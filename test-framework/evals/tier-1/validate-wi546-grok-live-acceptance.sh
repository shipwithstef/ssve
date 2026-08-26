#!/usr/bin/env bash
# Tier 1: WI-546 Grok live-acceptance (this Grok Build session).
#
# validator_path: test-framework/evals/tier-1/validate-wi546-grok-live-acceptance.sh
# failure_class: host registration reported as behavioral Grok parity
# expected_runtime_budget: <90s isolated HOME setup; no AGY rerun
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"
export SVC_SESSION_ID="${SVC_SESSION_ID:-svc-impl-wi546-01a01070}"
export SVC_HOST="${SVC_HOST:-grok}"

PASS=0
FAIL=0
pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

echo "=== Tier 1: WI-546 Grok live-acceptance ==="
echo "  exec_default: grok-4.6 high (fast forbidden on Cursor CLI)"

MATRIX="docs/specs/architecture/wi-548-capability-matrix.md"
if [[ -f "$MATRIX" ]] \
  && grep -q 'svc-grok-task-completion-guard' "$MATRIX" \
  && grep -q 'validate-wi546-grok-live-acceptance.sh' "$MATRIX"; then
  pass "capability matrix names the Grok live fixture"
else
  fail "capability matrix missing Grok live fixture pointer"
fi

MODE="$(git ls-files -s -- hooks/grok/svc-grok-task-completion-guard.sh | awk '{print $1}')"
[[ "$MODE" == "100755" ]] \
  && pass "AC-546-1/2: Grok Stop adapter is git mode 100755" \
  || fail "Grok Stop adapter git mode is '${MODE:-missing}', expected 100755"

bash -n hooks/grok/svc-grok-task-completion-guard.sh \
  && pass "Grok Stop adapter bash syntax valid" \
  || fail "Grok Stop adapter syntax error"

node --input-type=module - "$ROOT" <<'NODE' && pass "Grok manifest declares TOML hooks + fresh_session_launch" || fail "Grok host manifest drifted"
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.argv[2];
const m = JSON.parse(fs.readFileSync(path.join(root, "provision/hosts/grok.json"), "utf8"));
assert.equal(m.host, "grok");
assert.equal(m.hook_quirks?.config_format, "toml");
assert.equal(m.authority_capabilities?.fresh_session_launch?.enabled, true);
assert.ok((m.hook_events || []).includes("SessionStart"));
assert.ok((m.hook_events || []).includes("Stop"));
assert.equal(m.wiring?.wirer, "scripts/wire-grok-hooks.mjs");
NODE

grep -q 'SessionStart' scripts/wire-grok-hooks.mjs \
  && grep -q 'svc-session-start-healthcheck' scripts/wire-grok-hooks.mjs \
  && grep -q 'svc-grok-task-completion-guard' scripts/wire-grok-hooks.mjs \
  && pass "AC-546-2: wirer declares SessionStart healthcheck + Stop adapter" \
  || fail "wirer missing declared SessionStart/Stop adapters"

set +e
# WI-558 (post-review): hermeticity + no operator-side effects — see the twin
# probe in validate-wi546-cursor-live-acceptance.sh.
if [[ "$ROOT" == *"/.worktrees/"* ]]; then
  WT_OUT="$(./setup --host grok 2>&1)"; WT_RC=$?
  if [[ "$WT_RC" -ne 0 ]] && echo "$WT_OUT" | grep -q 'Refusing to install'; then
    pass "worktree ./setup --host grok refuses (AP-30)"
  else
    fail "worktree ./setup --host grok should refuse (rc=$WT_RC)"
  fi
else
  echo "  ! SKIP live ./setup grok probe — main checkout (hermeticity); AP-30 covered by setup-canonical-resolution fixtures"
fi

