#!/usr/bin/env bash
#
# svc Task Completion Guard — Stop hook for Claude Code and Kimi CLI (via adapter)
#
# Blocks stop when active .svc/lane-tasks-<WI>.json task graphs still have actionable work.
# Actionable means tasks in `pending` or `in_progress`; `blocked` tasks do not
# deadlock the session.
#
# Install: add to .claude/settings.json under hooks.Stop
# Config:
#   SVC_COMPLETION_MAX (default 3): REAL nag cap (WI-399 A6) — after MAX
#   consecutive pressure blocks for the same session, downgrades to a LOUD
#   advisory (stderr + exit 0). Previously display-only (printed 5/3 and
#   kept blocking). Malformed-state statuses are NOT capped. Supersedes the
#   WI-183 never-age-out posture; first MAX blocks stand unchanged.
#   SVC_COMPLETION_FAIL_OPEN=true: allow stop when hook payload or a lane-task graph is malformed
#
set -euo pipefail

# WI-379: single top-level trap cleans up ALL tmpfiles on ANY exit path
# (early exit 0 branches, set -e aborts, signals). Variables expand at
# trap-fire time (single quotes) so they tolerate late assignment.
# _GUARD_TMP and _e2e_tmp carry BOUNDED /tmp paths, never payload content —
# intentionally exempt from the payload-not-argv heuristic (paths, not payloads).
# The existing inline rm -f lines are kept as a harmless double-remove.
trap 'rm -f "${_GUARD_TMP:-}" "${_e2e_tmp:-}" "${_binding_tmp:-}" "${_runtime_err:-}"' EXIT

INPUT=$(cat)
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# WI-140/WI-206: SDKG post-task trigger router. Fires on every Stop event;
# checks if any registered SDKG instance's trigger_keywords match the most
# recently completed task's subject; appends deduped event to the instance's
# monitor triggers jsonl. Fail-opens for unrelated sessions, but blocks
# framework-evolution sessions if the registered SDKG registry is malformed.
if [ -f "${SVC_REPO_ROOT:-$PWD}/scripts/lib/post-task-trigger-router.mjs" ] && \
   [ -f "${SVC_REPO_ROOT:-$PWD}/references/sdkg-registry.json" ]; then
  # Extract the most recently completed task subject from any active lane-tasks
  # file. Best-effort — empty subject just means router emits no events.
  LAST_COMPLETED_TASK_JSON=$(
    SVC_REPO_ROOT_VAR="${SVC_REPO_ROOT:-$PWD}" node <<'NODE_SDKG' 2>/dev/null || true
const fs = require("fs");
const path = require("path");
const root = process.env.SVC_REPO_ROOT_VAR;
const dir = path.join(root, ".svc");
if (!fs.existsSync(dir)) process.exit(0);
const files = fs.readdirSync(dir).filter(f => f.startsWith("lane-tasks-") && f.endsWith(".json") && !f.includes(".completed"));
let last = null;
for (const f of files) {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    for (const t of j.tasks || []) {
      // recursively check process_tasks too
      const candidates = [t, ...(t.process_tasks || [])];
      for (const c of candidates) {
        if (c.status === "completed" && c.subject) {
          last = { task_id: String(c.id || ""), subject: c.subject };
        }
      }
    }
  } catch (_) {}
}
if (last) process.stdout.write(JSON.stringify(last));
NODE_SDKG
  )
  if [ -n "$LAST_COMPLETED_TASK_JSON" ]; then
    SDKG_OUTPUT=$(
      cd "${SVC_REPO_ROOT:-$PWD}" &&
        echo "$LAST_COMPLETED_TASK_JSON" | node "scripts/lib/post-task-trigger-router.mjs" 2>&1 >/dev/null
    ) || {
      SDKG_STATUS=$?
      SDKG_CONTRACT_BOUND_TO=$(
        SVC_REPO_ROOT_VAR="${SVC_REPO_ROOT:-$PWD}" node <<'NODE_SDKG_CONTRACT' 2>/dev/null || true
const fs = require("fs");
const path = require("path");
const p = path.join(process.env.SVC_REPO_ROOT_VAR || process.cwd(), ".svc", "session-contract.jsonl");
if (!fs.existsSync(p)) process.exit(0);
const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
if (!lines.length) process.exit(0);
try { process.stdout.write(JSON.parse(lines[lines.length - 1]).bound_to || ""); } catch (_) {}
NODE_SDKG_CONTRACT
      )
      if [ "${SDKG_CONTRACT_BOUND_TO}" = "framework-evolution" ] && [ "${SVC_SDKG_FAIL_OPEN:-false}" != "true" ]; then
        node -e 'console.log(JSON.stringify({ decision: "block", reason: process.argv[1] }))' \
          "SVC SDKG ROUTER: stop blocked because post-task trigger routing failed during framework-evolution work.

Router exit: ${SDKG_STATUS}
Output: ${SDKG_OUTPUT:-<empty>}

Fix references/sdkg-registry.json or scripts/lib/post-task-trigger-router.mjs before closing framework work. Set SVC_SDKG_FAIL_OPEN=true only for an explicit emergency bypass and log the decision."
        exit 0
      fi
      echo "svc SDKG router: fail-open after router error: ${SDKG_OUTPUT:-exit $SDKG_STATUS}" >&2
    }
  fi
fi

truthy() {
  case "${1:-}" in
    1|true|TRUE|yes|YES|on|ON) return 0 ;;
    *) return 1 ;;
  esac
}

RUNTIME_RESOLVER="$HOOK_DIR/../scripts/svc-runtime-root.mjs"
resolve_runtime_leaf() {
  if [[ ! -f "$RUNTIME_RESOLVER" ]]; then
    echo "svc-runtime-root: installed resolver is missing at $RUNTIME_RESOLVER; rerun ./setup for this host" >&2
    return 2
  fi
  node "$RUNTIME_RESOLVER" --leaf "$1"
}

emit_block() {
  local reason="$1"
  node -e 'console.log(JSON.stringify({ decision: "block", reason: process.argv[1] }))' "$reason"
}

