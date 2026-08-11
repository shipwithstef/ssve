#!/bin/bash
# PostCompact hook: Rehydrate framework state after context compaction.
# Receives: { session_id, cwd, hook_event_name, trigger, estimated_token_count }
# Reads checkpoint files and emits recovery guidance to agent context.

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

RECOVERY_MSG=""

# Find all checkpoint files in the project
while IFS= read -r cpfile; do
  if [ ! -f "$cpfile" ]; then
    continue
  fi

  # Parse checkpoint
  cp_data=$(cat "$cpfile" 2>/dev/null || echo "{}")
  cp_wi=$(echo "$cp_data" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.wi || '');
" || true)
  cp_lane=$(echo "$cp_data" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.lane || '');
" || true)
  cp_status=$(echo "$cp_data" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.status || '');
" || true)
  cp_next=$(echo "$cp_data" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.next_task ? d.next_task.id : '');
" || true)

  if [ -z "$cp_wi" ] || [ "$cp_status" = "completed" ]; then
    continue
  fi

  # Find the source lane-tasks file
  src_file="$CWD/.svc/lane-tasks-${cp_wi}.json"
  if [ ! -f "$src_file" ]; then
    continue
  fi

  # Get current state from lane-tasks
  current_status=$(node "$TASK_GRAPH" graph-status "$src_file" 2>/dev/null | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.status || '');
" || true)

  current_next=$(node "$TASK_GRAPH" next "$src_file" 2>/dev/null | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d ? d.id : '');
" || true)

  # Build recovery message
  RECOVERY_MSG="${RECOVERY_MSG}

⚠️ FRAMEWORK STATE RECOVERY (PostCompact)
Context was compacted. Active work item detected:
  WI: ${cp_wi}
  Lane: ${cp_lane}
  Checkpointed status: ${cp_status}
  Current status: ${current_status}
  Checkpointed next task: ${cp_next}
  Current next task: ${current_next}

RECOVERY PROTOCOL — Execute immediately:
1. Read: ${src_file}
2. Find first task with status 'in_progress' or 'pending'
3. Load its skill: node scripts/task-graph.mjs load-skill ${src_file} <task-id> <skill>
4. Re-read the SKILL.md for that skill
5. Resume execution
6. NEVER mark complete without verifying skill_receipt exists
"
done < <(find "$CWD" -maxdepth 2 -name ".checkpoint-*.checkpoint.json" -path "*/.svc/*" 2>/dev/null)

if [ -n "$RECOVERY_MSG" ]; then
  echo "$RECOVERY_MSG"
fi

exit 0
