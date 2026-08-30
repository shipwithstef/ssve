#!/usr/bin/env bash
# Tier-1: WI-543 Grok hook TOML dual-schema roundtrip + lossless user hooks +
# immutable migration backup / per-attempt rollback.
# Isolated config only — does not write ~/.grok/config.toml.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WIRER="$REPO_ROOT/scripts/wire-grok-hooks.mjs"
PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

echo "=== Tier 1: Grok hook TOML roundtrip ==="

if [ ! -f "$WIRER" ]; then
  echo "FAIL: missing $WIRER" >&2
  exit 1
fi

if node --check "$WIRER"; then
  pass "wire-grok-hooks.mjs parses"
else
  fail "wire-grok-hooks.mjs syntax invalid"
  echo "validate-grok-hook-toml-roundtrip: $PASS passed, $FAIL failed"
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
SKILLS="$TMP/skills"
mkdir -p "$SKILLS/hooks"
CONFIG="$TMP/config.toml"

cat > "$CONFIG" <<'EOF'
[cli]
installer = "internal"

[compat.claude]
# keep claude skills and sessions discoverable
skills = true
sessions = true
hooks = true

[compat.cursor]
# cursor hook key is intentionally absent before convergence
skills = true

# keep this user comment
# not an svc-owned hook
[[hooks]]
event = "SessionEnd"
matcher = "*"
command = "echo user-flat-keep"
timeout = 5

[[hooks.Stop]]
matcher = "*"
command = "node ~/.grok/skills/hooks/user-keep.mjs"
timeout = 5

[[hooks.UserPromptSubmit]]
matcher = "*"
hooks = [
  { type = "command", command = "echo user-nested-keep", timeout = 5 },
  { type = "command", command = "echo user-second-handler", timeout = 5 },
]

[[hooks.Notification]]
matcher = "*"
hooks = [
  { type = "http", url = "https://example.invalid/hook", timeout = 5 },
]

[[hooks.PostToolUse]]
matcher = "*"
hooks = [
  { type = "command", command = "echo ${HOME}/brace-keep", env = { FOO = "bar" }, timeout = 5 },
]

[[hooks.SessionEnd]]
matcher = "*"
hooks = [
  { type = "command", command = "echo \"quoted-keep\"", timeout = 5 },
]

[[hooks]]
event = "SessionStart"
matcher = "*"
command = "node ~/.grok/skills/hooks/svc-session-start-healthcheck.mjs"
timeout = 10

[[hooks.PreToolUse]]
matcher = "Write|Edit"
hooks = [
  { type = "command", command = "node ~/.grok/skills/hooks/svc-workflow-guard.mjs", timeout = 10 },
]

[privacy]
privacy_banner_acked = "test"
EOF

chmod 644 "$CONFIG"
cp -a "$CONFIG" "$TMP/fixture-original.toml"
ORIG_SHA=$(sha256sum "$TMP/fixture-original.toml" | awk '{print $1}')

# Fail-closed read: unreadable config must not be treated as empty.
cp -a "$CONFIG" "$TMP/unreadable.toml"
chmod 000 "$TMP/unreadable.toml"
if node "$WIRER" --skills-path "$SKILLS" --config "$TMP/unreadable.toml" >/tmp/wi543-unreadable.out 2>/tmp/wi543-unreadable.err; then
  fail "unreadable config should fail closed"
else
  if grep -qi 'cannot read grok config' /tmp/wi543-unreadable.err; then
    pass "unreadable config fails closed"
  else
    fail "unreadable config failed without fail-closed message: $(cat /tmp/wi543-unreadable.err)"
  fi
fi
chmod 644 "$TMP/unreadable.toml"

if SVC_WIRE_GROK_FAIL_AFTER_BACKUP=1 node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-fail-wire.out 2>/tmp/wi543-fail-wire.err; then
  fail "simulated failure should exit non-zero"
