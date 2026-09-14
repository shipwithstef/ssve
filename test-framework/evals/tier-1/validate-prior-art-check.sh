#!/usr/bin/env bash
# test-framework/evals/tier-1/validate-prior-art-check.sh
#
# Tier-1 validator for the prior-art-scan check in
# scripts/lint-proposal-authorship.mjs (added after the PR #131 incident
# where I shipped a proposal duplicating review-plan and review-cross-model
# without surveying prior art first).
#
# The lint itself stays warn-only by design — proposals don't get blocked,
# but the WARN surfaces the duplicate-skill failure mode at author time
# so the reviewer (and the author's own re-read) catches it before the
# proposal ships.
#
# Three positive cases must PASS the lint's prior_art_scan check; three
# negative cases must WARN.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0

check() {
  local label="$1"
  shift
  if "$@" >"$TMP/out" 2>&1; then
    echo "  ✓ $label"
    pass=$((pass + 1))
  else
    echo "  ✗ $label"
    cat "$TMP/out"
    fail=$((fail + 1))
  fi
}

echo "=== Tier 1: Prior-Art Check (lint-proposal-authorship.mjs) ==="

check "lint script exists" test -f "$ROOT/scripts/lint-proposal-authorship.mjs"
check "lint script syntax valid" node --check "$ROOT/scripts/lint-proposal-authorship.mjs"

# Helper: write a fixture proposal with given body, run the lint, return
# the prior_art_scan row's status.
prior_art_status() {
  local fixture="$1"
  node "$ROOT/scripts/lint-proposal-authorship.mjs" "$fixture" 2>&1 | \
    awk -F'|' '/prior_art_scan/ { for (i=1;i<=NF;i++) if ($i ~ /(PASS|WARN|FAIL)/) { gsub(/[ \t]/, "", $i); print $i; exit } }'
}

# Negative case 1: proposes a new skill in the review/gate/chain space
# with NO existing-skill citation in framing prose.
NEG1="$TMP/neg1.md"
{
  printf -- "---\nname: neg1\n---\n\n# Proposal: add a brand new adversarial review chain\n\nWe need a new gate that introduces a never-seen-before review loop.\n"
  for i in $(seq 1 50); do echo "Padding line $i to clear the 40-line stub threshold."; done
} > "$NEG1"
check "negative 1: review-space proposal with no review-family citations → WARN" bash -c '
  status=$(node "$0/scripts/lint-proposal-authorship.mjs" "$1" 2>&1 | awk -F"|" "/prior_art_scan/ { for (i=1;i<=NF;i++) if (\$i ~ /(PASS|WARN|FAIL)/) { gsub(/[ \t]/, \"\", \$i); print \$i; exit } }")
  [ "$status" = "WARN" ]
' "$ROOT" "$NEG1"

# Negative case 2: review-space proposal cites only ONE review-family skill
# (PR #131 original failure mode) — should still WARN.
NEG2="$TMP/neg2.md"
{
  printf -- "---\nname: neg2\n---\n\n# Proposal: introduce a new chain for cross-model review\n\nThis builds on the doctrine in rules/research-must-use-agy-cli.md that subordinate harnesses should run themselves. Related: skills/review-cross-model/SKILL.md.\n\nThe chain has primary + fallback + tie-break with model-family rotation.\n"
  for i in $(seq 1 50); do echo "Padding line $i to clear stub threshold."; done
} > "$NEG2"
check "negative 2: review-space proposal cites only 1 review-family skill → WARN" bash -c '
  status=$(node "$0/scripts/lint-proposal-authorship.mjs" "$1" 2>&1 | awk -F"|" "/prior_art_scan/ { for (i=1;i<=NF;i++) if (\$i ~ /(PASS|WARN|FAIL)/) { gsub(/[ \t]/, \"\", \$i); print \$i; exit } }")
  [ "$status" = "WARN" ]
' "$ROOT" "$NEG2"

# Negative case 3: proposes a new skill OUTSIDE the review space, no
# existing-skill citation. Should WARN with the generic message.
NEG3="$TMP/neg3.md"
{
  printf -- "---\nname: neg3\n---\n\n# Proposal: add a new spec-rendering wrapper\n\nWe propose a brand new wrapper script that introduces a never-seen-before rendering pipeline.\n"
  for i in $(seq 1 50); do echo "Padding line $i to clear stub threshold."; done
} > "$NEG3"
check "negative 3: non-review-space proposal with no citations → WARN" bash -c '
  status=$(node "$0/scripts/lint-proposal-authorship.mjs" "$1" 2>&1 | awk -F"|" "/prior_art_scan/ { for (i=1;i<=NF;i++) if (\$i ~ /(PASS|WARN|FAIL)/) { gsub(/[ \t]/, \"\", \$i); print \$i; exit } }")
  [ "$status" = "WARN" ]
' "$ROOT" "$NEG3"

# Positive case 1: proposal that does NOT introduce a new top-level concept
# (e.g. a docs-only update, a tightening, a learnings addition).
POS1="$TMP/pos1.md"
{
  printf -- "---\nname: pos1\n---\n\n# Proposal: tighten the existing forbidden-token policy\n\nThis tightens the existing token list. The word 'extend' is intentional — no architectural surface is being added.\n"
  for i in $(seq 1 50); do echo "Padding line $i to clear stub threshold."; done
} > "$POS1"
check "positive 1: proposal does not introduce a new concept → PASS (n/a)" bash -c '
  status=$(node "$0/scripts/lint-proposal-authorship.mjs" "$1" 2>&1 | awk -F"|" "/prior_art_scan/ { for (i=1;i<=NF;i++) if (\$i ~ /(PASS|WARN|FAIL)/) { gsub(/[ \t]/, \"\", \$i); print \$i; exit } }")
  [ "$status" = "PASS" ]
' "$ROOT" "$POS1"

# Positive case 2: review-space proposal with ≥2 review-family citations
# AND an explicit overlap-map section.
POS2="$TMP/pos2.md"
{
  printf -- "---\nname: pos2\n---\n\n# Proposal: extend review-cross-model with provenance enforcement\n\n## Relationship to existing skills\n\nThis proposal does NOT introduce a new gate. It extends skills/review-cross-model/SKILL.md and skills/review-plan/SKILL.md and tightens review-gate G5. The overlap map:\n\n- review-plan: 3-tier chain unchanged\n- review-cross-model: handles_concerns broadened\n- review-gate: G5 hooks the new wrapper\n- review-security: unchanged\n\nThis differs from each by adding provenance enforcement none of them currently have.\n\n## Acceptance Criteria\n\n- [ ] something\n"
  for i in $(seq 1 30); do echo "Padding line $i to clear stub threshold."; done
} > "$POS2"
check "positive 2: review-space proposal with ≥2 citations + overlap map → PASS" bash -c '
  status=$(node "$0/scripts/lint-proposal-authorship.mjs" "$1" 2>&1 | awk -F"|" "/prior_art_scan/ { for (i=1;i<=NF;i++) if (\$i ~ /(PASS|WARN|FAIL)/) { gsub(/[ \t]/, \"\", \$i); print \$i; exit } }")
  [ "$status" = "PASS" ]
' "$ROOT" "$POS2"

echo ""
echo "prior-art check: $pass passed, $fail failed"
[[ "$fail" -eq 0 ]]
