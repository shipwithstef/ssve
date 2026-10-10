import test from "node:test";
import assert from "node:assert/strict";
import { mergeIntervals as m } from "./solution.mjs";
test("merging", () => {
  assert.deepEqual(m([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]]);
  assert.deepEqual(m([[1, 4], [4, 5]]), [[1, 5]]);
  assert.deepEqual(m([[1, 10], [2, 3], [4, 5]]), [[1, 10]]);
  assert.deepEqual(m([[-5, -1], [-1, 0]]), [[-5, 0]]);
  assert.deepEqual(m([[0.5, 1.5], [1.5, 2]]), [[0.5, 2]]);
});
test("empty intervals drop and never bridge", () => {
  assert.deepEqual(m([[1, 2], [3, 3], [3, 4]]), [[1, 2], [3, 4]]);
  assert.deepEqual(m([[2, 2]]), []);
  assert.deepEqual(m([[1, 2], [2, 2], [4, 5]]), [[1, 2], [4, 5]]);
});
test("does not mutate input", () => {
  const input = [[3, 4], [1, 3]];
  const copy = JSON.parse(JSON.stringify(input));
  const out = m(input);
  assert.deepEqual(input, copy);
  out[0][1] = 99;
  assert.deepEqual(input, copy, "returned arrays are new");
});
test("errors", () => {
  for (const x of [[[3, 1]], [[1, NaN]], [[1, Infinity]], [[1]], [[1, 2, 3]], ["ab"], [null], [[1, "2"]]]) assert.throws(() => m(x), RangeError, JSON.stringify(x));
  assert.throws(() => m(null), TypeError);
  assert.throws(() => m("x"), TypeError);
});
