#!/usr/bin/env bash
# validate-all-host-install-migration.sh — WI-487 (AC-487-9/10/11/12) + round-2
# coverage findings R2-F011/F012/F013/F014/F015.
#
# Proves the versioned all-host first-run install migration:
#   - dynamic inventory of EVERY provision/hosts/*.json (all 8 hosts, no subset — AC-487-9 / R2-F011),
#   - every hook-capable host is migrated OR carries an explicit disposition — never silently skipped,
#   - convergence/health/drift parse the ACTUAL installed governed command and assert
#     launcher routing + live skills pointer (R2-F012): a command drifted back to a
#     direct checkout path is re-wired, NOT accepted as noop,
#   - a TERMINAL-class outcome (WI-486 unauth) is terminal on the FIRST occurrence and
#     is NOT auto-retried (R2-F013),
#   - rollback restores exact bytes when the config pre-existed, else REMOVES the
#     migration-created file, and a restore failure is a distinct terminal (R2-F014),
#   - the state root itself is validated (symlinked / group-other-writable ~/.svc is
#     refused fail-closed) and every bundle write threads a no-follow boundary (R2-F015),
#   - transactional failpoint rollback + resume + pinned N=3 ceiling (AC-487-10/12),
#   - legacy WI-state DELEGATES to WI-486 with NO second graph migrator (AC-487-11).
#
# Hermetic: temp fixture HOME (/tmp) + a DURABLE fixture source under $HOME/.cache
# (durable-canonical). Zero network / model calls.
#
# Tier-1 promotion note:
#   validator_path: test-framework/evals/tier-1/validate-all-host-install-migration.sh
#   failure_class: repairs only a hard-coded host subset; a hook-capable host silently
#     skipped; convergence accepted after governed-command drift; a terminal record
#     auto-retried; rollback that dangles a migration-created config; enforcement
#     materialized through an unvalidated state-root ancestor; a second WI-state migrator.
#   promotion_signal: signal 3 — protects the install/first-run hot path + the WI-486
#     delegation boundary + all-host governed-routing coverage.
#   expected_runtime_budget: < 8s, hermetic (temp repo + all 8 fixture host manifests), no network/model.
#   why_tier_2_or_targeted_is_insufficient: migration integrity, per-host coverage, the
#     pinned ceiling, the rollback contract, the state-root fence, and the no-second-graph
#     -migrator invariant must block before an upgrade ships to any host.

set -u
PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ok $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
echo "=== Tier 1: all-host install migration (WI-487 + round-2 coverage) ==="

if [ ! -f "$REPO_ROOT/scripts/svc-migrate-install.mjs" ]; then
  echo "EXPECTED-RED: all-host install migration not yet implemented"
  echo "EXPECTED-RED: versioned install rollback not yet implemented"
  echo "  FAIL — implementation missing"
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "  SKIP — node unavailable"; echo "  PASS — 0 assertions (skipped)"; exit 0; }

# --- No-second-migrator invariant (AC-487-11) --------------------------------
if grep -nE 'writeFile.*lane-tasks|renameSync.*lane-tasks|JSON\.stringify.*(tasks|lane-tasks)' "$REPO_ROOT/scripts/svc-migrate-install.mjs" >/dev/null 2>&1; then
  fail "svc-migrate-install.mjs contains a lane-tasks graph write (WI-486 boundary breach)"
else
  pass "no lane-tasks graph write in svc-migrate-install.mjs (delegates to WI-486)"
fi
grep -q 'task-state-compatibility' "$REPO_ROOT/scripts/svc-migrate-install.mjs" && pass "svc-migrate-install.mjs imports WI-486 task-state-compatibility for classification" || fail "no WI-486 delegation reference in migration CLI"

