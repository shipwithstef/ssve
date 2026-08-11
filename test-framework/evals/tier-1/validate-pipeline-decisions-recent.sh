#!/usr/bin/env bash
# Tier 1: Validate that pipeline-decisions.jsonl has entries from the last 24h.
#
# A session that produces framework changes but writes zero decision-log entries
# breaks the audit trail. Origin: audit-session-execution finding F3 (May 6 2026).
#
# No LLM, <5s. Exit 0 if recent entries exist or file is missing/empty, 1 if stale.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
LOG="$REPO_ROOT/.svc/pipeline-decisions.jsonl"

MAX_AGE_HOURS=24
MAX_AGE_SEC=$((MAX_AGE_HOURS * 3600))

echo "=== Tier 1: Pipeline Decisions Recency ==="

if [[ ! -f "$LOG" ]]; then
  echo "  SKIP — .svc/pipeline-decisions.jsonl does not exist"
  exit 0
fi

LINE_COUNT=$(wc -l < "$LOG" 2>/dev/null || echo 0)
if [[ "$LINE_COUNT" -eq 0 ]]; then
  echo "  SKIP — pipeline-decisions.jsonl is empty"
  exit 0
fi

# Extract the most recent timestamp field
LAST_LINE=$(tail -1 "$LOG" 2>/dev/null || true)
TS=$(echo "$LAST_LINE" | grep -oE '"timestamp":"[^"]+"' | cut -d'"' -f4 || true)

# Fallback: some entries use "ts" instead of "timestamp"
if [[ -z "$TS" ]]; then
  TS=$(echo "$LAST_LINE" | grep -oE '"ts":"[^"]+"' | cut -d'"' -f4 || true)
fi

if [[ -z "$TS" ]]; then
  echo "  FAIL — cannot parse timestamp from last pipeline-decisions entry"
  exit 1
fi

# Normalize and parse
TS_NORMALIZED=$(echo "$TS" | sed 's/+[0-9][0-9]:[0-9][0-9]//')
TS_EPOCH=$(date -d "$TS_NORMALIZED" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "$TS_NORMALIZED" +%s 2>/dev/null || echo 0)

if [[ "$TS_EPOCH" -eq 0 ]]; then
  echo "  FAIL — cannot parse timestamp: $TS"
  exit 1
fi

NOW=$(date +%s)
AGE=$((NOW - TS_EPOCH))

if [[ $AGE -gt $MAX_AGE_SEC ]]; then
  AGE_HOURS=$((AGE / 3600))
  echo "  FAIL — last pipeline-decisions entry is ${AGE_HOURS}h old (max ${MAX_AGE_HOURS}h)"
  echo "    Last entry: $LAST_LINE"
  exit 1
else
  AGE_HOURS=$((AGE / 3600))
  echo "  PASS — last pipeline-decisions entry is ${AGE_HOURS}h old (recent)"
  exit 0
fi
