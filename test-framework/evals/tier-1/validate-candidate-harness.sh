#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HARNESS="$ROOT/scripts/candidate-harness.mjs"
SEED="$ROOT/docs/specs/candidates/consumer-experience-pool.json"
GROUP="${CANDIDATE_TEST_GROUP:-all}"
case "$GROUP" in
  all|core|rank|triage) ;;
  *) echo "FAIL: unknown CANDIDATE_TEST_GROUP: $GROUP" >&2; exit 2 ;;
esac
TEST_ROOT="$(mktemp -d)"
REAL_STORE="${SVC_STATE_DIR:-$HOME/.svc}/store.db"

fingerprint() {
  if [[ -f "$1" ]]; then sha256sum "$1" | awk '{print $1}'; else printf 'MISSING\n'; fi
}

REAL_STORE_BEFORE="$(fingerprint "$REAL_STORE")"
cleanup() {
  rm -rf "$TEST_ROOT"
  [[ "$(fingerprint "$REAL_STORE")" == "$REAL_STORE_BEFORE" ]] || {
    echo "FAIL: validator changed operator store $REAL_STORE" >&2
    exit 1
  }
}
trap cleanup EXIT

fail() { echo "FAIL: $*" >&2; exit 1; }
pass() { echo "  PASS: $*"; }
expect_fail() { if "$@" >/dev/null 2>&1; then fail "command unexpectedly passed: $*"; fi; }

[[ -f "$HARNESS" ]] || fail "candidate-harness.mjs is missing"
[[ -f "$SEED" ]] || fail "seed mirror is missing"
command -v rg >/dev/null 2>&1 || fail "ripgrep (rg) is required by this validator"

node - <<'NODE' "$SEED"
const fs = require('fs');
const pool = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (!pool || !Array.isArray(pool.candidates)) throw new Error('expected candidates array');
if (pool.project_id !== null) throw new Error('shipped seed must remain project-neutral');
const ids = pool.candidates.map(x => x.id);
const want = Array.from({length: 50}, (_, i) => `CAND-${String(i + 1).padStart(3, '0')}`);
if (ids.length !== 50 || new Set(ids).size !== 50 || JSON.stringify([...ids].sort()) !== JSON.stringify(want)) throw new Error('seed IDs must be exactly CAND-001..050');
for (const c of pool.candidates) {
  if (!c.work_type || !c.code_grounding || !Array.isArray(c.cos_roles) || !c.cos_roles.length || !c.scores) throw new Error(`${c.id}: missing work_type, code_grounding, cos_roles, or scores`);
}
NODE
pass "seed schema and CAND-001..050 sequence"

make_repo() {
  local dir="$1" app_id="$2"
  mkdir -p "$dir/.svc" "$dir/docs/specs/candidates"
  git -C "$dir" init -q
  git -C "$dir" config user.email test@example.invalid
  git -C "$dir" config user.name "Candidate Test"
  printf '# Fixture\n' > "$dir/README.md"
  cp "$SEED" "$dir/docs/specs/candidates/pool.json"
  if [[ -n "$app_id" ]]; then printf '{"app_id":"%s"}\n' "$app_id" > "$dir/.svc/company-link.json"; fi
}

REPO_A="$TEST_ROOT/repo-a"
make_repo "$REPO_A" "fixture-project-a"
export SVC_CANDIDATE_DB="$TEST_ROOT/state/store.db"
export SVC_CANDIDATE_DECISIONS="$TEST_ROOT/state/decisions.jsonl"

run_a() { (cd "$REPO_A" && node "$HARNESS" "$@"); }

if [[ "$GROUP" == all || "$GROUP" == core ]]; then
  node --check "$HARNESS"
  run_a --help | rg -q '^usage: --file'
  expect_fail run_a --file docs/specs/candidates/pool.json --top 0
  expect_fail run_a --file docs/specs/candidates/pool.json --top -1
  expect_fail run_a --file docs/specs/candidates/pool.json --top 1.5
  expect_fail run_a --file docs/specs/candidates/pool.json --top many
  expect_fail run_a --rank
  run_a --file docs/specs/candidates/pool.json --top 1 > "$TEST_ROOT/core.out"
  run_a --file docs/specs/candidates/pool.json --top 999 > "$TEST_ROOT/top-overflow.out"
  [[ "$(wc -l < "$TEST_ROOT/top-overflow.out")" -eq 50 ]] || fail "top N did not clamp to candidate count"
  node - <<'NODE' "$SVC_CANDIDATE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);
const row=db.prepare('SELECT project_id, COUNT(*) AS n FROM candidates GROUP BY project_id').get();
if(row.project_id!=='fixture-project-a'||row.n!==50)throw Error(JSON.stringify(row));
const required={candidate_schema:['component','version','migrated_at'],candidates:['project_id','item_scope','candidate_id','title','summary','work_type','target_files_json','code_grounding_json','cos_roles_json','product_impact','growth_flywheel','db_overhead','security_risk','status','promoted_wi','rejection_reason','source_mirror','imported_at','updated_at'],candidate_decision_outbox:['event_id','project_id','item_scope','candidate_id','action','payload_json','created_at','logged_at']};
for(const [table,columns] of Object.entries(required)){const got=new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(x=>x.name));for(const column of columns)if(!got.has(column))throw Error(`${table} missing ${column}`)}
const candidateColumns=Object.fromEntries(db.prepare('PRAGMA table_info(candidates)').all().map(x=>[x.name,x]));if(candidateColumns.project_id.notnull!==1||candidateColumns.project_id.pk!==1||candidateColumns.item_scope.pk!==2||candidateColumns.candidate_id.pk!==3)throw Error('candidate key shape missing');
const candidateSql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='candidates'").get().sql;
if(!candidateSql.includes("status='candidate'")||!candidateSql.includes('product_impact BETWEEN 0 AND 100'))throw Error('candidate checks missing');
const outboxSql=db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='candidate_decision_outbox'").get().sql;
if(!outboxSql.includes("action IN ('promote','reject')")||db.prepare('PRAGMA foreign_key_list(candidate_decision_outbox)').all().length!==3)throw Error('outbox constraints missing');
db.close();
NODE
  REPO_DEFAULT_STATE="$TEST_ROOT/repo-default-state"
  make_repo "$REPO_DEFAULT_STATE" "default-state-project"
  env -u SVC_CANDIDATE_DB -u SVC_CANDIDATE_DECISIONS SVC_STATE_DIR="$TEST_ROOT/default-state" \
    bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1 >/dev/null' _ "$REPO_DEFAULT_STATE" "$HARNESS"
  node - <<'NODE' "$TEST_ROOT/default-state" "$TEST_ROOT/default-state/store.db"
