#!/usr/bin/env node
/**
 * decision-engine — compute a strategic decision instead of narrating it.
 *
 * The model's job is structure and evidence: options, the variables that
 * drive their value, ranges with sources, correlations, hard gates. This
 * engine does the part transformers do unreliably — many-cell arithmetic,
 * consistent probability, correlated uncertainty — deterministically:
 *
 *   1. Monte Carlo over all variables (seeded, correlated via Gaussian copula)
 *   2. HARD gates as probabilities: an option is eliminated when its chance of
 *      violating a gate exceeds the gate's tolerance
 *   3. per-option value distribution, P(best), expected regret
 *   4. value of information (EVPPI) per uncertain variable → the ONE question
 *      worth asking next, or "decision is clear" when no answer could change it
 *   5. sensitivity of the winning margin and the break-even value where the
 *      winner flips → computed revisit triggers
 *   6. the same run per constraint profile → where the winner flips by profile
 *
 * Usage:
 *   node scripts/decision-engine.mjs evaluate MODEL.json [--json|--markdown]
 *        [--samples N] [--seed S] [--profile NAME]
 *   node scripts/decision-engine.mjs validate MODEL.json
 * Model format: schemas/decision-model.schema.json; guide: docs/decision-engine.md.
 * Exit codes: 0 ok · 1 runtime error · 2 usage or invalid model.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./lib/decision-expr.mjs";

export const SCHEMA = "svc-decision-model/1";
const DISTS = new Set(["const", "uniform", "triangular", "normal", "lognormal", "discrete"]);

// ── random numbers ───────────────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normalPair(rng) {
  let u = 0; while (u === 0) u = rng();
  const v = rng(); const r = Math.sqrt(-2 * Math.log(u));
  return [r * Math.cos(2 * Math.PI * v), r * Math.sin(2 * Math.PI * v)];
}
/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf, |err| < 1.5e-7). */
export function phi(z) {
  const x = Math.abs(z) / Math.SQRT2; const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}
const Z90 = 1.2815515655446004; // Φ⁻¹(0.9)

/** Inverse CDF for each distribution; u ∈ (0,1), z is the matching standard normal. */
function quantile(d, u, z) {
  switch (d.dist) {
    case "const": return d.value;
    case "uniform": return d.low + u * (d.high - d.low);
    case "triangular": {
      const { low: a, mode: c, high: b } = d; if (b === a) return a; const f = (c - a) / (b - a);
      return u < f ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c));
    }
    case "normal": return d.mean + d.sd * z;
    case "lognormal": { // specified by its p10 / p90 (both > 0): the form people can actually estimate
      const mu = (Math.log(d.p10) + Math.log(d.p90)) / 2; const sigma = (Math.log(d.p90) - Math.log(d.p10)) / (2 * Z90);
      return Math.exp(mu + sigma * z);
    }
    case "discrete": {
      const tot = d.weights.reduce((s, w) => s + w, 0); let acc = 0;
      for (let i = 0; i < d.values.length; i++) { acc += d.weights[i] / tot; if (u <= acc) return d.values[i]; }
      return d.values[d.values.length - 1];
    }
  }
  throw new Error(`unknown dist ${d.dist}`);
}
/** p10 / p50 / p90 of a declared distribution (used for calibration against observations). */
export function rangeOf(d) {
  const q = (u, z) => quantile(d, u, z);
  if (d.dist === "discrete") { const v = [...d.values].sort((a, b) => a - b); return { p10: q(0.1, -Z90), p50: q(0.5, 0), p90: q(0.9, Z90), min: v[0], max: v[v.length - 1] }; }
  return { p10: q(0.1, -Z90), p50: q(0.5, 0), p90: q(0.9, Z90) };
}
function baseValue(d) {
  switch (d.dist) {
    case "const": return d.value;
    case "uniform": return (d.low + d.high) / 2;
    case "triangular": return d.mode;
    case "normal": return d.mean;
    case "lognormal": return Math.sqrt(d.p10 * d.p90);
    case "discrete": { let bi = 0; d.weights.forEach((w, i) => { if (w > d.weights[bi]) bi = i; }); return d.values[bi]; }
  }
}

/** Cholesky of a symmetric positive-definite matrix; throws when not PD. */
export function cholesky(m) {
  const n = m.length; const L = m.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = m[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (s <= 1e-12) throw new Error("correlation matrix is not positive definite (inconsistent rho values)"); L[i][i] = Math.sqrt(s); }
    else L[i][j] = s / L[j][j];
  }
  return L;
}

