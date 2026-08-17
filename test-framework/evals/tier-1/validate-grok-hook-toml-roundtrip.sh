#!/usr/bin/env bash
# Tier-1: WI-543 Grok hook TOML dual-schema roundtrip.
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

[[hooks]]
event = "SessionEnd"
matcher = "*"
command = "echo user-flat-keep"
timeout = 5

[[hooks.UserPromptSubmit]]
matcher = "*"
hooks = [
  { type = "command", command = "echo user-nested-keep", timeout = 5 },
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

cp -a "$CONFIG" "$TMP/fixture-original.toml"
ORIG_SHA=$(sha256sum "$TMP/fixture-original.toml" | awk '{print $1}')

if SVC_WIRE_GROK_FAIL_AFTER_BACKUP=1 node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-fail-wire.out 2>/tmp/wi543-fail-wire.err; then
  fail "simulated failure should exit non-zero"
else
  RESTORED_SHA=$(sha256sum "$CONFIG" | awk '{print $1}')
  if [ "$RESTORED_SHA" = "$ORIG_SHA" ]; then
    pass "restore-on-failure returns fixture bytes"
  else
    fail "restore-on-failure changed fixture (orig=$ORIG_SHA now=$RESTORED_SHA)"
  fi
  if [ -f "$CONFIG.wi543.bak" ]; then
    pass "backup written before simulated failure"
  else
    fail "backup missing after simulated failure"
  fi
fi

cp -a "$TMP/fixture-original.toml" "$CONFIG"
if node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-wire1.out 2>/tmp/wi543-wire1.err; then
  pass "first isolated rewire exits 0"
else
  fail "first isolated rewire failed: $(cat /tmp/wi543-wire1.err)"
fi

if grep -q 'echo user-flat-keep' "$CONFIG" && grep -q 'echo user-nested-keep' "$CONFIG"; then
  pass "user hooks kept across both schema styles"
else
  fail "user hooks were dropped"
fi

if grep -q '\[\[hooks\.SessionStart\]\]' "$CONFIG"; then
  pass "emits nested [[hooks.SessionStart]]"
else
  fail "did not emit nested SessionStart table"
fi

if grep -n 'svc-session-start-healthcheck' "$CONFIG" | grep -q 'timeout = 30'; then
  pass "Grok-native healthcheck timeout is 30"
else
  fail "healthcheck timeout is not 30: $(grep -n -A3 'svc-session-start-healthcheck' "$CONFIG" || true)"
fi

if grep -q '^\[\[hooks\]\]$' "$CONFIG"; then
  fail "flat [[hooks]] leftover after nested emit"
else
  pass "no leftover flat [[hooks]] tables"
fi

if grep -q '^\[cli\]' "$CONFIG" && grep -q '^\[privacy\]' "$CONFIG"; then
  pass "non-hook sections preserved"
else
  fail "non-hook sections lost"
fi

FIRST_SHA=$(sha256sum "$CONFIG" | awk '{print $1}')
if node "$WIRER" --skills-path "$SKILLS" --config "$CONFIG" >/tmp/wi543-wire2.out 2>/tmp/wi543-wire2.err; then
  SECOND_SHA=$(sha256sum "$CONFIG" | awk '{print $1}')
  if [ "$FIRST_SHA" = "$SECOND_SHA" ]; then
    pass "two isolated rewires are byte-identical"
  else
    fail "second rewire changed bytes ($FIRST_SHA vs $SECOND_SHA)"
  fi
else
  fail "second isolated rewire failed: $(cat /tmp/wi543-wire2.err)"
fi

# Other host wirers must not be part of this change (static path check).
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
