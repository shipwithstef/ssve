#!/usr/bin/env node

/**
 * svc Workflow Guard — PreToolUse hook (host-agnostic).
 *
 * Port of svc-workflow-guard.js (CommonJS → ES module, 2026-04-24) under
 * WI-072. Consumes hooks/lib/hook-payload.mjs + hook-decision.mjs so that
 * payload extraction and decision emission are shared with loop-guard and
 * any future hook.
 *
 * Sources:
 *   Workflow scope/phase-boundary: adapted from GSD hooks/gsd-workflow-guard.js
 *     (MIT, Copyright 2025 TACHES).
 *   Config-protection, block-no-verify, commit-quality: patterns from
 *     everything-claude-code (MIT, Copyright 2026 Affaan M. and contributors).
 *
 * Modes (set by CLI flag):
 *   (default)         Edit/Write: config-protection (hard), workflow scope warning (soft)
 *   --phase-boundary  Edit/Write: spec-file-during-execution warning (soft), dynamic phase gate (hard)
 *   --bash-guard      Bash: block-no-verify (hard), commit-quality (hard in full profile)
 *
 * Profile control (env vars):
 *   SVC_HOOK_PROFILE=minimal  — workflow scope + block-no-verify only (no config-protection, no commit-quality)
 *   SVC_HOOK_PROFILE=full     — all checks (default)
 *   SVC_DISABLED_HOOKS=<ids>  — comma-separated hook IDs to skip, e.g. "svc-config-protection,svc-commit-quality"
 *
 * Exit codes (per the universal contract; hook-hard-block-use-exit-2-not-exit-1 learning):
 *   0 — OK or soft warning only (proceed)
 *   2 — Hard block (stderr carries the reason; action aborted)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMEWORK_ROOT = path.resolve(__dirname, "..");
const { readHookPayload, extractCommand, extractFilePath } = await import(
  path.join(__dirname, "lib", "hook-payload.mjs")
);
const { blockViaExit, emitDecision, ASK, detectHost: detectHostEnv } = await import(
  path.join(__dirname, "lib", "hook-decision.mjs"),
);
const { resolveOperationScope } = await import(path.join(__dirname, "lib", "operation-scope.mjs"));

let operationRoot = process.cwd();
let operationMaintenance = false;

// WI-487 (F-003/AC-487-7): every BLOCK path emits the canonical 5-field
// actionable-denial envelope ({hook_id,reason_code,cause,operation,recovery}) +
// a durable receipt via emitDenial, then hard-blocks with exit 2 — no anonymous
// nonzero exit. The existing human guidance is folded into `cause`; `recovery`
// carries the fix-it path. Falls back to plain stderr+exit-2 on an older install.
let emitDenial = null;
try { ({ emitDenial } = await import(path.join(__dirname, "lib", "hook-denial.mjs"))); } catch { /* older install */ }
function denyActionable(hookId, reasonCode, humanReason, { operation, recovery, target } = {}) {
  // ADDITIVE contract (WI-487 R2): the host-visible output MUST be identical to
  // the prior blockViaExit path (validators grep this stderr for "BLOCKED"), so
  // the full human reason is ALWAYS written here. emitDenial layers the 5-field
  // envelope + durable receipt ON TOP — its dedup suppresses ONLY that extra
  // envelope on an identical repeat, never this human reason.
  if (humanReason) process.stderr.write(humanReason + "\n");
  if (emitDenial) {
    emitDenial({
      hook_id: hookId,
      reason_code: reasonCode,
      cause: String(humanReason || "").slice(0, 1200),
      operation: operation || "governed Edit/Write/Bash operation",
      recovery: recovery || "Resolve the blocking condition described above (or use the documented override/bypass channel) before retrying.",
      // Vary the denial identity by target so distinct blocks never dedup each
      // other; an identical repeat of the SAME block dedups the envelope only (AC-487-8).
      resolved_command_path: target || reasonCode,
      session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
    });
  }
  process.exit(2);
}

// -------------------------------------------------------------------
// Profile + disable helpers
// -------------------------------------------------------------------

function getProfile() {
  return (process.env.SVC_HOOK_PROFILE || "full").toLowerCase();
}

function isDisabled(hookId) {
  const disabled = (process.env.SVC_DISABLED_HOOKS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return disabled.includes(hookId);
}

function isMinimal() {
  return getProfile() === "minimal";
}

// -------------------------------------------------------------------
// Path helpers
// -------------------------------------------------------------------

function makeRelative(filePath) {
  const cwd = operationRoot;
  if (filePath.startsWith(cwd + "/")) {
    return filePath.slice(cwd.length + 1);
  }
  return filePath;
}

function matchesAny(relativePath, patterns) {
  return patterns.some((pattern) => pattern.test(relativePath));
}

// -------------------------------------------------------------------
// Configuration — protected config files
// -------------------------------------------------------------------

// WI-399 A4: two protection classes.
// HARD-DENY — irreversible/secret-bearing files where even an ask is wrong:
// lock files (machine-generated; hand-edits corrupt resolution) and env files
// (secret exposure risk in diffs/transcripts).
const HARD_DENY_CONFIG_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /bun\.lockb?$/,
  /Cargo\.lock$/,
  /poetry\.lock$/,
  /Pipfile\.lock$/,
  /composer\.lock$/,
  /Gemfile\.lock$/,
  /pubspec\.lock$/,
  /go\.sum$/,
  /\.env$/,
  /\.env\.local$/,
  /\.env\.production$/,
];

