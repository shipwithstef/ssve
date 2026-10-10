const LIMITS = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
function field(text, [lo, hi]) {
  const set = new Set();
  for (const item of text.split(",")) {
    const m = /^(\*|\d+|\d+-\d+)(?:\/(\d+))?$/.exec(item);
    if (!m) throw new RangeError("syntax");
    let a, b;
    if (m[1] === "*") { a = lo; b = hi; }
    else if (m[1].includes("-")) { [a, b] = m[1].split("-").map(Number); }
    else { a = Number(m[1]); b = m[2] ? hi : a; }
    const step = m[2] === undefined ? 1 : Number(m[2]);
    if (step < 1 || a < lo || b > hi || a > b) throw new RangeError("range");
    for (let v = a; v <= b; v += step) set.add(v);
  }
  return set;
}
export function nextCronRun(expr, from) {
  if (!(from instanceof Date) || Number.isNaN(from.getTime())) throw new RangeError("from");
  if (typeof expr !== "string") throw new RangeError("expr");
  const parts = expr.split(" ");
  if (parts.length !== 5) throw new RangeError("fields");
  const [mi, ho, dom, mo, dowRaw] = parts.map((p, i) => field(p, LIMITS[i]));
  const dow = new Set([...dowRaw].map((d) => d % 7));
  const domR = parts[2] !== "*", dowR = parts[4] !== "*";
  const t = new Date(from.getTime());
  t.setUTCSeconds(0, 0); t.setUTCMinutes(t.getUTCMinutes() + 1);
  const end = from.getTime() + 5 * 366 * 86400000;
  while (t.getTime() <= end) {
    if (!mo.has(t.getUTCMonth() + 1)) { t.setUTCMonth(t.getUTCMonth() + 1, 1); t.setUTCHours(0, 0); continue; }
    const dm = dom.has(t.getUTCDate()), dw = dow.has(t.getUTCDay());
    const dayOk = domR && dowR ? dm || dw : domR ? dm : dowR ? dw : true;
    if (!dayOk) { t.setUTCDate(t.getUTCDate() + 1); t.setUTCHours(0, 0); continue; }
    if (!ho.has(t.getUTCHours())) { t.setUTCHours(t.getUTCHours() + 1, 0); continue; }
    if (!mi.has(t.getUTCMinutes())) { t.setUTCMinutes(t.getUTCMinutes() + 1); continue; }
    return new Date(t.getTime());
  }
  throw new RangeError("no match");
}
