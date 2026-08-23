#!/usr/bin/env node

import assert from "node:assert/strict";
import { selectTier1Validators } from "../../../scripts/select-tier1-validators-v2.mjs";

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
    "validate-atomic-state-writes.sh",
    "validate-child-transport-resolver.mjs",
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
    "validate-parallel-wi-dispatch.sh",
    "validate-persistent-review-contract-v2.mjs",
    "validate-product-improvement-protocol-v2.mjs",
    "validate-product-proof-compiler-v2.mjs",
    "validate-release-lifecycle-v2.mjs",
    "validate-review-dispatch-adapter-convergence.sh",
    "validate-review-topology-v2.mjs",
    "validate-reviewer-run-evidence.sh",
    "validate-runtime-assurance-mutations-v2.mjs",
    "validate-runtime-cutover-v2.mjs",
    "validate-runtime-evidence-consumption-v2.mjs",
    "validate-runtime-migration-v2.mjs",
    "validate-runtime-scheduler-effects-v2.mjs",
    "validate-runtime-state-model-v2.mjs",
    "validate-runtime-v2.mjs",
    "validate-sample-shadow-replay-v2.mjs",
    "validate-skill-runtime-contracts-v2.mjs",
    "validate-state-io-discipline.sh",
    "validate-story-receipt-delivery-projection-v2.mjs",
    "validate-tier1-selector-v2.mjs",
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

check("protected authority-file primitive selects every policy and review consumer", () => {
  const result = selectTier1Validators(["scripts/lib/protected-file.mjs"]);
  assert.equal(result.fallback_full, false);
  assert.deepEqual(result.selected, [
    "validate-dispatch-resolver-wi551.mjs",
    "validate-external-review-launcher.sh",
    "validate-review-dispatch-adapter-convergence.sh",
    "validate-review-topology-v2.mjs",
  ]);
});

check("policy-status shell selects the launcher fixture that proves canonical delegation", () => {
  const result = selectTier1Validators(["scripts/resolve-adversarial-reviewer.sh"]);
  assert.equal(result.fallback_full, false);
  assert(result.selected.includes("validate-external-review-launcher.sh"));
  assert(result.selected.includes("validate-dispatch-resolver-wi551.mjs"));
});

check("WI-559 execution adapters retain convergence proof across transitive inputs", () => {
  for (const input of [
    "hooks/lib/wi-id.mjs",
    "scripts/resolve-execute-dispatch.mjs",
    "scripts/resolve-dispatch.mjs",
    "scripts/execute-dispatch-preflight.sh",
    "scripts/dispatch-worker.sh",
    "scripts/dispatch-log.sh",
    "scripts/resolve-child-transport.mjs",
    "scripts/svc-contained-exec.mjs",
    "scripts/validate-host-authority-capabilities.mjs",
    "scripts/state-io.mjs",
    "hooks/svc-execute-dispatch-guard.sh",
    "skills/execute-changeset/references/dispatch-preflight.md",
    "skills/execute-changeset/references/subagent-dispatch.md",
  ]) {
    const result = selectTier1Validators([input]);
    assert.equal(result.fallback_full, false, input);
    assert(result.selected.includes("validate-review-dispatch-adapter-convergence.sh"), input);
  }
});

check("shared dispatch and state I/O inputs select every established direct validator", () => {
  const worker = selectTier1Validators(["scripts/dispatch-worker.sh"]);
  for (const validator of ["validate-child-transport-resolver.mjs", "validate-parallel-wi-dispatch.sh", "validate-review-dispatch-adapter-convergence.sh"]) {
    assert(worker.selected.includes(validator), validator);
  }
  const state = selectTier1Validators(["scripts/state-io.mjs"]);
  for (const validator of ["validate-atomic-state-writes.sh", "validate-state-io-discipline.sh", "validate-review-dispatch-adapter-convergence.sh"]) {
    assert(state.selected.includes(validator), validator);
  }
});

check("review adapter retains resolver proof and adds convergence proof", () => {
  const result = selectTier1Validators(["scripts/review-plan-codex.sh"]);
  assert.deepEqual(result.selected, ["validate-dispatch-resolver-wi551.mjs", "validate-persistent-review-contract-v2.mjs", "validate-review-dispatch-adapter-convergence.sh"]);
});

check("persistent review validator follows every consumed launcher/schema input", () => {
  for (const input of ["scripts/run-external-review.mjs", "schemas/external-review-findings.schema.json", "schemas/external-review-receipt.schema.json"]) {
    const result = selectTier1Validators([input]);
    assert.equal(result.fallback_full, false, input);
    assert(result.selected.includes("validate-persistent-review-contract-v2.mjs"), input);
  }
});

check("v3 reviewer evidence inputs select the dual plan/tree binding proof", () => {
  for (const input of ["scripts/lib/reviewer-evidence.mjs", "test-framework/evals/tier-1/validate-reviewer-run-evidence.sh"]) {
    const result = selectTier1Validators([input]);
    assert.equal(result.fallback_full, false, input);
    assert(result.selected.includes("validate-reviewer-run-evidence.sh"), input);
  }
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

if (process.exitCode) process.stderr.write(`tier1 selector v2: ${passed} passed, failures present\n`);
else process.stdout.write(`tier1 selector v2: ${passed} passed, 0 failed\n`);
