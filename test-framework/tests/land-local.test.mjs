// @organism-suite
// land-local: lands a WI branch onto main for a project with no network remote (no model, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { advanceLocalOrigin, crossFamilyProblems, setAside, landLocal } from "../../scripts/land-local.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAND = path.join(ROOT, "scripts", "land-local.mjs");
const EMIT = path.join(ROOT, "scripts", "emit-receipt.mjs");
const WI = "WI-T1";

const cleanEnv = () => {
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (k.startsWith("GIT_") || k === "NODE_TEST_CONTEXT") delete env[k];
  return env;
};
function git(cwd, ...args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: cleanEnv() });
  assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
}

// A fresh user project: one root commit on main, local refs/remotes/origin/main, no remote, WI worktree.
function fixture() {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "land-local-")));
  const main = path.join(base, "proj");
  const wt = path.join(base, "wt");
  fs.mkdirSync(main);
  git(main, "init", "-q", "-b", "main");
  git(main, "config", "user.name", "tester");
  git(main, "config", "user.email", "tester@example.invalid");
  fs.writeFileSync(path.join(main, "spec.md"), "line one\nline two\nline three\n");
  git(main, "add", "-A");
  git(main, "commit", "-qm", "root");
  git(main, "update-ref", "refs/remotes/origin/main", "HEAD");
  git(main, "worktree", "add", "-q", "-b", "wi/t1", wt);
  return { base, main, wt };
}
const commitInWt = (f, file, content, msg = "wi change") => {
  fs.writeFileSync(path.join(f.wt, file), content);
  git(f.wt, "add", "--", file);
  git(f.wt, "commit", "-qm", msg);
  return git(f.wt, "rev-parse", "HEAD");
};
// Stub receipt arrangement: an eligible quick-fix receipt written as a git note on a commit.
// By default it is bound to that commit's own tree; `tree` overrides it to simulate a stale receipt.
function stubReceipt(f, { sha = "HEAD", tree = null } = {}) {
  const body = { receipt_type: "quick-fix", schema_version: 1, tree_hash: tree || git(f.wt, "rev-parse", `${sha}^{tree}`), eligible: true, reasons: [], files: ["spec.md"], timestamp: new Date().toISOString() };
  const args = [EMIT, "--type", "quick-fix", "--wi", WI, ...(sha === "HEAD" ? [] : ["--sha", git(f.wt, "rev-parse", sha)])];
  const r = spawnSync(process.execPath, args, { cwd: f.wt, input: JSON.stringify(body), encoding: "utf8", env: cleanEnv() });
  assert.equal(r.status, 0, r.stderr);
}
// In-process land with the receipt check stubbed: exercises the git mechanics only. The CLI never sets this seam.
for (const k of Object.keys(process.env)) if (k.startsWith("GIT_")) delete process.env[k];
const landIn = (f, opts = {}) => {
  try { return { status: 0, json: landLocal({ root: f.wt, wi: WI, receiptCheck: () => ({ type: "complete" }), ...opts }) }; }
  catch (e) { if (e.reason) return { status: 2, json: { refused: true, reason: e.reason, detail: e.detail, ...e.extra } }; throw e; }
};
// Real CLI, real receipt check (no seam).
const land = (f, extra = []) => {
  const r = spawnSync(process.execPath, [LAND, "--root", f.wt, "--wi", WI, "--json", ...extra], { encoding: "utf8", env: cleanEnv() });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* leave null */ }
  return { status: r.status, json, stderr: r.stderr };
};
const head = (dir) => git(dir, "rev-parse", "HEAD");
const read = (dir, file) => fs.readFileSync(path.join(dir, file), "utf8");
const gitHooksDir = (f) => path.join(git(f.main, "rev-parse", "--absolute-git-dir"), "hooks");
const evidenceBody = (extra = {}) => ({ receipt_type: "review-exec", wi: WI, schema_version: 3, verdict: "pass", reviewer_evidence: { independent: true, submitter_only: false, launcher_receipts: [{ path: ".svc/external-review-artifacts/none.json", sha256: "0".repeat(64) }], commands: ["x"], output_artifacts: [{ path: "x", sha256: "0".repeat(64) }] }, self_review: { orchestrator: "claude" }, adversarial_review: { primary_reviewer_host: "codex", primary_used: true, fallback_host: "codex", fallback_used: false, findings: [], iteration_count: 1 }, ...extra });
const putNote = (f, sha, env) => assert.equal(spawnSync("git", ["-C", f.wt, "notes", "--ref=svc-receipts", "add", "-f", "-m", JSON.stringify(env), sha], { encoding: "utf8", env: cleanEnv() }).status, 0);

