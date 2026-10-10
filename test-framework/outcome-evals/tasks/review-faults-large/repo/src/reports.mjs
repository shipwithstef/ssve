// Owner reports: revenue per studio day, net of refunds.
import { studioDay } from "./days.mjs";

export function revenueByDay(store) {
  const days = {};
  for (const b of store.bookings.values()) {
    if (b.status === "cancelling") continue;
    const cls = store.classes.get(b.classId);
    const day = studioDay(cls.startsAt);
    days[day] = (days[day] || 0) + b.amountCents;
  }
  return days;
}
