#!/usr/bin/env node
/** Tier 1: quality probes tell a strong test suite from a hollow one, count slop without
 * judging it, skip markup inside template literals, and the dimensions registry is
 * well formed. Hermetic: builds tiny fixtures in a temp dir; no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mutation, sizeAndSlop, testHygiene, mutationSites } from "../../../scripts/quality-probes.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const SOURCE = `export function price(cents, member) {
  if (cents < 0) throw new Error("negative");
  return member === true ? Math.floor(cents * 0.9) : cents;
}
export function canBook(taken, capacity) {
  return taken < capacity;
}
export function render(name) {
  return \`<p class="x">
  \${name > 1 ? "a" : "b"}
</p>\`;
}
`;

function fixture(testBody) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "qp-fixture-"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
  fs.writeFileSync(path.join(dir, "rules.mjs"), SOURCE);
  fs.writeFileSync(path.join(dir, "rules.test.mjs"), `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { price, canBook } from "./rules.mjs";\n${testBody}\n`);
  return dir;
}

test("mutation: a suite that checks behaviour kills most mutants; a hollow suite kills none", () => {
  const strong = fixture(`test("price", () => { assert.equal(price(1000, false), 1000); assert.equal(price(1000, true), 900); assert.throws(() => price(-1)); assert.equal(price(0, false), 0); });
test("capacity", () => { assert.equal(canBook(1, 2), true); assert.equal(canBook(2, 2), false); });`);
  const hollow = fixture(`test("exists", () => { assert.ok(true); assert.equal(typeof price, "function"); });`);
  try {
    const s = mutation(strong, { mutants: 12 });
    const h = mutation(hollow, { mutants: 12 });
    assert.ok(s.mutants > 0 && h.mutants > 0);
    assert.ok(s.score >= 0.6, `strong suite score ${s.score}`);
    assert.equal(h.score, 0, "a suite that asserts nothing kills nothing");
    assert.deepEqual(mutation(strong, { mutants: 12 }), s, "seeded: the same build gives the same score");
  } finally { fs.rmSync(strong, { recursive: true, force: true }); fs.rmSync(hollow, { recursive: true, force: true }); }
});

test("mutation: a build whose own tests fail as shipped gets no score, not zero", () => {
  const broken = fixture(`test("wrong", () => { assert.equal(price(1000, true), 1); });`);
  try { assert.equal(mutation(broken).score, null); } finally { fs.rmSync(broken, { recursive: true, force: true }); }
});

test("mutation sites skip markup inside template literals and test files", () => {
  const dir = fixture(`test("x", () => {});`);
  try {
    const sites = mutationSites(dir);
    assert.ok(sites.every((s) => s.file === "rules.mjs"), "tests are never mutated");
    assert.ok(!sites.some((s) => s.line >= 8 && s.line <= 10), "lines inside the template literal are skipped");
    assert.ok(sites.some((s) => s.line === 5), "logic lines are mutated");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("slop, size and hygiene are counted, not judged", () => {
  const dir = fixture(`test("a", () => { assert.ok(true); });\ntest.skip("b", () => {});`);
  fs.writeFileSync(path.join(dir, "extra.mjs"), `// TODO wire this up\nexport function unusedHelper() { try { return 1; } catch {} }\nconst key = "sk_live_abcdefghijkl";\n`);
  try {
    const m = sizeAndSlop(dir);
    assert.equal(m.slop.todo_or_placeholder, 1);
    assert.equal(m.slop.empty_catch, 1);
    assert.deepEqual([...m.slop.unused_export_names].sort(), ["render", "unusedHelper"]);
    assert.equal(m.secrets.hardcoded, 1);
    assert.equal(m.size.source_files, 2);
    const h = testHygiene(dir);
    assert.equal(h.trivial, 1);
    assert.equal(h.skipped, 1);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the dimensions registry names a class, a measure and a known source for every dimension", () => {
  const reg = JSON.parse(fs.readFileSync(path.join(root, "references/quality-dimensions.json"), "utf8"));
  const ids = new Set();
  for (const d of reg.dimensions) {
    assert.ok(!ids.has(d.id), `duplicate ${d.id}`); ids.add(d.id);
    assert.ok(reg.classes[d.class], `${d.id}: class ${d.class}`);
    assert.ok(d.measure && d.layer && d.better, d.id);
    assert.ok(reg.sources[d.source], `${d.id}: source ${d.source}`);
  }
  for (const layer of ["correctness", "production", "engineering", "efficiency", "product", "game"]) assert.ok(reg.dimensions.some((d) => d.layer === layer), layer);
});
