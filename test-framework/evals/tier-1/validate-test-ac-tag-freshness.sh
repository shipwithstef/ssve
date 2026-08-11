#!/bin/bash
# Tier-1 validator for WI-391 derived test→AC coverage tags.
# Mirrors WI-364's derive-then-verify tamper eval: the spec's Test/E2E columns
# and sync-spec-code's [TEST]-tier reconciliation become a verifier over tags
# that tests carry in source. The orphan-tag case is the freshness/tamper
# guard — a `@AC-<ID>` naming a spec AC that was renamed or removed must FAIL.
# Hermetic, deterministic, no network/no-LLM, <5s.

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

LINKER="$REPO_ROOT/scripts/verify-test-ac-tags.mjs"

echo "=== Tier 1: Test→AC Tag Freshness (WI-391) ==="

node --check "$LINKER" >/dev/null && pass "test-ac linker syntax valid" || fail "test-ac linker syntax valid"

# --- Fixture: a spec with the shared 5-column AC table -------------------------
mk_spec() {
  local root="$1"
  mkdir -p "$root/docs/specs/features"
  cat > "$root/docs/specs/features/feature-cart.md" <<'MD'
# Feature: Cart

### Acceptance Criteria — Cart

| AC | Description | QA | E2E | Test |
|----|-------------|-----|-----|------|
| CART-01 | Item adds to cart | — | 🔲 | — |
| CART-02 | Quantity updates total | — | 🔲 | — |
MD
}

mk_test() {
  local root="$1" tag="$2"
  mkdir -p "$root/e2e/specs"
  cat > "$root/e2e/specs/cart.spec.ts" <<TS
// @AC-${tag}
test('adds item to cart', async ({ page }) => {
  await page.getByRole('button', { name: /add to cart/i }).click();
});
TS
}

# (a) tagged test + matching spec AC -> PASS
mk_spec "$TMP/good"
mk_test "$TMP/good" "CART-01"
expect_pass "tagged test resolving to a real spec AC passes" node "$LINKER" --root "$TMP/good"

# (b) orphan tag (AC renamed/removed from spec) -> FAIL  [tamper/freshness case]
mk_spec "$TMP/orphan"
mk_test "$TMP/orphan" "CART-99"
expect_fail "orphan @AC tag with no matching spec AC fails" node "$LINKER" --root "$TMP/orphan"

# (c) no tagged tests at all -> PASS (vacuous; a tag-grep cannot invent coverage)
mk_spec "$TMP/empty"
mkdir -p "$TMP/empty/e2e/specs"
cat > "$TMP/empty/e2e/specs/cart.spec.ts" <<'TS'
test('adds item to cart', async ({ page }) => {
  await page.getByRole('button', { name: /add to cart/i }).click();
});
TS
expect_pass "untagged test suite passes (no false orphan)" node "$LINKER" --root "$TMP/empty"

# (d) case-sensitivity of the AC-ID convention is load-bearing: a lowercased
#     tag must NOT match a real uppercase spec AC (no IGNORECASE).
mk_spec "$TMP/case"
mkdir -p "$TMP/case/e2e/specs"
cat > "$TMP/case/e2e/specs/cart.spec.ts" <<'TS'
// @AC-cart-01  (wrong case — not the spec's CART-01)
test('adds item to cart', async ({ page }) => {
  await page.getByRole('button', { name: /add to cart/i }).click();
});
TS
expect_pass "lowercased tag is ignored, not matched to uppercase AC" node "$LINKER" --root "$TMP/case"

# --- SKILL.md wiring: the convention must be declared where tests are authored -
grep -q "verify-test-ac-tags.mjs" "$REPO_ROOT/skills/write-e2e/SKILL.md" \
  && pass "write-e2e references the test-ac tag verifier" \
  || fail "write-e2e references the test-ac tag verifier"
grep -q "@AC-" "$REPO_ROOT/skills/write-e2e/SKILL.md" \
  && pass "write-e2e documents the @AC-<ID> source tag" \
  || fail "write-e2e documents the @AC-<ID> source tag"
grep -q "@AC-" "$REPO_ROOT/skills/test-journeys/SKILL.md" \
  && pass "test-journeys QA path documents the @AC-<ID> source tag" \
  || fail "test-journeys QA path documents the @AC-<ID> source tag"
grep -q "verify-test-ac-tags.mjs" "$REPO_ROOT/skills/sync-spec-code/SKILL.md" \
  && pass "sync-spec-code [TEST]-tier cites the derived-tag verifier" \
  || fail "sync-spec-code [TEST]-tier cites the derived-tag verifier"

echo
echo "test-ac tag freshness: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
