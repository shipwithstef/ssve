#!/bin/bash
# validate-review-plan-readonly.sh — WI-075 tier-1 validator.
#
# Asserts reviewer adapters retain their safety contracts:
#   1. Read-only enforcement (kimi inline; Codex delegated to canonical launcher)
#   2. OUTPUT-FIRST preamble in the prompt
#   3. Kimi tail-parse and Codex shared-schema validation
#   4. Exit-code contract comment block (0/1/2/3 documented)
#   5. Lane-compliance focus dimension (g) in the prompt

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
KIMI="$REPO_ROOT/scripts/review-plan-kimi.sh"
CODEX="$REPO_ROOT/scripts/review-plan-codex.sh"

PASS=0
FAIL=0
FAILS=()

pass() { PASS=$((PASS+1)); echo "  ✓ $1"; }
fail() { FAIL=$((FAIL+1)); FAILS+=("$1"); echo "  ✗ $1"; }

echo "=== Tier 1: review-plan reviewer hardening (WI-075) ==="

[ -r "$KIMI" ] && pass "kimi script present" || { fail "kimi script missing"; exit 1; }
[ -r "$CODEX" ] && pass "codex script present" || { fail "codex script missing"; exit 1; }

# 1. Read-only enforcement
grep -q "READ-ONLY CONTRACT" "$KIMI" && pass "kimi: READ-ONLY CONTRACT in prompt" || fail "kimi: READ-ONLY CONTRACT missing from prompt"
grep -q -- "run-external-review.mjs" "$CODEX" && grep -q -- "--sandbox read-only" "$CODEX" && pass "codex: canonical launcher owns read-only isolation" || fail "codex: launcher delegation/read-only contract missing"

# 2. OUTPUT-FIRST preamble
grep -q "OUTPUT-FIRST PROTOCOL" "$KIMI" && pass "kimi: OUTPUT-FIRST preamble present" || fail "kimi: OUTPUT-FIRST preamble missing"
grep -q "OUTPUT-FIRST PROTOCOL" "$CODEX" && pass "codex: OUTPUT-FIRST preamble present" || fail "codex: OUTPUT-FIRST preamble missing"

# 3. Tail-parse for findings block + exit 2 on missing
grep -q "findings:\|rubric_score:\|yaml" "$KIMI" && pass "kimi: tail-parse regex present" || fail "kimi: tail-parse regex missing"
grep -q "Array.isArray(f.findings)" "$CODEX" && pass "codex: shared findings envelope validated" || fail "codex: shared findings envelope validation missing"
grep -q "findings missing" "$KIMI" && pass "kimi: exit-2-on-findings-missing path present" || fail "kimi: exit-2-on-findings-missing path missing"
grep -q "findings missing" "$CODEX" && pass "codex: exit-2-on-findings-missing path present" || fail "codex: exit-2-on-findings-missing path missing"

# 3b. Codex adapter cannot construct a paid provider command locally.
if ! grep -qE 'codex exec|claude (-p|--print)' "$CODEX"; then
  pass "codex: no direct paid provider command"
else
  fail "codex: direct paid provider command bypasses canonical launcher"
fi

# 4. Exit-code contract documentation (0/1/2/3 all named)
for code in 0 1 2 3; do
  grep -qE "^#\s+${code}\s+—" "$KIMI" && pass "kimi: exit code $code documented" || fail "kimi: exit code $code not documented in header"
  grep -qE "^#\s+${code}\s+—" "$CODEX" && pass "codex: exit code $code documented" || fail "codex: exit code $code not documented in header"
done

# 5. Lane-compliance focus dimension
grep -qi "lane compliance" "$KIMI" && pass "kimi: lane-compliance focus item present" || fail "kimi: lane-compliance focus item missing"
grep -qi "lane compliance" "$CODEX" && pass "codex: lane-compliance focus item present" || fail "codex: lane-compliance focus item missing"

# 6. Protocol doc also references lane-compliance
grep -qi "lane compliance" "$REPO_ROOT/references/plan-review-protocol.md" && pass "protocol doc: lane-compliance dimension documented" || fail "protocol doc: lane-compliance dimension missing"

echo ""
if [ "$FAIL" = 0 ]; then
  echo "  PASS — all $PASS assertions passed"
  exit 0
else
  echo "  $FAIL failed, $PASS passed"
  for e in "${FAILS[@]}"; do echo "    - $e"; done
  exit 1
fi
