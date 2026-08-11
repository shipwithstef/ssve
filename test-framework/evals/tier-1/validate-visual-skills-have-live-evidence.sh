#!/usr/bin/env bash
# Tier-1 validator: every svc-native visual-output skill MUST reference Phase Z (live in-app verification)
# Origin: Example Marketplace 2026-04-30 — logo-swap shipped to prod with raw JSX text in top-left because all
# checks were isolated. Live screenshot capture is the only reliable terminal gate.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

# svc-native visual-output skills (must include Phase Z)
NATIVE_VISUAL_SKILLS=("design-logo" "landing-page" "design-ui")

# Skills explicitly exempt (no visible artifact)
EXEMPT=("write-vision" "analyze-domain" "research" "list-work-items")

FAILED=0

for skill in "${NATIVE_VISUAL_SKILLS[@]}"; do
  skill_md="skills/$skill/SKILL.md"
  if [[ ! -f "$skill_md" ]]; then
    echo "WARN: $skill_md not found, skipping"
    continue
  fi
  if ! grep -qE "Phase Z|live-evidence\.md|in-app-verification" "$skill_md"; then
    echo "FAIL: $skill_md missing Phase Z / live-evidence reference"
    FAILED=$((FAILED + 1))
  else
    echo "PASS: $skill_md has live-evidence terminal gate"
  fi

  if ! awk '/^outputs:/{in_outputs=1} in_outputs && /^chain:/{exit} in_outputs{print}' "$skill_md" \
    | grep -qE 'artifact:[[:space:]]*live-page-screenshots'; then
    echo "FAIL: $skill_md missing outputs.produces artifact: live-page-screenshots"
    FAILED=$((FAILED + 1))
  elif ! awk '/^outputs:/{in_outputs=1} in_outputs && /^chain:/{exit} in_outputs{print}' "$skill_md" \
    | grep -qE 'path:[[:space:]]*"[^"]*in-app-verification/'; then
    echo "FAIL: $skill_md live-page-screenshots output does not declare an in-app-verification/ path"
    FAILED=$((FAILED + 1))
  else
    echo "PASS: $skill_md declares live-page-screenshots output path"
  fi
done

# Verify route-workflow declares an orchestrator/task-graph obligation, not a fake host hook.
LIVE_SECTION="$(awk '
  /^## / {
    if (in_section) exit
    in_section = ($0 ~ /visual-evidence obligation for visual-output skills/)
  }
  in_section { print }
' skills/route-workflow/SKILL.md)"

if [[ -z "$LIVE_SECTION" ]]; then
  echo "FAIL: skills/route-workflow/SKILL.md missing visual-evidence obligation for visual-output skills"
  FAILED=$((FAILED + 1))
else
  echo "PASS: route-workflow has visual-evidence task-graph obligation"
fi

if grep -qE "Post-skill hook.*Live evidence|this hook|host-installed hook enforcement" <<<"$LIVE_SECTION"; then
  echo "FAIL: skills/route-workflow/SKILL.md live-evidence section claims hook enforcement without a wired host hook"
  FAILED=$((FAILED + 1))
else
  echo "PASS: route-workflow live-evidence wording does not claim fake hook enforcement"
fi

if ! grep -q "not a host-installed hook" <<<"$LIVE_SECTION"; then
  echo "FAIL: skills/route-workflow/SKILL.md must explicitly say live-evidence is not a host-installed hook"
  FAILED=$((FAILED + 1))
else
  echo "PASS: route-workflow explicitly distinguishes task-graph obligation from host hook"
fi

if ! grep -q "artifact: live-page-screenshots" skills/route-workflow/SKILL.md; then
  echo "FAIL: skills/route-workflow/SKILL.md does not resolve visual evidence from declared live-page-screenshots outputs"
  FAILED=$((FAILED + 1))
else
  echo "PASS: route-workflow resolves visual evidence from declared output paths"
fi

# Verify shared doc exists
if [[ ! -f "_shared/live-evidence.md" ]]; then
  echo "FAIL: _shared/live-evidence.md not found — canonical pattern doc missing"
  FAILED=$((FAILED + 1))
else
  echo "PASS: _shared/live-evidence.md exists"
fi

# Verify create-skill template mentions the requirement
if ! grep -qE "Phase Z|live-evidence\.md|visual-output skill" skills/create-skill/SKILL.md; then
  echo "FAIL: skills/create-skill/SKILL.md missing visual-output checklist"
  FAILED=$((FAILED + 1))
else
  echo "PASS: create-skill template enforces live-evidence requirement"
fi

if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "❌ $FAILED check(s) failed"
  exit 1
fi

echo ""
echo "✅ All live-evidence requirements satisfied"
