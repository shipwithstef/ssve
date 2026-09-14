#!/usr/bin/env bash
# Tier 1: Lane 7 must declare mandatory review-gate surfaces for risky framework work.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LANE_MODEL="$REPO_ROOT/skills/route-workflow/references/lane-model.md"

failures=0

require_pattern() {
  local pattern="$1"
  local label="$2"

  if grep -Fq "$pattern" "$LANE_MODEL"; then
    printf '  PASS - %s\n' "$label"
  else
    printf '  FAIL - %s\n' "$label"
    failures=$((failures + 1))
  fi
}

echo "=== Tier 1: Framework Review-Gate Policy ==="

require_pattern "#### Framework Review-Gate Policy (Lane 7)" "Lane 7 has an explicit framework review-gate policy"
require_pattern "tier-1 validators" "tier-1 validators are listed as requiring review-gate"
require_pattern "Stop hooks" "Stop hooks are listed as requiring review-gate"
require_pattern "files under \`hooks/\`" "hooks/ changes are listed as requiring review-gate"
require_pattern "references-only" "references-only low-risk skip path is documented"
require_pattern "fixtures-only" "fixtures-only low-risk skip path is documented"
require_pattern ".svc/pipeline-decisions.jsonl" "skip justification must be logged"
require_pattern "metadata.skill: \"review-gate\"" "task graph docs require metadata.skill review-gate binding"
require_pattern "\"skill\": \"review-gate\"" "task graph example includes review-gate skill metadata"

if (( failures > 0 )); then
  echo "Framework review-gate policy validation failed with $failures issue(s)."
  exit 1
fi

echo "  PASS - framework review-gate policy is documented and mechanically checked"
