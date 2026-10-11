import test from "node:test";
import assert from "node:assert/strict";
import { slugify } from "../src/slugify.mjs";

test("lowercases and joins words with dashes", () => {
  assert.equal(slugify("Hello, World!"), "hello-world");
});

test("collapses runs of punctuation into one dash and trims the ends", () => {
  assert.equal(slugify("  --Rock & Roll!!  "), "rock-roll");
});

test("drops accents", () => {
  assert.equal(slugify("Crème Brûlée"), "creme-brulee");
});
