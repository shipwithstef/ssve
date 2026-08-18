#!/usr/bin/env bash
# Tier 1: WI-546 Cursor live-acceptance.
#
# Composes landed child validators (WI-545/547/549/550/551/552) and adds the
# Cursor-host glue AC-546-1/2/4/6/7 cannot get from registration-only checks.
#
# validator_path: test-framework/evals/tier-1/validate-wi546-cursor-live-acceptance.sh
# failure_class: host registration reported as behavioral Cursor parity
# expected_runtime_budget: <90s, hermetic isolated HOME for setup; no paid provider; no AGY rerun
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
export SVC_SESSION_ID="${SVC_SESSION_ID:-svc-impl-wi546-01a01070}"
export SVC_HOST="${SVC_HOST:-cursor}"

PASS=0
FAIL=0
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

echo "=== Tier 1: WI-546 Cursor live-acceptance ==="
echo "  model_id_required: cursor-grok-4.6-high"
echo "  usage_pool: Cursor Grok 4.6 High (not Anthropic Sonnet)"

# ---------------------------------------------------------------------------
# AC-546-7: matrix documents Cursor differences
# ---------------------------------------------------------------------------
MATRIX="docs/specs/architecture/wi-548-capability-matrix.md"
if [[ -f "$MATRIX" ]] \
  && grep -q 'hooks.json' "$MATRIX" \
  && grep -q 'exit-code-2\|exit code 2' "$MATRIX" \
  && grep -q 'no native Task UI' "$MATRIX" \
  && grep -q 'fresh_session_launch.enabled=false' "$MATRIX" \
  && grep -q 'validate-wi546-cursor-live-acceptance.sh' "$MATRIX"; then
  pass "AC-546-7: capability matrix documents Cursor differences and this fixture"
else
  fail "AC-546-7: capability matrix missing Cursor difference/fixture coverage"
fi

# ---------------------------------------------------------------------------
# AC-546-7 diffs 1-2,4: Cursor manifest + wirer + adapter contract
# ---------------------------------------------------------------------------
node --check scripts/wire-cursor-hooks.mjs >/dev/null 2>&1 \
  && pass "wire-cursor-hooks.mjs parses" \
  || fail "wire-cursor-hooks.mjs syntax error"
bash -n hooks/cursor/svc-cursor-task-completion-guard.sh \
  && pass "Cursor Stop adapter bash syntax valid" \
  || fail "Cursor Stop adapter syntax error"

MODE="$(git ls-files -s -- hooks/cursor/svc-cursor-task-completion-guard.sh | awk '{print $1}')"
[[ "$MODE" == "100755" ]] \
  && pass "AC-546-1/2: Cursor Stop adapter is git mode 100755" \
  || fail "Cursor Stop adapter git mode is '${MODE:-missing}', expected 100755"

node --input-type=module - "$ROOT" <<'NODE' && pass "Cursor host manifest declares hooks.json / no matcher / no Task UI / launch disabled" || fail "Cursor host manifest drifted from documented differences"
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.argv[2];
const m = JSON.parse(fs.readFileSync(path.join(root, "provision/hosts/cursor.json"), "utf8"));
assert.equal(m.host, "cursor");
assert.equal(m.hook_quirks?.config_file?.includes("hooks.json"), true);
assert.equal(m.hook_quirks?.config_format, "json");
assert.equal(m.hook_quirks?.tool_matcher_regex, false);
assert.equal(m.hook_quirks?.decision_format, "exit-code-2-blocks");
assert.match(String(m.task_graph?.task_ui || ""), /none/i);
assert.equal(m.authority_capabilities?.fresh_session_launch?.enabled, false);
assert.deepEqual(m.hook_events, ["beforeShellExecution", "afterFileEdit", "sessionStart", "stop"]);
assert.equal(m.wiring?.wirer, "scripts/wire-cursor-hooks.mjs");
assert.ok((m.wiring?.governed_token || []).includes("svc-cursor-task-completion-guard"));
NODE

grep -q 'sessionStart' scripts/wire-cursor-hooks.mjs \
  && grep -q 'svc-session-start-healthcheck' scripts/wire-cursor-hooks.mjs \
  && grep -q 'svc-cursor-task-completion-guard' scripts/wire-cursor-hooks.mjs \
  && pass "AC-546-2: wirer declares sessionStart healthcheck + Stop adapter" \
  || fail "wirer missing declared SessionStart/Stop adapters"

# ---------------------------------------------------------------------------
# AC-546-1: worktree setup refuses (AP-30); isolated non-worktree source succeeds
# ---------------------------------------------------------------------------
set +e
WT_OUT="$(./setup --host cursor 2>&1)"
WT_RC=$?
set -uo pipefail
if [[ "$WT_RC" -ne 0 ]] && echo "$WT_OUT" | grep -q 'Refusing to install'; then
  pass "AC-546-7 #6: ./setup --host cursor from this worktree refuses (AP-30)"
