#!/bin/bash
# Suite 1: Pipeline Integrity Validation
# Usage: bash validate-pipeline-integrity.sh <project-root>
# Exits 0 if all checks pass, 1 if any fail

set -euo pipefail

PROJECT="${1:-.}"
PASSED=0
FAILED=0
TOTAL=0

check() {
  local desc="$1"
  local result="$2"
  TOTAL=$((TOTAL + 1))
  if [ "$result" = "true" ]; then
    echo "  PASS  $desc"
    PASSED=$((PASSED + 1))
  else
    echo "  FAIL  $desc"
    FAILED=$((FAILED + 1))
  fi
}

echo "=== Serious Vibe Coding Pipeline Integrity: $(basename "$PROJECT") ==="
echo ""

# --- Skill Pack Structure ---
echo "--- Skill Pack Structure ---"

IS_SKILL_PACK=0
if [ -f "$PROJECT/skills-manifest.json" ]; then
  IS_SKILL_PACK=1
  check "skills-manifest.json exists" "true"
else
  echo "  SKIP  skills-manifest.json (not a skill pack — OK for projects)"
fi

if [ "$IS_SKILL_PACK" -eq 1 ]; then
  echo ""
  echo "--- Framework Artifacts ---"
  check "FRAMEWORK-STATE.md exists" \
    "$([ -f "$PROJECT/FRAMEWORK-STATE.md" ] && echo true || echo false)"
  SKILL_COUNT=$(find "$PROJECT/skills" -mindepth 2 -maxdepth 2 -type f -name SKILL.md 2>/dev/null | wc -l)
  check "at least 1 packaged skill exists ($SKILL_COUNT found)" \
    "$([ "$SKILL_COUNT" -ge 1 ] && echo true || echo false)"
  check "Tier-1 harness exists" \
    "$([ -x "$PROJECT/test-framework/evals/run-all-evals.sh" ] && echo true || echo false)"
  MANIFEST_COUNT=$(find "$PROJECT/docs/plans" -name manifest.md 2>/dev/null | wc -l)
  check "at least 1 framework change-set manifest exists ($MANIFEST_COUNT found)" \
    "$([ "$MANIFEST_COUNT" -ge 1 ] && echo true || echo false)"

  echo ""
  echo "=== Results: $PASSED passed, $FAILED failed (of $TOTAL checks) ==="
  if [ "$FAILED" -eq 0 ]; then
    echo "All checks passed."
    exit 0
  fi
  echo "Some checks failed."
  exit 1
fi

# --- Foundational Artifacts ---
echo ""
echo "--- Foundational Artifacts ---"

check "vision.md exists" \
  "$([ -f "$PROJECT/docs/specs/vision.md" ] && echo true || echo false)"

PERSONA_COUNT=$(find "$PROJECT/docs/specs/personas" -maxdepth 1 -type f -name 'P*.md' 2>/dev/null | wc -l)
check "at least 1 persona exists ($PERSONA_COUNT found)" \
  "$([ "$PERSONA_COUNT" -ge 1 ] && echo true || echo false)"

# --- Feature Specs ---
echo ""
echo "--- Feature Specs ---"

SPEC_COUNT=$(find "$PROJECT/docs/specs/features" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l)
check "at least 1 feature spec exists ($SPEC_COUNT found)" \
  "$([ "$SPEC_COUNT" -ge 1 ] && echo true || echo false)"

# Check each feature spec
for spec in "$PROJECT/docs/specs/features/"*.md; do
  [ -f "$spec" ] || continue
  name=$(basename "$spec" .md)

  # Status field
  has_status=$(grep -c "^\*\*Status:\*\*" "$spec" 2>/dev/null || true)
  check "$name has Status field" \
    "$([ "$has_status" -ge 1 ] && echo true || echo false)"

  # Type field
  has_type=$(grep -c "^\*\*Type:\*\*" "$spec" 2>/dev/null || true)
  check "$name has Type field" \
    "$([ "$has_type" -ge 1 ] && echo true || echo false)"

  # AC table format (matches | AC | or | # | or |---|)
  has_ac=$(grep -cP "^\|.*\|.*\|.*\|.*\|" "$spec" 2>/dev/null || true)
  check "$name has AC table(s)" \
    "$([ "$has_ac" -ge 2 ] && echo true || echo false)"

  # RESOLVED annotations point to existing files
  resolved_files=$(grep -oP 'RESOLVED.*?\s(\S+\.\w+:\d+)' "$spec" 2>/dev/null | grep -oP '\S+\.\w+' || true)
  if [ -n "$resolved_files" ]; then
    all_exist=true
    while IFS= read -r ref_file; do
      if [ ! -f "$PROJECT/$ref_file" ] && [ ! -f "$ref_file" ]; then
        all_exist=false
        echo "    WARNING: RESOLVED ref $ref_file not found"
      fi
    done <<< "$resolved_files"
    check "$name RESOLVED annotations point to existing files" "$all_exist"
  fi
