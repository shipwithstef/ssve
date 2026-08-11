#!/usr/bin/env bash
# kimi-job-cleanup.sh — purge /tmp/svc-kimi-jobs entries older than 24h.
#
# Safe to cron: only deletes files older than the threshold and skips
# anything not in /tmp/svc-kimi-jobs.
#
# Usage:
#   kimi-job-cleanup.sh                # default 24h
#   kimi-job-cleanup.sh --hours N
#
set -euo pipefail

JOB_ROOT="/tmp/svc-kimi-jobs"
HOURS=24

if [ "${1:-}" = "--hours" ]; then
  HOURS="${2:?--hours requires value}"
fi

[ -d "$JOB_ROOT" ] || exit 0

# Find files older than HOURS hours and delete.
find "$JOB_ROOT" -maxdepth 1 -type f -mmin +$((HOURS * 60)) \
  \( -name '*.log' -o -name '*.pid' -o -name '*.status' -o -name '*.worker.sh' \) \
  -delete

# Compact the index by dropping entries whose log_path no longer exists.
INDEX="$JOB_ROOT/index.jsonl"
if [ -r "$INDEX" ]; then
  TMP="$(mktemp)"
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    LOG="$(printf '%s' "$line" | sed -n 's/.*"log_path":"\([^"]*\)".*/\1/p')"
    if [ -n "$LOG" ] && [ -e "$LOG" ]; then
      printf '%s\n' "$line" >> "$TMP"
    fi
  done < "$INDEX"
  mv "$TMP" "$INDEX"
fi
