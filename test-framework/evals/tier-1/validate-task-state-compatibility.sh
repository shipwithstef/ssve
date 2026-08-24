#!/usr/bin/env bash
# Tier 1 (WI-486 task-1, RED-FIRST): task-state compatibility classifier + bounded
# disposition loop + explicit receipted migration.
#
# This fixture proves the SIB-26..42 compatibility/migration contract:
#   - classifyTaskState(RAW BYTES) buckets supported / legacy-lossless /
#     quarantine-recommended and NEVER throws on invalid bytes (SIB-26..29);
#   - normalizedView upgrades only a legacy-lossless graph in-memory and throws
#     otherwise; the result is never persisted (SIB-27);
#   - stateIdentityDigest hashes all six loop-termination fields INCLUDING
#     classification, so a classification-only change yields a distinct digest
#     (SIB-36..41);
#   - recordDisposition returns actionable on first sight, advisory on an identical
#     repeat, and none for supported state (SIB-36..41);
#   - svc-migrate-task-state.mjs is the only disk-rewrite path: backup-first,
#     digest-verified, receipt-terminal, WI-scoped restore, foreign-excluding, and
#     idempotent (SIB-30..35), and its receipt conforms to the migration schema.
#
# RED-FIRST: the compatibility module, the migration CLI, and the receipt schema are
# authored by task-4. Until they land, this fixture emits the NAMED expected-red
# marker and exits non-zero — it fails for its declared reason, never a syntax
# error. Once task-4 ships them, the detection gate passes and the real assertions
# below run and must pass.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
COMPAT="$ROOT/hooks/lib/task-state-compatibility.mjs"
MIGRATE="$ROOT/scripts/svc-migrate-task-state.mjs"
SCHEMA="$ROOT/schemas/task-state-migration-receipt.schema.json"

RED_MARKER="EXPECTED-RED: task-state compatibility classifier not yet implemented"

TMP="$(mktemp -d)"
if [[ "${SVC_KEEP_TMP:-0}" != 1 ]]; then trap 'rm -rf "$TMP"' EXIT; else printf '  fixture tmp: %s\n' "$TMP"; fi
chmod 700 "$TMP"
# Per-run isolated runtime dir so disposition markers never collide across runs.
export SVC_TASK_STATE_RUNTIME_DIR="$TMP/runtime"
export HOME="$TMP/home"; mkdir -m 700 "$HOME"
export XDG_RUNTIME_DIR="$TMP/missing-xdg"
unset SVC_RUNTIME_DIR SVC_CODEX_RUNTIME_DIR

PASS=0
FAIL=0
ok()  { printf '  \xe2\x9c\x93 %s\n' "$1"; PASS=$((PASS + 1)); }
bad() { printf '  \xe2\x9c\x97 %s\n' "$1"; FAIL=$((FAIL + 1)); }
expect() { local label="$1"; shift; if "$@"; then ok "$label"; else bad "$label"; fi; }

echo "=== Tier 1: task-state compatibility (WI-486 classify/normalize/migrate) ==="

# --- RED-FIRST detection gate ------------------------------------------------
# task-4 creates task-state-compatibility.mjs (pure classifier) plus the migration
# CLI and receipt schema. Absent today.
compat_module_implemented() {
  [[ -f "$COMPAT" ]] || return 1
  node -e '
    const {pathToFileURL}=require("url");
    import(pathToFileURL(process.argv[1]).href).then(m=>{
      const need=["classifyTaskState","normalizedView","stateIdentityDigest","recordDisposition"];
      process.exit(need.every(f=>typeof m[f]==="function")?0:1);
    }).catch(()=>process.exit(1));' "$COMPAT" >/dev/null 2>&1 || return 1
  [[ -f "$MIGRATE" && -f "$SCHEMA" ]] || return 1
  return 0
}

if ! compat_module_implemented; then
  echo "  $RED_MARKER"
  echo "  (task-state-compatibility.mjs + svc-migrate-task-state.mjs + receipt schema are authored by task-4; RED until then)"
  echo "  0 passed, 1 failed"
  exit 1
fi

