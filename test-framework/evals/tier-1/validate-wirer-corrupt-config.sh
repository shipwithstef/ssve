#!/usr/bin/env bash
# WI-562 IP-W1: uniform wirer write policy — corrupt host config must ABORT
# nonzero (never silently reset), original bytes preserved, atomic tmp+rename.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
pass=0; fail=0

echo "=== Tier 1: wirer corrupt-config + atomic write policy ==="

# --- Cursor: corrupt hooks.json aborts, bytes intact ---
CURSOR_HOME="$TMP/cursor-home"
mkdir -p "$CURSOR_HOME/.cursor"
printf '{ this is not json !!!' >"$CURSOR_HOME/.cursor/hooks.json"
cp "$CURSOR_HOME/.cursor/hooks.json" "$TMP/original-cursor.json"

set +e
HOME="$CURSOR_HOME" node "$ROOT/scripts/wire-cursor-hooks.mjs" >"$TMP/out" 2>&1
RC=$?
set -e
if [[ $RC -ne 0 ]]; then echo "  ✓ cursor corrupt config aborts nonzero"; pass=$((pass+1)); else echo "  ✗ cursor wirer exited 0 on corrupt config"; fail=$((fail+1)); fi
if grep -qi "not valid JSON" "$TMP/out"; then echo "  ✓ cursor abort message actionable"; pass=$((pass+1)); else echo "  ✗ cursor abort lacks actionable reason"; cat "$TMP/out"; fail=$((fail+1)); fi
if cmp -s "$CURSOR_HOME/.cursor/hooks.json" "$TMP/original-cursor.json"; then echo "  ✓ cursor original bytes untouched"; pass=$((pass+1)); else echo "  ✗ cursor corrupted file was modified"; fail=$((fail+1)); fi

# --- Cursor: healthy run is idempotent and byte-stable across double-run ---
HEALTHY="$TMP/cursor-healthy"
mkdir -p "$HEALTHY/.cursor/skills/hooks" "$HEALTHY/.cursor"
printf 'ok\n' >"$HEALTHY/.cursor/skills/hooks/svc-bash-guard.mjs"
HOME="$HEALTHY" node "$ROOT/scripts/wire-cursor-hooks.mjs" >/dev/null 2>&1 || true
cp "$HEALTHY/.cursor/hooks.json" "$TMP/run1.json" 2>/dev/null || true
if [[ -f "$HEALTHY/.cursor/hooks.json" ]]; then
  HOME="$HEALTHY" node "$ROOT/scripts/wire-cursor-hooks.mjs" >/dev/null 2>&1 || true
  if cmp -s "$HEALTHY/.cursor/hooks.json" "$TMP/run1.json"; then
    echo "  ✓ cursor wiring byte-stable across runs"; pass=$((pass+1))
  else
    echo "  ✗ cursor wiring drifted between identical runs"; fail=$((fail+1))
  fi
else
  echo "  ✗ healthy cursor wiring produced no output file (skills fixture mismatch — check buildCursorHookEntries expectations)"; fail=$((fail+1))
fi

# --- Claude wirer: settings writes go through the atomic primitive ---
if ! grep -qE 'fs\.writeFileSync\(settingsPath' "$ROOT/scripts/wire-hooks.mjs"; then
  echo "  ✓ claude wirer has no direct writeFileSync(settingsPath) calls"
  pass=$((pass+1))
else
  echo "  ✗ claude wirer still writes settings non-atomically"
  fail=$((fail+1))
fi
grep -q 'renameSync(tmp, target)' "$ROOT/scripts/wire-hooks.mjs" \
  && { echo "  ✓ claude wirer uses tmp+fsync+rename"; pass=$((pass+1)); } \
  || { echo "  ✗ claude wirer missing rename-based write"; fail=$((fail+1)); }

# --- Grok wirer: retains its backup + rollback posture ---
grep -q "pre-migration.bak\|SVC_WIRE_GROK_FAIL_AFTER_BACKUP\|rollback" "$ROOT/scripts/wire-grok-hooks.mjs" \
  && { echo "  ✓ grok wirer backup/rollback posture retained"; pass=$((pass+1)); } \
  || { echo "  ✗ grok wirer lost backup/rollback markers"; fail=$((fail+1)); }

echo "validate-wirer-corrupt-config: $pass passed, $fail failed"
[[ $fail -eq 0 ]]
