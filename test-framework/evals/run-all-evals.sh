#!/usr/bin/env bash
# Run all eval tiers.
# Tier 1 always runs and is free. Full mode may take minutes; focused mode has
# a <10s target and fails closed to full on unknown/global inputs.
# Tier 1.5, 2, and 3 run only if EVALS=1 is set.
#
# Usage:
#   ./run-all-evals.sh          # tier 1 only
#   EVALS=1 ./run-all-evals.sh  # all tiers
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "============================================"
echo "  svc Eval Framework"
echo "  $(date -Iseconds)"
echo "============================================"
echo ""

# FP-030: surface-scoped run — --surface <path> (repeatable/comma-separated)
# restricts the sweep to validators whose contract inputs fall under the given
# prefixes. The FULL suite remains the CP-PRELAND gate; surfaces are for fast,
# targeted iteration. Explicit --surface takes precedence over SVC_TIER1_MODE.
TIER1_SURFACES=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tier1)
      # Backward compat: tier-1 is already the suite default (WI-358 gate and
      # older docs pass it explicitly). Accepted and ignored.
      shift ;;
    --surface)
      [[ -n "${2:-}" ]] || { echo "FAIL: --surface requires a path argument" >&2; exit 2; }
      IFS=',' read -r -a _parts <<< "$2"
      TIER1_SURFACES+=("${_parts[@]}")
      shift 2 ;;
    *)
      echo "FAIL: unknown argument $1 (supported: --surface <path>)" >&2
      exit 2 ;;
  esac
done

TIER1_PASS=0
TIER1_FAIL=0
TIER1_TIMEOUT=0

# WI-110: per-validator timeout. Without it, a single hanging validator stalls
# the whole sweep silently (observed 2026-04-25 + reproduced 2026-04-26).
# Override: VALIDATOR_TIMEOUT_SEC=<n> bash run-all-evals.sh
# 2026-04-26 raise: validate-host-manifests legitimately runs 4× setup dry-runs
# (~15s each post-launch-knowledge); 30s was too aggressive. 90s catches
# real hangs without false-failing legitimate work.
VALIDATOR_TIMEOUT_SEC="${VALIDATOR_TIMEOUT_SEC:-180}"

# WI-165: per-tier outer timeouts for LLM-invoking tiers.
# Tier 1.5: ~5K tokens/test, ~30-60s each → 300s catches hangs on 5+ tests
# Tier 2: ~50K tokens/scenario, ~2-4min each → 600s catches hangs on 2+ scenarios
# Tier 3: ~20K tokens/judgment, ~30-60s each → 300s catches hangs on 5+ judgments
# Cost ceiling: tier-2 ≈ $0.60-1.00/scenario; abort suite if any single scenario
# exceeds 2× expected duration (possible infinite loop in agent prompt).
TIER15_TIMEOUT_SEC="${TIER15_TIMEOUT_SEC:-300}"
TIER2_TIMEOUT_SEC="${TIER2_TIMEOUT_SEC:-600}"
TIER3_TIMEOUT_SEC="${TIER3_TIMEOUT_SEC:-300}"

# --- Tier 1: Static validation (always, free; timing depends on mode) ---
echo ">>> Tier 1: Static Validation (no LLM; focused target <10s, full may take minutes)"
echo ""

# WI-453 (A1): tier-1 validators run as a bounded PARALLEL batch with results
# aggregated AFTER the join (no in-loop shared counter), preserving the per-script
# timeout, the PASS/FAIL/TIMEOUT counters, per-validator output, and exit semantics.
# A small SEQUENTIAL pre-pass runs the validators that touch the REAL ~/.claude host
# state (settings.json / symlinks / install) one-at-a-time, so parallelism can never
# corrupt live host config. Concurrency override: TIER1_JOBS=<n> (default = CPUs).
TIER1_JOBS="${TIER1_JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)}"
TIER1_RESULTS_DIR="$(mktemp -d)"

