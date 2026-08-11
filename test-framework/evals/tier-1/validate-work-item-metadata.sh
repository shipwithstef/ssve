#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  fi
}

check_fail() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  else
    echo "  ✓ $label"
    pass=$((pass + 1))
  fi
}

FIX="$TMP/repo"
mkdir -p "$FIX/docs/specs/work-items"

cat >"$FIX/docs/specs/work-items/WI-001.md" <<'MD'
# WI-001: Missing metadata

**Type:** enabler
**Status:** backlog
**Severity:** high
**Filed:** 2026-05-12
**Source:** test
MD

cat >"$FIX/docs/specs/work-items/WI-002.md" <<'MD'
# WI-002: Has metadata

**Type:** enabler
**Status:** backlog
**Severity:** critical
**Filed:** 2026-05-12
**Source:** test

## Affected Files
- unknown: design not complete
MD

echo "=== Tier 1: Work Item Metadata ==="

check "metadata validator syntax valid" node --check "$ROOT/scripts/validate-work-item-metadata.mjs"
check_fail "validator rejects high WI missing metadata" node "$ROOT/scripts/validate-work-item-metadata.mjs" --root "$FIX"
rm "$FIX/docs/specs/work-items/WI-001.md"
check "validator accepts high WI with unknown reason" node "$ROOT/scripts/validate-work-item-metadata.mjs" --root "$FIX"
check "repo metadata contract passes" node "$ROOT/scripts/validate-work-item-metadata.mjs" --root "$ROOT"

echo ""
echo "work item metadata: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
