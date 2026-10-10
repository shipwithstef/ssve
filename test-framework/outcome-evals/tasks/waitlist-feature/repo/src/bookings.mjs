// Bookings for a class studio. Money is integer cents.
export function createStore() { return { classes: new Map(), bookings: new Map(), nextId: 1 }; }
export function addClass(store, cls) { store.classes.set(cls.id, { ...cls }); }
export function paidCount(store, classId) { return [...store.bookings.values()].filter((b) => b.classId === classId && b.status === "paid").length; }
export async function book(store, classId, userId, payments) {
  const cls = store.classes.get(classId);
  if (!cls) throw new Error("no such class");
  if (paidCount(store, classId) >= cls.capacity) throw new Error("class full");
  const ch = await payments.charge(userId, cls.priceCents);
  const id = `b${store.nextId++}`;
  store.bookings.set(id, { id, classId, userId, chargeId: ch.id, status: "paid" });
  return id;
}
export async function cancel(store, bookingId, payments) {
  const b = store.bookings.get(bookingId);
  if (!b || b.status !== "paid") throw new Error("not cancellable");
  b.status = "cancelled";
}
