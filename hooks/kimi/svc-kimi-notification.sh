#!/bin/bash
# Notification hook: Surface active WI context when blocking notifications arrive.
# Receives: { session_id, cwd, hook_event_name, sink, notification_type, title, body, severity }
# Emits WI context to stdout (added to agent context near the notification).

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

NOTIF_TYPE=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.notification_type || '');
" 2>/dev/null || echo "")

TITLE=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.title || '');
" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

# Only surface context for blocking notification types
if [ "$NOTIF_TYPE" != "permission_prompt" ] && [ "$NOTIF_TYPE" != "approval_needed" ]; then
  exit 0
fi

RECOVERY_MSG=""

while IFS= read -r file; do
  if [ ! -f "$file" ]; then
    continue
  fi

  graph=$(cat "$file" 2>/dev/null || echo "{}")
  status=$(echo "$graph" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.status || 'pending');
" 2>/dev/null || echo "pending")

  if [ "$status" = "completed" ]; then
    continue
  fi

  wi=$(basename "$file" | sed 's/lane-tasks-//' | sed 's/\.json$//')
  next=$(echo "$graph" | node -e "
const g = JSON.parse(require('fs').readFileSync(0, 'utf8'));
const nextTask = g.tasks.find(t => t.status === 'in_progress') || g.tasks.find(t => t.status === 'pending' && (t.blocked_by || []).every(bid => g.tasks.find(x => x.id === bid)?.status === 'completed'));
if (nextTask) {
  console.log(JSON.stringify({ id: nextTask.id, subject: nextTask.subject, skill: nextTask.skill || nextTask.metadata?.skill || 'none' }));
} else {
  console.log('');
}
" 2>/dev/null || echo "")

  if [ -n "$next" ]; then
    next_id=$(echo "$next" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id||'');" || true)
    next_skill=$(echo "$next" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.skill||'');" || true)

    RECOVERY_MSG="${RECOVERY_MSG}

🔔 NOTIFICATION CONTEXT
  Notification: ${TITLE} (${NOTIF_TYPE})
  Active WI: ${wi} (${status})
  Next task: ${next_id} (${next_skill})

  This approval is blocking work on WI-${wi}.
  After resolving, resume with: node scripts/task-graph.mjs load-skill ${file} ${next_id} ${next_skill}
"
  fi
done < <(find "$CWD" -maxdepth 2 -name "lane-tasks-*.json" -path "*/.svc/*" 2>/dev/null)

if [ -n "$RECOVERY_MSG" ]; then
  echo "$RECOVERY_MSG"
fi

exit 0
