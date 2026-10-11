// @organism-suite
// land-local: lands a WI branch onto main for a project with no network remote (no model, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { advanceLocalOrigin, crossFamilyProblems, setAside } from "../../scripts/land-local.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LAND = path.join(ROOT, "scripts", "land-local.mjs");
const EMIT = path.join(ROOT, "scripts", "emit-receipt.mjs");
const CHECK = path.join(ROOT, "scripts", "check-chain-receipts.mjs");
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
  assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json));
}
const land = (f, extra = []) => {
  const r = spawnSync(process.execPath, [LAND, "--root", f.wt, "--wi", WI, "--json", ...extra], { encoding: "utf8", env: cleanEnv() });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* leave null */ }
  return { status: r.status, json, stderr: r.stderr };
};
const head = (dir) => git(dir, "rev-parse", "HEAD");
const read = (dir, file) => fs.readFileSync(path.join(dir, file), "utf8");

test("lands a fast-forward into the main checkout, advances local origin/main, repeat run is a no-op", () => {
  const f = fixture();
  const tip = commitInWt(f, "spec.md", "line one\nline two\nline three\nadded by wi\n");
  stubReceipt(f);
  commitInWt(f, "spec.md", "line one\nline two\nline three\nadded by wi\nsecond edit\n", "second");
  const tip2 = git(f.wt, "rev-parse", "HEAD");
  stubReceipt(f);
  assert.notEqual(tip, tip2);
  assert.match(read(f.main, "spec.md"), /^line one\nline two\nline three\n$/);

  const r = land(f);
  assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json));
  assert.equal(r.json.landed, true);
  assert.equal(r.json.method, "fast-forward");
  assert.equal(r.json.main_sha, tip2);
  assert.equal(head(f.main), tip2);
  assert.match(read(f.main, "spec.md"), /added by wi/);
  assert.match(read(f.main, "spec.md"), /second edit/);
  assert.equal(git(f.main, "status", "--porcelain"), "");
  assert.equal(git(f.main, "rev-parse", "refs/remotes/origin/main"), tip2);
  assert.equal(r.json.local_origin_ref, "advanced");
  // receipts are notes keyed by commit sha in the shared store: they still validate from the main checkout
  const chk = spawnSync(process.execPath, [CHECK, "--sha", tip2, "--wi", WI, "--consumer", "stop"], { cwd: f.main, encoding: "utf8", env: cleanEnv() });
  assert.equal(chk.status, 0, chk.stdout + chk.stderr);

  const again = land(f);
  assert.equal(again.status, 0);
  assert.equal(again.json.landed, true);
  assert.equal(again.json.method, "already-landed");
  assert.equal(again.json.main_sha, tip2);
  assert.equal(head(f.main), tip2);
});

test("refuses without chain receipts and changes nothing", () => {
  const f = fixture();
  commitInWt(f, "spec.md", "changed\n");
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.refused, true);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.equal(head(f.main), mainBefore);
  assert.match(read(f.main, "spec.md"), /line one/);
  assert.equal(git(f.main, "rev-parse", "refs/remotes/origin/main"), mainBefore);
});

test("refuses a receipt on the tip that is bound to a different tree", () => {
  const f = fixture();
  const first = commitInWt(f, "spec.md", "first\n");
  const staleTree = git(f.wt, "rev-parse", `${first}^{tree}`);
  commitInWt(f, "spec.md", "second, after the receipt\n");
  stubReceipt(f, { tree: staleTree }); // a receipt IS on the tip, but its tree is the previous one
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.ok(r.json.missing.some((m) => /tree mismatch/.test(m)), JSON.stringify(r.json.missing));
  assert.equal(head(f.main), mainBefore);
});

test("an unreviewed code commit followed by an eligible docs commit is refused", () => {
  const f = fixture();
  const code = commitInWt(f, "app.js", "export const secret = () => process.env.TOKEN;\n", "unreviewed code");
  commitInWt(f, "spec.md", "line one\nline two edited\nline three\n", "docs only");
  stubReceipt(f); // only the docs-only tip carries a quick-fix receipt
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.ok(r.json.missing.some((m) => m.startsWith(code.slice(0, 12))), JSON.stringify(r.json.missing));
  assert.equal(head(f.main), mainBefore);
  assert.equal(fs.existsSync(path.join(f.main, "app.js")), false);
  // the same branch lands once every commit carries its own eligible receipt (docs-only here)
  const g = fixture();
  commitInWt(g, "spec.md", "line one\nline two edited\nline three\n", "docs 1");
  stubReceipt(g);
  commitInWt(g, "spec.md", "line one\nline two edited again\nline three\n", "docs 2");
  stubReceipt(g);
  assert.equal(land(g).status, 0);
});

