#!/usr/bin/env bash
# Tier 1: exercise the WI-197 detection engine with the WI-199 bundle-grep
# substitution patterns config. Asserts good fixtures stay silent and bad
# fixtures each produce >= 1 actionable finding.
#
# Engine: scripts/scan-verification-delegation.mjs (shared with WI-197)
# Config: references/bundle-grep-substitution-patterns.json (WI-199-specific)
#
# Enforcement behavior: any good/ false positive or bad/ false negative fails
# tier-1. The Stop hook uses the same engine/config to hard-block closeouts.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCANNER="$REPO_ROOT/scripts/scan-verification-delegation.mjs"
CONFIG="$REPO_ROOT/references/bundle-grep-substitution-patterns.json"
FIXTURE_DIR="$REPO_ROOT/test-framework/evals/tier-1/fixtures/bundle-grep-substitution"
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

if [[ ! -f "$SCANNER" ]]; then
  fail "scanner not found at $SCANNER"
  exit 1
fi
if [[ ! -f "$CONFIG" ]]; then
  fail "patterns config not found at $CONFIG"
  exit 1
fi
if [[ ! -d "$FIXTURE_DIR" ]]; then
  fail "fixture directory not found at $FIXTURE_DIR"
  exit 1
fi

echo "=== Tier 1: Bundle-Grep Substitution Detection (WI-199 enforcing) ==="

# --- good/ fixtures: must produce zero actionable findings ---
GOOD_FAIL=0
shopt -s nullglob
for f in "$FIXTURE_DIR"/good/*.txt; do
  rel="${f#$REPO_ROOT/}"
  result=$(node "$SCANNER" --config "$CONFIG" --file "$f" --input-path "$f" --format json 2>&1)
  rc=$?
  if [[ $rc -ne 0 ]]; then
    fail "$rel — scanner returned non-zero ($rc)"
    continue
  fi
  actionable=$(printf '%s' "$result" | jq -r '.actionable_count // 0')
  if [[ "$actionable" -gt 0 ]]; then
    fail "$rel — false-positive: $actionable actionable finding(s) in good fixture"
    GOOD_FAIL=$((GOOD_FAIL + 1))
  fi
done

# --- bad/ fixtures: must each produce >= 1 actionable finding ---
BAD_FAIL=0
BAD_COUNT=0
for f in "$FIXTURE_DIR"/bad/*.txt; do
  BAD_COUNT=$((BAD_COUNT + 1))
  rel="${f#$REPO_ROOT/}"
  result=$(node "$SCANNER" --config "$CONFIG" --file "$f" --input-path "$f" --format json 2>&1)
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

# --- Patterns config self-check ---
delegation_count=$(jq -r '.delegation_patterns | length' "$CONFIG")
anchor_count=$(jq -r '.evidence_anchor_patterns | length' "$CONFIG")
if [[ "$delegation_count" -lt 3 ]]; then
  fail "patterns config: only $delegation_count substitution patterns (expected ≥ 3)"
fi
if [[ "$anchor_count" -lt 1 ]]; then
  fail "patterns config: $anchor_count evidence-anchor patterns (expected ≥ 1)"
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

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
exit 0
