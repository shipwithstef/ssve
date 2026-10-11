// Data integrity: two cancellations racing with a long waitlist must fill each freed seat
// exactly once. Capacity is never exceeded and nobody is booked or charged twice.
import { fail, pass, world } from "./_lib.mjs";

const w = await world({ capacity: 2, priceCents: 1500 });
const a = await w.b.book(w.store, "c1", "u1", w.payments);
const b2 = await w.b.book(w.store, "c1", "u2", w.payments);
for (const u of ["u3", "u4", "u5", "u6"]) w.b.joinWaitlist(w.store, "c1", u);
w.charges.length = 0;
await Promise.allSettled([w.b.cancel(w.store, a, w.payments), w.b.cancel(w.store, b2, w.payments)]);

const owners = w.paid().map((x) => x.userId);
if (owners.length > 2) fail(`overbooked: ${owners.length} paid bookings in a class of 2`);
if (new Set(owners).size !== owners.length) fail(`a customer holds two seats: ${owners.join(", ")}`);
const per = {}; for (const c of w.charges) per[c.userId] = (per[c.userId] || 0) + 1;
const twice = Object.entries(per).filter(([, n]) => n > 1).map(([u]) => u);
if (twice.length) fail(`charged more than once: ${twice.join(", ")}`);
if (owners.length !== 2) fail(`expected both freed seats filled, got ${owners.length}`);
pass("racing cancellations fill each seat once and never overbook");
