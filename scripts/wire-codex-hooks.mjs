#!/usr/bin/env node

/**
 * wire-codex-hooks.mjs — Idempotently merges svc enforcement hooks into
 * Codex CLI config. Writes `.codex/hooks.json` and ensures the
 * `[features] hooks = true` flag is set in `~/.codex/config.toml`.
 *
 * Codex hook model:
 *   - 6 events: SessionStart, PreToolUse, PermissionRequest, PostToolUse,
 *     UserPromptSubmit, Stop
 *   - JSON stdin → JSON stdout (or exit 2 for hard block)
 *   - Tool-event matchers support Bash, apply_patch/Edit/Write, and MCP tools
 *   - Decision format: hookSpecificOutput.permissionDecision (same as
 *     Claude and Kimi)
 *   - Requires feature flag enabled in config.toml
 *
 * Usage:
 *   node scripts/wire-codex-hooks.mjs --skills-path <path>
 *                                     [--hooks-file <path>]
 *                                     [--config <path>]
 *                                     [--dry-run]
 *
 * Arguments:
 *   --skills-path <path>   Absolute path to installed skills dir (e.g., ~/.codex/skills)
 *   --hooks-file <path>    Path to hooks.json (default: ~/.codex/hooks.json)
 *   --config <path>        Path to config.toml (default: ~/.codex/config.toml)
 *   --dry-run              Print what would change without writing
 *
 * Exit codes:
 *   0 — success
 *   1 — error (bad args, unreadable/unwritable files)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../hooks/lib/enforcement-core.mjs";

const PROFILE = process.env.SVC_HOOK_PROFILE || "full";
const DISABLED = new Set(
  (process.env.SVC_DISABLED_HOOKS || "").split(",").map((s) => s.trim()).filter(Boolean)
);
const NODE_CMD = shellQuote(process.env.SVC_NODE_BIN || process.execPath || "node");

function shellQuote(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

// WI-487 (F-001): the durable enforcement launcher, present only after
// materialization. When present, the governed-mutation skill-load enforcer runs
// THROUGH it (fail-closed on a deleted checkout); otherwise the in-checkout
// command is kept (never a broken host command).
const LAUNCHER_PATH = (() => {
  try {
    const p = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "bin", "svc-enforce");
    return launcherRunnable(p) ? p : null;
  } catch { return null; }
})();
function codexEnforcerCommand(codexHooksDir) {
  return LAUNCHER_PATH
    ? `${NODE_CMD} ${shellQuote(LAUNCHER_PATH)} svc-codex-skill-load-enforcer`
    : `${NODE_CMD} ${shellQuote(path.join(codexHooksDir, "svc-codex-skill-load-enforcer.mjs"))}`;
}
function codexDispatcherCommand(codexHooksDir) {
  return LAUNCHER_PATH
    ? `${NODE_CMD} ${shellQuote(LAUNCHER_PATH)} svc-codex-pretool-dispatcher`
    : `${NODE_CMD} ${shellQuote(path.join(codexHooksDir, "svc-codex-pretool-dispatcher.mjs"))}`;
}

// ---------------------------------------------------------------------------
// svc hook registry — Codex subset
//
// Only events Codex actually supports. Codex applies tool matchers to Bash,
// apply_patch (also aliased as Edit/Write), and MCP tools. File-edit guarding
// remains best-effort because apply_patch payloads are patch commands, not
// per-file Edit/Write envelopes.
// ---------------------------------------------------------------------------

function buildHookEntries(skillsPath) {
  const hooksDir = path.join(skillsPath, "hooks");
  const codexHooksDir = path.join(hooksDir, "codex");

  const entries = {
    PreToolUse: [],
    PostToolUse: [],
    UserPromptSubmit: [],
    SessionStart: [],
    Stop: [],
  };

  // Default-checkout isolation must run before every other mutation gate.
  if (!DISABLED.has("svc-worktree-isolation-guard")) {
    entries.PreToolUse.push({
      matcher: "Bash|apply_patch|Edit|Write",
      hooks: [{ type: "command", command: `${NODE_CMD} ${shellQuote(path.join(hooksDir, "svc-worktree-isolation-guard.mjs"))}` }],
    });
  }

  // Bash guard — block --no-verify, commit quality, etc.
  if (!DISABLED.has("svc-bash-guard")) {
    entries.PreToolUse.push({
      matcher: "Bash",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-workflow-guard.mjs --bash-guard` }],
    });
  }

  // Edit/write guard — config protection and phase-boundary checks for
  // apply_patch. Codex also accepts Edit/Write aliases for this matcher.
  if (!DISABLED.has("svc-edit-write-guard")) {
    entries.PreToolUse.push({
      matcher: "apply_patch|Edit|Write",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-workflow-guard.mjs` }],
    });
  }

  // Loop guard — stateful repetition detection for Bash and apply_patch.
  if (!DISABLED.has("svc-loop-guard")) {
    entries.PreToolUse.push({
      matcher: "Bash|apply_patch|Edit|Write",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-loop-guard.mjs` }],
    });
  }

  // G-4 skill-artifact-authenticity — blocks Edit/Write to canonical
  // skill-output paths without recent skill invocation receipt.
  if (!DISABLED.has("svc-skill-artifact-authenticity")) {
    entries.PreToolUse.push({
      matcher: "apply_patch|Edit|Write",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-skill-artifact-authenticity.mjs` }],
    });
  }

  // Session-contract freshness — blocks Edit/Write when contract is stale
  // or skill mismatched. Origin: audit-session-execution F2.
  if (!DISABLED.has("svc-session-contract-freshness")) {
    entries.PreToolUse.push({
      matcher: "apply_patch|Edit|Write",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-session-contract-freshness.mjs` }],
    });
  }

  // Inertia check — block new content that extends deprecated APIs/patterns
  // without an explicit migrate-vs-extend acknowledgement.
  if (!DISABLED.has("svc-inertia-check")) {
    entries.PreToolUse.push({
      matcher: "apply_patch|Edit|Write",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-inertia-check.mjs` }],
    });
  }

  // Codex-native skill load enforcer — exact session/task/worktree/hash proof.
  if (!DISABLED.has("svc-skill-load-enforcer")) {
    entries.PreToolUse.push({
      matcher: "Bash|apply_patch|Edit|Write|mcp__.*",
      // F-001: routed through the durable launcher when materialized.
      hooks: [{ type: "command", command: codexEnforcerCommand(codexHooksDir) }],
    });
  }

  // WI-481: compose after WI-485 exact skill authority. It inspects only git
  // commit commands; do not add another Codex Stop path.
  if (!DISABLED.has("svc-impact-triad-guard")) {
    entries.PreToolUse.push({
      matcher: "Bash",
      hooks: [{ type: "command", command: `${NODE_CMD} ${shellQuote(path.join(hooksDir, "svc-impact-triad-guard.mjs"))}` }],
    });
  }

  // Eval gate pre — TaskUpdate equivalent not available on Codex, skip

  // SessionStart — learning preload
  if (!DISABLED.has("svc-learning-preload")) {
    entries.SessionStart.push({
      matcher: "startup|resume",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-learning-preload.mjs` }],
    });
  }

  // ── R-1 lifecycle hooks (WI-116, host-agnostic via WI-123) ──────────────
  // Only the events Codex actually supports get wired here. Codex does NOT
  // support PreCompact / SessionEnd / Notification — coverage parity not
  // achievable for those without host-side feature additions.
  if (!DISABLED.has("svc-session-start-healthcheck")) {
    entries.SessionStart.push({
      matcher: "startup|resume",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-session-start-healthcheck.mjs` }],
    });
  }
  if (!DISABLED.has("svc-prompt-stale-state")) {
    entries.UserPromptSubmit.push({
      matcher: "*",
      hooks: [{ type: "command", command: `${NODE_CMD} ${hooksDir}/svc-prompt-stale-state.mjs` }],
    });
  }
  if (!DISABLED.has("svc-codex-owner-recovery")) {
    entries.UserPromptSubmit.unshift({
      matcher: "*",
      hooks: [{ type: "command", command: `${NODE_CMD} ${shellQuote(path.join(codexHooksDir, "svc-codex-owner-recovery.mjs"))}` }],
    });
  }
  if (!DISABLED.has("svc-codex-prompt-authority")) {
    entries.UserPromptSubmit.push({
      matcher: "*",
      hooks: [{ type: "command", command: `${NODE_CMD} ${shellQuote(path.join(codexHooksDir, "svc-codex-prompt-authority.mjs"))}` }],
    });
  }
  if (!DISABLED.has("svc-task-completion-guard")) {
    entries.Stop.push({
      matcher: "*",
      hooks: [{ type: "command", command: `${NODE_CMD} ${shellQuote(path.join(codexHooksDir, "svc-codex-stop-firewall.mjs"))}` }],
    });
  }
  // Codex CLI does not support PreCompact   — svc-pre-compact-snapshot skipped.
  // Codex CLI does not support SessionEnd   — svc-session-end-log skipped.
  // Codex CLI does not support Notification — svc-notification-surface skipped.

  entries.PreToolUse = DISABLED.has("svc-codex-pretool-dispatcher") ? entries.PreToolUse : [{
    matcher: "Bash|apply_patch|Edit|Write|mcp__.*",
    // WI-529: the dispatcher is the effective serialized mutation boundary. Route
    // that one command through the durable launcher; its child list still invokes
    // the exact skill-load enforcer once, without a second concurrent host hook.
    hooks: [{ type: "command", command: codexDispatcherCommand(codexHooksDir) }],
  }];
  return entries;
}

// ---------------------------------------------------------------------------
// Arg parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skills-path") args.skillsPath = argv[++i];
    else if (argv[i] === "--hooks-file") args.hooksFile = argv[++i];
    else if (argv[i] === "--config") args.configFile = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
    else if (argv[i] === "--list-all") args.listAll = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.skillsPath) {
  process.stderr.write(
    "Usage: node scripts/wire-codex-hooks.mjs --skills-path <path> [--hooks-file <path>] [--config <path>] [--dry-run] [--list-all]\n"
  );
  process.exit(1);
}

const skillsPath = args.skillsPath.replace(/^~/, os.homedir());
const hooksFile = (args.hooksFile || path.join(os.homedir(), ".codex", "hooks.json")).replace(/^~/, os.homedir());
const configFile = (args.configFile || path.join(os.homedir(), ".codex", "config.toml")).replace(/^~/, os.homedir());
const dryRun = args.dryRun ?? false;
const listAll = args.listAll ?? false;

// --list-all: print every hook the wirer declares, regardless of installed
// state. Used by structural-replay tests that need a deterministic check
// independent of whether hooks are already present in the local config.
if (listAll) {
  const registry = buildHookEntries(skillsPath);
  let total = 0;
  for (const list of Object.values(registry)) total += list.length;
  process.stdout.write(`# All ${total} svc hooks declared by wire-codex-hooks.mjs:\n\n`);
  process.stdout.write(JSON.stringify({ hooks: registry }, null, 2));
  process.stdout.write("\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Enable hooks feature flag in config.toml
// ---------------------------------------------------------------------------

const FEATURE_FLAG_NAME = "hooks";
const LEGACY_FEATURE_FLAG_NAME = "codex_hooks";

function featureTableBounds(lines) {
  const start = lines.findIndex((line) => /^\s*\[features\]\s*$/.test(line));
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^\s*\[.+\]\s*$/.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { start, end };
}

function dispatcherStateKey(hooksConfig) {
  for (const [entryIndex, entry] of (hooksConfig.hooks?.PreToolUse || []).entries()) {
    for (const [hookIndex, hook] of (entry.hooks || []).entries()) {
      if ((hook.command || "").includes("svc-codex-pretool-dispatcher")) {
        return `${path.resolve(hooksFile)}:pre_tool_use:${entryIndex}:${hookIndex}`;
      }
    }
  }
  throw new Error("effective Codex dispatcher position cannot be resolved");
}

function featureFlagCandidate(hooksConfig) {
  let text = "";
  const existed = fs.existsSync(configFile);
  if (existed) text = fs.readFileSync(configFile, "utf8");
  const original = text;

  const lines = text.split(/\n/);
  if (lines.length > 0 && lines.at(-1) === "") lines.pop();
  const bounds = featureTableBounds(lines);

  if (!bounds) {
    if (lines.length > 0) lines.push("");
    lines.push("[features]", `${FEATURE_FLAG_NAME} = true`);
  } else {
    let hasHooksFlag = false;
    for (let i = bounds.start + 1; i < bounds.end; i += 1) {
      if (new RegExp(`^\\s*${LEGACY_FEATURE_FLAG_NAME}\\s*=`).test(lines[i])) {
        lines.splice(i, 1);
        bounds.end -= 1;
        i -= 1;
        continue;
      }
      if (new RegExp(`^\\s*${FEATURE_FLAG_NAME}\\s*=`).test(lines[i])) {
        hasHooksFlag = true;
        lines[i] = `${FEATURE_FLAG_NAME} = true`;
      }
    }
    if (!hasHooksFlag) {
      lines.splice(bounds.start + 1, 0, `${FEATURE_FLAG_NAME} = true`);
    }
  }

  const stateKey = dispatcherStateKey(hooksConfig);
  let inManagedState = false;
  let stateChanged = false;
  for (let i = 0; i < lines.length; i += 1) {
    const section = lines[i].match(/^\s*\[hooks\.state\.("(?:[^"\\]|\\.)*")\]\s*$/);
    if (section) {
      let decoded = "";
      try { decoded = JSON.parse(section[1]); } catch { decoded = ""; }
      inManagedState = decoded === stateKey;
      continue;
    }
    if (/^\s*\[.+\]\s*$/.test(lines[i])) {
      inManagedState = false;
      continue;
    }
    if (inManagedState && /^\s*enabled\s*=\s*false\s*(?:#.*)?$/.test(lines[i])) {
      lines[i] = "enabled = true";
      stateChanged = true;
    }
  }

  text = `${lines.join("\n")}\n`;
  if (text === original) {
    return { changed: false, stateChanged: false, reason: "hooks feature flag and managed dispatcher state already enabled", text, original, existed };
  }
  const actions = [`${dryRun ? "would set" : "set"} [features] hooks = true and remove deprecated codex_hooks`];
  if (stateChanged) actions.push(`${dryRun ? "would enable" : "enabled"} the exact managed dispatcher state`);
  return { changed: true, stateChanged, reason: actions.join("; "), text, original, existed };
}

// ---------------------------------------------------------------------------
// Merge hooks.json
// ---------------------------------------------------------------------------

function commandKey(cmd) {
  if (cmd.includes("svc-codex-pretool-dispatcher")) return "svc-codex-pretool-dispatcher";
  if (cmd.includes("svc-worktree-isolation-guard.mjs")) return "svc-worktree-isolation-guard";
  if (cmd.includes("svc-workflow-guard.mjs --bash-guard")) return "svc-bash-guard";
  if (cmd.includes("svc-workflow-guard.mjs")) return "svc-edit-write-guard";
  if (cmd.includes("svc-loop-guard.mjs")) return "svc-loop-guard";
  if (cmd.includes("svc-learning-preload.mjs")) return "svc-learning-preload";
  if (cmd.includes("svc-session-start-healthcheck.mjs")) return "svc-session-start-healthcheck";
  if (cmd.includes("svc-prompt-stale-state.mjs")) return "svc-prompt-stale-state";
  if (cmd.includes("svc-codex-skill-load-enforcer") || cmd.includes("svc-kimi-skill-load-enforcer.sh")) return "svc-skill-load-enforcer";
  if (cmd.includes("svc-codex-prompt-authority.mjs")) return "svc-codex-prompt-authority";
  if (cmd.includes("svc-codex-stop-firewall.mjs")) return "svc-task-completion-guard";
  if (cmd.includes("svc-skill-artifact-authenticity.mjs")) return "svc-skill-artifact-authenticity";
  if (cmd.includes("svc-session-contract-freshness.mjs")) return "svc-session-contract-freshness";
  if (cmd.includes("svc-inertia-check.mjs")) return "svc-inertia-check";
  if (cmd.includes("svc-impact-triad-guard.mjs")) return "svc-impact-triad-guard";
  if (cmd.includes("svc-task-completion-guard.sh")) return "svc-task-completion-guard";
  return null;
}

function keyOf(entry) {
  const keys = [...new Set((entry.hooks || []).map((hook) => commandKey(hook.command || "")).filter(Boolean))];
  return keys.length === 1 ? keys[0] : null;
}

function normalizeManagedEntries(entries) {
  return entries.flatMap((entry) => {
    const hooks = Array.isArray(entry.hooks) ? entry.hooks : [];
    if (hooks.length <= 1 || !hooks.some((hook) => (hook.command || "").includes("svc-"))) return [entry];
    return hooks.map((hook) => ({ ...entry, hooks: [hook] }));
  });
}

function mergeHooks() {
  let hooksConfig = { hooks: {} };
  let original = "";
  const existed = fs.existsSync(hooksFile);
  if (existed) {
    try {
      original = fs.readFileSync(hooksFile, "utf8");
      hooksConfig = JSON.parse(original);
    } catch (err) {
      throw new Error(`Failed to parse ${hooksFile}: ${err.message}`);
    }
  }
  if (!hooksConfig.hooks) hooksConfig.hooks = {};

  const registry = buildHookEntries(skillsPath);
  const declaredByEvent = new Map(Object.entries(registry).map(([event, entries]) => [event, new Set(entries.map(keyOf).filter(Boolean))]));
  const added = [];
  const skipped = [];
  const updated = [];
  const pruned = [];

  for (const [event, newEntries] of Object.entries(registry)) {
    if (!hooksConfig.hooks[event]) hooksConfig.hooks[event] = [];
    hooksConfig.hooks[event] = normalizeManagedEntries(hooksConfig.hooks[event]);
    hooksConfig.hooks[event] = hooksConfig.hooks[event].filter((entry) => {
      const key = keyOf(entry);
      if (!key || declaredByEvent.get(event)?.has(key)) return true;
      pruned.push(`${event}/${key}`);
      return false;
    });
    for (const entry of newEntries) {
      const key = keyOf(entry);
      const existingIndex = key
        ? hooksConfig.hooks[event].findIndex((existing) => keyOf(existing) === key)
        : -1;
      if (existingIndex >= 0) {
        const existing = hooksConfig.hooks[event][existingIndex];
        if (JSON.stringify(existing) === JSON.stringify(entry)) {
          skipped.push(`${event}/${key}`);
        } else {
          hooksConfig.hooks[event][existingIndex] = entry;
          updated.push(`${event}/${key}`);
        }
      } else {
        hooksConfig.hooks[event].push(entry);
        added.push(`${event}/${key}`);
      }
    }
    const seen = new Set();
    hooksConfig.hooks[event] = hooksConfig.hooks[event].filter((entry) => {
      const key = keyOf(entry);
      const identity = key ? `known:${key}` : `raw:${JSON.stringify(entry)}`;
      if (seen.has(identity)) {
        pruned.push(`${event}/${key || "duplicate"}`);
        return false;
      }
      seen.add(identity);
      return true;
    });
  }

  return { hooksConfig, added, skipped, updated, pruned, original, existed };
}

function backupAdjacent(file) {
  if (!fs.existsSync(file)) return null;
  const backup = `${file}.svc-backup-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(file, backup);
  return backup;
}

function effectiveStopAssertion(candidate) {
  const configs = [candidate];
  const repoRoot = (() => {
    try { return fs.realpathSync(process.cwd()); } catch { return process.cwd(); }
  })();
  const repoHooks = path.join(repoRoot, ".codex", "hooks.json");
  if (path.resolve(repoHooks) !== path.resolve(hooksFile) && fs.existsSync(repoHooks)) {
    try { configs.push(JSON.parse(fs.readFileSync(repoHooks, "utf8"))); } catch (error) { throw new Error(`Failed to parse ${repoHooks}: ${error.message}`); }
  }
  const svcStops = configs.flatMap((config) => config.hooks?.Stop || [])
    .flatMap((entry) => entry.hooks || [])
    .map((hook) => hook.command || "")
    .filter((command) => command.includes("svc-"));
  if (svcStops.length !== 1 || commandKey(svcStops[0]) !== "svc-task-completion-guard" || !svcStops[0].includes("svc-codex-stop-firewall.mjs")) {
    throw new Error(`effective Codex hook view must contain exactly one svc Stop firewall; found ${svcStops.length}`);
  }
}

function atomicReplace(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, text);
  fs.renameSync(temp, file);
}

function restoreFile(file, existed, original) {
  if (existed) atomicReplace(file, original);
  else if (fs.existsSync(file)) fs.unlinkSync(file);
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

let mergeResult;
try {
  mergeResult = mergeHooks();
  const { hooksConfig } = mergeResult;
  effectiveStopAssertion(hooksConfig);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
}
const { hooksConfig, added, skipped, updated, pruned } = mergeResult;
const flagResult = featureFlagCandidate(hooksConfig);
process.stdout.write(`  ${flagResult.changed && dryRun ? "~" : "✓"} ${flagResult.reason} (${configFile})\n`);

for (const s of skipped) process.stdout.write(`  ✓ ${s} already wired — skipped\n`);

if (!flagResult.changed && added.length === 0 && updated.length === 0 && pruned.length === 0) {
  process.stdout.write(`  ✓ All svc hooks already present in ${hooksFile}\n`);
  process.stdout.write(`${JSON.stringify({ configured: true, effective_single_stop: true, trusted: "unknown", runtime_observed: false })}\n`);
  process.exit(0);
}

if (dryRun) {
  for (const a of added) process.stdout.write(`  ~ ${a} would be added (dry-run)\n`);
  for (const u of updated) process.stdout.write(`  ~ ${u} would be updated (dry-run)\n`);
  for (const p of pruned) process.stdout.write(`  ~ ${p} duplicate would be pruned (dry-run)\n`);
  process.exit(0);
}

try {
  const configBackup = flagResult.changed ? backupAdjacent(configFile) : null;
  const hooksBackup = (added.length || updated.length || pruned.length) ? backupAdjacent(hooksFile) : null;
  if (flagResult.changed) atomicReplace(configFile, flagResult.text);
  if (added.length || updated.length || pruned.length) atomicReplace(hooksFile, `${JSON.stringify(hooksConfig, null, 2)}\n`);
  if (configBackup) process.stdout.write(`  ✓ backup created: ${configBackup}\n`);
  if (hooksBackup) process.stdout.write(`  ✓ backup created: ${hooksBackup}\n`);
} catch (err) {
  try { restoreFile(configFile, flagResult.existed, flagResult.original); } catch {}
  try { restoreFile(hooksFile, mergeResult.existed, mergeResult.original); } catch {}
  process.stderr.write(`Failed to write ${hooksFile}: ${err.message}\n`);
  process.exit(1);
}

for (const a of added) process.stdout.write(`  ✓ ${a} wired into ${hooksFile}\n`);
for (const u of updated) process.stdout.write(`  ✓ ${u} updated in ${hooksFile}\n`);
for (const p of pruned) process.stdout.write(`  ✓ ${p} duplicate pruned from ${hooksFile}\n`);
process.stdout.write(`${JSON.stringify({ configured: true, effective_single_stop: true, trusted: "unknown", runtime_observed: false })}\n`);
