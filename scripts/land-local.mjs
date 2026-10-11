#!/usr/bin/env node
// scripts/land-local.mjs - land a WI branch onto the project's main branch for a LOCAL project
// (no network remote, no GitHub PR). The GitHub PR path in land-changeset is unchanged and is
// never used here: a project with any git remote is refused and must use that path.
//
//   node "$SVC_ROOT"/scripts/land-local.mjs --root <wi-worktree> --wi <WI> [--json] [--dry-run] [--cleanup]
// --cleanup (run it from the project root) removes the WI worktree and its merged branch after a landing.
//
// Lands only when (1) the chain receipts validate for the LOCAL consumer
// (`check-chain-receipts --consumer stop`, note-sourced) for the WI tip as the full five-receipt
// envelope with mandatory cross-family adversarial review evidence (schema v3 reviewer_evidence and
// differing author/reviewer families; no same-host route exists), or for EVERY incoming commit
// (main..tip) as an eligible tree-bound quick-fix receipt, (2) the main checkout is clean and on the main branch, and
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
import { familyOf } from "./lib/cognitive-family.mjs";

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

// Dirty = ANY tracked or staged change (including tracked .svc/ files: they are part of the commit).
// Untracked files only matter when the incoming change would overwrite them (handled separately).
function dirtyTracked(root) {
  return git(root, ["status", "--porcelain", "--untracked-files=no"]).out.split(/\r?\n/).filter(Boolean);
}

