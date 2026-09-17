/**
 * svc-opencode-plugin.ts
 *
 * Main OpenCode plugin adapter for the Serious Vibe Coding framework.
 * Maps OpenCode's plugin event system to svc hook behaviors.
 *
 * Ported from Claude Code's shell-based hooks to OpenCode's TypeScript plugin API.
 * Zero impact on other hosts — lives entirely in ~/.config/opencode/plugins/.
 *
 * Hook coverage:
 *   tool.execute.before → workflow-guard (blocks config/lockfile edits, --no-verify)
 *   tool.execute.after  → lane-tasks-validator (validates .svc/lane-tasks-*.json)
 *   session.idle        → stop-quality (batch format + typecheck)
 *   session.created     → session-healthcheck (dangling symlink detection)
 *   shell.env           → inject SVC_HOST=opencode
 *   session.compacted   → lane-tasks recovery (re-read source of truth)
 */

import type { Plugin } from "@opencode-ai/plugin";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function getProfile(): string {
  return (process.env.SVC_HOOK_PROFILE || "full").toLowerCase();
}

function isDisabled(hookId: string): boolean {
  const disabled = (process.env.SVC_DISABLED_HOOKS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return disabled.includes(hookId);
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function makeRelative(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd + "/")) {
    return filePath.slice(cwd.length + 1);
  }
  return filePath;
}

// ── svc-skill-artifact-authenticity (G-4, ported from hooks/svc-skill-artifact-authenticity.mjs) ──
// Path → required-skill mapping. Prefix match unless exact: true.
const SKILL_OUTPUT_PATHS: Array<{ match: string; skills: string[]; exact?: boolean }> = [
  { match: "docs/specs/features/", skills: ["validate-feature", "write-spec"] },
  { match: "docs/specs/design-ux/", skills: ["design-ux"] },
  { match: "docs/specs/design-ui/", skills: ["design-ui"] },
  { match: "docs/specs/design-tech/", skills: ["design-tech"] },
  { match: "docs/specs/plans/", skills: ["plan-changeset"] },
  { match: "docs/specs/decisions/", skills: ["strategic-decision", "explore-solutions", "decide"] },
  { match: "docs/specs/coverage-audit.md", skills: ["audit-coverage"], exact: true },
  { match: "docs/specs/capability-plan.md", skills: ["plan-capabilities"], exact: true },
  { match: "docs/specs/personas/", skills: ["build-personas"] },
  { match: "docs/specs/journeys/", skills: ["write-journeys"] },
  { match: "docs/specs/research-log.md", skills: ["research"], exact: true },
  // Framework-critical files
  { match: "skills-manifest.json", skills: ["plan-changeset", "improve-framework", "evolve-framework", "create-skill"], exact: true },
  { match: "REPO_MODES.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "EXTERNAL_ADDONS.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "DOCTRINE.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "FRAMEWORK-STATE.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "AGENTS.md", skills: ["plan-changeset", "improve-framework", "evolve-framework"], exact: true },
  { match: "skills/route-workflow/SKILL.md", skills: ["route-workflow", "improve-framework", "evolve-framework"], exact: true },
  { match: "references/routing-rules.md", skills: ["route-workflow", "improve-framework", "evolve-framework"], exact: true },
  { match: "references/lane-model.md", skills: ["improve-framework", "evolve-framework"], exact: true },
  { match: "references/intent-routing.md", skills: ["route-workflow", "improve-framework", "evolve-framework"], exact: true },
];

function findArtifactRule(rel: string): { match: string; skills: string[] } | null {
  for (const r of SKILL_OUTPUT_PATHS) {
    if (r.exact) { if (rel === r.match) return r; }
    else if (rel.startsWith(r.match)) return r;
  }
  return null;
}

function checkSkillReceipt(directory: string, skills: string[]): boolean {
  const windowMin = Number.parseInt(process.env.SVC_SKILL_RECEIPT_WINDOW_MIN || "90", 10);
  const cutoff = Date.now() - windowMin * 60 * 1000;
  const decisionsPath = path.join(directory, ".svc", "pipeline-decisions.jsonl");
  let entries: Array<Record<string, unknown>> = [];
  try {
    entries = fs.readFileSync(decisionsPath, "utf8").trim().split("\n").filter(Boolean).flatMap((line) => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
  } catch { return false; }
  return [...entries].reverse().some((entry) => {
    const ts = Date.parse(String(entry.timestamp || ""));
    return Number.isFinite(ts) && ts >= cutoff && typeof entry.skill === "string" && skills.includes(entry.skill);
  });
}

function matchesAny(relativePath: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(relativePath));
}

