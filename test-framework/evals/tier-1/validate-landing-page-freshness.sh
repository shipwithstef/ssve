#!/usr/bin/env bash
# Tier 1 — landing-page reference-bank freshness (WI-130).
#
# Flags any anchor pattern.md under references/landing-bank/<sector>/<anchor>/
# whose last-modified mtime is >12 months old. Real sites redesign annually;
# stale archetype analyses lead landing-page to chase outdated patterns.
#
# Exit 0 = all fresh OR no landing-bank directory exists yet (skill not used).
# Exit 1 = at least one stale anchor; prints the list.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

PASS=0
FAIL=0
STALE=()

MAX_AGE_DAYS="${LANDING_BANK_MAX_AGE_DAYS:-365}"

ROOT="$REPO_ROOT/references/landing-bank"

if [[ ! -d "$ROOT" ]]; then
  echo "=== Tier 1: landing-page reference-bank freshness ==="
  echo "  SKIP — references/landing-bank/ not present (landing-page not yet bootstrapped for any sector)"
  exit 0
fi

echo "=== Tier 1: landing-page reference-bank freshness ==="

NOW=$(date +%s)
MAX_AGE_SEC=$((MAX_AGE_DAYS * 86400))

while IFS= read -r f; do
  [[ -z "$f" ]] && continue
  mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
  age=$((NOW - mtime))
  if [[ $age -gt $MAX_AGE_SEC ]]; then
    STALE+=("$f (age: $((age / 86400))d)")
    FAIL=$((FAIL + 1))
  else
    PASS=$((PASS + 1))
  fi
done < <(find "$ROOT" -type f -name "pattern.md" 2>/dev/null)

# Anchor count gates — WI-131 raised the floor:
#   Sector banks (b2b-saas-vertical, dev-tools, etc.):  ≥10 anchors required
#   _high-performers cross-sector bank:                  exactly 10 required (style-mix invariant)
THIN_SECTORS=()
while IFS= read -r sector; do
  [[ -z "$sector" ]] && continue
  sector_name=$(basename "$sector")
  count=$(find "$sector" -mindepth 2 -name "pattern.md" 2>/dev/null | wc -l)
  if [[ "$sector_name" == "_high-performers" ]]; then
    # _high-performers: exactly 10 (style-diversity invariant)
    if [[ $count -lt 10 ]]; then
      THIN_SECTORS+=("_high-performers (only $count anchors; need 10 with style mix)")
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  else
    # sector banks: ≥10 anchors (raised from 3 in WI-131)
    if [[ $count -lt 10 ]]; then
      THIN_SECTORS+=("$sector_name (only $count anchors; need ≥10)")
      FAIL=$((FAIL + 1))
    else
      PASS=$((PASS + 1))
    fi
  fi
done < <(find "$ROOT" -mindepth 1 -maxdepth 1 -type d 2>/dev/null)

if [[ $FAIL -eq 0 ]]; then
  echo "  PASS — $PASS check(s) passed; no stale anchors, all sectors have ≥3 anchors"
  exit 0
else
  echo "  FAIL — $FAIL issue(s):"
  for s in "${STALE[@]}"; do echo "    STALE: $s"; done
  for t in "${THIN_SECTORS[@]}"; do echo "    THIN:  $t"; done
  echo ""
  echo "  Refresh per skills/landing-page/references/reference-bank-capture.md, OR add more anchors per sector."
  exit 1
fi
