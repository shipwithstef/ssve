// @organism-suite
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  loadBar, loadRows, decide, adopt, buildManifest, assertBalanced, dryRun, main, NorthstarError, catalogOverhead,
  isFinished, isVoid, fakeRun, reserveHashes, syntheticOverhead, unfinishedReason, offModel,
} from "../../scripts/northstar.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, "../outcome-evals/northstar/fixtures");
const CLI = path.join(HERE, "../../scripts/northstar.mjs");
const bar = loadBar();
const fx = (n) => loadRows([path.join(FIX, `${n}.json`)]);
const dev = (n, extra = {}) => decide(fx(n), { slice: "dev", bar, ...extra });
const cell = (d, task, comp) => d.cells.find((c) => c.task === task && c.component === comp);
const con = (d, task, id) => d.constraints.find((c) => c.task === task && c.id === id);
const near = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

// ---- bar.json ----
test("bar.json carries the pre-registration from the plan", () => {
  assert.deepEqual(bar.dev, ["yoga-studio", "ai-quest", "waitlist-feature", "bugfix-rootcause", "security-payments", "typo-readme", "continuity-rules"]);
  assert.deepEqual(bar.reserve.map((r) => r.task), ["R1", "R2"]);
  for (const r of bar.reserve) assert.match(r.grader_sha256, /^[0-9a-f]{64}$/, `${r.task} is frozen by its task hash`);
  assert.deepEqual(bar.matrix, {
    "yoga-studio": ["E", "S", "P"], "ai-quest": ["E", "P", "K"], "waitlist-feature": ["E", "S", "P"], "bugfix-rootcause": ["E", "P"],
    "security-payments": ["E", "S", "P"], "typo-readme": [], "continuity-rules": ["K"], R1: ["E", "S", "P", "K"], R2: ["E", "S", "P", "K"],
  });
  assert.deepEqual(bar.arms, ["solo", "framework"]);
  assert.equal(bar.overhead_task, "empty");
  assert.equal(bar.reps, 3); assert.equal(bar.parallel, 4); assert.equal(bar.overhead_task, "empty"); assert.equal(bar.floor_usd, 0.5);
  assert.deepEqual(bar.pass, { R_min: 2.0, delta_min: 0.2, delta_ci_low_gt: 0 });
  assert.equal(bar.min_finished_runs_per_cell_arm, 3);
  assert.deepEqual(bar.arm_limits, { time: 2, turns: 3, same_for_all_arms: true });
  assert.equal(bar.constraints.h_max_drop, 0.05);
  assert.equal(bar.constraints.product_cost_ratio_max, 1.5);
  assert.equal(bar.constraints.product_wall_ratio_max, 1.3);
  assert.equal(bar.constraints.typo_cost_ratio_max_net_overhead, 1.3);
  assert.equal(bar.budgets["P1.1"].cap_usd, 35);
  assert.equal(bar.budgets["P1.3"].cap_usd_each, 8);
  assert.equal(bar.budgets["P1.4"].cap_usd, 35);
  assert.equal(bar.budgets["P1.5"].min_cap_usd_total, 18);
  assert.equal(bar.budgets["P1.6"].owner_yes, true);
  assert.equal(bar.budgets["P1.6"].forecast_required, true);
  assert.doesNotMatch(JSON.stringify(bar), /\/home\/|\/Users\//);
});

// ---- decide ----
test("clear win: a finished run without an applicable component score makes that cell incomplete evidence", () => {
  const d = dev("dev-pass");
  assert.equal(d.headline.cells_numbered, 3); // yoga E and P, continuity K
  assert.equal(d.headline.cells_excluded, 12); // yoga S plus the 11 cells of tasks with no rows
  assert.deepEqual(d.headline.tasks_without_rows, ["ai-quest", "waitlist-feature", "bugfix-rootcause", "security-payments"]);
  // yoga framework S: [0.6, 0.5, missing]: not a measured zero, the cell is excluded
  const s = cell(d, "yoga-studio", "S");
  assert.equal(s.numbered, false); assert.equal(s.incomplete_evidence, true);
  assert.equal(s.framework.missing_component_runs, 1); assert.equal(s.framework.n_runs, 3);
  assert.match(s.excluded_reason, /incomplete evidence: framework has 1 finished run\(s\) without a S score/);
  assert.equal(d.overall, "incomplete");
  assert.ok(d.incomplete_reasons.some((r) => /1 cell\(s\) with incomplete evidence/.test(r)));
  near(d.headline.R.value, (0.8 + 0.9 + 1) / (0.2 + 0.3 + 0), 1e-3);
  near(d.headline.delta, (0.6 + 0.6 + 1) / 3, 1e-3);
  assert.ok(d.headline.ci95[0] > 0);
  assert.equal(d.headline.pass, true);
  assert.equal(d.pass, true);
  // zeros are kept only for unfinished runs: an errored run is a measured 0
  const crashed = dev("interrupted");
  assert.equal(cell(crashed, "yoga-studio", "E").numbered, true);
  near(cell(crashed, "yoga-studio", "E").framework.mean, 0.6);
});

test("a cell the matrix does not apply to is never numbered (typo-readme has no cells)", () => {
  const d = dev("dev-pass");
  assert.equal(d.cells.filter((c) => c.task === "typo-readme").length, 0);
  assert.equal(d.cells.filter((c) => c.task === "continuity-rules").length, 1);
});

test("solo zero everywhere: R is not defined and the headline can still pass", () => {
  const d = dev("solo-zero");
  assert.deepEqual(d.headline.R, { defined: false, value: null, reason: "not defined: solo 0 everywhere" });
  near(d.headline.delta, (0.6 + 0.5 + 0.6) / 3);
  assert.equal(d.headline.checks.R, true);
  assert.equal(d.headline.pass, true);
});

test("a both-zero cell adds 0 to both sums", () => {
  const d = dev("both-zero-cell");
  const k = cell(d, "continuity-rules", "K");
  assert.equal(k.numbered, true); assert.equal(k.both_zero, true); assert.equal(k.delta, 0);
  assert.equal(d.headline.R.value, 4); // (0.8+0.7+0.9+0) / (0.2+0.1+0.3+0)
  near(d.headline.delta, 0.45);
  assert.equal(d.headline.pass, true);
});

test("a cell with only 2 finished runs gets no number and is reported", () => {
  const d = dev("two-finished");
  for (const c of ["E", "S", "P"]) {
    const x = cell(d, "yoga-studio", c);
    assert.equal(x.numbered, false); assert.equal(x.solo.n_finished, 2); assert.equal(x.solo.n_runs, 3);
    assert.match(x.excluded_reason, /solo: 2 finished run\(s\) < 3/);
    assert.equal(x.delta, undefined);
  }
  assert.equal(d.headline.cells_numbered, 1);
  assert.equal(d.headline.cells_excluded, 14); // 3 thin yoga cells + 11 cells of tasks with no rows
  assert.equal(d.headline.R.value, 5); // only continuity K: 1 / 0.2
  near(d.headline.delta, 0.8);
  // the timed-out run still has its spend
  assert.equal(d.per_task["yoga-studio"].solo.cost_total_usd, 2.9);
  assert.equal(con(d, "yoga-studio", "cost_ratio").status, "unmeasured");
});

test("interrupted runs score 0 on every component and their spend stays in cost", () => {
  const d = dev("interrupted");
  const e = cell(d, "yoga-studio", "E");
  assert.equal(e.numbered, true); assert.equal(e.framework.n_runs, 4); assert.equal(e.framework.n_finished, 3);
  near(e.framework.mean, 0.6); // (0.8*3 + 0) / 4
  assert.equal(d.per_task["yoga-studio"].framework.cost_total_usd, 3.8);
  assert.equal(d.per_task["yoga-studio"].framework.errored, 1);
  near(d.per_task["yoga-studio"].framework.h_mean, (0.9 * 3) / 4);
  near(d.headline.R.value, 3);
});

test("mixed usage: an off-model-work row scores 0, its spend and tokens stay", () => {
  const d = dev("mixed-usage");
  const p = cell(d, "yoga-studio", "P");
  near(p.framework.mean, 0.6);
  assert.equal(p.framework.n_finished, 3);
  assert.equal(d.per_task["yoga-studio"].framework.cost_total_usd, 5);
  assert.ok(d.cost_per_arm.framework.tokens_mean > d.cost_per_arm.solo.tokens_mean); // opus tokens recorded
});

test("exhausted budgets: skipped and capped runs score 0, thin cells get no number", () => {
  const d = dev("budget-exhausted");
  for (const c of ["E", "S", "P"]) {
    const x = cell(d, "yoga-studio", c);
    assert.equal(x.numbered, false);
    assert.equal(x.framework.n_runs, 3); assert.equal(x.framework.n_finished, 1);
    assert.match(x.excluded_reason, /framework: 1 finished run\(s\) < 3/);
  }
  assert.equal(d.per_task["yoga-studio"].framework.cost_total_usd, 1.4); // skipped adds 0, capped keeps 0.4
  assert.equal(d.per_task["yoga-studio"].framework.stopped, 1);
  assert.equal(d.headline.cells_numbered, 1);
  assert.equal(d.headline.pass, true); // on continuity K alone
  assert.equal(d.overall, "incomplete"); // yoga constraints are unmeasured, none failed
});

test("paired outcomes: identical arms give delta 0 and no pass", () => {
  const d = dev("tie");
  assert.equal(d.headline.delta, 0);
  assert.equal(d.headline.R.value, 1);
  assert.equal(d.headline.checks.R, false); assert.equal(d.headline.checks.delta, false); assert.equal(d.headline.checks.ci_low, false);
  assert.equal(d.headline.pass, false);
  assert.equal(d.overall, "fail");
});

test("constraint failures: H drop, cost ratio, wall ratio and a miss where solo solved all", () => {
  const d = dev("constraint-failures");
  assert.equal(d.headline.pass, true); // headline alone passes; constraints decide overall
  const drop = con(d, "yoga-studio", "h_drop"); assert.equal(drop.status, "fail"); near(drop.value, 0.1);
  const cost = con(d, "yoga-studio", "cost_ratio"); assert.equal(cost.status, "fail"); near(cost.value, 1.6);
  const wall = con(d, "yoga-studio", "wall_ratio"); assert.equal(wall.status, "fail"); near(wall.value, 1.4);
  assert.equal(con(d, "waitlist-feature", "h_drop").status, "pass"); // 0.033 under the 0.05 limit
  assert.equal(con(d, "waitlist-feature", "h_miss").status, "fail"); // solo solved every run, framework missed one
  assert.equal(con(d, "waitlist-feature", "cost_ratio").status, "pass");
  assert.equal(d.constraints_failed, 4);
  assert.equal(d.overall, "fail");
});

test("constraints pass in the clear win; the miss rule does not apply when solo missed", () => {
  const d = dev("dev-pass");
  assert.equal(con(d, "yoga-studio", "cost_ratio").status, "pass");
  assert.equal(con(d, "yoga-studio", "wall_ratio").status, "pass");
  assert.equal(con(d, "yoga-studio", "h_drop").status, "pass");
  assert.equal(con(d, "yoga-studio", "h_miss").status, "pass"); // solo H 0.9: not a solved-every-run task
  assert.equal(con(d, "continuity-rules", "cost_ratio"), undefined); // not a product task
});

test("typo cost: unmeasured without an overhead file, measured net of overhead with one", () => {
  const none = dev("dev-pass");
  assert.equal(con(none, "typo-readme", "typo_cost").status, "unmeasured");
  assert.equal(none.overall, "incomplete");

  const ok = dev("dev-pass", { overheadRows: fx("overhead") });
  const t = con(ok, "typo-readme", "typo_cost");
  assert.equal(t.status, "pass"); near(t.overhead_usd, 0.16); near(t.net_usd, 0.04); near(t.value, 0.8);
  assert.equal(ok.constraints_unmeasured, 0);
  assert.equal(ok.overall, "incomplete"); // the other registered tasks have no rows

  const small = dev("dev-pass", { overheadRows: fx("overhead-small") });
  assert.equal(con(small, "typo-readme", "typo_cost").status, "fail"); // 0.20 - 0.02 = 0.18 > 1.3 * 0.05
  assert.equal(small.overall, "fail");
  assert.deepEqual(catalogOverhead(fx("overhead"), bar).n, [3, 3]);
  assert.throws(() => catalogOverhead(fx("overhead").filter((r) => r.arm === "solo"), bar), /needs at least 3 finished, costed runs per arm/);
});

test("duplicate task/arm/rep rows are an input error naming them; the flag counts them as separate runs", () => {
  assert.throws(() => dev("rerun"), (e) => e instanceof NorthstarError && /continuity-rules\/framework#2 x2/.test(e.message) && /--allow-duplicate-reps/.test(e.message));
  const d = dev("rerun", { allowDuplicateReps: true });
  const k = cell(d, "continuity-rules", "K");
  assert.equal(k.framework.n_runs, 4); assert.equal(k.framework.n_finished, 4); // the flagged first attempt is its own run, graded K 0
  near(k.framework.mean, 0.75);
  assert.equal(d.per_task["continuity-rules"].framework.cost_total_usd, 2.4);
  assert.equal(d.per_task["continuity-rules"].framework.rules_not_loaded, 1);
  assert.equal(d.per_task["continuity-rules"].framework.fail_open, 2);
  assert.throws(() => adopt(fx("rerun"), { candidate: "framework", baseline: "solo", component: "K" }), NorthstarError);
});

test("overall is never PASS while a registered task has no rows or a cell is excluded", () => {
  const d = dev("dev-pass", { overheadRows: fx("overhead") });
  assert.equal(d.pass, true); // the headline is still computed and passes
  assert.equal(d.overall, "incomplete");
  assert.ok(d.incomplete_reasons.some((r) => /no rows for registered task\(s\): ai-quest, waitlist-feature, bugfix-rootcause, security-payments/.test(r)));
  assert.ok(d.incomplete_reasons.some((r) => /12 cell\(s\) excluded/.test(r)));
  const thin = dev("two-finished");
  assert.equal(thin.overall, "incomplete");
  assert.ok(thin.incomplete_reasons.some((r) => /excluded without a number/.test(r)));
  // a failing headline stays "fail", not "incomplete"
  assert.equal(dev("tie").overall, "fail");
});

test("a complete, passing slice is the only way to overall PASS", () => {
  const m = buildManifest({ model: "fake-model", maxUsd: 35, slice: "all", dryRun: true, bar });
  const d = dryRun(m, bar);
  for (const s of ["dev", "reserve"]) {
    assert.equal(d.decisions[s].overall, "pass", JSON.stringify(d.decisions[s].incomplete_reasons));
    assert.deepEqual(d.decisions[s].incomplete_reasons, []);
  }
  // remove one task's rows and it is no longer complete
  const rows = m.runs.map((e) => fakeRun(e, bar)).filter((r) => r.task !== "ai-quest");
  const part = decide(rows, { slice: "dev", bar, overheadRows: syntheticOverhead("fake-model", bar) });
  assert.equal(part.overall, "incomplete");
});

test("runner termination is normalised: ok false and error/budget/turn caps are unfinished", () => {
  const d = dev("termination");
  const fw = d.per_task["yoga-studio"].framework;
  // finished: stop "success" and "end_turn" only
  assert.equal(fw.n_runs, 6); assert.equal(fw.n_finished, 2);
  near(cell(d, "yoga-studio", "E").framework.mean, (0.8 * 2) / 6);
  assert.equal(cell(d, "yoga-studio", "E").numbered, false); // 2 finished < 3
  assert.equal(fw.cost_total_usd, 0.5 + 0.6 + 4 * 1.0); // spend stays
  const ok = { model: "m", model_usage: { m: { outputTokens: 100 } } };
  for (const stop of ["error_max_budget_usd", "error_during_execution", "error_max_turns", "max_turns", "timeout"]) assert.equal(isFinished({ ...ok, stop }), false, stop);
  assert.equal(isFinished({ ...ok, stopped_by: "turns" }), false);
  assert.equal(isFinished({ ...ok, ok: false }), false);
  assert.equal(isFinished({ ...ok, stop: "success" }), true);
  assert.equal(isFinished({ ...ok, stop: "end_turn", ok: true }), true);
  assert.equal(isFinished(ok), true);
});

test("a row without a builder sandbox is void: excluded from scores and costs, overall incomplete", () => {
  const d = dev("void-sandbox");
  assert.equal(d.void_runs, 2);
  assert.deepEqual(d.void_by_arm, { solo: 0, framework: 2 });
  const fw = d.per_task["yoga-studio"].framework;
  assert.equal(fw.n_runs, 2); assert.equal(fw.cost_total_usd, 2); // the $7 and $9 void rows never count
  assert.equal(cell(d, "yoga-studio", "E").numbered, false); // only 2 usable framework runs
  assert.equal(d.overall, "incomplete");
  assert.ok(d.incomplete_reasons.some((r) => /2 void run\(s\)/.test(r)));
  assert.equal(d.cost_per_arm.framework.cost_total_usd, 2);
  // skipped rows never ran, so no sandbox is expected of them
  assert.equal(dev("budget-exhausted").void_runs, 0);
  // adopt ignores void rows too
  const nosb = [...fx("tie").map((r) => ({ ...r, builder_sandbox: null }))];
  assert.equal(adopt(nosb, { candidate: "framework", baseline: "solo", component: "E" }).n[0], 0); // every row void: none counted
  assert.equal(isVoid({ builder_sandbox: null }), true);
  assert.equal(isVoid({}), true);
  assert.equal(isVoid({ builder_sandbox: "bwrap" }), false);
});

test("judge cost stays out of arm cost and is reported separately per arm", () => {
  const d = dev("judged");
  assert.equal(d.cost_per_arm.solo.cost_total_usd, 1.5); assert.equal(d.cost_per_arm.solo.judge_cost_usd, 0.21);
  assert.equal(d.cost_per_arm.framework.cost_total_usd, 1.8); assert.equal(d.cost_per_arm.framework.judge_cost_usd, 0.27);
  assert.equal(d.per_task["continuity-rules"].framework.judge_cost_usd, 0.27);
  assert.equal(d.diagnostics.framework.judge_cost_usd, 0.27);
});

test("typo task: H must not drop at all, upstream stages are a constraint", () => {
  const d = dev("typo-fail");
  const drop = con(d, "typo-readme", "h_drop");
  assert.equal(drop.limit, 0); assert.equal(drop.status, "fail"); near(drop.value, 1 / 300, 1e-3); // 0.0033 < the general 0.05 allowance, still a fail
  assert.equal(con(d, "typo-readme", "h_miss").status, "fail"); // solo solved every run, framework missed one
  const up = con(d, "typo-readme", "upstream_stages");
  assert.equal(up.status, "fail"); assert.match(up.note, /write-spec, design-ux/);
  // framework rows without the field: unmeasured, not pass
  const none = dev("typo-no-stages");
  assert.equal(con(none, "typo-readme", "upstream_stages").status, "unmeasured");
  assert.equal(con(none, "typo-readme", "h_drop").status, "pass");
  // all listed empty: pass
  assert.equal(con(dev("dev-pass"), "typo-readme", "upstream_stages").status, "pass");
  // non-typo tasks keep the 0.05 allowance
  assert.equal(con(dev("constraint-failures"), "waitlist-feature", "h_drop").limit, 0.05);
});

test("slices are judged separately and rows outside the slice are ignored", () => {
  // the reserve slice needs a frozen reserve; the hashes here are placeholders for rows that never reach them
  const frozen = { ...bar, reserve: bar.reserve.map((r) => ({ ...r, grader_sha256: "a".repeat(64) })) };
  const res = decide(fx("dev-pass"), { slice: "reserve", bar: frozen });
  assert.equal(res.headline.cells_numbered, 0);
  assert.equal(res.headline.pass, false);
  assert.equal(res.overall, "incomplete"); // nothing numbered yet: not evidence of failure
  assert.ok(res.incomplete_reasons.includes("no cell has a number"));
  assert.throws(() => decide([], { slice: "all", bar }), NorthstarError);
});

test("decide is deterministic", () => {
  assert.deepEqual(dev("interrupted"), dev("interrupted"));
});

// ---- adopt ----
test("adopt: n >= 5 per arm, p < .05, ci low > 0, else inconclusive", () => {
  const mk = (arm, vals) => vals.map((v, i) => ({ task: "t", arm, rep: i + 1, builder_sandbox: "bwrap", model: "m", model_usage: { m: { outputTokens: 100 } }, score: v, hidden_total: 10, components: { E: v } }));
  const rows = [...mk("cand", [0.9, 0.95, 1, 0.85, 0.9, 1]), ...mk("base", [0.1, 0.2, 0.15, 0.1, 0.2, 0.1])];
  const a = adopt(rows, { candidate: "cand", baseline: "base", component: "E" });
  assert.equal(a.decision, "adopt"); assert.equal(a.needs_holdout_confirmation, true);
  const few = adopt(rows.filter((r) => !(r.arm === "cand" && r.rep > 4)), { candidate: "cand", baseline: "base", component: "H" });
  assert.equal(few.decision, "inconclusive");
  assert.throws(() => adopt(rows, { candidate: "cand", baseline: "base", component: "X" }), NorthstarError);
  // unfinished runs score 0 and drag the candidate
  const broken = rows.map((r) => (r.arm === "cand" ? { ...r, error: "crash" } : r));
  assert.equal(adopt(broken, { candidate: "cand", baseline: "base", component: "E" }).decision, "inconclusive");
});

// ---- plan ----
test("plan: balanced manifest, every task x arm x rep funded at or above the floor", () => {
  // The reserve is outside the repo and frozen by hash: stand it in with a temp root.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ns-plan-reserve-"));
  for (const t of ["R1", "R2"]) { fs.mkdirSync(path.join(root, t)); fs.writeFileSync(path.join(root, t, "task.json"), "{}"); }
  const frozen = { ...bar, reserve: bar.reserve.map((r) => ({ ...r, grader_sha256: reserveHashes(root, bar)[r.task] })) };
  const m = buildManifest({ model: "haiku", maxUsd: 35, slice: "all", frameworkSha: "dc358c0", bar: frozen, tasksRoots: [root] });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(m.runs.length, 54);
  assert.equal(m.forecast.runs, 54);
  assert.equal(m.per_run_usd, +(35 / 54).toFixed(4));
  assert.ok(m.per_run_usd >= 0.5);
  assert.equal(m.parallel, 4);
  assert.deepEqual(m.forecast.per_arm, { solo: 27, framework: 27 });
  for (const e of m.runs) {
    assert.equal(e.isolation.builder_sandbox, true); assert.equal(e.isolation.private_home, true);
    assert.equal(e.isolation.framework_sha, e.arm === "framework" ? "dc358c0" : null);
  }
  assert.equal(buildManifest({ model: "haiku", maxUsd: 35, slice: "dev", frameworkSha: "x", bar }).runs.length, 42);
  assert.equal(buildManifest({ model: "haiku", maxUsd: 8, slice: "dev", reps: 1, frameworkSha: "x", bar }).runs.length, 14);
});

test("plan refuses when it cannot fund every pair at the floor", () => {
  assert.throws(() => buildManifest({ model: "haiku", maxUsd: 20, slice: "dev", frameworkSha: "x", bar }), /cannot fund every pair does not start/);
  assert.throws(() => buildManifest({ model: "haiku", maxUsd: 20, slice: "dev", frameworkSha: "x", bar }), /\$0\.476/);
  assert.throws(() => buildManifest({ model: "haiku", maxUsd: 35, slice: "all", bar }), /framework-sha/); // framework arm must be pinned
  assert.throws(() => buildManifest({ maxUsd: 35, bar }), /--model/);
  assert.throws(() => buildManifest({ model: "haiku", bar }), /--max-usd/);
});

test("task contract hash covers what the agent sees, never the hidden grader", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ns-tasks-"));
  fs.mkdirSync(path.join(dir, "t1"));
  fs.writeFileSync(path.join(dir, "t1/spec.md"), "spec");
  fs.writeFileSync(path.join(dir, "t1/hidden.test.mjs"), "a");
  const small = { ...bar, dev: ["t1"], matrix: { t1: ["E"] } };
  const a = buildManifest({ model: "m", maxUsd: 10, slice: "dev", frameworkSha: "x", bar: small, tasksDir: dir });
  fs.writeFileSync(path.join(dir, "t1/hidden.test.mjs"), "changed");
  const b = buildManifest({ model: "m", maxUsd: 10, slice: "dev", frameworkSha: "x", bar: small, tasksDir: dir });
  assert.equal(a.runs[0].contract.task_files_sha256, b.runs[0].contract.task_files_sha256);
  fs.writeFileSync(path.join(dir, "t1/spec.md"), "spec v2");
  const c = buildManifest({ model: "m", maxUsd: 10, slice: "dev", frameworkSha: "x", bar: small, tasksDir: dir });
  assert.notEqual(a.runs[0].contract.task_files_sha256, c.runs[0].contract.task_files_sha256);
  assert.equal(a.runs[0].contract.timeout_ms, 15 * 60000 * 2);
  assert.equal(a.runs[0].contract.max_turns, 40 * 3);
  assert.equal(a.runs[0].contract.timeout_ms, a.runs[1].contract.timeout_ms); // same for both arms
});

test("plan refuses a manifest whose arms differ in contract or isolation", () => {
  const good = () => buildManifest({ model: "haiku", maxUsd: 35, slice: "dev", frameworkSha: "x", bar });
  assert.equal(assertBalanced(good(), bar), true);
  const tampered = (fn) => { const m = good(); fn(m); return m; };
  assert.throws(() => assertBalanced(tampered((m) => { m.runs.find((e) => e.arm === "framework").contract.tools += ",WebFetch"; }), bar), /different task contracts/); // Skill is the one allowed difference (p11-ready tests)
  assert.throws(() => assertBalanced(tampered((m) => { m.runs.find((e) => e.arm === "framework").contract.timeout_ms *= 2; }), bar), /different task contracts/);
  assert.throws(() => assertBalanced(tampered((m) => { m.runs.find((e) => e.arm === "solo").isolation.builder_sandbox = false; }), bar), /not sandboxed/);
  assert.throws(() => assertBalanced(tampered((m) => { m.runs.find((e) => e.arm === "framework").isolation.private_home = false; }), bar), /no private home/);
  assert.throws(() => assertBalanced(tampered((m) => { m.runs.find((e) => e.arm === "framework").budget_usd = 0.9; }), bar), /different budgets/);
  assert.throws(() => assertBalanced(tampered((m) => { m.runs = m.runs.filter((e) => !(e.arm === "solo" && e.rep === 1)); }), bar), /no solo run/);
});

test("dry run: fake runner rows go through decide end to end at $0", () => {
  const m = buildManifest({ model: "fake-model", maxUsd: 35, slice: "all", dryRun: true, bar });
  const d = dryRun(m, bar);
  assert.equal(d.rows, 54);
  assert.deepEqual(Object.keys(d.decisions).sort(), ["dev", "reserve"]);
  assert.equal(d.decisions.dev.rows_used, 42);
  assert.equal(d.decisions.dev.headline.cells_numbered, 15); // 3+3+3+2+3+0+1
  assert.equal(d.decisions.reserve.headline.cells_numbered, 8);
  assert.equal(d.decisions.dev.headline.pass, true);
  assert.deepEqual(dryRun(m, bar), d); // deterministic
});

// ---- CLI ----
const cli = (...args) => spawnSync(process.execPath, [CLI, ...args], { encoding: "utf8" });

test("cli decide prints JSON and a human summary", () => {
  const r = cli("decide", path.join(FIX, "dev-pass.json"), "--slice", "dev", "--overhead", path.join(FIX, "overhead.json"));
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.overall, "incomplete");
  assert.match(r.stderr, /headline pass: YES/);
  assert.match(r.stderr, /overall: INCOMPLETE/);
  assert.match(r.stderr, /incomplete: no rows for registered task/);
  const dup = cli("decide", path.join(FIX, "rerun.json"), "--slice", "dev");
  assert.equal(dup.status, 1); assert.match(dup.stderr, /duplicate task\/arm\/rep/);
  assert.equal(cli("decide", path.join(FIX, "rerun.json"), "--slice", "dev", "--allow-duplicate-reps").status, 0);
});