# --- Build a durable fixture source that copies EVERY host manifest + wirer ---
DURABLE_BASE="${SVC_TEST_DURABLE_BASE:-$HOME/.cache}"
mkdir -p "$DURABLE_BASE" 2>/dev/null || true
SRC="$(mktemp -d "$DURABLE_BASE/svc-wi487-mig-XXXXXX")"
FHOME="$(mktemp -d)"
cleanup() { rm -rf "$SRC" "$FHOME" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

mkdir -p "$SRC/bin" "$SRC/hooks/lib" "$SRC/hooks/kimi" "$SRC/hooks/codex" "$SRC/hooks/opencode" "$SRC/scripts" "$SRC/provision/hosts" "$SRC/references" "$SRC/.svc"
cp "$REPO_ROOT/bin/svc-enforce.mjs" "$SRC/bin/"
cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/validate-task-graph-shape.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/task-state-compatibility.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/svc-runtime-root.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/svc-task-completion-guard.sh" "$SRC/hooks/"; chmod +x "$SRC/hooks/svc-task-completion-guard.sh"
cp "$REPO_ROOT/hooks/kimi/svc-kimi-task-completion-guard.sh" "$SRC/hooks/kimi/"; chmod +x "$SRC/hooks/kimi/svc-kimi-task-completion-guard.sh"
cp "$REPO_ROOT/hooks/codex/svc-codex-skill-load-enforcer.mjs" "$SRC/hooks/codex/" 2>/dev/null || true
cp "$REPO_ROOT"/hooks/opencode/*.ts "$SRC/hooks/opencode/" 2>/dev/null || true
cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$SRC/scripts/"
cp "$REPO_ROOT/scripts/svc-migrate-task-state.mjs" "$SRC/scripts/" 2>/dev/null || true
cp "$REPO_ROOT/scripts/svc-runtime-root.mjs" "$SRC/scripts/"
cp "$REPO_ROOT/references/opencode-mimo-config.json" "$SRC/references/" 2>/dev/null || echo '{}' > "$SRC/references/opencode-mimo-config.json"
# F-004/F-010: the migration orchestrates the manifest-declared host wiring
# primitives — copy EVERY wirer so the fixture exercises real wiring + governed-
# command verification, not a stub.
for w in wire-hooks wire-codex-hooks wire-gemini-hooks wire-kimi-hooks wire-opencode-hooks; do
  cp "$REPO_ROOT/scripts/$w.mjs" "$SRC/scripts/"
done
# ALL 8 host manifests (dynamic inventory must find every one).
ALL_HOSTS=(antigravity claude codex cursor gemini kimi mimo-code opencode)
for h in "${ALL_HOSTS[@]}"; do cp "$REPO_ROOT/provision/hosts/$h.json" "$SRC/provision/hosts/"; done
# Create each host's skills dir + (for kimi) an existing config so it is "present".
mkdir -p "$FHOME/.claude/skills" "$FHOME/.codex/skills" "$FHOME/.gemini/skills" \
         "$FHOME/.kimi/skills" "$FHOME/.config/opencode/skills" "$FHOME/.mimocode/skills" \
         "$FHOME/.gemini/antigravity/skills" "$FHOME/.cursor/skills" "$FHOME/.codex" "$FHOME/.gemini"
printf 'x' > "$FHOME/.kimi/config.toml"   # kimi wirer requires an existing config.toml
# A SUPPORTED (current-version, well-formed) WI-state graph so the WI-486
# classification path is exercised without requiring migration authorization.
printf '{"version":1,"wi":"WI-999","tasks":[{"id":"t1","title":"x","status":"pending","blocked_by":[]}]}' > "$SRC/.svc/lane-tasks-WI-999.json"

MIG="$SRC/scripts/svc-migrate-install.mjs"

# --- Case A: dynamic inventory migrates ALL 8 hosts (R2-F011) -----------------
AOUT="$(HOME="$FHOME" node "$MIG" --all-hosts --repo-root "$SRC" --json 2>/dev/null | tail -1)"
for h in "${ALL_HOSTS[@]}"; do
  echo "$AOUT" | grep -q "\"host\":\"$h\"" && pass "dynamic inventory covered host: $h" || fail "host $h not inventoried"
done
# WI-486 delegation actually ran (classifications recorded).
echo "$AOUT" | grep -q 'classifications' && pass "WI-486 task-state classification delegated during migration (AC-487-11)" || fail "no WI-486 classification recorded"

# --- Case A2: per-host DISPOSITION coverage (R2-F011 — never silently skip) ---
# Every host is either migrated ok/noop OR carries an explicit non-migratable /
# skills-only / governed-false disposition. Assert each host's expected shape.
disp() { echo "$AOUT" | node -e '
  const o=JSON.parse(require("fs").readFileSync(0,"utf8"));
  const h=o.hosts.find(x=>x.host===process.argv[1])||{};
  process.stdout.write(JSON.stringify({status:h.status,governed:h.governed,routed:h.governed_routed,note:h.wiring_note||h.detail||""}));
' "$1"; }
for h in claude codex gemini kimi; do
  D="$(disp "$h")"
  if echo "$D" | grep -q '"status":"ok"' && echo "$D" | grep -q '"governed":true' && echo "$D" | grep -q '"routed":true'; then
    pass "governed launcher host migrated + routes through launcher: $h"
  else
    fail "governed host $h not migrated with launcher routing (got $D)"
  fi
done
for h in opencode mimo-code; do
  D="$(disp "$h")"
  if echo "$D" | grep -q '"status":"ok"' && echo "$D" | grep -q '"governed":false'; then
    pass "plugin host migrated with EXPLICIT governed:false disposition (git-pre-commit, not silently skipped): $h"
  else
    fail "plugin host $h did not carry an explicit governed:false disposition (got $D)"
  fi
done
for h in antigravity cursor; do
  D="$(disp "$h")"
  if echo "$D" | grep -q '"status":"ok"' && echo "$D" | grep -qi 'skills-only'; then
    pass "non-hook-capable host migrated skills-only (explicit): $h"
  else
    fail "non-hook-capable host $h not explicitly skills-only (got $D)"
  fi
done

# --- Case A3: not-installed host is an EXPLICIT non-migratable terminal --------
FHNI="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHNI" 2>/dev/null' EXIT INT TERM
NIOUT="$(HOME="$FHNI" node "$MIG" --all-hosts --repo-root "$SRC" --json 2>/dev/null | tail -1)"
NI_ALL_EXPLICIT=1
for h in "${ALL_HOSTS[@]}"; do
  echo "$NIOUT" | node -e 'const o=JSON.parse(require("fs").readFileSync(0,"utf8"));const h=o.hosts.find(x=>x.host===process.argv[1]);process.exit(h&&h.status==="not-migratable"?0:1)' "$h" || NI_ALL_EXPLICIT=0
done
[ "$NI_ALL_EXPLICIT" -eq 1 ] && pass "a machine with NO hosts installed reports every host as an explicit not-migratable terminal (never a silent skip)" || fail "not-installed hosts were not all explicitly reported"
rm -rf "$FHNI"; trap 'rm -rf "$SRC" "$FHOME" 2>/dev/null' EXIT INT TERM

# --- Case D: idempotent no-op on a converged host ----------------------------
NOOP="$(HOME="$FHOME" node "$MIG" --host claude --repo-root "$SRC" --json 2>/dev/null | grep -o '"status":"[a-z]*"' | head -1)"
echo "$NOOP" | grep -q 'noop' && pass "re-run on a converged host is a byte no-op (idempotent, AC-487-10)" || fail "converged host re-run not a no-op (got $NOOP)"

# --- Case D2 (R2-F012): governed-command DRIFT back to direct path -> re-wire --
# Rewrite the installed Claude Stop command to the direct checkout form and assert
# migration REPAIRS (status ok) rather than accepting it as noop.
node -e '
  const fs=require("fs");const p=process.argv[1],src=process.argv[2];
  const s=JSON.parse(fs.readFileSync(p,"utf8"));
  for(const e of (s.hooks.Stop||[]))for(const h of (e.hooks||[]))
    if((h.command||"").includes("svc-enforce")&&h.command.includes("svc-task-completion-guard"))
      h.command="bash "+src+"/hooks/svc-task-completion-guard.sh";
  fs.writeFileSync(p,JSON.stringify(s,null,2));
' "$FHOME/.claude/settings.json" "$SRC"
DRIFT="$(HOME="$FHOME" node "$MIG" --host claude --repo-root "$SRC" --json 2>/dev/null | grep -o '"status":"[a-z]*"' | head -1)"
echo "$DRIFT" | grep -q 'ok' && pass "R2-F012: governed-command drift to a direct path is REPAIRED (not accepted as noop)" || fail "R2-F012: drifted governed command wrongly accepted (got $DRIFT)"
grep -q 'svc-enforce' "$FHOME/.claude/settings.json" && pass "R2-F012: repaired Claude Stop command routes through the launcher again" || fail "R2-F012: repair did not re-route through the launcher"

# Install receipt records the FULL coverage schema (governed/routed booleans).
RCPT="$FHOME/.svc/install-state/claude.json"
if [ -f "$RCPT" ]; then
  node -e 'const r=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.exit(("hooks_installed" in r)&&("skills_installed" in r)&&("governed" in r)&&("governed_routed" in r)?0:1)' "$RCPT" \
    && pass "install receipt carries full coverage schema (hooks_installed/skills_installed/governed/governed_routed)" \
    || fail "install receipt missing coverage booleans"
  grep -q '"effective_source"' "$RCPT" && grep -q '"launcher_path"' "$RCPT" && pass "per-host install receipt records effective source + launcher (AC-487-5)" || fail "install receipt missing effective_source/launcher"
else
  fail "no per-host install receipt written"
fi

# --- Case E: versioned --rollback restores + is idempotent -------------------
# F-006: claude, codex, gemini, kimi were all migrated in Case A and SHARE one
# bundle. Rolling back claude must NOT delete the bundle the others still reference.
RB="$(HOME="$FHOME" node "$MIG" --rollback --host claude --repo-root "$SRC" --json 2>/dev/null | tail -1)"
echo "$RB" | grep -q '"status":"restored"' && pass "--rollback restores the host (D-12)" || fail "--rollback did not restore (got $RB)"
[ -d "$FHOME/.svc/enforcement/1" ] && pass "F-006: shared launcher bundle SURVIVES rolling back one of several hosts" || fail "F-006 BREACH: rolling back claude deleted the shared bundle others still use"
echo "$RB" | grep -q '"bundle_removed":false' && pass "F-006: rollback reports bundle NOT removed (still referenced)" || fail "F-006: rollback did not report bundle retained"
SURV_LAUNCHER="$FHOME/.svc/enforcement/1/bin/svc-enforce"
[ -f "$SURV_LAUNCHER" ] && pass "surviving host launcher present after cross-host rollback" || fail "surviving launcher missing"
RB2="$(HOME="$FHOME" node "$MIG" --rollback --host claude --repo-root "$SRC" --json 2>/dev/null | tail -1)"
echo "$RB2" | grep -q '"status":"noop"' && pass "a second --rollback of the same host is a byte no-op (idempotent)" || fail "second --rollback not idempotent (got $RB2)"
# Roll back the remaining launcher hosts; the LAST one out removes the shared bundle.
HOME="$FHOME" node "$MIG" --rollback --host codex --repo-root "$SRC" --json >/dev/null 2>&1
HOME="$FHOME" node "$MIG" --rollback --host gemini --repo-root "$SRC" --json >/dev/null 2>&1
# opencode/mimo/antigravity/cursor also hold receipts referencing the bundle; roll them
# back too so kimi is genuinely the last governed launcher host.
for h in opencode mimo-code antigravity cursor; do HOME="$FHOME" node "$MIG" --rollback --host "$h" --repo-root "$SRC" --json >/dev/null 2>&1; done
RBLAST="$(HOME="$FHOME" node "$MIG" --rollback --host kimi --repo-root "$SRC" --json 2>/dev/null | tail -1)"
[ ! -d "$FHOME/.svc/enforcement/1" ] && pass "F-006: bundle removed only when the LAST referencing host is rolled back" || fail "F-006: bundle not removed after last host rollback"
echo "$RBLAST" | grep -q '"bundle_removed":true' && pass "F-006: final rollback reports bundle removed" || fail "F-006: final rollback did not report bundle removed"

# --- Case K (R2-F014): rollback REMOVES a migration-created host config --------
# A host whose config did NOT pre-exist must have the migration-created file REMOVED
# on rollback (never a dangling pointer at a removed launcher).
FHK="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHK" 2>/dev/null' EXIT INT TERM
mkdir -p "$FHK/.gemini/skills" "$FHK/.gemini"
[ ! -f "$FHK/.gemini/settings.json" ] || fail "K precondition: gemini config unexpectedly pre-exists"
HOME="$FHK" node "$MIG" --host gemini --repo-root "$SRC" --json >/dev/null 2>&1
[ -f "$FHK/.gemini/settings.json" ] && pass "R2-F014: migration created the gemini host config (did not pre-exist)" || fail "R2-F014: migration did not create the host config"
KRB="$(HOME="$FHK" node "$MIG" --rollback --host gemini --repo-root "$SRC" --json 2>/dev/null | tail -1)"
echo "$KRB" | grep -q '"status":"restored"' && pass "R2-F014: rollback of a created-config host succeeds" || fail "R2-F014: rollback status not restored (got $KRB)"
[ ! -f "$FHK/.gemini/settings.json" ] && pass "R2-F014: rollback REMOVED the migration-created config (no dangling launcher pointer)" || fail "R2-F014: migration-created config left dangling after rollback"
rm -rf "$FHK"; trap 'rm -rf "$SRC" "$FHOME" 2>/dev/null' EXIT INT TERM

# --- Case K2: Codex secondary config is transactional ------------------------
FHC="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHC" 2>/dev/null' EXIT INT TERM
mkdir -p "$FHC/.codex/skills" "$FHC/.codex"
printf 'ORIGINAL' > "$FHC/.codex/skills/.source-repo"
printf 'model = "owner-model"\n\n[features]\nhooks = false\n' > "$FHC/.codex/config.toml"
CODEX_BEFORE="$(sha256sum "$FHC/.codex/config.toml" | awk '{print $1}')"
K2="$(HOME="$FHC" node "$MIG" --host codex --repo-root "$SRC" --skills-path "$FHC/.codex/skills" --fail-point after-wire --json 2>/dev/null | tail -1)"
echo "$K2" | grep -qE '"status":"(failed|terminal)"' && pass "R2-F014: Codex after-wire failpoint aborts" || fail "R2-F014: Codex after-wire failpoint did not abort (got $K2)"
CODEX_AFTER="$(sha256sum "$FHC/.codex/config.toml" | awk '{print $1}')"
[ "$CODEX_BEFORE" = "$CODEX_AFTER" ] && pass "R2-F014: rollback restores exact Codex config.toml bytes" || fail "R2-F014: Codex config.toml was not restored"
[ ! -f "$FHC/.codex/hooks.json" ] && pass "R2-F014: rollback removes migration-created Codex hooks.json" || fail "R2-F014: Codex hooks.json survived rollback"
rm -rf "$FHC"; trap 'rm -rf "$SRC" "$FHOME" 2>/dev/null' EXIT INT TERM

# --- Case B/C: transactional failpoint + rollback + resume -------------------
FHOME2="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHOME2" 2>/dev/null' EXIT INT TERM
mkdir -p "$FHOME2/.claude/skills"
printf 'ORIGINAL' > "$FHOME2/.claude/skills/.source-repo"
FP="$(HOME="$FHOME2" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME2/.claude/skills" --fail-point after-repoint --json 2>/dev/null | tail -1)"
echo "$FP" | grep -qE '"status":"(failed|terminal)"' && pass "failpoint aborts the per-host migration transactionally" || fail "failpoint did not fail (got $FP)"
RESTORED="$(cat "$FHOME2/.claude/skills/.source-repo" 2>/dev/null)"
[ "$RESTORED" = "ORIGINAL" ] && pass "failpoint rolled the host back to its pre-migration pointer (AC-487-10)" || fail "host not rolled back after failpoint (pointer=$RESTORED)"
[ ! -f "$FHOME2/.svc/install-state/claude.json" ] && pass "no install receipt written on a failed migration" || fail "install receipt written despite failure"
RES="$(HOME="$FHOME2" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME2/.claude/skills" --resume --json 2>/dev/null | tail -1)"
echo "$RES" | grep -q '"status":"ok"' && pass "interrupted migration resumes to completion (AC-487-10)" || fail "resume did not complete (got $RES)"

# --- Case F: pinned N=3 ceiling -> terminal, no 4th auto-retry ---------------
FHOME3="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHOME2" "$FHOME3" 2>/dev/null' EXIT INT TERM
mkdir -p "$FHOME3/.claude/skills"
S1="$(HOME="$FHOME3" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME3/.claude/skills" --fail-point after-backup --json 2>/dev/null | tail -1)"
S2="$(HOME="$FHOME3" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME3/.claude/skills" --fail-point after-backup --json 2>/dev/null | tail -1)"
S3="$(HOME="$FHOME3" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME3/.claude/skills" --fail-point after-backup --json 2>/dev/null | tail -1)"
S4="$(HOME="$FHOME3" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME3/.claude/skills" --fail-point after-backup --json 2>/dev/null | tail -1)"
echo "$S3" | grep -q '"status":"terminal"' && pass "attempt 3 writes a fail-closed terminal record (N=3 ceiling, AC-487-12)" || fail "attempt 3 not terminal (got $S3)"
echo "$S4" | grep -q '"status":"refused"' && pass "attempt 4 is REFUSED — no auto-retry past the ceiling (AC-487-12)" || fail "attempt 4 retried past ceiling (got $S4)"

# --- Case G (R2-F013 / F-005): a WI-486 legacy graph requiring migration with
# NO authorization is TERMINAL on the FIRST occurrence (fail-closed), NOT retried. ---
FHOME4="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHOME2" "$FHOME3" "$FHOME4" 2>/dev/null' EXIT INT TERM
mkdir -p "$FHOME4/.claude/skills"
LEGACY_SVC="$(mktemp -d)"
printf '{"version":0,"wi":"WI-998","tasks":[{"id":"t1","status":"pending","subject":"legacy"}]}' > "$LEGACY_SVC/lane-tasks-WI-998.json"
GT1="$(SVC_MIGRATE_SVC_DIR="$LEGACY_SVC" HOME="$FHOME4" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME4/.claude/skills" --json 2>/dev/null | tail -1)"
if echo "$GT1" | grep -q '"status":"terminal"' && echo "$GT1" | grep -qi 'authorization'; then
  pass "R2-F013: unauthorized legacy WI-state is TERMINAL on the FIRST attempt (not a transient failure)"
else
  fail "R2-F013: first unauthorized legacy attempt not terminal (got $GT1)"
fi
# The terminal ledger must record attempts=1 (NOT retried to 3).
ATT="$(cat "$FHOME4/.svc/install-migrations/v1/claude/attempts.json" 2>/dev/null)"
echo "$ATT" | node -e 'const o=JSON.parse(require("fs").readFileSync(0,"utf8")||"{}");process.exit((o.attempts===1&&o.terminal===true)?0:1)' 2>/dev/null \
  && pass "R2-F013: terminal record persisted at attempt=1 (no auto-retry loop)" || fail "R2-F013: terminal not persisted on first occurrence (ledger=$ATT)"
GT2="$(SVC_MIGRATE_SVC_DIR="$LEGACY_SVC" HOME="$FHOME4" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME4/.claude/skills" --json 2>/dev/null | tail -1)"
echo "$GT2" | grep -q '"status":"refused"' && pass "R2-F013: a terminal record is NOT auto-retried (second call refused)" || fail "R2-F013: terminal record auto-retried (got $GT2)"
# Explicit owner override (--force) is the ONLY silent-retry-free recovery path.
GT3="$(HOME="$FHOME4" node "$MIG" --host claude --repo-root "$SRC" --skills-path "$FHOME4/.claude/skills" --force --json 2>/dev/null | tail -1)"
echo "$GT3" | grep -q '"status":"ok"' && pass "R2-F013: explicit owner override (--force) clears the terminal and completes" || fail "R2-F013: --force owner override did not recover (got $GT3)"
[ ! -f "$FHOME4/.svc/install-state/claude.json" ] || true
rm -rf "$LEGACY_SVC"

# --- Case J (R2-F015): the state root itself is validated (fail-closed) --------
FHJ="$(mktemp -d)"; ELSE="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHOME2" "$FHOME3" "$FHOME4" "$FHJ" "$ELSE" 2>/dev/null' EXIT INT TERM
mkdir -p "$FHJ/.claude/skills"
ln -s "$ELSE" "$FHJ/.svc"
SYMOUT="$(HOME="$FHJ" node "$MIG" materialize --host claude --repo-root "$SRC" --skills-path "$FHJ/.claude/skills" 2>&1)"; SYMRC=$?
if [ "$SYMRC" -ne 0 ] && echo "$SYMOUT" | grep -q 'INSECURE-STATE-ROOT'; then
  pass "R2-F015: a symlinked ~/.svc state root is REFUSED fail-closed (materialization aborts)"
else
  fail "R2-F015: symlinked state root not refused (rc=$SYMRC out=$SYMOUT)"
fi
rm -rf "$FHJ/.svc"; mkdir -p "$FHJ/.svc"; chmod 0777 "$FHJ/.svc"
WOUT="$(HOME="$FHJ" node "$MIG" materialize --host claude --repo-root "$SRC" --skills-path "$FHJ/.claude/skills" 2>&1)"; WRC=$?
if [ "$WRC" -ne 0 ] && echo "$WOUT" | grep -q 'WRITABLE-STATE-ROOT'; then
  pass "R2-F015: a group/other-writable ~/.svc state root is REFUSED fail-closed"
else
  fail "R2-F015: writable state root not refused (rc=$WRC out=$WOUT)"
fi
rm -rf "$FHJ" "$ELSE"

# --- Case L (R3-F002): the LAUNCHER fails closed on an insecure bundle ancestor
# BEFORE importing its materialized core (dependency-free bootstrap check). A
# group/other-writable bundle ancestor could otherwise let an attacker swap the core
# that runs the rest of the validation. We CORRUPT the materialized core so that IF
# the import ran before the bundle check, the launcher would surface a DISTINCT
# import-time (INTERNAL) failure — the contrast proves the ordering. ---
FHL="$(mktemp -d)"; trap 'rm -rf "$SRC" "$FHOME" "$FHL" 2>/dev/null' EXIT INT TERM
mkdir -p "$FHL/.claude/skills"
HOME="$FHL" node "$MIG" materialize --host claude --repo-root "$SRC" --skills-path "$FHL/.claude/skills" >/dev/null 2>&1
LBIN="$FHL/.svc/enforcement/1/bin/svc-enforce"
LCORE="$FHL/.svc/enforcement/1/lib/enforcement-core.mjs"
if [ -f "$LBIN" ] && [ -f "$LCORE" ]; then
  # Corrupt the core: a valid bundle would import this and crash (INTERNAL).
  printf 'this is @@@ not valid javascript' > "$LCORE"
  # Control: ancestry still SECURE → bootstrap passes → the corrupt core IS imported
  # → an import-time failure signature appears (proves the import path is reached).
  CTL="$(echo '{}' | HOME="$FHL" node "$LBIN" svc-task-completion-guard 2>&1)"
  if echo "$CTL" | grep -q 'SVC-ENFORCE-INTERNAL'; then
    pass "R3-F002 control: with a SECURE bundle the corrupt core is imported (import-time failure observed)"
  else
    fail "R3-F002 control: expected an import-time (INTERNAL) signature on a secure bundle (got: $(echo "$CTL" | tr '\n' '|' | head -c 200))"
  fi
  # Now make a bundle ANCESTOR group/other-writable → bootstrap must DENY first.
  chmod 0777 "$FHL/.svc/enforcement/1"
  INS="$(echo '{}' | HOME="$FHL" node "$LBIN" svc-task-completion-guard 2>&1)"; INSRC=$?
  if [ "$INSRC" -ne 0 ] && echo "$INS" | grep -q 'SVC-ENFORCE-INSECURE-BUNDLE'; then
    pass "R3-F002: launcher FAILS CLOSED (deny) on a group/other-writable bundle ancestor"
  else
    fail "R3-F002: writable bundle ancestor not refused (rc=$INSRC out=$(echo "$INS" | tr '\n' '|' | head -c 200))"
  fi
  # The deny came from the bootstrap check, NOT from importing the corrupt core:
  # the INTERNAL import signature must be ABSENT (import never happened).
  if echo "$INS" | grep -q 'SVC-ENFORCE-INTERNAL'; then
    fail "R3-F002: launcher imported the core BEFORE the bundle check (INTERNAL leaked through)"
  else
    pass "R3-F002: the bundle check runs BEFORE the dynamic import (no import-time signature on the insecure run)"
  fi
  chmod 0755 "$FHL/.svc/enforcement/1" 2>/dev/null || true
  # Symlinked bundle ancestor variant — also refused fail-closed.
  ELSED="$(mktemp -d)"; rm -rf "$FHL/.svc/enforcement/1/lib"; mkdir -p "$ELSED"
  ln -s "$ELSED" "$FHL/.svc/enforcement/1/lib"
  SYM="$(echo '{}' | HOME="$FHL" node "$LBIN" svc-task-completion-guard 2>&1)"; SYMRC=$?
  if [ "$SYMRC" -ne 0 ] && echo "$SYM" | grep -q 'SVC-ENFORCE-INSECURE-BUNDLE'; then
    pass "R3-F002: launcher FAILS CLOSED on a SYMLINKED bundle ancestor too"
  else
    fail "R3-F002: symlinked bundle ancestor not refused (rc=$SYMRC out=$(echo "$SYM" | tr '\n' '|' | head -c 200))"
  fi
  rm -rf "$ELSED"
else
  fail "R3-F002: could not materialize a bundle for the ancestry test"
fi
rm -rf "$FHL"; trap 'rm -rf "$SRC" "$FHOME" 2>/dev/null' EXIT INT TERM

# --- Case M (R3-F002 core): assertSecureAncestry rejects a group/other-writable
# component, not only a symlinked/foreign-owned one. ---
node -e '
  const fs=require("fs"), os=require("os"), path=require("path"), cp=require("child_process");
  (async () => {
    const core = await import(process.argv[1]);
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "svc-r3f002-anc-"));
    const mid = path.join(root, "mid"); const leaf = path.join(mid, "leaf");
    fs.mkdirSync(leaf, { recursive: true });
    fs.chmodSync(root, 0o700); fs.chmodSync(leaf, 0o700);
    // Secure chain passes.
    let ok1=false; try { core.assertSecureAncestry(leaf, root); ok1=true; } catch {}
    // Make the middle component group/other-writable → must throw.
    fs.chmodSync(mid, 0o777);
    let threw=false, msg=""; try { core.assertSecureAncestry(leaf, root); } catch(e){ threw=true; msg=e.message; }
    fs.rmSync(root, { recursive:true, force:true });
    process.exit((ok1 && threw && /WRITABLE-ANCESTOR/.test(msg)) ? 0 : 1);
  })();
' "$SRC/hooks/lib/enforcement-core.mjs" \
  && pass "R3-F002: assertSecureAncestry throws WRITABLE-ANCESTOR on a group/other-writable component" \
  || fail "R3-F002: assertSecureAncestry did not reject a group/other-writable ancestor component"

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
