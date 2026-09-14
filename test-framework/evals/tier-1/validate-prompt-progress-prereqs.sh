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

echo "=== Tier 1: Prompt Progress And Prerequisites ==="

check "contract validator syntax valid" node --check "$ROOT/scripts/validate-prompt-progress-contract.mjs"
check "prompt progress contract passes" node "$ROOT/scripts/validate-prompt-progress-contract.mjs" --root "$ROOT"

FIX="$TMP/repo"
mkdir -p "$FIX/.svc"
cat >"$FIX/.svc/lane-tasks-WI-999.json" <<'JSON'
{
  "wi": "WI-999",
  "created": "2026-05-11T08:00:00Z",
  "tasks": [
    {"id":"T1","skill":"execute-changeset","status":"in_progress","started_at":"2026-05-11T08:00:00Z","subject":"old task"}
  ]
}
JSON

check "prompt hook warns on stale in-progress task" bash -c "cd '$FIX' && SVC_PROMPT_PROGRESS_WARN_MINUTES=1 node '$ROOT/hooks/svc-prompt-stale-state.mjs' < /dev/null 2>'$TMP/hook.err' && grep -q 'stalled in-progress task' '$TMP/hook.err'"

echo ""
echo "prompt progress prerequisites: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