else
  fail "worktree ./setup --host cursor should refuse without canonical override (rc=$WT_RC)"
fi

ISO_HOME="$(mktemp -d)"
CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}"
mkdir -p "$CACHE_ROOT"
ISO_SRC="$(mktemp -d "$CACHE_ROOT/svc-wi546-src-XXXXXX")"
ISO_STATE="$ISO_HOME/.svc/setup-state"
cleanup_iso() { rm -rf "$ISO_HOME" "$ISO_SRC" 2>/dev/null || true; }
trap cleanup_iso EXIT

mkdir -p "$ISO_HOME/.svc"
chmod 700 "$ISO_HOME/.svc"
# Setup refuses a symlinked skills root and each skills/<name>/SKILL.md.
# Hardlink-copy the package so SCRIPT_DIR is a real directory outside .worktrees/.
cp "$ROOT/setup" "$ISO_SRC/setup"
chmod +x "$ISO_SRC/setup"
cp -al "$ROOT/skills" "$ISO_SRC/skills"
cp -al "$ROOT/scripts" "$ISO_SRC/scripts"
cp -al "$ROOT/bin" "$ISO_SRC/bin"
cp -al "$ROOT/hooks" "$ISO_SRC/hooks"
cp -al "$ROOT/provision" "$ISO_SRC/provision"
for d in references proposals examples agents templates _shared concerns; do
  cp -al "$ROOT/$d" "$ISO_SRC/$d"
done
for f in DOCTRINE.md REPO_MODES.md WORKTREES.md EXTERNAL_ADDONS.md FRAMEWORK-STATE.md \
         skills-manifest.json CONTRIBUTING.md AGENTS.md; do
  cp -al "$ROOT/$f" "$ISO_SRC/$f"
done
# Isolated source path must not contain ".worktrees/" so setup does not refuse.
if [[ "$ISO_SRC" == *".worktrees/"* ]]; then
  fail "isolated setup source unexpectedly lives under .worktrees/"
else
  pass "isolated Cursor setup source is outside .worktrees/"
fi

set +e
SETUP_LOG="$ISO_HOME/setup-cursor.log"
HOME="$ISO_HOME" SVC_SETUP_STATE_ROOT="$ISO_STATE" \
  "$ISO_SRC/setup" --host cursor >"$SETUP_LOG" 2>&1
SETUP_RC=$?
set -uo pipefail
if [[ "$SETUP_RC" -eq 0 ]]; then
  pass "AC-546-1: isolated ./setup --host cursor exits 0"
else
  fail "isolated ./setup --host cursor failed (rc=$SETUP_RC)"
  tail -n 40 "$SETUP_LOG" || true
fi

set +e
DRIFT_LOG="$ISO_HOME/drift-cursor.log"
HOME="$ISO_HOME" bash "$ISO_SRC/scripts/check-install-drift.sh" --host cursor >"$DRIFT_LOG" 2>&1
DRIFT_RC=$?
set -uo pipefail
if [[ "$DRIFT_RC" -eq 0 ]]; then
  pass "AC-546-1: isolated check-install-drift.sh --host cursor is zero"
else
  fail "isolated check-install-drift.sh --host cursor failed (rc=$DRIFT_RC)"
  cat "$DRIFT_LOG" || true
fi

HOOKS_FILE="$ISO_HOME/.cursor/hooks.json"
if [[ -f "$HOOKS_FILE" ]] \
  && grep -q 'sessionStart' "$HOOKS_FILE" \
  && grep -q 'svc-session-start-healthcheck' "$HOOKS_FILE" \
  && grep -q 'stop' "$HOOKS_FILE" \
  && grep -q 'svc-cursor-task-completion-guard' "$HOOKS_FILE"; then
  pass "AC-546-2: isolated Cursor hooks.json loads SessionStart + Stop adapters"
else
  fail "isolated Cursor hooks.json missing declared SessionStart/Stop adapters"
  [[ -f "$HOOKS_FILE" ]] && python3 -c "print(open('$HOOKS_FILE').read()[:1500])" || true
fi

# Live session (this Cursor CLI) already running: observational, not a mutation.
LIVE_HOOKS_REAL="${SVC_LIVE_HOME:-$(getent passwd "$(id -u)" | cut -d: -f6)}/.cursor/hooks.json"
if [[ -f "$LIVE_HOOKS_REAL" ]] \
  && grep -q 'svc-session-start-healthcheck' "$LIVE_HOOKS_REAL" \
  && grep -q 'svc-cursor-task-completion-guard' "$LIVE_HOOKS_REAL"; then
  pass "AC-546-2: live Cursor session hooks.json already loads declared adapters"
