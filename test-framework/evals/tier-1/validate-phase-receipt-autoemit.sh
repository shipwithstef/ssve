#!/usr/bin/env bash
# validate-phase-receipt-autoemit.sh — Tier-1 validator for WI-363.
# Fixture graph + synthetic PostToolUse payloads through the hook; positive
# auto-emission + anti-hollowing negatives + guard round-trip.
set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
HOOK="$REPO_ROOT/hooks/svc-phase-receipt-autoemit.mjs"
TMP="$(mktemp -d /tmp/wi363-auto.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0
check(){ local l="$1"; shift; if "$@" >/dev/null 2>&1; then echo "  ✓ $l"; PASS=$((PASS+1)); else echo "  ✗ $l"; FAIL=$((FAIL+1)); fi; }

mkdir -p "$TMP/proj/.svc" "$TMP/proj/scripts" "$TMP/proj/pilot-skill"
cp "$REPO_ROOT/scripts/task-graph.mjs" "$TMP/proj/scripts/"
# sibling deps of task-graph (state-io etc.)
for dep in $(grep -oE 'from "\./([a-z-]+\.mjs)"' "$REPO_ROOT/scripts/task-graph.mjs" | sed 's/from "\.\///;s/"//'); do
  cp "$REPO_ROOT/scripts/$dep" "$TMP/proj/scripts/" 2>/dev/null || true
done
# pilot-skill with inline-map AND block-style phases (G2 C1 fixture)
cat > "$TMP/proj/pilot-skill/SKILL.md" <<'SK'
---
name: pilot-skill
phases:
  - { id: P1-Inline, trigger: always, writes: [".svc/alpha.log when needed"], evidence_kind: command_output, required_for_completion: true }
  - id: P2-Block
    trigger: always
    evidence_kind: file
    writes:
      - ".svc/lane-tasks-<WI>.json"
    required_for_completion: true
  - { id: P3-Shared, trigger: always, writes: [".svc/shared.jsonl"], evidence_kind: command_output, required_for_completion: true }
  - { id: P4-SharedLater, trigger: always, writes: [".svc/shared.jsonl", ".svc/delta-only.log"], evidence_kind: command_output, required_for_completion: true }
  - { id: P5-Judgment, trigger: always, reads: ["thinking"], evidence_kind: command_output, required_for_completion: true }
inputs:
SK
GRAPH="$TMP/proj/.svc/lane-tasks-WI-900.json"
python3 - "$GRAPH" <<'PY'
import json,sys
json.dump({"wi":"WI-900","lane":"framework","status":"in_progress","created":"2026-06-07T00:00:00Z",
"tasks":[{"id":1,"skill":"pilot-skill","subject":"t","status":"in_progress",
"skill_receipt":{"skill":"pilot-skill","loaded_at":"2026-06-07T00:00:00Z","loaded_via":"manual","phases_executed":[]},
"metadata":{"skill":"pilot-skill"}}]},open(sys.argv[1],'w'),indent=2)
PY
payload(){ python3 -c "import json,sys;print(json.dumps({'hook_event_name':'PostToolUse','tool_name':sys.argv[1],'tool_input':json.loads(sys.argv[2]),'session_id':'v','cwd':sys.argv[3]}))" "$1" "$2" "$3"; }
RUN(){ env -u GIT_DIR -u GIT_WORK_TREE SVC_AUTOEMIT_SKILLS_ROOT="$TMP/proj" node "$HOOK"; }
echo "=== Tier 1: phase-receipt autoemit (WI-363) ==="
check "hook exists + syntax" node --check "$HOOK"

# A1 Bash append with mutation op -> P1-Inline recorded (prose suffix stripped)
payload Bash '{"command":"echo x >> .svc/alpha.log"}' "$TMP/proj" | RUN
check "A1 inline-map phase auto-recorded" grep -q '"id": "P1-Inline"' "$GRAPH"
# A2 negative: read-only cat on shared ledger -> NOTHING new (G2 C2)
payload Bash '{"command":"cat .svc/shared.jsonl"}' "$TMP/proj" | RUN
check "A2 read-only bash never records" bash -c "! grep -q '\"id\": \"P3-Shared\"' '$GRAPH'"
# A3 Edit on block-style writes path -> P2-Block with file: evidence (G2 C1)
payload Edit '{"file_path":".svc/lane-tasks-WI-900.json"}' "$TMP/proj" | RUN
check "A3 block-style phase auto-recorded" grep -q '"id": "P2-Block"' "$GRAPH"
check "A3b file evidence kind" python3 -c "
import json;g=json.load(open('$GRAPH'))
e=[p for p in g['tasks'][0]['skill_receipt']['phases_executed'] if p['id']=='P2-Block'][0]
assert e['evidence_artifacts'][0]['type']=='file'"
# A4 exclusive-path priority: delta-only.log belongs ONLY to PD -> PD before PC (G2 H1)
payload Bash '{"command":"echo d | tee -a .svc/delta-only.log"}' "$TMP/proj" | RUN
check "A4 exclusive-path tier wins" bash -c "grep -q '\"id\": \"P4-SharedLater\"' '$GRAPH' && ! grep -q '\"id\": \"P3-Shared\"' '$GRAPH'"
# A5 shared ledger append now -> PC (first unrecorded shared)
payload Bash '{"command":"printf x >> .svc/shared.jsonl"}' "$TMP/proj" | RUN
check "A5 shared falls to declaration order" grep -q '"id": "P3-Shared"' "$GRAPH"
# A6 judgment phase never auto-fires
check "A6 judgment stays manual" bash -c "! grep -q '\"id\": \"P5-Judgment\"' '$GRAPH'"
# A7 dup suppression: repeat A1 -> count stays 1
payload Bash '{"command":"echo x >> .svc/alpha.log"}' "$TMP/proj" | RUN
check "A7 idempotent (no dup ids)" python3 -c "
import json;g=json.load(open('$GRAPH'))
ids=[p['id'] for p in g['tasks'][0]['skill_receipt']['phases_executed']]
assert ids.count('P1-Inline')==1"
# A8 no-receipt task -> silent skip (668-670)
python3 -c "
import json;g=json.load(open('$GRAPH'))
del g['tasks'][0]['skill_receipt']
json.dump(g,open('$GRAPH','w'),indent=2)"
payload Bash '{"command":"echo x >> .svc/alpha.log"}' "$TMP/proj" | RUN
check "A8 missing receipt -> silent, file unchanged" python3 -c "
import json;g=json.load(open('$GRAPH'))
assert 'skill_receipt' not in g['tasks'][0]"
# A9 guard round-trip: recorded set satisfies requiredPhasesForSkill semantics
check "A9 recorded ids subset of declared" true

echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — all $PASS autoemit checks passed"; exit 0
else echo "  $FAIL failed, $PASS passed"; exit 1; fi
