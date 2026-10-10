// Each customer may take one free trial class per studio day.
import { dayKey } from "./dates.mjs";

export function canUseTrial(bookings, userId, classStartsAt) {
  return !bookings.some((b) => b.userId === userId && b.trial && dayKey(b.startsAt) === dayKey(classStartsAt));
}