// ASK class — legitimate-edit-sometimes configs. The block message used to say
// "the user must explicitly request it" while offering NO channel to express
// that (capability audit R5). Now we use the host's native permission prompt:
// the user approves or denies in-flight. Logged-override channel:
// .svc/pipeline-decisions.jsonl entry {config_protection_override:true,
// path_prefix, reasoning, approved_by} pre-authorizes matching paths.
const PROTECTED_CONFIG_PATTERNS = [
  // Package manifests / dependency config
  /package\.json$/,
  /Cargo\.toml$/,
  /go\.mod$/,
  /pyproject\.toml$/,
  /Pipfile$/,
  /requirements\.txt$/,
  /composer\.json$/,
  /Gemfile$/,
  /pubspec\.yaml$/,
  // Linters
  /\.eslintrc(\.(js|json|yaml|yml|cjs|mjs))?$/,
  /eslint\.config\.(js|mjs|cjs|ts)$/,
  /biome\.json$/,
  /oxlint\.json$/,
  // Formatters
  /prettier\.config\.(js|cjs|mjs|ts)$/,
  /\.prettierrc(\.(js|json|yaml|yml|cjs))?$/,
  // Type checkers
  /tsconfig.*\.json$/,
  /pyrightconfig\.json$/,
  /mypy\.ini$/,
  /\.mypy\.ini$/,
  // Test runners
  /jest\.config\.(js|ts|mjs|cjs)$/,
  /vitest\.config\.(js|ts|mjs|cjs)$/,
  /pytest\.ini$/,
  /setup\.cfg$/,
  // Framework/build config
  /vite\.config\./,
  /webpack\.config\./,
  /next\.config\./,
  /nuxt\.config\./,
  /svelte\.config\./,
  /astro\.config\./,
  /remix\.config\./,
  /sst\.config\./,
  // svc's own hooks — must not self-modify
  /^hooks\/svc-.*\.(js|mjs)$/,
  /^hooks\/hooks\.json$/,
];

const PLANNING_PATTERNS = [
  /^docs\/specs\/features\//,
  /^docs\/specs\/vision\.md$/,
  /^docs\/specs\/journeys\//,
  /^docs\/specs\/personas\//,
  /^docs\/specs\/ux\//,
  /^docs\/specs\/ui\//,
  /^docs\/plans\//,
  /manifest\.md$/,
];

