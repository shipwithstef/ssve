#!/usr/bin/env node
// svc-learning-inject — PreToolUse/PostToolUse action-time learning injection (WI-384).
//
// Injects the 1-3 learnings keyed (by their `files` arrays — 89/96 carry them —
// and a Bash-error-class) to the path/command the agent is about to touch, as
// additionalContext with permissionDecision:"allow". ADDITIVE ONLY — never
// blocks. FAIL-OPEN: every dependency is dynamically imported INSIDE the guarded
// main() (Gemini G6 #1 — a top-level import that threw would crash before the
// catch and brick every Edit/Write/Bash). Claude host only.
//
// Side effect (WI-384 AC3): each FRESH fire appends {ts,key,origin} to
// .svc/learning-fires.jsonl (state-io atomic) — the elevation-predicate
// substrate (confidence>=8 AND fires>=3, previously uncomputable).
//
// Authored under explicit user authorization (2026-06-08) to add a new
// hooks/svc-* file past the config-protection guard, for WI-384.

import { join } from "node:path";   // node builtin — safe at module top level
import path from "node:path";

const CAP = 10000;        // additionalContext char cap (host-documented)
const MAX_INJECT = 3;

async function main() {
  // Dynamic imports so a missing/broken repo dep fails OPEN, not a host-bricking crash.
  const { readHookPayload, resolveHookOperation } = await import("./lib/hook-payload.mjs");
  const { loadLearnings, matchByPath, matchByCommand, renderInjection } = await import("./lib/learning-index.mjs");
  const { appendJsonlLine, writeJsonAtomic, readJsonAtomic } = await import("../scripts/state-io.mjs");
  const { resolveSvcStateDir } = await import("./lib/svc-state-dir.mjs");

  const call = readHookPayload();
  if (!call) return;
  const event = (call.raw && (call.raw.hook_event_name || call.raw.hookEventName)) || "";
  const operation = resolveHookOperation(call);
  if (operation.host === "codex" && !operation.scope?.ok) return;
  const cwd = operation.root || call.cwd || process.cwd();
  // WI-452: only inject/persist within an svc-governed repo; never seed .svc in /tmp or a foreign cwd.
  const svcDir = resolveSvcStateDir(cwd);
  if (!svcDir) return;
  const tool = call.toolName;
  const ti = call.toolInput || {};

  const touchedRaw = ti.file_path || ti.path || ti.notebook_path || "";
  const touched = touchedRaw && path.isAbsolute(touchedRaw)
    ? path.relative(cwd, path.resolve(touchedRaw))
    : touchedRaw;
  const command = tool === "Bash" ? (ti.command || "") : "";
  if (!touched && !command) return;

  const learnings = loadLearnings(cwd);
  if (!learnings.length) return;

  let matched = [];
  if (touched) matched = matchByPath(learnings, touched, MAX_INJECT);
  if (matched.length < MAX_INJECT && command) {
    const byCmd = matchByCommand(learnings, command, MAX_INJECT);
    const seen = new Set(matched.map((m) => m.key));
    for (const m of byCmd) { if (!seen.has(m.key) && matched.length < MAX_INJECT) { matched.push(m); seen.add(m.key); } }
  }
  if (!matched.length) return;

  const session = String(call.sessionId || "nosession").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  const memoPath = join(svcDir, `learning-injections-${session}.json`);
  const firesPath = join(svcDir, "learning-fires.jsonl");
  let memo = {};
  try { memo = readJsonAtomic(memoPath) || {}; } catch { memo = {}; }
  const fresh = matched.filter((m) => !memo[m.key]);
  if (!fresh.length) return;

  // Gemini G6 #2: persist the dedup memo FIRST and on its OWN, so dedup holds
  // even if the fires-ledger append fails (else the same learning re-fires every
  // keystroke). Fires are best-effort, each in its own try.
  for (const m of fresh) memo[m.key] = "fired";
  try { writeJsonAtomic(memoPath, memo); } catch { /* memo best-effort */ }
  const ts = new Date().toISOString();
  for (const m of fresh) { try { appendJsonlLine(firesPath, { ts, key: m.key, origin: m.origin, session }); } catch { /* fires best-effort */ } }

  const ctx = renderInjection(fresh).slice(0, CAP);
  const out = event === "PostToolUse"
    ? { hookSpecificOutput: { hookEventName: event, additionalContext: ctx } }
    : { hookSpecificOutput: { hookEventName: event || "PreToolUse", permissionDecision: "allow", additionalContext: ctx } };
  process.stdout.write(JSON.stringify(out));
}

main().catch(() => process.exit(0));               // any error → fail open
process.on("uncaughtException", () => process.exit(0));   // belt + suspenders
