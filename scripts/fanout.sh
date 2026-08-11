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

SPEC="${1:-/dev/stdin}"
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

# Launch workers
while IFS= read -r line; do
  [ -z "$line" ] && continue
  ID="$(echo "$line" | jq -r '.id')"
  HARNESS="$(echo "$line" | jq -r '.harness // "claude"')"
  SKILL="$(echo "$line" | jq -r '.skill // "execute-changeset"')"
  PAYLOAD_FILE="$(echo "$line" | jq -r '.payload_file')"

  [ -r "$PAYLOAD_FILE" ] || { echo "payload unreadable for $ID: $PAYLOAD_FILE" >&2; exit 2; }

  LOG="/tmp/svc-fanout-$RUN_ID-$ID.log"
  LOGS+=("$LOG")
  IDS+=("$ID")

  PAYLOAD="$(cat "$PAYLOAD_FILE")"
  SVC_HARNESS="$HARNESS" SVC_WORKER_SKILL="$SKILL" \
    bash "$DISPATCH" "$PAYLOAD" > "$LOG" 2>&1 &
  PIDS+=("$!")
done < "$SPEC"

# Wait for all
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