# --- Real assertions (run once task-4 lands the module/CLI/schema) -----------
# Deterministic, hermetic: local node only, zero network/model calls.
classify() {
  # $1 = path to a graph-bytes fixture; prints the classification token.
  node -e '
    const fs=require("fs");const {pathToFileURL}=require("url");
    import(pathToFileURL(process.argv[1]).href).then(m=>{
      const bytes=fs.readFileSync(process.argv[2]);
      process.stdout.write(m.classifyTaskState(bytes).classification||"");
    });' "$COMPAT" "$1"
}

# SIB-26: omitted version == current supported shape.
printf '{"schema_version":1,"wi":"WI-486","tasks":[{"id":"task-1","status":"in_progress","skill":"route-workflow"}]}\n' > "$TMP/supported.json"
expect "supported graph classifies supported" test "$(classify "$TMP/supported.json")" = supported

# SIB-27: explicit version:0 lossless-eligible == legacy-lossless.
printf '{"version":0,"wi":"WI-486","tasks":[{"id":"task-1","status":"in_progress"}]}\n' > "$TMP/legacy.json"
expect "version-0 lossless graph classifies legacy-lossless" test "$(classify "$TMP/legacy.json")" = legacy-lossless

# SIB-28: version>1 quarantines.
printf '{"version":99,"tasks":[]}\n' > "$TMP/future.json"
expect "future version quarantines" test "$(classify "$TMP/future.json")" = quarantine-recommended

# SIB-29: unparseable bytes quarantine WITHOUT throwing.
printf '{not-json' > "$TMP/bad.json"
expect "unparseable bytes quarantine and never throw" test "$(classify "$TMP/bad.json")" = quarantine-recommended

# SIB-36..41: stateIdentityDigest is classification-sensitive; recordDisposition
# is first-actionable / repeat-advisory; supported writes no marker.
expect "digest is classification-sensitive and disposition is bounded" node -e '
  const fs=require("fs");const {pathToFileURL}=require("url");
  import(pathToFileURL(process.argv[1]).href).then(m=>{
    const id={repoRoot:"/r",sessionId:"s",worktreeRoot:"/w",affectedPaths:["a"],graphBytesByPath:{a:Buffer.from("x")}};
    const dA=m.stateIdentityDigest({...id,classification:"legacy-lossless"});
    const dB=m.stateIdentityDigest({...id,classification:"quarantine-recommended"});
    if(dA===dB) process.exit(1);                       // classification-sensitive
    const first=m.recordDisposition({...id,classification:"quarantine-recommended"}).disposition;
    const again=m.recordDisposition({...id,classification:"quarantine-recommended"}).disposition;
    const sup =m.recordDisposition({...id,classification:"supported"}).disposition;
    process.exit((first==="actionable"&&again==="advisory"&&sup==="none")?0:1);
  }).catch(()=>process.exit(1));' "$COMPAT"

# SIB-30..35: migration schema parses and requires terminal-result shape.
expect "migration receipt schema parses" node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$SCHEMA"

# SIB-33/34: migrate/restore both demand --wi and --authorization (no bare rewrite).
set +e
node "$MIGRATE" --wi WI-486 </dev/null >/dev/null 2>&1
NO_AUTH_RC=$?
set -e
expect "migration refuses without an authorization file" test "$NO_AUTH_RC" -ne 0

# --- WI-486 EXEC-008: malformed CURRENT-version graphs quarantine (no silent pass).
printf '{"schema_version":1,"tasks":"invalid"}\n' > "$TMP/malformed-current.json"
expect "malformed current-version graph (tasks not an array) quarantines" test "$(classify "$TMP/malformed-current.json")" = quarantine-recommended
printf '{"schema_version":1,"tasks":[{"id":1}]}\n' > "$TMP/nostatus.json"
expect "current graph with a statusless task quarantines" test "$(classify "$TMP/nostatus.json")" = quarantine-recommended
printf '{"schema_version":1,"wi":"WI-1"}\n' > "$TMP/notasks.json"
expect "current graph with no tasks array quarantines" test "$(classify "$TMP/notasks.json")" = quarantine-recommended