test("fast-forward lands into the main checkout, advances local origin/main, repeat run is a no-op", () => {
  const f = fixture();
  commitInWt(f, "spec.md", "line one\nline two\nline three\nadded by wi\n");
  const tip = commitInWt(f, "extra.md", "new file\n", "second");
  assert.match(read(f.main, "spec.md"), /^line one\nline two\nline three\n$/);
  const r = landIn(f);
  assert.equal(r.status, 0);
  assert.equal(r.json.landed, true);
  assert.equal(r.json.method, "fast-forward");
  assert.equal(r.json.main_sha, tip);
  assert.equal(head(f.main), tip);
  assert.match(read(f.main, "spec.md"), /added by wi/);
  assert.equal(read(f.main, "extra.md"), "new file\n");
  assert.equal(git(f.main, "status", "--porcelain"), "");
  assert.equal(git(f.main, "rev-parse", "refs/remotes/origin/main"), tip);
  assert.equal(r.json.local_origin_ref, "advanced");
  const again = landIn(f);
  assert.equal(again.json.method, "already-landed");
  assert.equal(again.json.main_sha, tip);
  assert.equal(head(f.main), tip);
});

test("no receipts at all: refused with the cross-family chain requirement, nothing changes", () => {
  const f = fixture();
  commitInWt(f, "spec.md", "changed\n");
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.match(r.json.detail, /cross-family adversarial reviews/);
  assert.equal(head(f.main), mainBefore);
  assert.match(read(f.main, "spec.md"), /line one/);
  assert.equal(git(f.main, "rev-parse", "refs/remotes/origin/main"), mainBefore);
});

test("quick-fix receipts alone can never land, even valid ones on every commit", () => {
  const f = fixture();
  commitInWt(f, "spec.md", "line one\nline two edited\nline three\n", "docs 1");
  stubReceipt(f);
  commitInWt(f, "spec.md", "line one\nline two edited again\nline three\n", "docs 2");
  stubReceipt(f);
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.match(r.json.detail, /quick-fix receipts and same-host reviews cannot land/);
  assert.equal(head(f.main), mainBefore);
  assert.equal(land(f, ["--dry-run"]).status, 2);
});

test("cross-family fence: malformed versions, v1/v2, same-family, unknown family and fabricated evidence are rejected", () => {
  const f = fixture();
  const sha = commitInWt(f, "spec.md", "x\n");
  const env = (exec, plan = exec) => ({ "review-plan": { ...evidenceBody(plan), receipt_type: "review-plan" }, "review-exec": { ...evidenceBody(exec), receipt_type: "review-exec" } });
  for (const bad of ["not-a-version", "3", 3.5, null, NaN, undefined, 2]) {
    putNote(f, sha, env({ schema_version: bad }));
    assert.match(crossFamilyProblems(f.wt, sha, WI).join("|"), /cross-family reviewer evidence required/, `schema_version ${String(bad)}`);
  }
  putNote(f, sha, env({ adversarial_review: { primary_reviewer_host: "claude", primary_used: true, fallback_host: "claude", fallback_used: false, findings: [], iteration_count: 1 } }));
  assert.match(crossFamilyProblems(f.wt, sha, WI).join("|"), /not a cross-family review|reviewer evidence not verified/);
  putNote(f, sha, env({ self_review: { orchestrator: "mystery" } }));
  assert.ok(crossFamilyProblems(f.wt, sha, WI).length > 0);
  // integer version 3, plausible cross-family hosts, but the launcher evidence is fabricated: authentication fails
  putNote(f, sha, env({}));
  const problems = crossFamilyProblems(f.wt, sha, WI).join("|");
  assert.match(problems, /review-exec: reviewer evidence not verified/);
  assert.match(problems, /review-plan: reviewer evidence not verified/);
});

test("a full-looking chain with integer review versions and fabricated launcher evidence is refused before the shared checker", () => {
  const f = fixture();
  const sha = commitInWt(f, "spec.md", "x\n");
  const rec = (type) => ({ receipt_type: type, wi: WI, schema_version: 3, verdict: "pass" });
  putNote(f, sha, {
    "plan-manifest": rec("plan-manifest"), "exec-record": rec("exec-record"), "audit-implementation": rec("audit-implementation"),
    "review-plan": { ...evidenceBody(), receipt_type: "review-plan" }, "review-exec": evidenceBody(),
  });
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.ok(r.json.missing.some((m) => /reviewer evidence not verified/.test(m)), JSON.stringify(r.json.missing));
  assert.equal(r.json.missing.includes("plan-manifest"), false, "the shared checker must not have been reached");
  assert.equal(head(f.main), mainBefore);
});