test("a merge commit inside the WI branch cannot ride on quick-fix receipts", () => {
  const f = fixture();
  commitInWt(f, "wi.md", "wi\n");
  stubReceipt(f);
  fs.writeFileSync(path.join(f.main, "m.md"), "main\n");
  git(f.main, "add", "-A");
  git(f.main, "commit", "-qm", "main moves");
  git(f.wt, "merge", "-q", "--no-edit", "main");
  stubReceipt(f);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.ok(r.json.missing.some((m) => /merge commit/.test(m)), JSON.stringify(r.json.missing));
});

test("cross-family adversarial review is mandatory: v1/v2, self-declared and same-family reviews are rejected", () => {
  const f = fixture();
  const sha = commitInWt(f, "spec.md", "x\n");
  const note = (reviewExec, reviewPlan = reviewExec) => {
    const env = { "review-plan": { receipt_type: "review-plan", wi: WI, ...reviewPlan }, "review-exec": { receipt_type: "review-exec", wi: WI, ...reviewExec } };
    const r = spawnSync("git", ["-C", f.wt, "notes", "--ref=svc-receipts", "add", "-f", "-m", JSON.stringify(env), sha], { encoding: "utf8", env: cleanEnv() });
    assert.equal(r.status, 0, r.stderr + JSON.stringify(r.json));
  };
  const ar = (host) => ({ primary_reviewer_host: host, primary_used: true, fallback_host: host, fallback_used: false, findings: [], iteration_count: 1 });
  for (const bad of ["not-a-version", "3", 3.5, null, NaN, undefined]) {
    note({ schema_version: bad, reviewer_evidence: { independent: true }, self_review: { orchestrator: "claude" }, adversarial_review: ar("codex") });
    assert.match(crossFamilyProblems(f.wt, sha, WI).join("|"), /cross-family reviewer evidence required/, `schema_version ${String(bad)}`);
  }
  note({ schema_version: 2, self_review: { orchestrator: "claude" }, adversarial_review: ar("codex") });
  assert.match(crossFamilyProblems(f.wt, sha, WI).join("|"), /cross-family reviewer evidence required/);
  note({ schema_version: 3, reviewer_evidence: { independent: true }, self_review: { orchestrator: "claude" }, adversarial_review: ar("claude") });
  assert.match(crossFamilyProblems(f.wt, sha, WI).join("|"), /not a cross-family review/);
  note({ schema_version: 3, reviewer_evidence: { independent: true }, self_review: { orchestrator: "mystery" }, adversarial_review: ar("codex") });
  assert.match(crossFamilyProblems(f.wt, sha, WI).join("|"), /not a cross-family review/);
  note({ schema_version: 3, reviewer_evidence: { independent: true }, self_review: { orchestrator: "claude" }, adversarial_review: ar("codex") });
  assert.deepEqual(crossFamilyProblems(f.wt, sha, WI), []);
});

test("a chain of self-declared reviews is refused with an evidence-specific reason before any shared check", () => {
  const f = fixture();
  const sha = commitInWt(f, "spec.md", "x\n");
  const ar = { primary_reviewer_host: "codex", primary_used: true, fallback_host: "codex", fallback_used: false, findings: [], iteration_count: 1 };
  const rec = (type, extra = {}) => ({ receipt_type: type, wi: WI, schema_version: "not-a-version", verdict: "pass", ...extra });
  const env = {
    "plan-manifest": rec("plan-manifest"), "exec-record": rec("exec-record"), "audit-implementation": rec("audit-implementation"),
    "review-plan": rec("review-plan", { reviewer_evidence: { independent: true, submitter_only: false } }),
    "review-exec": rec("review-exec", { reviewer_evidence: { independent: true, submitter_only: false }, self_review: { orchestrator: "claude" }, adversarial_review: ar }),
  };
  assert.equal(spawnSync("git", ["-C", f.wt, "notes", "--ref=svc-receipts", "add", "-f", "-m", JSON.stringify(env), sha], { encoding: "utf8", env: cleanEnv() }).status, 0);
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.ok(r.json.missing.some((m) => /cross-family reviewer evidence required/.test(m)), JSON.stringify(r.json.missing));
  assert.equal(r.json.missing.includes("plan-manifest"), false, "the shared checker must not have been reached");
  assert.equal(head(f.main), mainBefore);
});

