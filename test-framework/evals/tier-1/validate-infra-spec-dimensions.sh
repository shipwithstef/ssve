#!/usr/bin/env bash
# Tier 1: Verify every infra spec has the 3 mandatory dimension sections
# (FinOps / Security / Scalability) per proposal §17.4.
# Only checks specs whose lane field declares an infra-* lane.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SPECS_DIR="$REPO_ROOT/docs/specs/features"
PASS=0
FAIL=0
ERRORS=""

if [[ ! -d "$SPECS_DIR" ]]; then
  echo "validate-infra-spec-dimensions: no specs directory yet — OK"
  exit 0
fi

while IFS= read -r spec; do
  [[ -f "$spec" ]] || continue
  # Detect infra lane via heading/frontmatter
  if ! grep -qiE "^(\*\*Lane:\*\*|lane:)\s*(infra-greenfield|infra-feature|infra-migration|infra-incident|infra-cost-optimization)" "$spec"; then
    continue
  fi
  for dim in "FinOps" "Security" "Scalability"; do
    if ! grep -qE "^## $dim\b" "$spec"; then
      ERRORS+="  FAIL: ${spec#$REPO_ROOT/} — missing required '## $dim' section (infra spec dimension)\n"
      FAIL=$((FAIL+1))
    else
      PASS=$((PASS+1))
    fi
  done
done < <(find "$SPECS_DIR" -name "*.md" -type f 2>/dev/null)

echo "validate-infra-spec-dimensions: $PASS pass, $FAIL fail"
if [[ -n "$ERRORS" ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
