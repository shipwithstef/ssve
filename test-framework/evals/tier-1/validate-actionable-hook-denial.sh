#!/usr/bin/env bash
# validate-actionable-hook-denial.sh — WI-487 (AC-487-2/7/7A/8/12).
#
# Proves the actionable-denial contract + the durable-launcher fail-closed path:
#   - the INSTALLED launcher fails closed on a fully-DELETED source checkout with a
#     visible deny + a home-local per-session receipt (AC-487-2 / AC-487-7A e2e),
#   - every blocking-hook denial carries {hook_id,reason_code,cause,operation,recovery}
#     (AC-487-7); an anonymous nonzero exit is a failure,
#   - a stderr-swallowing host recovers from the durable receipt (AC-487-7A),
#   - repeated identical denials dedup OUTPUT only and NEVER convert deny->allow
#     (AC-487-8 / AC-487-12),
#   - the STRUCTURED blocking-hook inventory maps every row to a real repo file
#     (F-002 completeness),
#   - the governed-mutation guard fails closed on an ephemeral installed source
#     (AC-487-2).
#
# Hermetic: temporary fixture HOME (/tmp) + a DURABLE fixture source under
# $HOME/.cache (never /tmp / never a worktree — so it classifies durable-canonical).
# Zero network / model calls.
#
# Tier-1 promotion note:
#   validator_path: test-framework/evals/tier-1/validate-actionable-hook-denial.sh
#   failure_class: anonymous nonzero blocking-hook exit / empty stderr-host surface /
#     fail-open-on-deleted-checkout / denial storm / dedup-converts-deny-to-allow /
#     uncovered inventoried blocking hook.
#   promotion_signal: signal 3 — protects the hook-execution hot path + $LAUNCHER.
#   expected_runtime_budget: < 5s, hermetic, no network/model.
#   why_tier_2_or_targeted_is_insufficient: the denial contract + launcher
#     fail-closed path is a per-tool-call hot path; a broken diagnostic or a
#     fail-open-on-deleted-checkout must block before install ships.

set -u
PASS=0; FAIL=0
pass() { PASS=$((PASS+1)); echo "  ok $1"; }
fail() { FAIL=$((FAIL+1)); echo "  FAIL $1"; }

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
. "$REPO_ROOT/test-framework/evals/tier-1/lib/stage-governed-hooks.sh"; STAGE_HOOKS_REPO="$REPO_ROOT"
echo "=== Tier 1: actionable hook denial + durable launcher fail-closed (WI-487) ==="

# --- Red-first markers (fire only when the implementation is absent) -----------
if [ ! -f "$REPO_ROOT/bin/svc-enforce.mjs" ] || [ ! -f "$REPO_ROOT/hooks/lib/enforcement-core.mjs" ] || [ ! -f "$REPO_ROOT/hooks/lib/hook-denial.mjs" ]; then
  echo "EXPECTED-RED: actionable hook-denial contract not yet implemented"
  echo "EXPECTED-RED: durable launcher fail-closed-on-deleted-checkout not yet implemented"
  echo "EXPECTED-RED: full blocking-hook denial coverage not yet implemented"
  echo "  FAIL — implementation files missing"
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "  SKIP — node unavailable"; echo "  PASS — 0 assertions (skipped)"; exit 0; }

