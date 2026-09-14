#!/usr/bin/env bash
# Tier-1: Every BASELINED+ feature spec MUST carry an `## Industry Grounding`
# section with a documented `landscape_state` field. Per WI-142, the keyword
# trigger (earn|redeem|verify|enroll|loyalty|points|reward) is REMOVED — the
# gate is now universal. Exemptions: explicit landscape_inapplicable_reason
# frontmatter, OR Type:Enabler/Integration with UX/UI pillar marked
# [N/A — justified] (framework-internal, no customer-facing flow to ground).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

FAIL=0

if [ ! -d "$REPO_ROOT/docs/specs/features" ]; then
  echo "PASS: validate-feature-competitive-cross-reference (no docs/specs/features dir — N/A)"
  exit 0
fi

while IFS= read -r spec; do
  # Only check BASELINED specs (or later lifecycle states)
  if ! grep -qE "^\*\*Status:\*\* (BASELINED|CHANGE-SET-APPROVED|PROMOTED|VERIFIED)" "$spec" 2>/dev/null; then
    continue
  fi

  # Exemption: spec explicitly declares landscape_inapplicable
  if grep -qE "landscape_inapplicable_reason\s*:" "$spec"; then
    continue
  fi

  # Exemption: framework-internal Enabler/Integration (no end-customer flow).
  # Signal: Type: Enabler|Integration AND UX or UI pillar marked [N/A — justified].
  # Such specs have no customer-facing flow against which industry mechanics
  # could be cross-referenced.
  if grep -qE "^\*\*Type:\*\* (Enabler|Integration)" "$spec" && \
     awk "/^## Pillars Coverage Matrix/,/^---/" "$spec" 2>/dev/null | grep -qE "(UX|UI).*\[N/A.*justified"; then
    continue
  fi

  # NOTE (WI-142): Keyword regex removed. Every BASELINED+ spec that is not
  # explicitly exempted must carry the Industry Grounding section. Pre-WI-142
  # this gate only fired for specs whose ACs matched core-mechanic keywords —
  # that left 90% of feature work without competitive grounding.

  # Has the section? Accept either the new header (Industry Grounding) or the
  # legacy header (Competitive Risk Assessment) during the migration window.
  # validate-industry-grounding-section.sh enforces the four-part substructure
  # under the new header; this validator just enforces presence.
  if ! grep -qE "^## (Industry Grounding|Competitive Risk Assessment)" "$spec"; then
    echo "FAIL: $spec is BASELINED+ but missing '## Industry Grounding' section (or legacy '## Competitive Risk Assessment'). See references/templates/industry-grounding.md." >&2
    FAIL=1
    continue
  fi

  # Has landscape_state field documented?
  if ! grep -qE "landscape_state\s*:|Landscape state:" "$spec"; then
    echo "FAIL: $spec has Industry Grounding section but no landscape_state field documented." >&2
    FAIL=1
  fi
done < <(find "$REPO_ROOT/docs/specs/features" -type f -name "*.md" 2>/dev/null)

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: validate-feature-competitive-cross-reference"
  exit 0
fi
exit 1