else
  echo "  ! live ~/.cursor/hooks.json not wired (isolated install still covers AC-546-2)"
fi

# ---------------------------------------------------------------------------
# AC-546-3/Stop: Cursor adapter translates block → exit 2
# ---------------------------------------------------------------------------
STOP_TMP="$(mktemp -d)"
git -C "$STOP_TMP" init -q
git -C "$STOP_TMP" config user.email fixture@example.invalid
git -C "$STOP_TMP" config user.name fixture
printf 'seed\n' > "$STOP_TMP/seed.txt"
git -C "$STOP_TMP" add seed.txt
git -C "$STOP_TMP" commit -qm seed
mkdir -p "$STOP_TMP/.svc"
cat > "$STOP_TMP/.svc/lane-tasks-WI-546.json" <<'JSON'
{"wi":"WI-546","lane":"framework","status":"completed","tasks":[]}
JSON
STOP_PAYLOAD="$(printf '{"cwd":"%s","session_id":"svc-impl-wi546-stop"}' "$STOP_TMP")"
set +e
STOP_OUT="$(cd "$STOP_TMP" && printf '%s' "$STOP_PAYLOAD" | bash "$ROOT/hooks/cursor/svc-cursor-task-completion-guard.sh" 2>/dev/null)"
STOP_RC=$?
set -uo pipefail
if [[ "$STOP_RC" -eq 2 ]]; then
  pass "AC-546-3/7: Cursor Stop adapter exits 2 when canonical receipts fail"
else
  fail "Cursor Stop adapter rc=$STOP_RC, expected 2 on missing receipts"
fi
rm -rf "$STOP_TMP"

# ---------------------------------------------------------------------------
# AC-546-4: consume real AGY bytes for f27a143a; do not spawn AGY
# ---------------------------------------------------------------------------
if grep -E 'dispatch-agy|spawnSync\([^)]*run-external-review' \
  scripts/check-chain-receipts.mjs scripts/lib/review-evidence-store.mjs >/dev/null; then
  fail "AC-546-4: consume path references AGY/reviewer launch"
else
  pass "AC-546-4: check-chain-receipts consume path does not launch AGY"
fi

AGY_LOG="$(mktemp)"
if node scripts/check-chain-receipts.mjs --sha f27a143a --wi WI-542 --json >"$AGY_LOG" 2>&1 \
  && grep -q '"ok": true' "$AGY_LOG" \
  && grep -q '"receipt_source": "note"' "$AGY_LOG"; then
  pass "AC-546-4: check-chain-receipts --sha f27a143a consumes notes from this tree/common git dir"
else
  fail "AC-546-4: f27a143a consume failed"
  cat "$AGY_LOG" || true
fi
rm -f "$AGY_LOG"

# ---------------------------------------------------------------------------
# AC-546-6: dispatch traces keep cursor-grok-4.6-high; no Claude/Codex/Sonnet remap
# ---------------------------------------------------------------------------
node --input-type=module - "$ROOT" <<'NODE' && pass "AC-546-6: Cursor EXEC stays cursor-grok-4.6-high; missing policy and sonnet remap fail closed" || fail "AC-546-6: dispatch remap/fail-closed contract broken"
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.argv[2];
const { resolveDispatchModel } = await import(pathToFileURL(path.join(root, "scripts/resolve-dispatch.mjs")).href);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wi546-dispatch-"));
const policyPath = path.join(tmp, "dispatch-policy.json");
const policy = {
  schema_version: 1,
  authority: "repository-owner",
  default_mode: "cursor-grok-high",
  deny: { "*": ["claude-sonnet-5", "claude-opus-5", "gpt-5.6-codex"] },
  allow: {},
  modes: {
    "cursor-grok-high": {
      labels: {
        STRAT: { host: "cursor", family: "xai", model: "cursor-grok-4.6-high", effort: "high" },
        PLAN: { host: "cursor", family: "xai", model: "cursor-grok-4.6-high", effort: "high" },
        EXEC: { host: "cursor", family: "xai", model: "cursor-grok-4.6-high", effort: "high" },
        REVIEW: { host: "cursor", family: "xai", model: "cursor-grok-4.6-high", effort: "high" },
        SENSE: { host: "cursor", family: "xai", model: "cursor-grok-4.6-high", effort: "high" },
        DISC: { host: "cursor", family: "xai", model: "web_search", effort: "high" },
        PASS: { host: "cursor", family: "xai", model: "cursor-grok-4.6-high", effort: "high" },
      },
    },
  },
};
fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });
const resolved = resolveDispatchModel({
  configPath: policyPath,
  label: "EXEC",
  orchestrator: "cursor",
});
assert.equal(resolved.tuple.host, "cursor");
assert.equal(resolved.tuple.model, "cursor-grok-4.6-high");
assert.equal(resolved.harness, "cursor");
assert.notEqual(resolved.tuple.host, "claude");
assert.notEqual(resolved.tuple.host, "codex");
assert.doesNotMatch(resolved.tuple.model, /sonnet|opus|codex|composer/i);

