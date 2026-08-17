#!/usr/bin/env node

/**
 * wire-grok-hooks.mjs — Idempotently merges svc enforcement hooks into
 * Grok Build CLI config (~/.grok/config.toml).
 *
 * Grok hook model:
 *   - Events: PreToolUse, PostToolUse, UserPromptSubmit, Stop, SessionStart, SessionEnd
 *   - Format: TOML [[hooks]] tables
 *   - Exit code 2 = hard block (PreToolUse, Stop)
 *
 * Usage:
 *   node scripts/wire-grok-hooks.mjs --skills-path <path> [--config <path>] [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../hooks/lib/enforcement-core.mjs";

const THIS_FILE = fileURLToPath(import.meta.url);

const DISABLED = new Set(
  (process.env.SVC_DISABLED_HOOKS || "").split(",").map((s) => s.trim()).filter(Boolean)
);
const NODE_CMD = process.env.SVC_NODE_BIN || process.execPath || "node";

const LAUNCHER_PATH = (() => {
  try {
    const p = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "bin", "svc-enforce");
    return launcherRunnable(p) ? p : null;
  } catch { return null; }
})();

function stopGuardCommand(hooksDir) {
  return LAUNCHER_PATH
    ? `${NODE_CMD} ${LAUNCHER_PATH} svc-grok-task-completion-guard`
    : `bash ${hooksDir}/grok/svc-grok-task-completion-guard.sh`;
}

function toPortablePath(absolutePath) {
  const home = os.homedir();
  if (absolutePath.startsWith(home + path.sep)) {
    return "~" + absolutePath.slice(home.length);
  }
  return absolutePath;
}

export function buildGrokHookEntries(skillsPath) {
  const portablePath = toPortablePath(skillsPath);
  const hooksDir = path.join(portablePath, "hooks");

  const hooks = [];

  // Worktree isolation
  if (!DISABLED.has("svc-worktree-isolation-guard")) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Shell|Write|Edit|Bash",
      command: `${NODE_CMD} ${hooksDir}/svc-worktree-isolation-guard.mjs`,
      timeout: 10,
    });
  }

  // Workflow guard (config-protection)
  if (!DISABLED.has("svc-workflow-guard")) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Write|Edit",
      command: `${NODE_CMD} ${hooksDir}/svc-workflow-guard.mjs`,
      timeout: 10,
    });
  }

  // Phase boundary detector
  if (!DISABLED.has("svc-phase-boundary")) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Write|Edit",
      command: `${NODE_CMD} ${hooksDir}/svc-workflow-guard.mjs --phase-boundary`,
      timeout: 10,
    });
  }

  // Bash guard (block-no-verify)
  if (!DISABLED.has("svc-bash-guard")) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Shell|Bash",
      command: `${NODE_CMD} ${hooksDir}/svc-workflow-guard.mjs --bash-guard`,
      timeout: 10,
    });
  }

  // Skill artifact authenticity
  if (!DISABLED.has("svc-skill-artifact-authenticity")) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Write|Edit",
      command: `${NODE_CMD} ${hooksDir}/svc-skill-artifact-authenticity.mjs`,
      timeout: 10,
    });
  }

  // Session contract freshness
  if (!DISABLED.has("svc-session-contract-freshness")) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Write|Edit",
      command: `${NODE_CMD} ${hooksDir}/svc-session-contract-freshness.mjs`,
      timeout: 10,
    });
  }

  // Inertia check
  if (!DISABLED.has("svc-inertia-check")) {
    hooks.push({
      event: "PreToolUse",
      matcher: "Write|Edit",
      command: `${NODE_CMD} ${hooksDir}/svc-inertia-check.mjs`,
      timeout: 10,
    });
  }

  // Lane tasks validator (PostToolUse)
  if (!DISABLED.has("svc-lane-tasks-validator")) {
    hooks.push({
      event: "PostToolUse",
      matcher: "Write|Edit",
      command: `${NODE_CMD} ${hooksDir}/svc-lane-tasks-validator.mjs`,
      timeout: 10,
    });
  }

  // Session start healthcheck
  if (!DISABLED.has("svc-session-start-healthcheck")) {
    hooks.push({
      event: "SessionStart",
      matcher: "*",
      command: `${NODE_CMD} ${hooksDir}/svc-session-start-healthcheck.mjs`,
      timeout: 10,
    });
  }

  // User prompt submit (prompt-stale-state)
  if (!DISABLED.has("svc-prompt-stale-state")) {
    hooks.push({
      event: "UserPromptSubmit",
      matcher: "*",
      command: `${NODE_CMD} ${hooksDir}/svc-prompt-stale-state.mjs`,
      timeout: 10,
    });
  }

  // Session end log
  if (!DISABLED.has("svc-session-end-log")) {
    hooks.push({
      event: "SessionEnd",
      matcher: "*",
      command: `${NODE_CMD} ${hooksDir}/svc-session-end-log.mjs`,
      timeout: 10,
    });
  }

  // Stop completion guard (governed launcher route)
  if (!DISABLED.has("svc-task-completion-guard")) {
    hooks.push({
      event: "Stop",
      matcher: "*",
      command: stopGuardCommand(hooksDir),
      timeout: 30,
    });
  }

  return hooks;
}

function parseExistingToml(content) {
  const nonHookSections = [];
  const existingHooks = [];
  const lines = content.split(/\r?\n/);
  let inHook = false;
  let currentHook = {};
  let currentNonHook = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "[[hooks]]") {
      if (inHook && currentHook.command) {
        existingHooks.push(currentHook);
      }
      if (currentNonHook.length > 0) {
        nonHookSections.push(currentNonHook.join("\n"));
        currentNonHook = [];
      }
      inHook = true;
      currentHook = {};
      continue;
    }

    if (inHook && line.trim().startsWith("[") && line.trim() !== "[[hooks]]") {
      if (currentHook.command) {
        existingHooks.push(currentHook);
      }
      inHook = false;
      currentHook = {};
      currentNonHook.push(line);
      continue;
    }

    if (inHook) {
      const matchStr = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/);
      const matchNum = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*([0-9]+)/);
      const matchBool = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*(true|false)\b/i);
      if (matchStr) {
        try { currentHook[matchStr[1]] = JSON.parse(matchStr[2]); } catch { currentHook[matchStr[1]] = matchStr[2].replace(/^'|'$/g, ""); }
      } else if (matchNum) {
        currentHook[matchNum[1]] = parseInt(matchNum[2], 10);
      } else if (matchBool) {
        currentHook[matchBool[1]] = matchBool[2].toLowerCase() === "true";
      }
    } else {
      currentNonHook.push(line);
    }
  }

  if (inHook && currentHook.command) {
    existingHooks.push(currentHook);
  }
  if (currentNonHook.length > 0) {
    nonHookSections.push(currentNonHook.join("\n"));
  }

  return { nonHookText: nonHookSections.join("\n\n").trim(), existingHooks };
}

function serializeToml(nonHookText, hooks) {
  const blocks = [];
  if (nonHookText) {
    blocks.push(nonHookText);
  }

  for (const h of hooks) {
    const lines = ["[[hooks]]"];
    for (const [k, v] of Object.entries(h)) {
      if (typeof v === "string") lines.push(`${k} = ${JSON.stringify(v)}`);
      else if (typeof v === "number" || typeof v === "boolean") lines.push(`${k} = ${v}`);
    }
    blocks.push(lines.join("\n"));
  }

  return blocks.join("\n\n") + "\n";
}

export function wireGrok(options = {}) {
  const home = process.env.HOME || os.homedir();
  const skillsPath = options.skillsPath || path.join(home, ".grok", "skills");
  const configFile = options.configFile || path.join(home, ".grok", "config.toml");
  const dryRun = options.dryRun || false;

  let content = "";
  if (fs.existsSync(configFile)) {
    try {
      content = fs.readFileSync(configFile, "utf8");
    } catch {
      content = "";
    }
  }

  const { nonHookText, existingHooks } = parseExistingToml(content);
  const svcHooks = buildGrokHookEntries(skillsPath);

  // Retain non-svc hooks
  const nonSvcHooks = existingHooks.filter((h) => {
    const cmd = h.command || "";
    return !cmd.includes("svc-") && !cmd.includes("/skills/hooks/");
  });

  const mergedHooks = [...nonSvcHooks, ...svcHooks];
  const output = serializeToml(nonHookText, mergedHooks);

  if (dryRun) {
    process.stdout.write(output);
    return 0;
  }

  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  const tmp = `${configFile}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, output, "utf8");
  fs.renameSync(tmp, configFile);
  process.stdout.write(`Wired Grok hooks in ${configFile}\n`);
  return 0;
}

function parseArgs(argv) {
  const options = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--skills-path" && argv[i + 1]) {
      options.skillsPath = path.resolve(argv[++i]);
    } else if (argv[i] === "--config" && argv[i + 1]) {
      options.configFile = path.resolve(argv[++i]);
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
  process.exit(wireGrok(options));
}
