#!/usr/bin/env bash
# validate-quick-fix-carve-out.sh — Tier-1 validator for WI-360.
# Both-directions proof for the exempt-class carve-out + receipt-commit binding.
# Promotion note: docs/plans/2026-06-07-wi-360-quick-fix-carve-out/manifest.md

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

TMP="$(mktemp -d /tmp/wi360-carveout.XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

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

# Scratch repo with sanitized git env (WI-358 LF-001 class: never inherit GIT_*)
G() { env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE git -C "$TMP/repo" "$@"; }
SESSION="019f6001-5463-7dc0-a1f5-73104831606a"
impact_receipt() {
  local classified
  classified="$(cd "$TMP/repo" && node "$REPO_ROOT/scripts/classify-change-risk.mjs" --staged --json 2>/dev/null)" || return 0
  ( cd "$TMP/repo" && CLASSIFIED="$classified" SESSION_ID="$SESSION" node --input-type=module <<'NODE'
import fs from 'node:fs';
const c=JSON.parse(process.env.CLASSIFIED);
fs.mkdirSync('.svc/impact-triad/WI-900',{recursive:true});
const high=c.tier==='high', logic=c.tier==='logic';
const artifact=c.paths[0];
const r={schema_version:1,wi:'WI-900',session_id:process.env.SESSION_ID,worktree_root:process.cwd(),task_graph:`${process.cwd()}/.svc/lane-tasks-WI-900.json`,task_id:1,diff_sha256:c.sha256,risk_tier:c.tier,risk_reasons:c.reasons,breaks_what:{answer:'carve-out fixture diff',sources:['git diff --cached'],evidence:['validate-quick-fix-carve-out.sh']},intended_behavior:{answer:'preserve carve-out contract',sources:['test-framework/evals/tier-1/validate-quick-fix-carve-out.sh'],evidence:['fixture assertions']},product_surface:{answer:'headless quick-fix gate',sources:['references/change-impact-triad.md'],evidence:['mechanical fixture']},coverage_tasks:[{id:'fixture',status:'completed',owner:'validator',validation:'validate-quick-fix-carve-out.sh'}],independent_review:{status:high?'pass':'n/a',executor_family:'openai',reviewer_family:high?'anthropic':'n/a',artifacts:high?[artifact]:[]},runtime_proof:{status:'pass',kind:high?'behavioral':logic?'mapped-test':'static',artifacts:[artifact]},created_at:new Date().toISOString()};
fs.writeFileSync('.svc/impact-triad/WI-900/task-1.json',JSON.stringify(r));
NODE
  )
}
ELIG() { impact_receipt; ( cd "$TMP/repo" && SVC_SESSION_ID="$SESSION" env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/quick-fix-eligibility.mjs" ); }

mkdir -p "$TMP/repo"
G init -q
G config user.email t@t.t
G config user.name t
mkdir -p "$TMP/repo/docs/specs/work-items" "$TMP/repo/docs/analysis" "$TMP/repo/proposals" "$TMP/repo/.svc" "$TMP/repo/hooks"
echo "seed" > "$TMP/repo/seed.md"
printf '.svc/receipts/\n' > "$TMP/repo/.gitignore"   # the eligibility script writes staging receipts into .svc/receipts/ — keep add -A clean
G add -A; G commit -qm seed
BRANCH="$(G branch --show-current)"
printf '.svc/bindings/\n.svc/claims/\n.svc/impact-triad/\n.svc/lane-tasks-WI-900.json\n' >> "$TMP/repo/.git/info/exclude"
mkdir -p "$TMP/repo/.svc/bindings" "$TMP/repo/.svc/claims"
cat > "$TMP/repo/.svc/lane-tasks-WI-900.json" <<'JSON'
{"wi":"WI-900","lane":"quick-fix","status":"in_progress","tasks":[{"id":1,"skill":"quick-fix","metadata":{"skill":"quick-fix","wi":"WI-900"},"status":"in_progress","blocked_by":[],"skill_receipt":{"skill":"quick-fix","loaded_at":"2026-07-15T00:00:00Z","loaded_via":"fixture"}}]}
JSON
CLAIM="$TMP/repo/.svc/claims/WI-900.claim.json"
cat > "$CLAIM" <<JSON
{"schema_version":1,"wi":"WI-900","generation":1,"repo_root":"$TMP/repo","worktree_root":"$TMP/repo","branch":"$BRANCH","session_id":"$SESSION","role":"mutating","started_at":"2026-07-15T00:00:00Z","renewed_at":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","ttl_hours":24}
JSON
cat > "$TMP/repo/.svc/bindings/test.json" <<JSON
{"schema_version":1,"session_id":"$SESSION","role":"mutating","wi":"WI-900","repo_root":"$TMP/repo","worktree_root":"$TMP/repo","branch":"$BRANCH","claim_path":"$CLAIM","created_at":"2026-07-15T00:00:00Z","updated_at":"2026-07-15T00:00:00Z","generation":1}
JSON

echo "=== Tier 1: quick-fix carve-out (WI-360) ==="

# D1: exempt-class multi-file (>3 files, >30 lines) → ELIGIBLE
for i in 1 2 3 4 5; do printf 'doc %s\n%s\n' "$i" "$(seq 1 12)" > "$TMP/repo/docs/specs/work-items/WI-90$i.md"; done
printf 'analysis\n' > "$TMP/repo/docs/analysis/a.md"
printf '{"ts":"t1"}\n' >> "$TMP/repo/.svc/pipeline-decisions.jsonl"
G add -A
OUT_D1="$(ELIG)"; CODE_D1=$?
check "D1 exit 0 (eligible)" test "$CODE_D1" = "0"
check "D1 receipt says eligible true" bash -c "printf '%s' '$OUT_D1' | grep -q '\"eligible\": *true'"
check "D1 reason cites exempt-class" bash -c "printf '%s' '$OUT_D1' | grep -qi 'exempt'"
G commit -qm "docs batch"

# D2: hot-path file → REFUSED (denylist direction)
echo "x=1" > "$TMP/repo/hooks/h.mjs"; G add -A
OUT_D2="$(ELIG)"; CODE_D2=$?
check "D2 hot-path refused (exit 1)" test "$CODE_D2" = "1"
check "D2 reason cites denylist" bash -c "printf '%s' '$OUT_D2' | grep -q 'denylist'"
G commit -qm "hot"

# D3: tier-1 dir + FRAMEWORK-STATE.md newly denied
mkdir -p "$TMP/repo/test-framework/evals/tier-1"
echo "echo hi" > "$TMP/repo/test-framework/evals/tier-1/v.sh"; G add -A
OUT_D3="$(ELIG)"; CODE_D3=$?
check "D3 tier-1 dir refused" test "$CODE_D3" = "1"
G commit -qm t1
echo "state" > "$TMP/repo/FRAMEWORK-STATE.md"; G add -A
OUT_D3b="$(ELIG)"; CODE_D3b=$?
check "D3b FRAMEWORK-STATE refused" test "$CODE_D3b" = "1"
G commit -qm fs

# D4: mixed exempt + hot → REFUSED
echo "more docs" >> "$TMP/repo/docs/analysis/a.md"
echo "y=2" >> "$TMP/repo/hooks/h.mjs"
G add -A
OUT_D4="$(ELIG)"; CODE_D4=$?
check "D4 mixed stage refused" test "$CODE_D4" = "1"
G commit -qm mixed

# D5: .svc jsonl REWRITE (removal lines) → REFUSED; append-only → eligible
printf '{"ts":"t2"}\n' >> "$TMP/repo/.svc/pipeline-decisions.jsonl"
G add -A
CODE_D5a=0; ELIG >/dev/null 2>&1 || CODE_D5a=$?
check "D5a append-only jsonl eligible" test "$CODE_D5a" = "0"
G commit -qm append
python3 - "$TMP/repo/.svc/pipeline-decisions.jsonl" <<'PY'
import sys
p=sys.argv[1]
lines=open(p).read().splitlines(True)
open(p,'w').writelines(lines[1:])  # delete first line = rewrite
PY
G add -A
CODE_D5b=0; ELIG >/dev/null 2>&1 || CODE_D5b=$?
check "D5b jsonl rewrite refused" test "$CODE_D5b" = "1"

# D6: receipt-commit binding — checker rejects tree-hash mismatch
check "checker binds receipt tree to commit tree (static)" grep -q 'rev-parse.*\^{tree}' "$REPO_ROOT/scripts/check-chain-receipts.mjs"
check "checker reports tree-mismatch reason (static)" grep -qi 'tree.*mismatch\|mismatch.*tree' "$REPO_ROOT/scripts/check-chain-receipts.mjs"

# D7 (G6-001): R100 rename from denylisted source into exempt tree → REFUSED
mkdir -p "$TMP/repo/scripts" "$TMP/repo/docs/specs"
printf 'export const x = 1;\n' > "$TMP/repo/scripts/smuggle.mjs"
G add -A; G commit -qm pre-rename
G mv scripts/smuggle.mjs docs/specs/smuggle.mjs
CODE_D7=0; ELIG >/dev/null 2>&1 || CODE_D7=$?
check "D7 rename smuggling refused" test "$CODE_D7" = "1"
G commit -qm renamed

# D8 (G6-002): dynamic binding — wrong-tree receipt rejected, right-tree accepted
SHA8=$(G rev-parse HEAD)
TREE8=$(G rev-parse "$SHA8^{tree}")
# checker is notes-first: inject a consolidated note {"quick-fix": {...}}
NOTE_BAD=$(python3 -c "import json;print(json.dumps({'quick-fix':{'receipt_type':'quick-fix','schema_version':1,'tree_hash':'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef','eligible':True,'reasons':[],'files':['docs/specs/smuggle.mjs'],'timestamp':'2026-06-07T00:00:00Z'}}))")
G notes --ref=svc-receipts add -f -m "$NOTE_BAD" "$SHA8"
( cd "$TMP/repo" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/check-chain-receipts.mjs" --sha "$SHA8" > "$TMP/d8.out" 2>&1 ) || true
check "D8 wrong-tree receipt rejected" grep -qi "tree mismatch" "$TMP/d8.out"
NOTE_OK=$(python3 -c "import json;print(json.dumps({'quick-fix':{'receipt_type':'quick-fix','schema_version':1,'tree_hash':'$TREE8','eligible':True,'reasons':[],'files':['docs/specs/smuggle.mjs'],'timestamp':'2026-06-07T00:00:00Z'}}))")
G notes --ref=svc-receipts add -f -m "$NOTE_OK" "$SHA8"
# WI-369 D2 upgrade: tree-binding alone was BLIND to this forged note on the
# rename-smuggle commit; the eligibility re-check now refuses it.
( cd "$TMP/repo" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/check-chain-receipts.mjs" --sha "$SHA8" > "$TMP/d8b.out" 2>&1 ) || true
check "D8b right-tree FORGED note on smuggle commit refused (D2 catches what binding missed)" grep -qi "eligibility mismatch" "$TMP/d8b.out"
# D8c: right-tree HONEST note on a genuinely exempt commit → accepted end-to-end
echo "clean docs" >> "$TMP/repo/docs/analysis/a.md"
G add -A; G commit -qm d8c
SHA8C=$(G rev-parse HEAD)
TREE8C=$(G rev-parse "$SHA8C^{tree}")
NOTE_8C=$(python3 -c "import json;print(json.dumps({'quick-fix':{'receipt_type':'quick-fix','schema_version':1,'tree_hash':'$TREE8C','eligible':True,'reasons':['exempt'],'files':['docs/analysis/a.md'],'timestamp':'2026-06-07T00:00:00Z'}}))")
G notes --ref=svc-receipts add -f -m "$NOTE_8C" "$SHA8C"
( cd "$TMP/repo" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/check-chain-receipts.mjs" --sha "$SHA8C" > "$TMP/d8c.out" 2>&1 ) || true
check "D8c honest exempt note accepted (binding + predicate both pass)" grep -q "\"ok\": true" "$TMP/d8c.out"

# D9 (WI-376): closeout-class batch — docs/specs + docs/plans + lane-tasks
# REWRITE + claim + review-receipt + jsonl APPEND → ELIGIBLE (per-file
# append-only scoping; the diff-global WI-360 shortcut would refuse this).
mkdir -p "$TMP/repo/docs/plans/x" "$TMP/repo/.svc/claims" "$TMP/repo/.svc/review-receipts"
echo "wi" > "$TMP/repo/docs/specs/work-items/WI-999.md"
printf '{"tasks":[{"id":1,"status":"in_progress"}]}\n' > "$TMP/repo/.svc/lane-tasks-WI-999.json"
G add -A; G commit -qm pre-closeout
echo "plan" > "$TMP/repo/docs/plans/x/manifest.md"
printf '{"tasks":[{"id":1,"status":"completed"}]}\n' > "$TMP/repo/.svc/lane-tasks-WI-999.json"
printf '{"wi":"WI-999"}\n' > "$TMP/repo/.svc/claims/WI-999.claim.json"
printf '{"pr":1,"result":"PASS"}\n' > "$TMP/repo/.svc/review-receipts/pr-1.json"
printf '{"ts":"t3"}\n' >> "$TMP/repo/.svc/pipeline-decisions.jsonl"
echo "closed" >> "$TMP/repo/docs/specs/work-items/WI-999.md"
G add -A
OUT_D9="$(ELIG)"; CODE_D9=$?
check "D9 task-graph closeout escalates under WI-481" test "$CODE_D9" = "1"
if printf '%s' "$OUT_D9" | grep -qi "impact tier.*high"; then
  echo "  ✓ D9 reason cites high impact tier"; PASS=$((PASS+1))
else
  echo "  ✗ D9 reason cites high impact tier"; FAIL=$((FAIL+1))
fi
G commit -qm closeout

# D10 (WI-376): jsonl OWN-hunk removal stays refused even beside state files
printf '{"tasks":[]}\n' > "$TMP/repo/.svc/lane-tasks-WI-999.json"
python3 - "$TMP/repo/.svc/pipeline-decisions.jsonl" <<'PY'
import sys
p=sys.argv[1]
lines=open(p).read().splitlines(True)
open(p,'w').writelines(lines[1:])
PY
G add -A
CODE_D10=0; ELIG >/dev/null 2>&1 || CODE_D10=$?
check "D10 jsonl own-hunk rewrite refused beside state files" test "$CODE_D10" = "1"
G commit -qm d10

# D11 (WI-376): .svc/concerns NOT exempt — proven via files cap (5 files)
mkdir -p "$TMP/repo/.svc/concerns"
echo "severity: CRITICAL" > "$TMP/repo/.svc/concerns/pii.md"
for i in 1 2 3 4; do echo "d$i" > "$TMP/repo/docs/analysis/d11-$i.md"; done
G add -A
OUT_D11="$(ELIG)"; CODE_D11=$?
check "D11 concerns dir refused (fell out of carve-out)" test "$CODE_D11" = "1"
G commit -qm d11

# D11b (WI-376 G6-001): a SINGLE small concerns/*.md edit must hit the DENYLIST
# (severity overrides are gate semantics — the small-markdown path is closed)
echo "severity: LOW" > "$TMP/repo/.svc/concerns/pii.md"
G add -A
OUT_D11b="$(ELIG)"; CODE_D11b=$?
check "D11b single concerns file refused" test "$CODE_D11b" = "1"
check "D11b reason cites denylist" bash -c "printf '%s' '$OUT_D11b' | grep -q 'denylist'"
G commit -qm d11b

# D12 (WI-376 G6-002): jsonl REWRITTEN as binary — numstat prints '-', which
# must fail closed (Infinity), never coerce to "0 removed" (append-only pass)
printf '\x00\x01\x02\x00\x00\x00\x00\x00' > "$TMP/repo/.svc/pipeline-decisions.jsonl"
G add -A
CODE_D12=0; ELIG >/dev/null 2>&1 || CODE_D12=$?
check "D12 binary jsonl rewrite refused (numstat dash fails closed)" test "$CODE_D12" = "1"
G commit -qm d12

# D13 (WI-369 D1): reference learnings ledgers append-only beside docs rewrites → ELIGIBLE
mkdir -p "$TMP/repo/references" "$TMP/repo/docs/learnings"
printf '{"k":"a"}\n' > "$TMP/repo/references/framework-learnings.jsonl"
printf '{"k":"b"}\n' > "$TMP/repo/docs/learnings/learnings.jsonl"
G add -A; G commit -qm seed-ledgers
printf '{"k":"a2"}\n' >> "$TMP/repo/references/framework-learnings.jsonl"
printf '{"k":"b2"}\n' >> "$TMP/repo/docs/learnings/learnings.jsonl"
python3 - "$TMP/repo/docs/analysis/a.md" <<'PY'
import sys
p=sys.argv[1]
open(p,'w').write("rewritten analysis line\n")
PY
G add -A
CODE_D13=0; ELIG >/dev/null 2>&1 || CODE_D13=$?
check "D13 reference-ledger appends beside docs rewrite eligible" test "$CODE_D13" = "0"
G commit -qm d13
# D13b: reference-ledger OWN rewrite → refused
python3 - "$TMP/repo/references/framework-learnings.jsonl" <<'PY'
import sys
lines=open(sys.argv[1]).read().splitlines(True)
open(sys.argv[1],'w').writelines(lines[1:])
PY
G add -A
CODE_D13b=0; ELIG >/dev/null 2>&1 || CODE_D13b=$?
check "D13b reference-ledger rewrite refused" test "$CODE_D13b" = "1"
G commit -qm d13b

# D14 (WI-369 D2): forged eligible:true note on a hot-path commit → checker refuses (eligibility mismatch)
echo "evil=1" > "$TMP/repo/hooks/forged.mjs"
G add -A; G commit -qm forged
SHA14=$(G rev-parse HEAD)
TREE14=$(G rev-parse "$SHA14^{tree}")
NOTE14=$(python3 -c "import json;print(json.dumps({'quick-fix':{'receipt_type':'quick-fix','schema_version':1,'tree_hash':'$TREE14','eligible':True,'reasons':['forged'],'files':['hooks/forged.mjs'],'timestamp':'2026-06-08T00:00:00Z'}}))")
G notes --ref=svc-receipts add -f -m "$NOTE14" "$SHA14"
( cd "$TMP/repo" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/check-chain-receipts.mjs" --sha "$SHA14" > "$TMP/d14.out" 2>&1 ) || true
check "D14 forged eligible note refused (eligibility mismatch)" grep -qi "eligibility mismatch" "$TMP/d14.out"

# D15 (WI-369 D2): sha-mode parity — exempt commit classifies eligible via --sha
echo "more docs" >> "$TMP/repo/docs/analysis/a.md"
G add -A; G commit -qm d15
SHA15=$(G rev-parse HEAD)
( cd "$TMP/repo" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/quick-fix-eligibility.mjs" --sha "$SHA15" >/dev/null 2>&1 ); CODE_D15=$?
check "D15 --sha mode classifies exempt commit eligible" test "$CODE_D15" = "0"

# D16 (WI-481 M5): once adopted, deleting the schema cannot grandfather the
# deleting commit out of the replayed impact floor.
mkdir -p "$TMP/repo/schemas"
printf '{}\n' > "$TMP/repo/schemas/change-impact-triad.schema.json"
G add -A; G commit -qm triad-adoption
G rm -q schemas/change-impact-triad.schema.json; G commit -qm delete-triad-schema
SHA16=$(G rev-parse HEAD)
OUT_D16="$(cd "$TMP/repo" && env -u GIT_DIR -u GIT_WORK_TREE -u GIT_INDEX_FILE node "$REPO_ROOT/scripts/quick-fix-eligibility.mjs" --sha "$SHA16" 2>/dev/null)"; CODE_D16=$?
check "D16 deleting adopted schema remains under triad replay" test "$CODE_D16" = "1"
check "D16 replay reason cites high impact tier" bash -c "printf '%s' '$OUT_D16' | grep -qi 'impact tier.*high'"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS carve-out checks passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
