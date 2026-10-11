import test from "node:test";
import assert from "node:assert/strict";
import { createStore, addClass, book, cancel, joinWaitlist, leaveWaitlist, waitlistView, paidCount } from "../src/bookings.mjs";
import { fakeGateway } from "../src/payments.mjs";
import { createServer } from "../src/server.mjs";

async function full(capacity = 1) {
  const s = createStore(), p = fakeGateway();
  addClass(s, { id: "c1", capacity, priceCents: 1500 });
  const ids = [];
  for (let i = 0; i < capacity; i++) ids.push(await book(s, "c1", `u${i + 1}`, p));
  return { s, p, ids };
}

test("waitlist: joining is refused while the class has space and kept to one entry", async () => {
  const s = createStore(), p = fakeGateway();
  addClass(s, { id: "c1", capacity: 1, priceCents: 1500 });
  assert.throws(() => joinWaitlist(s, "c1", "u2"), /class has space/);
  await book(s, "c1", "u1", p);
  joinWaitlist(s, "c1", "u2"); joinWaitlist(s, "c1", "u2");
  assert.deepEqual(waitlistView(s, "c1"), [{ position: 1, userId: "u2" }]);
});

test("waitlist: cancelling charges and books the first customer in line", async () => {
  const { s, p, ids } = await full(1);
  joinWaitlist(s, "c1", "u2"); joinWaitlist(s, "c1", "u3");
  await cancel(s, ids[0], p);
  assert.equal(paidCount(s, "c1"), 1);
  assert.deepEqual([...s.bookings.values()].filter((b) => b.status === "paid").map((b) => b.userId), ["u2"]);
  assert.deepEqual(waitlistView(s, "c1"), [{ position: 1, userId: "u3" }]);
});

test("waitlist: a declined card drops that customer and the next is tried", async () => {
  const { s, p, ids } = await full(1);
  for (const u of ["u2", "u3", "u4"]) joinWaitlist(s, "c1", u);
  p.declined.add("u2"); p.declined.add("u3");
  await cancel(s, ids[0], p);
  assert.deepEqual([...s.bookings.values()].filter((b) => b.status === "paid").map((b) => b.userId), ["u4"]);
  assert.deepEqual(waitlistView(s, "c1"), []);
});

test("waitlist: leaving removes the customer and is a no-op when absent", async () => {
  await full(1).then(({ s }) => {
    joinWaitlist(s, "c1", "u2"); joinWaitlist(s, "c1", "u3");
    leaveWaitlist(s, "c1", "u2"); leaveWaitlist(s, "c1", "nobody");
    assert.deepEqual(waitlistView(s, "c1"), [{ position: 1, userId: "u3" }]);
  });
});

test("waitlist: only as many customers are promoted as seats were freed", async () => {
  const { s, p, ids } = await full(2);
  for (const u of ["u3", "u4", "u5"]) joinWaitlist(s, "c1", u);
  await cancel(s, ids[0], p);
  assert.equal(paidCount(s, "c1"), 2);
  assert.equal(waitlistView(s, "c1").length, 2);
});

test("waitlist: an unknown class is rejected, not crashed on", async () => {
  const s = createStore();
  assert.throws(() => joinWaitlist(s, "nope", "u1"), /no such class/);
});

test("waitlist: GET /classes/:id/waitlist returns the list in order and 4xx for a stranger", async () => {
  const { s, p } = await full(1);
  joinWaitlist(s, "c1", "u2"); joinWaitlist(s, "c1", "u3");
  const server = createServer(s, p);
  await new Promise((r) => server.listen(0, r));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const ok = await fetch(`${base}/classes/c1/waitlist`);
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), [{ position: 1, userId: "u2" }, { position: 2, userId: "u3" }]);
    assert.equal((await fetch(`${base}/classes/nope/waitlist`)).status, 400);
  } finally { server.close(); }
});
