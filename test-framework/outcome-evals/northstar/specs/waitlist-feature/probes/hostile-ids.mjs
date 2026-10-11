// Data integrity: customer and class ids are data. Object-prototype names must not break
// the waitlist or leak between customers.
import { fail, pass, world } from "./_lib.mjs";

const w = await world({ capacity: 1, priceCents: 1500 });
await w.b.book(w.store, "c1", "u1", w.payments);
const ids = ["__proto__", "constructor", "toString", "hasOwnProperty"];
try { for (const u of ids) w.b.joinWaitlist(w.store, "c1", u); } catch (e) { fail(`joining as ${ids.join("/")} threw: ${e.message}`); }
const view = w.b.waitlistView(w.store, "c1").map((x) => x.userId);
if (JSON.stringify(view) !== JSON.stringify(ids)) fail(`waitlist for hostile ids is ${JSON.stringify(view)}`);
try { w.b.joinWaitlist(w.store, "__proto__", "u9"); fail("joining a class named __proto__ succeeded"); } catch (e) { if (!/no such class|class/i.test(e.message)) fail(`unexpected error for a hostile class id: ${e.message}`); }
if ({}.u9 !== undefined || Object.prototype.u9 !== undefined) fail("object prototype polluted");
pass("hostile ids are plain data");
