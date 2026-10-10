// A fresh session without the owner's rules: a common default policy.
import { price } from "./pricing.mjs";
export function refundFor(booking, cancelledAt) {
  return booking.startsAt - cancelledAt >= 24 * 3600000 ? price(booking.classType) : 0;
}
