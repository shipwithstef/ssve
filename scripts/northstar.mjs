#!/usr/bin/env node
/**
 * northstar.mjs — the pre-registered bar from docs/analysis/2026-10-11-organism-plan.md
 * section 4, implemented exactly.
 *
 *   node scripts/northstar.mjs plan --model <id> --max-usd <n> [--slice dev|reserve|all]
 *                                   [--reps n] [--framework-sha <sha>] [--parallel n] [--dry-run]
 *   node scripts/northstar.mjs decide <results.json...> --slice dev|reserve [--overhead <results.json>]
 *   node scripts/northstar.mjs adopt <results.json...> --candidate <arm> --baseline <arm>
 *                                   --component <H|E|S|P|K> [--task <id>]
 *
 * Results files are what outcome-eval.mjs writes: { rows: [...] }. The pre-registration
 * (tasks, applicability matrix, thresholds, budgets) lives in
 * test-framework/outcome-evals/northstar/bar.json. Nothing here calls a model.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { stratifiedDelta, adoptionDecision, avg, rng } from "./lib/stats.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BAR_PATH = path.join(ROOT, "test-framework/outcome-evals/northstar/bar.json");
const TASKS_DIR = path.join(ROOT, "test-framework/outcome-evals/tasks");
const DEFAULT_TOOLS = "Read,Write,Edit,Glob,Grep,Bash(node:*),Bash(ls:*),Bash(cat:*),Bash(curl:*),Bash(mkdir:*)";
const EPS = 1e-9;
const COMPONENTS = ["H", "E", "S", "P", "K"];

export class NorthstarError extends Error {}

export const loadBar = (file = BAR_PATH) => JSON.parse(fs.readFileSync(file, "utf8"));
export const sliceTasks = (bar, slice) => {
  const dev = bar.dev, reserve = bar.reserve.map((r) => r.task);
  if (slice === "dev") return dev;
  if (slice === "reserve") return reserve;
  if (slice === "all") return [...dev, ...reserve];
  throw new NorthstarError(`unknown slice "${slice}" (dev|reserve|all)`);
};

// ---------- results ----------

export function loadRows(files) {
  const rows = [];
  for (const f of files) {
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    const rs = Array.isArray(j) ? j : j.rows;
    if (!Array.isArray(rs)) throw new NorthstarError(`${f}: no rows array`);
    rows.push(...rs);
  }
  return rows;
}

const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
// A finished run ended on its own: no error, not stopped by a limit, not skipped.
export const isFinished = (r) => !r.error && !r.stopped_by && !r.skipped;

// Run score for one component. Unfinished runs score 0 on every component; so does a
// finished run whose grader left the component out (counted and reported as missing).
export function runScore(r, comp) {
  if (!isFinished(r)) return { value: 0, missing: false };
  if (comp === "H") {
    const s = num(r.score) ?? (num(r.hidden_total) ? (num(r.hidden_pass) ?? 0) / r.hidden_total : null);
    return s == null ? { value: 0, missing: true } : { value: s, missing: false };
  }
  const v = num(r.components?.[comp]);
  return v == null ? { value: 0, missing: true } : { value: v, missing: false };
}

// A re-run of the same task/arm/rep (the rules-not-loaded re-run) supersedes the earlier
// row for scoring; the earlier row's spend and wall time stay on the kept row.
export function dedupe(rows) {
  const by = new Map();
  for (const r of rows) {
    const key = `${r.task}|${r.arm}|${r.rep}`;
    const prev = by.get(key);
    if (!prev) { by.set(key, { ...r, superseded: 0 }); continue; }
    by.set(key, { ...r, superseded: prev.superseded + 1, cost_usd: (num(prev.cost_usd) ?? 0) + (num(r.cost_usd) ?? 0), wall_ms: (num(prev.wall_ms) ?? 0) + (num(r.wall_ms) ?? 0) });
  }
  return [...by.values()];
}

function tokensOf(usage) {
  let t = 0;
  for (const m of Object.values(usage || {})) {
    if (!m || typeof m !== "object") continue;
    for (const [k, v] of Object.entries(m)) if (/token/i.test(k) && /input|output|cache/i.test(k) && num(v) != null) t += v;
  }
  return t;
}

const r4 = (x) => (x == null ? null : +x.toFixed(4));
const mean = (xs) => (xs.length ? avg(xs) : null);

function armSummary(rows) {
  const fin = rows.filter(isFinished);
  return {
    n_runs: rows.length,
    n_finished: fin.length,
    errored: rows.filter((r) => r.error).length,
    stopped: rows.filter((r) => r.stopped_by).length,
    cost_total_usd: r4(rows.reduce((a, r) => a + (num(r.cost_usd) ?? 0), 0)),
    cost_mean_usd: r4(mean(rows.map((r) => num(r.cost_usd) ?? 0))),
    wall_mean_ms: rows.length ? Math.round(mean(rows.map((r) => num(r.wall_ms) ?? 0))) : null,
    turns_mean: r4(mean(rows.map((r) => num(r.turns) ?? 0))),
    tokens_mean: rows.length ? Math.round(mean(rows.map((r) => tokensOf(r.model_usage)))) : null,
    h_mean: r4(mean(rows.map((r) => runScore(r, "H").value))),
    solved_all: rows.length > 0 && rows.every((r) => isFinished(r) && r.solved === true),
    rules_not_loaded: rows.filter((r) => r.rules_not_loaded).length,
    fail_open: rows.reduce((a, r) => a + (num(r.fail_open) ?? 0), 0),
    superseded_runs: rows.reduce((a, r) => a + (r.superseded || 0), 0),
  };
}

// ---------- decide ----------

export function decide(rawRows, { slice, bar = loadBar(), overheadRows = null, iterations = 10000 } = {}) {
  if (slice !== "dev" && slice !== "reserve") throw new NorthstarError("decide needs --slice dev|reserve (each slice is judged separately)");
  const tasks = sliceTasks(bar, slice);
  const minFin = bar.min_finished_runs_per_cell_arm;
  const [soloArm, fwArm] = bar.arms;
  const rows = dedupe(rawRows.filter((r) => tasks.includes(r.task) && bar.arms.includes(r.arm)));
  const of = (task, arm) => rows.filter((r) => r.task === task && r.arm === arm);

  // cells
  const cells = [];
  for (const task of tasks) for (const comp of bar.matrix[task] || []) {
    const s = of(task, soloArm), f = of(task, fwArm);
    const sv = s.map((r) => runScore(r, comp)), fv = f.map((r) => runScore(r, comp));
    const cell = {
      task, component: comp,
      solo: { n_runs: s.length, n_finished: s.filter(isFinished).length, mean: r4(mean(sv.map((x) => x.value))), missing_component_runs: sv.filter((x) => x.missing).length },
      framework: { n_runs: f.length, n_finished: f.filter(isFinished).length, mean: r4(mean(fv.map((x) => x.value))), missing_component_runs: fv.filter((x) => x.missing).length },
    };
    const thin = [["solo", cell.solo], ["framework", cell.framework]].filter(([, a]) => a.n_finished < minFin);
    cell.numbered = thin.length === 0;
    if (!cell.numbered) {
      cell.excluded_reason = thin.map(([n, a]) => `${n}: ${a.n_finished} finished run(s) < ${minFin}`).join("; ");
    } else {
      cell.delta = r4(mean(fv.map((x) => x.value)) - mean(sv.map((x) => x.value)));
      cell.both_zero = mean(sv.map((x) => x.value)) === 0 && mean(fv.map((x) => x.value)) === 0;
      cell._values = { solo: sv.map((x) => x.value), framework: fv.map((x) => x.value) };
    }
    cells.push(cell);
  }
  const numbered = cells.filter((c) => c.numbered);

  // headline
  const headline = { tasks_without_rows: tasks.filter((t) => !rows.some((r) => r.task === t)), cells_numbered: numbered.length, cells_excluded: cells.length - numbered.length, delta: null, ci95: null, R: null, checks: {}, pass: false };
  if (numbered.length) {
    const sd = stratifiedDelta(numbered.map((c) => c._values), iterations);
    headline.delta = sd.delta; headline.ci95 = sd.ci95;
    const sumF = numbered.reduce((a, c) => a + avg(c._values.framework), 0);
    const sumS = numbered.reduce((a, c) => a + avg(c._values.solo), 0);
    headline.R = sumS === 0 ? { defined: false, value: null, reason: "not defined: solo 0 everywhere" } : { defined: true, value: r4(sumF / sumS) };
    headline.checks = {
      R: headline.R.defined ? headline.R.value >= bar.pass.R_min - EPS : true,
      delta: sd.delta >= bar.pass.delta_min - EPS,
      ci_low: sd.ci95[0] > bar.pass.delta_ci_low_gt + EPS,
    };
    headline.pass = headline.checks.R && headline.checks.delta && headline.checks.ci_low;
  } else {
    headline.reason = "no cell has a number";
  }
  for (const c of cells) delete c._values;

  // per-task summaries and constraints
  const per_task = {};
  for (const task of tasks) {
    const s = of(task, soloArm), f = of(task, fwArm);
    if (!s.length && !f.length) continue;
    per_task[task] = { solo: armSummary(s), framework: armSummary(f) };
  }
  const constraints = [];
  const K = bar.constraints;
  const push = (task, id, status, extra) => constraints.push({ task, id, status, ...extra });
  const measurable = (t) => per_task[t] && per_task[t].solo.n_finished >= minFin && per_task[t].framework.n_finished >= minFin;
  for (const task of Object.keys(per_task)) {
    const t = per_task[task];
    if (!measurable(task)) {
      const why = `fewer than ${minFin} finished runs in an arm (solo ${t.solo.n_finished}, framework ${t.framework.n_finished})`;
      push(task, "h_drop", "unmeasured", { note: why });
      push(task, "h_miss", "unmeasured", { note: why });
      if (K.product_tasks.includes(task)) { push(task, "cost_ratio", "unmeasured", { note: why }); push(task, "wall_ratio", "unmeasured", { note: why }); }
      continue;
    }
    const drop = t.solo.h_mean - t.framework.h_mean;
    push(task, "h_drop", drop <= K.h_max_drop + EPS ? "pass" : "fail", { value: r4(drop), limit: K.h_max_drop });
    const missed = t.solo.solved_all ? f_unsolved(of(task, fwArm)) : 0;
    push(task, "h_miss", missed === 0 ? "pass" : "fail", { value: missed, note: t.solo.solved_all ? "solo solved every run" : "solo did not solve every run: not applicable" });
    if (K.product_tasks.includes(task)) {
      const cr = t.solo.cost_mean_usd ? t.framework.cost_mean_usd / t.solo.cost_mean_usd : null;
      push(task, "cost_ratio", t.framework.cost_mean_usd <= K.product_cost_ratio_max * t.solo.cost_mean_usd + EPS ? "pass" : "fail", { value: r4(cr), limit: K.product_cost_ratio_max, solo_usd: t.solo.cost_mean_usd, framework_usd: t.framework.cost_mean_usd });
      const wr = t.solo.wall_mean_ms ? t.framework.wall_mean_ms / t.solo.wall_mean_ms : null;
      push(task, "wall_ratio", t.framework.wall_mean_ms <= K.product_wall_ratio_max * t.solo.wall_mean_ms + EPS ? "pass" : "fail", { value: r4(wr), limit: K.product_wall_ratio_max, solo_ms: t.solo.wall_mean_ms, framework_ms: t.framework.wall_mean_ms });
    }
  }
  if (tasks.includes(K.typo_task) && per_task[K.typo_task]) {
    const t = per_task[K.typo_task];
    const ov = overheadRows ? catalogOverhead(overheadRows, bar) : null;
    if (!ov) push(K.typo_task, "typo_cost", "unmeasured", { note: "no catalog overhead measured (--overhead <results.json> with both arms)" });
    else if (!measurable(K.typo_task)) push(K.typo_task, "typo_cost", "unmeasured", { note: `fewer than ${minFin} finished runs in an arm` });
    else {
      const net = t.framework.cost_mean_usd - ov.overhead_usd;
      push(K.typo_task, "typo_cost", net <= K.typo_cost_ratio_max_net_overhead * t.solo.cost_mean_usd + EPS ? "pass" : "fail",
        { value: r4(t.solo.cost_mean_usd ? net / t.solo.cost_mean_usd : null), limit: K.typo_cost_ratio_max_net_overhead, framework_usd: t.framework.cost_mean_usd, overhead_usd: ov.overhead_usd, net_usd: r4(net), solo_usd: t.solo.cost_mean_usd });
    }
  }

  const failed = constraints.filter((c) => c.status === "fail");
  const unmeasured = constraints.filter((c) => c.status === "unmeasured");
  const overall = !headline.pass || failed.length ? "fail" : unmeasured.length ? "incomplete" : "pass";

  const arms = {};
  for (const arm of bar.arms) arms[arm] = armSummary(rows.filter((r) => r.arm === arm));
  return {
    slice, tasks, rows_used: rows.length,
    headline, pass: headline.pass,
    constraints, constraints_failed: failed.length, constraints_unmeasured: unmeasured.length,
    overall,
    cells, per_task, cost_per_arm: arms,
    diagnostics: Object.fromEntries(bar.arms.map((a) => [a, { turns_mean: arms[a].turns_mean, tokens_mean: arms[a].tokens_mean, rules_not_loaded: arms[a].rules_not_loaded, fail_open: arms[a].fail_open, superseded_runs: arms[a].superseded_runs }])),
    overhead: overheadRows ? catalogOverhead(overheadRows, bar) : null,
  };
}

const f_unsolved = (fwRows) => fwRows.filter((r) => !(isFinished(r) && r.solved === true)).length;

// Measured fixed catalog overhead: mean cost of framework runs minus solo's, on an empty task.
export function catalogOverhead(overheadRows, bar = loadBar()) {
  const [soloArm, fwArm] = bar.arms;
  const s = overheadRows.filter((r) => r.arm === soloArm), f = overheadRows.filter((r) => r.arm === fwArm);
  if (!s.length || !f.length) return null;
  const raw = mean(f.map((r) => num(r.cost_usd) ?? 0)) - mean(s.map((r) => num(r.cost_usd) ?? 0));
  return { overhead_usd: r4(Math.max(0, raw)), raw_usd: r4(raw), n: [s.length, f.length] };
}

export function summarizeDecision(d) {
  const L = [];
  const h = d.headline;
  L.push(`northstar decide: ${d.slice} slice, ${d.rows_used} runs`);
  L.push(`cells: ${h.cells_numbered} numbered, ${h.cells_excluded} without a number${h.tasks_without_rows.length ? `; no rows for: ${h.tasks_without_rows.join(", ")}` : ""}`);
  if (h.delta == null) L.push(`headline: ${h.reason}`);
  else {
    L.push(`delta ${h.delta} (95% CI ${h.ci95[0]} to ${h.ci95[1]})   R ${h.R.defined ? h.R.value : h.R.reason}`);
    L.push(`headline pass: ${h.pass ? "YES" : "NO"}   (R ${h.checks.R ? "ok" : "fail"}, delta ${h.checks.delta ? "ok" : "fail"}, ci low ${h.checks.ci_low ? "ok" : "fail"})`);
  }
  for (const c of d.cells) L.push(`  ${c.task}/${c.component}: ` + (c.numbered ? `solo ${c.solo.mean} (n ${c.solo.n_runs}/${c.solo.n_finished} fin) framework ${c.framework.mean} (n ${c.framework.n_runs}/${c.framework.n_finished} fin) delta ${c.delta}${c.both_zero ? " [both zero]" : ""}` : `no number: ${c.excluded_reason}`));
  for (const c of d.constraints) L.push(`  constraint ${c.task}/${c.id}: ${c.status}${c.value != null ? ` (${c.value}${c.limit != null ? ` vs ${c.limit}` : ""})` : ""}${c.status === "unmeasured" ? ` - ${c.note}` : ""}`);
  for (const [a, s] of Object.entries(d.cost_per_arm)) L.push(`  cost ${a}: $${s.cost_total_usd} total, $${s.cost_mean_usd}/run over ${s.n_runs} runs`);
  L.push(`overall: ${d.overall.toUpperCase()}${d.overall === "incomplete" ? " (headline passes; some constraints are unmeasured)" : ""}`);
  return L.join("\n");
}

// ---------- adopt ----------

export function adopt(rawRows, { candidate, baseline, component, task = null, iterations = 10000 }) {
  if (!COMPONENTS.includes(component)) throw new NorthstarError(`component must be one of ${COMPONENTS.join("|")}`);
  const rows = dedupe(rawRows).filter((r) => !task || r.task === task);
  const sample = (arm) => rows.filter((r) => r.arm === arm).map((r) => runScore(r, component).value);
  const res = adoptionDecision(sample(candidate), sample(baseline), iterations);
  return { candidate, baseline, component, task, ...res, needs_holdout_confirmation: res.decision === "adopt" };
}

// ---------- plan ----------

function taskConfig(tasksDir, task) {
  const f = path.join(tasksDir, task, "task.json");
  const c = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  return { max_turns: c.max_turns ?? 40, timeout_min: c.timeout_min ?? 15, tools: c.tools ?? DEFAULT_TOOLS };
}

// Hash of what the agent sees: every file under the task dir except the hidden grader,
// the reference solution and the judge rubric.
export function taskFilesSha(tasksDir, task) {
  const dir = path.join(tasksDir, task);
  if (!fs.existsSync(dir)) return null;
  const hidden = new Set(["hidden.test.mjs", "ref.mjs", "ref", "judge.md"]);
  const h = crypto.createHash("sha256");
  const walk = (d, rel) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!rel && hidden.has(e.name)) continue;
      const p = path.join(d, e.name), r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) { h.update(r + "\0"); h.update(fs.readFileSync(p)); h.update("\0"); }
    }
  };
  walk(dir, "");
  return h.digest("hex");
}

export function buildManifest({ model, maxUsd, slice = "all", reps, frameworkSha = null, parallel, bar = loadBar(), tasksDir = TASKS_DIR, dryRun = false } = {}) {
  if (!model) throw new NorthstarError("plan needs --model <id>");
  if (!(maxUsd > 0)) throw new NorthstarError("plan needs --max-usd <n> (every paid run uses --max-usd)");
  const tasks = sliceTasks(bar, slice);
  const nReps = reps ?? bar.reps;
  const par = parallel ?? bar.parallel;
  if (!dryRun && !frameworkSha) throw new NorthstarError("plan needs --framework-sha <sha>: the framework arm runs from git archive of one pinned sha");
  const warnings = [];
  const shas = {};
  const entries = [];
  for (const task of tasks) {
    shas[task] = taskFilesSha(tasksDir, task);
    if (shas[task] == null) warnings.push(`task directory missing for ${task}: contract hash recorded as null`);
  }
  const runs = tasks.length * bar.arms.length * nReps;
  const share = maxUsd / runs;
  if (share < bar.floor_usd) {
    throw new NorthstarError(`a manifest that cannot fund every pair does not start: ${runs} runs at $${maxUsd} is $${share.toFixed(3)} per run, below the $${bar.floor_usd} floor (needs at least $${(runs * bar.floor_usd).toFixed(2)})`);
  }
  for (const task of tasks) {
    const cfg = taskConfig(tasksDir, task);
    for (let rep = 1; rep <= nReps; rep++) for (const arm of bar.arms) {
      entries.push({
        id: `${task}/${arm}#${rep}`, task, arm, rep, model,
        budget_usd: +share.toFixed(4),
        contract: {
          task_files_sha256: shas[task],
          tools: cfg.tools,
          timeout_ms: cfg.timeout_min * 60000 * bar.arm_limits.time,
          max_turns: cfg.max_turns * bar.arm_limits.turns,
          limits: { time_x: bar.arm_limits.time, turns_x: bar.arm_limits.turns },
        },
        isolation: {
          builder_sandbox: true,
          private_home: true,
          home: arm === "framework" ? "git-archive" : "bare-no-skills",
          framework_sha: arm === "framework" ? frameworkSha : null,
        },
      });
    }
  }
  const manifest = {
    schema: "northstar-manifest", version: 1, model, slice, reps: nReps, parallel: par, floor_usd: bar.floor_usd,
    cap_usd: maxUsd, per_run_usd: +share.toFixed(4), framework_sha: frameworkSha, dry_run: dryRun,
    forecast: {
      runs, per_arm: Object.fromEntries(bar.arms.map((a) => [a, tasks.length * nReps])),
      max_spend_usd: maxUsd, per_run_usd: +share.toFixed(4),
      wall: `forecast after the first wave of ${par} runs; not estimated before it`,
    },
    warnings, runs: entries,
  };
  assertBalanced(manifest);
  return manifest;
}

// Both arms must have the same task contract and the same isolation, per task and rep.
export function assertBalanced(manifest, bar = loadBar()) {
  const by = new Map();
  for (const e of manifest.runs) {
    const k = `${e.task}#${e.rep}`;
    if (!by.has(k)) by.set(k, {});
    by.get(k)[e.arm] = e;
  }
  for (const [k, pair] of by) {
    for (const arm of bar.arms) if (!pair[arm]) throw new NorthstarError(`unbalanced manifest: ${k} has no ${arm} run`);
    const [a, b] = bar.arms.map((x) => pair[x]);
    if (JSON.stringify(a.contract) !== JSON.stringify(b.contract)) throw new NorthstarError(`unbalanced manifest: ${k} arms have different task contracts (files, tools or timeouts)`);
    for (const arm of bar.arms) {
      const iso = pair[arm].isolation;
      if (iso?.builder_sandbox !== true) throw new NorthstarError(`unbalanced manifest: ${k}/${arm} is not sandboxed`);
      if (iso?.private_home !== true) throw new NorthstarError(`unbalanced manifest: ${k}/${arm} has no private home`);
    }
    if (a.budget_usd !== b.budget_usd) throw new NorthstarError(`unbalanced manifest: ${k} arms have different budgets`);
    if (a.model !== b.model) throw new NorthstarError(`unbalanced manifest: ${k} arms use different models`);
  }
  const share = manifest.runs[0]?.budget_usd ?? 0;
  if (share < manifest.floor_usd) throw new NorthstarError(`per-run funding $${share} is below the $${manifest.floor_usd} floor`);
  return true;
}

// Fake runner for the $0 dry run: deterministic synthetic rows shaped like outcome-eval rows.
export function fakeRun(entry, bar = loadBar()) {
  let h = 0;
  for (const ch of entry.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = rng(h);
  const fw = entry.arm === "framework";
  const level = fw ? 0.75 : 0.25;
  const jitter = () => Math.min(1, Math.max(0, level + (rand() - 0.5) * 0.3));
  const components = {};
  for (const c of bar.matrix[entry.task] || []) components[c] = +jitter().toFixed(2);
  const score = +Math.min(1, 0.85 + rand() * 0.15).toFixed(2);
  const cost = +((fw ? 1.25 : 1) * (0.4 + rand() * 0.1)).toFixed(4);
  return {
    task: entry.task, arm: entry.arm, rep: entry.rep, model: entry.model, synthetic: true,
    cost_usd: cost, wall_ms: Math.round((fw ? 1.15 : 1) * 60000 * (1 + rand() * 0.1)), turns: fw ? 30 : 12,
    hidden_pass: Math.round(score * 10), hidden_total: 10, score, solved: score === 1,
    ...(Object.keys(components).length ? { components } : {}),
    model_usage: { [entry.model]: { inputTokens: fw ? 90000 : 30000, outputTokens: fw ? 12000 : 5000 } },
    fail_open: 0, rules_not_loaded: false, stopped_by: null, budget_usd: entry.budget_usd,
  };
}

export function dryRun(manifest, bar = loadBar()) {
  const rows = manifest.runs.map((e) => fakeRun(e, bar));
  const decisions = {};
  for (const slice of ["dev", "reserve"]) {
    const inSlice = rows.filter((r) => sliceTasks(bar, slice).includes(r.task));
    if (inSlice.length) decisions[slice] = decide(inSlice, { slice, bar, overheadRows: null });
  }
  return { rows: rows.length, decisions };
}

// ---------- CLI ----------

export function parseArgs(argv) {
  const out = { _: [] };
  const bool = new Set(["dry-run", "json"]);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const k = a.slice(2);
      if (bool.has(k)) out[k] = true;
      else { if (i + 1 >= argv.length) throw new NorthstarError(`--${k} needs a value`); out[k] = argv[++i]; }
    } else out._.push(a);
  }
  return out;
}

export function main(argv, io = { out: (s) => process.stdout.write(s + "\n"), err: (s) => process.stderr.write(s + "\n") }) {
  try {
    const [cmd, ...rest] = argv;
    const args = parseArgs(rest);
    const bar = loadBar();
    if (cmd === "plan") {
      const manifest = buildManifest({
        model: args.model ?? (args["dry-run"] ? "fake-model" : undefined),
        maxUsd: args["max-usd"] != null ? Number(args["max-usd"]) : args["dry-run"] ? 35 : undefined,
        slice: args.slice ?? "all", reps: args.reps != null ? Number(args.reps) : undefined,
        frameworkSha: args["framework-sha"] ?? null, parallel: args.parallel != null ? Number(args.parallel) : undefined,
        dryRun: Boolean(args["dry-run"]), bar,
      });
      if (args["dry-run"]) {
        const d = dryRun(manifest, bar);
        io.out(JSON.stringify({ manifest: { ...manifest, runs: undefined, run_count: manifest.runs.length }, dry_run: d }, null, 2));
        for (const [s, dec] of Object.entries(d.decisions)) io.err(summarizeDecision(dec) + `\n(${s}: synthetic rows through decide)`);
      } else {
        io.out(JSON.stringify(manifest, null, 2));
        io.err(`northstar plan: ${manifest.forecast.runs} runs, $${manifest.per_run_usd}/run, forecast spend up to $${manifest.cap_usd}; wall time is forecast after the first wave`);
        for (const w of manifest.warnings) io.err(`warning: ${w}`);
      }
      return 0;
    }
    if (cmd === "decide") {
      if (!args._.length) throw new NorthstarError("decide needs at least one results file");
      const d = decide(loadRows(args._), { slice: args.slice, bar, overheadRows: args.overhead ? loadRows([args.overhead]) : null });
      io.out(JSON.stringify(d, null, 2));
      io.err(summarizeDecision(d));
      return 0;
    }
    if (cmd === "adopt") {
      if (!args._.length) throw new NorthstarError("adopt needs at least one results file");
      if (!args.candidate || !args.baseline || !args.component) throw new NorthstarError("adopt needs --candidate, --baseline and --component");
      const a = adopt(loadRows(args._), { candidate: args.candidate, baseline: args.baseline, component: args.component, task: args.task ?? null });
      io.out(JSON.stringify(a, null, 2));
      io.err(`adoption: ${a.decision} (${a.reason})`);
      return 0;
    }
    throw new NorthstarError("usage: northstar.mjs plan|decide|adopt ... (see the header of scripts/northstar.mjs)");
  } catch (e) {
    if (e instanceof NorthstarError) { io.err(`northstar: ${e.message}`); return 1; }
    throw e;
  }
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
