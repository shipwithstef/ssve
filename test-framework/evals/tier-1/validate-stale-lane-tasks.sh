#!/usr/bin/env bash
# Tier 1: detect stale .svc/lane-tasks-<WI>.json files whose WI commits are
# already on main. Prevents the failure mode where a deleted-worktree's
# lane-tasks file gets read by hooks/agents as if it represented active work.
#
# Source: 2026-04-30 incident — phantom WI-SPINE-001 status report after PR
# #55 merged. The lane-tasks file lived in the (deleted) worktree's .svc/
# but a copy persisted in main's .svc/ and got reported as 'pending'.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SVC_DIR="$REPO_ROOT/.svc"
PASS=0
STALE=0
ERRORS=""

[[ -d "$SVC_DIR" ]] || { echo "validate-stale-lane-tasks: no .svc dir — OK"; exit 0; }

while IFS= read -r ltf; do
  base=$(basename "$ltf")
  # Skip files already marked stale (.completed-* suffix)
  [[ "$base" == *.completed-* ]] && continue
  # Extract WI from lane-tasks-<WI>.json
  wi=$(echo "$base" | sed -n 's/^lane-tasks-\(.*\)\.json$/\1/p')
  [[ -z "$wi" ]] && continue
  # If commits referencing this WI exist in git history, the WI is landed
  if git -C "$REPO_ROOT" log --all --oneline --grep="$wi" 2>/dev/null | grep -qE "(#[0-9]+\)|feat\(|land|merge)"; then
    ERRORS+="  STALE: $base — WI $wi has merged commits in git history; rename to ${base%.json}.completed-<PR>.json or remove\n"
    STALE=$((STALE+1))
  else
    PASS=$((PASS+1))
  fi
done < <(find "$SVC_DIR" -maxdepth 1 -name "lane-tasks-*.json" -type f 2>/dev/null)

echo "validate-stale-lane-tasks: $PASS active, $STALE stale"
if [[ -n "$ERRORS" ]]; then
  printf "%b" "$ERRORS"
  # Phase A: warn-only
fi
exit 0
