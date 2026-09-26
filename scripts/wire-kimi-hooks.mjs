#!/usr/bin/env node

/**
 * wire-kimi-hooks.mjs — Idempotently merges svc enforcement hooks into a
 * Kimi Code CLI config.toml file.
 *
 * Usage:
 *   node scripts/wire-kimi-hooks.mjs --skills-path <path> [--config <path>] [--dry-run]
 *
 * Called by `setup` after installation for --host kimi. Can also be run
 * standalone to re-wire hooks without a full reinstall.
 *
 * Arguments:
 *   --skills-path <path>   Absolute path to installed skills dir (e.g. ~/.kimi/skills)
 *   --config <path>        Path to kimi config.toml (default: ~/.kimi/config.toml)
 *   --dry-run              Print what would change without writing
 *
 * Exit codes:
 *   0 — success (hooks wired or already present)
 *   1 — error (bad args, unreadable/unwritable config file)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../hooks/lib/enforcement-core.mjs";
import { wrapHookEntries } from "./lib/hook-command.mjs";
import { isKnownManagedCommand } from "../hooks/lib/svc-ownership.mjs";

// WI-487 (F-010): route Kimi's GOVERNED Stop completion guard through the durable
// launcher when it has been materialized (setup runs `svc-migrate-install
// materialize` BEFORE this wirer). A COPIED real file OUTSIDE the checkout means a
// deleted source checkout fails CLOSED. When the launcher is absent the in-checkout
// command is kept (never a broken host command); Kimi's fail_open=true default is
// exactly why the governed guard must not be checkout-bound.
const LAUNCHER_PATH = (() => {
  try {
    const p = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "bin", "svc-enforce");
    return launcherRunnable(p) ? p : null;
  } catch { return null; }
})();
function completionGuardCommand(kimiHooksDir) {
  return LAUNCHER_PATH
    ? `node ${LAUNCHER_PATH} svc-kimi-task-completion-guard`
    : `bash ${kimiHooksDir}/svc-kimi-task-completion-guard.sh`;
}

// ---------------------------------------------------------------------------
// Hook definitions — Kimi uses TOML [[hooks]] arrays
// ---------------------------------------------------------------------------

/**
 * Convert an absolute path under the user's home directory to a portable
 * ~-prefixed path. Leaves other absolute paths unchanged.
 */
function toPortablePath(absolutePath) {
  const home = os.homedir();
  if (absolutePath.startsWith(home + path.sep)) {
    return "~" + absolutePath.slice(home.length);
  }
  return absolutePath;
}

