#!/usr/bin/env bash
# validate-rule-injection.sh — Tier-1 validator for WI-361.
# Hermetic: drives hooks/svc-rule-injector.mjs with synthetic stdin payloads
# against the REAL registry; asserts classification invariants + linter schema.
# Promotion note: docs/plans/2026-06-07-wi-361-rule-injection/manifest.md

set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1
TMP="$(mktemp -d /tmp/wi361-inject.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
INJ="hooks/svc-rule-injector.mjs"

PASS=0; FAIL=0
check() { local l="$1"; shift; if "$@" >/dev/null 2>&1; then echo "  ✓ $l"; PASS=$((PASS+1)); else echo "  ✗ $l"; FAIL=$((FAIL+1)); fi; }

payload() { # tool file session -> stdin JSON
  python3 -c "import json,sys;print(json.dumps({'hook_event_name':sys.argv[1],'tool_name':sys.argv[2],'tool_input':{sys.argv[3]:sys.argv[4]},'session_id':sys.argv[5]}))" "$1" "$2" "$3" "$4" "$5"
}
run_inj() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$INJ"; }

echo "=== Tier 1: rule injection (WI-361) ==="

check "injector exists + node syntax" node --check "$INJ"

# I1: registry classification invariants
check "every entry has auto_inject" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
assert all(e.get('auto_inject') in ('always','signal','lazy') for e in m['rulesRegistry']['entries'])"
check "exactly 5 always entries (WI-393: long-output demoted always->signal)" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
assert sum(e['auto_inject']=='always' for e in m['rulesRegistry']['entries'])==5"
check "every signal entry has >=1 signal source" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
for e in m['rulesRegistry']['entries']:
    if e['auto_inject']=='signal':
        s=e.get('signals',{}) or {}
        assert s.get('paths') or s.get('bash') or s.get('keywords') or 'concern-bridge' in (e.get('notes','') or ''), e['path']"

# I2: PreToolUse(Edit) on a react file injects react rule with allow (fresh session s1)
rm -f .svc/rule-injections-wi361s1.json
OUT1=$(payload PreToolUse Edit file_path src/components/App.tsx wi361s1 | run_inj)
printf '%s' "$OUT1" > "$TMP/o1.json"
check "I2 react rule injected pre-edit" grep -q "react/coding-style" "$TMP/o1.json"
check "I2 permissionDecision allow present" grep -q '"permissionDecision":"allow"' "$TMP/o1.json"
check "I2 under 10K cap" python3 -c "
import json;d=json.load(open('$TMP/o1.json'));assert len(d['hookSpecificOutput']['additionalContext'])<=10000"

# I3: memo suppresses second touch (same session) — single-rule path (.go)
# so the cap cannot pointer anything (pointer rules re-arrive BY DESIGN, I11b)
rm -f .svc/rule-injections-wi361s1b.json
OUTg=$(payload PreToolUse Edit file_path src/main.go wi361s1b | run_inj)
printf '%s' "$OUTg" | grep -q "golang/patterns" || echo "  (warn: golang not injected first?)"
OUT2=$(payload PreToolUse Edit file_path src/util.go wi361s1b | run_inj)
check "I3 memo suppresses repeat (empty output)" test -z "$OUT2"

# I4: Bash keyword trigger (gh workflow class)
rm -f .svc/rule-injections-wi361s2.json
OUT3=$(payload PreToolUse Bash command "gh workflow run build.yml --ref main" wi361s2 | run_inj)
printf '%s' "$OUT3" > "$TMP/o3.json"
check "I4 bash-keyword rule injected" grep -q "gh-workflow-validation\|cross-ref-workflow" "$TMP/o3.json"

# I5: explore trigger (PostToolUse Read) — no permissionDecision on PostToolUse
rm -f .svc/rule-injections-wi361s3.json
OUT4=$(payload PostToolUse Read file_path e2e/specs/j1.spec.ts wi361s3 | run_inj)
printf '%s' "$OUT4" > "$TMP/o4.json"
check "I5 e2e rules injected on explore" grep -q "transient-ui-assertion\|tenant-scoped" "$TMP/o4.json"
check "I5 no permissionDecision on PostToolUse" bash -c "! grep -q permissionDecision '$TMP/o4.json'"