const PHASE_GATES = [
  { pattern: /^docs\/specs\/tech-design\.md$/, phase: "design-tech", requires: ["design-ui"] },
  { pattern: /^docs\/specs\/ui\//, phase: "design-ui", requires: ["design-ux"] },
  { pattern: /^docs\/specs\/ux\//, phase: "design-ux", requires: ["write-spec"] },
  { pattern: /^docs\/plans\//, phase: "plan-changeset", requires: ["design-tech"] },
  { pattern: /^src\//, phase: "execute-changeset", requires: ["plan-changeset"] },
  { pattern: /^app\//, phase: "execute-changeset", requires: ["plan-changeset"] },
  { pattern: /^components\//, phase: "execute-changeset", requires: ["plan-changeset"] },
];

// -------------------------------------------------------------------
// Dynamic phase gate helpers
// -------------------------------------------------------------------

function claimSessionOf(cwd, wi) {
  // tolerate both observed claim schemas: {session,...} and {claimed_by,...}
  try {
    const c = JSON.parse(
      fs.readFileSync(path.join(cwd, ".svc", "claims", `${wi}.claim.json`), "utf8"),
    );
    return String(c.session || c.session_id || c.claimed_by || "");
  } catch {
    return "";
  }
}

function findLaneTasksFile(cwd, sessionId) {
  const svcDir = path.join(cwd, ".svc");
  try {
    const files = fs.readdirSync(svcDir);
    const laneTasks = files.filter(
      (f) => f.startsWith("lane-tasks-") && f.endsWith(".json") && !f.includes(".completed"),
    );
    // WI-399 A7 (G6 F5): with parallel orchestrators, most-recent-mtime can
    // select ANOTHER session's WI graph. Prefer the graph whose WI claim
    // belongs to the current session; fall back to mtime ordering.
    if (sessionId) {
      const sid = String(sessionId);
      const owned = laneTasks.filter((f) => {
        const wi = f.replace(/^lane-tasks-/, "").replace(/\.json$/, "");
        const cs = claimSessionOf(cwd, wi);
        return cs && cs.includes(sid);
      });
      if (owned.length > 0) {
        return owned
          .map((f) => ({ name: f, mtime: fs.statSync(path.join(svcDir, f)).mtimeMs }))
          .sort((a, b) => b.mtime - a.mtime)[0].name;
      }
    }
    return laneTasks
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(svcDir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime)[0]?.name;
  } catch {
    return null;
  }
}

function readLaneTasks(cwd, sessionId) {
  const file = findLaneTasksFile(cwd, sessionId);
  if (!file) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, ".svc", file), "utf8"));
  } catch {
    return null;
  }
}

function readCapabilityRegistry(cwd) {
  try {
    return JSON.parse(fs.readFileSync(path.join(cwd, ".svc", "capability-registry.json"), "utf8"));
  } catch {
    return null;
  }
}

function getSkillStatus(laneTasks, skillName) {
  if (!laneTasks || !laneTasks.tasks) return null;
  const task = laneTasks.tasks.find((t) => t.skill === skillName);
  if (!task) return null;
  return {
    status: task.status,
    skipReason: task.skip_reason || null,
    completedAt: task.completed_at || null,
  };
}

function checkDynamicPhaseGate(filePath, cwd, sessionId) {
  const relativePath = makeRelative(filePath);
  const gate = PHASE_GATES.find((g) => g.pattern.test(relativePath));
  if (!gate) return null;

  const laneTasks = readLaneTasks(cwd, sessionId);
  const registry = readCapabilityRegistry(cwd);

  if (!laneTasks) return null;

  const blocked = [];
  for (const reqSkill of gate.requires) {
    const skillStatus = getSkillStatus(laneTasks, reqSkill);
    if (skillStatus && skillStatus.status === "completed") continue;
    if (skillStatus && skillStatus.status === "skipped" && skillStatus.skipReason) continue;
    if (registry && registry.capabilities && registry.capabilities[`phase:${reqSkill}`] === false) continue;
    blocked.push(reqSkill);
  }

  if (blocked.length === 0) return null;

  return (
    `[svc-dynamic-phase-gate] BLOCKED: "${relativePath}" requires prerequisite phase(s) to be completed first.\n` +
    `  File phase:    ${gate.phase}\n` +
    `  Missing:       ${blocked.join(", ")}\n` +
    `  Lane-tasks:    ${laneTasks.wi || "unknown"}\n\n` +
    `To proceed, either:\n` +
    `  1. Complete the prerequisite skill(s) in the lane-tasks file, OR\n` +
    `  2. Mark them as "skipped" with a valid skip_reason, OR\n` +
    `  3. Add "phase:${blocked[0]}: false" to .svc/capability-registry.json exemptions.\n\n` +
    `This enforces progressive narrowing per DOCTRINE.md.`
  );
}

// -------------------------------------------------------------------
// Edit/Write mode checks
// -------------------------------------------------------------------

function hasLoggedConfigOverride(relativePath) {
  // WI-399 A4: pre-authorized config edits — a .svc/pipeline-decisions.jsonl
  // entry with config_protection_override:true, a path_prefix the target
  // matches, reasoning, and approved_by. Mirrors the PR-merge bypass channel.
  const log = path.join(operationRoot, ".svc", "pipeline-decisions.jsonl");
  if (!fs.existsSync(log)) return false;
  try {
    const lines = fs.readFileSync(log, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.some((line) => {
      try {
        const e = JSON.parse(line);
        return (
          e.config_protection_override === true &&
          typeof e.path_prefix === "string" &&
          relativePath.startsWith(e.path_prefix) &&
          typeof e.reasoning === "string" && e.reasoning.trim() &&
          typeof e.approved_by === "string" && e.approved_by.trim()
        );
      } catch { return false; }
    });
  } catch { return false; }
}

function checkConfigProtection(filePath) {
  if (isMinimal() || isDisabled("svc-config-protection")) return null;

  const relativePath = makeRelative(filePath);

  if (matchesAny(relativePath, HARD_DENY_CONFIG_PATTERNS)) {
    return {
      mode: "deny",
      message:
        `[svc-config-protection] BLOCKED: "${relativePath}" is a hard-protected file (lock file / env secrets).\n` +
        `Lock files are machine-generated (hand edits corrupt dependency resolution); env files carry secrets.\n` +
        `Regenerate lock files with the package manager; manage env values outside the agent loop.`,
    };
  }

  if (matchesAny(relativePath, PROTECTED_CONFIG_PATTERNS)) {
    if (hasLoggedConfigOverride(relativePath)) return null;
    return {
      mode: "ask",
      message:
        `[svc-config-protection] "${relativePath}" is a protected config file (linter/type-checker/test/build/framework config). ` +
        `Agents must not modify these to silence errors — but a deliberate, user-approved edit is legitimate. ` +
        `Approve to proceed, deny to keep the file untouched. ` +
        `(Pre-authorize a path: append {config_protection_override:true, path_prefix, reasoning, approved_by} to .svc/pipeline-decisions.jsonl.)`,
    };
  }
  return null;
}

function checkPhaseBoundary(filePath) {
  const relativePath = makeRelative(filePath);
  if (!matchesAny(relativePath, PLANNING_PATTERNS)) return null;

  const executionDirs = ["src", "lib", "app", "pages", "components"];
  const hasExecutionFiles = executionDirs.some((dir) => {
    const dirPath = path.join(operationRoot, dir);
    try {
      return fs.statSync(dirPath).isDirectory();
    } catch {
      return false;
    }
  });

  if (hasExecutionFiles) {
    return (
      `[svc-phase-boundary] REMINDER: Modifying planning file "${relativePath}" ` +
      `while execution-phase code exists in the project.\n` +
      `If this is a loop-back (spec defect found during execution), this is correct — ` +
      `document the reason in the commit message.\n` +
      `If this is accidental spec drift during execution, reconsider.\n` +
      `See DOCTRINE.md — phase boundaries exist to prevent lossy translation.`
    );
  }
  return null;
}

function checkWorkflowScope(filePath) {
  if (isDisabled("svc-workflow-guard")) return null;

  const relativePath = makeRelative(filePath);
  const currentSkill = process.env.SVC_CURRENT_SKILL || null;
  if (!currentSkill) return null;

  const skillMdPath = path.join(FRAMEWORK_ROOT, "skills", currentSkill, "SKILL.md");
  let declaredPaths = null;
  try {
    const content = fs.readFileSync(skillMdPath, "utf8");
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const paths = [];
      const producesMatch = frontmatter.match(/produces:\s*\n((?:\s+-.*\n)*)/);
      if (producesMatch) {
        const entries = producesMatch[1].matchAll(/path:\s*"([^"]+)"/g);
        for (const entry of entries) {
          paths.push(entry[1]);
        }
      }
      declaredPaths = paths.length > 0 ? paths : null;
    }
  } catch {
    return null;
  }

  if (!declaredPaths) return null;

  const isInScope = declaredPaths.some((declared) => {
    const pattern = declared.replace(/<[^>]+>/g, "[^/]+").replace(/\*/g, ".*");
    return new RegExp(pattern).test(relativePath);
  });

  if (!isInScope) {
    return (
      `[svc-workflow-guard] WARNING: Editing "${relativePath}" which is ` +
      `outside ${currentSkill}'s declared output paths.\n` +
      `Declared outputs: ${declaredPaths.join(", ")}\n` +
      `This may be intentional (dependency fix, shared type update). ` +
      `If not, consider logging this as a finding instead of modifying directly.\n` +
      `See references/anti-patterns.md AP-9.`
    );
  }
  return null;
}

// -------------------------------------------------------------------
// Bash mode checks
// -------------------------------------------------------------------

function checkNoVerifyBypass(command) {
  if (isDisabled("svc-block-no-verify")) return null;

  // --no-gpg-sign skips signing, not checks — it does not belong in this block
  // (false-positive class on signed-by-default machines; WI-399 A5).
  if (/--no-verify\b/.test(command)) {
    return (
      `[svc-block-no-verify] BLOCKED: --no-verify is not permitted.\n` +
      `Pre-commit hooks exist to catch real issues. Fix the underlying problem instead.\n` +
      `If you must bypass, the user must explicitly request it.\n` +
      `See CLAUDE.md: "Never skip hooks (--no-verify) unless the user explicitly requests these actions."`
    );
  }
  return null;
}

// WI-399 A2: 60s expired during normal long-message generation, forcing
// retry dances; 300s still bounds the intent-to-action gap meaningfully.
const DESTRUCTIVE_PREAMBLE_WINDOW_MS = Number.parseInt(
  process.env.SVC_DESTRUCTIVE_PREAMBLE_WINDOW_MS || "300000",
  10,
);

function identifyDestructiveGitCommand(command) {
  if (isDisabled("svc-destructive-git-preamble")) return null;
  if (!command || typeof command !== "string") return null;

  const checks = [
    {
      kind: "git push --force",
      pattern: /\bgit\s+(?:[^\n;&|]*\s+)?push\b[^\n;&|]*(?:--force(?:-with-lease)?\b|-f\b)/,
    },
    {
      kind: "git reset --hard",
      pattern: /\bgit\s+(?:[^\n;&|]*\s+)?reset\b[^\n;&|]*--hard\b/,
    },
    {
      kind: "git clean -f",
      pattern: /\bgit\s+(?:[^\n;&|]*\s+)?clean\b[^\n;&|]*-(?:[a-zA-Z]*f|[a-zA-Z]*f[a-zA-Z]*)\b/,
    },
    {
      kind: "git branch -D",
      pattern: /\bgit\s+(?:[^\n;&|]*\s+)?branch\b[^\n;&|]*-D\b/,
    },
  ];

  return checks.find((check) => check.pattern.test(command)) || null;
}

// WI-399 A2: extract the OPERATION TARGET for op+target preamble matching.
// Exact-full-command matching punished innocent respellings (adding git -C,
// changing a pipe suffix) and trained plumbing bypasses — the safety-relevant
// identity of a destructive op is its KIND + TARGET, not its shell spelling.
function destructiveTarget(kind, command) {
  let m;
  switch (kind) {
    case "git branch -D":
      m = command.match(/branch\b[^\n;&|]*?-D\s+([^\s;&|]+)/);
      return m ? m[1] : "";
    case "git push --force": {
      m = command.match(/push\b([^\n;&|]*)/);
      if (!m) return "";
      const toks = m[1].split(/\s+/).filter((t) => t && !t.startsWith("-"));
      return toks.slice(0, 2).join(" ").trim();
    }
    case "git reset --hard":
      m = command.match(/reset\b[^\n;&|]*--hard\s+([^\s;&|]+)?/);
      return m && m[1] ? m[1] : "";
    case "git clean -f":
      return ""; // typically pathless; kind match suffices
  }
  return "";
}

function textFromContent(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textFromContent).filter(Boolean).join("\n");
  if (typeof value === "object") {
    if (typeof value.text === "string") return value.text;
    if (typeof value.content === "string") return value.content;
    if (Array.isArray(value.content)) return textFromContent(value.content);
    if (value.message) return textFromContent(value.message);
  }
  return "";
}