test("cli plan: refusal exits 1 with the message; success prints a manifest and forecast", () => {
  const bad = cli("plan", "--model", "haiku", "--max-usd", "10", "--slice", "dev", "--framework-sha", "abc");
  assert.equal(bad.status, 1); assert.match(bad.stderr, /cannot fund every pair does not start/);
  const ok = cli("plan", "--model", "haiku", "--max-usd", "35", "--slice", "dev", "--framework-sha", "abc");
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).runs.length, 42);
  assert.match(ok.stderr, /forecast spend up to \$35/);
});

test("cli plan --dry-run needs no model, key or money", () => {
  const r = cli("plan", "--dry-run");
  assert.equal(r.status, 0, r.stderr);
  const j = JSON.parse(r.stdout);
  assert.equal(j.manifest.dry_run, true); assert.equal(j.dry_run.rows, 54);
});

test("cli adopt and usage errors", () => {
  assert.equal(cli("adopt", path.join(FIX, "tie.json")).status, 1);
  const r = cli("adopt", path.join(FIX, "tie.json"), "--candidate", "framework", "--baseline", "solo", "--component", "E");
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).decision, "inconclusive"); // n = 3 per arm
  assert.equal(cli("decide", path.join(FIX, "tie.json")).status, 1); // no --slice
  assert.equal(cli("bogus").status, 1);
  assert.equal(main(["bogus"], { out() {}, err() {} }), 1);
});