test("refuses on a dirty main checkout", () => {
  const f = fixture();
  commitInWt(f, "extra.md", "x\n");
  fs.writeFileSync(path.join(f.main, "spec.md"), "local edit in main\n");
  const mainBefore = head(f.main);
  const r = landIn(f);
  assert.equal(r.json.reason, "MAIN_DIRTY");
  assert.equal(head(f.main), mainBefore);
  assert.equal(read(f.main, "spec.md"), "local edit in main\n");
  assert.equal(fs.existsSync(path.join(f.main, "extra.md")), false);
});

test("a main that moved is refused (fast-forward only, no merge commit), conflicting or not, and nothing changes", () => {
  for (const conflicting of [true, false]) {
    const f = fixture();
    const wiTip = commitInWt(f, conflicting ? "spec.md" : "wi.md", conflicting ? "line one\nWI says two\nline three\n" : "from wi\n");
    if (conflicting) fs.writeFileSync(path.join(f.main, "spec.md"), "line one\nMAIN says two\nline three\n");
    else fs.writeFileSync(path.join(f.main, "main-only.md"), "from main\n");
    git(f.main, "add", "-A");
    git(f.main, "commit", "-qm", "main moves");
    git(f.main, "update-ref", "refs/remotes/origin/main", "HEAD");
    const mainBefore = head(f.main);
    const refs = git(f.main, "for-each-ref", "--format=%(refname) %(objectname)");
    const r = landIn(f);
    assert.equal(r.status, 2);
    assert.equal(r.json.reason, "MAIN_MOVED");
    assert.match(r.json.detail, /Merge main into the WI branch/);
    assert.match(r.json.detail, /re-run the plan\/exec\/audit reviews/);
    assert.equal(head(f.main), mainBefore);
    assert.equal(git(f.main, "status", "--porcelain"), "");
    assert.equal(git(f.main, "for-each-ref", "--format=%(refname) %(objectname)"), refs);
    // once the WI branch contains main (merge, no rebase) the landing is a plain fast-forward of that tip
    git(f.wt, "merge", "-q", "--no-edit", ...(conflicting ? ["-X", "ours"] : []), "main");
    const merged = head(f.wt);
    assert.notEqual(merged, wiTip);
    const ok = landIn(f);
    assert.equal(ok.json.method, "fast-forward");
    assert.equal(head(f.main), merged);
  }
});

test("a real remote is not routed here", () => {
  const f = fixture();
  commitInWt(f, "extra.md", "x\n");
  git(f.main, "remote", "add", "origin", "https://example.invalid/acme/app.git");
  const mainBefore = head(f.main);
  const r = landIn(f);
  assert.equal(r.json.reason, "HAS_REMOTE");
  assert.equal(head(f.main), mainBefore);
  assert.equal(land(f).json.reason, "HAS_REMOTE");
});

test("untracked state in main: identical copy is moved aside and kept, a differing copy is refused", () => {
  const f = fixture();
  commitInWt(f, "state.md", "shared state\n");
  fs.writeFileSync(path.join(f.main, "state.md"), "different\n");
  const mainBefore = head(f.main);
  const blocked = landIn(f);
  assert.equal(blocked.json.reason, "MAIN_UNTRACKED_COLLISION");
  assert.equal(head(f.main), mainBefore);
  assert.equal(read(f.main, "state.md"), "different\n");
  fs.writeFileSync(path.join(f.main, "state.md"), "shared state\n");
  assert.equal(landIn(f).status, 0);
  assert.equal(read(f.main, "state.md"), "shared state\n");
  assert.equal(git(f.main, "status", "--porcelain"), "");
});

test("refuses when the main checkout is not on the main branch, and --dry-run lands nothing", () => {
  const f = fixture();
  commitInWt(f, "extra.md", "x\n");
  const mainBefore = head(f.main);
  const dry = landIn(f, { dryRun: true });
  assert.equal(dry.json.would_land, true);
  assert.equal(dry.json.landed, false);
  assert.equal(head(f.main), mainBefore);
  git(f.main, "checkout", "-q", "-b", "scratch");
  assert.equal(landIn(f).json.reason, "MAIN_CHECKOUT_OFF_BRANCH");
  assert.equal(git(f.main, "rev-parse", "refs/heads/main"), mainBefore);
});

