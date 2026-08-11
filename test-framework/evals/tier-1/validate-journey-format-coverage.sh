#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
FORMAT="$REPO_ROOT/scripts/validate-journey-format.mjs"
COVERAGE="$REPO_ROOT/scripts/verify-journey-coverage.mjs"
PROMPT="$REPO_ROOT/test-framework/evals/tier-1.5/prompts/comprehension/write-journeys.txt"
GOOD="$REPO_ROOT/test-framework/evals/tier-1/fixtures/journey-format/good"
BAD="$REPO_ROOT/test-framework/evals/tier-1/fixtures/journey-format/bad"

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

echo "=== Tier 1: journey format and coverage ==="

node --check "$FORMAT" >/dev/null && ok "journey format helper syntax valid" || bad "journey format helper syntax valid"
node --check "$COVERAGE" >/dev/null && ok "journey coverage helper syntax valid" || bad "journey coverage helper syntax valid"
node "$FORMAT" --root "$GOOD" >/dev/null && ok "valid journey fixture passes format" || bad "valid journey fixture passes format"
node "$COVERAGE" --root "$GOOD" >/dev/null && ok "valid journey fixture passes coverage" || bad "valid journey fixture passes coverage"

if node "$FORMAT" --root "$BAD" >/tmp/svc-journey-format-bad.out 2>&1; then
  bad "invalid journey fixture fails format"
else
  grep -q "missing @AC trace tag" /tmp/svc-journey-format-bad.out && ok "invalid journey fixture fails format" || bad "format failure explains missing AC"
fi

if node "$COVERAGE" --root "$BAD" >/tmp/svc-journey-coverage-bad.out 2>&1; then
  bad "invalid journey fixture fails coverage"
else
  grep -q "zero AC trace tags" /tmp/svc-journey-coverage-bad.out && ok "invalid journey fixture fails coverage" || bad "coverage failure explains missing AC"
fi

if [[ -f "$PROMPT" ]] && grep -q "JOURNEY_INDEX" "$PROMPT" && grep -q "Layer 3" "$PROMPT"; then
  ok "write-journeys tier-1.5 comprehension prompt exists"
else
  bad "write-journeys tier-1.5 comprehension prompt exists"
fi

echo
echo "journey format and coverage: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