// ---- round 2 ----
const runRow = (task, arm, rep, o = {}) => ({
  task, arm, rep, builder_sandbox: "bwrap", model: "m", framework_sha: arm === "framework" ? "sha1" : null,
  model_usage: { m: { inputTokens: 100, outputTokens: 100 } }, cost_usd: 1, wall_ms: 1000, turns: 5,
  score: 1, solved: true, hidden_total: 10, hidden_pass: 10, ...o,
});
// yoga-studio rows from per-component arrays: { E: [..3], S: [..], P: [..], H: [..] } per arm
const yoga = (solo, fw, extra = {}) => ["solo", "framework"].flatMap((arm) => [0, 1, 2].map((i) => {
  const c = arm === "solo" ? solo : fw;
  return runRow("yoga-studio", arm, i + 1, { score: c.H[i], solved: c.H[i] === 1, components: { E: c.E[i], S: c.S[i], P: c.P[i] }, ...(extra[arm] || {}) });
}));
const flat = (v) => [v, v, v];

test("decisions compare raw values: R of 1.999975 and a typo H drop of 0.00004 do not pass", () => {
  // solo sums 0.4 (E.2 S.1 P.1), framework sums 0.79999 -> R = 1.999975 shows as 2 when rounded to 4 places
  const rows = yoga({ H: flat(0.9), E: flat(0.2), S: flat(0.1), P: flat(0.1) }, { H: flat(0.9), E: flat(0.5), S: flat(0.2), P: flat(0.09999) });
  const d = decide(rows, { slice: "dev", bar });
  assert.equal(d.headline.R.value, 2); // display rounds to 4 places
  assert.ok(d.headline.raw.R < 2);
  assert.equal(d.headline.checks.R, false);
  assert.equal(d.headline.pass, false);
  // typo H drop 0.00004: shown as 0 at 4 places, still a fail against the 0 limit
  const typo = ["solo", "framework"].flatMap((arm) => [1, 2, 3].map((i) => runRow("typo-readme", arm, i, { score: arm === "solo" ? 1 : 0.99996, solved: arm === "solo", upstream_stages: [] })));
  const t = decide(typo, { slice: "dev", bar });
  const drop = con(t, "typo-readme", "h_drop");
  assert.equal(drop.status, "fail"); assert.ok(drop.value === 0 || drop.value === 0.0000); // displayed rounded
  // and an exact-limit case still passes: framework equals solo
  const same = ["solo", "framework"].flatMap((arm) => [1, 2, 3].map((i) => runRow("typo-readme", arm, i, { upstream_stages: [] })));
  assert.equal(con(decide(same, { slice: "dev", bar }), "typo-readme", "h_drop").status, "pass");
});

