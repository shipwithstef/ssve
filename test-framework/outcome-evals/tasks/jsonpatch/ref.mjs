class PatchError extends Error { constructor(m) { super(m); this.name = "PatchError"; } }
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
function tokens(ptr) {
  if (typeof ptr !== "string") throw new PatchError("pointer");
  if (ptr === "") return [];
  if (ptr[0] !== "/") throw new PatchError("pointer");
  return ptr.slice(1).split("/").map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
}
const isIdx = (t) => /^(0|[1-9]\d*)$/.test(t);
function parentOf(root, toks) {
  let cur = root;
  for (const t of toks.slice(0, -1)) {
    if (Array.isArray(cur)) { if (!isIdx(t) || +t >= cur.length) throw new PatchError("missing"); cur = cur[+t]; }
    else if (cur && typeof cur === "object") { if (!Object.hasOwn(cur, t)) throw new PatchError("missing"); cur = cur[t]; }
    else throw new PatchError("missing");
  }
  return cur;
}
function get(root, toks) {
  if (!toks.length) return root;
  const p = parentOf(root, toks), k = toks.at(-1);
  if (Array.isArray(p)) { if (!isIdx(k) || +k >= p.length) throw new PatchError("missing"); return p[+k]; }
  if (p && typeof p === "object" && Object.hasOwn(p, k)) return p[k];
  throw new PatchError("missing");
}
function add(root, toks, value) {
  if (!toks.length) return value;
  const p = parentOf(root, toks), k = toks.at(-1);
  if (Array.isArray(p)) {
    if (k === "-") p.push(value);
    else { if (!isIdx(k) || +k > p.length) throw new PatchError("index"); p.splice(+k, 0, value); }
  } else if (p && typeof p === "object") p[k] = value;
  else throw new PatchError("missing");
  return root;
}
function remove(root, toks) {
  if (!toks.length) throw new PatchError("remove root");
  const p = parentOf(root, toks), k = toks.at(-1);
  if (Array.isArray(p)) { if (!isIdx(k) || +k >= p.length) throw new PatchError("missing"); p.splice(+k, 1); }
  else if (p && typeof p === "object" && Object.hasOwn(p, k)) delete p[k];
  else throw new PatchError("missing");
  return root;
}
function equal(a, b) {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => equal(x, b[i]));
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
export function applyPatch(doc, patch) {
  if (!Array.isArray(patch)) throw new PatchError("patch");
  let root = clone(doc);
  for (const op of patch) {
    if (!op || typeof op !== "object" || typeof op.op !== "string") throw new PatchError("op");
    const toks = tokens(op.path);
    const need = (k) => { if (!Object.hasOwn(op, k)) throw new PatchError(`missing ${k}`); return op[k]; };
    switch (op.op) {
      case "add": root = add(root, toks, clone(need("value"))); break;
      case "remove": root = remove(root, toks); break;
      case "replace": { const v = clone(need("value")); get(root, toks); root = toks.length ? add(remove(root, toks), toks, v) : v; break; }
      case "move": { const from = tokens(need("from")); if (op.path !== op.from && op.path.startsWith(op.from + "/")) throw new PatchError("move into child"); const v = get(root, from); root = remove(root, from); root = add(root, toks, v); break; }
      case "copy": { const from = tokens(need("from")); root = add(root, toks, clone(get(root, from))); break; }
      case "test": if (!equal(get(root, toks), need("value"))) throw new PatchError("test failed"); break;
      default: throw new PatchError("unknown op");
    }
  }
  return root;
}
