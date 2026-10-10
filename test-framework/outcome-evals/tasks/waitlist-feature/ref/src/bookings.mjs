// Bookings for a class studio. Money is integer cents.
export function createStore() { return { classes: new Map(), bookings: new Map(), nextId: 1 }; }
export function addClass(store, cls) { store.classes.set(cls.id, { waitlist: [], ...cls }); }
export function paidCount(store, classId) { return [...store.bookings.values()].filter((b) => b.classId === classId && b.status === "paid").length; }

function requireClass(store, classId) {
  const cls = store.classes.get(classId);
  if (!cls) throw new Error("no such class");
  cls.waitlist ??= [];
  return cls;
}

export async function book(store, classId, userId, payments) {
  const cls = requireClass(store, classId);
  if (paidCount(store, classId) >= cls.capacity) throw new Error("class full");
  const ch = await payments.charge(userId, cls.priceCents);
  const id = `b${store.nextId++}`;
  store.bookings.set(id, { id, classId, userId, chargeId: ch.id, status: "paid" });
  return id;
}

export function joinWaitlist(store, classId, userId) {
  const cls = requireClass(store, classId);
  if (paidCount(store, classId) < cls.capacity) throw new Error("class has space");
  if (!cls.waitlist.includes(userId)) cls.waitlist.push(userId);
}

export function leaveWaitlist(store, classId, userId) {
  const cls = requireClass(store, classId);
  cls.waitlist = cls.waitlist.filter((u) => u !== userId);
}

export function waitlistView(store, classId) {
  return requireClass(store, classId).waitlist.map((userId, i) => ({ position: i + 1, userId }));
}

export async function cancel(store, bookingId, payments) {
  const b = store.bookings.get(bookingId);
  if (!b || b.status !== "paid") throw new Error("not cancellable");
  b.status = "cancelled";
  const cls = requireClass(store, b.classId);
  while (cls.waitlist.length && paidCount(store, cls.id) < cls.capacity) {
    const userId = cls.waitlist.shift();
    try { await book(store, cls.id, userId, payments); } catch { /* declined: try the next customer */ }
  }
}
