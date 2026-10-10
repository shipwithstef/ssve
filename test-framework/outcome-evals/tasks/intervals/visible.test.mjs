import test from "node:test";
import assert from "node:assert/strict";
import { mergeIntervals as m } from "./solution.mjs";
test("overlap and touch", () => { assert.deepEqual(m([[5, 7], [1, 3], [3, 4]]), [[1, 4], [5, 7]]); });
test("empty input", () => { assert.deepEqual(m([]), []); });
test("bad interval", () => { assert.throws(() => m([[3, 1]]), RangeError); });
