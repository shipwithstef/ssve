import test from "node:test";
import assert from "node:assert/strict";
import { applyPatch as a } from "./solution.mjs";
test("add and replace", () => { assert.deepEqual(a({ x: 1 }, [{ op: "add", path: "/y", value: 2 }, { op: "replace", path: "/x", value: 3 }]), { x: 3, y: 2 }); });
test("array insert", () => { assert.deepEqual(a([1, 3], [{ op: "add", path: "/1", value: 2 }]), [1, 2, 3]); });
test("failed test throws PatchError", () => { assert.throws(() => a({ x: 1 }, [{ op: "test", path: "/x", value: 2 }]), (e) => e.name === "PatchError"); });
