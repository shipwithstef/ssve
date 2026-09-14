#!/usr/bin/env bash
# Tier 1: Validate every SKILL.md has required frontmatter fields and sections.
# No LLM, <10s. Exit 0 if all pass, 1 if any fail.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"

PASS=0
FAIL=0
ERRORS=""
WARNINGS=""
WARN=0

# WI-CLN-15 (plan §3.3): version-field enforcement mode.
#   "advisory" — missing `version` warns but does not fail (Step 3.3a)
#   "blocking" — missing `version` fails the eval (Step 3.3b, after 82-file backfill)
VERSION_CHECK_MODE="blocking"

# Skills exempt from Pipeline Continuation section
EXEMPT_PIPELINE=("route-workflow" "test-framework")

# Skills that must have Audit Mode section (15 skills)
AUDIT_SKILLS=(
  "write-vision"
  "validate-feature"
  "write-spec"
  "write-journeys"
  "design-ux"
  "design-ui"
  "design-tech"
  "write-e2e"
  "analyze-domain"
  "analyze-competitors"
  "define-code-style"
  "explore-solutions"
  "audit-implementation"
  "track-visuals"
  "extract-bootstrap"
)

is_exempt_pipeline() {
  local skill="$1"
  for exempt in "${EXEMPT_PIPELINE[@]}"; do
    [[ "$skill" == "$exempt" ]] && return 0
  done
  return 1
}

should_have_audit() {
  local skill="$1"
  for a in "${AUDIT_SKILLS[@]}"; do
    [[ "$skill" == "$a" ]] && return 0
  done
  return 1
}

# Get all skills from manifest
SKILLS=$(node -e "
  const m = require('$MANIFEST');
  m.includedSkills.forEach(s => console.log(s));
")

for skill in $SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"

  if [[ ! -f "$SKILL_FILE" ]]; then
    ERRORS+="  FAIL: $skill — SKILL.md not found\n"
    FAIL=$((FAIL + 1))
    continue
  fi

  # Extract frontmatter (between first two --- lines)
  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

  # Check required frontmatter fields exist
  for field in name description inputs outputs chain; do
    if ! grep -q "^${field}:" <<< "$FRONTMATTER"; then
      ERRORS+="  FAIL: $skill — missing frontmatter field: $field\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  done

  # version: SKILL.md contract version (WI-CLN-15 / plan §3.3).
  # Advisory in 3.3a; blocking in 3.3b after the 82-file backfill.
  if ! grep -q "^version:" <<< "$FRONTMATTER"; then
    if [[ "$VERSION_CHECK_MODE" == "blocking" ]]; then
      ERRORS+="  FAIL: $skill — missing frontmatter field: version\n"
      FAIL=$((FAIL + 1))
    else
      WARNINGS+="  WARN: $skill — missing frontmatter field: version (advisory)\n"
      WARN=$((WARN + 1))
    fi
  else
    PASS=$((PASS + 1))
  fi

  # L2 substantive checks: values are real, not empty stubs

  # name: must match directory name
  DECLARED_NAME=$(grep "^name:" <<< "$FRONTMATTER" | sed 's/^name:\s*//')
  if [[ -n "$DECLARED_NAME" && "$DECLARED_NAME" != "$skill" ]]; then
    ERRORS+="  FAIL: $skill — name '$DECLARED_NAME' does not match directory name\n"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi

  # description: must be non-empty (not just "description:" or "description: >")
  DESC_LINE=$(grep "^description:" <<< "$FRONTMATTER" | head -1)
  DESC_VALUE=$(echo "$DESC_LINE" | sed 's/^description:\s*//')
  if [[ -z "$DESC_VALUE" || "$DESC_VALUE" == ">" || "$DESC_VALUE" == "|" ]]; then
    # Multi-line description — check that next line has content
    NEXT_LINE=$(grep -A1 "^description:" <<< "$FRONTMATTER" | tail -1 | sed 's/^\s*//')
    if [[ -z "$NEXT_LINE" ]]; then
      ERRORS+="  FAIL: $skill — description is empty\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  else
    PASS=$((PASS + 1))
  fi

  # inputs: must have required: sub-key
  if grep -q "^inputs:" <<< "$FRONTMATTER"; then
    if ! grep -q "required:" <<< "$FRONTMATTER"; then
      ERRORS+="  FAIL: $skill — inputs section missing 'required:' sub-key\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  fi

  # outputs: must have produces: sub-key
  if grep -q "^outputs:" <<< "$FRONTMATTER"; then
    if ! grep -q "produces:" <<< "$FRONTMATTER"; then
      ERRORS+="  FAIL: $skill — outputs section missing 'produces:' sub-key\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  fi

  # chain: must have lanes: sub-key
  if grep -q "^chain:" <<< "$FRONTMATTER"; then
    if ! grep -q "lanes:" <<< "$FRONTMATTER"; then
      ERRORS+="  FAIL: $skill — chain section missing 'lanes:' sub-key\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  fi

  # Check Pipeline Continuation section (unless exempt)
  if ! is_exempt_pipeline "$skill"; then
    if ! grep -q "## Pipeline Continuation" "$SKILL_FILE"; then
      ERRORS+="  FAIL: $skill — missing '## Pipeline Continuation' section\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  else
    PASS=$((PASS + 1))  # exempt, auto-pass
  fi

  # Check Audit Mode section for skills that should have it
  if should_have_audit "$skill"; then
    if ! grep -q "## Audit Mode" "$SKILL_FILE"; then
      ERRORS+="  FAIL: $skill — missing '## Audit Mode' section\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  fi
done

echo "=== Tier 1: Skill Structure Validation ==="
echo "  $PASS passed, $FAIL failed, $WARN advisory"
if [[ $WARN -gt 0 ]]; then
  printf "$WARNINGS"
fi
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — all skills have required structure"
  exit 0
fi