function buildHookEntries(skillsPath) {
  const portablePath = toPortablePath(skillsPath);
  const hooksDir = path.join(portablePath, "hooks");
  const kimiHooksDir = path.join(hooksDir, "kimi");

  const hooks = [
    {
      event: "PreToolUse",
      matcher: "Shell|WriteFile|StrReplaceFile",
      command: `node ${hooksDir}/svc-worktree-isolation-guard.mjs`,
      timeout: 10,
    },
    // ── PreToolUse guards ─────────────────────────────────────────────────────────
    {
      event: "PreToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `bash ${kimiHooksDir}/svc-kimi-workflow-guard.sh --workflow-guard`,
      timeout: 10,
    },
    {
      event: "PreToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `bash ${kimiHooksDir}/svc-kimi-workflow-guard.sh --phase-boundary`,
      timeout: 10,
    },
    {
      event: "PreToolUse",
      matcher: "Shell",
      command: `bash ${kimiHooksDir}/svc-kimi-workflow-guard.sh --bash-guard`,
      timeout: 10,
    },
    {
      event: "PreToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `bash ${kimiHooksDir}/svc-kimi-lane-tasks-pre-validator.sh`,
      timeout: 10,
    },
    // ── G-4 skill-artifact-authenticity (WI-114) ──────────────────────────────────
    {
      event: "PreToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `bash ${kimiHooksDir}/svc-kimi-skill-artifact-authenticity.sh`,
      timeout: 10,
    },
    // ── Branch guard ──────────────────────────────────────────────────────────────
    {
      event: "PreToolUse",
      matcher: "Shell",
      command: `bash ${kimiHooksDir}/svc-kimi-branch-guard.sh`,
      timeout: 10,
    },
    // ── PostToolUse validators ────────────────────────────────────────────────────
    {
      event: "PostToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `bash ${kimiHooksDir}/svc-kimi-lane-tasks-validator.sh`,
      timeout: 10,
    },
    {
      event: "PostToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `bash ${kimiHooksDir}/svc-kimi-stop-quality.sh --accumulate`,
      timeout: 10,
    },
    {
      event: "PreToolUse",
      matcher: "Shell",
      command: `bash ${kimiHooksDir}/svc-kimi-skill-load-enforcer.sh`,
      timeout: 10,
    },
    // ── PostToolUseFailure ────────────────────────────────────────────────────────
    {
      event: "PostToolUseFailure",
      matcher: "WriteFile|StrReplaceFile",
      command: `bash ${kimiHooksDir}/svc-kimi-lane-tasks-failure.sh`,
      timeout: 10,
    },
    // ── Stop guard (GOVERNED — routed through the durable launcher, F-010) ─────────
    {
      event: "Stop",
      matcher: "",
      command: completionGuardCommand(kimiHooksDir),
      timeout: 10,
    },
    // ── UserPromptSubmit pre-flight ───────────────────────────────────────────────
    {
      event: "UserPromptSubmit",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-preflight-guard.sh`,
      timeout: 10,
    },
    // ── SessionStart auto-recovery ────────────────────────────────────────────────
    {
      event: "SessionStart",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-session-start.sh`,
      timeout: 10,
    },
    // ── SessionEnd final checkpoint ───────────────────────────────────────────────
    {
      event: "SessionEnd",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-session-end.sh`,
      timeout: 10,
    },
    // ── StopFailure error logger ──────────────────────────────────────────────────
    {
      event: "StopFailure",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-stop-failure.sh`,
      timeout: 10,
    },
    // ── SubagentStart pre-flight ──────────────────────────────────────────────────
    {
      event: "SubagentStart",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-subagent-start.sh`,
      timeout: 10,
    },
    // ── SubagentStop validation ───────────────────────────────────────────────────
    {
      event: "SubagentStop",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-subagent-stop.sh`,
      timeout: 10,
    },
    // ── Notification context surfacing ────────────────────────────────────────────
    {
      event: "Notification",
      matcher: "permission_prompt|approval_needed",
      command: `bash ${kimiHooksDir}/svc-kimi-notification.sh`,
      timeout: 10,
    },
    // ── Compaction hooks ──────────────────────────────────────────────────────────
    {
      event: "PreCompact",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-pre-compact.sh`,
      timeout: 20,
    },
    {
      event: "PostCompact",
      matcher: "",
      command: `bash ${kimiHooksDir}/svc-kimi-post-compact.sh`,
      timeout: 20,
    },
    // ── Session-contract freshness (audit-session-execution F2) ─────────────────
    {
      event: "PreToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `node ${hooksDir}/svc-session-contract-freshness.mjs`,
      timeout: 10,
    },
    // ── Inertia check: deprecated foundation migrate-vs-extend gate ──────────────
    {
      event: "PreToolUse",
      matcher: "WriteFile|StrReplaceFile",
      command: `node ${hooksDir}/svc-inertia-check.mjs`,
      timeout: 10,
    },
    // ── R-1 lifecycle hooks (WI-116, host-agnostic via WI-123) ───────────────────
    // The 5 .mjs hooks live at hooks/svc-*.mjs (top-level, not under hooks/kimi).
    // Invoked via `node` directly so Kimi gets the same observability coverage
    // as Claude. Soft-warn / observe-only — never block.
    {
      event: "SessionStart",
      matcher: "",
      command: `node ${hooksDir}/svc-session-start-healthcheck.mjs`,
      timeout: 10,
    },
    {
      event: "SessionStart",
      matcher: "",
      command: `SVC_HOST=kimi node ${hooksDir}/svc-origin-orchestrator-prompt.mjs`,
      timeout: 10,
    },
    {
      event: "UserPromptSubmit",
      matcher: "",
      command: `SVC_HOST=kimi node ${hooksDir}/svc-origin-orchestrator-prompt.mjs`,
      timeout: 10,
    },
    {
      event: "UserPromptSubmit",
      matcher: "",
      command: `node ${hooksDir}/svc-prompt-stale-state.mjs`,
      timeout: 10,
    },
    {
      event: "PreCompact",
      matcher: "",
      command: `node ${hooksDir}/svc-pre-compact-snapshot.mjs`,
      timeout: 20,
    },
    {
      event: "SessionEnd",
      matcher: "",
      command: `node ${hooksDir}/svc-session-end-log.mjs`,
      timeout: 10,
    },
    {
      event: "Notification",
      matcher: "",
      command: `node ${hooksDir}/svc-notification-surface.mjs`,
      timeout: 10,
    },
  ];
  return hooks.map((hook) => wrapHookEntries(hook, { skillsPath, host: "kimi", event: hook.event, outerTimeout: 30 }));
}

// ---------------------------------------------------------------------------
// TOML helpers
// ---------------------------------------------------------------------------

function parseToml(tomlText) {
  const lines = tomlText.split("\n");
  const hooks = [];
  let current = null;
  let inArray = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith("[[hooks]]")) {
      if (current) { current._lineEnd = i; hooks.push(current); }
      current = { _lineStart: i };
      inArray = true;
      continue;
    }

    // Any TOML table header ends the current [[hooks]] block. Without this,
    // duplicate pruning can consume unrelated user tables through EOF.
    if (trimmed.startsWith("[")) {
      if (current) { current._lineEnd = i; hooks.push(current); current = null; }
      inArray = false;
      continue;
    }

    if (inArray && current && trimmed.includes("=")) {
      const eqIdx = trimmed.indexOf("=");
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      current[key] = value;
    }
  }
  if (current) { current._lineEnd = lines.length; hooks.push(current); }

  return hooks;
}

/**
 * Normalize a hook command for comparison by expanding ~ to the user's
 * home directory. This ensures absolute and ~-prefixed paths are treated
 * as equal, preventing duplicate hooks when switching path formats.
 */
function normalizeCommand(cmd) {
  if (!cmd) return cmd;
  return cmd.replace(/~\//g, os.homedir() + path.sep);
}

/**
 * Normalize matcher for comparison: treat undefined and empty string as
 * equivalent, since serializeHook omits empty matchers.
 */
function normalizeMatcher(m) {
  return m === undefined || m === "" ? "" : m;
}

function hooksEqual(a, b) {
  return (
    a.event === b.event &&
    normalizeMatcher(a.matcher) === normalizeMatcher(b.matcher) &&
    normalizeCommand(a.command) === normalizeCommand(b.command)
  );
}

function serializeHook(hook) {
  const lines = ["[[hooks]]"];
  if (hook.event) lines.push(`event = "${hook.event}"`);
  if (hook.matcher) lines.push(`matcher = "${hook.matcher}"`);
  if (hook.command) lines.push(`command = ${JSON.stringify(hook.command)}`);
  if (hook.timeout) lines.push(`timeout = ${hook.timeout}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--skills-path" && i + 1 < argv.length) {
      args.skillsPath = argv[++i];
    } else if (argv[i] === "--config" && i + 1 < argv.length) {
      args.configPath = argv[++i];
    } else if (argv[i] === "--dry-run") {
      args.dryRun = true;
    } else if (argv[i] === "--list-all") {
      // Print every hook the wirer would install, regardless of installed
      // state. Useful for structural-replay tests that need a deterministic
      // declaration check independent of the local install state.
      args.listAll = true;
    }
  }
  return args;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Expand a leading ~/ to the user's home directory. Leaves other paths unchanged.
 */
function expandTilde(p) {
  if (p.startsWith("~/")) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

const args = parseArgs(process.argv);

if (!args.skillsPath) {
  console.error("Usage: node wire-kimi-hooks.mjs --skills-path <path> [--config <path>] [--dry-run] [--list-all]");
  process.exit(1);
}

const configPath = args.configPath || path.join(os.homedir(), ".kimi", "config.toml");
const skillsPath = path.resolve(expandTilde(args.skillsPath));

let originalText = "";
if (fs.existsSync(configPath)) {
  originalText = fs.readFileSync(configPath, "utf-8");
} else {
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
}

// WI-487 (F-010): migrate an EXISTING in-checkout Kimi completion-guard command to
// the durable-launcher form when the launcher is materialized. hooksEqual is
// command-keyed, so without this an existing install would keep the checkout-bound
// Stop guard (fail-OPEN on checkout deletion under Kimi's fail_open default).
let kimiGuardMigrated = 0;
if (LAUNCHER_PATH) {
  const migrated = originalText.replace(
    /command = "(?:bash )?[^"]*svc-kimi-task-completion-guard\.sh"/g,
    () => { kimiGuardMigrated++; return `command = "node ${LAUNCHER_PATH} svc-kimi-task-completion-guard"`; }
  );
  if (migrated !== originalText) {
    originalText = migrated;
    if (!args.dryRun) fs.writeFileSync(configPath, originalText);
    console.log(`Migrated ${kimiGuardMigrated} Kimi Stop guard command(s): in-checkout → durable launcher`);
  }
}

const desiredHooks = buildHookEntries(skillsPath);

// --list-all: print every hook the wirer declares, regardless of installed
// state. Used by structural-replay tests that need a deterministic check
// independent of whether hooks are already present in the local config.
if (args.listAll) {
  console.log(`# All ${desiredHooks.length} svc hooks declared by wire-kimi-hooks.mjs:`);
  console.log("");
  console.log(desiredHooks.map(serializeHook).join("\n\n"));
  process.exit(0);
}

// Parse existing hooks. A prior direct->launcher migration can make two formerly
// distinct svc entries identical. Keep exactly one desired entry and remove only
// duplicate svc-owned blocks; user hooks never match a complete desired tuple.
let existingHooks = parseToml(originalText);
function delegatedCommand(command) {
  const encoded = String(command || "").match(/--spec ([A-Za-z0-9_-]+)/)?.[1];
  if (!encoded) return String(command || "");
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")).command || ""; }
  catch { return ""; }
}
const knownCommands = desiredHooks.map((desired) => ({
  event: desired.event,
  matcher: normalizeMatcher(desired.matcher),
  command: normalizeCommand(delegatedCommand(desired.command)),
}));
function isManagedKimiHook(candidate) {
  const command = normalizeCommand(delegatedCommand(candidate.command));
  return knownCommands.some((known) =>
    candidate.event === known.event && normalizeMatcher(candidate.matcher) === known.matcher && command === known.command) ||
    isKnownManagedCommand(candidate.command, skillsPath);
}
if (desiredHooks.every((desired) => existingHooks.some((existing) => hooksEqual(existing, desired))) &&
    existingHooks.filter(isManagedKimiHook).length === desiredHooks.length) {
  console.log("All svc hooks already present in Kimi config. No changes needed.");
  process.exit(0);
}
// Replace all previously wired SVC commands as one catalog. This removes
// legacy direct commands as well as old wrapper versions without touching
// foreign hook tables or their text.
const managedRanges = existingHooks
  .filter(isManagedKimiHook)
  .map((hook) => [hook._lineStart, hook._lineEnd]);
if (managedRanges.length) {
  const lines = originalText.split(/\r?\n/);
  const removed = new Set(managedRanges.flatMap(([start, end]) => Array.from({ length: end - start }, (_, offset) => start + offset)));
  originalText = lines.filter((_, index) => !removed.has(index)).join("\n")
    .replace(/\n?# svc framework hooks \(auto-wired by setup --host kimi\)\n?/g, "\n").trimEnd() + "\n";
  existingHooks = parseToml(originalText);
}
const duplicateRanges = [];
for (const desired of desiredHooks) {
  const matches = existingHooks.filter((hook) => hooksEqual(hook, desired));
  for (const duplicate of matches.slice(1)) duplicateRanges.push([duplicate._lineStart, duplicate._lineEnd]);
}
if (duplicateRanges.length) {
  const lines = originalText.split(/\r?\n/);
  const removed = new Set(duplicateRanges.flatMap(([start, end]) => Array.from({ length: end - start }, (_, offset) => start + offset)));
  originalText = lines.filter((_, index) => !removed.has(index)).join("\n");
  if (!args.dryRun) fs.writeFileSync(configPath, originalText);
  console.log(`Pruned ${duplicateRanges.length} duplicate svc-owned Kimi hook(s)`);
  existingHooks = parseToml(originalText);
}

// Determine which hooks are missing
const missingHooks = desiredHooks.filter((dh) => !existingHooks.some((eh) => hooksEqual(eh, dh)));

if (missingHooks.length === 0) {
  console.log("All svc hooks already present in Kimi config. No changes needed.");
  process.exit(0);
}

const additions = missingHooks.map(serializeHook).join("\n\n");

if (args.dryRun) {
  console.log(`Would append ${missingHooks.length} hook(s) to ${configPath}:`);
  console.log("");
  console.log(additions);
  process.exit(0);
}

// Append to config file (ensure trailing newline)
let newText = originalText;
if (!newText.endsWith("\n")) newText += "\n";
newText += "\n# svc framework hooks (auto-wired by setup --host kimi)\n";
newText += additions;
newText += "\n";

fs.writeFileSync(configPath, newText);
console.log(`Wired ${missingHooks.length} svc hook(s) into ${configPath}`);
