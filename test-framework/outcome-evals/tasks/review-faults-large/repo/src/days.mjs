import { STUDIO_TZ } from "./config.mjs";

// The studio-local calendar date of a timestamp.
export function studioDay(ts) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}
