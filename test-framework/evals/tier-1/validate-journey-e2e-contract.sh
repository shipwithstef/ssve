#!/bin/bash
# Tier-1 validator for WI-307 journey/E2E contract hardening.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

expect_pass() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then pass "$label"; else "$@" || true; fail "$label"; fi
}

expect_fail() {
  local label="$1"; shift
  if "$@" >/dev/null 2>&1; then fail "$label"; else pass "$label"; fi
}

echo "=== Tier 1: Journey/E2E Contract Hardening ==="

node --check "$REPO_ROOT/scripts/validate-e2e-selector-discipline.mjs" >/dev/null && pass "selector validator syntax valid" || fail "selector validator syntax valid"
node --check "$REPO_ROOT/scripts/verify-journey-e2e-bridge.mjs" >/dev/null && pass "journey bridge validator syntax valid" || fail "journey bridge validator syntax valid"
node --check "$REPO_ROOT/scripts/validate-journey-execution-trace.mjs" >/dev/null && pass "journey execution trace validator syntax valid" || fail "journey execution trace validator syntax valid"

mkdir -p "$TMP/good/e2e/specs" "$TMP/bad/e2e/specs" "$TMP/bridge" "$TMP/trace"

cat > "$TMP/good/e2e/specs/todo.spec.ts" <<'TS'
test('creates todo', async ({ page }) => {
  await page.locator('[data-testid="todo-title"]').fill('milk');
  await page.getByRole('button', { name: /save todo/i }).click();
});
TS
cat > "$TMP/bad/e2e/specs/todo.spec.ts" <<'TS'
test('chooses location', async ({ page }) => {
  await page.getByRole('combobox').first().click();
});
TS
cat > "$TMP/good/e2e/specs/exception.spec.ts" <<'TS'
test('legacy stable position', async ({ page }) => {
  // selector-exception: no stable alternative; position asserted stable by fixture render order.
  await page.getByRole('combobox').first().click();
});
TS

expect_pass "semantic/testid selectors pass" node "$REPO_ROOT/scripts/validate-e2e-selector-discipline.mjs" --root "$TMP/good"
expect_fail "positional role selector fails without exception" node "$REPO_ROOT/scripts/validate-e2e-selector-discipline.mjs" --root "$TMP/bad"

cat > "$TMP/bridge/good.feature.md" <<'MD'
# J01: Todo Flow

`@TODO-01`
## Scenario: User creates a todo from the Add Todo form
- Given I am on the Todo list page
- When I fill "Todo title" with "Buy milk"
- And I click the "Save todo" button
- Then I see "Buy milk" in the active todo list

## E2E Coverage

- `e2e/specs/todo.spec.ts` covers `@TODO-01`.
MD
cat > "$TMP/bridge/bad.feature.md" <<'MD'
# J02: Bad Flow

## Scenario: User does a thing
- Given I am on the app
- When I click the primary CTA
- Then it works
MD

expect_pass "journey bridge accepts specific AC-tagged E2E-ready journey" node "$REPO_ROOT/scripts/verify-journey-e2e-bridge.mjs" "$TMP/bridge/good.feature.md"
expect_fail "journey bridge rejects generic untraceable journey" node "$REPO_ROOT/scripts/verify-journey-e2e-bridge.mjs" "$TMP/bridge/bad.feature.md"

cat > "$TMP/trace/SUMMARY.md" <<'MD'
# Journey QA Summary

viewport_stage=desktop

✅ 05-11 (code) src/pages/Login.tsx:42 — login form fields exist before browser run.

Closeout:
node scripts/verify-skill-contract.mjs test-journeys-closeout --summary docs/specs/features/test-evidence/run/SUMMARY.md --scenarios docs/specs/features/test-evidence/run/scenarios.json --next write-e2e
MD
cat > "$TMP/trace/scenarios.json" <<'JSON'
[
  {"id":"J01-s1","status":"executed","evidence_path":".svc/visuals/WI-001/login.png"},
  {"id":"J01-s2","status":"skipped-infeasible","wi_path":"docs/specs/work-items/WI-999.md"},
  {"id":"J01-s3","status":"skipped-user-approved","approval":"2026-05-11 user approved skipping external bank account flow"}
]
JSON
cat > "$TMP/trace/bad-scenarios.json" <<'JSON'
[
  {"id":"J01-s1","status":"pending","skip_reason":"low value given time"}
]
JSON

expect_pass "journey execution trace accepts terminal executed/skipped evidence" node "$REPO_ROOT/scripts/validate-journey-execution-trace.mjs" --summary "$TMP/trace/SUMMARY.md" --scenarios "$TMP/trace/scenarios.json"
expect_fail "journey execution trace rejects pending/efficiency skip" node "$REPO_ROOT/scripts/validate-journey-execution-trace.mjs" --summary "$TMP/trace/SUMMARY.md" --scenarios "$TMP/trace/bad-scenarios.json"

grep -q "mode: e2e-test" "$REPO_ROOT/skills/diagnose-bug/SKILL.md" && pass "diagnose-bug documents e2e-test mode" || fail "diagnose-bug documents e2e-test mode"
grep -q "validate-e2e-selector-discipline.mjs" "$REPO_ROOT/skills/write-e2e/SKILL.md" && pass "write-e2e requires selector validator" || fail "write-e2e requires selector validator"
grep -q "validate-e2e-selector-discipline.mjs" "$REPO_ROOT/skills/test-journeys/SKILL.md" && pass "test-journeys inherits selector validator for E2E follow-ups" || fail "test-journeys inherits selector validator for E2E follow-ups"
grep -q "verify-journey-e2e-bridge.mjs" "$REPO_ROOT/skills/write-journeys/SKILL.md" && pass "write-journeys requires bridge validator" || fail "write-journeys requires bridge validator"
grep -q "validate-journey-execution-trace.mjs" "$REPO_ROOT/skills/test-journeys/SKILL.md" && pass "test-journeys requires execution trace validator" || fail "test-journeys requires execution trace validator"
grep -q "### Process Checks" "$REPO_ROOT/test-framework/evals/tier-2/scenarios/test-journeys-runtime.md" && pass "test-journeys tier-2 scenario declares process checks" || fail "test-journeys tier-2 scenario declares process checks"
grep -q "### Process Checks" "$REPO_ROOT/test-framework/evals/tier-2/scenarios/write-journeys-generate.md" && pass "write-journeys tier-2 scenario declares process checks" || fail "write-journeys tier-2 scenario declares process checks"
grep -q "### Process Checks" "$REPO_ROOT/test-framework/evals/tier-2/scenarios/write-e2e-spec.md" && pass "write-e2e tier-2 scenario declares process checks" || fail "write-e2e tier-2 scenario declares process checks"

echo
echo "journey/e2e contract: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
