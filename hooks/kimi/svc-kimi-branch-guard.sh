#!/bin/bash
# PreToolUse hook: Block direct commits to main when worktree branch is specified.
# Receives: { tool_name, tool_input, cwd } on stdin.
# Can block (exit 2) with reason on stderr.
#
# Rule: If a lane-tasks file specifies a worktree branch, prevent git commit
# on the main branch. Force the agent to use the worktree branch.

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

# Only check Shell tool calls with git commit
TOOL_NAME=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.tool_name || '');
" 2>/dev/null || echo "")

if [ "$TOOL_NAME" != "Shell" ]; then
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

# Check if this is a git commit call
if ! echo "$COMMAND" | grep -qE '^\s*git\s+commit\b'; then
  exit 0
fi

# Check if --no-verify or other bypass flags are present (already forbidden by KIMI.md)
# We still enforce branch protection

CWD=$(echo "$PAYLOAD" | node -e "
const d = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(d.cwd || '');
" 2>/dev/null || echo "")

if [ -z "$CWD" ]; then
  exit 0
fi

# Check current branch
cd "$CWD" || exit 0
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  exit 0
fi

# Check if any active lane-tasks specifies a worktree branch
WORKTREE_BRANCH=""
while IFS= read -r ltfile; do
  if [ ! -f "$ltfile" ]; then
    continue
  fi
  # Check if this lane-tasks is active (not completed)
  graph_status=$(node -e "
const fs = require('fs');
try {
  const g = JSON.parse(fs.readFileSync('$ltfile', 'utf8'));
  console.log(g.status || 'pending');
} catch (e) { console.log('completed'); }
" 2>/dev/null || echo "completed")

  if [ "$graph_status" = "completed" ]; then
    continue
  fi

  # Check for worktree/branch info in tasks
  branch=$(node -e "
const fs = require('fs');
try {
  const g = JSON.parse(fs.readFileSync('$ltfile', 'utf8'));
  const branch = g.branch || g.worktree || g.metadata?.branch || g.metadata?.worktree || '';
  console.log(branch);
} catch (e) { console.log(''); }
" 2>/dev/null || echo "")

  if [ -n "$branch" ]; then
    WORKTREE_BRANCH="$branch"
    break
  fi
done < <(find "$CWD" -maxdepth 2 -name "lane-tasks-*.json" -path "*/.svc/*" 2>/dev/null)

if [ -z "$WORKTREE_BRANCH" ]; then
  exit 0
fi

# BLOCK: committing to main while a worktree branch is specified
echo ""
echo "❌ BRANCH GUARD (PreToolUse): Commit to '$CURRENT_BRANCH' blocked."
echo "   Active lane-tasks specifies worktree branch: $WORKTREE_BRANCH"
echo "   You MUST commit to the worktree branch, not main."
echo ""
echo "   To switch:"
echo "      git checkout $WORKTREE_BRANCH"
echo "   Or use the worktree:"
echo "      bash $SCRIPT_DIR/scripts/worktree.sh create $WORKTREE_BRANCH"
echo ""
exit 2
