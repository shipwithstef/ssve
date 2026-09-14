#!/usr/bin/env bash
# Tier-1 validator for WI-305 feature validation closeout ledgers.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS + 1)); }
fail() { echo "  ✗ $1"; FAIL=$((FAIL + 1)); }

expect_pass() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    pass "$label"
  else
    "$@" || true
    fail "$label"
  fi
}

expect_fail() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    fail "$label"
  else
    pass "$label"
  fi
}

echo "=== Tier 1: Feature Closeout Ledger ==="

node --check "$REPO_ROOT/scripts/validate-feature-closeout-ledger.mjs" >/dev/null
pass "validator syntax valid"

mkdir -p "$TMP/.svc/visuals/WI-305/current-state" "$TMP/test-results"
touch "$TMP/.svc/visuals/WI-305/current-state/dialog.png"
touch "$TMP/test-results/e2e-ai-generation.txt"

cat > "$TMP/feature-ai-generation.md" <<'MD'
# Feature: AI Generation

## Acceptance Criteria

| AC | Description | QA | E2E | Test |
|---|---|---|---|---|
| AIG-01 | User can click Generate and save the generated dialog result. | pending | pending | pending |
| AIG-02 | Saved image state is visible on the result page at mobile and desktop viewports. | pending | pending | pending |
MD

cat > "$TMP/FEATURE_VALIDATION_LEDGER.md" <<'MD'
# Feature Validation Ledger

Feature: `AI Generation`
Work item: `WI-305`
Run: `2026-05-11-ai-generation`
Target: `local`

Final closeout classification: `framework-complete`

## AC Closeout Table

| AC ID | Persona(s) | Journey scenario(s) | Validation tier | Evidence path(s) | Runtime result | E2E result | Final |
|---|---|---|---|---|---|---|---|
| AIG-01 | P2 Creator | PASS - J01 @AIG-01 | V2 runtime + V1 tests | test-results/e2e-ai-generation.txt, .svc/visuals/WI-305/current-state/dialog.png | PASS - browser save replay | PASS - e2e/specs/ai-generation.spec.ts | PASS |
| AIG-02 | P2 Creator | PASS - J01 @AIG-02 | V2 runtime + visual | .svc/visuals/WI-305/current-state/dialog.png | PASS - mobile and desktop replay | PASS - e2e/specs/ai-generation.spec.ts | PASS |

## Final Closeout Classification

`framework-complete`
MD

pushd "$TMP" >/dev/null
expect_pass "valid ledger covers every AC exactly once" \
  node "$REPO_ROOT/scripts/validate-feature-closeout-ledger.mjs" \
    --feature feature-ai-generation.md \
    --ledger FEATURE_VALIDATION_LEDGER.md
popd >/dev/null

cp "$TMP/FEATURE_VALIDATION_LEDGER.md" "$TMP/missing-ledger.md"
node - "$TMP/missing-ledger.md" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
const text = fs.readFileSync(file, "utf8").replace(/\n\| AIG-02 \|[^\n]+/, "");
fs.writeFileSync(file, text);
NODE

pushd "$TMP" >/dev/null
expect_fail "ledger fails when an AC row is missing" \
  node "$REPO_ROOT/scripts/validate-feature-closeout-ledger.mjs" \
    --feature feature-ai-generation.md \
    --ledger missing-ledger.md
popd >/dev/null

cp "$TMP/FEATURE_VALIDATION_LEDGER.md" "$TMP/api-only-ledger.md"
node - "$TMP/api-only-ledger.md" <<'NODE'
const fs = require("node:fs");
const file = process.argv[2];
let text = fs.readFileSync(file, "utf8");
text = text.replace(".svc/visuals/WI-305/current-state/dialog.png", "test-results/e2e-ai-generation.txt");
text = text.replace("PASS - mobile and desktop replay", "blocked");
fs.writeFileSync(file, text);
NODE

pushd "$TMP" >/dev/null
expect_fail "WI-233-style API-only/blocked visual closeout fails" \
  node "$REPO_ROOT/scripts/validate-feature-closeout-ledger.mjs" \
    --feature feature-ai-generation.md \
    --ledger api-only-ledger.md
popd >/dev/null

echo
echo "feature closeout ledger: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then exit 1; fi
