/**
 * Host-agnostic hook payload extraction for svc.
 *
 * Normalizes PreToolUse / PostToolUse payloads across Claude Code, Kimi CLI,
 * Codex CLI, and Gemini CLI into one shape:
 *
 *   { toolName, toolInput, sessionId, cwd, raw }
 *
 * Rules:
 *   1. Read JSON from stdin first (universal across all four hosts).
 *   2. Fall back to argv[2] for legacy wiring that passed "$TOOL_INPUT".
 *      Under Claude Code "$TOOL_INPUT" is never expanded, so this is a
 *      fail-open path — we return null rather than block.
 *   3. If we cannot extract a real tool name AND real tool input, return
 *      null. Hooks MUST fail open on null: blocking on ambiguous input is
 *      exactly what caused the loop-guard cascade.
 *
 * Usage:
 *   import { readHookPayload } from "./lib/hook-payload.mjs";
 *   const call = readHookPayload();
 *   if (!call) process.exit(0);
 *   const { toolName, toolInput } = call;
 */

import fs from "node:fs";
import { parsePatchTargets, resolveOperationScope } from "./operation-scope.mjs";

function readStdinSync() {
  if (process.stdin.isTTY) return "";
  const chunks = [];
  const buf = Buffer.alloc(16384);
  let retries = 0;
  while (retries < 500) {
    try {
      const bytesRead = fs.readSync(0, buf, 0, buf.length, null);
      if (bytesRead === 0) {
        break;
      }
      chunks.push(buf.subarray(0, bytesRead).toString("utf8"));
      retries = 0;
    } catch (err) {
      if (err && (err.code === "EAGAIN" || err.code === "EWOULDBLOCK")) {
        retries++;
        const end = Date.now() + 1;
        while (Date.now() < end) {}
        continue;
      }
      break;
    }
  }
  return chunks.join("");
}

function tryParse(raw) {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "$TOOL_INPUT") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

/**
 * @returns {null | {toolName:string, toolInput:object, sessionId:string, cwd:string, raw:object}}
 */
export function readHookPayload() {
  const stdinRaw = readStdinSync();
  const payload = tryParse(stdinRaw) || tryParse(process.argv[2] || "");
  if (!payload || typeof payload !== "object") return null;

  // Tool name — Claude Code uses tool_name; Kimi sometimes uses tool;
  // Codex/Gemini variants observed with toolName/name/event.tool.
  const toolName =
    payload.tool_name ||
    payload.toolName ||
    payload.tool ||
    payload.name ||
    (payload.event && (payload.event.tool_name || payload.event.tool)) ||
    (payload.tool_input && (payload.tool_input.tool_name || payload.tool_input.tool)) ||
    "";

  // Tool input (the args the agent actually passed)
  const toolInput =
    payload.tool_input ||
    payload.toolInput ||
    payload.arguments ||
    payload.args ||
    payload.input ||
    null;

  if (!toolName || !toolInput) return null;

  return {
    toolName,
    toolInput,
    sessionId: payload.session_id || payload.sessionId || payload.session || "",
    cwd: payload.cwd || payload.working_directory || process.cwd(),
    session_cwd: payload.cwd || payload.working_directory || process.cwd(),
    raw: payload,
  };
}

/**
 * Extract a shell command from a Bash tool_input across hosts.
 * Claude:  { command, description }
 * Kimi:    { command } or { cmd } or { shell }
 */
export function extractCommand(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return "";
  return toolInput.command || toolInput.cmd || toolInput.shell || "";
}

/**
 * Extract file_path from Edit/Write/Read-style tool_input across hosts.
 * Claude:  { file_path, old_string, new_string }
 * Kimi:    { file_path } or { path } or { file }
 */
export function extractFilePath(toolInput) {
  return extractFilePaths(toolInput)[0] || "";
}

/** Extract every supported direct and apply_patch path. */
export function extractFilePaths(toolInput) {
  if (!toolInput || typeof toolInput !== "object") return [];
  const paths = [];
  for (const key of ["file_path", "filePath", "path", "file"]) {
    if (typeof toolInput[key] === "string" && toolInput[key].trim()) paths.push(toolInput[key].trim());
  }
  for (const key of ["paths", "file_paths", "filePaths", "files"]) {
    if (!Array.isArray(toolInput[key])) continue;
    for (const value of toolInput[key]) {
      if (typeof value === "string" && value.trim()) paths.push(value.trim());
      else if (value && typeof value === "object") {
        const candidate = value.file_path || value.filePath || value.path || value.file;
        if (typeof candidate === "string" && candidate.trim()) paths.push(candidate.trim());
      }
    }
  }
  const command = extractCommand(toolInput);
  const patch = typeof toolInput.patch === "string" ? toolInput.patch : command;
  paths.push(...parsePatchTargets(patch).map((target) => target.requested));
  return [...new Set(paths)];
}

// Resolve operation context for shared advisory/action-time helpers.  The
// Codex envelope is the only host that may carry an effective per-call cwd;
// Claude keeps its historical payload cwd path so its golden behavior remains
// byte-identical.  A failed Codex scope is returned to the caller rather than
// silently falling back to the session checkout.
export function resolveHookOperation(call, env = process.env) {
  const raw = call?.raw || {};
  const host = String(raw.host || env.SVC_HOST ||
    (env.CLAUDE_PLUGIN_ROOT || env.CLAUDE_CODE_REMOTE || env.CLAUDE_PROJECT_DIR ? "claude" :
      (env.CODEX_HOME || env.CODEX_SESSION_ID ? "codex" : "")) || "").toLowerCase();
  if (host !== "codex") return { host, scope: null, cwd: call?.cwd || process.cwd(), root: call?.cwd || process.cwd() };
  const scope = resolveOperationScope({
    ...raw,
    host: "codex",
    tool_name: call.toolName,
    tool_input: call.toolInput,
    cwd: call.session_cwd || call.cwd,
  }, { host: "codex", env });
  return {
    host,
    scope,
    cwd: scope.operation_cwd || call?.cwd || process.cwd(),
    root: scope.operation_repository?.worktree_root || scope.operation_cwd || call?.cwd || process.cwd(),
  };
}
