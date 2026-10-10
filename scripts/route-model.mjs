#!/usr/bin/env node
/**
 * route-model.mjs — pick the model and effort for a task, escalate on failure,
 * and learn from recorded outcomes. Claude Code host; deterministic, no LLM call.
 *
 *   node scripts/route-model.mjs pick [--task-type T | --skill S | --text "<request>"] [--risk low|med|high]
 *        [--size S|M|L] [--rung N --last-failure <kind>] [--allow-opt-in] [--json]
 *   node scripts/route-model.mjs record --task-type T --model M --effort E --outcome pass|fail
 *        [--rung N] [--failure-kind <kind>] [--signal tests] [--skill S] [--tokens N]
 *   node scripts/route-model.mjs stats [--task-type T] [--json]
 *   node scripts/route-model.mjs check            # data files valid and fresh (exit 1 if not)
 *
 * Policy (references/model-intel/priors.json):
 *   - Each task type has a ladder of up to 3 [model, effort] rungs; rung 0 is the first try.
 *   - First pick: the rung with the lowest expected cost per completed task, counting the
 *     cost of failing and escalating: E(i) = c(i) + (1-p(i)) * (penalty + E(i+1)), and a
 *     failure past the last rung costs the penalty. High risk starts at rung 1 unless rung 0
 *     has proven itself on recorded outcomes.
 *   - p(i) stays at its prior until the arm has min_samples outcomes on the current model
 *     id, then follows a Beta posterior. A new model behind an alias starts from the prior
 *     again, so cheaper rungs get retried after every model release.
 *   - Classification, ladders and failure kinds are data in priors.json, not code.
 *   - On failure: verify_fail -> next rung (cheaper effort step before a model change);
 *     capability/context -> next rung on a different model, else the next rung;
 *     refusal/infra -> same rung (Claude Code's own fallback handles those).
 *   - Past the last rung: stop and report instead of looping.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { appendJsonlLine } from "./state-io.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTEL = path.join(ROOT, "references", "model-intel");

export function loadIntel(dir = INTEL) {
  return {
    models: JSON.parse(fs.readFileSync(path.join(dir, "models.json"), "utf8")),
    priors: JSON.parse(fs.readFileSync(path.join(dir, "priors.json"), "utf8")),
  };
}


export function classify({ taskType, skill, text } = {}, priors) {
  if (taskType) return { taskType, source: "explicit" };
  if (skill && priors.skill_task_types[skill]) return { taskType: priors.skill_task_types[skill], source: `skill:${skill}` };
  if (text) {
    const tr = priors.text_rules;
    const hits = [];
    for (const [type, src] of tr.rules) { const m = new RegExp(src, "i").exec(text); if (m) hits.push({ type, index: m.index, word: m[0] }); }
    const first = tr.priority.map((t) => hits.find((h) => h.type === t)).find(Boolean);
    if (first) return { taskType: first.type, source: `text:${first.word}` };
    const suppressed = new Set(hits.flatMap((h) => tr.suppress[h.type] || []));
    const best = hits.filter((h) => !suppressed.has(h.type)).sort((x, y) => x.index - y.index)[0];
    if (best) return { taskType: best.type, source: `text:${best.word}` };
  }
  return { taskType: "exec", source: "default" };
}

function armKey(taskType, model, effort) { return `${taskType}|${model}|${effort}`; }

export function readOutcomes(files) {
  const rows = [];
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(f, "utf8"); } catch { continue; }
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line)); } catch { /* skip a torn line */ }
    }
  }
  return rows;
}

// Counts per arm, only for the model id currently behind each alias (legacy rows without model_id count).
export function tally(outcomes, models = null) {
  const t = new Map();
  for (const o of outcomes) {
    if (!o.task_type || !o.model || !o.effort || !["pass", "fail"].includes(o.outcome)) continue;
    if (o.failure_kind === "refusal" || o.failure_kind === "infra") continue; // not a capability signal
    if (models && o.model_id && models.models[o.model] && o.model_id !== models.models[o.model].id) continue;
    const k = armKey(o.task_type, o.model, o.effort);
    const cur = t.get(k) || { n: 0, pass: 0 };
    cur.n += 1;
    if (o.outcome === "pass") cur.pass += 1;
    t.set(k, cur);
  }
  return t;
}

