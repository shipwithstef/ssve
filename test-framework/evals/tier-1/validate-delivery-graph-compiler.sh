#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

node --input-type=module - <<'NODE'
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const fixturesDir = "test-framework/evals/tier-1/fixtures/delivery-graph-compiler";
const fixtures = [
  ["framework-change.json", ["improve-framework", "review-gate", "test-framework"]],
  ["browser-visible-product-change.json", ["track-visuals", "test-journeys", "build-personas", "write-e2e"]],
  ["backend-base44-change.json", ["base44-environment", "design-tech", "audit-implementation"]],
  ["provider-backed-generation.json", ["track-visuals", "test-journeys", "build-personas", "write-e2e"]],
  ["docs-only-change.json", ["design-ui:skipped", "track-visuals:skipped", "test-journeys:skipped"]],
  ["retroactive-corrective-closure.json", ["audit-session-execution"]],
];

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  passed += 1;
}

for (const [fixture, expectations] of fixtures) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-delivery-graph-"));
  const out = path.join(tmp, "lane-tasks.json");
  execFileSync("node", ["scripts/compile-delivery-graph.mjs", "--input", path.join(fixturesDir, fixture), "--out", out], { encoding: "utf8" });
  const graph = JSON.parse(fs.readFileSync(out, "utf8"));
  assert(graph.delivery_graph?.compiler_version === 1, `${fixture}: compiler_version missing`);
  assert(graph.delivery_graph?.closeout_classification_required === true, `${fixture}: closeout classification not required`);
  assert(Array.isArray(graph.delivery_graph?.mutation_history) && graph.delivery_graph.mutation_history.length === 1, `${fixture}: initial mutation history missing`);
  assert(Array.isArray(graph.tasks) && graph.tasks.length > 0, `${fixture}: tasks not generated`);
  assert(graph.tasks.every((task) => task.metadata?.skill), `${fixture}: generated task missing metadata.skill`);
  if (graph.delivery_graph.risk_flags?.includes("browser-visible")) {
    const visualModes = graph.tasks
      .filter((task) => task.metadata?.skill === "track-visuals")
      .map((task) => task.metadata?.mode);
    assert(visualModes.includes("baseline"), `${fixture}: browser-visible graph missing track-visuals baseline mode`);
    const execute = graph.tasks.find((task) => task.metadata?.skill === "execute-changeset");
    assert(execute?.metadata?.required_process_steps?.some((step) => step.skill === "track-visuals" && step.mode === "diff" && step.before === "review-gate"), `${fixture}: browser-visible graph missing pre-G5 track-visuals diff process`);
  }
  if (graph.delivery_graph.change_type === "feature" &&
      graph.delivery_graph.risk_flags?.some((flag) => flag === "user-facing" || flag === "admin-facing")) {
    assert(graph.delivery_graph.evidence_families?.feature_validation_closeout === "required", `${fixture}: user/admin-facing feature missing feature_validation_closeout requirement`);
  }
  if (graph.delivery_graph.risk_flags?.some((flag) => ["provider-backed", "generated-content", "ai-generation", "primary-provider", "saved-outcome"].includes(flag))) {
    assert(graph.delivery_graph.evidence_families?.provider_fidelity === "required", `${fixture}: provider-backed/generated graph missing provider_fidelity requirement`);
  }

  for (const expectation of expectations) {
    if (expectation.endsWith(":skipped")) {
      const skill = expectation.replace(":skipped", "");
      assert(graph.delivery_graph.skipped_skills.some((item) => item.skill === skill), `${fixture}: expected skipped ${skill}`);
    } else {
      assert(graph.delivery_graph.required_skills.includes(expectation), `${fixture}: expected required ${expectation}`);
    }
  }
}

console.log(`delivery-graph compiler: ${passed} checks passed across ${fixtures.length} fixtures`);
NODE