test("a cost ratio just over the limit fails on raw values even when it displays as the limit", () => {
  const mk = (fwCost) => ["solo", "framework"].flatMap((arm) => [1, 2, 3].map((i) => runRow("yoga-studio", arm, i, { cost_usd: arm === "solo" ? 1 : fwCost, components: { E: 0.5, S: 0.5, P: 0.5 } })));
  assert.equal(con(decide(mk(1.5), { slice: "dev", bar }), "yoga-studio", "cost_ratio").status, "pass");
  const over = con(decide(mk(1.50000001), { slice: "dev", bar }), "yoga-studio", "cost_ratio");
  assert.equal(over.status, "fail"); assert.equal(over.value, 1.5);
});

test("a finished run missing cost or wall time makes that constraint unmeasured, so overall is not PASS", () => {
  const m = buildManifest({ model: "fake-model", maxUsd: 35, slice: "all", dryRun: true, bar });
  const clean = dryRun(m, bar).decisions.dev;
  assert.equal(clean.overall, "pass");
  const rows = m.runs.map((e) => fakeRun(e, bar)).filter((r) => r.task !== "typo-readme" || true);
  const nullCost = rows.map((r) => (r.arm === "framework" && r.task === "yoga-studio" ? { ...r, cost_usd: undefined } : r));
  const d = decide(nullCost, { slice: "dev", bar, overheadRows: syntheticOverhead("fake-model", bar) });
  assert.equal(con(d, "yoga-studio", "cost_ratio").status, "unmeasured");
  assert.match(con(d, "yoga-studio", "cost_ratio").note, /cost_usd missing/);
  assert.equal(con(d, "yoga-studio", "wall_ratio").status, "pass");
  assert.equal(d.overall, "incomplete");
  const nullWall = rows.map((r) => (r.arm === "framework" && r.task === "ai-quest" ? { ...r, wall_ms: null } : r));
  const w = decide(nullWall, { slice: "dev", bar, overheadRows: syntheticOverhead("fake-model", bar) });
  assert.equal(con(w, "ai-quest", "wall_ratio").status, "unmeasured");
  assert.equal(w.overall, "incomplete");
  // a typo-task cost gap blocks the typo constraint too
  const typo = rows.map((r) => (r.arm === "framework" && r.task === "typo-readme" ? { ...r, cost_usd: null } : r));
  assert.equal(con(decide(typo, { slice: "dev", bar, overheadRows: syntheticOverhead("fake-model", bar) }), "typo-readme", "typo_cost").status, "unmeasured");
  // an unfinished run missing cost is not a measurement gap: it is already unfinished
  assert.equal(d.per_task["yoga-studio"].framework.missing_cost_runs, 3);
});