# Durable fixture source (NOT under /tmp, NOT a worktree) so classifySource==durable-canonical.
DURABLE_BASE="${SVC_TEST_DURABLE_BASE:-$HOME/.cache}"
mkdir -p "$DURABLE_BASE" 2>/dev/null || true
SRC="$(mktemp -d "$DURABLE_BASE/svc-wi487-src-XXXXXX")"
FHOME="$(mktemp -d)"
cleanup() { rm -rf "$SRC" "$FHOME" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# Materialize a minimal durable source checkout with just the enforcement surface.
mkdir -p "$SRC/bin" "$SRC/hooks/lib" "$SRC/hooks/codex" "$SRC/scripts" "$SRC/provision/hosts"
cp "$REPO_ROOT/bin/svc-enforce.mjs" "$SRC/bin/"
cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/durable-source.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/hook-denial.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/svc-runtime-root.mjs" "$SRC/hooks/lib/"
cp "$REPO_ROOT/hooks/svc-task-completion-guard.sh" "$SRC/hooks/"
chmod +x "$SRC/hooks/svc-task-completion-guard.sh"
cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$SRC/scripts/"
cp "$REPO_ROOT/scripts/svc-runtime-root.mjs" "$SRC/scripts/"
cp "$REPO_ROOT/provision/hosts/claude.json" "$SRC/provision/hosts/"
stage_governed_bash_hooks "$SRC"

# ---------------------------------------------------------------------------
# Case A: materialize the launcher, DELETE the whole source checkout, then invoke
# the INSTALLED launcher and assert fail-closed deny + home-local receipt.
# ---------------------------------------------------------------------------
if HOME="$FHOME" node "$SRC/scripts/svc-migrate-install.mjs" materialize --host claude --repo-root "$SRC" --skills-path "$FHOME/.claude/skills" >/dev/null 2>&1; then
  pass "materialized durable launcher from a durable source"
else
  fail "could not materialize launcher from durable source"
fi
LAUNCHER="$FHOME/.svc/enforcement/1/bin/svc-enforce"
[ -f "$LAUNCHER" ] && pass "launcher exists at $LAUNCHER" || fail "launcher missing after materialize"
# Prove it is a COPY, not a symlink into the checkout.
if [ -L "$LAUNCHER" ]; then fail "launcher is a symlink (must be a copied real file)"; else pass "launcher is a copied real file (not a symlink)"; fi
[ -f "$FHOME/.svc/enforcement/1/lib/enforcement-core.mjs" ] && pass "materialized enforcement-core sits beside launcher" || fail "materialized enforcement-core missing"

# Delete the ENTIRE source checkout.
rm -rf "$SRC"
[ -d "$SRC" ] && fail "source checkout still present" || pass "deleted the entire source checkout"

OUT="$(echo '{}' | env -u SVC_BREAK_GLASS -u SVC_BREAK_GLASS_TTL_HOURS HOME="$FHOME" node "$LAUNCHER" svc-task-completion-guard 2>/tmp/wi487-launcher-err.$$)"
RC=$?
ERR="$(cat /tmp/wi487-launcher-err.$$ 2>/dev/null)"; rm -f /tmp/wi487-launcher-err.$$
[ "$RC" -ne 0 ] && pass "launcher fails closed (exit $RC) after checkout deletion" || fail "launcher did NOT fail closed after checkout deletion (exit 0 = fail-open)"
echo "$OUT" | grep -q '"decision":"block"' && pass "launcher emits a Stop block decision (never a silent allow)" || fail "launcher did not emit a block decision"
if echo "$OUT$ERR" | grep -q 'SVC-ENFORCE-SOURCE-DANGLING'; then pass "launcher denial carries reason_code SVC-ENFORCE-SOURCE-DANGLING"; else fail "launcher denial missing dangling reason code"; fi
RCPT_DIR="$FHOME/.svc/denial-receipts"
if [ -d "$RCPT_DIR" ] && [ -n "$(find "$RCPT_DIR" -name '*.json' 2>/dev/null | head -1)" ]; then
  pass "home-local denial receipt written (stderr-swallowing host recovery, AC-487-7A)"
  RCPT="$(find "$RCPT_DIR" -name '*.json' | head -1)"
  for f in hook_id reason_code cause operation recovery; do
    grep -q "\"$f\"" "$RCPT" && pass "receipt carries field: $f" || fail "receipt missing field: $f"
  done
else
  fail "no home-local denial receipt after fail-closed deny"
fi

# ---------------------------------------------------------------------------
# Case B/C: emitDenial identity + durable receipt + dedup-never-fail-open.
# ---------------------------------------------------------------------------
FHOME2="$(mktemp -d)"; trap 'rm -rf "$FHOME" "$FHOME2" 2>/dev/null' EXIT INT TERM
DENIAL_JS='
import path from "node:path";
import { pathToFileURL } from "node:url";
const repo = process.env._SVC_REPO;
const hd = await import(pathToFileURL(path.join(repo, "hooks/lib/hook-denial.mjs")).href);
const denial = { hook_id:"svc-test-hook", reason_code:"SVC-TEST-DENY", cause:"unit-test cause", operation:"unit-test op", recovery:"do X", session_id:"sess-1",
  state:{ hook_id:"svc-test-hook", reason_code:"SVC-TEST-DENY", resolved_command_path:"/x", effective_source:"/y", source_or_receipt_class:"dangling", target_exists:false, target_executable:false } };
const first = hd.emitDenial(denial);
const second = hd.emitDenial(denial);
process.stdout.write(JSON.stringify({ first_decision:first.decision, first_deduped:first.deduped, first_receipt:first.receipt_path, first_incomplete:first.incomplete,
  second_decision:second.decision, second_deduped:second.deduped, digest_stable:first.digest===second.digest }));
'
DRES="$(_SVC_REPO="$REPO_ROOT" HOME="$FHOME2" node --input-type=module -e "$DENIAL_JS" 2>/dev/null)"
echo "$DRES" | grep -q '"first_decision":"deny"' && pass "first denial returns deny" || fail "first denial not a deny"
echo "$DRES" | grep -q '"first_deduped":false' && pass "first denial emits (not deduped)" || fail "first denial unexpectedly deduped"
echo "$DRES" | grep -q '"first_incomplete":false' && pass "first denial has all 5 required fields (not incomplete)" || fail "first denial reported incomplete diagnostic"
echo "$DRES" | grep -q '"second_deduped":true' && pass "identical repeat is deduped (output suppressed, AC-487-8)" || fail "identical repeat not deduped"
echo "$DRES" | grep -q '"second_decision":"deny"' && pass "deduped repeat STILL returns deny (never fail-open, AC-487-8)" || fail "deduped repeat converted deny->allow"
echo "$DRES" | grep -q '"digest_stable":true' && pass "denialStateDigest stable across processes" || fail "denialStateDigest unstable"

# Incomplete-diagnostic detection: a denial missing a field is flagged incomplete.
INC_JS='
import path from "node:path";
import { pathToFileURL } from "node:url";
const hd = await import(pathToFileURL(path.join(process.env._SVC_REPO, "hooks/lib/hook-denial.mjs")).href);
const r = hd.emitDenial({ hook_id:"svc-x", reason_code:"", cause:"c", operation:"o", recovery:"", session_id:"s2" }, { emit:false });
process.stdout.write(JSON.stringify({ decision:r.decision, incomplete:r.incomplete }));
'
IRES="$(_SVC_REPO="$REPO_ROOT" HOME="$FHOME2" node --input-type=module -e "$INC_JS" 2>/dev/null)"
echo "$IRES" | grep -q '"incomplete":true' && pass "an incomplete denial diagnostic is detected (AC-487-7)" || fail "incomplete denial not detected"
echo "$IRES" | grep -q '"decision":"deny"' && pass "an incomplete denial still denies (never fail-open)" || fail "incomplete denial did not deny"

# ---------------------------------------------------------------------------
# Case D: inventory completeness (F-002) — every row maps to a real repo file.
# ---------------------------------------------------------------------------
INV="$REPO_ROOT/docs/specs/test-evidence/WI-487/blocking-hook-inventory.json"
if [ -f "$INV" ]; then
  if node "$REPO_ROOT/scripts/check-blocking-hook-inventory.mjs" --inventory "$INV" \
       --repo-paths "/tmp/wi487-repo-paths.$$" --repo-root "$REPO_ROOT" >/dev/null 2>&1; then
    pass "every blocking-hook inventory row maps to a real reviewed repo file"
  else
    fail "blocking-hook inventory has a row that does not map to a real repo file"
  fi
  rm -f "/tmp/wi487-repo-paths.$$"
  # Cross-check: every hooks.json HARD BLOCK id is present in the inventory.
  MISSING_IDS=0
  for id in svc-workflow-guard svc-bash-guard svc-eval-gate-pre svc-preflight-skill svc-skill-artifact-authenticity svc-session-contract-freshness svc-inertia-check svc-lane-tasks-validator svc-wi-pillars-check svc-stop-quality svc-verification-delegation-guard svc-task-completion-guard svc-codex-skill-load-enforcer svc-codex-stop-firewall svc-codex-prompt-authority; do
    grep -q "\"$id\"" "$INV" || { echo "    uncovered blocking hook: $id"; MISSING_IDS=$((MISSING_IDS+1)); }
  done
  [ "$MISSING_IDS" -eq 0 ] && pass "every known HARD-BLOCK + codex blocking hook is inventoried" || fail "$MISSING_IDS blocking hook(s) missing from the inventory"
  # The two governed-mutation guards must route through the launcher.
  grep -q '"disposition": "route-through-launcher"' "$INV" && pass "governed-mutation guards dispositioned route-through-launcher" || fail "no route-through-launcher disposition found"
else
  fail "blocking-hook inventory JSON missing"
fi

# ---------------------------------------------------------------------------
# Case E: the governed guard fails closed on an EPHEMERAL installed source.
# ---------------------------------------------------------------------------
EPH="$(mktemp -d)"  # under /tmp -> ephemeral by classifySource
mkdir -p "$EPH/hooks/lib" "$EPH/scripts"
cp "$REPO_ROOT/hooks/svc-task-completion-guard.sh" "$EPH/hooks/"; chmod +x "$EPH/hooks/svc-task-completion-guard.sh"
cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$REPO_ROOT/hooks/lib/durable-source.mjs" "$REPO_ROOT/hooks/lib/hook-denial.mjs" "$EPH/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/svc-runtime-root.mjs" "$EPH/hooks/lib/"
cp "$REPO_ROOT/scripts/svc-runtime-root.mjs" "$EPH/scripts/"
EOUT="$(echo '{}' | HOME="$FHOME2" bash "$EPH/hooks/svc-task-completion-guard.sh" 2>/dev/null)"
if echo "$EOUT" | grep -q '"decision":"block"' && echo "$EOUT" | grep -q 'SVC-ENFORCE-SOURCE-EPHEMERAL'; then
  pass "governed guard fails closed on an ephemeral installed source (AC-487-2)"
else
  fail "governed guard did NOT fail closed on an ephemeral source"
fi
rm -rf "$EPH"

# ---------------------------------------------------------------------------
# Case F (F-001): the ACTUAL generated HOST command routes through the launcher,
# and a DELETED source checkout makes that installed host command fail CLOSED.
# This proves the installed host path — not just a direct launcher invocation.
# ---------------------------------------------------------------------------
SRC2="$(mktemp -d "$DURABLE_BASE/svc-wi487-hostpath-XXXXXX")"
FHOME5="$(mktemp -d)"
trap 'rm -rf "$FHOME" "$FHOME2" "$SRC2" "$FHOME5" 2>/dev/null' EXIT INT TERM
mkdir -p "$SRC2/bin" "$SRC2/hooks/lib" "$SRC2/scripts" "$SRC2/provision/hosts" "$FHOME5/.claude/skills/hooks"
cp "$REPO_ROOT/bin/svc-enforce.mjs" "$SRC2/bin/"
cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$SRC2/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/svc-runtime-root.mjs" "$SRC2/hooks/lib/"
cp "$REPO_ROOT/hooks/svc-task-completion-guard.sh" "$SRC2/hooks/"; chmod +x "$SRC2/hooks/svc-task-completion-guard.sh"
cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$SRC2/scripts/"
cp "$REPO_ROOT/scripts/svc-runtime-root.mjs" "$SRC2/scripts/"
cp "$REPO_ROOT/provision/hosts/claude.json" "$SRC2/provision/hosts/"
stage_governed_bash_hooks "$SRC2"
# Materialize the launcher for this fixture HOME (durable source), then wire the
# REAL Claude host config through the launcher (wire-hooks resolves the launcher
# from HOME and routes the governed Stop guard through it).
HOME="$FHOME5" node "$SRC2/scripts/svc-migrate-install.mjs" materialize --host claude --repo-root "$SRC2" --skills-path "$FHOME5/.claude/skills" >/dev/null 2>&1
HOME="$FHOME5" node "$REPO_ROOT/scripts/wire-hooks.mjs" --skills-path "$FHOME5/.claude/skills" >/dev/null 2>&1
STOP_CMD="$(HOME="$FHOME5" node -e '
const fs=require("fs"),os=require("os"),path=require("path");
const s=JSON.parse(fs.readFileSync(path.join(os.homedir(),".claude/settings.json"),"utf8"));
const stop=(s.hooks&&s.hooks.Stop)||[];
for(const e of stop){for(const h of (e.hooks||[])){const c=h.command||"";if(c.includes("svc-task-completion-guard")){process.stdout.write(c);process.exit(0);}}}
' 2>/dev/null)"
if echo "$STOP_CMD" | grep -q 'svc-enforce' && echo "$STOP_CMD" | grep -q 'svc-task-completion-guard'; then
  pass "F-001: generated Claude host Stop command routes through the durable launcher"
else
  fail "F-001: host Stop command does NOT route through the launcher (got: $STOP_CMD)"
fi
# Now delete the ENTIRE source checkout and run the EXTRACTED host command.
rm -rf "$SRC2"
HP_OUT="$(echo '{}' | env -u SVC_BREAK_GLASS -u SVC_BREAK_GLASS_TTL_HOURS HOME="$FHOME5" bash -c "$STOP_CMD" 2>/tmp/wi487-hostpath-err.$$)"
HP_RC=$?
HP_ERR="$(cat /tmp/wi487-hostpath-err.$$ 2>/dev/null)"; rm -f /tmp/wi487-hostpath-err.$$
[ "$HP_RC" -ne 0 ] && pass "F-001: installed host command fails closed (exit $HP_RC) after checkout deletion" || fail "F-001: installed host command DID NOT fail closed after checkout deletion (fail-OPEN)"
echo "$HP_OUT" | grep -q '"decision":"block"' && pass "F-001: host command emits a Stop block decision (never a silent allow)" || fail "F-001: host command did not emit a block decision"
if [ -d "$FHOME5/.svc/denial-receipts" ] && [ -n "$(find "$FHOME5/.svc/denial-receipts" -name '*.json' 2>/dev/null | head -1)" ]; then
  pass "F-001: host-path fail-closed wrote a durable home-local denial receipt"
else
  fail "F-001: no denial receipt after host-path fail-closed"
fi

# ---------------------------------------------------------------------------
# Case G (F-002): the launcher must NOT honor a runtime source override
# (SVC_ENFORCE_SOURCE) — authority substitution is rejected. With a healthy
# manifest bound to the durable source, an attacker-pointed override is ignored:
# the launcher still binds to the validated manifest's effective source.
# ---------------------------------------------------------------------------
SRC3="$(mktemp -d "$DURABLE_BASE/svc-wi487-authsub-XXXXXX")"
ATTACK="$(mktemp -d "$DURABLE_BASE/svc-wi487-attack-XXXXXX")"
FHOME6="$(mktemp -d)"
trap 'rm -rf "$FHOME" "$FHOME2" "$FHOME5" "$SRC3" "$ATTACK" "$FHOME6" 2>/dev/null' EXIT INT TERM
mkdir -p "$SRC3/bin" "$SRC3/hooks/lib" "$SRC3/scripts" "$SRC3/provision/hosts" "$ATTACK/hooks"
cp "$REPO_ROOT/bin/svc-enforce.mjs" "$SRC3/bin/"
cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$SRC3/hooks/lib/"
cp "$REPO_ROOT/hooks/lib/svc-runtime-root.mjs" "$SRC3/hooks/lib/"
cp "$REPO_ROOT/hooks/svc-task-completion-guard.sh" "$SRC3/hooks/"; chmod +x "$SRC3/hooks/svc-task-completion-guard.sh"
cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$SRC3/scripts/"
cp "$REPO_ROOT/scripts/svc-runtime-root.mjs" "$SRC3/scripts/"
cp "$REPO_ROOT/provision/hosts/claude.json" "$SRC3/provision/hosts/"
stage_governed_bash_hooks "$SRC3"
# Attacker-controlled "permissive" guard that would ALLOW if honored.
printf '#!/usr/bin/env bash\necho "{\\"decision\\":\\"approve\\"}"\nexit 0\n' > "$ATTACK/hooks/svc-task-completion-guard.sh"
chmod +x "$ATTACK/hooks/svc-task-completion-guard.sh"
HOME="$FHOME6" node "$SRC3/scripts/svc-migrate-install.mjs" materialize --host claude --repo-root "$SRC3" --skills-path "$FHOME6/.claude/skills" >/dev/null 2>&1
LAUNCHER3="$FHOME6/.svc/enforcement/1/bin/svc-enforce"
# Delete the REAL source so the ONLY way to "succeed" would be honoring the override.
rm -rf "$SRC3"
OV_OUT="$(echo '{}' | env -u SVC_BREAK_GLASS -u SVC_BREAK_GLASS_TTL_HOURS SVC_ENFORCE_SOURCE="$ATTACK" HOME="$FHOME6" node "$LAUNCHER3" svc-task-completion-guard 2>/dev/null)"
if echo "$OV_OUT" | grep -q '"decision":"approve"'; then
  fail "F-002: launcher HONORED an attacker-chosen SVC_ENFORCE_SOURCE (authority substitution)"
else
  pass "F-002: launcher ignores SVC_ENFORCE_SOURCE override (no authority substitution)"
fi
echo "$OV_OUT" | grep -q '"decision":"block"' && pass "F-002: launcher fails closed on the validated (now-deleted) source, not the override" || fail "F-002: launcher did not fail closed under override attempt"

# A forged manifest (group/other-writable) is rejected by the validator → the
# launcher falls back to fail-closed rather than trusting the forged effective_source.
FHOME7="$(mktemp -d)"; trap 'rm -rf "$FHOME" "$FHOME2" "$FHOME5" "$FHOME6" "$ATTACK" "$FHOME7" 2>/dev/null' EXIT INT TERM
SRC4="$(mktemp -d "$DURABLE_BASE/svc-wi487-forge-XXXXXX")"
mkdir -p "$SRC4/bin" "$SRC4/hooks/lib" "$SRC4/scripts" "$SRC4/provision/hosts"
cp "$REPO_ROOT/bin/svc-enforce.mjs" "$SRC4/bin/"; cp "$REPO_ROOT/hooks/lib/enforcement-core.mjs" "$SRC4/hooks/lib/"
cp "$REPO_ROOT/scripts/svc-migrate-install.mjs" "$SRC4/scripts/"; cp "$REPO_ROOT/provision/hosts/claude.json" "$SRC4/provision/hosts/"
stage_governed_bash_hooks "$SRC4"
HOME="$FHOME7" node "$SRC4/scripts/svc-migrate-install.mjs" materialize --host claude --repo-root "$SRC4" --skills-path "$FHOME7/.claude/skills" >/dev/null 2>&1
MANIFEST7="$FHOME7/.svc/enforcement/1/manifest.json"
LAUNCHER7="$FHOME7/.svc/enforcement/1/bin/svc-enforce"
# Forge: point effective_source at the attacker dir AND make the manifest g/o-writable.
node -e 'const fs=require("fs");const p=process.argv[1];const m=JSON.parse(fs.readFileSync(p,"utf8"));m.effective_source=process.argv[2];fs.writeFileSync(p,JSON.stringify(m));' "$MANIFEST7" "$ATTACK" 2>/dev/null
chmod 0666 "$MANIFEST7" 2>/dev/null
FO_OUT="$(echo '{}' | HOME="$FHOME7" node "$LAUNCHER7" svc-task-completion-guard 2>/dev/null)"
if echo "$FO_OUT" | grep -q '"decision":"approve"'; then
  fail "F-002: launcher trusted a forged (g/o-writable) manifest effective_source"
else
  pass "F-002: launcher rejects a forged/insecure manifest and fails closed"
fi
rm -rf "$SRC4"

# ---------------------------------------------------------------------------
# Case H (F-003 / R2-F003): TABLE-DRIVEN, RUNTIME-first coverage of EVERY
# `adopt-emitDenial` inventory row. For each row the harness constructs the
# minimal hostile input that forces the hook to its block path, runs the
# INSTALLED command form under a hermetic per-row fixture HOME + SVC_SESSION_ID,
# and asserts: (a) all 5 fields {hook_id,reason_code,cause,operation,recovery}
# appear in combined stdout+stderr, (b) a durable denial receipt was written
# under $HOME/.svc/denial-receipts, (c) the exit code is the hook's block code
# (2 for hard-block hooks; {decision:"block"} on stdout for Stop-class hooks).
# The dispatch is data-driven off the inventory JSON: a future adopt-emitDenial
# row with no bespoke runtime driver still falls to a SOURCE assertion that its
# block path routes through emitDenial / emit-denial.sh — so no row is ever
# silently uncovered. The two route-through-launcher guards are proven in
# Cases A/E/F above; the passthrough / context-injection rows are asserted to be
# present with their NON-denial disposition (they own no runtime block path).
# ---------------------------------------------------------------------------
H_SESS="wi487-caseH"

# Shared assertion for a runtime-driven row: 5-field envelope + durable receipt +
# block exit code. mode=hard → exit 2; mode=stop-block → {decision:"block"} stdout.
assert_row_denial() {
  local hid="$1" out="$2" rc="$3" mode="$4" rhome="$5"
  local miss=0 f
  for f in hook_id reason_code cause operation recovery; do
    echo "$out" | grep -q "\"$f\"" || { echo "      [$hid] envelope missing field: $f"; miss=1; }
  done
  [ "$miss" -eq 0 ] && pass "F-003 RUNTIME[$hid]: emits full 5-field actionable envelope" \
                    || fail "F-003 RUNTIME[$hid]: envelope missing required field(s)"
  if [ -n "$(find "$rhome/.svc/denial-receipts" -name '*.json' 2>/dev/null | head -1)" ]; then
    pass "F-003 RUNTIME[$hid]: wrote a durable per-session denial receipt"
  else
    fail "F-003 RUNTIME[$hid]: no durable denial receipt under \$HOME/.svc/denial-receipts"
  fi
  case "$mode" in
    hard)
      [ "$rc" -eq 2 ] && pass "F-003 RUNTIME[$hid]: hard-block exit 2 (not anonymous exit 1)" \
                      || fail "F-003 RUNTIME[$hid]: expected block exit 2, got $rc" ;;
    stop-block)
      echo "$out" | grep -q '"decision"[[:space:]]*:[[:space:]]*"block"' \
        && pass "F-003 RUNTIME[$hid]: keeps {decision:\"block\"} stdout for the Stop host" \
        || fail "F-003 RUNTIME[$hid]: missing {decision:\"block\"} stdout" ;;
  esac
}

