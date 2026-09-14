#!/usr/bin/env bash
# Tier 1 — research skill pre-scope sub-agent gate.
#
# Per rules/research-must-use-agy-cli.md and WI-090, every pre-scope
# artifact at docs/specs/research-prescope-*.md MUST select agy-cli as
# primary OR cite a legitimate fallback reason if Claude was used.
#
# This validator scans the artifacts and FAILS if it finds an
# illegitimate rationalization. Goal: prevent the 2026-04-25 failure
# pattern (agent picked Claude up-front citing 'preserve agy quota').
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PRESCOPE_DIR="$REPO_ROOT/docs/specs"

PASS=0
FAIL=0
ERRORS=""

# Patterns that indicate a legitimate fallback reason
LEGITIMATE='((gemini-cli|agy-cli) (is )?(unavailable|not installed|not found|errored|failed|exhausted|auth(entication)? (expired|failure))|SVC_RESEARCH_AGENT|env override|primary (returned|exited) non-zero|partial coverage|stalled mid-pass|timed out|(gemini-cli|agy-cli) has actually failed|(gemini-cli|agy-cli) failed)'

# Illegitimate rationalizations (must NOT appear ANYWHERE in the artifact when Claude is selected)
ILLEGITIMATE='(preserve [a-z-]* quota|preserve (gemini|agy)|websearch is more reliable|faster for this|javascript-heavy|dynamic web content where websearch|already have the data|prefer claude|claude is better|burn it on this extraction|deliberate inversion of the WI-090 default)'

shopt -s nullglob
PRESCOPE_FILES=("$PRESCOPE_DIR"/research-prescope-*.md)

if [[ ${#PRESCOPE_FILES[@]} -eq 0 ]]; then
  echo "  validate-research-prescope-sub-agent: 0 pre-scope artifacts to check (PASS by vacuous-truth)"
  exit 0
fi

for f in "${PRESCOPE_FILES[@]}"; do
  basename=$(basename "$f")

  # First check: is there an illegitimate rationalization ANYWHERE in the artifact?
  # If so, fail regardless of how the agent was labelled.
  if grep -qiE "$ILLEGITIMATE" "$f"; then
    ERRORS+="  FAIL: $basename — pre-scope contains a rationalization matching forbidden pattern. See rules/research-must-use-agy-cli.md for legitimate reasons.\n"
    ERRORS+="    matched: $(grep -iE "$ILLEGITIMATE" "$f" | head -1 | head -c 200)\n"
    FAIL=$((FAIL+1))
    continue
  fi

  # Find a sub-agent declaration line — accept several phrasings
  SELECTED_LINE=$(grep -iE '(selected (for this run|sub-?agent|agent for this)|^- ?\*?\*?primary[: ]|^primary[: ]|primary: \*?\*?(gemini-cli|agy-cli|claude))' "$f" | head -1 || true)

  if [[ -z "$SELECTED_LINE" ]]; then
    echo "  WARN: $basename has no sub-agent declaration line; consider regenerating from prescope-template.md"
    PASS=$((PASS+1))
    continue
  fi

  SELECTED=$(echo "$SELECTED_LINE" | grep -oiE '(gemini-cli|agy-cli|claude|primary|fallback)' | head -1 | tr '[:upper:]' '[:lower:]')

  if [[ "$SELECTED" == "gemini-cli" || "$SELECTED" == "agy-cli" || "$SELECTED" == "primary" ]]; then
    PASS=$((PASS+1))
    continue
  fi

  # Non-primary selected — must cite a legitimate reason
  if grep -qiE "$LEGITIMATE" "$f"; then
    PASS=$((PASS+1))
  else
    echo "  WARN: $basename — non-primary sub-agent selected but no clear legitimate-fallback reason in artifact. Add one or switch to agy-cli."
    PASS=$((PASS+1))
  fi
done

echo ""
echo "  validate-research-prescope-sub-agent: $PASS passed, $FAIL failed (across ${#PRESCOPE_FILES[@]} artifacts)"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
