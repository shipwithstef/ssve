#!/usr/bin/env bash
# Tier-1 validator for WI-312 hook/host residual mapping and historical-skip guard.
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

echo "=== Tier 1: Hook/Host Residuals ==="

if node --check scripts/validate-hook-host-residuals.mjs >/tmp/hook-host-residuals-syntax.out 2>&1; then
  pass "validator syntax valid"
else
  cat /tmp/hook-host-residuals-syntax.out
  fail "validator syntax valid"
fi

if node scripts/validate-hook-host-residuals.mjs >/tmp/hook-host-residuals-current.out 2>&1; then
  cat /tmp/hook-host-residuals-current.out
  pass "WI-312 residual map and triage are valid"
else
  cat /tmp/hook-host-residuals-current.out
  fail "WI-312 residual map and triage are valid"
fi

if bash test-framework/evals/tier-1/validate-stop-hook-phase-enforcement.sh >/tmp/hook-host-residuals-stop.out 2>&1; then
  if grep -q "historical_skip" /tmp/hook-host-residuals-stop.out; then
    pass "Stop hook historical_skip fixture passes"
  else
    cat /tmp/hook-host-residuals-stop.out
    fail "Stop hook historical_skip fixture is missing"
  fi
else
  cat /tmp/hook-host-residuals-stop.out
  fail "Stop hook historical_skip fixture passes"
fi

if bash test-framework/evals/tier-1/validate-cross-host-hook-conformance.sh >/tmp/hook-host-residuals-cross-host.out 2>&1; then
  pass "cross-host hook conformance still passes"
else
  cat /tmp/hook-host-residuals-cross-host.out
  fail "cross-host hook conformance still passes"
fi

echo "hook/host residuals: $PASS passed, $FAIL failed"
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