function runChecker(wtRoot, sha, wi, extra) {
  const r = spawnSync(process.execPath, [CHECKER, "--sha", sha, "--wi", wi, "--consumer", "stop", ...extra], { cwd: wtRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* checker printed no JSON */ }
  const row = parsed?.results?.[0];
  return { ok: r.status === 0 && parsed?.ok === true, type: row?.type, missing: row?.missing || [(r.stderr || "").trim() || "receipt check failed"] };
}

// Receipt bodies for a commit from the git note (the only authority; the checker already required a note source).
function noteBodies(wtRoot, sha) {
  const n = git(wtRoot, ["notes", "--ref=svc-receipts", "show", sha], { allowFail: true });
  if (!n.ok) return [];
  let env;
  try { env = JSON.parse(n.out); } catch { return []; }
  const out = [];
  if (env && env.receipt_type) out.push(env);
  for (const [k, v] of Object.entries(env || {})) if (k !== "digests" && v && typeof v === "object" && !Array.isArray(v) && v.receipt_type) out.push(v);
  return out;
}

// Cross-family adversarial review is mandatory for the full chain. The shared checker grandfathers
// v1/v2 review envelopes for commits it cannot find in the framework's own object store, which is
// every commit of a user project, so require the verified v3 reviewer_evidence form here and
// re-derive the author/reviewer families from the receipt. Same-family or unknown never passes.
export function crossFamilyProblems(wtRoot, sha, wi) {
  const problems = [];
  for (const type of ["review-plan", "review-exec"]) {
    const bodies = noteBodies(wtRoot, sha).filter((b) => b.receipt_type === type && (!b.wi || b.wi.toLowerCase() === wi.toLowerCase()));
    if (!bodies.length) { problems.push(`${type}: no receipt in the note`); continue; }
    for (const b of bodies) {
      // an integer >= 3 only: strings, NaN, floats and missing values never reach (or skip) evidence verification
      if (!Number.isInteger(b.schema_version) || b.schema_version < 3 || !b.reviewer_evidence || typeof b.reviewer_evidence !== "object" || Array.isArray(b.reviewer_evidence)) {
        problems.push(`${type}: cross-family reviewer evidence required (schema_version >= 3 with reviewer_evidence); a v1/v2 or self-declared review is not accepted`);
        continue;
      }
      if (type === "review-exec") {
        const ar = b.adversarial_review || {};
        const reviewerHost = ar.fallback_used ? ar.fallback_host : ar.primary_reviewer_host;
        const af = familyOf(b.self_review?.orchestrator), rf = familyOf(reviewerHost);
        if (af === "unknown" || rf === "unknown" || af === rf) problems.push(`review-exec: not a cross-family review (author ${af}, reviewer ${rf})`);
      }
    }
  }
  return problems;
}

// Returns {mode, commits}. Full chain at the tip covers the whole branch (tree-bound reviews of the
// cumulative change). Otherwise EVERY incoming commit must carry its own eligible quick-fix receipt,
// so an unreviewed code commit cannot ride in under a later documentation-only commit.
function checkReceipts(wtRoot, tip, wi, incoming) {
  // The local cross-family fence runs BEFORE the shared checker: a review that fails it is never handed
  // to evidence verification (whose own version gate a non-integer schema_version could otherwise skip).
  const fullProblems = crossFamilyProblems(wtRoot, tip, wi);
  let full = null;
  if (!fullProblems.length) {
    full = runChecker(wtRoot, tip, wi, ["--expected-stage", "audit"]);
    if (full.ok) return { type: full.type || "complete", sha: tip, commits: incoming.length };
  }
  const quickFailures = [];
  const merges = incoming.filter((c) => git(wtRoot, ["rev-list", "--parents", "-n", "1", c]).out.split(" ").length > 2);
  if (merges.length) quickFailures.push(`merge commit(s) ${merges.map((c) => c.slice(0, 12)).join(", ")} in the WI branch need the full reviewed chain`);
  else {
    for (const c of incoming) {
      const q = runChecker(wtRoot, c, wi, []);
      if (!(q.ok && q.type === "quick-fix")) quickFailures.push(`${c.slice(0, 12)}: ${(q.missing || []).join("; ")}`);
    }
  }
  if (!quickFailures.length) return { type: "quick-fix", sha: tip, commits: incoming.length };
  const missing = fullProblems.length ? fullProblems : full.missing;
  throw new Refusal("RECEIPTS_MISSING", `chain receipts do not validate for local landing of ${incoming.length} incoming commit(s)`, { missing: [...missing, ...quickFailures], sha: tip });
}

function incomingCollisions(mainRoot, mainSha, tip) {
  // Paths the merge would add that collide with untracked files/dirs already in the main checkout.
  const added = git(mainRoot, ["diff", "--name-only", "--diff-filter=AR", "-z", mainSha, tip]).out.split("\0").filter(Boolean);
  const same = [];
  const clash = [];
  const tracked = (rel) => git(mainRoot, ["ls-files", "--error-unmatch", "--", rel], { allowFail: true }).ok;
  for (const rel of added) {
    // an untracked FILE where a parent directory of the incoming path is needed
    const parts = rel.split("/");
    let blocked = false;
    for (let i = 1; i < parts.length && !blocked; i++) {
      const anc = parts.slice(0, i).join("/");
      try { if (fs.lstatSync(path.join(mainRoot, anc)).isFile() && !tracked(anc)) blocked = true; } catch { break; }
    }
    if (blocked) { clash.push(rel); continue; }
    const abs = path.join(mainRoot, rel);
    let st;
    try { st = fs.lstatSync(abs); } catch { continue; }
    if (tracked(rel)) continue;
    if (!st.isFile()) { clash.push(rel); continue; } // untracked directory (or link) where a file arrives
    const incoming = spawnSync("git", ["-C", mainRoot, "cat-file", "blob", `${tip}:${rel}`], { maxBuffer: 256 * 1024 * 1024 });
    const equal = incoming.status === 0 && Buffer.compare(incoming.stdout, fs.readFileSync(abs)) === 0;
    (equal ? same : clash).push(rel);
  }
  return { same, clash };
}

// Identical untracked copies are moved aside (never deleted) and restored on any failure.
export function setAside(mainRoot, rels) {
  const dir = path.join(git(mainRoot, ["rev-parse", "--absolute-git-dir"]).out, `svc-land-local-aside-${process.pid}`);
  const moved = [];
  const restore = () => {
    const failed = [];
    for (const rel of moved.splice(0).reverse()) {
      const target = path.join(mainRoot, rel);
      try {
        if (fs.existsSync(target)) continue;
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.renameSync(path.join(dir, rel), target);
      } catch { failed.push(rel); }
    }
    if (!failed.length) fs.rmSync(dir, { recursive: true, force: true });
    return failed;
  };
  try {
    for (const rel of rels) {
      const dest = path.join(dir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(path.join(mainRoot, rel), dest);
      moved.push(rel);
    }
  } catch (e) {
    // all-or-nothing: put back everything already moved before surfacing the failure
    const failed = restore();
    throw new Refusal("ASIDE_FAILED", `could not set aside identical untracked files (${e.message}); ${failed.length ? `COULD NOT RESTORE ${failed.join(", ")} - copies kept in ${dir}` : "all restored"}`);
  }
  return { restore, discard() { fs.rmSync(dir, { recursive: true, force: true }); } };
}

// Package-resolved cleanup (no project-local scripts/hooks needed): only after the WI tip is in main.
function cleanupWorktree(mainRoot, wtTop, branch, mainBranch, tip) {
  const cwd = (() => { try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); } })();
  if (cwd === wtTop || cwd.startsWith(wtTop + path.sep)) return "skipped-cwd-inside-worktree: run from the project root";
  if (!isAncestor(mainRoot, tip, resolveRef(mainRoot, `refs/heads/${mainBranch}`))) return "skipped-not-landed";
  if (dirtyTracked(wtTop).length) return "skipped-tracked-changes";
  // Tracked work is clean and landed; what `--force` discards is untracked/ignored scratch (.svc state).
  const rm = git(mainRoot, ["worktree", "remove", "--force", wtTop], { allowFail: true });
  if (!rm.ok) return `worktree-remove-failed: ${rm.err || rm.out}`;
  const br = git(mainRoot, ["branch", "-d", branch], { allowFail: true });
  return br.ok ? "removed" : `worktree-removed-branch-kept: ${br.err || br.out}`;
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

const ZERO_OID = "0".repeat(40);
export function advanceLocalOrigin(mainRoot, newMain, seams = {}) {
  if (git(mainRoot, ["remote"]).out) return "skipped-has-remote";
  const ref = "refs/remotes/origin/main";
  let result = "unchanged";
  // compare-and-swap on the observed value; on a lost race re-read and revalidate ancestry (never rewind)
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = resolveRef(mainRoot, ref);
    if (current === newMain) break;
    if (current && !isAncestor(mainRoot, current, newMain)) return "skipped-diverged";
    if (seams.beforeCas) seams.beforeCas(attempt); // test seam only: simulates a concurrent writer
    const cas = git(mainRoot, ["update-ref", ref, newMain, current || ZERO_OID], { allowFail: true });
    if (cas.ok) { result = "advanced"; break; }
    result = "skipped-concurrent";
  }
  if (result !== "skipped-concurrent" && !git(mainRoot, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"], { allowFail: true }).ok) {
    git(mainRoot, ["symbolic-ref", "refs/remotes/origin/HEAD", ref]);
  }
  return result;
}

export function landLocal({ root, wi, dryRun = false, cleanup = false }) {
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

  const mainSha = resolveRef(mainRoot, `refs/heads/${mainBranch}`);
  // Receipts first: the same check also makes an already-landed repeat run honest (receipts persist).
  // An already-landed branch has no incoming commits, so it is judged on its tip's full-chain/quick-fix receipt.
  const incoming = git(wtTop, ["rev-list", "--reverse", `${mainSha}..${tip}`]).out.split(/\r?\n/).filter(Boolean);
  const receipts = checkReceipts(wtTop, tip, wi, incoming.length ? incoming : [tip]);

  const common = { branch, main_branch: mainBranch, main_root: mainRoot, wi_sha: tip, receipts: receipts.type };

  if (isAncestor(mainRoot, tip, mainSha)) {
    const origin = dryRun ? "not-run" : advanceLocalOrigin(mainRoot, mainSha);
    const cleaned = cleanup && !dryRun ? cleanupWorktree(mainRoot, wtTop, branch, mainBranch, tip) : undefined;
    return { landed: true, main_sha: mainSha, method: "already-landed", dry_run: dryRun || undefined, local_origin_ref: origin, ...(cleaned ? { cleanup: cleaned } : {}), ...common };
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

  const aside = setAside(mainRoot, same);
  try {
    if (ff) {
      const r = git(mainRoot, ["merge", "--ff-only", "--quiet", tip], { allowFail: true });
      if (!r.ok) throw new Refusal("MERGE_FAILED", `git merge failed; main is unchanged: ${r.err || r.out}`);
    } else {
      const hasIdent = git(mainRoot, ["config", "user.name"], { allowFail: true }).ok && git(mainRoot, ["config", "user.email"], { allowFail: true }).ok;
      const ident = hasIdent ? [] : ["-c", "user.name=svc-land-local", "-c", "user.email=svc-land-local@localhost"];
      const r = git(mainRoot, [...ident, "merge", "--no-ff", "--no-edit", "--quiet", "-m", `Land ${wi}: merge ${branch} into ${mainBranch}`, tip], { allowFail: true });
      if (!r.ok) {
        git(mainRoot, ["merge", "--abort"], { allowFail: true });
        throw new Refusal("MERGE_FAILED", `git merge failed and was aborted; main is unchanged: ${r.err || r.out}`);
      }
    }
  } catch (e) {
    aside.restore();
    throw e;
  }
  aside.discard();
  const newMain = resolveRef(mainRoot, "HEAD");
  const origin = advanceLocalOrigin(mainRoot, newMain);
  const cleaned = cleanup ? cleanupWorktree(mainRoot, wtTop, branch, mainBranch, tip) : undefined;
  return { landed: true, main_sha: newMain, previous_main_sha: mainSha, method, local_origin_ref: origin, ...(cleaned ? { cleanup: cleaned } : {}), ...common };
}

function parseArgs(argv) {
  const o = { root: null, wi: null, json: false, dryRun: false, cleanup: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") o.root = argv[++i];
    else if (a === "--wi") o.wi = argv[++i];
    else if (a === "--json") o.json = true;
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--cleanup") o.cleanup = true;
    else if (a === "-h" || a === "--help") o.help = true;
    else { console.error(`land-local: unknown argument ${a}`); process.exit(1); }
  }
  return o;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log("usage: land-local.mjs --root <wi-worktree> --wi <WI-###> [--json] [--dry-run] [--cleanup]"); return; }
  try {
    const result = landLocal({ root: args.root, wi: args.wi, dryRun: args.dryRun, cleanup: args.cleanup });
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