# --- WI-486 EXEC-R2-003: the ONE canonical validator rejects unknown statuses and
#     integrity violations (duplicate ids, dangling/non-array blockers) — these
#     previously passed the loose isWellFormedGraphShape and were classified clean.
printf '{"schema_version":1,"tasks":[{"id":1,"status":"frobnicate"}]}\n' > "$TMP/badstatus.json"
expect "current graph with an UNKNOWN task status quarantines (EXEC-R2-003)" test "$(classify "$TMP/badstatus.json")" = quarantine-recommended
printf '{"schema_version":1,"tasks":[{"id":1,"status":"pending"},{"id":1,"status":"pending"}]}\n' > "$TMP/dupid.json"
expect "current graph with DUPLICATE task ids quarantines (EXEC-R2-003)" test "$(classify "$TMP/dupid.json")" = quarantine-recommended
printf '{"schema_version":1,"tasks":[{"id":1,"status":"pending","blocked_by":[2]}]}\n' > "$TMP/dangling.json"
expect "current graph with a DANGLING blocker quarantines (EXEC-R2-003)" test "$(classify "$TMP/dangling.json")" = quarantine-recommended
printf '{"schema_version":1,"tasks":[{"id":1,"status":"pending","blocked_by":1}]}\n' > "$TMP/nonarrayblocked.json"
expect "current graph with non-array blocked_by quarantines (EXEC-R2-003)" test "$(classify "$TMP/nonarrayblocked.json")" = quarantine-recommended

# EXEC-008: an unestablishable first-seen marker (unsafe runtime dir) yields a
# NON-BLOCKING disposition — never a perpetual "actionable" that hard-blocks Stop.
expect "unwritable disposition runtime dir is non-blocking (never perpetual actionable)" node -e '
  const fs=require("fs");const {pathToFileURL}=require("url");
  const dirAsFile=process.argv[2];
  fs.writeFileSync(dirAsFile,"runtime dir path is a FILE, so mkdir must fail\n");
  process.env.SVC_TASK_STATE_RUNTIME_DIR=dirAsFile;
  import(pathToFileURL(process.argv[1]).href).then(m=>{
    const r=m.recordDisposition({repoRoot:"/r",sessionId:"s",worktreeRoot:"/w",affectedPaths:["a"],graphBytesByPath:{a:Buffer.from("x")},classification:"quarantine-recommended"});
    process.exit(r.disposition!=="actionable"?0:1);
  }).catch(()=>process.exit(1));' "$COMPAT" "$TMP/dispo-as-file"

# --- WI-486 EXEC-006/007: structured authorization + backup-first transaction ----
# Run the REAL migration CLI inside an isolated temp repository copy so it never
# touches this worktree's own state.
MREPO="$TMP/mrepo"
mkdir -p "$MREPO/scripts" "$MREPO/hooks/lib" "$MREPO/schemas" "$MREPO/.svc"
cp "$ROOT/scripts/svc-migrate-task-state.mjs" "$MREPO/scripts/"
cp "$ROOT/scripts/state-io.mjs" "$MREPO/scripts/"
# WI-562: state-io imports the shared liveness lib — copy the dependency.
mkdir -p "$MREPO/hooks/lib" && cp "$ROOT/hooks/lib/process-liveness.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/hooks/lib/wi-claim.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/hooks/lib/svc-runtime-root.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/hooks/lib/authority-store.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/hooks/lib/delegation-authority.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/hooks/lib/claim-owner.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/hooks/lib/wi-id.mjs" "$MREPO/hooks/lib/"  # WI-497 canonical dep
cp "$ROOT/hooks/lib/task-state-compatibility.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/hooks/lib/validate-task-graph-shape.mjs" "$MREPO/hooks/lib/"
cp "$ROOT/schemas/task-state-migration-receipt.schema.json" "$MREPO/schemas/"
git -C "$MREPO" init -q
MREPO_REAL="$(cd "$MREPO" && pwd -P)"
MG="$MREPO/scripts/svc-migrate-task-state.mjs"
MWI=WI-4242
MRUNTIME="$TMP/mruntime"
GRAPHF="$MREPO/.svc/lane-tasks-$MWI.json"
mk_legacy() { printf '{"version":0,"wi":"%s","tasks":[{"id":"task-1","status":"pending"}]}\n' "$MWI" > "$GRAPHF"; }
mk_auth() { node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({repository:process.argv[3],wi:process.argv[2],principal:"owner@svc",issued_at:new Date(Date.now()-1000).toISOString(),expires_at:process.argv[4],nonce:"n-"+Math.random().toString(36).slice(2)}))' "$1" "$2" "$3" "$4"; }
FUTURE="$(node -e 'process.stdout.write(new Date(Date.now()+3600000).toISOString())')"
PAST="$(node -e 'process.stdout.write(new Date(Date.now()-3600000).toISOString())')"
mk_auth "$TMP/auth-good.json" "$MWI" "$MREPO_REAL" "$FUTURE"
mk_auth "$TMP/auth-wrongwi.json" WI-9999 "$MREPO_REAL" "$FUTURE"
mk_auth "$TMP/auth-expired.json" "$MWI" "$MREPO_REAL" "$PAST"
mk_auth "$TMP/auth-wrongrepo.json" "$MWI" "$TMP" "$FUTURE"
printf 'just a readme, not an authorization\n' > "$TMP/bare-auth.txt"

