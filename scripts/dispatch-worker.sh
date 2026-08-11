#!/bin/bash
# DEPRECATED on the Claude host for READ-ONLY analysis fan-outs (WI-373):
# use the native Workflow tool per references/workflow-fanout-protocol.md
# (pipeline/parallel + StructuredOutput + budget). Retained for non-Claude
# hosts until parity; mutating multi-WI work stays on dispatch-waves.
# scripts/dispatch-worker.sh
# A completely isolated, zero-history, headless execution transport.
# Supports triple harnesses:
#   - claude    : Claude Code CLI (default; applies its own autocompact, can thrash at ~150K)
#   - openclaw  : OpenClaw CLI (alternative Claude-compat, high-context-friendly)
#   - opencode  : OpenCode CLI with MiMo as a configured provider via ~/.config/opencode/opencode.json
#                 (recommended for large multi-file ports — OpenCode does not apply Claude Code's
#                 client-side compaction, so MiMo's 1M-token window is fully usable)
#
# NOTE: When SVC_MODEL_PROFILE=kimi-native or claude-native, this script is NOT used.
#       The orchestrator handles execution inline. Dispatch is only needed for svc-default
#       and kimi-orchestrator-mixed profiles where EXEC/SENSE delegate to MiMo.

# Configuration: Harness, Skill, and Model
HARNESS=${SVC_HARNESS:-"claude"}
SKILL=${SVC_WORKER_SKILL:-"execute-changeset"}
WORKER_WI=${SVC_WORKER_WI:-""}
DISPATCH_DIR=${SVC_DISPATCH_DIR:-".svc/dispatch"}
WORKER_TIMEOUT_SEC=${SVC_WORKER_TIMEOUT_SEC:-"0"}
DELEGATION_ID=${SVC_DELEGATION_ID:-""}

if [[ -n "$DELEGATION_ID" ]]; then
  : "${SVC_DELEGATION_STATE_ROOT:?mutating delegated worker requires SVC_DELEGATION_STATE_ROOT}"
  : "${SVC_DELEGATION_CHILD_PRINCIPAL:?mutating delegated worker requires SVC_DELEGATION_CHILD_PRINCIPAL}"
  : "${SVC_DELEGATION_TOKEN:?mutating delegated worker requires one-time SVC_DELEGATION_TOKEN}"
  : "${SVC_EXECUTION_GRAPH:?mutating delegated worker requires SVC_EXECUTION_GRAPH}"
  : "${SVC_HOST:?mutating delegated worker requires SVC_HOST}"
  : "${SVC_DELEGATION_VALIDATION:?mutating delegated worker requires SVC_DELEGATION_VALIDATION}"
  : "${SVC_DELEGATION_COMPLETION_OUT:?mutating delegated worker requires SVC_DELEGATION_COMPLETION_OUT}"
  FRAMEWORK_SCRIPT="$(realpath "${BASH_SOURCE[0]}")"
  FRAMEWORK_ROOT="$(cd "$(dirname "$FRAMEWORK_SCRIPT")/.." && pwd)"
  [[ -f "$FRAMEWORK_ROOT/scripts/validate-host-authority-capabilities.mjs" ]] || {
    echo "mutating delegated execution requires an installed svc framework script bundle at $FRAMEWORK_ROOT" >&2
    exit 2
  }
  node "$FRAMEWORK_ROOT/scripts/validate-host-authority-capabilities.mjs" --root "$FRAMEWORK_ROOT" >/dev/null || exit 2
  node -e '
const fs = require("fs"); const path = require("path");
const [root, host] = process.argv.slice(1);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "provision/hosts", `${host}.json`), "utf8"));
if (!manifest.authority_capabilities?.mutating_child_execution) throw new Error(`mutating child execution is unsupported on ${host}`);
' "$FRAMEWORK_ROOT" "$SVC_HOST" || exit 2
  node "$FRAMEWORK_ROOT/scripts/svc-contained-exec.mjs" probe >/dev/null || exit 2
  node "$FRAMEWORK_ROOT/scripts/dispatch-execution-task.mjs" accept \
    --state-root "$SVC_DELEGATION_STATE_ROOT" \
    --delegation "$DELEGATION_ID" \
    --child-principal "$SVC_DELEGATION_CHILD_PRINCIPAL" \
    --token "$SVC_DELEGATION_TOKEN" \
    --graph "$SVC_EXECUTION_GRAPH" >/dev/null || exit 2
  export SVC_DELEGATION_SKILL_RECEIPT="$SVC_DELEGATION_STATE_ROOT/delegation-receipts/$DELEGATION_ID.json"
  unset SVC_DELEGATION_TOKEN
