#!/usr/bin/env bash
# Tier 1: route-workflow must close completed scoped worktrees and branches.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/route-workflow/SKILL.md"
REF="$REPO_ROOT/skills/route-workflow/references/worktree-branch-hygiene-closeout.md"
WORKTREE_SH="$REPO_ROOT/scripts/worktree.sh"

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

require_fixed() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: route-workflow worktree/branch hygiene closeout ==="

require_fixed "$SKILL" "## Worktree/Branch Hygiene Closeout" "hygiene closeout section exists"
require_fixed "$REF" "git worktree list --porcelain" "worktree registry check required"
require_fixed "$REF" "git branch --list '<scope-pattern>*' -vv" "scoped local branch check required"
require_fixed "$REF" "git ls-remote --heads origin '<scope-pattern>*'" "scoped remote branch check required"
require_fixed "$REF" "every canonical alias for the completed scope" "all canonical aliases required"
require_fixed "$REF" 'compact lowercase: `wi304`' "compact WI alias example required"
require_fixed "$REF" 'hyphenated lowercase: `wi-304`' "hyphenated lowercase WI alias example required"
require_fixed "$REF" 'hyphenated uppercase: `WI-304`' "hyphenated uppercase WI alias example required"
require_fixed "$REF" "closeout that checks only the active branch name is incomplete" "active-branch-only closeout forbidden"
require_fixed "$REF" 'For squash-merged PRs, the branch head is usually not an ancestor of `origin/main`.' "squash merge ancestry caveat required"
require_fixed "$REF" "gh pr list --head '<branch>' --state all --json number,state,mergedAt,url" "merged PR proof command required"
require_fixed "$REF" "Remove completed clean worktrees" "completed clean worktree removal required"
require_fixed "$REF" "Preserve dirty, unmerged, open-PR, or user-requested worktrees/branches" "preservation blockers required"
require_fixed "$SKILL" "Worktree/branch hygiene closed" "self-verify covers hygiene closeout"
require_fixed "$REF" "Delete stale local branches only after verifying the PR is merged" "reference requires safe local branch deletion"
require_fixed "$REF" 'branch is an ancestor of `origin/main`.' "reference requires origin/main ancestry proof"
require_fixed "$REF" 'Delete stale remote branches only after verifying the PR for that head is' "reference requires safe remote branch deletion"
require_fixed "$REF" "Preserve remote branches with open PRs, closed-unmerged PRs, no PR and no" "remote preservation blockers required"
require_fixed "$SKILL" "scan every canonical scope alias" "route-workflow mandates canonical alias scan"

require_fixed "$WORKTREE_SH" 'git merge-base --is-ancestor "$branch_name" origin/main' "worktree remove checks origin/main ancestry"
require_fixed "$WORKTREE_SH" "merged to origin/main" "worktree remove reports origin/main merge cleanup"
require_fixed "$WORKTREE_SH" "not merged to main or origin/main" "worktree remove preserves truly unmerged branches"

echo ""
echo "route-workflow worktree/branch hygiene closeout: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