assert.throws(
  () => resolveDispatchModel({
    configPath: path.join(tmp, "missing-policy.json"),
    label: "EXEC",
    orchestrator: "cursor",
  }),
  /missing/,
);
assert.throws(
  () => resolveDispatchModel({ configPath: policyPath, label: "EXEC", orchestrator: "agy" }),
  /reviewer transport only/,
);

const sonnet = structuredClone(policy);
sonnet.modes["cursor-grok-high"].labels.EXEC = {
  host: "claude", family: "anthropic", model: "claude-sonnet-5", effort: "high",
};
fs.writeFileSync(policyPath, `${JSON.stringify(sonnet, null, 2)}\n`);
assert.throws(
  () => resolveDispatchModel({ configPath: policyPath, label: "EXEC", orchestrator: "cursor" }),
  /denied for role "implementor"/,
);
fs.rmSync(tmp, { recursive: true, force: true });
NODE

# Owner ~/.svc/dispatch-policy.json now exists (EXEC = Grok 4.6 high).
# Live resolve must not remap to Sonnet. Missing file still fail-closes.
set +e
LIVE_RESOLVE="$(env -u SVC_DISPATCH_POLICY SVC_HOST=cursor bash scripts/resolve-model.sh EXEC --json 2>&1)"
LIVE_RESOLVE_RC=$?
set -uo pipefail
if echo "$LIVE_RESOLVE" | grep -qi 'claude-sonnet'; then
  fail "live resolve-model EXEC remapped to Sonnet: $LIVE_RESOLVE"
elif [[ "$LIVE_RESOLVE_RC" -eq 0 ]] && echo "$LIVE_RESOLVE" | grep -Eq 'grok-4.6|cursor-grok-4.6-high'; then
  pass "AC-546-6: live resolve-model EXEC stays Grok 4.6 high (no Sonnet remap)"
elif [[ "$LIVE_RESOLVE_RC" -ne 0 ]] && echo "$LIVE_RESOLVE" | grep -qi 'missing'; then
  pass "AC-546-6: live resolve-model EXEC fail-closes on missing owner dispatch file (no Sonnet remap)"
else
  fail "live resolve-model EXEC unexpected: rc=$LIVE_RESOLVE_RC $LIVE_RESOLVE"
fi

DETECTED="$(bash scripts/detect-host.sh 2>/dev/null || true)"
if [[ "$DETECTED" == "cursor" ]]; then
  pass "AC-546-6: detect-host.sh reports cursor in this session"
else
  echo "  ! detect-host.sh reported '${DETECTED:-empty}' (validator still pins SVC_HOST=cursor)"
fi

# ---------------------------------------------------------------------------
# AC-546-3: compose landed child validators (do not rewrite them)
# ---------------------------------------------------------------------------
run_child() {
  local name="$1" runner="$2" script="$3"
  local out rc
  out="$(mktemp)"
  set +e
  "$runner" "$script" >"$out" 2>&1
  rc=$?
  set -uo pipefail
  if [[ "$rc" -eq 0 ]]; then
    pass "compose $name"
  else
    fail "compose $name (rc=$rc)"
    tail -n 30 "$out" || true
  fi
  rm -f "$out"
}

run_child "WI-545 bash hook mode" bash "$ROOT/test-framework/evals/tier-1/validate-enforce-bash-hook-mode.sh"
run_child "WI-547 review-evidence portability" bash "$ROOT/test-framework/evals/tier-1/validate-review-evidence-portability.sh"
run_child "WI-549 shared chain-policy" bash "$ROOT/test-framework/evals/tier-1/validate-shared-chain-policy.sh"
run_child "WI-550 receipt identity + Stop/finalization" bash "$ROOT/test-framework/evals/tier-1/validate-receipt-identity-collision.sh"
run_child "WI-551 dispatch no-remap" node "$ROOT/test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs"
run_child "WI-552 restart continuation (fake transport / cursor capability_limited)" node "$ROOT/test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs"
run_child "task-state persistence includes cursor" bash "$ROOT/test-framework/evals/tier-1/validate-task-graph-cross-host.sh"

echo ""
echo "WI-546 Cursor live-acceptance: $PASS passed, $FAIL failed"
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
exit 0
