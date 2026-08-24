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
WORKER_MUTATION=${SVC_WORKER_MUTATION:-""}
if [[ -z "$WORKER_MUTATION" ]]; then
  case "$SKILL" in execute-changeset|dispatch-waves) WORKER_MUTATION="true" ;; *) WORKER_MUTATION="false" ;; esac
fi
if [[ "$WORKER_MUTATION" == "true" && -z "$DELEGATION_ID" ]]; then
  echo "REFUSED: mutating worker launch requires a persisted SVC_DELEGATION_ID and the full delegation preflight; execute under the controller if unavailable" >&2
  exit 2
fi

if [[ -n "$DELEGATION_ID" ]]; then
  : "${SVC_WORKER_WI:?mutating delegated worker requires SVC_WORKER_WI for lifecycle completion}"
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
  TRANSPORT_RECEIPT="${SVC_DELEGATION_TRANSPORT_RECEIPT:-$SVC_DELEGATION_STATE_ROOT/transport-receipts/$DELEGATION_ID.json}"
  mkdir -p "$(dirname "$TRANSPORT_RECEIPT")" "$(dirname "$SVC_DELEGATION_COMPLETION_OUT")"
  node "$FRAMEWORK_ROOT/scripts/resolve-child-transport.mjs" \
    --state-root "$SVC_DELEGATION_STATE_ROOT" \
    --delegation "$DELEGATION_ID" \
    --child-principal "$SVC_DELEGATION_CHILD_PRINCIPAL" \
    --token "$SVC_DELEGATION_TOKEN" \
    --worktree "$(pwd -P)" \
    --completion-receipt "$SVC_DELEGATION_COMPLETION_OUT" \
    --host-manifest "$FRAMEWORK_ROOT/provision/hosts/$SVC_HOST.json" \
    --receipt "$TRANSPORT_RECEIPT" >/dev/null || exit 2
  node "$FRAMEWORK_ROOT/scripts/dispatch-execution-task.mjs" accept \
    --state-root "$SVC_DELEGATION_STATE_ROOT" \
    --delegation "$DELEGATION_ID" \
    --child-principal "$SVC_DELEGATION_CHILD_PRINCIPAL" \
    --token "$SVC_DELEGATION_TOKEN" \
    --graph "$SVC_EXECUTION_GRAPH" >/dev/null || exit 2
  export SVC_DELEGATION_SKILL_RECEIPT="$SVC_DELEGATION_STATE_ROOT/delegation-receipts/$DELEGATION_ID.json"
  unset SVC_DELEGATION_TOKEN
fi

# ── WI-562 V-2: non-blocking branch claim ──────────────────────────────────
# Advisory claim on this branch so parallel workers fast-fail instead of
# blocking on locks. Hashed identity (slash-safe), pid+start_token ownership,
# positive-death-proof steal of stale claims, EXIT-trap release. branch_busy is
# a retryable status (fanout requeues up to 2x; dispatch-waves documents the
# cross-run policy).
if [[ -n "$SVC_WORKER_BRANCH_CLAIM" ]]; then
  CLAIM_DIR="$(git rev-parse --git-common-dir 2>/dev/null)/svc-wave-branch-claims"
  CLAIM_ID="$(printf '%s' "$SVC_WORKER_BRANCH_CLAIM" | sha256sum | cut -d' ' -f1)"
  CLAIM_PATH="$CLAIM_DIR/$CLAIM_ID"
  mkdir -p "$CLAIM_DIR"
  START_TOKEN=""
  if [[ -r "/proc/$$/stat" ]]; then
    START_TOKEN="$(sed 's/.*) //' "/proc/$$/stat" | awk '{print $20}')"
  fi
  claim_try_acquire() {
    if mkdir "$CLAIM_PATH" 2>/dev/null; then
      printf '%s\n%s\n%s\n%s\n' "$$" "$(hostname)" "$START_TOKEN" "$(date -u +%FT%TZ)" >"$CLAIM_PATH/owner"
      return 0
    fi
    return 1
  }
  claim_owner_alive() {
    local owner_file="$CLAIM_PATH/owner"
    [[ -r "$owner_file" ]] || return 2   # malformed claim: treat as dead
    local o_pid o_host o_tok
    read -r o_pid < <(sed -n 1p "$owner_file")
    read -r o_host < <(sed -n 2p "$owner_file")
    read -r o_tok  < <(sed -n 3p "$owner_file")
    [[ "$o_host" == "$(hostname)" ]] || return 2
    kill -0 "$o_pid" 2>/dev/null || return 1
    # PID reuse guard: compare start tokens when both sides have one.
    if [[ -n "$o_tok" && -r "/proc/$o_pid/stat" ]]; then
      local cur; cur="$(sed 's/.*) //' "/proc/$o_pid/stat" | awk '{print $20}')"
      [[ "$cur" == "$o_tok" ]] || return 1
    fi
    return 0
  }
  branch_busy_exit() {
    echo "=== SVC_WORKER_SUMMARY ==="
    echo "status: branch_busy"
    echo "worker_summary: branch $SVC_WORKER_BRANCH_CLAIM is claimed by another worker"
    echo "files_changed:"
    echo "commits: none"
    echo "notable_decisions:"
    echo "blockers:"
    echo "  - branch_busy (retryable; orchestrator re-dispatches max 2 attempts)"
    echo "next_action: redispatch this WI after the claim holder finishes"
    echo "=== END_SVC_WORKER_SUMMARY ==="
    exit 0
  }
  if ! claim_try_acquire; then
    if claim_owner_alive; then
      branch_busy_exit   # live owner: immediate structured skip — no waiting
    else
      rm -rf "$CLAIM_PATH"   # provably-dead owner: steal stale claim
      claim_try_acquire || branch_busy_exit
    fi
  fi
  claim_release() { rm -rf "$CLAIM_PATH" 2>/dev/null || true; }
  trap claim_release EXIT INT TERM
