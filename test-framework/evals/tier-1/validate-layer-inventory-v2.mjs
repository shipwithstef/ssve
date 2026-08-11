#!/usr/bin/env node

import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileCanonicalLayerInventory, loadCanonicalLayerDenominator } from "../../../scripts/svc-layer-inventory-v2.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
let passed = 0;
const checks = [];
function check(name, fn) { checks.push([name, fn]); }

check("canonical denominator imports every registered layer family exactly once", () => {
  const denominator = loadCanonicalLayerDenominator(root);
  assert.equal(new Set(denominator.rows.map((row) => row.id)).size, denominator.rows.length);
  for (const kind of ["SKILL", "STAGE", "CONCERN", "AUTHORITY", "HOST"]) assert.ok(denominator.rows.some((row) => row.kind === kind), kind);
});

check("complete applicability map compiles and binds all source digests", () => {
  const denominator = loadCanonicalLayerDenominator(root);
  const decisions = Object.fromEntries(denominator.rows.map((row) => [row.id, { applicable: true, reason: "activated by golden product graph" }]));
  const result = compileCanonicalLayerInventory({ repoRoot: root, decisions, generation: 3 });
  assert.equal(result.valid, true, result.errors?.join("\n"));
  assert.equal(result.inventory.layers.length, denominator.rows.length);
  assert.match(result.inventory.inventory_digest, /^[a-f0-9]{64}$/);
});

check("caller cannot omit or inject a layer", () => {
  const denominator = loadCanonicalLayerDenominator(root);
  const decisions = Object.fromEntries(denominator.rows.map((row) => [row.id, { applicable: false, reason: "not activated by this bounded outcome" }]));
  delete decisions[denominator.rows[0].id];
  decisions["skill:forged"] = { applicable: true, reason: "forged" };
  const result = compileCanonicalLayerInventory({ repoRoot: root, decisions });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("missing applicability")));
  assert.ok(result.errors.some((error) => error.includes("unknown caller-supplied")));
});

for (const [name, fn] of checks) {
  try { await fn(); passed += 1; }
  catch (error) { console.error(`FAIL ${name}: ${error.stack ?? error.message}`); process.exitCode = 1; }
}
if (!process.exitCode) console.log(`PASS validate-layer-inventory-v2 ${passed}/${checks.length}`);
