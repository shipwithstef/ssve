// Seeded statistics shared by outcome-eval, experiment-compare and northstar decide.
// There is one bootstrap core (bootstrapDeltas). compareSamples and stratifiedDelta are
// both built on it, so recorded evidence re-derives to the same numbers every time.

export const SEED = 20261010;

export function rng(seed = SEED) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// The one bootstrap core. `cells` is [{ a, b, group? }]. Per iteration, runs are resampled
// once per (group, arm): every cell of one group (one task) reuses the same drawn run
// indices, so a run's components stay together, as "resampling runs within task and arm"
// requires. Draw order is group by group, a then b. A cell without a group is its own
// group, so a single cell draws a then b exactly as compareSamples always has. Each cell
// contributes its difference of means; the iteration's value is their average.
export function bootstrapDeltas(cells, iterations, rand) {
  const groups = [];
  const byKey = new Map();
  cells.forEach((c, i) => {
    const key = c.group ?? `\u0000cell${i}`;
    if (!byKey.has(key)) { byKey.set(key, { na: c.a.length, nb: c.b.length, cells: [] }); groups.push(byKey.get(key)); }
    const g = byKey.get(key);
    if (g.na !== c.a.length || g.nb !== c.b.length) throw new Error(`bootstrap group ${String(key)}: cells must hold the same runs per arm`);
    g.cells.push(c);
  });
  const draw = (n) => Array.from({ length: n }, () => Math.floor(rand() * n));
  const meanAt = (xs, idx) => idx.reduce((s, k) => s + xs[k], 0) / idx.length;
  const boots = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (const g of groups) {
      const ia = draw(g.na), ib = draw(g.nb);
      for (const c of g.cells) sum += meanAt(c.a, ia) - meanAt(c.b, ib);
    }
    boots.push(sum / cells.length);
  }
  return boots.sort((x, y) => x - y);
}

const bounds = (boots, iterations) => [boots[Math.floor(iterations * 0.025)], boots[Math.floor(iterations * 0.975)]];

// Unrounded difference of means (a - b) with a bootstrap 95% interval and a two-sided
// permutation p-value. Decisions use these raw numbers; rounding is for display only.
export function compareRaw(a, b, iterations = 10000) {
  if (!a.length || !b.length) return null;
  const rand = rng();
  const diff = avg(a) - avg(b);
  const boots = bootstrapDeltas([{ a, b }], iterations, rand);
  const pooled = [...a, ...b];
  let extreme = 0;
  for (let i = 0; i < iterations; i++) {
    const shuffled = [...pooled];
    for (let j = shuffled.length - 1; j > 0; j--) { const k = Math.floor(rand() * (j + 1)); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
    if (Math.abs(avg(shuffled.slice(0, a.length)) - avg(shuffled.slice(a.length))) >= Math.abs(diff) - 1e-12) extreme++;
  }
  const [lo, hi] = bounds(boots, iterations);
  return { diff, ci95: [lo, hi], p: (extreme + 1) / (iterations + 1), n: [a.length, b.length] };
}

// Same statistics rounded for display (diff and ci95 to 2 places, p to 4).
export function compareSamples(a, b, iterations = 10000) {
  const r = compareRaw(a, b, iterations);
  if (!r) return null;
  return { diff: +r.diff.toFixed(2), ci95: [+r.ci95[0].toFixed(2), +r.ci95[1].toFixed(2)], p: +r.p.toFixed(4), n: r.n };
}

// Stratified delta: each cell is { task, framework: [run scores], solo: [run scores] } for one
// task x component, with scores in the same run order for every component of a task. delta = mean over cells of (framework mean - solo mean); the 95%
// interval resamples runs within task x arm and recomputes it. Cells with an empty arm
// are skipped; returns null when no cell is usable. Values are rounded to 6 places.
export function stratifiedDelta(cells, iterations = 10000) {
  const usable = (cells || []).filter((c) => c?.framework?.length && c?.solo?.length);
  if (!usable.length) return null;
  const rand = rng();
  const delta = avg(usable.map((c) => avg(c.framework) - avg(c.solo)));
  const boots = bootstrapDeltas(usable.map((c) => ({ a: c.framework, b: c.solo, group: c.task })), iterations, rand);
  const [lo, hi] = bounds(boots, iterations);
  const r = (x) => +x.toFixed(6);
  return { delta: r(delta), ci95: [r(lo), r(hi)], cells: usable.length, iterations };
}

// Adoption rule (organism plan rev 4, section 11 item 8): n >= 5 per arm and p < .05 and a
// positive lower bound, else "inconclusive". `a` is the candidate sample, `b` the baseline.
export const ADOPT_MIN_N = 5;
export function adoptionDecision(a, b, iterations = 10000) {
  const n = [a.length, b.length];
  if (Math.min(...n) < ADOPT_MIN_N) return { decision: "inconclusive", reason: `n >= ${ADOPT_MIN_N} per arm required, got ${n[0]} and ${n[1]}`, n, stats: null };
  const raw = compareRaw(a, b, iterations);
  const ok = raw.p < 0.05 && raw.ci95[0] > 0; // unrounded: a bound of 0.004 is above zero, 0.00 displayed or not
  const stats = compareSamples(a, b, iterations);
  return { decision: ok ? "adopt" : "inconclusive", reason: ok ? "gain established (p < .05, ci95 low > 0)" : `gain not established (diff ${stats.diff}, ci95 [${stats.ci95}], p ${stats.p})`, n, stats };
}
