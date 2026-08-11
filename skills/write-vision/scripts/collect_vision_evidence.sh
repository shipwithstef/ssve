#!/usr/bin/env bash
set -euo pipefail

# Non-mutating evidence inventory for vision grounding.
# Usage:
#   collect_vision_evidence.sh [repo_root]

REPO_ROOT="${1:-$(pwd)}"

if [ -d "$REPO_ROOT/docs/specs" ]; then
  ROOT="$REPO_ROOT"
elif [ -d "$REPO_ROOT/svc/docs/specs" ]; then
  ROOT="$REPO_ROOT/svc"
else
  echo "Error: could not detect repo root from '$REPO_ROOT'" >&2
  echo "Pass the repo root explicitly, e.g. collect_vision_evidence.sh /path/to/repo" >&2
  exit 1
fi

cd "$ROOT"

echo "# Vision Evidence Inventory"
echo
echo "Generated: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "Root: $ROOT"
echo

echo "## Vision Targets"
if [ -f "docs/specs/vision.md" ]; then
  echo "- Canonical: docs/specs/vision.md"
else
  echo "- Canonical: docs/specs/vision.md (missing)"
fi

if [ -f "VISION.md" ]; then
  echo "- Legacy candidate: VISION.md"
fi
if [ -f "docs/specs/CORE_VISION.md" ]; then
  echo "- Legacy candidate: docs/specs/CORE_VISION.md"
fi
echo

anchor_block() {
  local title="$1"
  local cmd="$2"
  echo "### $title"
  if ! eval "$cmd"; then
    echo "- No matches found"
  fi
  echo
}

anchor_block "README anchors" \
  "test -f README.md && rg -n --no-heading 'north star|vision|problem|audience|trust|match|value|non-goal|metric' README.md"

anchor_block "Implementation status anchors" \
  "test -f IMPLEMENTATION_STATUS.md && rg -n --no-heading 'status|built|shipped|production|resolved|planned|drift|metric' IMPLEMENTATION_STATUS.md"

anchor_block "Vision/spec anchors" \
  "test -d docs/specs && rg -n --no-heading 'north star|problem|audience|non-goals|principles|success|metric|vision' docs/specs/*.md docs/specs/features/*.md 2>/dev/null"

anchor_block "Journey/persona anchors" \
  "test -d docs/specs && rg -n --no-heading 'persona|journey|segment|role|who we serve|user type' docs/specs/journeys/*.md docs/specs/personas/*.md 2>/dev/null"

anchor_block "Runtime code anchors" \
  "rg -n --no-heading 'match|trust|tier|vision|decision|workflow|persona|journey|feature' src lib web app 2>/dev/null"