test("catalog overhead must come from the registered empty task", () => {
  assert.throws(() => dev("dev-pass", { overheadRows: fx("overhead-typo-task") }), (e) => e instanceof NorthstarError && /registered empty task "empty", got: typo-readme/.test(e.message));
  assert.throws(() => catalogOverhead(fx("overhead-typo-task"), bar), NorthstarError);
});

test("catalog overhead needs 3 finished runs per arm", () => {
  assert.throws(() => dev("dev-pass", { overheadRows: fx("overhead-two-runs") }), /needs at least 3 finished, costed runs per arm on "empty" \(solo 2, framework 2\)/);
  // unfinished or uncosted overhead runs do not count toward the 3
  const rows = fx("overhead").map((r, i) => (i === 0 ? { ...r, error: "crash" } : i === 3 ? { ...r, cost_usd: null } : r));
  assert.throws(() => catalogOverhead(rows, bar), /solo 2, framework 2/);
});

test("catalog overhead is bound to the decided rows' model and framework sha", () => {
  assert.throws(() => dev("dev-pass", { overheadRows: fx("overhead-other-model") }), /model mismatch/);
  assert.throws(() => dev("dev-pass", { overheadRows: fx("overhead-other-sha") }), /framework_sha mismatch/);
  assert.equal(dev("dev-pass", { overheadRows: fx("overhead") }).overhead.overhead_task, "empty");
  // the CLI refuses with exit 1
  const r = cli("decide", path.join(FIX, "dev-pass.json"), "--slice", "dev", "--overhead", path.join(FIX, "overhead-typo-task.json"));
  assert.equal(r.status, 1); assert.match(r.stderr, /registered empty task/);
});

