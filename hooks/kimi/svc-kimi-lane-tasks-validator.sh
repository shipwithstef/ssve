#!/bin/bash
# hooks/kimi/svc-kimi-lane-tasks-validator.sh
#
# Adapter wrapper for svc-lane-tasks-validator.mjs on Kimi CLI.
# Reads JSON from stdin and forwards to the existing validator.
#
# Usage (from ~/.kimi/config.toml):
#   [[hooks]]
#   event = "PostToolUse"
#   matcher = "WriteFile|StrReplaceFile"
#   command = "bash ~/.kimi/skills/hooks/kimi/svc-kimi-lane-tasks-validator.sh"

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

# Read JSON payload from stdin (Kimi protocol)
PAYLOAD=$(cat)

if [ -z "$PAYLOAD" ] || [ "$PAYLOAD" = "{}" ]; then
  exit 0
fi

node "$SCRIPT_DIR/hooks/svc-lane-tasks-validator.mjs" "$PAYLOAD"