const fs=require('fs');const [dir,file]=process.argv.slice(2);if(!fs.statSync(file).isFile())throw Error('default store missing');if(process.platform!=='win32'){const mode=p=>fs.statSync(p).mode&0o777;if(mode(dir)!==0o700||mode(file)!==0o600)throw Error(`default modes ${mode(dir).toString(8)}/${mode(file).toString(8)}`)}
NODE
  FUTURE_DB="$TEST_ROOT/state/future.db"
  node - <<'NODE' "$FUTURE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);db.exec("CREATE TABLE candidate_schema(component TEXT PRIMARY KEY,version INTEGER NOT NULL); INSERT INTO candidate_schema VALUES('candidate-reservoir',99)");db.close();
NODE
  V0_DB="$TEST_ROOT/state/v0.db"
  node - <<'NODE' "$V0_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);db.exec("CREATE TABLE candidate_schema(component TEXT PRIMARY KEY,version INTEGER NOT NULL,migrated_at TEXT NOT NULL); INSERT INTO candidate_schema VALUES('candidate-reservoir',0,'old')");db.close();
NODE
  expect_fail env SVC_CANDIDATE_DB="$V0_DB" bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1' _ "$REPO_A" "$HARNESS"
  node - <<'NODE' "$V0_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);const v=db.prepare("SELECT version FROM candidate_schema WHERE component='candidate-reservoir'").get().version;const t=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='candidates'").get();if(v!==0||t)throw Error(`undefined migration changed schema: ${v}/${JSON.stringify(t)}`);db.close();
NODE
  UNREGISTERED_DB="$TEST_ROOT/state/unregistered.db"
  SVC_CANDIDATE_DB="$UNREGISTERED_DB" run_a --file docs/specs/candidates/pool.json --top 1 >/dev/null
  node - <<'NODE' "$UNREGISTERED_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);db.prepare("DELETE FROM candidate_schema WHERE component='candidate-reservoir'").run();db.close();
NODE
  expect_fail env SVC_CANDIDATE_DB="$UNREGISTERED_DB" bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1' _ "$REPO_A" "$HARNESS"
  node - <<'NODE' "$UNREGISTERED_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);const schema=db.prepare("SELECT version FROM candidate_schema WHERE component='candidate-reservoir'").get();if(schema)throw Error(`unregistered schema was stamped: ${JSON.stringify(schema)}`);db.close();
NODE
  if (SVC_CANDIDATE_DB="$FUTURE_DB" run_a --file docs/specs/candidates/pool.json --top 1 >/dev/null 2>&1); then fail "newer schema unexpectedly accepted"; fi
  node - <<'NODE' "$FUTURE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);const v=db.prepare("SELECT version FROM candidate_schema WHERE component='candidate-reservoir'").get().version;const t=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='candidates'").get();if(v!==99||t)throw Error(`non-atomic schema refusal: ${v}/${JSON.stringify(t)}`);db.close();
NODE
  if rg -ni '/home/|/Users/|[A-Z]:\\\\|Supabase|postgres(?:ql)?://|app-workspaces|example-company|s7an-it' "$HARNESS" "$SEED"; then fail "source or seed contains a proprietary or customer-database literal"; fi
  REPO_ORIGIN="$TEST_ROOT/repo-origin"
  make_repo "$REPO_ORIGIN" ""
  git -C "$REPO_ORIGIN" remote add origin 'https://user:secret@example.com/Org/Portable.git?token=hidden'
  (cd "$REPO_ORIGIN" && node "$HARNESS" --file docs/specs/candidates/pool.json --top 1 >/dev/null)
  REPO_PORT_ORIGIN="$TEST_ROOT/repo-port-origin"
  make_repo "$REPO_PORT_ORIGIN" ""
  git -C "$REPO_PORT_ORIGIN" remote add origin 'https://example.com:8443/Org/Portable.git'
  (cd "$REPO_PORT_ORIGIN" && node "$HARNESS" --file docs/specs/candidates/pool.json --top 1 >/dev/null)
  REPO_SCP_ORIGIN="$TEST_ROOT/repo-scp-origin"
  make_repo "$REPO_SCP_ORIGIN" ""
  git -C "$REPO_SCP_ORIGIN" remote add origin 'git@EXAMPLE.com:Org/Portable-SCP.git?token=secret#fragment'
  (cd "$REPO_SCP_ORIGIN" && node "$HARNESS" --file docs/specs/candidates/pool.json --top 1 >/dev/null)
  REPO_BASENAME="$TEST_ROOT/repo-basename"
  make_repo "$REPO_BASENAME" ""
  (cd "$REPO_BASENAME" && node "$HARNESS" --file docs/specs/candidates/pool.json --top 1 >/dev/null)
  REPO_LOCAL_ORIGIN="$TEST_ROOT/repo-local-origin"
  make_repo "$REPO_LOCAL_ORIGIN" ""
  git -C "$REPO_LOCAL_ORIGIN" remote add origin "$TEST_ROOT/private-origin.git"
  (cd "$REPO_LOCAL_ORIGIN" && node "$HARNESS" --file docs/specs/candidates/pool.json --top 1 >/dev/null)
  for invalid_root in null '[]' '"text"' '{"app_id":42}' '{"app_id":""}' '{"app_id":"   "}' '{'; do
    REPO_BAD_CONFIG="$TEST_ROOT/repo-bad-config-$(printf '%s' "$invalid_root" | sha256sum | cut -c1-8)"
    make_repo "$REPO_BAD_CONFIG" ""
    printf '%s\n' "$invalid_root" > "$REPO_BAD_CONFIG/.svc/company-link.json"
    if (cd "$REPO_BAD_CONFIG" && node "$HARNESS" --file docs/specs/candidates/pool.json --top 1 >"$TEST_ROOT/bad-config.out" 2>"$TEST_ROOT/bad-config.err"); then fail "non-object company-link unexpectedly accepted"; fi
    rg -q '\.svc/company-link\.json' "$TEST_ROOT/bad-config.err" || fail "company-link shape error was not actionable"
  done
  REPO_SYMLINK_CONFIG="$TEST_ROOT/repo-symlink-config"
  make_repo "$REPO_SYMLINK_CONFIG" ""
  rmdir "$REPO_SYMLINK_CONFIG/.svc"
  mkdir "$TEST_ROOT/external-config"
  printf '{"app_id":"outside-project"}\n' > "$TEST_ROOT/external-config/company-link.json"
  ln -s "$TEST_ROOT/external-config" "$REPO_SYMLINK_CONFIG/.svc"
  expect_fail env SVC_CANDIDATE_DB="$TEST_ROOT/symlink-config.db" SVC_CANDIDATE_DECISIONS="$TEST_ROOT/symlink-config.jsonl" \
    bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1' _ "$REPO_SYMLINK_CONFIG" "$HARNESS"
  node - <<'NODE' "$SVC_CANDIDATE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);
