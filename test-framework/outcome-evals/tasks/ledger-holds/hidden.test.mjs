import test from "node:test";
import assert from "node:assert/strict";
import { toCents, formatCents } from "./src/money.mjs";
import { Ledger } from "./src/ledger.mjs";
import { monthlySummary, formatSummary } from "./src/report.mjs";
const D = (s) => new Date(s);
const insufficient = (fn) => assert.throws(fn, (e) => e && e.name === "InsufficientFunds");
test("regression: money", () => { assert.equal(toCents("12.34"), 1234); assert.equal(formatCents(-1205), "-12.05"); });
test("regression: overdraft without holds", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 1000, at: D("2026-01-05T00:00:00Z") });
  l.post({ account: "a", amount_cents: -2500, at: D("2026-01-10T00:00:00Z") });
  assert.equal(l.balance("a"), -1500);
});
test("regression: summary fields and format", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 10000, at: D("2026-01-01T00:00:00Z") });
  l.post({ account: "a", amount_cents: -2500, at: D("2026-01-31T23:59:59Z") });
  const rows = monthlySummary(l, "a", 2026);
  assert.deepEqual(rows[0], { month: 1, credits: 10000, debits: 2500, closing: 7500, held: 0 });
  assert.equal(formatSummary(rows.slice(0, 1)), "01 +100.00 -25.00 = 75.00");
});
test("holds: window is half-open and per account", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 1000, at: D("2026-01-01T00:00:00Z") });
  const id = l.hold({ account: "a", amount_cents: 300, at: D("2026-01-02T00:00:00Z"), until: D("2026-01-05T00:00:00Z") });
  assert.ok(Number.isInteger(id) && id > 0);
  assert.equal(l.available("a", D("2026-01-01T12:00:00Z")), 1000);
  assert.equal(l.available("a", D("2026-01-02T00:00:00Z")), 700);
  assert.equal(l.available("a", D("2026-01-04T23:59:59Z")), 700);
  assert.equal(l.available("a", D("2026-01-05T00:00:00Z")), 1000);
  assert.equal(l.available("b", D("2026-01-03T00:00:00Z")), 0);
  const id2 = l.hold({ account: "a", amount_cents: 100, at: D("2026-01-02T00:00:00Z"), until: D("2026-01-03T00:00:00Z") });
  assert.notEqual(id, id2);
  assert.equal(l.available("a", D("2026-01-02T06:00:00Z")), 600);
});
test("holds: validation", () => {
  const l = new Ledger(); const a = D("2026-01-01T00:00:00Z"), b = D("2026-01-02T00:00:00Z");
  for (const bad of [{ account: "", amount_cents: 1, at: a, until: b }, { account: "a", amount_cents: 0, at: a, until: b }, { account: "a", amount_cents: -5, at: a, until: b }, { account: "a", amount_cents: 1.5, at: a, until: b }, { account: "a", amount_cents: 1, at: b, until: a }, { account: "a", amount_cents: 1, at: a, until: a }, { account: "a", amount_cents: 1, at: "2026-01-01", until: b }]) assert.throws(() => l.hold(bad), TypeError, JSON.stringify(bad));
});
test("release", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 1000, at: D("2026-01-01T00:00:00Z") });
  const id = l.hold({ account: "a", amount_cents: 400, at: D("2026-01-02T00:00:00Z"), until: D("2026-01-10T00:00:00Z") });
  l.release(id, D("2026-01-04T00:00:00Z"));
  assert.equal(l.available("a", D("2026-01-03T00:00:00Z")), 600, "still active before release");
  assert.equal(l.available("a", D("2026-01-04T00:00:00Z")), 1000);
  l.release(id, D("2026-01-08T00:00:00Z"));
  assert.equal(l.available("a", D("2026-01-05T00:00:00Z")), 1000, "a later release does not revive it");
  assert.throws(() => l.release(999, D("2026-01-05T00:00:00Z")), RangeError);
});
test("debits against holds", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 1000, at: D("2026-01-01T00:00:00Z") });
  l.hold({ account: "a", amount_cents: 700, at: D("2026-01-02T00:00:00Z"), until: D("2026-01-10T00:00:00Z") });
  insufficient(() => l.post({ account: "a", amount_cents: -400, at: D("2026-01-03T00:00:00Z") }));
  assert.equal(l.balance("a"), 1000, "rejected debit not recorded");
  l.post({ account: "a", amount_cents: -300, at: D("2026-01-03T00:00:00Z") });
  assert.equal(l.available("a", D("2026-01-03T00:00:00Z")), 0);
  l.post({ account: "a", amount_cents: -5000, at: D("2026-01-11T00:00:00Z") });
  assert.equal(l.balance("a"), -4300, "no active hold: overdraft allowed again");
  l.post({ account: "a", amount_cents: 50, at: D("2026-01-05T00:00:00Z") });
  l.post({ account: "b", amount_cents: -10, at: D("2026-01-05T00:00:00Z") });
  assert.equal(l.balance("b"), -10, "other accounts unaffected");
});
test("summary held at month end", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 10000, at: D("2026-01-01T00:00:00Z") });
  l.hold({ account: "a", amount_cents: 200, at: D("2026-01-20T00:00:00Z"), until: D("2026-02-05T00:00:00Z") });
  l.hold({ account: "a", amount_cents: 50, at: D("2026-01-25T00:00:00Z"), until: D("2026-02-01T00:00:00Z") });
  l.hold({ account: "a", amount_cents: 70, at: D("2026-02-27T00:00:00Z"), until: D("2026-03-03T00:00:00Z") });
  const rows = monthlySummary(l, "a", 2026);
  assert.equal(rows[0].held, 250);
  assert.equal(rows[1].held, 70);
  assert.equal(rows[2].held, 0);
  assert.equal(formatSummary(rows.slice(0, 1)), "01 +100.00 -0.00 = 100.00");
});
