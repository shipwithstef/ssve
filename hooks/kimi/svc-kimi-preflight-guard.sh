#!/bin/bash
# UserPromptSubmit hook: Intelligent entry point for autonomous framework.
# Receives: { prompt, cwd } on stdin. Cannot block.
# stdout is added to agent context.
#
# Behaviors:
#   - If active lane-tasks exist → emit reminder + suggest lane-executor
#   - If user intent is actionable → suggest auto-router
#   - If user says stop/wait → respect (no auto suggestion)

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

# Extract fields
CWD=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.cwd || '');
")

PROMPT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.prompt || '');
" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

# Detect stop/wait/pause intent
if echo "$PROMPT" | grep -qiE "^\\s*(wait|stop|hold on|pause|don't|do not|let me check|hold up)\\b"; then
  echo "⏸️ USER REQUESTED PAUSE — Auto-router will not trigger."
  echo "   Say 'continue' or 'resume' when ready."
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

# Check for active lane-tasks
ACTIVE_WIS=""
HAS_ACTIVE_WORK=0

while IFS= read -r ltfile; do
  if [ ! -f "$ltfile" ]; then
    continue
  fi

  graph_status=$(node "$TASK_GRAPH" graph-status "$ltfile" 2>/dev/null | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.status || '');
" || true)

  if [ "$graph_status" = "completed" ]; then
    continue
  fi

  HAS_ACTIVE_WORK=1
  wi=$(basename "$ltfile" | sed 's/lane-tasks-//' | sed 's/\.json$//')

  # Check human_checkpoint flag
  hp_flag=$(node -e "
    const fs = require('fs');
    try {
      const g = JSON.parse(fs.readFileSync('$ltfile', 'utf8'));
      console.log(g.human_checkpoint === true ? 'true' : 'false');
    } catch (e) { console.log('false'); }
  " 2>/dev/null || echo "false")

  next_task=$(node "$TASK_GRAPH" next "$ltfile" 2>/dev/null | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
if (!d) process.exit(0);
console.log(JSON.stringify({ id: d.id, subject: d.subject, skill: d.skill || d.metadata?.skill || '' }));
" || true)

  next_id=$(echo "$next_task" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.id||'');" || true)
  next_subject=$(echo "$next_task" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.subject||'');" || true)
  next_skill=$(echo "$next_task" | node -e "const d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(d.skill||'');" || true)

  if [ "$hp_flag" = "true" ]; then
    ACTIVE_WIS="${ACTIVE_WIS}
  🔒 WI: ${wi} (HUMAN CHECKPOINT ACTIVE)
     Next: ${next_id} — ${next_subject}
     Status: ${graph_status}
     ⚠️  Ask user before proceeding."
  else
    ACTIVE_WIS="${ACTIVE_WIS}
  🤖 WI: ${wi}
     Next: ${next_id} — ${next_subject} (${next_skill})
     Status: ${graph_status}
     To auto-resume: /flow:svc-lane-executor"
  fi
done < <(find "$CWD" -maxdepth 2 -name "lane-tasks-*.json" -not -name "*.completed-*" -path "*/.svc/*" 2>/dev/null)

# Detect intent class and emit appropriate guidance
if [ "$HAS_ACTIVE_WORK" -eq 1 ]; then
  # Check if user said continue/resume
  if echo "$PROMPT" | grep -qiE '^\s*(continue|resume|go on|keep going|finish)\b'; then
    echo ""
    echo "🤖 AUTO-RESUME TRIGGERED"
    echo "${ACTIVE_WIS}"
    echo ""
    echo "   Run: /flow:svc-lane-executor"
    exit 0
  fi

  contract_json=$(cd "$CWD" && tail -1 .svc/session-contract.jsonl 2>/dev/null || true)
  contract_bound_to=$(printf '%s' "$contract_json" | node -e '
    try { const d = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(d.bound_to || ""); }
    catch { console.log(""); }
  ' 2>/dev/null || true)
  contract_wi=$(printf '%s' "$contract_json" | node -e '
    try { const d = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(d.wi || ""); }
    catch { console.log(""); }
  ' 2>/dev/null || true)
  contract_request=$(printf '%s' "$contract_json" | node -e '
    try { const d = JSON.parse(require("fs").readFileSync(0, "utf8")); console.log(d.request || ""); }
    catch { console.log(""); }
  ' 2>/dev/null || true)

  if echo "$contract_bound_to" | grep -qE '^(user-request|framework-evolution|framework)$'; then
    if [ -z "$contract_wi" ] || ! echo "$PROMPT" | grep -qiF "$contract_wi"; then
      echo ""
      echo "📋 ACTIVE WORK ITEM ADVISORY (UserPromptSubmit)"
      echo "${ACTIVE_WIS}"
      echo ""
      echo "   Session contract is bound to ${contract_bound_to}: ${contract_request:-current user request}"
      echo "   Backlog execution is paused unless the user says: continue with <WI>"
      exit 0
    fi
  fi

  echo ""
  echo "📋 ACTIVE WORK ITEM REMINDER (UserPromptSubmit)"
  echo "${ACTIVE_WIS}"
  echo ""
  echo "   To start new work instead: /flow:svc-auto-router"
  exit 0
fi

# No active work — suggest auto-router for actionable intents
if [ -n "$PROMPT" ]; then
  # Simple intent classification
  if echo "$PROMPT" | grep -qiE '^\s*(what|how|why|explain|compare|difference between)\b'; then
    echo ""
    echo "💬 QUESTION DETECTED"
    echo "   For questions, use: /skill:svc-advisor"
    exit 0
  fi

  # Detect framework/meta intent FIRST — these bypass normal routing
  if echo "$PROMPT" | grep -qiE '\b(evolve framework|improve framework|fix framework|framework gap|add skill|fix hook|test framework|framework hook|auto-router|lane-executor|capability registry|orchestrator)\b'; then
    echo ""
    echo "🔧 FRAMEWORK INTENT DETECTED: '${PROMPT}'"
    echo "   Framework work does NOT use normal lanes."
    echo ""
    echo "   Run ONE of:"
    echo "     /skill:evolve-framework   (new capabilities, architecture changes)"
    echo "     /skill:improve-framework  (fixes, optimizations, gap closure)"
    exit 0
  fi

  if echo "$PROMPT" | grep -qiE '\b(fix|build|add|create|implement|improve|update|refactor|ship|deploy|find|optimize)\b'; then
    echo ""
    echo "🤖 ACTIONABLE INTENT DETECTED: '${PROMPT}'"
    echo "   No active work items. Auto-router can handle this."
    echo ""
    echo "   Run: /flow:svc-auto-router"
    exit 0
  fi
fi

exit 0
