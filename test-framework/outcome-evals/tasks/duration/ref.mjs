const UNITS = [["d", 86400000], ["h", 3600000], ["m", 60000], ["s", 1000], ["ms", 1]];
export function parseDuration(text) {
  if (typeof text !== "string" || text === "") throw new RangeError("invalid");
  if (text === "0") return 0;
  let s = text, sign = 1;
  if (s[0] === "-") { sign = -1; s = s.slice(1); }
  const re = /^(\d+(?:\.\d+)?)(ms|d|h|m|s)/;
  let last = -1, total = 0, sawFraction = false;
  if (!s) throw new RangeError("invalid");
  while (s) {
    const m = re.exec(s);
    if (!m || sawFraction) throw new RangeError("invalid");
    const idx = UNITS.findIndex(([u]) => u === m[2]);
    if (idx <= last) throw new RangeError("invalid");
    last = idx;
    if (m[1].includes(".")) sawFraction = true;
    total += Number(m[1]) * UNITS[idx][1];
    s = s.slice(m[0].length);
  }
  const r = Math.round(Math.abs(total));
  const v = Math.abs(total) - Math.floor(Math.abs(total)) === 0.5 ? Math.floor(Math.abs(total)) + 1 : r;
  return sign * v;
}
