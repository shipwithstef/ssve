import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  loadBar, loadRows, decide, adopt, buildManifest, assertBalanced, dryRun, main, NorthstarError, catalogOverhead,
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
  assert.deepEqual(bar.reserve, [{ task: "R1", grader_sha256: null }, { task: "R2", grader_sha256: null }]);
  assert.deepEqual(bar.matrix, {
    "yoga-studio": ["E", "S", "P"], "ai-quest": ["E", "P"], "waitlist-feature": ["E", "S", "P"], "bugfix-rootcause": ["E", "P"],
    "security-payments": ["E", "S", "P"], "typo-readme": [], "continuity-rules": ["K"], R1: ["E", "S", "P", "K"], R2: ["E", "S", "P", "K"],
  });
  assert.deepEqual(bar.arms, ["solo", "framework"]);
  assert.equal(bar.reps, 3); assert.equal(bar.parallel, 4); assert.equal(bar.floor_usd, 0.5);
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
test("clear win: zeros and missing components count, headline passes", () => {
  const d = dev("dev-pass");
  assert.equal(d.headline.cells_numbered, 4);
  assert.equal(d.headline.cells_excluded, 10); // the 10 dev cells of tasks with no rows are reported, not numbered
  assert.deepEqual(d.headline.tasks_without_rows, ["ai-quest", "waitlist-feature", "bugfix-rootcause", "security-payments"]);
  // yoga framework S: [0.6, 0.5, missing -> 0]
  const s = cell(d, "yoga-studio", "S");
  near(s.framework.mean, 1.1 / 3); assert.equal(s.framework.missing_component_runs, 1); assert.equal(s.framework.n_runs, 3);
  near(d.headline.R.value, (0.8 + 1.1 / 3 + 0.9 + 1) / (0.2 + 0.1 + 0.3 + 0), 1e-3);
  near(d.headline.delta, (0.6 + (1.1 / 3 - 0.1) + 0.6 + 1) / 4, 1e-3);
  assert.ok(d.headline.ci95[0] > 0);
  assert.equal(d.headline.pass, true);
  assert.equal(d.pass, true);
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
  assert.equal(d.headline.cells_excluded, 13); // 3 thin yoga cells + 10 cells of tasks with no rows
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
  assert.equal(ok.overall, "pass");

  const small = dev("dev-pass", { overheadRows: fx("overhead-small") });
  assert.equal(con(small, "typo-readme", "typo_cost").status, "fail"); // 0.20 - 0.02 = 0.18 > 1.3 * 0.05
  assert.equal(small.overall, "fail");
  assert.deepEqual(catalogOverhead(fx("overhead"), bar).n, [3, 3]);
  assert.equal(catalogOverhead(fx("overhead").filter((r) => r.arm === "solo"), bar), null);
});

test("rules-not-loaded re-run supersedes the first row; first spend is kept", () => {
  const d = dev("rerun");
  const k = cell(d, "continuity-rules", "K");
  assert.equal(k.framework.n_runs, 3); near(k.framework.mean, 1);
  assert.equal(d.per_task["continuity-rules"].framework.cost_total_usd, 2.4);
  assert.equal(d.per_task["continuity-rules"].framework.superseded_runs, 1);
  assert.equal(d.per_task["continuity-rules"].framework.rules_not_loaded, 0);
  assert.equal(d.headline.R.defined, false); // solo K is 0
  assert.equal(d.headline.pass, true);
});

test("slices are judged separately and rows outside the slice are ignored", () => {
  const res = decide(fx("dev-pass"), { slice: "reserve", bar });
  assert.equal(res.headline.cells_numbered, 0);
  assert.equal(res.headline.pass, false);
  assert.equal(res.overall, "fail");
  assert.throws(() => decide([], { slice: "all", bar }), NorthstarError);
});

test("decide is deterministic", () => {
  assert.deepEqual(dev("interrupted"), dev("interrupted"));
});

// ---- adopt ----
test("adopt: n >= 5 per arm, p < .05, ci low > 0, else inconclusive", () => {
  const mk = (arm, vals) => vals.map((v, i) => ({ task: "t", arm, rep: i + 1, score: v, hidden_total: 10, components: { E: v } }));
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
  const m = buildManifest({ model: "haiku", maxUsd: 35, slice: "all", frameworkSha: "dc358c0", bar });
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
  assert.throws(() => assertBalanced(tampered((m) => { m.runs.find((e) => e.arm === "framework").contract.tools += ",Skill"; }), bar), /different task contracts/);
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
  assert.equal(d.decisions.dev.headline.cells_numbered, 14); // 3+2+3+2+3+0+1
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
  assert.equal(j.overall, "pass");
  assert.match(r.stderr, /headline pass: YES/);
  assert.match(r.stderr, /overall: PASS/);
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
