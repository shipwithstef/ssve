#!/usr/bin/env node
/**
 * route-model.mjs — pick the model and effort for a task, escalate on failure,
 * and learn from recorded outcomes. Claude Code host; deterministic, no LLM call.
 *
 *   node scripts/route-model.mjs pick --task-type exec [--risk low|med|high] [--size S|M|L]
 *        [--skill <name>] [--text "<request>"] [--rung N --last-failure <kind>] [--allow-fable] [--json]
 *   node scripts/route-model.mjs record --task-type exec --model sonnet --effort medium --outcome pass|fail
 *        [--rung N] [--failure-kind <kind>] [--signal tests] [--skill <name>] [--tokens N]
 *   node scripts/route-model.mjs stats [--task-type exec] [--json]
 *   node scripts/route-model.mjs check            # data files valid and fresh (exit 1 if not)
 *
 * Policy (references/model-intel/priors.json):
 *   - Each task type has a 3-rung ladder [model, effort]. Rung 0 is the first attempt.
 *   - First pick: the rung with the lowest expected cost per completed task, counting the
 *     cost of failing and escalating (E(i) = cost(i) + (1-p(i)) * (penalty + E(i+1))).
 *     High risk only considers rungs whose success estimate meets the risk target.
 *     Estimates are Beta posteriors: the prior from priors.json, updated by
 *     .svc/model-outcomes.jsonl and ~/.svc/model-outcomes.jsonl as outcomes accumulate.
 *   - On failure: verify_fail -> next rung (effort first, which keeps the prompt cache);
 *     capability/context -> next rung on a different model; refusal/infra -> same rung.
 *   - Past the last rung: stop and hand to a person (or the advisor) instead of looping.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INTEL = path.join(ROOT, "references", "model-intel");

export function loadIntel(dir = INTEL) {
  return {
    models: JSON.parse(fs.readFileSync(path.join(dir, "models.json"), "utf8")),
    priors: JSON.parse(fs.readFileSync(path.join(dir, "priors.json"), "utf8")),
  };
}

const TEXT_RULES = [
  ["security", /\b(vulnerab\w*|exploit\w*|cves?|auth\w*|secrets?|xss|csrf|injection|pentest\w*|rls)\b/i],
  ["debug", /\b(bugs?|broken|fail\w*|errors?|crash\w*|regress\w*|stack ?traces?|flaky)\b|doesn'?t work|not working/i],
  ["review", /\b(review\w*|audit\w*|critique\w*)\b|check (?:this|the) (?:diff|pr|plan)/i],
  ["plan", /\b(plan\w*|design\w*|architect\w*|spec|specs|strateg\w*|approach\w*|trade-?offs?)\b/i],
  ["mechanical", /\b(renam\w*|reformat\w*|format\w*|typos?|bump\w*|sort imports|lint fix\w*|changelog|summari[sz]\w*)\b|move (?:the )?files?/i],
  ["exec", /\b(implement\w*|build|add|wire|refactor\w*|port|integrat\w*|create)\b/i],
  ["explore", /\b(find|locate|search\w*|inventor\w*)\b|where is|list all|which files/i],
  ["writing", /\b(posts?|copy|blog\w*|emails?|tweets?|announce\w*|readme|docs? page)\b/i],
];

export function classify({ taskType, skill, text } = {}, priors) {
  if (taskType) return { taskType, source: "explicit" };
  if (skill && priors.skill_task_types[skill]) return { taskType: priors.skill_task_types[skill], source: `skill:${skill}` };
  if (text) {
    // Security wins whenever it appears; otherwise the earliest matching verb names the task.
    let best = null;
    for (const [type, re] of TEXT_RULES) {
      const m = re.exec(text);
      if (!m) continue;
      if (type === "security") return { taskType: type, source: `text:${m[0]}` };
      if (!best || m.index < best.index) best = { type, index: m.index, word: m[0] };
    }
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

export function tally(outcomes) {
  const t = new Map();
  for (const o of outcomes) {
    if (!o.task_type || !o.model || !o.effort || !["pass", "fail"].includes(o.outcome)) continue;
    if (o.failure_kind === "refusal" || o.failure_kind === "infra") continue; // not a capability signal
    const k = armKey(o.task_type, o.model, o.effort);
    const cur = t.get(k) || { n: 0, pass: 0 };
    cur.n += 1;
    if (o.outcome === "pass") cur.pass += 1;
    t.set(k, cur);
  }
  return t;
}

export function estimate(prior, counts, priors) {
  const s = priors.prior_strength;
  const a = prior * s + (counts?.pass || 0);
  const b = (1 - prior) * s + ((counts?.n || 0) - (counts?.pass || 0));
  return { mean: a / (a + b), n: counts?.n || 0, informed: (counts?.n || 0) >= priors.min_samples };
}

export function relCost(model, effort, models) {
  return +(models.models[model].price_out * models.effort_cost_multiplier[effort]).toFixed(2);
}

// Expected cost of finishing the task when starting at rung i and escalating on failure:
// E(i) = cost(i) + (1 - p(i)) * (failure_penalty + E(i + 1)); E(last) = cost(last).
export function expectedCosts(arms, penalty) {
  const e = new Array(arms.length);
  for (let i = arms.length - 1; i >= 0; i--) {
    e[i] = i === arms.length - 1 ? arms[i].cost : arms[i].cost + (1 - arms[i].mean) * (penalty + e[i + 1]);
  }
  return e.map((x) => +x.toFixed(2));
}

export function pick(opts, intel, outcomes = []) {
  const { models, priors } = intel;
  const { taskType, source } = classify(opts, priors);
  const spec = priors.task_types[taskType];
  if (!spec) throw new Error(`unknown task type "${taskType}" (known: ${Object.keys(priors.task_types).join(", ")})`);
  const risk = ["low", "med", "high"].includes(opts.risk) ? opts.risk : "med";
  const target = priors.target_success[risk];
  const counts = tally(outcomes);
  // Fable rungs drop out unless allowed (it bills usage credits on some plans).
  const ladder = spec.ladder
    .map(([model, effort], i) => ({ model, effort, prior: spec.prior_success[i] }))
    .filter((r) => r.model !== "fable" || opts.allowFable);
  const note = ladder.length < spec.ladder.length ? "fable rung skipped (set SVC_ROUTE_ALLOW_FABLE=1 or --allow-fable to include it)" : null;
  const last = ladder.length - 1;
  const arms = ladder.map((r, i) => ({
    rung: i, model: r.model, effort: r.effort, cost: relCost(r.model, r.effort, models),
    ...estimate(r.prior, counts.get(armKey(taskType, r.model, r.effort)), priors),
  }));
  const expected = expectedCosts(arms, priors.failure_penalty);
  arms.forEach((a, i) => { a.expectedCost = expected[i]; });

  let rung;
  let why;
  if (opts.rung !== undefined && opts.lastFailure) {
    const from = Math.max(0, Math.min(last, Number(opts.rung)));
    const kind = opts.lastFailure;
    if (kind === "refusal" || kind === "infra") { rung = from; why = `${kind}: retry the same rung (native fallback handles it)`; }
    else if (kind === "capability" || kind === "context") {
      rung = from + 1;
      while (rung <= last && ladder[rung].model === ladder[from].model) rung += 1;
      why = `${kind}: move to a different model`;
    } else { rung = from + 1; why = "verify_fail: one rung up (same model first keeps the cache)"; }
    if (rung > last) {
      return { taskType, classifiedBy: source, risk, exhausted: true, arms, note,
        next: "Ladder exhausted. Stop retrying: report the failing check and what was tried, or consult the advisor (/advisor) before another attempt." };
    }
  } else {
    const bump = Math.min(last, (priors.risk_start_bump[risk] || 0) + (opts.size === "L" ? 1 : 0));
    let pool = arms.slice(bump);
    if (risk === "high") {
      const safe = pool.filter((a) => a.mean >= target);
      pool = safe.length ? safe : [pool.reduce((best, a) => (a.mean > best.mean ? a : best))];
    }
    rung = pool.reduce((best, a) => (a.expectedCost < best.expectedCost ? a : best)).rung;
    why = risk === "high"
      ? `high risk: lowest expected cost among rungs with estimated success >= ${target} (or the best estimate)`
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
    onFailure: `node scripts/route-model.mjs pick --task-type ${taskType} --rung ${rung} --last-failure <verify_fail|capability|context|refusal|infra>${opts.allowFable ? " --allow-fable" : ""}`,
    arms,
  };
}

export function outcomeFiles(env = process.env, cwd = process.cwd(), home = os.homedir()) {
  if (env.SVC_MODEL_OUTCOMES) return env.SVC_MODEL_OUTCOMES.split(":").filter(Boolean);
  let top = cwd;
  try { top = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { /* not a repo */ }
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
  return problems;
}

