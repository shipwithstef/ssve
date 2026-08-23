#!/usr/bin/env bash
# Resolve, launch, and append exact schema-v2 execute dispatch evidence.
set -u

HARNESS="${1:-}"
SKILL="${2:-execute-changeset}"
PAYLOAD="${3:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTEXT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)"
WI_ID="${SVC_WORKER_WI:-}"

if [[ -z "$HARNESS" || -z "$PAYLOAD" || -z "$WI_ID" ]]; then
  echo "usage: SVC_WORKER_WI=<WI> dispatch-log.sh <resolved-host> <skill> <prompt-or-@file>" >&2
  exit 2
fi

if [[ "${PAYLOAD:0:1}" == "@" ]]; then
  PAYLOAD_FILE="${PAYLOAD:1}"
  [[ -r "$PAYLOAD_FILE" ]] || { echo "payload file unreadable: $PAYLOAD_FILE" >&2; exit 2; }
  PAYLOAD="$(<"$PAYLOAD_FILE")"
fi

PREFLIGHT_ARGS=(preflight --repo "$CONTEXT_ROOT" --wi "$WI_ID")
if [[ -n "${SVC_DISPATCH_POLICY:-}" ]]; then PREFLIGHT_ARGS+=(--policy "$SVC_DISPATCH_POLICY"); fi
if [[ -n "${SVC_DISPATCH_MODE:-}" ]]; then PREFLIGHT_ARGS+=(--mode "$SVC_DISPATCH_MODE"); fi
if [[ -n "${SVC_HOST:-}" ]]; then PREFLIGHT_ARGS+=(--orchestrator "$SVC_HOST"); fi
PREFLIGHT_JSON="$(node "$SCRIPT_DIR/resolve-execute-dispatch.mjs" "${PREFLIGHT_ARGS[@]}")" || exit $?

IFS=$'\t' read -r DECISION MODE HOST FAMILY MODEL EFFORT POLICY_SHA REVIEW_SHA <<<"$(node -e '
const value=JSON.parse(process.argv[1]);
process.stdout.write([value.decision,value.mode,value.host,value.family,value.model,value.effort,value.policy_sha256,value.review_log_sha256].join("\t"));
' "$PREFLIGHT_JSON")"

if [[ "$DECISION" != "dispatch" || "$HARNESS" != "$HOST" ]]; then
  echo "dispatch-log: requested harness $HARNESS does not match authorized decision $DECISION host ${HOST:-none}" >&2
  exit 2
fi
if [[ -n "${SVC_WORKER_MODEL:-}" && "$SVC_WORKER_MODEL" != "$MODEL" ]]; then
  echo "dispatch-log: requested model $SVC_WORKER_MODEL does not match authorized $MODEL" >&2
  exit 2
fi
if [[ -n "${SVC_WORKER_EFFORT:-}" && "$SVC_WORKER_EFFORT" != "$EFFORT" ]]; then
  echo "dispatch-log: requested effort $SVC_WORKER_EFFORT does not match authorized $EFFORT" >&2
  exit 2
fi

mkdir -p "$CONTEXT_ROOT/.svc"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_LOG="/tmp/svc-dispatch-${STAMP}-$$.log"
START_MS="$(date +%s%3N)"

SVC_HARNESS="$HOST" \
SVC_WORKER_SKILL="$SKILL" \
SVC_WORKER_MODEL="$MODEL" \
SVC_WORKER_EFFORT="$EFFORT" \
SVC_WORKER_FAMILY="$FAMILY" \
SVC_WORKER_POLICY_SHA256="$POLICY_SHA" \
SVC_WORKER_REVIEW_LOG_SHA256="$REVIEW_SHA" \
  bash "$SCRIPT_DIR/dispatch-worker.sh" "$PAYLOAD" >"$RUN_LOG" 2>&1
EXIT_CODE=$?

END_MS="$(date +%s%3N)"
DURATION_MS=$((END_MS - START_MS))
DISPATCH_JSONL="$CONTEXT_ROOT/.svc/dispatch-log.jsonl"

node --input-type=module - "$SCRIPT_DIR/state-io.mjs" "$DISPATCH_JSONL" "$WI_ID" "$DECISION" "$SKILL" "$MODE" "$HOST" "$FAMILY" "$MODEL" "$EFFORT" "$POLICY_SHA" "$REVIEW_SHA" "$DURATION_MS" "$EXIT_CODE" "$RUN_LOG" <<'NODE'
import { pathToFileURL } from 'node:url';
const [stateIoPath, logPath, wi, decision, skill, mode, host, family, model, effort, policySha, reviewSha, durationMs, exitCode, runLog] = process.argv.slice(2);
const { appendJsonlLine } = await import(pathToFileURL(stateIoPath).href);
appendJsonlLine(logPath, {
  schema_version: 2,
  ts: new Date().toISOString(),
  wi,
  decision,
  skill,
  mode,
  host,
  family,
  model,
  effort,
  policy_sha256: policySha,
  review_log_sha256: reviewSha,
  duration_ms: Number(durationMs),
  exit_code: Number(exitCode),
  log_path: runLog,
});
NODE

cat "$RUN_LOG"
exit "$EXIT_CODE"
