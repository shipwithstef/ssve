#!/usr/bin/env bash
# Tier 1: exercise the verification-delegation detection engine against
# good/bad fixtures.
#
# Detection validator behavior:
#   - The good/ fixtures MUST produce zero actionable findings.
#   - The bad/ fixtures MUST each produce >= 1 actionable finding.
#   - Any false positive/negative fails tier-1.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCANNER="$REPO_ROOT/scripts/scan-verification-delegation.mjs"
FIXTURE_DIR="$REPO_ROOT/test-framework/evals/tier-1/fixtures/verification-delegation"
ADVISORY=0
FAIL=0

advise() {
  echo "  ADVISORY: $1"
  ADVISORY=$((ADVISORY + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

if [[ ! -x "$SCANNER" && ! -f "$SCANNER" ]]; then
  fail "scanner not found at $SCANNER"
  exit 1
fi

if [[ ! -d "$FIXTURE_DIR" ]]; then
  fail "fixture directory not found at $FIXTURE_DIR"
  exit 1
fi

echo "=== Tier 1: Verification-Delegation Detection (WI-197 enforcing) ==="

# --- good/ fixtures: must produce zero actionable findings ---
GOOD_FAIL=0
shopt -s nullglob
for f in "$FIXTURE_DIR"/good/*.txt; do
  rel="${f#$REPO_ROOT/}"
  result=$(node "$SCANNER" --file "$f" --input-path "$f" --format json 2>&1)
  rc=$?
  if [[ $rc -ne 0 ]]; then
    fail "$rel — scanner returned non-zero ($rc)"
    continue
  fi
  actionable=$(printf '%s' "$result" | jq -r '.actionable_count // 0')
  exempt=$(printf '%s' "$result" | jq -r '.exempt // false')
  if [[ "$actionable" -gt 0 ]]; then
    fail "$rel — false-positive: $actionable actionable finding(s) in good fixture"
    GOOD_FAIL=$((GOOD_FAIL + 1))
  fi
done

# --- bad/ fixtures: must produce >= 1 actionable finding each ---
BAD_FAIL=0
BAD_COUNT=0
for f in "$FIXTURE_DIR"/bad/*.txt; do
  BAD_COUNT=$((BAD_COUNT + 1))
  rel="${f#$REPO_ROOT/}"
  result=$(node "$SCANNER" --file "$f" --input-path "$f" --format json 2>&1)
  rc=$?
  if [[ $rc -ne 0 ]]; then
    fail "$rel — scanner returned non-zero ($rc)"
    continue
  fi
  actionable=$(printf '%s' "$result" | jq -r '.actionable_count // 0')
  if [[ "$actionable" -lt 1 ]]; then
    fail "$rel — false-negative: bad fixture produced zero actionable findings"
    BAD_FAIL=$((BAD_FAIL + 1))
  fi
done
shopt -u nullglob

# --- Patterns config self-check: at least one delegation pattern + one anchor ---
PATTERNS_FILE="$REPO_ROOT/references/verification-delegation-patterns.json"
if [[ -f "$PATTERNS_FILE" ]]; then
  delegation_count=$(jq -r '.delegation_patterns | length' "$PATTERNS_FILE")
  anchor_count=$(jq -r '.evidence_anchor_patterns | length' "$PATTERNS_FILE")
  if [[ "$delegation_count" -lt 3 ]]; then
    fail "patterns config: only $delegation_count delegation patterns (expected ≥ 3)"
  fi
  if [[ "$anchor_count" -lt 1 ]]; then
    fail "patterns config: $anchor_count evidence-anchor patterns (expected ≥ 1)"
  fi
else
  fail "patterns file missing at $PATTERNS_FILE"
fi

echo "  Bad fixtures exercised: $BAD_COUNT"
echo "  False-positive count (good fixtures with actionable findings): $GOOD_FAIL"
echo "  False-negative count (bad fixtures with zero actionable): $BAD_FAIL"
echo "  Total advisory lines: $ADVISORY"
if [[ $GOOD_FAIL -eq 0 && $BAD_FAIL -eq 0 && $FAIL -eq 0 ]]; then
  echo "  PASS — engine detects all bad fixtures and stays silent on good fixtures"
else
  echo "  FAIL — detection false positives/negatives must be fixed"
fi

# --- WI-399 A9: artifact-grounded Stop-gate contract -------------------------
# The hard gate is keyed to state: blocks ONLY when a browser-visible WI is
# active AND no recent runtime-evidence artifact exists; else advisory.
GUARD="$REPO_ROOT/scripts/verification-stop-guard.mjs"
DELEG_MSG='All done. Please manually verify the toast appears and manually confirm the dropdown opens.'
A9_TMP="$(mktemp -d)"
mkdir -p "$A9_TMP/.svc"
a9_case() {
  local name="$1"; local expect_block="$2"
  local payload out code
  payload=$(node -e 'process.stdout.write(JSON.stringify({last_assistant_message: process.argv[1]}))' "$DELEG_MSG")
  out=$( cd "$A9_TMP" && printf '%s' "$payload" | node "$GUARD" 2>/dev/null )
  code=$?
  local blocked="no"
  [[ "$out" == *'"decision":"block"'* ]] && blocked="yes"
  if [[ "$blocked" == "$expect_block" ]]; then
    echo "  ✓ A9 $name"
  else
    echo "  FAIL: A9 $name — expected block=$expect_block got block=$blocked (exit=$code)"
    FAIL=$((FAIL+1))
  fi
}
# 1. no browser-visible WI active -> advisory (no block)
a9_case "no browser-visible WI -> advisory" "no"
# 2. browser-visible WI active, NO evidence artifact -> HARD BLOCK (negative fixture)
cat > "$A9_TMP/.svc/lane-tasks-WI-vis.json" <<'JSON'
{"wi":"WI-vis","lane":"brownfield-feature","delivery_graph":{"lane":"brownfield-feature","risk_flags":["browser-visible"]},"tasks":[{"id":"t1","skill":"execute-changeset","status":"in_progress"}]}
JSON
a9_case "browser WI + no artifact -> blocks" "yes"
# 3. browser-visible WI + fresh evidence artifact -> advisory
mkdir -p "$A9_TMP/.svc/visuals/WI-vis"
touch "$A9_TMP/.svc/visuals/WI-vis/home-desktop.png"
a9_case "browser WI + fresh artifact -> advisory" "no"
rm -rf "$A9_TMP"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