function parseArgs(argv) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) { o._.push(a); continue; }
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    if (["json", "allowFable"].includes(key)) o[key] = true;
    else o[key] = argv[++i];
  }
  return o;
}

function main(argv) {
  const args = parseArgs(argv);
  const cmd = args._[0] || "pick";
  const intel = loadIntel();
  const files = outcomeFiles();
  if (cmd === "check") {
    const problems = checkIntel(intel);
    for (const p of problems) process.stderr.write(`route-model check: ${p}\n`);
    if (!problems.length) process.stdout.write("route-model check: ok\n");
    return problems.length ? 1 : 0;
  }
  if (cmd === "record") {
    const row = {
      ts: new Date().toISOString(), task_type: args.taskType, skill: args.skill || null, model: args.model, effort: args.effort,
      rung: args.rung !== undefined ? Number(args.rung) : null, outcome: args.outcome, failure_kind: args.failureKind || null,
      signal: args.signal || null, tokens: args.tokens !== undefined ? Number(args.tokens) : null,
    };
    if (!intel.priors.task_types[row.task_type] || !intel.models.models[row.model] || !intel.models.efforts.includes(row.effort) || !["pass", "fail"].includes(row.outcome)) {
      process.stderr.write("route-model record: need --task-type <known> --model <haiku|sonnet|opus|fable> --effort <level> --outcome pass|fail\n");
      return 2;
    }
    fs.mkdirSync(path.dirname(files[0]), { recursive: true });
    fs.appendFileSync(files[0], JSON.stringify(row) + "\n");
    process.stdout.write(`recorded to ${files[0]}\n`);
    return 0;
  }
  const outcomes = readOutcomes(files);
  if (cmd === "stats") {
    const rows = [];
    for (const [type, spec] of Object.entries(intel.priors.task_types)) {
      if (args.taskType && args.taskType !== type) continue;
      const counts = tally(outcomes);
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
    result = pick({ ...args, allowFable: args.allowFable || process.env.SVC_ROUTE_ALLOW_FABLE === "1" }, intel, outcomes);
  } catch (e) { process.stderr.write(`route-model: ${e.message}\n`); return 2; }
  if (args.json) { process.stdout.write(JSON.stringify(result, null, 2) + "\n"); return 0; }
  if (result.exhausted) { process.stdout.write(`${result.taskType}: ${result.next}\n`); return 3; }
  process.stdout.write(`${result.taskType} (${result.classifiedBy}) -> model=${result.model} effort=${result.effort} rung=${result.rung} est=${result.estimate}${result.informed ? "" : " (prior)"}\n`);
  process.stdout.write(`why: ${result.why}${result.note ? `; ${result.note}` : ""}${result.advisor ? `; consider /advisor ${result.advisor}` : ""}\n`);
  process.stdout.write(`on failure: ${result.onFailure}\n`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main(process.argv.slice(2)));
