#!/usr/bin/env bash
# Validate that the todo-api example has a structurally complete svc pipeline.
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label"
    FAIL=$((FAIL + 1))
  fi
}

file_exists() {
  [ -f "$DIR/$1" ] && echo "true" || echo "false"
}

file_contains() {
  grep -q "$2" "$DIR/$1" 2>/dev/null && echo "true" || echo "false"
}

echo "=== Serious Vibe Coding Pipeline Validation: todo-api ==="
echo ""

echo "--- Required Files ---"
check "vision.md exists" "$(file_exists docs/specs/vision.md)"
check "persona P1.md exists" "$(file_exists docs/specs/personas/P1.md)"
check "feature-todo-management.md exists" "$(file_exists docs/specs/features/feature-todo-management.md)"
check "enabler-overdue-checker.md exists" "$(file_exists docs/specs/features/enabler-overdue-checker.md)"
check "J01-todo-lifecycle.feature.md exists" "$(file_exists docs/specs/journeys/J01-todo-lifecycle.feature.md)"
check "UX design exists" "$(file_exists docs/specs/ux/feature-todo-management.md)"
check "UI design exists" "$(file_exists docs/specs/ui/feature-todo-management.md)"
check "design-system.md exists" "$(file_exists docs/specs/design-system.md)"
check "manifest.md exists" "$(file_exists docs/plans/manifest.md)"

echo ""
echo "--- Feature Spec Checks ---"
check "feature spec has Type: Feature" "$(file_contains docs/specs/features/feature-todo-management.md 'Type:.* Feature')"
check "feature spec has Status: VERIFIED" "$(file_contains docs/specs/features/feature-todo-management.md 'Status:.* VERIFIED')"
check "feature spec has QA column with checkmark" "$(file_contains docs/specs/features/feature-todo-management.md '✅.*✅')"
check "feature spec has journey reference" "$(file_contains docs/specs/features/feature-todo-management.md 'J01.*todo-lifecycle')"

echo ""
echo "--- Enabler Spec Checks ---"
check "enabler spec has Type: Enabler" "$(file_contains docs/specs/features/enabler-overdue-checker.md 'Type:.* Enabler')"
check "enabler spec has Status: VERIFIED" "$(file_contains docs/specs/features/enabler-overdue-checker.md 'Status:.* VERIFIED')"
check "enabler spec has QA column with checkmark" "$(file_contains docs/specs/features/enabler-overdue-checker.md '✅.*✅')"

echo ""
echo "--- Cross-Reference Checks ---"
check "journey references feature spec (POST)" "$(file_contains docs/specs/journeys/J01-todo-lifecycle.feature.md 'POST /todos')"
check "journey references enabler (overdue-checker)" "$(file_contains docs/specs/journeys/J01-todo-lifecycle.feature.md 'overdue-checker')"
check "UX design references feature" "$(file_contains docs/specs/ux/feature-todo-management.md 'feature-todo-management')"
check "UI design references design system" "$(file_contains docs/specs/ui/feature-todo-management.md 'design-system')"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  echo "All checks passed."
  exit 0
fi
