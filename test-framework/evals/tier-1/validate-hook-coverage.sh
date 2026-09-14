#!/usr/bin/env bash
# Tier-1: validate hook coverage spec is in sync with hooks/hooks.json.
# Parses hooks/hook-coverage-spec.md for events with posture=block|warn AND
# Wired?=Yes; asserts each event has at least one entry in hooks.json.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SPEC="$REPO_ROOT/hooks/hook-coverage-spec.md"
HOOKS_JSON="$REPO_ROOT/hooks/hooks.json"

if [ ! -f "$SPEC" ]; then
  echo "FAIL: missing $SPEC" >&2
  exit 1
fi
if [ ! -f "$HOOKS_JSON" ]; then
  echo "FAIL: missing $HOOKS_JSON" >&2
  exit 1
fi

PASS=0; FAIL=0

# Extract required events from spec table: rows with posture in {block,warn} AND Wired?=Yes
REQUIRED=$(awk -F'|' '
  /^\|[[:space:]]*[A-Z][A-Za-z]+[[:space:]]*\|/ {
    event=$2; posture=$3; wired=$4;
    gsub(/^[ \t]+|[ \t]+$/, "", event);
    gsub(/^[ \t]+|[ \t]+$/, "", posture);
    gsub(/^[ \t]+|[ \t]+$/, "", wired);
    if ((posture == "block" || posture == "warn") && wired == "Yes") {
      print event;
    }
  }
' "$SPEC")

if [ -z "$REQUIRED" ]; then
  echo "FAIL: no required events parsed from $SPEC" >&2
  exit 1
fi

for event in $REQUIRED; do
  # Use node to robustly check the event key exists with at least one entry
  found=$(node -e "
const j = JSON.parse(require('fs').readFileSync('$HOOKS_JSON','utf8'));
const arr = (j.hooks||{})['$event'];
process.stdout.write(Array.isArray(arr) && arr.length>0 ? 'yes' : 'no');
")
  if [ "$found" = "yes" ]; then
    echo "  ✓ $event wired in hooks.json"
    PASS=$((PASS+1))
  else
    echo "  ✗ $event REQUIRED by spec but missing from hooks.json"
    FAIL=$((FAIL+1))
  fi
done

echo ""
echo "validate-hook-coverage: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