# Host-state validators — must NOT run concurrently (race -> live host-config
# corruption). Derived from a grep of real-$HOME / settings.json refs; the multi-run
# no-loss verification (old-vs-new identical PASS/FAIL set) backstops any miss.
TIER1_SEQUENTIAL_SET="
validate-all-host-setup.sh
validate-codex-zero-block-reads.sh
validate-claude-skills-symlinks.sh
validate-codex-execution-integrity.sh
validate-framework-self-management.sh
validate-self-heal-survives-double-dead-pointer.sh
validate-settings-no-duplicate-hooks.sh
validate-skill-receipt-shape.sh
validate-settings-write-guard.sh
validate-setup-worktree-canonical-resolution.sh
validate-source-repo-not-worktree.sh
validate-no-svc-residue.sh
validate-phase-receipt-autoemit.sh
validate-session-contract-freshness.sh
validate-rule-injection.sh
"

# Run one validator -> per-script .out + .rc files. The `&& rc=0 || rc=$?` idiom
# keeps a non-zero validator from aborting the caller under `set -e`.
_tier1_run_one() {
  local script="$1" name runner rc
  name="$(basename "$script")"
  runner="bash"; [[ "$script" == *.mjs ]] && runner="node"
  timeout "$VALIDATOR_TIMEOUT_SEC" "$runner" "$script" > "$TIER1_RESULTS_DIR/$name.out" 2>&1 && rc=0 || rc=$?
  printf '%s' "$rc" > "$TIER1_RESULTS_DIR/$name.rc"
}
export -f _tier1_run_one
export VALIDATOR_TIMEOUT_SEC TIER1_RESULTS_DIR

