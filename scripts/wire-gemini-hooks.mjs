#!/usr/bin/env node

/**
 * wire-gemini-hooks.mjs — Idempotently merges svc enforcement hooks into
 * Gemini CLI settings.json.
 *
 * Gemini hook model:
 *   - 11 events, Pre/Post renamed to Before/After:
 *       BeforeTool / AfterTool / BeforeToolSelection
 *       BeforeAgent / AfterAgent / BeforeModel / AfterModel
 *       SessionStart / SessionEnd / PreCompress / Notification
 *   - JSON stdin → pure JSON stdout (stderr for all logging)
 *   - Exit 2 with stderr for hard block
 *   - timeout in MILLISECONDS (not seconds)
 *   - Env vars: GEMINI_PROJECT_DIR, GEMINI_SESSION_ID, GEMINI_CWD,
 *     CLAUDE_PROJECT_DIR (alias)
 *   - Decision format: {"decision": "deny"} on stdout
 *
 * Usage:
 *   node scripts/wire-gemini-hooks.mjs --skills-path <path>
 *                                      [--settings <path>]
 *                                      [--dry-run]
 *                                      [--remove-company-session-hooks]
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../hooks/lib/enforcement-core.mjs";

const DISABLED = new Set(
  (process.env.SVC_DISABLED_HOOKS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

// WI-487 (F-001): route the governed Stop guard through the durable launcher
// when it is materialized; keep the in-checkout command otherwise.
const LAUNCHER_PATH = (() => {
  try {
    const p = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "bin", "svc-enforce");
    return launcherRunnable(p) ? p : null;
  } catch { return null; }
})();
function completionGuardCommand(hooksDir) {
  // Fallback keeps the exact stdin-preserving direct form; the launcher form ALSO
  // preserves stdin (bin/svc-enforce.mjs forwards fd 0 to the delegated guard).
  return LAUNCHER_PATH
    ? `node ${LAUNCHER_PATH} svc-task-completion-guard`
    : `bash ${hooksDir}/svc-task-completion-guard.sh`;
}

// ---------------------------------------------------------------------------
// svc hook registry — Gemini subset
// Event names are Gemini-local. Timeouts in ms.
// ---------------------------------------------------------------------------

function buildHookEntries(skillsPath) {
  const hooksDir = path.join(skillsPath, "hooks");

  const entries = {
    BeforeTool: [],
    AfterTool: [],
    SessionStart: [],
    SessionEnd: [],
    PreCompress: [],
    Notification: [],
    UserPromptSubmit: [],
  };

  // Default-checkout isolation must run before every other mutation gate.
  if (!DISABLED.has("svc-worktree-isolation-guard")) {
    entries.BeforeTool.push({
      matcher: "run_shell_command|shell|write_file|replace|edit",
      hooks: [{
        name: "svc-worktree-isolation-guard",
        type: "command",
        command: `node ${hooksDir}/svc-worktree-isolation-guard.mjs`,
        timeout: 10000,
      }],
    });
  }

  // Loop guard — applies to all tools
  if (!DISABLED.has("svc-loop-guard")) {
    entries.BeforeTool.push({
      matcher: ".*",
      hooks: [
        {
          name: "svc-loop-guard",
          type: "command",
          command: `node ${hooksDir}/svc-loop-guard.mjs`,
          timeout: 10000,
        },
      ],
    });
  }

  // Workflow guard — Bash-ish commands. Gemini tool names are snake_case.
  if (!DISABLED.has("svc-workflow-guard")) {
    entries.BeforeTool.push({
      matcher: "run_shell_command|shell",
      hooks: [
        {
          name: "svc-bash-guard",
          type: "command",
          command: `node ${hooksDir}/svc-workflow-guard.mjs --bash-guard`,
          timeout: 10000,
        },
      ],
    });

    entries.BeforeTool.push({
      matcher: "write_file|replace|edit",
      hooks: [
        {
          name: "svc-phase-boundary",
          type: "command",
          command: `node ${hooksDir}/svc-workflow-guard.mjs --phase-boundary`,
          timeout: 10000,
        },
      ],
    });
  }

  if (!DISABLED.has("svc-skill-artifact-authenticity")) {
    entries.BeforeTool.push({
      matcher: "write_file|replace|edit",
      hooks: [{
        name: "svc-skill-artifact-authenticity",
        type: "command",
        command: `node ${hooksDir}/svc-skill-artifact-authenticity.mjs`,
        timeout: 10000,
      }],
    });
  }

  if (!DISABLED.has("svc-session-contract-freshness")) {
    entries.BeforeTool.push({
      matcher: "write_file|replace|edit",
      hooks: [{
        name: "svc-session-contract-freshness",
        type: "command",
        command: `node ${hooksDir}/svc-session-contract-freshness.mjs`,
        timeout: 10000,
      }],
    });
  }

  if (!DISABLED.has("svc-inertia-check")) {
    entries.BeforeTool.push({
      matcher: "write_file|replace|edit",
      hooks: [{
        name: "svc-inertia-check",
        type: "command",
        command: `node ${hooksDir}/svc-inertia-check.mjs`,
        timeout: 10000,
      }],
    });
  }

  if (!DISABLED.has("svc-workflow-guard")) {
    entries.BeforeTool.push({
      matcher: "write_file|replace|edit",
      hooks: [{
        name: "svc-workflow-guard",
        type: "command",
        command: `node ${hooksDir}/svc-workflow-guard.mjs`,
        timeout: 10000,
      }],
    });
  }

  if (!DISABLED.has("svc-branch-guard")) {
    entries.BeforeTool.push({
      matcher: "run_shell_command|shell",
      hooks: [{
        name: "svc-branch-guard",
        type: "command",
        command: `bash ${hooksDir}/kimi/svc-kimi-branch-guard.sh`,
        timeout: 10000,
      }],
    });
  }

  if (!DISABLED.has("svc-skill-load-enforcer")) {
    entries.BeforeTool.push({
      matcher: "run_shell_command|shell",
      hooks: [{
        name: "svc-skill-load-enforcer",
        type: "command",
        command: `bash ${hooksDir}/kimi/svc-kimi-skill-load-enforcer.sh`,
        timeout: 10000,
      }],
    });
  }

  // SessionStart — learning preload
  if (!DISABLED.has("svc-learning-preload")) {
    entries.SessionStart.push({
      matcher: "startup|resume",
      hooks: [
        {
          name: "svc-learning-preload",
          type: "command",
          command: `node ${hooksDir}/svc-learning-preload.mjs`,
          timeout: 10000,
        },
      ],
    });
  }

  if (!DISABLED.has("svc-cos-briefing") && fs.existsSync(path.join(hooksDir, "cos-briefing.mjs"))) {
    entries.SessionStart.push({
      matcher: "startup|resume",
      hooks: [{
        name: "svc-cos-briefing",
        type: "command",
        command: `node ${hooksDir}/cos-briefing.mjs --format gemini`,
        timeout: 10000,
      }],
    });
  }

  if (!DISABLED.has("svc-delta-preload") && fs.existsSync(path.join(hooksDir, "svc-delta-preload.mjs"))) {
    entries.SessionStart.push({
      matcher: "startup|resume",
      hooks: [{
        name: "svc-delta-preload",
        type: "command",
        command: `node ${hooksDir}/svc-delta-preload.mjs --format gemini`,
        timeout: 10000,
      }],
    });
  }

  // Lane-tasks validator — AfterTool on file writes
  if (!DISABLED.has("svc-lane-tasks-validator")) {
    entries.AfterTool.push({
      matcher: "write_file|replace|edit",
      hooks: [
        {
          name: "svc-lane-tasks-validator",
          type: "command",
          command: `node ${hooksDir}/svc-lane-tasks-validator.mjs`,
          timeout: 10000,
        },
      ],
    });
  }

  // Session-contract freshness — BeforeTool on file writes
  if (!DISABLED.has("svc-session-contract-freshness")) {
    entries.BeforeTool.push({
      matcher: "write_file|replace|edit",
      hooks: [
        {
          name: "svc-session-contract-freshness",
          type: "command",
          command: `node ${hooksDir}/svc-session-contract-freshness.mjs`,
          timeout: 10000,
        },
      ],
    });
  }

  // ── R-1 lifecycle hooks (WI-116, host-agnostic via WI-123) ──────────────
  // Gemini event names: SessionStart / SessionEnd / Notification / PreCompress.
  // PreCompress is the Gemini equivalent of Claude's PreCompact (compaction
  // event before context is compressed). Hooks are stdin-agnostic (ignored)
  // and write to .svc/ directly, so they work identically under Gemini.
  // Gemini does NOT list a UserPromptSubmit event — svc-prompt-stale-state
  // is registered under UserPromptSubmit anyway in case future Gemini versions
  // add it; current host will silently ignore unknown event keys.
  if (!DISABLED.has("svc-session-start-healthcheck")) {
    entries.SessionStart.push({
      matcher: "startup|resume",
      hooks: [
        {
          name: "svc-session-start-healthcheck",
          type: "command",
          command: `node ${hooksDir}/svc-session-start-healthcheck.mjs`,
          timeout: 10000,
        },
      ],
    });
  }
  if (!DISABLED.has("svc-session-end-log")) {
    entries.SessionEnd.push({
      matcher: ".*",
      hooks: [
        {
          name: "svc-session-end-log",
          type: "command",
          command: `node ${hooksDir}/svc-session-end-log.mjs`,
          timeout: 10000,
        },
      ],
    });
  }
  if (!DISABLED.has("svc-pre-compact-snapshot")) {
    entries.PreCompress.push({
      matcher: ".*",
      hooks: [
        {
          name: "svc-pre-compact-snapshot",
          type: "command",
          command: `node ${hooksDir}/svc-pre-compact-snapshot.mjs`,
          timeout: 20000,
        },
      ],
    });
  }
  if (!DISABLED.has("svc-notification-surface")) {
    entries.Notification.push({
      matcher: ".*",
      hooks: [
        {
          name: "svc-notification-surface",
          type: "command",
          command: `node ${hooksDir}/svc-notification-surface.mjs`,
          timeout: 10000,
        },
      ],
    });
  }
  // Gemini CLI does not list a UserPromptSubmit event — svc-prompt-stale-state
  // skipped on Gemini until host-side support lands.

  if (!DISABLED.has("svc-stop-quality")) {
    entries.Stop = entries.Stop || [];
    entries.Stop.push({
      matcher: ".*",
      hooks: [{
        name: "svc-stop-quality",
        type: "command",
        command: `node ${hooksDir}/svc-stop-quality.js --check`,
        timeout: 10000,
      }],
    });
  }

  if (!DISABLED.has("svc-task-completion-guard")) {
    entries.Stop = entries.Stop || [];
    entries.Stop.push({
      matcher: ".*",
      hooks: [{
        name: "svc-task-completion-guard",
        type: "command",
        command: completionGuardCommand(hooksDir),
        timeout: 10000,
      }],
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skills-path") args.skillsPath = argv[++i];
    else if (argv[i] === "--settings") args.settingsPath = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--remove-company-session-hooks") args.removeCompanySessionHooks = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.skillsPath) {
  process.stderr.write(
    "Usage: node scripts/wire-gemini-hooks.mjs --skills-path <path> [--settings <path>] [--dry-run] [--remove-company-session-hooks]\n"
  );
  process.exit(1);
}

const skillsPath = args.skillsPath.replace(/^~/, os.homedir());
const settingsPath = (args.settingsPath || path.join(os.homedir(), ".gemini", "settings.json")).replace(/^~/, os.homedir());
const dryRun = args.dryRun ?? false;

// ---------------------------------------------------------------------------
// Load / merge / write
// ---------------------------------------------------------------------------

let settings = {};
if (fs.existsSync(settingsPath)) {
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  } catch (err) {
    process.stderr.write(`Failed to parse ${settingsPath}: ${err.message}\n`);
    process.exit(1);
  }
}

// Global host settings are shared by every session. Preserve a one-shot
// recovery copy before any mutation, including explicit hook removal.
let backupDone = false;
function backupSettingsOnce() {
  if (backupDone || dryRun || !fs.existsSync(settingsPath)) return;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const bak = `${settingsPath}.svc-backup-${ts}`;
  fs.copyFileSync(settingsPath, bak);
  process.stdout.write(`  ✓ backup: ${bak}\n`);
  process.stdout.write(`    restore: cp "${bak}" "${settingsPath}"\n`);
  backupDone = true;
}
if (!settings.hooks) settings.hooks = {};

const COMPANY_SESSION_HOOK_NAMES = new Set(["svc-cos-briefing", "svc-delta-preload"]);
const COMPANY_SESSION_HOOK_FILES = ["cos-briefing.mjs", "svc-delta-preload.mjs"];
function pruneCompanySessionHooks(removeAll = false) {
  let removed = 0;
  const entries = settings.hooks.SessionStart;
  if (!Array.isArray(entries)) return removed;
  for (const entry of entries) {
    if (!Array.isArray(entry.hooks)) continue;
    const before = entry.hooks.length;
    entry.hooks = entry.hooks.filter((hook) => {
      const ownedFile = COMPANY_SESSION_HOOK_FILES.find((file) => hook.command === `node ${path.join(skillsPath, "hooks", file)} --format gemini` || (removeAll && hook.command?.includes(file)));
      const owned = COMPANY_SESSION_HOOK_NAMES.has(hook.name) || Boolean(ownedFile);
      if (!owned) return true;
      if (removeAll) return false;
      return ownedFile ? fs.existsSync(path.join(skillsPath, "hooks", ownedFile)) : false;
    });
    removed += before - entry.hooks.length;
  }
  settings.hooks.SessionStart = entries.filter((entry) => !Array.isArray(entry.hooks) || entry.hooks.length > 0);
  return removed;
}

const removedCompanyHooks = pruneCompanySessionHooks(args.removeCompanySessionHooks === true);
if (args.removeCompanySessionHooks) {
  if (dryRun) {
    process.stdout.write(`  ~ ${removedCompanyHooks} company SessionStart hook(s) would be removed (dry-run)\n`);
    process.exit(0);
  }
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    backupSettingsOnce();
    fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
    process.stdout.write(`  ✓ removed ${removedCompanyHooks} company SessionStart hook(s) from ${settingsPath}\n`);
  } catch (err) {
    process.stderr.write(`Failed to write ${settingsPath}: ${err.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

function isAlreadyWired(existingEntries, name) {
  return existingEntries.some((entry) =>
    entry.hooks?.some((h) => h.name === name)
  );
}

// WI-487 (F-001): migrate an EXISTING in-checkout completion-guard command to the
// durable-launcher form when the launcher is materialized. isAlreadyWired is
// name-keyed, so without this an existing install would keep the checkout-bound
// command (fail-OPEN on checkout deletion).
const hooksDirForMigrate = path.join(skillsPath, "hooks");
let migratedGemini = 0;
if (LAUNCHER_PATH) {
  for (const event of Object.keys(settings.hooks)) {
    if (!Array.isArray(settings.hooks[event])) continue;
    for (const entry of settings.hooks[event]) {
      for (const h of entry.hooks || []) {
        if (h.name === "svc-task-completion-guard" && typeof h.command === "string" &&
            h.command.includes("svc-task-completion-guard.sh") && !h.command.includes("svc-enforce")) {
          h.command = `node ${LAUNCHER_PATH} svc-task-completion-guard`;
          migratedGemini++;
        }
      }
    }
  }
}

const registry = buildHookEntries(skillsPath);
const added = [];
const skipped = [];

for (const [event, newEntries] of Object.entries(registry)) {
  if (!settings.hooks[event]) settings.hooks[event] = [];
  for (const entry of newEntries) {
    const hookName = entry.hooks[0].name;
    if (isAlreadyWired(settings.hooks[event], hookName)) {
      skipped.push(`${event}/${hookName}`);
    } else {
      settings.hooks[event].push(entry);
      added.push(`${event}/${hookName}`);
    }
  }
}

for (const s of skipped) process.stdout.write(`  ✓ ${s} already wired — skipped\n`);
if (migratedGemini > 0) process.stdout.write(`  ✓ migrated svc-task-completion-guard: in-checkout→durable-launcher x${migratedGemini}\n`);
if (removedCompanyHooks > 0) process.stdout.write(`  ✓ pruned missing company SessionStart hooks x${removedCompanyHooks}\n`);

if (added.length === 0 && migratedGemini === 0 && removedCompanyHooks === 0) {
  process.stdout.write(`  ✓ All svc hooks already present in ${settingsPath}\n`);
  process.exit(0);
}

if (dryRun) {
  for (const a of added) process.stdout.write(`  ~ ${a} would be added (dry-run)\n`);
  process.exit(0);
}

try {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  backupSettingsOnce();
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);
} catch (err) {
  process.stderr.write(`Failed to write ${settingsPath}: ${err.message}\n`);
  process.exit(1);
}

for (const a of added) process.stdout.write(`  ✓ ${a} wired into ${settingsPath}\n`);
