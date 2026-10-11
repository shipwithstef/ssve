#!/usr/bin/env node
// scripts/land-local.mjs - land a WI branch onto the project's main branch for a LOCAL project
// (no network remote, no GitHub PR). The GitHub PR path in land-changeset is unchanged and is
// never used here: a project with any git remote is refused and must use that path.
//
//   node "$SVC_ROOT"/scripts/land-local.mjs --root <wi-worktree> --wi <WI> [--json] [--dry-run]
//
// Lands only when (1) the chain receipts for the WI branch tip validate for the LOCAL consumer
// (`check-chain-receipts --consumer stop`, note-sourced; the full five-receipt envelope, or an
// eligible quick-fix receipt), (2) the main checkout is clean and on the main branch, and
// (3) the merge cannot conflict. It fast-forwards main when possible, otherwise makes a merge
// commit; it never rewrites history, never forces and never auto-resolves a conflict.
// Receipts are git notes keyed by commit SHA in the shared object store, so they stay attached to
// the WI tip commit, which becomes (or stays) an ancestor of main; nothing needs moving.
// When no origin remote exists, refs/remotes/origin/main is advanced to the new main so the
// local stand-in for origin follows the landed state (as svc-bootstrap-repo does).
//
// Exit: 0 landed or already landed (also --dry-run that would land), 2 refused, 1 usage/error.
// stdout (--json): {landed, main_sha, method, ...}; refusals add {refused, reason, detail}.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CHECKER = path.join(SCRIPT_DIR, "check-chain-receipts.mjs");
const WI_RE = /^WI-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i;

class Refusal extends Error {
  constructor(reason, detail, extra = {}) { super(`${reason}: ${detail}`); this.reason = reason; this.detail = detail; this.extra = extra; }
}

function git(cwd, args, opts = {}) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: opts.env || process.env, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && !opts.allowFail) throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
  return { ok: r.status === 0, status: r.status, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
}

function resolveRef(cwd, ref) {
  const r = git(cwd, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFail: true });
  return r.ok ? r.out : null;
}

function isAncestor(cwd, a, b) {
  return git(cwd, ["merge-base", "--is-ancestor", a, b], { allowFail: true }).ok;
}

// First entry of `git worktree list` is always the main worktree (the project's own checkout).
function mainCheckout(cwd) {
  const out = git(cwd, ["worktree", "list", "--porcelain"]).out;
  const first = out.split(/\r?\n\r?\n/)[0] || "";
  const m = /^worktree (.+)$/m.exec(first);
  if (!m) throw new Refusal("NO_MAIN_CHECKOUT", "cannot locate the main checkout of this repository");
  if (/^bare$/m.test(first)) throw new Refusal("NO_MAIN_CHECKOUT", "repository is bare; there is no main checkout to update");
  return fs.realpathSync(m[1]);
}

function mainBranchName(mainRoot) {
  const sym = git(mainRoot, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], { allowFail: true });
  if (sym.ok && sym.out.startsWith("origin/")) {
    const n = sym.out.slice("origin/".length);
    if (resolveRef(mainRoot, `refs/heads/${n}`)) return n;
  }
  for (const n of ["main", "master"]) if (resolveRef(mainRoot, `refs/heads/${n}`)) return n;
  throw new Refusal("NO_MAIN_BRANCH", "no main or master branch exists in this repository");
}

