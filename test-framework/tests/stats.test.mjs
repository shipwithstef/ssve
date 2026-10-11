import test from "node:test";
import assert from "node:assert/strict";
import { compareSamples, stratifiedDelta, adoptionDecision } from "../../scripts/lib/stats.mjs";
import { compareSamples as legacyCompareSamples } from "../../scripts/outcome-eval.mjs";

const CASES = [
  [[1, 0.5, 0.75, 0.25], [0.2, 0.1, 0.4]],
  [[1, 1, 1], [0, 0, 0]],
  [[0.5], [0.5]],
  [[3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5]],
];

test("compareSamples matches the outcome-eval export on fixed inputs", () => {
  for (const [a, b] of CASES) {
    assert.deepEqual(compareSamples(a, b), legacyCompareSamples(a, b));
    assert.deepEqual(compareSamples(a, b, 500), legacyCompareSamples(a, b, 500));
  }
  assert.equal(compareSamples([], [1]), null);
  assert.equal(compareSamples([1], []), null);
});

test("compareSamples golden values recorded before the move (seed 20261010)", () => {
  assert.deepEqual(compareSamples(...CASES[0]), { diff: 0.39, ci95: [0.08, 0.7], p: 0.1127, n: [4, 3] });
  assert.deepEqual(compareSamples(...CASES[0], 500), { diff: 0.39, ci95: [0.04, 0.7], p: 0.1198, n: [4, 3] });
  assert.deepEqual(compareSamples(...CASES[1]), { diff: 1, ci95: [1, 1], p: 0.0973, n: [3, 3] });
  assert.deepEqual(compareSamples(...CASES[2]), { diff: 0, ci95: [0, 0], p: 1, n: [1, 1] });
  assert.deepEqual(compareSamples(...CASES[3]), { diff: 2.5, ci95: [0.67, 4.3], p: 0.0586, n: [6, 5] });
});

test("stratifiedDelta on one cell equals the compareSamples difference and interval", () => {
  const [a, b] = CASES[3];
  const s = stratifiedDelta([{ framework: a, solo: b }], 10000);
  const c = compareSamples(a, b);
  assert.equal(+s.delta.toFixed(2), c.diff);
  assert.deepEqual(s.ci95.map((x) => +x.toFixed(2)), c.ci95);
});

test("stratifiedDelta is the mean over cells of framework mean minus solo mean", () => {
  const cells = [
    { framework: [1, 1, 1], solo: [0, 0, 0] },
    { framework: [0.5, 0.5, 0.5], solo: [0.5, 0.5, 0.5] },
  ];
  const s = stratifiedDelta(cells, 2000);
  assert.equal(s.delta, 0.5);
  assert.deepEqual(s.ci95, [0.5, 0.5]); // no within-cell variance: interval collapses
  assert.deepEqual(s.cells, 2);
});

test("stratifiedDelta resamples within task and arm, never across cells", () => {
  // Cell one is all-framework-wins, cell two is all-ties: every bootstrap draw has delta exactly 0.5
  // (pooling runs across cells would give a wider interval).
  const s = stratifiedDelta([
    { framework: [1, 1, 1], solo: [0, 0, 0] },
    { framework: [0.2, 0.2, 0.2], solo: [0.2, 0.2, 0.2] },
  ], 1000);
  assert.deepEqual(s.ci95, [0.5, 0.5]);
});

test("stratifiedDelta is deterministic and returns null with no usable cell", () => {
  const cells = [{ framework: [1, 0, 1], solo: [0, 0, 1] }, { framework: [0.5, 1, 0.75], solo: [0.25, 0.5, 0] }];
  assert.deepEqual(stratifiedDelta(cells, 500), stratifiedDelta(cells, 500));
  assert.equal(stratifiedDelta([], 100), null);
  assert.equal(stratifiedDelta([{ framework: [], solo: [1] }], 100), null);
});

test("adoptionDecision needs n >= 5 per arm, p < .05 and ci95 low > 0", () => {
  const big = [0.9, 0.95, 1, 0.85, 0.9, 1];
  const small = [0.1, 0.2, 0.15, 0.1, 0.2, 0.1];
  assert.equal(adoptionDecision(big, small).decision, "adopt");
  assert.equal(adoptionDecision(big.slice(0, 4), small).decision, "inconclusive"); // n=4
  assert.equal(adoptionDecision(big, small.slice(0, 4)).decision, "inconclusive");
  assert.equal(adoptionDecision(small, small.slice()).decision, "inconclusive"); // no gain
  assert.equal(adoptionDecision(small, big).decision, "inconclusive"); // negative gain is never adopted
  const r = adoptionDecision(big.slice(0, 4), small);
  assert.match(r.reason, /n >= 5/);
  assert.equal(adoptionDecision([], big).decision, "inconclusive");
});

test("stratifiedDelta keeps a run's components together: two identical cells of one task give the one-cell interval", () => {
  const fw = [0.9, 0.2, 0.7], so = [0.1, 0.4, 0.0];
  const one = stratifiedDelta([{ task: "t", framework: fw, solo: so }], 4000);
  const two = stratifiedDelta([{ task: "t", framework: fw, solo: so }, { task: "t", framework: fw, solo: so }], 4000);
  assert.deepEqual(two.ci95, one.ci95);
  // Independent draws per cell (different tasks) average out and narrow the interval.
  const apart = stratifiedDelta([{ task: "t1", framework: fw, solo: so }, { task: "t2", framework: fw, solo: so }], 4000);
  assert.ok(apart.ci95[1] - apart.ci95[0] < one.ci95[1] - one.ci95[0]);
});
