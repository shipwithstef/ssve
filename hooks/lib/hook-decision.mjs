/**
 * Host-agnostic hook decision serializer.
 *
 * Accepts a normalized decision and emits the correct wire-protocol shape
 * for the target host (Claude / Kimi / Codex / Gemini).
 *
 * Claude Code, Kimi CLI, and Codex CLI all converged on the same modern
 * shape: `{hookSpecificOutput: {hookEventName, permissionDecision, permissionDecisionReason}}`.
 * Gemini CLI uses `{decision: "deny"}` on stdout + strict-pure-stdout rule.
 * All four support exit-code-2-with-stderr as the fallback hard block.
 *
 * Usage:
 *   import { emitDecision, ALLOW, DENY } from "./lib/hook-decision.mjs";
 *   emitDecision({
 *     host: detectHost(),           // "claude" | "kimi" | "codex" | "gemini"
 *     event: "PreToolUse",           // host-local event name
 *     decision: "deny",              // "allow" | "deny" | "ask" | "defer"
 *     reason: "rm -rf blocked",
 *     additionalContext: null,       // optional
 *   });
 *   // Exits with appropriate code.
 */

export const ALLOW = "allow";
export const DENY = "deny";
export const ASK = "ask";
export const DEFER = "defer";

/**
 * Auto-detect host from environment.
 * - Claude Code sets CLAUDE_PROJECT_DIR, CLAUDE_PLUGIN_ROOT, CLAUDE_CODE_REMOTE
 * - Gemini sets GEMINI_PROJECT_DIR, GEMINI_SESSION_ID (CLAUDE_PROJECT_DIR is an alias)
 * - Codex sets CODEX_* (best-effort; docs don't fully enumerate)
 * - Kimi passes via payload not env; no reliable env signal
 * - Explicit override: SVC_HOST=claude|kimi|codex|gemini|opencode|antigravity|cursor wins
 *
 * @returns {"claude"|"kimi"|"codex"|"gemini"|"opencode"|"antigravity"|"cursor"|"unknown"}
 */
export function detectHost() {
  const explicit = process.env.SVC_HOST;
  if (explicit && ["claude", "kimi", "codex", "gemini", "opencode", "antigravity", "cursor", "mimo-code", "grok"].includes(explicit)) {
    return explicit;
  }
  // Gemini sets CLAUDE_PROJECT_DIR as an alias, so check GEMINI_* first.
  if (process.env.GEMINI_PROJECT_DIR || process.env.GEMINI_SESSION_ID) return "gemini";
  if (process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_CODE_REMOTE) return "claude";
  if (process.env.CLAUDE_PROJECT_DIR) return "claude"; // Claude without plugin env
  if (process.env.CODEX_HOME || process.env.CODEX_SESSION_ID) return "codex";
  if (process.env.KIMI_HOME || process.env.KIMI_SESSION_ID) return "kimi";
  if (process.env.GROK_SESSION_ID || process.env.XAI_API_KEY || process.env.GROK_HOME || process.env.GROK_CLI) return "grok";
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_AGENT) return "cursor";
  if (process.env.ANTIGRAVITY) return "antigravity";
  return "unknown";
}

/**
 * Emit a hook decision in the correct wire format for `host` and exit.
 *
 * For allow: exits 0, no output (the universal "just let it happen" signal).
 * For deny: emits host-appropriate JSON on stdout AND exits with host-appropriate code.
 * For ask/defer: emits JSON on stdout, exit 0 (Claude only supports these fully; other
 *   hosts best-effort fall back to allow).
 *
 * Callers that want to block via stderr+exit-2 path should use `blockViaExit` instead.
 */
