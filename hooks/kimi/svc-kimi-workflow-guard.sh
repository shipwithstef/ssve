#!/bin/bash
# hooks/kimi/svc-kimi-workflow-guard.sh
#
# Adapter wrapper that translates Kimi's stdin-JSON hook protocol to the
# existing svc hook scripts (which expect the payload as argv[2]).
#
# Kimi hooks receive JSON on stdin. Existing Claude hooks receive JSON
# as a quoted string argument. This wrapper bridges the two.
#
# Now also supports structured JSON blocking (hookSpecificOutput.permissionDecision)
# per Kimi CLI docs.
#
# Usage (from ~/.kimi/config.toml):
#   [[hooks]]
#   event = "PreToolUse"
#   matcher = "WriteFile|StrReplaceFile"
#   command = "bash ~/.kimi/hooks/svc-kimi-workflow-guard.sh --workflow-guard"
#
# Modes:
#   --workflow-guard   → node hooks/svc-workflow-guard.mjs "$PAYLOAD"
#   --phase-boundary   → node hooks/svc-workflow-guard.mjs "$PAYLOAD" --phase-boundary
#   --bash-guard       → node hooks/svc-workflow-guard.mjs "$PAYLOAD" --bash-guard
#
# Exit codes:
#   0 — OK or structured JSON block (proceed or deny via hookSpecificOutput)
#   2 — Hard block fallback (Kimi protocol: stderr fed back to LLM as correction)

set -euo pipefail

# WI-127 Phase 1.5: kimi hook self-disables on non-Kimi hosts.
# Test harnesses can spoof kimi via SVC_FORCE_HOST=kimi.
if [ "${SVC_FORCE_HOST:-}" != "kimi" ]; then
  __SVC_HG="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/../.." 2>/dev/null && pwd)"
  if [ -x "$__SVC_HG/scripts/detect-host.sh" ]; then
    __SVC_HOST="$(bash "$__SVC_HG/scripts/detect-host.sh" 2>/dev/null || echo unknown)"
    [ "$__SVC_HOST" = "kimi" ] || { unset __SVC_HG __SVC_HOST; exit 0; }
  fi
  unset __SVC_HG __SVC_HOST
fi

unset __SVC_HG __SVC_HOST

HOOK_DIR="$(dirname "$0")"
if [[ "$HOOK_DIR" == */kimi ]]; then
  SCRIPT_DIR="$(cd "$HOOK_DIR/../.." && pwd)"
else
  SCRIPT_DIR="$(cd "$HOOK_DIR/.." && pwd)/skills"
fi
MODE="${1:-}"

# Read JSON payload from stdin (Kimi protocol)
PAYLOAD=$(cat)

# If stdin is empty, nothing to do
if [ -z "$PAYLOAD" ] || [ "$PAYLOAD" = "{}" ]; then
  exit 0
fi

TMP_OUT="$(mktemp /tmp/wf-guard-XXXXXX.out)"
TMP_ERR="$(mktemp /tmp/wf-guard-XXXXXX.err)"
trap 'rm -f "$TMP_OUT" "$TMP_ERR"' EXIT

EXIT_CODE=0
case "$MODE" in
  --workflow-guard)
    node "$SCRIPT_DIR/hooks/svc-workflow-guard.mjs" "$PAYLOAD" > "$TMP_OUT" 2> "$TMP_ERR" || EXIT_CODE=$?
    ;;
  --phase-boundary)
    node "$SCRIPT_DIR/hooks/svc-workflow-guard.mjs" "$PAYLOAD" --phase-boundary > "$TMP_OUT" 2> "$TMP_ERR" || EXIT_CODE=$?
    ;;
  --bash-guard)
    node "$SCRIPT_DIR/hooks/svc-workflow-guard.mjs" "$PAYLOAD" --bash-guard > "$TMP_OUT" 2> "$TMP_ERR" || EXIT_CODE=$?
    ;;
  *)
    echo "Unknown mode: $MODE" >&2
    exit 1
    ;;
esac

# The underlying script exits 2 on block (universal contract across all 4 hosts).
# Exit 1 is kept for backward-compat with older inner-script versions.
if [ "$EXIT_CODE" -eq 1 ] || [ "$EXIT_CODE" -eq 2 ]; then
  REASON="$(cat "$TMP_ERR" "$TMP_OUT" | head -c 2000)"
  if [ -z "$REASON" ]; then
    REASON="Workflow guard blocked this operation."
  fi
  node -e '
    const reason = process.argv[1];
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason
      }
    }));
  ' "$REASON"
  # Fallback: also emit stderr and exit 2 for older Kimi versions
  echo "$REASON" >&2
  exit 2
fi

# Forward any stdout from the guard script to context
if [ -s "$TMP_OUT" ]; then
  cat "$TMP_OUT"
fi

exit 0
