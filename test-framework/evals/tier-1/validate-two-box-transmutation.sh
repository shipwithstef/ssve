#!/usr/bin/env bash
# validate-two-box-transmutation.sh — cheap offline Two-Box / transmutation gate.
# Runs node --test modules plus local host-capability, schema, and contract checks.
# Does not invoke a paid canary.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

fail() { echo "FAIL: $*" >&2; exit 1; }

[[ -f "$ROOT/test-framework/evals/tier-1/validate-two-box-transmutation.sh" ]] || fail "validator script missing"
[[ -f "$ROOT/scripts/two-box-plan.mjs" ]] || fail "missing scripts/two-box-plan.mjs"
[[ -f "$ROOT/scripts/validate-host-authority-capabilities.mjs" ]] || fail "missing host-authority validator"
[[ -f "$ROOT/scripts/review-plan-codex.sh" ]] || fail "missing scripts/review-plan-codex.sh"

TESTS=(
  test-framework/tests/two-box-plan.test.mjs
  test-framework/tests/research-decision.test.mjs
  test-framework/tests/two-box-learning.test.mjs
  test-framework/tests/two-box-receipts.test.mjs
  test-framework/tests/released-lease-recovery.test.mjs
)
for rel in "${TESTS[@]}"; do
  [[ -f "$ROOT/$rel" ]] || fail "missing $rel"
done

node --test "${TESTS[@]}"

node "$ROOT/scripts/validate-host-authority-capabilities.mjs" --root "$ROOT"

node --input-type=module -e '
import {packageCapabilities, validatePlanSchema} from "./scripts/lib/plan-manifest-contract.mjs";
import {PLANNING_ROLES} from "./scripts/lib/two-box-protocol.mjs";
import fs from "node:fs";
const caps = packageCapabilities();
if (caps.issuance_versions.join(",") !== "5") throw new Error("issuance_versions must be [5]");
if (!caps.supported_versions.includes(4) || !caps.supported_versions.includes(5)) throw new Error("supported_versions");
if (!caps.modes.includes("inline") || !caps.modes.includes("dispatch")) throw new Error("modes");
if (!caps.files.some((row) => row.path === "scripts/lib/review-inputs.mjs")) throw new Error("review-inputs missing from packageCapabilities");
const incomplete = validatePlanSchema({receipt_type: "plan-manifest", schema_version: 5, mode: "inline"});
if (incomplete.ok) throw new Error("incomplete v5 body must not schema-pass");
const control = JSON.parse(fs.readFileSync("schemas/receipts/control-plan.schema.json", "utf8"));
if (JSON.stringify(control.properties.schema_version.enum) !== "[1,2]") throw new Error("control-plan schema_version enum");
if (!control.$defs?.v1?.properties?.floor_verdict) throw new Error("v1 floor_verdict branch missing");
if (control.$defs?.v2?.properties && Object.hasOwn(control.$defs.v2.properties, "floor_verdict")) throw new Error("v2 must not declare floor_verdict");
const scouts = PLANNING_ROLES.filter((role) => role === "scout_forward" || role === "scout_reverse");
if (scouts.length !== 2) throw new Error("exactly two scouts");
if (!PLANNING_ROLES.includes("open_box") || !PLANNING_ROLES.includes("contract_box")) throw new Error("independent Open/Contract roles");
'

CODEX="$ROOT/scripts/review-plan-codex.sh"
grep -q -- "--plan-file" "$CODEX" || fail "review-plan-codex.sh must forward --plan-file"
grep -q -- "--context-files" "$CODEX" || fail "review-plan-codex.sh must forward --context-files"
grep -q -- "--reviewer-phase plan" "$CODEX" || fail "review-plan-codex.sh must keep --reviewer-phase plan"
grep -q -- "--review-kind plan" "$CODEX" || fail "review-plan-codex.sh must keep --review-kind plan"
grep -q "pre_execution_base" "$CODEX" || fail "review-plan-codex.sh must keep pre-execution base"
grep -q "parsePlanBytes" "$CODEX" || fail "review-plan-codex.sh must extract exact prepared JSON bytes"
if grep -Eq "schema_version[[:space:]]*=[[:space:]]*4" "$CODEX"; then fail "review-plan-codex.sh must not recast inline v4"; fi
if grep -Eq "createTransmutationSeal|sealAfterReview" "$CODEX"; then fail "review-plan-codex.sh must not seal"; fi

node "$ROOT/scripts/two-box-plan.mjs" --self-check
node "$ROOT/scripts/run-live-two-box-canary.mjs" --self-check

echo "validate-two-box-transmutation: PASS"
