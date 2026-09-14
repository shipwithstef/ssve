#!/bin/bash
# PreCompact hook: Persist framework state before context compaction.
# Receives: { session_id, cwd, hook_event_name, trigger, token_count }
# Writes checkpoint for all active lane-tasks files in the project.

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

# Extract CWD to find the project
CWD=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.cwd || '');
")

if [ -z "$CWD" ]; then
  exit 0
fi

# Find task-graph.mjs in the project (search CWD and parent dirs)
TASK_GRAPH=""
search_dir="$CWD"
for _ in 1 2 3; do
  if [ -f "$search_dir/scripts/task-graph.mjs" ]; then
    TASK_GRAPH="$search_dir/scripts/task-graph.mjs"
    break
  fi
  search_dir="$(dirname "$search_dir")"
done

if [ -z "$TASK_GRAPH" ]; then
  exit 0
fi

# Find all active lane-tasks files in the project
find "$CWD" -maxdepth 2 -name "lane-tasks-*.json" -path "*/.svc/*" 2>/dev/null | while read -r file; do
  # Only checkpoint if graph is not already completed
  status=$(node "$TASK_GRAPH" graph-status "$file" 2>/dev/null | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.status || '');
" || true)

  if [ "$status" != "completed" ]; then
    node "$TASK_GRAPH" checkpoint "$file" >/dev/null 2>&1 || true
  fi
done

exit 0
