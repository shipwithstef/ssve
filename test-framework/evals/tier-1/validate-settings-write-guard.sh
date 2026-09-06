#!/usr/bin/env bash
# validate-settings-write-guard.sh — Tier-1 validator for WI-394.
# Hermetic: drives scripts/svc-settings-write-guard.mjs with synthetic
# PostToolUse(Edit|Write) payloads against a TEMP settings file (SVC_SETTINGS_PATH),
# never a real ~/.claude. Proves a malformed ~/.claude/settings.json write is
# REJECTED (jq/parse + skillOverrides shape-check) and the prior good settings
# are RESTORED from the WI-359 `*.svc-backup-*` sibling. No network, no LLM.
# Promotion note: docs/specs/work-items/WI-394.md "Tier-1 promotion note".

set -u

# Keep standalone invocation isolated from active host/session state.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/fixture-home.sh"
svc_require_fixture "$@"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1
# Absolute paths so the guard + manifest resolve regardless of any cwd churn
# inside command-substitution subshells (the harness may reset cwd to /).
GUARD="$REPO_ROOT/scripts/svc-settings-write-guard.mjs"
TMP="$(mktemp -d /tmp/wi394-settings.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

PASS=0; FAIL=0
check() { local l="$1"; shift; if "$@" >/dev/null 2>&1; then echo "  ✓ $l"; PASS=$((PASS+1)); else echo "  ✗ $l"; FAIL=$((FAIL+1)); fi; }

# Build a PostToolUse Edit payload (tool + target file) as stdin JSON.
payload() { # file -> stdin JSON
  python3 -c "import json,sys;print(json.dumps({'hook_event_name':'PostToolUse','tool_name':'Edit','tool_input':{'file_path':sys.argv[1]},'session_id':'wi394'}))" "$1"
}
run_guard() { # settings-path -> runs guard with that file as the guarded target
  env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE SVC_SETTINGS_PATH="$1" node "$GUARD"
}

# A known-good settings.json (the documented shape) and a valid backup of it.
GOOD='{"skillOverrides":{"foo":"name-only","bar":"off"},"hooks":{"PreToolUse":[{"matcher":"Edit","hooks":[]}]}}'

echo "=== Tier 1: settings-write guard (WI-394) ==="

check "guard exists + node syntax" node --check "$GUARD"

# ----- AC1: malformed skillOverrides SHAPE is rejected + restored -----------
S1="$TMP/s1.json"
printf '%s' "$GOOD" > "$S1"
# wire-hooks-style backup of the GOOD state (lexical-newest by ISO suffix)
cp "$S1" "$S1.svc-backup-2026-06-08T10-00-00-000Z"
# now simulate the c9 regression landing on disk: object instead of string enum
printf '%s' '{"skillOverrides":{"foo":{"nameOnly":true}}}' > "$S1"
OUT1=$(payload "$S1" | run_guard "$S1" 2>"$TMP/e1.txt"); RC1=$?
check "AC1 malformed-shape write REJECTED (exit 2)" test "$RC1" = "2"
check "AC1 prior settings RESTORED from backup (on-disk == GOOD)" bash -c "test \"\$(cat '$S1')\" = '$GOOD'"
check "AC1 stderr names the c9 learning" grep -q "host-settings-schema-live-verify-before-write" "$TMP/e1.txt"
check "AC1 stderr reports the bad shape" grep -q "skillOverrides" "$TMP/e1.txt"

# ----- AC1 (jq/parse half): non-JSON garbage is rejected + restored ---------
S2="$TMP/s2.json"
printf '%s' "$GOOD" > "$S2"
cp "$S2" "$S2.svc-backup-2026-06-08T11-00-00-000Z"
printf '%s' '{ this is not json' > "$S2"
OUT2=$(payload "$S2" | run_guard "$S2" 2>"$TMP/e2.txt"); RC2=$?
check "AC1 invalid-JSON write REJECTED (exit 2)" test "$RC2" = "2"
check "AC1 invalid-JSON RESTORED to GOOD" bash -c "test \"\$(cat '$S2')\" = '$GOOD'"
check "AC1 stderr reports parse failure" grep -qi "valid JSON\|parse failed" "$TMP/e2.txt"