mk_legacy
migrate_rc() { set +e; SVC_TASK_STATE_RUNTIME_DIR="$MRUNTIME" SVC_SESSION_ID=migrator-session node "$MG" "$@" >/dev/null 2>&1; local rc=$?; set -e; echo "$rc"; }
expect "unstructured (non-JSON) authorization is rejected (EXEC-006)" test "$(migrate_rc --wi "$MWI" --authorization "$TMP/bare-auth.txt")" -ne 0
expect "authorization naming a different WI is rejected (EXEC-006)" test "$(migrate_rc --wi "$MWI" --authorization "$TMP/auth-wrongwi.json")" -ne 0
expect "authorization naming a different repository is rejected (EXEC-006)" test "$(migrate_rc --wi "$MWI" --authorization "$TMP/auth-wrongrepo.json")" -ne 0
expect "expired authorization is rejected (EXEC-006)" test "$(migrate_rc --wi "$MWI" --authorization "$TMP/auth-expired.json")" -ne 0
expect "graph is untouched by every rejected authorization" test "$(classify "$GRAPHF")" = legacy-lossless

MIG_OUT="$(SVC_TASK_STATE_RUNTIME_DIR="$MRUNTIME" SVC_SESSION_ID=migrator-session node "$MG" --wi "$MWI" --authorization "$TMP/auth-good.json")"
expect "structured authorization migrates a legacy graph and records the principal+nonce" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.terminal_result===\"migrated\"&&o.authorization.principal===\"owner@svc\"&&Boolean(o.authorization.nonce)?0:1)}catch{process.exit(1)}})"' "$MIG_OUT"
expect "migrated graph now classifies supported" test "$(classify "$GRAPHF")" = supported
BACKUP="$(printf '%s' "$MIG_OUT" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const o=JSON.parse(s);process.stdout.write(o.backups[0].backup_path)})')"

# EXEC-007: restore ONLY from a receipt-indexed, digest-verified backup.
RES_OUT="$(SVC_TASK_STATE_RUNTIME_DIR="$MRUNTIME" SVC_SESSION_ID=migrator-session node "$MG" --wi "$MWI" --authorization "$TMP/auth-good.json" --restore "$BACKUP")"
expect "receipt-indexed backup restores" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.terminal_result===\"restored\"?0:1)}catch{process.exit(1)}})"' "$RES_OUT"
expect "restored graph is the original legacy bytes" test "$(classify "$GRAPHF")" = legacy-lossless
printf '{"version":0,"wi":"WI-4242","tasks":[{"id":"forged","status":"pending"}]}\n' > "$TMP/arbitrary.json"
expect "arbitrary (non-receipt-indexed) restore bytes are rejected (EXEC-007)" test "$(migrate_rc --wi "$MWI" --authorization "$TMP/auth-good.json" --restore "$TMP/arbitrary.json")" -ne 0

