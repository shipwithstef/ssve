#!/bin/bash
# validate-settings-no-duplicate-hooks.sh — WI-076 tier-1 validator.
#
# Asserts scripts/wire-hooks.mjs is idempotent: running it twice from scratch
# must produce a settings.json with zero duplicate hooks per matcher/command.
#
# Method: run dry-run on a scratch settings.json (empty), then run again,
# then compare. If results differ, dedup broke. Additionally, a direct scan
# of any settings.json pointed to must show zero duplicates per
# (event, matcher, command) tuple.

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

PASS=0
FAIL=0

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ✗ $1"; }

echo "=== Tier 1: settings no-duplicate-hooks (WI-076) ==="

WIRE="$REPO_ROOT/scripts/wire-hooks.mjs"
RENAMES="$REPO_ROOT/hooks/.renames.json"

[ -r "$WIRE" ] && pass "wire-hooks.mjs present" || { fail "wire-hooks.mjs missing"; exit 1; }
[ -r "$RENAMES" ] && pass ".renames.json registry present" || fail ".renames.json registry missing"

# Registry is valid JSON
if [ -r "$RENAMES" ]; then
  python3 -c "import json; json.load(open('$RENAMES'))" 2>/dev/null && pass ".renames.json is valid JSON" || fail ".renames.json is invalid JSON"
fi

# Syntax check on the wire script
node --check "$WIRE" 2>/dev/null && pass "wire-hooks.mjs syntax OK" || fail "wire-hooks.mjs syntax error"

# Fresh-install idempotency: run twice on a scratch settings, compare
SCRATCH=$(mktemp -d)
echo '{}' > "$SCRATCH/settings1.json"
cp "$SCRATCH/settings1.json" "$SCRATCH/settings2.json"
# Fresh settings after 1 run
node "$WIRE" --skills-path "$SCRATCH" --settings "$SCRATCH/settings1.json" >/dev/null 2>&1 || true
# Same settings after 2 runs
cp "$SCRATCH/settings1.json" "$SCRATCH/settings2.json"
node "$WIRE" --skills-path "$SCRATCH" --settings "$SCRATCH/settings2.json" >/dev/null 2>&1 || true
if diff -q "$SCRATCH/settings1.json" "$SCRATCH/settings2.json" >/dev/null 2>&1; then
  pass "idempotent: 2 runs produce identical settings.json"
else
  fail "NOT idempotent: 2nd run differs from 1st"
fi
# WI-FW-HOOKS-SAFETY-01 (AC-6): ONE deny-capable pre-tool decision engine per
# event, and no two deny-capable PreToolUse entries may share an effective
# mutation tool — double classification of one request is the FP-03/FP-07 hazard.
SCRATCH_SETTINGS="$SCRATCH/settings1.json"
export SCRATCH_SETTINGS
ONE_ENGINE=$(python3 -c "
import json,sys,os
s=json.load(open(os.environ.get('SCRATCH_SETTINGS','settings1.json')))
pre=s.get('hooks',{}).get('PreToolUse',[])
engine=[e for e in pre if any('svc-codex-pretool-dispatcher' in h.get('command','') for h in e.get('hooks',[]))]
print(1 if len(engine)==1 else 0)
")
if [ "$ONE_ENGINE" = "1" ]; then
  pass "exactly one deny-capable pre-tool decision engine wired"
else
  fail "expected exactly 1 svc-codex-pretool-dispatcher PreToolUse entry"
fi

OVERLAP=$(python3 -c "
import json,sys,os
s=json.load(open(os.environ.get('SCRATCH_SETTINGS','settings1.json')))
ADVISORY=('svc-rule-injector-edit','svc-learning-inject','svc-owner-inject')
def advisory(eid):
    return any(a in eid for a in ('rule-injector','learning-inject','owner-inject'))
pre=s.get('hooks',{}).get('PreToolUse',[])
tools=lambda m:set(filter(None,m.split('|')))
seen={}
for e in pre:
    eid=e.get('id') or ''
    if advisory(eid): continue
    for t in tools(e.get('matcher','')):
        seen.setdefault(t,set()).add(eid or 'cmd')
overlap=0
MUT={'Bash','Edit','Write','MultiEdit','StrReplaceFile','NotebookEdit','apply_patch'}
for t,ids in seen.items():
    if t in MUT and len(ids)>1:
        non_engine=[i for i in ids if i!='svc-pretool-decision-engine']
        if non_engine: overlap+=1; print(t, non_engine, file=sys.stderr)
print(overlap)
")
if [ "$OVERLAP" = "0" ]; then
  pass "no deny-capable overlap on mutation tools outside the single engine"
else
  fail "deny-capable PreToolUse overlap on mutation tools ($OVERLAP)"
fi

rm -rf "$SCRATCH"

# Duplicate-hook check on real settings (if present)
SETTINGS="$HOME/.claude/settings.json"
if [ -r "$SETTINGS" ]; then
  DUPES=$(python3 - <<EOF
import json, sys
with open("$SETTINGS") as f: s = json.load(f)
hooks = s.get("hooks", {})
dupes = 0
for event, entries in hooks.items():
    if not isinstance(entries, list): continue
    seen = set()
    for entry in entries:
        m = entry.get("matcher", "")
        cmds = tuple(sorted((h.get("type",""), h.get("command","")) for h in entry.get("hooks", [])))
        key = (m, cmds)
        if key in seen:
            dupes += 1
        else:
            seen.add(key)
print(dupes)
EOF
)
  if [ "$DUPES" = "0" ]; then
    pass "~/.claude/settings.json has zero duplicate hooks"
  else
    fail "~/.claude/settings.json has $DUPES duplicate hook entries — run ./setup --host claude to dedup"
  fi
else
  pass "~/.claude/settings.json not present — dedup check N/A"
fi

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
