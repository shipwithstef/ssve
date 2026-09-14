#!/usr/bin/env bash
# Tier-1 (WI-142): For every BASELINED+ feature spec that carries an
# `## Industry Grounding` section, verify the four required subsections are
# present and the Source/Landscape state metadata fields are populated.
#
# This complements validate-feature-competitive-cross-reference.sh (which
# enforces presence of the section) by enforcing its substructure.
#
# Required subsections (per references/templates/industry-grounding.md):
#   ### What the industry does
#   ### What we're doing
#   ### Why we differ (or align)
#   ### Reversibility
#
# Required metadata:
#   **Source:** <path>
#   **Landscape state:** <value>
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

FAIL=0

if [ ! -d "$REPO_ROOT/docs/specs/features" ]; then
  echo "PASS: validate-industry-grounding-section (no docs/specs/features dir — N/A)"
  exit 0
fi

REQUIRED_SUBSECTIONS=(
  "### What the industry does"
  "### What we're doing"
  "### Why we differ"
  "### Reversibility"
)

while IFS= read -r spec; do
  # Only check BASELINED+ specs that have the new section header.
  # Legacy `## Competitive Risk Assessment` is permitted during migration but
  # NOT enforced here — once renamed to `## Industry Grounding`, the four-part
  # structure becomes mandatory.
  if ! grep -qE "^\*\*Status:\*\* (BASELINED|CHANGE-SET-APPROVED|PROMOTED|VERIFIED)" "$spec" 2>/dev/null; then
    continue
  fi
  if ! grep -q "^## Industry Grounding" "$spec"; then
    continue
  fi

  # Extract the Industry Grounding section body. The start header is also an H2,
  # so do not let the generic "next H2" terminator stop on the same line.
  section_body=$(awk '
    /^## Industry Grounding/ { in_section=1; print; next }
    in_section && /^## [^#]/ { exit }
    in_section { print }
  ' "$spec" 2>/dev/null || true)

  # Check required metadata
  if ! grep -qE "^\*\*Source:\*\*" <<< "$section_body"; then
    echo "FAIL: $spec — Industry Grounding section missing **Source:** metadata field." >&2
    FAIL=1
  fi
  if ! grep -qE "^\*\*Landscape state:\*\*" <<< "$section_body"; then
    echo "FAIL: $spec — Industry Grounding section missing **Landscape state:** metadata field." >&2
    FAIL=1
  fi

  # Check required subsections
  for sub in "${REQUIRED_SUBSECTIONS[@]}"; do
    if ! grep -qF "$sub" <<< "$section_body"; then
      echo "FAIL: $spec — Industry Grounding section missing required subsection: '$sub'." >&2
      FAIL=1
    fi
  done
done < <(find "$REPO_ROOT/docs/specs/features" -type f -name "*.md" 2>/dev/null)

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: validate-industry-grounding-section"
  exit 0
fi
exit 1
