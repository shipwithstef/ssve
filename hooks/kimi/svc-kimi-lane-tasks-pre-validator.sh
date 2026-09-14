#!/bin/bash
# PreToolUse hook that blocks invalid lane-tasks edits BEFORE they happen.
# Kimi protocol:
#   - Primary: structured JSON output with permissionDecision="deny" + exit 0
#   - Fallback: exit 2 (stderr fed back to LLM as correction)
# Docs: https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html

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

PAYLOAD=$(cat)

if [ -z "$PAYLOAD" ] || [ "$PAYLOAD" = "{}" ]; then
  exit 0
fi

TOOL_NAME=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.tool_name || d.tool || '');
")

FILE_PATH=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
console.log(input.path || input.file_path || '');
")

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if ! echo "$FILE_PATH" | grep -qE '\.svc/lane-tasks-[^/]+\.json$'; then
  exit 0
fi

if ! [[ "$FILE_PATH" = /* ]]; then
  FILE_PATH="${PWD}/${FILE_PATH}"
fi

emit_deny() {
  local reason="$1"
  node -e '
    const reason = process.argv[1];
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason
      }
    }));
  ' "$reason"
  # Fallback: also exit 2 for older Kimi versions that may not yet honor structured JSON
  echo "$reason" >&2
  exit 2
}

TMP_OUT="$(mktemp /tmp/lt-validate-XXXXXX.out)"
trap 'rm -f "$TMP_OUT"' EXIT

if [ "$TOOL_NAME" = "WriteFile" ]; then
  CONTENT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
console.log(input.content || '');
")

  if [ -z "$CONTENT" ]; then
    exit 0
  fi

  if ! echo "$CONTENT" | node "$SCRIPT_DIR/hooks/svc-lane-tasks-validate-content.mjs" --stdin "$FILE_PATH" > "$TMP_OUT" 2>&1; then
    REASON="$(cat "$TMP_OUT")"
    emit_deny "${REASON:-Invalid lane-tasks content for WriteFile}"
  fi
  exit 0
fi

if [ "$TOOL_NAME" = "StrReplaceFile" ]; then
  if [ ! -f "$FILE_PATH" ]; then
    exit 0
  fi

  OLD_TEXT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
const edit = input.edit || {};
console.log(edit.old || '');
")

  NEW_TEXT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const input = d.tool_input || d.input || {};
const edit = input.edit || {};
console.log(edit.new || '');
")

  if [ -z "$OLD_TEXT" ]; then
    exit 0
  fi

  if ! node "$SCRIPT_DIR/hooks/svc-lane-tasks-validate-edit.mjs" "$FILE_PATH" "$OLD_TEXT" "$NEW_TEXT" > "$TMP_OUT" 2>&1; then
    REASON="$(cat "$TMP_OUT")"
    emit_deny "${REASON:-Invalid lane-tasks edit for StrReplaceFile}"
  fi
  exit 0
fi

exit 0
