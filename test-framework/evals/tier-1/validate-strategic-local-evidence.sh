#!/usr/bin/env bash
# Tier 1 validator: strategic decisions must scan local evidence before external research.
# Origin: WI-313.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

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
  local needle="$2"
  local label="$3"

  if grep -Fq "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

require_order() {
  local file="$1"
  local first="$2"
  local second="$3"
  local label="$4"
  local first_line
  local second_line

  first_line="$(grep -Fn "$first" "$file" | head -1 | cut -d: -f1 || true)"
  second_line="$(grep -Fn "$second" "$file" | head -1 | cut -d: -f1 || true)"

  if [[ -n "$first_line" && -n "$second_line" && "$first_line" -lt "$second_line" ]]; then
    pass "$label"
  else
    fail "$label"
  fi
}

STRATEGIC="skills/strategic-decision/SKILL.md"
REVIEWER="agents/strategic-reviewer.md"

echo "=== Tier 1: strategic local evidence discipline ==="

require_fixed "$STRATEGIC" "local evidence first, then gap-targeted external fetches" "strategic-decision Phase 1b names local-first research"
require_order "$STRATEGIC" "Before any WebSearch or external fetch, perform a local index scan." "If data is still missing after the local scan: use WebSearch inline" "strategic-decision orders local scan before WebSearch"
require_fixed "$STRATEGIC" 'docs/specs/research/*.md' "strategic-decision scans project research artifacts"
require_fixed "$STRATEGIC" 'references/knowledge/**/*.md' "strategic-decision scans framework knowledge artifacts"
require_fixed "$STRATEGIC" '.svc/pipeline-decisions.jsonl' "strategic-decision scans past pipeline decisions"
require_fixed "$STRATEGIC" "## Local Evidence Scan" "strategic-decision requires DIMENSIONS.md local evidence scan"
require_fixed "$STRATEGIC" "<= 90 days old and covers >=80%" "strategic-decision defines freshness and coverage gate"
require_fixed "$STRATEGIC" "file:line" "strategic-decision requires file:line local citations"
require_fixed "$STRATEGIC" "research must be gap-targeted" "strategic-decision limits external research to local gaps"
require_fixed "$STRATEGIC" "## Research Grounding" "DECISION.md template includes research grounding section"
require_fixed "$STRATEGIC" "Phase 1b local evidence scan happened before WebSearch" "strategic-decision self-verify checks local evidence before WebSearch"

require_fixed "$REVIEWER" "P-000" "strategic-reviewer defines P-000 local evidence finding"
require_fixed "$REVIEWER" "DIMENSIONS.md has a Local Evidence Scan before URL-only citations" "strategic-reviewer audits Local Evidence Scan ordering"
require_fixed "$REVIEWER" "topic-matching file existed under" "strategic-reviewer checks ignored local evidence"
require_fixed "$REVIEWER" "CRITICAL" "strategic-reviewer can escalate ignored local evidence as critical"

echo
echo "strategic local evidence discipline: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
