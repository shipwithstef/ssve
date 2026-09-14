#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
VALIDATOR="$ROOT/test-framework/scripts/validate-pipeline-integrity.sh"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

passed=0
failed=0
ok() { printf 'PASS: %s\n' "$1"; passed=$((passed + 1)); }
no() { printf 'FAIL: %s\n' "$1"; failed=$((failed + 1)); }

FRAMEWORK="$TMP_ROOT/framework"
mkdir -p "$FRAMEWORK/skills/route-workflow" "$FRAMEWORK/test-framework/evals" "$FRAMEWORK/docs/plans/example"
printf '{}\n' > "$FRAMEWORK/skills-manifest.json"
printf '# Framework state\n' > "$FRAMEWORK/FRAMEWORK-STATE.md"
printf '%s\n' '---' 'name: route-workflow' '---' > "$FRAMEWORK/skills/route-workflow/SKILL.md"
printf '#!/usr/bin/env bash\n' > "$FRAMEWORK/test-framework/evals/run-all-evals.sh"
chmod +x "$FRAMEWORK/test-framework/evals/run-all-evals.sh"
printf '# Plan\n' > "$FRAMEWORK/docs/plans/example/manifest.md"

if bash "$VALIDATOR" "$FRAMEWORK" | grep -q 'All checks passed'; then
  ok "framework mode validates framework artifacts without product vision/persona requirements"
else
  no "framework mode did not pass a valid skill pack"
fi

rm "$FRAMEWORK/FRAMEWORK-STATE.md"
if bash "$VALIDATOR" "$FRAMEWORK" >/dev/null 2>&1; then
  no "framework mode accepted a missing FRAMEWORK-STATE.md"
else
  ok "framework mode fails closed when framework state is missing"
fi

PRODUCT="$TMP_ROOT/product"
mkdir -p "$PRODUCT/docs/specs/personas" "$PRODUCT/docs/specs/features" \
  "$PRODUCT/docs/specs/journeys" "$PRODUCT/docs/specs/ux" "$PRODUCT/docs/specs/ui" \
  "$PRODUCT/docs/plans/example"
printf '# Vision\n' > "$PRODUCT/docs/specs/vision.md"
printf '# Persona\n' > "$PRODUCT/docs/specs/personas/P-01.md"
printf '%s\n' '**Status:** DRAFT' '**Type:** Feature' '| AC | Behavior | QA | E2E |' '|---|---|---|---|' '| AC-1 | works | pass | pass |' > "$PRODUCT/docs/specs/features/example.md"
printf '@AC-1\n' > "$PRODUCT/docs/specs/journeys/J01.feature.md"
printf '# UX\n' > "$PRODUCT/docs/specs/ux/example.md"
printf '# UI\n' > "$PRODUCT/docs/specs/ui/example.md"
printf '# Design system\n' > "$PRODUCT/docs/specs/design-system.md"
printf '# Plan\n' > "$PRODUCT/docs/plans/example/manifest.md"

if bash "$VALIDATOR" "$PRODUCT" | grep -q 'All checks passed'; then
  ok "consumer mode preserves product artifact validation"
else
  no "consumer mode regressed"
fi

printf '=== Results: %d passed, %d failed ===\n' "$passed" "$failed"
[ "$failed" -eq 0 ]
