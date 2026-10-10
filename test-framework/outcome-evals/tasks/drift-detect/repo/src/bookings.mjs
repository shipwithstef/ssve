const MAX_UPCOMING = 3;
const NO_REFUND_WINDOW_MS = 2 * 60 * 60 * 1000;

export function canBook(bookings, userId, now = Date.now()) {
  const upcoming = bookings.filter((b) => b.userId === userId && b.status === "paid" && b.startsAt > now).length;
  return upcoming < MAX_UPCOMING;
}

export function refundOnCancel(booking, now = Date.now()) {
  return booking.startsAt - now < NO_REFUND_WINDOW_MS ? 0 : booking.price;
}

export function priceFor(classType) {
  return { flow: 18.5, yin: 16, private: 90 }[classType];
}
