#!/bin/bash
# validate-loop-guard.sh — tier-1 regression test for svc-loop-guard.mjs
#
# Locks in the host-agnostic payload contract. Catches the class of bug where:
#   - The guard reads argv instead of stdin and every call fingerprints to {}
#   - Empty/literal "$TOOL_INPUT" payloads get blocked
#   - The tool-name field renders as empty "()"
#
# Fixtures mirror Claude Code, Kimi, Codex, and Gemini PreToolUse shapes.

set -u
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
GUARD="$REPO_ROOT/hooks/svc-loop-guard.mjs"
STATE="$REPO_ROOT/.svc/loop-guard-state.json"

# Session-keyed state files this test's fixtures cause the hook to write. The hook
# uses stateFileFor(sessionId) -> .svc/loop-guard-state-<sid>.json when a payload
# carries session_id; the only such fixture here is "claude-code" (session_id "abc").
# Clearing only $STATE (the legacy/no-session path) left .svc/loop-guard-state-abc.json
# to accumulate identical-`ls` fingerprints across runs until the repetition guard
# tripped on a single fresh call (a residue-poisoned flake, deterministic only in a
# long-lived session). List fixture session files explicitly — NEVER a
# .svc/loop-guard-state-*.json glob, which would clobber other LIVE sessions' state.
FIXTURE_SESSION_STATES=(
  "$REPO_ROOT/.svc/loop-guard-state-abc.json"
)
reset_state() { rm -f "$STATE" "${FIXTURE_SESSION_STATES[@]}"; }

FAIL=0
PASS=0

run_case() {
  local name="$1"; local payload="$2"; local expected_exit="$3"
  reset_state
  local actual_exit
  # shellcheck disable=SC2001
  actual_exit=$(echo "$payload" | node "$GUARD" > /dev/null 2>&1; echo $?)
  if [[ "$actual_exit" == "$expected_exit" ]]; then
    echo "  PASS: $name (exit=$actual_exit)"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name — expected exit=$expected_exit got $actual_exit"
    FAIL=$((FAIL+1))
  fi
}

run_sequence() {
  local name="$1"; shift
  local expected_last_exit="$1"; shift
  reset_state
  local actual_exit=0
  for payload in "$@"; do
    actual_exit=$(echo "$payload" | node "$GUARD" > /dev/null 2>&1; echo $?)
  done
  if [[ "$actual_exit" == "$expected_last_exit" ]]; then
    echo "  PASS: $name (final exit=$actual_exit)"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name — expected final exit=$expected_last_exit got $actual_exit"
    FAIL=$((FAIL+1))
  fi
}

echo "== Host-agnostic payload parsing =="
run_case "claude-code bash" \
  '{"session_id":"abc","tool_name":"Bash","tool_input":{"command":"ls"}}' 0
run_case "kimi bash"         \
  '{"tool_name":"Bash","tool_input":{"command":"ls"}}' 0
run_case "codex shape"       \
  '{"tool":"Bash","arguments":{"command":"ls"}}' 0
run_case "gemini shape"      \
  '{"name":"Bash","args":{"command":"ls"}}' 0

echo "== Fail-open on ambiguous input (prevents the cascade bug) =="
run_case "empty stdin" ""                    0
run_case "empty json"  "{}"                   0
run_case "literal unexpanded envvar" '$TOOL_INPUT' 0
run_case "malformed"   "not-json-at-all"      0
run_case "no tool name" '{"tool_input":{"command":"ls"}}' 0

echo "== Pagination/drill-down is NOT a loop =="
run_sequence "git log pagination" 0 \
  '{"tool_name":"Bash","tool_input":{"command":"git log | head -80"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"git log | sed -n 80,160p"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"git log | sed -n 160,240p"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"git log | sed -n 240,320p"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"git log | sed -n 320,400p"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"git log | sed -n 400,480p"}}'

echo "== Actual repetition IS blocked (exit 2 = universal hard-block code) =="
run_sequence "5x identical ls" 2 \
  '{"tool_name":"Bash","tool_input":{"command":"ls"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"ls"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"ls"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"ls"}}' \
  '{"tool_name":"Bash","tool_input":{"command":"ls"}}'

reset_state

echo
echo "== Summary =="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
