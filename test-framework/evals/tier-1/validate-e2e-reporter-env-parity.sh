#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PASS=0
FAIL=0

ok() {
  echo "  PASS - $1"
  PASS=$((PASS + 1))
}

bad() {
  echo "  FAIL - $1"
  FAIL=$((FAIL + 1))
}

require_grep() {
  local label="$1"
  local pattern="$2"
  local file="$3"
  if grep -qE "$pattern" "$file"; then
    ok "$label"
  else
    bad "$label"
  fi
}

echo "=== Tier 1: E2E Reporter Env Parity ==="

require_grep \
  "test-journeys has reporter/runner parity gate" \
  "Reporter/Runner Env Parity Gate" \
  "$REPO_ROOT/skills/test-journeys/SKILL.md"

require_grep \
  "test-journeys requires same env-loading and account-resolution contract" \
  "same env-loading and account-resolution" \
  "$REPO_ROOT/skills/test-journeys/SKILL.md"

require_grep \
  "test-journeys names stream-specific owner credentials" \
  "TEST_OWNER_EMAIL_STREAM_A" \
  "$REPO_ROOT/skills/test-journeys/SKILL.md"

require_grep \
  "test-journeys names stream-specific customer credentials" \
  "TEST_CUSTOMER_EMAIL_STREAM_A" \
  "$REPO_ROOT/skills/test-journeys/SKILL.md"

require_grep \
  "write-e2e has reporter/runner parity contract" \
  "Reporter/Runner Env Parity" \
  "$REPO_ROOT/skills/write-e2e/SKILL.md"

require_grep \
  "write-e2e rejects generic-only credential checks" \
  "only look for generic" \
  "$REPO_ROOT/skills/write-e2e/SKILL.md"

require_grep \
  "write-e2e requires runner blockage proof before accepting blocked coverage" \
  "prove the E2E runner would also be" \
  "$REPO_ROOT/skills/write-e2e/SKILL.md"

require_grep \
  "framework learning captures reporter env parity incident" \
  '"key":"e2e-reporter-env-parity"' \
  "$REPO_ROOT/references/framework-learnings.jsonl"

echo
echo "e2e reporter env parity: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
