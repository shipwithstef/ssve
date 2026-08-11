#!/usr/bin/env bash
# Tier-1 (WI-142): Defensive lockdown. The SDKG primitive layer
# (scripts/lib/structured-gate-engine.mjs) and per-instance gate configs
# (scripts/gates/*.mjs) MUST NOT make network calls at gate-time. Gates read
# from structured data files (populated by analyze-competitors and the
# eventual refresh-competitors skill from WI-143) — NEVER fetch live data
# during a gate evaluation.
#
# Web-fetch from a gate is slow (per-spec cost), expensive (every spec gate
# burns API tokens), inconsistent (intermittent failures), and re-fetches
# what should already be in the knowledge base.
#
# This validator greps the engine + per-gate configs + gate-related validators
# for forbidden network-call patterns and fails if any are found.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

# Files that MUST NOT contain network calls
TARGETS=(
  "scripts/lib/structured-gate-engine.mjs"
)

# Add all per-gate configs
if [ -d "$REPO_ROOT/scripts/gates" ]; then
  while IFS= read -r f; do
    TARGETS+=("$(realpath --relative-to="$REPO_ROOT" "$f")")
  done < <(find "$REPO_ROOT/scripts/gates" -type f -name "*.mjs" 2>/dev/null)
fi

# Forbidden patterns. Note: we exclude `// fetch` comments and the import-line
# shebang `^#` by anchoring to actual call sites.
FORBIDDEN_PATTERNS=(
  '\bfetch\s*\('
  '\bWebSearch\b'
  '\bWebFetch\b'
  '\bgh\s+api\b'
  '\bcurl\s'
  '\bwget\s'
  'https?://[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/'
)

FAIL=0

for target in "${TARGETS[@]}"; do
  full="$REPO_ROOT/$target"
  if [ ! -f "$full" ]; then
    continue
  fi
  for pat in "${FORBIDDEN_PATTERNS[@]}"; do
    # Strip line comments before grepping. Crude but effective.
    if sed 's://.*$::' "$full" | grep -qE "$pat"; then
      echo "FAIL: $target contains forbidden network-call pattern: $pat" >&2
      sed 's://.*$::' "$full" | grep -nE "$pat" | head -3 >&2
      FAIL=1
    fi
  done
done

if [ "$FAIL" -eq 0 ]; then
  echo "PASS: validate-no-web-fetch-in-gate"
  exit 0
fi
exit 1