fi

# Cognitive Routing: Select model based on skill if not explicitly overridden
if [[ -z "$SVC_WORKER_MODEL" ]]; then
  case "$SKILL" in
    "track-visuals")
      # [SENSE-OMNI] Visual/multimodal baseline and diff tasks
      MODEL="mimo-v2-omni"
      ;;
    *)
      # [EXEC-MIMO] Default mechanical execution
      MODEL="mimo-v2-pro"
      ;;
  esac
else
  MODEL="$SVC_WORKER_MODEL"
fi

# Environment Setup
export API_TIMEOUT_MS="3600000"
export SVC_SUBAGENT="1" # Bypasses host UI task mirroring

# Harness-specific Logic
if [[ "$HARNESS" == "claude" ]]; then
    # --- Claude Code Harness ---
    if [[ "$MODEL" == *"mimo"* ]]; then
      export ANTHROPIC_BASE_URL="${ANTHROPIC_BASE_URL:-"https://token-plan-ams.xiaomimimo.com/anthropic"}"
      export ANTHROPIC_AUTH_TOKEN="${MIMO_API_KEY}"
      export ANTHROPIC_API_KEY="${MIMO_API_KEY}"
      
      # Hijack default model names to prevent CLI fallback errors
      export ANTHROPIC_MODEL="$MODEL"
      export ANTHROPIC_DEFAULT_SONNET_MODEL="$MODEL"
      export ANTHROPIC_DEFAULT_OPUS_MODEL="$MODEL"
      export ANTHROPIC_DEFAULT_HAIKU_MODEL="$MODEL"

      # Expert Mode: Disable CLI-side safety limits for 1M context
      export CLAUDE_AUTOCOMPACT_ENABLED="false"
      export CLAUDE_CODE_MAX_OUTPUT_TOKENS="65536"
    elif [[ -n "$MODEL" ]]; then
      # WI-470: native Claude model (e.g. claude-sonnet-5) — pin it so `claude -p`
      # honors the routed EXEC model instead of falling back to the session default.
      export ANTHROPIC_MODEL="$MODEL"
    fi
    EXEC_ARGV=(claude -p)

elif [[ "$HARNESS" == "openclaw" ]]; then
    # --- OpenClaw Harness (DEPRECATED — not installed by default) ---
    if ! command -v openclaw &>/dev/null; then
      echo "ERROR: openclaw harness requested but 'openclaw' binary not found on PATH." >&2
      echo "Install openclaw or switch to HARNESS=claude or HARNESS=opencode." >&2
      exit 1
    fi
    PROVIDER="xiaomi-coding"
    FULL_MODEL="$PROVIDER/$MODEL"
    EXEC_ARGV=(openclaw agent --non-interactive --model "$FULL_MODEL" --message)

elif [[ "$HARNESS" == "opencode" ]]; then
    # --- OpenCode Harness ---
    # OpenCode reads ~/.config/opencode/opencode.json for the `mimo` provider definition
    # (baseURL + apiKey + models). No ANTHROPIC_* env vars needed — OpenCode is model-agnostic
    # and does NOT apply Claude Code's autocompact, so MiMo's 1M context is fully usable.
    #
    # Prerequisites (one-time):
    #   1. opencode binary on PATH (~/.opencode/bin or npm -g opencode-ai)
    #   2. ~/.config/opencode/opencode.json with provider.mimo block
    #      (see svc reference: references/opencode-mimo-config.json)
    PROVIDER="mimo"
    FULL_MODEL="$PROVIDER/$MODEL"

    # OpenCode flags:
    #   --model <provider/model>        select configured provider + model
    #   --dangerously-skip-permissions  auto-approve file writes / bash (subprocess needs no human)
    #   --pure                          skip plugin loading (trimmer context)
    # Prompt goes as positional arg at the end.
    EXEC_ARGV=(opencode run --model "$FULL_MODEL" --dangerously-skip-permissions --pure)
else
    echo "ERROR: unsupported harness: $HARNESS" >&2
    exit 2
fi

CONTAINMENT_ARGV=()
if [[ -n "$DELEGATION_ID" ]]; then
  CONTAINMENT_ARGV=(node "$FRAMEWORK_ROOT/scripts/svc-contained-exec.mjs" run --root "$(pwd -P)" --)
