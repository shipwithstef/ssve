#!/usr/bin/env bash
# Tier 1: Validate progressive flag consistency.
# - progressive: true requires at least one lane entry (non-empty lanes)
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"

PASS=0
FAIL=0
ERRORS=""

INCLUDED_SKILLS=$(node -e "
  const m = require('$MANIFEST');
  m.includedSkills.forEach(s => console.log(s));
")

for skill in $INCLUDED_SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ ! -f "$SKILL_FILE" ]] && continue

  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

  IS_PROGRESSIVE=$(echo "$FRONTMATTER" | grep -oP 'progressive:\s*(true|false)' | grep -oP '(true|false)' || true)

  # Count lane entries: look for "<lane-name>:" lines under the lanes: block
  # A non-empty lanes block has at least one lane key with a { ... } value
  LANE_COUNT=$(echo "$FRONTMATTER" | grep -oP '^\s+[\w-]+:\s*\{' | wc -l || true)

  if [ "$IS_PROGRESSIVE" = "true" ] && [ "$LANE_COUNT" -eq 0 ]; then
    ERRORS+="  FAIL: $skill — progressive: true but lanes is empty\n"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi
done

if [ $FAIL -gt 0 ]; then
  echo "=== Tier 1: Progressive Consistency Validation ==="
  echo -e "$ERRORS"
  echo "$PASS passed, $FAIL failed"
  exit 1
else
  echo "=== Tier 1: Progressive Consistency Validation ==="
  echo "  $PASS passed, $FAIL failed"
  echo "PASS — all progressive skills declare non-empty lanes"
fi
