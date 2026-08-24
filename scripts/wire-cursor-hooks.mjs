#!/usr/bin/env node

/**
 * wire-cursor-hooks.mjs — Idempotently merges svc enforcement hooks into
 * Cursor CLI config (~/.cursor/hooks.json).
 *
 * Cursor hook model:
 *   - Events: beforeShellExecution, afterFileEdit, sessionStart, stop
 *   - Command array format: { version: 1, hooks: { event: [ { command: "..." } ] } }
 *   - Exit code 2 = hard block (beforeShellExecution, afterFileEdit, stop)
 *
 * Usage:
 *   node scripts/wire-cursor-hooks.mjs --skills-path <path>
 *                                      [--hooks-file <path>]
 *                                      [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { isUserOwnedCommand } from "../hooks/lib/svc-ownership.mjs"; // WI-562 IP-W2
import { renderCommand } from "../hooks/lib/hook-catalog.mjs"; // WI-562 IP-W3/W-D
import os from "node:os";
import { fileURLToPath } from "node:url";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../hooks/lib/enforcement-core.mjs";

const THIS_FILE = fileURLToPath(import.meta.url);

const DISABLED = new Set(
  (process.env.SVC_DISABLED_HOOKS || "").split(",").map((s) => s.trim()).filter(Boolean)
);
const NODE_CMD = shellQuote(process.env.SVC_NODE_BIN || process.execPath || "node");

function shellQuote(s) {
  return `'${String(s).replace(/'/g, "'\\''")}'`;
}

const LAUNCHER_PATH = (() => {
  try {
    const p = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "bin", "svc-enforce");
    return launcherRunnable(p) ? p : null;
  } catch { return null; }
})();

function stopGuardCommand(hooksDir) {
  return LAUNCHER_PATH
    ? `${NODE_CMD} ${shellQuote(LAUNCHER_PATH)} svc-cursor-task-completion-guard`
    : `bash ${shellQuote(path.join(hooksDir, "cursor", "svc-cursor-task-completion-guard.sh"))}`;
}

export function buildCursorHookEntries(skillsPath) {
  // WI-562 IP-W3/W-D: single-source QUOTED rendering from the hook-catalog lib.
  // Entries below are the canonical cursor set registered in
  // references/host-hook-catalog.json; the renderer quotes every interpolated
  // path so space-bearing install prefixes wire correctly. Full catalog-driven
  // generation (catalog-only additions without code edits) lands in WI-563 —
  // recorded there as part of the cross-host receipt/parity seed corpus.
  const hooksDir = path.join(skillsPath, "hooks");
  const q = (p) => `"${p}"`;   // W-D: quote every interpolated path

  const entries = {
    beforeShellExecution: [],
    afterFileEdit: [],
    sessionStart: [],
    stop: [],
  };

  if (!DISABLED.has("svc-worktree-isolation-guard")) {
    entries.beforeShellExecution.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-worktree-isolation-guard.mjs`)}` });
  }
  if (!DISABLED.has("svc-bash-guard")) {
    // Canonical command from the catalog template, rendered with QUOTED paths.
    entries.beforeShellExecution.push({ command: `${renderCommand("node {NODE_CMD} {HOOKS_DIR}/svc-workflow-guard.mjs --bash-guard", { hooksDir, nodeCmd: NODE_CMD }).replace(`"${NODE_CMD}"`, NODE_CMD)}` });
  }
  if (!DISABLED.has("svc-impact-triad-guard")) {
    entries.beforeShellExecution.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-impact-triad-guard.mjs`)}` });
  }
  if (!DISABLED.has("svc-workflow-guard")) {
    entries.afterFileEdit.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-workflow-guard.mjs`)}` });
  }
  if (!DISABLED.has("svc-lane-tasks-validator")) {
    entries.afterFileEdit.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-lane-tasks-validator.mjs`)}` });
  }
  if (!DISABLED.has("svc-session-contract-freshness")) {
    entries.afterFileEdit.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-session-contract-freshness.mjs`)}` });
  }
  if (!DISABLED.has("svc-skill-artifact-authenticity")) {
    entries.afterFileEdit.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-skill-artifact-authenticity.mjs`)}` });
  }
  if (!DISABLED.has("svc-inertia-check")) {
    entries.afterFileEdit.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-inertia-check.mjs`)}` });
  }
  if (!DISABLED.has("svc-session-start-healthcheck")) {
    entries.sessionStart.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-session-start-healthcheck.mjs`)}` });
  }
  if (!DISABLED.has("svc-learning-preload")) {
    entries.sessionStart.push({ command: `${NODE_CMD} ${q(`${hooksDir}/svc-learning-preload.mjs`)}` });
  }
  if (!DISABLED.has("svc-task-completion-guard")) {
    entries.stop.push({ command: stopGuardCommand(hooksDir) });
  }

  return entries;
}

export function mergeCursorConfig(existingConfig, newEntries) {
  const result = {
    version: existingConfig?.version || 1,
    hooks: { ...(existingConfig?.hooks || {}) },
  };

  for (const [event, hookList] of Object.entries(newEntries)) {
    if (!result.hooks[event]) {
      result.hooks[event] = [];
    }

    // WI-562 IP-W2: retain user-owned hooks via the SHARED predicate.
    const nonSvcHooks = result.hooks[event].filter((item) => {
      const cmd = typeof item === "string"
        ? item
        : item?.command || item?.hooks?.[0]?.command || "";
      return isUserOwnedCommand(cmd);
    });

    const svcEntries = hookList.map((entry) => ({
      matcher: "*",
      hooks: [{ command: entry.command }],
    }));

    result.hooks[event] = [...nonSvcHooks, ...svcEntries];
  }

  return result;
}

export function wireCursor(options = {}) {
  const home = process.env.HOME || os.homedir();
  const skillsPath = options.skillsPath || path.join(home, ".cursor", "skills");
  const hooksFile = options.hooksFile || path.join(home, ".cursor", "hooks.json");
  const dryRun = options.dryRun || false;

  let existing = {};
  if (fs.existsSync(hooksFile)) {
    try {
      existing = JSON.parse(fs.readFileSync(hooksFile, "utf8"));
    } catch (err) {
      // WI-562 IP-W1: a malformed config is NEVER silently reset to {} — that
      // destroyed user hooks irrecoverably (audit HW-2). Abort loudly; the
      // original bytes stay on disk for manual recovery.
      process.stderr.write(
        `wire-cursor-hooks: refusing to wire — ${hooksFile} is not valid JSON (${err.message}).\n` +
        `Fix or remove the file manually; your existing hooks were NOT modified.\n`
      );
      return 1;
    }
  }

  const entries = buildCursorHookEntries(skillsPath);
  const merged = mergeCursorConfig(existing, entries);

  if (dryRun) {
    process.stdout.write(JSON.stringify(merged, null, 2) + "\n");
    return 0;
  }

  fs.mkdirSync(path.dirname(hooksFile), { recursive: true });
  // WI-562 IP-W1: immutable pre-mutation backup before the first write of a
  // run (mirrors the grok wirer posture), then tmp+fsync+rename atomic write.
  const backupPath = `${hooksFile}.pre-migration.bak`;
  if (fs.existsSync(hooksFile) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(hooksFile, backupPath);
  }
  const tmp = `${hooksFile}.${process.pid}.tmp`;
  const payload = JSON.stringify(merged, null, 2) + "\n";
  const fd = fs.openSync(tmp, "w", 0o644);
  try {
    fs.writeFileSync(fd, payload);
    try { fs.fsyncSync(fd); } catch { /* tmpfs may reject fsync */ }
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, hooksFile);
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch {}
    throw err;
  }
  process.stdout.write(`Wired Cursor hooks in ${hooksFile}\n`);
  return 0;
}

function parseArgs(argv) {
  const options = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skills-path" && argv[i + 1]) {
      options.skillsPath = path.resolve(argv[++i]);
    } else if (argv[i] === "--hooks-file" && argv[i + 1]) {
      options.hooksFile = path.resolve(argv[++i]);
    } else if (argv[i] === "--dry-run") {
      options.dryRun = true;
    }
  }
  return options;
}

function isDirectExecution() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(THIS_FILE);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(THIS_FILE);
  }
}

if (isDirectExecution()) {
  const options = parseArgs(process.argv.slice(2));
  process.exit(wireCursor(options));
}
