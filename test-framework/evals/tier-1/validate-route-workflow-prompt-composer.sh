#!/usr/bin/env bash
# Tier 1: human-invoked route-workflow must compose full downstream prompts.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/route-workflow/SKILL.md"
REF="$REPO_ROOT/skills/route-workflow/references/prompt-composer.md"

PASS=0
FAIL=0

pass() {
  echo "  PASS: $1"
  PASS=$((PASS + 1))
}

fail() {
  echo "  FAIL: $1"
  FAIL=$((FAIL + 1))
}

require_fixed() {
  local file="$1"
  local needle="$2"
  local label="$3"
  if grep -Fq "$needle" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "=== Tier 1: route-workflow prompt composer ==="

if [[ -f "$REF" ]]; then
  pass "prompt composer reference exists"
else
  fail "prompt composer reference exists"
fi

require_fixed "$SKILL" "references/prompt-composer.md" "route-workflow loads prompt composer reference"
require_fixed "$SKILL" "For human-invoked routing, produce a Prompt Composer package" "human-invoked routing composes prompt package"
require_fixed "$SKILL" "Self-dispatch is allowed only when an explicit host/platform autorun contract or internal continuation invokes route-workflow non-interactively" "self-dispatch exception is narrow"
require_fixed "$SKILL" 'Still end with exactly one `**Next:**` trailer per the Output Protocol' "prompt composer reconciles output protocol"
require_fixed "$SKILL" "it must not replace the package with a thin next-skill line" "thin next trailer forbidden for rich routes"
require_fixed "$SKILL" "Prompt Composer package complete" "self-verify covers prompt package"
require_fixed "$SKILL" "copy-paste prompt/continuation primitive while naming the target skill" "self-verify allows prompt-composer next trailer"

require_fixed "$REF" "human_prompt_composer" "human prompt mode declared"
require_fixed "$REF" "internal_continuation" "internal continuation mode declared"
require_fixed "$REF" "explicit_autorun" "explicit autorun mode declared"
require_fixed "$REF" 'If the mode is ambiguous, default to `human_prompt_composer`.' "ambiguous mode defaults to prompt composer"
require_fixed "$REF" "Prompt To Send" "copy-paste prompt section required"
require_fixed "$REF" "Required Sequence" "sequence section required"
require_fixed "$REF" "Verification And Evals" "eval section required"
require_fixed "$REF" "Continuation Primitive" "continuation primitive section required"
require_fixed "$REF" '**Next:** <paste/send the prompt above' "package shape includes next trailer"
require_fixed "$REF" "Output Protocol Compatibility" "output protocol compatibility section required"
require_fixed "$REF" 'end with exactly one `**Next:**` line' "exactly one next trailer required"
require_fixed "$REF" "A response that only says" "thin next-only response rejected"
require_fixed "$REF" 'Use `/goal`' "goal suggestion rule required"
require_fixed "$REF" 'Use `/loop`' "loop suggestion rule required"
require_fixed "$REF" 'Use `dispatch-waves`' "dispatch-waves suggestion rule required"
require_fixed "$REF" "Never fabricate platform capabilities." "platform capability honesty required"

echo ""
echo "route-workflow prompt composer: $PASS passed, $FAIL failed"
if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
