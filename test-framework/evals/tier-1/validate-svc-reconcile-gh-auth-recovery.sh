#!/usr/bin/env bash
# Tier 1: svc-reconcile must recover deterministic gh account mismatches.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/svc-reconcile.mjs"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

require_fixed() {
  local needle="$1"
  local label="$2"
  if grep -Fq "$needle" "$SCRIPT"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: svc-reconcile gh auth recovery ==="

node --check "$SCRIPT" >/dev/null && pass "svc-reconcile syntax valid" || fail "svc-reconcile syntax invalid"
require_fixed "function expectedGithubOwner()" "extracts expected owner from origin"
require_fixed "function withRepoOwnerGh(fn)" "wraps gh calls with deterministic owner switch"
require_fixed "gh auth switch --user" "uses gh auth switch recovery"
require_fixed "finally" "restores previous gh owner"
require_fixed "stdio: [\"ignore\", \"pipe\", \"pipe\"]" "captures gh stderr without leaking GraphQL noise"
require_fixed "auth_recovery_error" "reports auth recovery failure structurally"

echo ""
echo "svc-reconcile gh auth recovery: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
