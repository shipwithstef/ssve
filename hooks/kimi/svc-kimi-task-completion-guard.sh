#!/bin/bash
# hooks/kimi/svc-kimi-task-completion-guard.sh
#
# Adapter wrapper for svc-task-completion-guard.sh on Kimi CLI.
# Reads JSON from stdin and forwards to the existing guard.
# Translates the guard's JSON stdout output into Kimi-compatible exit codes:
#   - If guard outputs decision:block → exit 2 (hard block per Kimi docs)
#   - If guard outputs decision:allow or anti_loop → exit 0
#
# Usage (from ~/.kimi/config.toml):
#   [[hooks]]
#   event = "Stop"
#   command = "bash ~/.kimi/hooks/svc-kimi-task-completion-guard.sh"

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

# Extract CWD from payload so we run the guard in the correct project directory
CWD=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.cwd || '');
" 2>/dev/null || echo "")

# Use CWD if available, otherwise fall back to current directory
TARGET_DIR="${CWD:-$PWD}"

# Forward to the original guard script and capture stdout
OUTPUT=$(cd "$TARGET_DIR" && printf '%s' "$PAYLOAD" | bash "$SCRIPT_DIR/hooks/svc-task-completion-guard.sh" 2>/dev/null || true)

# Always forward the guard's output to stdout (added to agent context)
if [ -n "$OUTPUT" ]; then
  echo "$OUTPUT"
fi

# Translate guard decision into Kimi exit codes
# The guard emits JSON like: {"decision":"block","reason":"..."}
# or {"decision":"allow"} or nothing (allow)
if echo "$OUTPUT" | grep -q '"decision"\s*:\s*"block"'; then
  # Extract reason for stderr feedback
  REASON=$(echo "$OUTPUT" | node -e '
    try {
      const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
      console.log(d.reason || "Stop blocked by svc completion guard.");
    } catch (e) {
      console.log("Stop blocked by svc completion guard.");
    }
  ' 2>/dev/null || echo "Stop blocked by svc completion guard.")
  echo "$REASON" >&2
  exit 2
fi

exit 0
