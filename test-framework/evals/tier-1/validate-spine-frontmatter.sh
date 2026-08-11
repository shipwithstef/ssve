#!/usr/bin/env bash
# Tier 1: Validate Knowledge Spine frontmatter fields (optional) — when a skill
# declares requires_topics / produces_topics / recall_depth / idempotent, check
# their shape. Skills that don't declare them are unaffected.
#
# Source: proposals/done/2026-04-30-infra-project-support.md § 3.2
#         WI-SPINE-001 deliverable 4
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"

PASS=0
FAIL=0
ERRORS=""
VALID_DEPTHS="layer-1 layer-2 layer-3 escalate"
VALID_IDEMPOTENT="true false once-only"

SKILLS=$(node -e "const m=require('$MANIFEST'); m.includedSkills.forEach(s=>console.log(s));")

for skill in $SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ -f "$SKILL_FILE" ]] || continue

  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

  # recall_depth — must be one of the 4 allowed values when present
  if echo "$FRONTMATTER" | grep -qE "^recall_depth:"; then
    val=$(echo "$FRONTMATTER" | grep -E "^recall_depth:" | sed 's/^recall_depth:[[:space:]]*//' | tr -d '"' | tr -d "'" | xargs)
    if ! echo "$VALID_DEPTHS" | tr ' ' '\n' | grep -qx "$val"; then
      ERRORS+="  FAIL: $skill — recall_depth='$val' invalid (allowed: $VALID_DEPTHS)\n"
      FAIL=$((FAIL+1))
    else
      PASS=$((PASS+1))
    fi
  fi

  # idempotent — must be true|false|once-only when present
  if echo "$FRONTMATTER" | grep -qE "^idempotent:"; then
    val=$(echo "$FRONTMATTER" | grep -E "^idempotent:" | sed 's/^idempotent:[[:space:]]*//' | tr -d '"' | tr -d "'" | xargs)
    if ! echo "$VALID_IDEMPOTENT" | tr ' ' '\n' | grep -qx "$val"; then
      ERRORS+="  FAIL: $skill — idempotent='$val' invalid (allowed: $VALID_IDEMPOTENT)\n"
      FAIL=$((FAIL+1))
    else
      PASS=$((PASS+1))
    fi
  fi

  # requires_topics / produces_topics — when present must be arrays (start with [ on same line, OR YAML list)
  for field in requires_topics produces_topics; do
    if echo "$FRONTMATTER" | grep -qE "^${field}:"; then
      line=$(echo "$FRONTMATTER" | grep -E "^${field}:" | sed "s/^${field}:[[:space:]]*//")
      # Accept: empty list `[]`, inline `[a, b]`, or YAML list (next line starts with `  -`)
      if [[ -z "$line" ]] || [[ "$line" == "[]" ]] || [[ "$line" =~ ^\[.*\]$ ]]; then
        PASS=$((PASS+1))
      else
        # check if it's followed by indented YAML list
        if echo "$FRONTMATTER" | grep -A1 "^${field}:" | tail -1 | grep -qE "^[[:space:]]+-"; then
          PASS=$((PASS+1))
        else
          ERRORS+="  FAIL: $skill — $field must be an array (empty [] OK)\n"
          FAIL=$((FAIL+1))
        fi
      fi
    fi
  done
done

echo "validate-spine-frontmatter: $PASS pass, $FAIL fail"
if [[ -n "$ERRORS" ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0

# Cap: requires_topics[] length must be <=8 per skill (proposal §12 risk mitigation)
# Done as a second pass for clarity
for skill in $SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  [[ -f "$SKILL_FILE" ]] || continue
  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")
  if echo "$FRONTMATTER" | grep -qE "^requires_topics:"; then
    line=$(echo "$FRONTMATTER" | grep -E "^requires_topics:" | sed "s/^requires_topics:[[:space:]]*//")
    count=0
    if [[ "$line" =~ ^\[(.*)\]$ ]]; then
      inner="${BASH_REMATCH[1]}"
      [[ -n "$inner" ]] && count=$(echo "$inner" | tr ',' '\n' | wc -l)
    else
      # YAML list — count indented `-` lines after the field
      count=$(awk -v field="^requires_topics:" 'BEGIN{found=0} $0 ~ field {found=1; next} found==1 && /^[[:space:]]+-/ {n++} found==1 && !/^[[:space:]]+-/ && !/^$/ {exit} END{print n+0}' <<< "$FRONTMATTER")
    fi
    if (( count > 8 )); then
      echo "FAIL: $skill — requires_topics[] has $count entries (cap is 8)" >&2
      exit 1
    fi
  fi
done
