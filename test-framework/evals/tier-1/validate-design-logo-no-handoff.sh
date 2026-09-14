#!/usr/bin/env bash
# validate-design-logo-no-handoff.sh
# Tier-1 validator: ensures skills/design-logo/SKILL.md contains no forbidden handoff phrases.
# Enforces WI-141 AC-01 + AC-11.

set -euo pipefail

SKILL="skills/design-logo/SKILL.md"

if [[ ! -f "$SKILL" ]]; then
  echo "FAIL: $SKILL not found"
  exit 1
fi

FORBIDDEN=(
  "hire a designer"
  "designer handoff"
  "AI ceiling"
  "human designer"
  "external designer"
  "Designer-handoff brief"
)

EXIT_CODE=0
# Split at Self-Verify table — check 11b legitimately mentions phrases as things to avoid
BODY=$(sed '/## Self-Verify/,$d' "$SKILL")
for phrase in "${FORBIDDEN[@]}"; do
  if echo "$BODY" | grep -qi "$phrase"; then
    echo "FAIL: forbidden phrase found in $SKILL body (before Self-Verify): '$phrase'"
    EXIT_CODE=1
  fi
done

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "PASS: no forbidden handoff phrases in $SKILL"
fi

exit $EXIT_CODE
