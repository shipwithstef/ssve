#!/usr/bin/env bash
# validate-output-discipline-guard.sh — Tier-1 validator for WI-393
# (session-survival output guard). Hermetic, deterministic, no network/no-LLM.
#
# Asserts the three WI-393 deliverables:
#   (a) rules/long-output-to-file.md is signal-injected on output-heavy skill
#       signals (not always-on); the injector actually fires on those paths and
#       is silent on a control path.
#   (b) the headless dispatch template prepends the canonical output-discipline
#       preamble into the worker prompt.
#   (c) the SessionStart zombie-session sweeper flags an all-error/zero-work
#       transcript as a learning-candidate, leaves a healthy transcript alone,
#       NEVER blocks (exit 0), and self-dedupes across runs.
#
# Promotion note: docs/specs/work-items/WI-393.md "## Tier-1 promotion note".

set -u
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
cd "$REPO_ROOT" || exit 1
TMP="$(mktemp -d /tmp/wi393-output-guard.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

INJ="hooks/svc-rule-injector.mjs"
SWEEP="scripts/zombie-session-sweep.mjs"
PREAMBLE="references/output-discipline-preamble.md"
DISPATCH="scripts/dispatch-worker.sh"

PASS=0; FAIL=0
check() { local l="$1"; shift; if "$@" >/dev/null 2>&1; then echo "  ✓ $l"; PASS=$((PASS+1)); else echo "  ✗ $l"; FAIL=$((FAIL+1)); fi; }
not_contains() { local needle="$1" value="$2"; ! grep -Fq -- "$needle" <<<"$value"; }

run_node() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$@"; }

echo "=== Tier 1: output-discipline guard (WI-393) ==="

# ── Static: files exist + parse ───────────────────────────────────────────────
check "sweeper exists + node syntax" run_node --check "$SWEEP"
check "preamble fragment exists" test -r "$PREAMBLE"
check "dispatch template exists" test -r "$DISPATCH"

# ── (a) long-output rule classification ───────────────────────────────────────
check "(a) long-output is signal-injected (not always)" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
e=[x for x in m['rulesRegistry']['entries'] if x['path']=='rules/long-output-to-file.md'][0]
assert e['auto_inject']=='signal', e['auto_inject']"
check "(a) long-output carries output-heavy path/bash signals" python3 -c "
import json;m=json.load(open('skills-manifest.json'))
e=[x for x in m['rulesRegistry']['entries'] if x['path']=='rules/long-output-to-file.md'][0]
s=e.get('signals',{}) or {}
assert s.get('paths'), 'no paths'
assert s.get('bash'), 'no bash'
joined=' '.join(s['paths'])+' '+' '.join(s['bash'])
assert 'audit' in joined and ('knowledge' in joined or 'analysis' in joined), joined"
check "(a) rule file still present on disk (injector reads it)" test -r "rules/long-output-to-file.md"

# injector FIRES on an output-heavy path
rm -f .svc/rule-injections-wi393a1.json
printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Write","tool_input":{"file_path":"docs/specs/audit-reports/WI-1.md"},"session_id":"wi393a1"}' \
  | run_node "$INJ" > "$TMP/a1.json" 2>/dev/null
check "(a) injector fires long-output on audit-reports path" grep -q "long-output-to-file" "$TMP/a1.json"
check "(a) injector emits allow on PreToolUse" grep -q '"permissionDecision":"allow"' "$TMP/a1.json"

# injector FIRES on an output-heavy bash command
rm -f .svc/rule-injections-wi393a2.json
printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Bash","tool_input":{"command":"run audit-implementation WI-1"},"session_id":"wi393a2"}' \
  | run_node "$INJ" > "$TMP/a2.json" 2>/dev/null
check "(a) injector fires long-output on audit-implementation bash" grep -q "long-output-to-file" "$TMP/a2.json"

# injector SILENT on a control path (proves it is no longer always-on)
rm -f .svc/rule-injections-wi393a3.json
OUTC=$(printf '%s' '{"hook_event_name":"PreToolUse","tool_name":"Edit","tool_input":{"file_path":"CHANGELOG.md"},"session_id":"wi393a3"}' | run_node "$INJ" 2>/dev/null)
check "(a) long-output NOT injected on control path" not_contains "long-output-to-file" "$OUTC"
rm -f .svc/rule-injections-wi393a*.json

# ── (b) dispatch template prepends the preamble ───────────────────────────────
check "(b) dispatch reads canonical preamble fragment" grep -q "output-discipline-preamble.md" "$DISPATCH"
check "(b) dispatch injects preamble into worker PROMPT" grep -q "OUTPUT_DISCIPLINE" "$DISPATCH"
check "(b) preamble states file-first discipline" grep -qi "file-first" "$PREAMBLE"
check "(b) preamble bounds retries" grep -qi "retries" "$PREAMBLE"
# honest-scope clause present (AC: hooks/preambles cannot hard-cap output length)
check "(b) preamble is honest about not hard-capping output" grep -qi "cannot hard-cap" "$PREAMBLE"

