export function mergeIntervals(list) {
  if (!Array.isArray(list)) throw new TypeError("not an array");
  for (const iv of list) {
    if (!Array.isArray(iv) || iv.length !== 2 || !iv.every((n) => typeof n === "number" && Number.isFinite(n)) || iv[0] > iv[1]) throw new RangeError("bad interval");
  }
  const xs = list.filter(([a, b]) => a < b).map(([a, b]) => [a, b]).sort((p, q) => p[0] - q[0]);
  const out = [];
  for (const [a, b] of xs) {
    const last = out.at(-1);
    if (last && a <= last[1]) last[1] = Math.max(last[1], b); else out.push([a, b]);
  }
  return out;
}
