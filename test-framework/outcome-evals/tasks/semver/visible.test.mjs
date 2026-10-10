import test from "node:test";
import assert from "node:assert/strict";
import { compareSemver as c } from "./solution.mjs";
test("core", () => { assert.equal(c("1.2.3", "1.10.0"), -1); assert.equal(c("2.0.0", "2.0.0"), 0); });
test("prerelease is lower", () => { assert.equal(c("1.0.0-alpha", "1.0.0"), -1); });
test("invalid", () => { assert.throws(() => c("01.0.0", "1.0.0"), TypeError); });
