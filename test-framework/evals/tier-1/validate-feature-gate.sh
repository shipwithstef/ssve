#!/usr/bin/env bash
# Tier 1 — validate-feature gate (per WI-109).
#
# For every VERIFIED WI in a lane that requires validate-feature, confirm that
# either (a) a decision-log entry references validate-feature being run, OR
# (b) an explicit skip-validate-feature entry with non-empty reasoning exists.
#
# GRACE PERIOD: until 2026-05-02, gaps are warnings (exit 0). After that, failures.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WI_DIR="$REPO_ROOT/docs/specs/work-items"
DECISIONS="$REPO_ROOT/.svc/pipeline-decisions.jsonl"

# Lanes that require validate-feature
REQUIRING_LANES="greenfield brownfield-feature brownfield-conversion"

# Grace-period cutoff
GRACE_CUTOFF="2026-05-02"
TODAY="$(date -u +%Y-%m-%d)"
if [[ "$TODAY" > "$GRACE_CUTOFF" ]]; then
  BLOCKING=1
else
  BLOCKING=0
fi

PASS=0
WARN=0
FAIL=0
ERRORS=""

# Node one-liner to check a WI's decision log
check_wi() {
  local wi_id="$1"
  local wi_file="$2"
  node -e "
  const fs = require('fs');
  const id = '$wi_id';
  const log = '$DECISIONS';
  if (!fs.existsSync(log)) { console.log('missing-log'); process.exit(0); }
  const lines = fs.readFileSync(log, 'utf8').trim().split('\n').filter(Boolean);
  let ran = false, skipped = false, skipReason = '';
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.run_id !== id) continue;
      if (e.skill === 'validate-feature') {
        if (e.decision === 'skip-validate-feature') {
          skipped = true;
          skipReason = e.reasoning || '';
        } else {
          ran = true;
        }
      }
    } catch {}
  }
  if (ran) console.log('ran');
  else if (skipped && skipReason.length > 10) console.log('skipped-with-reason');
  else if (skipped) console.log('skipped-no-reason');
  else console.log('gap');
  "
}

for f in "$WI_DIR"/WI-*.md; do
  [[ -f "$f" ]] || continue
  basename=$(basename "$f" .md)
  # Skip DONE.md / INDEX.md (defensive — glob should not match these)
  [[ "$basename" == "DONE" || "$basename" == "INDEX" ]] && continue

  status=$(grep -m1 -E '^\*\*Status:\*\*' "$f" | sed -E 's/^\*\*Status:\*\* //' | tr -d '\r' || true)
  lane=$(grep -m1 -E '^\*\*Lane:\*\*' "$f" | sed -E 's/^\*\*Lane:\*\* //' | tr -d '\r' | awk '{print $1}' || true)

  # Only check VERIFIED WIs
  [[ "$status" != "VERIFIED" ]] && continue

  # Only check lanes that require validate-feature
  echo "$REQUIRING_LANES" | grep -qw "$lane" || { PASS=$((PASS+1)); continue; }

  result=$(check_wi "$basename" "$f")
  case "$result" in
    ran|skipped-with-reason)
      PASS=$((PASS+1))
      ;;
    skipped-no-reason)
      if [[ $BLOCKING -eq 1 ]]; then
        ERRORS+="  FAIL: $basename — validate-feature skipped but reasoning is missing or too short (< 10 chars)\n"
        FAIL=$((FAIL+1))
      else
        WARN=$((WARN+1))
      fi
      ;;
    gap|missing-log)
      if [[ $BLOCKING -eq 1 ]]; then
        ERRORS+="  FAIL: $basename (lane=$lane) — no validate-feature run and no override logged\n"
        FAIL=$((FAIL+1))
      else
        WARN=$((WARN+1))
      fi
      ;;
  esac
done

echo ""
if [[ $BLOCKING -eq 1 ]]; then
  echo "  validate-feature gate: $PASS passed, $FAIL failed (post-grace blocking mode)"
  if [[ $FAIL -gt 0 ]]; then
    printf "%b" "$ERRORS"
    exit 1
  fi
else
  echo "  validate-feature gate: $PASS passed, $WARN warnings (grace period until $GRACE_CUTOFF)"
fi
exit 0
