// Data integrity: cancelling the same booking twice at once frees one seat, not two.
import { fail, pass, world } from "./_lib.mjs";

const w = await world({ capacity: 1, priceCents: 1500 });
const id = await w.b.book(w.store, "c1", "u1", w.payments);
for (const u of ["u2", "u3"]) w.b.joinWaitlist(w.store, "c1", u);
w.charges.length = 0;
await Promise.allSettled([w.b.cancel(w.store, id, w.payments), w.b.cancel(w.store, id, w.payments)]);
const owners = w.paid().map((x) => x.userId);
if (owners.length !== 1) fail(`one seat was freed but ${owners.length} customers hold a paid booking`);
if (w.charges.length !== 1) fail(`one seat was freed but ${w.charges.length} charges were made`);
pass("a double cancel frees one seat");
