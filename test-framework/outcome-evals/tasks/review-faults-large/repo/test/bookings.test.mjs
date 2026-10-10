import test from "node:test";
import assert from "node:assert/strict";
import { createStore, book, cancel } from "../src/bookings.mjs";
import { revenueByDay } from "../src/reports.mjs";

const gateway = () => ({ n: 0, async charge() { return { id: `ch${++this.n}` }; }, async refund() {} });
const H = 3600000;

test("book, cancel early for a refund, and the waitlist fills the seat", async () => {
  const s = createStore(); const p = gateway(); const now = Date.parse("2026-11-01T00:00:00Z");
  s.classes.set("c1", { id: "c1", startsAt: now + 48 * H, capacity: 1, priceCents: 1850, waitlist: ["u2"] });
  const id = await book(s, p, "c1", "u1");
  assert.deepEqual(await cancel(s, p, id, "u1", now), { refunded: 1850 });
  assert.equal([...s.bookings.values()].filter((b) => b.status === "paid")[0].userId, "u2");
});

test("revenue per studio day", async () => {
  const s = createStore(); const p = gateway();
  s.classes.set("c1", { id: "c1", startsAt: Date.parse("2026-11-02T03:00:00Z"), capacity: 5, priceCents: 1850, waitlist: [] });
  await book(s, p, "c1", "u1"); await book(s, p, "c1", "u2");
  assert.deepEqual(revenueByDay(s), { "2026-11-02": 3700 });
});
