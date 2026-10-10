import test from "node:test";
import assert from "node:assert/strict";
import { parseCsvLine as p } from "./solution.mjs";
test("plain", () => { assert.deepEqual(p("a,b,c"), ["a", "b", "c"]); });
test("quoted comma and escaped quote", () => { assert.deepEqual(p('"a,b","say ""hi"""'), ["a,b", 'say "hi"']); });
test("unterminated", () => { assert.throws(() => p('"abc'), SyntaxError); });