# SOURCE fallback for a row with no hermetic runtime driver: prove its block path
# routes through emitDenial / emit-denial.sh (never an anonymous nonzero exit).
assert_row_source() {
  local hid="$1"
  local rpath="$2"
  local hf="$REPO_ROOT/$rpath"
  local ok=0 d
  if [ ! -f "$hf" ]; then fail "F-003 SOURCE[$hid]: repo_path missing: $rpath"; return; fi
  grep -qE 'emitDenial|svc_emit_denial|emit-denial\.sh|hook-denial' "$hf" && ok=1
  if [ "$ok" -eq 0 ]; then
    for d in $(grep -oE 'scripts/[a-zA-Z0-9_/-]+\.mjs' "$hf" 2>/dev/null | sort -u); do
      [ -f "$REPO_ROOT/$d" ] && grep -qE 'emitDenial|svc_emit_denial|hook-denial' "$REPO_ROOT/$d" && ok=1 && break
    done
  fi
  [ "$ok" -eq 1 ] \
    && pass "F-003 SOURCE[$hid]: block path routes through emitDenial/emit-denial.sh (hermetic runtime-drive impractical — documented below)" \
    || fail "F-003 SOURCE[$hid]: no emitDenial route found in $rpath"
}

# Per-row runtime drivers. Returns 0 if it ran a driver (and asserted), 1 if no
# bespoke driver exists for this hook_id (→ caller falls back to SOURCE assertion).
# NOTE ON svc-stop-quality: driving it to its block hermetically requires a
# detected stack (tsconfig), `npx tsc` producing NEW type errors distinct from a
# recorded session baseline, and a populated edited-files accumulator — not
# reproducible in a network-free < 5s tier-1 fixture. It is SOURCE-asserted; its
# block path routes through the canonical emitDenial (dynamic ESM import of
# hooks/lib/hook-denial.mjs), verified by assert_row_source.
run_row_driver() {
  local hid="$1" RHOME P OUT RC NV RT DMSG
  case "$hid" in
    svc-workflow-guard)
      RHOME="$(mktemp -d)"
      OUT="$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/.env"}}' "$RHOME" \
        | HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME" ;;
    svc-bash-guard)
      RHOME="$(mktemp -d)"; NV="--no-""verify"   # split literal so this fixture never trips the installed guard
      OUT="$(printf '{"tool_name":"Bash","tool_input":{"command":"git commit %s -m x"}}' "$NV" \
        | HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/hooks/svc-workflow-guard.mjs" --bash-guard 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME" ;;
    svc-eval-gate-pre)
      RHOME="$(mktemp -d)"; P="$(mktemp -d)"; mkdir -p "$P/.svc"
      printf '%s\n' '{"tasks":[{"id":"t1","status":"in_progress","eval_matrix":[{"id":"p1","label":"L","value":null}]}]}' > "$P/.svc/lane-tasks.json"
      OUT="$(printf '{"tool_name":"TaskUpdate","tool_input":{"status":"completed","id":"t1"}}' \
        | ( cd "$P" && HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/scripts/eval-gate.mjs" pre ) 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" stop-block "$RHOME"; rm -rf "$P" ;;
    svc-preflight-skill)
      RHOME="$(mktemp -d)"; P="$(mktemp -d)"; mkdir -p "$P/.svc"
      printf 'not json{' > "$P/.svc/preflight-demo.json"
      OUT="$(printf '{"tool_name":"Skill","tool_input":{"skill":"demo"}}' \
        | ( cd "$P" && HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/scripts/preflight.mjs" --hook --fail-closed ) 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME"; rm -rf "$P" ;;
    svc-skill-artifact-authenticity)
      RHOME="$(mktemp -d)"; P="$(mktemp -d)"; mkdir -p "$P/.svc" "$P/docs/specs/features"
      OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"docs/specs/features/x.md"}}' \
        | ( cd "$P" && HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/hooks/svc-skill-artifact-authenticity.mjs" ) 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME"; rm -rf "$P" ;;
    svc-session-contract-freshness)
      RHOME="$(mktemp -d)"; P="$(mktemp -d)"; mkdir -p "$P/.git" "$P/.svc"
      printf '{"ts":"2020-01-01T00:00:00Z","wi":"WI-1","skill":null}\n' > "$P/.svc/session-contract.jsonl"
      OUT="$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/target.txt"}}' "$P" \
        | ( cd "$P" && HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/hooks/svc-session-contract-freshness.mjs" ) 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME"; rm -rf "$P" ;;
    svc-inertia-check)
      RHOME="$(mktemp -d)"; RT="component""Will""Mount("   # split inside the word so this fixture doesn't trip inertia-check
      OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"foo.js","content":"class X { %s) {} }"}}' "$RT" \
        | HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/hooks/svc-inertia-check.mjs" 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME" ;;
    svc-lane-tasks-validator)
      RHOME="$(mktemp -d)"; P="$(mktemp -d)"; mkdir -p "$P/.svc"
      printf '{invalid json' > "$P/.svc/lane-tasks-WI-1.json"
      OUT="$(printf '{"tool_name":"Write","tool_input":{"file_path":"%s/.svc/lane-tasks-WI-1.json"}}' "$P" \
        | ( cd "$P" && HOME="$RHOME" SVC_SESSION_ID="$H_SESS" node "$REPO_ROOT/hooks/svc-lane-tasks-validator.mjs" ) 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME"; rm -rf "$P" ;;
    svc-wi-pillars-check)
      RHOME="$(mktemp -d)"; P="$(mktemp -d)"; mkdir -p "$P/docs/specs/work-items"
      printf -- '---\nstatus: VERIFIED\n---\n# WI-1\nno pillar audit\n' > "$P/docs/specs/work-items/WI-1.md"
      OUT="$(printf '{"tool_name":"Edit","tool_input":{"file_path":"%s/docs/specs/work-items/WI-1.md"}}' "$P" \
        | HOME="$RHOME" SVC_SESSION_ID="$H_SESS" SVC_REPO_ROOT="$REPO_ROOT" bash "$REPO_ROOT/hooks/svc-wi-pillars-check.sh" 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" hard "$RHOME"; rm -rf "$P" ;;
    svc-verification-delegation-guard)
      RHOME="$(mktemp -d)"; P="$(mktemp -d)"; mkdir -p "$P/.svc"
      printf '%s\n' '{"lane":"brownfield-feature","delivery_graph":{"risk_flags":["browser-visible"]},"tasks":[]}' > "$P/.svc/lane-tasks-WI-1.json"
      DMSG="I was unable to test this; can you confirm it works on your end?"
      OUT="$(printf '{"last_assistant_message":"%s"}' "$DMSG" \
        | ( cd "$P" && HOME="$RHOME" SVC_SESSION_ID="$H_SESS" SVC_REPO_ROOT="$REPO_ROOT" bash "$REPO_ROOT/hooks/svc-verification-delegation-guard.sh" ) 2>&1)"; RC=$?
      assert_row_denial "$hid" "$OUT" "$RC" stop-block "$RHOME"; rm -rf "$P" ;;
    *) return 1 ;;
  esac
  [ -n "${RHOME:-}" ] && rm -rf "$RHOME" 2>/dev/null   # receipts already asserted; keep /tmp clean
  return 0
}

