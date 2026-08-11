#!/usr/bin/env bash
# Tier-1: when a spec has a Compensating Control section, all 4 fields MUST
# be filled (no TBD/blank/placeholder). Per CC-03.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

REQUIRED_FIELDS=("missing_capability" "why_not_now" "risk_of_workaround" "path_to_replacement")
FAIL=0

if [ ! -d "$REPO_ROOT/docs/specs/features" ]; then
  echo "PASS: validate-spec-compensating-control (no docs/specs/features dir — N/A)"
  exit 0
fi

while IFS= read -r spec; do
  if ! grep -q "^## Compensating Control" "$spec"; then
    continue
  fi

  for field in "${REQUIRED_FIELDS[@]}"; do
    # Field must appear AND have non-empty/non-TBD value after colon
    if ! grep -qE "(^|^- |^\*\*|\s)$field\s*:?\s*\S" "$spec"; then
      echo "FAIL: $spec Compensating Control missing field: $field" >&2
      FAIL=1
      continue
    fi
    # Reject placeholder values
    if grep -qE "(^|^- |^\*\*|\s)$field\s*:?\s*(TBD|TODO|<.*>|placeholder|to be filled|\[fill)" "$spec"; then
      echo "FAIL: $spec Compensating Control field '$field' has placeholder value." >&2
      FAIL=1
    fi
  done
done < <(find "$REPO_ROOT/docs/specs/features" -type f -name "*.md" 2>/dev/null)

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: validate-spec-compensating-control"
  exit 0
fi
exit 1
