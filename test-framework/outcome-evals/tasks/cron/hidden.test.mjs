import test from "node:test";
import assert from "node:assert/strict";
import { nextCronRun as n } from "./solution.mjs";
const at = (e, f) => n(e, new Date(f)).toISOString();
const F = "2026-03-14T09:26:53.589Z"; // a Saturday
test("basics", () => {
  assert.equal(at("* * * * *", F), "2026-03-14T09:27:00.000Z");
  assert.equal(at("30 9 * * *", F), "2026-03-14T09:30:00.000Z");
  assert.equal(at("0 0 1 * *", F), "2026-04-01T00:00:00.000Z");
  assert.equal(at("0 0 1 1 *", F), "2027-01-01T00:00:00.000Z");
  assert.equal(at("5/20 * * * *", F), "2026-03-14T09:45:00.000Z");
  assert.equal(at("10-30/10 * * * *", "2026-03-14T09:31:00Z"), "2026-03-14T10:10:00.000Z");
  assert.equal(at("0,30 8-10 * * *", F), "2026-03-14T09:30:00.000Z");
});
test("day of week, sunday as 0 and 7", () => {
  assert.equal(at("0 9 * * 0", F), "2026-03-15T09:00:00.000Z");
  assert.equal(at("0 9 * * 7", F), "2026-03-15T09:00:00.000Z");
  assert.equal(at("0 9 * * 1-5", F), "2026-03-16T09:00:00.000Z");
});
test("dom OR dow when both restricted", () => {
  assert.equal(at("0 0 13 * 5", "2026-03-14T00:00:00Z"), "2026-03-20T00:00:00.000Z");
  assert.equal(at("0 0 16 * 5", "2026-03-14T00:00:00Z"), "2026-03-16T00:00:00.000Z");
  assert.equal(at("0 0 */10 * 1", "2026-03-14T00:00:00Z"), "2026-03-16T00:00:00.000Z");
  assert.equal(at("0 0 * * 1", "2026-03-14T00:00:00Z"), "2026-03-16T00:00:00.000Z");
});
test("month and leap days", () => {
  assert.equal(at("0 0 29 2 *", F), "2028-02-29T00:00:00.000Z");
  assert.equal(at("0 0 31 * *", "2026-04-01T00:00:00Z"), "2026-05-31T00:00:00.000Z");
  assert.equal(at("59 23 31 12 *", F), "2026-12-31T23:59:00.000Z");
});
test("errors", () => {
  const d = new Date(F);
  for (const e of ["* * * *", "* * * * * *", "60 * * * *", "* 24 * * *", "* * 0 * *", "* * 32 * *", "* * * 13 *", "* * * * 8", "5-1 * * * *", "*/0 * * * *", "MON * * * *", "* * * JAN *", "1,,2 * * * *", "*  * * * *", " * * * * *", "-1 * * * *", "1.5 * * * *"]) assert.throws(() => n(e, d), RangeError, e);
  assert.throws(() => n("0 0 30 2 *", d), RangeError, "never matches");
  assert.throws(() => n("* * * * *", "2026-01-01"), RangeError);
  assert.throws(() => n("* * * * *", new Date("nope")), RangeError);
});
