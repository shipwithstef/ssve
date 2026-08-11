#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/tier2-process-assertions.mjs"
SCENARIO="$REPO_ROOT/test-framework/evals/tier-2/scenarios/diagnose-bug-typo.md"
TEST_JOURNEYS_SCENARIO="$REPO_ROOT/test-framework/evals/tier-2/scenarios/test-journeys-runtime.md"
WRITE_JOURNEYS_SCENARIO="$REPO_ROOT/test-framework/evals/tier-2/scenarios/write-journeys-generate.md"
WRITE_E2E_SCENARIO="$REPO_ROOT/test-framework/evals/tier-2/scenarios/write-e2e-spec.md"
RUNNER="$REPO_ROOT/test-framework/evals/tier-2/run-tier2.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

echo "=== Tier 1: tier-2 process assertions ==="

node --check "$HELPER" >/dev/null && ok "process assertion helper syntax valid" || bad "process assertion helper syntax valid"

mkdir -p "$TMP/good/docs/specs/bugfixes" "$TMP/good/.svc" "$TMP/bad/docs/specs/bugfixes" "$TMP/bad/.svc"
cat > "$TMP/good/docs/specs/bugfixes/2026-05-11-todo-creation-brief.md" <<'EOF'
# Bug Diagnosis Brief

## Root Cause
`src/routes/todos.js:42` reads `req.body.titel`; the spec and failing test require `req.body.title`.

## Pattern Scan
`rg "titel|title" src/routes/todos.js src/routes/todos.test.js` found the misspelled field only in the route handler.
EOF
cat > "$TMP/good/.svc/lane-tasks-WI-193.json" <<'EOF'
{"tasks":[{"skill_receipt":{"skill":"diagnose-bug","phases_executed":[{"id":"P3-RootCause"}]}}]}
EOF
cat > "$TMP/bad/docs/specs/bugfixes/2026-05-11-todo-creation-brief.md" <<'EOF'
# Brief

Root cause found. Pattern scan complete.
EOF
cat > "$TMP/bad/.svc/lane-tasks-WI-193.json" <<'EOF'
{"tasks":[{"skill_receipt":{"skill":"diagnose-bug","phases_executed":[]}}]}
EOF
: > "$TMP/output.txt"

node "$HELPER" "$SCENARIO" "$TMP/good" "$TMP/output.txt" >/dev/null && ok "helper accepts substantive diagnose-bug fixture" || bad "helper accepts substantive diagnose-bug fixture"
if node "$HELPER" "$SCENARIO" "$TMP/bad" "$TMP/output.txt" >/dev/null 2>&1; then
  bad "helper rejects placeholder root-cause/pattern fixture"
else
  ok "helper rejects placeholder root-cause/pattern fixture"
fi

grep -q "tier2-process-assertions.mjs" "$RUNNER" && ok "tier-2 runner invokes process assertions" || bad "tier-2 runner invokes process assertions"
grep -q "### Process Checks" "$SCENARIO" && ok "diagnose-bug-typo scenario declares process checks" || bad "diagnose-bug-typo scenario declares process checks"
grep -q '"phase_receipt"' "$SCENARIO" && ok "diagnose-bug-typo requires phase receipt evidence" || bad "diagnose-bug-typo requires phase receipt evidence"
grep -Fq 'src/routes/todos\\.js:[0-9]' "$SCENARIO" && ok "diagnose-bug-typo requires file:line evidence" || bad "diagnose-bug-typo requires file:line evidence"
grep -q "### Process Checks" "$TEST_JOURNEYS_SCENARIO" && ok "test-journeys-runtime scenario declares process checks" || bad "test-journeys-runtime scenario declares process checks"
grep -q "validate-journey-execution-trace" "$TEST_JOURNEYS_SCENARIO" && ok "test-journeys-runtime requires execution trace validation" || bad "test-journeys-runtime requires execution trace validation"
grep -q "scenarios.json" "$TEST_JOURNEYS_SCENARIO" && grep -q "viewport_stage=desktop" "$TEST_JOURNEYS_SCENARIO" && ok "test-journeys-runtime checks terminal inventory and viewport stage" || bad "test-journeys-runtime checks terminal inventory and viewport stage"
grep -q "### Process Checks" "$WRITE_JOURNEYS_SCENARIO" && ok "write-journeys-generate scenario declares process checks" || bad "write-journeys-generate scenario declares process checks"
grep -q "E2E Coverage" "$WRITE_JOURNEYS_SCENARIO" && ok "write-journeys-generate requires E2E bridge handoff" || bad "write-journeys-generate requires E2E bridge handoff"
grep -q '"artifact_not_regex"' "$WRITE_JOURNEYS_SCENARIO" && ok "write-journeys-generate rejects implementation/generic prose" || bad "write-journeys-generate rejects implementation/generic prose"
grep -q "### Process Checks" "$WRITE_E2E_SCENARIO" && ok "write-e2e-spec scenario declares process checks" || bad "write-e2e-spec scenario declares process checks"
grep -q "validate-e2e-selector-discipline" "$WRITE_E2E_SCENARIO" && ok "write-e2e-spec requires selector discipline validator" || bad "write-e2e-spec requires selector discipline validator"
grep -q "positional role selectors" "$WRITE_E2E_SCENARIO" && ok "write-e2e-spec rejects positional role selector drift" || bad "write-e2e-spec rejects positional role selector drift"

if [[ "$fail" -gt 0 ]]; then
  echo
  echo "tier-2 process assertions: $pass passed, $fail failed"
  exit 1
fi

echo
echo "tier-2 process assertions: $pass passed, $fail failed"