test("off-model work is re-validated from model_usage with the runner's rule", () => {
  const base = { model: "claude-haiku-4-5" };
  const usage = (other, own = 500) => ({ model_usage: { "claude-haiku-4-5": { outputTokens: own }, "claude-opus-4-8": { outputTokens: other } } });
  assert.equal(offModel({ ...base, ...usage(9000) }), true); // > 1000 and > 5%
  assert.equal(offModel({ ...base, ...usage(900) }), false); // under 1000: background calls tolerated
  assert.equal(offModel({ ...base, ...usage(1001, 100000) }), false); // over 1000 but under 5% of the run
  assert.equal(offModel({ ...base, ...usage(1001, 1000) }), true);
  assert.equal(offModel({ model: "haiku", model_usage: { "claude-haiku-4-5": { outputTokens: 5000 } } }), false); // alias pin
  assert.equal(offModel({ ...base, model_usage: { "claude-haiku-4-5": { output_tokens: 10 }, other: { output_tokens: 3000 } } }), true);
  assert.equal(unfinishedReason({ ...base, ...usage(9000) }), "off-model");
  const d = dev("off-model-silent");
  const fw = d.per_task["yoga-studio"].framework;
  assert.equal(fw.off_model_runs, 1); assert.equal(fw.n_finished, 3); assert.equal(fw.n_runs, 4);
  near(cell(d, "yoga-studio", "E").framework.mean, 0.6); // the silent off-model run scores 0
  assert.equal(fw.cost_total_usd, 4); // and its spend stays
});

