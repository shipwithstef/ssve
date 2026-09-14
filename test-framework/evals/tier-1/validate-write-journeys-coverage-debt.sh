#!/usr/bin/env bash
# Tier 1: prevent write-journeys from regressing to zero registered integration coverage.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCENARIO="$REPO_ROOT/test-framework/evals/tier-2/scenarios/write-journeys-generate.md"
EVALS="$REPO_ROOT/test-framework/evals/evals.json"
STATE="$REPO_ROOT/FRAMEWORK-STATE.md"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

echo "=== Tier 1: write-journeys coverage debt guard ==="

if [[ -f "$SCENARIO" ]]; then
  pass "write-journeys tier-2 scenario file exists"
else
  fail "missing tier-2 scenario: $SCENARIO"
fi

if node -e '
const fs = require("fs");
const evals = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const scenarios = evals?.tiers?.["tier-2"]?.scenarios || [];
const found = scenarios.some((s) =>
  s.name === "write-journeys-generate" &&
  s.path === "tier-2/scenarios/write-journeys-generate.md" &&
  s.skill_under_test === "write-journeys" &&
  Number(s.assertions) >= 6
);
process.exit(found ? 0 : 1);
' "$EVALS"; then
  pass "evals.json registers write-journeys tier-2 scenario"
else
  fail "evals.json missing registered write-journeys tier-2 scenario"
fi

if grep -Fq 'docs/specs/journeys/*.feature.md' "$SCENARIO" \
  && grep -Fq 'docs/specs/journeys/JOURNEY_INDEX.md' "$SCENARIO" \
  && grep -Fq '"AC-"' "$SCENARIO" \
  && grep -Fq '"Layer 3"' "$SCENARIO"; then
  pass "scenario asserts journey docs, index, AC traceability, and Layer 3 analysis"
else
  fail "scenario does not pin the expected write-journeys outputs"
fi

if grep -q 'write-journeys-generate' "$REPO_ROOT/test-framework/evals/tier-2/run-tier2.sh" \
  && grep -q 'rm -rf "$work_dir/docs/specs/journeys"' "$REPO_ROOT/test-framework/evals/tier-2/run-tier2.sh"; then
  pass "tier-2 runner clears fixture journeys for the write-journeys scenario"
else
  fail "tier-2 runner does not clear preexisting fixture journeys for write-journeys"
fi

if ! grep -q '0 tier-2 scenarios for write-journeys' "$STATE" \
  && ! grep -q 'write-journeys tier-2 coverage | Zero tier-2' "$STATE"; then
  pass "current framework state no longer claims zero write-journeys tier-2 coverage"
else
  fail "FRAMEWORK-STATE.md still claims zero write-journeys tier-2 coverage"
fi

echo ""
echo "write-journeys coverage debt guard: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
