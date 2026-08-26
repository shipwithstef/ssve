#!/usr/bin/env bash
# scripts/lib/dispatch-codex-lane.sh — canonical detached Codex lane dispatcher.
#
# WI-FW-CODEX-SVC-HOST-DISPATCH-01: ad-hoc `nohup codex exec` dispatches do
# not export SVC_HOST into the spawned session, so every governed call inside
# the child was denied by the PreToolUse host-identity gate ("host identity
# missing: wiring must set SVC_HOST") and the lane died mid-flight (iOS Azure
# pipeline incident 2026-08-26). BREAK-GLASS does NOT bypass that gate — this
# wrapper is the ONLY sanctioned way to launch a detached Codex lane: it
# exports SVC_HOST=codex before detach so hooks resolve host identity even
# when their wiring carries no env prefix.
#
# Usage:
#   scripts/lib/dispatch-codex-lane.sh [--label <text>] [--max-seconds N] -- \
#     codex exec [codex args...] "<prompt>"
#
# Stdout: single JSON object { job_id, log_path, pid_path, started_at }
# Registry: /tmp/svc-codex-jobs/index.jsonl (one line per launch)
set -euo pipefail

usage() { sed -n '2,22p' "$0" >&2; exit 2; }

LABEL=""
MAX_SECONDS=""
while [ $# -gt 0 ]; do
  case "$1" in
    --label)       [ $# -ge 2 ] || usage; LABEL="${2//[^A-Za-z0-9_-]/_}"; shift 2 ;;
    --max-seconds) [ $# -ge 2 ] || usage; MAX_SECONDS="$2"; shift 2 ;;
    --help|-h)     usage ;;
    --)            shift; break ;;
    *)             break ;;  # first non-flag token starts the codex argv
  esac
done
[ $# -gt 0 ] || usage

case "$1" in
  codex|*/codex) : ;;
  *) echo "dispatch-codex-lane.sh only wraps 'codex' invocations (got: '$1'); BREAK-GLASS is not a substitute for host wiring" >&2; exit 2 ;;
esac

case "${MAX_SECONDS:-0}" in
  ''|*[!0-9]*) [ -z "$MAX_SECONDS" ] || { echo "max-seconds must be a positive integer" >&2; exit 2; } ;;
esac

# WI-FW-CODEX-SVC-HOST-DISPATCH-01 (P0): THE fix — child session inherits a
# valid host identity regardless of how the parent shell was provisioned.
export SVC_HOST=codex

JOB_ROOT="${SVC_CODEX_JOBS_ROOT:-/tmp/svc-codex-jobs}"
mkdir -p "$JOB_ROOT"

TS="$(date +%s)"
RAND="$(printf '%04x' "$((RANDOM % 65536))")"
JOB_ID="codex-lane-${TS}-${RAND}"
[ -n "$LABEL" ] && JOB_ID="${JOB_ID}-${LABEL}"

LOG_PATH="$JOB_ROOT/${JOB_ID}.log"
PID_PATH="$JOB_ROOT/${JOB_ID}.pid"
INDEX_PATH="$JOB_ROOT/index.jsonl"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ -n "$MAX_SECONDS" ]; then
  setsid nohup timeout --foreground "${MAX_SECONDS}s" "$@" </dev/null >>"$LOG_PATH" 2>&1 &
else
  setsid nohup "$@" </dev/null >>"$LOG_PATH" 2>&1 &
fi
CHILD_PID=$!
disown "$CHILD_PID" 2>/dev/null || true

echo "$CHILD_PID" > "$PID_PATH"

printf '{"job_id":"%s","pid":%d,"label":"%s","log_path":"%s","started_at":"%s"}\n' \
  "$JOB_ID" "$CHILD_PID" "$LABEL" "$LOG_PATH" "$STARTED_AT" >> "$INDEX_PATH"

printf '{"job_id":"%s","log_path":"%s","pid_path":"%s","started_at":"%s"}\n' \
  "$JOB_ID" "$LOG_PATH" "$PID_PATH" "$STARTED_AT"
