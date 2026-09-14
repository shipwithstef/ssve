#!/usr/bin/env bash
# Tier 1: ensure Stop hook wiring preserves host JSON stdin for completion guard.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
FAIL=0

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

assert_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if ! grep -Fq "$needle" "$file"; then
    fail "$label missing in ${file#$REPO_ROOT/}"
  fi
}

assert_not_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    fail "$label still present in ${file#$REPO_ROOT/}"
  fi
}

OLD_WRAPPER="printf '%s' | bash hooks/svc-task-completion-guard.sh"

assert_contains "$REPO_ROOT/hooks/hooks.json" '"command": "bash hooks/svc-task-completion-guard.sh"' "Claude canonical direct Stop command"
assert_not_contains "$REPO_ROOT/hooks/hooks.json" "$OLD_WRAPPER" "stdin-discarding canonical Stop command"
assert_not_contains "$REPO_ROOT/scripts/wire-hooks.mjs" "printf '%s' | bash \${hooksDir}/svc-task-completion-guard.sh" "stdin-discarding Claude wirer command"
# WI-487 (F-001): the governed Stop guard is routed through the durable launcher
# when materialized; the stdin-preserving DIRECT form `bash ${hooksDir}/...` remains
# the fallback. BOTH preserve host JSON stdin: the launcher (bin/svc-enforce.mjs)
# reads fd 0 and forwards it to the delegated guard.
assert_contains "$REPO_ROOT/scripts/wire-hooks.mjs" '`bash ${hooksDir}/svc-task-completion-guard.sh`' "Claude wirer stdin-preserving direct Stop fallback"
assert_contains "$REPO_ROOT/scripts/wire-hooks.mjs" 'node ${LAUNCHER_PATH} svc-task-completion-guard' "Claude wirer launcher-routed Stop command (F-001)"
assert_contains "$REPO_ROOT/scripts/wire-gemini-hooks.mjs" '`bash ${hooksDir}/svc-task-completion-guard.sh`' "Gemini wirer stdin-preserving direct Stop fallback"
assert_contains "$REPO_ROOT/scripts/wire-gemini-hooks.mjs" 'node ${LAUNCHER_PATH} svc-task-completion-guard' "Gemini wirer launcher-routed Stop command (F-001)"
# The launcher itself must forward stdin to the delegated guard (no stdin discard).
assert_contains "$REPO_ROOT/bin/svc-enforce.mjs" 'input: stdin' "launcher forwards host JSON stdin to the delegated guard"
assert_contains "$REPO_ROOT/hooks/kimi/svc-kimi-task-completion-guard.sh" 'printf '\''%s'\'' "$PAYLOAD" | bash "$SCRIPT_DIR/hooks/svc-task-completion-guard.sh"' "Kimi adapter payload-preserving forward"

CODEX_REGISTRY="$(node "$REPO_ROOT/scripts/wire-codex-hooks.mjs" --skills-path "$REPO_ROOT" --list-all)"
if ! grep -Fq '"Stop"' <<<"$CODEX_REGISTRY"; then
  fail "Codex registry does not declare Stop hooks"
fi
if ! grep -Fq "$REPO_ROOT/hooks/codex/svc-codex-stop-firewall.mjs" <<<"$CODEX_REGISTRY"; then
  fail "Codex registry does not wire the composite Stop firewall"
fi
if grep -Fq "printf '%s' | bash $REPO_ROOT/hooks/svc-task-completion-guard.sh" <<<"$CODEX_REGISTRY"; then
  fail "Codex registry still discards Stop hook stdin"
fi
assert_contains "$REPO_ROOT/hooks/codex/svc-codex-stop-firewall.mjs" 'input: raw' "Codex firewall payload-preserving forward"
assert_contains "$REPO_ROOT/hooks/codex/svc-codex-stop-firewall.mjs" '"svc-task-completion-guard.sh"' "Codex firewall shared-guard delegation"

if [[ $FAIL -gt 0 ]]; then
  echo "=== Tier 1: Stop Hook Stdin Preservation ==="
  echo "  FAIL — $FAIL checks failed"
  exit 1
fi

echo "=== Tier 1: Stop Hook Stdin Preservation ==="
echo "  PASS — Stop hook wiring preserves JSON stdin for supported shell-hook hosts"
