import test from "node:test";
import assert from "node:assert/strict";
import { parseDuration as p } from "./solution.mjs";
const bad = (x) => assert.throws(() => p(x), RangeError, JSON.stringify(x));
test("valid", () => {
  assert.equal(p("1d"), 86400000);
  assert.equal(p("1h30m"), 5400000);
  assert.equal(p("1d2h3m4s5ms"), 93784005);
  assert.equal(p("1.5h"), 5400000);
  assert.equal(p("1m1.5s"), 61500);
  assert.equal(p("0"), 0);
  assert.equal(p("0s"), 0);
  assert.equal(p("-1m"), -60000);
  assert.equal(p("10ms"), 10);
  assert.equal(p("2m10ms"), 120010);
});
test("rounding halves away from zero", () => {
  assert.equal(p("0.5ms"), 1);
  assert.equal(p("-0.5ms"), -1);
  assert.equal(p("2.5ms"), 3);
  assert.equal(p("0.25ms"), 0);
  assert.equal(p("1s0.75ms"), 1001);
});
test("ms is not m then s", () => { assert.equal(p("5ms"), 5); assert.equal(p("1m5ms"), 60005); });
test("invalid", () => {
  for (const x of ["", "h", "1", "5", "-", "--1s", "+1s", "1 h", " 1h", "1h ", "30m1h", "1m1m", "1s1m", "1.5h30m", ".5h", "1.h", "1H", "1y", "1hh", "1h-30m", "0h0", "1e3s"]) bad(x);
  bad(null); bad(5); bad(undefined);
});
