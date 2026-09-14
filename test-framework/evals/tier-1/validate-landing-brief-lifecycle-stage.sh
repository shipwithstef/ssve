#!/usr/bin/env bash
# Tier 1: Validate that landing-page briefs declare lifecycle stage and respect
# lifecycle-appropriateness gating (Proposal 2026-05-06).
#
# Checks every docs/specs/landing/*-brief.md:
#   - project_lifecycle block must be present with stage, evidence, paying_customers,
#     production_data_available, primary_traffic_source
#   - Every recommendation must have lifecycle_compatibility field
#   - No blocked_at_pre_launch recommendation without override justification when
#     stage is pre-launch
#
# No LLM, <10s. Exit 0 if all pass or no briefs exist, 1 if any fail.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
BRIEF_DIR="$REPO_ROOT/docs/specs/landing"

PASS=0
FAIL=0
ERRORS=""

if [[ ! -d "$BRIEF_DIR" ]]; then
  echo "=== Tier 1: landing-brief lifecycle-stage validation ==="
  echo "  SKIP — docs/specs/landing/ not present (no landing briefs to validate)"
  exit 0
fi

echo "=== Tier 1: landing-brief lifecycle-stage validation ==="

while IFS= read -r brief; do
  [[ -z "$brief" ]] && continue
  basename_brief=$(basename "$brief")
  BRIEF_FAIL=0

  # --- Check 1: project_lifecycle block exists with required fields ---
  if ! grep -qE '^project_lifecycle:' "$brief"; then
    ERRORS+="  FAIL: $basename_brief — missing project_lifecycle block\n"
    BRIEF_FAIL=$((BRIEF_FAIL + 1))
  else
    # Extract the YAML block (simple heuristic: from project_lifecycle: to next blank line or markdown heading)
    BLOCK=$(awk '/^project_lifecycle:/{found=1} found{print; if (/^$/ || /^#{1,3} /){if (NR > found_line) exit}} {found_line=NR}' "$brief" 2>/dev/null || true)

    for field in stage evidence paying_customers production_data_available primary_traffic_source; do
      if ! grep -qE "^  ${field}:" "$brief"; then
        ERRORS+="  FAIL: $basename_brief — project_lifecycle missing field: $field\n"
        BRIEF_FAIL=$((BRIEF_FAIL + 1))
      else
        PASS=$((PASS + 1))
      fi
    done
  fi

  # --- Check 2: lifecycle_compatibility on every recommendation ---
  # Count recommendations (lines starting with "  - name:" under a recommendations block)
  REC_COUNT=$(grep -cE '^  - name:' "$brief" 2>/dev/null || echo 0)
  COMPAT_COUNT=$(grep -cE 'lifecycle_compatibility:' "$brief" 2>/dev/null || echo 0)
  if [[ "$REC_COUNT" -gt 0 && "$COMPAT_COUNT" -lt "$REC_COUNT" ]]; then
    ERRORS+="  FAIL: $basename_brief — $REC_COUNT recommendations but only $COMPAT_COUNT have lifecycle_compatibility ($((REC_COUNT - COMPAT_COUNT)) missing)\n"
    BRIEF_FAIL=$((BRIEF_FAIL + 1))
  elif [[ "$REC_COUNT" -gt 0 ]]; then
    PASS=$((PASS + 1))
  fi

  # --- Check 3: blocked_at_pre_launch without override at pre-launch stage ---
  STAGE=$(grep -E '^  stage:' "$brief" 2>/dev/null | head -1 | sed 's/^  stage: *//' | tr -d '"' || true)
  if [[ "$STAGE" == "pre-launch" ]]; then
    # Find recommendations with blocked_at_pre_launch: true
    # Heuristic: grep for the flag, then verify it's in a recommendations block
    BLOCKED_LINES=$(grep -nE 'blocked_at_pre_launch: true' "$brief" 2>/dev/null || true)
    if [[ -n "$BLOCKED_LINES" ]]; then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        LINENO=$(echo "$line" | cut -d: -f1)
        # Look for override justification within 5 lines before or after
        CONTEXT=$(sed -n "$((LINENO - 5)),$((LINENO + 5))p" "$brief" 2>/dev/null || true)
        if ! echo "$CONTEXT" | grep -qiE 'override|justification|override_justification'; then
          ERRORS+="  FAIL: $basename_brief — blocked_at_pre_launch recommendation at line $LINENO lacks override justification (stage=pre-launch)\n"
          BRIEF_FAIL=$((BRIEF_FAIL + 1))
        else
          PASS=$((PASS + 1))
        fi
      done <<< "$BLOCKED_LINES"
    fi
  fi

  if [[ $BRIEF_FAIL -gt 0 ]]; then
    FAIL=$((FAIL + BRIEF_FAIL))
  else
    PASS=$((PASS + 1))
  fi
done < <(find "$BRIEF_DIR" -maxdepth 1 -type f -name '*-brief.md' 2>/dev/null)

# Edge case: no briefs at all — that's fine, just report
BRIEF_COUNT=$(find "$BRIEF_DIR" -maxdepth 1 -type f -name '*-brief.md' 2>/dev/null | wc -l)
if [[ "$BRIEF_COUNT" -eq 0 ]]; then
  echo "  SKIP — no *-brief.md files found in $BRIEF_DIR"
  exit 0
fi

echo "  $PASS passed, $FAIL failed"
if [[ $FAIL -gt 0 ]]; then
  echo ""
  printf "$ERRORS"
  exit 1
else
  echo "  PASS — all $BRIEF_COUNT landing brief(s) have valid lifecycle-stage gating"
  exit 0
fi
