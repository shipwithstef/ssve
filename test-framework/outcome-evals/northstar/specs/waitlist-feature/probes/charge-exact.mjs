// Money: a promoted customer is charged exactly the class price, exactly once; a declined
// customer is tried once, gets no booking and is not charged again.
import { fail, pass, world } from "./_lib.mjs";

const w = await world({ capacity: 1, priceCents: 1500 });
const first = await w.b.book(w.store, "c1", "u1", w.payments);
for (const u of ["u2", "u3", "u4"]) w.b.joinWaitlist(w.store, "c1", u);
w.declined.add("u2");
w.charges.length = 0;
await w.b.cancel(w.store, first, w.payments);

const tried = w.charges.map((c) => `${c.userId}:${c.cents}`);
if (JSON.stringify(tried) !== JSON.stringify(["u2:1500", "u3:1500"])) fail(`expected one charge of 1500 each for u2 then u3, got ${tried.join(", ") || "none"}`);
const owners = w.paid().map((x) => x.userId);
if (JSON.stringify(owners) !== JSON.stringify(["u3"])) fail(`expected only u3 booked, got ${owners.join(", ") || "nobody"}`);
if (w.store.bookings.size !== 2) fail(`a declined charge left a booking record (${w.store.bookings.size} bookings)`);
pass("promoted customers are charged the class price once; a declined charge books nobody");
