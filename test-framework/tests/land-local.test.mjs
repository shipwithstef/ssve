// @organism-suite
// land-local: lands a WI branch onto main for a project with no network remote (no model, no network).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  git(f.wt, "add", "-A");
  git(f.wt, "commit", "-qm", msg);
  return git(f.wt, "rev-parse", "HEAD");
};
// Stub receipt arrangement: an eligible quick-fix receipt bound to the tip tree, written as a git note.
function stubReceipt(f) {
  const body = { receipt_type: "quick-fix", schema_version: 1, tree_hash: git(f.wt, "rev-parse", "HEAD^{tree}"), eligible: true, reasons: [], files: ["spec.md"], timestamp: new Date().toISOString() };
  const r = spawnSync(process.execPath, [EMIT, "--type", "quick-fix", "--wi", WI], { cwd: f.wt, input: JSON.stringify(body), encoding: "utf8", env: cleanEnv() });
  assert.equal(r.status, 0, r.stderr);
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
  commitInWt(f, "extra.md", "new file\n", "second");
  const tip2 = git(f.wt, "rev-parse", "HEAD");
  stubReceipt(f);
  assert.notEqual(tip, tip2);
  assert.match(read(f.main, "spec.md"), /^line one\nline two\nline three\n$/);

  const r = land(f);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.json.landed, true);
  assert.equal(r.json.method, "fast-forward");
  assert.equal(r.json.main_sha, tip2);
  assert.equal(head(f.main), tip2);
  assert.match(read(f.main, "spec.md"), /added by wi/);
  assert.equal(read(f.main, "extra.md"), "new file\n");
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

test("refuses a receipt that is bound to a different tree", () => {
  const f = fixture();
  commitInWt(f, "spec.md", "first\n");
  stubReceipt(f);
  commitInWt(f, "spec.md", "second, after the receipt\n");
  const mainBefore = head(f.main);
  const r = land(f);
  assert.equal(r.status, 2);
  assert.equal(r.json.reason, "RECEIPTS_MISSING");
  assert.equal(head(f.main), mainBefore);
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
