#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/resolve-skill-hint.mjs"
ROUTER="$REPO_ROOT/skills/route-workflow/SKILL.md"
REF="$REPO_ROOT/skills/route-workflow/references/intent-classification.md"
TASK_REF="$REPO_ROOT/skills/route-workflow/references/task-graph-protocol.md"
AUDIT="$REPO_ROOT/skills/audit-session-execution/SKILL.md"

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qE "$pattern" "$file"; then ok "$label"; else bad "$label"; fi
}

match_skill() {
  local text="$1"
  local skill="$2"
  local label="$3"
  if node "$HELPER" --text "$text" --manifest "$REPO_ROOT/skills-manifest.json" | grep -q "\"skill\": \"$skill\""; then
    ok "$label"
  else
    bad "$label"
  fi
}

echo "=== Tier 1: mid-task hint persistence ==="

node --check "$HELPER" >/dev/null && ok "skill hint resolver syntax valid" || bad "skill hint resolver syntax valid"
match_skill "use the test journey account for this verification" "test-journeys" "resolver maps test journey hint"
match_skill "do visual tracking before closeout" "track-visuals" "resolver maps visual tracking hint"
match_skill "use the qa skills you already have" "review-gate" "resolver maps qa skills to review-gate"
match_skill "use the qa skills you already have" "audit-implementation" "resolver maps qa skills to audit-implementation"

contains "$ROUTER" "mid_task_hints\\[\\]" "route-workflow records mid_task_hints"
contains "$REF" "mid_task_hints\\[\\]" "intent-classification defines mid_task_hints"
contains "$REF" "scripts/resolve-skill-hint\\.mjs" "intent-classification invokes skill hint resolver"
contains "$TASK_REF" "mid_task_hints\\[\\]" "task graph protocol defines mid_task_hints"
contains "$AUDIT" "artifact-count overreaction" "audit-session-execution checks artifact-count overreaction"

echo
echo "mid-task hint persistence: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