# Ordered validator list (sh then mjs — stable, matches the legacy output order).
TIER1_ALL=()
for script in "$SCRIPT_DIR/tier-1"/*.sh;  do [[ -f "$script" ]] && TIER1_ALL+=("$script"); done
for script in "$SCRIPT_DIR/tier-1"/*.mjs; do [[ -f "$script" ]] && TIER1_ALL+=("$script"); done

if [[ ${#TIER1_SURFACES[@]} -gt 0 ]]; then
  SELECTOR="$SCRIPT_DIR/../../scripts/select-tier1-validators-v2.mjs"
  SURFACE_FILE="$TIER1_RESULTS_DIR/surface-validators.txt"
  if node "$SELECTOR" --repo-root "$SCRIPT_DIR/../.." --format lines --surface "$(IFS=,; printf '%s' "${TIER1_SURFACES[*]}")" > "$SURFACE_FILE"; then
    # Zero RUNNABLE matches = typo'd surface. Count validators that exist on
    # disk AND were selected (raw selector output can name a validator file
    # that was renamed/deleted); the auto-added selector never counts.
    TIER1_SURFACE=()
    for script in "${TIER1_ALL[@]}"; do
      name="$(basename "$script")"
      if grep -qxF "$name" "$SURFACE_FILE"; then TIER1_SURFACE+=("$script"); fi
    done
    if [[ ${#TIER1_SURFACE[@]} -eq 0 ]]; then
      echo "FAIL: surface(s) [${TIER1_SURFACES[*]}] matched zero runnable contract validators — typo? Surfaces must be repo paths that appear in the selector contract table (directory prefixes recommended)." >&2
      exit 2
    fi
    TIER1_SURFACE+=("$SCRIPT_DIR/tier-1/validate-tier1-selector-v2.mjs")
    echo "  surface scope: ${#TIER1_SURFACE[@]} validator(s) for ${#TIER1_SURFACES[@]} surface(s)"
    TIER1_ALL=("${TIER1_SURFACE[@]}")
  else
    echo "FAIL: surface selector errored — refusing to fall open to full sweep" >&2
    exit 2
  fi
fi

# Controller v2 focused mode is opt-in until the historical replay/default-cutover
# gate passes. Unknown inputs and changes to the runner/global manifests fail
# closed to the complete legacy sweep. Default behavior remains byte-for-byte
# scheduling-compatible with the old full mode.
SVC_TIER1_MODE="${SVC_TIER1_MODE:-full}"
if [[ "$SVC_TIER1_MODE" != "full" && "$SVC_TIER1_MODE" != "focused" ]]; then
  echo "FAIL: SVC_TIER1_MODE must be full or focused" >&2
  exit 2
fi
if [[ "$SVC_TIER1_MODE" == "focused" ]]; then
  SELECTOR="$SCRIPT_DIR/../../scripts/select-tier1-validators-v2.mjs"
  SELECTION_FILE="$TIER1_RESULTS_DIR/selected-validators.txt"
  CHANGED_ARGS=()
  if [[ -n "${SVC_TIER1_CHANGED_FILES:-}" && -f "$SVC_TIER1_CHANGED_FILES" ]]; then
    # WI-557-v2: the pre-push gate hands us the PUSHED-RANGE file list; without
    # this, a clean post-commit working tree selects zero validators and the
    # suite would green-light a push without running anything.
    CHANGED_JSON="$(node -e 'const fs=require("fs");const list=[...new Set(fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/).filter(Boolean))];process.stdout.write(JSON.stringify(list))' "$SVC_TIER1_CHANGED_FILES")"
    CHANGED_ARGS=(--changed-json "$CHANGED_JSON")
    echo "  focused selector: using pushed-range change list ($(wc -l < "$SVC_TIER1_CHANGED_FILES") files)"
  fi
  if node "$SELECTOR" --repo-root "$SCRIPT_DIR/../.." --format lines "${CHANGED_ARGS[@]}" > "$SELECTION_FILE"; then
    if ! grep -qxF '__FULL__' "$SELECTION_FILE"; then
      TIER1_FOCUSED=()
      for script in "${TIER1_ALL[@]}"; do
        if grep -qxF "$(basename "$script")" "$SELECTION_FILE"; then TIER1_FOCUSED+=("$script"); fi
      done
      if [[ ${#TIER1_FOCUSED[@]} -eq 0 ]]; then
        # Fail-closed: an empty closure with no explicit fallback reason means we
        # know nothing about what changed — run everything.
        echo "  focused selector: empty closure — failing closed to full sweep" >&2
      else
      TIER1_ALL=("${TIER1_FOCUSED[@]}")
      echo "  focused selector: exact contract closure (${#TIER1_ALL[@]} validators)"
      fi
    else
      echo "  focused selector: unknown/global input -> full sweep"
    fi
  else
    echo "  focused selector failed -> full sweep" >&2
  fi
fi

# Split: sequential pre-pass for host-state validators, parallel for the rest.
TIER1_PARALLEL=()
for script in "${TIER1_ALL[@]}"; do
  if printf '%s\n' $TIER1_SEQUENTIAL_SET | grep -qxF "$(basename "$script")"; then
    _tier1_run_one "$script"
  else
    TIER1_PARALLEL+=("$script")
  fi
done

# Parallel batch: bounded concurrency, NUL-delimited, never &&-chained (every
# validator runs and reports; one failure cannot abort the sweep). Each child exits
# 0 (rc is captured into a file), so pipefail/set -e stay satisfied.
echo "  (running ${#TIER1_ALL[@]} tier-1 validators: ${#TIER1_PARALLEL[@]} parallel across ${TIER1_JOBS} jobs + sequential host-state pre-pass)"
echo ""
if [[ ${#TIER1_PARALLEL[@]} -gt 0 ]]; then
  printf '%s\0' "${TIER1_PARALLEL[@]}" | xargs -0 -P "$TIER1_JOBS" -n1 bash -c '_tier1_run_one "$@"' _
fi

# Aggregate AFTER the join — same order, counters, messages, and output as before.
for script in "${TIER1_ALL[@]}"; do
  script_name="$(basename "$script")"
  echo "  Running $script_name..."
  cat "$TIER1_RESULTS_DIR/$script_name.out" 2>/dev/null
  rc="$(cat "$TIER1_RESULTS_DIR/$script_name.rc" 2>/dev/null || echo 1)"
  if [[ "$rc" -eq 0 ]]; then
    TIER1_PASS=$((TIER1_PASS + 1))
  elif [[ "$rc" -eq 124 ]]; then
    TIER1_TIMEOUT=$((TIER1_TIMEOUT + 1))
    TIER1_FAIL=$((TIER1_FAIL + 1))
    echo "  FAIL: $script_name — timed out at ${VALIDATOR_TIMEOUT_SEC}s (WI-110 guard)"
  else
    TIER1_FAIL=$((TIER1_FAIL + 1))
    echo "  FAIL: $script_name (rc=$rc)"
  fi
  echo ""
done
rm -rf "$TIER1_RESULTS_DIR"

echo ">>> Tier 1 Result: $TIER1_PASS scripts passed, $TIER1_FAIL failed ($TIER1_TIMEOUT timed out)"
echo ""

# --- Tier 1.5, 2, 3: Only with EVALS=1 ---
if [[ "${EVALS:-0}" != "1" ]]; then
  echo ">>> Tiers 1.5, 2, 3 skipped (set EVALS=1 to run)"
  echo ""

  if [[ $TIER1_FAIL -gt 0 ]]; then
    echo "RESULT: FAIL ($TIER1_FAIL tier-1 scripts failed)"
    exit 1
  else
    echo "RESULT: PASS (tier-1 only)"
    exit 0
  fi
fi

TIER15_EXIT=0
TIER2_EXIT=0
TIER3_EXIT=0

# --- Tier 1.5: Skill comprehension + triggering (~30-60s per test, ~5K tokens) ---
echo ">>> Tier 1.5: Skill Comprehension & Triggering (~5K tokens/test)"
echo ""

for script in "$SCRIPT_DIR/tier-1.5"/test-*.sh; do
  [[ ! -f "$script" ]] && continue
  script_name="$(basename "$script")"
  echo "  Running $script_name..."
  set +e
  timeout "$TIER15_TIMEOUT_SEC" bash "$script"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    echo "  $script_name: PASS"
  elif [[ $rc -eq 124 ]]; then
    TIER15_EXIT=1
    echo "  FAIL: $script_name — timed out at ${TIER15_TIMEOUT_SEC}s (WI-165 guard)"
  else
    TIER15_EXIT=1
    echo "  $script_name: FAIL"
  fi
  echo ""
done

# --- Tier 2: Integration scenarios (~50K tokens/scenario) ---
echo ">>> Tier 2: Integration Scenarios (~50K tokens/scenario)"
echo ""

# Reset summary file so individual runners can append their markers (WI-135)
: > "${SVC_TIER2_SUMMARY:-/tmp/svc-tier2-summary.txt}"

if [[ -f "$SCRIPT_DIR/tier-2/run-tier2.sh" ]]; then
  set +e
  timeout "$TIER2_TIMEOUT_SEC" bash "$SCRIPT_DIR/tier-2/run-tier2.sh"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    echo "  Tier 2 [integration]: PASS"
    echo "[integration] PASS" >> "${SVC_TIER2_SUMMARY:-/tmp/svc-tier2-summary.txt}"
  elif [[ $rc -eq 124 ]]; then
    TIER2_EXIT=1
    echo "  FAIL: Tier 2 [integration] — timed out at ${TIER2_TIMEOUT_SEC}s (WI-165 guard)"
    echo "[integration] TIMEOUT" >> "${SVC_TIER2_SUMMARY:-/tmp/svc-tier2-summary.txt}"
  else
    TIER2_EXIT=1
    echo "  Tier 2 [integration]: FAIL"
    echo "[integration] FAIL" >> "${SVC_TIER2_SUMMARY:-/tmp/svc-tier2-summary.txt}"
  fi
else
  echo "  WARN: tier-2/run-tier2.sh not found"
fi
echo ""

# WI-135: behavioral evals — recorded-fixture playback, deterministic, no LLM
if [[ -f "$SCRIPT_DIR/tier-2/run-behavioral.mjs" ]]; then
  echo ">>> Tier 2 [behavioral]: Recorded-fixture playback (WI-135)"
  set +e
  timeout "$TIER2_TIMEOUT_SEC" node "$SCRIPT_DIR/tier-2/run-behavioral.mjs" "$SCRIPT_DIR/tier-2/behavioral"
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    echo "  Tier 2 [behavioral]: PASS"
  elif [[ $rc -eq 124 ]]; then
    TIER2_EXIT=1
    echo "  FAIL: Tier 2 [behavioral] — timed out at ${TIER2_TIMEOUT_SEC}s (WI-165 guard)"
  else
    TIER2_EXIT=1
    echo "  Tier 2 [behavioral]: FAIL"
  fi
  echo ""
fi

# --- Tier 3: LLM-as-judge (~20K tokens/judgment) ---
echo ">>> Tier 3: LLM-as-Judge (~20K tokens/judgment)"
echo "  Note: Tier 3 requires skill output files to evaluate."
echo "  Run tier 2 first to produce outputs, then pass them to tier 3."
echo ""

if [[ -f "$SCRIPT_DIR/../../scripts/tier3-coverage-plan.mjs" ]]; then
  set +e
  node "$SCRIPT_DIR/../../scripts/tier3-coverage-plan.mjs"
  rc=$?
  set -e
  if [[ $rc -ne 0 ]]; then
    TIER3_EXIT=1
    echo "  FAIL: tier-3 coverage plan invalid"
  fi
fi

# If tier-2 produced outputs, evaluate them
TIER2_RESULTS="$SCRIPT_DIR/results/tier-2"
LATEST_TIER2=$(ls -td "$TIER2_RESULTS"/*/ 2>/dev/null | head -1 || true)