function estimate(prior, counts, priors) {
  const n = counts?.n || 0;
  const informed = n >= priors.min_samples;
  if (!informed) return { mean: prior, n, informed };
  const s = priors.prior_strength;
  const a = prior * s + counts.pass;
  const b = (1 - prior) * s + (n - counts.pass);
  return { mean: a / (a + b), n, informed };
}

function relCost(model, effort, models) {
  return +(models.models[model].price_out * models.effort_cost_multiplier[effort]).toFixed(2);
}

export function expectedCosts(arms, penalty) {
  const e = new Array(arms.length);
  for (let i = arms.length - 1; i >= 0; i--) {
    const next = i === arms.length - 1 ? 0 : e[i + 1];
    e[i] = arms[i].cost + (1 - arms[i].mean) * (penalty + next);
  }
  return e.map((x) => +x.toFixed(2));
}

export function pick(opts, intel, outcomes = []) {
  const { models, priors } = intel;
  const { taskType, source } = classify(opts, priors);
  const spec = priors.task_types[taskType];
  if (!spec) throw new Error(`unknown task type "${taskType}" (known: ${Object.keys(priors.task_types).join(", ")})`);
  const risk = opts.risk ?? "med";
  const failureKinds = Object.keys(priors.failure_kinds);
  if (!["low", "med", "high"].includes(risk)) throw new Error(`--risk must be low, med or high (got "${risk}")`);
  const escalating = opts.rung !== undefined || opts.lastFailure !== undefined;
  if (escalating && (opts.rung === undefined || opts.lastFailure === undefined)) throw new Error("--rung and --last-failure go together");
  if (escalating && !failureKinds.includes(opts.lastFailure)) throw new Error(`--last-failure must be one of ${failureKinds.join(", ")}`);
  const counts = tally(outcomes, models);
  // Models marked opt_in (for example billed to usage credits) drop out unless opted in.
  const ladder = spec.ladder
    .map(([model, effort], i) => ({ model, effort, prior: spec.prior_success[i] }))
    .filter((r) => !models.models[r.model].opt_in || opts.allowOptIn);
  const skipped = [...new Set(spec.ladder.map(([m]) => m).filter((m) => models.models[m].opt_in && !opts.allowOptIn))];
  const note = skipped.length ? `${skipped.join(", ")} rung skipped: ${models.models[skipped[0]].opt_in}` : null;
  const last = ladder.length - 1;
  const arms = ladder.map((r, i) => ({
    rung: i, model: r.model, effort: r.effort, cost: relCost(r.model, r.effort, models),
    ...estimate(r.prior, counts.get(armKey(taskType, r.model, r.effort)), priors),
  }));
  const expected = expectedCosts(arms, priors.failure_penalty);
  arms.forEach((a, i) => { a.expectedCost = expected[i]; });

  let rung;
  let why;
  if (escalating) {
    const from = Number(opts.rung);
    if (!Number.isInteger(from) || from < 0 || from > last) throw new Error(`--rung must be an integer from 0 to ${last}`);
    const kind = opts.lastFailure;
    if (kind === "refusal" || kind === "infra") { rung = from; why = `${kind}: retry the same rung (Claude Code's fallback handles it)`; }
    else if (kind === "capability" || kind === "context") {
      const other = arms.find((a) => a.rung > from && a.model !== arms[from].model);
      rung = other ? other.rung : from + 1;
      why = other ? `${kind}: move to a different model` : `${kind}: no other model on this ladder, next rung`;
    } else { rung = from + 1; why = "verify_fail: one rung up (effort before model)"; }
    if (rung > last) {
      return { taskType, classifiedBy: source, risk, exhausted: true, arms, note,
        next: "Ladder exhausted. Stop retrying: report the failing check and what was tried, or consult the advisor (/advisor) before another attempt." };
    }
  } else {
    const proven = arms[0].informed && arms[0].mean >= priors.high_risk_target;
    const bump = Math.min(last, (risk === "high" && !proven ? 1 : 0) + (opts.size === "L" ? 1 : 0));
    let pool = arms.slice(bump);
    if (risk === "high") {
      const safe = pool.filter((a) => a.mean >= priors.high_risk_target);
      pool = safe.length ? safe : [pool.reduce((best, a) => (a.mean > best.mean ? a : best))];
    }
    rung = pool.reduce((best, a) => (a.expectedCost < best.expectedCost ? a : best)).rung;
    why = risk === "high"
      ? `high risk: lowest expected cost among rungs with estimated success >= ${priors.high_risk_target} (or the best estimate)`
      : `lowest expected cost per completed task, counting escalation (start rung >= ${bump})`;
  }
  const arm = arms[rung];
  // A failed Sonnet attempt gets a stronger advisor before the model switch.
  const advisor = arm.model === "sonnet" && rung > 0 ? "opus" : null;
  return {
    taskType, classifiedBy: source, risk, rung, exhausted: false,
    model: arm.model, modelId: models.models[arm.model].id, effort: arm.effort,
    estimate: +arm.mean.toFixed(3), samples: arm.n, informed: arm.informed, relCost: arm.cost, expectedCost: arm.expectedCost,
    why, note, advisor,
    onFailure: `node scripts/route-model.mjs pick --task-type ${taskType} --rung ${rung} --last-failure <${failureKinds.join("|")}>${opts.allowOptIn ? " --allow-opt-in" : ""}`,
    arms,
  };
}

