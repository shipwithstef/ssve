#!/usr/bin/env node

import assert from "node:assert/strict";
import { selectTier1Validators, selectTier1ValidatorsForSurfaces } from "../../../scripts/select-tier1-validators-v2.mjs";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    process.stderr.write(`not ok ${name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

check("controller source selects controller and Scout lifecycle replay", () => {
  const result = selectTier1Validators(["scripts/svc-execution-controller-v2.mjs"]);
  assert.equal(result.valid, true);
  assert.equal(result.fallback_full, false);
  assert.deepEqual(result.selected, ["validate-execution-controller-v2.mjs", "validate-sample-shadow-replay-v2.mjs"]);
});

check("concern registry selects concern compiler validator", () => {
  const result = selectTier1Validators(["concerns/REGISTRY.json"]);
  assert.deepEqual(result.selected, ["validate-concern-compiler-v2.mjs"]);
});

check("proposal selects complete v2 focused closure", () => {
  const result = selectTier1Validators(["proposals/2026-08-10-wi368-execution-controller-v2.md"]);
  assert.deepEqual(result.selected, [
    "validate-clean-main-followup.mjs",
    "validate-concern-compiler-v2.mjs",
    "validate-continuation-lifecycle-wi552.mjs",
    "validate-control-value-audit-v2.mjs",
    "validate-dispatch-resolver-wi551.mjs",
    "validate-execution-controller-v2.mjs",
    "validate-external-review-launcher.sh",
    "validate-host-runtime-adapter-v2.mjs",
    "validate-impact-triad-contract-fast-v2.mjs",
    "validate-layer-inventory-v2.mjs",
    "validate-memory-company-v2.mjs",
    "validate-owner-decision-v2.mjs",
    "validate-persistent-review-contract-v2.mjs",
    "validate-product-improvement-protocol-v2.mjs",
    "validate-product-proof-compiler-v2.mjs",
    "validate-release-lifecycle-v2.mjs",
    "validate-review-topology-v2.mjs",
    "validate-runtime-assurance-mutations-v2.mjs",
    "validate-runtime-cutover-v2.mjs",
    "validate-runtime-evidence-consumption-v2.mjs",
    "validate-runtime-migration-v2.mjs",
    "validate-runtime-scheduler-effects-v2.mjs",
    "validate-runtime-state-model-v2.mjs",
    "validate-runtime-v2.mjs",
    "validate-sample-shadow-replay-v2.mjs",
    "validate-skill-judgment.mjs",
    "validate-skill-runtime-contracts-v2.mjs",
    "validate-story-receipt-delivery-projection-v2.mjs",
    "validate-tier1-selector-v2.mjs",
    "validate-ux-graduation.mjs",
    "validate-wi546-cursor-live-acceptance.sh"
  ]);
});

check("impact guard selects both behavior and doctrine contracts", () => {
  const result = selectTier1Validators(["hooks/svc-impact-triad-guard.mjs"]);
  assert.deepEqual(result.selected, ["validate-impact-triad-contract-fast-v2.mjs", "validate-persistent-review-contract-v2.mjs"]);
});

check("product proof graph selects transformer context compiler", () => {
  const result = selectTier1Validators(["schemas/product-proof-graph-v2.schema.json"]);
  assert.deepEqual(result.selected, ["validate-product-proof-compiler-v2.mjs"]);
});

check("product improvement contract selects no-orphan and anti-loop proof", () => {
  const result = selectTier1Validators(["references/product-outcome-improvement-protocol-v2.md"]);
  assert.deepEqual(result.selected, ["validate-product-improvement-protocol-v2.mjs"]);
});

check("controller schema selects controller and full Scout replay", () => {
  const result = selectTier1Validators(["schemas/execution-task-capsule-v2.schema.json"]);
  assert.deepEqual(result.selected, ["validate-execution-controller-v2.mjs", "validate-sample-shadow-replay-v2.mjs"]);
});

check("unknown input fails closed to full sweep", () => {
  const result = selectTier1Validators(["scripts/unmapped-new-runtime.mjs"]);
  assert.equal(result.valid, true);
  assert.equal(result.fallback_full, true);
  assert.deepEqual(result.unknown_paths, ["scripts/unmapped-new-runtime.mjs"]);
});

check("global runner input forces full sweep", () => {
  const result = selectTier1Validators(["test-framework/evals/run-all-evals.sh"]);
  assert.equal(result.fallback_full, true);
  assert.equal(result.reason, "global-runner-input");
});

check("reviewer owner config support selects exact topology and launcher validators", () => {
  const result = selectTier1Validators(["scripts/review-topology-v2.mjs"]);
  assert.equal(result.fallback_full, false);
  assert.deepEqual(result.selected, ["validate-dispatch-resolver-wi551.mjs", "validate-external-review-launcher.sh", "validate-review-topology-v2.mjs"]);
});

check("story projection selects its focused receipt validator", () => {
  const result = selectTier1Validators(["scripts/audit-story-receipts.mjs"]);
  assert.equal(result.fallback_full, false);
  assert.deepEqual(result.selected, ["validate-story-receipt-delivery-projection-v2.mjs"]);
});

check("path traversal is invalid rather than widened silently", () => {
  const result = selectTier1Validators(["../outside"]);
  assert.equal(result.valid, false);
  assert(result.errors[0].includes("unsafe changed path"));
});

check("empty change set schedules no repeated proof", () => {
  const result = selectTier1Validators([]);
  assert.equal(result.valid, true);
  assert.equal(result.fallback_full, false);
  assert.deepEqual(result.selected, []);
});

// FP-030 surface mode: pure contract matches — the runner owns appending
// validate-tier1-selector-v2.mjs and treating an empty scope as a loud failure.
check("surface exact file selects its owning contracts and nothing else", () => {
  const result = selectTier1ValidatorsForSurfaces(["concerns/REGISTRY.json"]);
  assert.equal(result.valid, true);
  assert.equal(result.fallback_full, false);
  assert.deepEqual(result.selected, ["validate-concern-compiler-v2.mjs"]);
});

check("surface directory prefix selects every contract under the tree", () => {
  const result = selectTier1ValidatorsForSurfaces(["schemas/"]);
  for (const expected of ["validate-execution-controller-v2.mjs", "validate-product-proof-compiler-v2.mjs", "validate-review-topology-v2.mjs"]) {
    assert.ok(result.selected.includes(expected), `missing ${expected} under schemas/ prefix`);
  }
  assert.ok(!result.selected.includes("validate-concern-compiler-v2.mjs"), "concerns/REGISTRY.json must not match a schemas/ prefix");
});

check("surface prefix does not leak sibling contracts outside the prefix", () => {
  const result = selectTier1ValidatorsForSurfaces(["schemas/execution-task-capsule-v2.schema.json"]);
  assert.ok(!result.selected.includes("validate-concern-compiler-v2.mjs"));
  assert.ok(result.selected.includes("validate-execution-controller-v2.mjs"));
});

check("surface with no contract match returns an EMPTY selection (runner fails loudly)", () => {
  const result = selectTier1ValidatorsForSurfaces(["no/such/tree.mjs"]);
  assert.equal(result.valid, true);
  assert.deepEqual(result.selected, []);
});

check("surface traversal attempt is rejected rather than widened", () => {
  const result = selectTier1ValidatorsForSurfaces(["../outside/repo"]);
  assert.equal(result.valid, false);
});



check("skill judgment consumers select the focused contract", () => {
  for (const input of ["_shared/product-question-format.md", "skills/svc-advisor/SKILL.md", "skills/diagnose-bug/SKILL.md", "agents/strategic-reviewer.md", "skills/design-ui/SKILL.md"]) {
    const changed = selectTier1Validators([input]);
    assert.equal(changed.fallback_full, false);
    assert(changed.selected.includes("validate-skill-judgment.mjs"), input);
    assert(selectTier1ValidatorsForSurfaces([input]).selected.includes("validate-skill-judgment.mjs"), input);
  }
  assert.equal(selectTier1Validators(["future/unmapped-skill.md"]).fallback_full, true);
  assert.equal(selectTier1Validators(["AGENTS.md"]).fallback_full, true);
  assert.deepEqual(selectTier1ValidatorsForSurfaces(["definitely-unmapped-skill-judgment-surface"]).selected, []);
});

if (process.exitCode) process.stderr.write(`tier1 selector v2: ${passed} passed, failures present\n`);
else process.stdout.write(`tier1 selector v2: ${passed} passed, 0 failed\n`);
