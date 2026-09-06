#!/bin/bash
# validate-claude-skills-symlinks.sh — WI-079 tier-1 validator.
#
# Detects dead symlinks under ~/.claude/skills/ that break Claude Code's
# hook resolution. Root cause: worktree deletion breaks symlinks that
# pointed into the deleted worktree. Recovery: ./setup --host claude.
#
# Exit 0 if skills dir absent (fresh machine) or all symlinks resolve.
# Exit 1 listing dead symlink paths with recovery command.

set -u

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

SKILLS_DIR="$HOME/.claude/skills"

PASS=0
FAIL=0
DEAD=()

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: ~/.claude/skills symlink integrity (WI-079) ==="

if [ ! -d "$SKILLS_DIR" ]; then
  pass "$SKILLS_DIR does not exist — nothing to check (fresh install OK)"
  echo ""
  echo "  PASS — all $PASS assertions passed"
  exit 0
fi

pass "$SKILLS_DIR exists"

# Find all dead symlinks under skills/
# -L so -e checks link target; then negate to find broken ones.
while IFS= read -r link; do
  if [ ! -e "$link" ]; then
    DEAD+=("$link")
  fi
done < <(find "$SKILLS_DIR" -maxdepth 6 -type l 2>/dev/null)

TOTAL=$(find "$SKILLS_DIR" -maxdepth 6 -type l 2>/dev/null | wc -l)
pass "scanned $TOTAL symlinks"

if [ "${#DEAD[@]}" -eq 0 ]; then
  pass "all symlinks resolve to real targets"
else
  for d in "${DEAD[@]}"; do
    target=$(readlink "$d" 2>/dev/null)
    fail "dead symlink: $d → $target"
  done
  echo ""
  echo "  Recovery: run ./setup --host claude from the framework repo to re-point symlinks."
  echo "  Root cause: worktree deletion broke symlinks pointing into the deleted worktree path."
fi

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
