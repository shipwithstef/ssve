#!/bin/bash
# DEPRECATED on the Claude host for READ-ONLY analysis fan-outs (WI-373):
# use the native Workflow tool per references/workflow-fanout-protocol.md
# (pipeline/parallel + StructuredOutput + budget). Retained for non-Claude
# hosts until parity; mutating multi-WI work stays on dispatch-waves.
# scripts/fanout.sh <workers.jsonl>
# Parallel worker fan-out orchestrator.
#
# Input (stdin or $1): a JSONL file where each line is a worker spec:
#   {"id": "A", "harness": "opencode", "skill": "execute-changeset", "payload_file": "/tmp/payload-A.txt"}
#
# Output (stdout): a markdown table summarizing all workers' SVC_WORKER_SUMMARY blocks.
# Side effect: per-worker logs at /tmp/svc-fanout-$$-<id>.log (kept for audit).
#
# Pipeline:
#   1. Read N worker specs.
#   2. Launch N dispatch-worker.sh invocations in parallel, each to its own log.
#   3. Wait for all to finish.
#   4. Run extract-summary.sh on each log; fall back to haiku-extract.sh when Tier A fails.
#   5. Emit one markdown table: id | status | files_changed count | blockers | next_action.
#
# Requires:
#   - jq (for JSONL parsing)
#   - scripts/dispatch-worker.sh
#   - scripts/extract-summary.sh
#   - scripts/haiku-extract.sh (optional; only used when Tier A fails)
set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DISPATCH="$SCRIPT_DIR/dispatch-worker.sh"
EXTRACT="$SCRIPT_DIR/extract-summary.sh"
HAIKU="$SCRIPT_DIR/haiku-extract.sh"

command -v jq >/dev/null 2>&1 || { echo "fanout.sh requires jq on PATH" >&2; exit 2; }
[ -x "$DISPATCH" ] || { echo "dispatch-worker.sh not executable at $DISPATCH" >&2; exit 2; }
[ -x "$EXTRACT" ]  || { echo "extract-summary.sh not executable at $EXTRACT" >&2; exit 2; }

RUN_ID=$$
declare -a PIDS=()
declare -a IDS=()
declare -a LOGS=()

# WI-562 Swarm DAG Velocity (V-1): adaptive bounded concurrency.
# Resolution order: --max-parallel N > SVC_FANOUT_MAX_PARALLEL > adaptive
# default min(queue, max(2, nproc/2)). Invalid/zero env values fall back to the
# adaptive default with a warning; UNBOUNDED requires the explicit --unbounded
# flag so callers can never "accidentally" disable the cap.
MAX_PARALLEL=""
UNBOUNDED=false
ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --max-parallel) MAX_PARALLEL="$2"; shift 2 ;;
    --unbounded)    UNBOUNDED=true; shift ;;
    *) ARGS+=("$1"); shift ;;
  esac
done

SPEC="${ARGS[0]:-/dev/stdin}"
QUEUE=$(grep -c . "$SPEC" 2>/dev/null || echo 0)
NPROC=$(nproc 2>/dev/null || echo 4)

if [[ $UNBOUNDED == true ]]; then
  MAX_PARALLEL=$(( QUEUE > 0 ? QUEUE : 1 ))
  echo "fanout: --unbounded requested — launching all $QUEUE workers at once (loudly logged per WI-562 V-1)" >&2
elif [[ -z "$MAX_PARALLEL" ]]; then
  ENV_VAL="${SVC_FANOUT_MAX_PARALLEL:-}"
  if [[ -n "$ENV_VAL" ]] && [[ "$ENV_VAL" =~ ^[1-9][0-9]*$ ]]; then
    MAX_PARALLEL="$ENV_VAL"
  else
    if [[ -n "$ENV_VAL" ]]; then
      echo "fanout: ignoring invalid SVC_FANOUT_MAX_PARALLEL='$ENV_VAL' — using adaptive default" >&2
    fi
    ADAPTIVE=$(( NPROC / 2 )); (( ADAPTIVE < 2 )) && ADAPTIVE=2
    (( ADAPTIVE > QUEUE && QUEUE > 0 )) && ADAPTIVE=$QUEUE
    MAX_PARALLEL=$ADAPTIVE
  fi
elif ! [[ "$MAX_PARALLEL" =~ ^[1-9][0-9]*$ ]]; then
  echo "fanout: ignoring invalid --max-parallel '$MAX_PARALLEL' — using adaptive default" >&2
  ADAPTIVE=$(( NPROC / 2 )); (( ADAPTIVE < 2 )) && ADAPTIVE=2
  (( ADAPTIVE > QUEUE && QUEUE > 0 )) && ADAPTIVE=$QUEUE
  MAX_PARALLEL=$ADAPTIVE
fi
(( MAX_PARALLEL > QUEUE && QUEUE > 0 )) && MAX_PARALLEL=$QUEUE

echo "fanout: queue=$QUEUE max_parallel=$MAX_PARALLEL (nproc=$NPROC)" >&2

# WI-562 V-1: bounded job-slot pool — launch up to MAX_PARALLEL, then
# launch-next-as-one-finishes. Streaming wait replaces the thundering herd.
# WI-562 V-2 retry bookkeeping: attempt counts per worker id.
declare -A ATTEMPTS

