import test from "node:test";
import assert from "node:assert/strict";
import { toRoman, fromRoman } from "./solution.mjs";
test("round trip 1..3999", () => { for (let n = 1; n <= 3999; n++) assert.equal(fromRoman(toRoman(n)), n); });
test("known values", () => {
  for (const [n, r] of [[4, "IV"], [9, "IX"], [14, "XIV"], [40, "XL"], [90, "XC"], [400, "CD"], [444, "CDXLIV"], [900, "CM"], [3999, "MMMCMXCIX"], [3888, "MMMDCCCLXXXVIII"]]) { assert.equal(toRoman(n), r); assert.equal(fromRoman(r), n); }
});
test("toRoman range", () => { for (const x of [0, -1, 4000, 1.5, NaN, Infinity, "5", null]) assert.throws(() => toRoman(x), RangeError, String(x)); });
test("fromRoman strict", () => {
  for (const x of ["", "iv", "Iv", "IIII", "VV", "LL", "DD", "MMMM", "IC", "VX", "IL", "XD", "IIX", "XM", "IM", "VIV", "XCX", "CMC", "IXI", " X", "X ", "IVI", "ABC"]) assert.throws(() => fromRoman(x), RangeError, x);
  assert.throws(() => fromRoman(null), RangeError);
  assert.throws(() => fromRoman(10), RangeError);
});
