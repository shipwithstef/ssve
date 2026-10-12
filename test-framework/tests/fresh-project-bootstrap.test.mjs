// @organism-suite
// WP-FRESH: a project that has only been `git init`ed (no commit, no origin, no .svc) gets the
// git facts the framework assumes, and the chain machinery then works on it. No model calls.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { selectPlanAuthorityBytes } from "../../scripts/emit-receipt.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = (name) => path.join(ROOT, "scripts", name);
const SESSION = "7b1f3c52-9d3e-4a51-8a47-2f6e0c1d9a10";

const tmp = (prefix) => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
const HOME = tmp("svc-fresh-home-");
fs.chmodSync(HOME, 0o700);

function baseEnv(extra = {}) {
  const env = { ...process.env, HOME, USERPROFILE: HOME, XDG_CONFIG_HOME: path.join(HOME, ".config"), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: path.join(HOME, ".gitconfig-none"), SVC_HOST: "claude", SVC_SESSION_ID: SESSION, ...extra };
  for (const k of Object.keys(env)) if (/^GIT_(AUTHOR|COMMITTER)_/.test(k) || ["SVC_CHAIN_POLICY", "GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "NODE_TEST_CONTEXT", "SVC_WORKTREES_ROOT"].includes(k)) delete env[k];
  return { ...env, ...extra };
}
const run = (cwd, cmd, args, extra = {}) => spawnSync(cmd, args, { cwd, env: baseEnv(extra), encoding: "utf8" });
const git = (cwd, ...args) => run(cwd, "git", args);
const node = (cwd, name, ...args) => run(cwd, process.execPath, [script(name), ...args]);
const out = (r) => (r.stdout || "").trim();

function freshProject(spec = "# Spec\nBuild a thing.\n") {
  const dir = tmp("svc-fresh-proj-");
  assert.equal(git(dir, "init", "-q").status, 0);
  fs.writeFileSync(path.join(dir, "spec.md"), spec);
  return dir;
}
function sha(cwd, ref) { const r = git(cwd, "rev-parse", "--verify", "--quiet", ref); return r.status === 0 ? out(r) : null; }

test("the home directory used by these tests is private and holds no framework state", () => {
  assert.equal(fs.statSync(HOME).mode & 0o777, 0o700);
  assert.equal(fs.existsSync(path.join(HOME, ".svc")), false);
});

test("1. the harness seed yields identical, remote-less repositories with origin/main at HEAD and no .svc", () => {
  const heads = [];
  for (let i = 0; i < 2; i += 1) {
    const dir = freshProject();
    const dates = { GIT_AUTHOR_DATE: "2026-01-01T00:00:00Z", GIT_COMMITTER_DATE: "2026-01-01T00:00:00Z" };
    for (const args of [["branch", "-M", "main"], ["add", "-A"], ["-c", "user.name=eval", "-c", "user.email=eval@localhost", "commit", "-q", "-m", "Initial commit"], ["update-ref", "refs/remotes/origin/main", "HEAD"], ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]]) {
      const r = run(dir, "git", args, dates);
      assert.equal(r.status, 0, `${args.join(" ")}: ${r.stderr}`);
    }
    assert.equal(sha(dir, "HEAD"), sha(dir, "refs/remotes/origin/main"));
    assert.equal(out(git(dir, "remote")), "");
    assert.equal(fs.existsSync(path.join(dir, ".svc")), false);
    heads.push(sha(dir, "HEAD"));
  }
  assert.equal(heads[0], heads[1], "both arms start from the same commit");
});

test("2. init-project-state on an unborn repo commits, writes a refuse policy under the git dir, and the resolver reads it as shared", () => {
  const dir = freshProject();
  const r = node(dir, "init-project-state.mjs");
  assert.equal(r.status, 0, r.stderr);
  assert.ok(sha(dir, "HEAD"), "HEAD exists");
  assert.equal(out(git(dir, "symbolic-ref", "--short", "HEAD")), "main");
  assert.match(out(git(dir, "ls-tree", "-r", "--name-only", "HEAD")), /^spec\.md$/m);
  assert.doesNotMatch(out(git(dir, "ls-tree", "-r", "--name-only", "HEAD")), /(^|\/)\.worktrees\//);
  const common = path.resolve(dir, out(git(dir, "rev-parse", "--git-common-dir")));
  const policy = JSON.parse(fs.readFileSync(path.join(common, "svc-chain-policy.json"), "utf8"));
  assert.equal(policy.mode, "refuse");
  assert.equal(fs.existsSync(path.join(dir, ".svc", "chain-policy.json")), false);
  const resolved = JSON.parse(out(node(dir, "lib/chain-policy.mjs", "--json")));
  assert.equal(resolved.source, "shared");
  assert.equal(resolved.mode, "refuse");
  assert.equal(out(git(dir, "remote")), "", "no network remote is invented");
  assert.equal(sha(dir, "refs/remotes/origin/main"), sha(dir, "HEAD"));
  assert.equal(git(dir, "config", "--local", "user.name").stdout.trim(), "project", "repo-local identity was assumed");
});

test("bootstrap is idempotent: a second run makes no commit and changes nothing", () => {
  const dir = freshProject();
  const first = JSON.parse(out(node(dir, "svc-bootstrap-repo.mjs", "--json")));
  assert.equal(first.ok, true);
  assert.equal(first.created_root_commit, true);
  assert.equal(first.identity_assumed, true);
  assert.equal(first.chain_policy_written, true);
  assert.equal(first.branch, "main");
  const count = out(git(dir, "rev-list", "--count", "--all"));
  const second = JSON.parse(out(node(dir, "svc-bootstrap-repo.mjs", "--json")));
  assert.equal(second.created_root_commit, false);
  assert.equal(second.chain_policy_written, false);
  assert.equal(second.head, first.head);
  assert.equal(out(git(dir, "rev-list", "--count", "--all")), count);
});

test("bootstrap keeps an existing identity, an existing remote, and an existing commit untouched", () => {
  const dir = freshProject();
  git(dir, "config", "--local", "user.name", "Real Person");
  git(dir, "config", "--local", "user.email", "real@example.invalid");
  git(dir, "remote", "add", "origin", "https://example.invalid/x.git");
  const r = JSON.parse(out(node(dir, "svc-bootstrap-repo.mjs", "--json")));
  assert.equal(r.identity_assumed, false);
  assert.equal(git(dir, "log", "-1", "--format=%an").stdout.trim(), "Real Person");
  assert.equal(sha(dir, "refs/remotes/origin/main"), null, "a configured origin is never given a fake origin/main");
  const again = JSON.parse(out(node(dir, "svc-bootstrap-repo.mjs", "--json")));
  assert.equal(again.created_root_commit, false);
  assert.equal(again.head, r.head);
});

test("bootstrap does not override an owner-home chain policy", () => {
  const home = tmp("svc-fresh-home-owner-");
  fs.chmodSync(home, 0o700);
  fs.mkdirSync(path.join(home, ".svc"));
  fs.writeFileSync(path.join(home, ".svc", "chain-policy.json"), JSON.stringify({ mode: "warn" }));
  const dir = freshProject();
  const r = run(dir, process.execPath, [script("svc-bootstrap-repo.mjs"), "--json"], { HOME: home, USERPROFILE: home });
  const body = JSON.parse(out(r));
  assert.equal(body.chain_policy_written, false);
  assert.equal(body.chain_policy_source, "home");
});

test("3-7. the chain machinery works on a fresh project: worktree, reconcile baseline, receipts, graph, stage activation", () => {
  const dir = freshProject();
  assert.equal(node(dir, "init-project-state.mjs").status, 0);

  // 3. worktree from origin/main, second run returns the same path.
  const w1 = node(dir, "svc-ensure-worktree.mjs", "--wi", "WI-1", "--branch", "feature-wi-1", "--from", "origin/main", "--json");
  assert.equal(w1.status, 0, w1.stderr);
  const first = JSON.parse(out(w1).split("\n").pop());
  assert.ok(fs.existsSync(path.join(first.absolute_worktree, "spec.md")), "the worktree contains spec.md");
  const w2 = node(dir, "svc-ensure-worktree.mjs", "--wi", "WI-1", "--branch", "feature-wi-1", "--from", "origin/main", "--json");
  assert.equal(w2.status, 0, w2.stderr);
  assert.equal(JSON.parse(out(w2).split("\n").pop()).absolute_worktree, first.absolute_worktree);

  // 4. reconcile baselines the single note-less root commit, then holds the line.
  const rec = node(dir, "svc-reconcile.mjs");
  assert.equal(rec.status, 0, rec.stderr);
  assert.match(rec.stdout, /pre-svc-baseline/);
  assert.equal(git(dir, "commit", "-q", "--allow-empty", "-m", "second").status, 0);
  const rec2 = node(dir, "svc-reconcile.mjs");
  assert.equal(rec2.status, 1, "a second note-less commit is receipt debt under refuse");

  // 5. receipts: clean HEAD writes a note; dirty index stages; --bind-staging attaches after commit.
  const execBody = (marker) => JSON.stringify({ diff_hash: "a".repeat(64), files_touched: [marker], dispatch_model: "test-model" });
  const cleanRun = spawnSync(process.execPath, [script("emit-receipt.mjs"), "--type", "exec-record", "--wi", "WI-1"], { cwd: dir, env: baseEnv(), input: execBody("spec.md"), encoding: "utf8" });
  assert.equal(cleanRun.status, 0, cleanRun.stderr);
  assert.match(out(git(dir, "notes", "--ref=svc-receipts", "show", "HEAD")), /exec-record/);

  fs.writeFileSync(path.join(dir, "app.js"), "console.log(1)\n");
  assert.equal(git(dir, "add", "app.js").status, 0);
  const staged = spawnSync(process.execPath, [script("emit-receipt.mjs"), "--type", "exec-record", "--wi", "WI-2"], { cwd: dir, env: baseEnv(), input: execBody("app.js"), encoding: "utf8" });
  assert.equal(staged.status, 0, staged.stderr);
  const stagedJson = JSON.parse(staged.stdout);
  assert.equal(stagedJson.staging, true);
  assert.equal(stagedJson.note_written, false);
  assert.equal(git(dir, "commit", "-q", "-m", "add app").status, 0);
  const head = sha(dir, "HEAD");
  const bound = node(dir, "emit-receipt.mjs", "--bind-staging", "--sha", "HEAD");
  assert.equal(bound.status, 0, bound.stderr + bound.stdout);
  const boundJson = JSON.parse(bound.stdout);
  assert.equal(boundJson.bound.length, 1);
  assert.equal(boundJson.bound[0].type, "exec-record");
  const noteAfter = JSON.parse(out(git(dir, "notes", "--ref=svc-receipts", "show", "HEAD")));
  assert.ok(Object.keys(noteAfter).some((k) => k.startsWith(`slot::exec-record::WI-2::${head}`)));
  const again = node(dir, "emit-receipt.mjs", "--bind-staging", "--sha", "HEAD");
  assert.equal(again.status, 0, "binding twice is a no-op");
  assert.equal(JSON.parse(again.stdout).bound[0].already_bound, true);
  const chk = node(dir, "check-chain-receipts.mjs", "--sha", head, "--consumer", "reconcile");
  const seen = JSON.parse(chk.stdout).results[0];
  assert.equal(seen.receipt_source, "note", "the receipt checker reads the bound note");
  assert.ok(!seen.missing.includes("exec-record"), "the bound exec-record is no longer missing");
  assert.ok(seen.missing.includes("plan-manifest"), "the other chain receipts are still owed");

  // 6. the delivery graph compiles.
  const graph = node(dir, "compile-delivery-graph.mjs", "--wi", "WI-1", "--lane", "greenfield", "--change-type", "feature", "--intent", "build", "--delivery-profile", "mvp", "--out", ".svc/lane-tasks-WI-1.json");
  assert.equal(graph.status, 0, graph.stderr);

  // 7. stage activation against origin/main sees an empty diff on a fresh worktree branch.
  const wt = first.absolute_worktree;
  const act = node(wt, "stage-activation.mjs", "--diff", "origin/main...HEAD");
  assert.equal(act.status, 0, act.stderr);
  const stages = JSON.parse(act.stdout);
  const essential = stages.filter((row) => /^essential/.test(row.condition));
  assert.ok(essential.length >= 4 && essential.every((row) => row.result === "active" && row.evaluated_against.files === 0));
});

test("a missing session id is reported with exactly how to provide it", () => {
  const dir = freshProject();
  const env = baseEnv();
  delete env.SVC_SESSION_ID;
  for (const k of ["CLAUDE_CODE_SESSION_ID", "CLAUDE_SESSION_ID", "CODEX_THREAD_ID", "CODEX_SESSION_ID", "CURSOR_CONVERSATION_ID", "CURSOR_SESSION_ID", "GROK_SESSION_ID", "KIMI_SESSION_ID", "GEMINI_SESSION_ID"]) delete env[k];
  const r = spawnSync(process.execPath, [script("svc-ensure-worktree.mjs"), "--wi", "WI-9", "--branch", "feature-wi-9"], { cwd: dir, env, encoding: "utf8" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /SVC_SESSION_ID/);
  assert.match(r.stderr, /--session-id/);
  // The flag satisfies it, and CLAUDE_CODE_SESSION_ID alone is accepted.
  const flagged = spawnSync(process.execPath, [script("svc-ensure-worktree.mjs"), "--wi", "WI-9", "--branch", "feature-wi-9", "--session-id", "sess-flag-0001", "--json"], { cwd: dir, env, encoding: "utf8" });
  assert.equal(flagged.status, 0, flagged.stderr);
  const dir2 = freshProject();
  const viaHost = spawnSync(process.execPath, [script("svc-ensure-worktree.mjs"), "--wi", "WI-9", "--branch", "feature-wi-9", "--json"], { cwd: dir2, env: { ...env, SVC_HOST: "", CLAUDE_CODE_SESSION_ID: "0c5a9e2e-1b7d-4f44-9a6a-3d2f8e7b6c11", CLAUDECODE: "1" }, encoding: "utf8" });
  assert.equal(viaHost.status, 0, viaHost.stderr);
});

test("an empty-but-unbootstrappable base still refuses to work in place", () => {
  const dir = tmp("svc-fresh-notgit-");
  const r = node(dir, "svc-bootstrap-repo.mjs", "--json");
  assert.equal(r.status, 2);
  assert.equal(JSON.parse(out(r)).reason, "not_a_git_repository");
});

// ---- Round 2 regressions (Codex review of b1187a5f) ----

test("R1. --bind-staging refuses a hand-written schema-v1 review receipt (same safeguards as direct emission)", () => {
  const dir = freshProject();
  assert.equal(node(dir, "init-project-state.mjs").status, 0);
  const head = sha(dir, "HEAD");
  const tree = out(git(dir, "rev-parse", "HEAD^{tree}"));
  const staging = path.join(dir, ".svc", "receipts", "staging", tree);
  fs.mkdirSync(staging, { recursive: true });
  fs.writeFileSync(path.join(staging, "review-exec--WI-3.json"), JSON.stringify({
    receipt_type: "review-exec", schema_version: 1, wi: "WI-3", diff_hash: "x", self_review: {}, adversarial_review: {}, verdict: "pass", timestamp: new Date().toISOString(),
  }));
  // The direct path refuses the same body.
  const direct = spawnSync(process.execPath, [script("emit-receipt.mjs"), "--type", "review-exec", "--wi", "WI-3", "--sha", head], { cwd: dir, env: baseEnv(), input: fs.readFileSync(path.join(staging, "review-exec--WI-3.json"), "utf8"), encoding: "utf8" });
  assert.equal(direct.status, 1);
  const bound = node(dir, "emit-receipt.mjs", "--bind-staging", "--sha", head);
  assert.equal(bound.status, 1, bound.stdout);
  const report = JSON.parse(bound.stdout);
  assert.equal(report.bound.length, 0);
  assert.match(report.refused[0].reason, /candidate_digest|reviewer evidence/);
  assert.equal(git(dir, "notes", "--ref=svc-receipts", "show", head).status === 0 && /review-exec/.test(out(git(dir, "notes", "--ref=svc-receipts", "show", head))), false, "no review-exec note was written");
});

test("R2. an existing remote-less master repository keeps being reconciled after bootstrap", () => {
  const dir = tmp("svc-fresh-master-");
  git(dir, "init", "-q", "-b", "master");
  git(dir, "config", "user.name", "Owner"); git(dir, "config", "user.email", "o@example.invalid");
  git(dir, "commit", "-q", "--allow-empty", "-m", "one");
  assert.equal(node(dir, "init-project-state.mjs").status, 0);
  assert.equal(out(git(dir, "symbolic-ref", "--short", "HEAD")), "master", "an existing default branch is not renamed");
  assert.equal(node(dir, "svc-reconcile.mjs").status, 0);
  git(dir, "commit", "-q", "--allow-empty", "-m", "two, no receipt");
  const r = node(dir, "svc-reconcile.mjs");
  assert.equal(r.status, 1, `the new master commit must be seen: ${r.stderr}`);
  assert.match(r.stderr, /1 unaccounted commits/);
});

test("R3. an orphan branch in an established repository is not committed onto main", () => {
  const dir = tmp("svc-fresh-orphan-");
  git(dir, "init", "-q", "-b", "main");
  git(dir, "config", "user.name", "Owner"); git(dir, "config", "user.email", "o@example.invalid");
  git(dir, "commit", "-q", "--allow-empty", "-m", "base");
  const mainTip = sha(dir, "main");
  assert.equal(git(dir, "checkout", "-q", "--orphan", "scratch").status, 0);
  fs.writeFileSync(path.join(dir, "draft.txt"), "private draft\n");
  const r = JSON.parse(out(node(dir, "svc-bootstrap-repo.mjs", "--json")));
  assert.equal(r.created_root_commit, false);
  assert.equal(r.unborn_head_in_established_repository, true);
  assert.equal(sha(dir, "main"), mainTip, "main did not move");
  assert.equal(out(git(dir, "symbolic-ref", "--short", "HEAD")), "scratch", "HEAD still on the orphan branch");
  assert.equal(git(dir, "cat-file", "-e", "main:draft.txt").status === 0, false);
});

test("R4. bootstrap honors owner commit hooks and reports a refusal instead of bypassing it", () => {
  const dir = freshProject();
  const marker = path.join(dir, ".git", "hook-ran");
  const hook = path.join(dir, ".git", "hooks", "pre-commit");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(hook, `#!/bin/sh\ntouch "${marker}"\necho "owner hook says no" >&2\nexit 1\n`, { mode: 0o755 });
  const r = node(dir, "svc-bootstrap-repo.mjs", "--json");
  assert.equal(r.status, 2);
  assert.ok(fs.existsSync(marker), "the owner's pre-commit hook ran");
  assert.match(r.stderr, /owner hook says no/);
  assert.equal(sha(dir, "HEAD"), null, "no commit was forced through");
  const init = node(dir, "init-project-state.mjs");
  assert.equal(init.status, 1);
  assert.match(init.stderr, /bootstrap failed/);
  const w = node(dir, "svc-ensure-worktree.mjs", "--wi", "WI-4", "--branch", "feature-wi-4");
  assert.notEqual(w.status, 0);
  assert.match(w.stderr, /owner hook says no/);
  fs.writeFileSync(hook, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  assert.equal(JSON.parse(out(node(dir, "svc-bootstrap-repo.mjs", "--json"))).created_root_commit, true, "a passing hook lets bootstrap commit");
});

// ---- Round 3 regression ----

test("R5. binding keeps the seal-bound plan bytes exactly; it never swaps in the re-serialised staged file", () => {
  const original = Buffer.from('{"wi":"WI-5","receipt_type":"plan-manifest","schema_version":5,"x":[1,2]}');
  const body = JSON.parse(original.toString("utf8"));
  const reformatted = JSON.stringify(body, null, 2); // what the staging mirror contains
  const kept = selectPlanAuthorityBytes({ bindStaged: true, loadedBytes: original, raw: reformatted, body });
  assert.ok(Buffer.compare(kept, original) === 0, "the original authority bytes are retained byte for byte");
  assert.notEqual(kept.toString("utf8"), reformatted);
  // Direct emission is unchanged: the caller's bytes are the authority.
  assert.equal(selectPlanAuthorityBytes({ bindStaged: false, loadedBytes: original, raw: reformatted, body }).toString("utf8"), reformatted);
  // A staged body that is not the sealed document is refused.
  assert.throws(() => selectPlanAuthorityBytes({ bindStaged: true, loadedBytes: original, raw: reformatted, body: { ...body, x: [9] } }), /differs from the seal-bound/);
  assert.throws(() => selectPlanAuthorityBytes({ bindStaged: true, loadedBytes: undefined, raw: reformatted, body }), /unavailable/);
});

test("R5b. bind refuses staged plan and control-plan receipts whose authority cannot be recovered, and writes no note", () => {
  const dir = freshProject();
  assert.equal(node(dir, "init-project-state.mjs").status, 0);
  const head = sha(dir, "HEAD");
  const tree = out(git(dir, "rev-parse", "HEAD^{tree}"));
  const staging = path.join(dir, ".svc", "receipts", "staging", tree);
  fs.mkdirSync(staging, { recursive: true });
  fs.writeFileSync(path.join(staging, "plan-manifest--WI-5.json"), JSON.stringify({ receipt_type: "plan-manifest", schema_version: 5, wi: "WI-5", mode: "inline" }, null, 2));
  fs.writeFileSync(path.join(staging, "control-plan--WI-5.json"), JSON.stringify({ receipt_type: "control-plan", schema_version: 1, wi: "WI-5" }, null, 2));
  const bound = node(dir, "emit-receipt.mjs", "--bind-staging", "--sha", head);
  assert.equal(bound.status, 1, bound.stdout);
  const report = JSON.parse(bound.stdout);
  assert.equal(report.bound.length, 0);
  assert.equal(report.refused.length, 2);
  assert.match(report.refused.find((r) => r.type === "control-plan").reason, /cannot be recovered from staging/);
  assert.equal(git(dir, "notes", "--ref=svc-receipts", "show", head).status === 0, false, "no note was written");
});
