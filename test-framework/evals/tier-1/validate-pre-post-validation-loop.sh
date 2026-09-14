#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
PASS=0
FAIL=0

ok() {
  echo "  PASS - $1"
  PASS=$((PASS + 1))
}

bad() {
  echo "  FAIL - $1"
  FAIL=$((FAIL + 1))
}

require_grep() {
  local label="$1"
  local pattern="$2"
  local file="$3"
  if grep -qE "$pattern" "$file"; then
    ok "$label"
  else
    bad "$label"
  fi
}

echo "=== Tier 1: Pre/Post Validation Loop ==="

REFERENCE="$REPO_ROOT/references/pre-post-validation-loop.md"

if [[ -f "$REFERENCE" ]]; then
  ok "shared pre/post validation reference exists"
else
  bad "shared pre/post validation reference exists"
fi

require_grep \
  "reference requires exact command capture" \
  "exact command" \
  "$REFERENCE"

require_grep \
  "reference requires pre and post comparison" \
  "Compare pre and post results" \
  "$REFERENCE"

require_grep \
  "reference blocks branch-introduced closeout" \
  "branch-introduced" \
  "$REFERENCE"

require_grep \
  "reference defines no-baseline escape" \
  "no_pre_baseline_reason" \
  "$REFERENCE"

require_grep \
  "reference names machine evidence validator" \
  "validate-pre-post-validation-evidence.mjs" \
  "$REFERENCE"

require_grep \
  "route-workflow detail dispatches pre/post obligation" \
  "references/pre-post-validation-loop.md" \
  "$REPO_ROOT/skills/route-workflow/references/hot-path-operational-details.md"

require_grep \
  "route-workflow detail requires evidence validator when present" \
  "validate-pre-post-validation-evidence.mjs" \
  "$REPO_ROOT/skills/route-workflow/references/hot-path-operational-details.md"

require_grep \
  "execute-changeset records pre/post loop" \
  "Pre/Post Validation Baseline" \
  "$REPO_ROOT/skills/execute-changeset/SKILL.md"

require_grep \
  "test-journeys records pre/post policy" \
  "Pre/post policy" \
  "$REPO_ROOT/skills/test-journeys/SKILL.md"

require_grep \
  "write-e2e records pre/post test comparison" \
  "[Pp]re/post test comparison" \
  "$REPO_ROOT/skills/write-e2e/SKILL.md"

require_grep \
  "verify-promotion records pre/post delta" \
  "Pre/post validation delta classified" \
  "$REPO_ROOT/skills/verify-promotion/SKILL.md"

require_grep \
  "audit-implementation audits pre/post evidence" \
  "[Pp]re/post validation evidence audited" \
  "$REPO_ROOT/skills/audit-implementation/SKILL.md"

VALIDATOR="$REPO_ROOT/scripts/validate-pre-post-validation-evidence.mjs"
FIXTURE_DIR="$REPO_ROOT/test-framework/evals/tier-1/fixtures/pre-post-validation-loop"

if node --check "$VALIDATOR" >/dev/null; then
  ok "machine-readable evidence validator parses"
else
  bad "machine-readable evidence validator parses"
fi

if node "$VALIDATOR" --evidence "$FIXTURE_DIR/good.json" >/dev/null; then
  ok "valid pre/post evidence passes"
else
  bad "valid pre/post evidence passes"
fi

if node "$VALIDATOR" --evidence "$FIXTURE_DIR/no-baseline-good.json" >/dev/null; then
  ok "no-baseline evidence with replacement passes"
else
  bad "no-baseline evidence with replacement passes"
fi

for bad_fixture in \
  command-mismatch-bad.json \
  branch-introduced-bad.json \
  unclassified-bad.json \
  multi-batch-bad.json
do
  if node "$VALIDATOR" --evidence "$FIXTURE_DIR/$bad_fixture" >/dev/null 2>&1; then
    bad "bad fixture rejected: $bad_fixture"
  else
    ok "bad fixture rejected: $bad_fixture"
  fi
done

require_grep \
  "framework learning captures pre/post validation loop" \
  '"key":"pre-post-validation-loop"' \
  "$REPO_ROOT/references/framework-learnings.jsonl"

echo
echo "pre/post validation loop: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]]