// ── model validation ─────────────────────────────────────────────────────────
const num = (x) => typeof x === "number" && Number.isFinite(x);
export function validateModel(m) {
  const errs = [];
  if (!m || typeof m !== "object") return ["model must be a JSON object"];
  if (m.schema !== SCHEMA) errs.push(`schema must be "${SCHEMA}"`);
  if (!m.question || typeof m.question !== "string") errs.push("question is required");
  const vars = m.variables || {};
  if (typeof vars !== "object" || Array.isArray(vars)) errs.push("variables must be an object");
  for (const [k, d] of Object.entries(vars)) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) errs.push(`variable '${k}': name must be an identifier`);
    if (!d || !DISTS.has(d.dist)) { errs.push(`variable '${k}': dist must be one of ${[...DISTS].join(", ")}`); continue; }
    const need = { const: ["value"], uniform: ["low", "high"], triangular: ["low", "mode", "high"], normal: ["mean", "sd"], lognormal: ["p10", "p90"] }[d.dist] || [];
    for (const f of need) if (!num(d[f])) errs.push(`variable '${k}': ${d.dist} needs numeric ${f}`);
    if (d.dist === "uniform" && d.low > d.high) errs.push(`variable '${k}': low > high`);
    if (d.dist === "triangular" && !(d.low <= d.mode && d.mode <= d.high)) errs.push(`variable '${k}': need low <= mode <= high`);
    if (d.dist === "normal" && d.sd < 0) errs.push(`variable '${k}': sd < 0`);
    if (d.dist === "lognormal" && !(d.p10 > 0 && d.p90 > d.p10)) errs.push(`variable '${k}': need 0 < p10 < p90`);
    if (d.dist === "discrete" && (!Array.isArray(d.values) || !Array.isArray(d.weights) || d.values.length === 0 || d.values.length !== d.weights.length || !d.values.every(num) || !d.weights.every((w) => num(w) && w >= 0) || d.weights.every((w) => w === 0))) errs.push(`variable '${k}': discrete needs equal-length numeric values[] and non-negative weights[]`);
  }
  const derived = m.derived || {};
  for (const k of Object.keys(derived)) { if (vars[k]) errs.push(`derived '${k}' shadows a variable`); if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(k)) errs.push(`derived '${k}': name must be an identifier`); }
  if (!Array.isArray(m.options) || m.options.length < 2) errs.push("options must list at least 2 options");
  const ids = new Set();
  for (const o of m.options || []) {
    if (!o || !o.id) { errs.push("every option needs an id"); continue; }
    if (ids.has(o.id)) errs.push(`duplicate option id '${o.id}'`); ids.add(o.id);
    if (o.value === undefined) errs.push(`option '${o.id}': value expression is required`);
  }
  for (const c of m.correlations || []) {
    if (!vars[c.a] || !vars[c.b]) errs.push(`correlation ${c.a}~${c.b}: both must be declared variables`);
    else if (vars[c.a].dist === "const" || vars[c.b].dist === "const") errs.push(`correlation ${c.a}~${c.b}: const variables cannot be correlated`);
    if (!num(c.rho) || c.rho <= -1 || c.rho >= 1) errs.push(`correlation ${c.a}~${c.b}: rho must be in (-1, 1)`);
    if (c.a === c.b) errs.push(`correlation ${c.a}~${c.b}: a variable cannot correlate with itself`);
  }
  for (const [p, prof] of Object.entries(m.profiles || {})) for (const k of Object.keys((prof && prof.variables) || {})) if (!vars[k]) errs.push(`profile '${p}' overrides undeclared variable '${k}'`);
  if (errs.length) return errs;
  // expression compile check (names resolve; derived may use variables + earlier derived)
  const scope = new Set(Object.keys(vars));
  for (const [k, ex] of Object.entries(derived)) { try { compile(ex, scope); } catch (e) { errs.push(`derived '${k}': ${e.message}`); } scope.add(k); }
  for (const o of m.options) {
    const s = new Set([...scope, ...Object.keys(o.params || {})]);
    try { compile(o.value, s); } catch (e) { errs.push(`option '${o.id}' value: ${e.message}`); }
    for (const g of [...(m.gates || []), ...(o.gates || [])]) {
      if (!g || g.expr === undefined) { errs.push(`option '${o.id}': every gate needs an expr`); continue; }
      try { compile(g.expr, s); } catch (e) { errs.push(`option '${o.id}' gate '${g.label || g.expr}': ${e.message}`); }
      if (g.tolerance !== undefined && !(num(g.tolerance) && g.tolerance >= 0 && g.tolerance < 1)) errs.push(`option '${o.id}' gate '${g.label || g.expr}': tolerance must be in [0, 1)`);
    }
  }
  return errs;
}

