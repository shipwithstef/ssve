#!/bin/bash
# DEPRECATED on the Claude host for READ-ONLY analysis fan-outs (WI-373):
# use the native Workflow tool per references/workflow-fanout-protocol.md
# (pipeline/parallel + StructuredOutput + budget). Retained for non-Claude
# hosts until parity; mutating multi-WI work stays on dispatch-waves.
# scripts/extract-summary.sh <log-file>
# Deterministic Tier-A extractor for the svc worker summary contract.
# Prints ONLY the SVC_WORKER_SUMMARY block to stdout.
# Exit 0: valid block found and printed.
# Exit 1: no block present (orchestrator should try haiku-extract.sh as salvage).
# Exit 2: file not readable.
#
# The worker summary block format is defined in scripts/dispatch-worker.sh
# and enforced by every worker regardless of harness.
set -eu

LOG="${1:-}"
if [ -z "$LOG" ] || [ ! -r "$LOG" ]; then
  echo "usage: extract-summary.sh <log-file>" >&2
  echo "log file missing or unreadable: $LOG" >&2
  exit 2
fi

# awk the block between the marker lines (inclusive of both markers).
BLOCK="$(awk '/=== SVC_WORKER_SUMMARY ===/,/=== END_SVC_WORKER_SUMMARY ===/' "$LOG")"

# Validate the block contains both markers (guards against half-truncated logs).
if ! echo "$BLOCK" | grep -q "=== SVC_WORKER_SUMMARY ===" \
   || ! echo "$BLOCK" | grep -q "=== END_SVC_WORKER_SUMMARY ==="; then
  echo "no valid summary block in $LOG" >&2
  exit 1
fi

echo "$BLOCK"
