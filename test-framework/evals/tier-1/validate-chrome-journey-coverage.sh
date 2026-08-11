#!/usr/bin/env bash
# Tier 1: validate chrome journey coverage validator and adaptation-window behavior.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/scripts/validate-chrome-journey-coverage.mjs"

if [[ "${1:-}" == "--root" ]]; then
  node "$SCRIPT" "$@"
  exit $?
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

pass() { echo "  PASS - $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL - $1"; FAIL=$((FAIL + 1)); }

echo "=== Tier 1: chrome journey coverage ==="

mkdir -p "$TMP_DIR/src" "$TMP_DIR/.svc" "$TMP_DIR/docs/specs/journeys"
cat > "$TMP_DIR/src/Layout.jsx" <<'JSX'
export default function Layout() {
  return <button aria-label="Change language">BG</button>;
}
JSX
echo "2026-05-01T00:00:00Z" > "$TMP_DIR/.svc/chrome-coverage-installed-at"

if node --check "$SCRIPT" >/dev/null; then
  pass "validator syntax valid"
else
  fail "validator syntax invalid"
fi

if node "$SCRIPT" --root "$TMP_DIR" --now 2026-05-11T00:00:00Z > "$TMP_DIR/warn.out"; then
  if grep -Fq "[chrome-coverage WARN]" "$TMP_DIR/warn.out"; then
    pass "uncovered chrome warns during adaptation window"
  else
    fail "adaptation-window warning text missing"
  fi
else
  fail "validator hard-failed during adaptation window"
fi

if node "$SCRIPT" --root "$TMP_DIR" --now 2026-06-05T00:00:00Z > "$TMP_DIR/high.out"; then
  fail "validator did not fail after adaptation window"
else
  if grep -Fq "[chrome-coverage HIGH]" "$TMP_DIR/high.out"; then
    pass "uncovered chrome escalates to HIGH after 30 days"
  else
    fail "HIGH escalation text missing"
  fi
fi

cat > "$TMP_DIR/docs/specs/journeys/Chrome-button-layout-change-language.feature.md" <<'MD'
# Chrome button: Change language

**Trace:** @chrome-control:layout-button-change-language
MD

if node "$SCRIPT" --root "$TMP_DIR" --now 2026-06-05T00:00:00Z > "$TMP_DIR/pass.out"; then
  pass "covered chrome passes after journey trace exists"
else
  fail "covered chrome still failed"
fi

rm -f "$TMP_DIR/docs/specs/journeys/Chrome-button-layout-change-language.feature.md"
cat > "$TMP_DIR/.svc/lane-tasks-WI-TEST.json" <<'JSON'
{
  "notes": ["concern-waived: chrome-coverage - legacy project backlog accepted for this lane"]
}
JSON
if node "$SCRIPT" --root "$TMP_DIR" --now 2026-06-05T00:00:00Z > "$TMP_DIR/waived.out"; then
  pass "lane-task waiver suppresses HIGH block"
else
  fail "lane-task waiver did not suppress HIGH block"
fi

rm -f "$TMP_DIR/.svc/lane-tasks-WI-TEST.json"
echo "active_mode: bootstrap" > "$TMP_DIR/REPO_MODES.md"
if node "$SCRIPT" --root "$TMP_DIR" --now 2026-06-05T00:00:00Z > "$TMP_DIR/bootstrap.out"; then
  if grep -Fq "bootstrap_mode" "$TMP_DIR/bootstrap.out"; then
    pass "bootstrap mode skips chrome coverage"
  else
    fail "bootstrap skip reason missing"
  fi
else
  fail "bootstrap mode did not skip"
fi

if grep -Fq "validate-chrome-journey-coverage.sh" "$REPO_ROOT/docs/specs/work-items/WI-170.md"; then
  pass "WI-170 names the validator"
else
  fail "WI-170 missing validator reference"
fi

echo ""
echo "chrome journey coverage: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
