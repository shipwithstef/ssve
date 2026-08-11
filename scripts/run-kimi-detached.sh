#!/usr/bin/env bash
# run-kimi-detached.sh — generic detached Kimi runner for svc skills.
#
# Launches a Kimi job in a fully-detached process group, returns JSON
# describing the job in <2s, then exits. The Kimi process survives past
# this script's exit so callers (Claude Code Bash, hooks) are not capped
# by their host's foreground/background timeout.
#
# Usage:
#   run-kimi-detached.sh \
#     --skill <skill-id> \
#     --prompt-file <path> \
#     [--max-seconds N]   # default from references/model-routing.md cap table
#     [--label <text>]    # human-readable suffix in log filename
#
# Stdout: single JSON object
#   { job_id, log_path, pid_path, max_seconds, started_at }
#
# Caps:
#   - Per-skill default from references/model-routing.md (KIMI_DETACHED_CAPS block)
#   - Caller --max-seconds overrides the default
#   - KIMI_DETACHED_HARD_CAP env (default 7200) truncates whatever the caller asked
#
# Registry:
#   /tmp/svc-kimi-jobs/index.jsonl  — append-only line per launch
#   /tmp/svc-kimi-jobs/<job_id>.log
#   /tmp/svc-kimi-jobs/<job_id>.pid
#   /tmp/svc-kimi-jobs/<job_id>.status  — written when job finishes (state, exit_code, ended_at)
#
set -euo pipefail

usage() {
  sed -n '2,30p' "$0" >&2
  exit 2
}

SKILL=""
PROMPT_FILE=""
MAX_SECONDS=""
LABEL=""

while [ $# -gt 0 ]; do
  case "$1" in
    --skill)        SKILL="$2"; shift 2 ;;
    --prompt-file)  PROMPT_FILE="$2"; shift 2 ;;
    --max-seconds)  MAX_SECONDS="$2"; shift 2 ;;
    --label)        LABEL="$2"; shift 2 ;;
    --help|-h)      usage ;;
    *) echo "unknown arg: $1" >&2; usage ;;
  esac
done

[ -n "$SKILL" ]       || { echo "missing --skill" >&2; exit 2; }
[ -n "$PROMPT_FILE" ] || { echo "missing --prompt-file" >&2; exit 2; }
[ -r "$PROMPT_FILE" ] || { echo "prompt-file not readable: $PROMPT_FILE" >&2; exit 2; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ROUTING_DOC="$REPO_ROOT/references/model-routing.md"

# Resolve per-skill cap from model-routing.md (KIMI_DETACHED_CAPS block).
# Block format: lines like "skill_id=NNNN" between BEGIN/END markers.
read_cap() {
  local skill="$1"
  [ -r "$ROUTING_DOC" ] || { echo 1800; return; }
  awk -v skill="$skill" '
    /KIMI_DETACHED_CAPS_BEGIN/ { in_block=1; next }
    /KIMI_DETACHED_CAPS_END/   { in_block=0 }
    in_block && $0 ~ "^"skill"=" {
      sub(/^[^=]+=/, "", $0); print $0; found=1; exit
    }
    END { if (!found) print "" }
  ' "$ROUTING_DOC"
}

DEFAULT_CAP="$(read_cap default)"
[ -n "$DEFAULT_CAP" ] || DEFAULT_CAP=1800

if [ -z "$MAX_SECONDS" ]; then
  CAP="$(read_cap "$SKILL")"
  [ -n "$CAP" ] || CAP="$DEFAULT_CAP"
  MAX_SECONDS="$CAP"
fi

HARD_CAP="${KIMI_DETACHED_HARD_CAP:-7200}"
case "$MAX_SECONDS" in
  ''|*[!0-9]*) echo "max-seconds must be integer" >&2; exit 2 ;;
esac
case "$HARD_CAP" in
  ''|*[!0-9]*) echo "KIMI_DETACHED_HARD_CAP must be integer" >&2; exit 2 ;;
esac
[ "$MAX_SECONDS" -le "$HARD_CAP" ] || MAX_SECONDS="$HARD_CAP"

