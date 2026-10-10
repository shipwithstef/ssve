const T = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function toRoman(n) {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 3999) throw new RangeError("out of range");
  let s = ""; for (const [v, r] of T) while (n >= v) { s += r; n -= v; } return s;
}
const RE = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
export function fromRoman(text) {
  if (typeof text !== "string" || !text || !RE.test(text)) throw new RangeError("invalid");
  let n = 0, s = text; for (const [v, r] of T) while (s.startsWith(r)) { n += v; s = s.slice(r.length); } return n;
}