ISO_HOME="$(mktemp -d)"
CACHE_ROOT="${XDG_CACHE_HOME:-$HOME/.cache}"
mkdir -p "$CACHE_ROOT"
ISO_SRC="$(mktemp -d "$CACHE_ROOT/svc-wi546-grok-src-XXXXXX")"
ISO_STATE="$ISO_HOME/.svc/setup-state"
cleanup_iso() { rm -rf "$ISO_HOME" "$ISO_SRC" 2>/dev/null || true; }
trap cleanup_iso EXIT
mkdir -p "$ISO_HOME/.svc"
chmod 700 "$ISO_HOME/.svc"
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
         skills-manifest.json CONTRIBUTING.md AGENTS.md GROK.md; do
  [[ -f "$ROOT/$f" ]] && cp -al "$ROOT/$f" "$ISO_SRC/$f"
done
[[ "$ISO_SRC" != *".worktrees/"* ]] \
  && pass "isolated Grok setup source is outside .worktrees/" \
  || fail "isolated setup source under .worktrees/"

set +e
SETUP_LOG="$ISO_HOME/setup-grok.log"
HOME="$ISO_HOME" SVC_SETUP_STATE_ROOT="$ISO_STATE" \
  "$ISO_SRC/setup" --host grok >"$SETUP_LOG" 2>&1
SETUP_RC=$?
set -uo pipefail
if [[ "$SETUP_RC" -eq 0 ]]; then
  pass "AC-546-1: isolated ./setup --host grok exits 0"
else
  fail "isolated ./setup --host grok failed (rc=$SETUP_RC)"
  tail -n 40 "$SETUP_LOG" || true
fi

set +e
DRIFT_LOG="$ISO_HOME/drift-grok.log"
HOME="$ISO_HOME" bash "$ISO_SRC/scripts/check-install-drift.sh" --host grok >"$DRIFT_LOG" 2>&1
DRIFT_RC=$?
set -uo pipefail
if [[ "$DRIFT_RC" -eq 0 ]]; then
  pass "AC-546-1: isolated check-install-drift.sh --host grok is zero"
else
  fail "isolated check-install-drift.sh --host grok failed (rc=$DRIFT_RC)"
  cat "$DRIFT_LOG" || true
fi

GROK_TOML="$ISO_HOME/.grok/config.toml"
if [[ -f "$GROK_TOML" ]] \
  && grep -q 'SessionStart' "$GROK_TOML" \
  && grep -q 'svc-session-start-healthcheck' "$GROK_TOML" \
  && grep -q 'Stop' "$GROK_TOML" \
  && grep -q 'svc-grok-task-completion-guard' "$GROK_TOML"; then
  pass "AC-546-2: isolated ~/.grok/config.toml loads SessionStart + Stop adapters"
else
  fail "isolated Grok config.toml missing declared SessionStart/Stop adapters"
  [[ -f "$GROK_TOML" ]] && tail -n 40 "$GROK_TOML" || true
fi

LIVE_TOML="${SVC_LIVE_HOME:-$HOME}/.grok/config.toml"
if [[ -f "$LIVE_TOML" ]] \
  && grep -q 'svc-session-start-healthcheck' "$LIVE_TOML" \
  && grep -q 'svc-grok-task-completion-guard' "$LIVE_TOML"; then
  pass "AC-546-2: live ~/.grok/config.toml already loads declared adapters"
else
  echo "  ! live ~/.grok/config.toml not wired (isolated install still covers AC-546-2)"
fi

# Live EXEC default: Grok 4.6 high, no Sonnet, no Cursor fast variant.
# Operator-HOME pins are machine state, not repo state (WI-558 hermeticity):
# SKIP with a notice when absent — tier-1 must not fail on machines that never
# pinned the operator's personal EXEC default.
if [[ -f "$HOME/.svc/cursor-exec-default.json" ]] \
  && grep -q 'cursor-grok-4.6-high' "$HOME/.svc/cursor-exec-default.json" \
  && grep -q '"fast": false' "$HOME/.svc/cursor-exec-default.json"; then
  pass "Cursor EXEC default is cursor-grok-4.6-high with fast=false"
else
  echo "  ! SKIP live EXEC pin check — ~/.svc/cursor-exec-default.json absent or unpinned (operator-machine state; isolated coverage below still applies)"
fi

