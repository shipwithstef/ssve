import test from "node:test";
import assert from "node:assert/strict";
import { parseCsvLine as p } from "./solution.mjs";
test("empties", () => {
  assert.deepEqual(p(""), [""]);
  assert.deepEqual(p(","), ["", ""]);
  assert.deepEqual(p("a,"), ["a", ""]);
  assert.deepEqual(p(",a"), ["", "a"]);
  assert.deepEqual(p('""'), [""]);
  assert.deepEqual(p('"",""'), ["", ""]);
  assert.deepEqual(p('a,""'), ["a", ""]);
});
test("quotes", () => {
  assert.deepEqual(p('"a""b"'), ['a"b']);
  assert.deepEqual(p('""""'), ['"']);
  assert.deepEqual(p('a"b,c'), ['a"b', "c"]);
  assert.deepEqual(p(' "a"'), [' "a"']);
  assert.deepEqual(p('"x\ny",z'), ["x\ny", "z"]);
  assert.deepEqual(p('"a,b,c"'), ["a,b,c"]);
  assert.deepEqual(p("  a , b "), ["  a ", " b "]);
});
test("errors", () => {
  for (const x of ['"a', '"a"b', '"a" ,b', 'x,"y', '"""', '"a""']) assert.throws(() => p(x), SyntaxError, x);
  assert.throws(() => p(null), TypeError);
  assert.throws(() => p(1), TypeError);
});