if [[ -n "$LATEST_TIER2" && -d "$LATEST_TIER2" ]]; then
  echo "  Using tier-2 outputs from: $LATEST_TIER2"
  for output_file in "$LATEST_TIER2"/*-output.txt; do
    [[ ! -f "$output_file" ]] && continue
    scenario_name="$(basename "$output_file" -output.txt)"
    echo "  Judging: $scenario_name"
    for dim in completeness actionability consistency; do
      set +e
      timeout "$TIER3_TIMEOUT_SEC" bash "$SCRIPT_DIR/tier-3/run-tier3.sh" "$output_file" "$dim"
      rc=$?
      set -e
      if [[ $rc -eq 124 ]]; then
        TIER3_EXIT=1
        echo "  FAIL: $scenario_name [$dim] — timed out at ${TIER3_TIMEOUT_SEC}s (WI-165 guard)"
      elif [[ $rc -ne 0 ]]; then
        TIER3_EXIT=1
      fi
    done
  done
else
  echo "  No tier-2 outputs found. Run tier 2 first."
fi
echo ""

# --- Summary ---
echo "============================================"
echo "  Summary"
echo "============================================"
echo "  Tier 1:   $TIER1_PASS passed, $TIER1_FAIL failed"
echo "  Tier 1.5: $([ $TIER15_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "  Tier 2:   $([ $TIER2_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo "  Tier 3:   $([ $TIER3_EXIT -eq 0 ] && echo 'PASS' || echo 'FAIL')"
echo ""

if [[ $TIER1_FAIL -gt 0 || $TIER15_EXIT -ne 0 || $TIER2_EXIT -ne 0 || $TIER3_EXIT -ne 0 ]]; then
  echo "RESULT: FAIL"
  exit 1
else
  echo "RESULT: PASS"
  exit 0
fi