const ids=db.prepare('SELECT DISTINCT project_id FROM candidates ORDER BY project_id').all().map(x=>x.project_id);
if(!ids.includes('example.com/Org/Portable')||!ids.includes('example.com:8443/Org/Portable')||!ids.includes('example.com/Org/Portable-SCP')||!ids.includes('repo-basename')||!ids.includes('repo-local-origin'))throw Error(JSON.stringify(ids));
if(ids.some(x=>/secret|token|user@/.test(x)))throw Error(`credential leak: ${JSON.stringify(ids)}`);db.close();
NODE
  pass "core CLI, config identity, SQLite scope, and portability"
fi

if [[ "$GROUP" == all || "$GROUP" == rank ]]; then
  node - <<'NODE' "$REPO_A/docs/specs/candidates/pool.json"
const fs=require('fs');const file=process.argv[2];const pool=JSON.parse(fs.readFileSync(file));const candidate=pool.candidates.find(x=>x.id==='CAND-011');candidate.composite_score=999;candidate.code_grounding={valid_count:999,total_count:999,ratio:'999/999',invalid_targets:[]};fs.writeFileSync(file,JSON.stringify(pool,null,2)+'\n');
NODE
  run_a --file docs/specs/candidates/pool.json --top 10 > "$TEST_ROOT/top10.out"
  sed 's/	/|/g' > "$TEST_ROOT/top10.normalized" < "$TEST_ROOT/top10.out"
  diff -u <(printf '%s\n' \
    '1|CAND-001|composite=74.25|grounding=1/1|product_impact=95.00|code_grounding=100.00|growth_flywheel=90.00|db_overhead=10.00|security_risk=10.00|work_type=feature|cos_roles=product,growth|status=candidate|invalid_targets=-' \
    '2|CAND-002|composite=74.25|grounding=1/1|product_impact=95.00|code_grounding=100.00|growth_flywheel=90.00|db_overhead=10.00|security_risk=10.00|work_type=feature|cos_roles=product,growth|status=candidate|invalid_targets=-' \
    '3|CAND-003|composite=73.30|grounding=1/1|product_impact=94.00|code_grounding=100.00|growth_flywheel=88.00|db_overhead=12.00|security_risk=10.00|work_type=feature|cos_roles=product,growth,engineering|status=candidate|invalid_targets=-' \
    '4|CAND-004|composite=73.20|grounding=1/1|product_impact=92.00|code_grounding=100.00|growth_flywheel=90.00|db_overhead=10.00|security_risk=10.00|work_type=feature|cos_roles=product,growth|status=candidate|invalid_targets=-' \
    '5|CAND-005|composite=72.90|grounding=1/1|product_impact=90.00|code_grounding=100.00|growth_flywheel=92.00|db_overhead=10.00|security_risk=10.00|work_type=feature|cos_roles=product,growth,security|status=candidate|invalid_targets=-' \
    '6|CAND-006|composite=72.45|grounding=1/1|product_impact=91.00|code_grounding=100.00|growth_flywheel=88.00|db_overhead=12.00|security_risk=8.00|work_type=feature|cos_roles=product,growth|status=candidate|invalid_targets=-' \
    '7|CAND-008|composite=72.40|grounding=1/1|product_impact=88.00|code_grounding=100.00|growth_flywheel=92.00|db_overhead=10.00|security_risk=8.00|work_type=feature|cos_roles=growth,product|status=candidate|invalid_targets=-' \
    '8|CAND-007|composite=72.35|grounding=1/1|product_impact=89.00|code_grounding=100.00|growth_flywheel=90.00|db_overhead=8.00|security_risk=10.00|work_type=feature|cos_roles=product,growth,security|status=candidate|invalid_targets=-' \
    '9|CAND-010|composite=71.45|grounding=1/1|product_impact=87.00|code_grounding=100.00|growth_flywheel=90.00|db_overhead=10.00|security_risk=10.00|work_type=feature|cos_roles=product,growth|status=candidate|invalid_targets=-' \
    '10|CAND-009|composite=71.30|grounding=1/1|product_impact=90.00|code_grounding=100.00|growth_flywheel=85.00|db_overhead=12.00|security_risk=10.00|work_type=feature|cos_roles=product,engineering|status=candidate|invalid_targets=-') "$TEST_ROOT/top10.normalized"
  run_a --file docs/specs/candidates/pool.json --rank > "$TEST_ROOT/rank1.out"
  MIRROR_RANK_HASH="$(sha256sum "$REPO_A/docs/specs/candidates/pool.json" | awk '{print $1}')"
  run_a --file docs/specs/candidates/pool.json --rank > "$TEST_ROOT/rank2.out"
  [[ "$(wc -l < "$TEST_ROOT/rank1.out")" -eq 50 ]] || fail "rank did not emit 50 rows"
  cmp "$TEST_ROOT/rank1.out" "$TEST_ROOT/rank2.out"
  [[ "$(sha256sum "$REPO_A/docs/specs/candidates/pool.json" | awk '{print $1}')" == "$MIRROR_RANK_HASH" ]] || fail "unchanged rank was not mirror-byte-idempotent"
  rg -q $'CAND-011\t.*grounding=0/1.*invalid_targets=src/candidates/CAND-011.mjs' "$TEST_ROOT/rank1.out" || fail "missing grounding diagnostic"
  node - <<'NODE' "$REPO_A/docs/specs/candidates/precision.json"
const fs=require('fs');const base={title:'Precision order',summary:'Unrounded ordering proof',work_type:'test',item_scope:'precision',target_files:['README.md'],code_grounding:{},cos_roles:['product'],scores:{product_impact:50,growth_flywheel:50,db_overhead:50,security_risk:50},status:'candidate'};fs.writeFileSync(process.argv[2],JSON.stringify({schema_version:'1.0.0',topic:'precision',project_id:null,item_scope:'precision',candidates:[{...base,id:'CAND-951'},{...base,id:'CAND-952',scores:{...base.scores,product_impact:50.001}}]},null,2)+'\n');
NODE
  run_a --file docs/specs/candidates/precision.json --rank > "$TEST_ROOT/precision.out"
  [[ "$(sed -n '1s/.*\(CAND-[0-9]*\).*/\1/p' "$TEST_ROOT/precision.out")" == "CAND-952" ]] || fail "ranking used rounded display score instead of full precision"
  [[ "$(cut -f3 "$TEST_ROOT/precision.out" | sort -u)" == "composite=42.50" ]] || fail "precision fixture did not exercise equal displayed scores"
  printf 'outside\n' > "$TEST_ROOT/outside.txt"
  mkdir "$REPO_A/existing-directory"
  printf 'nested\n' > "$REPO_A/existing-directory/nested.txt"
  ln -s "$REPO_A/README.md" "$REPO_A/internal-link"
  ln -s "$TEST_ROOT/outside.txt" "$REPO_A/external-link"
  ln -s "$REPO_A/missing-target" "$REPO_A/broken-link"
  node - <<'NODE' "$REPO_A/docs/specs/candidates/hostile.json" "$TEST_ROOT/outside.txt"
