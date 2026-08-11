#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PLAN="$REPO_ROOT/scripts/tier3-coverage-plan.mjs"
BASELINES="$REPO_ROOT/test-framework/evals/tier-3/skill-baselines.json"
RUNNER="$REPO_ROOT/test-framework/evals/run-all-evals.sh"
TIER3="$REPO_ROOT/test-framework/evals/tier-3/run-tier3.sh"

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

echo "=== Tier 1: tier-3 coverage plan ==="

node --check "$PLAN" >/dev/null && ok "coverage plan helper syntax valid" || bad "coverage plan helper syntax valid"
node -e "JSON.parse(require('fs').readFileSync('$BASELINES','utf8'))" && ok "tier-3 baselines parse as JSON" || bad "tier-3 baselines parse as JSON"

plan_json="$(cd "$REPO_ROOT" && node "$PLAN" --json)"
node -e '
const fs = require("fs");
const plan = JSON.parse(fs.readFileSync(0, "utf8"));
if (plan.scenario_count < 35) throw new Error("scenario_count");
if (plan.judgments !== undefined) {}
if (plan.judgments.length !== plan.scenario_count * 3) throw new Error("judgment coverage");
for (const dim of ["completeness", "actionability", "consistency"]) {
  if (!plan.dimensions.includes(dim)) throw new Error(`missing ${dim}`);
}
' <<<"$plan_json" && ok "plan covers every tier-2 scenario across 3 dimensions" || bad "plan covers every tier-2 scenario across 3 dimensions"

grep -q "tier3-coverage-plan.mjs" "$RUNNER" && ok "run-all validates tier-3 coverage plan before judging" || bad "run-all validates tier-3 coverage plan before judging"
grep -q "for dim in completeness actionability consistency" "$RUNNER" && ok "run-all batches all three judge dimensions" || bad "run-all batches all three judge dimensions"
grep -q "SVC_TIER3_MIN_SCORE" "$TIER3" && ok "tier-3 runner enforces score floor" || bad "tier-3 runner enforces score floor"
grep -q "score below minimum" "$TIER3" && ok "tier-3 runner fails low-score judgments" || bad "tier-3 runner fails low-score judgments"

if [[ "$fail" -gt 0 ]]; then
  echo
  echo "tier-3 coverage plan: $pass passed, $fail failed"
  exit 1
fi

echo
echo "tier-3 coverage plan: $pass passed, $fail failed"