fi

# ── WI-562 IP-H1: capture the PRE-DISPATCH base SHA ──
# Ground truth for the worker's diff window must be the tree state BEFORE any
# worker work, so a worker-created commit is head-vs-base — never both.
SVC_WORKER_BASE_SHA="$(git rev-parse HEAD 2>/dev/null || true)"

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
  GIT_RUNTIME_ROOT="$(git rev-parse --absolute-git-dir)"
  CONTAINMENT_ARGV=(node "$FRAMEWORK_ROOT/scripts/svc-contained-exec.mjs" run --root "$(pwd -P)" --policy "$TRANSPORT_RECEIPT" --runtime-root "$GIT_RUNTIME_ROOT" --)
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

  # WI-562 IP-H1: workers COMMIT their own work before reporting; the parent
  # recomputes ground truth from git and never trusts these self-reported
  # fields. base_sha = PRE-dispatch capture (SVC_WORKER_BASE_SHA), so a
  # worker-created commit forms a real diff window instead of an empty one.
  local base_sha="${SVC_WORKER_BASE_SHA:-}" head_sha diff_digest committed="false"
  if [ -z "$base_sha" ]; then base_sha="$(git rev-parse HEAD 2>/dev/null || true)"; fi
  if [ "$status" = "success" ] && [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
    git add -A >/dev/null 2>&1 || true
    git commit -m "worker($WORKER_WI): dispatch result commit (auto)" >/dev/null 2>&1 || true
  fi
  head_sha="$(git rev-parse HEAD 2>/dev/null || true)"
  if [ -n "$base_sha" ] && [ -n "$head_sha" ] && [ "$base_sha" != "$head_sha" ] && [ -z "$(git status --porcelain 2>/dev/null || true)" ]; then
    committed="true"
  fi
  if [ -n "$base_sha" ] && [ -n "$head_sha" ] && [ "$base_sha" != "$head_sha" ]; then
    diff_digest="$(git diff --binary "$base_sha..$head_sha" 2>/dev/null | sha256sum | cut -d' ' -f1)"
    diff_digest="sha256:$diff_digest"
  else
    diff_digest="sha256:$(printf '' | sha256sum | cut -d' ' -f1)"
  fi

  local changed
  changed="$(git diff --name-only "${base_sha:-HEAD}" "${head_sha:-HEAD}" 2>/dev/null || true)"
  if [ -z "$changed" ] && [ -n "$(git status --porcelain 2>/dev/null || true)" ]; then
    changed="$(git status --porcelain 2>/dev/null | awk '{print $2}')"
  fi

  BASE_SHA="$base_sha" HEAD_SHA="$head_sha" DIFF_DIGEST="$diff_digest" COMMITTED="$committed" WORKTREE_REALPATH="$(pwd -P)" \
  SVC_WORKER_DECLARED_COMMANDS="${SVC_WORKER_DECLARED_COMMANDS:-}" \
  CHANGED_FILES="$changed" node - "$DISPATCH_DIR/$WORKER_WI.result.json" "$DISPATCH_DIR/$WORKER_WI.edits.json" "$WORKER_WI" "$status" "$exit_code" "$log_path" "$DELEGATION_ID" <<'NODE_RESULT'
const fs = require("fs");
const [resultFile, editsFile, wi, status, exitCode, logPath, delegationId] = process.argv.slice(2);
const files = (process.env.CHANGED_FILES || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
// WI-562 IP-H1: no worker-authored PASS verdicts and no parent_graph_mutation
// fabrication. Evidence rows name the PLAN-DECLARED validation commands so the
// validator can REPLAY them; mutation flags are set by the orchestrator AFTER
// validate-parallel-merge-back passes.
const declaredCommands = (process.env.SVC_WORKER_DECLARED_COMMANDS || "")
  .split("\u001f").map((s) => s.trim()).filter(Boolean);
const result = {
  wi,
  status,
  worker_summary: status === "success" ? "Worker completed and emitted dispatch result." : `Worker ended with ${status}.`,
  worktree: process.env.WORKTREE_REALPATH || null,
  base_sha: process.env.BASE_SHA || null,
  head_sha: process.env.HEAD_SHA || null,
  diff_digest: process.env.DIFF_DIGEST || null,
  committed: process.env.COMMITTED === "true",
  changed_files: files,
  validation_evidence: [
    ...declaredCommands.map((command) => ({ command })),
  ],
  clean_worktree: undefined,
  parent_graph_mutation: { updated: false, forbidden: true, path: `.svc/lane-tasks-${wi}.json` },
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
