#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/validate-design-chrome-testability.mjs"
GOOD="$REPO_ROOT/test-framework/evals/tier-1/fixtures/design-chrome-testability/good"
BAD="$REPO_ROOT/test-framework/evals/tier-1/fixtures/design-chrome-testability/bad"
UI="$REPO_ROOT/skills/design-ui/SKILL.md"
TECH="$REPO_ROOT/skills/design-tech/SKILL.md"

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

echo "=== Tier 1: design chrome testability ==="

node --check "$HELPER" >/dev/null && ok "chrome testability helper syntax valid" || bad "chrome testability helper syntax valid"
node "$HELPER" --root "$GOOD" >/dev/null && ok "labeled chrome fixture passes" || bad "labeled chrome fixture passes"
if node "$HELPER" --root "$BAD" >/tmp/svc-design-chrome-bad.out 2>&1; then
  bad "unlabeled chrome fixture fails"
else
  grep -q "missing accessible name" /tmp/svc-design-chrome-bad.out && ok "unlabeled chrome fixture fails" || bad "unlabeled chrome failure explains accessible name"
fi

if grep -q "Chrome Control Testability" "$UI" && grep -q "data-testid" "$UI"; then
  ok "design-ui requires chrome control testability"
else
  bad "design-ui requires chrome control testability"
fi

if grep -q "Chrome Control Testability" "$TECH" && grep -q "validate-design-chrome-testability.mjs" "$TECH"; then
  ok "design-tech requires chrome control validation"
else
  bad "design-tech requires chrome control validation"
fi

echo
echo "design chrome testability: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
