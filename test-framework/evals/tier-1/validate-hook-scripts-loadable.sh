#!/usr/bin/env bash
# Tier-1: validate every hook command in hooks/hooks.json that invokes a
# `node hooks/...` script resolves to a file that exists AND parses cleanly
# (`node --check`). Catches "Cannot find module svc-stop-quality.js" class
# of errors at lint time before they hit a real session.
#
# Introduced WI-123.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOKS_JSON="$REPO_ROOT/hooks/hooks.json"

if [ ! -f "$HOOKS_JSON" ]; then
  echo "FAIL: missing $HOOKS_JSON" >&2
  exit 1
fi

PASS=0; FAIL=0

# Extract every (event, id, command) tuple from hooks.json
TUPLES=$(node -e "
const j = JSON.parse(require('fs').readFileSync('$HOOKS_JSON','utf8'));
for (const [event, arr] of Object.entries(j.hooks||{})) {
  for (const entry of arr) {
    const id = entry.id || '<no-id>';
    const cmd = entry.command || '';
    console.log(event + '\t' + id + '\t' + cmd);
  }
}
")

while IFS=$'\t' read -r event id cmd; do
  [ -z "$cmd" ] && continue

  # Find a 'node <path>', 'bash <path>', or direct svc-managed script token in the command.
  # We look for tokens that end with .mjs or .js and start with 'hooks/' or
  # 'scripts/' — those are svc-managed scripts that should resolve relative
  # to the repo root.
  for tok in $cmd; do
    case "$tok" in
      hooks/*.mjs|hooks/*.js|scripts/*.mjs|scripts/*.js)
        SCRIPT_PATH="$REPO_ROOT/$tok"
        if [ ! -f "$SCRIPT_PATH" ]; then
          echo "  ✗ $event/$id: script not found: $tok"
          FAIL=$((FAIL+1))
          continue
        fi
        # Syntax-check via node --check (no execute).
        if node --check "$SCRIPT_PATH" 2>/dev/null; then
          echo "  ✓ $event/$id: $tok loadable"
          PASS=$((PASS+1))
        else
          err=$(node --check "$SCRIPT_PATH" 2>&1 | head -3 | tr '\n' ' ')
          echo "  ✗ $event/$id: $tok syntax error: $err"
          FAIL=$((FAIL+1))
        fi
        ;;
      hooks/*.sh|scripts/*.sh)
        SCRIPT_PATH="$REPO_ROOT/$tok"
        if [ ! -f "$SCRIPT_PATH" ]; then
          echo "  ✗ $event/$id: script not found: $tok"
          FAIL=$((FAIL+1))
          continue
        fi
        if bash -n "$SCRIPT_PATH" 2>/dev/null; then
          echo "  ✓ $event/$id: $tok loadable"
          PASS=$((PASS+1))
        else
          err=$(bash -n "$SCRIPT_PATH" 2>&1 | head -3 | tr '\n' ' ')
          echo "  ✗ $event/$id: $tok syntax error: $err"
          FAIL=$((FAIL+1))
        fi
        ;;
    esac
  done
  :
done <<< "$TUPLES" || true

echo ""
echo "validate-hook-scripts-loadable: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
