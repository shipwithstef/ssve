#!/bin/bash
# scripts/execute-dispatch-preflight.sh <project-repo-root> <wi-id> [--allow-override-file <path>]
#
# MANDATORY preflight for every execute-changeset invocation.
# Reads the plan's review-log, checks MiMo quota, emits a dispatch decision.
# If decision is MIMO or SONNET, orchestrator MUST dispatch — inline Opus
# execution of file writes is a framework violation unless override_file is
# provided and has been accepted.
#
# Exit codes:
#   0  — decision emitted on stdout; orchestrator proceeds per decision
#   1  — missing inputs (no review-log / no WI) — orchestrator should run
#         review-plan first
#   2  — configuration error
#
# Stdout (single line, machine-parseable):
#   DISPATCH=mimo-pro              (chewed plan + MiMo available)
#   DISPATCH=sonnet                (chewed plan + MiMo exhausted/absent)
#   DISPATCH=opus-override         (override_file present + accepted)
#   DISPATCH=not-required          (plan not yet chewed — run review-plan first)
#
# Decision matrix:
#   | plan chewed? | MiMo quota? | override? | decision          |
#   | no           | —           | —         | not-required (run review-plan first) |
#   | yes          | available   | no        | mimo-pro (MANDATORY)  |
#   | yes          | exhausted   | no        | sonnet (fallback)     |
#   | yes          | any         | yes       | opus-override (logged) |
set -u

REPO_ROOT="${1:-}"
WI_ID="${2:-}"
OVERRIDE_FILE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --allow-override-file) OVERRIDE_FILE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$REPO_ROOT" ] || [ -z "$WI_ID" ]; then
  echo "usage: execute-dispatch-preflight.sh <project-repo-root> <wi-id> [--allow-override-file <path>]" >&2
  exit 2
fi

cd "$REPO_ROOT" 2>/dev/null || { echo "preflight: repo unreadable: $REPO_ROOT" >&2; exit 2; }

# 1. Check for an accepted override
if [ -n "$OVERRIDE_FILE" ] && [ -r "$OVERRIDE_FILE" ]; then
  if grep -q '^accept:[[:space:]]*true' "$OVERRIDE_FILE" 2>/dev/null; then
    REASON=$(grep '^reason:' "$OVERRIDE_FILE" | head -1 | sed 's/^reason:[[:space:]]*//')
    echo "preflight: ACCEPTED OVERRIDE — reason: $REASON" >&2
    echo "preflight: logging to .svc/dispatch-log.jsonl for audit" >&2
    mkdir -p .svc
    python3 -c "
import json, datetime
entry = {
  'ts': datetime.datetime.utcnow().isoformat() + 'Z',
  'harness': 'opus-override',
  'model': 'claude-opus-4-7',
  'skill': 'execute-changeset',
  'wi': '$WI_ID',
  'override_reason': '''${REASON:-unspecified}''',
  'exit_code': 0,
}
print(json.dumps(entry))
" >> .svc/dispatch-log.jsonl
    echo "DISPATCH=opus-override"
    exit 0
  fi
fi

# 2. Look for a review-log that indicates the plan is chewed
# Search for any docs/plans/*/review-log.yaml with terminal_state PROMOTED or REVISED_AND_REVIEWED
REVIEW_LOG=$(find docs/plans -name "review-log.yaml" 2>/dev/null | grep -v /done/ | head -1)
if [ -z "$REVIEW_LOG" ]; then
  # Also try .svc/lane-tasks-*.json for a completed review-plan task
  LANE_TASKS=$(find .svc -name "lane-tasks-${WI_ID}*.json" 2>/dev/null | head -1)
  if [ -z "$LANE_TASKS" ]; then
    echo "preflight: no review-log.yaml and no lane-tasks for $WI_ID — plan not chewed" >&2
    echo "DISPATCH=not-required"
    exit 0
  fi
  # Check if review-plan task is completed
  REVIEWED=$(python3 -c "
import json, sys
try:
    with open('$LANE_TASKS') as f:
        g = json.load(f)
    for t in g.get('tasks', []):
        if t.get('skill') == 'review-plan' and t.get('status') == 'completed':
            print('yes')
            break
except Exception as e:
    pass
")
  if [ "$REVIEWED" != "yes" ]; then
    echo "preflight: review-plan task not yet completed in $LANE_TASKS — plan not chewed" >&2
    echo "DISPATCH=not-required"
    exit 0
  fi
fi

# At this point the plan is CHEWED. Opus inline is forbidden without override.
# Check MiMo quota via the probe script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIMO_CHECK=$(bash "$SCRIPT_DIR/check-mimo-quota.sh" 2>/dev/null | tail -1)

case "$MIMO_CHECK" in
  USE_MIMO_PRO)
    echo "preflight: plan chewed + MiMo Pro available → MANDATORY MiMo dispatch" >&2
    echo "DISPATCH=mimo-pro"
    exit 0
    ;;
  USE_SONNET)
    echo "preflight: plan chewed + MiMo Pro unavailable → Sonnet fallback dispatch" >&2
    echo "DISPATCH=sonnet"
    exit 0
    ;;
  *)
    echo "preflight: MiMo quota probe returned unexpected: $MIMO_CHECK — defaulting to Sonnet fallback" >&2
    echo "DISPATCH=sonnet"
    exit 0
    ;;
esac