// ── statistics helpers ───────────────────────────────────────────────────────
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
function pct(sorted, q) { const i = (sorted.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo); }
function ranks(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; const avg = (i + j) / 2; for (let k = i; k <= j; k++) r[idx[k][1]] = avg; i = j + 1; } return r; }
function pearson(x, y) { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < x.length; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  return sxx === 0 || syy === 0 ? 0 : sxy / Math.sqrt(sxx * syy); }
const spearman = (x, y) => pearson(ranks(x), ranks(y));
const round = (x, d = 4) => (Number.isFinite(x) ? Number(x.toPrecision(d)) : x);

// ── evaluation ───────────────────────────────────────────────────────────────
function applyProfile(model, profileName) {
  if (!profileName) return model;
  const prof = (model.profiles || {})[profileName];
  if (!prof) throw new Error(`unknown profile '${profileName}'`);
  return { ...model, variables: { ...model.variables, ...(prof.variables || {}) } };
}

/** Draw `n` correlated samples: returns { names, cols: {name: Float64Array} }. */
function sample(model, n, seed) {
  const names = Object.keys(model.variables);
  const random = names.filter((k) => model.variables[k].dist !== "const");
  const ix = new Map(random.map((k, i) => [k, i]));
  const C = random.map((_, i) => random.map((__, j) => (i === j ? 1 : 0)));
  for (const c of model.correlations || []) {
    if (!ix.has(c.a) || !ix.has(c.b)) continue;
    C[ix.get(c.a)][ix.get(c.b)] = c.rho; C[ix.get(c.b)][ix.get(c.a)] = c.rho;
  }
  const L = random.length ? cholesky(C) : [];
  const rng = mulberry32(seed);
  const cols = Object.fromEntries(names.map((k) => [k, new Float64Array(n)]));
  const g = new Array(random.length);
  for (let s = 0; s < n; s++) {
    for (let i = 0; i < random.length; i += 2) { const [a, b] = normalPair(rng); g[i] = a; if (i + 1 < random.length) g[i + 1] = b; }
    for (let i = 0; i < random.length; i++) {
      let z = 0; for (let k = 0; k <= i; k++) z += L[i][k] * g[k];
      const d = model.variables[random[i]]; cols[random[i]][s] = quantile(d, phi(z), z);
    }
    for (const k of names) if (model.variables[k].dist === "const") cols[k][s] = model.variables[k].value;
  }
  return { names, random, cols };
}