# WI-487 (AC-487-2/7/7A): fail-closed enforcement-source guard. Routed through the
# durable launcher by setup (host command becomes `node $LAUNCHER
# svc-task-completion-guard`); this in-file pre-check is the second layer for when
# the guard IS reachable. If THIS guard's OWN installed enforcement source is
# ephemeral / worktree-bound / dangling, deny VISIBLY (never a silent allow) with
# an actionable {hook_id,reason_code,cause,operation,recovery} diagnostic + a
# durable per-session receipt. A durable canonical source passes straight through.
# When the WI-487 libs are absent (older install / uncommitted checkout), it emits
# "skip" and the launcher remains the hard fail-closed layer — the live healthy
# session is never blocked by this check.
if [ -f "$HOOK_DIR/lib/durable-source.mjs" ] && [ -f "$HOOK_DIR/lib/hook-denial.mjs" ] && command -v node >/dev/null 2>&1; then
  _SVC_ENFORCE_DECISION=$(
    _SVC_HOOK_DIR="$HOOK_DIR" _SVC_SESSION="${SVC_SESSION_ID:-${CLAUDE_SESSION_ID:-}}" node <<'NODE_ENFORCE' 2>/dev/null || echo "skip"
import path from "node:path";
import { pathToFileURL } from "node:url";
(async () => {
  const hookDir = process.env._SVC_HOOK_DIR;
  let ds, hd;
  try {
    ds = await import(pathToFileURL(path.join(hookDir, "lib", "durable-source.mjs")).href);
    hd = await import(pathToFileURL(path.join(hookDir, "lib", "hook-denial.mjs")).href);
  } catch { process.stdout.write("skip"); return; }
  const source = path.resolve(hookDir, "..");
  const decision = ds.guardEnforcementSource({ hook_id: "svc-task-completion-guard", source_path: source, operation: "session Stop", session_id: process.env._SVC_SESSION || "" });
  if (decision.decision === "allow") { process.stdout.write("allow"); return; }
  const d = hd.emitDenial({ ...decision, session_id: process.env._SVC_SESSION || "" });
  process.stdout.write("DENY\t" + Buffer.from(d.host_message || d.message, "utf8").toString("base64"));
})();
NODE_ENFORCE
  )
  if [[ "$_SVC_ENFORCE_DECISION" == DENY* ]]; then
    _SVC_ENFORCE_REASON=$(node -e 'process.stdout.write(Buffer.from(process.argv[1] || "", "base64").toString("utf8"))' "${_SVC_ENFORCE_DECISION#DENY$'\t'}")
    emit_block "${_SVC_ENFORCE_REASON:-SVC DENIAL svc-task-completion-guard: installed enforcement source is not durable (fail-closed).}"
    exit 0
  fi
fi

