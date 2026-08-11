#!/usr/bin/env bash
# Tier 1: Validate that decision-heavy skills reference the pipeline decision log.
# The 7 key skills that make taste/gate decisions during a pipeline run MUST
# contain instructions to call scripts/pipeline-log.mjs or reference
# pipeline-decisions.jsonl. Without this, auto-mode runs produce no audit trail.
#
# Evidence: Valluri ran 11 skills in auto mode (2026-04-12), zero decision log entries.
#
# No LLM, <5s. Exit 0 if all pass, 1 if any fail.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

PASS=0
FAIL=0
ERRORS=""

# Skills that MUST reference the decision log
REQUIRED_SKILLS=(
  "route-workflow"
  "validate-feature"
  "build-personas"
  "write-spec"
  "design-tech"
  "plan-changeset"
  "land-changeset"
  "quick-fix"
)

for skill in "${REQUIRED_SKILLS[@]}"; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  if [ ! -f "$SKILL_FILE" ]; then
    ERRORS+="  FAIL: $skill/SKILL.md does not exist\n"
    FAIL=$((FAIL + 1))
    continue
  fi

  # Check for pipeline-log.mjs invocation OR pipeline-decisions.jsonl reference
  if grep -q 'pipeline-log\.mjs\|pipeline-decisions\.jsonl' "$SKILL_FILE"; then
    PASS=$((PASS + 1))
  else
    ERRORS+="  FAIL: $skill/SKILL.md has no decision logging reference (pipeline-log.mjs or pipeline-decisions.jsonl)\n"
    FAIL=$((FAIL + 1))
  fi
done

echo "validate-decision-logging: $PASS passed, $FAIL failed"
if [ $FAIL -gt 0 ]; then
  echo -e "$ERRORS"
  exit 1
fi
exit 0
