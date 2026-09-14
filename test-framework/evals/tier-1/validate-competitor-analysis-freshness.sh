#!/usr/bin/env bash
# Tier-1: 90-day freshness check for analyze-competitors.data.json (COMP-06)
# + cross-references competitive-monitor-triggers.jsonl: if 3+ triggers in
# quarter AND last_verified >90d → FAIL (MON-03/MON-04).
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

DATA="$REPO_ROOT/docs/specs/analyze-competitors.data.json"
TRIGGERS="$REPO_ROOT/.svc/competitive-monitor-triggers.jsonl"

# In svc itself there is no project-level analyze-competitors.data.json — that
# only materializes in downstream consumer repos. So this validator is a no-op
# in svc (returns PASS) but enforces in any downstream project that has the file.
if [ ! -f "$DATA" ]; then
  echo "PASS: validate-competitor-analysis-freshness (no project data file — N/A)"
  exit 0
fi

# Compute max last_verified age in days
MAX_AGE_DAYS=$(node -e "
const fs = require('fs');
const d = JSON.parse(fs.readFileSync('$DATA','utf8'));
if (!d.competitors || !d.competitors.length) { console.log(0); process.exit(0); }
const today = Date.now();
const ages = d.competitors.map(c => {
  const t = new Date(c.last_verified).getTime();
  return Math.floor((today - t) / (1000*60*60*24));
});
console.log(Math.max(...ages));
")

LANDSCAPE_STATE=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$DATA','utf8')).landscape_state)")

# Hard-fail: >90 days AND landscape is populated/nascent
if [ "$MAX_AGE_DAYS" -gt 90 ] && { [ "$LANDSCAPE_STATE" = "populated" ] || [ "$LANDSCAPE_STATE" = "nascent" ]; }; then
  echo "FAIL: competitor data is $MAX_AGE_DAYS days old (>90d threshold) AND landscape_state=$LANDSCAPE_STATE." >&2
  echo "      Run /analyze-competitors to refresh before BASELINE on any feature touching core mechanics." >&2
  exit 1
fi

# Cross-reference triggers jsonl (MON-04): 3+ events in last 90 days + stale data → FAIL
if [ -f "$TRIGGERS" ]; then
  TRIGGER_COUNT=$(node -e "
    const fs = require('fs');
    const lines = fs.readFileSync('$TRIGGERS','utf8').split('\n').filter(Boolean);
    const cutoff = Date.now() - 90*24*60*60*1000;
    const recent = lines.filter(l => {
      try { return new Date(JSON.parse(l).ts).getTime() > cutoff; } catch { return false; }
    });
    console.log(recent.length);
  ")
  if [ "$TRIGGER_COUNT" -ge 3 ] && [ "$MAX_AGE_DAYS" -gt 60 ]; then
    echo "FAIL: $TRIGGER_COUNT core-mechanic WIs in last 90 days + competitor data is $MAX_AGE_DAYS days old." >&2
    echo "      High-velocity project — competitor data MUST be re-verified more often." >&2
    exit 1
  fi
fi

echo "PASS: validate-competitor-analysis-freshness (max age ${MAX_AGE_DAYS}d, landscape=$LANDSCAPE_STATE)"