// ---------------------------------------------------------------------------
// Protected config files (same list as svc-workflow-guard.mjs)
// ---------------------------------------------------------------------------

const PROTECTED_CONFIG_PATTERNS: RegExp[] = [
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
  // Lock files
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
  // Environment files
  /\.env$/,
  /\.env\.local$/,
  /\.env\.production$/,
  // svc's own hooks — must not self-modify
  /^hooks\/svc-.*\.(js|mjs)$/,
  /^hooks\/hooks\.json$/,
];

const PROTECTED_SVC_PATTERNS: RegExp[] = [
  /\.svc\/lane-tasks-.*\.json$/,
  /skills-manifest\.json$/,
  /FRAMEWORK-STATE\.md$/,
];

const FORBIDDEN_BASH_PATTERNS: RegExp[] = [
  /--no-verify/,
  /--no-gpg-sign/,
  /--force\b.*\bpush/,
  /push\b.*--force/,
  /\brm\s+-rf\s+\/\s/,
];

// ---------------------------------------------------------------------------
// Skills path resolution
// ---------------------------------------------------------------------------

function findSkillsPath(): string | null {
  const candidates = [
    path.join(process.env.HOME || "~", ".claude/skills"),
    path.join(process.env.HOME || "~", ".config/opencode/skills"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(path.join(p, "route-workflow/SKILL.md"))) {
      return p;
    }
  }
  return null;
}

function findScriptsPath(): string | null {
  const skillsPath = findSkillsPath();
  if (!skillsPath) return null;
  const scriptsPath = path.join(skillsPath, "scripts");
  return fs.existsSync(scriptsPath) ? scriptsPath : null;
}

// ---------------------------------------------------------------------------
// Lane-tasks validation
// ---------------------------------------------------------------------------