const fs=require('fs');const out=process.argv[2];const external=process.argv[3];
const base={title:'Hostile path fixture',summary:'Containment proof',work_type:'test',item_scope:'hostile',code_grounding:{target_files_declared:7},cos_roles:['security'],scores:{product_impact:50,growth_flywheel:50,db_overhead:50,security_risk:50},status:'candidate'};
fs.writeFileSync(out,JSON.stringify({schema_version:'1.0.0',topic:'hostile',project_id:null,item_scope:'hostile',candidates:[{...base,id:'CAND-901',target_files:['README.md','existing-directory','internal-link','../outside.txt','external-link','broken-link',external]},{...base,id:'CAND-902',target_files:[],code_grounding:{target_files_declared:0}}]},null,2)+'\n');
NODE
  README_BEFORE="$(sha256sum "$REPO_A/README.md" | awk '{print $1}')"
  NESTED_BEFORE="$(sha256sum "$REPO_A/existing-directory/nested.txt" | awk '{print $1}')"
  run_a --file docs/specs/candidates/hostile.json --rank > "$TEST_ROOT/hostile.out"
  [[ "$(sha256sum "$REPO_A/README.md" | awk '{print $1}')" == "$README_BEFORE" ]] || fail "grounding changed target bytes"
  [[ "$(sha256sum "$REPO_A/existing-directory/nested.txt" | awk '{print $1}')" == "$NESTED_BEFORE" ]] || fail "grounding changed directory target contents"
  ABSOLUTE_TARGET="$(printf '%s' "$TEST_ROOT/outside.txt" | sed 's/[][\\.^$*+?{}|()]/\\&/g')"
  rg -q "CAND-901.*grounding=3/7.*code_grounding=42.86.*invalid_targets=../outside.txt,external-link,broken-link,${ABSOLUTE_TARGET}" "$TEST_ROOT/hostile.out" || fail "hostile target containment result missing"
  rg -q $'CAND-902\t.*grounding=0/0.*code_grounding=0.00' "$TEST_ROOT/hostile.out" || fail "empty grounding result missing"
  LEDGER_LINES_BEFORE=0
  if [[ -f "$SVC_CANDIDATE_DECISIONS" ]]; then LEDGER_LINES_BEFORE="$(wc -l < "$SVC_CANDIDATE_DECISIONS")"; fi
  CANDIDATE_ROWS_BEFORE="$(node -e 'const {DatabaseSync}=require("node:sqlite"),d=new DatabaseSync(process.argv[1]);process.stdout.write(String(d.prepare("SELECT COUNT(*) n FROM candidates").get().n));d.close()' "$SVC_CANDIDATE_DB")"
  node - <<'NODE' "$REPO_A/docs/specs/candidates/invalid.json"
const fs=require('fs');const c={id:'CAND-999',title:'Duplicate',summary:'invalid',work_type:'test',item_scope:'invalid',target_files:[],code_grounding:{},cos_roles:['product'],scores:{product_impact:50,growth_flywheel:50,db_overhead:50,security_risk:50},status:'candidate'};fs.writeFileSync(process.argv[2],JSON.stringify({schema_version:'1.0.0',topic:'invalid',item_scope:'invalid',candidates:[c,c]})+'\n');
NODE
  expect_fail run_a --file docs/specs/candidates/invalid.json --rank
  printf '{' > "$REPO_A/docs/specs/candidates/malformed.json"
  expect_fail run_a --file docs/specs/candidates/malformed.json --rank
  node - <<'NODE' "$REPO_A/docs/specs/candidates/control.json"
const fs=require('fs');const c={id:'CAND-998',title:'Control',summary:'invalid output injection',work_type:'test',item_scope:'invalid',target_files:[],code_grounding:{},cos_roles:['product\nforged-row'],scores:{product_impact:50,growth_flywheel:50,db_overhead:50,security_risk:50},status:'candidate'};fs.writeFileSync(process.argv[2],JSON.stringify({schema_version:'1.0.0',topic:'invalid',item_scope:'invalid',candidates:[c]})+'\n');
NODE
  expect_fail run_a --file docs/specs/candidates/control.json --rank
  node - <<'NODE' "$REPO_A/docs/specs/candidates/missing-field.json" "$REPO_A/docs/specs/candidates/out-of-range.json" "$REPO_A/docs/specs/candidates/inconsistent-terminal.json" "$REPO_A/docs/specs/candidates/non-finite.json" "$REPO_A/docs/specs/candidates/below-range.json" "$REPO_A/docs/specs/candidates/non-number.json" "$REPO_A/docs/specs/candidates/boundaries.json"
const fs=require('fs');const base={id:'CAND-997',title:'Validation',summary:'matrix',work_type:'test',item_scope:'invalid',target_files:[],code_grounding:{},cos_roles:['product'],scores:{product_impact:50,growth_flywheel:50,db_overhead:50,security_risk:50},status:'candidate'};const wrap=c=>({schema_version:'1.0.0',topic:'invalid',project_id:null,item_scope:'invalid',candidates:[c]});const missing={...base};delete missing.title;fs.writeFileSync(process.argv[2],JSON.stringify(wrap(missing)));fs.writeFileSync(process.argv[3],JSON.stringify(wrap({...base,scores:{...base.scores,security_risk:101}})));fs.writeFileSync(process.argv[4],JSON.stringify(wrap({...base,status:'candidate',promoted_wi:'WI-BYPASS'})));fs.writeFileSync(process.argv[5],JSON.stringify(wrap(base)).replace('"security_risk":50','"security_risk":1e400'));
fs.writeFileSync(process.argv[6],JSON.stringify(wrap({...base,scores:{...base.scores,db_overhead:-0.01}})));
fs.writeFileSync(process.argv[7],JSON.stringify(wrap({...base,scores:{...base.scores,product_impact:'50'}})));
fs.writeFileSync(process.argv[8],JSON.stringify(wrap({...base,id:'CAND-995',scores:{product_impact:0,growth_flywheel:100,db_overhead:0,security_risk:100}})));
NODE
  expect_fail run_a --file docs/specs/candidates/missing-field.json --rank
  expect_fail run_a --file docs/specs/candidates/out-of-range.json --rank
  expect_fail run_a --file docs/specs/candidates/inconsistent-terminal.json --rank
  expect_fail run_a --file docs/specs/candidates/non-finite.json --rank
  expect_fail run_a --file docs/specs/candidates/below-range.json --rank
  expect_fail run_a --file docs/specs/candidates/non-number.json --rank
  run_a --file docs/specs/candidates/boundaries.json --rank > "$TEST_ROOT/boundaries.out"
  rg -q $'CAND-995\t.*product_impact=0.00.*growth_flywheel=100.00.*db_overhead=0.00.*security_risk=100.00' "$TEST_ROOT/boundaries.out" || fail "inclusive score boundaries were not accepted"
  CANDIDATE_ROWS_BEFORE="$(node -e 'const {DatabaseSync}=require("node:sqlite"),d=new DatabaseSync(process.argv[1]);process.stdout.write(String(d.prepare("SELECT COUNT(*) n FROM candidates").get().n));d.close()' "$SVC_CANDIDATE_DB")"
  cp "$REPO_A/docs/specs/candidates/pool.json" "$TEST_ROOT/pool-before-rescope.json"
  node - <<'NODE' "$REPO_A/docs/specs/candidates/pool.json"