# I6: non-matching path → silent exit 0
OUT5=$(payload PreToolUse Edit file_path README.md wi361s4 | run_inj); RC=$?
check "I6 non-match silent" bash -c "test -z '$OUT5' && test $RC -eq 0"

# I7: always-set never appears in injector output (they live in global dir)
check "I7 always rules not signal-classified" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
always={e['path'] for e in m['rulesRegistry']['entries'] if e['auto_inject']=='always'}
sig={e['path'] for e in m['rulesRegistry']['entries'] if e['auto_inject']=='signal'}
assert not (always & sig)"

# I8: linter passes with new schema
check "I8 lint-skills-manifest green" node scripts/lint-skills-manifest.mjs

# I9: setup installs only always (static)
check "I9 setup filters auto_inject==always" grep -q "auto_inject" setup
check "I9b setup backs up before trim" grep -q "rules-backup\|svc-backup" setup

# I10 (PLAN-004): bridge-ONLY proof — fixture registries where the rule has NO
# direct path/bash/keyword signal; only the concern's handled_by.required_rules
# can produce the injection.
rm -f .svc/rule-injections-wi361s5.json
python3 - "$TMP" <<'PY'
import json,sys
t=sys.argv[1]
json.dump({"rulesRegistry":{"entries":[{"path":"rules/post-fix-evidence-before-next-fix.md","type":"correction","auto_inject":"signal","notes":"concern-bridge only (fixture)","signals":{}}]}},open(f"{t}/fixture-manifest.json","w"))
json.dump({"concerns":[{"name":"fixture-bridge","signals":{"file_path_patterns":["**/bridge-target/**"]},"handled_by":{"required_rules":["post-fix-evidence-before-next-fix"]},"fires_off":[]}]},open(f"{t}/fixture-concerns.json","w"))
PY
OUT6=$(payload PreToolUse Edit file_path src/bridge-target/x.js wi361s5 |   SVC_RULES_MANIFEST="$TMP/fixture-manifest.json" SVC_CONCERNS_REGISTRY="$TMP/fixture-concerns.json" run_inj)
printf '%s' "$OUT6" > "$TMP/o6.json"
check "I10 bridge-ONLY injection (no direct signals possible)" grep -q "post-fix-evidence" "$TMP/o6.json"

# I11 (PLAN-003): pointer-state rules stay eligible for FULL injection later
rm -f .svc/rule-injections-wi361s6.json
python3 - "$TMP" <<'PY'
import json,sys,os
t=sys.argv[1]
os.makedirs(f"{t}/bigrules/rules",exist_ok=True)
open(f"{t}/bigrules/rules/big-a.md","w").write("A"*6000)
open(f"{t}/bigrules/rules/big-b.md","w").write("B"*6000)
json.dump({"rulesRegistry":{"entries":[
 {"path":"rules/big-a.md","type":"correction","auto_inject":"signal","signals":{"paths":["overflow-target"]}},
 {"path":"rules/big-b.md","type":"correction","auto_inject":"signal","signals":{"paths":["overflow-target"]}}]}},open(f"{t}/fixture-overflow.json","w"))
PY
O1=$(payload PreToolUse Edit file_path src/overflow-target/a.js wi361s6 |   SVC_RULES_MANIFEST="$TMP/fixture-overflow.json" SVC_RULES_ROOT="$TMP/bigrules" run_inj)
printf '%s' "$O1" > "$TMP/o7.json"
check "I11a first big rule full, second pointered" bash -c "grep -q 'AAAA' '$TMP/o7.json' && grep -q 'rules/big-b.md' '$TMP/o7.json' && ! grep -q 'BBBB' '$TMP/o7.json'"
O2=$(payload PreToolUse Edit file_path src/overflow-target/b.js wi361s6 |   SVC_RULES_MANIFEST="$TMP/fixture-overflow.json" SVC_RULES_ROOT="$TMP/bigrules" run_inj)
printf '%s' "$O2" > "$TMP/o8.json"
check "I11b pointered rule arrives FULL on next touch" grep -q "BBBB" "$TMP/o8.json"

# cleanup memo fixtures
rm -f .svc/rule-injections-wi361s*.json

echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — all $PASS rule-injection checks passed"; exit 0
else echo "  $FAIL failed, $PASS passed"; exit 1; fi
