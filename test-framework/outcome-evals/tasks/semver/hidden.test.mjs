import test from "node:test";
import assert from "node:assert/strict";
import { compareSemver as c } from "./solution.mjs";
test("spec ordering chain", () => {
  const chain = ["1.0.0-alpha", "1.0.0-alpha.1", "1.0.0-alpha.beta", "1.0.0-beta", "1.0.0-beta.2", "1.0.0-beta.11", "1.0.0-rc.1", "1.0.0"];
  for (let i = 0; i < chain.length - 1; i++) { assert.equal(c(chain[i], chain[i + 1]), -1, chain[i]); assert.equal(c(chain[i + 1], chain[i]), 1); }
});
test("core numeric", () => { assert.equal(c("1.9.0", "1.10.0"), -1); assert.equal(c("10.0.0", "9.9.9"), 1); assert.equal(c("0.0.0", "0.0.0"), 0); });
test("build ignored", () => { assert.equal(c("1.0.0+build.1", "1.0.0+build.2"), 0); assert.equal(c("1.0.0-rc.1+x", "1.0.0-rc.1"), 0); assert.equal(c("1.0.0+001", "1.0.0"), 0); });
test("ascii order and numeric lower", () => { assert.equal(c("1.0.0-Beta", "1.0.0-alpha"), -1); assert.equal(c("1.0.0-1", "1.0.0-a"), -1); assert.equal(c("1.0.0-a-b", "1.0.0-a"), 1); assert.equal(c("1.0.0-0a", "1.0.0-1"), 1); });
test("big numbers exact", () => { assert.equal(c("9007199254740993.0.0", "9007199254740992.0.0"), 1); assert.equal(c("1.0.0-9007199254740993", "1.0.0-9007199254740992"), 1); });
test("invalid", () => {
  for (const v of ["1.0", "1.0.0.0", "v1.0.0", " 1.0.0", "1.0.0 ", "01.0.0", "1.01.0", "1.0.01", "1.0.0-", "1.0.0-01", "1.0.0-a..b", "1.0.0+", "1.0.0+a..b", "1.0.0-a_b", "1.0.0+a_b", "-1.0.0", "1.0.0-+a", ""]) assert.throws(() => c(v, "1.0.0"), TypeError, v);
  assert.throws(() => c(null, "1.0.0"), TypeError);
  assert.throws(() => c("1.0.0", 1), TypeError);
});