export function evaluate(rawModel, opts = {}) {
  const errs = validateModel(rawModel);
  if (errs.length) { const e = new Error(`invalid decision model:\n- ${errs.join("\n- ")}`); e.code = 2; throw e; }
  const model = applyProfile(rawModel, opts.profile);
  const n = opts.samples ?? model.samples ?? 20000;
  const seed = opts.seed ?? model.seed ?? 1;
  if (!Number.isInteger(n) || n < 200 || n > 2_000_000) { const e = new Error("samples must be an integer in [200, 2000000]"); e.code = 2; throw e; }
  const { names, random, cols } = sample(model, n, seed);
  const scope = new Set(names);
  const derived = Object.entries(model.derived || {}).map(([k, ex]) => { const c = compile(ex, scope); scope.add(k); return [k, c.fn]; });
  const opt = model.options.map((o) => {
    const s = new Set([...scope, ...Object.keys(o.params || {})]);
    return { o, value: compile(o.value, s).fn, gates: [...(model.gates || []), ...(o.gates || [])].map((g) => ({ g, fn: compile(g.expr, s).fn })) };
  });
  const values = opt.map(() => new Float64Array(n));
  const gateFail = opt.map((x) => x.gates.map(() => 0));
  const env = {};
  for (let s = 0; s < n; s++) {
    for (const k of names) env[k] = cols[k][s];
    for (const [k, fn] of derived) env[k] = fn(env);
    opt.forEach((x, oi) => {
      const e = x.o.params ? { ...env, ...x.o.params } : env;
      const v = x.value(e);
      if (!Number.isFinite(v)) throw new Error(`option '${x.o.id}' value is not finite at sample ${s} (check divisions/logs)`);
      values[oi][s] = v;
      x.gates.forEach((gt, gi) => { if (!gt.fn(e)) gateFail[oi][gi]++; });
    });
  }
  // gates → elimination
  const rows = opt.map((x, oi) => {
    const gates = x.gates.map((gt, gi) => {
      const pFail = gateFail[oi][gi] / n; const tol = gt.g.tolerance ?? 0.05;
      return { label: gt.g.label || gt.g.expr, family: gt.g.family || null, p_fail: round(pFail), tolerance: tol, eliminates: pFail > tol };
    });
    const sorted = Float64Array.from(values[oi]).sort();
    return { id: x.o.id, label: x.o.label || x.o.id, gates, eliminated: gates.some((g) => g.eliminates),
      mean: mean(values[oi]), p10: pct(sorted, 0.1), p50: pct(sorted, 0.5), p90: pct(sorted, 0.9) };
  });
  const alive = rows.map((r, i) => (r.eliminated ? -1 : i)).filter((i) => i >= 0);
  const dir = (model.objective && model.objective.direction) === "min" ? -1 : 1;
  const out = { schema: "svc-decision-result/1", question: model.question, profile: opts.profile || null, samples: n, seed,
    objective: { metric: model.objective?.metric || "value", unit: model.objective?.unit || null, direction: dir === 1 ? "max" : "min" } };
  if (alive.length === 0) {
    return { ...out, verdict: "no-survivor", winner: null, options: rows.map(fmtRow), next_question: null,
      summary: "Every option fails a HARD gate beyond tolerance. Relax a gate deliberately or add options." };
  }
  // utility = direction-adjusted value (higher is better)
  const U = (oi, s) => dir * values[oi][s];
  const best = new Uint32Array(n); let evpiAcc = 0;
  const means = alive.map((oi) => dir * rows[oi].mean);
  const wIdx = alive[means.indexOf(Math.max(...means))];
  const regret = new Map(alive.map((oi) => [oi, 0]));
  for (let s = 0; s < n; s++) {
    let bo = alive[0], bu = U(alive[0], s);
    for (const oi of alive) { const u = U(oi, s); if (u > bu) { bu = u; bo = oi; } }
    best[s] = bo; evpiAcc += bu - U(wIdx, s);
    for (const oi of alive) regret.set(oi, regret.get(oi) + (bu - U(oi, s)));
  }
  const wins = new Map(alive.map((oi) => [oi, 0])); for (let s = 0; s < n; s++) wins.set(best[s], wins.get(best[s]) + 1);
  for (const oi of alive) { rows[oi].p_best = wins.get(oi) / n; rows[oi].expected_regret = regret.get(oi) / n; }
  const evpi = evpiAcc / n;
  const ranked = [...alive].sort((a, b) => dir * rows[b].mean - dir * rows[a].mean);
  const runner = ranked[1];
  // value of information per uncertain variable (EVPPI, quantile-binning estimator)
  const bins = Math.max(5, Math.min(50, Math.floor(n / 400)));
  const margin = runner === undefined ? null : Array.from({ length: n }, (_, s) => U(wIdx, s) - U(runner, s));
  const voi = random.map((k) => {
    const order = Array.from(cols[k].keys()).sort((a, b) => cols[k][a] - cols[k][b]);
    let acc = 0; const flips = [];
    for (let b = 0; b < bins; b++) {
      const lo = Math.floor((b * n) / bins), hi = Math.floor(((b + 1) * n) / bins); if (hi <= lo) continue;
      let bestU = -Infinity, bestO = -1;
      for (const oi of alive) { let s2 = 0; for (let j = lo; j < hi; j++) s2 += U(oi, order[j]); const m = s2 / (hi - lo); if (m > bestU) { bestU = m; bestO = oi; } }
      let wU = 0; for (let j = lo; j < hi; j++) wU += U(wIdx, order[j]); wU /= hi - lo;
      acc += (bestU - wU) * (hi - lo);
      flips.push({ from: cols[k][order[lo]], to: cols[k][order[hi - 1]], best: bestO });
    }
    // break-even: first bin boundary where the conditional best changes away from / back to the winner
    let breakEven = null;
    for (let b = 1; b < flips.length; b++) if (flips[b].best !== flips[b - 1].best) { breakEven = { at: round((flips[b - 1].to + flips[b].from) / 2), below: rows[flips[b - 1].best].id, above: rows[flips[b].best].id }; break; }
    const d = model.variables[k];
    return { variable: k, evppi: acc / n, sensitivity: margin ? spearman(Array.from(cols[k]), Array.from(margin)) : 0, break_even: breakEven,
      askable: d.askable !== false, question: d.question || null, source: d.source || null, base: baseValue(d) };
  }).sort((a, b) => b.evppi - a.evppi);
  const stake = Math.max(Math.abs(rows[wIdx].mean), Math.abs(rows[wIdx].p90 - rows[wIdx].p10), 1e-9);
  const threshold = model.objective?.voi_threshold ?? 0.01 * stake;
  const next = voi.find((v) => v.askable && v.evppi > threshold) || null;
  const pBest = rows[wIdx].p_best;
  // ask-first: one answerable unknown is worth more than the threshold.
  // clear: even perfect information about everything is worth less than it.
  // decide-and-monitor: uncertainty matters jointly, but no single question pays.
  const verdict = next ? "ask-first" : evpi <= threshold ? "clear" : "decide-and-monitor";
  return { ...out, verdict, evpi: round(evpi), voi_threshold: round(threshold),
    winner: { id: rows[wIdx].id, label: rows[wIdx].label, p_best: round(pBest), mean: round(rows[wIdx].mean), runner_up: runner === undefined ? null : rows[runner].id },
    next_question: next ? { variable: next.variable, question: next.question || `What is the real value of ${next.variable}?`, evppi: round(next.evppi), break_even: next.break_even, source: next.source } : null,
    options: ranked.concat(rows.map((_, i) => i).filter((i) => !alive.includes(i))).map((i) => fmtRow(rows[i])),
    value_of_information: voi.map((v) => ({ ...v, evppi: round(v.evppi), sensitivity: round(v.sensitivity, 3), base: round(v.base) })),
    summary: summarize(verdict, rows[wIdx], runner === undefined ? null : rows[runner], next, evpi, out.objective) };
}
function fmtRow(r) {
  return { id: r.id, label: r.label, eliminated: r.eliminated, mean: round(r.mean), p10: round(r.p10), p50: round(r.p50), p90: round(r.p90),
    p_best: r.p_best === undefined ? null : round(r.p_best), expected_regret: r.expected_regret === undefined ? null : round(r.expected_regret),
    gates: r.gates };
}
function summarize(verdict, w, r, next, evpi, obj) {
  const u = obj.unit ? ` ${obj.unit}` : "";
  const head = `${w.label} wins: expected ${obj.metric} ${round(w.mean)}${u}, best in ${Math.round(w.p_best * 100)}% of futures${r ? `; runner-up ${r.label} at ${round(r.mean)}${u}` : ""}.`;
  if (verdict === "ask-first") return `${head} Before committing, answer one question: ${next.question || next.variable} Knowing it is worth ${round(next.evppi)}${u} in expectation${next.break_even ? `; the best option changes at ${next.variable} = ${next.break_even.at}` : ""}.`;
  if (verdict === "clear") return `${head} No unknown is worth asking about: perfect information on everything is worth only ${round(evpi)}${u}. Decide.`;
  return `${head} Remaining uncertainty (worth ${round(evpi)}${u} if fully resolved) is spread across several variables; no single question pays for itself. Decide, and watch the revisit triggers.`;
}