# WI-486 (task-5): bound malformed task-state pressure through the shared
# task-state-compatibility disposition. The FIRST time a given repository/session/
# worktree/state-digest/classification is seen it is "actionable" (block once);
# an identical unchanged repeat is "advisory" so malformed state can never
# hard-block a session indefinitely. Emits "actionable" or "advisory".
invalid_state_disposition() {
  local runtime runtime_error
  _runtime_err=$(mktemp)
  if ! runtime=$(resolve_runtime_leaf "svc-task-state-compat-$(id -u 2>/dev/null || echo user)" 2>"$_runtime_err"); then
    runtime_error=$(cat "$_runtime_err" 2>/dev/null || true)
    rm -f "$_runtime_err"; _runtime_err=""
    echo "SVC COMPLETION GUARD: advisory only. task-state runtime root is unavailable or unsafe; compatibility pressure disabled. ${runtime_error}" >&2
    echo advisory
    return 0
  fi
  rm -f "$_runtime_err"; _runtime_err=""
  if [[ "$runtime" != /* || "$runtime" == *$'\n'* ]]; then
    echo "SVC COMPLETION GUARD: advisory only. task-state runtime resolver returned a non-absolute or multi-line path; compatibility pressure disabled." >&2
    echo advisory
    return 0
  fi
  SVC_TASK_STATE_RUNTIME_DIR="$runtime" \
  _SVC_LANE_LIST="${LANE_TASKS_LIST:-}" _SVC_SESSION="${SESSION_ID:-}" _SVC_HOOK_DIR="$HOOK_DIR" \
  node <<'NODE_DISP' 2>/dev/null || echo actionable
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
(async () => {
  let mod;
  try { mod = await import(pathToFileURL(path.join(process.env._SVC_HOOK_DIR, "lib", "task-state-compatibility.mjs")).href); }
  catch { process.stdout.write("actionable"); return; }
  const files = String(process.env._SVC_LANE_LIST || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const graphBytesByPath = {};
  let classification = "supported";
  for (const f of files) {
    let bytes; try { bytes = fs.readFileSync(f); } catch { bytes = Buffer.from(""); }
    graphBytesByPath[f] = bytes;
    const c = mod.classifyTaskState(bytes).classification;
    if (c !== "supported") classification = c;
  }
  if (classification === "supported") classification = "quarantine-recommended"; // malformed-enforcement path
  let repoRoot = process.cwd();
  try { repoRoot = require("node:child_process").execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim(); } catch {}
  const r = mod.recordDisposition({
    repoRoot, sessionId: process.env._SVC_SESSION || "", worktreeRoot: process.cwd(),
    affectedPaths: files, graphBytesByPath, classification,
  });
  // WI-486 (EXEC-008): block ONLY on a genuine first-seen "actionable". Every
  // other disposition — "advisory" (bounded repeat), "error" (marker could not be
  // persisted), "none" — is non-blocking, so an unwritable runtime dir can never
  // hard-block Stop forever.
  process.stdout.write(r.disposition === "actionable" ? "actionable" : "advisory");
})();
NODE_DISP
}

check_end_to_end_stop() {
  if truthy "${SVC_END_TO_END_STOP_DISABLE:-false}"; then
    return 0
  fi

  local result status reason_b64 reason
  # WI-379: write $INPUT to a tmpfile so the node child reads the payload from
  # disk (not envp) — avoids ARG_MAX/E2BIG. `printf '%s' "$INPUT" | node <<heredoc`
  # does NOT deliver stdin inside bash $() (bash subshell heredoc limitation).
  local _e2e_tmp
  _e2e_tmp=$(mktemp)
  printf '%s' "$INPUT" > "$_e2e_tmp"
  result=$(
    # _SVC_E2E_INPUT carries a BOUNDED /tmp path, never payload content — intentionally exempt from the payload-not-argv heuristic.
    _SVC_E2E_INPUT="$_e2e_tmp" node <<'NODE_E2E' 2>/dev/null || true
const fs = require("node:fs");
const path = require("node:path");

function findSvcDir(start) {
  let dir = path.resolve(start || process.cwd());
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, ".svc");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

function readLastContract(svcDir) {
  if (!svcDir) return null;
  const file = path.join(svcDir, "session-contract.jsonl");
  if (!fs.existsSync(file)) return null;
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function contentToText(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part.text === "string") return part.text;
      return "";
    }).filter(Boolean).join("\n");
  }
  if (content && typeof content.text === "string") return content.text;
  return "";
}

function assistantTextFromTranscript(file) {
  if (!file || !fs.existsSync(file)) return "";
  const stat = fs.statSync(file);
  const bytes = Math.min(stat.size, 512 * 1024);
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(bytes);
  fs.readSync(fd, buf, 0, bytes, stat.size - bytes);
  fs.closeSync(fd);
  const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    try {
      const obj = JSON.parse(lines[i]);
      const role = obj.role || obj?.message?.role || obj.type;
      if (role !== "assistant" && role !== "assistant_message") continue;
      const text = contentToText(obj.content || obj?.message?.content || obj.text);
      if (text.trim()) return text;
    } catch {
      // Ignore malformed transcript lines.
    }
  }
  return "";
}

function shouldBlock(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return false;
  const patterns = [
    /\bif you want\b/i,
    /\blet me know if\b/i,
    /\bdo you want me\b/i,
    /\bwould you like\b/i,
    /\bshould i\b/i,
    /\bstanding by\b/i,
    /\bawaiting (your )?(direction|instructions|confirmation)\b/i,
    /\bready when you are\b/i,
    /\breply\b.{0,80}\b(continue|yes|go|approve)\b/i
  ];
  if (patterns.some((pattern) => pattern.test(trimmed))) return true;
  const tail = trimmed.slice(-240);
  return /\?\s*$/.test(tail) && /\b(you|your|we|i)\b/i.test(tail);
}

let input = {};
try {
  const raw = fs.readFileSync(process.env._SVC_E2E_INPUT || "/dev/null", "utf8");
  input = JSON.parse(raw || "{}");
} catch {
  input = {};
}

const svcDir = findSvcDir(input.cwd || process.cwd());
const contract = readLastContract(svcDir);
if (contract?.execution_mode !== "end_to_end") {
  console.log("allow\t");
  process.exit(0);
}

const text =
  input.last_assistant_message ||
  input.lastAssistantMessage ||
  assistantTextFromTranscript(input.transcript_path || input.transcriptPath);

if (!shouldBlock(text)) {
  console.log("allow\t");
  process.exit(0);
}

const reason = [
  "SVC END-TO-END GUARD: execution_mode=end_to_end is active, but the final assistant message asks the user for permission or direction.",
  "",
  "Do not stop with question-style trailers such as 'if you want', 'let me know', 'should I', or 'standing by'.",
  "Continue the next natural action automatically unless there is a hard blocker, destructive blast radius, paid-spend threshold, or explicit user interjection.",
  "",
  "Bypass only for emergencies: SVC_END_TO_END_STOP_DISABLE=true."
].join("\n");
console.log(`block\t${Buffer.from(reason, "utf8").toString("base64")}`);
NODE_E2E
  )
  rm -f "$_e2e_tmp"

  status="${result%%$'\t'*}"
  reason_b64="${result#*$'\t'}"
  if [[ "$status" == "block" ]]; then
    reason=$(node -e 'process.stdout.write(Buffer.from(process.argv[1] || "", "base64").toString("utf8"))' "$reason_b64")
    emit_block "$reason"
    exit 0
  fi
}

check_end_to_end_stop

# WI-484: when a worktree has opted into session bindings, resolve exact
# ownership before discovering or parsing any lane graph. Ambiguous, missing,
# read-only, mismatched, or foreign ownership is advisory/allow for Stop.
_binding_tmp=$(mktemp)
printf '%s' "$INPUT" > "$_binding_tmp"
BINDING_PREFLIGHT=$(
  _SVC_BINDING_INPUT="$_binding_tmp" _SVC_HOOK_DIR="$HOOK_DIR" node <<'NODE_BINDING' 2>/dev/null || true
// WI-486 (task-5, SIB-19): the Claude Stop adapter no longer embeds a second
// ownership resolver. It routes the exact-binding decision through the SAME
// resolve-wi.mjs authority function Codex uses (authorityJson), so the two hosts
// cannot drift. This block only classifies legacy-vs-opted-in and non-execution
// role, then delegates the tuple decision to the shared resolver.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

function out(status, graph = "", wi = "", session = "", reason = "") {
  console.log([status, graph, wi, session, Buffer.from(String(reason)).toString("base64")].join("\t"));
}
function findSvc(start) {
  let dir = path.resolve(start || process.cwd());
  while (dir !== path.dirname(dir)) {
    const svc = path.join(dir, ".svc");
    try { if (fs.statSync(svc).isDirectory()) return svc; } catch {}
    dir = path.dirname(dir);
  }
  return null;
}
(async () => {
  let input = {};
  try { input = JSON.parse(fs.readFileSync(process.env._SVC_BINDING_INPUT, "utf8") || "{}"); }
  catch { out("legacy"); return; }
  const cwd = path.resolve(input.cwd || input.working_directory || process.cwd());
  const svc = findSvc(cwd);
  if (!svc) { out("legacy"); return; }
  const bindings = path.join(svc, "bindings");
  let files = [];
  try { files = fs.readdirSync(bindings).filter((name) => name.endsWith(".json")); }
  catch { out("legacy"); return; }
  const role = String(input.session_role || input.role || process.env.SVC_SESSION_ROLE || "");
  if (new Set(["reviewer", "adversarial", "research", "audit", "cross-model-review"]).has(role)) {
    out("allow", "", "", "", "non-execution role"); return;
  }
  if (files.length === 0) { out("advisory", "", "", "", "worktree binding required but no binding exists"); return; }
  const session = String(input.session_id || input.sessionId || input.thread_id || input.threadId ||
    process.env.SVC_SESSION_ID || process.env.CODEX_THREAD_ID || process.env.CODEX_SESSION_ID ||
    process.env.CLAUDE_SESSION_ID || process.env.KIMI_SESSION_ID || process.env.GEMINI_SESSION_ID || "");
  if (!session) { out("advisory", "", "", "", "missing attributable current session"); return; }
  let authorityJson;
  try {
    ({ authorityJson } = await import(pathToFileURL(path.join(process.env._SVC_HOOK_DIR, "lib", "resolve-wi.mjs")).href));
  } catch { out("advisory", "", "", session, "shared authority resolver unavailable"); return; }
  // SVC_WORKER_WI mismatch is handled by the guard's own downstream branch, not
  // by folding a requested WI into tuple resolution — keep it out of the resolver
  // env so the bound tuple reflects the actual session binding.
  const resolverEnv = { ...process.env, SVC_SESSION_ID: session, SVC_REQUIRE_SESSION_BINDING: "1" };
  delete resolverEnv.SVC_WORKER_WI;
  const decision = authorityJson({ cwd, session_id: session }, resolverEnv);
  if (!decision.authority) {
    // A non-execution binding role is an allow; every other non-owned outcome is
    // advisory (foreign/stale/mismatch/malformed) — never a foreign graph read.
    const reason = String(decision.reason || decision.classification || "no exact session binding");
    if (/non-execution role|binding role cannot mutate/.test(reason)) { out("allow", "", "", session, reason); return; }
    out("advisory", "", (decision.tuple && decision.tuple.wi) || "", session, reason);
    return;
  }
  const graph = decision.tuple && decision.tuple.graph_path ? String(decision.tuple.graph_path) : "";
  if (!graph || !fs.existsSync(graph)) { out("advisory", "", decision.tuple && decision.tuple.wi, session, "exact bound graph is missing"); return; }
  out("bound", graph, decision.tuple.wi, decision.tuple.session_id || session, "");
})();
NODE_BINDING
)
rm -f "$_binding_tmp"

IFS=$'\t' read -r BINDING_STATUS BOUND_GRAPH BOUND_WI BOUND_SESSION BINDING_REASON_B64 <<< "$BINDING_PREFLIGHT"
case "${BINDING_STATUS:-}" in
  allow) exit 0 ;;
  advisory)
    BINDING_REASON=$(node -e 'process.stdout.write(Buffer.from(process.argv[1] || "", "base64").toString("utf8"))' "${BINDING_REASON_B64:-}")
    echo "SVC COMPLETION GUARD: advisory only. ${BINDING_REASON:-session/worktree ownership is not attributable}; no foreign graph was inspected." >&2
    exit 0
    ;;
  bound) ;;
  legacy) BOUND_GRAPH="" ;;
  *)
    echo "SVC COMPLETION GUARD: advisory only. binding preflight failed without an attributable result; no graph was inspected." >&2
    exit 0
    ;;
esac

if [[ "${BINDING_STATUS:-}" == "bound" && -n "${SVC_WORKER_WI:-}" && "${SVC_WORKER_WI}" != "${BOUND_WI}" ]]; then
  echo "SVC COMPLETION GUARD: advisory only. requested WI ${SVC_WORKER_WI} differs from the authoritative session binding ${BOUND_WI}; no graph was inspected." >&2
  exit 0
fi

find_lane_tasks() {
  # Emit every lane-tasks*.json file from the nearest ancestor that has
  # .svc/lane-tasks*.json (one lookup, all matches). Supports the
  # multi-WI convention `lane-tasks-<WI>.json` alongside the legacy
  # singular `lane-tasks.json`.
  local dir="$PWD"
  while [[ "$dir" != "/" ]]; do
    if compgen -G "$dir/.svc/lane-tasks*.json" >/dev/null 2>&1; then
      # shellcheck disable=SC2012
      ls -1 "$dir"/.svc/lane-tasks*.json
      return 0
    fi
    dir="$(dirname "$dir")"
  done
  return 1
}

# Collect all lane-tasks*.json files (one per active WI).
if [[ -n "${BOUND_GRAPH:-}" ]]; then
  LANE_TASKS_LIST="$BOUND_GRAPH"
else
  LANE_TASKS_LIST=$(find_lane_tasks 2>/dev/null || true)
fi
if [[ -z "$LANE_TASKS_LIST" ]]; then
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  echo "svc completion guard: node not available, skipping check for $LANE_TASKS_LIST" >&2
  exit 0
fi

PARSED=""
# WI-379: write the b64-framed envelope to a tmpfile so neither $INPUT nor
# $LANE_TASKS_LIST enters envp (ARG_MAX/E2BIG class). The pipe-to-heredoc
# form (`printf | node <<heredoc`) does not deliver stdin inside bash $()
# — bash subshell limitation; tmpfile is the safe alternative.
_GUARD_TMP=$(mktemp)
printf '{"input_b64":"%s","lane_tasks_list_b64":"%s"}' \
  "$(printf '%s' "$INPUT" | base64 | tr -d '\n')" \
  "$(printf '%s' "$LANE_TASKS_LIST" | base64 | tr -d '\n')" > "$_GUARD_TMP"
[[ -s "$_GUARD_TMP" ]] || { if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then exit 0; fi; emit_block "SVC COMPLETION GUARD: payload envelope write failed (empty tempfile) — stop blocked until the transport is repaired or SVC_COMPLETION_FAIL_OPEN=true."; exit 0; }
if ! PARSED=$(
  # _GUARD_TMP carries a BOUNDED /tmp path, never payload content — intentionally exempt from the payload-not-argv heuristic.
  _GUARD_TMP="$_GUARD_TMP" node <<'NODE'
const fs = require("node:fs");
const path = require("node:path");

function truthy(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

let envelope = {};
try {
  envelope = JSON.parse(fs.readFileSync(process.env._GUARD_TMP || "/dev/null", "utf8") || "{}");
} catch { envelope = {}; }
const inputRaw = envelope.input_b64
  ? Buffer.from(envelope.input_b64, "base64").toString("utf8")
  : "{}";
let input;
try {
  input = JSON.parse(inputRaw);
} catch (error) {
  console.log(`status\tinvalid_input`);
  console.log(`warning\tinvalid hook input: ${error.message}`);
  process.exit(0);
}

const isSubagent =
  truthy(input.is_subagent) ||
  truthy(input?.metadata?.is_subagent) ||
  input.agent_type === "subagent" ||
  input.role === "subagent" ||
  input?.invocation?.source === "subagent" ||
  input.parent_session_id != null ||
  input.parentSessionId != null;

if (isSubagent) {
  console.log("status\tsubagent");
  process.exit(0);
}

// Kimi Stop hook anti-loop: on re-trigger, stop_hook_active is set to true.
// We must exit 0 immediately to prevent infinite loops.
if (truthy(input.stop_hook_active)) {
  console.log("status\tanti_loop");
  process.exit(0);
}

// Multi-WI support: read every lane-tasks-*.json and aggregate pending work.
// Exclude .completed-* archive files — they are historical and do not need
// routing decisions or skill receipts checked (Fix C from completion-guard-dedup).
const laneListRaw = envelope.lane_tasks_list_b64
  ? Buffer.from(envelope.lane_tasks_list_b64, "base64").toString("utf8")
  : "";
let laneFiles = laneListRaw
  .split(/\r?\n/)
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((f) => !path.basename(f).includes(".completed"));

// WI resolution — canonical chain (resolve-wi.mjs inlined for bash-embedded Node)
function resolveActiveWI(hookInput) {
  // 1. SVC_WORKER_WI env var
  if (process.env.SVC_WORKER_WI) return process.env.SVC_WORKER_WI;
  // 2. Hook payload .wi
  if (hookInput?.wi) return hookInput.wi;
  // 3. Git branch name (WI-id via canonical hooks/lib/wi-id.mjs — named + numeric; resolved through resolve-wi.mjs)
  try {
    const { execSync } = require("node:child_process");
    const branch = execSync("git symbolic-ref --short HEAD 2>/dev/null", { encoding: "utf8" }).trim();
    const m = branch.match(/WI-(\d+)/i) || branch.match(/(?:feature|bugfix|refactor)-(\d+)/i);
    if (m) return `WI-${m[1]}`;
  } catch {}
  // 4. Single in_progress lane-tasks
  const svcDir = laneFiles[0] ? path.dirname(laneFiles[0]) : null;
  if (svcDir) {
    const activeGraphs = laneFiles.filter((f) => {
      try {
        const g = JSON.parse(fs.readFileSync(f, "utf8"));
        return (g.tasks || []).some((t) => t.status === "pending" || t.status === "in_progress");
      } catch { return false; }
    });
    if (activeGraphs.length === 1) {
      try {
        const g = JSON.parse(fs.readFileSync(activeGraphs[0], "utf8"));
        return g.wi || path.basename(activeGraphs[0]).replace("lane-tasks-", "").replace(".json", "");
      } catch {}
    }
  }
  // 5. Session-contract last-line (racy fallback)
  if (svcDir) {
    const cp = path.join(svcDir, "session-contract.jsonl");
    if (fs.existsSync(cp)) {
      try {
        const lines = fs.readFileSync(cp, "utf8").split(/\r?\n/).filter(Boolean);
        if (lines.length > 0) {
          const last = JSON.parse(lines[lines.length - 1]);
          return last.wi || "";
        }
      } catch {}
    }
  }
  return "";
}

// Role-aware skip: non-execution roles should not be blocked
function isNonExecutionRole(hookInput) {
  const role = hookInput?.session_role || hookInput?.role || process.env.SVC_SESSION_ROLE || "";
  const NON_BLOCKING = new Set(["reviewer", "adversarial", "research", "audit", "cross-model-review"]);
  if (NON_BLOCKING.has(role)) return true;
  // Also check session-contract for role
  const svcDir = laneFiles[0] ? path.dirname(laneFiles[0]) : null;
  if (svcDir) {
    const cp = path.join(svcDir, "session-contract.jsonl");
    if (fs.existsSync(cp)) {
      try {
        const lines = fs.readFileSync(cp, "utf8").split(/\r?\n/).filter(Boolean);
        if (lines.length > 0) {
          const last = JSON.parse(lines[lines.length - 1]);
          const contractRole = last.session_role || last.role || "";
          if (NON_BLOCKING.has(contractRole)) return true;
        }
      } catch {}
    }
  }
  return false;
}

if (isNonExecutionRole(input)) {
  console.log("status\tallow");
  process.exit(0);
}

const workerWi = resolveActiveWI(input);
if (workerWi) {
  laneFiles = laneFiles.filter((file) => {
    try {
      const graph = JSON.parse(fs.readFileSync(file, "utf8"));
      const wi = String(graph.wi || "");
      const parent = String(graph.parent_wi || graph.parent || "");
      const deps = Array.isArray(graph.depends_on) ? graph.depends_on.map(String) : [];
      return wi === workerWi || parent === workerWi || deps.includes(workerWi);
    } catch {
      return path.basename(file).includes(workerWi);
    }
  });
}

if (laneFiles.length === 0) {
  console.log("status\tallow");
  process.exit(0);
}

let totalActionable = 0;
let totalCompleted = 0;
let totalBlocked = 0;
let totalTasks = 0;
const remainingLines = [];
const wiList = [];
const warnings = [];
let sessionContract = null;
const phaseEnforceAfter = process.env.SVC_PHASE_RECEIPT_ENFORCE_AFTER || "2026-05-10T16:00:00Z";

function graphPhaseEnforcementActive(graph) {
  return typeof graph?.created === "string" && graph.created > phaseEnforceAfter;
}

function requiredPhasesForSkill(root, skill) {
  if (!skill || !/^[A-Za-z0-9._-]+$/.test(skill)) return [];
  const skillFile = path.join(root, "skills", skill, "SKILL.md");
  if (!fs.existsSync(skillFile)) return [];
  const text = fs.readFileSync(skillFile, "utf8");
  const start = text.match(/^phases:\s*$/m);
  if (!start) return [];
  const rest = text.slice(start.index);
  const end = rest.search(/^inputs:\s*$/m);
  const block = end === -1 ? rest : rest.slice(0, end);
  const required = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line.includes("required_for_completion: true")) continue;
    const match = line.match(/id:\s*([A-Za-z0-9.-]+)/);
    if (match) required.push(match[1]);
  }
  return required;
}

function phaseIdsForTask(task) {
  const phases = task?.skill_receipt?.phases_executed;
  if (!Array.isArray(phases)) return new Set();
  return new Set(phases.map((phase) => phase?.id).filter(Boolean));
}

for (const file of laneFiles) {
  let graph;
  try {
    graph = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    warnings.push(`invalid ${file}: ${error.message}`);
    continue;
  }
  if (!Array.isArray(graph.tasks)) {
    warnings.push(`invalid ${file}: tasks must be an array`);
    continue;
  }
  const tasks = graph.tasks;
  // Actionable = pending or in_progress. `blocked` and `manual` are non-blocking.
  const actionable = tasks.filter(
    (task) => task && ["pending", "in_progress"].includes(task.status)
  );
  totalActionable += actionable.length;
  totalCompleted += tasks.filter((t) => t && t.status === "completed").length;
  totalBlocked += tasks.filter((t) => t && t.status === "blocked").length;
  totalTasks += tasks.length;
  const wi = graph.wi || file.replace(/.*lane-tasks-?/, "").replace(/\.json$/, "") || "unknown";
  if (actionable.length > 0) {
    wiList.push(wi);
    for (const task of actionable) {
      const skill = task?.metadata?.skill || task.skill || "unknown-skill";
      remainingLines.push(`[${wi}:${task.id}] ${skill}: ${task.subject}`);
    }
  }
}

if (warnings.length > 0 && totalTasks === 0) {
  // All files invalid AND no readable tasks — invalid state.
  console.log("status\tinvalid_graph");
  console.log(`warning\t${warnings.join("; ")}`);
  process.exit(0);
}

if (laneFiles[0]) {
  const contractPath = path.join(path.dirname(laneFiles[0]), "session-contract.jsonl");
  if (fs.existsSync(contractPath)) {
    try {
      const lines = fs.readFileSync(contractPath, "utf8").split(/\r?\n/).filter(Boolean);
      if (lines.length > 0) {
        sessionContract = JSON.parse(lines[lines.length - 1]);
      }
    } catch (error) {
      warnings.push(`failed to parse ${contractPath}: ${error.message}`);
    }
  }
}

// Decision Log Enforcement (FG1)
const decisionLogPath = laneFiles[0]
  ? path.join(path.dirname(laneFiles[0]), "pipeline-decisions.jsonl")
  : null;
const loggedWIs = new Set();
const historicalSkipWIs = new Set();
function addDecisionWIs(entry, target) {
  if (entry.run_id) {
    // Handle compound run_ids like "WI-140,WI-142" (FG-004: split on comma/whitespace)
    const ids = String(entry.run_id).split(/[,\s]+/).filter(Boolean);
    for (const id of ids) target.add(id);
  }
  if (entry.wi) target.add(entry.wi);
  if (Array.isArray(entry.affected_wis)) {
    for (const id of entry.affected_wis) {
      if (typeof id === "string" && id.trim()) target.add(id.trim());
    }
  }
}
if (decisionLogPath && fs.existsSync(decisionLogPath)) {
  try {
    const lines = fs.readFileSync(decisionLogPath, "utf8").split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const entry = JSON.parse(line);
      if (entry.run_id && entry.skill === "route-workflow") {
        addDecisionWIs(entry, loggedWIs);
      }
      if (entry.wi && entry.skill === "route-workflow") {
        addDecisionWIs(entry, loggedWIs);
      }
      if (entry.skill === "route-workflow" && entry.historical_skip === true) {
        addDecisionWIs(entry, historicalSkipWIs);
      }
    }
  } catch (error) {
    warnings.push(`failed to parse ${decisionLogPath}: ${error.message}`);
  }
}
const missingDecisionWIs = [];
if (totalActionable === 0) {
  for (const file of laneFiles) {
    try {
      const graph = JSON.parse(fs.readFileSync(file, "utf8"));
      const wi = graph.wi || file.replace(/.*lane-tasks-?/, "").replace(/\.json$/, "") || "unknown";
      // If WI is NOT verified in the spec yet (OR if we just want to enforce log for any WI closure)
      // Actually, if lane-tasks exists and is fully completed, it's a closure event.
      if (wi !== "unknown" && !loggedWIs.has(wi) && !historicalSkipWIs.has(wi) && graph.status !== "completed") {
        missingDecisionWIs.push(wi);
      }
      // If loggedWIs.has(wi) → decision exists; never re-demand (Fix C from completion-guard-dedup).
      // If historicalSkipWIs.has(wi) → pre-enforcement WI is explicitly acknowledged; never re-demand.
      // The 10-minute window is used only for the info message, not the block logic.
    } catch (e) {
      // already warned above
    }
  }
}

const missingReceiptTasks = [];
const missingPhaseReceiptTasks = [];
for (const file of laneFiles) {
  try {
    const graph = JSON.parse(fs.readFileSync(file, "utf8"));
    const wi = graph.wi || file.replace(/.*lane-tasks-?/, "").replace(/\.json$/, "") || "unknown";
    const root = path.dirname(path.dirname(file));
    if (historicalSkipWIs.has(wi) && totalActionable === 0) {
      continue;
    }
    if (graph.status !== "completed") {
      for (const task of graph.tasks) {
        if (task && task.status === "completed" && (task.metadata?.skill || task.skill) && !task.skill_receipt) {
          missingReceiptTasks.push(`${wi}:${task.id} (${task.metadata?.skill || task.skill})`);
        }
      }
    }
    if (graphPhaseEnforcementActive(graph)) {
      for (const task of graph.tasks) {
        if (!task || task.status !== "completed" || !task.skill_receipt) continue;
        const skill = task.skill_receipt.skill || task.metadata?.skill || task.skill;
        const required = requiredPhasesForSkill(root, skill);
        if (required.length === 0) continue;
        const executed = phaseIdsForTask(task);
        const missing = required.filter((phase) => !executed.has(phase));
        if (missing.length > 0) {
          missingPhaseReceiptTasks.push(`${wi}:${task.id} (${skill}) missing ${missing.join(",")}`);
        }
      }
    }
  } catch (e) {
    // already warned above
  }
}

let status = "allow";
if (totalActionable > 0) {
  const boundTo = sessionContract?.bound_to || "";
  const boundWi = sessionContract?.wi || "";
  const sessionIsBacklog = boundTo === "wi-backlog";
  const sessionTargetsActionableWi = boundWi && wiList.includes(boundWi);
  const sessionIsOnDemand =
    boundTo === "user-request" ||
    boundTo === "framework-evolution" ||
    boundTo === "framework";

  if (sessionIsBacklog || sessionTargetsActionableWi || !sessionIsOnDemand) {
    status = "block";
  } else {
    status = "advisory_contract";
  }
} else if (missingDecisionWIs.length > 0) {
  status = "missing_decision";
} else if (missingPhaseReceiptTasks.length > 0) {
  status = "missing_phase_receipt";
} else if (missingReceiptTasks.length > 0) {
  status = "missing_receipt";
}

console.log(`status\t${status}`);
console.log(`session_id\t${input.session_id || input.sessionId || ""}`);
console.log(`wi\t${wiList.join(",") || "none"}`);
console.log(`missing_decisions\t${missingDecisionWIs.join(",") || "none"}`);
console.log(`missing_receipts\t${missingReceiptTasks.join("; ") || "none"}`);
console.log(`missing_phase_receipts\t${missingPhaseReceiptTasks.join("; ") || "none"}`);
console.log(`total\t${totalTasks}`);
console.log(`completed\t${totalCompleted}`);
console.log(`blocked\t${totalBlocked}`);
console.log(`actionable\t${totalActionable}`);
console.log(`contract_bound_to\t${sessionContract?.bound_to || "none"}`);
console.log(`contract_wi\t${sessionContract?.wi || "none"}`);
console.log(`contract_ts\t${sessionContract?.timestamp || sessionContract?.ts || ""}`);
console.log(`contract_request\t${sessionContract?.request || ""}`);
console.log(`remaining_b64\t${Buffer.from(remainingLines.join("\n"), "utf8").toString("base64")}`);
if (warnings.length > 0) {
  console.log(`warning\t${warnings.join("; ")}`);
}
NODE
); then
  if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then
    echo "svc completion guard: unable to parse hook payload or lane tasks, fail-open enabled" >&2
    exit 0
  fi
  emit_block "SVC COMPLETION GUARD: a lane task graph exists but the completion guard could not parse the hook payload or task graph. Stop blocked until the task state is repaired or SVC_COMPLETION_FAIL_OPEN=true is set."
  exit 0
fi
rm -f "$_GUARD_TMP"

STATUS=""
SESSION_ID=""
WI=""
MISSING_DECISIONS=""
MISSING_RECEIPTS=""
MISSING_PHASE_RECEIPTS=""
TOTAL="0"
COMPLETED="0"
BLOCKED="0"
ACTIONABLE="0"
CONTRACT_BOUND_TO=""
CONTRACT_WI=""
CONTRACT_TS=""
CONTRACT_REQUEST=""
REMAINING_B64=""
WARNING=""
ACTIVE_INTENT_REASON_B64=""

while IFS=$'\t' read -r key value; do
  case "$key" in
    status) STATUS="$value" ;;
    session_id) SESSION_ID="$value" ;;
    wi) WI="$value" ;;
    missing_decisions) MISSING_DECISIONS="$value" ;;
    missing_receipts) MISSING_RECEIPTS="$value" ;;
    missing_phase_receipts) MISSING_PHASE_RECEIPTS="$value" ;;
    total) TOTAL="$value" ;;
    completed) COMPLETED="$value" ;;
    blocked) BLOCKED="$value" ;;
    actionable) ACTIONABLE="$value" ;;
    contract_bound_to) CONTRACT_BOUND_TO="$value" ;;
    contract_wi) CONTRACT_WI="$value" ;;
    contract_ts) CONTRACT_TS="$value" ;;
    contract_request) CONTRACT_REQUEST="$value" ;;
    remaining_b64) REMAINING_B64="$value" ;;
    warning) WARNING="$value" ;;
  esac
done <<< "$PARSED"

if [[ -n "$WARNING" ]]; then
  echo "svc completion guard: $WARNING" >&2
fi

if [[ "$STATUS" == "block" && -f "$HOOK_DIR/lib/active-intent.mjs" ]]; then
  # WI-379: pipe the unbounded $INPUT payload via stdin (ARG_MAX/E2BIG class).
  # $LANE_TASKS_LIST (svcDir derivation only) / $WI / contract vars stay env —
  # bounded (path list + WI id + short contract strings). See lib check-mode
  # stdin-first read + size assertion.
  ACTIVE_INTENT_RESULT=$(
    printf '%s' "$INPUT" | \
      LANE_TASKS_LIST="$LANE_TASKS_LIST" WI="$WI" \
      CONTRACT_BOUND_TO="$CONTRACT_BOUND_TO" CONTRACT_WI="$CONTRACT_WI" CONTRACT_TS="$CONTRACT_TS" \
      node "$HOOK_DIR/lib/active-intent.mjs" check 2>/dev/null || true
  )
  while IFS=$'\t' read -r key value; do
    case "$key" in
      suppress)
        STATUS="advisory_active_intent"
        ACTIVE_INTENT_REASON_B64="$value"
        ;;
    esac
  done <<< "$ACTIVE_INTENT_RESULT"
fi

if [[ -n "${BOUND_SESSION:-}" ]]; then
  SESSION_ID="$BOUND_SESSION"
fi
if [[ -z "$SESSION_ID" ]]; then
  SESSION_ID=$(printf '%s' "${PWD}|$$|$(date +%s%N)" | sha1sum | awk '{print $1}')
fi

if [[ "$STATUS" =~ ^(block|missing_decision|missing_receipt|missing_phase_receipt)$ ]]; then
MAX=${SVC_COMPLETION_MAX:-3}
if ! [[ "$MAX" =~ ^[0-9]+$ ]]; then MAX=3; fi
if [[ "$MAX" -lt 1 ]]; then MAX=1; fi
if [[ "$MAX" -gt 3 ]]; then MAX=3; fi
_runtime_err=$(mktemp)
if ! RUNTIME_ROOT=$(resolve_runtime_leaf "svc-completion-guard-$(id -u 2>/dev/null || echo user)" 2>"$_runtime_err"); then
  RUNTIME_ERROR=$(cat "$_runtime_err" 2>/dev/null || true)
  rm -f "$_runtime_err"; _runtime_err=""
  echo "SVC COMPLETION GUARD: advisory only. runtime counter root is insecure, unavailable, or foreign-owned; completion pressure disabled. ${RUNTIME_ERROR}" >&2
  exit 0
fi
rm -f "$_runtime_err"; _runtime_err=""
if [[ "$RUNTIME_ROOT" != /* || "$RUNTIME_ROOT" == *$'\n'* ]]; then
  echo "SVC COMPLETION GUARD: advisory only. runtime counter resolver returned a non-absolute or multi-line path; completion pressure disabled." >&2
  exit 0
fi
BOUND_REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
REPO_HASH=$( { printf '%s' "$BOUND_REPO_ROOT" | sha256sum 2>/dev/null || printf '%s' "$BOUND_REPO_ROOT" | shasum -a 256 2>/dev/null || echo "nohash"; } | awk '{print substr($1,1,24)}' )
SESSION_HASH=$( { printf '%s' "$SESSION_ID" | sha256sum 2>/dev/null || printf '%s' "$SESSION_ID" | shasum -a 256 2>/dev/null || echo "nohash"; } | awk '{print substr($1,1,24)}' )
WORKTREE_HASH=$( { printf '%s' "$PWD" | sha256sum 2>/dev/null || printf '%s' "$PWD" | shasum -a 256 2>/dev/null || echo "nohash"; } | awk '{print substr($1,1,24)}' )
WI_HASH=$( { printf '%s' "${WI:-none}" | sha256sum 2>/dev/null || printf '%s' "${WI:-none}" | shasum -a 256 2>/dev/null || echo "nohash"; } | awk '{print substr($1,1,24)}' )
COUNTER_DIR="${RUNTIME_ROOT}/${REPO_HASH}/${SESSION_HASH}/${WORKTREE_HASH}/${WI_HASH}"
(umask 077; mkdir -p "$COUNTER_DIR")
# WI-399 A6: key the counter by session AND checkout — the same session id in
# a different worktree/fixture dir is a different pressure context (static
# fixture ids were sharing global counters across validator runs; real
# sessions span multiple worktrees the same way).
# G6 R2-F4: sha1sum is GNU-only — on macOS/BSD (shasum) a bare sha1sum call
# would crash the guard under set -e and permanently block Stop. Fallback
# chain, and a constant sentinel if no hasher exists (degrades to per-session
# keying, never crashes).
COUNTER_FILE="${COUNTER_DIR}/pressure-count"
if [[ -e "$COUNTER_FILE" && ( -L "$COUNTER_FILE" || ! -f "$COUNTER_FILE" || ! -O "$COUNTER_FILE" ) ]]; then
  echo "SVC COMPLETION GUARD: advisory only. runtime pressure counter is insecure or foreign-owned; completion pressure disabled." >&2
  exit 0
fi
if [[ -f "$COUNTER_FILE" ]]; then chmod 600 "$COUNTER_FILE" 2>/dev/null || true; fi

COUNT=0
if [[ -f "$COUNTER_FILE" ]]; then
  COUNT=$(cat "$COUNTER_FILE" 2>/dev/null || echo "0")
fi

# Counter bytes are same-user runtime state, not trusted shell syntax. Bash
# arithmetic recursively evaluates array subscripts and command substitutions;
# accept a bounded decimal only before entering $((...)). Malformed state is
# advisory pressure failure and can never execute in the Stop-hook context.
if ! [[ "$COUNT" =~ ^(0|[1-9][0-9]{0,5})$ ]]; then
  echo "SVC COMPLETION GUARD: advisory only. runtime pressure counter is malformed; completion pressure disabled." >&2
  exit 0
fi

NEXT=$((10#$COUNT + 1))
(umask 077; printf '%s\n' "$NEXT" > "$COUNTER_FILE")
chmod 600 "$COUNTER_FILE" 2>/dev/null || true

# ---- WI-399 A6: real N-strike cap on PRESSURE statuses ---------------------
# block / missing_decision / missing_receipt / missing_phase_receipt are
# "keep working" pressure. Past the cap, an unbreakable loop means the state
# is stale or this session cannot resolve it — the user decides, not the
# guard (learning completion-guard-foreign-claim-resolution c8: printed 5/3
# and kept hard-blocking). SUPERSEDES the WI-183 never-age-out posture: the
# first MAX blocks stand unchanged (lazy-agent pressure intact), the
# post-cap advisory is LOUD, and malformed-state statuses stay uncapped.
case "$STATUS" in
  block|missing_decision|missing_receipt|missing_phase_receipt)
    if [[ "$NEXT" -gt "$MAX" ]]; then
      echo "SVC COMPLETION GUARD: advisory (cap ${MAX} reached at attempt ${NEXT}). Status '$STATUS' for ${WI:-unknown} keeps recurring — task state is likely stale or unresolvable by this session. Repair .svc/lane-tasks-<WI>.json / receipts, or ask the user how to proceed. No longer blocking Stop." >&2
      exit 0
    fi
    ;;
esac
fi

# ---- WI-399 A6: foreign-claim ownership check (c8). If the primary WI is
# claimed by a DIFFERENT live session (host-session-shaped id != current,
# claim fresh under TTL), execute-pressure here would dual-claim and corrupt
# both sessions (WI-352 crosstalk class). Unattributable claims keep pressure.
if [[ "$STATUS" == "block" && -n "${WI:-}" ]]; then
  PRIMARY_WI="${WI%%,*}"
  FIRST_LANE_FILE=$(printf '%s\n' "$LANE_TASKS_LIST" | head -n 1)
  CLAIM_FILE="$(dirname "$FIRST_LANE_FILE")/claims/${PRIMARY_WI}.claim.json"
  if [[ -f "$CLAIM_FILE" ]]; then
    FOREIGN=$(node --input-type=module - "$CLAIM_FILE" "$SESSION_ID" "$HOOK_DIR" <<'NODE_LEGACY_CLAIM' 2>/dev/null || echo "no"
import { pathToFileURL } from "node:url";
const [claimPath, session, hookDir] = process.argv.slice(2);
const claims = await import(pathToFileURL(`${hookDir}/lib/wi-claim.mjs`));
const claim = claims.readClaimAbsolute(claimPath);
const freshness = claims.claimFreshness(claim, claimPath);
process.stdout.write(freshness.fresh && session && freshness.owner.session_id !== session ? "yes" : "no");
NODE_LEGACY_CLAIM
    )
    if [[ "$FOREIGN" == "yes" ]]; then
      echo "SVC COMPLETION GUARD: advisory only. ${ACTIONABLE:-?} task(s) remain for ${PRIMARY_WI}, but its absolute claim belongs to a DIFFERENT live session. Executing here would dual-claim (WI-352 crosstalk class). Leave it to the owning session, or use an explicit generation-bound transfer." >&2
      exit 0
    fi
  fi
fi

case "$STATUS" in
  allow|subagent|anti_loop)
    exit 0
    ;;
  advisory_contract)
    echo "SVC COMPLETION GUARD: advisory only. ${ACTIONABLE} backlog task(s) remain for ${WI}, but this session is bound to ${CONTRACT_BOUND_TO} (${CONTRACT_WI:-none}): ${CONTRACT_REQUEST}" >&2
    echo "Reply 'continue with <WI>' to switch to backlog execution, or continue the current request." >&2
    exit 0
    ;;
  advisory_active_intent)
    ACTIVE_INTENT_REASON=""
    if [[ -n "$ACTIVE_INTENT_REASON_B64" ]]; then
      ACTIVE_INTENT_REASON=$(node -e 'process.stdout.write(Buffer.from(process.argv[1] || "", "base64").toString("utf8"))' "$ACTIVE_INTENT_REASON_B64")
    fi
    echo "SVC COMPLETION GUARD: advisory only. ${ACTIONABLE} backlog task(s) remain for ${WI}, but the latest user intent suppresses stale WI continuation pressure." >&2
    if [[ -n "$ACTIVE_INTENT_REASON" ]]; then
      echo "$ACTIVE_INTENT_REASON" >&2
    fi
    echo "Reply 'continue ${WI%%,*}' or 'resume ${WI%%,*}' to resume that WI; otherwise continue the current request." >&2
    exit 0
    ;;
  invalid_input|invalid_graph)
    if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then
      exit 0
    fi
    # WI-486 (task-5): bound the malformed-state block. First sight of this exact
    # session/state digest is actionable (block once); an unchanged repeat is
    # advisory so malformed task state can never wedge Stop indefinitely.
    if [[ "$(invalid_state_disposition)" == "advisory" ]]; then
      echo "SVC COMPLETION GUARD: advisory only. Task-state enforcement is still malformed for the same session/state digest already reported once; no longer hard-blocking. Repair the hook payload or .svc/lane-tasks-<WI>.json, or set SVC_COMPLETION_FAIL_OPEN=true." >&2
      echo "${WARNING}" >&2
      exit 0
    fi
    REASON="SVC COMPLETION GUARD: stop blocked because task-state enforcement is malformed.

${WARNING}

Fix the hook payload or active .svc/lane-tasks-<WI>.json graph before stopping. The singular .svc/lane-tasks.json path is legacy compatibility only. This first malformed-state block is bounded — an unchanged repeat downgrades to advisory. Explicitly set SVC_COMPLETION_FAIL_OPEN=true to bypass now."
    emit_block "$REASON"
    exit 0
    ;;
  block)
    if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then
      exit 0
    fi
    ;;
  missing_decision)
    if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then
      exit 0
    fi
    REASON="SVC COMPLETION GUARD (${NEXT}/${MAX}): Work Item ${MISSING_DECISIONS} is complete but missing a routing decision in .svc/pipeline-decisions.jsonl.

AUDIT TRAIL IS MANDATORY. You cannot close this WI until the routing decision and reasoning are logged.

Correction: Append a routing decision to .svc/pipeline-decisions.jsonl before stopping.
Format: { \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"run_id\": \"${MISSING_DECISIONS}\", \"skill\": \"route-workflow\", \"decision\": \"...\", \"reasoning\": \"...\" }"
    emit_block "$REASON"
    exit 0
    ;;
  missing_receipt)
    if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then
      exit 0
    fi
    REASON="SVC COMPLETION GUARD (${NEXT}/${MAX}): Completed tasks missing skill_receipt.

${MISSING_RECEIPTS}

Every completed task with a declared skill must have a skill_receipt. Ghost execution (marking tasks complete without loading the skill) violates AP-27.

Correction: For each missing receipt, run:
  node scripts/task-graph.mjs load-skill <path> <task-id> <skill-name>

Or if the task was completed before skill receipts were enforced, run:
  node scripts/task-graph.mjs backfill-receipts <path>"
    emit_block "$REASON"
    exit 0
    ;;
  missing_phase_receipt)
    if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then
      exit 0
    fi
    REASON="SVC COMPLETION GUARD (${NEXT}/${MAX}): Completed tasks are missing required phase receipts.

${MISSING_PHASE_RECEIPTS}

Each completed task must record every phase declared by the active skill with required_for_completion: true. Closing a task without matching phase receipts violates AP-33 and makes the skill's process claims unverifiable.

Correction: record the missing phases before stopping. Example:
  node scripts/task-graph.mjs record-phase .svc/lane-tasks-<WI>.json <task-id> <phase-id> --evidence command_output:<path>"
    emit_block "$REASON"
    exit 0
    ;;
  *)
    if truthy "${SVC_COMPLETION_FAIL_OPEN:-false}"; then
      echo "svc completion guard: unexpected parser status '$STATUS', fail-open enabled" >&2
      exit 0
    fi
    emit_block "SVC COMPLETION GUARD: unexpected parser status '$STATUS'. Stop blocked until task-state enforcement is repaired."
    exit 0
    ;;
esac

REMAINING=$(node -e 'process.stdout.write(Buffer.from(process.argv[1] || "", "base64").toString("utf8"))' "$REMAINING_B64")

REASON="SVC COMPLETION GUARD (${NEXT}/${MAX}): ${ACTIONABLE} actionable tasks remaining for ${WI}.

Completed: ${COMPLETED}/${TOTAL}
Blocked but not stop-blocking: ${BLOCKED}

Pending tasks:
${REMAINING}

PROGRESS IS NOT COMPLETION. Continue with the next actionable task.
Do not stop until all actionable tasks are completed or the user explicitly says stop.
Context management is not your job — auto-compact handles it.
DO NOT NARRATE what remains. EXECUTE it."

node -e 'console.log(JSON.stringify({ decision: "block", reason: process.argv[1] }))' "$REASON"
