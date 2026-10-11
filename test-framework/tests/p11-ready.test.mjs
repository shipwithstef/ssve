// @organism-suite
// Fixes required before the paid P1.1 baseline: run does not silently run every task, reserve
// hashes are checked before paying, --sealed prints no score, solo and framework differ by
// exactly Skill, and no judge means the builder gets the whole share. No model is called.
import test from "node:test";
import assert from "node:assert/strict";
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
  assert.throws(() => assertBalanced(tamper((x) => { x.runs.find((r) => r.arm === "solo").contract.tools += ",WebFetch"; }), bar), /more than Skill: WebFetch/);
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
  const r = oe.preflightRun({ tasks, arms: ["solo", "framework"], reps: 3, maxUsd: 35, bar: { floor_usd: 0.5 }, dirOf: () => null });
  assert.match(r.error, /156 jobs/); assert.match(r.error, /\$0\.224 per job/); assert.match(r.error, /\$0\.5 floor/);
  assert.ok(oe.preflightRun({ tasks: ["a"], arms: ["solo"], reps: 1, maxUsd: 0.8, bar: { floor_usd: 1 }, dirOf: () => null }).error, "floor from the bar, not the default");
  assert.equal(oe.barFloor(null), 0.5);
  assert.equal(oe.barFloor({}), 0.5);
  assert.equal(oe.barFloor({ floor_usd: 0.75 }), 0.75);
});

test("preflight prints the plan line; no cap keeps --tasks optional", () => {
  const ok = oe.preflightRun({ tasks: ["a", "b"], arms: ["solo", "framework"], reps: 3, maxUsd: 12, bar: { floor_usd: 0.5 }, dirOf: () => null });
  assert.equal(ok.error, undefined);
  assert.equal(ok.jobs, 12);
  assert.equal(ok.line, "plan: tasks a,b; 12 jobs; $1.000 per job; arms solo,framework");
  const free = oe.preflightRun({ tasks: ["a"], arms: ["solo"], reps: 1, maxUsd: null, bar: { floor_usd: 0.5 }, dirOf: () => null });
  assert.match(free.line, /no cap/);
});

test("run without --tasks under a cap that cannot fund every task exits 2 before anything starts", () => {
  const r = run(["--arms", "solo,framework", "--max-usd", "35", "--framework-sha", "deadbeef"]);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /refusing to start: \d+ jobs/);
  assert.match(r.stderr, /per job, below the \$0\.5 floor/);
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
