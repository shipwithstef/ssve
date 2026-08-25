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
      hooks: [{ type: "command", command: `node ${hooksDir}/codex/svc-codex-pretool-dispatcher.mjs` }],
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
      hooks: [{ type: "command", command: `node ${hooksDir}/codex/svc-codex-posttool-heartbeat.mjs` }],
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
// Idempotency check — is a hook already wired for this event type?
// ---------------------------------------------------------------------------

function isAlreadyWired(existingEntries, hookId) {
  return existingEntries.some((entry) =>
    entry.hooks?.some((h) => {
      const cmd = h.command || "";
      if (hookId === "svc-worktree-isolation-guard") return cmd.includes("svc-worktree-isolation-guard.mjs");
      if (hookId === "svc-workflow-guard") return (cmd.includes("svc-workflow-guard.mjs") || cmd.includes("svc-workflow-guard.js")) && !cmd.includes("--phase-boundary") && !cmd.includes("--bash-guard");
      if (hookId === "svc-phase-boundary-detector") return (cmd.includes("svc-workflow-guard.mjs") || cmd.includes("svc-workflow-guard.js")) && cmd.includes("--phase-boundary");
      if (hookId === "svc-bash-guard") return (cmd.includes("svc-workflow-guard.mjs") || cmd.includes("svc-workflow-guard.js")) && cmd.includes("--bash-guard");
      if (hookId === "svc-eval-gate-pre") return cmd.includes("eval-gate.mjs pre");
      if (hookId === "svc-preflight-skill") return cmd.includes("preflight.mjs") && cmd.includes("--hook");
      if (hookId === "svc-eval-gate-post") return cmd.includes("eval-gate.mjs post");
      if (hookId === "svc-edit-accumulator") return cmd.includes("svc-stop-quality.js") && cmd.includes("--accumulate");
      if (hookId === "svc-vibe-auditor") return cmd.includes("svc-vibe-auditor.js");
      if (hookId === "svc-lane-tasks-validator") return cmd.includes("svc-lane-tasks-validator.mjs");
      if (hookId === "svc-wi-pillars-check") return cmd.includes("svc-wi-pillars-check.sh");
      if (hookId === "svc-auto-capture-learnings") return cmd.includes("svc-auto-capture-learnings.mjs");
      if (hookId === "svc-stop-quality") return cmd.includes("svc-stop-quality.js") && cmd.includes("--check");
      if (hookId === "svc-verification-delegation-guard") return cmd.includes("svc-verification-delegation-guard.sh");
      if (hookId === "svc-task-completion-guard") return isCompletionGuardCmd(cmd);
      if (hookId === "svc-loop-guard") return cmd.includes("svc-loop-guard.mjs");
      if (hookId === "svc-rule-injector-edit") return cmd.includes("svc-rule-injector.mjs") && entry.matcher && /Edit/.test(entry.matcher);
      if (hookId === "svc-rule-injector-bash") return cmd.includes("svc-rule-injector.mjs") && entry.matcher === "Bash";
      if (hookId === "svc-rule-injector-explore") return cmd.includes("svc-rule-injector.mjs") && entry.matcher && /Read/.test(entry.matcher);
      if (hookId === "svc-phase-receipt-autoemit-edit") return cmd.includes("svc-phase-receipt-autoemit.mjs") && entry.matcher && /Edit/.test(entry.matcher);
      if (hookId === "svc-phase-receipt-autoemit-bash") return cmd.includes("svc-phase-receipt-autoemit.mjs") && entry.matcher === "Bash";
      if (hookId === "svc-learning-preload") return cmd.includes("svc-learning-preload.mjs");
      if (hookId === "svc-cos-briefing") return cmd.includes("cos-briefing.mjs");
      if (hookId === "svc-delta-preload") return cmd.includes("svc-delta-preload.mjs");
      if (hookId === "svc-skill-artifact-authenticity") return cmd.includes("svc-skill-artifact-authenticity.mjs");
      if (hookId === "svc-session-contract-freshness") return cmd.includes("svc-session-contract-freshness.mjs");
      if (hookId === "svc-inertia-check") return cmd.includes("svc-inertia-check.mjs");
      if (hookId === "svc-session-start-healthcheck") return cmd.includes("svc-session-start-healthcheck.mjs");
      if (hookId === "svc-prompt-stale-state") return cmd.includes("svc-prompt-stale-state.mjs");
      if (hookId === "svc-pre-compact-snapshot") return cmd.includes("svc-pre-compact-snapshot.mjs");
      if (hookId === "svc-session-end-log") return cmd.includes("svc-session-end-log.mjs");
      if (hookId === "svc-notification-surface") return cmd.includes("svc-notification-surface.mjs");
      return false;
    })
  );
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

// ---------------------------------------------------------------------------
// Migration: scrub stale references to files renamed under WI-072 (.js → .mjs).
// Idempotency check then re-adds the .mjs version. Without this, old installs
// would keep running the deleted .js file.
// ---------------------------------------------------------------------------

// Load rename registry from hooks/.renames.json (WI-076).
// Single source of truth for all `.js → .mjs` and future filename migrations.
// Fallback to hard-coded list if the registry is missing (keeps setup robust
// during fresh clones before WI-076 lands everywhere).
function loadRenamedFiles(skillsPath) {
  const registryPath = path.join(skillsPath, "hooks", ".renames.json");
  if (fs.existsSync(registryPath)) {
    try {
      const reg = JSON.parse(fs.readFileSync(registryPath, "utf8"));
      if (Array.isArray(reg.renames)) return reg.renames.map(({ from, to }) => ({ from, to }));
    } catch (e) {
      process.stderr.write(`Warning: failed to parse ${registryPath}: ${e.message}\n`);
    }
  }
  // Fallback for environments without the registry.
  return [
    { from: "svc-workflow-guard.js", to: "svc-workflow-guard.mjs" },
  ];
}
const RENAMED_FILES = loadRenamedFiles(skillsPath);
const CANONICAL_COMMANDS = [
  {
    id: "svc-task-completion-guard",
    from: path.join(os.homedir(), ".claude", "hooks", "svc-task-completion-guard.sh"),
    to: `bash ${path.join(skillsPath, "hooks", "svc-task-completion-guard.sh")}`,
  },
];

const migrated = [];
if (removedCompanyHooks > 0) migrated.push(`SessionStart:missing-company-hooks-pruned-x${removedCompanyHooks}`);
for (const hookType of Object.keys(settings.hooks)) {
  if (!Array.isArray(settings.hooks[hookType])) continue;
  for (const entry of settings.hooks[hookType]) {
    if (!Array.isArray(entry.hooks)) continue;
    for (const h of entry.hooks) {
      if (!h.command) continue;
      for (const { from, to } of RENAMED_FILES) {
        if (h.command.includes(from)) {
          h.command = h.command.replace(new RegExp(from.replace(/\./g, "\\."), "g"), to);
          migrated.push(`${hookType}:${from}→${to}`);
        }
      }
      for (const { id, from, to } of CANONICAL_COMMANDS) {
        if (h.command.trim() === from) {
          h.command = to;
          migrated.push(`${hookType}:${id}:legacy-path→skills-path`);
        }
      }
      // WI-487 (F-001): migrate an EXISTING in-checkout completion-guard command
      // to the durable-launcher form when the launcher is materialized. Without
      // this, isAlreadyWired skips re-emission and a pre-WI-487 install would keep
      // running the checkout-bound guard (fail-OPEN on checkout deletion).
      if (hookType === "Stop" && LAUNCHER_PATH &&
          h.command.includes("svc-task-completion-guard.sh") &&
          !h.command.includes("svc-enforce")) {
        h.command = `node ${LAUNCHER_PATH} svc-task-completion-guard`;
        migrated.push(`${hookType}:svc-task-completion-guard:in-checkout→durable-launcher`);
      }
      // WI-359: strip stale argv-payload tokens from svc hooks. All svc hooks
      // read stdin first (hooks/lib/hook-payload.mjs, conf-10 learning) — a
      // payload argv token is dead weight AND creates variant-class
      // duplicates that the exact-string dedup below cannot collapse.
      if (/svc-[a-z-]+\.(mjs|js|sh)/.test(h.command) && h.command.includes("$TOOL_INPUT")) {
        const before = h.command;
        // Token-level strip: remove ONLY standalone payload argv tokens (bare,
        // double- or single-quoted). Embedded forms (--arg=$TOOL_INPUT) are
        // intentionally left untouched (G6 EXEC-002).
        h.command = before
          .split(/\s+/)
          .filter((t) => !/^["']?\$TOOL_INPUT["']?$/.test(t))
          .join(" ")
          .trim();
        if (h.command !== before) migrated.push(`${hookType}:argv-payload-canonicalized`);
      }
      // WI-359: adopt async on the 3 observational svc hooks for EXISTING
      // installs — emission carries async for fresh wires, but isAlreadyWired
      // skips re-emission, so already-wired entries would stay synchronous
      // forever without this migration.
      for (const a of [
        { ev: "PostToolUse", re: /svc-vibe-auditor\.js$/ },
        { ev: "PostToolUse", re: /svc-auto-capture-learnings\.mjs --trigger post-tool-use$/ },
        { ev: "Stop", re: /svc-auto-capture-learnings\.mjs --trigger stop$/ },
      ]) {
        if (hookType === a.ev && a.re.test(h.command) && h.async !== true) {
          h.async = true;
          migrated.push(`${hookType}:async-adopted`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

const entries = buildHookEntries(skillsPath);
const added = [];
const skipped = [];

for (const [hookType, newEntries] of Object.entries(entries)) {
  if (!settings.hooks[hookType]) settings.hooks[hookType] = [];

  for (const entry of newEntries) {
    if (isAlreadyWired(settings.hooks[hookType], entry.id)) {
      skipped.push(`${hookType}/${entry.id}`);
    } else {
      // Strip internal id field — settings.json doesn't need it
      const { id: _id, ...settingsEntry } = entry;
      settings.hooks[hookType].push(settingsEntry);
      added.push(`${hookType}/${entry.id}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Generic dedup pass (WI-076) — collapse duplicates that accumulated from
// prior runs where isAlreadyWired had gaps. Safety net: runs AFTER the
// per-hookId check so nothing new gets duplicated; this only removes
// already-existing duplicates that the hookId check missed.
//
// Dedup key: matcher + exact command string. Two entries collapse if they
// have the same matcher AND the same hook command set.
// ---------------------------------------------------------------------------

const dedupedCounts = {};
for (const hookType of Object.keys(settings.hooks)) {
  if (!Array.isArray(settings.hooks[hookType])) continue;
  const seen = new Map(); // key: `matcher|command1|command2|...`, value: first entry
  const deduped = [];
  for (const entry of settings.hooks[hookType]) {
    const matcher = entry.matcher || "";
    const commands = (entry.hooks || [])
      .map((h) => `${h.type || ""}:${h.command || ""}`)
      .sort()
      .join("||");
    const key = `${matcher}||${commands}`;
    if (seen.has(key)) {
      dedupedCounts[hookType] = (dedupedCounts[hookType] || 0) + 1;
      continue;
    }
    seen.set(key, entry);
    deduped.push(entry);
  }
  settings.hooks[hookType] = deduped;
}

// ---------------------------------------------------------------------------
// WI-370: kimi-host scripts do not belong in Claude-written settings — they
// are owned by wire-kimi-hooks.mjs for the kimi host and cost ~300ms each per
// Bash call here (re-measured 2026-06-07). Strip stale installs two-step
// (G2: inner hooks filter, then drop emptied entries).
for (const hookType of Object.keys(settings.hooks)) {
  if (!Array.isArray(settings.hooks[hookType])) continue;
  let removed = 0;
  for (const entry of settings.hooks[hookType]) {
    if (!Array.isArray(entry.hooks)) continue;
    const before = entry.hooks.length;
    // WI-562 IP-W2: kimi-host scripts are svc-owned by the shared predicate
    // (path containment), so strip via ONE classifier instead of a substring.
    entry.hooks = entry.hooks.filter((h) => {
      if (isSvcOwnedCommand(h.command || "") && /hooks\/kimi\//.test(String(h.command))) return false;
      return !h.command?.includes("hooks/kimi/");
    });
    removed += before - entry.hooks.length;
  }
  settings.hooks[hookType] = settings.hooks[hookType].filter((e) => !Array.isArray(e.hooks) || e.hooks.length > 0);
  if (removed > 0) migrated.push(`${hookType}:kimi-host-hooks-removed-x${removed}`);
}

// ---------------------------------------------------------------------------
// Variant-aware dedup (WI-359, dedup-v2) — runs AFTER the WI-076 exact pass.
// Identity per entry: matcher + per-hook [interpreter-stripped script basename
// | sorted bare (non-flag, non-$) args | sorted --flags]. Collapses pairs that
// differ only by payload tokens or path spelling; intentional flag/subcommand
// variants (workflow-guard trio, eval-gate pre/post, stop-quality
// accumulate/check) hash distinctly and survive. Canonical-keep: prefer the
// entry without a payload token; first wins otherwise (deterministic).
// ---------------------------------------------------------------------------
function hookIdentity(cmd) {
  const toks = (cmd || "").trim().split(/\s+/);
  let i = 0;
  if (toks[0] && /^(node|bash|sh)$/.test(path.basename(toks[0]))) i = 1;
  const base = toks[i] ? path.basename(toks[i]) : "";
  // Fuzzy (basename|subs|flags) identity ONLY for framework-owned scripts —
  // two distinct USER hooks may legitimately share a basename across paths
  // (tier-3 WI-359-T3-001). Non-framework hooks: exact-string identity, never
  // fuzzy-collapsed.
  if (!/^(svc-|eval-gate\.|preflight\.)/.test(base)) return (cmd || "").trim();
  const rest = toks.slice(i + 1);
  const flags = rest.filter((t) => t.startsWith("--")).sort().join(",");
  const subs = rest.filter((t) => !t.startsWith("--") && !/^"?\$/.test(t)).sort().join(",");
  return `${base}|${subs}|${flags}`;
}
const dedupedV2Counts = {};
for (const hookType of Object.keys(settings.hooks)) {
  if (!Array.isArray(settings.hooks[hookType])) continue;
  const seenV2 = new Map();
  const dedupedV2 = [];
  for (const entry of settings.hooks[hookType]) {
    const matcher = entry.matcher || "";
    const ident = (entry.hooks || []).map((h) => hookIdentity(h.command)).sort().join("||");
    const key = `${matcher}||${ident}`;
    const prev = seenV2.get(key);
    if (prev) {
      const prevHasPayload = (prev.hooks || []).some((h) => (h.command || "").includes("$TOOL_INPUT"));
      const curHasPayload = (entry.hooks || []).some((h) => (h.command || "").includes("$TOOL_INPUT"));
      if (prevHasPayload && !curHasPayload) {
        dedupedV2[dedupedV2.indexOf(prev)] = entry;
        seenV2.set(key, entry);
      }
      dedupedV2Counts[hookType] = (dedupedV2Counts[hookType] || 0) + 1;
      continue;
    }
    seenV2.set(key, entry);
    dedupedV2.push(entry);
  }
  settings.hooks[hookType] = dedupedV2;
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
