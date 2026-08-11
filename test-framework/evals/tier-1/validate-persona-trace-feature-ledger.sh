#!/usr/bin/env bash
# Tier-1 validator for concrete persona trace enforcement in feature closeout ledgers.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
VALIDATOR="$REPO_ROOT/scripts/validate-feature-closeout-ledger.mjs"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

pass() {
  echo "  PASS - $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL - $1"
  FAIL=$((FAIL + 1))
}

EVIDENCE="$TMP_DIR/screenshot.png"
echo "runtime proof" > "$EVIDENCE"

write_feature() {
  local file="$1"
  cat > "$file" <<'MARKDOWN'
# Feature: Persona Trace Probe

## Acceptance Criteria

| AC | Description | QA | E2E | Test |
|----|-------------|----|-----|------|
| TRACE-01 | Customer sees the assistant recommendation screen | - | - | - |
| TRACE-02 | Internal sync writes audit metadata | - | - | - |
MARKDOWN
}

write_ledger() {
  local file="$1"
  local persona_1="$2"
  cat > "$file" <<MARKDOWN
# Feature Validation Ledger

Final closeout classification: runtime-accepted

| AC ID | Persona(s) | Journey scenario(s) | Validation tier | Evidence path(s) | Runtime result | E2E result | Final |
|-------|------------|---------------------|-----------------|------------------|----------------|------------|-------|
| TRACE-01 | $persona_1 | PASS - J01 customer assistant | runtime | $EVIDENCE | PASS | PASS | PASS |
| TRACE-02 | N/A - backend audit metadata with no user/admin journey | N/A - internal sync only | unit | $EVIDENCE | PASS | N/A - unit covered | PASS |
MARKDOWN
}

expect_pass() {
  local feature="$1"
  local ledger="$2"
  local label="$3"
  if node "$VALIDATOR" --feature "$feature" --ledger "$ledger" >/dev/null 2>&1; then
    pass "$label"
  else
    node "$VALIDATOR" --feature "$feature" --ledger "$ledger" || true
    fail "$label"
  fi
}

expect_fail_persona_trace() {
  local feature="$1"
  local ledger="$2"
  local label="$3"
  local out="$TMP_DIR/out.txt"
  if node "$VALIDATOR" --feature "$feature" --ledger "$ledger" >"$out" 2>&1; then
    fail "$label"
  elif grep -q "lacks concrete persona trace" "$out"; then
    pass "$label"
  else
    cat "$out"
    fail "$label"
  fi
}

echo "=== Tier 1: Persona Trace Feature Ledger Gate ==="

node --check "$VALIDATOR" >/dev/null && pass "feature ledger validator syntax valid" || fail "feature ledger validator syntax invalid"

FEATURE="$TMP_DIR/feature.md"
write_feature "$FEATURE"

WEAK_LEDGER="$TMP_DIR/weak-ledger.md"
write_ledger "$WEAK_LEDGER" "PASS"
expect_fail_persona_trace "$FEATURE" "$WEAK_LEDGER" "weak Persona(s)=PASS fails"

ID_LEDGER="$TMP_DIR/id-ledger.md"
write_ledger "$ID_LEDGER" "P2 Real-Time Discovery Customer"
expect_pass "$FEATURE" "$ID_LEDGER" "persona id trace passes"

PATH_LEDGER="$TMP_DIR/path-ledger.md"
write_ledger "$PATH_LEDGER" "docs/specs/personas/P2-real-time-discovery-customer.md"
expect_pass "$FEATURE" "$PATH_LEDGER" "persona path trace passes"

echo "persona trace feature ledger gate: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
