#!/usr/bin/env bash
# Tier 1: Validate lane dynamic handling — skip/NA conditions and new-lane detection.
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LANE_MODEL="$REPO_ROOT/skills/route-workflow/references/lane-model.md"
TASK_PROTOCOL="$REPO_ROOT/skills/route-workflow/references/task-graph-protocol.md"

PASS=0
FAIL=0
ERRORS=""

pass() {
  PASS=$((PASS + 1))
}

fail() {
  ERRORS+="  FAIL: $1\n"
  FAIL=$((FAIL + 1))
}

# --- 1. Lane-model skip/NA coverage ---
# Each lane (1-7) must document at least one skip or NA condition.
for lane in "Lane 1:" "Lane 2:" "Lane 3:" "Lane 4:" "Lane 5:" "Lane 6:" "Lane 7:"; do
  if grep -q "$lane" "$LANE_MODEL"; then
    pass
  else
    fail "lane-model.md missing $lane section"
  fi
done

# Lane 3 must document the pure-background skip for skills/design-ux/design-ui/track-visuals
if grep -q "Pure background Enabler/Integration work may explicitly skip" "$LANE_MODEL"; then
  pass
else
  fail "lane-model.md Lane 3 missing pure-background skip documentation"
fi

# Lane 5 must document skip when no src/ changes
if grep -q "only touched spec/doc files (no \`src/\` changes), skip with explicit justification" "$LANE_MODEL"; then
  pass
else
  fail "lane-model.md Lane 5 missing no-src-changes skip documentation"
fi

# Lane 6 must document browser-visible vs not-browser-visible skip
if grep -q "If NOT browser-visible: log an explicit \`SKIP: not browser-visible because" "$LANE_MODEL"; then
  pass
else
  fail "lane-model.md Lane 6 missing browser-visible skip documentation"
fi

# Lane 7 must document autorun vs human-checkpoint behavior per use case
if grep -q "Auto-execute if evidence exists. Human checkpoint if plan touches" "$LANE_MODEL"; then
  pass
else
  fail "lane-model.md Lane 7 missing autorun/human-checkpoint behavior table"
fi

# --- 2. Skill Self-Verify skip-justification checks ---
# Key skills that document skip conditions in their body must have a Self-Verify check.

check_skill_skip_verify() {
  local skill="$1"
  local skill_file="$REPO_ROOT/skills/$skill/SKILL.md"
  local label="$2"

  if [[ ! -f "$skill_file" ]]; then
    fail "$skill/SKILL.md not found"
    return
  fi

  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$skill_file")
  if ! echo "$FRONTMATTER" | grep -q "self_verify: true"; then
    # If self_verify is false, we can't require a Self-Verify check
    pass
    return
  fi

  SELF_VERIFY_CONTENT=$(awk '/^#{2,3} Self-Verify/{found=1; next} found && /^#{2,3} /{exit} found{print}' "$skill_file")
  if echo "$SELF_VERIFY_CONTENT" | grep -qiE 'skip justified|skip reason|skip documented|not applicable|N/A.*justified'; then
    pass
  else
    fail "$label missing skip/NA justification check in Self-Verify"
  fi
}

check_skill_skip_verify "design-ux" "design-ux (enabler/Integration skip)"
check_skill_skip_verify "design-ui" "design-ui (no-visual-surface skip)"
check_skill_skip_verify "execute-changeset" "execute-changeset (TDD skip)"
check_skill_skip_verify "track-visuals" "track-visuals (no-WI skip)"

# --- 3. New-lane necessity checks ---
# plan-changeset must have a Self-Verify check for new-lane detection.
PLAN_CHANGESET_SV=$(awk '/^#{2,3} Self-Verify/{found=1; next} found && /^#{2,3} /{exit} found{print}' "$REPO_ROOT/skills/plan-changeset/SKILL.md")
if echo "$PLAN_CHANGESET_SV" | grep -qiE 'new.lane needed|new lane needed|lane.*does not fit|does not fit.*lane'; then
  pass
else
  fail "plan-changeset Self-Verify missing new-lane necessity check"
fi

# route-workflow must have a Self-Verify check for new-lane detection.
ROUTE_SV=$(awk '/^#{2,3} Self-Verify/{found=1; next} found && /^#{2,3} /{exit} found{print}' "$REPO_ROOT/skills/route-workflow/SKILL.md")
if echo "$ROUTE_SV" | grep -qiE 'new.lane necessity|new lane necessity|lane.*needed'; then
  pass
else
  fail "route-workflow Self-Verify missing new-lane necessity check"
fi

# --- 4. Task-graph protocol skip_reason support ---
if grep -q "skip_reason" "$TASK_PROTOCOL"; then
  pass
else
  fail "task-graph-protocol.md missing skip_reason documentation"
fi

if grep -q "skip reasons, and resume" "$TASK_PROTOCOL"; then
  pass
else
  fail "task-graph-protocol.md missing skip_reason in source-of-truth contract"
fi

# --- Report ---
echo "=== Tier 1: Lane Dynamic Handling Validation ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — all lane dynamic handling checks valid"
  exit 0
fi
