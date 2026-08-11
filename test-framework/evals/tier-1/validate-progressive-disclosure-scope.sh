#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CONVENTIONS="$REPO_ROOT/references/skill-conventions.md"
WI="$REPO_ROOT/docs/specs/work-items/WI-189.md"

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

require() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qE "$pattern" "$file"; then
    ok "$label"
  else
    bad "$label"
  fi
}

echo "=== Tier 1: progressive-disclosure scope ==="

require "$CONVENTIONS" "Do NOT refactor existing skills wholesale" "legacy wholesale refactor is explicitly a non-goal"
require "$CONVENTIONS" "new skills authored on or after 2026-04-28" "scope applies to post-convention new skills"
require "$CONVENTIONS" "Legacy skills are converted only when they are being substantively edited" "legacy conversion is opportunistic"
require "$CONVENTIONS" "tier-1 advisory check" "future enforcement remains advisory unless separately changed"
require "$WI" "status: closed-invalid" "WI-189 is closed invalid rather than pretending corpus is fixed"
require "$WI" "references/skill-conventions.md" "WI-189 cites canonical progressive-disclosure scope"

if [[ "$fail" -gt 0 ]]; then
  echo
  echo "progressive-disclosure scope: $pass passed, $fail failed"
  exit 1
fi

echo
echo "progressive-disclosure scope: $pass passed, $fail failed"
