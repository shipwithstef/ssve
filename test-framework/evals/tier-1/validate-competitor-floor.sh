#!/usr/bin/env bash
# Tier-1 (WI-143): Competitor floor validation.
#
# Asserts that analyze-competitors.data.json contains >=30 competitor entries
# OR has landscape_state: nascent|none-found with justification.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FAIL=0
PASS=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: Competitor Floor Validation ==="

DATA_FILE="$REPO_ROOT/references/knowledge/competitors/analyze-competitors.data.json"
INDEX_FILE="$REPO_ROOT/references/knowledge/competitors/index.md"

# If data file does not exist, check index.md for landscape_state
if [ ! -f "$DATA_FILE" ]; then
  if [ -f "$INDEX_FILE" ]; then
    if grep -qiE "landscape_state.*nascent|landscape_state.*none-found|Landscape state.*nascent|Landscape state.*none-found" "$INDEX_FILE"; then
      pass "No data.json but index.md declares nascent/none-found landscape"
    else
      fail "No analyze-competitors.data.json and no landscape_state justification in index.md"
    fi
  else
    fail "No analyze-competitors.data.json and no index.md"
  fi
  echo ""
  if [ "$FAIL" = 0 ]; then
    echo "PASS — $PASS checks passed"
    exit 0
  else
    echo "FAIL — $FAIL issues"
    exit 1
  fi
fi

# Count competitor entries in data.json
COUNT=$(python3 -c "import json; d=json.load(open('$DATA_FILE')); print(len(d.get('competitors', [])))" 2>/dev/null || echo "0")

if [ "$COUNT" -ge 30 ]; then
  pass "competitor count >= 30 ($COUNT)"
else
  # Check for justified nascent/none-found
  if [ -f "$INDEX_FILE" ] && grep -qiE "landscape_state:\s*(nascent|none-found)" "$INDEX_FILE"; then
    pass "competitor count < 30 ($COUNT) but landscape_state justifies lower count"
  else
    fail "competitor count < 30 ($COUNT) and no landscape_state justification"
  fi
fi

echo ""
if [ "$FAIL" = 0 ]; then
  echo "PASS — $PASS checks passed"
  exit 0
else
  echo "FAIL — $FAIL issues"
  exit 1
fi
