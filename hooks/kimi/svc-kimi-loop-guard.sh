#!/usr/bin/env bash
#
# svc Loop Guard — Kimi CLI PreToolUse wrapper
# Mirrors hooks/svc-loop-guard.mjs for Kimi hosts.
#
# Detects repetitive tool-call patterns:
#   - Exact repetition: same tool+args 3× → warning, 5× → block
#   - Ping-pong: alternating A-B-A-B → warning, continues → block
#   - No-progress: no git diff change for 10 consecutive meaningful calls → warning
#
# Exemptions: TaskList, TaskOutput, TaskStop (observational tools)

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

# Read tool input from stdin (Kimi passes JSON via stdin for some hook types)
# or from $TOOL_INPUT env var
INPUT_RAW="${TOOL_INPUT:-$(cat)}"

# Delegate to the canonical Node.js implementation
SKILLS_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
node "$SKILLS_DIR/hooks/svc-loop-guard.mjs" "$INPUT_RAW" || true
