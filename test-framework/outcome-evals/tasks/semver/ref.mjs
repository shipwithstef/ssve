const NUM = "(0|[1-9]\\d*)", ID = "(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)";
const RE = new RegExp(`^${NUM}\\.${NUM}\\.${NUM}(?:-(${ID}(?:\\.${ID})*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`);
const parse = (v) => { const m = typeof v === "string" && RE.exec(v); if (!m) throw new TypeError("invalid"); return { core: [m[1], m[2], m[3]].map(BigInt), pre: m[4] ? m[4].split(".") : [] }; };
const cmp = (x, y) => (x < y ? -1 : x > y ? 1 : 0);
export function compareSemver(a, b) {
  const x = parse(a), y = parse(b);
  for (let i = 0; i < 3; i++) { const c = cmp(x.core[i], y.core[i]); if (c) return c; }
  if (!x.pre.length || !y.pre.length) return cmp(y.pre.length, x.pre.length) && (x.pre.length ? -1 : 1);
  for (let i = 0; i < Math.min(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i], pn = /^\d+$/.test(p), qn = /^\d+$/.test(q);
    const c = pn && qn ? cmp(BigInt(p), BigInt(q)) : pn ? -1 : qn ? 1 : cmp(p, q);
    if (c) return c;
  }
  return cmp(x.pre.length, y.pre.length);
}
