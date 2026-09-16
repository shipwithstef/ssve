#!/bin/bash
# validate-claude-hook-e2e.sh — Tier 1 end-to-end validation for critical Claude hooks.
# Note: set -x is intentionally enabled and redirected to /dev/null to work around
# a buffering issue where node.js stdout is not reliably flushed to a file redirect
# when run through the eval orchestrator. The trace has zero functional impact.
exec 19>/dev/null
BASH_XTRACEFD=19
set -x
#
# COST: $0 — no LLM calls. Pipes synthetic JSON payloads through hook scripts.
#
# Tests:
#   - svc-workflow-guard.mjs (config protection)
#   - svc-workflow-guard.mjs --phase-boundary (dynamic phase gate)
#   - svc-workflow-guard.mjs --bash-guard (no-verify block)
#   - svc-workflow-guard.mjs default mode (workflow scope warning)
#   - svc-stop-quality.js --accumulate (edit accumulator)
#   - svc-task-completion-guard.sh (blocks stop when actionable tasks remain)
#   - svc-task-completion-guard.sh (advisory-only when session contract is not backlog-bound)
#
# Exit 0: all checks pass
# Exit 1: one or more checks fail

set -euo pipefail

# grep -q closes stdin on the first match. Combined with pipefail, a producer still
# writing a long denial receipt can exit 141 and invert a true match. Consume the
# complete haystack through a here-string instead of an early-exit pipe.
contains_ci() {
  grep -qi -- "$1" <<<"$2"
}

PIPE_LOCK=$(python3 -c 'print("BLOCKED" + chr(10) + "x"*131072)')
if ! contains_ci "BLOCKED" "$PIPE_LOCK"; then
  echo "  ✗ here-string must match BLOCKED in a 128KiB haystack without pipefail inversion"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
ERRORS=0

fail() {
  echo "  ✗ $1"
  ERRORS=$((ERRORS + 1))
}

pass() {
  echo "  ✓ $1"
}

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# =============================================================================
# Helper: run workflow guard with JSON payload on stdin.
# Claude/Kimi/Codex/Gemini all pipe the hook envelope on stdin — the hook
# reads via hooks/lib/hook-payload.mjs which requires tool_name + tool_input.
# Pass a tool_input object as $2; we wrap it in a Claude-shape envelope.
# =============================================================================
run_workflow_guard() {
  local mode="$1"
  local tool_input="$2"
  local tool_name="${3:-Edit}"
  local envelope="{\"tool_name\":\"${tool_name}\",\"tool_input\":${tool_input}}"
  if [ -n "$mode" ]; then
    echo "$envelope" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" "$mode" 2>&1 || true
  else
    echo "$envelope" | node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" 2>&1 || true
  fi
}

# =============================================================================
# 1. Config protection: package-lock.json should be BLOCKED
# =============================================================================
echo "=== Tier 1: Claude Hook End-to-End Validation ==="

CONFIG_PAYLOAD='{"file_path":"/home/user/project/package-lock.json","content":"{}"}'
CONFIG_RESULT=$(run_workflow_guard "" "$CONFIG_PAYLOAD")
if contains_ci "BLOCKED" "$CONFIG_RESULT"; then
  pass "config-protection blocks package-lock.json"
else
  fail "config-protection should block package-lock.json (output: $CONFIG_RESULT)"
fi

# =============================================================================
# 2. Config protection: README.md should be ALLOWED
# =============================================================================
README_PAYLOAD='{"file_path":"/home/user/project/README.md","content":"# Hello"}'
README_RESULT=$(run_workflow_guard "" "$README_PAYLOAD")
if contains_ci "BLOCKED" "$README_RESULT"; then
  fail "config-protection should allow README.md (output: $README_RESULT)"
else
  pass "config-protection allows README.md"
fi

# =============================================================================
# 3. Phase boundary: tech-design.md with pending prerequisite should be BLOCKED
# =============================================================================
mkdir -p "$TMP_DIR/.svc"
cat > "$TMP_DIR/.svc/lane-tasks-WI-999.json" <<'EOF'
{
  "wi": "WI-999",
  "lane": "greenfield",
  "tasks": [
    {"id": 1, "skill": "write-spec", "status": "completed"},
    {"id": 2, "skill": "design-ux", "status": "completed"},
    {"id": 3, "skill": "design-ui", "status": "pending"},
    {"id": 4, "skill": "design-tech", "status": "pending"}
  ]
}
EOF
cat > "$TMP_DIR/.svc/capability-registry.json" <<'EOF'
{"version": 1, "capabilities": {}}
EOF

