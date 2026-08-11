#!/bin/bash
# PreToolUse hook: HARD BLOCK task completion without skill loading.
# Receives: { tool_name, tool_input } on stdin.
#
# Rule: Before marking a task complete with task-graph.mjs complete,
# the agent must have called task-graph.mjs load-skill for that task.
# If not, exit 2 to hard-block the tool call.

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

# Only check task-graph complete commands
TOOL_NAME=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.tool_name || '');
" 2>/dev/null || echo "")

# We only care about Shell/Bash tool calls that invoke task-graph.mjs complete
if [ "$TOOL_NAME" != "Shell" ] && [ "$TOOL_NAME" != "Bash" ]; then
  exit 0
fi

TOOL_INPUT=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(d.tool_input || {}));
" 2>/dev/null || echo "{}")

COMMAND=$(echo "$TOOL_INPUT" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.command || '');
" 2>/dev/null || echo "")

# Check if this is a task-graph complete call
if ! echo "$COMMAND" | grep -qE 'task-graph\.mjs.*complete'; then
  exit 0
fi

# Extract the lane-tasks file path and task ID from the command
LT_FILE=$(echo "$COMMAND" | grep -oE '\.svc/lane-tasks-[^ ]+\.json' | head -1)
TASK_ID=$(echo "$COMMAND" | grep -oE '--id [^ ]+' | sed 's/--id //' | head -1)

if [ -z "$LT_FILE" ] || [ -z "$TASK_ID" ]; then
  exit 0
fi

# Find the project root by walking up from cwd
CWD=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.cwd || '');
" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

# Resolve full path
if [[ "$LT_FILE" != /* ]]; then
  LT_FILE="$CWD/$LT_FILE"
fi

if [ ! -f "$LT_FILE" ]; then
  exit 0
fi

# Check if load-skill was called for this task in this session
# We look at the task's metadata for skill_receipt
HAS_SKILL_RECEIPT=$(node -e "
const fs = require('fs');
try {
  const g = JSON.parse(fs.readFileSync('$LT_FILE', 'utf8'));
  const task = g.tasks.find(t => t.id === '$TASK_ID');
  if (!task) { console.log('false'); process.exit(0); }
  const hasReceipt = !!task.skill_receipt;
  console.log(hasReceipt ? 'true' : 'false');
} catch (e) { console.log('false'); }
" 2>/dev/null || echo "false")

if [ "$HAS_SKILL_RECEIPT" != "true" ]; then
  echo ""
  echo "🚫 SKILL LOAD GUARD (PreToolUse) — HARD BLOCK"
  echo "   Task '$TASK_ID' is being marked complete WITHOUT a skill_receipt."
  echo "   Rule: Before completing a task, load its SKILL.md via:"
  echo "      node scripts/task-graph.mjs load-skill <lt-file> --id <task-id> --skill <skill-name>"
  echo "   Then mark complete."
  echo ""
  exit 2
fi

exit 0
