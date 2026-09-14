#!/usr/bin/env bash
# Tier 1: Validate worktree safety infrastructure.
# Checks: .gitignore exists and ignores .worktrees/, scripts/worktree.sh exists
# and is executable, no orphaned worktrees under .worktrees/ or /tmp/svc-*.
# No LLM, <5s.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

PASS=0
FAIL=0
ERRORS=""

echo "=== Tier 1: Worktree Safety Validation ==="

# Check if we are in an installed environment (path contains .agents/skills)
# In installed environments, some repo-level files like .gitignore are not present.
IS_INSTALLED=false
if [[ "$REPO_ROOT" == *".agents/skills"* ]]; then
  IS_INSTALLED=true
fi

# 1. .gitignore exists
if [[ "$IS_INSTALLED" == "true" ]]; then
  PASS=$((PASS + 1))
elif [[ -f "$REPO_ROOT/.gitignore" ]]; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: .gitignore does not exist\n"
  FAIL=$((FAIL + 1))
fi

# 2. .gitignore contains serious vibe coding ignores envelope
if [[ "$IS_INSTALLED" == "true" ]]; then
  PASS=$((PASS + 1))
elif [[ -f "$REPO_ROOT/.gitignore" ]] && grep -q '# === BEGIN SERIOUS VIBE CODING IGNORES ===' "$REPO_ROOT/.gitignore" && grep -q '\.worktrees' "$REPO_ROOT/.gitignore" && grep -q '\.svc/\*\.log' "$REPO_ROOT/.gitignore"; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: .gitignore is missing Serious Vibe Coding ignore block or core patterns.\n"
  ERRORS+="  RECOVERY: Run 'node scripts/init-project-state.mjs' to automatically provision or repair framework ignores.\n"
  FAIL=$((FAIL + 1))
fi

# 3. git check-ignore confirms .worktrees/ is ignored
if [[ "$IS_INSTALLED" == "true" ]]; then
  PASS=$((PASS + 1))
elif (cd "$REPO_ROOT" && git check-ignore -q .worktrees/ 2>/dev/null); then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: .worktrees/ is not actually git-ignored (git check-ignore failed)\n"
  FAIL=$((FAIL + 1))
fi

# 4. scripts/worktree.sh exists and is executable
if [[ -x "$REPO_ROOT/scripts/worktree.sh" ]]; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: scripts/worktree.sh does not exist or is not executable\n"
  FAIL=$((FAIL + 1))
fi

# 5. WORKTREES.md exists
if [[ "$IS_INSTALLED" == "true" ]]; then
  PASS=$((PASS + 1))
elif [[ -f "$REPO_ROOT/WORKTREES.md" ]]; then
  PASS=$((PASS + 1))
else
  ERRORS+="  FAIL: WORKTREES.md does not exist\n"
  FAIL=$((FAIL + 1))
fi

# 6. No orphaned .worktrees/ directories (entries not in git worktree list)
# WI-562 IP-H3: .quarantine/ is preserved evidence, not an orphan.
if [[ -d "$REPO_ROOT/.worktrees" ]]; then
  KNOWN_PATHS=$(cd "$REPO_ROOT" && git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //')
  for dir in "$REPO_ROOT/.worktrees"/*/; do
    [[ ! -d "$dir" ]] && continue
    dir="${dir%/}"
    [[ "${dir##*/}" == ".quarantine" ]] && continue
    if ! echo "$KNOWN_PATHS" | grep -q "^${dir}$"; then
      ERRORS+="  FAIL: orphaned worktree directory: $dir\n"
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  done
fi

# 7. No orphaned /tmp/svc-test-* worktrees
for dir in /tmp/svc-test-*/; do
  [[ ! -d "$dir" ]] && continue
  ERRORS+="  FAIL: orphaned temp worktree: $dir\n"
  FAIL=$((FAIL + 1))
done
# If no /tmp dirs found, that's a pass
if ! compgen -G "/tmp/svc-test-*/" >/dev/null 2>&1; then
  PASS=$((PASS + 1))
fi

echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — worktree safety checks valid"
  exit 0
fi