function timestampMs(value) {
  if (!value || typeof value !== "object") return null;
  const raw =
    value.ts ||
    value.timestamp ||
    value.created_at ||
    value.createdAt ||
    value.message?.timestamp ||
    value.message?.created_at ||
    null;
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function isAssistantRecord(value) {
  if (!value || typeof value !== "object") return false;
  const role = value.role || value.type || value.message?.role || value.event?.role || "";
  return role === "assistant" || role === "assistant_message";
}

function recentAssistantMessages(rawPayload) {
  const messages = [];

  for (const key of ["last_assistant_message", "lastAssistantMessage"]) {
    if (typeof rawPayload?.[key] === "string" && rawPayload[key].trim()) {
      messages.push({ text: rawPayload[key], source: key, recent: true });
    }
  }

  const transcriptPath = rawPayload?.transcript_path || rawPayload?.transcriptPath || null;
  if (typeof transcriptPath === "string" && transcriptPath) {
    try {
      const stat = fs.statSync(transcriptPath);
      const start = Math.max(0, stat.size - 512 * 1024);
      const fd = fs.openSync(transcriptPath, "r");
      const buf = Buffer.alloc(stat.size - start);
      fs.readSync(fd, buf, 0, buf.length, start);
      fs.closeSync(fd);

      const cutoff = Date.now() - DESTRUCTIVE_PREAMBLE_WINDOW_MS;
      for (const line of buf.toString("utf8").split(/\r?\n/).reverse()) {
        if (!line.trim()) continue;
        let entry;
        try {
          entry = JSON.parse(line);
        } catch {
          continue;
        }
        if (!isAssistantRecord(entry)) continue;
        const ts = timestampMs(entry);
        if (ts !== null && ts < cutoff) continue;
        const text = textFromContent(entry);
        if (text.trim()) messages.push({ text, source: "transcript_path", recent: ts !== null });
        if (messages.length >= 5) break;
      }
    } catch {
      // Missing/unreadable transcript means no proof of a fresh preamble.
    }
  }

  return messages;
}

function hasDestructivePreamble(rawPayload, command, destructive) {
  const messages = recentAssistantMessages(rawPayload);
  const normalizedCommand = command.trim();
  const target = destructiveTarget(destructive.kind, command);
  return messages.some(({ text }) => {
    const lines = text.split(/\r?\n/).filter((line) => line.includes("DESTRUCTIVE: running"));
    return lines.some((line) => {
      if (!/\bPre-check:\s*status=.+,\s*unpushed=\d+,\s*disposition=safe\b/.test(line)) return false;
      // legacy exact-command form (still accepted)
      if (line.includes(`DESTRUCTIVE: running ${normalizedCommand}.`)) return true;
      // WI-399 A2 op+target form: the preamble names the operation KIND and
      // the TARGET — robust to innocent command respellings between retries.
      // G6 R2-F1: the target must follow the kind phrase CONTIGUOUSLY —
      // a floating includes(target) matched boilerplate ("status=clean"
      // validated target "clean"). The preamble format is "<kind> <target>".
      if (target) {
        if (!line.includes(`${destructive.kind} ${target}`)) return false;
      } else if (!line.includes(destructive.kind)) {
        return false;
      }
      return true;
    });
  });
}

function checkDestructiveGitPreamble(command, rawPayload) {
  const destructive = identifyDestructiveGitCommand(command);
  if (!destructive) return null;
  if (hasDestructivePreamble(rawPayload, command, destructive)) return null;

  const target = destructiveTarget(destructive.kind, command);
  return (
    `[svc-destructive-git-preamble] BLOCKED: ${destructive.kind} requires a fresh destructive-op preamble.\n` +
    `Before running this command, emit exactly one visible line in the assistant response:\n` +
    `  DESTRUCTIVE: running ${destructive.kind}${target ? " " + target : ""}. Pre-check: status=<summary>, unpushed=<count>, disposition=<safe|review>.\n\n` +
    `The line must name the operation kind${target ? " and the target (" + target + ")" : ""} — the exact shell spelling ` +
    `is NOT required (WI-399 A2). It must appear in an assistant message from the last ` +
    `${Math.round(DESTRUCTIVE_PREAMBLE_WINDOW_MS / 1000)} seconds.\n` +
    `If disposition is review, stop and ask the user. See rules/destructive-git-ops.md.`
  );
}

// -------------------------------------------------------------------
// Host detection for dynamic commit attribution
// -------------------------------------------------------------------

function detectHost() {
  // Parent process detection (most reliable — matches scripts/detect-host.sh order).
  // WI-399 A5: was `require("child_process")` inside an ES module — threw on every
  // call and silently fell through to env vars. Uses the execFileSync import.
  try {
    let pid = process.ppid;
    let depth = 0;
    while (pid > 1 && depth < 10) {
      const comm = execFileSync("ps", ["-o", "comm=", String(pid)], { encoding: "utf8" }).trim();
      if (comm.includes("Kimi") || comm.includes("kimi")) return "kimi";
      if (comm.includes("claude")) return "claude";
      if (comm.includes("codex")) return "codex";
      if (comm.includes("gemini")) return "gemini";
      if (comm.includes("opencode")) return "opencode";
      if (comm.includes("antigravity")) return "antigravity";
      if (comm.includes("cursor")) return "cursor";
      pid = parseInt(execFileSync("ps", ["-o", "ppid=", String(pid)], { encoding: "utf8" }).trim(), 10);
      depth++;
    }
  } catch {
    // fail silently — host detection is advisory, not blocking
  }

  // Env var fallback
  if (process.env.KIMI_WORK_DIR) return "kimi";
  if (process.env.CLAUDE_CODE_SSE_PORT) return "claude";
  if (process.env.CODEX_CLI || process.env.CODEX_API_KEY || process.env.CODEX_HOME || process.env.CODEX_THREAD_ID || process.env.CODEX_CI) return "codex";
  if (process.env.GEMINI_CLI_IDE_SERVER_PORT) return "gemini";
  if (process.env.OPENCODE) return "opencode";
  if (process.env.CURSOR_TRACE_ID || process.env.CURSOR_AGENT) return "cursor";
  if (process.env.ANTIGRAVITY) return "antigravity";

  return "unknown";
}

function getCommitAttribution(host) {
  // WI-399 A5: single-sourced from references/model-registry.json (WI-357 rule).
  // The registry's orchestrators.<host>.commitAttribution wins; the table below
  // is the offline fallback only.
  try {
    const reg = JSON.parse(
      fs.readFileSync(path.join(operationRoot, "references", "model-registry.json"), "utf8"),
    );
    const attr = reg?.orchestrators?.[host]?.commitAttribution;
    if (typeof attr === "string" && attr.trim()) return attr;
  } catch {
    // registry unreadable — fall through to the static fallback
  }
  const attributions = {
    claude: "Claude Opus 4.8 (1M context) <contact-cd29c5ac34@example.invalid>",
    kimi:   "Kimi k1.6 (Kimi Code CLI) <contact-4baf1bf8ca@example.invalid>",
    codex:  "Codex CLI <contact-b6b620a2d4@example.invalid>",
    gemini: "Gemini 2.5 Pro (Gemini CLI) <contact-4a2d56cec3@example.invalid>",
    opencode: "OpenCode CLI <contact-dabed2f59a@example.invalid>",
    antigravity: "Antigravity <contact-4a2d56cec3@example.invalid>",
    cursor: "Cursor <contact-a755e48a92@example.invalid>",
  };
  return attributions[host] || "<Model> (<Host>) <contact-a319d7a9d9@example.invalid>";
}

function checkCommitQuality(command) {
  if (isMinimal() || isDisabled("svc-commit-quality")) return null;

  if (!/\bgit\s+commit\b/.test(command)) return null;
  if (/--amend\b/.test(command)) return null;

  if (/\bfix\s+if[- ]needed\b/i.test(command)) {
    return {
      block: true,
      message:
        `[svc-commit-quality] BLOCKED: Commit message contains forbidden phrase "fix if needed".\n` +
        `Address specific fixes directly without conditional ambiguity.\n` +
        `See rules/common/neversay-fix-if-needed.md for rationale.`,
    };
  }

  const host = detectHost();
  const attribution = getCommitAttribution(host);

  if (!command.includes("Co-Authored-By")) {
    // WI-399 A5: `git commit -F <file>` / --file puts the message (and trailer)
    // in a FILE — scanning only the command string false-positived on the
    // robust file-based pattern. Check the message file before blocking.
    let trailerInFile = false;
    const fileMatch = command.match(/\s(?:-F|--file)(?:=|\s+)("[^"]+"|'[^']+'|[^\s;&|]+)/);
    if (fileMatch) {
      const msgPath = unquoteShellValue(fileMatch[1]);
      try {
        trailerInFile = fs
          .readFileSync(path.resolve(operationRoot, msgPath), "utf8")
          .includes("Co-Authored-By");
      } catch {
        // unreadable message file — fall through to block with guidance
      }
    }
    if (!trailerInFile) {
      return {
        block: true,
        message:
          `[svc-commit-quality] BLOCKED: Commit is missing the required Co-Authored-By trailer.\n` +
          `Required format (in commit message, or in the -F/--file message file):\n` +
          `  Co-Authored-By: ${attribution}\n` +
          `Add the trailer to the commit message.\n` +
          `See CLAUDE.md commit rules.`,
      };
    }
  }

  const shortMsgMatch = command.match(/-m\s+["']([^"'\n]{1,30})["']/);
  if (shortMsgMatch) {
    const msg = shortMsgMatch[1].trim().toLowerCase();
    const vague = ["fix", "update", "changes", "change", "wip", "stuff", "misc", "temp", "test", "patch", "tweak"];
    if (msg.length < 8 || vague.includes(msg)) {
      process.stderr.write(
        `[svc-commit-quality] WARNING: Commit message "${shortMsgMatch[1]}" may be too vague.\n` +
        `Use a descriptive message explaining the change.\n`
      );
    }
  }

  return null;
}

function gitOutput(args, cwd = operationRoot) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function stagedFiles(cwd = operationRoot) {
  const out = gitOutput(["diff", "--cached", "--name-only"], cwd);
  return out ? out.split(/\r?\n/).filter(Boolean) : [];
}

function latestLaneTasksGraph(cwd) {
  const lane = readLaneTasks(cwd);
  return lane && typeof lane === "object" ? lane : null;
}

function isFeatureLikeGraph(graph) {
  const lane = String(graph?.lane || graph?.delivery_graph?.lane || "");
  const changeType = String(graph?.delivery_graph?.change_type || graph?.change_type || "");
  const riskFlags = graph?.delivery_graph?.risk_flags || graph?.risk_flags || [];
  return (
    lane === "brownfield-feature" ||
    lane === "brownfield-iter-visual" ||
    changeType === "feature" ||
    riskFlags.includes("browser-visible") ||
    riskFlags.includes("user-facing") ||
    riskFlags.includes("admin-facing")
  );
}

function docsOnlyFrameworkException(files) {
  return files.length > 0 && files.every((file) => (
    file.startsWith("docs/") ||
    file.startsWith("references/") ||
    file.startsWith("proposals/") ||
    file === "FRAMEWORK-STATE.md" ||
    file.endsWith(".md")
  ));
}

function commandStagesBeforeCommit(command) {
  const commitIndex = command.search(/\bgit\s+commit\b/);
  if (commitIndex === -1) return false;
  const beforeCommit = command.slice(0, commitIndex);
  return /\bgit\s+(?:add|mv|rm)\b/.test(beforeCommit);
}

function commandCommitsUnstagedChanges(command) {
  const commitMatch = command.match(/\bgit\s+commit\b([\s\S]*)/);
  if (!commitMatch) return false;
  return /(?:^|\s)(?:-[A-Za-z]*a[A-Za-z]*|--all)(?:\s|$)/.test(commitMatch[1]);
}

function checkDirectMainFeatureCommit(command, cwd = operationRoot) {
  if (isDisabled("svc-direct-main-feature-commit")) return null;
  if (!/\bgit\s+commit\b/.test(command) || /--amend\b/.test(command)) return null;

  const branch = gitOutput(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
  if (branch !== "main" && branch !== "master") return null;

  const graph = latestLaneTasksGraph(cwd);
  if (!isFeatureLikeGraph(graph)) return null;

  const files = stagedFiles(cwd);
  if (files.length === 0 && !commandStagesBeforeCommit(command) && !commandCommitsUnstagedChanges(command)) {
    return null;
  }
  if (docsOnlyFrameworkException(files)) return null;

  return (
    `[svc-direct-main-feature-commit] BLOCKED: feature or brownfield-iteration implementation commits must not land directly on ${branch}.\n` +
    `Use a .worktrees/ feature branch and PR path, or stage only framework/docs exception files.\n` +
    `Lane/WI: ${graph?.lane || graph?.delivery_graph?.lane || "unknown"} / ${graph?.wi || "unknown"}`
  );
}

function extractPrMergeNumber(command) {
  const match = command.match(/\bgh\s+pr\s+merge\s+([0-9]+)/);
  return match ? match[1] : null;
}

function hasFrameworkRoot(cwd) {
  return fs.existsSync(path.join(cwd, "skills-manifest.json")) &&
    fs.existsSync(path.join(cwd, "FRAMEWORK-STATE.md"));
}

function validReviewReceipt(root, pr) {
  const candidates = [
    path.join(root, ".svc", "review-receipts", `pr-${pr}.json`),
    path.join(root, "docs", "specs", "reviews", `pr-${pr}-review-gate.json`),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const receipt = JSON.parse(fs.readFileSync(file, "utf8"));
      if (String(receipt.pr || receipt.pr_number || "") !== String(pr)) continue;
      if (receipt.review_gate_required !== true) continue;
      if (receipt.self_review === true) continue;
      if (!["PASS", "pass", "approved"].includes(receipt.result)) continue;
      if (!receipt.reviewed_at || !receipt.review_gate_task || !receipt.reviewer) continue;
      if (!Array.isArray(receipt.evidence) || receipt.evidence.length === 0) continue;
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function hasLoggedReviewBypass(root, pr) {
  const log = path.join(root, ".svc", "pipeline-decisions.jsonl");
  if (!fs.existsSync(log)) return false;
  try {
    const lines = fs.readFileSync(log, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.some((line) => {
      try {
        const entry = JSON.parse(line);
        return (
          entry.review_gate_bypass === true &&
          String(entry.pr || entry.pr_number || "") === String(pr) &&
          typeof entry.reasoning === "string" &&
          entry.reasoning.trim() &&
          typeof entry.approved_by === "string" &&
          entry.approved_by.trim()
        );
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function checkPrMergeReviewReceipt(command) {
  if (isDisabled("svc-pr-merge-review-receipt")) return null;
  if (!/\bgh\s+pr\s+merge\b/.test(command)) return null;
  const cwd = operationRoot;
  if (!hasFrameworkRoot(cwd)) return null;

  const pr = extractPrMergeNumber(command);
  if (!pr) {
    return (
      `[svc-pr-merge-review-receipt] BLOCKED: framework PR merges must name a PR number so review-gate receipt eligibility can be checked.\n` +
      `Use: node scripts/merge-pr-with-review-receipt.mjs --pr <number> --squash --delete-branch`
    );
  }
  if (validReviewReceipt(cwd, pr) || hasLoggedReviewBypass(cwd, pr)) return null;

  return (
    `[svc-pr-merge-review-receipt] BLOCKED: PR ${pr} is missing a valid review-gate receipt.\n` +
    `Create .svc/review-receipts/pr-${pr}.json or docs/specs/reviews/pr-${pr}-review-gate.json with review_gate_required=true, result=PASS, reviewer, reviewed_at, review_gate_task, and evidence[].\n` +
    `Emergency bypass requires a .svc/pipeline-decisions.jsonl entry with review_gate_bypass=true, pr=${pr}, reasoning, and approved_by.\n` +
    `Codex shell/API sessions must use: node scripts/merge-pr-with-review-receipt.mjs --pr ${pr} --squash --delete-branch`
  );
}

function isBase44CodingWriteMutation(command) {
  if (!/\bcoding\/write\b/.test(command)) return false;

  const curlPost = /\bcurl\b/.test(command) &&
    /(?:\s-X\s*POST\b|\s--request\s+POST\b|\s-d\s|\s--data(?:-raw|-binary)?\b)/.test(command);
  const cliWrite = /\b(?:base44|b44)\b[^\n;&|]*\bcoding\/write\b/.test(command) ||
    /\bcoding\/write\s+entities\//.test(command);

  return curlPost || cliWrite;
}

function isBase44EntitySchemaWrite(command) {
  if (!isBase44CodingWriteMutation(command)) return false;
  return (
    /\bentities\/[A-Za-z0-9_-]+\b/.test(command) ||
    /["'\\]?file_path["'\\]?\s*:\s*["'\\]?entities\/[A-Za-z0-9_-]+\b/.test(command) ||
    /["'\\]?filePath["'\\]?\s*:\s*["'\\]?entities\/[A-Za-z0-9_-]+\b/.test(command) ||
    /["'\\]?path["'\\]?\s*:\s*["'\\]?entities\/[A-Za-z0-9_-]+\b/.test(command)
  );
}

function unquoteShellValue(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function schemaWriteArtifactFromCommand(command) {
  const envMatch = command.match(/(?:^|[\s;&|])SVC_BASE44_SCHEMA_WRITE_ARTIFACT=("[^"]+"|'[^']+'|[^\s;&|]+)/);
  if (envMatch) return unquoteShellValue(envMatch[1]);

  const argMatch = command.match(/\b--schema-change-artifact(?:=|\s+)("[^"]+"|'[^']+'|[^\s;&|]+)/);
  if (argMatch) return unquoteShellValue(argMatch[1]);

  return null;
}

function validBase44SchemaWriteArtifact(root, artifactPath) {
  if (!artifactPath) return false;
  const resolved = path.resolve(root, artifactPath);
  const rootWithSep = path.resolve(root) + path.sep;
  if (!resolved.startsWith(rootWithSep)) return false;
  if (!fs.existsSync(resolved)) return false;

  try {
    const content = fs.readFileSync(resolved, "utf8").toLowerCase();
    const hasRollback = /\brollback\b/.test(content);
    const hasProbeEvidence = /\b(round[- ]?trip|persistence|rls|probe|wi-308|security rule)\b/.test(content);
    return hasRollback && hasProbeEvidence;
  } catch {
    return false;
  }
}

function hasLoggedBase44SchemaWriteOverride(root) {
  const log = path.join(root, ".svc", "pipeline-decisions.jsonl");
  if (!fs.existsSync(log)) return false;
  try {
    const lines = fs.readFileSync(log, "utf8").split(/\r?\n/).filter(Boolean);
    return lines.some((line) => {
      try {
        const entry = JSON.parse(line);
        const approved = entry.base44_schema_write_override === true ||
          entry.base44_schema_write_approved === true;
        return approved &&
          typeof entry.reasoning === "string" &&
          entry.reasoning.trim() &&
          typeof entry.approved_by === "string" &&
          entry.approved_by.trim();
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

function checkBase44SchemaWriteGuard(command) {
  if (isDisabled("svc-base44-schema-write-guard")) return null;
  if (!isBase44EntitySchemaWrite(command)) return null;

  const root = operationRoot;
  const artifact = schemaWriteArtifactFromCommand(command);
  if (validBase44SchemaWriteArtifact(root, artifact)) return null;
  if (hasLoggedBase44SchemaWriteOverride(root)) return null;

  return (
    `[svc-base44-schema-write-guard] BLOCKED: Base44 coding/write entity-schema mutations require durable evidence.\n` +
    `Add SVC_BASE44_SCHEMA_WRITE_ARTIFACT=<repo-relative-path> or --schema-change-artifact <path> pointing to a schema-change artifact with rollback plus round-trip/persistence/RLS/probe evidence, OR log an explicit .svc/pipeline-decisions.jsonl override with base44_schema_write_override=true, reasoning, and approved_by.\n` +
    `This guard applies to coding/write entities/* only; function recovery writes remain allowed. See WI-324 and base44-environment/SKILL.md.`
  );
}

// -------------------------------------------------------------------
// Main dispatch
// -------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const mode = args.find((a) => a.startsWith("--")) || "--edit-write";

  // Unified host-agnostic payload extraction via shared lib.
  const call = readHookPayload();
  // Fail open on empty/unparseable payloads — blocking on ambiguous input is a regression.
  if (!call) process.exit(0);

  const operationHost = call.raw?.host || process.env.SVC_HOST ||
    (process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_CODE_REMOTE || process.env.CLAUDE_PROJECT_DIR ? "claude" :
      (process.env.CODEX_HOME || process.env.CODEX_SESSION_ID ? "codex" : "codex"));
  const operationScope = resolveOperationScope({
    ...call.raw, host: operationHost,
    tool_name: call.toolName, tool_input: call.toolInput, cwd: call.session_cwd || call.cwd,
  });
  operationRoot = operationScope.operation_repository?.worktree_root || operationScope.operation_cwd || call.session_cwd || call.cwd || process.cwd();
  operationMaintenance = Boolean(operationScope.framework_maintenance && detectHostEnv() === "codex");

  const { toolInput } = call;

  if (mode === "--bash-guard") {
    const command = extractCommand(toolInput);
    if (!command) process.exit(0);

    const bashDeny = (reason, recovery) => denyActionable("svc-bash-guard", "SVC-BASH-GUARD-BLOCK", reason, {
      operation: "Bash command execution",
      recovery,
      target: command,
    });

    const noVerifyBlock = checkNoVerifyBypass(command);
    if (noVerifyBlock) bashDeny(noVerifyBlock, "Fix the underlying issue and run the command without --no-verify; only bypass if the user explicitly requests it.");

    const destructiveBlock = checkDestructiveGitPreamble(command, call.raw);
    if (destructiveBlock) bashDeny(destructiveBlock, "Emit the required DESTRUCTIVE preamble line (naming the op kind + target) in an assistant message, then retry. See rules/destructive-git-ops.md.");

    const commitResult = checkCommitQuality(command);
    if (commitResult) {
      if (commitResult.block) bashDeny(commitResult.message, "Add the required Co-Authored-By trailer / remove the forbidden phrase, then re-commit. See CLAUDE.md commit rules.");
      process.stderr.write(commitResult.message + "\n");
    }

    const directMainBlock = operationMaintenance ? null : checkDirectMainFeatureCommit(command, operationRoot);
    if (directMainBlock) bashDeny(directMainBlock, "Move the change to a .worktrees/ feature branch and land via PR, or stage only framework/docs exception files.");

    const prMergeBlock = checkPrMergeReviewReceipt(command);
    if (prMergeBlock) bashDeny(prMergeBlock, "Create a valid review-gate receipt (or log an approved bypass), then merge via scripts/merge-pr-with-review-receipt.mjs.");

    const base44SchemaWriteBlock = checkBase44SchemaWriteGuard(command);
    if (base44SchemaWriteBlock) bashDeny(base44SchemaWriteBlock, "Provide a schema-change artifact (rollback + round-trip/RLS/probe evidence) via SVC_BASE44_SCHEMA_WRITE_ARTIFACT/--schema-change-artifact, or log an approved override.");

    process.exit(0);
  } else if (mode === "--phase-boundary") {
    const filePath = extractFilePath(toolInput);
    if (!filePath) process.exit(0);

    const phaseBlock = operationMaintenance ? null : checkDynamicPhaseGate(filePath, operationRoot, call.sessionId);
    if (phaseBlock) denyActionable("svc-workflow-guard", "SVC-WORKFLOW-GUARD-BLOCK", phaseBlock, {
      operation: `Edit/Write of ${filePath}`,
      recovery: "Complete (or mark skipped with a reason) the prerequisite phase(s) in the lane-tasks graph, or add a capability-registry exemption, then retry.",
      target: filePath,
    });

    const warning = checkPhaseBoundary(filePath);
    if (warning) process.stderr.write(warning + "\n");
    process.exit(0);
  } else {
    // Default --edit-write. WI-399 A1: also runs the former --phase-boundary
    // checks in the SAME process — one spawn per Edit/Write instead of two.
    // The --phase-boundary flag stays valid for hosts wired the old way.
    const filePath = extractFilePath(toolInput);
    if (!filePath) process.exit(0);

    const configVerdict = operationMaintenance ? null : checkConfigProtection(filePath);
    if (configVerdict) {
      if (configVerdict.mode === "deny") denyActionable("svc-workflow-guard", "SVC-WORKFLOW-GUARD-BLOCK", configVerdict.message, {
        operation: `Edit/Write of ${filePath}`,
        recovery: "Do not hand-edit lock/env files: regenerate lock files with the package manager; manage env values outside the agent loop.",
        target: filePath,
      });
      // WI-399 A4: ask — the host's native permission prompt decides (R5:
      // hard-deny offered no channel for "the user explicitly requested it").
      emitDecision({
        host: detectHostEnv(),
        event: "PreToolUse",
        decision: ASK,
        reason: configVerdict.message,
      });
      return; // unreachable — emitDecision exits
    }

    const phaseBlock = operationMaintenance ? null : checkDynamicPhaseGate(filePath, operationRoot, call.sessionId);
    if (phaseBlock) denyActionable("svc-workflow-guard", "SVC-WORKFLOW-GUARD-BLOCK", phaseBlock, {
      operation: `Edit/Write of ${filePath}`,
      recovery: "Complete (or mark skipped with a reason) the prerequisite phase(s) in the lane-tasks graph, or add a capability-registry exemption, then retry.",
      target: filePath,
    });

    const scopeWarning = checkWorkflowScope(filePath);
    if (scopeWarning) process.stderr.write(scopeWarning + "\n");

    const boundaryWarning = checkPhaseBoundary(filePath);
    if (boundaryWarning) process.stderr.write(boundaryWarning + "\n");

    process.exit(0);
  }
}

main().catch(() => process.exit(0));
