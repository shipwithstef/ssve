#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

pass=0
fail=0
ok() { echo "  PASS - $1"; pass=$((pass+1)); }
bad() { echo "  FAIL - $1"; fail=$((fail+1)); }

echo "=== Tier 1: visual evidence motion ==="

node --check scripts/live-evidence-capture.mjs >/dev/null && ok "live evidence helper syntax valid" || bad "live evidence helper syntax invalid"
node --check scripts/validate-motion-pattern-usage.mjs >/dev/null && ok "motion validator syntax valid" || bad "motion validator syntax invalid"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

node scripts/live-evidence-capture.mjs --init "$tmp/capture-live-evidence.mjs" >/dev/null
grep -q "report.json" "$tmp/capture-live-evidence.mjs" && ok "live evidence helper emits report.json shape" || bad "helper missing report.json"
if grep -q 'name: "mobile"' "$tmp/capture-live-evidence.mjs" && grep -q 'name: "tablet"' "$tmp/capture-live-evidence.mjs" && grep -q 'name: "desktop"' "$tmp/capture-live-evidence.mjs"; then
  ok "live evidence helper emits viewport matrix"
else
  bad "helper missing viewport matrix"
fi
grep -Fq 'THEMES = ["light", "dark"]' "$tmp/capture-live-evidence.mjs" && ok "live evidence helper emits theme matrix" || bad "helper missing theme matrix"

mkdir -p "$tmp/good" "$tmp/bad" "$tmp/none"
cat > "$tmp/good/component.md" <<'MD'
Motion via framer-motion. Applies references/motion-patterns.md with motion.duration.normal and motion.easing.enter.
Reduced motion: prefers-reduced-motion collapses movement to opacity-only.
MD
cat > "$tmp/bad/component.md" <<'MD'
Motion via framer-motion with stagger and spring transitions.
MD
cat > "$tmp/none/component.md" <<'MD'
Static visual copy with no animated behavior.
MD

node scripts/validate-motion-pattern-usage.mjs "$tmp/good" >/dev/null && ok "motion fixture with citation and reduced-motion passes" || bad "good motion fixture rejected"
if node scripts/validate-motion-pattern-usage.mjs "$tmp/bad" >/dev/null 2>&1; then bad "motion fixture without citation accepted"; else ok "motion fixture without citation fails"; fi
node scripts/validate-motion-pattern-usage.mjs "$tmp/none" >/dev/null && ok "no-motion fixture passes" || bad "no-motion fixture rejected"

grep -q "scripts/live-evidence-capture.mjs" _shared/live-evidence.md && ok "shared live evidence doc names helper" || bad "shared doc missing helper"
grep -q "validate-motion-pattern-usage.mjs" skills/landing-page/SKILL.md && ok "landing-page self-verify names motion validator" || bad "landing-page missing motion validator"

echo "visual evidence motion: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
