#!/usr/bin/env node

/**
 * wire-grok-hooks.mjs — Idempotently merges svc enforcement hooks into
 * Grok Build CLI config (~/.grok/config.toml).
 *
 * Grok hook model (WI-543 live inspect 2026-08-17):
 *   - Events: PreToolUse, PostToolUse, UserPromptSubmit, Stop, SessionStart, SessionEnd
 *   - Loaded schema: nested [[hooks.<Event>]] + inner hooks = [{ type, command, timeout }]
 *   - Parser also removes leftover flat [[hooks]] tables so a later revert cannot duplicate
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
      timeout: 30,
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

function parseTomlScalar(raw) {
  const t = String(raw).trim();
  if (t.startsWith("\"")) {
    try { return JSON.parse(t); } catch { return t.replace(/^"|"$/g, ""); }
  }
  if (t.startsWith("'")) return t.slice(1, -1);
  if (/^[0-9]+$/.test(t)) return parseInt(t, 10);
  if (/^(true|false)$/i.test(t)) return t.toLowerCase() === "true";
  return t;
}

function assignTomlKv(obj, line) {
  const matchStr = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*')/);
  const matchNum = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*([0-9]+)/);
  const matchBool = line.match(/^\s*([a-zA-Z0-9_-]+)\s*=\s*(true|false)\b/i);
  if (matchStr) {
    obj[matchStr[1]] = parseTomlScalar(matchStr[2]);
    return matchStr[1];
  }
  if (matchNum) {
    obj[matchNum[1]] = parseInt(matchNum[2], 10);
    return matchNum[1];
  }
  if (matchBool) {
    obj[matchBool[1]] = matchBool[2].toLowerCase() === "true";
    return matchBool[1];
  }
  return null;
}

function parseInlineHookObjects(text) {
  const hooks = [];
  const re = /\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(text))) {
    const obj = {};
    const inner = m[1];
    const kv = /([a-zA-Z0-9_-]+)\s*=\s*("(?:[^"\\]|\\.)*"|'[^']*'|[0-9]+|true|false)/gi;
    let pair;
    while ((pair = kv.exec(inner))) {
      obj[pair[1]] = parseTomlScalar(pair[2]);
    }
    if (obj.command) hooks.push(obj);
  }
  return hooks;
}

function collectBracketBlock(lines, startIdx) {
  let buf = lines[startIdx];
  let i = startIdx;
  let depth = 0;
  let inStr = false;
  let esc = false;
  const scan = (s) => {
    for (const ch of s) {
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (ch === "\\") { esc = true; continue; }
        if (ch === "\"") inStr = false;
        continue;
      }
      if (ch === "\"") { inStr = true; continue; }
      if (ch === "[") depth++;
      if (ch === "]") depth--;
    }
  };
  scan(lines[startIdx]);
  while (depth > 0 && i + 1 < lines.length) {
    i++;
    buf += "\n" + lines[i];
    scan(lines[i]);
  }
  return { text: buf, endIdx: i };
}

function classifyHookHeader(trimmed) {
  if (trimmed === "[[hooks]]") return { kind: "flat" };
  const handler = trimmed.match(/^\[\[hooks\.([A-Za-z][A-Za-z0-9]*)\.hooks\]\]$/);
  if (handler) return { kind: "nested-handler", event: handler[1] };
  const event = trimmed.match(/^\[\[hooks\.([A-Za-z][A-Za-z0-9]*)\]\]$/);
  if (event) return { kind: "nested-event", event: event[1] };
  return null;
}

export function parseExistingToml(content) {
  const nonHookSections = [];
  const existingHooks = [];
  const lines = String(content || "").split(/\r?\n/);
  let mode = "none";
  let currentHook = {};
  let currentEvent = "";
  let eventMatcher = "";
  let currentNonHook = [];

  const flushHook = () => {
    if (currentHook.command) existingHooks.push(currentHook);
    currentHook = {};
  };
  const flushNonHook = () => {
    if (currentNonHook.length > 0) {
      nonHookSections.push(currentNonHook.join("\n"));
      currentNonHook = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const header = classifyHookHeader(trimmed);
    if (header) {
      flushHook();
      flushNonHook();
      if (header.kind === "flat") {
        mode = "flat";
        currentEvent = "";
        eventMatcher = "";
        currentHook = {};
      } else if (header.kind === "nested-event") {
        mode = "nested-event";
        currentEvent = header.event;
        eventMatcher = "";
        currentHook = { event: header.event };
      } else {
        mode = "nested-handler";
        currentEvent = header.event;
        currentHook = { event: header.event };
        if (eventMatcher) currentHook.matcher = eventMatcher;
      }
      continue;
    }

    if (mode !== "none" && trimmed.startsWith("[")) {
      flushHook();
      mode = "none";
      currentEvent = "";
      eventMatcher = "";
      currentNonHook.push(line);
      continue;
    }

    if (mode === "none") {
      currentNonHook.push(line);
      continue;
    }

    if ((mode === "nested-event" || mode === "nested-handler") && /^\s*hooks\s*=\s*\[/.test(line)) {
      const block = collectBracketBlock(lines, i);
      const matcher = currentHook.matcher || eventMatcher || "*";
      for (const inner of parseInlineHookObjects(block.text)) {
        existingHooks.push({
          event: currentEvent || currentHook.event,
          matcher,
          type: inner.type || "command",
          command: inner.command,
          timeout: inner.timeout,
        });
      }
      currentHook = { event: currentEvent };
      if (eventMatcher) currentHook.matcher = eventMatcher;
      i = block.endIdx;
      continue;
    }

    const key = assignTomlKv(currentHook, line);
    if (key === "matcher") eventMatcher = currentHook.matcher;
    if (key === "event") currentEvent = currentHook.event;
  }

  flushHook();
  flushNonHook();
  return { nonHookText: nonHookSections.join("\n\n").trim(), existingHooks };
}

export function serializeToml(nonHookText, hooks) {
  const blocks = [];
  if (nonHookText) blocks.push(nonHookText);

  for (const h of hooks) {
    const event = h.event || "SessionStart";
    const matcher = h.matcher == null ? "*" : h.matcher;
    const type = h.type || "command";
    const inner = [`type = ${JSON.stringify(type)}`, `command = ${JSON.stringify(h.command || "")}`];
    if (typeof h.timeout === "number") inner.push(`timeout = ${h.timeout}`);
    blocks.push([
      `[[hooks.${event}]]`,
      `matcher = ${JSON.stringify(matcher)}`,
      "hooks = [",
      `  { ${inner.join(", ")} },`,
      "]",
    ].join("\n"));
  }

  return blocks.join("\n\n") + "\n";
}

function isSvcOwnedHook(hook) {
  const cmd = hook.command || "";
  return cmd.includes("svc-") || cmd.includes("/skills/hooks/");
}

export function wireGrok(options = {}) {
  const home = process.env.HOME || os.homedir();
  const skillsPath = options.skillsPath || path.join(home, ".grok", "skills");
  const configFile = options.configFile || path.join(home, ".grok", "config.toml");
  const dryRun = options.dryRun || false;
  const backupFile = `${configFile}.wi543.bak`;

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
  const nonSvcHooks = existingHooks.filter((h) => !isSvcOwnedHook(h));
  const mergedHooks = [...nonSvcHooks, ...svcHooks];
  const output = serializeToml(nonHookText, mergedHooks);

  if (dryRun) {
    process.stdout.write(output);
    return 0;
  }

  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  if (fs.existsSync(configFile)) {
    fs.copyFileSync(configFile, backupFile);
  }
  try {
    if (process.env.SVC_WIRE_GROK_FAIL_AFTER_BACKUP === "1") {
      throw new Error("simulated write failure");
    }
    const tmp = `${configFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, output, "utf8");
    fs.renameSync(tmp, configFile);
    process.stdout.write(`Wired Grok hooks in ${configFile}\n`);
    return 0;
  } catch (err) {
    if (fs.existsSync(backupFile)) {
      fs.copyFileSync(backupFile, configFile);
    }
    throw err;
  }
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