else
  RESTORED_SHA=$(sha256sum "$CONFIG" | awk '{print $1}')
  if [ "$RESTORED_SHA" = "$ORIG_SHA" ]; then
    pass "restore-on-failure returns fixture bytes"
  else
    fail "restore-on-failure changed fixture (orig=$ORIG_SHA now=$RESTORED_SHA)"
  fi
  if [ -f "$CONFIG.pre-migration.bak" ]; then
    pass "immutable pre-migration backup written"
  else
    fail "immutable pre-migration backup missing"
  fi
  if [ -f "$CONFIG.svc-wire.rollback" ]; then
    pass "per-attempt rollback written"
  else
    fail "per-attempt rollback missing"
  fi
fi

cp -a "$TMP/fixture-original.toml" "$CONFIG"
rm -f "$CONFIG.pre-migration.bak" "$CONFIG.svc-wire.rollback"
if node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-wire1.out 2>/tmp/wi543-wire1.err; then
  pass "first isolated rewire exits 0"
else
  fail "first isolated rewire failed: $(cat /tmp/wi543-wire1.err)"
fi

IMMUTABLE_SHA=$(sha256sum "$CONFIG.pre-migration.bak" | awk '{print $1}')
if [ "$IMMUTABLE_SHA" = "$ORIG_SHA" ]; then
  pass "immutable backup matches original fixture"
else
  fail "immutable backup is not the original fixture"
fi

for token in \
  "echo user-flat-keep" \
  "echo user-nested-keep" \
  "echo user-second-handler" \
  "https://example.invalid/hook" \
  'echo ${HOME}/brace-keep' \
  'FOO = "bar"' \
  'echo \"quoted-keep\"' \
  "keep this user comment" \
  "not an svc-owned hook" \
  "node ~/.grok/skills/hooks/user-keep.mjs"
do
  if grep -Fq "$token" "$CONFIG"; then
    pass "preserved user text: $token"
  else
    fail "lost user text: $token"
  fi
done

if grep -q '\[\[hooks\.SessionStart\]\]' "$CONFIG" \
  && grep -q 'svc-session-start-healthcheck' "$CONFIG" \
  && grep -q 'timeout = 30' "$CONFIG"; then
  pass "emits nested SessionStart healthcheck timeout 30"
else
  fail "nested SessionStart healthcheck timeout 30 missing"
fi

if grep -q 'matcher = "Shell|Write|Edit|Bash|run_terminal_command"' "$CONFIG"; then
  pass "Grok isolation matcher includes run_terminal_command"
else
  fail "Grok isolation matcher omits run_terminal_command"
fi

if [ "$(grep -c '^\[compat\.claude\]$' "$CONFIG")" -eq 1 ] \
  && [ "$(grep -c '^\[compat\.cursor\]$' "$CONFIG")" -eq 1 ] \
  && [ "$(grep -c '^hooks = false$' "$CONFIG")" -eq 2 ] \
  && grep -q 'keep claude skills and sessions discoverable' "$CONFIG" \
  && grep -q '^sessions = true$' "$CONFIG" \
  && grep -q 'cursor hook key is intentionally absent' "$CONFIG"; then
  pass "compat Claude/Cursor hooks disabled without duplicate tables or unrelated-key loss"
else
  fail "compat hook convergence is missing, duplicated, or lossy"
fi

if [ "$(grep -c 'svc-codex-pretool-dispatcher.mjs' "$CONFIG")" -eq 1 ] \
  && grep -B4 -A5 'svc-codex-pretool-dispatcher.mjs' "$CONFIG" | grep -q 'matcher = "Shell|Write|Edit|Bash|run_terminal_command"'; then
  pass "one native PreToolUse dispatcher covers run_terminal_command"
else
  fail "native Grok dispatcher count or matcher is wrong"
fi

if awk '/^command = / && /\.grok\/skills/ && /\/svc-|\/codex\/svc-/ && $0 !~ /^command = "SVC_HOST=grok / { bad=1 } END { exit bad ? 1 : 0 }' "$CONFIG"; then
  pass "every Grok-owned command carries SVC_HOST=grok"
