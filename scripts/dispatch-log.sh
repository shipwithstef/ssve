#!/bin/bash
# scripts/dispatch-log.sh <harness> <skill> <prompt-or-file>
#
# Wrapper around dispatch-worker.sh that logs every dispatch to
# .svc/dispatch-log.jsonl with harness, model, skill, duration_ms, and
# approximate token usage parsed from subprocess output.
#
# This closes framework gap F-010 (token-economy instrumentation) from
# proposals/done/2026-04-20-evolution-orchestrator-parsimony.md.
#
# Token parsing is best-effort per harness:
#   - claude -p     : no stable token line in stdout; duration-only
#   - opencode run  : look for "tokens used" pattern (varies by version)
#   - codex exec    : "tokens used\n<number>" block in stdout tail
#
# Log entry shape (one JSON per line):
#   {"ts": "2026-04-20T14:30:00Z", "harness": "opencode", "model": "mimo-v2-pro",
#    "skill": "execute-changeset", "duration_ms": 8523, "approx_tokens": 37144,
#    "mode": "dispatch", "exit_code": 0, "log_path": "/tmp/svc-dispatch-<ts>.log"}
#
# WI-386: the `mode` field records whether the changeset executed via a zero-context
# subagent ("dispatch") or inline with the orchestrator's full context ("inline").
# This writer fires only when a subprocess is actually spawned, so it stamps
# "dispatch" by default; SVC_DISPATCH_MODE overrides it. plan-changeset resolves the
# mode BEFORE planning and the plan-manifest receipt's `mode` field mirrors this — the
# pair is what gates conditional blueprint authoring (schema if/then + check-chain).
#
# Usage:
#   bash scripts/dispatch-log.sh opencode execute-changeset "<prompt>"
#   bash scripts/dispatch-log.sh opencode execute-changeset @/tmp/payload.txt
set -u

HARNESS="${1:-claude}"
SKILL="${2:-execute-changeset}"
PAYLOAD="${3:-}"

[ -z "$PAYLOAD" ] && { echo "usage: dispatch-log.sh <harness> <skill> <prompt-or-@file>" >&2; exit 2; }

# Resolve payload from file if prefixed with @
if [ "${PAYLOAD:0:1}" = "@" ]; then
  FILE="${PAYLOAD:1}"
  [ -r "$FILE" ] || { echo "payload file unreadable: $FILE" >&2; exit 2; }
  PAYLOAD="$(cat "$FILE")"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || dirname "$SCRIPT_DIR")"
LOG_DIR=".svc"
[ -d "$LOG_DIR" ] || LOG_DIR="$REPO_ROOT/.svc"
mkdir -p "$LOG_DIR"

TS=$(date -u +%Y%m%dT%H%M%SZ)
DISPATCH_LOG="/tmp/svc-dispatch-${TS}-$$.log"
DISPATCH_JSONL="$LOG_DIR/dispatch-log.jsonl"

START_MS=$(date +%s%3N)

SVC_HARNESS="$HARNESS" SVC_WORKER_SKILL="$SKILL" \
  bash "$SCRIPT_DIR/dispatch-worker.sh" "$PAYLOAD" \
  > "$DISPATCH_LOG" 2>&1
EXIT=$?

END_MS=$(date +%s%3N)
DURATION_MS=$((END_MS - START_MS))

# Best-effort token extraction per harness
TOKENS=""
case "$HARNESS" in
  opencode)
    # opencode ~end-of-run: line like "tokens used: N" or similar
    TOKENS=$(grep -oE 'tokens[^0-9]*([0-9]{3,})' "$DISPATCH_LOG" | tail -1 | grep -oE '[0-9]+' | tail -1)
    ;;
  claude)
    # claude -p does not report tokens in stdout; leave blank
    TOKENS=""
    ;;
  openclaw)
    TOKENS=$(grep -oE 'tokens[^0-9]*([0-9]{3,})' "$DISPATCH_LOG" | tail -1 | grep -oE '[0-9]+' | tail -1)
    ;;
esac

# Resolve model from dispatch header (dispatch-worker.sh prints "🤖 Model: X")
MODEL=$(grep -oE '🤖 Model:[[:space:]]+\S+' "$DISPATCH_LOG" | awk '{print $NF}' | head -1)
[ -z "$MODEL" ] && MODEL="unknown"

# Append one-line JSON to the dispatch log
python3 -c "
import json, sys
entry = {
  'ts': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
  'harness': '$HARNESS',
  'model': '$MODEL',
  'skill': '$SKILL',
  'duration_ms': $DURATION_MS,
  'approx_tokens': $([ -n "$TOKENS" ] && echo "$TOKENS" || echo 'null'),
  'mode': '${SVC_DISPATCH_MODE:-dispatch}',
  'exit_code': $EXIT,
  'log_path': '$DISPATCH_LOG',
}
print(json.dumps(entry))
" >> "$DISPATCH_JSONL"

# Surface the dispatch output on stdout (so caller can still pipe-parse it)
cat "$DISPATCH_LOG"
exit $EXIT
