// Shared by the waitlist probes: the build's modules plus a gateway that records every charge.
import { dir, fail, load, pass } from "../../../graders/sk-probe.mjs";

export { dir, fail, load, pass };

export async function world({ capacity = 1, priceCents = 1500 } = {}) {
  const b = await load("src/bookings.mjs").catch((e) => fail(`src/bookings.mjs does not load: ${e.message}`));
  if (typeof b.joinWaitlist !== "function" || typeof b.cancel !== "function") fail("the waitlist feature is not in the build (joinWaitlist missing)");
  const store = b.createStore();
  const charges = []; const declined = new Set(); let n = 0;
  const payments = { declined, charges, async charge(userId, cents) { charges.push({ userId, cents }); await new Promise((r) => setImmediate(r)); if (declined.has(userId)) throw new Error("declined"); return { id: `ch${++n}`, userId, cents }; } };
  b.addClass(store, { id: "c1", capacity, priceCents });
  const paid = () => [...store.bookings.values()].filter((x) => x.status === "paid");
  return { b, store, payments, charges, declined, paid };
}
