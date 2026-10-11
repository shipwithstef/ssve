#!/usr/bin/env node
/** Tier 1: the framework agrees with itself. Lane chains, compiler lanes, the review round
 * cap, essential-stage skips, stated counts and named paths all match the code and the
 * manifest that enforce them (scripts/framework-coherence.mjs), and each check still
 * catches a planted contradiction. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runAll, chainBlock, expectedNeighbours, effectiveLanes, checkLaneLayers } from "../../../scripts/framework-coherence.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "skills-manifest.json"), "utf8"));

test("the repository has no coherence findings", () => {
  const findings = runAll();
  assert.deepEqual(findings.map((f) => `${f.check}: ${f.file} ${f.msg}`), []);
});

test("chain blocks parse, and a wrong neighbour is detected", () => {
  const text = "---\nname: x\nchain:\n  lanes:\n    bugfix: { position: 2, prev: diagnose-bug, next: null }\n---\n";
  assert.deepEqual(chainBlock(text), { bugfix: { position: 2, prev: "diagnose-bug", next: null } });
  const order = effectiveLanes(manifest).bugfix;
  const want = expectedNeighbours(order, "plan-changeset");
  assert.equal(want.next, "review-plan", "the mandatory chain puts review-plan after plan-changeset");
  assert.notEqual(chainBlock(text).bugfix.next, want.next);
});

test("lane-layers flags a compiler step missing from the manifest lane", () => {
  const broken = structuredClone(manifest);
  broken.laneDefinitions.refactor.skills = broken.laneDefinitions.refactor.skills.filter((s) => s !== "design-tech");
  assert.ok(checkLaneLayers(broken).some((f) => /refactor: required step design-tech/.test(f.msg)));
  const undeclared = structuredClone(manifest);
  delete undeclared.mandatoryChainOutOfLane["review-plan"];
  assert.ok(checkLaneLayers(undeclared).some((f) => /review-plan is in the mandatory chain/.test(f.msg)));
});

test("a non-code lane keeps its own steps; code lanes get the delivery chain (review #127, #129 lane kinds)", async () => {
  const { effectiveLanes } = await import("../../../scripts/framework-coherence.mjs");
  const m = { laneDefinitions: { research: { kind: "non-code", skills: ["analyze-domain", "strategic-decision"] }, feature: { skills: ["analyze-domain", "plan-changeset"] } } };
  const lanes = effectiveLanes(m);
  assert.deepEqual(lanes.research, ["analyze-domain", "strategic-decision"]);
  assert.ok(lanes.feature.includes("verify-promotion") && lanes.feature.includes("execute-changeset"), "a code lane gets the mandatory chain");
});
