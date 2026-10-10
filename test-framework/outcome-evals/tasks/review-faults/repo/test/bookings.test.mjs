import test from "node:test";
import assert from "node:assert/strict";
import { createStore, addClass, book, refund } from "../src/bookings.mjs";
import { sign, isOwner } from "../src/auth.mjs";

const payments = () => { const log = []; return { log, charge: async (u, c) => (log.push(["charge", u, c]), { id: `ch${log.length}` }), refund: async (id, c) => log.push(["refund", id, c]) }; };

test("book then refund once", async () => {
  const s = createStore(); const p = payments();
  addClass(s, { id: "c1", capacity: 2, priceCents: 1500 });
  const id = await book(s, "c1", "u1", p);
  assert.equal((await refund(s, id, "u1", p)).status, "refunded");
  await assert.rejects(refund(s, id, "u1", p));
});

test("a signed owner token is accepted", () => {
  assert.equal(isOwner(sign("ann", "owner", Date.now() + 60000)), true);
  assert.equal(isOwner(sign("bob", "customer", Date.now() + 60000)), false);
});
