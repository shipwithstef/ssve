#!/usr/bin/env node
/**
 * experiment-compare — decide an A/B (or A/B/n) from real counts, without
 * eyeballing percentages. Works for anything with trials and successes:
 * social posts (impressions → clicks/follows/signups), landing or component
 * variants (visitors → conversions), outreach (sends → replies).
 *
 * Bayesian beta-binomial: each variant's rate gets a Beta(prior + successes,
 * prior + failures) posterior. Monte Carlo (seeded) gives P(best), the
 * expected loss of shipping each variant (how much rate you give up if it is
 * not actually the best), and a 90% credible interval. The verdict is:
 *   ship        expected loss of the leader ≤ threshold → stop, ship it
 *   keep-running not decidable yet; reports roughly how many more trials
 *               per variant would get the leader under the threshold
 * Small samples are where this matters: 3/40 vs 1/38 "looks" 3× better and is
 * not decidable; the tool says so instead of a confident wrong call.
 *
 * Usage:
 *   node scripts/experiment-compare.mjs --variant name:trials:successes [--variant ...]
 *        [--value-per-success N] [--threshold 0.001] [--prior a,b] [--seed S] [--json]
 *   node scripts/experiment-compare.mjs --file EXPERIMENT.json [--json]
 *     EXPERIMENT.json: { "variants":[{"name":"A","trials":1200,"successes":31}], "threshold":0.001,
 *                        "value_per_success": 29, "prior":[1,1] }
 * Exit codes: 0 ok · 2 usage error.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(rng) { let u = 0; while (u === 0) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); }
/** Marsaglia–Tsang gamma sampler (shape k > 0, scale 1). */
function gamma(k, rng) {
  if (k < 1) { const u = rng(); return gamma(k + 1, rng) * Math.pow(u || 1e-12, 1 / k); }
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) { let x, v; do { x = gauss(rng); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rng();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; }
}
const beta = (a, b, rng) => { const x = gamma(a, rng); return x / (x + gamma(b, rng)); };

export function compare({ variants, threshold = 0.001, prior = [1, 1], value_per_success = null, samples = 40000, seed = 1 }) {
  if (!Array.isArray(variants) || variants.length < 2) throw usage("need at least 2 variants");
  const names = new Set();
  for (const v of variants) {
    if (!v.name || names.has(v.name)) throw usage(`variant names must be unique and non-empty (${v.name})`); names.add(v.name);
    if (!Number.isInteger(v.trials) || !Number.isInteger(v.successes) || v.trials < 0 || v.successes < 0 || v.successes > v.trials) throw usage(`variant ${v.name}: need integers 0 <= successes <= trials`);
  }
  if (!(prior[0] > 0 && prior[1] > 0)) throw usage("prior must be two positive numbers");
  if (!(threshold > 0)) throw usage("threshold must be > 0");
  const rng = mulberry32(seed); const k = variants.length;
  const draws = variants.map(() => new Float64Array(samples));
  for (let s = 0; s < samples; s++) for (let i = 0; i < k; i++) {
    const v = variants[i]; draws[i][s] = beta(prior[0] + v.successes, prior[1] + v.trials - v.successes, rng);
  }
  const wins = new Array(k).fill(0); const loss = new Array(k).fill(0);
  for (let s = 0; s < samples; s++) {
    let best = 0; for (let i = 1; i < k; i++) if (draws[i][s] > draws[best][s]) best = i;
    wins[best]++; for (let i = 0; i < k; i++) loss[i] += draws[best][s] - draws[i][s];
  }
  const rows = variants.map((v, i) => {
    const sorted = Float64Array.from(draws[i]).sort();
    const r = { name: v.name, trials: v.trials, successes: v.successes, observed_rate: v.trials ? v.successes / v.trials : null,
      posterior_mean: (prior[0] + v.successes) / (prior[0] + prior[1] + v.trials),
      ci90: [sorted[Math.floor(0.05 * samples)], sorted[Math.floor(0.95 * samples)]],
      p_best: wins[i] / samples, expected_loss: loss[i] / samples };
    if (value_per_success !== null) r.expected_loss_value = r.expected_loss * value_per_success;
    return r;
  }).sort((a, b) => a.expected_loss - b.expected_loss);
  const lead = rows[0];
  const verdict = lead.expected_loss <= threshold ? "ship" : "keep-running";
  // expected loss shrinks roughly with 1/sqrt(n): scale the current per-variant trials
  const n = Math.max(1, Math.min(...variants.map((v) => v.trials)));
  const more = verdict === "ship" ? 0 : Math.ceil(n * ((lead.expected_loss / threshold) ** 2 - 1));
  const pct = (x) => `${(100 * x).toFixed(2)}%`;
  const summary = verdict === "ship"
    ? `Ship ${lead.name}: P(best) ${Math.round(lead.p_best * 100)}%, expected loss if wrong ${pct(lead.expected_loss)} of rate (threshold ${pct(threshold)}).`
    : `Not decidable yet: ${lead.name} leads with P(best) ${Math.round(lead.p_best * 100)}% but shipping it now risks ${pct(lead.expected_loss)} of rate (threshold ${pct(threshold)}). Roughly ${more} more trials per variant needed${more > 20 * n ? " — likely too many; the variants are probably equivalent, so decide on cost or taste" : ""}.`;
  return { schema: "svc-experiment-result/1", verdict, leader: lead.name, threshold, prior, samples, seed, more_trials_per_variant: more, variants: rows, summary };
}

function usage(msg) { return Object.assign(new Error(msg), { code: 2 }); }

function parse(argv) {
  const o = { variants: [], json: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") { o.json = true; continue; }
    const v = argv[++i]; if (v === undefined) throw usage(`${a} requires a value`);
    if (a === "--variant") { const m = /^([^:]+):(\d+):(\d+)$/.exec(v); if (!m) throw usage(`--variant expects name:trials:successes, got '${v}'`); o.variants.push({ name: m[1], trials: Number(m[2]), successes: Number(m[3]) }); }
    else if (a === "--file") o.file = v;
    else if (a === "--threshold") o.threshold = Number(v);
    else if (a === "--value-per-success") o.value_per_success = Number(v);
    else if (a === "--seed") o.seed = Number(v);
    else if (a === "--prior") { const p = v.split(",").map(Number); if (p.length !== 2 || p.some((x) => !Number.isFinite(x))) throw usage("--prior expects a,b"); o.prior = p; }
    else throw usage(`unknown option: ${a}`);
  }
  if (o.file) { let f; try { f = JSON.parse(fs.readFileSync(o.file, "utf8")); } catch (e) { throw usage(`cannot read ${o.file}: ${e.message}`); } Object.assign(o, f, o.variants.length ? { variants: o.variants } : {}); }
  return o;
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  try {
    const o = parse(process.argv.slice(2)); const { json, file, ...args } = o;
    for (const k of Object.keys(args)) if (args[k] === undefined) delete args[k];
    const r = compare(args);
    if (json) console.log(JSON.stringify(r, null, 2));
    else {
      console.log(r.summary);
      for (const v of r.variants) console.log(`  ${v.name.padEnd(14)} ${v.successes}/${v.trials}  posterior ${(100 * v.posterior_mean).toFixed(2)}% [${(100 * v.ci90[0]).toFixed(2)}–${(100 * v.ci90[1]).toFixed(2)}]  P(best) ${Math.round(v.p_best * 100)}%`);
    }
  } catch (e) { console.error(`experiment-compare: ${e.message}`); process.exit(e.code === 2 ? 2 : 1); }
}