done

# --- Journeys ---
echo ""
echo "--- Journeys ---"

JOURNEY_COUNT=$(find "$PROJECT/docs/specs/journeys" -maxdepth 1 -type f -name 'J*.feature.md' 2>/dev/null | wc -l)
check "at least 1 journey exists ($JOURNEY_COUNT found)" \
  "$([ "$JOURNEY_COUNT" -ge 1 ] && echo true || echo false)"

# Check journey AC references exist in some feature spec
for journey in "$PROJECT/docs/specs/journeys/"J*.feature.md; do
  [ -f "$journey" ] || continue
  jname=$(basename "$journey" .feature.md)

  # Extract AC IDs referenced in journey (pattern: @AC-ID or AC-ID)
  ac_refs=$(grep -oP '[A-Z]+-\d+' "$journey" 2>/dev/null | sort -u || true)
  if [ -n "$ac_refs" ]; then
    # Check at least one AC ref exists in some feature spec
    found_any=false
    while IFS= read -r ac_id; do
      if grep -rq "$ac_id" "$PROJECT/docs/specs/features/" 2>/dev/null; then
        found_any=true
        break
      fi
    done <<< "$ac_refs"
    check "$jname AC references found in feature specs" "$found_any"
  fi
done

# --- UX/UI Designs ---
echo ""
echo "--- UX/UI Designs ---"

UX_COUNT=$(find "$PROJECT/docs/specs/ux" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l)
UI_COUNT=$(find "$PROJECT/docs/specs/ui" -maxdepth 1 -type f -name '*.md' 2>/dev/null | wc -l)

# Only check if features of Type: Feature exist (Enablers may skip UX/UI)
FEATURE_TYPE_COUNT=$(grep -rl "Type:.*Feature" "$PROJECT/docs/specs/features/" 2>/dev/null | wc -l || echo 0)
if [ "$FEATURE_TYPE_COUNT" -ge 1 ]; then
  check "UX designs exist for Feature-type specs ($UX_COUNT found)" \
    "$([ "$UX_COUNT" -ge 1 ] && echo true || echo false)"
  check "UI designs exist for Feature-type specs ($UI_COUNT found)" \
    "$([ "$UI_COUNT" -ge 1 ] && echo true || echo false)"
fi

# --- Design System ---
echo ""
echo "--- Design System ---"

if [ "$UI_COUNT" -ge 1 ]; then
  check "design-system.md exists (required by UI designs)" \
    "$([ -f "$PROJECT/docs/specs/design-system.md" ] && echo true || echo false)"
fi

# --- Manifest ---
echo ""
echo "--- Change Set ---"

MANIFEST_COUNT=$(find "$PROJECT/docs/plans" -name "manifest.md" 2>/dev/null | wc -l)
check "at least 1 change set manifest exists ($MANIFEST_COUNT found)" \
  "$([ "$MANIFEST_COUNT" -ge 1 ] && echo true || echo false)"

# --- Feature Type Coverage ---
echo ""
echo "--- Feature Type Coverage ---"

ENABLER_COUNT=$(grep -rl "Type:.*Enabler" "$PROJECT/docs/specs/features/" 2>/dev/null | wc -l || echo 0)
INTEGRATION_COUNT=$(grep -rl "Type:.*Integration" "$PROJECT/docs/specs/features/" 2>/dev/null | wc -l || echo 0)

check "Feature-type specs exist ($FEATURE_TYPE_COUNT found)" \
  "$([ "$FEATURE_TYPE_COUNT" -ge 1 ] && echo true || echo false)"

# Enablers and Integrations are optional but noted
echo "  INFO  Enabler-type specs: $ENABLER_COUNT"
echo "  INFO  Integration-type specs: $INTEGRATION_COUNT"

# --- Summary ---
echo ""
echo "=== Results: $PASSED passed, $FAILED failed (of $TOTAL checks) ==="

if [ "$FAILED" -eq 0 ]; then
  echo "All checks passed."
  exit 0
else
  echo "Some checks failed."
  exit 1
fi
