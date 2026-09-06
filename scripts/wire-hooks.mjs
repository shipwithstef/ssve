#!/usr/bin/env node

/**
 * wire-hooks.mjs — Idempotently merges svc enforcement hooks into a
 * Claude Code settings.json file.
 *
 * Usage:
 *   node scripts/wire-hooks.mjs --skills-path <path> [--settings <path>] [--dry-run]
 *
 * Called by `setup` after installation. Can also be run standalone to
 * re-wire hooks without a full reinstall (e.g., after settings.json is reset).
 *
 * Arguments:
 *   --skills-path <path>   Absolute path to installed skills dir (e.g. ~/.claude/skills)
 *   --settings <path>      Path to settings.json (default: ~/.claude/settings.json)
 *   --dry-run              Print what would change without writing
 *   --remove-company-session-hooks
 *                          Remove only WI-507 company SessionStart hooks
 *
 * Exit codes:
 *   0 — success (hooks wired or already present)
 *   1 — error (bad args, unreadable/unwritable settings file)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../hooks/lib/enforcement-core.mjs";
import { isSvcOwnedCommand } from "../hooks/lib/svc-ownership.mjs"; // WI-562 IP-W2: shared ownership predicate

// ---------------------------------------------------------------------------
// Profile control
// ---------------------------------------------------------------------------

const PROFILE = process.env.SVC_HOOK_PROFILE || "full";
const DISABLED = new Set(
  (process.env.SVC_DISABLED_HOOKS || "").split(",").map((s) => s.trim()).filter(Boolean)
);

// ---------------------------------------------------------------------------
// WI-487 (F-001): the durable enforcement launcher. When it has been
// materialized (setup runs `svc-migrate-install materialize` BEFORE this wirer),
// every GOVERNED-MUTATION guard command is rewritten to invoke the launcher —
// a COPIED real file OUTSIDE the guarded checkout — so a deleted source checkout
// fails CLOSED instead of open. When the launcher is NOT present (non-durable
// source / materialization skipped), the in-checkout command is kept and the
// guard's own in-file pre-check remains the layer (never a broken host command).
// ---------------------------------------------------------------------------
function resolveLauncher() {
  try {
    const root = resolveStateRoot(process.env);
    const p = path.join(root, "enforcement", MIGRATION_VERSION, "bin", "svc-enforce");
    return launcherRunnable(p) ? p : null;
  } catch {
    return null;
  }
}
const LAUNCHER_PATH = resolveLauncher();
// The governed Stop guard's routed identity + a matcher that recognizes BOTH the
// launcher form and the legacy in-checkout form for idempotency/migration.
function completionGuardCommand(hooksDir) {
  // Fallback keeps the exact stdin-preserving direct form `bash ${hooksDir}/...`;
  // the launcher form ALSO preserves stdin (bin/svc-enforce.mjs reads fd 0 and
  // forwards it to the delegated guard).
  return LAUNCHER_PATH
    ? `node ${LAUNCHER_PATH} svc-task-completion-guard`
    : `bash ${hooksDir}/svc-task-completion-guard.sh`;
}
function isCompletionGuardCmd(cmd) {
  if (!cmd) return false;
  if (cmd.includes("svc-task-completion-guard.sh")) return true;
  return cmd.includes("svc-enforce") && cmd.includes("svc-task-completion-guard");
}

// ---------------------------------------------------------------------------
// Hook definitions — add new svc hooks here, not in setup
// ---------------------------------------------------------------------------

function buildHookEntries(skillsPath) {
  const hooksDir = path.join(skillsPath, "hooks");
  const scriptsDir = path.join(skillsPath, "scripts");

  const entries = {
    PreToolUse: [],
    PostToolUse: [],
    PostToolUseFailure: [],
    Stop: [],
    UserPromptSubmit: [],
    SessionStart: [],
    SessionEnd: [],
    StopFailure: [],
    SubagentStart: [],
    SubagentStop: [],
    PreCompact: [],
    PostCompact: [],
    Notification: [],
  };

  // ── PreToolUse guards ─────────────────────────────────────────────────────

  // WI-FW-HOOKS-SAFETY-01 (AC-6/FP-07): ONE deny-capable pre-tool decision
  // engine per host event. The engine classifies observation vs mutation once
  // against the immutable original input, then runs every policy guard as an
  // in-process child on the governed path ONLY — a rewritten read can never be
  // re-classified as an unbound mutation by a sibling hook, and hook ordering
  // no longer affects any security decision. The former direct wirings for
  // svc-worktree-isolation-guard / svc-workflow-guard (+ --bash-guard /
  // --phase-boundary) / svc-loop-guard (Bash|Edit|Write side) /
  // svc-skill-artifact-authenticity / svc-session-contract-freshness /
  // svc-inertia-check are consolidated here; their ids live on in the engine's
  // child registry and remain individually disableable via SVC_DISABLED_HOOKS.
  if (!DISABLED.has("svc-codex-pretool-dispatcher")) {
    entries.PreToolUse.push({
      id: "svc-pretool-decision-engine",
      matcher: "Bash|Edit|Write|MultiEdit|StrReplaceFile|NotebookEdit|apply_patch",
      hooks: [{ type: "command", command: `SVC_HOST=claude node ${hooksDir}/codex/svc-codex-pretool-dispatcher.mjs` }],
    });
  }

  // WI-481: early feedback at task-completion/commit commands via TaskUpdate.
  // The Bash side of this guard runs inside the decision engine's child list;
  // only the tool-specific TaskUpdate matcher stays separately wired.
  if (!DISABLED.has("svc-impact-triad-guard")) {
    entries.PreToolUse.push({
      id: "svc-impact-triad-guard",
      matcher: "TaskUpdate",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-impact-triad-guard.mjs` }],
    });
  }

  // Loop guard keeps ONLY its Agent-tool coverage here; Bash/Edit/Write loop
  // detection runs inside the engine's child list.
  if (!DISABLED.has("svc-loop-guard")) {
    entries.PreToolUse.push({
      id: "svc-loop-guard-agent",
      matcher: "Agent",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-loop-guard.mjs` }],
    });
  }

  if (!DISABLED.has("svc-eval-gate-pre")) {
    entries.PreToolUse.push({
      id: "svc-eval-gate-pre",
      matcher: "TaskUpdate",
      hooks: [{ type: "command", command: `node ${scriptsDir}/eval-gate.mjs pre` }],
    });
  }

  if (!DISABLED.has("svc-preflight-skill")) {
    entries.PreToolUse.push({
      id: "svc-preflight-skill",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${scriptsDir}/preflight.mjs --hook --fail-closed` }],
    });
  }

  // (WI-FW-HOOKS-SAFETY-01) The legacy Bash|Edit|Write loop-guard wiring is
  // consolidated into the decision engine above; only the Agent matcher stays.

  // ── PostToolUse validators ────────────────────────────────────────────────

  // WI-FW-HOOKS-SAFETY-01 (AC-5): replay-safe post-tool correlation — a
  // successful call may heartbeat only through the one-time pre-tool receipt
  // for the exact authorized tuple. Never grants authority.
  if (!DISABLED.has("svc-posttool-heartbeat")) {
    entries.PostToolUse.push({
      id: "svc-posttool-heartbeat",
      matcher: "Bash|Edit|Write|MultiEdit|StrReplaceFile|NotebookEdit|apply_patch",
      hooks: [{ type: "command", command: `SVC_HOST=claude node ${hooksDir}/codex/svc-codex-posttool-heartbeat.mjs` }],
    });
  }

  if (!DISABLED.has("svc-eval-gate-post")) {
    entries.PostToolUse.push({
      id: "svc-eval-gate-post",
      matcher: "TaskUpdate",
      hooks: [{ type: "command", command: `node ${scriptsDir}/eval-gate.mjs post` }],
    });
  }

  if (PROFILE !== "minimal" && !DISABLED.has("svc-edit-accumulator")) {
    entries.PostToolUse.push({
      id: "svc-edit-accumulator",
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-stop-quality.js --accumulate` }],
    });
  }

  // WI-361: rule injector — PRIMARY pre-edit injection (NOT async: PreToolUse
  // must respond before the tool call so additionalContext lands pre-edit)
  if (!DISABLED.has("svc-rule-injector-edit")) {
    entries.PreToolUse.push({
      id: "svc-rule-injector-edit",
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-rule-injector.mjs` }],
    });
  }
  if (!DISABLED.has("svc-rule-injector-bash")) {
    entries.PreToolUse.push({
      id: "svc-rule-injector-bash",
      matcher: "Bash",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-rule-injector.mjs` }],
    });
  }
  // WI-363: phase-receipt auto-emission (sync — Stop-guard reads receipts
  // immediately; observable-evidence phases only, judgment stays manual)
  if (!DISABLED.has("svc-phase-receipt-autoemit-edit")) {
    entries.PostToolUse.push({
      id: "svc-phase-receipt-autoemit-edit",
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-phase-receipt-autoemit.mjs` }],
    });
  }
  if (!DISABLED.has("svc-phase-receipt-autoemit-bash")) {
    entries.PostToolUse.push({
      id: "svc-phase-receipt-autoemit-bash",
      matcher: "Bash",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-phase-receipt-autoemit.mjs` }],
    });
  }

  if (!DISABLED.has("svc-rule-injector-explore")) {
    entries.PostToolUse.push({
      id: "svc-rule-injector-explore",
      matcher: "Read|Grep|Glob",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-rule-injector.mjs` }],
    });
  }

  // WI-384: action-time LEARNING injection — inject the 1-3 learnings keyed to
  // the path/command the agent is about to touch (additive; allow + context;
  // never blocks). PreToolUse so the learning lands BEFORE the edit/command.
  if (!DISABLED.has("svc-learning-inject")) {
    entries.PreToolUse.push({
      id: "svc-learning-inject",
      matcher: "Edit|Write|Bash",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-learning-inject.mjs` }],
    });
  }

  // WI-392: action-time INTENDED-OWNER routing — when a command/path belongs to a
  // task-class with a registered owner (deploy→base44-environment, browser-verify
  // →Playwright browse mode, per-project app owners), inject "route through the
  // owner" (additive; allow + context; never blocks). PreToolUse so the reminder
  // lands BEFORE the wrong-approach command runs.
  if (!DISABLED.has("svc-owner-inject")) {
    entries.PreToolUse.push({
      id: "svc-owner-inject",
      matcher: "Edit|Write|Bash",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-owner-inject.mjs` }],
    });
  }

  if (PROFILE !== "minimal" && !DISABLED.has("svc-vibe-auditor")) {
    entries.PostToolUse.push({
      id: "svc-vibe-auditor",
      matcher: "Edit|Write",
      // async: observational auditor — never blocks (docs-verified 2026-06-07)
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-vibe-auditor.js`, async: true }],
    });
  }

  if (!DISABLED.has("svc-lane-tasks-validator")) {
    entries.PostToolUse.push({
      id: "svc-lane-tasks-validator",
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-lane-tasks-validator.mjs` }],
    });
  }

  if (PROFILE !== "minimal" && !DISABLED.has("svc-wi-pillars-check")) {
    entries.PostToolUse.push({
      id: "svc-wi-pillars-check",
      matcher: "Edit|Write",
      hooks: [{ type: "command", command: `bash ${hooksDir}/svc-wi-pillars-check.sh` }],
    });
  }

  if (!DISABLED.has("svc-auto-capture-learnings")) {
    entries.PostToolUse.push({
      id: "svc-auto-capture-learnings",
      matcher: "Edit|Write",
      // async: observational capture — never blocks (docs-verified 2026-06-07)
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-auto-capture-learnings.mjs --trigger post-tool-use`, async: true }],
    });
  }

  // ── PostToolUseFailure ────────────────────────────────────────────────────

  // ── Stop guards ───────────────────────────────────────────────────────────

  if (PROFILE !== "minimal" && !DISABLED.has("svc-stop-quality")) {
    entries.Stop.push({
      id: "svc-stop-quality",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-stop-quality.js --check` }],
    });
  }

  if (PROFILE !== "minimal" && !DISABLED.has("svc-verification-delegation-guard")) {
    entries.Stop.push({
      id: "svc-verification-delegation-guard",
      matcher: "*",
      hooks: [{ type: "command", command: `bash ${hooksDir}/svc-verification-delegation-guard.sh` }],
    });
  }

  if (!DISABLED.has("svc-task-completion-guard")) {
    entries.Stop.push({
      id: "svc-task-completion-guard",
      matcher: "*",
      // F-001: routed through the durable launcher when materialized; in-checkout otherwise.
      hooks: [{ type: "command", command: completionGuardCommand(hooksDir) }],
    });
  }

  if (!DISABLED.has("svc-auto-capture-learnings")) {
    entries.Stop.push({
      id: "svc-auto-capture-learnings",
      matcher: "*",
      // async: observational capture at stop — Stop is docs-verified async-safe;
      // the blocking svc-stop-quality --check entry stays synchronous.
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-auto-capture-learnings.mjs --trigger stop`, async: true }],
    });
  }

  // ── UserPromptSubmit pre-flight ───────────────────────────────────────────

  // ── SessionStart auto-recovery ────────────────────────────────────────────

  if (!DISABLED.has("svc-learning-preload")) {
    entries.SessionStart.push({
      id: "svc-learning-preload",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-learning-preload.mjs` }],
    });
  }

  if (!DISABLED.has("svc-cos-briefing") && fs.existsSync(path.join(hooksDir, "cos-briefing.mjs"))) {
    entries.SessionStart.push({
      id: "svc-cos-briefing",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/cos-briefing.mjs` }],
    });
  }

  if (!DISABLED.has("svc-delta-preload") && fs.existsSync(path.join(hooksDir, "svc-delta-preload.mjs"))) {
    entries.SessionStart.push({
      id: "svc-delta-preload",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-delta-preload.mjs` }],
    });
  }

  // ── SessionEnd final checkpoint ───────────────────────────────────────────

  // ── StopFailure error logger ──────────────────────────────────────────────

  // ── SubagentStart pre-flight ──────────────────────────────────────────────

  // ── SubagentStop validation ───────────────────────────────────────────────

  // ── Compaction hooks ──────────────────────────────────────────────────────

  // ── Notification context surfacing ────────────────────────────────────────

  // ── G-4 skill-artifact-authenticity (WI-114) ──────────────────────────────
  // WI-FW-HOOKS-SAFETY-01: svc-skill-artifact-authenticity,
  // svc-session-contract-freshness, and svc-inertia-check are deny-capable
  // children INSIDE the single decision engine above — no direct Edit|Write
  // wiring remains, so no request is ever classified twice. The ids stay
  // enumerated here for the cross-host gate validator and remain recognized
  // as MUST gates via the engine's child registry.
  const CONSOLIDATED_INTO_ENGINE = new Set([
    "svc-skill-artifact-authenticity",
    "svc-session-contract-freshness",
    "svc-inertia-check",
  ]);
  void CONSOLIDATED_INTO_ENGINE;

  // ── R-1 lifecycle hooks (WI-116) — host-agnostic observability ────────────
  // Soft warn / observe-only. Wired here so all four cross-host gate IDs
  // resolve to a real entry on Claude.
  if (!DISABLED.has("svc-session-start-healthcheck")) {
    entries.SessionStart.push({
      id: "svc-session-start-healthcheck",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-session-start-healthcheck.mjs` }],
    });
  }

  // ── Zombie-session sweeper (WI-393) — SOFT, observe-only ──────────────────
  // Scans prior session transcripts and emits a learning-candidate row for any
  // session that produced zero work (all-error output-limit/API loop). Never
  // blocks. Implementation lives under scripts/ (config-protection treats the
  // hooks/svc-* glob as a protected hot path).
  if (!DISABLED.has("svc-zombie-session-sweep")) {
    entries.SessionStart.push({
      id: "svc-zombie-session-sweep",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${scriptsDir}/zombie-session-sweep.mjs` }],
    });
  }

  if (!DISABLED.has("svc-prompt-stale-state")) {
    entries.UserPromptSubmit.push({
      id: "svc-prompt-stale-state",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-prompt-stale-state.mjs` }],
    });
  }

  if (!DISABLED.has("svc-pre-compact-snapshot")) {
    entries.PreCompact.push({
      id: "svc-pre-compact-snapshot",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-pre-compact-snapshot.mjs` }],
    });
  }

  if (!DISABLED.has("svc-auto-capture-learnings")) {
    entries.PreCompact.push({
      id: "svc-auto-capture-learnings",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-auto-capture-learnings.mjs --trigger pre-compact` }],
    });
  }

  if (!DISABLED.has("svc-session-end-log")) {
    entries.SessionEnd.push({
      id: "svc-session-end-log",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-session-end-log.mjs` }],
    });
  }

  if (!DISABLED.has("svc-notification-surface")) {
    entries.Notification.push({
      id: "svc-notification-surface",
      matcher: "*",
      hooks: [{ type: "command", command: `node ${hooksDir}/svc-notification-surface.mjs` }],
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
    else if (argv[i] === "--list-all") args.listAll = true;
    else if (argv[i] === "--remove-company-session-hooks") args.removeCompanySessionHooks = true;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

if (!args.skillsPath) {
  process.stderr.write(
    "Usage: node scripts/wire-hooks.mjs --skills-path <path> [--settings <path>] [--dry-run] [--list-all] [--remove-company-session-hooks]\n"
  );
  process.exit(1);
}

const skillsPath = args.skillsPath.replace(/^~/, os.homedir());
const settingsPath = args.settingsPath
  ? args.settingsPath.replace(/^~/, os.homedir())
  : path.join(os.homedir(), ".claude", "settings.json");
const dryRun = args.dryRun ?? false;
const listAll = args.listAll ?? false;

// --list-all: print every hook the wirer declares, regardless of installed
// state. Used by structural-replay tests that need a deterministic check
// independent of whether hooks are already present in the local config.
if (listAll) {
  const registry = buildHookEntries(skillsPath);
  let total = 0;
  for (const list of Object.values(registry)) total += list.length;
  process.stdout.write(`# All ${total} svc hooks declared by wire-hooks.mjs:\n\n`);
  process.stdout.write(JSON.stringify({ hooks: registry }, null, 2));
  process.stdout.write("\n");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Read existing settings
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
function writeSettingsDocument(target, value) {
  // WI-562 IP-W1: uniform atomic write policy — tmp + fsync + rename. A crash
  // mid-write leaves the prior settings intact instead of a truncated file.
  const tmp = `${target}.svc-wire-${process.pid}.tmp`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  const fd = fs.openSync(tmp, "w", 0o644);
  try {
    fs.writeFileSync(fd, payload);
    try { fs.fsyncSync(fd); } catch { /* tmpfs may reject fsync; rename is still atomic */ }
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, target);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
}