test("tracked .svc/ changes are dirty in both checkouts", () => {
  const f = fixture();
  fs.mkdirSync(path.join(f.main, ".svc"));
  fs.writeFileSync(path.join(f.main, ".svc", "state.json"), "{}\n");
  git(f.main, "add", "-f", ".svc/state.json");
  git(f.main, "commit", "-qm", "track svc state");
  git(f.wt, "merge", "-q", "--ff-only", "main");
  commitInWt(f, "extra.md", "x\n");
  fs.writeFileSync(path.join(f.wt, ".svc", "state.json"), '{"wip":true}\n');
  const mainBefore = head(f.main);
  assert.equal(landIn(f).json.reason, "WI_WORKTREE_DIRTY");
  git(f.wt, "checkout", "--", ".svc/state.json");
  fs.writeFileSync(path.join(f.main, ".svc", "state.json"), '{"wip":true}\n');
  assert.equal(landIn(f).json.reason, "MAIN_DIRTY");
  assert.equal(head(f.main), mainBefore);
});

test("a failed fast-forward restores identical untracked files that were set aside", () => {
  const f = fixture();
  commitInWt(f, "state.md", "shared state\n");
  const hook = path.join(gitHooksDir(f), "reference-transaction");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, "#!/bin/sh\nif [ \"$1\" = prepared ]; then cat | grep -q refs/heads/main && exit 1; fi\nexit 0\n", { mode: 0o755 });
  fs.writeFileSync(path.join(f.main, "state.md"), "shared state\n");
  const mainBefore = head(f.main);
  const r = landIn(f);
  assert.equal(r.json.reason, "MERGE_FAILED");
  assert.equal(head(f.main), mainBefore);
  assert.equal(read(f.main, "state.md"), "shared state\n");
  assert.equal(git(f.main, "status", "--porcelain"), "?? state.md");
});

test("an untracked directory where an incoming file lands is a collision, not a deletion", () => {
  const f = fixture();
  commitInWt(f, "docs", "now a file\n");
  fs.mkdirSync(path.join(f.main, "docs"));
  fs.writeFileSync(path.join(f.main, "docs", "keep.md"), "keep\n");
  assert.equal(landIn(f).json.reason, "MAIN_UNTRACKED_COLLISION");
  assert.equal(read(f.main, "docs/keep.md"), "keep\n");
});

test("origin/main update is compare-and-swap: a concurrent advance is never rewound", () => {
  const f = fixture();
  const base = head(f.main);
  fs.writeFileSync(path.join(f.main, "a.md"), "a\n");
  git(f.main, "add", "-A");
  git(f.main, "commit", "-qm", "a");
  const newMain = head(f.main);
  git(f.main, "checkout", "-q", "--detach", base);
  fs.writeFileSync(path.join(f.main, "c.md"), "c\n");
  git(f.main, "add", "-A");
  git(f.main, "commit", "-qm", "concurrent");
  const concurrent = head(f.main);
  git(f.main, "checkout", "-q", "main");
  const result = advanceLocalOrigin(f.main, newMain, { beforeCas: () => git(f.main, "update-ref", "refs/remotes/origin/main", concurrent) });
  assert.match(result, /^skipped-/);
  assert.equal(git(f.main, "rev-parse", "refs/remotes/origin/main"), concurrent);
});

test("setAside is all-or-nothing: a failed later move restores every earlier one", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.main, "one.md"), "1\n");
  fs.mkdirSync(path.join(f.main, "d"));
  fs.writeFileSync(path.join(f.main, "d", "two.md"), "2\n");
  const aside = path.join(git(f.main, "rev-parse", "--absolute-git-dir"), `svc-land-local-aside-${process.pid}`);
  fs.mkdirSync(aside, { recursive: true });
  fs.writeFileSync(path.join(aside, "d"), "in the way");
  assert.throws(() => setAside(f.main, ["one.md", "d/two.md"]), (e) => e.reason === "ASIDE_FAILED" && /all restored/.test(e.detail));
  assert.equal(read(f.main, "one.md"), "1\n");
  assert.equal(read(f.main, "d/two.md"), "2\n");
  assert.equal(fs.existsSync(aside), false);
});

test("--cleanup removes the landed worktree and branch with git only, never from inside it", () => {
  const f = fixture();
  commitInWt(f, "spec.md", "line one\nline two edited\nline three\n");
  assert.equal(landIn(f).status, 0);
  const here = process.cwd();
  try {
    process.chdir(f.wt);
    assert.match(landIn(f, { cleanup: true }).json.cleanup, /^skipped-cwd-inside-worktree/);
  } finally { process.chdir(here); }
  assert.equal(fs.existsSync(f.wt), true);
  const json = landIn(f, { cleanup: true }).json;
  assert.equal(json.method, "already-landed");
  assert.equal(json.cleanup, "removed");
  assert.equal(fs.existsSync(f.wt), false);
  assert.equal(git(f.main, "branch", "--list", "wi/t1"), "");
  assert.match(read(f.main, "spec.md"), /edited/);
  assert.equal(git(f.main, "status", "--porcelain"), "");
});
