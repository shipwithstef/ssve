#!/usr/bin/env bash
# Tier-1 validator: lane task graph creation requires a fresh session contract
# for the same WI. Origin: WI-214.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

iso_now() {
  node -e 'console.log(new Date().toISOString())'
}

iso_hours_ago() {
  local hours="$1"
  node -e "console.log(new Date(Date.now() - ${hours} * 60 * 60 * 1000).toISOString())"
}

write_contract() {
  local ws="$1"
  local wi="$2"
  local bound_to="$3"
  local ts="$4"
  mkdir -p "$ws/.svc"
  printf '{"ts":"%s","bound_to":"%s","request":"fixture","wi":"%s","skill":"route-workflow","guard_override_count":0}\n' \
    "$ts" "$bound_to" "$wi" > "$ws/.svc/session-contract.jsonl"
}

run_init() {
  local ws="$1"
  local wi="$2"
  node "$REPO_ROOT/scripts/task-graph.mjs" init "$ws/.svc/lane-tasks-$wi.json" --wi "$wi" --lane framework
}

expect_pass() {
  local name="$1"
  shift
  if "$@" >/tmp/svc-wi214-pass.out 2>&1; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name"
    cat /tmp/svc-wi214-pass.out
    FAIL=$((FAIL + 1))
  fi
}

expect_fail_contains() {
  local name="$1"
  local expected="$2"
  shift 2
  if "$@" >/tmp/svc-wi214-fail.out 2>&1; then
    echo "  ✗ $name — expected failure"
    FAIL=$((FAIL + 1))
    return
  fi
  if grep -q "$expected" /tmp/svc-wi214-fail.out; then
    echo "  ✓ $name"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $name — wrong failure"
    cat /tmp/svc-wi214-fail.out
    FAIL=$((FAIL + 1))
  fi
}

echo "=== Tier 1: task-graph session-contract binding ==="

NOW="$(iso_now)"
STALE="$(iso_hours_ago 5)"  # >4h (the SESSION_CONTRACT_MAX_AGE_MS threshold)

WS_PASS_BACKLOG="$TMP_DIR/pass-backlog"
write_contract "$WS_PASS_BACKLOG" "WI-901" "wi-backlog" "$NOW"
expect_pass "fresh wi-backlog contract accepted" run_init "$WS_PASS_BACKLOG" "WI-901"

WS_PASS_USER="$TMP_DIR/pass-user"
write_contract "$WS_PASS_USER" "WI-902" "user-request" "$NOW"
expect_pass "fresh user-request contract accepted" run_init "$WS_PASS_USER" "WI-902"

WS_PASS_FRAMEWORK="$TMP_DIR/pass-framework"
write_contract "$WS_PASS_FRAMEWORK" "WI-903" "framework-evolution" "$NOW"
expect_pass "fresh framework-evolution contract accepted" run_init "$WS_PASS_FRAMEWORK" "WI-903"

WS_STALE="$TMP_DIR/stale"
write_contract "$WS_STALE" "WI-904" "wi-backlog" "$STALE"
expect_fail_contains "stale contract blocks init" "no fresh session-contract entry references WI-904" run_init "$WS_STALE" "WI-904"

WS_WRONG="$TMP_DIR/wrong-wi"
write_contract "$WS_WRONG" "WI-905" "wi-backlog" "$NOW"
expect_fail_contains "wrong-WI contract blocks init" "no fresh session-contract entry references WI-906" run_init "$WS_WRONG" "WI-906"

WS_MISSING="$TMP_DIR/missing"
mkdir -p "$WS_MISSING/.svc"
expect_fail_contains "missing contract blocks init" "session-contract.jsonl is missing or empty" run_init "$WS_MISSING" "WI-907"

WS_PATH="$TMP_DIR/path-mismatch"
write_contract "$WS_PATH" "WI-908" "wi-backlog" "$NOW"
expect_fail_contains "wrong lane-tasks path blocks init" "must write .svc/lane-tasks-WI-908.json" \
  node "$REPO_ROOT/scripts/task-graph.mjs" init "$WS_PATH/.svc/lane-tasks-WI-909.json" --wi WI-908 --lane framework

echo
echo "task-graph session-contract binding: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
