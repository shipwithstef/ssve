#!/usr/bin/env node
// svc-owner-inject — PreToolUse action-time INTENDED-OWNER routing (WI-392).
//
// When the agent is about to run a command (or touch a path) that belongs to a
// task-class with a registered OWNER — deploy->base44-environment, browser-verify
// ->Playwright browse mode, per-project app owners — inject a routing reminder as
// additionalContext with permissionDecision:"allow". ADDITIVE ONLY — never
// blocks (identical safety profile to the verified WI-361 rule injector and the
// WI-384 learning injector). FAIL-OPEN: every dependency is dynamically imported
// INSIDE the guarded main() (a top-level import that threw would crash before the
// catch and brick every Edit/Write/Bash — the WI-384 Gemini-G6 #1 lesson).
// Claude host only.
//
// Owner registry: skills-manifest.json `ownersRegistry.entries` (AC3: one row per
// mapping) + project `.svc/task-owners.json` (AC2: exempt-class, project apps).
//
// Authored under explicit user authorization (2026-06-08) to add a new
// hooks/svc-* file past the config-protection guard, for WI-392.

import { join } from "node:path";   // node builtin — safe at module top level
import path from "node:path";

const CAP = 10000;      // additionalContext char cap (host-documented)
const MAX_INJECT = 2;   // never inject more than 2 owner reminders at one action
const MEMO_LOCK_MS = 250;   // Codex G6 F1: bound the memo write — never spin the 5s default on the hot path

async function main() {
  // Dynamic imports so a missing/broken repo dep fails OPEN, not host-bricking.
  const { readHookPayload, extractCommand, extractFilePath, resolveHookOperation } = await import("./lib/hook-payload.mjs");
  const { loadOwners, matchOwners, renderInjection } = await import("./lib/owner-index.mjs");
  const { writeJsonAtomic, readJsonAtomic } = await import("../scripts/state-io.mjs");
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

  // Action target: a Bash command (the primary signal — deploy/curl/probe) or a
  // touched path (Edit/Write of a deploy config etc.).
  const command = tool === "Bash" ? extractCommand(ti) : "";
  const touchedRaw = (tool === "Edit" || tool === "Write") ? extractFilePath(ti) : "";
  const touched = touchedRaw && path.isAbsolute(touchedRaw)
    ? path.relative(cwd, path.resolve(touchedRaw))
    : touchedRaw;
  if (!command && !touched) return;

  const owners = loadOwners(cwd);
  if (!owners.length) return;

  const matched = matchOwners(owners, { command, touchedPath: touched }, MAX_INJECT);
  if (!matched.length) return;

  // Per-session dedup so the same owner reminder doesn't re-fire every command
  // (memo is machine-local + gitignored, like the rule/learning injectors').
  const session = String(call.sessionId || "nosession").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48);
  const memoPath = join(svcDir, `owner-injections-${session}.json`);
  let memo = {};
  try { memo = readJsonAtomic(memoPath) || {}; } catch { memo = {}; }
  const keyOf = (o) => o.task_class + "|" + o.owner;
  const fresh = matched.filter((o) => !memo[keyOf(o)]);
  if (!fresh.length) return;

  // Codex G6 F1: bound the memo write (per-session/single-writer; a STALE .lock
  // would otherwise spin the default 5s on this hot path) and SKIP the injection
  // if it can't persist — emitting after a failed/slow write would re-fire the
  // same reminder on every command. Fail-open + no-hang + no-spam.
  for (const o of fresh) memo[keyOf(o)] = "fired";
  let persisted = false;
  try { writeJsonAtomic(memoPath, memo, { timeoutMs: MEMO_LOCK_MS }); persisted = true; } catch { /* could not persist */ }
  if (!persisted) return;

  const ctx = renderInjection(fresh).slice(0, CAP);
  const out = event === "PostToolUse"
    ? { hookSpecificOutput: { hookEventName: event, additionalContext: ctx } }
    : { hookSpecificOutput: { hookEventName: event || "PreToolUse", permissionDecision: "allow", additionalContext: ctx } };
  process.stdout.write(JSON.stringify(out));
}

main().catch(() => process.exit(0));               // any error → fail open
process.on("uncaughtException", () => process.exit(0));   // belt + suspenders