/** Plain-language trigger: which side of the break-even makes which option best. */
export function triggerText(v, winnerId) {
  const be = v.break_even; if (!be) return null;
  return be.below === winnerId
    ? `if \`${v.variable}\` turns out above ${be.at}, ${be.above} becomes the better option`
    : `if \`${v.variable}\` turns out below ${be.at}, ${be.below} becomes the better option`;
}

/** Run the base model and every declared profile; report where the winner flips. */
export function evaluateProfiles(model, opts = {}) {
  const base = evaluate(model, opts);
  const profiles = Object.keys(model.profiles || {}).map((p) => { const r = evaluate(model, { ...opts, profile: p }); return { profile: p, verdict: r.verdict, winner: r.winner?.id ?? null, p_best: r.winner?.p_best ?? null, next_question: r.next_question?.variable ?? null }; });
  return { ...base, profiles, winner_flips_by_profile: new Set(profiles.map((p) => p.winner).concat(base.winner?.id ?? null)).size > 1 };
}

export function toMarkdown(r) {
  const u = r.objective.unit ? ` (${r.objective.unit})` : "";
  const L = [`# Decision: ${r.question}`, "", `**Verdict:** ${r.verdict}${r.profile ? ` · profile ${r.profile}` : ""} · ${r.samples} samples · seed ${r.seed}`, "", r.summary, ""];
  L.push(`| Option | mean${u} | p10 | p50 | p90 | P(best) | expected regret | eliminated by |`, "|---|---:|---:|---:|---:|---:|---:|---|");
  for (const o of r.options) L.push(`| ${o.label} | ${o.mean} | ${o.p10} | ${o.p50} | ${o.p90} | ${o.p_best ?? "—"} | ${o.expected_regret ?? "—"} | ${o.gates.filter((g) => g.eliminates).map((g) => `${g.label} (P(fail) ${g.p_fail} > ${g.tolerance})`).join("; ") || ""} |`);
  if (r.value_of_information) {
    L.push("", "## What would change the decision", "", "| Variable | value of knowing it (EVPPI) | sensitivity of winning margin | winner flips at | source |", "|---|---:|---:|---|---|");
    for (const v of r.value_of_information) L.push(`| ${v.variable}${v.askable ? "" : " (not askable)"} | ${v.evppi} | ${v.sensitivity} | ${v.break_even ? `${v.break_even.at} (${v.break_even.below} below, ${v.break_even.above} above)` : "no flip in range"} | ${v.source || "—"} |`);
  }
  if (r.profiles?.length) {
    L.push("", "## By constraint profile", "", "| Profile | winner | P(best) | verdict | ask first |", "|---|---|---:|---|---|");
    for (const p of r.profiles) L.push(`| ${p.profile} | ${p.winner ?? "none"} | ${p.p_best ?? "—"} | ${p.verdict} | ${p.next_question ?? "—"} |`);
  }
  const triggers = (r.value_of_information || []).filter((v) => v.break_even).slice(0, 3);
  if (triggers.length) { L.push("", "## Revisit triggers (computed)", ""); for (const v of triggers) L.push(`- Re-run ${triggerText(v, r.winner?.id)}.`); }
  return L.join("\n") + "\n";
}