export function emitDecision({
  host = "unknown",
  event = "PreToolUse",
  decision = ALLOW,
  reason = "",
  additionalContext = null,
  updatedInput = null,
}) {
  // Allow with no extras → nothing to emit; exit 0 silently.
  if (decision === ALLOW && !additionalContext && !updatedInput) {
    process.exit(0);
  }

  // Gemini: strict pure-stdout contract, different top-level shape.
  if (host === "gemini") {
    const out = {};
    if (decision === DENY) out.decision = "deny";
    if (reason) out.reason = reason;
    process.stdout.write(JSON.stringify(out));
    process.exit(decision === DENY ? 2 : 0);
  }

  // Cursor: { permission, user_message, additional_context, updated_input }
  if (host === "cursor") {
    const out = {
      permission: decision === DENY ? "deny" : decision === ASK ? "ask" : "allow",
      ...(reason && { user_message: reason }),
      ...(additionalContext && { additional_context: additionalContext }),
      ...(updatedInput && { updated_input: updatedInput }),
    };
    process.stdout.write(JSON.stringify(out));
    process.exit(0);
  }

  // Codex does not implement Claude's native `ask` permissionDecision.  A
  // Codex PreToolUse hook returning it is rejected by the host before the tool
  // can run.  Preserve the interactive ask contract for Claude, but fail closed
  // as a supported deny for Codex with the same explanatory reason.
  const wireDecision = host === "codex" && decision === ASK ? DENY : decision;
  const wireReason = host === "codex" && decision === ASK
    ? `${reason} Codex has no native ask decision; approve this path through the documented SVC override and retry.`
    : reason;

  // Claude / Kimi / Codex — shared modern shape.
  const out = {
    hookSpecificOutput: {
      hookEventName: event,
      permissionDecision: wireDecision,
      ...(wireReason && { permissionDecisionReason: wireReason }),
      ...(additionalContext && { additionalContext }),
      ...(updatedInput && { updatedInput }),
    },
  };

  process.stdout.write(JSON.stringify(out));
  // For deny: exit 0 with JSON is the correct path (exit 2 would ignore stdout).
  // For hard-abort scenarios, callers use blockViaExit() instead.
  process.exit(0);
}

/**
 * Hard-block via stderr + exit 2. Works identically across all four hosts.
 * Use when the decision cannot be expressed in host-specific JSON, or when
 * the caller explicitly wants the "abort the action" path.
 */
export function blockViaExit(reason) {
  if (reason) process.stderr.write(reason + "\n");
  process.exit(2);
}

/**
 * Map svc canonical event name → host-local event name.
 * Returns null if the host doesn't have an equivalent event.
 */
export function canonicalToHostEvent(canonical, host) {
  const map = {
    claude: {
      "pre-tool-use": "PreToolUse",
      "post-tool-use": "PostToolUse",
      "post-tool-use-failure": "PostToolUseFailure",
      "user-prompt-submit": "UserPromptSubmit",
      "stop": "Stop",
      "session-start": "SessionStart",
      "session-end": "SessionEnd",
      "subagent-start": "SubagentStart",
      "subagent-stop": "SubagentStop",
      "pre-compact": "PreCompact",
      "post-compact": "PostCompact",
      "notification": "Notification",
    },
    kimi: {
      "pre-tool-use": "PreToolUse",
      "post-tool-use": "PostToolUse",
      "post-tool-use-failure": "PostToolUseFailure",
      "user-prompt-submit": "UserPromptSubmit",
      "stop": "Stop",
      "stop-failure": "StopFailure",
      "session-start": "SessionStart",
      "session-end": "SessionEnd",
      "subagent-start": "SubagentStart",
      "subagent-stop": "SubagentStop",
      "pre-compact": "PreCompact",
      "post-compact": "PostCompact",
      "notification": "Notification",
    },
    codex: {
      "pre-tool-use": "PreToolUse",
      "post-tool-use": "PostToolUse",
      "permission-request": "PermissionRequest",
      "user-prompt-submit": "UserPromptSubmit",
      "stop": "Stop",
      "session-start": "SessionStart",
    },
    gemini: {
      "pre-tool-use": "BeforeTool",
      "post-tool-use": "AfterTool",
      "pre-tool-selection": "BeforeToolSelection",
      "pre-agent": "BeforeAgent",
      "post-agent": "AfterAgent",
      "pre-model": "BeforeModel",
      "post-model": "AfterModel",
      "session-start": "SessionStart",
      "session-end": "SessionEnd",
      "pre-compact": "PreCompress",
      "notification": "Notification",
    },
    cursor: {
      "pre-tool-use": "beforeShellExecution",
      "post-tool-use": "afterFileEdit",
      "session-start": "sessionStart",
      "stop": "stop",
    },
    grok: {
      "pre-tool-use": "PreToolUse",
      "post-tool-use": "PostToolUse",
      "post-tool-use-failure": "PostToolUseFailure",
      "user-prompt-submit": "UserPromptSubmit",
      "stop": "Stop",
      "stop-failure": "StopFailure",
      "session-start": "SessionStart",
      "session-end": "SessionEnd",
    },
  };
  return (map[host] && map[host][canonical]) || null;
}
