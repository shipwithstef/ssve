#!/usr/bin/env bash
# validate-git-isolation-meta.sh — WI-375: validators creating scratch git repos
# must never run bare git mutations (cd-relative); identity leaked into the REAL
# repo twice (WI-358 GIT_DIR leak; WI-363-closeout recurrence). Every git config/
# init/commit/add in tier-1 sources must be -C-scoped (helper functions count
# when they wrap `git -C`).
# Promotion note: validator_path=this; failure_class=fixture-git-identity-leak;
# promotion_signal=§1 twice-in-60d (2026-06-07 incident log); runtime <1s hermetic;
# tier-2 insufficient: leak corrupts the real repo on every lint run.
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR" || exit 1
PASS=0; FAIL=0
SELF="validate-git-isolation-meta.sh"
for f in *.sh *.mjs; do
  [ "$f" = "$SELF" ] && continue
  [ -f "$f" ] || continue
  # bare mutating git at line start or after common separators, NOT followed by -C and NOT inside a `git -C` wrapper line
  hits=$(grep -nE '(^|[;&|]\s*|\$\(\s*)git (config user|init|commit|add|notes|mv|rm|checkout|switch|reset|branch|merge|rebase|worktree (add|remove|move|prune|repair|lock|unlock)|update-ref|symbolic-ref)\b' "$f" 2>/dev/null | grep -v "git -C" | grep -vE '^\s*[0-9]+:\s*#' | grep -vE 'tool_input|payload|\"command\"' || true)
  if [ -n "$hits" ]; then
    echo "  ✗ $f"; echo "$hits" | sed 's/^/      /' | head -4
    FAIL=$((FAIL+1))
  else
    PASS=$((PASS+1))
  fi
done
echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — $PASS validator sources git-isolation clean"; exit 0
else echo "  $FAIL validator source(s) with bare mutating git"; exit 1; fi