# ----- AC1 (enum half): bad string value (typo) is rejected -----------------
S3="$TMP/s3.json"
printf '%s' "$GOOD" > "$S3"
cp "$S3" "$S3.svc-backup-2026-06-08T12-00-00-000Z"
printf '%s' '{"skillOverrides":{"foo":"nameonly"}}' > "$S3"
OUT3=$(payload "$S3" | run_guard "$S3" 2>"$TMP/e3.txt"); RC3=$?
check "AC1 bad-enum-value write REJECTED (exit 2)" test "$RC3" = "2"
check "AC1 bad-enum RESTORED to GOOD" bash -c "test \"\$(cat '$S3')\" = '$GOOD'"

# ----- AC2: backup necessary-but-not-sufficient (no backup -> no clobber) ----
S4="$TMP/s4.json"
printf '%s' '{"skillOverrides":{"foo":{"nameOnly":true}}}' > "$S4"   # malformed, NO backup sibling
OUT4=$(payload "$S4" | run_guard "$S4" 2>"$TMP/e4.txt"); RC4=$?
check "AC2 no-backup malformed write still REJECTED (exit 2)" test "$RC4" = "2"
check "AC2 no-backup path warns it cannot auto-restore" grep -q "cannot auto-restore\|NO \`\*.svc-backup" "$TMP/e4.txt"
check "AC2 no-backup leaves the bad file untouched (no clobber)" bash -c "grep -q nameOnly '$S4'"
check "AC2 restore path emits a copy/restore command when a backup exists" grep -q "cp \"" "$TMP/e1.txt"

# ----- Negative: a VALID settings write passes silently ---------------------
S5="$TMP/s5.json"
printf '%s' "$GOOD" > "$S5"
OUT5=$(payload "$S5" | run_guard "$S5" 2>"$TMP/e5.txt"); RC5=$?
check "valid settings write passes (exit 0)" test "$RC5" = "0"
check "valid settings write is silent (no stderr)" test ! -s "$TMP/e5.txt"

# ----- Scope: a non-settings Edit is ignored (silent exit 0) ----------------
S6="$TMP/other.json"
printf '%s' '{ also not json but not the guarded file' > "$S6"
OUT6=$(payload "$S6" | env -u GIT_DIR SVC_SETTINGS_PATH="$TMP/s5.json" node "$GUARD" 2>"$TMP/e6.txt"); RC6=$?
check "non-settings target ignored (exit 0)" test "$RC6" = "0"
check "non-settings target untouched (still bad json, not restored)" bash -c "grep -q 'not json' '$S6'"

# ----- Escape hatch: SVC_SETTINGS_GUARD_OFF=1 disables the guard ------------
S7="$TMP/s7.json"
printf '%s' '{"skillOverrides":{"foo":{"nameOnly":true}}}' > "$S7"
cp "$S7" "$S7.svc-backup-2026-06-08T13-00-00-000Z"
RC7OUT=$(payload "$S7" | env -u GIT_DIR SVC_SETTINGS_PATH="$S7" SVC_SETTINGS_GUARD_OFF=1 node "$GUARD" 2>/dev/null); RC7=$?
check "SVC_SETTINGS_GUARD_OFF=1 bypasses (exit 0, no restore)" bash -c "test '$RC7' = '0' && grep -q nameOnly '$S7'"

# ----- AC3: never-fabricate rule registered as signal with signals ----------
check "AC3 rules/no-fabrication.md on disk" test -f "$REPO_ROOT/rules/no-fabrication.md"
check "AC3 no-fabrication registered as signal WITH signals" python3 -c "
import json
m=json.load(open('$REPO_ROOT/skills-manifest.json'))
e=[x for x in m['rulesRegistry']['entries'] if x['path']=='rules/no-fabrication.md']
assert len(e)==1, 'expected exactly one no-fabrication entry, got %d' % len(e)
e=e[0]
assert e['auto_inject']=='signal', e['auto_inject']
s=e.get('signals',{}) or {}
assert s.get('paths') or s.get('bash') or s.get('keywords') or s.get('content'), 'no signals'
"

echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — all $PASS settings-write-guard checks passed"; exit 0
else echo "  $FAIL failed, $PASS passed"; exit 1; fi
