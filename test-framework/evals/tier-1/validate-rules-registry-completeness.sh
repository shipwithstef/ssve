#!/bin/bash
# validate-rules-registry-completeness.sh — WI-078 tier-1 validator.
#
# Asserts every rules/**/*.md file on disk has a matching entry in
# skills-manifest.json rulesRegistry.entries[].path.
#
# Catches the silent-bookkeeping gap where a new rule file is added to
# rules/ but the committer forgets to register it in skills-manifest.json,
# causing scripts/lint-skills-manifest.mjs to fail at an unrelated time.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: rules registry completeness (WI-078) ==="

[ -r "$REPO_ROOT/skills-manifest.json" ] && pass "skills-manifest.json present" || { fail "skills-manifest.json missing"; exit 1; }

# List all rules/**/*.md on disk
RULES_ON_DISK=$(find "$REPO_ROOT/rules" -type f -name "*.md" 2>/dev/null | sed "s|^$REPO_ROOT/||" | sort)

if [ -z "$RULES_ON_DISK" ]; then
  pass "no rules/ files on disk (vacuously consistent)"
  echo ""
  echo "  PASS — all $PASS assertions passed"
  exit 0
fi

TOTAL=$(echo "$RULES_ON_DISK" | wc -l)
pass "rules/ scan found $TOTAL file(s)"

# Extract registry paths from skills-manifest.json
RULES_IN_REGISTRY=$(python3 -c "
import json
with open('$REPO_ROOT/skills-manifest.json') as f: m = json.load(f)
entries = m.get('rulesRegistry', {}).get('entries', [])
for e in entries:
    p = e.get('path', '')
    if p: print(p)
" | sort)

REGISTERED_COUNT=$(echo "$RULES_IN_REGISTRY" | grep -c . || echo 0)
pass "rulesRegistry has $REGISTERED_COUNT entry/entries"

# Forward: every file on disk must be in registry
UNREGISTERED=$(comm -23 <(echo "$RULES_ON_DISK") <(echo "$RULES_IN_REGISTRY"))
if [ -z "$UNREGISTERED" ]; then
  pass "forward: all disk rules are registered"
else
  for f in $UNREGISTERED; do
    fail "unregistered rule on disk (add to skills-manifest.json rulesRegistry): $f"
  done
fi

# Reverse: every registry entry must exist on disk
MISSING_FILES=$(comm -13 <(echo "$RULES_ON_DISK") <(echo "$RULES_IN_REGISTRY"))
if [ -z "$MISSING_FILES" ]; then
  pass "reverse: all registered rules exist on disk"
else
  for f in $MISSING_FILES; do
    fail "registry entry points to missing file: $f"
  done
fi

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