PHASE_PAYLOAD='{"file_path":"docs/specs/tech-design.md","content":"# Tech Design"}'
PHASE_RESULT=$(cd "$TMP_DIR" && run_workflow_guard "--phase-boundary" "$PHASE_PAYLOAD")
if contains_ci "BLOCKED" "$PHASE_RESULT"; then
  pass "phase-boundary blocks tech-design.md when design-ui is pending"
else
  fail "phase-boundary should block tech-design.md when prerequisite pending (output: $PHASE_RESULT)"
fi

# =============================================================================
# 4. Phase boundary: tech-design.md with completed prerequisite should be ALLOWED
# =============================================================================
cat > "$TMP_DIR/.svc/lane-tasks-WI-999.json" <<'EOF'
{
  "wi": "WI-999",
  "lane": "greenfield",
  "tasks": [
    {"id": 1, "skill": "write-spec", "status": "completed"},
    {"id": 2, "skill": "design-ux", "status": "completed"},
    {"id": 3, "skill": "design-ui", "status": "completed"},
    {"id": 4, "skill": "design-tech", "status": "pending"}
  ]
}
EOF

PHASE_RESULT2=$(cd "$TMP_DIR" && run_workflow_guard "--phase-boundary" "$PHASE_PAYLOAD")
if contains_ci "BLOCKED" "$PHASE_RESULT2"; then
  fail "phase-boundary should allow tech-design.md when prerequisite completed (output: $PHASE_RESULT2)"
else
  pass "phase-boundary allows tech-design.md when design-ui is completed"
fi

# =============================================================================
# 5. Bash guard: git commit --no-verify should be BLOCKED
# =============================================================================
BASH_PAYLOAD='{"command":"git commit --no-verify -m \"test\""}'
BASH_RESULT=$(run_workflow_guard "--bash-guard" "$BASH_PAYLOAD" "Bash")
if contains_ci "BLOCKED" "$BASH_RESULT"; then
  pass "bash-guard blocks git commit --no-verify"
else
  fail "bash-guard should block --no-verify (output: $BASH_RESULT)"
fi

# =============================================================================
# 6. Bash guard: git commit with Co-Authored-By should be ALLOWED
# =============================================================================
BASH_PAYLOAD2='{"command":"git commit -m \"fix typo\" -m \"Co-Authored-By: Test <test@example.com>\""}'
BASH_RESULT2=$(run_workflow_guard "--bash-guard" "$BASH_PAYLOAD2" "Bash")
if contains_ci "BLOCKED" "$BASH_RESULT2"; then
  fail "bash-guard should allow commit with Co-Authored-By (output: $BASH_RESULT2)"
else
  pass "bash-guard allows commit with Co-Authored-By trailer"
fi

# =============================================================================
# 7. Stop hook: blocks when actionable tasks remain
# =============================================================================
STOP_DIR="$TMP_DIR/stop-test-7"
mkdir -p "$STOP_DIR/.svc"
cat > "$STOP_DIR/.svc/lane-tasks-WI-stop.json" <<'EOF'
{
  "wi": "WI-stop",
  "lane": "bugfix",
  "tasks": [
    {"id": 1, "skill": "diagnose-bug", "subject": "diagnose", "status": "pending", "blocked_by": []}
  ]
}
EOF

cd "$STOP_DIR"
# Use a unique session_id so the completion counter starts fresh and is not
# contaminated by prior test runs (the counter is keyed by session_id).
TEST_SESSION_ID="hook-e2e-7-$(date +%s%N)-$$"
printf '%s' "{\"session_id\":\"$TEST_SESSION_ID\"}" > "$TMP_DIR/stop-input.json"
# Use script -q to force a pseudo-TTY so node.js flushes stdout reliably.
# Unset BASH_XTRACEFD inside the subshell so script's inner bash does not
# inherit the xtrace fd redirect (which would send output to /dev/null).
(
  unset BASH_XTRACEFD
  script -q /dev/null -c "bash \"$REPO_ROOT/hooks/svc-task-completion-guard.sh\" < \"$TMP_DIR/stop-input.json\"" > "$TMP_DIR/stop-result-7.txt" 2>&1 || true
)
# Remove script's control characters and prompt artifacts
sed -i 's/\r$//' "$TMP_DIR/stop-result-7.txt"
STOP_RESULT=$(cat "$TMP_DIR/stop-result-7.txt" || true)
cd "$REPO_ROOT"

if contains_ci '"decision":"block"' "$STOP_RESULT"; then
  pass "task-completion-guard blocks stop when pending tasks exist"
