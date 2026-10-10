// Calendar helpers shared by the schedule and the trial rules.
export function dayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

export function formatTime(ts, tz) {
  return new Intl.DateTimeFormat("en-AU", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(ts));
}
