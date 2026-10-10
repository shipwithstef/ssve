import test from "node:test";
import assert from "node:assert/strict";
import { toCents, formatCents } from "../src/money.mjs";
import { Ledger } from "../src/ledger.mjs";
import { monthlySummary, formatSummary } from "../src/report.mjs";
const D = (s) => new Date(s);
test("money", () => {
  assert.equal(toCents("12.34"), 1234); assert.equal(toCents("-0.5"), -50); assert.equal(toCents("7"), 700);
  assert.equal(formatCents(-1205), "-12.05"); assert.throws(() => toCents("1.234"), TypeError);
});
test("balances and overdraft", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 1000, at: D("2026-01-05T00:00:00Z") });
  l.post({ account: "a", amount_cents: -2500, at: D("2026-01-10T00:00:00Z") });
  assert.equal(l.balance("a"), -1500, "overdraft is allowed");
  assert.equal(l.balance("a", D("2026-01-06T00:00:00Z")), 1000);
  assert.equal(l.balance("b"), 0);
});
test("validation", () => {
  const l = new Ledger();
  assert.throws(() => l.post({ account: "", amount_cents: 1, at: new Date() }), TypeError);
  assert.throws(() => l.post({ account: "a", amount_cents: 0, at: new Date() }), TypeError);
  assert.throws(() => l.post({ account: "a", amount_cents: 1.5, at: new Date() }), TypeError);
});
test("monthly summary", () => {
  const l = new Ledger();
  l.post({ account: "a", amount_cents: 10000, at: D("2026-01-01T00:00:00Z") });
  l.post({ account: "a", amount_cents: -2500, at: D("2026-01-31T23:59:59Z") });
  l.post({ account: "a", amount_cents: -1000, at: D("2026-02-01T00:00:00Z") });
  const rows = monthlySummary(l, "a", 2026);
  const pick = (r) => ({ month: r.month, credits: r.credits, debits: r.debits, closing: r.closing });
  assert.deepEqual(pick(rows[0]), { month: 1, credits: 10000, debits: 2500, closing: 7500 });
  assert.deepEqual(pick(rows[1]), { month: 2, credits: 0, debits: 1000, closing: 6500 });
  assert.equal(rows[11].closing, 6500);
  assert.equal(formatSummary(rows.slice(0, 1)), "01 +100.00 -25.00 = 75.00");
});
