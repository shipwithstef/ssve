#!/usr/bin/env bash
# Tier 1: validate catalog-domain-capabilities -> write-journeys capability scaffolding.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SCRIPT="$REPO_ROOT/skills/write-journeys/scripts/capability-journeys.mjs"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

PASS=0
FAIL=0

pass() { echo "  PASS - $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL - $1"; FAIL=$((FAIL + 1)); }

echo "=== Tier 1: capability journey auto-chain ==="

mkdir -p "$TMP_DIR/src" "$TMP_DIR/docs/specs"

cat > "$TMP_DIR/src/Layout.jsx" <<'JSX'
export function Layout() {
  const labels = getNavTranslations();
  window.dispatchEvent(new Event('languageChange'));
  return <button aria-label={labels.language}>BG</button>;
}
JSX

cat > "$TMP_DIR/docs/specs/capability-catalog.data.json" <<'JSON'
{
  "meta": {
    "generated": "2026-05-11",
    "domain": "marketplace",
    "source_skills": ["catalog-domain-capabilities"],
    "total_capabilities": 1
  },
  "capabilities": [
    {
      "capability_id": "multi-language",
      "name": "Multi-language",
      "category": "chrome",
      "frequency": "universal",
      "maturity": "MVP-required",
      "visibility": "user-facing",
      "kano": "must-be",
      "convergence_velocity": "stable",
      "mechanic_count": 1,
      "bps": 20,
      "depth": 1,
      "coverage_quality": "V0",
      "mechanics": [{ "pattern": "i18n", "prevalence": "universal", "tier": "MVP" }],
      "journey_mappings": []
    }
  ],
  "build_priority_ranking": []
}
JSON

if node --check "$SCRIPT" >/dev/null; then
  pass "capability journey helper syntax valid"
else
  fail "capability journey helper syntax invalid"
fi

if node "$SCRIPT" --root "$TMP_DIR" --capability multi-language > "$TMP_DIR/out.json"; then
  pass "helper runs against capability catalog fixture"
else
  fail "helper failed against capability catalog fixture"
fi

TARGET="$TMP_DIR/docs/specs/journeys/J-CAP-multi-language.feature.md"
if [[ -f "$TARGET" ]]; then
  pass "helper emits J-CAP journey"
else
  fail "helper did not emit J-CAP journey"
fi

if grep -Fq "@capability:multi-language" "$TARGET" \
  && grep -Fq "customer mobile" "$TARGET" \
  && grep -Fq "customer desktop" "$TARGET" \
  && grep -Fq "owner mobile" "$TARGET" \
  && grep -Fq "owner desktop" "$TARGET"; then
  pass "journey covers role and surface combinations"
else
  fail "journey missing capability trace or role/surface coverage"
fi

before_count="$(find "$TMP_DIR/docs/specs/journeys" -name 'J-CAP-*.feature.md' | wc -l | tr -d ' ')"
node "$SCRIPT" --root "$TMP_DIR" --capability multi-language > "$TMP_DIR/out2.json"
after_count="$(find "$TMP_DIR/docs/specs/journeys" -name 'J-CAP-*.feature.md' | wc -l | tr -d ' ')"
if [[ "$before_count" == "$after_count" ]]; then
  pass "rerun is idempotent"
else
  fail "rerun duplicated capability journeys"
fi

rm -rf "$TMP_DIR/docs/specs/journeys"
cat > "$TMP_DIR/src/Layout.jsx" <<'JSX'
export function Layout() {
  return <button aria-label="Language">BG</button>;
}
JSX
node "$SCRIPT" --root "$TMP_DIR" --capability multi-language > "$TMP_DIR/out3.json"
if [[ ! -e "$TARGET" ]] && grep -Fq "implementation_pattern_not_detected" "$TMP_DIR/out3.json"; then
  pass "stack matcher skips unimplemented capability"
else
  fail "stack matcher generated a false positive"
fi

if grep -Fq "capability-journeys.mjs" "$REPO_ROOT/skills/catalog-domain-capabilities/SKILL.md" \
  && grep -Fq -- "--capability" "$REPO_ROOT/skills/write-journeys/SKILL.md"; then
  pass "skill contracts document the auto-chain"
else
  fail "skill contracts do not document the auto-chain"
fi

echo ""
echo "capability journey auto-chain: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