test("a row with no model_usage is unfinished evidence (usage missing)", () => {
  const row = { model: "m", cost_usd: 1 };
  assert.equal(unfinishedReason(row), "usage missing");
  assert.equal(unfinishedReason({ ...row, model_usage: {} }), "usage missing");
  assert.equal(isFinished(row), false);
  const rows = yoga({ H: flat(0.9), E: flat(0.2), S: flat(0.2), P: flat(0.2) }, { H: flat(0.9), E: flat(0.8), S: flat(0.8), P: flat(0.8) }, { framework: { model_usage: undefined } });
  const d = decide(rows, { slice: "dev", bar });
  assert.equal(d.per_task["yoga-studio"].framework.usage_missing_runs, 3);
  assert.equal(cell(d, "yoga-studio", "E").numbered, false);
  assert.equal(cell(d, "yoga-studio", "E").framework.mean, 0);
  assert.notEqual(d.overall, "pass");
});

// ---- round 3 ----
const reps3 = (task, arm, o = {}) => [1, 2, 3].map((i) => runRow(task, arm, i, typeof o === "function" ? o(i) : o));
const yogaRows = (soloO = {}, fwO = {}) => [...reps3("yoga-studio", "solo", { components: { E: 0.2, S: 0.2, P: 0.2 }, ...soloO }), ...reps3("yoga-studio", "framework", { components: { E: 0.8, S: 0.8, P: 0.8 }, ...fwO })];

test("one decision compares one model and one framework build", () => {
  const other = { model: "n", model_usage: { n: { outputTokens: 100 } } };
  assert.throws(() => decide(yogaRows({}, other), { slice: "dev", bar }), (e) => e instanceof NorthstarError && /mix models/.test(e.message) && /"m"/.test(e.message) && /"n"/.test(e.message));
  // the mismatch can sit on one row of one task
  const rows = [...yogaRows(), ...reps3("continuity-rules", "solo", { components: { K: 0 } }), ...reps3("continuity-rules", "framework", (i) => ({ components: { K: 1 }, ...(i === 2 ? other : {}) }))];
  assert.throws(() => decide(rows, { slice: "dev", bar }), /mix models/);
  assert.throws(() => decide(yogaRows({}, (/* sha per row */ {}) ).map((r, i) => (r.arm === "framework" && i === 5 ? { ...r, framework_sha: "sha2" } : r)), { slice: "dev", bar }), /mix framework_sha values \["sha1","sha2"\]/);
  assert.doesNotThrow(() => decide(yogaRows(), { slice: "dev", bar }));
  // skipped rows never ran and do not count as a second model
  const withSkipped = [...yogaRows(), { ...runRow("yoga-studio", "framework", 4), skipped: true, model: "zzz", builder_sandbox: null, model_usage: undefined }];
  assert.doesNotThrow(() => decide(withSkipped, { slice: "dev", bar }));
  // the CLI refuses with exit 1
  const f = path.join(os.tmpdir(), `ns-mixed-${process.pid}.json`);
  fs.writeFileSync(f, JSON.stringify({ rows: yogaRows({}, other) }));
  try { const r = cli("decide", f, "--slice", "dev"); assert.equal(r.status, 1); assert.match(r.stderr, /mix models/); } finally { fs.rmSync(f, { force: true }); }
});