JOB_ROOT="/tmp/svc-kimi-jobs"
mkdir -p "$JOB_ROOT"

TS="$(date +%s)"
RAND="$(printf '%04x' "$((RANDOM % 65536))")"
JOB_ID="kimi-${SKILL}-${TS}-${RAND}"
[ -n "$LABEL" ] && JOB_ID="${JOB_ID}-${LABEL//[^A-Za-z0-9_-]/_}"

LOG_PATH="$JOB_ROOT/${JOB_ID}.log"
PID_PATH="$JOB_ROOT/${JOB_ID}.pid"
STATUS_PATH="$JOB_ROOT/${JOB_ID}.status"
INDEX_PATH="$JOB_ROOT/index.jsonl"

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Detached worker. Wraps `kimi` invocation with a timeout and writes a
# .status file when the run completes (any reason).
WORKER=$(cat <<'EOS'
#!/usr/bin/env bash
set -u
JOB_ID="__JOB_ID__"
LOG_PATH="__LOG_PATH__"
STATUS_PATH="__STATUS_PATH__"
PROMPT_FILE="__PROMPT_FILE__"
MAX_SECONDS="__MAX_SECONDS__"
SKILL="__SKILL__"

WORKER_STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Stream prompt into kimi via stdin; cap with timeout.
# `timeout --foreground` ensures signals propagate even when in own session.
set +e
timeout --foreground "${MAX_SECONDS}s" kimi < "$PROMPT_FILE" >> "$LOG_PATH" 2>&1
EXIT_CODE=$?
set -e

ENDED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
case "$EXIT_CODE" in
  0)        STATE="done" ;;
  124)      STATE="timeout" ;;
  130|143)  STATE="killed" ;;
  *)        STATE="done" ;;  # non-zero exit still completed; caller inspects exit_code
esac

printf '{"job_id":"%s","skill":"%s","state":"%s","exit_code":%d,"started_at":"%s","ended_at":"%s","max_seconds":%s}\n' \
  "$JOB_ID" "$SKILL" "$STATE" "$EXIT_CODE" "$WORKER_STARTED_AT" "$ENDED_AT" "$MAX_SECONDS" \
  > "$STATUS_PATH"
EOS
)

WORKER="${WORKER//__JOB_ID__/$JOB_ID}"
WORKER="${WORKER//__LOG_PATH__/$LOG_PATH}"
WORKER="${WORKER//__STATUS_PATH__/$STATUS_PATH}"
WORKER="${WORKER//__PROMPT_FILE__/$PROMPT_FILE}"
WORKER="${WORKER//__MAX_SECONDS__/$MAX_SECONDS}"
WORKER="${WORKER//__SKILL__/$SKILL}"

WORKER_SCRIPT="$JOB_ROOT/${JOB_ID}.worker.sh"
printf '%s\n' "$WORKER" > "$WORKER_SCRIPT"
chmod +x "$WORKER_SCRIPT"

# Detach: setsid + nohup + redirect, fully disowned from this shell.
setsid nohup bash "$WORKER_SCRIPT" </dev/null >/dev/null 2>&1 &
WORKER_PID=$!
disown "$WORKER_PID" 2>/dev/null || true

echo "$WORKER_PID" > "$PID_PATH"

# Append registry line.
printf '{"job_id":"%s","skill":"%s","pid":%d,"log_path":"%s","pid_path":"%s","status_path":"%s","max_seconds":%s,"started_at":"%s","label":"%s"}\n' \
  "$JOB_ID" "$SKILL" "$WORKER_PID" "$LOG_PATH" "$PID_PATH" "$STATUS_PATH" "$MAX_SECONDS" "$STARTED_AT" "$LABEL" \
  >> "$INDEX_PATH"

# Stdout response (single JSON line).
printf '{"job_id":"%s","log_path":"%s","pid_path":"%s","max_seconds":%s,"started_at":"%s"}\n' \
  "$JOB_ID" "$LOG_PATH" "$PID_PATH" "$MAX_SECONDS" "$STARTED_AT"
