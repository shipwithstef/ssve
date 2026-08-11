#!/usr/bin/env bash
# Tier 1: envelope-integrity holes (WI-396).
# Golden negatives for the two reproduced bypasses:
#   H1 — a code file under an exempt prefix must NOT be quick-fix eligible
#        (docs/specs/payload.js shipped arbitrary code with zero envelope).
#   H2 — full-envelope validation must reject a forged exec/review receipt:
#        a non-64-hex diff_hash (presence-only let empty/garbage pass), and a
#        tree_hash that does not match the commit tree (receipt mis-bound).
# All git mutations use `git -C` (WI-375 fixture-identity-leak isolation rule).
set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP" 2>/dev/null || true' EXIT
PASS=0; FAIL=0
pass(){ echo "  ✓ $1"; PASS=$((PASS+1)); }
fail(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
prepare_impact(){
  local d="$1" session="019f6001-5463-7dc0-a1f5-73104831606a" branch classified
  branch="$(git -C "$d" symbolic-ref --short HEAD)"
  mkdir -p "$d/.svc/bindings" "$d/.svc/claims" "$d/.svc/impact-triad/WI-900"
  printf '.svc/bindings/\n.svc/claims/\n.svc/impact-triad/\n' >> "$d/.git/info/exclude"
  printf '{"wi":"WI-900","status":"in_progress","tasks":[{"id":1,"skill":"quick-fix","metadata":{"skill":"quick-fix","wi":"WI-900"},"status":"in_progress","blocked_by":[],"skill_receipt":{"skill":"quick-fix","loaded_at":"2026-07-15T00:00:00Z","loaded_via":"test"}}]}\n' > "$d/.svc/lane-tasks-WI-900.json"
  printf '{"schema_version":1,"wi":"WI-900","generation":1,"repo_root":"%s","worktree_root":"%s","branch":"%s","session_id":"%s","role":"mutating","started_at":"2026-07-15T00:00:00Z","renewed_at":"2099-07-15T00:00:00Z","ttl_hours":24}\n' "$d" "$d" "$branch" "$session" > "$d/.svc/claims/WI-900.claim.json"
  printf '{"schema_version":1,"session_id":"%s","role":"mutating","wi":"WI-900","repo_root":"%s","worktree_root":"%s","branch":"%s","claim_path":"%s/.svc/claims/WI-900.claim.json","created_at":"2026-07-15T00:00:00Z","updated_at":"2026-07-15T00:00:00Z","generation":1}\n' "$session" "$d" "$d" "$branch" "$d" > "$d/.svc/bindings/test.json"
  classified="$(cd "$d" && node "$REPO_ROOT/scripts/classify-change-risk.mjs" --staged --json)"
  ( cd "$d" && CLASSIFIED="$classified" ROOT_PATH="$d" SESSION_ID="$session" node --input-type=module <<'NODE'
import fs from 'node:fs';
const c=JSON.parse(process.env.CLASSIFIED);
const artifact=c.paths[0];
const receipt={schema_version:1,wi:'WI-900',session_id:process.env.SESSION_ID,worktree_root:process.env.ROOT_PATH,task_graph:`${process.env.ROOT_PATH}/.svc/lane-tasks-WI-900.json`,task_id:1,diff_sha256:c.sha256,risk_tier:c.tier,risk_reasons:c.reasons,breaks_what:{answer:'fixture scope',sources:['docs/specs'],evidence:['staged diff']},intended_behavior:{answer:'preserve envelope eligibility contract',sources:['validate-envelope-integrity.sh'],evidence:['tier-1 fixture']},product_surface:{answer:'static documentation fixture',sources:['docs/specs'],evidence:['staged diff']},coverage_tasks:[{id:'coverage-1',status:'completed',owner:'WI-900 task 1',blocked_by:[],validation:'validate-envelope-integrity.sh'}],independent_review:{status:c.tier==='high'?'pass':'n/a',executor_family:'openai',reviewer_family:'anthropic',artifacts:c.tier==='high'?[artifact]:[]},runtime_proof:{status:'pass',kind:c.tier==='cosmetic'?'static':'mapped-test',artifacts:[artifact]},subsumed_by:[{phase:'P3-Verification',artifacts:[artifact]}],created_at:new Date().toISOString()};
fs.writeFileSync('.svc/impact-triad/WI-900/task-1.json',JSON.stringify(receipt,null,2));
NODE
  )
}
elig(){ prepare_impact "$1"; ( cd "$1" && SVC_SESSION_ID="019f6001-5463-7dc0-a1f5-73104831606a" node "$REPO_ROOT/scripts/quick-fix-eligibility.mjs" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('eligible'))" 2>/dev/null ); }
mkrepo(){ local d="$TMP/$1"; rm -rf "$d"; mkdir -p "$d/docs/specs"; git -C "$d" init -q; git -C "$d" config user.email t@t; git -C "$d" config user.name t; printf '%s' "$3" > "$d/docs/specs/$2"; git -C "$d" add -A; elig "$d"; }

echo "=== Tier 1: Envelope Integrity (WI-396) ==="

# --- H1: code under exempt prefix is NOT exempt; real docs still are ---
[ "$(mkrepo h1a payload.js 'export function x(){return process.env.S}')" = "False" ] && pass "code file under docs/specs/ is NOT quick-fix exempt" || fail "code file under docs/specs/ wrongly exempt"
[ "$(mkrepo h1b note.md '# note')" = "True" ] && pass "markdown doc under docs/specs/ stays exempt (no false positive)" || fail "markdown doc wrongly non-exempt"
[ "$(mkrepo h1c run.sh "$(seq 1 40 | sed 's/^/echo line /')")" = "False" ] && pass "large shell script under docs/specs/ is NOT exempt (size limit enforced)" || fail "large shell script wrongly exempt"

# --- H2: full-envelope rejects forged diff_hash / mis-bound tree ---
D="$TMP/h2"; mkdir -p "$D"; git -C "$D" init -q; git -C "$D" config user.email t@t; git -C "$D" config user.name t
echo a > "$D/a.txt"; git -C "$D" add -A; git -C "$D" commit -qm c >/dev/null 2>&1
SHA="$(git -C "$D" rev-parse HEAD)"; TREE="$(git -C "$D" rev-parse 'HEAD^{tree}')"; GOOD="$(printf x | sha256sum | cut -d' ' -f1)"
MIR="$D/.svc/receipts/${SHA:0:7}"; mkdir -p "$MIR"
python3 - "$MIR" "$GOOD" "$TREE" <<'PY'
import json,sys
mir,h,tree=sys.argv[1:4]
recs={"plan-manifest":{"scope":{},"dependencies":[],"decision_trace":"x","task_graph":"x","validation_plan":"x","risk_rollback":"x","changeset_blueprints":"x","execution_command_sequence":"x"},
"review-plan":{"self_review":{},"adversarial_review":{},"verdict":"approve"},
"exec-record":{"diff_hash":h,"files_touched":1,"dispatch_model":"x","tree_hash":tree},
"review-exec":{"diff_hash":h,"self_review":{},"adversarial_review":{},"verdict":"pass","tree_hash":tree},
"audit-implementation":{"verdict":"pass","findings":[]}}
for t,e in recs.items():
    e.update({"receipt_type":t,"schema_version":1,"wi":"WI-T","timestamp":"t"}); json.dump(e,open(f"{mir}/{t}.json","w"))
PY
chk(){ ( cd "$D" && node "$REPO_ROOT/scripts/check-chain-receipts.mjs" --sha "$SHA" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['results'][0]['ok'])" 2>/dev/null ); }
[ "$(chk)" = "True" ] && pass "well-formed full envelope (good diff_hash + matching tree) validates" || fail "well-formed envelope rejected"
python3 -c "import json;d=json.load(open('$MIR/review-exec.json'));d['diff_hash']='';json.dump(d,open('$MIR/review-exec.json','w'))"
[ "$(chk)" = "False" ] && pass "review-exec with empty diff_hash is REJECTED" || fail "forged empty diff_hash passed"
python3 -c "import json;d=json.load(open('$MIR/review-exec.json'));d['diff_hash']='$GOOD';d['tree_hash']='0'*40;json.dump(d,open('$MIR/review-exec.json','w'))"
[ "$(chk)" = "False" ] && pass "review-exec with mismatched tree_hash is REJECTED" || fail "mis-bound tree_hash passed"
# legacy schema_version-1 envelope (no tree_hash, placeholder diff_hash) is grandfathered
python3 - "$MIR" <<'PY'
import json,sys
mir=sys.argv[1]
for t in ["exec-record","review-exec"]:
    d=json.load(open(f"{mir}/{t}.json")); d['schema_version']=1; d.pop('tree_hash',None); d['diff_hash']='legacy-placeholder'; json.dump(d,open(f"{mir}/{t}.json","w"))
PY
[ "$(chk)" = "True" ] && pass "legacy schema_version-1 envelope (no tree_hash) is grandfathered" || fail "legacy v1 envelope wrongly rejected"
# omission bypass (codex G6 #1): schema_version 2 but tree_hash stripped + empty diff_hash → REJECT
python3 -c "import json;d=json.load(open('$MIR/review-exec.json'));d['schema_version']=2;d.pop('tree_hash',None);d['diff_hash']='';json.dump(d,open('$MIR/review-exec.json','w'))"
[ "$(chk)" = "False" ] && pass "v2 receipt with tree_hash OMITTED is REJECTED (omission bypass blocked)" || fail "omission bypass: v2 without tree_hash passed"

echo "envelope integrity: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
