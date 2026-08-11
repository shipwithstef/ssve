#!/usr/bin/env bash
# Tier 1: route-workflow must remain a compact hot-path router.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/route-workflow/SKILL.md"
DETAIL="$REPO_ROOT/skills/route-workflow/references/hot-path-operational-details.md"

total_lines="$(wc -l < "$SKILL" | tr -d ' ')"
failures=0

echo "=== Tier 1: route-workflow hot-path size ==="

if (( total_lines <= 220 )); then
  echo "  PASS - skills/route-workflow/SKILL.md is compact ($total_lines lines <= 220)"
else
  echo "  FAIL - skills/route-workflow/SKILL.md is too large ($total_lines lines > 220)"
  failures=$((failures + 1))
fi

if [[ -f "$DETAIL" ]]; then
  echo "  PASS - hot-path details reference exists"
else
  echo "  FAIL - hot-path details reference missing"
  failures=$((failures + 1))
fi

for ref in \
  "references/hot-path-operational-details.md" \
  "references/intent-normalization.md" \
  "references/intent-classification.md" \
  "references/lane-model.md" \
  "references/routing-rules.md" \
  "references/task-graph-protocol.md" \
  "references/decision-log.md" \
  "references/autorun-orchestrator.md"
do
  if grep -Fq "$ref" "$SKILL"; then
    echo "  PASS - SKILL.md references $ref"
  else
    echo "  FAIL - SKILL.md missing $ref"
    failures=$((failures + 1))
  fi
done

if (( failures > 0 )); then
  exit 1
fi