# --- WI-486 EXEC-R2-006: the immutable backup is content-addressed and NEVER
#     unlinked/clobbered by a re-run (the prior code rm'd it before O_EXCL). Graph
#     is legacy again (restored above); re-migrating reuses the same backup path.
BACKUP_HASH_BEFORE="$(sha256sum "$BACKUP" | awk '{print $1}')"
REMIG_OUT="$(SVC_TASK_STATE_RUNTIME_DIR="$MRUNTIME" SVC_SESSION_ID=migrator-session node "$MG" --wi "$MWI" --authorization "$TMP/auth-good.json")"
expect "re-migration reuses the content-addressed backup and still migrates (EXEC-R2-006)" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.terminal_result===\"migrated\"?0:1)}catch{process.exit(1)}})"' "$REMIG_OUT"
expect "prior immutable backup still present after re-run (EXEC-R2-006)" test -f "$BACKUP"
expect "prior immutable backup is byte-identical — never clobbered (EXEC-R2-006)" test "$(sha256sum "$BACKUP" | awk '{print $1}')" = "$BACKUP_HASH_BEFORE"
expect "immutable backup is read-only mode 0400 (EXEC-R2-006)" test "$(stat -c %a "$BACKUP")" = 400

# --- WI-486 EXEC-R2-007: dry-run is NON-TERMINAL and side-effect-free (no backup,
#     no graph bytes, actual unchanged after-digest). Use a DISTINCT-content graph
#     so its digest cannot collide with any prior backup.
printf '{"version":0,"wi":"%s","tasks":[{"id":"task-9","status":"pending","subject":"dry"}]}\n' "$MWI" > "$GRAPHF"
DRY_DIGEST="$(sha256sum "$GRAPHF" | awk '{print $1}')"
DRY_OUT="$(SVC_TASK_STATE_RUNTIME_DIR="$MRUNTIME" SVC_SESSION_ID=migrator-session node "$MG" --wi "$MWI" --authorization "$TMP/auth-good.json" --dry-run)"
expect "migration dry-run is NON-terminal eligible-dry-run with no backup/changed_paths (EXEC-R2-007)" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.terminal_result===\"eligible-dry-run\"&&o.backups.length===0&&o.changed_paths.length===0&&o.after_digests[Object.keys(o.after_digests)[0]]===o.before_digests[Object.keys(o.before_digests)[0]]?0:1)}catch{process.exit(1)}})"' "$DRY_OUT"
expect "migration dry-run leaves the graph byte-unchanged (still legacy) (EXEC-R2-007)" test "$(classify "$GRAPHF")" = legacy-lossless
expect "migration dry-run wrote NO backup for its digest (EXEC-R2-007)" bash -c "! test -e '$MRUNTIME/$MWI/backups/lane-tasks-$MWI.$DRY_DIGEST.bak.json'"
RES_DRY_OUT="$(SVC_TASK_STATE_RUNTIME_DIR="$MRUNTIME" SVC_SESSION_ID=migrator-session node "$MG" --wi "$MWI" --authorization "$TMP/auth-good.json" --restore "$BACKUP" --dry-run)"
expect "restore dry-run is NON-terminal restore-dry-run with no backup/changed_paths and unchanged after-digest (EXEC-R2-007)" bash -c 'printf "%s" "$0" | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{try{const o=JSON.parse(s);process.exit(o.terminal_result===\"restore-dry-run\"&&o.backups.length===0&&o.changed_paths.length===0&&o.after_digests[Object.keys(o.after_digests)[0]]===o.before_digests[Object.keys(o.before_digests)[0]]?0:1)}catch{process.exit(1)}})"' "$RES_DRY_OUT"
expect "restore dry-run leaves the graph byte-unchanged (EXEC-R2-007)" test "$(sha256sum "$GRAPHF" | awk '{print $1}')" = "$DRY_DIGEST"
# Reset the migration graph to a fresh legacy state for the foreign-binding step.
mk_legacy

# EXEC-007: a fresh FOREIGN BINDING (not just a claim) blocks migration.
mkdir -p "$MREPO/.svc/bindings"
node -e 'const fs=require("fs");fs.writeFileSync(process.argv[1],JSON.stringify({schema_version:1,session_id:"019f6169-0000-7000-8000-00000000fb01",role:"mutating",wi:process.argv[2],worktree_root:process.argv[3],branch:"b",generation:1}),{mode:0o600})' "$MREPO/.svc/bindings/foreign.json" "$MWI" "$MREPO_REAL"
expect "a fresh foreign binding (claims+bindings reinspection) blocks migration (EXEC-007)" test "$(migrate_rc --wi "$MWI" --authorization "$TMP/auth-good.json")" -ne 0
rm -f "$MREPO/.svc/bindings/foreign.json"

echo ""
echo "  $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
