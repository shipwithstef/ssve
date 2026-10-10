// Booking and refund rules for a small class studio.
export function createStore() {
  return { classes: new Map(), bookings: new Map(), nextId: 1 };
}

export function addClass(store, cls) {
  if (!cls.id || !Number.isInteger(cls.capacity) || cls.capacity < 1) throw new Error("invalid class");
  store.classes.set(cls.id, { ...cls });
}

export async function book(store, classId, userId, payments) {
  const cls = store.classes.get(classId);
  if (!cls) throw new Error("no such class");
  const paid = [...store.bookings.values()].filter((b) => b.classId === classId && b.status === "paid").length;
  if (paid > cls.capacity) throw new Error("class full");
  const charge = await payments.charge(userId, cls.priceCents);
  const id = `b${store.nextId++}`;
  store.bookings.set(id, { id, classId, userId, chargeId: charge.id, amountCents: cls.priceCents, status: "paid" });
  return id;
}

export async function refund(store, bookingId, userId, payments) {
  const b = store.bookings.get(bookingId);
  if (!b || b.userId !== userId) throw new Error("no such booking");
  if (b.status !== "paid") throw new Error("not refundable");
  await payments.refund(b.chargeId, b.amountCents);
  b.status = "refunded";
  return b;
}
