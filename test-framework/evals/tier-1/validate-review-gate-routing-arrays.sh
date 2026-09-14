#!/usr/bin/env bash
# Tier 1: review gate skills must stay visible to routing arrays.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

node - "$REPO_ROOT/skills-manifest.json" <<'NODE'
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const failures = [];

function includes(arr, value, label) {
  if (!Array.isArray(arr) || !arr.includes(value)) {
    failures.push(`${label} missing ${value}`);
  }
}

includes(manifest.includedSkills, "review-plan", "includedSkills");
includes(manifest.includedSkills, "review-security", "includedSkills");
includes(manifest.corePackForRouting, "review-plan", "corePackForRouting");
includes(manifest.corePackForRouting, "review-security", "corePackForRouting");

const pipeline = manifest.pipeline || [];
const planIndex = pipeline.indexOf("plan-changeset");
const reviewIndex = pipeline.indexOf("review-plan");
const executeIndex = pipeline.indexOf("execute-changeset");
if (planIndex === -1 || reviewIndex === -1 || executeIndex === -1) {
  failures.push("pipeline must include plan-changeset, review-plan, and execute-changeset");
} else if (!(planIndex < reviewIndex && reviewIndex < executeIndex)) {
  failures.push("pipeline must order plan-changeset -> review-plan -> execute-changeset");
}

console.log("=== Tier 1: Review Gate Routing Arrays ===");
if (failures.length > 0) {
  for (const failure of failures) console.log(`  FAIL: ${failure}`);
  process.exit(1);
}

console.log("  PASS - skills/review-plan/review-security routing invariants hold");
NODE