launch_worker() {
  local line="$1"
  local attempt="${ATTEMPTS[$(echo "$line" | jq -r '.id')]:-0}"
  ID="$(echo "$line" | jq -r '.id')"
  HARNESS="$(echo "$line" | jq -r '.harness // "claude"')"
  SKILL="$(echo "$line" | jq -r '.skill // "execute-changeset"')"
  PAYLOAD_FILE="$(echo "$line" | jq -r '.payload_file')"

  [ -r "$PAYLOAD_FILE" ] || { echo "payload unreadable for $ID: $PAYLOAD_FILE" >&2; exit 2; }

  LOG="/tmp/svc-fanout-$RUN_ID-$ID.log"
  LOGS+=("$LOG")
  IDS+=("$ID")

  PAYLOAD="$(cat "$PAYLOAD_FILE")"
  # WI-562 IP-H1/V-2: plan-declared validation commands flow to the worker
  # (unit-separator-separated) so evidence rows are replayable; the branch
  # CLAIM key is the BRANCH (workers on the same branch contend), not the id.
  DECLARED="$(echo "$line" | jq -r '(.validation_commands // []) | join("\u001f")')"
  WORKER_WI="$(echo "$line" | jq -r '.wi // .id')"
  WORKER_BRANCH="$(echo "$line" | jq -r '.branch // "branch"')"
  SVC_HARNESS="$HARNESS" SVC_WORKER_SKILL="$SKILL" \
    SVC_WORKER_WI="$WORKER_WI" \
    SVC_WORKER_DECLARED_COMMANDS="$DECLARED" \
    SVC_WORKER_BRANCH_CLAIM="${SVC_WORKER_BRANCH_CLAIM_PREFIX:-}${WORKER_BRANCH}" \
    bash "$DISPATCH" "$PAYLOAD" > "$LOG" 2>&1 &
  PIDS+=("$!")
}

QUEUE_LINES=()
while IFS= read -r line; do
  [ -z "$line" ] && continue
  QUEUE_LINES+=("$line")
done < "$SPEC"

run_queue() {
  for line in "${QUEUE_LINES[@]}"; do
    [ -z "$line" ] && continue
    # Slot free? Reap every finished worker before considering a new launch.
    while [[ ${#PIDS[@]} -ge $MAX_PARALLEL ]]; do
      local_done=0
      alive=()
      for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
          alive+=("$pid")
        else
          wait "$pid" 2>/dev/null || true
          local_done=1
        fi
      done
      PIDS=("${alive[@]}")
      [[ $local_done -eq 0 ]] && sleep 0.2
    done
    launch_worker "$line"
  done
}

run_queue

# Drain: wait out every in-flight worker BEFORE inspecting summaries.
for pid in "${PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done
PIDS=()

# WI-562 V-2: branch_busy retry — requeue up to 2 attempts per the documented
# consumer contract. A summary whose status is branch_busy goes back through
# the bounded pool; anything else is final for this run.
for round_i in 1 2; do
  declare -a NEXT=()
  for i in "${!IDS[@]}"; do
    grep -q "^status: branch_busy" "${LOGS[$i]}" 2>/dev/null || continue
    ID="${IDS[$i]}"
    ATT=$(( ${ATTEMPTS[$ID]:-0} + 1 ))
    if [[ $ATT -le 2 ]]; then
      ATTEMPTS[$ID]=$ATT
      LINE=$(grep ""$ID"" "$SPEC" | head -1)
      [[ -n "$LINE" ]] && NEXT+=("$LINE")
      echo "fanout: $ID branch_busy — redispatch attempt $ATT/2" >&2
    fi
  done
  [[ ${#NEXT[@]} -eq 0 ]] && break
  PIDS=(); IDS=(); LOGS=()
  QUEUE_LINES=("${NEXT[@]}")
  run_queue
done

# Drain remaining workers
for pid in "${PIDS[@]}"; do
  wait "$pid" 2>/dev/null || true
done

# Render table header
printf '| worker | status | files_changed | blockers | next_action |\n'
printf '|--------|--------|---------------|----------|-------------|\n'

# Extract + summarize each
for i in "${!IDS[@]}"; do
  ID="${IDS[$i]}"
  LOG="${LOGS[$i]}"

  # Tier A: deterministic grep
  BLOCK="$(bash "$EXTRACT" "$LOG" 2>/dev/null || true)"
  if [ -z "$BLOCK" ] && [ -x "$HAIKU" ]; then
    # Tier B: locked Haiku salvage
    BLOCK="$(bash "$HAIKU" "$LOG" 2>/dev/null || true)"
  fi

  if [ -z "$BLOCK" ]; then
    printf '| %s | ⚠️ missing | - | extractor-failed | inspect %s |\n' "$ID" "$LOG"
    continue
  fi

  STATUS="$(echo "$BLOCK" | awk -F': ' '/^status:/{print $2; exit}')"
  FILES_COUNT="$(echo "$BLOCK" | awk '/^files_changed:/{flag=1; next} /^[a-z_]+:/{flag=0} flag && /^  - /{c++} END{print c+0}')"
  BLOCKERS="$(echo "$BLOCK" | awk '/^blockers:/{flag=1; next} /^[a-z_]+:/{flag=0} flag && /^  - /{sub(/^  - /, ""); print; exit}')"
  NEXT="$(echo "$BLOCK" | awk -F': ' '/^next_action:/{$1=""; sub(/^ /,""); print; exit}')"

  printf '| %s | %s | %s | %s | %s |\n' "$ID" "${STATUS:-unknown}" "${FILES_COUNT:-0}" "${BLOCKERS:-none}" "${NEXT:-none}"
done

# Footer: paths to logs for deep dive
printf '\n_Logs:_ '
for LOG in "${LOGS[@]}"; do printf '`%s` ' "$LOG"; done
printf '\n'
