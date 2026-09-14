#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CANARY="$REPO_ROOT/scripts/validate-main-green.sh"
FIXTURE_DIR="$(mktemp -d)"
trap 'rm -rf "$FIXTURE_DIR"' EXIT

pass=0
fail=0
ok() { echo "  PASS — $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL — $1"; fail=$((fail + 1)); }

make_canary_repo() {
  local name="$1"
  local log_path="$2"
  local runner_rc="$3"
  local allowlist_json="$4"
  local repo="$FIXTURE_DIR/$name"
  mkdir -p "$repo/scripts" "$repo/test-framework/evals" "$repo/.svc"
  cp "$CANARY" "$repo/scripts/validate-main-green.sh"
  cp "$log_path" "$repo/.svc/fake-runner-output"
  printf '%s\n' "$runner_rc" > "$repo/.svc/fake-runner-rc"
  printf '%s\n' "$allowlist_json" > "$repo/.svc/main-green-allowlist.json"
  cat > "$repo/test-framework/evals/run-all-evals.sh" <<'RUNNER'
#!/usr/bin/env bash
cat .svc/fake-runner-output
exit "$(cat .svc/fake-runner-rc)"
RUNNER
  chmod +x "$repo/scripts/validate-main-green.sh" "$repo/test-framework/evals/run-all-evals.sh"
  git -C "$repo" init -q
  git -C "$repo" config user.name fixture
  git -C "$repo" config user.email fixture@example.invalid
  git -C "$repo" add .
  git -C "$repo" commit -qm fixture
  printf '%s\n' "$repo"
}

run_canary_case() {
  local repo="$1"
  local expected_rc="$2"
  local expected_text="$3"
  local output rc
  set +e
  output="$(cd "$repo" && bash scripts/validate-main-green.sh 2>&1)"
  rc=$?
  set -e
  [[ "$rc" -eq "$expected_rc" && "$output" == *"$expected_text"* ]]
}

OBSERVED="$REPO_ROOT/test-framework/evals/tier-1/fixtures/main-green/observed-red-run.txt"
mixed_output="$(bash "$CANARY" --parse-log "$OBSERVED" || true)"
expected=$'validate-proposal-triage-sla.sh\nvalidate-skip-conditions-registry.sh'
[[ "$mixed_output" == "$expected" ]] && ok "attributes only explicit runner failures in an observed red-run fixture" || bad "misattributed observed red-run fixture"

ANSI="$FIXTURE_DIR/ansi.log"
printf '%s\n' $'\033[31m    FAIL: future-validator.mjs (rc=1)\033[0m' > "$ANSI"
[[ "$(bash "$CANARY" --parse-log "$ANSI" || true)" == "future-validator.mjs" ]] && ok "normalizes ANSI and indentation around a runner failure record" || bad "rejected normalized runner record"

SUMMARY_ONLY="$FIXTURE_DIR/summary-only.log"
printf '%s\n' '  Running validate-markdown-ast.mjs...' '>>> Tier 1 Result: 268 scripts passed, 2 failed (0 timed out)' > "$SUMMARY_ONLY"
set +e
summary_output="$(bash "$CANARY" --parse-log "$SUMMARY_ONLY" 2>/dev/null)"
summary_rc=$?
set -e
if [[ "$summary_rc" -eq 0 || -n "$summary_output" ]]; then
  bad "aggregate summary was falsely attributed to the final validator"
else
  ok "summary-only input emits nothing and returns nonzero for fail-closed handling"
fi

allow_two='{"schema":1,"known_red":[{"script":"validate-proposal-triage-sla.sh","wi":"WI-472","reason":"fixture"},{"script":"validate-skip-conditions-registry.sh","wi":"WI-498","reason":"fixture"}]}'
known_repo="$(make_canary_repo known "$OBSERVED" 1 "$allow_two")"
run_canary_case "$known_repo" 0 "WARN — 2 red, ALL in known-debt allowlist" && ok "full canary accepts exactly named tracked debt" || bad "full known-debt verdict drifted"

empty_allow='{"schema":1,"known_red":[]}'
unparsed_repo="$(make_canary_repo unparsed "$SUMMARY_ONLY" 1 "$empty_allow")"
run_canary_case "$unparsed_repo" 1 "no failing script names parsed" && ok "full canary fails closed on a nonzero summary without runner failure records" || bad "full unparsed-failure verdict drifted"

TIMEOUT="$FIXTURE_DIR/timeout.log"
printf '%s\n' '>>> Tier 1 Result: 270 scripts passed, 0 failed (1 timed out)' > "$TIMEOUT"
timeout_repo="$(make_canary_repo timeout "$TIMEOUT" 1 "$empty_allow")"
run_canary_case "$timeout_repo" 1 "reports 1 timed out validator" && ok "full canary fails closed on an explicit timeout" || bad "full timeout verdict drifted"

INCONSISTENT="$FIXTURE_DIR/inconsistent.log"
printf '%s\n' '>>> Tier 1 Result: 270 scripts passed, 0 failed (0 timed out)' > "$INCONSISTENT"
inconsistent_repo="$(make_canary_repo inconsistent "$INCONSISTENT" 1 "$empty_allow")"
run_canary_case "$inconsistent_repo" 1 "reports 0 failed but runner exited 1" && ok "full canary rejects a zero-failure summary from a failed runner" || bad "full runner-consistency verdict drifted"

RUNNER="$REPO_ROOT/test-framework/evals/run-all-evals.sh"
grep -Fq '>>> Tier 1 Result: $TIER1_PASS scripts passed, $TIER1_FAIL failed ($TIER1_TIMEOUT timed out)' "$RUNNER" && ok "producer keeps the unconditional timeout count in the canonical result line" || bad "runner result format drifted"
grep -Fq 'tier-1"/*.sh' "$RUNNER" && grep -Fq 'tier-1"/*.mjs' "$RUNNER" && ok "producer enumerates only the parser-supported shell and module validator extensions" || bad "runner validator extension contract drifted"

echo "main-green parser: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
