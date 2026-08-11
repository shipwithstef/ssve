#!/usr/bin/env bash
# Tier-1: validate svc-session-start-healthcheck self-heal behavior.
#
# T1: healthy state → silent exit 0 (no stderr)
# T2: dangling symlink in isolated HOME → hook detects and reports
# T3: SVC_SELF_HEAL_DISABLE=1 → hook is a no-op
#
# Tests run with isolated HOME so the real ~/.claude is untouched.
# Setup is intentionally NOT triggered: the .source-repo pointer is omitted
# and ~/.claude/skills/scripts is not symlinked back at the real repo, so
# repo-detection fails and the hook prints a WARN without invoking setup.
#
# Introduced WI-124.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-session-start-healthcheck.mjs"

if [ ! -f "$HOOK" ]; then
  echo "FAIL: hook not found at $HOOK" >&2
  exit 1
fi

PASS=0; FAIL=0

run_hook() {
  # $1 = HOME, $2 = optional "disable"
  local home="$1"
  local disable="${2:-}"
  local out_err
  if [ "$disable" = "disable" ]; then
    out_err=$(HOME="$home" SVC_HOST=claude SVC_SELF_HEAL_DISABLE=1 node "$HOOK" </dev/null 2>&1 || true)
  else
    out_err=$(HOME="$home" SVC_HOST=claude node "$HOOK" </dev/null 2>&1 || true)
  fi
  echo "$out_err"
}

# ----- T1: healthy state, isolated HOME with no skills dir at all → silent
T1_HOME=$(mktemp -d)
trap 'rm -rf "$T1_HOME" "$T2_HOME" "$T3_HOME" 2>/dev/null || true' EXIT
mkdir -p "$T1_HOME/.claude/skills"
echo '{"hooks":{}}' > "$T1_HOME/.claude/settings.json"
T1_OUT=$(run_hook "$T1_HOME")
if [ -z "$T1_OUT" ]; then
  echo "  ✓ T1: healthy state silent"
  PASS=$((PASS+1))
else
  echo "  ✗ T1: expected silent, got: $T1_OUT"
  FAIL=$((FAIL+1))
fi

# ----- T2: dangling symlink → hook detects and warns
T2_HOME=$(mktemp -d)
mkdir -p "$T2_HOME/.claude/skills"
ln -s /nonexistent/does/not/exist "$T2_HOME/.claude/skills/dangling-link"
echo '{"hooks":{}}' > "$T2_HOME/.claude/settings.json"
T2_OUT=$(run_hook "$T2_HOME")
if echo "$T2_OUT" | grep -qE "dangling|self-heal"; then
  echo "  ✓ T2: dangling symlink detected"
  PASS=$((PASS+1))
else
  echo "  ✗ T2: expected detection of dangling symlink, got: $T2_OUT"
  FAIL=$((FAIL+1))
fi

# ----- T3: SVC_SELF_HEAL_DISABLE=1 with dangling → silent
T3_HOME=$(mktemp -d)
mkdir -p "$T3_HOME/.claude/skills"
ln -s /nonexistent/does/not/exist "$T3_HOME/.claude/skills/dangling-link"
echo '{"hooks":{}}' > "$T3_HOME/.claude/settings.json"
T3_OUT=$(run_hook "$T3_HOME" disable)
if [ -z "$T3_OUT" ]; then
  echo "  ✓ T3: SVC_SELF_HEAL_DISABLE=1 bypasses heal"
  PASS=$((PASS+1))
else
  echo "  ✗ T3: expected silent with disable flag, got: $T3_OUT"
  FAIL=$((FAIL+1))
fi

echo ""
echo "validate-session-start-self-heal: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
