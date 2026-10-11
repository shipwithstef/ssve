// Seeded statistics shared by outcome-eval, experiment-compare and northstar decide.
// There is one bootstrap core (bootstrapDeltas). compareSamples and stratifiedDelta are
// both built on it, so recorded evidence re-derives to the same numbers every time.

export const SEED = 20261010;

export function rng(seed = SEED) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// The one bootstrap core. `cells` is [{ a, b }]: per iteration, resample a and b within
// each cell (draw order: a then b, cell by cell), take the cell's difference of means, and
// average the differences over cells. Returns the sorted bootstrap distribution.
export function bootstrapDeltas(cells, iterations, rand) {
  const pick = (xs) => xs[Math.floor(rand() * xs.length)];
  const boots = [];
  for (let i = 0; i < iterations; i++) {
    let sum = 0;
    for (const { a, b } of cells) sum += avg(a.map(() => pick(a))) - avg(b.map(() => pick(b)));
    boots.push(sum / cells.length);
  }
  return boots.sort((x, y) => x - y);
}

const bounds = (boots, iterations) => [boots[Math.floor(iterations * 0.025)], boots[Math.floor(iterations * 0.975)]];

// Difference of means (a - b) with a bootstrap 95% interval and a two-sided permutation p-value.
export function compareSamples(a, b, iterations = 10000) {
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
  return { diff: +diff.toFixed(2), ci95: [+lo.toFixed(2), +hi.toFixed(2)], p: +((extreme + 1) / (iterations + 1)).toFixed(4), n: [a.length, b.length] };
}

// Stratified delta: each cell is { framework: [run scores], solo: [run scores] } for one
// task x component. delta = mean over cells of (framework mean - solo mean); the 95%
// interval resamples runs within task x arm and recomputes it. Cells with an empty arm
// are skipped; returns null when no cell is usable. Values are rounded to 6 places.
export function stratifiedDelta(cells, iterations = 10000) {
  const usable = (cells || []).filter((c) => c?.framework?.length && c?.solo?.length);
  if (!usable.length) return null;
  const rand = rng();
  const delta = avg(usable.map((c) => avg(c.framework) - avg(c.solo)));
  const boots = bootstrapDeltas(usable.map((c) => ({ a: c.framework, b: c.solo })), iterations, rand);
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
  const stats = compareSamples(a, b, iterations);
  const ok = stats.p < 0.05 && stats.ci95[0] > 0;
  return { decision: ok ? "adopt" : "inconclusive", reason: ok ? "gain established (p < .05, ci95 low > 0)" : `gain not established (diff ${stats.diff}, ci95 [${stats.ci95}], p ${stats.p})`, n, stats };
}
