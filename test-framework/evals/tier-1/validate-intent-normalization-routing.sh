#!/usr/bin/env bash
# Tier-1 validator: route-workflow must normalize recoverable typo-heavy user
# messages before route classification. Origin: WI-202.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROUTER="$REPO_ROOT/skills/route-workflow/SKILL.md"
REF="$REPO_ROOT/skills/route-workflow/references/intent-normalization.md"
PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

require_fixed() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -Fq "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: route-workflow intent normalization ==="

require_fixed "$ROUTER" "### Pre-Routing Typo Normalization" "route-workflow has pre-routing normalization section"
require_fixed "$ROUTER" "references/intent-normalization.md" "route-workflow links normalization reference"
require_fixed "$ROUTER" "normalized_intent" "route-workflow requires normalized_intent audit field"
require_fixed "$ROUTER" "Route from the normalized interpretation, not the noisy surface form" "route-workflow routes from normalized interpretation"

require_fixed "$REF" "should improvmeent for this thing" "reference covers improvement typo example"
require_fixed "$REF" "ful lverifications" "reference covers split verification example"
require_fixed "$REF" "browser trakc visual" "reference covers browser/track-visuals example"
require_fixed "$REF" "tetjourney" "reference covers test-journeys typo"
require_fixed "$REF" "normalization_applied" "reference defines normalization_applied context field"
require_fixed "$REF" "normalization_evidence" "reference defines normalization_evidence context field"
require_fixed "$REF" "Do Not" "reference includes guardrails against adding intent"

echo
echo "intent normalization routing: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
