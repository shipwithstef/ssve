import test from "node:test";
import assert from "node:assert/strict";
import { createStore, issue, redeem } from "../src/giftcards.mjs";

const ledger = { record: async () => {} };

test("issues a card", () => {
  const s = createStore();
  const code = issue(s, 5000);
  assert.match(code, /^[0-9A-F]{12}$/);
  assert.equal(s.get(code).balanceCents, 5000);
});

test("redeem keeps the remainder", async () => {
  const s = createStore(); const code = issue(s, 5000);
  assert.equal(await redeem(s, code, 1850, ledger), 0);
  assert.equal(s.get(code).balanceCents, 3150);
});

test("expired cards are rejected", async () => {
  const s = createStore(); const code = issue(s, 5000, Date.parse("2025-01-01"));
  await assert.rejects(redeem(s, code, 1000, ledger, Date.parse("2025-06-01")).then(() => { throw new Error("expired"); }));
});

test("concurrent redemptions", async () => {
  const s = createStore(); const code = issue(s, 2000);
  await Promise.all([redeem(s, code, 1500, ledger), redeem(s, code, 1500, ledger)]);
  assert.ok(true);
});

test("unknown code", async () => {
  await assert.rejects(redeem(createStore(), "NOPE", 100, ledger), /unknown gift card/);
});
