#!/usr/bin/env bash
# Tier 1: Validate chain references are consistent.
# - Every chain.lanes.*.next and *.prev references a real skill in includedSkills
# - Lane skill lists in manifest match the chain positions declared in individual SKILL.md
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"

PASS=0
FAIL=0
ERRORS=""

# Get all included skills as a newline-separated list
INCLUDED_SKILLS=$(node -e "
  const m = require('$MANIFEST');
  m.includedSkills.forEach(s => console.log(s));
")

is_included() {
  echo "$INCLUDED_SKILLS" | grep -qx "$1"
}

# For each skill, validate chain.lanes prev/next references
for skill in $INCLUDED_SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ ! -f "$SKILL_FILE" ]] && continue

  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

  # Extract prev/next references from chain.lanes
  # Strip trailing commas, braces, spaces from YAML inline syntax
  CHAIN_REFS=$(echo "$FRONTMATTER" | grep -oP '(prev|next):\s*(\S+)' | sed 's/.*:\s*//; s/[,} ]*$//' | grep -v '^null$' || true)

  for ref in $CHAIN_REFS; do
    if ! is_included "$ref"; then
      ERRORS+="  FAIL: $skill — chain references '$ref' which is not in includedSkills\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  done
done

# Validate manifest laneDefinitions against individual skill chain declarations
LANES=$(node -e "
  const m = require('$MANIFEST');
  Object.keys(m.laneDefinitions || {}).forEach(l => console.log(l));
")

for lane in $LANES; do
  # Get skills listed in the lane from manifest
  LANE_SKILLS=$(node -e "
    const m = require('$MANIFEST');
    (m.laneDefinitions['$lane'].skills || []).forEach(s => console.log(s));
  ")

  for lane_skill in $LANE_SKILLS; do
    SKILL_FILE="$REPO_ROOT/skills/$lane_skill/SKILL.md"
    [[ ! -f "$SKILL_FILE" ]] && continue

    FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

    # Check if this skill declares membership in this lane
    if ! echo "$FRONTMATTER" | grep -q "$lane:"; then
      ERRORS+="  FAIL: $lane_skill listed in manifest lane '$lane' but doesn't declare that lane in frontmatter\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  done

  # Reverse check: skills that declare a lane but aren't in the manifest lane list
  # Pre-lane entry points (route-workflow) are exempt — they route INTO lanes
  # but are not part of the progressive skill chain within any lane.
  for skill in $INCLUDED_SKILLS; do
    SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
    [[ ! -f "$SKILL_FILE" ]] && continue

    FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

    if echo "$FRONTMATTER" | grep -q "^    $lane:"; then
      if [ "$skill" = "route-workflow" ]; then
        PASS=$((PASS + 1))
      elif ! echo "$LANE_SKILLS" | grep -qx "$skill"; then
        ERRORS+="  FAIL: $skill declares lane '$lane' in frontmatter but is not in manifest laneDefinitions.$lane.skills\n"
        FAIL=$((FAIL + 1))
      else
        PASS=$((PASS + 1))
      fi
    fi
  done
done

echo "=== Tier 1: Chain Reference Validation ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — all chain references valid"
  exit 0
fi
