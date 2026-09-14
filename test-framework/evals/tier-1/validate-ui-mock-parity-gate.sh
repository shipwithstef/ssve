#!/usr/bin/env bash
# Tier-1 validator: existing-component UI changes require production-derived mock parity.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

pass=0
fail=0

ok() {
  echo "  PASS - $1"
  pass=$((pass + 1))
}

bad() {
  echo "  FAIL - $1"
  fail=$((fail + 1))
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"

  if [[ ! -f "$file" ]]; then
    bad "$label ($file missing)"
    return
  fi

  if grep -Eq "$pattern" "$file"; then
    ok "$label"
  else
    bad "$label"
  fi
}

echo "=== Tier 1: UI mock parity gate ==="

assert_contains \
  "skills/design-ui/SKILL.md" \
  "Production-Derived Mock Parity Gate" \
  "design-ui defines the production-derived mock parity gate"

assert_contains \
  "skills/design-ui/SKILL.md" \
  "affected existing component/screen|Production source paths|current-state evidence|intended final-state" \
  "design-ui ledger requires component, source, current, and final evidence"

assert_contains \
  "skills/design-ui/SKILL.md" \
  "Do not generate standalone greenfield mocks|generic.*mocks.*not.*valid|affected existing component" \
  "design-ui forbids generic mocks for existing-component changes"

assert_contains \
  "skills/design-ui/SKILL.md" \
  "pre-change current state.*intended final state|current state.*intended final state" \
  "design-ui requires current and final states in comparable context"

assert_contains \
  "skills/track-visuals/SKILL.md" \
  "Read the Production-Derived Mock Parity Ledger" \
  "track-visuals reads the mock parity ledger"

assert_contains \
  "skills/track-visuals/SKILL.md" \
  "component.*blast radius.*Production-Derived Mock Parity Ledger|ledger.*affected usages/routes.*required states" \
  "track-visuals derives component blast radius from the ledger"

assert_contains \
  "skills/plan-changeset/SKILL.md" \
  "Browser-visible MODIFY mock parity gate" \
  "plan-changeset blocks browser-visible MODIFY work without the gate"

assert_contains \
  "skills/plan-changeset/SKILL.md" \
  'route[[:space:]]+back[[:space:]]+to[[:space:]]+`design-ui`|generic.*mocks.*cannot pass' \
  "plan-changeset routes missing parity evidence back to design-ui"

assert_contains \
  "skills/review-gate/SKILL.md" \
  "Existing-component mock parity proven.*G3 FAIL|Production-Derived Mock Parity Ledger.*G3 FAIL" \
  "review-gate G3 fails missing mock parity ledger"

assert_contains \
  "skills/review-gate/SKILL.md" \
  "Existing UI mock parity carried through execution.*G5 FAIL|final-only screenshot evidence.*G5 FAIL" \
  "review-gate G5 fails missing carried-through parity evidence"

assert_contains \
  "skills/test-journeys/SKILL.md" \
  "Production-Derived Mock Parity Ledger" \
  "test-journeys ties existing-component visual AC evidence to the ledger"

assert_contains \
  "skills/test-journeys/SKILL.md" \
  "final-only screenshot.*not verified|current-state comparison.*intended final-state" \
  "test-journeys rejects final-only screenshots for existing-component changes"

echo
echo "UI mock parity gate: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
