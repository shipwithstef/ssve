#!/usr/bin/env bash
# Tier 1: Validate chain positions and next-skill ordering.
# - position matches at least one occurrence in manifest laneDefinitions
# - next is either null (terminal) or appears AFTER the skill in the manifest lane
# - framework lane is skipped (non-progressive, documentation-only positions)
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"

PASS=0
FAIL=0
ERRORS=""

LANES=$(node -e "
  const m = require('$MANIFEST');
  Object.keys(m.laneDefinitions || {}).forEach(l => console.log(l));
")

for lane in $LANES; do
  # Skip framework lane — positions are documentation-only, not progressive
  if [ "$lane" = "framework" ]; then
    continue
  fi

  # Build ordered array of skills for this lane
  LANE_SKILLS=$(node -e "
    const m = require('$MANIFEST');
    (m.laneDefinitions['$lane'].skills || []).forEach(s => console.log(s));
  ")

  declare -a SKILL_ARRAY=()
  while IFS= read -r s; do
    SKILL_ARRAY+=("$s")
  done <<< "$LANE_SKILLS"

  total=${#SKILL_ARRAY[@]}

  for ((i=0; i<total; i++)); do
    skill="${SKILL_ARRAY[$i]}"
    expected_pos=$((i + 1))

    SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
    [[ ! -f "$SKILL_FILE" ]] && continue

    FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

    # Check if this skill declares this lane
    if ! echo "$FRONTMATTER" | grep -q "$lane:"; then
      continue
    fi

    # Extract position
    actual_pos=$(echo "$FRONTMATTER" | grep -oP "$lane:\s*\{[^}]*position:\s*\d+" | grep -oP 'position:\s*\d+' | grep -oP '\d+' || true)

    # Extract next
    actual_next=$(echo "$FRONTMATTER" | grep -oP "$lane:\s*\{[^}]*next:\s*[^,}]+" | grep -oP 'next:\s*[^,}]+' | sed 's/next:\s*//; s/[,} ]*$//' || true)

    # Position check: must match at least one occurrence in the lane
    found_pos=false
    for ((j=0; j<total; j++)); do
      if [ "${SKILL_ARRAY[$j]}" = "$skill" ] && [ "$actual_pos" = "$((j + 1))" ]; then
        found_pos=true
        break
      fi
    done

    if [ -n "$actual_pos" ] && [ "$found_pos" = "false" ]; then
      ERRORS+="  FAIL: $skill — $lane position is $actual_pos, not found in manifest lane order\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi

    # Next check: must be null (terminal) or appear AFTER the matched position
    if [ -n "$actual_next" ] && [ "$actual_next" != "null" ]; then
      next_after=false
      start_idx=$expected_pos
      # If actual_pos was found, use that index for the after-check
      if [ "$found_pos" = "true" ]; then
        start_idx=$actual_pos
      fi
      for ((j=start_idx; j<total; j++)); do
        if [ "${SKILL_ARRAY[$j]}" = "$actual_next" ]; then
          next_after=true
          break
        fi
      done

      if [ "$next_after" = "false" ]; then
        ERRORS+="  FAIL: $skill — $lane next is '$actual_next', which does not appear after position $start_idx in manifest\n"
        FAIL=$((FAIL + 1))
      else
        PASS=$((PASS + 1))
      fi
    else
      PASS=$((PASS + 1))
    fi
  done
done

if [ $FAIL -gt 0 ]; then
  echo "=== Tier 1: Chain Position Validation ==="
  echo -e "$ERRORS"
  echo "$PASS passed, $FAIL failed"
  exit 1
else
  echo "=== Tier 1: Chain Position Validation ==="
  echo "  $PASS passed, $FAIL failed"
  echo "PASS — all chain positions and next-skills are consistent"
fi
