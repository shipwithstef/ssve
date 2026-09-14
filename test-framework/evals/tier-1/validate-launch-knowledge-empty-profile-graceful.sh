#!/usr/bin/env bash
# Tier 1 — launch-knowledge empty-profile graceful handling (WI-126 AC-06 + AC-09).
#
# Verifies the launch-knowledge SKILL.md contains an explicit "empty profile"
# handling clause AND forbids placeholder strings from being expected outputs.
#
# AC-06: skill works GREAT with EMPTY ~/.svc/founder-profile.md — outputs
#        generic best-practice advice, no errors, no degraded UX.
#
# Exit 0 = clause present + no placeholder advice in the skill body.
# Exit 1 = clause absent OR forbidden placeholder pattern present.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL_FILE="$REPO_ROOT/skills/launch-knowledge/SKILL.md"

PASS=0
FAIL=0
ERRORS=""

if [[ ! -f "$SKILL_FILE" ]]; then
  echo ""
  echo "  launch-knowledge-empty-profile-graceful: skipped (SKILL.md not present)"
  exit 0
fi

# 1. Required clause: must mention empty-profile graceful handling.
#    Accept either of two heading shapes:
#      - "## Empty-profile graceful handling"
#      - section/paragraph mentioning AC-06 + an explicit empty/missing-profile rule
if grep -qiE "Empty-profile graceful handling|empty.*profile.*MUST.*still produce|missing.*founder-profile" "$SKILL_FILE"; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: SKILL.md missing explicit empty-profile graceful clause (AC-06)\n"
  ERRORS+="        Expected: a section titled 'Empty-profile graceful handling' or\n"
  ERRORS+="        equivalent prose stating outputs MUST still produce when profile is missing.\n"
  FAIL=$((FAIL+1))
fi

# 2. Required reference to fixtures (AC-07 — profile bias verification).
if grep -qE "fixture-bg-above-cap-solo|fixture-us-llc-dual-cofounder" "$SKILL_FILE"; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: SKILL.md does not reference the AC-07 fixtures by name\n"
  ERRORS+="        Expected: mention of fixture-bg-above-cap-solo and fixture-us-llc-dual-cofounder\n"
  FAIL=$((FAIL+1))
fi

# 3. Forbidden patterns: SKILL.md must NOT instruct outputs to contain placeholder
#    strings the AC-06 prose explicitly bans. Detect literal placeholder advice.
FORBIDDEN_PATTERNS=(
  '<TODO: ask user>'
  '<jurisdiction>.*placeholder'
  '\[FILL IN\]'
)

# We allow the patterns to APPEAR if they are in a "MUST NOT contain" instruction.
# Heuristic: a forbidden literal is OK only on a line that also contains MUST NOT
# (or NOT) — i.e., the SKILL.md is forbidding it, not requiring it.
for pat in "${FORBIDDEN_PATTERNS[@]}"; do
  # collect lines with the pattern
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    if ! grep -qE "MUST NOT|NEVER|forbidden|ban" <<<"$line"; then
      ERRORS+="  FAIL: SKILL.md contains forbidden placeholder advice not in a NOT-clause:\n"
      ERRORS+="        Pattern: $pat\n"
      ERRORS+="        Line: $line\n"
      FAIL=$((FAIL+1))
    fi
  done < <(grep -nE "$pat" "$SKILL_FILE" || true)
done
PASS=$((PASS+1))

# 4. Validator self-test: verify the validator caught its own required structure.
if grep -q "AC-06" "$SKILL_FILE"; then
  PASS=$((PASS+1))
else
  ERRORS+="  FAIL: SKILL.md does not reference AC-06 by name\n"
  FAIL=$((FAIL+1))
fi

echo ""
echo "  launch-knowledge-empty-profile-graceful: $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