if (!settings.hooks) settings.hooks = {};

const COMPANY_SESSION_HOOK_FILES = ["cos-briefing.mjs", "svc-delta-preload.mjs"];
function pruneCompanySessionHooks(removeAll = false) {
  let removed = 0;
  const entries = settings.hooks.SessionStart;
  if (!Array.isArray(entries)) return removed;
  for (const entry of entries) {
    if (!Array.isArray(entry.hooks)) continue;
    const before = entry.hooks.length;
    entry.hooks = entry.hooks.filter((hook) => {
      const reservedId = entry.id === "svc-cos-briefing" ? "cos-briefing.mjs" : entry.id === "svc-delta-preload" ? "svc-delta-preload.mjs" : null;
      const ownedFile = COMPANY_SESSION_HOOK_FILES.find((file) => reservedId === file || hook.command === `node ${path.join(skillsPath, "hooks", file)}` || (removeAll && hook.command?.includes(file)));
      return !ownedFile || (!removeAll && fs.existsSync(path.join(skillsPath, "hooks", ownedFile)));
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
    writeSettingsDocument(settingsPath, settings);
    process.stdout.write(`  ✓ removed ${removedCompanyHooks} company SessionStart hook(s) from ${settingsPath}\n`);
  } catch (err) {
    process.stderr.write(`Failed to write ${settingsPath}: ${err.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

// Rebuild framework-owned commands from the current catalog. Keep each foreign
// command and its enclosing metadata, including mixed managed/user entries.
// Generic framework scripts do not use the svc- prefix: recognize only their
// exact configured source path, never an arbitrary matching basename.
function stripSvcOwnedHooks(hooks) {
  const genericPaths = [
    "scripts/eval-gate.mjs", "scripts/preflight.mjs", "hooks/cos-briefing.mjs",
    "scripts/zombie-session-sweep.mjs",
  ].map(rel => path.join(skillsPath, rel));
  const owned = command => {
    if (isSvcOwnedCommand(command)) return true;
    const tokens = String(command || "").match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g) || [];
    const argv = tokens.map(token => token.replace(/^(['"])(.*)\1$/, "$2"));
    while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0] || "")) argv.shift();
    return path.basename(argv[0] || "") === "node" && genericPaths.includes(argv[1]);
  };
  for (const [event, entries] of Object.entries(hooks)) {
    if (!Array.isArray(entries)) continue;
    hooks[event] = entries.flatMap(entry => {
      if (!Array.isArray(entry.hooks)) return [entry];
      const remaining = entry.hooks.filter(h => !owned(h.command));
      if (remaining.length === entry.hooks.length) return [entry];
      return remaining.length ? [{ ...entry, hooks: remaining }] : [];
    });
  }
}
const hooksBeforeRebuild = JSON.stringify(settings.hooks);
stripSvcOwnedHooks(settings.hooks);
const entries = buildHookEntries(skillsPath);
const added = [];
const skipped = [];
const migrated = JSON.stringify(settings.hooks) !== hooksBeforeRebuild
  ? ["managed-hooks-rebuilt"] : [];
const dedupedCounts = {};
const dedupedV2Counts = {};
for (const [event, catalog] of Object.entries(entries)) {
  if (!settings.hooks[event]) settings.hooks[event] = [];
  for (const { id, ...entry } of catalog) {
    settings.hooks[event].push(entry);
    added.push(`${event}/${id}`);
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

if (migrated.length > 0) {
  for (const m of migrated) {
    process.stdout.write(`  ✓ migrated ${m}\n`);
  }
}

// Report dedup stats (WI-076 + WI-359 v2)
const totalDeduped = Object.values(dedupedCounts).reduce((a, b) => a + b, 0);
const totalDedupedV2 = Object.values(dedupedV2Counts).reduce((a, b) => a + b, 0);
if (totalDeduped > 0) {
  for (const [t, n] of Object.entries(dedupedCounts)) {
    process.stdout.write(`  ✓ dedup: removed ${n} duplicate entries from ${t}\n`);
  }
}

if (added.length === 0 && skipped.length === 0 && migrated.length === 0 && totalDeduped === 0 && totalDedupedV2 === 0) {
  process.stdout.write(`  ✓ No hooks to wire (definitions list is empty)\n`);
  process.exit(0);
}

// If only dedup happened, write the cleaned settings.
if (totalDedupedV2 > 0) {
  for (const [t, n] of Object.entries(dedupedV2Counts)) {
    process.stdout.write(`  ✓ dedup-v2: removed ${n} variant duplicate entries from ${t}\n`);
  }
}

if (added.length === 0 && migrated.length === 0 && (totalDeduped > 0 || totalDedupedV2 > 0) && !dryRun) {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    backupSettingsOnce();
    writeSettingsDocument(settingsPath, settings);
    process.stdout.write(`  ✓ settings written after dedup to ${settingsPath}\n`);
  } catch (err) {
    process.stderr.write(`Failed to write ${settingsPath}: ${err.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

// If only migrations happened, still write out the updated settings.
if (added.length === 0 && migrated.length > 0 && !dryRun) {
  try {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    backupSettingsOnce();
    writeSettingsDocument(settingsPath, settings);
    process.stdout.write(`  ✓ settings written with migrations to ${settingsPath}\n`);
  } catch (err) {
    process.stderr.write(`Failed to write ${settingsPath}: ${err.message}\n`);
    process.exit(1);
  }
  process.exit(0);
}

if (skipped.length > 0) {
  for (const s of skipped) {
    process.stdout.write(`  ✓ ${s} already wired — skipped\n`);
  }
}

if (added.length === 0) {
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

if (dryRun) {
  for (const a of added) {
    process.stdout.write(`  ~ ${a} would be added (dry-run)\n`);
  }
  process.exit(0);
}

try {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  backupSettingsOnce();
  writeSettingsDocument(settingsPath, settings);
} catch (err) {
  process.stderr.write(`Failed to write ${settingsPath}: ${err.message}\n`);
  process.exit(1);
}

for (const a of added) {
  process.stdout.write(`  ✓ ${a} wired into ${settingsPath}\n`);
}