# ── (c) zombie-session sweeper ────────────────────────────────────────────────
# Fixture transcripts: one all-error/zero-work (zombie), one with a tool_use
# (healthy → must NOT be flagged), one error-mixed-with-text-but-tooluse.
TDIR="$TMP/transcripts"
mkdir -p "$TDIR"
python3 - "$TDIR" <<'PY'
import json,sys,os
t=sys.argv[1]
# zombie: every assistant turn is an output-limit error, no tool use
with open(os.path.join(t,"zombie.jsonl"),"w") as f:
    f.write(json.dumps({"type":"user","message":{"role":"user","content":"do the thing"}})+"\n")
    f.write(json.dumps({"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"API Error: 500 output token maximum reached"}]}})+"\n")
    f.write(json.dumps({"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"prompt is too long"}]}})+"\n")
# healthy: assistant did a tool_use → work product → NOT a zombie
with open(os.path.join(t,"healthy.jsonl"),"w") as f:
    f.write(json.dumps({"type":"user","message":{"role":"user","content":"do the thing"}})+"\n")
    f.write(json.dumps({"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Edit","input":{}}]}})+"\n")
    f.write(json.dumps({"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"done"}]}})+"\n")
# error-but-worked: had a rate-limit error AND a tool_use → NOT a zombie (did work)
with open(os.path.join(t,"errored-but-worked.jsonl"),"w") as f:
    f.write(json.dumps({"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"rate limit hit, retrying"}]}})+"\n")
    f.write(json.dumps({"type":"assistant","message":{"role":"assistant","content":[{"type":"tool_use","name":"Bash","input":{}}]}})+"\n")
PY

# Run sweeper hermetically against the fixture dir, in an isolated cwd so the
# candidates file is created fresh (no repo .svc pollution). Capture stdout to a
# file (the additionalContext JSON contains quotes — do not shell-interpolate).
WORK="$TMP/work"; mkdir -p "$WORK/.svc"
printf '%s' "{\"cwd\":\"$WORK\"}" | SVC_TRANSCRIPT_DIR="$TDIR" run_node "$SWEEP" > "$TMP/sweep.out" 2>"$TMP/sweep.err"; RC=$?
CAND="$WORK/.svc/zombie-session-candidates.jsonl"

check "(c) sweeper exits 0 (never blocks)" test "$RC" -eq 0
check "(c) candidates file written" test -f "$CAND"
check "(c) zombie transcript flagged" bash -c "grep -q '\"transcript\":\"zombie.jsonl\"' '$CAND'"
check "(c) healthy transcript NOT flagged" bash -c "! grep -q '\"transcript\":\"healthy.jsonl\"' '$CAND'"
check "(c) errored-but-worked NOT flagged" bash -c "! grep -q 'errored-but-worked.jsonl' '$CAND'"
check "(c) row is non-blocking" bash -c "grep -q '\"blocking\":false' '$CAND'"
check "(c) row carries learning-candidate type" bash -c "grep -q '\"type\":\"learning-candidate\"' '$CAND'"
check "(c) row records assistant/error turn evidence" bash -c "grep -q '\"error_turns\"' '$CAND' && grep -q '\"assistant_turns\"' '$CAND'"
check "(c) SessionStart additionalContext surfaced" grep -q "additionalContext" "$TMP/sweep.out"

# dedupe: second run must NOT re-append the same zombie row
LINES1=$(wc -l < "$CAND")
printf '%s' "{\"cwd\":\"$WORK\"}" | SVC_TRANSCRIPT_DIR="$TDIR" run_node "$SWEEP" >/dev/null 2>&1
LINES2=$(wc -l < "$CAND")
check "(c) re-run self-dedupes (no double-emit)" test "$LINES1" -eq "$LINES2"

# missing transcript dir → silent exit 0 (fail-open)
printf '%s' "{\"cwd\":\"$WORK\"}" | SVC_TRANSCRIPT_DIR="$TMP/does-not-exist" run_node "$SWEEP" > "$TMP/none.out" 2>/dev/null; RC2=$?
check "(c) missing transcript dir → silent exit 0" bash -c "test ! -s '$TMP/none.out' && test $RC2 -eq 0"

# ── wiring: sweeper registered as a SessionStart command in wire-hooks ─────────
check "(wire) sweeper wired into wire-hooks SessionStart" grep -q "zombie-session-sweep.mjs" scripts/wire-hooks.mjs

echo ""
if [ "$FAIL" = 0 ]; then echo "  PASS — all $PASS output-discipline checks passed"; exit 0
else echo "  $FAIL failed, $PASS passed"; exit 1; fi