// Dirty = tracked changes or staged changes. Untracked files only matter when the incoming
// change would overwrite them (handled separately), and .svc/ is workflow state, never work product.
function dirtyTracked(root) {
  const lines = git(root, ["status", "--porcelain", "--untracked-files=no"]).out.split(/\r?\n/).filter(Boolean);
  return lines.filter((l) => !/^\S{1,2}\s+\.svc\//.test(l));
}

function checkReceipts(wtRoot, tip, wi) {
  const run = (extra) => {
    const r = spawnSync(process.execPath, [CHECKER, "--sha", tip, "--wi", wi, "--consumer", "stop", ...extra], { cwd: wtRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    let parsed = null;
    try { parsed = JSON.parse(r.stdout); } catch { /* checker printed no JSON */ }
    return { status: r.status, parsed, stderr: (r.stderr || "").trim() };
  };
  // Strict: the whole five-receipt chain (note-sourced). Never weaker than the push consumer's full set.
  const full = run(["--expected-stage", "audit"]);
  if (full.status === 0 && full.parsed?.ok === true) return { type: full.parsed.results?.[0]?.type || "complete", sha: tip };
  // An eligible, tree-bound, re-verified quick-fix receipt is the framework's only lighter lane.
  const derived = run([]);
  const row = derived.parsed?.results?.[0];
  if (derived.status === 0 && derived.parsed?.ok === true && row?.type === "quick-fix") return { type: "quick-fix", sha: tip };
  const missing = full.parsed?.results?.[0]?.missing || derived.parsed?.results?.[0]?.missing || [full.stderr || derived.stderr || "receipt check failed"];
  throw new Refusal("RECEIPTS_MISSING", `chain receipts for ${tip.slice(0, 12)} do not validate for local landing`, { missing, sha: tip });
}

function incomingCollisions(mainRoot, mainSha, tip) {
  // Paths the merge would add that already exist as untracked files in the main checkout.
  const added = git(mainRoot, ["diff", "--name-only", "--diff-filter=AR", "-z", mainSha, tip]).out.split("\0").filter(Boolean);
  const same = [];
  const clash = [];
  for (const rel of added) {
    const abs = path.join(mainRoot, rel);
    if (!fs.existsSync(abs) || git(mainRoot, ["ls-files", "--error-unmatch", "--", rel], { allowFail: true }).ok) continue;
    const incoming = spawnSync("git", ["-C", mainRoot, "cat-file", "blob", `${tip}:${rel}`], { maxBuffer: 256 * 1024 * 1024 });
    let equal = false;
    try { equal = incoming.status === 0 && fs.statSync(abs).isFile() && Buffer.compare(incoming.stdout, fs.readFileSync(abs)) === 0; } catch { equal = false; }
    (equal ? same : clash).push(rel);
  }
  return { same, clash };
}

function conflictCheck(mainRoot, mainSha, tip) {
  const r = git(mainRoot, ["merge-tree", "--write-tree", "--name-only", "--no-messages", mainSha, tip], { allowFail: true });
  if (r.ok) return [];
  if (r.status === 1) {
    const lines = r.out.split(/\r?\n/).filter(Boolean).slice(1); // first line is the tree id
    return lines.length ? lines : ["(unspecified conflict)"];
  }
  throw new Error(`git merge-tree failed: ${r.err || r.out}`);
}

function advanceLocalOrigin(mainRoot, newMain) {
  if (git(mainRoot, ["remote"]).out) return "skipped-has-remote";
  const ref = "refs/remotes/origin/main";
  const current = resolveRef(mainRoot, ref);
  if (current === newMain) return "unchanged";
  if (current && !isAncestor(mainRoot, current, newMain)) return "skipped-diverged";
  git(mainRoot, ["update-ref", ref, newMain]);
  if (!git(mainRoot, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], { allowFail: true }).ok) {
    git(mainRoot, ["symbolic-ref", "refs/remotes/origin/HEAD", ref]);
  }
  return "advanced";
}

export function landLocal({ root, wi, dryRun = false }) {
  if (!wi || !WI_RE.test(wi)) throw new Refusal("USAGE", "--wi <WI-###> is required");
  const wtRoot = fs.realpathSync(path.resolve(root || process.cwd()));
  const top = git(wtRoot, ["rev-parse", "--show-toplevel"], { allowFail: true });
  if (!top.ok) throw new Refusal("NOT_A_REPO", `${wtRoot} is not inside a git work tree`);
  const wtTop = fs.realpathSync(top.out);

  // A real remote means the PR path owns landing; same-host review receipts must never grant that.
  const remotes = git(wtTop, ["remote"]).out.split(/\r?\n/).filter(Boolean);
  if (remotes.length) throw new Refusal("HAS_REMOTE", `repository has remote(s) [${remotes.join(", ")}]; land through the push/PR path in land-changeset, not land-local`, { remotes });

  const mainRoot = mainCheckout(wtTop);
  const mainBranch = mainBranchName(mainRoot);
  const branch = git(wtTop, ["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFail: true }).out;
  if (!branch) throw new Refusal("DETACHED_HEAD", "the WI worktree is on a detached HEAD; check out the WI branch");
  if (branch === mainBranch) throw new Refusal("NOT_A_WI_BRANCH", `${wtTop} is on ${mainBranch}; run land-local from the WI worktree`);
  const tip = resolveRef(wtTop, "HEAD");

  const tracked = dirtyTracked(wtTop);
  if (tracked.length) throw new Refusal("WI_WORKTREE_DIRTY", "the WI worktree has uncommitted tracked changes that would not be delivered; commit them first", { paths: tracked });

  // Receipts first: the same check also makes an already-landed repeat run honest (receipts persist).
  const receipts = checkReceipts(wtTop, tip, wi);

  const mainSha = resolveRef(mainRoot, `refs/heads/${mainBranch}`);
  const common = { branch, main_branch: mainBranch, main_root: mainRoot, wi_sha: tip, receipts: receipts.type };

  if (isAncestor(mainRoot, tip, mainSha)) {
    const origin = dryRun ? "not-run" : advanceLocalOrigin(mainRoot, mainSha);
    return { landed: true, main_sha: mainSha, method: "already-landed", dry_run: dryRun || undefined, local_origin_ref: origin, ...common };
  }

  const onBranch = git(mainRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFail: true }).out;
  if (onBranch !== mainBranch) throw new Refusal("MAIN_CHECKOUT_OFF_BRANCH", `the main checkout is on ${onBranch || "a detached HEAD"}, not ${mainBranch}; it is not changed automatically`);
  const dirty = dirtyTracked(mainRoot);
  if (dirty.length) throw new Refusal("MAIN_DIRTY", "the main checkout has uncommitted tracked changes; commit or stash them, then re-run", { paths: dirty });

  const { same, clash } = incomingCollisions(mainRoot, mainSha, tip);
  if (clash.length) throw new Refusal("MAIN_UNTRACKED_COLLISION", "untracked files in the main checkout would be overwritten by the incoming change", { paths: clash });

  const ff = isAncestor(mainRoot, mainSha, tip);
  if (!ff) {
    const conflicts = conflictCheck(mainRoot, mainSha, tip);
    if (conflicts.length) throw new Refusal("MERGE_CONFLICT", "the WI branch conflicts with main; resolve it in the WI worktree (merge main into the branch), re-review as needed, then re-run", { conflicts });
  }
  const method = ff ? "fast-forward" : "merge-commit";
  if (dryRun) return { landed: false, would_land: true, main_sha: mainSha, method, dry_run: true, ...common };

  // Identical untracked copies (e.g. state files written into the main checkout earlier) are safe to drop.
  for (const rel of same) fs.rmSync(path.join(mainRoot, rel), { force: true });

  if (ff) {
    git(mainRoot, ["merge", "--ff-only", "--quiet", tip]);
  } else {
    const hasIdent = git(mainRoot, ["config", "user.name"], { allowFail: true }).ok && git(mainRoot, ["config", "user.email"], { allowFail: true }).ok;
    const ident = hasIdent ? [] : ["-c", "user.name=svc-land-local", "-c", "user.email=svc-land-local@localhost"];
    const r = git(mainRoot, [...ident, "merge", "--no-ff", "--no-edit", "--quiet", "-m", `Land ${wi}: merge ${branch} into ${mainBranch}`, tip], { allowFail: true });
    if (!r.ok) {
      git(mainRoot, ["merge", "--abort"], { allowFail: true });
      throw new Refusal("MERGE_FAILED", `git merge failed and was aborted; main is unchanged: ${r.err || r.out}`);
    }
  }
  const newMain = resolveRef(mainRoot, "HEAD");
  const origin = advanceLocalOrigin(mainRoot, newMain);
  return { landed: true, main_sha: newMain, previous_main_sha: mainSha, method, local_origin_ref: origin, ...common };
}

function parseArgs(argv) {
  const o = { root: null, wi: null, json: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") o.root = argv[++i];
    else if (a === "--wi") o.wi = argv[++i];
    else if (a === "--json") o.json = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "-h" || a === "--help") o.help = true;
    else { console.error(`land-local: unknown argument ${a}`); process.exit(1); }
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log("usage: land-local.mjs --root <wi-worktree> --wi <WI-###> [--json] [--dry-run]"); return; }
  try {
    const result = landLocal({ root: args.root, wi: args.wi, dryRun: args.dryRun });
    console.log(args.json ? JSON.stringify(result, null, 2) : `${result.landed ? "landed" : "would land"} ${result.branch} on ${result.main_branch} at ${result.main_sha.slice(0, 12)} (${result.method})`);
  } catch (e) {
    if (e instanceof Refusal) {
      const body = { landed: false, refused: true, reason: e.reason, detail: e.detail, ...e.extra };
      if (args.json) console.log(JSON.stringify(body, null, 2));
      else console.error(`land-local refused: ${e.reason}: ${e.detail}${e.extra.missing ? ` (${e.extra.missing.join("; ")})` : ""}${e.extra.conflicts ? ` (${e.extra.conflicts.join(", ")})` : ""}${e.extra.paths ? ` (${e.extra.paths.join(", ")})` : ""}`);
      process.exit(e.reason === "USAGE" ? 1 : 2);
    }
    console.error(`land-local: ${e.message}`);
    process.exit(1);
  }
}

if (isMain(import.meta.url)) main();
