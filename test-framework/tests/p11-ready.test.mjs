// @organism-suite
// Fixes required before the paid P1.1 baseline: run does not silently run every task, reserve
// hashes are checked before paying, --sealed prints no score, solo and framework differ by
// exactly Skill, and no judge means the builder gets the whole share. No model is called.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import * as oe from "../../scripts/outcome-eval.mjs";
import { armTools, toolDiff } from "../../scripts/lib/arm-tools.mjs";
import { loadBar, buildManifest, assertBalanced } from "../../scripts/northstar.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCRIPT = path.join(ROOT, "scripts", "outcome-eval.mjs");
const bar = loadBar();
const tmp = (p = "p11-") => fs.mkdtempSync(path.join(os.tmpdir(), p));
const run = (args) => spawnSync(process.execPath, [SCRIPT, "run", "--parallel", "4", ...args], { encoding: "utf8", timeout: 60000 });

// ---- 4. tools ----
test("solo and framework effective tool lists differ by exactly Skill, for every dev task", () => {
  for (const task of bar.dev) {
    const cfg = oe.taskConfig(task);
    const solo = armTools(cfg.tools, "solo"), fw = armTools(cfg.tools, "framework");
    assert.deepEqual(toolDiff(solo, fw), { only_a: [], only_b: ["Skill"] }, task);
    for (const t of ["Bash", "Agent", "Task"]) assert.ok(solo.split(",").includes(t), `${task} solo has ${t}`);
    for (const t of (cfg.tools || "").split(",").filter(Boolean)) assert.ok(solo.split(",").includes(t), `${task} keeps its own tool ${t}`);
    assert.ok(!solo.split(",").includes("Skill"));
  }
  assert.match(oe.taskConfig("ai-quest").tools, /Bash\(npm:\*\)/, "ai-quest brings its own list, which is kept");
  assert.equal(oe.armTools, armTools, "outcome-eval and northstar share one implementation");
});

test("other arms keep their lists", () => {
  assert.match(armTools(undefined, "swarm"), /Agent,Task,Bash\(git:\*\)$/);
  assert.match(armTools(undefined, "bounded"), /Bash\(git:\*\)$/);
  assert.doesNotMatch(armTools(undefined, "plain"), /Agent|Skill|,Bash(,|$)/);
});

test("the manifest stores the effective per-arm list and flags any difference other than Skill", () => {
  const good = () => buildManifest({ model: "haiku", maxUsd: 35, slice: "dev", frameworkSha: "x", bar });
  const m = good();
  const e = (arm) => m.runs.find((r) => r.arm === arm && r.task === "ai-quest");
  assert.equal(e("framework").contract.tools, armTools(oe.taskConfig("ai-quest").tools, "framework"));
  assert.equal(e("solo").contract.tools, armTools(oe.taskConfig("ai-quest").tools, "solo"));
  assert.equal(assertBalanced(m, bar), true);
  const tamper = (fn) => { const x = good(); fn(x); return x; };
  assert.throws(() => assertBalanced(tamper((x) => { x.runs.find((r) => r.arm === "solo").contract.tools += ",NotebookEdit"; }), bar), /more than Skill: NotebookEdit/);
  assert.throws(() => assertBalanced(tamper((x) => { x.runs.find((r) => r.arm === "framework").contract.tools = x.runs.find((r) => r.arm === "framework").contract.tools.replace(",Task", ""); }), bar), /more than Skill: Task/);
});

// ---- 5. no judge, no judge share ----
test("with no judge the builder gets the whole share; with a judge it keeps the 15% back", () => {
  const none = new oe.Budget(10, 2, 0.5, 0).claim();
  assert.deepEqual(none, { usd: 5, builder: 5, judge: 0 });
  const judged = new oe.Budget(10, 2).claim();
  assert.equal(judged.builder, +(5 * (1 - oe.JUDGE_SHARE)).toFixed(2));
  assert.equal(judged.judge, +(5 * oe.JUDGE_SHARE).toFixed(2));
});

// ---- 1. the run is bounded ----
test("preflight refuses when the per-job share is under the floor, using bar.json floor_usd", () => {
  const tasks = Array.from({ length: 26 }, (_, i) => `t${i}`);
  const r = oe.preflightRun({ tasks, arms: ["solo", "framework"], reps: 3, maxUsd: 35, bar: { floor_usd: 0.5, reserve: [] }, dirOf: () => null });
  assert.match(r.error, /156 jobs/); assert.match(r.error, /tasks t0,t1,.*t25/); assert.match(r.error, /\$0\.224/); assert.match(r.error, /\$0\.224 per job/); assert.match(r.error, /\$0\.5 floor/);
  assert.ok(oe.preflightRun({ tasks: ["a"], arms: ["solo"], reps: 1, maxUsd: 0.8, bar: { floor_usd: 1, reserve: [] }, dirOf: () => null }).error, "floor from the bar, not the default");
  assert.equal(oe.barFloor(null), 0.5);
  assert.equal(oe.barFloor({}), 0.5);
  assert.equal(oe.barFloor({ floor_usd: 0.75 }), 0.75);
});

