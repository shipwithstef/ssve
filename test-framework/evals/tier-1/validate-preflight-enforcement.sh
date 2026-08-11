#!/usr/bin/env bash
# Tier 1: validate WI-185 preflight hook fail-closed behavior.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/preflight.mjs"
HOOKS_JSON="$REPO_ROOT/hooks/hooks.json"
WIRE="$REPO_ROOT/scripts/wire-hooks.mjs"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

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

echo "=== Tier 1: Preflight Hook Enforcement (WI-185) ==="

if node --check "$SCRIPT" >/dev/null; then
  pass "preflight helper parses"
else
  fail "preflight helper has syntax errors"
fi

mkdir -p "$TMP_DIR/.svc"
cat > "$TMP_DIR/.svc/preflight-demo.json" <<'JSON'
{
  "skill": "demo",
  "inputs": ["missing-input.md"],
  "outputs": ["out/result.md"]
}
JSON
PAYLOAD='{"tool_name":"Skill","tool_input":{"skill":"demo"}}'

set +e
(cd "$TMP_DIR" && printf '%s' "$PAYLOAD" | node "$SCRIPT" --hook >/tmp/svc-preflight-warn.out 2>&1)
RC_WARN=$?
set -e
if [[ "$RC_WARN" -eq 0 ]] && grep -q '"status": "WARN"' /tmp/svc-preflight-warn.out; then
  pass "hook mode remains warn-only without --fail-closed"
else
  fail "hook warn-only mode did not return WARN exit 0"
fi

set +e
(cd "$TMP_DIR" && printf '%s' "$PAYLOAD" | node "$SCRIPT" --hook --fail-closed >/tmp/svc-preflight-block.out 2>&1)
RC_BLOCK=$?
set -e
if [[ "$RC_BLOCK" -eq 2 ]] && grep -q '"status": "FAIL"' /tmp/svc-preflight-block.out && grep -q '"hook_blocking": true' /tmp/svc-preflight-block.out; then
  pass "declared failing contract blocks in fail-closed hook mode"
else
  fail "fail-closed hook mode did not block declared failing contract"
fi

set +e
(cd "$TMP_DIR" && printf '%s' '{"tool_name":"Skill","tool_input":{"skill":"missing-contract"}}' | node "$SCRIPT" --hook --fail-closed >/tmp/svc-preflight-missing.out 2>&1)
RC_MISSING=$?
set -e
if [[ "$RC_MISSING" -eq 0 ]]; then
  pass "missing preflight contract still fails open"
else
  fail "missing preflight contract should fail open"
fi

printf '{not-json' > "$TMP_DIR/.svc/preflight-bad.json"
set +e
(cd "$TMP_DIR" && printf '%s' '{"tool_name":"Skill","tool_input":{"skill":"bad"}}' | node "$SCRIPT" --hook --fail-closed >/tmp/svc-preflight-bad.out 2>&1)
RC_BAD=$?
set -e
if [[ "$RC_BAD" -eq 2 ]] && grep -q '"malformed_config"' /tmp/svc-preflight-bad.out; then
  pass "malformed declared contract blocks in fail-closed hook mode"
else
  fail "malformed declared contract did not block"
fi

if node -e '
const fs = require("fs");
const hooks = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const entry = hooks.hooks.PreToolUse.find((h) => h.id === "svc-preflight-skill");
if (!entry) process.exit(1);
if (!/--hook --fail-closed/.test(entry.command)) process.exit(2);
if (!/HARD BLOCK/.test(entry.description)) process.exit(3);
' "$HOOKS_JSON"; then
  pass "canonical hooks.json wires fail-closed preflight hook"
else
  fail "canonical hooks.json does not wire fail-closed preflight hook"
fi

if grep -q 'preflight.mjs --hook --fail-closed' "$WIRE"; then
  pass "Claude hook wirer installs fail-closed preflight hook"
else
  fail "Claude hook wirer missing fail-closed preflight hook"
fi

echo ""
echo "preflight hook enforcement: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
