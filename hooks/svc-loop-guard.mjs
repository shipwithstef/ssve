#!/usr/bin/env node

/**
 * svc Loop Guard — PreToolUse hook, host-agnostic.
 *
 * Detects repetitive tool-call patterns that indicate the agent is stuck.
 * Uses deterministic SHA-256 fingerprinting — zero LLM calls.
 *
 * Patterns detected:
 *   - Exact repetition: same tool+args 3× → warning, 5× → block
 *   - Ping-pong: alternating A-B-A-B → warning, continues → block
 *   - No-progress: no git diff change for 10 consecutive meaningful calls → warning
 *
 * Exemptions (legitimately repetitive tools):
 *   - TaskList, TaskOutput, TaskStop (observational tools)
 *
 * State file: .svc/loop-guard-state.json (per-worktree, gitignored).
 *
 * Host-agnostic via hooks/lib/hook-payload.mjs + hook-decision.mjs.
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic } from "../scripts/state-io.mjs";
import {
  pruneExpiredLoopGuardStates,
  shouldPruneLoopGuardState,
} from "./lib/loop-guard-state-lifecycle.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { readHookPayload } = await import(path.join(__dirname, "lib", "hook-payload.mjs"));
const {
  emitDecision, blockViaExit, detectHost, canonicalToHostEvent,
  DENY,
} = await import(path.join(__dirname, "lib", "hook-decision.mjs"));
const { resolveSvcStateDir } = await import(path.join(__dirname, "lib", "svc-state-dir.mjs"));
const { resolveOperationScope } = await import(path.join(__dirname, "lib", "operation-scope.mjs"));
const { isShellTool } = await import(path.join(__dirname, "lib", "shell-tools.mjs"));

// -------------------------------------------------------------------
// Config
// -------------------------------------------------------------------

const EXACT_WARNING_THRESHOLD = 3;
const EXACT_BLOCK_THRESHOLD = 5;
const RESEARCH_WARNING_THRESHOLD = 15;
const RESEARCH_BLOCK_THRESHOLD = 20;
const PINGPONG_WARNING_THRESHOLD = 4;
const PINGPONG_BLOCK_THRESHOLD = 6;
const NO_PROGRESS_WINDOW = 10;
const WINDOW_SIZE = 40;
const EXEMPT_TOOLS = new Set(["TaskList", "TaskOutput", "TaskStop"]);
const RESEARCH_TOOLS = new Set([
  "grep_search",
  "search_web",
  "view_file",
  "list_dir",
  "read_url_content",
]);
// WI-399 A7: state is keyed by session id — two parallel orchestrators in the
// same checkout were polluting each other's repetition fingerprints (false
// loop-blocks; capability audit R7). Falls back to the legacy shared file
// only when the payload carries no session id.
// WI-452: state lives under the resolved svc-repo .svc dir (passed in), never a
// bare cwd-relative ".svc/" (which seeded /tmp/.svc).
function stateFileFor(svcDir, sessionId) {
  const sid = String(sessionId || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  return path.join(svcDir, sid ? `loop-guard-state-${sid}.json` : "loop-guard-state.json");
}

// -------------------------------------------------------------------
// Argument normalization
// -------------------------------------------------------------------

function normalizeArgs(args) {
  if (!args || typeof args !== "object") return "";
  const sorted = Object.keys(args)
    .sort()
    .reduce((acc, k) => {
      const v = args[k];
      acc[k] = v && typeof v === "object" && !Array.isArray(v) ? normalizeArgs(v) : v;
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

function fingerprint(toolName, toolInput) {
  return createHash("sha256")
    .update(toolName + ":" + normalizeArgs(toolInput))
    .digest("hex")
    .slice(0, 16);
}

// -------------------------------------------------------------------
// State
// -------------------------------------------------------------------

function loadState(stateFile) {
  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"));
  } catch {
    return { history: [], warningsIssued: [], lastGitChecksum: null, noProgressCount: 0 };
  }
}

function saveState(stateFile, state) {
  try {
    writeJsonAtomic(stateFile, state);
  } catch { /* fail open */ }
}

