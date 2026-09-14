#!/usr/bin/env bash
# WI-559 T04 — nightly double-sweep flake detector.
set -uo pipefail

EVALS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$EVALS_DIR/../.." && pwd)"
cd "$REPO_ROOT"

RESULTS="$(mktemp -d)"
trap "rm -rf "$RESULTS"" EXIT

run_sweep() {
  local label="$1"
  if [[ "$label" == "B" ]]; then
    TIER1_JOBS=$(( ${TIER1_JOBS_B:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)} * 2 ))     _IN_FLAKE_CHECK=1 FLAKE_CHECK=0 bash "$EVALS_DIR/run-all-evals.sh" > "$RESULTS/out-$label.log" 2>&1
  else
    TIER1_JOBS="${TIER1_JOBS_A:-4}"     _IN_FLAKE_CHECK=1 FLAKE_CHECK=0 bash "$EVALS_DIR/run-all-evals.sh" > "$RESULTS/out-$label.log" 2>&1
  fi
}

extract_outcomes() {
  grep -hoE "(PASS|FAIL|TIMEOUT):? .*(validate-[a-z0-9-]+\.(sh|mjs))" "$1" 2>/dev/null     | awk "{print \$NF, \$1}" | sort > "$2"
  return 0
}

echo "=== Double-Sweep Flake Detector (WI-559) ==="

for SWEEP in A B; do
  echo "--- sweep $SWEEP ---"
  run_sweep "$SWEEP" || true
  extract_outcomes "$RESULTS/out-$SWEEP.log" "$RESULTS/outcomes-$SWEEP.txt"
done

DIFF_OUT="$(diff -u "$RESULTS/outcomes-A.txt" "$RESULTS/outcomes-B.txt" || true)"
if [[ -n "$DIFF_OUT" ]]; then
  echo "FAIL: Flake detected between sweeps:"
  echo "$DIFF_OUT"
  exit 1
fi

COUNT=$(wc -l < "$RESULTS/outcomes-A.txt" 2>/dev/null || echo 0)
echo "PASS: Double-sweep complete. $COUNT validators identical across both sweeps with 0 flakes."
exit 0