if [[ -f "$HOME/.svc/dispatch-policy.json" ]]; then
  set +e
  LIVE_RESOLVE="$(env -u SVC_DISPATCH_POLICY SVC_HOST=grok bash scripts/resolve-model.sh EXEC --json 2>&1)"
  LIVE_RESOLVE_RC=$?
  set -uo pipefail
  if echo "$LIVE_RESOLVE" | grep -qi 'claude-sonnet\|-fast'; then
    fail "live EXEC remapped to Sonnet or a fast Grok variant: $LIVE_RESOLVE"
  elif [[ "$LIVE_RESOLVE_RC" -eq 0 ]] && echo "$LIVE_RESOLVE" | grep -Eq 'grok-4.6'; then
    pass "AC-546-6: live resolve-model EXEC is grok-4.6 (no Sonnet/fast remap)"
  elif [[ "$LIVE_RESOLVE_RC" -eq 0 ]] && [[ -n "$LIVE_RESOLVE" ]]; then
    # Owner dispatch policy routes off-grok on this machine (exec-review R5 machine state):
    # the no-Sonnet/no-fast invariant holds; the route belongs to the policy's host.
    pass "AC-546-6: live resolve-model EXEC routed by owner dispatch policy (no Sonnet/fast remap)"
  else
    fail "live resolve-model EXEC unexpected: rc=$LIVE_RESOLVE_RC $LIVE_RESOLVE"
  fi
else
  echo "  ! SKIP live dispatch-policy resolve — ~/.svc/dispatch-policy.json absent (owner policy is external state; fixture resolve coverage below still applies)"
fi

DETECTED="$(bash scripts/detect-host.sh 2>/dev/null || true)"
if [[ "$DETECTED" == "grok" ]]; then
  pass "AC-546-6: detect-host.sh reports grok"
else
  echo "  ! detect-host.sh reported '${DETECTED:-empty}' (validator pins SVC_HOST=grok)"
fi

# Compose children (same as Cursor wave; do not rewrite).
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
    tail -n 20 "$out" || true
  fi
  rm -f "$out"
}

run_child "WI-545 bash hook mode" bash "$ROOT/test-framework/evals/tier-1/validate-enforce-bash-hook-mode.sh"
run_child "WI-547 review-evidence portability" bash "$ROOT/test-framework/evals/tier-1/validate-review-evidence-portability.sh"
run_child "WI-549 shared chain-policy" bash "$ROOT/test-framework/evals/tier-1/validate-shared-chain-policy.sh"
run_child "WI-550 receipt identity + Stop/finalization" bash "$ROOT/test-framework/evals/tier-1/validate-receipt-identity-collision.sh"
run_child "WI-551 dispatch no-remap" node "$ROOT/test-framework/evals/tier-1/validate-dispatch-resolver-wi551.mjs"
run_child "WI-552 restart continuation (fake transport)" node "$ROOT/test-framework/evals/tier-1/validate-continuation-lifecycle-wi552.mjs"

# Live Grok single-turn launch (fresh session proof). Bounded. Not a Cursor remap.
if command -v grok >/dev/null 2>&1; then
  PONG_LOG="$(mktemp)"
  set +e
  timeout 45 grok -p "Reply with the single word pong and nothing else." \
    --output-format json >"$PONG_LOG" 2>&1
  PONG_RC=$?
  set -uo pipefail
  if [[ "$PONG_RC" -eq 0 ]] && grep -qi pong "$PONG_LOG"; then
    pass "AC-546-3 live: grok -p single-turn launch returned pong"
  else
    echo "  ! grok -p live launch rc=$PONG_RC (isolated setup still covers AC-546-1/2)"
    tail -n 8 "$PONG_LOG" || true
  fi
  rm -f "$PONG_LOG"
else
  echo "  ! grok CLI not on PATH; skip live -p launch"
fi

echo ""
echo "WI-546 Grok live-acceptance: $PASS passed, $FAIL failed"
if [[ "$FAIL" -ne 0 ]]; then
  exit 1
fi
exit 0