else
  fail "a Grok-owned command lacks SVC_HOST=grok"
fi

if [ "$(grep -c '^matcher = "Shell|Bash|run_terminal_command"$' "$CONFIG")" -eq 2 ] \
  && grep -q 'svc-workflow-guard.mjs --bash-guard' "$CONFIG" \
  && grep -q 'svc-phase-receipt-autoemit.mjs' "$CONFIG"; then
  pass "Grok bash guard and shell phase receipt include run_terminal_command"
else
  fail "Grok bash guard or shell phase receipt omits run_terminal_command"
fi

if grep -q 'svc-codex-prompt-authority.mjs' "$CONFIG" \
  && grep -q 'svc-codex-owner-recovery.mjs' "$CONFIG"; then
  pass "Grok UserPromptSubmit wires prompt authority and owner recovery"
else
  fail "Grok UserPromptSubmit authority hooks missing"
fi

if grep -q '^\[cli\]' "$CONFIG" && grep -q '^\[privacy\]' "$CONFIG"; then
  pass "non-hook sections preserved"
else
  fail "non-hook sections lost"
fi

FIRST_SHA=$(sha256sum "$CONFIG" | awk '{print $1}')
node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-wire2.out 2>/tmp/wi543-wire2.err
SECOND_SHA=$(sha256sum "$CONFIG" | awk '{print $1}')
node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-wire3.out 2>/tmp/wi543-wire3.err
THIRD_SHA=$(sha256sum "$CONFIG" | awk '{print $1}')
IMMUTABLE_AFTER=$(sha256sum "$CONFIG.pre-migration.bak" | awk '{print $1}')
if [ "$FIRST_SHA" = "$SECOND_SHA" ] && [ "$SECOND_SHA" = "$THIRD_SHA" ]; then
  pass "three isolated rewires are byte-identical"
else
  fail "rewires diverged $FIRST_SHA $SECOND_SHA $THIRD_SHA"
fi
if [ "$IMMUTABLE_AFTER" = "$ORIG_SHA" ]; then
  pass "three rewires did not overwrite immutable backup"
else
  fail "immutable backup changed after rewires"
fi

# Failure after a successful rewire must restore the last good wired bytes,
# not the original fixture, and must leave the immutable backup untouched.
WIRED_SHA=$THIRD_SHA
if SVC_WIRE_GROK_FAIL_AFTER_BACKUP=1 node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-fail2.out 2>/tmp/wi543-fail2.err; then
  fail "post-success simulated failure should exit non-zero"
else
  AFTER_FAIL=$(sha256sum "$CONFIG" | awk '{print $1}')
  IMMUTABLE_FINAL=$(sha256sum "$CONFIG.pre-migration.bak" | awk '{print $1}')
  if [ "$AFTER_FAIL" = "$WIRED_SHA" ]; then
    pass "failure after success restores last good wired bytes"
  else
    fail "failure after success restored unexpected bytes"
  fi
  if [ "$IMMUTABLE_FINAL" = "$ORIG_SHA" ]; then
    pass "failure after success left immutable backup untouched"
  else
    fail "failure after success mutated immutable backup"
  fi
fi

# Live host note is not a test assertion; recorded in tracked evidence.
# Other host wirers must not be part of this change.
OTHER_DIRTY=0
for w in wire-kimi-hooks.mjs wire-hooks.mjs wire-cursor-hooks.mjs wire-codex-hooks.mjs wire-gemini-hooks.mjs; do
  if git -C "$REPO_ROOT" diff --name-only -- "scripts/$w" | grep -q .; then
    fail "out-of-scope wirer dirty: $w"
    OTHER_DIRTY=1
  fi
done
if [ "$OTHER_DIRTY" -eq 0 ]; then
  pass "Kimi/Claude/Cursor/Codex/Gemini wirers unchanged"
fi

echo ""
echo "validate-grok-hook-toml-roundtrip: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
