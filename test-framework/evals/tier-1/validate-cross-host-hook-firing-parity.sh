#!/usr/bin/env bash
# validate-cross-host-hook-firing-parity.sh — tier-1 validator.
#
# Existing validate-cross-host-hook-conformance.sh is a STATIC wiring check —
# it greps each host's wire script for the gate's pattern. It does NOT verify
# that identical PreToolUse payloads produce identical decisions across hosts.
#
# This validator pipes synthetic PreToolUse payloads through Claude's direct
# svc-workflow-guard.mjs AND Kimi's svc-kimi-workflow-guard.sh adapter shim.
# If exit codes diverge for the same input, the adapter is broken — caught HERE,
# not at runtime in production.
#
# Test cases (each must produce the same exit code on both paths):
#   1. config-protection block (Edit on .eslintrc) → exit 2 (hard block)
#   2. no-verify block (Bash with --no-verify) → exit 2 (hard block)
#   3. clean Edit on src/components/Button.jsx → exit 0 (proceed)
#   4. Edit on docs/specs/foo.md → exit 0 (proceed)
#
# Exit 0 if all parity assertions pass.
# Exit 1 if any input produces divergent exit codes between Claude and Kimi paths.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CLAUDE_GUARD="$REPO_ROOT/hooks/svc-workflow-guard.mjs"
KIMI_ADAPTER="$REPO_ROOT/hooks/kimi/svc-kimi-workflow-guard.sh"

PASS=0
FAIL=0
SKIP=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }
skip() { SKIP=$((SKIP+1)); echo "  - $1"; }

echo "=== Tier 1: cross-host hook firing parity (Claude vs Kimi) ==="

if [ ! -f "$CLAUDE_GUARD" ]; then
  fail "Claude guard not found at $CLAUDE_GUARD"
  exit 1
fi
if [ ! -f "$KIMI_ADAPTER" ]; then
  fail "Kimi adapter not found at $KIMI_ADAPTER"
  exit 1
fi

# --------------------------------------------------------------------
# Helper: invoke each host's path with the same payload, compare exits.
# Claude path: node guard.mjs "<payload>" (argv style)
# Kimi path:   echo "<payload>" | bash adapter.sh --workflow-guard (stdin)
# --------------------------------------------------------------------
parity_check() {
  local label="$1"
  local payload="$2"
  local guard_args="${3:-}"

  # Claude path — argv style (matches how Claude's hook system invokes it)
  set +e
  node "$CLAUDE_GUARD" "$payload" $guard_args >/dev/null 2>&1
  local claude_exit=$?
  set -e

  # Kimi path — adapter shim translates stdin-JSON to argv-JSON
  # SVC_FORCE_HOST=kimi bypasses the adapter's host-detection self-disable
  set +e
  local kimi_mode="--workflow-guard"
  case "$guard_args" in
    *--phase-boundary*) kimi_mode="--phase-boundary" ;;
    *--bash-guard*) kimi_mode="--bash-guard" ;;
  esac
  echo "$payload" | SVC_FORCE_HOST=kimi bash "$KIMI_ADAPTER" "$kimi_mode" >/dev/null 2>&1
  local kimi_exit=$?
  set -e

  if [ "$claude_exit" -eq "$kimi_exit" ]; then
    pass "$label — claude=$claude_exit kimi=$kimi_exit (identical)"
  else
    fail "$label — claude=$claude_exit BUT kimi=$kimi_exit (DIVERGENT)"
  fi
}

# --------------------------------------------------------------------
# Test cases — synthetic payloads matching real PreToolUse hook envelopes.
# Both Claude and Kimi normalize to {tool_name, tool_input}.
# --------------------------------------------------------------------

# Case 1: config-protection block. Editing .eslintrc must block on both.
parity_check "config-protection: Edit on .eslintrc.json" \
  '{"tool_name":"Edit","tool_input":{"file_path":".eslintrc.json","old_string":"a","new_string":"b"}}'

# Case 2: no-verify block. Bash --no-verify must block on both.
parity_check "bash-guard: git commit --no-verify" \
  '{"tool_name":"Bash","tool_input":{"command":"git commit -m test --no-verify"}}' \
  "--bash-guard"

# Case 3: clean Edit on a normal source file should pass on both.
parity_check "clean Edit on src/components/Button.jsx" \
  '{"tool_name":"Edit","tool_input":{"file_path":"src/components/Button.jsx","old_string":"a","new_string":"b"}}'

# Case 4: doc Edit should pass on both (docs are not config-protected).
parity_check "doc Edit on docs/specs/foo.md" \
  '{"tool_name":"Edit","tool_input":{"file_path":"docs/specs/foo.md","old_string":"a","new_string":"b"}}'

# Case 5: Bash that's not a no-verify should pass on both.
parity_check "bash-guard: ls -la (benign)" \
  '{"tool_name":"Bash","tool_input":{"command":"ls -la"}}' \
  "--bash-guard"

# --------------------------------------------------------------------
echo
echo "PASS: $PASS, FAIL: $FAIL, SKIP: $SKIP"

if [ "$FAIL" -gt 0 ]; then
  echo
  echo "Recovery:"
  echo "  Inspect the divergent input above. The Kimi adapter shim at"
  echo "  $KIMI_ADAPTER"
  echo "  must translate its stdin payload to the same argv shape that"
  echo "  $CLAUDE_GUARD"
  echo "  expects. Common causes: payload field renames (tool_name vs name),"
  echo "  exit-code mapping (2 vs 1), missing forward of guard mode."
  exit 1
fi

exit 0
