#!/usr/bin/env node
/** Tier 1: Lane 13 (general) is registered consistently everywhere lanes are enumerated, and has no code delivery graph. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const manifest = JSON.parse(read("skills-manifest.json"));
const lanes = Object.keys(manifest.laneDefinitions).sort();

test("general is a declared non-code lane", () => {
  assert.ok(lanes.includes("general"));
  assert.equal(manifest.laneDefinitions.general.kind, "non-code");
});

test("validate-wi-promotion LANE_ENUM and the promotion-receipt schema enum match the manifest lanes", () => {
  const enumSrc = read("scripts/validate-wi-promotion.mjs").match(/const LANE_ENUM = (\[[^\]]*\]);/);
  assert.ok(enumSrc, "LANE_ENUM literal not found");
  assert.deepEqual(JSON.parse(enumSrc[1]).sort(), lanes);
  const schema = read("references/schemas/promotion-receipt.schema.json");
  const m = schema.match(/"enum": (\["greenfield"[^\]]*\])/);
  assert.ok(m, "promotion-receipt lane enum not found");
  assert.deepEqual(JSON.parse(m[1]).sort(), lanes);
});

test("lane enumerations in docs and self-verify include general", () => {
  assert.match(read("skills/route-workflow/references/task-graph-protocol.md"), /"lane": "[^"]*\|general"/);
  assert.match(read("references/advisor/framework-knowledge-index.md"), /Workflow lanes \| 8: [^|]*general/);
  assert.match(read("FRAMEWORK-STATE.md"), /\*\*Lanes:\*\* 8:/);
  assert.match(read("skills/route-workflow/SKILL.md"), /one of the 8 lane definitions/);
});

test("compileDeliveryGraph refuses the general lane and points at its flow", async () => {
  const { compileDeliveryGraph } = await import(pathToFileURL(path.join(root, "scripts/compile-delivery-graph.mjs")));
  assert.throws(() => compileDeliveryGraph({ wi: "WI-999", lane: "general", change_type: "feature", user_intent: "pick a launch channel", risk_flags: [], platform_contracts: [] }),
    /no code delivery graph[\s\S]*general-lane\.md/);
});