test("setAside is all-or-nothing: a failed later move restores every earlier one", () => {
  const f = fixture();
  fs.writeFileSync(path.join(f.main, "one.md"), "1\n");
  fs.mkdirSync(path.join(f.main, "d"));
  fs.writeFileSync(path.join(f.main, "d", "two.md"), "2\n");
  const aside = path.join(git(f.main, "rev-parse", "--absolute-git-dir"), `svc-land-local-aside-${process.pid}`);
  fs.mkdirSync(aside, { recursive: true });
  fs.writeFileSync(path.join(aside, "d"), "in the way"); // makes the second move's parent directory impossible
  assert.throws(() => setAside(f.main, ["one.md", "d/two.md"]), (e) => e.reason === "ASIDE_FAILED" && /all restored/.test(e.detail));
  assert.equal(read(f.main, "one.md"), "1\n");
  assert.equal(read(f.main, "d/two.md"), "2\n");
  assert.equal(fs.existsSync(aside), false);
});

test("--cleanup removes the landed worktree and branch with package-resolved git only, never from inside it", () => {
  const f = fixture();
  commitInWt(f, "spec.md", "line one\nline two edited\nline three\n");
  stubReceipt(f);
  assert.equal(land(f).status, 0);
  const inside = spawnSync(process.execPath, [LAND, "--root", f.wt, "--wi", WI, "--json", "--cleanup"], { cwd: f.wt, encoding: "utf8", env: cleanEnv() });
  assert.match(JSON.parse(inside.stdout).cleanup, /^skipped-cwd-inside-worktree/);
  assert.equal(fs.existsSync(f.wt), true);
  const out = spawnSync(process.execPath, [LAND, "--root", f.wt, "--wi", WI, "--json", "--cleanup"], { cwd: f.main, encoding: "utf8", env: cleanEnv() });
  const json = JSON.parse(out.stdout);
  assert.equal(out.status, 0, out.stdout + out.stderr);
  assert.equal(json.method, "already-landed");
  assert.equal(json.cleanup, "removed");
  assert.equal(fs.existsSync(f.wt), false);
  assert.equal(git(f.main, "branch", "--list", "wi/t1"), "");
  assert.match(read(f.main, "spec.md"), /edited/);
  assert.equal(git(f.main, "status", "--porcelain"), "");
});

test("refuses on a dirty main checkout", () => {
  const f = fixture();
  commitInWt(f, "extra.md", "x\n");
  stubReceipt(f);
  fs.writeFileSync(path.join(f.main, "spec.md"), "local edit in main\n");
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "MAIN_DIRTY");
  assert.equal(head(f.main), mainBefore);
  assert.equal(read(f.main, "spec.md"), "local edit in main\n");
  assert.equal(fs.existsSync(path.join(f.main, "extra.md")), false);
});

test("refuses on a conflict and modifies nothing; non-conflicting divergence makes a merge commit", () => {
  const f = fixture();
  const tip = commitInWt(f, "spec.md", "line one\nWI says two\nline three\n");
  stubReceipt(f);
  fs.writeFileSync(path.join(f.main, "spec.md"), "line one\nMAIN says two\nline three\n");
  git(f.main, "commit", "-qam", "main moves");
  git(f.main, "update-ref", "refs/remotes/origin/main", "HEAD");
  const mainBefore = head(f.main);
  const refBefore = git(f.main, "for-each-ref", "--format=%(refname) %(objectname)");
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "MERGE_CONFLICT");
  assert.ok(r.json.conflicts.includes("spec.md"));
  assert.equal(head(f.main), mainBefore);
  assert.equal(read(f.main, "spec.md"), "line one\nMAIN says two\nline three\n");
  assert.equal(git(f.main, "status", "--porcelain"), "");
  assert.equal(git(f.main, "for-each-ref", "--format=%(refname) %(objectname)"), refBefore);

  // Same shape but disjoint files: lands as a merge commit, history is never rewritten.
  const g = fixture();
  const wiTip = commitInWt(g, "wi.md", "from wi\n");
  stubReceipt(g);
  fs.writeFileSync(path.join(g.main, "main-only.md"), "from main\n");
  git(g.main, "add", "-A");
  git(g.main, "commit", "-qm", "main moves");
  const mainSha = head(g.main);
  const ok = land(g);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(ok.json.method, "merge-commit");
  assert.equal(git(g.main, "rev-list", "--parents", "-n", "1", "HEAD").split(" ").length, 3);
  assert.equal(git(g.main, "rev-parse", "HEAD^1"), mainSha);
  assert.equal(git(g.main, "rev-parse", "HEAD^2"), wiTip);
  assert.equal(read(g.main, "wi.md"), "from wi\n");
  assert.equal(read(g.main, "main-only.md"), "from main\n");
  assert.equal(git(g.main, "rev-parse", "refs/remotes/origin/main"), head(g.main));
  assert.equal(land(g).json.method, "already-landed");
  assert.ok(tip);
});

