#!/bin/bash
# StopFailure hook: Log error context when a turn ends due to error.
# Receives: { session_id, cwd, hook_event_name, error_type, error_message }
# Appends to .svc/error-log.jsonl for debugging.

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

CWD=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.cwd || '');
" 2>/dev/null || echo "")

ERROR_TYPE=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.error_type || '');
" 2>/dev/null || echo "")

ERROR_MSG=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.error_message || '');
" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

# Find active lane-tasks files
ACTIVE_WIS=""
while IFS= read -r file; do
  if [ ! -f "$file" ]; then
    continue
  fi
  wi=$(basename "$file" | sed 's/lane-tasks-//' | sed 's/\.json$//')
  status=$(node -e "
    const fs = require('fs');
    try {
      const g = JSON.parse(fs.readFileSync('$file', 'utf8'));
      console.log(g.status || 'pending');
    } catch (e) { console.log('unknown'); }
  " 2>/dev/null || echo "unknown")
  if [ "$status" != "completed" ]; then
    next=$(node -e "
      const fs = require('fs');
      try {
        const g = JSON.parse(fs.readFileSync('$file', 'utf8'));
        const nextTask = g.tasks.find(t => t.status === 'in_progress') || g.tasks.find(t => t.status === 'pending' && (t.blocked_by || []).every(bid => g.tasks.find(x => x.id === bid)?.status === 'completed'));
        console.log(nextTask ? nextTask.id + ':' + (nextTask.skill || 'none') : 'none');
      } catch (e) { console.log('unknown'); }
    " 2>/dev/null || echo "unknown")
    ACTIVE_WIS="${ACTIVE_WIS}${wi}(${status},next=${next});"
  fi
done < <(find "$CWD" -maxdepth 2 -name "lane-tasks-*.json" -path "*/.svc/*" 2>/dev/null)

SVC_DIR="$CWD/.svc"
if [ ! -d "$SVC_DIR" ]; then
  exit 0
fi

# Append error log entry
ENTRY=$(node -e '
  const d = JSON.parse(require("fs").readFileSync(0, "utf8"));
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: "StopFailure",
    error_type: d.error_type || "unknown",
    error_message: (d.error_message || "").slice(0, 500),
    active_wis: process.argv[1] || "none",
    cwd: d.cwd || ""
  }));
' "$ACTIVE_WIS" <<< "$PAYLOAD" 2>/dev/null || echo "")

if [ -n "$ENTRY" ]; then
  echo "$ENTRY" >> "$SVC_DIR/error-log.jsonl"
  echo "⚠️ Turn ended with error. Logged to .svc/error-log.jsonl"
  echo "  Type: ${ERROR_TYPE:-unknown}"
  echo "  Active WIs: ${ACTIVE_WIS:-none}"
fi

exit 0