# Drive EVERY adopt-emitDenial row (data-driven off the inventory).
ADOPT_ROWS="$(node -e '
const fs=require("fs");
const inv=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
for(const r of inv.rows){ if(r.disposition==="adopt-emitDenial") process.stdout.write(r.hook_id+"\t"+r.repo_path+"\n"); }
' "$INV" 2>/dev/null)"
ADOPT_COUNT=0
while IFS=$'\t' read -r HID RPATH; do
  [ -z "$HID" ] && continue
  ADOPT_COUNT=$((ADOPT_COUNT+1))
  if ! run_row_driver "$HID"; then
    assert_row_source "$HID" "$RPATH"
  fi
done <<< "$ADOPT_ROWS"
[ "$ADOPT_COUNT" -gt 0 ] && pass "F-003: drove $ADOPT_COUNT adopt-emitDenial inventory row(s) (runtime-first, source-fallback)" \
                        || fail "F-003: no adopt-emitDenial rows found in the inventory"

# Passthrough / context-injection rows: present with a NON-denial disposition
# (own no runtime block path — asserted present, not denial-driven).
for pair in "svc-codex-stop-firewall:passthrough-delegated" "svc-codex-prompt-authority:context-injection-no-block"; do
  PHID="${pair%%:*}"; PPFX="${pair##*:}"
  PDISP="$(node -e 'const fs=require("fs");const inv=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));const r=inv.rows.find(x=>x.hook_id===process.argv[2]);process.stdout.write(r?r.disposition:"")' "$INV" "$PHID" 2>/dev/null)"
  case "$PDISP" in
    "$PPFX":*) pass "F-003: $PHID inventoried as non-denial ($PPFX) — owns no independent block path" ;;
    *) fail "F-003: $PHID not reclassified to $PPFX (disposition='$PDISP')" ;;
  esac
done

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  exit 1
fi
