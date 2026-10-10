import test from "node:test";
import assert from "node:assert/strict";
import { applyPatch as a } from "./solution.mjs";
const fails = (doc, patch) => assert.throws(() => a(doc, patch), (e) => e && e.name === "PatchError", JSON.stringify(patch));
test("rfc examples", () => {
  assert.deepEqual(a({ foo: "bar" }, [{ op: "add", path: "/baz", value: "qux" }]), { foo: "bar", baz: "qux" });
  assert.deepEqual(a({ foo: ["bar", "baz"] }, [{ op: "add", path: "/foo/1", value: "qux" }]), { foo: ["bar", "qux", "baz"] });
  assert.deepEqual(a({ baz: "qux", foo: "bar" }, [{ op: "remove", path: "/baz" }]), { foo: "bar" });
  assert.deepEqual(a({ foo: { bar: "baz", waldo: "fred" }, qux: { corge: "grault" } }, [{ op: "move", from: "/foo/waldo", path: "/qux/thud" }]), { foo: { bar: "baz" }, qux: { corge: "grault", thud: "fred" } });
  assert.deepEqual(a({ foo: ["all", "grass", "cows", "eat"] }, [{ op: "move", from: "/foo/1", path: "/foo/3" }]), { foo: ["all", "cows", "eat", "grass"] });
  assert.deepEqual(a({ foo: ["bar"] }, [{ op: "add", path: "/foo/-", value: ["abc", "def"] }]), { foo: ["bar", ["abc", "def"]] });
  assert.deepEqual(a({ "/": 9, "~1": 10 }, [{ op: "test", path: "/~01", value: 10 }]), { "/": 9, "~1": 10 });
  assert.deepEqual(a({ "a/b": 1 }, [{ op: "replace", path: "/a~1b", value: 2 }]), { "a/b": 2 });
});
test("whole document and copies", () => {
  assert.deepEqual(a({ x: 1 }, [{ op: "add", path: "", value: [1] }]), [1]);
  assert.deepEqual(a({ x: 1 }, [{ op: "replace", path: "", value: 5 }]), 5);
  const r = a({ x: { y: [1] } }, [{ op: "copy", from: "/x", path: "/z" }, { op: "add", path: "/z/y/-", value: 2 }]);
  assert.deepEqual(r, { x: { y: [1] }, z: { y: [1, 2] } }, "copy is deep");
  assert.deepEqual(a([1, 2], [{ op: "add", path: "/2", value: 3 }]), [1, 2, 3]);
});
test("deep equality in test", () => {
  assert.doesNotThrow(() => a({ o: { a: 1, b: [1, { c: 2 }] } }, [{ op: "test", path: "/o", value: { b: [1, { c: 2 }], a: 1 } }]));
  assert.doesNotThrow(() => a({ n: 1 }, [{ op: "test", path: "/n", value: 1.0 }]));
  fails({ o: [1, 2] }, [{ op: "test", path: "/o", value: [2, 1] }]);
  fails({ o: { a: 1 } }, [{ op: "test", path: "/o", value: { a: 1, b: undefined, c: null } }]);
  fails({ n: null }, [{ op: "test", path: "/n", value: 0 }]);
});
test("errors", () => {
  fails({ x: 1 }, [{ op: "remove", path: "/y" }]);
  fails({ x: 1 }, [{ op: "replace", path: "/y", value: 1 }]);
  fails([1], [{ op: "add", path: "/5", value: 1 }]);
  fails([1], [{ op: "add", path: "/01", value: 1 }]);
  fails([1], [{ op: "remove", path: "/-" }]);
  fails([1], [{ op: "replace", path: "/1", value: 1 }]);
  fails({ a: { b: 1 } }, [{ op: "move", from: "/a", path: "/a/c" }]);
  fails({ x: 1 }, [{ op: "frob", path: "/x" }]);
  fails({ x: 1 }, [{ op: "add", path: "/y" }]);
  fails({ x: 1 }, [{ op: "add", path: "x", value: 1 }]);
  fails({ x: 1 }, [{ op: "copy", path: "/y" }]);
  fails({ x: 1 }, [{ op: "add", path: "/a/b", value: 1 }]);
});
test("atomic and non-mutating", () => {
  const doc = { list: [1, 2], o: { k: "v" } };
  const before = JSON.stringify(doc);
  fails(doc, [{ op: "add", path: "/list/-", value: 3 }, { op: "remove", path: "/o/k" }, { op: "test", path: "/list/0", value: 9 }]);
  assert.equal(JSON.stringify(doc), before, "failed patch leaves doc unchanged");
  const out = a(doc, [{ op: "add", path: "/list/-", value: 3 }, { op: "remove", path: "/o/k" }]);
  assert.equal(JSON.stringify(doc), before, "successful patch leaves doc unchanged");
  assert.deepEqual(out, { list: [1, 2, 3], o: {} });
});