function validateLaneTasksFile(filePath: string): { valid: boolean; error?: string } {
  const scriptsPath = findScriptsPath();
  if (!scriptsPath) return { valid: true }; // can't validate without scripts

  const taskGraphPath = path.join(scriptsPath, "task-graph.mjs");
  if (!fs.existsSync(taskGraphPath)) return { valid: true };

  try {
    // Read file content and validate via task-graph.mjs
    const content = fs.readFileSync(filePath, "utf8");
    const tmpDir = fs.mkdtempSync("/tmp/svc-lane-tasks-opencode-");
    const tmpPath = path.join(tmpDir, "lane-tasks.json");
    fs.writeFileSync(tmpPath, content, "utf8");

    try {
      execFileSync("node", [taskGraphPath, "validate", tmpPath], {
        cwd: scriptsPath,
        stdio: "pipe",
        timeout: 10000,
      });
      return { valid: true };
    } catch (e: any) {
      const msg = e.stderr?.toString() || e.stdout?.toString() || e.message;
      return { valid: false, error: msg };
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  } catch (e: any) {
    return { valid: false, error: e.message };
  }
}

// ---------------------------------------------------------------------------
// Session-contract freshness (audit-session-execution F2)
// ---------------------------------------------------------------------------

function readLastContract(cwd: string): Record<string, unknown> | null {
  const file = path.join(cwd, ".svc", "session-contract.jsonl");
  try {
    const content = fs.readFileSync(file, "utf8").trim();
    if (!content) return null;
    const lines = content.split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

function parseTs(ts: unknown): number | null {
  if (!ts || typeof ts !== "string") return null;
  const normalized = ts.replace(/\+[0-9]{2}:[0-9]{2}$/, "").replace(/Z$/, "");
  const epoch = Date.parse(normalized + "Z");
  return isNaN(epoch) ? null : epoch;
}

function checkSessionContractFreshness(cwd: string): string | null {
  if (isDisabled("svc-session-contract-freshness")) return null;

  const contract = readLastContract(cwd);
  if (!contract) {
    return (
      `svc-session-contract-freshness: Session contract is MISSING. ` +
      `Before any edit/write/bash, write a contract entry to .svc/session-contract.jsonl. ` +
      `See route-workflow/SKILL.md §Session Contract.`
    );
  }

  // WI-558 policy parity: same 24h / 1440-minute default as hooks/svc-session-contract-freshness.mjs
  const maxAgeHours = parseInt(process.env.SVC_CONTRACT_MAX_AGE_HOURS || "24", 10);
  if (maxAgeHours === 0) {
    return null; // bypass age check
  }

  // WI-558: parity with hooks/svc-session-contract-freshness.mjs — freshness
  // governs a stale WI BINDING. Terminal unbound rows (no wi + an explicit
  // user-request | framework-evolution boundary marker) carry no edit authority
  // and cannot go stale; rows with a wi are always governed.
  const boundTo = typeof contract.bound_to === "string" ? contract.bound_to : "";
  const boundWi = typeof contract.wi === "string" ? contract.wi.trim() : "";
  if (!boundWi && (boundTo === "user-request" || boundTo === "framework-evolution")) {
    return null;
  }
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  const ts = parseTs(contract.ts);
  if (ts === null) return null;

  const now = Date.now();
  const ageMs = now - ts;

  if (ageMs > maxAgeMs) {
    const ageHours = Math.round(ageMs / (60 * 60 * 1000));
    return (
      `svc-session-contract-freshness: Session contract is ${ageHours}h old ` +
      `(max ${maxAgeHours}h). Update the contract or start a new session.`
    );
  }

  const currentSkill = process.env.SVC_CURRENT_SKILL || "";
  if (currentSkill && contract.skill && typeof contract.skill === "string" && contract.skill !== currentSkill) {
    return (
      `svc-session-contract-freshness: Session contract.skill="${contract.skill}" ` +
      `does not match SVC_CURRENT_SKILL="${currentSkill}". Run route-workflow to reconcile.`
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Batch format + typecheck
// ---------------------------------------------------------------------------

function runBatchFormatTypecheck(directory: string): void {
  const scriptsPath = findScriptsPath();
  if (!scriptsPath) return;

  // Check if package.json exists with relevant scripts
  const pkgPath = path.join(directory, "package.json");
  if (!fs.existsSync(pkgPath)) return;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    const scripts = pkg.scripts || {};

    // Run format if available
    if (scripts.format) {
      try {
        execFileSync("sh", ["-c", "npm run format"], { cwd: directory, stdio: "pipe", timeout: 30000 });
      } catch { /* format errors are non-blocking */ }
    }

    // Run typecheck if available
    if (scripts.typecheck || scripts["type-check"]) {
      const cmd = scripts.typecheck ? "npm run typecheck" : "npm run type-check";
      try {
        execFileSync("sh", ["-c", cmd], { cwd: directory, stdio: "pipe", timeout: 60000 });
      } catch {
        // Typecheck errors block — emit warning
        console.error("⚠️  svc-stop-quality: typecheck failed after edits");
      }
    }
  } catch { /* can't parse package.json */ }
}

// ---------------------------------------------------------------------------
// Session healthcheck (dangling symlink detection)
// ---------------------------------------------------------------------------

function checkDanglingSymlinks(directory: string): void {
  const skillsPath = findSkillsPath();
  if (!skillsPath || !fs.existsSync(skillsPath)) return;

  let dangling = 0;
  try {
    const entries = fs.readdirSync(skillsPath);
    for (const entry of entries) {
      const fullPath = path.join(skillsPath, entry);
      try {
        const stat = fs.lstatSync(fullPath);
        if (stat.isSymbolicLink()) {
          const target = fs.readlinkSync(fullPath);
          if (!fs.existsSync(fullPath)) {
            dangling++;
          }
        }
      } catch { /* skip unreadable entries */ }
    }
  } catch { /* can't read skills dir */ }

  if (dangling > 0) {
    console.error(
      `⚠️  svc-session-healthcheck: ${dangling} dangling symlink(s) in ${skillsPath}. ` +
      `Run ./setup to fix.`
    );
  }
}

// ---------------------------------------------------------------------------
// Main plugin export
// ---------------------------------------------------------------------------

export const SvcPlugin: Plugin = async ({ project, directory, worktree }) => {
  // Track edited files for batch format/typecheck at session idle
  const editedFiles = new Set<string>();

  return {
    // --- Inject svc environment variables into all shell execution ---
    "shell.env": async (_input, output) => {
      if (isDisabled("svc-shell-env")) return;
      output.env.SVC_HOST = "opencode";
      output.env.SVC_HARNESS = "opencode";
    },

    // --- Block dangerous tool calls before execution ---
    "tool.execute.before": async (input, output) => {
      // Session-contract freshness
      if (!isDisabled("svc-session-contract-freshness")) {
        const tool = input.tool;
        if (tool === "edit" || tool === "write" || tool === "apply_patch") {
          const freshnessError = checkSessionContractFreshness(directory);
          if (freshnessError) {
            throw new Error(freshnessError);
          }
        }
      }

      // Workflow guard: block config/lockfile edits
      if (!isDisabled("svc-workflow-guard")) {
        const tool = input.tool;

        if (tool === "edit" || tool === "write" || tool === "apply_patch") {
          // Extract file path from args
          const filePath = (output as any).args?.filePath ||
                           (output as any).args?.path || "";

          if (filePath) {
            const rel = makeRelative(filePath);
            if (matchesAny(rel, PROTECTED_CONFIG_PATTERNS)) {
              throw new Error(
                `svc-workflow-guard: blocked edit to protected config file ${rel}. ` +
                `Use package manager commands instead.`
              );
            }
            if (matchesAny(rel, PROTECTED_SVC_PATTERNS)) {
              throw new Error(
                `svc-workflow-guard: blocked edit to svc internal state file ${rel}. ` +
                `This file is managed by the svc framework.`
              );
            }
          }
        }

        // Bash guard: block --no-verify and dangerous commands
        if (tool === "bash") {
          const command = (output as any).args?.command || "";
          for (const pattern of FORBIDDEN_BASH_PATTERNS) {
            if (pattern.test(command)) {
              throw new Error(
                `svc-bash-guard: blocked dangerous bash command. ` +
                `Matched pattern: ${pattern.source}`
              );
            }
          }
        }
      }

      // Skill artifact authenticity: require recent skill receipt for canonical paths
      if (!isDisabled("svc-skill-artifact-authenticity")) {
        const tool = input.tool;
        if (tool === "edit" || tool === "write" || tool === "apply_patch") {
          const filePath = (output as any).args?.filePath ||
                           (output as any).args?.path || "";
          if (filePath) {
            const rel = makeRelative(filePath);
            const rule = findArtifactRule(rel);
            if (rule) {
              const hasReceipt = checkSkillReceipt(directory, rule.skills);
              if (!hasReceipt) {
                throw new Error(
                  `svc-skill-artifact-authenticity: blocked edit to ${rel}. ` +
                  `This path requires a recent receipt from one of: ${rule.skills.join(", ")}. ` +
                  `Invoke the skill first, then edit its output. ` +
                  `Bypass: SVC_SKILL_ARTIFACT_ALLOW=1`
                );
              }
            }
          }
        }
      }

      // Phase boundary: warn when editing spec files during execution
      if (!isDisabled("svc-phase-boundary")) {
        const tool = input.tool;
        if (tool === "edit" || tool === "write") {
          const filePath = (output as any).args?.filePath ||
                           (output as any).args?.path || "";
          if (filePath && /docs\/specs\/features\//.test(filePath)) {
            console.error(
              `⚠️  svc-phase-boundary: editing spec file during execution: ${makeRelative(filePath)}`
            );
          }
        }
      }
    },

    // --- Validate lane-tasks files after write ---
    "tool.execute.after": async (input, output) => {
      if (isDisabled("svc-lane-tasks-validator")) return;

      const tool = input.tool;
      if (tool !== "edit" && tool !== "write" && tool !== "apply_patch") return;

      const filePath = (output as any).args?.filePath ||
                       (output as any).args?.path || "";

      if (!filePath) return;

      // Track edited files for batch format/typecheck
      editedFiles.add(filePath);

      // Validate lane-tasks JSON
      if (/\.svc\/lane-tasks-.*\.json$/.test(filePath)) {
        const result = validateLaneTasksFile(filePath);
        if (!result.valid) {
          throw new Error(
            `svc-lane-tasks-validator: invalid lane-tasks JSON written to ${makeRelative(filePath)}.\n` +
            `${result.error}`
          );
        }
      }
    },

    // --- Batch format + typecheck at session idle ---
    "session.idle": async () => {
      if (isDisabled("svc-stop-quality")) return;
      if (editedFiles.size === 0) return;

      // Run format+typecheck in the project directory
      const targetDir = worktree || directory;
      runBatchFormatTypecheck(targetDir);
      editedFiles.clear();
    },

    // --- Dangling symlink detection at session start ---
    "session.created": async () => {
      if (isDisabled("svc-session-healthcheck")) return;
      checkDanglingSymlinks(directory);
    },

    // --- Lane-tasks recovery after compaction ---
    "session.compacted": async () => {
      if (isDisabled("svc-compact-recovery")) return;

      // After compaction, re-read lane-tasks file as source of truth
      const svcDir = path.join(directory, ".svc");
      if (!fs.existsSync(svcDir)) return;

      try {
        const files = fs.readdirSync(svcDir);
        const laneTasksFiles = files.filter((f) => f.startsWith("lane-tasks-") && f.endsWith(".json"));
        if (laneTasksFiles.length > 0) {
          console.error(
            `svc-compact-recovery: ${laneTasksFiles.length} lane-tasks file(s) found. ` +
            `Re-read these as the source of truth after compaction.`
          );
        }
      } catch { /* .svc dir not readable */ }
    },
  };
};

export default SvcPlugin;
