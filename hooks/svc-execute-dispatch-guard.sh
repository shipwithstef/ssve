#!/bin/bash
# hooks/svc-execute-dispatch-guard.sh
#
# Pre-commit / pre-land guard that enforces MiMo-mandatory-for-chewed-plans.
# Run from project repo root (example-marketplace, not svc). Exits non-zero if a commit
# touches execute-changeset-scoped files (src/ edits) for a WI whose plan
# review-log.yaml has terminal_state PROMOTED* or REVISED_AND_REVIEWED, AND
# .svc/dispatch-log.jsonl has no matching mimo-pro / sonnet / opus-override
# entry in the last N minutes.
#
# Intent: catch the silent-bypass pattern where orchestrator (Opus or user-
# driven) writes files inline despite a chewed plan existing.
#
# Install (per-project, opt-in, user runs once):
#   ln -sf "$(pwd)/hooks/svc-execute-dispatch-guard.sh" .git/hooks/pre-commit
#   (or symlink from the svc framework location)
#
# Output:
#   exit 0  — no violation detected, commit allowed
#   exit 1  — violation: inline execution detected without matching dispatch entry
#   exit 2  — usage / setup error (non-blocking — framework hook skips)
#
# Bypass in emergencies: git commit --no-verify (but orchestrator is instructed
# never to skip hooks; use --allow-override-file path as the principled escape)
set -u

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
[ -z "$REPO_ROOT" ] && { echo "svc-dispatch-guard: not in a git repo, skipping" >&2; exit 2; }
cd "$REPO_ROOT" || exit 2

# Only guards commits that touch src/ (execute-changeset scope). Docs / plan /
# benchmark / .svc metadata commits are out of scope.
STAGED_SRC=$(git diff --cached --name-only 2>/dev/null | grep -E '^src/' | head -5)
[ -z "$STAGED_SRC" ] && exit 0

# Look for a chewed plan — any review-log.yaml (not in done/) with a passing state
REVIEW_LOG=$(find docs/plans -name "review-log.yaml" 2>/dev/null | grep -v /done/ | head -1)
if [ -z "$REVIEW_LOG" ]; then
  # No chewed plan → no enforcement (this is either a quick-fix or no-review path)
  exit 0
fi

# Extract the terminal state
TERMINAL_STATE=$(grep -E '^\s*terminal_state:' "$REVIEW_LOG" 2>/dev/null | head -1 | sed -E 's/.*terminal_state:[[:space:]]*//' | tr -d '"')
case "$TERMINAL_STATE" in
  PROMOTED|PROMOTED_WITH_DISPUTES|REVISED_AND_REVIEWED)
    ;;
  *)
    # Plan review exists but not in a chewed state → no enforcement
    exit 0
  ;;
esac

# Plan IS chewed. Require a recent dispatch entry matching execute-changeset.
DISPATCH_LOG=".svc/dispatch-log.jsonl"
if [ ! -r "$DISPATCH_LOG" ]; then
  echo "" >&2
  echo "🚫 svc-dispatch-guard: BLOCKED" >&2
  echo "  Chewed plan detected ($REVIEW_LOG state=$TERMINAL_STATE)" >&2
  echo "  Staged src/ changes: $(echo "$STAGED_SRC" | wc -l) files" >&2
  echo "  But .svc/dispatch-log.jsonl does not exist — no MiMo/Sonnet dispatch logged." >&2
  echo "" >&2
  echo "  This commit bypasses the MiMo-mandatory rule (FRAMEWORK-STATE 2026-04-20 decision)." >&2
  echo "  Fix: either (a) revert, dispatch via scripts/dispatch-log.sh opencode execute-changeset," >&2
  echo "              or (b) write an override file and re-run scripts/execute-dispatch-preflight.sh." >&2
  exit 1
fi

# Check last 6 hours of dispatch-log for an execute-changeset entry
# (6 hours = reasonable session length; adjust if needed)
SIX_HOURS_AGO=$(date -u -d "6 hours ago" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
                date -u -v-6H +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || \
                echo "")

RECENT_DISPATCH=$(python3 -c "
import json
from datetime import datetime, timezone, timedelta
cutoff = datetime.now(timezone.utc) - timedelta(hours=6)
found = False
try:
    for line in open('$DISPATCH_LOG'):
        try:
            e = json.loads(line)
            ts_str = e.get('ts', '')
            if not ts_str: continue
            ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
            if ts < cutoff: continue
            if e.get('skill') != 'execute-changeset': continue
            model = e.get('model', '')
            harness = e.get('harness', '')
            if 'mimo' in model or 'sonnet' in model or harness == 'opus-override':
                found = True
                break
        except: continue
except: pass
print('yes' if found else 'no')
")

if [ "$RECENT_DISPATCH" = "yes" ]; then
  echo "svc-dispatch-guard: recent execute-changeset dispatch logged — commit allowed" >&2
  exit 0
fi

# Violation
echo "" >&2
echo "🚫 svc-dispatch-guard: BLOCKED" >&2
echo "  Chewed plan detected ($REVIEW_LOG state=$TERMINAL_STATE)" >&2
echo "  Staged src/ changes: $(echo "$STAGED_SRC" | wc -l) files" >&2
echo "  But no execute-changeset dispatch (mimo/sonnet/override) logged in last 6h in $DISPATCH_LOG" >&2
echo "" >&2
echo "  This commit appears to bypass the MiMo-mandatory rule." >&2
echo "  Per FRAMEWORK-STATE 2026-04-20 locked decision:" >&2
echo "    - execute-changeset requires MiMo Pro dispatch when plan is chewed" >&2
echo "    - Sonnet fallback is allowed only on MiMo quota exhaustion (logged automatically by preflight)" >&2
echo "    - Opus inline requires an accepted override file with written justification" >&2
echo "" >&2
echo "  Fix one of these:" >&2
echo "    (a) Revert the inline writes: git reset, dispatch via" >&2
echo "        bash scripts/dispatch-log.sh opencode execute-changeset @/tmp/payload.txt" >&2
echo "    (b) Write override: echo -e 'accept: true\\nreason: <why>' > /tmp/override.yaml" >&2
echo "        bash scripts/execute-dispatch-preflight.sh \"\$PWD\" <wi-id> --allow-override-file /tmp/override.yaml" >&2
echo "" >&2
echo "  Emergency-only bypass: git commit --no-verify (discouraged, but unblocks for real incidents)." >&2
exit 1