test("a real remote is not routed here", () => {
  const f = fixture();
  commitInWt(f, "extra.md", "x\n");
  stubReceipt(f);
  git(f.main, "remote", "add", "origin", "https://example.invalid/acme/app.git");
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "HAS_REMOTE");
  assert.equal(head(f.main), mainBefore);
});

test("untracked state in main: identical copy is dropped, a differing copy is refused", () => {
  const f = fixture();
  commitInWt(f, "state.md", "shared state\n");
  stubReceipt(f);
  fs.writeFileSync(path.join(f.main, "state.md"), "different\n");
  const mainBefore = head(f.main);
  const blocked = land(f);
  assert.equal(blocked.status, 2);
  assert.equal(blocked.json.reason, "MAIN_UNTRACKED_COLLISION");
  assert.equal(head(f.main), mainBefore);
  assert.equal(read(f.main, "state.md"), "different\n");
  fs.writeFileSync(path.join(f.main, "state.md"), "shared state\n");
  const ok = land(f);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(read(f.main, "state.md"), "shared state\n");
  assert.equal(git(f.main, "status", "--porcelain"), "");
});

test("refuses when the main checkout is not on the main branch, and --dry-run lands nothing", () => {
  const f = fixture();
  commitInWt(f, "extra.md", "x\n");
  stubReceipt(f);
  const mainBefore = head(f.main);
  const dry = land(f, ["--dry-run"]);
  assert.equal(dry.status, 0, dry.stderr);
  assert.equal(dry.json.would_land, true);
  assert.equal(dry.json.landed, false);
  assert.equal(head(f.main), mainBefore);
  git(f.main, "checkout", "-q", "-b", "scratch");
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "MAIN_CHECKOUT_OFF_BRANCH");
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
  stubReceipt(f);
  fs.writeFileSync(path.join(f.wt, ".svc", "state.json"), '{"wip":true}\n');
  const mainBefore = head(f.main);
  const a = land(f);
  assert.equal(a.status, 2);
  assert.equal(a.json.reason, "WI_WORKTREE_DIRTY");
  git(f.wt, "checkout", "--", ".svc/state.json");
  fs.writeFileSync(path.join(f.main, ".svc", "state.json"), '{"wip":true}\n');
  const b = land(f);
  assert.equal(b.status, 2);
  assert.equal(b.json.reason, "MAIN_DIRTY");
  assert.equal(head(f.main), mainBefore);
});

test("a failed merge restores identical untracked files that were set aside", () => {
  const f = fixture();
  commitInWt(f, "state.md", "shared state\n");
  stubReceipt(f);
  fs.writeFileSync(path.join(f.main, "other.md"), "main\n");
  git(f.main, "add", "-A");
  git(f.main, "commit", "-qm", "main moves"); // forces a merge commit, which the hook then rejects
  const hook = path.join(git(f.main, "rev-parse", "--absolute-git-dir"), "hooks", "pre-merge-commit");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
  fs.writeFileSync(path.join(f.main, "state.md"), "shared state\n");
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "MERGE_FAILED");
  assert.equal(head(f.main), mainBefore);
  assert.equal(read(f.main, "state.md"), "shared state\n");
  assert.equal(git(f.main, "status", "--porcelain"), "?? state.md");
});

test("an untracked directory where an incoming file lands is a collision, not a deletion", () => {
  const f = fixture();
  commitInWt(f, "docs", "now a file\n");
  stubReceipt(f);
  fs.mkdirSync(path.join(f.main, "docs"));
  fs.writeFileSync(path.join(f.main, "docs", "keep.md"), "keep\n");
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "MAIN_UNTRACKED_COLLISION");
  assert.equal(read(f.main, "docs/keep.md"), "keep\n");
});

test("origin/main update is compare-and-swap: a concurrent advance is never rewound", () => {
  const f = fixture();
  const base = head(f.main);
  fs.writeFileSync(path.join(f.main, "a.md"), "a\n");
  git(f.main, "add", "-A");
  git(f.main, "commit", "-qm", "a");
  const newMain = head(f.main);
  // a concurrent writer moves origin/main to a descendant of the observed value that newMain does not contain
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
