#!/usr/bin/env bash
# Tier 1: Validate discussion-phase helper behavior and, when present,
# downstream contract wiring.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
HELPER="$REPO_ROOT/scripts/discussion-artifact.mjs"
ROUTER="$REPO_ROOT/skills/route-workflow/SKILL.md"
REVIEW_GATE="$REPO_ROOT/skills/review-gate/SKILL.md"
WRITE_SPEC="$REPO_ROOT/skills/write-spec/SKILL.md"
DESIGN_UX="$REPO_ROOT/skills/design-ux/SKILL.md"
DESIGN_TECH="$REPO_ROOT/skills/design-tech/SKILL.md"

PASS=0
FAIL=0
ERRORS=""

ok() {
  PASS=$((PASS + 1))
}

bad() {
  local message="$1"
  ERRORS+="  FAIL: $message\n"
  FAIL=$((FAIL + 1))
}

require_contains() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    ok
  else
    bad "$label missing in $(basename "$file")"
  fi
}

if [[ -f "$HELPER" ]]; then
  ok
else
  bad "helper missing: scripts/discussion-artifact.mjs"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

VALID_ARTIFACT="$TMP_DIR/valid.md"
INVALID_ARTIFACT="$TMP_DIR/invalid.md"

cat > "$VALID_ARTIFACT" <<'EOF'
---
topic: discussion-phase
target: docs/specs/features/feature-discussion-phase.md
repo_mode: framework
authoring_mode: framework-gap
status: proceed
ambiguity_before: 6
ambiguity_after: 2
open_count: 1
blocking_count: 0
recommended_next_skill: write-spec
source_refs: ["FRAMEWORK-STATE.md", "skills/route-workflow/SKILL.md"]
updated: 2026-04-10
---

## Summary

Proceed with one deferred follow-up.

## Gray Area Register

| id | category | reversibility | magnitude | signal_score | status | downstream_phase | decision_summary |
|----|----------|---------------|-----------|--------------|--------|------------------|------------------|
| GA-01 | scope | one-way-door | high | 3 | decided | write-spec | Keep a standalone skill |
| GA-02 | sequencing-ownership | two-way-door | low | 1 | deferred | design-tech | Revisit resume semantics |

## Evidence Notes

- `FRAMEWORK-STATE.md`

## Decisions

- Use `docs/specs/discussions/<topic>.md`

## Deferred

- Resume semantics follow-up

## Blockers

- None

## Next Step

Proceed to `write-spec`.
EOF

cat > "$INVALID_ARTIFACT" <<'EOF'
---
topic: bad-artifact
target: docs/specs/features/bad.md
repo_mode: framework
authoring_mode: framework-gap
status: nope
ambiguity_before: 6
ambiguity_after: 2
open_count: 1
blocking_count: 0
recommended_next_skill: write-spec
source_refs: ["FRAMEWORK-STATE.md"]
updated: 2026-04-10
---

## Gray Area Register

| id | category | reversibility | magnitude | signal_score | status | downstream_phase | decision_summary |
|----|----------|---------------|-----------|--------------|--------|------------------|------------------|
| GA-01 | wildcard | one-way-door | high | 3 | guessed | write-spec | Invalid row |
EOF

if node "$HELPER" validate --path "$VALID_ARTIFACT" >/dev/null 2>&1; then
  ok
else
  bad "helper should validate a well-formed discussion artifact"
fi

if node "$HELPER" summary --path "$VALID_ARTIFACT" | grep -Fq '"status": "proceed"'; then
  ok
else
  bad "helper summary should emit JSON with status"
fi

if node "$HELPER" summary --path "$VALID_ARTIFACT" | grep -Fq '"decided_count": 1'; then
  ok
else
  bad "helper summary should count decided rows"
fi

if node "$HELPER" validate --path "$INVALID_ARTIFACT" >/dev/null 2>&1; then
  bad "helper should reject an invalid discussion artifact"
else
  ok
fi

if grep -Fq "discuss-phase" "$ROUTER"; then
  require_contains "$ROUTER" "Reroute precedence must run before ambiguity scoring" "route-workflow reroute precedence"
  require_contains "$ROUTER" "discuss-phase" "route-workflow discuss-phase route"
fi

if grep -Fq "discussion artifact" "$WRITE_SPEC"; then
  require_contains "$WRITE_SPEC" "discussion artifact" "write-spec discussion pre-flight"
fi

if grep -Fq "discussion artifact" "$DESIGN_UX"; then
  require_contains "$DESIGN_UX" "discussion artifact" "design-ux discussion pre-flight"
fi

if grep -Fq "discussion artifact" "$DESIGN_TECH"; then
  require_contains "$DESIGN_TECH" "discussion artifact" "design-tech discussion pre-flight"
fi

if grep -Fq "discussion decision" "$REVIEW_GATE"; then
  require_contains "$REVIEW_GATE" "discussion decision" "review-gate discussion enforcement"
fi

echo "=== Tier 1: Discussion Phase Contract Validation ==="
echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — discussion-phase helper and contracts valid"
  exit 0
fi
