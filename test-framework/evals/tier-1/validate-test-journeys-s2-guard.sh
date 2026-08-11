#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/validate-s2-justification.mjs"
SKILL="$REPO_ROOT/skills/test-journeys/SKILL.md"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

pass=0
fail=0

ok() { echo "  PASS - $1"; pass=$((pass + 1)); }
bad() { echo "  FAIL - $1"; fail=$((fail + 1)); }

echo "=== Tier 1: test-journeys S2 guard ==="

node --check "$HELPER" >/dev/null && ok "S2 helper syntax valid" || bad "S2 helper syntax valid"

cat >"$TMP_DIR/good.md" <<'EOF'
S2: visual judgment for brand polish subjective_or_real_data=true automation_exhausted=true user_only_claim=true
EOF

cat >"$TMP_DIR/bad.md" <<'EOF'
S2: user should check that signup works
EOF

node "$HELPER" --summary "$TMP_DIR/good.md" >/dev/null && ok "valid S2 justification passes" || bad "valid S2 justification passes"
if node "$HELPER" --summary "$TMP_DIR/bad.md" >/tmp/svc-s2-bad.out 2>&1; then
  bad "bad S2 justification fails"
else
  grep -q "all three required conditions" /tmp/svc-s2-bad.out && ok "bad S2 justification fails" || bad "bad S2 failure explains condition requirement"
fi

if grep -q "ALL THREE conditions" "$SKILL" && grep -q "subjective_or_real_data=true" "$SKILL"; then
  ok "test-journeys documents machine-readable S2 condition markers"
else
  bad "test-journeys documents machine-readable S2 condition markers"
fi

echo
echo "test-journeys S2 guard: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