// -------------------------------------------------------------------
// Pattern detection
// -------------------------------------------------------------------

function countExactRepetition(history, fp) {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].fp === fp) count++;
    else break;
  }
  return count;
}

function detectPingPong(history) {
  if (history.length < 4) return { detected: false, count: 0 };
  const last4 = history.slice(-4);
  const a = last4[0].fp;
  const b = last4[1].fp;
  if (a === b) return { detected: false, count: 0 };
  const pattern = [a, b, a, b];
  const matches = last4.every((h, i) => h.fp === pattern[i]);
  if (!matches) return { detected: false, count: 0 };

  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const expected = (history.length - 1 - i) % 2 === 0 ? a : b;
    if (history[i].fp === expected) count++;
    else break;
  }
  return { detected: true, count, pair: [a, b] };
}

async function checkNoProgress(state) {
  const recent = state.history.slice(-NO_PROGRESS_WINDOW);
  const meaningful = recent.filter(h => {
    const t = h.tool;
    return isShellTool(t) || t === "Edit" || t === "Write" || t === "StrReplaceFile";
  });
  if (meaningful.length < NO_PROGRESS_WINDOW) return { stuck: false };

  try {
    const { execSync } = await import("node:child_process");
    const diffStat = execSync("git diff --stat 2>/dev/null || true", { encoding: "utf8", timeout: 5000 });
    const checksum = createHash("sha256").update(diffStat).digest("hex").slice(0, 16);

    if (state.lastGitChecksum === checksum) {
      state.noProgressCount = (state.noProgressCount || 0) + 1;
      if (state.noProgressCount >= 2) {
        return { stuck: true, turns: NO_PROGRESS_WINDOW * state.noProgressCount };
      }
    } else {
      state.noProgressCount = 0;
      state.lastGitChecksum = checksum;
    }
    return { stuck: false };
  } catch {
    return { stuck: false };
  }
}

// -------------------------------------------------------------------
// Main
// -------------------------------------------------------------------