fi

echo "============================================================"
echo "🚀 Dispatching Isolated Worker"
echo "🛠️  Harness: $HARNESS"
echo "🤖 Model:   $MODEL"
echo "🎯 Skill:   $SKILL"
echo "🧠 Context: FRESH SESSION (0 tokens copied from parent)"
echo "============================================================"

write_worker_progress() {
  [ -n "$WORKER_WI" ] || return 0
  mkdir -p "$DISPATCH_DIR"
  node -e '
const fs = require("fs");
const [file, wi, event, status] = process.argv.slice(1);
const entry = { ts: new Date().toISOString(), wi, event, status };
fs.appendFileSync(file, JSON.stringify(entry) + "\n");
' "$DISPATCH_DIR/wave-progress.jsonl" "$WORKER_WI" "$1" "$2"
}

write_worker_result() {
  [ -n "$WORKER_WI" ] || return 0
  local status="$1"
  local exit_code="$2"
  local log_path="$3"
  mkdir -p "$DISPATCH_DIR"
  local changed
  changed="$(git diff --name-only HEAD 2>/dev/null || true)"
  if [ -z "$changed" ]; then
    changed="$(git diff --cached --name-only 2>/dev/null || true)"
  fi
  local clean="false"
  if [ -z "$(git status --porcelain 2>/dev/null || true)" ]; then
    clean="true"
  fi
  CHANGED_FILES="$changed" node - "$DISPATCH_DIR/$WORKER_WI.result.json" "$DISPATCH_DIR/$WORKER_WI.edits.json" "$WORKER_WI" "$status" "$exit_code" "$log_path" "$clean" "$DELEGATION_ID" <<'NODE_RESULT'
const fs = require("fs");
const [resultFile, editsFile, wi, status, exitCode, logPath, cleanRaw, delegationId] = process.argv.slice(2);
const files = (process.env.CHANGED_FILES || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
const clean = cleanRaw === "true";
const result = {
  wi,
  status,
  worker_summary: status === "success" ? "Worker completed and emitted dispatch result." : `Worker ended with ${status}.`,
  changed_files: files,
  validation_evidence: [
    { command: "dispatch-worker exit", result: status === "success" ? "PASS" : "FAIL", exit_code: Number(exitCode), log_path: logPath }
  ],
  clean_worktree: clean,
  parent_graph_mutation: delegationId ? { updated: false, forbidden: true } : { updated: true, path: `.svc/lane-tasks-${wi}.json` },
  delegation_id: delegationId || null,
  quality: {
    per_worker_quality: process.env.SVC_SKIP_WORKER_QUALITY === "1" ? "skipped" : "required",
    orchestrator_rollup_required: process.env.SVC_SKIP_WORKER_QUALITY === "1"
  }
};
fs.writeFileSync(resultFile, JSON.stringify(result, null, 2) + "\n");
fs.writeFileSync(editsFile, JSON.stringify({ wi, files, source_result: resultFile }, null, 2) + "\n");
NODE_RESULT
}

# WI-393 AC(b): prepend the canonical output-discipline preamble so every
# headless worker biases toward file-first output + bounded retries (kills the
# 500-output-token-maximum death spiral). Read from the single source of truth;
# fall back to a one-line reminder if the fragment is missing so dispatch never
# breaks on a stale checkout.
PREAMBLE_FILE="$(git rev-parse --show-toplevel 2>/dev/null)/references/output-discipline-preamble.md"
if [ -r "$PREAMBLE_FILE" ]; then
  OUTPUT_DISCIPLINE="$(cat "$PREAMBLE_FILE")"
else
  OUTPUT_DISCIPLINE="## Output discipline (headless worker)
Write long output (>~800 lines / ~10K tokens) to disk and summarize inline. Never re-send a payload rejected for output-length/context/rate-limit reasons; shrink it first. Max 2 retries, then emit a partial summary and stop."
fi

# Inject the strict protocol payload before the user's prompt
PROMPT="You are a headless, isolated worker running the '$SKILL' skill.

$OUTPUT_DISCIPLINE

CRITICAL FIRST STEP: locate and read the SKILL.md for '$SKILL'. Search in this order:
  1. ~/.kimi/skills/$SKILL/SKILL.md  (Kimi CLI skills directory)
  2. ~/.config/opencode/skills/$SKILL/SKILL.md  (OpenCode CLI skills directory)
  3. ~/.agents/skills/$SKILL/SKILL.md  (legacy agents directory)
  4. ./skills/$SKILL/SKILL.md  (repo-local packaged skill, if running from svc repo root)
  5. $(git rev-parse --show-toplevel)/skills/$SKILL/SKILL.md  (repo-local packaged skill via git root)
The first found file is the source of truth for inputs, outputs, and procedure. Do not improvise.

CRITICAL FINAL STEP: after you complete the task, your LAST output MUST be a concise machine-readable summary block in exactly this format (no prose after):

=== SVC_WORKER_SUMMARY ===
status: success | fail | partial
files_changed:
  - <path>
  - <path>
commits: <SHAs or 'none'>
notable_decisions:
  - <one-line decision>
blockers:
  - <one-line blocker or 'none'>
next_action: <one-line recommendation for the orchestrator>
=== END_SVC_WORKER_SUMMARY ===

The orchestrator greps for this block to decide the next task in the graph. If you cannot complete the task, still emit the block with status: fail and a clear blocker line — silent failure will dead-lock the orchestrator.

Task Payload:
$1"

# Execute (all three harnesses accept the prompt as a trailing positional arg)
if [ -n "$WORKER_WI" ]; then
  mkdir -p "$DISPATCH_DIR"
  RUN_LOG="$DISPATCH_DIR/$WORKER_WI.log"
  write_worker_progress "started" "running"
  set +e
  if [ "$WORKER_TIMEOUT_SEC" != "0" ]; then
    timeout "$WORKER_TIMEOUT_SEC" "${CONTAINMENT_ARGV[@]}" "${EXEC_ARGV[@]}" "$PROMPT" 2>&1 | tee "$RUN_LOG"
  else
    "${CONTAINMENT_ARGV[@]}" "${EXEC_ARGV[@]}" "$PROMPT" 2>&1 | tee "$RUN_LOG"
  fi
  EXIT_CODE=${PIPESTATUS[0]}
  set -e
  if [ "$EXIT_CODE" -eq 124 ]; then
    RESULT_STATUS="failed:timeout"
    if [ -n "$DELEGATION_ID" ]; then node "$FRAMEWORK_ROOT/scripts/dispatch-execution-task.mjs" expire --state-root "$SVC_DELEGATION_STATE_ROOT" --delegation "$DELEGATION_ID" --graph "$SVC_EXECUTION_GRAPH" --reason timeout >/dev/null || true; fi
  elif [ "$EXIT_CODE" -ne 0 ]; then
    RESULT_STATUS="failed:error"
    if [ -n "$DELEGATION_ID" ]; then node "$FRAMEWORK_ROOT/scripts/dispatch-execution-task.mjs" fail --state-root "$SVC_DELEGATION_STATE_ROOT" --delegation "$DELEGATION_ID" --graph "$SVC_EXECUTION_GRAPH" --reason "worker exit $EXIT_CODE" >/dev/null || true; fi
  elif [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
    RESULT_STATUS="failed:dirty-tree"
    if [ -n "$DELEGATION_ID" ]; then node "$FRAMEWORK_ROOT/scripts/dispatch-execution-task.mjs" fail --state-root "$SVC_DELEGATION_STATE_ROOT" --delegation "$DELEGATION_ID" --graph "$SVC_EXECUTION_GRAPH" --reason dirty-worktree >/dev/null || true; fi
  else
    RESULT_STATUS="success"
    if [ -n "$DELEGATION_ID" ] && ! node "$FRAMEWORK_ROOT/scripts/dispatch-execution-task.mjs" complete \
      --state-root "$SVC_DELEGATION_STATE_ROOT" --delegation "$DELEGATION_ID" \
      --child-principal "$SVC_DELEGATION_CHILD_PRINCIPAL" --graph "$SVC_EXECUTION_GRAPH" \
      --validation "$SVC_DELEGATION_VALIDATION" --out "$SVC_DELEGATION_COMPLETION_OUT" >/dev/null; then
      RESULT_STATUS="failed:completion"
      EXIT_CODE=2
    fi
  fi
  write_worker_result "$RESULT_STATUS" "$EXIT_CODE" "$RUN_LOG"
  write_worker_progress "finished" "$RESULT_STATUS"
  exit "$EXIT_CODE"
fi

"${CONTAINMENT_ARGV[@]}" "${EXEC_ARGV[@]}" "$PROMPT"
