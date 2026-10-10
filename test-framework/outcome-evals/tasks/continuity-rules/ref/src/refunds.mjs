import { price } from "./pricing.mjs";
const H = 3600000;
export function refundFor(booking, cancelledAt) {
  const paid = price(booking.classType, booking.member);
  const lead = booking.startsAt - cancelledAt;
  if (lead >= 24 * H) return paid;
  if (lead >= 6 * H) return Math.floor(paid / 2);
  return 0;
}