const fs=require('fs');const file=process.argv[2];const pool=JSON.parse(fs.readFileSync(file));pool.item_scope='renamed-scope';for(const candidate of pool.candidates)candidate.item_scope=pool.item_scope;fs.writeFileSync(file,JSON.stringify(pool,null,2)+'\n');
NODE
  RESCOPED_HASH="$(sha256sum "$REPO_A/docs/specs/candidates/pool.json" | awk '{print $1}')"
  expect_fail run_a --file docs/specs/candidates/pool.json --rank
  [[ "$(sha256sum "$REPO_A/docs/specs/candidates/pool.json" | awk '{print $1}')" == "$RESCOPED_HASH" ]] || fail "refused mirror re-scope changed mirror bytes"
  [[ "$(node -e 'const {DatabaseSync}=require("node:sqlite"),d=new DatabaseSync(process.argv[1]);process.stdout.write(String(d.prepare("SELECT COUNT(*) n FROM candidates").get().n));d.close()' "$SVC_CANDIDATE_DB")" == "$CANDIDATE_ROWS_BEFORE" ]] || fail "refused mirror re-scope changed database rows"
  cp "$TEST_ROOT/pool-before-rescope.json" "$REPO_A/docs/specs/candidates/pool.json"
  node - <<'NODE' "$REPO_A/docs/specs/candidates/path-whitespace.json"
const fs=require('fs');const candidate={id:'CAND-996',title:'Path whitespace',summary:'invalid',work_type:'test',item_scope:'invalid',target_files:[' README.md'],code_grounding:{},cos_roles:['security'],scores:{product_impact:50,growth_flywheel:50,db_overhead:50,security_risk:50},status:'candidate'};fs.writeFileSync(process.argv[2],JSON.stringify({schema_version:'1.0.0',topic:'invalid',project_id:null,item_scope:'invalid',candidates:[candidate]})+'\n');
NODE
  expect_fail run_a --file docs/specs/candidates/path-whitespace.json --rank
  LEDGER_LINES_AFTER=0
  if [[ -f "$SVC_CANDIDATE_DECISIONS" ]]; then LEDGER_LINES_AFTER="$(wc -l < "$SVC_CANDIDATE_DECISIONS")"; fi
  [[ "$LEDGER_LINES_AFTER" == "$LEDGER_LINES_BEFORE" ]] || fail "invalid import changed decision ledger"
  [[ "$(node -e 'const {DatabaseSync}=require("node:sqlite"),d=new DatabaseSync(process.argv[1]);process.stdout.write(String(d.prepare("SELECT COUNT(*) n FROM candidates").get().n));d.close()' "$SVC_CANDIDATE_DB")" == "$CANDIDATE_ROWS_BEFORE" ]] || fail "invalid import changed database rows"
  pass "exact formula, total order, ratios, diagnostics, and idempotent ranking"
fi

if [[ "$GROUP" == all || "$GROUP" == triage ]]; then
  run_a --file docs/specs/candidates/pool.json --top 1 >/dev/null
  TRIAGE_README_HASH="$(sha256sum "$REPO_A/README.md" | awk '{print $1}')"
  expect_fail run_a --promote CAND-001 --wi invalid-wi
  expect_fail run_a --reject CAND-001 --reason '   '
  expect_fail run_a --promote CAND-DOES-NOT-EXIST --wi WI-MISSING
  node - <<'NODE' "$REPO_A/docs/specs/candidates/pool.json"
const fs=require('fs');const file=process.argv[2];const pool=JSON.parse(fs.readFileSync(file));const candidate=pool.candidates.find(x=>x.id==='CAND-002');candidate.status='promoted';candidate.promoted_wi='WI-BYPASS';fs.writeFileSync(file,JSON.stringify(pool,null,2)+'\n');
NODE
  run_a --file docs/specs/candidates/pool.json --top 1 >/dev/null
  node - <<'NODE' "$SVC_CANDIDATE_DB" "$REPO_A/docs/specs/candidates/pool.json"
const {DatabaseSync}=require('node:sqlite');const fs=require('fs');const db=new DatabaseSync(process.argv[2]);const row=db.prepare("SELECT status,promoted_wi FROM candidates WHERE project_id='fixture-project-a' AND item_scope='consumer-experience' AND candidate_id='CAND-002'").get();db.close();const mirror=JSON.parse(fs.readFileSync(process.argv[3]));const projected=mirror.candidates.find(x=>x.id==='CAND-002');if(row.status!=='candidate'||row.promoted_wi!==null||projected.status!=='candidate'||projected.promoted_wi!=null)throw Error(`mirror bypass: ${JSON.stringify({row,projected})}`);
NODE
  run_a --promote CAND-001 --wi WI-TEST-1 >/dev/null
  run_a --promote CAND-001 --wi WI-TEST-1 >/dev/null
  [[ "$(wc -l < "$SVC_CANDIDATE_DECISIONS")" -eq 1 ]] || fail "promotion retry duplicated ledger event"
  expect_fail run_a --reject CAND-001 --reason conflict
  run_a --reject CAND-003 --reason "lower confidence" >/dev/null
  [[ "$(wc -l < "$SVC_CANDIDATE_DECISIONS")" -eq 2 ]] || fail "rejection event missing"
  node - <<'NODE' "$REPO_A/docs/specs/candidates/pool.json" "$SVC_CANDIDATE_DECISIONS"
