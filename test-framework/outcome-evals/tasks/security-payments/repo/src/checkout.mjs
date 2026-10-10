// Checkout and refunds for class bookings. Payments go through a gateway client.
import { PRICES } from "./prices.mjs";

export async function checkout(db, gateway, user, body) {
  const cls = db.classes.get(body.classId);
  if (!cls) return { status: 404 };
  const amountCents = Number(body.amountCents ?? PRICES[cls.type]);
  const session = await gateway.createCheckout({ userId: user.id, classId: cls.id, amountCents });
  db.pending.set(session.id, { userId: user.id, classId: cls.id, amountCents });
  return { status: 200, url: session.url };
}

export async function refundBooking(db, gateway, user, bookingId) {
  const booking = db.bookings.get(bookingId);
  if (!booking || booking.status !== "paid") return { status: 404 };
  booking.status = "refunding";
  await gateway.refund(booking.chargeId);
  booking.status = "refunded";
  return { status: 200 };
}
