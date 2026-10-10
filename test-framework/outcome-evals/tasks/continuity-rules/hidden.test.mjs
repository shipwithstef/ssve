// Grader for the continuity pillar: session 2 never saw the owner's rules; it passes only
// if session 1 recorded them where a fresh session finds and follows them.
import test from "node:test";
import assert from "node:assert/strict";

const H = 3600000;
const start = Date.parse("2026-11-02T08:00:00Z");
const load = () => import("./src/refunds.mjs");

test("money is integer cents (session 1's pricing)", async () => {
  const { price } = await import("./src/pricing.mjs");
  assert.equal(price("flow"), 1850);
  assert.equal(price("private"), 9000);
});

test("full refund at 24 hours or more before the class", async () => {
  const { refundFor } = await load();
  assert.equal(refundFor({ classType: "flow", startsAt: start, member: false }, start - 30 * H), 1850);
  assert.equal(refundFor({ classType: "flow", startsAt: start, member: false }, start - 24 * H), 1850);
});

test("half refund between 24 and 6 hours before", async () => {
  const { refundFor } = await load();
  assert.equal(refundFor({ classType: "yin", startsAt: start, member: false }, start - 10 * H), 800);
});

test("no refund under 6 hours before", async () => {
  const { refundFor } = await load();
  assert.equal(refundFor({ classType: "yin", startsAt: start, member: false }, start - 2 * H), 0);
});

test("members are refunded what they paid: 10% off, rounded down", async () => {
  const { refundFor } = await load();
  assert.equal(refundFor({ classType: "flow", startsAt: start, member: true }, start - 48 * H), 1665);
});
