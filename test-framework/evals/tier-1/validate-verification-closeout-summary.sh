#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/validate-verification-closeout-summary.mjs"
VERIFY="$REPO_ROOT/skills/verify-promotion/SKILL.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if grep -qE "$pattern" "$file"; then ok "$label"; else bad "$label"; fi
}

echo "=== Tier 1: verification closeout summary ==="

node --check "$HELPER" >/dev/null && ok "closeout summary validator syntax valid" || bad "closeout summary validator syntax valid"

cat >"$TMP_DIR/bad-missing-label.md" <<'EOF'
# Bundle proof

bundle-grep found Submit in dist/main.js.
EOF

if node "$HELPER" --summary "$TMP_DIR/bad-missing-label.md" >/tmp/svc-closeout-bad-label.out 2>&1; then
  bad "bundle-grep proof without V0 label fails"
else
  grep -q "Verification tier: V0" /tmp/svc-closeout-bad-label.out && ok "bundle-grep proof without V0 label fails" || bad "V0 label failure explains requirement"
fi

cat >"$TMP_DIR/bad-i18n-closeout.md" <<'EOF'
# i18n campaign closeout

Verification tier: V0

| item | target_class | verification_tier | sampled | evidence |
|---|---|---|---|---|
| PR-101 | browser-visible | V0 | false | bundle-grep dist/main.js |

Cumulative status: VERIFIED complete.
EOF

if node "$HELPER" --summary "$TMP_DIR/bad-i18n-closeout.md" >/tmp/svc-closeout-bad-i18n.out 2>&1; then
  bad "i18n-style V0 browser-visible verified closeout fails"
else
  grep -q "browser-visible item remains V0-only" /tmp/svc-closeout-bad-i18n.out && ok "i18n-style V0 browser-visible verified closeout fails" || bad "i18n-style failure explains V0 browser-visible row"
fi

cat >"$TMP_DIR/good-single-lane.md" <<'EOF'
# Single lane closeout

Verification tier: V0

single_lane_summary:
  item: WI-999
  target_class: api
  verification_tier: V0
  sampled: true
  evidence:
    - docs/logs/static-proof.md

Cumulative status: PARTIAL - browser-visible V0-only rows remain unverified.
EOF

node "$HELPER" --summary "$TMP_DIR/good-single-lane.md" >/dev/null && ok "qualified single-lane V0 summary passes" || bad "qualified single-lane V0 summary passes"

contains "$VERIFY" "validate-verification-closeout-summary\\.mjs" "verify-promotion invokes closeout summary validator"
contains "$VERIFY" "Verification tier: V0" "verify-promotion requires V0 label"
contains "$VERIFY" "single_lane_summary" "verify-promotion extends sampled-row fields to single-lane summary"

echo
echo "verification closeout summary: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
