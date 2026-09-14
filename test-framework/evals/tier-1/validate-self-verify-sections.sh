#!/usr/bin/env bash
# Tier 1: Validate that every top-level skill declares self_verify: true and has
# a Self-Verify section containing a table with PASS/FAIL column.
# No LLM, <10s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PASS=0
FAIL=0
ERRORS=""

SKILLS=$(node --input-type=module - "$REPO_ROOT/skills-manifest.json" <<'JS'
import fs from 'node:fs';
const skills=JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).includedSkills;
if (!Array.isArray(skills) || !skills.length || skills.some(s=>typeof s !== 'string' || !/^[a-z0-9-]+$/.test(s))) throw new Error('invalid or empty skill registry');
console.log(skills.join('\n'));
JS
)

for skill in $SKILLS; do
  SKILL_FILE="$REPO_ROOT/skills/$skill/SKILL.md"
  if [[ ! -f "$SKILL_FILE" ]]; then
    ERRORS+="  FAIL: $skill — registered skill file missing\n"
    FAIL=$((FAIL + 1))
    continue
  fi

  FRONTMATTER=$(awk '/^---$/{n++; next} n==1{print} n>=2{exit}' "$SKILL_FILE")

  if ! grep -qE '^[[:space:]]*self_verify: true[[:space:]]*$' <<< "$FRONTMATTER"; then
    ERRORS+="  FAIL: $skill — missing required self_verify: true declaration\n"
    FAIL=$((FAIL + 1))
    continue
  fi

  # Must have a Self-Verify section (## or ### heading)
  if ! grep -qE '^#{2,3} Self-Verify' "$SKILL_FILE"; then
    ERRORS+="  FAIL: $skill — self_verify: true but missing 'Self-Verify' section\n"
    FAIL=$((FAIL + 1))
    continue
  fi

  # The Self-Verify section must contain a real table with criteria
  # Extract content after Self-Verify heading until next same-or-higher heading
  SELF_VERIFY_CONTENT=$(awk '/^#{2,3} Self-Verify/{found=1; next} found && /^#{2,3} /{exit} found{print}' "$SKILL_FILE")

  if ! grep -qE 'PASS|FAIL' <<< "$SELF_VERIFY_CONTENT"; then
    ERRORS+="  FAIL: $skill — Self-Verify section exists but has no PASS/FAIL column\n"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi

  # Check for table structure (pipe-delimited rows)
  if ! grep -qE '^\|' <<< "$SELF_VERIFY_CONTENT"; then
    ERRORS+="  FAIL: $skill — Self-Verify section has no table (expected | delimited rows)\n"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi

  # L2 substantive: table must have at least 3 data rows (not just header + separator)
  # Data rows: start with | but not the separator row (|---|)
  DATA_ROWS=$(grep -E '^\|' <<< "$SELF_VERIFY_CONTENT" | grep -vE '^\|[\s-]+\|' | grep -v '^| #' | grep -v '^| Check' | wc -l)
  if [[ "$DATA_ROWS" -lt 3 ]]; then
    ERRORS+="  FAIL: $skill — Self-Verify table has only $DATA_ROWS data rows (minimum 3 criteria expected)\n"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi

  # L2 substantive: each data row must have a non-empty "How" column
  # Typical format: | N | Check description | How to verify | PASS/FAIL |
  EMPTY_HOW=0
  while IFS= read -r row; do
    HOW_COL=$(echo "$row" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
    [[ -z "$HOW_COL" ]] && EMPTY_HOW=$((EMPTY_HOW + 1))
  done < <(grep -E '^\| [0-9]' <<< "$SELF_VERIFY_CONTENT" || true)
  if [[ "$EMPTY_HOW" -gt 0 ]]; then
    ERRORS+="  FAIL: $skill — Self-Verify table has $EMPTY_HOW rows with empty How column\n"
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi
done

echo "=== Tier 1: Self-Verify Section Validation ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — all self-verify sections valid"
  exit 0
fi
