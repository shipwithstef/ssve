// Booking rules. Money is integer cents. A class: { id, startsAt, capacity, priceCents, waitlist: [] }.
import { CANCEL_CUTOFF_HOURS } from "./config.mjs";

export function createStore() {
  return { classes: new Map(), bookings: new Map(), nextId: 1 };
}

export function paidCount(store, classId) {
  let n = 0;
  for (const b of store.bookings.values()) if (b.classId === classId && b.status === "paid") n++;
  return n;
}

export async function book(store, payments, classId, userId) {
  const cls = store.classes.get(classId);
  if (!cls) throw new Error("no such class");
  if (paidCount(store, classId) >= cls.capacity) throw new Error("class full");
  cls.held = (cls.held || 0) + 1;
  try {
    if (paidCount(store, classId) + cls.held > cls.capacity) throw new Error("class full");
    const charge = await payments.charge(userId, cls.priceCents);
    const id = `b${store.nextId++}`;
    store.bookings.set(id, { id, classId, userId, chargeId: charge.id, amountCents: cls.priceCents, status: "paid" });
    return id;
  } finally {
    cls.held -= 1;
  }
}

export async function cancel(store, payments, bookingId, userId, now = Date.now()) {
  const b = store.bookings.get(bookingId);
  if (!b || b.userId !== userId || b.status !== "paid") throw new Error("no such booking");
  const cls = store.classes.get(b.classId);
  b.status = "cancelling";
  const refundable = cls.startsAt - now >= CANCEL_CUTOFF_HOURS * 3600000;
  if (refundable) await payments.refund(b.chargeId, b.amountCents);
  b.status = refundable ? "refunded" : "cancelled";
  await promoteFromWaitlist(store, payments, cls);
  return { refunded: refundable ? b.amountCents : 0 };
}

// Fill a freed seat from the waitlist: charge the first customer; if their charge fails,
// drop them and try the next, until a seat is filled or the waitlist is empty.
export async function promoteFromWaitlist(store, payments, cls) {
  while (cls.waitlist.length && paidCount(store, cls.id) < cls.capacity) {
    const userId = cls.waitlist.shift();
    try {
      await book(store, payments, cls.id, userId);
    } catch {
      break;
    }
  }
}