test("preflight prints the plan line; no cap keeps --tasks optional", () => {
  const ok = oe.preflightRun({ tasks: ["a", "b"], arms: ["solo", "framework"], reps: 3, maxUsd: 12, bar: { floor_usd: 0.5, reserve: [] }, dirOf: () => null });
  assert.equal(ok.error, undefined);
  assert.equal(ok.jobs, 12);
  assert.equal(ok.line, "plan: tasks a,b; 12 jobs; $1.000 per job; arms solo,framework");
  const free = oe.preflightRun({ tasks: ["a"], arms: ["solo"], reps: 1, maxUsd: null, bar: { floor_usd: 0.5, reserve: [] }, dirOf: () => null });
  assert.match(free.line, /no cap/);
});

test("run without --tasks under a cap that cannot fund every task exits 2 before anything starts", () => {
  const r = run(["--arms", "solo,framework", "--max-usd", "35", "--framework-sha", "deadbeef"]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /refusing to start: tasks .*; \d+ jobs/);
  assert.match(r.stderr, /per job \(arms solo,framework\), below the \$0\.5 floor/);
});

// ---- 2. reserve hashes ----
test("reserve check: missing dir, null frozen hash and a mismatch are refusals; a match passes", () => {
  const dir = tmp(); fs.writeFileSync(path.join(dir, "hidden.test.mjs"), "x");
  const sha = (d) => spawnSync(process.execPath, ["-e", `import("${ROOT}/scripts/lib/dir-sha.mjs").then((m)=>console.log(m.dirSha(${JSON.stringify(d)})))`], { encoding: "utf8" }).stdout.trim();
  const frozen = sha(dir);
  const b = (hash) => ({ reserve: [{ task: "R1", grader_sha256: hash }] });
  assert.deepEqual(oe.reserveProblems(["yoga-studio", "R1"], b(frozen), () => dir), [], "a match passes; a non-reserve task is not checked");
  assert.match(oe.reserveProblems(["R1"], b(frozen), () => path.join(dir, "nope"))[0], /not found/);
  assert.match(oe.reserveProblems(["R1"], b(null), () => dir)[0], /no frozen grader_sha256/);
  assert.match(oe.reserveProblems(["R1"], b("0".repeat(64)), () => dir)[0], /differs from its frozen grader_sha256/);
  assert.ok(oe.preflightRun({ tasks: ["R1"], arms: ["solo"], reps: 1, maxUsd: 5, bar: b("0".repeat(64)), dirOf: () => dir }).error);
});

test("run refuses a reserve task that is missing or changed, exit 2, before any job", () => {
  let r = run(["--arms", "solo", "--tasks", "R1", "--reps", "1", "--max-usd", "5"]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /reserve task R1 not found/);
  const root = tmp("p11-root-"); fs.mkdirSync(path.join(root, "R1")); fs.writeFileSync(path.join(root, "R1", "hidden.test.mjs"), "x");
  r = run(["--arms", "solo", "--tasks", "R1", "--reps", "1", "--max-usd", "5", "--tasks-root", root]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /reserve task R1 differs from its frozen grader_sha256/);
});

