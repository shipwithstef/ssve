// The owner's schedule: classes grouped by day, in start order.
import { dayKey, formatTime } from "./dates.mjs";
import { STUDIO_TZ } from "./config.mjs";

export function groupByDay(classes) {
  const days = {};
  for (const c of [...classes].sort((a, b) => a.startsAt - b.startsAt)) {
    (days[dayKey(c.startsAt)] ??= []).push({ id: c.id, time: formatTime(c.startsAt, STUDIO_TZ), name: c.name });
  }
  return days;
}
