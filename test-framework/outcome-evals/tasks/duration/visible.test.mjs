import test from "node:test";
import assert from "node:assert/strict";
import { parseDuration } from "./solution.mjs";
test("basic components", () => {
  assert.equal(parseDuration("1h30m"), 5400000);
  assert.equal(parseDuration("250ms"), 250);
  assert.equal(parseDuration("-2s"), -2000);
});
test("order is enforced", () => { assert.throws(() => parseDuration("30m1h"), RangeError); });
test("zero", () => { assert.equal(parseDuration("0"), 0); });