const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[2]));const byId=Object.fromEntries(p.candidates.map(x=>[x.id,x]));
if(byId['CAND-001'].status!=='promoted'||byId['CAND-001'].promoted_wi!=='WI-TEST-1')throw Error('promotion mirror');
if(byId['CAND-003'].status!=='rejected'||byId['CAND-003'].rejection_reason!=='lower confidence')throw Error('rejection mirror');
const events=fs.readFileSync(process.argv[3],'utf8').trim().split('\n').map(JSON.parse);for(const e of events)for(const k of ['timestamp','event_id','project_id','item_scope','candidate_id','action','status'])if(!e[k])throw Error(`missing ${k}`);
const promoted=events.find(e=>e.candidate_id==='CAND-001');if(!promoted||promoted.action!=='promote'||promoted.status!=='promoted'||promoted.promoted_wi!=='WI-TEST-1'||promoted.reason!==null)throw Error(`promotion event mismatch: ${JSON.stringify(promoted)}`);
const rejected=events.find(e=>e.candidate_id==='CAND-003');if(!rejected||rejected.action!=='reject'||rejected.status!=='rejected'||rejected.reason!=='lower confidence'||rejected.promoted_wi!==null)throw Error(`rejection event mismatch: ${JSON.stringify(rejected)}`);
NODE
  ORIGINAL_LEDGER="$SVC_CANDIDATE_DECISIONS"
  LEDGER_BEFORE_FORCED_FAILURE="$(wc -l < "$ORIGINAL_LEDGER")"
  mkdir "$TEST_ROOT/unwritable-ledger"
  if (SVC_CANDIDATE_DECISIONS="$TEST_ROOT/unwritable-ledger" run_a --reject CAND-005 --reason "projection recovery" >/dev/null 2>&1); then fail "directory ledger unexpectedly accepted"; fi
  [[ "$(wc -l < "$ORIGINAL_LEDGER")" == "$LEDGER_BEFORE_FORCED_FAILURE" ]] || fail "failed ledger projection changed the valid ledger"
  node - <<'NODE' "$SVC_CANDIDATE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);const candidate=db.prepare("SELECT status,rejection_reason FROM candidates WHERE project_id='fixture-project-a' AND item_scope='consumer-experience' AND candidate_id='CAND-005'").get();const event=db.prepare("SELECT action,logged_at FROM candidate_decision_outbox WHERE project_id='fixture-project-a' AND item_scope='consumer-experience' AND candidate_id='CAND-005'").get();if(candidate?.status!=='rejected'||candidate?.rejection_reason!=='projection recovery'||event?.action!=='reject'||event?.logged_at!==null)throw Error(JSON.stringify({candidate,event}));db.close();
NODE
  SVC_CANDIDATE_DECISIONS="$ORIGINAL_LEDGER" run_a --file docs/specs/candidates/pool.json --top 1 >/dev/null
  [[ "$(wc -l < "$SVC_CANDIDATE_DECISIONS")" -eq 3 ]] || fail "outbox recovery did not append exactly one event"
  node - <<'NODE' "$SVC_CANDIDATE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);db.prepare("UPDATE candidate_decision_outbox SET logged_at=NULL WHERE candidate_id='CAND-005'").run();db.close();
NODE
  run_a --reject CAND-005 --reason "projection recovery" >/dev/null
  [[ "$(wc -l < "$SVC_CANDIDATE_DECISIONS")" -eq 3 ]] || fail "append-before-mark replay duplicated event"
  node - <<'NODE' "$SVC_CANDIDATE_DECISIONS"
const fs=require('fs');const events=fs.readFileSync(process.argv[2],'utf8').trim().split('\n').map(JSON.parse);const ids=events.map(x=>x.event_id);if(new Set(ids).size!==ids.length)throw Error(`duplicate event IDs: ${JSON.stringify(ids)}`);if(events.filter(x=>x.candidate_id==='CAND-005'&&x.action==='reject').length!==1)throw Error('CAND-005 event is not unique');
NODE
  MIRROR_BEFORE="$(sha256sum "$REPO_A/docs/specs/candidates/pool.json" | awk '{print $1}')"
  chmod 0555 "$REPO_A/docs/specs/candidates"
  if run_a --reject CAND-006 --reason "mirror recovery" >/dev/null 2>&1; then chmod 0755 "$REPO_A/docs/specs/candidates"; fail "read-only mirror directory unexpectedly exported"; fi
  chmod 0755 "$REPO_A/docs/specs/candidates"
  [[ "$(sha256sum "$REPO_A/docs/specs/candidates/pool.json" | awk '{print $1}')" == "$MIRROR_BEFORE" ]] || fail "failed mirror export changed prior bytes"
  run_a --file docs/specs/candidates/pool.json --top 1 >/dev/null
  rg -q '"rejection_reason": "mirror recovery"' "$REPO_A/docs/specs/candidates/pool.json" || fail "mirror replay did not heal"
  CONCURRENT_LINES_BEFORE="$(wc -l < "$SVC_CANDIDATE_DECISIONS")"
  (run_a --reject CAND-007 --reason "concurrent identical choice" >"$TEST_ROOT/concurrent-a.out" 2>&1) &
  CONCURRENT_A=$!
  (run_a --reject CAND-007 --reason "concurrent identical choice" >"$TEST_ROOT/concurrent-b.out" 2>&1) &
  CONCURRENT_B=$!
  wait "$CONCURRENT_A" || fail "first concurrent identical transition failed: $(<"$TEST_ROOT/concurrent-a.out")"
  wait "$CONCURRENT_B" || fail "second concurrent identical transition failed: $(<"$TEST_ROOT/concurrent-b.out")"
  [[ "$(wc -l < "$SVC_CANDIDATE_DECISIONS")" -eq $((CONCURRENT_LINES_BEFORE + 1)) ]] || fail "concurrent identical transition did not produce exactly one event"
  CONFLICT_LINES_BEFORE="$(wc -l < "$SVC_CANDIDATE_DECISIONS")"
  (run_a --promote CAND-010 --wi WI-CONCURRENT >"$TEST_ROOT/conflict-promote.out" 2>&1) &
  CONFLICT_PROMOTE=$!
  (run_a --reject CAND-010 --reason "concurrent conflict" >"$TEST_ROOT/conflict-reject.out" 2>&1) &
  CONFLICT_REJECT=$!
  set +e
  wait "$CONFLICT_PROMOTE"; CONFLICT_PROMOTE_RC=$?
  wait "$CONFLICT_REJECT"; CONFLICT_REJECT_RC=$?
  set -e
  if [[ ( "$CONFLICT_PROMOTE_RC" -eq 0 && "$CONFLICT_REJECT_RC" -eq 0 ) || ( "$CONFLICT_PROMOTE_RC" -ne 0 && "$CONFLICT_REJECT_RC" -ne 0 ) ]]; then
    fail "concurrent conflicting transitions did not produce exactly one success"
  fi
  [[ "$(wc -l < "$SVC_CANDIDATE_DECISIONS")" -eq $((CONFLICT_LINES_BEFORE + 1)) ]] || fail "concurrent conflicting transitions did not produce exactly one event"
  run_a --reject CAND-008 --reason --file >/dev/null
  rg -q '"rejection_reason": "--file"' "$REPO_A/docs/specs/candidates/pool.json" || fail "flag-like reason operand was misparsed"
  node - <<'NODE' "$SVC_CANDIDATE_DB" "$TEST_ROOT/lock-ready" &
