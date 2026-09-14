#!/bin/bash
# validate-wi-closeout-evidence.sh — Tier-1 validator for WI-095.
# Hard close-out gate: every WI marked VERIFIED in DONE.md must have a
# consistent close-out footprint (WI frontmatter, INDEX row, git commit trail).
# Prevents the premature-completion failure mode observed across WI-077, -081,
# -073, -076, -065 where "done" was declared on faulty reasoning.
#
# v1 scope — framework lane. URL-Playwright portion of WI-095 is deferred
# until WI-097 (browser-verify wrapper) lands.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

VERIFY="$REPO_ROOT/scripts/verify-wi-closeout.mjs"
DONE="$REPO_ROOT/docs/specs/work-items/DONE.md"

echo "=== Tier 1: WI Close-Out Evidence Validation ==="

if [ ! -f "$DONE" ]; then
  echo "  SKIP — DONE.md not present"
  exit 0
fi
if [ ! -f "$VERIFY" ]; then
  echo "  FAIL — scripts/verify-wi-closeout.mjs missing"
  exit 1
fi

PASS=0
FAIL=0
FAILS=()

# Extract every WI-NNN listed in DONE.md (skip the header row).
WI_LIST=$(grep -oE '\[WI-[0-9]+\]' "$DONE" | sort -u | sed 's/\[//; s/\]//')

if [ -z "$WI_LIST" ]; then
  echo "  SKIP — DONE.md has no WI rows"
  exit 0
fi

for WI in $WI_LIST; do
  if node "$VERIFY" "$WI" > /dev/null 2> /tmp/wi-closeout-err.$$; then
    echo "  ✓ $WI close-out consistent"
    PASS=$((PASS+1))
  else
    FIRST_ERR=$(head -1 /tmp/wi-closeout-err.$$ 2>/dev/null || echo "unknown failure")
    echo "  ✗ $WI — $FIRST_ERR"
    FAILS+=("$WI: $FIRST_ERR")
    FAIL=$((FAIL+1))
  fi
done

rm -f /tmp/wi-closeout-err.$$

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS closed WIs have consistent close-out artifacts"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  for e in "${FAILS[@]}"; do echo "    - $e"; done
  exit 1
fi
