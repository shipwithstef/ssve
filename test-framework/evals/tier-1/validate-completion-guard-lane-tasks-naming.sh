#!/usr/bin/env bash
# Tier 1: keep completion-guard docs on lane-tasks-<WI>.json, not legacy lane-tasks.json.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GUARD="$REPO_ROOT/hooks/svc-task-completion-guard.sh"
HOOKS="$REPO_ROOT/hooks/hooks.json"

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

echo "=== Tier 1: completion guard lane-tasks naming ==="

if grep -q 'lane-tasks-<WI>.json' "$GUARD"; then
  pass "completion guard header/messages name lane-tasks-<WI>.json"
else
  fail "completion guard does not name lane-tasks-<WI>.json"
fi

if grep -q 'lane-tasks-<WI>.json' "$HOOKS"; then
  pass "hooks manifest completion-guard description names lane-tasks-<WI>.json"
else
  fail "hooks manifest completion-guard description does not name lane-tasks-<WI>.json"
fi

if grep -q 'legacy compatibility only' "$GUARD" && grep -q 'legacy compatibility only' "$HOOKS"; then
  pass "legacy singular lane-tasks.json is explicitly framed as compatibility-only"
else
  fail "legacy singular lane-tasks.json is not explicitly framed as compatibility-only"
fi

if grep -q 'Blocks stop when \.svc/lane-tasks\.json' "$GUARD" \
  || grep -q 'Blocks stop when \.svc/lane-tasks\.json' "$HOOKS" \
  || grep -q 'payload or lane-tasks\.json is malformed' "$GUARD" \
  || grep -q 'lane-tasks\.json exists but the completion guard' "$GUARD" \
  || grep -q 'Fix the hook payload or \.svc/lane-tasks\.json' "$GUARD"; then
  fail "legacy singular lane-tasks.json still appears as the primary completion-guard path"
else
  pass "legacy singular lane-tasks.json is not described as the primary completion-guard path"
fi

echo ""
echo "completion guard lane-tasks naming: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
