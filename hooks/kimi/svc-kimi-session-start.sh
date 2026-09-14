#!/bin/bash
# SessionStart hook: Auto-recover and auto-resume framework state on session start/resume.
# Receives: { source: "startup" | "resume", cwd } on stdin.
# stdout is added to agent context.

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

SOURCE=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.source || '');
")

if [ -z "$CWD" ]; then
  exit 0
fi

# Find task-graph.mjs
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
HAS_AUTO_RESUMABLE=0

# Check orchestrator state FIRST (primary source of truth for cross-session resume)
ORCH_STATE=$(node "$SCRIPT_DIR/scripts/orchestrator-state.mjs" resume "$CWD" 2>/dev/null || echo '{"canResume":false}')
ORCH_CAN_RESUME=$(echo "$ORCH_STATE" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.canResume===true?'true':'false');" 2>/dev/null || echo "false")

if [ "$ORCH_CAN_RESUME" = "true" ]; then
  ORCH_WI=$(echo "$ORCH_STATE" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.activeWi||'');" 2>/dev/null || echo "")
  ORCH_LANE=$(echo "$ORCH_STATE" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.activeLane||'');" 2>/dev/null || echo "")
  ORCH_TASK=$(echo "$ORCH_STATE" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.nextTask||'');" 2>/dev/null || echo "")
  ORCH_ACTION=$(echo "$ORCH_STATE" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.lastAction||'');" 2>/dev/null || echo "")

  HAS_AUTO_RESUMABLE=1
  RECOVERY_MSG="

🤖 ORCHESTRATOR STATE — CROSS-SESSION RESUME
   WI: ${ORCH_WI}
   Lane: ${ORCH_LANE}
   Next task: ${ORCH_TASK}
   Last action: ${ORCH_ACTION}
"
fi

# Check for active lane-tasks files (fallback if orchestrator state is empty)
while IFS= read -r ltfile; do
  if [ ! -f "$ltfile" ]; then
    continue
  fi

  graph=$(cat "$ltfile" 2>/dev/null || echo "{}")
  status=$(echo "$graph" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.status || 'pending');
" 2>/dev/null || echo "pending")

  if [ "$status" = "completed" ]; then
    continue
  fi

  wi=$(basename "$ltfile" | sed 's/lane-tasks-//' | sed 's/\.json$//')

  # Check human_checkpoint flag
  hp_flag=$(echo "$graph" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.human_checkpoint === true ? 'true' : 'false');
" 2>/dev/null || echo "false")

  auto_resume=$(echo "$graph" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.auto_resume === false ? 'false' : 'true');
" 2>/dev/null || echo "true")

  next=$(echo "$graph" | node -e "
const g = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const nextTask = g.tasks.find(t => t.status === 'in_progress') || g.tasks.find(t => t.status === 'pending' && (t.blocked_by || []).every(bid => g.tasks.find(x => x.id === bid)?.status === 'completed'));
if (nextTask) {
  console.log(JSON.stringify({ id: nextTask.id, subject: nextTask.subject, skill: nextTask.skill || nextTask.metadata?.skill || 'none' }));
} else {
  console.log('');
}
" 2>/dev/null || echo "")

  if [ "$hp_flag" = "true" ]; then
    RECOVERY_MSG="${RECOVERY_MSG}

🔒 WI: ${wi} — HUMAN CHECKPOINT ACTIVE
   Status: ${status}
   ⚠️  Ask user before proceeding.
"
  elif [ "$auto_resume" = "true" ] && [ -n "$next" ]; then
    HAS_AUTO_RESUMABLE=1
    next_id=$(echo "$next" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id||'');" || true)
    next_skill=$(echo "$next" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.skill||'');" || true)
    next_subject=$(echo "$next" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.subject||'');" || true)

    RECOVERY_MSG="${RECOVERY_MSG}

🤖 WI: ${wi} — AUTO-RESUMABLE
   Status: ${status}
   Next task: ${next_id} — ${next_subject}
   Skill: ${next_skill}
"
  fi
done < <(find "$CWD" -maxdepth 2 -name "lane-tasks-*.json" -not -name "*.completed-*" -path "*/.svc/*" 2>/dev/null)

if [ -n "$RECOVERY_MSG" ]; then
  if [ "$HAS_AUTO_RESUMABLE" -eq 1 ] && [ "$SOURCE" = "resume" ]; then
    echo ""
    echo "🔄 SESSION RESUME RECOVERY (SessionStart)"
    echo "${RECOVERY_MSG}"
    echo ""
    echo "RECOVERY PROTOCOL:"
    echo "1. Read the active lane-tasks file"
    echo "2. Run: /flow:svc-lane-executor"
  elif [ "$HAS_AUTO_RESUMABLE" -eq 1 ]; then
    echo ""
    echo "📋 ACTIVE WORK ITEM (SessionStart)"
    echo "${RECOVERY_MSG}"
    echo ""
    echo "   To auto-resume: /flow:svc-lane-executor"
  else
    echo ""
    echo "📋 ACTIVE WORK ITEM (SessionStart)"
    echo "${RECOVERY_MSG}"
  fi
fi

exit 0
