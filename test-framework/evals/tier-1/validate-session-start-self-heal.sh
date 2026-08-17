#!/usr/bin/env bash
# Tier-1: validate svc-session-start-healthcheck self-heal behavior.
#
# T1: healthy state → silent exit 0 (no stderr)
# T2: dangling symlink in isolated HOME → hook detects and reports
# T3: SVC_SELF_HEAL_DISABLE=1 → hook is a no-op
# T4: isolated-HOME TOML `~` path present → silent (WI-542)
# T5: isolated-HOME TOML `~` path absent → missing (WI-542)
# T6: ${VAR} / relative / interpreter tokens are not treated as missing (WI-542)
# T7: session stamp skips a second invoke; no session id always runs (WI-543)
#
# Tests run with isolated HOME so the real ~/.claude is untouched.
# Setup is intentionally NOT triggered: the .source-repo pointer is omitted
# and ~/.claude/skills/scripts is not symlinked back at the real repo, so
# repo-detection fails and the hook prints a WARN without invoking setup.
# Session IDs are unset so a host session cannot stamp-skip these fixtures.
#
# Introduced WI-124. Extended WI-542 / WI-543.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-session-start-healthcheck.mjs"

if [ ! -f "$HOOK" ]; then
  echo "FAIL: hook not found at $HOOK" >&2
  exit 1
fi

PASS=0; FAIL=0

run_hook() {
  # $1 = HOME, $2 = optional "disable", $3 = optional host (default claude)
  local home="$1"
  local disable="${2:-}"
  local host="${3:-claude}"
  local out_err
  local env_cmd=(
    env
    -u GROK_SESSION_ID -u CLAUDE_SESSION_ID -u CODEX_SESSION_ID
    -u CODEX_THREAD_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID -u SVC_SESSION_ID
    HOME="$home" SVC_HOST="$host"
  )
  if [ "$disable" = "disable" ]; then
    out_err=$("${env_cmd[@]}" SVC_SELF_HEAL_DISABLE=1 node "$HOOK" </dev/null 2>&1 || true)
  else
    out_err=$("${env_cmd[@]}" node "$HOOK" </dev/null 2>&1 || true)
  fi
  echo "$out_err"
}

write_tilde_toml() {
  local home="$1"
  local host_dir="$2"
  mkdir -p "$home/$host_dir"
  cat > "$home/$host_dir/config.toml" <<'EOF'
[[hooks]]
event = "SessionStart"
command = "node ~/.fakehost/skills/hooks/foo.mjs"
timeout = 30
EOF
}

# ----- T1: healthy state, isolated HOME with no skills dir at all → silent
T1_HOME=$(mktemp -d)
T4_HOME=""; T5_HOME=""; T6_HOME=""; T7_HOME=""; T7_RUNTIME=""
trap 'rm -rf "$T1_HOME" "$T2_HOME" "$T3_HOME" "$T4_HOME" "$T5_HOME" "$T6_HOME" "$T7_HOME" "$T7_RUNTIME" 2>/dev/null || true' EXIT
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

# ----- T4: TOML ~ path present under isolated HOME → silent (no self-heal)
T4_HOME=$(mktemp -d)
mkdir -p "$T4_HOME/.grok/skills" "$T4_HOME/.fakehost/skills/hooks"
printf '%s\n' 'export {}' > "$T4_HOME/.fakehost/skills/hooks/foo.mjs"
write_tilde_toml "$T4_HOME" ".grok"
T4_OUT=$(run_hook "$T4_HOME" "" grok)
if [ -z "$T4_OUT" ]; then
  echo "  ✓ T4: present tilde TOML path is silent"
  PASS=$((PASS+1))
else
  echo "  ✗ T4: expected silent for present ~ path, got: $T4_OUT"
  FAIL=$((FAIL+1))
fi

