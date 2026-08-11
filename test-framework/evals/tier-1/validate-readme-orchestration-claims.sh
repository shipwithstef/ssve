#!/usr/bin/env bash
# Tier-1 validator: README must not overstate parallel orchestration as a
# runtime scheduler. Origin: WI-209.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  ✗ $1"
  FAIL=$((FAIL + 1))
}

echo "=== Tier 1: README orchestration claim accuracy ==="

README_TEXT="$(tr '\n' ' ' < README.md)"

if grep -qE "up to ~?100 .*instances working[[:space:]]+in parallel" README.md; then
  fail "README no longer claims ~100 runtime-parallel instances"
else
  pass "README no longer claims ~100 runtime-parallel instances"
fi

if grep -Fq "architecture support, not a runtime" README.md; then
  pass "README labels parallel capability as architecture support"
else
  fail "README labels parallel capability as architecture support"
fi

if [[ "$README_TEXT" == *"no automatic multi-instance scheduling or global lock layer"* ]]; then
  pass "README names missing scheduler and lock layer"
else
  fail "README names missing scheduler and lock layer"
fi

if grep -Fq "| Multi-agent coordination | Architecture support, not scheduler" README.md; then
  pass "capability table uses non-operational wording"
else
  fail "capability table uses non-operational wording"
fi

echo
echo "README orchestration claim accuracy: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
