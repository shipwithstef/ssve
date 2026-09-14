#!/usr/bin/env bash
# Tier-1 validator: route-workflow must distinguish mid-task method corrections
# from new goals. Origin: WI-201.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
ROUTER="$REPO_ROOT/skills/route-workflow/SKILL.md"
REF="$REPO_ROOT/skills/route-workflow/references/intent-classification.md"
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

echo "=== Tier 1: route-workflow mid-task correction routing ==="

require_fixed "$ROUTER" "### Mid-Task Correction Classification" "route-workflow has mid-task classification section"
require_fixed "$ROUTER" "references/intent-classification.md" "route-workflow links classification reference"
require_fixed "$ROUTER" "method-correction" "route-workflow names method-correction class"
require_fixed "$ROUTER" "minimum viable swap" "route-workflow requires minimum viable swap"
require_fixed "$ROUTER" "Do not start a new lane" "route-workflow blocks rerouting method corrections"
require_fixed "$ROUTER" "Run mid-task correction classification before" "intent-switch rule defers to classification"
require_fixed "$ROUTER" "mid_task_classification" "route-workflow requires classification audit field"
require_fixed "$ROUTER" "new_artifacts_allowed" "route-workflow records artifact permission"
require_fixed "$ROUTER" "| 12 | Mid-task correction classified" "self-verify covers mid-task correction"

require_fixed "$REF" "method-correction" "reference defines method-correction"
require_fixed "$REF" "scope-correction" "reference defines scope-correction"
require_fixed "$REF" "goal-change" "reference defines goal-change"
require_fixed "$REF" "status-question" "reference defines status-question"
require_fixed "$REF" "you have users with which you can do the full verifications" "reference covers source verification-account example"
require_fixed "$REF" "accounts per testjourney and visual tracking and qa skills" "reference covers source journey/visual example"
require_fixed "$REF" "do not author a new spec" "reference blocks over-engineered spec creation"
require_fixed "$REF" "A one-line credential swap must not" "reference pins minimum-swap heuristic"

echo
echo "mid-task correction routing: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
