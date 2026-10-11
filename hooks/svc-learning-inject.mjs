#!/usr/bin/env node
// svc-learning-inject — action-time learning injection (WI-384).
//
// Injects the 1-3 learnings keyed (by their `files` arrays — 89/96 carry them —
// and a Bash-error-class) to the path/command the agent is about to touch, as
// additionalContext. ADDITIVE ONLY: it never blocks and never returns a
// permission decision (an "allow" here would skip the host's permission prompt
// for the tool call in enforce mode, and adding context is all this hook does).
// FAIL-OPEN: every dependency is dynamically imported INSIDE the guarded
// collector (Gemini G6 #1 — a top-level import that threw would crash before the
// catch and brick every Edit/Write/Bash).
//
// On Claude this runs inside the single context injector process
// (hooks/svc-rule-injector.mjs imports learningContext); the CLI entry below is
// kept for direct use and other hosts.
//
// Side effect (WI-384 AC3): each FRESH fire appends {ts,key,origin} to
// .svc/learning-fires.jsonl (state-io atomic) — the elevation-predicate
// substrate (confidence>=8 AND fires>=3, previously uncomputable).
//
// Authored under explicit user authorization (2026-06-08) to add a new
// hooks/svc-* file past the config-protection guard, for WI-384.

import { join } from "node:path";   // node builtin — safe at module top level
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const CAP = 10000;        // additionalContext char cap (host-documented)
const MAX_INJECT = 3;

// Returns the context text to inject for this call, or "" (never throws).
export async function learningContext(call) {
  try {
    const { resolveHookOperation } = await import("./lib/hook-payload.mjs");
    const { loadLearningsDetailed, matchByPath, matchByCommand, renderInjection } = await import("./lib/learning-index.mjs");
    const { appendJsonlLine, writeJsonAtomic, readJsonAtomic } = await import("../scripts/state-io.mjs");
    const { resolveSvcStateDir } = await import("./lib/svc-state-dir.mjs");

    if (!call) return "";
    const operation = resolveHookOperation(call);
    if (operation.host === "codex" && !operation.scope?.ok) return "";
    const cwd = operation.root || call.cwd || process.cwd();
    // WI-452: only inject/persist within an svc-governed repo; never seed .svc in /tmp or a foreign cwd.
    const svcDir = resolveSvcStateDir(cwd);
    if (!svcDir) return "";
    const tool = call.toolName;
    const ti = call.toolInput || {};

    const touchedRaw = ti.file_path || ti.path || ti.notebook_path || "";
    const touched = touchedRaw && path.isAbsolute(touchedRaw)
      ? path.relative(cwd, path.resolve(touchedRaw))
      : touchedRaw;
    const command = tool === "Bash" ? (ti.command || "") : "";
    if (!touched && !command) return "";

    const normalized = loadLearningsDetailed(cwd);
    const learnings = normalized.learnings;
    for (const finding of normalized.findings) { try { appendJsonlLine(join(svcDir, "learning-lifecycle.jsonl"), { ts: new Date().toISOString(), event: "malformed", ...finding }); } catch {} }
    if (!learnings.length) return "";

    let matched = [];
    if (touched) matched = matchByPath(learnings, touched, MAX_INJECT);
    if (matched.length < MAX_INJECT && command) {
      const byCmd = matchByCommand(learnings, command, MAX_INJECT);
      const seen = new Set(matched.map((m) => m.key));
      for (const m of byCmd) { if (!seen.has(m.key) && matched.length < MAX_INJECT) { matched.push(m); seen.add(m.key); } }
    }
    if (!matched.length) return "";

    const session = String(call.sessionId || "nosession").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
    const memoPath = join(svcDir, `learning-injections-${session}.json`);
    const firesPath = join(svcDir, "learning-fires.jsonl");
    let memo = {};
    try { memo = readJsonAtomic(memoPath) || {}; } catch { memo = {}; }
    const fresh = matched.filter((m) => !memo[m.key]);
    if (!fresh.length) return "";

    // Gemini G6 #2: persist the dedup memo FIRST and on its OWN, so dedup holds
    // even if the fires-ledger append fails (else the same learning re-fires every
    // keystroke). Fires are best-effort, each in its own try.
    for (const m of fresh) memo[m.key] = "fired";
    try { writeJsonAtomic(memoPath, memo); } catch { /* memo best-effort */ }
    const ts = new Date().toISOString();
    for (const m of fresh) { try { appendJsonlLine(firesPath, { ts, key: m.key, origin: m.origin, session }); } catch { /* fires best-effort */ } }

    return renderInjection(fresh).slice(0, CAP);
  } catch {
    return "";                                       // any error → fail open
  }
}

function invokedDirectly() {
  try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (invokedDirectly()) {
  process.on("uncaughtException", () => process.exit(0));   // belt + suspenders
  (async () => {
    const { readHookPayload } = await import("./lib/hook-payload.mjs");
    const call = readHookPayload();
    const ctx = await learningContext(call);
    if (!ctx) return;
    const event = (call.raw && (call.raw.hook_event_name || call.raw.hookEventName)) || "PreToolUse";
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: ctx } }));
  })().catch(() => process.exit(0));
}