const {DatabaseSync}=require('node:sqlite');const fs=require('fs');const db=new DatabaseSync(process.argv[2]);db.exec('BEGIN IMMEDIATE');fs.writeFileSync(process.argv[3],'ready');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,700);db.exec('COMMIT');db.close();
NODE
  LOCK_PID=$!
  while [[ ! -f "$TEST_ROOT/lock-ready" ]]; do sleep 0.02; done
  run_a --file docs/specs/candidates/pool.json --top 1 >/dev/null
  wait "$LOCK_PID"
  node - <<'NODE' "$SVC_CANDIDATE_DB" "$TEST_ROOT/long-lock-ready" "$TEST_ROOT/release-long-lock" &
const {DatabaseSync}=require('node:sqlite');const fs=require('fs');const db=new DatabaseSync(process.argv[2]);db.exec('BEGIN IMMEDIATE');fs.writeFileSync(process.argv[3],'ready');const deadline=Date.now()+15000;while(Date.now()<deadline&&!fs.existsSync(process.argv[4]))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);db.exec('COMMIT');db.close();
NODE
  LONG_LOCK_PID=$!
  while [[ ! -f "$TEST_ROOT/long-lock-ready" ]]; do sleep 0.02; done
  LONG_LOCK_START="$(date +%s)"
  expect_fail run_a --reject CAND-009 --reason "must time out"
  LONG_LOCK_ELAPSED=$(( $(date +%s) - LONG_LOCK_START ))
  touch "$TEST_ROOT/release-long-lock"
  wait "$LONG_LOCK_PID"
  [[ "$LONG_LOCK_ELAPSED" -ge 4 && "$LONG_LOCK_ELAPSED" -le 8 ]] || fail "busy timeout was not bounded near five seconds: ${LONG_LOCK_ELAPSED}s"
  node - <<'NODE' "$SVC_CANDIDATE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);const c=db.prepare("SELECT status FROM candidates WHERE project_id='fixture-project-a' AND item_scope='consumer-experience' AND candidate_id='CAND-009'").get();const n=db.prepare("SELECT COUNT(*) n FROM candidate_decision_outbox WHERE project_id='fixture-project-a' AND candidate_id='CAND-009'").get().n;if(c?.status!=='candidate'||n!==0)throw Error(JSON.stringify({c,n}));db.close();
NODE
  OLD_REPO_A="$REPO_A"
  REPO_MOVED="$TEST_ROOT/repo-a-moved"
  mv "$REPO_A" "$REPO_MOVED"
  REPO_A="$REPO_MOVED"
  run_a --reject CAND-004 --reason "moved repository" >/dev/null
  rg -q '"rejection_reason": "moved repository"' "$REPO_A/docs/specs/candidates/pool.json" || fail "relative mirror did not survive repository move"
  [[ ! -e "$OLD_REPO_A" ]] || fail "terminal projection recreated or wrote the old repository path"
  node - <<'NODE' "$REPO_A/docs/specs/candidates/pool.json" "$REPO_A/docs/specs/candidates/conflicting-mirror.json"
const fs=require('fs');const pool=JSON.parse(fs.readFileSync(process.argv[2]));const candidate=pool.candidates.find(x=>x.id==='CAND-002');fs.writeFileSync(process.argv[3],JSON.stringify({...pool,topic:'conflicting-mirror',candidates:[candidate]},null,2)+'\n');
NODE
  expect_fail run_a --file docs/specs/candidates/conflicting-mirror.json --rank
  run_a --file docs/specs/candidates/pool.json --top 2 >/dev/null
  node - <<'NODE' "$REPO_A/docs/specs/candidates/pool.json" "$SVC_CANDIDATE_DB"
const fs=require('fs');const {DatabaseSync}=require('node:sqlite');const pool=JSON.parse(fs.readFileSync(process.argv[2]));if(!pool.candidates.some(x=>x.id==='CAND-002'))throw Error('origin mirror lost CAND-002');const db=new DatabaseSync(process.argv[3]);const row=db.prepare("SELECT source_mirror FROM candidates WHERE project_id='fixture-project-a' AND item_scope='consumer-experience' AND candidate_id='CAND-002'").get();if(row?.source_mirror!=='docs/specs/candidates/pool.json')throw Error(JSON.stringify(row));db.close();
NODE
  node - <<'NODE' "$REPO_A/docs/specs/candidates/pool.json" "$REPO_A/docs/specs/candidates/second-scope.json"
const fs=require('fs');const p=JSON.parse(fs.readFileSync(process.argv[2]));p.topic='second-scope';p.item_scope='consumer-experience-secondary';for(const c of p.candidates)c.item_scope=p.item_scope;fs.writeFileSync(process.argv[3],JSON.stringify(p,null,2)+'\n');
NODE
  run_a --file docs/specs/candidates/second-scope.json --top 1 >/dev/null
  expect_fail run_a --promote CAND-002 --wi WI-AMBIGUOUS
  REPO_B="$TEST_ROOT/repo-b"
  make_repo "$REPO_B" "fixture-project-b"
  (cd "$REPO_B" && node "$HARNESS" --file docs/specs/candidates/pool.json --top 1 >/dev/null)
  (cd "$REPO_B" && node "$HARNESS" --reject CAND-001 --reason "project b choice" >/dev/null)
  node - <<'NODE' "$SVC_CANDIDATE_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);
