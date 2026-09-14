#!/usr/bin/env bash
# Tier 1: validate write-journeys --auto-discover-chrome helper on a fixture app.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/skills/write-journeys/scripts/auto-discover-chrome.mjs"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

pass() {
  echo "  ✓ $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

mkdir -p "$TMP_DIR/src" "$TMP_DIR/docs/specs/journeys"

cat > "$TMP_DIR/src/Layout.jsx" <<'JSX'
import { Link } from 'react-router-dom';

export default function Layout() {
  return (
    <div>
      <header>
        <button aria-label="Change language">BG</button>
        <button>Open menu</button>
        <Link to="/settings">Settings</Link>
      </header>
    </div>
  );
}
JSX

cat > "$TMP_DIR/src/Sidebar.jsx" <<'JSX'
export function Sidebar() {
  return (
    <aside>
      <a href="/billing">Billing</a>
      <DropdownMenu label="Account actions" />
    </aside>
  );
}
JSX

echo "=== Tier 1: write-journeys chrome auto-discovery ==="

if [[ ! -f "$SCRIPT" ]]; then
  echo "FAIL: helper missing at $SCRIPT"
  exit 1
fi

if node --check "$SCRIPT" >/dev/null; then
  pass "helper syntax valid"
else
  fail "helper syntax invalid"
fi

first_out="$TMP_DIR/first.json"
if node "$SCRIPT" --root "$TMP_DIR" > "$first_out"; then
  pass "helper runs on fixture"
else
  fail "helper failed on fixture"
fi

generated_count="$(find "$TMP_DIR/docs/specs/journeys" -name 'Chrome-*.feature.md' | wc -l | tr -d ' ')"
if [[ "$generated_count" -ge 5 ]]; then
  pass "emits chrome journey skeletons for discovered controls ($generated_count)"
else
  fail "expected at least 5 chrome journey skeletons, got $generated_count"
fi

if grep -R "@chrome-control:" "$TMP_DIR/docs/specs/journeys"/Chrome-*.feature.md >/dev/null; then
  pass "journey skeletons include stable chrome-control traces"
else
  fail "journey skeletons missing chrome-control traces"
fi

if grep -q "src/Layout.jsx:7" "$TMP_DIR/docs/specs/journeys/SUMMARY.md" \
  && grep -q "src/Sidebar.jsx:4" "$TMP_DIR/docs/specs/journeys/SUMMARY.md"; then
  pass "SUMMARY.md cites file:line sources"
else
  fail "SUMMARY.md missing expected file:line citations"
fi

before_hash="$(find "$TMP_DIR/docs/specs/journeys" -name 'Chrome-*.feature.md' -print0 | sort -z | xargs -0 sha256sum)"
node "$SCRIPT" --root "$TMP_DIR" > "$TMP_DIR/second.json"
after_hash="$(find "$TMP_DIR/docs/specs/journeys" -name 'Chrome-*.feature.md' -print0 | sort -z | xargs -0 sha256sum)"
after_count="$(find "$TMP_DIR/docs/specs/journeys" -name 'Chrome-*.feature.md' | wc -l | tr -d ' ')"

if [[ "$after_count" == "$generated_count" ]]; then
  pass "rerun is idempotent for skeleton count"
else
  fail "rerun changed skeleton count ($generated_count -> $after_count)"
fi

if [[ "$before_hash" == "$after_hash" ]]; then
  pass "rerun leaves generated files unchanged"
else
  fail "rerun changed generated file contents"
fi

if grep -q '"source": "src/Layout.jsx:7"' "$first_out"; then
  pass "JSON output includes file:line evidence"
else
  fail "JSON output missing file:line evidence"
fi

echo ""
echo "write-journeys chrome discovery: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