// ── CLI ──────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const [cmd, file, ...rest] = argv; const o = { cmd, file, format: "markdown" };
  if (!["evaluate", "validate"].includes(cmd) || !file) throw Object.assign(new Error("usage: decision-engine.mjs evaluate|validate MODEL.json [--json|--markdown] [--samples N] [--seed S] [--profile NAME]"), { code: 2 });
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") o.format = "json"; else if (a === "--markdown") o.format = "markdown";
    else if (["--samples", "--seed", "--profile"].includes(a)) { const v = rest[++i]; if (v === undefined) throw Object.assign(new Error(`${a} requires a value`), { code: 2 }); o[a.slice(2)] = a === "--profile" ? v : Number(v); }
    else throw Object.assign(new Error(`unknown option: ${a}`), { code: 2 });
  }
  if (o.seed !== undefined && !Number.isInteger(o.seed)) throw Object.assign(new Error("--seed must be an integer"), { code: 2 });
  return o;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    const o = parseArgs(process.argv.slice(2));
    let model; try { model = JSON.parse(fs.readFileSync(o.file, "utf8")); } catch (e) { throw Object.assign(new Error(`cannot read model: ${e.message}`), { code: 2 }); }
    if (o.cmd === "validate") { const errs = validateModel(model); if (errs.length) { console.error(`invalid decision model:\n- ${errs.join("\n- ")}`); process.exit(2); } console.log("decision model valid"); process.exit(0); }
    const r = o.profile ? evaluate(model, o) : evaluateProfiles(model, o);
    process.stdout.write(o.format === "json" ? JSON.stringify(r, null, 2) + "\n" : toMarkdown(r));
  } catch (e) { console.error(`decision-engine: ${e.message}`); process.exit(e.code === 2 ? 2 : 1); }
}
