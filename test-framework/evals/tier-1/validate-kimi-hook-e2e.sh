#!/bin/bash
# validate-kimi-hook-e2e.sh — Tier 1 end-to-end validation for critical Kimi hooks.
#
# COST: $0 — no LLM calls. Pipes actual Kimi JSON payloads through wrappers.
#
# Tests:
#   - svc-kimi-workflow-guard.sh --workflow-guard (config protection)
#   - svc-kimi-workflow-guard.sh --phase-boundary (dynamic phase gate)
#   - svc-kimi-workflow-guard.sh --bash-guard (no-verify block)
#   - svc-kimi-workflow-guard.sh default mode (workflow scope warning)
#
# Exit 0: all checks pass
# Exit 1: one or more checks fail

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WRAPPER="$REPO_ROOT/hooks/kimi/svc-kimi-workflow-guard.sh"
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
# Helper: run wrapper with Kimi JSON payload
# =============================================================================
run_hook() {
  local mode="$1"
  local payload="$2"
  # WI-127: kimi hooks self-disable on non-Kimi hosts; spoof for test harness.
  echo "$payload" | SVC_FORCE_HOST=kimi bash "$WRAPPER" "$mode" 2>&1 || true
}

# =============================================================================
# 1. Config protection: package-lock.json should be BLOCKED
# =============================================================================
echo "=== Tier 1: Kimi Hook End-to-End Validation ==="

CONFIG_PAYLOAD='{"tool_name":"WriteFile","tool_input":{"path":"/home/user/project/package-lock.json","content":"{}"}}'
CONFIG_RESULT=$(run_hook "--workflow-guard" "$CONFIG_PAYLOAD")
if grep -q "BLOCKED" <<<"$CONFIG_RESULT"; then
  pass "config-protection blocks package-lock.json"
else
  fail "config-protection should block package-lock.json (output: $CONFIG_RESULT)"
fi

# =============================================================================
# 2. Config protection: README.md should be ALLOWED
# =============================================================================
README_PAYLOAD='{"tool_name":"WriteFile","tool_input":{"path":"/home/user/project/README.md","content":"# Hello"}}'
README_RESULT=$(run_hook "--workflow-guard" "$README_PAYLOAD")
if grep -q "BLOCKED" <<<"$README_RESULT"; then
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

printf -v DIAGNOSTIC_PADDING '\n%131072s' ''  # Catch early-match SIGPIPE without padding failure messages.

PHASE_PAYLOAD='{"tool_name":"WriteFile","tool_input":{"path":"docs/specs/tech-design.md","content":"# Tech Design"}}'
PHASE_RESULT=$(cd "$TMP_DIR" && echo "$PHASE_PAYLOAD" | SVC_FORCE_HOST=kimi bash "$WRAPPER" "--phase-boundary" 2>&1 || true)
if grep -q "BLOCKED" <<<"${PHASE_RESULT}${DIAGNOSTIC_PADDING}"; then
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

PHASE_ALLOW_RESULT=$(cd "$TMP_DIR" && echo "$PHASE_PAYLOAD" | SVC_FORCE_HOST=kimi bash "$WRAPPER" "--phase-boundary" 2>&1 || true)
if grep -q "BLOCKED" <<<"${PHASE_ALLOW_RESULT}${DIAGNOSTIC_PADDING}"; then
  fail "phase-boundary should allow tech-design.md when design-ui is completed (output: $PHASE_ALLOW_RESULT)"
else
  pass "phase-boundary allows tech-design.md when prerequisite completed"
fi

# =============================================================================
# 5. Bash guard: git commit --no-verify should be BLOCKED
# =============================================================================
NOVERIFY_PAYLOAD='{"tool_name":"Shell","tool_input":{"command":"git commit -m test --no-verify"}}'
NOVERIFY_RESULT=$(run_hook "--bash-guard" "$NOVERIFY_PAYLOAD")
if grep -q "BLOCKED" <<<"$NOVERIFY_RESULT"; then
  pass "bash-guard blocks git commit --no-verify"
else
  fail "bash-guard should block --no-verify (output: $NOVERIFY_RESULT)"
fi

# =============================================================================
# 6. Bash guard: normal git commit with trailer should be ALLOWED
# =============================================================================
GOOD_COMMIT_PAYLOAD='{"tool_name":"Shell","tool_input":{"command":"git commit -m \"Add feature\" -m \"Co-Authored-By: Claude Opus 4.6 (1M context) <contact-cd29c5ac34@example.invalid>\""}}'
GOOD_COMMIT_RESULT=$(run_hook "--bash-guard" "$GOOD_COMMIT_PAYLOAD")
if grep -q "BLOCKED" <<<"$GOOD_COMMIT_RESULT"; then
  fail "bash-guard should allow commit with trailer (output: $GOOD_COMMIT_RESULT)"
else
  pass "bash-guard allows commit with Co-Authored-By trailer"
fi

# =============================================================================
# 7. Default mode: unregulated file should be ALLOWED
# =============================================================================
DEFAULT_PAYLOAD='{"tool_name":"WriteFile","tool_input":{"path":"src/utils.js","content":"export const x = 1;"}}'
DEFAULT_RESULT=$(run_hook "" "$DEFAULT_PAYLOAD")
if grep -q "BLOCKED" <<<"$DEFAULT_RESULT"; then
  fail "default mode should allow src/utils.js (output: $DEFAULT_RESULT)"
else
  pass "default mode allows unregulated file write"
fi

# =============================================================================
# Summary
# =============================================================================
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "  PASS — all $((7)) hook e2e assertions passed"
  exit 0
else
  echo "  $ERRORS failed"
  exit 1
fi
