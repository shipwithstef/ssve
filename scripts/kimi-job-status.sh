#!/usr/bin/env bash
# kimi-job-status.sh — report state of a detached Kimi job.
#
# Usage:
#   kimi-job-status.sh <job_id>           # JSON for one job
#   kimi-job-status.sh --list             # JSON array of registry entries
#
# Output fields:
#   state         — running | done | timeout | killed | unknown
#   exit_code     — present when state != running and worker wrote .status
#   elapsed_seconds
#   log_tail_kb   — size of the log file in KB (rounded up)
#
set -euo pipefail

JOB_ROOT="/tmp/svc-kimi-jobs"

if [ "${1:-}" = "--list" ]; then
  if [ ! -r "$JOB_ROOT/index.jsonl" ]; then
    echo "[]"
    exit 0
  fi
  printf '['
  first=1
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    if [ "$first" -eq 1 ]; then first=0; else printf ','; fi
    printf '%s' "$line"
  done < "$JOB_ROOT/index.jsonl"
  printf ']\n'
  exit 0
fi

JOB_ID="${1:-}"
[ -n "$JOB_ID" ] || { echo "usage: kimi-job-status.sh <job_id> | --list" >&2; exit 2; }

PID_PATH="$JOB_ROOT/${JOB_ID}.pid"
STATUS_PATH="$JOB_ROOT/${JOB_ID}.status"
LOG_PATH="$JOB_ROOT/${JOB_ID}.log"

[ -r "$PID_PATH" ] || { echo "{\"job_id\":\"$JOB_ID\",\"state\":\"unknown\",\"reason\":\"no pid file\"}"; exit 0; }

PID="$(cat "$PID_PATH")"
NOW="$(date +%s)"

# Started-at from registry.
STARTED_AT_EPOCH=0
if [ -r "$JOB_ROOT/index.jsonl" ]; then
  REG_LINE="$(grep -F "\"job_id\":\"$JOB_ID\"" "$JOB_ROOT/index.jsonl" | tail -n1 || true)"
  if [ -n "$REG_LINE" ]; then
    ISO="$(printf '%s' "$REG_LINE" | sed -n 's/.*"started_at":"\([^"]*\)".*/\1/p')"
    [ -n "$ISO" ] && STARTED_AT_EPOCH="$(date -d "$ISO" +%s 2>/dev/null || echo 0)"
  fi
fi
[ "$STARTED_AT_EPOCH" -gt 0 ] || STARTED_AT_EPOCH="$NOW"
ELAPSED=$((NOW - STARTED_AT_EPOCH))

LOG_KB=0
if [ -r "$LOG_PATH" ]; then
  BYTES="$(stat -c%s "$LOG_PATH" 2>/dev/null || echo 0)"
  LOG_KB=$(( (BYTES + 1023) / 1024 ))
fi

if [ -r "$STATUS_PATH" ]; then
  STATE="$(sed -n 's/.*"state":"\([^"]*\)".*/\1/p' "$STATUS_PATH")"
  EXIT_CODE="$(sed -n 's/.*"exit_code":\([0-9-]*\).*/\1/p' "$STATUS_PATH")"
  printf '{"job_id":"%s","state":"%s","exit_code":%s,"elapsed_seconds":%d,"log_tail_kb":%d}\n' \
    "$JOB_ID" "${STATE:-done}" "${EXIT_CODE:-0}" "$ELAPSED" "$LOG_KB"
  exit 0
fi

# No status file yet → still running (or died without writing). Check process.
if kill -0 "$PID" 2>/dev/null; then
  printf '{"job_id":"%s","state":"running","pid":%d,"elapsed_seconds":%d,"log_tail_kb":%d}\n' \
    "$JOB_ID" "$PID" "$ELAPSED" "$LOG_KB"
else
  printf '{"job_id":"%s","state":"unknown","reason":"pid not alive and no status file","elapsed_seconds":%d,"log_tail_kb":%d}\n' \
    "$JOB_ID" "$ELAPSED" "$LOG_KB"
fi