else
  fail "task-completion-guard should block when pending tasks exist (output: $STOP_RESULT)"
fi

# =============================================================================
# 8. Stop hook: allows when all tasks completed + decision log + skill receipt
# =============================================================================
STOP_DIR2="$TMP_DIR/stop-test-8"
mkdir -p "$STOP_DIR2/.svc"
cat > "$STOP_DIR2/.svc/lane-tasks-WI-stop.json" <<'EOF'
{
  "wi": "WI-stop",
  "lane": "bugfix",
  "tasks": [
    {
      "id": 1,
      "skill": "diagnose-bug",
      "subject": "diagnose",
      "status": "completed",
      "blocked_by": [],
      "completed_at": "2026-04-23T00:00:00Z",
      "skill_receipt": {
        "skill": "diagnose-bug",
        "loaded_at": "2026-04-23T00:00:00Z",
        "loaded_via": "manual"
      }
    }
  ]
}
EOF
# Decision log is required for completed WIs
cat > "$STOP_DIR2/.svc/pipeline-decisions.jsonl" <<'EOF'
{"timestamp":"2026-04-23T00:00:00Z","run_id":"WI-stop","skill":"route-workflow","decision":"bugfix","reasoning":"User reported auth bug"}
EOF

cd "$STOP_DIR2"
TEST_SESSION_ID2="hook-e2e-8-$(date +%s%N)-$$"
printf '%s' "{\"session_id\":\"$TEST_SESSION_ID2\"}" > "$TMP_DIR/stop-input.json"
(
  unset BASH_XTRACEFD
  script -q /dev/null -c "bash \"$REPO_ROOT/hooks/svc-task-completion-guard.sh\" < \"$TMP_DIR/stop-input.json\"" > "$TMP_DIR/stop-result-8.txt" 2>&1 || true
)
sed -i 's/\r$//' "$TMP_DIR/stop-result-8.txt"
STOP_RESULT2=$(cat "$TMP_DIR/stop-result-8.txt" || true)
cd "$REPO_ROOT"

if contains_ci '"decision":"block"' "$STOP_RESULT2"; then
  fail "task-completion-guard should allow stop when all tasks completed (output: $STOP_RESULT2)"
else
  pass "task-completion-guard allows stop when no actionable tasks remain"
fi

# =============================================================================
# 9. Stop hook: advisory-only when session contract is bound to a user/framework request
# =============================================================================
STOP_DIR3="$TMP_DIR/stop-test-9"
mkdir -p "$STOP_DIR3/.svc"
cat > "$STOP_DIR3/.svc/lane-tasks-WI-backlog.json" <<'EOF'
{
  "wi": "WI-backlog",
  "lane": "framework",
  "tasks": [
    {"id": 1, "skill": "improve-framework", "subject": "backlog task", "status": "pending", "blocked_by": []}
  ]
}
EOF
cat > "$STOP_DIR3/.svc/session-contract.jsonl" <<'EOF'
{"ts":"2026-05-01T00:00:00Z","bound_to":"framework-evolution","request":"answer the current Kimi setup audit","wi":null,"skill":"route-workflow","guard_override_count":0}
EOF

cd "$STOP_DIR3"
TEST_SESSION_ID3="hook-e2e-9-$(date +%s%N)-$$"
printf '%s' "{\"session_id\":\"$TEST_SESSION_ID3\"}" > "$TMP_DIR/stop-input.json"
(
  unset BASH_XTRACEFD
  script -q /dev/null -c "bash \"$REPO_ROOT/hooks/svc-task-completion-guard.sh\" < \"$TMP_DIR/stop-input.json\"" > "$TMP_DIR/stop-result-9.txt" 2>&1 || true
)
sed -i 's/\r$//' "$TMP_DIR/stop-result-9.txt"
STOP_RESULT3=$(cat "$TMP_DIR/stop-result-9.txt" || true)
cd "$REPO_ROOT"

if contains_ci '"decision":"block"' "$STOP_RESULT3"; then
  fail "task-completion-guard should not hard-block backlog when session contract is framework-bound (output: $STOP_RESULT3)"
elif contains_ci "advisory only" "$STOP_RESULT3"; then
  pass "task-completion-guard is advisory-only for non-backlog session contract"
else
  fail "task-completion-guard should emit advisory text for non-backlog session contract (output: $STOP_RESULT3)"
fi

# =============================================================================
# Summary
# =============================================================================
if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "$((9 - ERRORS)) passed, $ERRORS failed"
  exit 1
else
  echo ""
  echo "PASS — all 9 Claude hook assertions passed"
fi
