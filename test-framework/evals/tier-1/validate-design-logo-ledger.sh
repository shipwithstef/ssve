#!/usr/bin/env bash
# validate-design-logo-ledger.sh
# Tier-1 validator: ensures concept-ledger.md exists and follows round-mode rules.
# Enforces WI-141 AC-02 + AC-06.

set -euo pipefail

LEDGER_PATTERN="docs/specs/logo-pack/concept-ledger.md"

# Find any concept-ledger.md in the project
LEDGER=$(find . -path "*/$LEDGER_PATTERN" -print -quit 2>/dev/null || true)

if [[ -z "${LEDGER:-}" ]]; then
  # No active logo run found — pass vacuously
  echo "PASS: no active logo-pack ledger found (no-op)"
  exit 0
fi

EXIT_CODE=0

# Check YAML frontmatter keys
for key in round mode concepts_introduced concepts_advanced new_concepts_allowed_next_round; do
  if ! grep -q "^$key:" "$LEDGER"; then
    echo "FAIL: ledger missing required key: $key"
    EXIT_CODE=1
  fi
done

# Check mode values
MODE=$(grep "^mode:" "$LEDGER" | head -1 | sed 's/.*: *//' | tr -d ' ')
if [[ -n "$MODE" && ! "$MODE" =~ ^(exploration|refinement|polish|terminal)$ ]]; then
  echo "FAIL: ledger mode '$MODE' is not one of: exploration, refinement, polish, terminal"
  EXIT_CODE=1
fi

# If round > 2, new_concepts_allowed_next_round must be 0
ROUND=$(grep "^round:" "$LEDGER" | head -1 | sed 's/.*: *//' | tr -d ' ')
if [[ -n "$ROUND" && "$ROUND" -gt 2 ]]; then
  ALLOWED=$(grep "^new_concepts_allowed_next_round:" "$LEDGER" | head -1 | sed 's/.*: *//' | tr -d ' ')
  if [[ "${ALLOWED:-1}" != "0" ]]; then
    echo "FAIL: round=$ROUND > 2 but new_concepts_allowed_next_round != 0"
    EXIT_CODE=1
  fi
fi

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "PASS: concept ledger valid ($LEDGER)"
fi

exit $EXIT_CODE
