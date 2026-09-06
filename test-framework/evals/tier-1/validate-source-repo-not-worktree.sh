#!/bin/bash
# validate-source-repo-not-worktree.sh — WI-134 tier-1 inflow guard.
#
# A host install (~/.<host>/skills/) bound to a worktree path becomes a
# time-bomb: when the worktree is later removed, every symlink dangles and
# the SessionStart self-heal can lose both pointers simultaneously
# (the WI-134 recurrence). This validator fails CI if any installed host
# pointer or symlink target contains "/.worktrees/".
#
# Host-aware: iterates the canonical install roots for every supported host
# (claude, kimi, codex, gemini, opencode). If none of them exist on this
# machine, emits a PASS line and exits 0 — fresh contributor environments
# without any svc install are not in scope.
#
# Exit 0 if no host install dirs OR all checked pointers/symlinks are
# canonical (no .worktrees/ substring).
# Exit 1 listing the offending paths and the recovery command.

set -u

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: host install pointers must not be worktree-bound (WI-134) ==="

# Canonical host install roots — must match scripts/init-project-state.mjs
# and provision/hosts/*.json `skills_path` fields.
HOST_ROOTS=(
  "$HOME/.claude/skills"
  "$HOME/.kimi/skills"
  "$HOME/.codex/skills"
  "$HOME/.gemini/skills"
  "$HOME/.config/opencode/skills"
)

ANY_ROOT=0
for ROOT in "${HOST_ROOTS[@]}"; do
  [ -d "$ROOT" ] && ANY_ROOT=1 && break
done

if [ "$ANY_ROOT" = 0 ]; then
  pass "no host install dirs — nothing to check (fresh contributor environment OK)"
  echo ""
  echo "  PASS — all $PASS assertions passed"
  exit 0
fi

for ROOT in "${HOST_ROOTS[@]}"; do
  [ -d "$ROOT" ] || continue
  pass "host root exists: $ROOT"

  # Check 1: .source-repo pointer
  POINTER="$ROOT/.source-repo"
  if [ -f "$POINTER" ]; then
    POINTER_VAL="$(cat "$POINTER" 2>/dev/null)"
    if [[ "$POINTER_VAL" == *"/.worktrees/"* ]]; then
      fail ".source-repo points at a worktree path: $POINTER → $POINTER_VAL"
    else
      pass ".source-repo canonical: $POINTER_VAL"
    fi
  fi

  # Check 2: every symlink under ROOT must resolve to a non-.worktrees/ path
  COUNT=0
  WT_HITS=()
  while IFS= read -r link; do
    [ -z "$link" ] && continue
    COUNT=$((COUNT + 1))
    target="$(readlink "$link" 2>/dev/null)"
    if [[ "$target" == *"/.worktrees/"* ]]; then
      WT_HITS+=("$link → $target")
    fi
  done < <(find "$ROOT" -maxdepth 6 -type l 2>/dev/null)

  pass "scanned $COUNT symlinks under $ROOT"

  if [ "${#WT_HITS[@]}" -gt 0 ]; then
    for h in "${WT_HITS[@]}"; do
      fail "symlink target inside .worktrees/: $h"
    done
  else
    pass "no symlink targets inside .worktrees/ under $ROOT"
  fi
done

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  echo ""
  echo "  Recovery: cd to the canonical svc checkout (NOT a worktree) and run"
  echo "    ./setup --host <host>"
  echo "  This rewrites pointers and symlinks to the canonical path."
  echo "  Root cause: setup was run from inside .worktrees/<name>/ (or with"
  echo "  SVC_SETUP_ALLOW_WORKTREE=1 bypass) — see WI-134 brief."
  exit 1
fi