async function main() {
  const call = readHookPayload();
  // Fail open on unparseable/empty payloads.
  if (!call) process.exit(0);

  const { toolName, toolInput } = call;
  if (!toolName) process.exit(0);
  if (EXEMPT_TOOLS.has(toolName)) process.exit(0);

  const host = detectHost();
  const event = canonicalToHostEvent("pre-tool-use", host) || "PreToolUse";

  // WI-452: resolve the .svc state dir against the target/repo root. Outside an
  // svc-governed repo (e.g. /tmp scratch, sandbox cwd) → skip loop tracking
  // rather than seed a stray .svc. Loop detection only matters within a repo session.
  const operationHost = call.raw?.host || process.env.SVC_HOST ||
    (process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_CODE_REMOTE || process.env.CLAUDE_PROJECT_DIR ? "claude" : "codex");
  const scope = resolveOperationScope({
    ...call.raw, host: operationHost,
    tool_name: call.toolName, tool_input: call.toolInput, cwd: call.session_cwd || call.cwd,
  });
  const stateRoot = scope.ok
    ? (scope.operation_repository?.worktree_root || scope.operation_cwd || call.session_cwd || call.cwd || process.cwd())
    : (call.session_cwd || call.cwd || process.cwd());
  const svcDir = resolveSvcStateDir(stateRoot);
  if (!svcDir) process.exit(0);

  const fp = fingerprint(toolName, toolInput);
  const stateFile = stateFileFor(svcDir, call.sessionId);
  try {
    if (shouldPruneLoopGuardState(stateFile)) {
      pruneExpiredLoopGuardStates({ svcDir, currentStateFile: stateFile });
    }
  } catch {
    // Stale-state retirement is best-effort maintenance. Loop enforcement
    // continues even if the lifecycle helper itself regresses unexpectedly.
  }
  const state = loadState(stateFile);

  if (state.history.length >= WINDOW_SIZE) {
    state.history = state.history.slice(-WINDOW_SIZE + 1);
  }
  state.history.push({ fp, tool: toolName, time: Date.now() });

  // --- Exact repetition ---
  const exactCount = countExactRepetition(state.history, fp);
  const isResearch = RESEARCH_TOOLS.has(toolName);
  const blockThreshold = isResearch ? RESEARCH_BLOCK_THRESHOLD : EXACT_BLOCK_THRESHOLD;
  const warningThreshold = isResearch ? RESEARCH_WARNING_THRESHOLD : EXACT_WARNING_THRESHOLD;

  if (exactCount >= blockThreshold) {
    saveState(stateFile, state);
    const reason = `LOOP GUARD BLOCK: You have executed the same tool (${toolName}) with identical arguments ${exactCount} times consecutively. This is a loop. You must stop repeating and either:\n1. Invoke the 'research' skill to verify your approach\n2. Change strategy completely\n3. Emit ## TASK BLOCKED with reasoning\n\nRepetition without variation is not progress.`;
    // Hard block via stdout JSON decision (preserves reason in context across hosts).
    blockViaExit(reason);
    return; // unreachable
  }

  if (exactCount >= warningThreshold) {
    const key = `exact-${fp}`;
    if (!state.warningsIssued.includes(key)) {
      state.warningsIssued.push(key);
      process.stderr.write(
        `[SYSTEM WARNING: Loop Guard] You have called ${toolName} with identical arguments ${exactCount} times. If you reach ${blockThreshold}, this tool call will be blocked. Try a different approach or invoke 'research'.\n`
      );
    }
  }

  // --- Ping-pong ---
  const pingPong = detectPingPong(state.history);
  if (pingPong.detected) {
    const last2 = state.history.slice(-2);
    const bothResearch = last2.length === 2 && last2.every(h => RESEARCH_TOOLS.has(h.tool));
    const ppBlockThreshold = bothResearch ? 15 : PINGPONG_BLOCK_THRESHOLD;
    const ppWarningThreshold = bothResearch ? 10 : PINGPONG_WARNING_THRESHOLD;

    if (pingPong.count >= ppBlockThreshold) {
      saveState(stateFile, state);
      const reason = `LOOP GUARD BLOCK: You are oscillating between two actions (${pingPong.count} alternations). This ping-pong pattern indicates you are stuck. You must:\n1. Stop alternating\n2. Invoke the 'research' skill\n3. Or emit ## TASK BLOCKED with reasoning`;
      emitDecision({ host, event, decision: DENY, reason });
      return;
    }
    if (pingPong.count >= ppWarningThreshold) {
      const key = `pingpong-${pingPong.pair.join("-")}`;
      if (!state.warningsIssued.includes(key)) {
        state.warningsIssued.push(key);
        process.stderr.write(
          `[SYSTEM WARNING: Loop Guard] You are alternating between two actions (${pingPong.count} times). Pick one direction or invoke 'research'.\n`
        );
      }
    }
  }

  // --- No-progress (every 10th meaningful call) ---
  const meaningfulCount = state.history.filter(h => {
    const t = h.tool;
    return isShellTool(t) || t === "Edit" || t === "Write" || t === "StrReplaceFile";
  }).length;
  if (meaningfulCount % NO_PROGRESS_WINDOW === 0) {
    const noProgress = await checkNoProgress(state);
    if (noProgress.stuck) {
      const key = `noprogress-${noProgress.turns}`;
      if (!state.warningsIssued.includes(key)) {
        state.warningsIssued.push(key);
        process.stderr.write(
          `[SYSTEM WARNING: Loop Guard] No file changes detected for ${noProgress.turns} consecutive meaningful tool calls. Consider invoking 'research' or emit ## TASK BLOCKED.\n`
        );
      }
    }
  }

  saveState(stateFile, state);
  process.exit(0);
}

main().catch(() => process.exit(0));