test("a missing component score on a finished run is incomplete evidence, never a measured zero", () => {
  const rows = yogaRows({}, { components: { E: 0.8, P: 0.8 } }); // framework S absent on all 3 finished runs
  const d = decide(rows, { slice: "dev", bar });
  const s = cell(d, "yoga-studio", "S");
  assert.equal(s.numbered, false); assert.equal(s.incomplete_evidence, true);
  assert.equal(s.framework.missing_component_runs, 3);
  assert.equal(cell(d, "yoga-studio", "E").numbered, true);
  assert.equal(d.overall, "incomplete");
  // an errored run is still a zero (unfinished), and does not make the cell incomplete evidence
  const crashed = yogaRows({}, {}).map((r) => (r.arm === "framework" && r.rep === 3 ? { ...r, error: "crash", components: undefined } : r));
  const c = cell(decide(crashed, { slice: "dev", bar }), "yoga-studio", "S");
  assert.equal(c.incomplete_evidence, false); assert.equal(c.framework.missing_component_runs, 0);
});

test("missing H evidence is unmeasured, not a 0-vs-0 comparison", () => {
  const noH = { score: undefined, hidden_pass: undefined, hidden_total: undefined, solved: undefined };
  const rows = [...reps3("typo-readme", "solo", noH), ...reps3("typo-readme", "framework", { ...noH, upstream_stages: [] })];
  const d = decide(rows, { slice: "dev", bar });
  assert.equal(con(d, "typo-readme", "h_drop").status, "unmeasured");
  assert.match(con(d, "typo-readme", "h_drop").note, /H evidence missing on 6 finished run/);
  assert.equal(con(d, "typo-readme", "h_miss").status, "unmeasured");
  assert.equal(d.per_task["typo-readme"].solo.h_missing_runs, 3);
  assert.notEqual(d.overall, "pass");
  // hidden_pass/hidden_total alone is enough evidence for H
  const counts = [...reps3("typo-readme", "solo", { score: undefined, solved: undefined }), ...reps3("typo-readme", "framework", { score: undefined, solved: undefined, upstream_stages: [] })];
  assert.equal(con(decide(counts, { slice: "dev", bar }), "typo-readme", "h_drop").status, "pass");
});

test("an unfinished run missing cost or wall time makes the constraint unmeasured; skipped-for-budget is excepted", () => {
  const base = yogaRows();
  const crash = (o) => [...base, runRow("yoga-studio", "framework", 4, { error: "crash", components: undefined, ...o })];
  const noCost = decide(crash({ cost_usd: undefined }), { slice: "dev", bar });
  assert.equal(con(noCost, "yoga-studio", "cost_ratio").status, "unmeasured");
  assert.match(con(noCost, "yoga-studio", "cost_ratio").note, /cost_usd missing/);
  assert.equal(con(noCost, "yoga-studio", "wall_ratio").status, "pass");
  assert.equal(noCost.per_task["yoga-studio"].framework.missing_cost_runs, 1);
  const noWall = decide(crash({ wall_ms: null }), { slice: "dev", bar });
  assert.equal(con(noWall, "yoga-studio", "wall_ratio").status, "unmeasured");
  assert.equal(con(noWall, "yoga-studio", "cost_ratio").status, "pass");
  assert.notEqual(noWall.overall, "pass");
  // a run skipped for budget never ran: no cost or wall is expected of it
  const skipped = [...base, { task: "yoga-studio", arm: "framework", rep: 4, error: "skipped: budget", builder_sandbox: null, model: "m" }];
  const sk = decide(skipped, { slice: "dev", bar });
  assert.equal(con(sk, "yoga-studio", "cost_ratio").status, "pass");
  assert.equal(con(sk, "yoga-studio", "wall_ratio").status, "pass");
});

test("solved is derived from hidden_pass/hidden_total when the flag is absent", () => {
  const solo = reps3("yoga-studio", "solo", { solved: undefined, score: 1, hidden_pass: 10, hidden_total: 10, components: { E: 0.2, S: 0.2, P: 0.2 } });
  const fw = reps3("yoga-studio", "framework", (i) => ({ solved: undefined, score: i === 3 ? 0.97 : 1, hidden_pass: i === 3 ? 9 : 10, hidden_total: 10, components: { E: 0.8, S: 0.8, P: 0.8 } }));
  const d = decide([...solo, ...fw], { slice: "dev", bar });
  assert.equal(d.per_task["yoga-studio"].solo.solved_all, true);
  assert.equal(con(d, "yoga-studio", "h_drop").status, "pass"); // 0.01 under the 0.05 allowance
  const miss = con(d, "yoga-studio", "h_miss");
  assert.equal(miss.status, "fail"); assert.equal(miss.value, 1); // solo passed every hidden test, framework missed one
  // flag absent and no counts: no solved verdict, so the miss rule is unmeasured
  const none = [...reps3("yoga-studio", "solo", { solved: undefined, hidden_pass: undefined, hidden_total: undefined, components: { E: 0.2, S: 0.2, P: 0.2 } }), ...reps3("yoga-studio", "framework", { components: { E: 0.8, S: 0.8, P: 0.8 } })];
  const n = decide(none, { slice: "dev", bar });
  assert.equal(con(n, "yoga-studio", "h_miss").status, "unmeasured");
  assert.equal(con(n, "yoga-studio", "h_drop").status, "pass"); // score is still present
  assert.equal(n.per_task["yoga-studio"].solo.solved_missing_runs, 3);
});

test("catalog overhead rows get the same task/arm/rep uniqueness check", () => {
  const oh = fx("overhead");
  const triple = (r) => [1, 2, 3].map(() => ({ ...r }));
  const dup = [...triple(oh.find((r) => r.arm === "solo")), ...triple(oh.find((r) => r.arm === "framework"))];
  assert.throws(() => catalogOverhead(dup, bar), (e) => e instanceof NorthstarError && /duplicate task\/arm\/rep rows: empty\/solo#1 x3, empty\/framework#1 x3/.test(e.message));
  assert.throws(() => dev("dev-pass", { overheadRows: dup }), /duplicate task\/arm\/rep/);
  assert.equal(catalogOverhead(dup, bar, null, { allowDuplicateReps: true }).n[0], 3); // explicit opt-in counts them separately
  assert.equal(catalogOverhead(oh, bar).n[0], 3);
});
