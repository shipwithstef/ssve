#!/bin/bash
# DEPRECATED on the Claude host for READ-ONLY analysis fan-outs (WI-373):
# use the native Workflow tool per references/workflow-fanout-protocol.md
# (pipeline/parallel + StructuredOutput + budget). Retained for non-Claude
# hosts until parity; mutating multi-WI work stays on dispatch-waves.
# scripts/wait-for-output.sh <file> [pattern] [timeout_s]
#
# Safe polling wrapper. Waits for a file to exist and optionally contain a
# pattern, up to a timeout. Exits 0 on success, non-zero on timeout.
# REPLACES ad-hoc `until [ -f ... ]; do sleep X; done` loops that leave
# zombies when the orchestrator forgets to kill them.
#
# Usage:
#   bash scripts/wait-for-output.sh /tmp/worker.log                  # file exists
#   bash scripts/wait-for-output.sh /tmp/worker.log "SUMMARY" 120    # file + pattern + 120s cap
#
# Exit codes:
#   0  — file exists (and pattern matched if given)
#   1  — timeout before file/pattern appeared
#   2  — usage error
set -u

FILE="${1:-}"
PATTERN="${2:-}"
TIMEOUT="${3:-300}"
INTERVAL=2

[ -z "$FILE" ] && { echo "usage: wait-for-output.sh <file> [pattern] [timeout_s]" >&2; exit 2; }

START=$(date +%s)
while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "TIMEOUT: $FILE not ready after ${TIMEOUT}s" >&2
    exit 1
  fi
  if [ -f "$FILE" ]; then
    if [ -z "$PATTERN" ]; then
      exit 0
    fi
    if grep -q "$PATTERN" "$FILE" 2>/dev/null; then
      exit 0
    fi
  fi
  sleep "$INTERVAL"
done