// Outcomes live in the main checkout (worktrees share it) and in ~/.svc for cross-repo learning.
function outcomeFiles(env = process.env, cwd = process.cwd(), home = os.homedir()) {
  if (env.SVC_MODEL_OUTCOMES) return env.SVC_MODEL_OUTCOMES.split(":").filter(Boolean);
  let top = cwd;
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    top = path.dirname(common);
  } catch { /* not a repo */ }
  return [path.join(top, ".svc", "model-outcomes.jsonl"), path.join(home, ".svc", "model-outcomes.jsonl")];
}

export function checkIntel(intel, now = new Date()) {
  const problems = [];
  const { models, priors } = intel;
  const age = (now - new Date(models.updated)) / 86400000;
  if (!(age <= models.max_age_days)) problems.push(`models.json is ${Math.round(age)} days old (max ${models.max_age_days}); refresh per references/model-intel/SOURCES.md`);
  for (const [type, spec] of Object.entries(priors.task_types)) {
    if (spec.ladder.length !== spec.prior_success.length) problems.push(`${type}: ladder and prior_success lengths differ`);
    if (spec.ladder.length > 3) problems.push(`${type}: more than 3 rungs`);
    let prev = -1;
    spec.ladder.forEach(([m, e], i) => {
      if (!models.models[m]) problems.push(`${type}: unknown model ${m}`);
      if (!models.efforts.includes(e)) problems.push(`${type}: unknown effort ${e}`);
      if (models.models[m]) {
        const c = relCost(m, e, models);
        if (c < prev) problems.push(`${type}: rung ${i} is cheaper than rung ${i - 1}`);
        prev = c;
      }
      const p = spec.prior_success[i];
      if (!(p > 0 && p < 1)) problems.push(`${type}: prior_success[${i}] must be in (0,1)`);
    });
  }
  for (const [skill, type] of Object.entries(priors.skill_task_types)) if (!priors.task_types[type]) problems.push(`skill ${skill}: unknown task type ${type}`);
  for (const [type, src] of priors.text_rules.rules) {
    if (!priors.task_types[type]) problems.push(`text rule for unknown task type ${type}`);
    try { new RegExp(src, "i"); } catch (e) { problems.push(`text rule ${type}: ${e.message}`); }
  }
  return problems;
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (["json", "allowOptIn"].includes(key)) o[key] = true;
    else o[key] = argv[++i];
  }
  return o;
}

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0] || "pick";
  const intel = loadIntel();
  if (cmd === "check") {
    const problems = checkIntel(intel);
    for (const p of problems) process.stderr.write(`route-model check: ${p}\n`);
    if (!problems.length) process.stdout.write("route-model check: ok\n");
    return problems.length ? 1 : 0;
  }
  const files = outcomeFiles();
  if (cmd === "record") {
    const row = {
      ts: new Date().toISOString(), task_type: args.taskType, skill: args.skill || null, model: args.model,
      model_id: intel.models.models[args.model]?.id || null, effort: args.effort,
      rung: args.rung !== undefined ? Number(args.rung) : null, outcome: args.outcome, failure_kind: args.failureKind || null,
      signal: args.signal || null, tokens: args.tokens !== undefined ? Number(args.tokens) : null,
    };
    if (!intel.priors.task_types[row.task_type] || !intel.models.models[row.model] || !intel.models.efforts.includes(row.effort) || !["pass", "fail"].includes(row.outcome)
      || (row.failure_kind && !(row.failure_kind in intel.priors.failure_kinds))) {
      process.stderr.write(`route-model record: need --task-type <known> --model <${Object.keys(intel.models.models).join("|")}> --effort <level> --outcome pass|fail [--failure-kind ${Object.keys(intel.priors.failure_kinds).join("|")}]\n`);
      return 2;
    }
    for (const f of files) {
      try { appendJsonlLine(f, row); }
      catch (e) { process.stderr.write(`route-model record: could not write ${f}: ${e.message}\n`); }
    }
    process.stdout.write(`recorded to ${files.join(" and ")}\n`);
    return 0;
  }
  const outcomes = readOutcomes(files);
  if (cmd === "stats") {
    const rows = [];
    const counts = tally(outcomes, intel.models);
    for (const [type, spec] of Object.entries(intel.priors.task_types)) {
      if (args.taskType && args.taskType !== type) continue;
      spec.ladder.forEach(([m, e], i) => {
        const est = estimate(spec.prior_success[i], counts.get(armKey(type, m, e)), intel.priors);
        rows.push({ task_type: type, rung: i, model: m, effort: e, samples: est.n, estimate: +est.mean.toFixed(3), informed: est.informed });
      });
    }
    if (args.json) process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    else for (const r of rows) process.stdout.write(`${r.task_type.padEnd(11)} rung ${r.rung}  ${r.model.padEnd(6)} ${r.effort.padEnd(6)}  est ${r.estimate.toFixed(2)}  n=${r.samples}${r.informed ? "" : " (prior)"}\n`);
    return 0;
  }
  if (cmd !== "pick") { process.stderr.write(`route-model: unknown command "${cmd}"\n`); return 2; }
  let result;
  try {
    result = pick({ ...args, allowOptIn: args.allowOptIn || process.env.SVC_ROUTE_ALLOW_OPT_IN === "1" }, intel, outcomes);
  } catch (e) { process.stderr.write(`route-model: ${e.message}\n`); return 2; }
  if (args.json) { process.stdout.write(JSON.stringify(result, null, 2) + "\n"); return result.exhausted ? 3 : 0; }
  if (result.exhausted) { process.stdout.write(`${result.taskType}: ${result.next}\n`); return 3; }
  process.stdout.write(`${result.taskType} (${result.classifiedBy}) -> model=${result.model} effort=${result.effort} rung=${result.rung} est=${result.estimate}${result.informed ? "" : " (prior)"}\n`);
  process.stdout.write(`why: ${result.why}${result.note ? `; ${result.note}` : ""}${result.advisor ? `; consider /advisor ${result.advisor}` : ""}\n`);
  process.stdout.write(`on failure: ${result.onFailure}\n`);
  return 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
