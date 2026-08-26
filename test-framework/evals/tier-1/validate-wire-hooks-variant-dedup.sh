#!/usr/bin/env bash
# validate-wire-hooks-variant-dedup.sh — Tier-1 validator for WI-359.
# Fixture-driven proof that wire-hooks.mjs canonicalizes argv-payload variants,
# collapses variant-class duplicates, preserves intentional flag-variants,
# emits async on observational hooks, is idempotent, and backs up before write.
# Promotion note: docs/plans/2026-06-07-wi-359-wire-hooks-dedup/manifest.md

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1

FIXTURE="test-framework/evals/tier-1/fixtures/wire-hooks-variant-dup.json"
WIRER="scripts/wire-hooks.mjs"
TMP="$(mktemp -d /tmp/wi359-dedup.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
S1="$TMP/settings.json"
cp "$FIXTURE" "$S1"

PASS=0
FAIL=0
check() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then
    echo "  ✓ $label"; PASS=$((PASS+1))
  else
    echo "  ✗ $label"; FAIL=$((FAIL+1))
  fi
}

# jq-free JSON probe: q <event> <py-expr-over-entries> ; entries = settings.hooks[event]
q() {
  python3 - "$S1" "$1" "$2" <<'PY'
import json,sys
s=json.load(open(sys.argv[1]))
entries=s.get("hooks",{}).get(sys.argv[2],[])
cmds=[(r.get("matcher",""),h) for r in entries for h in r.get("hooks",[])]
print(int(eval(sys.argv[3])))
PY
}

echo "=== Tier 1: wire-hooks variant dedup (WI-359) ==="

env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S1" > "$TMP/run1.log" 2>&1
check "wire run 1 exits 0" test "$?" = "0"

check "loop-guard collapsed to exactly 1" test "$(q PreToolUse "sum('svc-loop-guard.mjs' in h.get('command','') for _,h in cmds)")" = "1"
check "surviving loop-guard is canonical (no payload token)" test "$(q PreToolUse "sum('svc-loop-guard.mjs' in h.get('command','') and 'TOOL_INPUT' in h.get('command','') for _,h in cmds)")" = "0"
check "workflow-guard trio survived (3 entries)" test "$(q PreToolUse "sum('svc-workflow-guard.mjs' in h.get('command','') for _,h in cmds)")" = "3"
check "trio flag sets intact (plain+phase-boundary+bash-guard)" test "$(q PreToolUse "sum('svc-workflow-guard.mjs' in h.get('command','') and '--phase-boundary' in h.get('command','') for _,h in cmds) + sum('svc-workflow-guard.mjs' in h.get('command','') and '--bash-guard' in h.get('command','') for _,h in cmds)")" = "2"
check "no payload tokens on any svc hook" test "$(q PreToolUse "sum('TOOL_INPUT' in h.get('command','') for _,h in cmds)")" = "0"
check "accumulate entry survived canonicalized" test "$(q PostToolUse "sum('--accumulate' in h.get('command','') and 'TOOL_INPUT' not in h.get('command','') for _,h in cmds)")" = "1"
check "eval-gate pre+post both present (distinct identities)" test "$(q PreToolUse "sum('eval-gate.mjs pre' in h.get('command','') for _,h in cmds)")$(q PostToolUse "sum('eval-gate.mjs post' in h.get('command','') for _,h in cmds)")" = "11"
check "vibe-auditor is async" test "$(q PostToolUse "sum('svc-vibe-auditor' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "1"
check "capture-learnings PostToolUse is async" test "$(q PostToolUse "sum('svc-auto-capture-learnings' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "1"
check "capture-learnings Stop is async" test "$(q Stop "sum('svc-auto-capture-learnings' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "1"
check "stop-quality --check stays synchronous" test "$(q Stop "sum('--check' in h.get('command','') and h.get('async') is True for _,h in cmds)")" = "0"
check "backup created + restore line printed" bash -c "ls \"$TMP\"/settings.json.svc-backup-* >/dev/null 2>&1 && grep -q 'restore:' \"$TMP/run1.log\""

check "single-quoted payload variant collapsed into canonical loop-guard" test "$(q PreToolUse "sum(chr(39) in h.get('command','') and 'svc-loop-guard' in h.get('command','') for _,h in cmds)")" = "0"
check "user embedded-token hook untouched" test "$(q Stop "sum('--payload=\$TOOL_INPUT' in h.get('command','') for _,h in cmds)")" = "1"
check "kimi-host entry stripped from claude settings (WI-370)" test "$(q PreToolUse "sum('hooks/kimi/' in h.get('command','') for _,h in cmds)")" = "0"
check "emission contains no kimi scripts (WI-370)" bash -c "! env -u GIT_DIR -u GIT_WORK_TREE node '$WIRER' --skills-path '$REPO_ROOT' --list-all | grep -q 'hooks/kimi/'"
check "user hooks with same basename both survive (no fuzzy collapse)" test "$(q Stop "sum('deploy.js' in h.get('command','') for _,h in cmds)")" = "2"
# WI-562 IP-W1: the 3 direct write sites were unified into ONE atomic
# primitive (tmp+fsync+rename). The invariant is now: zero direct
# fs.writeFileSync(settingsPath) calls, writeSettingsDocument used, and every
# write path still preceded by backupSettingsOnce().
check "no direct settings writes remain (atomic primitive only)" bash -c "! grep -q 'fs.writeFileSync(settingsPath' '$WIRER'"
check "atomic writeSettingsDocument primitive present" bash -c "grep -q 'renameSync(tmp, target)' '$WIRER'"
check "all write sites are backup-guarded (static)" bash -c "test \"\$(grep -B1 'writeSettingsDocument(settingsPath' '$WIRER' | grep -c 'backupSettingsOnce();')\" = \"2\""

cp "$S1" "$TMP/snap1.json"
env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE \
  node "$WIRER" --skills-path "$REPO_ROOT" --settings "$S1" > "$TMP/run2.log" 2>&1
check "run 2 idempotent (byte-identical)" cmp -s "$S1" "$TMP/snap1.json"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS wire-hooks dedup checks passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
