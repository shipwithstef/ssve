// Grader for the waitlist feature (a brownfield change with one easy-to-miss criterion,
// AC3: a declined charge must not stop the waitlist). Uses only the interface FEATURE.md states.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import * as b from "./src/bookings.mjs";
import { createServer } from "./src/server.mjs";
import { fakeGateway } from "./src/payments.mjs";

function full(capacity = 1) {
  const s = b.createStore(); const p = fakeGateway();
  b.addClass(s, { id: "c1", capacity, priceCents: 1500 });
  return { s, p };
}
const paid = (s) => [...s.bookings.values()].filter((x) => x.status === "paid");

test("AC1: joining is rejected while the class has space, allowed when full, once per user", async () => {
  const { s, p } = full(1);
  assert.throws(() => b.joinWaitlist(s, "c1", "u2"), /class has space/);
  await b.book(s, "c1", "u1", p);
  b.joinWaitlist(s, "c1", "u2"); b.joinWaitlist(s, "c1", "u2");
  assert.deepEqual(b.waitlistView(s, "c1"), [{ position: 1, userId: "u2" }]);
});

test("AC2: cancelling a paid booking charges and books the first waitlisted customer", async () => {
  const { s, p } = full(1);
  const id = await b.book(s, "c1", "u1", p);
  b.joinWaitlist(s, "c1", "u2"); b.joinWaitlist(s, "c1", "u3");
  await b.cancel(s, id, p);
  assert.deepEqual(paid(s).map((x) => x.userId), ["u2"]);
  assert.deepEqual(b.waitlistView(s, "c1"), [{ position: 1, userId: "u3" }]);
});

test("AC3: a declined charge drops that customer and the next one is tried", async () => {
  const { s, p } = full(1);
  const id = await b.book(s, "c1", "u1", p);
  for (const u of ["u2", "u3", "u4"]) b.joinWaitlist(s, "c1", u);
  p.declined.add("u2"); p.declined.add("u3");
  await b.cancel(s, id, p);
  assert.deepEqual(paid(s).map((x) => x.userId), ["u4"]);
  assert.deepEqual(b.waitlistView(s, "c1"), []);
});

test("AC3: when every waitlisted charge fails, the waitlist empties and nobody is booked", async () => {
  const { s, p } = full(1);
  const id = await b.book(s, "c1", "u1", p);
  b.joinWaitlist(s, "c1", "u2"); p.declined.add("u2");
  await b.cancel(s, id, p);
  assert.equal(paid(s).length, 0);
  assert.deepEqual(b.waitlistView(s, "c1"), []);
});

test("AC4: leaving removes the customer and is a no-op when absent", async () => {
  const { s, p } = full(1);
  await b.book(s, "c1", "u1", p);
  b.joinWaitlist(s, "c1", "u2"); b.joinWaitlist(s, "c1", "u3");
  b.leaveWaitlist(s, "c1", "u2"); b.leaveWaitlist(s, "c1", "nobody");
  assert.deepEqual(b.waitlistView(s, "c1"), [{ position: 1, userId: "u3" }]);
});

test("AC5: GET /classes/:id/waitlist returns the waitlist in order", async () => {
  const { s, p } = full(1);
  await b.book(s, "c1", "u1", p);
  b.joinWaitlist(s, "c1", "u2"); b.joinWaitlist(s, "c1", "u3");
  const server = createServer(s, p);
  await new Promise((r) => server.listen(0, r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/classes/c1/waitlist`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), [{ position: 1, userId: "u2" }, { position: 2, userId: "u3" }]);
  } finally { server.close(); }
});

test("existing behaviour: the repository's own tests still pass", () => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const files = fs.readdirSync("test").filter((f) => f.endsWith(".test.mjs")).map((f) => `test/${f}`);
  const r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...files], { encoding: "utf8", env });
  assert.equal(r.status, 0, r.stdout.slice(-600));
});
