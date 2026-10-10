#!/usr/bin/env node
/**
 * decision-ledger — the learning loop for computed decisions.
 *
 * A decision engine is only as good as the ranges people feed it, and people
 * are systematically overconfident (their 80% intervals catch the truth far
 * less than 80% of the time). The ledger closes that loop with data instead of
 * advice:
 *
 *   record   store what the engine predicted (winner, its p10/p50/p90, every
 *            variable's declared range) next to the model it came from
 *   observe  add what actually happened: the outcome metric and/or the real
 *            values of variables, as they become known
 *   review   re-run the stored model with observed values pinned: was the
 *            choice still right with what we know now? (hindsight regret)
 *   calibration
 *            how often reality landed inside the declared 80% ranges, per
 *            variable and for outcomes, and which direction estimates miss —
 *            the evidence to widen or shift the next model's ranges
 *
 * Usage:
 *   node scripts/decision-ledger.mjs record  --model M.json [--result R.json] [--id ID] [--profile P]
 *   node scripts/decision-ledger.mjs observe --id ID [--metric N] [--var name=value ...] [--note TEXT]
 *   node scripts/decision-ledger.mjs review  --id ID [--json]
 *   node scripts/decision-ledger.mjs calibration [--json]
 *   all commands accept --ledger FILE (default .svc/decision-ledger.jsonl)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { evaluate, rangeOf } from "./decision-engine.mjs";
import { appendJsonlLine } from "./state-io.mjs";

const DEFAULT_LEDGER = ".svc/decision-ledger.jsonl";
const usage = (msg) => Object.assign(new Error(msg), { code: 2 });

export function readLedger(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l, i) => {
    try { return JSON.parse(l); } catch { throw new Error(`${file}:${i + 1}: not valid JSON`); }
  });
}

const digest = (obj) => crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex").slice(0, 16);

export function predictionRow(model, result, { id, modelPath, profile } = {}) {
  const vars = { ...model.variables, ...((profile && model.profiles?.[profile]?.variables) || {}) };
  const w = result.options.find((o) => o.id === result.winner?.id);
  return {
    type: "prediction", id: id || `${new Date().toISOString().slice(0, 10)}-${digest(model).slice(0, 8)}`, ts: new Date().toISOString(),
    question: model.question, model_path: modelPath || null, model_digest: digest(model), profile: profile || null,
    metric: result.objective.metric, unit: result.objective.unit, direction: result.objective.direction,
    verdict: result.verdict, winner: result.winner?.id ?? null,
    predicted: w ? { mean: w.mean, p10: w.p10, p50: w.p50, p90: w.p90 } : null,
    next_question: result.next_question?.variable ?? null,
    variables: Object.fromEntries(Object.entries(vars).filter(([, d]) => d.dist !== "const").map(([k, d]) => [k, rangeOf(d)])),
    revisit: (result.value_of_information || []).filter((v) => v.break_even).map((v) => ({ variable: v.variable, ...v.break_even })),
  };
}

function observationsFor(rows, id) { return rows.filter((r) => r.type === "observation" && r.id === id); }
function latestVars(obs) { const v = {}; for (const o of obs) Object.assign(v, o.variables || {}); return v; }

/** Re-run the stored model with every observed variable pinned to its observed value. */
export function review(rows, id, { root = process.cwd() } = {}) {
  const pred = rows.find((r) => r.type === "prediction" && r.id === id);
  if (!pred) throw usage(`no prediction with id '${id}'`);
  const obs = observationsFor(rows, id); const known = latestVars(obs);
  const metric = [...obs].reverse().find((o) => typeof o.metric === "number")?.metric ?? null;
  const out = { id, question: pred.question, chose: pred.winner, observed_metric: metric, observed_variables: known,
    metric_in_predicted_range: metric === null || !pred.predicted ? null : metric >= pred.predicted.p10 && metric <= pred.predicted.p90,
    triggers_fired: (pred.revisit || []).filter((t) => known[t.variable] !== undefined &&
      ((t.below === pred.winner && known[t.variable] > t.at) || (t.above === pred.winner && known[t.variable] < t.at))).map((t) => t.variable) };
  if (pred.model_path && Object.keys(known).length) {
    const file = path.resolve(root, pred.model_path);
    if (fs.existsSync(file)) {
      const model = JSON.parse(fs.readFileSync(file, "utf8"));
      if (digest(model) !== pred.model_digest) out.model_changed_since_record = true;
      const pinned = { ...model, variables: { ...model.variables } };
      for (const [k, v] of Object.entries(known)) if (pinned.variables[k]) pinned.variables[k] = { ...pinned.variables[k], dist: "const", value: v };
      const r = evaluate(pinned, { profile: pred.profile || undefined });
      out.hindsight = { winner: r.winner?.id ?? null, verdict: r.verdict, still_right: r.winner?.id === pred.winner, next_question: r.next_question?.variable ?? null };
    }
  }
  return out;
}

