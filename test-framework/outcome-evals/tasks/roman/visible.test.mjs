import test from "node:test";
import assert from "node:assert/strict";
import { toRoman, fromRoman } from "./solution.mjs";
test("to", () => { assert.equal(toRoman(1994), "MCMXCIV"); assert.throws(() => toRoman(0), RangeError); });
test("from", () => { assert.equal(fromRoman("MMXXVI"), 2026); assert.throws(() => fromRoman("IIII"), RangeError); });
