#!/usr/bin/env bash
# Tier 1 — research skill activity-scorecard gate.
#
# When a knowledge domain has CAPABILITIES.md mtime newer than the activity
# gate's introduction (2026-05-03), it MUST also contain `.activity.json`
# with a non-null `activity_verdict` field — UNLESS the domain has a marker
# `.activity-na` indicating activity-check is not applicable (e.g., open-source
# repo libs, internal-only tooling that doesn't publish a blog).
#
# Failure mode this prevents: agent extracts site/competitor without
# checking liveness; downstream consumers get stale "active" assumptions.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
KB_ROOT="$REPO_ROOT/references/knowledge"
GATE_DATE="2026-05-03"
GATE_EPOCH=$(date -u -d "$GATE_DATE 00:00:00 UTC" +%s)

PASS=0
FAIL=0
SKIP=0
ERRORS=""

file_commit_epoch() {
  local path="$1"
  local ts=""
  local relative="${path#$REPO_ROOT/}"

  ts=$(node --input-type=module - "$REPO_ROOT" "$relative" <<'NODE'
import { historicalPathEpoch } from "./scripts/lib/history-epoch.mjs";
console.log(historicalPathEpoch(process.argv[2], process.argv[3]));
NODE
)

  if [[ -z "$ts" || "$ts" == "" ]]; then
    ts=$(stat -c %Y "$path" 2>/dev/null || stat -f %m "$path" 2>/dev/null || echo 0)
  fi

  echo "${ts:-0}"
}

shopt -s nullglob
for caps in "$KB_ROOT"/competitors/*/CAPABILITIES.md "$KB_ROOT"/launch/*/CAPABILITIES.md; do
  [[ -f "$caps" ]] || continue
  domain_dir=$(dirname "$caps")
  caps_epoch=$(file_commit_epoch "$caps")
  caps_date=$(date -u -d "@$caps_epoch" +%Y-%m-%d 2>/dev/null || date -r "$caps" +%Y-%m-%d)

  # Skip legacy domains based on commit-time.
  if (( caps_epoch < GATE_EPOCH )); then
    SKIP=$((SKIP+1))
    continue
  fi

  # Skip domains with explicit N/A marker
  if [[ -f "$domain_dir/.activity-na" ]]; then
    SKIP=$((SKIP+1))
    continue
  fi

  # Require .activity.json
  if [[ ! -f "$domain_dir/.activity.json" ]]; then
    ERRORS+="  FAIL: $(basename "$domain_dir") — CAPABILITIES.md ($caps_date, ≥ gate $GATE_DATE) but no .activity.json. Run blog-crawl.mjs or create .activity-na if blog-crawl doesn't apply.\n"
    FAIL=$((FAIL+1))
    continue
  fi

  # Validate activity_verdict is set
  verdict=$(grep -oE '"activity_verdict"[[:space:]]*:[[:space:]]*"[^"]+"' "$domain_dir/.activity.json" | sed 's/.*"\([^"]*\)"$/\1/' | head -1)
  if [[ -z "$verdict" ]]; then
    ERRORS+="  FAIL: $(basename "$domain_dir") — .activity.json missing activity_verdict field\n"
    FAIL=$((FAIL+1))
  else
    PASS=$((PASS+1))
  fi
done

echo "  validate-research-activity-scorecard: $PASS passed, $FAIL failed, $SKIP skipped (legacy or N/A)"
if [[ $FAIL -gt 0 ]]; then
  printf "%b" "$ERRORS"
  exit 1
fi
exit 0
