import test from "node:test";
import assert from "node:assert/strict";
import { createStore, addClass, book } from "../src/bookings.mjs";
import { fakeGateway } from "../src/payments.mjs";
test("a full class rejects bookings", async () => {
  const s = createStore(); const p = fakeGateway();
  addClass(s, { id: "c1", capacity: 1, priceCents: 1000 });
  await book(s, "c1", "u1", p);
  await assert.rejects(book(s, "c1", "u2", p), /full/);
});