// ---- 3. sealed ----
test("--sealed without --out is refused", () => {
  const r = run(["--arms", "solo", "--tasks", "typo-readme", "--reps", "1", "--sealed"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--sealed requires --out/);
});

test("usage documents --sealed", () => {
  const r = spawnSync(process.execPath, [SCRIPT, "bogus"], { encoding: "utf8" });
  assert.match(r.stderr, /--sealed/);
  assert.match(r.stderr, /no score/);
});

// ---- review round 1 ----
test("the bar must load and validate: missing, malformed or reserve-less bar refuses, also for R1 with no directory", () => {
  const args = { tasks: ["R1"], arms: ["solo"], reps: 1, maxUsd: 5, dirOf: () => null };
  assert.match(oe.preflightRun({ ...args, bar: null }).error, /bar\.json/);
  assert.match(oe.preflightRun({ ...args, bar: {} }).error, /reserve/);
  assert.match(oe.preflightRun({ ...args, bar: { reserve: "R1" } }).error, /reserve/);
  assert.match(oe.preflightRun({ ...args, bar: { reserve: [{ task: 1 }] } }).error, /reserve/);
  assert.match(oe.preflightRun({ ...args, bar: { reserve: [{ task: "R1", grader_sha256: 5 }] } }).error, /reserve/);
  assert.match(oe.preflightRun({ ...args, bar: { floor_usd: -1, reserve: [] } }).error, /floor_usd/);
  assert.match(oe.preflightRun({ ...args, bar: { reserve: [{ task: "R1", grader_sha256: null }] } }).error, /R1/, "no directory: refused");
  assert.match(oe.preflightRun({ ...args, maxUsd: null, bar: null }).error, /bar\.json/, "also without a cap");
  assert.equal(oe.preflightRun({ ...args, tasks: ["a"], bar: { reserve: [] }, dirOf: () => "x" }).error, undefined);
});

test("a missing bar.json refuses the run (exit 2) even for a task with a directory", () => {
  const repo = tmp("p11-repo-");
  fs.mkdirSync(path.join(repo, "scripts", "lib"), { recursive: true });
  fs.cpSync(path.join(ROOT, "scripts", "lib"), path.join(repo, "scripts", "lib"), { recursive: true });
  fs.cpSync(path.join(ROOT, "hooks", "lib"), path.join(repo, "hooks", "lib"), { recursive: true });
  for (const f of ["outcome-eval.mjs", "state-io.mjs", "quality-probes.mjs", "chaos-probe.mjs"]) fs.copyFileSync(path.join(ROOT, "scripts", f), path.join(repo, "scripts", f));
  const task = path.join(repo, "test-framework", "outcome-evals", "tasks", "R1");
  fs.mkdirSync(task, { recursive: true });
  fs.writeFileSync(path.join(task, "spec.md"), "Export add(a, b) from solution.mjs.\n");
  fs.writeFileSync(path.join(task, "hidden.test.mjs"), "// grader\n");
  assert.ok(fs.existsSync(task), "the task directory is there, so the refusal cannot be 'not found'");
  const r = spawnSync(process.execPath, [path.join(repo, "scripts", "outcome-eval.mjs"), "run", "--parallel", "1", "--arms", "solo", "--tasks", "R1", "--reps", "1"], { encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /bar\.json/);
  assert.doesNotMatch(r.stderr, /not found/);
});

test("--sealed --out must be a regular file outside /dev and /proc, checked before any job", () => {
  const dir = tmp("p11-out-");
  const ok = path.join(dir, "r.json");
  assert.equal(oe.sealedOutProblem(ok), null, "does not exist yet");
  fs.writeFileSync(ok, "{}");
  assert.equal(oe.sealedOutProblem(ok), null, "existing regular file");
  for (const bad of ["/dev/stdout", "/dev/stderr", "/dev/fd/1", "/dev/null", "/proc/self/fd/1", dir, path.join(dir, "nodir", "r.json")]) {
    assert.ok(oe.sealedOutProblem(bad), bad);
  }
  const link = path.join(dir, "link.json"); fs.symlinkSync("/dev/stdout", link);
  assert.ok(oe.sealedOutProblem(link), "a symlink to a device");
  const fifo = path.join(dir, "fifo");
  if (spawnSync("mkfifo", [fifo]).status === 0) assert.ok(oe.sealedOutProblem(fifo), "a FIFO");
  for (const bad of ["/dev/stdout", "/dev/fd/2", fifo]) {
    const r = run(["--arms", "solo", "--tasks", "typo-readme", "--reps", "1", "--sealed", "--out", bad]);
    assert.equal(r.status, 2, bad);
    assert.match(r.stderr, /--sealed --out/);
    assert.doesNotMatch(r.stdout, /solve|score/i);
  }
});

test("--reps must be a positive integer, checked before the job count and funding", () => {
  for (const bad of ["1.5", "0", "-1", "abc", "", "2e0x"]) {
    const r = run(["--arms", "solo,framework", "--tasks", "typo-readme", "--reps", bad, "--max-usd", "5"]);
    assert.equal(r.status, 2, `--reps ${JSON.stringify(bad)}: ${r.stderr}`);
    assert.match(r.stderr, /--reps must be a positive integer/);
    assert.doesNotMatch(r.stderr, /jobs/);
  }
});

// ---- multi-session tasks ----
// P1.1 found continuity-rules scoring 0 in both arms: solo/framework sent "Build what spec.md
// asks for." to a task that withholds spec.md, and never sent its two session instructions.
test("solo and framework get every session instruction of a multi-session dev task", () => {
  for (const task of bar.dev) {
    const { steps, copy_spec } = oe.taskConfig(task);
    for (const arm of ["solo", "framework"]) {
      const prompts = oe.armPrompts(task, arm);
      if (!steps || copy_spec) { assert.equal(prompts.length, 1, `${task}/${arm}`); assert.match(prompts[0], /spec\.md/, `${task}/${arm}`); continue; }
      assert.equal(prompts.length, steps.length, `${task}/${arm}`);
      prompts.forEach((p, i) => { assert.ok(p.startsWith(steps[i].instruction), `${task}/${arm} step ${i + 1}`); assert.doesNotMatch(p, /spec\.md/, `${task}/${arm} step ${i + 1}`); });
      if (arm === "solo") assert.deepEqual(prompts, steps.map((s) => s.instruction));
      else prompts.forEach((p, i) => assert.equal(p, `${steps[i].instruction} ${oe.ARMS.framework.slice("Build what spec.md asks for.".length).trim()}`));
    }
  }
  assert.ok(bar.dev.some((t) => oe.taskConfig(t).steps && !oe.taskConfig(t).copy_spec), "a multi-session dev task exists");
  assert.throws(() => oe.armPrompts("continuity-rules", "plain"), /cannot run multi-session/);
});

test("promptSha hashes the prompts a multi-session task actually sends, and is unchanged for one-prompt tasks", () => {
  const h = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 12);
  for (const arm of ["solo", "framework"]) {
    assert.equal(oe.promptSha(arm, "continuity-rules"), h(oe.armPrompts("continuity-rules", arm).join("\n\0\n")));
    assert.notEqual(oe.promptSha(arm, "continuity-rules"), h(oe.ARMS[arm]));
    assert.equal(oe.promptSha(arm, "yoga-studio"), h(oe.ARMS[arm]));
  }
});

test("preflight refuses an arm that cannot prompt a multi-session task, before any job runs", () => {
  const bad = oe.preflightRun({ tasks: ["continuity-rules"], arms: ["solo", "plain"], reps: 1, maxUsd: 5, bar: { floor_usd: 0.5, reserve: [] }, dirOf: () => null });
  assert.match(bad.error, /refusing to start: arm plain cannot run multi-session task continuity-rules/);
  const ok = oe.preflightRun({ tasks: ["continuity-rules"], arms: ["solo", "framework"], reps: 1, maxUsd: 5, bar: { floor_usd: 0.5, reserve: [] }, dirOf: () => null });
  assert.equal(ok.error, undefined);
  const r = run(["--arms", "plain", "--tasks", "continuity-rules", "--reps", "1", "--max-usd", "5", "--judge", "none"]);
  assert.equal(r.status, 2, r.stderr); assert.match(r.stderr, /cannot run multi-session task continuity-rules/);
});

// ---- the task repo is an ordinary checkout, and the model sees no per-job budget ----
test("prepare seeds main with one root commit and origin/main, identically for every arm", () => {
  const a = oe.prepare("bugfix-rootcause"), b = oe.prepare("bugfix-rootcause");
  const git = (d, ...args) => spawnSync("git", args, { cwd: d, encoding: "utf8" }).stdout.trim();
  for (const d of [a, b]) {
    assert.equal(git(d, "branch", "--show-current"), "main");
    assert.equal(git(d, "rev-list", "--count", "HEAD"), "1");
    assert.equal(git(d, "log", "-1", "--format=%s"), oe.SEED_MESSAGE);
    assert.equal(git(d, "rev-parse", "origin/main"), git(d, "rev-parse", "HEAD"));
    assert.equal(git(d, "remote"), "", "no network remote");
    assert.equal(git(d, "status", "--porcelain"), "", "every task file is in the root commit");
  }
  assert.equal(git(a, "rev-parse", "HEAD"), git(b, "rev-parse", "HEAD"), "same seed commit for both arms");
  for (const d of [a, b]) fs.rmSync(d, { recursive: true, force: true });
});

test("the builder session gets no --max-budget-usd (the CLI would show it to the model)", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  const call = src.match(/const step = await runAgent\([^\n]*\n?/)[0];
  assert.doesNotMatch(call, /max-budget-usd/);
});

test("both arms get the web tools a real Claude Code user has (WebSearch, WebFetch), so research stages can run", () => {
  for (const arm of ["solo", "framework"]) {
    const tools = armTools(undefined, arm).split(",");
    for (const t of ["WebSearch", "WebFetch"]) assert.ok(tools.includes(t), `${arm} has ${t}`);
  }
  assert.deepEqual(toolDiff(armTools(undefined, "solo"), armTools(undefined, "framework")), { only_a: [], only_b: ["Skill"] });
});
