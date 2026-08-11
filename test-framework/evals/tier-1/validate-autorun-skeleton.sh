#!/usr/bin/env bash
# Tier-1: validate route-workflow autorun skeleton documents the required
# behaviors per references/autorun-contract.md. Static check (no LLM).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/route-workflow/SKILL.md"
ORCH="$REPO_ROOT/skills/route-workflow/references/autorun-orchestrator.md"
CONTRACT="$REPO_ROOT/references/autorun-contract.md"

PASS=0; FAIL=0

check() {
  local label="$1" file="$2" pattern="$3"
  if [ ! -f "$file" ]; then
    echo "  ✗ $label: source file $file missing"
    FAIL=$((FAIL+1))
    return
  fi
  if grep -qiE "$pattern" "$file"; then
    echo "  ✓ $label"
    PASS=$((PASS+1))
  else
    echo "  ✗ $label: pattern not found in $(basename "$file")"
    FAIL=$((FAIL+1))
  fi
}

# 1. Lane selection mention in SKILL.md
check "lane selection mentioned in skills/route-workflow/SKILL.md" \
  "$SKILL" "lane[- ]selection|select.*lane|choose.*lane|lane.*model"

# 2. Lane-tasks file creation mentioned in autorun-orchestrator.md (or SKILL.md)
if grep -qiE "lane-tasks|lane_tasks|task graph|task-graph" "$ORCH" 2>/dev/null; then
  echo "  ✓ lane-tasks file creation mentioned in autorun-orchestrator.md"
  PASS=$((PASS+1))
elif grep -qiE "lane-tasks|lane_tasks|task graph" "$SKILL"; then
  echo "  ✓ lane-tasks file creation mentioned in SKILL.md"
  PASS=$((PASS+1))
else
  echo "  ✗ lane-tasks file creation not mentioned in route-workflow"
  FAIL=$((FAIL+1))
fi

# 3. human-checkpoint behavior
if grep -qiE "human[_ -]checkpoint|human checkpoint|human-in-the-loop" "$ORCH" "$SKILL" 2>/dev/null; then
  echo "  ✓ human-checkpoint behavior referenced"
  PASS=$((PASS+1))
else
  echo "  ✗ human-checkpoint behavior not referenced in route-workflow"
  FAIL=$((FAIL+1))
fi

# 4. autorun contract document exists
if [ -f "$CONTRACT" ]; then
  echo "  ✓ references/autorun-contract.md exists"
  PASS=$((PASS+1))
else
  echo "  ✗ references/autorun-contract.md missing"
  FAIL=$((FAIL+1))
fi

# 5. autorun-contract documents autorun:true tagging in decisions
if grep -qiE "autorun.*true|autorun=true|autorun:[[:space:]]*true" "$CONTRACT" 2>/dev/null; then
  echo "  ✓ autorun:true decision-log tagging documented"
  PASS=$((PASS+1))
else
  echo "  ✗ autorun:true decision-log tagging not documented in autorun-contract.md"
  FAIL=$((FAIL+1))
fi

echo ""
echo "validate-autorun-skeleton: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