# ----- T5: TOML ~ path absent → missing / self-heal warn
T5_HOME=$(mktemp -d)
mkdir -p "$T5_HOME/.grok/skills" "$T5_HOME/.fakehost/skills/hooks"
write_tilde_toml "$T5_HOME" ".grok"
T5_OUT=$(run_hook "$T5_HOME" "" grok)
if echo "$T5_OUT" | grep -qE "missing|self-heal"; then
  echo "  ✓ T5: absent tilde TOML path is missing"
  PASS=$((PASS+1))
else
  echo "  ✗ T5: expected missing/self-heal for absent ~ path, got: $T5_OUT"
  FAIL=$((FAIL+1))
fi

# ----- T6: ${VAR}, relative, and interpreter tokens are ignored
T6_HOME=$(mktemp -d)
mkdir -p "$T6_HOME/.grok/skills"
cat > "$T6_HOME/.grok/config.toml" <<'EOF'
[[hooks]]
event = "SessionStart"
command = "node ${HOME}/.fakehost/skills/hooks/foo.mjs"
timeout = 30

[[hooks]]
event = "PostToolUse"
command = "node hooks/relative-only.mjs"
timeout = 10

[[hooks]]
event = "SessionEnd"
command = "/usr/bin/node /usr/bin/env"
timeout = 10
EOF
T6_OUT=$(run_hook "$T6_HOME" "" grok)
if [ -z "$T6_OUT" ]; then
  echo "  ✓ T6: interpolated/relative/interpreter tokens ignored"
  PASS=$((PASS+1))
else
  echo "  ✗ T6: expected silent for non-script tokens, got: $T6_OUT"
  FAIL=$((FAIL+1))
fi

# ----- T7: session stamp — second invoke with same id is a no-op
T7_HOME=$(mktemp -d)
T7_RUNTIME=$(mktemp -d)
mkdir -p "$T7_HOME/.claude/skills"
ln -s /nonexistent/does/not/exist "$T7_HOME/.claude/skills/dangling-link"
echo '{"hooks":{}}' > "$T7_HOME/.claude/settings.json"
T7_SID="wi542-stamp-$$"
T7_FIRST=$(env -u GROK_SESSION_ID -u CLAUDE_SESSION_ID -u CODEX_SESSION_ID \
  -u CODEX_THREAD_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID -u SVC_SESSION_ID \
  HOME="$T7_HOME" SVC_HOST=claude GROK_SESSION_ID="$T7_SID" XDG_RUNTIME_DIR="$T7_RUNTIME" \
  node "$HOOK" </dev/null 2>&1 || true)
T7_SECOND=$(env -u GROK_SESSION_ID -u CLAUDE_SESSION_ID -u CODEX_SESSION_ID \
  -u CODEX_THREAD_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID -u SVC_SESSION_ID \
  HOME="$T7_HOME" SVC_HOST=claude GROK_SESSION_ID="$T7_SID" XDG_RUNTIME_DIR="$T7_RUNTIME" \
  node "$HOOK" </dev/null 2>&1 || true)
T7_NO_SID=$(env -u GROK_SESSION_ID -u CLAUDE_SESSION_ID -u CODEX_SESSION_ID \
  -u CODEX_THREAD_ID -u KIMI_SESSION_ID -u GEMINI_SESSION_ID -u SVC_SESSION_ID \
  HOME="$T7_HOME" SVC_HOST=claude XDG_RUNTIME_DIR="$T7_RUNTIME" \
  node "$HOOK" </dev/null 2>&1 || true)
if echo "$T7_FIRST" | grep -qE "dangling|self-heal" \
  && [ -z "$T7_SECOND" ] \
  && echo "$T7_NO_SID" | grep -qE "dangling|self-heal" \
  && [ -f "$T7_RUNTIME/svc-sshc-claude-$T7_SID" ]; then
  echo "  ✓ T7: session stamp no-op; no session id still runs"
  PASS=$((PASS+1))
else
  echo "  ✗ T7: stamp contract failed first='$T7_FIRST' second='$T7_SECOND' nosid='$T7_NO_SID'"
  FAIL=$((FAIL+1))
fi
rm -rf "$T7_RUNTIME"

echo ""
echo "validate-session-start-self-heal: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
