#!/usr/bin/env bash
# Tier 1 — launch-knowledge freshness (WI-126).
#
# Flags any knowledge file under references/knowledge/launch/credit-programs/
# or references/knowledge/launch/jurisdictions/ whose last-modified mtime is
# >12 months old. Programs revise eligibility / amounts annually; jurisdictional
# rules (caps, VAT thresholds, franchise taxes) change annually.
#
# Exit 0 = all fresh OR knowledge dirs do not exist yet (skill not installed).
# Exit 1 = at least one stale file; prints the list.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

PASS=0
FAIL=0
ERRORS=""
STALE=()

# 12 months = 365 days.
MAX_AGE_DAYS="${LAUNCH_KNOWLEDGE_MAX_AGE_DAYS:-365}"

CHECK_DIRS=(
  "$REPO_ROOT/references/knowledge/launch/credit-programs"
  "$REPO_ROOT/references/knowledge/launch/jurisdictions"
)

ANY_DIR_PRESENT=0
for dir in "${CHECK_DIRS[@]}"; do
  if [[ -d "$dir" ]]; then
    ANY_DIR_PRESENT=1
    break
  fi
done

if [[ $ANY_DIR_PRESENT -eq 0 ]]; then
  echo ""
  echo "  launch-knowledge-freshness: skipped (knowledge dirs not present)"
  exit 0
fi

for dir in "${CHECK_DIRS[@]}"; do
  if [[ ! -d "$dir" ]]; then
    continue
  fi
  while IFS= read -r -d '' file; do
    base="$(basename "$file")"
    # Skip INDEX.md — it's a Layer-1 navigator that doesn't need annual refresh
    # (each detail file's freshness is tracked individually).
    if [[ "$base" == "INDEX.md" ]]; then
      PASS=$((PASS+1))
      continue
    fi
    # Find files older than MAX_AGE_DAYS via mtime
    if find "$file" -mtime "+$MAX_AGE_DAYS" -print -quit | grep -q .; then
      STALE+=("$file")
      FAIL=$((FAIL+1))
    else
      PASS=$((PASS+1))
    fi
  done < <(find "$dir" -type f -name '*.md' -print0)
done

if [[ $FAIL -gt 0 ]]; then
  ERRORS+="  FAIL: ${FAIL} stale launch-knowledge file(s) (>$MAX_AGE_DAYS days):\n"
  for f in "${STALE[@]}"; do
    rel="${f#$REPO_ROOT/}"
    ERRORS+="    - $rel\n"
  done
fi

echo ""
echo "  launch-knowledge-freshness: $PASS passed, $FAIL failed (max-age ${MAX_AGE_DAYS}d)"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  echo "  Fix: dispatch /research <topic> against each stale file's source URL,"
  echo "       update content, then 'git commit' to bump mtime."
  exit 1
fi
exit 0
