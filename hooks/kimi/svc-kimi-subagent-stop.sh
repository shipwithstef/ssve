#!/bin/bash
# SubagentStop hook: Validate subagent output for lane-tasks modifications.
# Receives: { session_id, cwd, hook_event_name, agent_name, response }
# Checks if the subagent mentioned editing lane-tasks files and warns if so.

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

AGENT_NAME=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.agent_name || d.agent_type || '');
" 2>/dev/null || echo "")

RESPONSE=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.response || d.output || '');
" 2>/dev/null || echo "")

if [ -z "$CWD" ] || [ -z "$RESPONSE" ]; then
  exit 0
fi

# Check if response mentions lane-tasks edits
if echo "$RESPONSE" | grep -qiE 'lane-tasks|\.svc.*\.json|task-graph|set-status|load-skill'; then
  echo "
⚠️ SUBAGENT MAY HAVE MODIFIED FRAMEWORK STATE (SubagentStop)
  Subagent: ${AGENT_NAME}
  The subagent output mentions lane-tasks or task-graph operations.

  ACTION REQUIRED:
  1. Check if .svc/lane-tasks-*.json files were modified
  2. Run validation: node scripts/task-graph.mjs validate <file>
  3. If invalid, revert or fix before proceeding
"
fi

exit 0