const rows=db.prepare("SELECT DISTINCT project_id,status FROM candidates WHERE candidate_id='CAND-001' AND project_id IN ('fixture-project-a','fixture-project-b') ORDER BY project_id").all();
if(JSON.stringify(rows)!==JSON.stringify([{project_id:'fixture-project-a',status:'promoted'},{project_id:'fixture-project-b',status:'rejected'}]))throw Error(JSON.stringify(rows));db.close();
NODE
  REPO_LEDGER_SYMLINK="$TEST_ROOT/repo-ledger-symlink"
  make_repo "$REPO_LEDGER_SYMLINK" ""
  LEDGER_SYMLINK_DB="$TEST_ROOT/ledger-symlink.db"
  SVC_CANDIDATE_DB="$LEDGER_SYMLINK_DB" SVC_CANDIDATE_DECISIONS="$TEST_ROOT/bootstrap-ledger.jsonl" \
    bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1 >/dev/null' _ "$REPO_LEDGER_SYMLINK" "$HARNESS"
  rmdir "$REPO_LEDGER_SYMLINK/.svc"
  mkdir "$TEST_ROOT/external-ledger"
  ln -s "$TEST_ROOT/external-ledger" "$REPO_LEDGER_SYMLINK/.svc"
  expect_fail env -u SVC_CANDIDATE_DECISIONS SVC_CANDIDATE_DB="$LEDGER_SYMLINK_DB" \
    bash -c 'cd "$1" && node "$2" --reject CAND-001 --reason outside' _ "$REPO_LEDGER_SYMLINK" "$HARNESS"
  [[ ! -e "$TEST_ROOT/external-ledger/pipeline-decisions.jsonl" ]] || fail "default ledger escaped through a symlinked .svc ancestor"
  REPO_FORGED="$TEST_ROOT/repo-forged-ledger"
  make_repo "$REPO_FORGED" "forged-project"
  FORGED_DB="$TEST_ROOT/forged.db"
  FORGED_LEDGER="$TEST_ROOT/forged.jsonl"
  SVC_CANDIDATE_DB="$FORGED_DB" SVC_CANDIDATE_DECISIONS="$FORGED_LEDGER" \
    bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1 >/dev/null' _ "$REPO_FORGED" "$HARNESS"
  node - <<'NODE' "$FORGED_LEDGER"
const fs=require('fs'),{createHash}=require('crypto');const identity={schema_version:1,project_id:'forged-project',item_scope:'consumer-experience',candidate_id:'CAND-001',action:'promote',status:'promoted',promoted_wi:'WI-FORGED',reason:null};const event_id=createHash('sha256').update(JSON.stringify(identity),'utf8').digest('hex');fs.writeFileSync(process.argv[2],JSON.stringify({event_id,forged:true})+'\n');
NODE
  expect_fail env SVC_CANDIDATE_DB="$FORGED_DB" SVC_CANDIDATE_DECISIONS="$FORGED_LEDGER" \
    bash -c 'cd "$1" && node "$2" --promote CAND-001 --wi WI-FORGED' _ "$REPO_FORGED" "$HARNESS"
  node - <<'NODE' "$FORGED_DB"
const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[2]);const c=db.prepare("SELECT status,promoted_wi FROM candidates WHERE project_id='forged-project' AND item_scope='consumer-experience' AND candidate_id='CAND-001'").get();const o=db.prepare("SELECT logged_at FROM candidate_decision_outbox WHERE project_id='forged-project' AND candidate_id='CAND-001'").get();if(c?.status!=='promoted'||c?.promoted_wi!=='WI-FORGED'||!o||o.logged_at!==null)throw Error(JSON.stringify({c,o}));db.close();
NODE
  REPO_DEFAULT_LEDGER="$TEST_ROOT/repo-default-ledger"
  make_repo "$REPO_DEFAULT_LEDGER" "default-ledger-project"
  DEFAULT_LEDGER_DB="$TEST_ROOT/default-ledger.db"
  SVC_CANDIDATE_DB="$DEFAULT_LEDGER_DB" SVC_CANDIDATE_DECISIONS="$TEST_ROOT/default-ledger-bootstrap.jsonl" \
    bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1 >/dev/null' _ "$REPO_DEFAULT_LEDGER" "$HARNESS"
  env -u SVC_CANDIDATE_DECISIONS SVC_CANDIDATE_DB="$DEFAULT_LEDGER_DB" \
    bash -c 'cd "$1" && node "$2" --promote CAND-001 --wi WI-DEFAULT-LEDGER' _ "$REPO_DEFAULT_LEDGER" "$HARNESS"
  node - <<'NODE' "$REPO_DEFAULT_LEDGER/.svc/pipeline-decisions.jsonl"
const fs=require('fs');const file=process.argv[2];const events=fs.readFileSync(file,'utf8').trim().split('\n').map(JSON.parse);if(events.length!==1||events[0].action!=='promote'||events[0].candidate_id!=='CAND-001'||events[0].status!=='promoted')throw Error(JSON.stringify(events));if(process.platform!=='win32'&&(fs.statSync(file).mode&0o777)!==0o600)throw Error(`new ledger mode ${(fs.statSync(file).mode&0o777).toString(8)}`);
NODE
  REPO_EXISTING_LEDGER="$TEST_ROOT/repo-existing-ledger"
  make_repo "$REPO_EXISTING_LEDGER" "existing-ledger-project"
  EXISTING_LEDGER_DB="$TEST_ROOT/existing-ledger.db"
  SVC_CANDIDATE_DB="$EXISTING_LEDGER_DB" SVC_CANDIDATE_DECISIONS="$TEST_ROOT/existing-ledger-bootstrap.jsonl" \
    bash -c 'cd "$1" && node "$2" --file docs/specs/candidates/pool.json --top 1 >/dev/null' _ "$REPO_EXISTING_LEDGER" "$HARNESS"
  printf '{"type":"pre-existing"}\n' > "$REPO_EXISTING_LEDGER/.svc/pipeline-decisions.jsonl"
  chmod 0644 "$REPO_EXISTING_LEDGER/.svc/pipeline-decisions.jsonl"
  env -u SVC_CANDIDATE_DECISIONS SVC_CANDIDATE_DB="$EXISTING_LEDGER_DB" \
    bash -c 'cd "$1" && node "$2" --reject CAND-001 --reason existing-ledger' _ "$REPO_EXISTING_LEDGER" "$HARNESS"
  if [[ "$(uname -s)" != MINGW* && "$(stat -c '%a' "$REPO_EXISTING_LEDGER/.svc/pipeline-decisions.jsonl")" != 644 ]]; then fail "existing shared ledger mode changed"; fi
  [[ "$(sha256sum "$REPO_A/README.md" | awk '{print $1}')" == "$TRIAGE_README_HASH" ]] || fail "triage changed a grounded source file"
  [[ ! -d "$REPO_A/docs/specs/work-items" ]] || [[ -z "$(find "$REPO_A/docs/specs/work-items" -type f -print -quit)" ]] || fail "triage created a Work Item artifact"
  pass "terminal monotonicity, ambiguity, outbox recovery, contention, moved mirror, and cross-project isolation"
fi

pass "operator default store unchanged"
echo "Candidate Harness validation: PASS ($GROUP)"
