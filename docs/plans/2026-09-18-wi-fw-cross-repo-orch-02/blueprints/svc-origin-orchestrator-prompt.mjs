#!/usr/bin/env node
/**
 * UserPromptSubmit / SessionStart (Claude, Grok, Kimi):
 * if the prompt names a WI or project subject, inject origin-orchestrator
 * context and bindIfNeeded. Never blocks. Never spawns PLAN/EXEC.
 * Cursor uses the adapter, not this process.
 */
import { readFileSync } from "node:fs";
import {
  resolveOriginIntent,
  originOrchestratorContext,
  bindIfNeeded,
} from "../scripts/lib/resolve-named-worktree.mjs";

function promptText(payload) {
  const value = payload.prompt ?? payload.user_prompt ?? payload.content ?? payload.message ?? "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map((p) => (typeof p === "string" ? p : p?.text || "")).join("\n");
  return String(value?.text || "");
}

function additionalContextEnvelope(event, text) {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: event,
      additionalContext: text,
    },
  });
}

function empty() {
  process.stdout.write("{}\n");
  process.exit(0);
}

let raw = "";
try { raw = readFileSync(0, "utf8"); } catch { empty(); }
let payload = {};
try { payload = JSON.parse(raw || "{}"); } catch { payload = {}; }

const text = promptText(payload);
if (!text) empty();

const host = String(payload.host || process.env.SVC_HOST || "").toLowerCase();
const event = String(payload.hook_event_name || payload.hookEventName || "UserPromptSubmit");
const cwd = payload.cwd || process.cwd();
let intent = null;
try {
  intent = resolveOriginIntent(text, cwd);
} catch {
  empty();
}
if (!intent) empty();

let bound = false;
try {
  const result = bindIfNeeded(intent, {
    host,
    cwd,
    sessionId: payload.session_id || payload.sessionId || process.env.CURSOR_SESSION_ID || process.env.GROK_SESSION_ID || process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID,
    request: text,
  });
  bound = Boolean(result?.bound);
  if (result?.reason === "orch_foreign" || result?.reason === "orch_default_checkout" || result?.reason === "orch_session_missing") {
    const stay = [
      "ORIGIN ORCHESTRATOR: bind refused (" + result.reason + ").",
      "Stay put. Do not rewrite foreign or default-checkout state.",
      "Do not tell the user to run a command.",
    ].join("\n");
    process.stdout.write(`${additionalContextEnvelope(event, stay)}\n`);
    process.exit(0);
  }
} catch {
  // never block prompt submit
}

const ctx = originOrchestratorContext(intent, { host, bound });
process.stdout.write(`${ctx ? additionalContextEnvelope(event, ctx) : "{}"}\n`);
process.exit(0);