/** Interval calibration: target is 0.8 (p10..p90). Ratio = observed / declared median, log-averaged. */
export function calibration(rows) {
  const preds = rows.filter((r) => r.type === "prediction");
  const perVar = {}; let outHit = 0, outN = 0;
  for (const p of preds) {
    const obs = observationsFor(rows, p.id); const known = latestVars(obs);
    const metric = [...obs].reverse().find((o) => typeof o.metric === "number")?.metric;
    if (metric !== undefined && p.predicted) { outN++; if (metric >= p.predicted.p10 && metric <= p.predicted.p90) outHit++; }
    for (const [k, v] of Object.entries(known)) {
      const r = p.variables?.[k]; if (!r) continue;
      const e = (perVar[k] ||= { n: 0, hits: 0, logRatio: 0, above: 0, below: 0 });
      e.n++; if (v >= r.p10 && v <= r.p90) e.hits++; else if (v > r.p90) e.above++; else e.below++;
      if (v > 0 && r.p50 > 0) e.logRatio += Math.log(v / r.p50);
    }
  }
  const variables = Object.entries(perVar).map(([k, e]) => ({ variable: k, observations: e.n, hit_rate: e.hits / e.n,
    observed_over_estimate: Number(Math.exp(e.logRatio / e.n).toPrecision(3)), misses_above: e.above, misses_below: e.below,
    advice: e.n < 3 ? "too few observations" : e.hits / e.n < 0.6 ? (e.above > e.below ? "ranges too low and too narrow: shift up and widen" : e.below > e.above ? "ranges too high and too narrow: shift down and widen" : "ranges too narrow: widen") : e.hits / e.n > 0.95 && e.n >= 10 ? "ranges may be wider than needed" : "calibrated" }))
    .sort((a, b) => a.hit_rate - b.hit_rate || b.observations - a.observations);
  return { predictions: preds.length, outcomes_observed: outN, outcome_hit_rate: outN ? outHit / outN : null, target_hit_rate: 0.8, variables };
}

function parse(argv) {
  const [cmd, ...rest] = argv; const o = { cmd, vars: {}, ledger: DEFAULT_LEDGER };
  if (!["record", "observe", "review", "calibration"].includes(cmd)) throw usage("usage: decision-ledger.mjs record|observe|review|calibration [options] (see --help in the file header)");
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") { o.json = true; continue; }
    const v = rest[++i]; if (v === undefined) throw usage(`${a} requires a value`);
    if (a === "--var") { const m = /^([A-Za-z_][A-Za-z0-9_]*)=(-?[\d.eE+-]+)$/.exec(v); if (!m || !Number.isFinite(Number(m[2]))) throw usage(`--var expects name=number, got '${v}'`); o.vars[m[1]] = Number(m[2]); }
    else if (a === "--metric") { o.metric = Number(v); if (!Number.isFinite(o.metric)) throw usage("--metric must be a number"); }
    else if (["--model", "--result", "--id", "--profile", "--note", "--ledger"].includes(a)) o[a.slice(2)] = v;
    else throw usage(`unknown option: ${a}`);
  }
  return o;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    const o = parse(process.argv.slice(2));
    const rows = readLedger(o.ledger);
    if (o.cmd === "record") {
      if (!o.model) throw usage("record needs --model");
      const model = JSON.parse(fs.readFileSync(o.model, "utf8"));
      const result = o.result ? JSON.parse(fs.readFileSync(o.result, "utf8")) : evaluate(model, { profile: o.profile });
      const row = predictionRow(model, result, { id: o.id, modelPath: path.relative(process.cwd(), path.resolve(o.model)), profile: o.profile });
      if (rows.some((r) => r.type === "prediction" && r.id === row.id)) throw usage(`prediction '${row.id}' already recorded`);
      appendJsonlLine(o.ledger, row); console.log(`recorded ${row.id}: ${row.winner} (${row.verdict})`);
    } else if (o.cmd === "observe") {
      if (!o.id) throw usage("observe needs --id");
      if (!rows.some((r) => r.type === "prediction" && r.id === o.id)) throw usage(`no prediction with id '${o.id}'`);
      if (o.metric === undefined && !Object.keys(o.vars).length) throw usage("observe needs --metric and/or --var");
      appendJsonlLine(o.ledger, { type: "observation", id: o.id, ts: new Date().toISOString(), ...(o.metric !== undefined ? { metric: o.metric } : {}), ...(Object.keys(o.vars).length ? { variables: o.vars } : {}), ...(o.note ? { note: o.note } : {}) });
      console.log(`observed ${o.id}`);
    } else if (o.cmd === "review") {
      if (!o.id) throw usage("review needs --id");
      const r = review(rows, o.id);
      if (o.json) console.log(JSON.stringify(r, null, 2));
      else console.log(`${r.question}\nchose ${r.chose}; ${r.hindsight ? (r.hindsight.still_right ? "still the right choice" : `with what is known now, ${r.hindsight.winner} would win`) : "no observed variables to re-run with"}` +
        `${r.triggers_fired.length ? `; revisit triggers fired: ${r.triggers_fired.join(", ")}` : ""}${r.metric_in_predicted_range === false ? "; outcome landed outside the predicted p10–p90" : ""}`);
    } else {
      const c = calibration(rows);
      if (o.json) console.log(JSON.stringify(c, null, 2));
      else {
        console.log(`${c.predictions} predictions, ${c.outcomes_observed} outcomes observed${c.outcome_hit_rate === null ? "" : `, ${Math.round(c.outcome_hit_rate * 100)}% inside predicted p10–p90 (target 80%)`}`);
        for (const v of c.variables) console.log(`  ${v.variable}: ${v.observations} obs, ${Math.round(v.hit_rate * 100)}% inside declared range, reality/estimate ×${v.observed_over_estimate} → ${v.advice}`);
      }
    }
  } catch (e) { console.error(`decision-ledger: ${e.message}`); process.exit(e.code === 2 ? 2 : 1); }
}
