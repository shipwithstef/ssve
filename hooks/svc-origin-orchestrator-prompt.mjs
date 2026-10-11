#!/usr/bin/env node
/**
 * UserPromptSubmit / SessionStart (Claude, Grok, Kimi):
 * if the prompt names a WI or project subject, inject origin-orchestrator
 * context and bindIfNeeded. Never blocks. Never launches PLAN/EXEC children.
 * Cursor uses the adapter, not this process.
 */
// Optional: a bundle without the counter simply does not count.
const { failOpen, failOpenAt } = await import("./lib/fail-open.mjs").catch(() => ({ failOpen() {}, failOpenAt() {} }));
import { readFileSync, appendFileSync } from "node:fs";
import { frameworkRoot, frameworkRootContext } from "../scripts/lib/framework-root.mjs";
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
failOpenAt({ cwd: payload.cwd || process.cwd() });

// Session start, every host: say where the framework's files are, so a project session
// runs its scripts from the install instead of concluding they are missing.
const startEvent = String(payload.hook_event_name || payload.hookEventName || "");
let rootContext = null;
if (startEvent === "SessionStart") {
  try {
    const root = frameworkRoot();
    rootContext = frameworkRootContext(root, payload.cwd || process.cwd());
    // Claude Code exports CLAUDE_CODE_SESSION_ID, which a nested `claude -p` inherits from
    // its parent; the framework's scripts read SVC_SESSION_ID first. Export this session's
    // own id from the hook payload so worktree and claim scripts bind to the right session.
    const sid = String(payload.session_id || payload.sessionId || "");
    if (process.env.CLAUDE_ENV_FILE) {
      const lines = [rootContext ? `export SVC_ROOT=${JSON.stringify(root)}` : "", /^[A-Za-z0-9._:-]{1,200}$/.test(sid) ? `export SVC_SESSION_ID=${JSON.stringify(sid)}` : ""].filter(Boolean);
      if (lines.length) appendFileSync(process.env.CLAUDE_ENV_FILE, lines.join("\n") + "\n");
    }
  } catch (error) { failOpen("svc-origin-orchestrator-prompt", error); rootContext = null; }
}

const text = promptText(payload);
if (!text) {
  if (rootContext) { process.stdout.write(`${additionalContextEnvelope("SessionStart", rootContext)}\n`); process.exit(0); }
  empty();
}

const host = String(payload.host || process.env.SVC_HOST || "").toLowerCase();
const event = String(payload.hook_event_name || payload.hookEventName || "UserPromptSubmit");
const cwd = payload.cwd || process.cwd();
let intent = null;
try {
  intent = resolveOriginIntent(text, cwd);
} catch (error) {
  failOpen("svc-origin-orchestrator-prompt", error);
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
  if (result?.reason === "orch_host_invalid" || result?.reason === "orch_intent_gate") {
    const stay = [
      "ORIGIN ORCHESTRATOR: bind refused (" + result.reason + ").",
      "Stay put. Do not dispatch PLAN or EXEC.",
      "Do not tell the user to run a command.",
    ].join("\n");
    process.stdout.write(`${additionalContextEnvelope(event, stay)}\n`);
    process.exit(0);
  }
  if (result?.reason === "orch_foreign" || result?.reason === "orch_default_checkout" || result?.reason === "orch_session_missing") {
    const stay = [
      "ORIGIN ORCHESTRATOR: bind refused (" + result.reason + ").",
      "Stay put. Do not rewrite foreign or default-checkout state.",
      "Do not tell the user to run a command.",
    ].join("\n");
    process.stdout.write(`${additionalContextEnvelope(event, stay)}\n`);
    process.exit(0);
  }
} catch (error) {
  failOpen("svc-origin-orchestrator-prompt", error);
  // never block prompt submit
}

const ctx = [rootContext, originOrchestratorContext(intent, { host, bound })].filter(Boolean).join("\n\n");
process.stdout.write(`${ctx ? additionalContextEnvelope(event, ctx) : "{}"}\n`);
process.exit(0);
