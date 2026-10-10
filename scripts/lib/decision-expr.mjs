/**
 * decision-expr — a small, side-effect-free expression language for decision
 * models. Compiles once to a closure; never uses eval/Function.
 *
 * Grammar (lowest → highest precedence):
 *   cond   := or ('?' expr ':' expr)?
 *   or     := and ('||' and)*
 *   and    := cmp ('&&' cmp)*
 *   cmp    := sum (('<'|'<='|'>'|'>='|'=='|'!=') sum)?
 *   sum    := prod (('+'|'-') prod)*
 *   prod   := unary (('*'|'/'|'%') unary)*
 *   unary  := ('-'|'!') unary | pow
 *   pow    := atom ('^' unary)?          (right-associative)
 *   atom   := number | ident | ident '(' args ')' | '(' expr ')'
 * Booleans are 1/0. Unknown identifiers and functions are compile errors.
 */
const FUNCS = {
  min: (...a) => Math.min(...a), max: (...a) => Math.max(...a), abs: Math.abs,
  sqrt: Math.sqrt, log: Math.log, exp: Math.exp, floor: Math.floor, ceil: Math.ceil, round: Math.round,
  clamp: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
  if: (c, a, b) => (c ? a : b),
};

function tokenize(src) {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (num) { out.push({ t: "num", v: Number(num[0]) }); i += num[0].length; continue; }
    const id = /^[A-Za-z_][A-Za-z0-9_.]*/.exec(src.slice(i));
    if (id) { out.push({ t: "id", v: id[0] }); i += id[0].length; continue; }
    const op = /^(?:<=|>=|==|!=|&&|\|\||[-+*/%^()<>!?:,])/.exec(src.slice(i));
    if (op) { out.push({ t: "op", v: op[0] }); i += op[0].length; continue; }
    throw new Error(`unexpected character '${c}' at ${i}`);
  }
  return out;
}

/** Compile `src` against the allowed identifier set. Returns { fn(env), refs:Set }. */
export function compile(src, allowed) {
  if (typeof src === "number") return { fn: () => src, refs: new Set() };
  if (typeof src !== "string" || !src.trim()) throw new Error("expression must be a non-empty string or number");
  const toks = tokenize(src); let p = 0; const refs = new Set();
  const peek = () => toks[p]; const isOp = (v) => toks[p] && toks[p].t === "op" && toks[p].v === v;
  const expect = (v) => { if (!isOp(v)) throw new Error(`expected '${v}' in "${src}"`); p++; };
  const bin = (next, ops, f) => () => { let l = next(); while (toks[p] && toks[p].t === "op" && ops.includes(toks[p].v)) { const o = toks[p++].v; const r = next(); const a = l; l = (e) => f(o, a(e), r(e)); } return l; };
  let expr;
  const atom = () => {
    const tk = peek(); if (!tk) throw new Error(`unexpected end of "${src}"`);
    if (tk.t === "num") { p++; return () => tk.v; }
    if (isOp("(")) { p++; const e = expr(); expect(")"); return e; }
    if (tk.t === "id") {
      p++;
      if (isOp("(")) {
        p++; const f = FUNCS[tk.v]; if (!f) throw new Error(`unknown function '${tk.v}' in "${src}"`);
        const args = []; if (!isOp(")")) { do { args.push(expr()); } while (isOp(",") && ++p); } expect(")");
        return (e) => f(...args.map((a) => a(e)));
      }
      if (!allowed.has(tk.v)) throw new Error(`unknown identifier '${tk.v}' in "${src}"`);
      refs.add(tk.v); const name = tk.v; return (e) => e[name];
    }
    throw new Error(`unexpected '${tk.v}' in "${src}"`);
  };
  const pow = () => { const b = atom(); if (isOp("^")) { p++; const x = unary(); return (e) => b(e) ** x(e); } return b; };
  const unary = () => { if (isOp("-")) { p++; const u = unary(); return (e) => -u(e); } if (isOp("!")) { p++; const u = unary(); return (e) => (u(e) ? 0 : 1); } return pow(); };
  const prod = bin(unary, ["*", "/", "%"], (o, a, b) => (o === "*" ? a * b : o === "/" ? a / b : a % b));
  const sum = bin(prod, ["+", "-"], (o, a, b) => (o === "+" ? a + b : a - b));
  const cmp = () => { const l = sum(); const tk = peek(); if (tk && tk.t === "op" && ["<", "<=", ">", ">=", "==", "!="].includes(tk.v)) { p++; const r = sum(); const o = tk.v;
    return (e) => { const a = l(e), b = r(e); return Number(o === "<" ? a < b : o === "<=" ? a <= b : o === ">" ? a > b : o === ">=" ? a >= b : o === "==" ? a === b : a !== b); }; } return l; };
  const and = bin(cmp, ["&&"], (o, a, b) => Number(Boolean(a) && Boolean(b)));
  const or = bin(and, ["||"], (o, a, b) => Number(Boolean(a) || Boolean(b)));
  expr = () => { const c = or(); if (isOp("?")) { p++; const a = expr(); expect(":"); const b = expr(); return (e) => (c(e) ? a(e) : b(e)); } return c; };
  const fn = expr();
  if (p !== toks.length) throw new Error(`unexpected '${toks[p].v}' in "${src}"`);
  return { fn, refs };
}
