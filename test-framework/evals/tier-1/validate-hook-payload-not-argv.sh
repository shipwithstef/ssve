#!/usr/bin/env bash
# validate-hook-payload-not-argv.sh — regression guard for the ARG_MAX/E2BIG class:
# a hook must NEVER hand a large stdin payload to a child via argv OR env var
# (envp counts toward ARG_MAX). A 200KB Edit payload through svc-wi-pillars-check.sh
# must not produce "Argument list too long" and must not hard-abort (exit 126).
# Promotion note: validator_path=this; failure_class=hook-payload-argmax-e2big;
# promotion_signal=live regression 2026-06-08 (PostToolUse:Edit hard-fail) +
# documented learning cli-prompt-packages-stdin-not-argv; runtime <2s hermetic;
# tier-2 insufficient: every large Edit fires this hook on every session.
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-wi-pillars-check.sh"   # behavioral anchor (original regression)
# WI-379: the static source heuristic now sweeps ALL svc-*.sh hooks, not just
# the pillars hook — any svc hook that env-exports or argv-passes the payload
# var to a child is the same ARG_MAX/E2BIG class.
shopt -s nullglob
HOOKS_TO_SWEEP=("$REPO_ROOT"/hooks/svc-*.sh)
if [[ "${#HOOKS_TO_SWEEP[@]}" -eq 0 ]]; then
  echo "  FAIL — no hooks/svc-*.sh matched; vacuous PASS is the bug (check REPO_ROOT=$REPO_ROOT)"
  exit 1
fi
PASS=0; FAIL=0
# Assertions evaluate a boolean computed IN THIS shell — never inside a child
# bash -c (which would lose parent vars like $OUT and silently pass; G6-001).
assert(){ if [ "$2" = 1 ]; then echo "  ✓ $1"; PASS=$((PASS+1)); else echo "  ✗ $1"; FAIL=$((FAIL+1)); fi; }

# 300KB payload reproduces the E2BIG class (envp+argv both bounded by ARG_MAX).
BIG="$(node -e 'process.stdout.write(JSON.stringify({tool_input:{file_path:"README.md",new_string:"x".repeat(300000)}}))')"
OUT="$(printf '%s' "$BIG" | bash "$HOOK" 2>&1)"; CODE=$?

grep -q 'Argument list too long' <<<"$OUT" && E2BIG=1 || E2BIG=0
assert "200KB+ payload: no 'Argument list too long'" "$([ "$E2BIG" = 0 ] && echo 1 || echo 0)"
assert "200KB+ payload: hook does not hard-abort (exit != 126/127)" "$([ "$CODE" != 126 ] && [ "$CODE" != 127 ] && echo 1 || echo 0)"
assert "200KB+ non-WI payload exits 0 (no-op)" "$([ "$CODE" = 0 ] && echo 1 || echo 0)"

# Behavioral test above is authoritative. This static check is a HEURISTIC
# backstop: the payload var must not reach a child via env-export OR argv —
# swept across EVERY svc-*.sh hook (WI-379).
# NOTE: bounded tmpfile-PATH env vars (_GUARD_TMP, _SVC_E2E_INPUT) are
# intentionally outside this heuristic — they carry /tmp paths, not payload
# content. The BEHAVIORAL 300KB check above is the authoritative gate for
# detecting actual ARG_MAX/E2BIG violations.
SRC_BAD=0
BAD_HOOKS=""
for H in "${HOOKS_TO_SWEEP[@]}"; do
  [ -f "$H" ] || continue
  HBAD=0
  grep -qE '(HOOK_INPUT|INPUT|PAYLOAD|LANE_TASKS_LIST)="\$(INPUT|HOOK_INPUT|PAYLOAD|LANE_TASKS_LIST)"[[:space:]]+(node|python)' "$H" && HBAD=1   # env-export ordering
  grep -qE '(node|python)([^|<]*)"\$(INPUT|HOOK_INPUT|PAYLOAD|LANE_TASKS_LIST)"' "$H" && HBAD=1                                                  # argv ordering
  if [ "$HBAD" = 1 ]; then SRC_BAD=1; BAD_HOOKS="$BAD_HOOKS $(basename "$H")"; fi
done
assert "no svc hook passes the payload var to a child (env or argv heuristic; swept all svc-*.sh)${BAD_HOOKS:+ — offenders:$BAD_HOOKS}" "$([ "$SRC_BAD" = 0 ] && echo 1 || echo 0)"

echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — all $PASS hook-payload checks passed"; exit 0
else echo "  $FAIL failed, $PASS passed"; exit 1; fi
