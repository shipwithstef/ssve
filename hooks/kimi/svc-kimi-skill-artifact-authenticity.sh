#!/bin/bash
# hooks/kimi/svc-kimi-skill-artifact-authenticity.sh
#
# Adapter wrapper for G-4 skill-artifact-authenticity hook on Kimi CLI.
# Bridges Kimi's stdin-JSON protocol to the host-agnostic .mjs hook.
#
# Usage (from ~/.kimi/config.toml):
#   [[hooks]]
#   event = "PreToolUse"
#   matcher = "WriteFile|StrReplaceFile"
#   command = "bash ~/.kimi/hooks/svc-kimi-skill-artifact-authenticity.sh"
#
# Exit codes:
#   0 — OK (path not protected, receipt found, or override set)
#   2 — HARD BLOCK (stderr carries the reason; action aborted)

set -euo pipefail

# WI-127 Phase 1.5: kimi hook self-disables on non-Kimi hosts.
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

# Kimi hooks receive JSON on stdin. The .mjs hook expects the payload
# as a quoted string argument (Claude-compatible).
node "${SCRIPT_DIR}/hooks/svc-skill-artifact-authenticity.mjs" "$PAYLOAD"
