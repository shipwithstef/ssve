// Calendar helpers shared by the schedule and the trial rules.
import { STUDIO_TZ } from "./config.mjs";

// The studio-local calendar date (YYYY-MM-DD) of a timestamp, honouring daylight saving.
export function dayKey(ts, tz = STUDIO_TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

export function formatTime(ts, tz) {
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
}
