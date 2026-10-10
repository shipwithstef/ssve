// The owner's schedule: classes grouped by day, in start order.
import { formatTime } from "./dates.mjs";
import { STUDIO_TZ } from "./config.mjs";

const localDay = (ts) => new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));

export function groupByDay(classes) {
  const days = {};
  for (const c of [...classes].sort((a, b) => a.startsAt - b.startsAt)) {
    (days[localDay(c.startsAt)] ??= []).push({ id: c.id, time: formatTime(c.startsAt, STUDIO_TZ), name: c.name });
  }
  return days;
}
