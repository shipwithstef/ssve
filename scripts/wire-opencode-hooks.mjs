#!/usr/bin/env node

/**
 * wire-opencode-hooks.mjs — Idempotently installs svc enforcement plugins and
 * configures OpenCode CLI for use as a first-class svc host.
 *
 * Usage:
 *   node scripts/wire-opencode-hooks.mjs --skills-path <path> [--dry-run]
 *
 * Called by `setup --host opencode` after installation. Can also be run
 * standalone to re-wire without a full reinstall.
 *
 * What it does:
 *   1. Copies svc plugin files to ~/.config/opencode/plugins/
 *   2. Merges MiMo provider + svc agent definitions into ~/.config/opencode/opencode.json
 *   3. Generates ~/.config/opencode/AGENTS.md from svc universal rules
 *   4. Verifies installation
 *
 * OpenCode currently exposes no command-hook registry equivalent to the
 * pre-tool events used by other svc hosts. Default-checkout isolation is
 * therefore enforced by hooks/git/pre-commit.d/10-default-checkout-isolation.
 * Do not claim pre-mutation enforcement until a supported lifecycle event is
 * verified.
 *
 * Idempotent: safe to re-run. Skips steps where target already matches source.
 *
 * Exit codes:
 *   0 — success
 *   1 — error (bad args, missing files)
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let skillsPath = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--skills-path" && args[i + 1]) {
    skillsPath = args[++i];
  } else if (args[i] === "--dry-run") {
    dryRun = true;
  }
}

if (!skillsPath) {
  console.error("Usage: wire-opencode-hooks.mjs --skills-path <path> [--dry-run]");
  process.exit(1);
}

const HOME = os.homedir();
const CONFIG_DIR = path.join(HOME, ".config", "opencode");
const PLUGINS_DIR = path.join(CONFIG_DIR, "plugins");
const CONFIG_FILE = path.join(CONFIG_DIR, "opencode.json");
const AGENTS_FILE = path.join(CONFIG_DIR, "AGENTS.md");
const SOURCE_HOOKS_DIR = path.join(skillsPath, "hooks", "opencode");
const REFERENCE_CONFIG = path.join(skillsPath, "references", "opencode-mimo-config.json");

// Resolve the source repo from .source-repo pointer (written by setup).
// The manifest and rules live in the repo, not under the installed skills dir.
const SOURCE_REPO_FILE = path.join(skillsPath, ".source-repo");
let SOURCE_REPO = skillsPath;
try {
  SOURCE_REPO = fs.readFileSync(SOURCE_REPO_FILE, "utf8").trim();
} catch { /* fallback to skillsPath */ }

// Read rulesRegistry from skills-manifest.json — source of truth for universal vs stack-specific rules.
const MANIFEST_FILE = path.join(SOURCE_REPO, "skills-manifest.json");
let rulesRegistry = [];
try {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  rulesRegistry = manifest.rulesRegistry?.entries || [];
} catch { /* no manifest, skip rules */ }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dst) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dst)) {
    const srcContent = fs.readFileSync(src, "utf8");
    const dstContent = fs.readFileSync(dst, "utf8");
    if (srcContent === dstContent) return false; // already up to date
  }
  if (!dryRun) {
    fs.copyFileSync(src, dst);
  }
  return true;
}

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJSON(filePath, obj) {
  if (!dryRun) {
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + "\n", "utf8");
  }
}

// ---------------------------------------------------------------------------
// Step 1: Install plugins
// ---------------------------------------------------------------------------

console.log("OpenCode hook wiring");
console.log("====================");
console.log(`Skills:  ${skillsPath}`);
console.log(`Config:  ${CONFIG_DIR}`);
console.log(`Source:  ${SOURCE_HOOKS_DIR}`);
console.log("Isolation: hooks/git/pre-commit.d/10-default-checkout-isolation (no supported OpenCode pre-tool command hook)");
console.log("");

ensureDir(CONFIG_DIR);
ensureDir(PLUGINS_DIR);

let pluginsInstalled = 0;

if (fs.existsSync(SOURCE_HOOKS_DIR)) {
  const pluginFiles = fs.readdirSync(SOURCE_HOOKS_DIR)
    .filter((f) => f.endsWith(".ts") || f.endsWith(".js"));

  for (const file of pluginFiles) {
    const src = path.join(SOURCE_HOOKS_DIR, file);
    const dst = path.join(PLUGINS_DIR, file);
    if (copyFile(src, dst)) {
      console.log(`  Plugin: ${file}`);
      pluginsInstalled++;
    }
  }
}

console.log(`Plugins: ${pluginsInstalled} installed${pluginsInstalled === 0 ? " (already current)" : ""}`);

// ---------------------------------------------------------------------------
// Step 2: Merge config into opencode.json
// ---------------------------------------------------------------------------

// Read reference config for MiMo provider definition
let mimoProvider = null;
if (fs.existsSync(REFERENCE_CONFIG)) {
  const refConfig = readJSON(REFERENCE_CONFIG);
  if (refConfig?.provider?.mimo) {
    mimoProvider = refConfig.provider.mimo;
  }
}

// Build svc additions
const svcConfig = {
  agent: {
    build: {
      mode: "primary",
      description: "Full development agent with all tools enabled (svc default)",
      permission: {
        edit: "allow",
        bash: "allow",
        skill: "allow",
      },
    },
    plan: {
      mode: "primary",
      description: "Planning and analysis agent — no file modifications",
      permission: {
        edit: "deny",
        bash: "deny",
        skill: "allow",
        read: "allow",
        grep: "allow",
        glob: "allow",
      },
    },
    "summary-extractor": {
      mode: "subagent",
      description: "Extracts SVC_WORKER_SUMMARY blocks from worker logs",
      model: "mimo/mimo-v2.5",
      permission: {
        edit: "deny",
        bash: "deny",
        skill: "deny",
      },
      hidden: true,
    },
  },
  permission: {
    skill: "allow",
    bash: {
      "*": "allow",
      "rm -rf *": "ask",
      "git push*": "ask",
      "git push --force*": "deny",
    },
    edit: "allow",
    task: "allow",
  },
};

// Merge with existing config
const existingConfig = readJSON(CONFIG_FILE) || {};
const mergedConfig = { ...existingConfig };

// Add $schema if missing
if (!mergedConfig.$schema) {
  mergedConfig.$schema = "https://opencode.ai/config.json";
}

// Merge provider (don't overwrite existing providers)
if (mimoProvider) {
  if (!mergedConfig.provider) mergedConfig.provider = {};
  if (!mergedConfig.provider.mimo) {
    mergedConfig.provider.mimo = mimoProvider;
    console.log("Config: added mimo provider");
  }
}

// Merge agents (don't overwrite existing agents)
if (!mergedConfig.agent) mergedConfig.agent = {};
for (const [name, agentConfig] of Object.entries(svcConfig.agent)) {
  if (!mergedConfig.agent[name]) {
    mergedConfig.agent[name] = agentConfig;
    console.log(`Config: added agent "${name}"`);
  }
}

// Merge permissions (don't overwrite existing)
if (!mergedConfig.permission) mergedConfig.permission = {};
for (const [key, value] of Object.entries(svcConfig.permission)) {
  if (!mergedConfig.permission[key]) {
    mergedConfig.permission[key] = value;
  }
}

// Add instructions pointing to svc rule files (using manifest as source of truth)
const instructionPaths = [];

// Universal rules from manifest → always loaded
for (const entry of rulesRegistry) {
  if (entry.stack === "universal") {
    const rulePath = path.join(SOURCE_REPO, entry.path);
    if (fs.existsSync(rulePath)) {
      instructionPaths.push(rulePath);
    }
  }
}

// Add AGENTS.md as primary instruction
if (!instructionPaths.includes(AGENTS_FILE)) {
  instructionPaths.unshift(AGENTS_FILE);
}

if (instructionPaths.length > 0) {
  if (mergedConfig.instructions) {
    // Append svc rules to existing instructions (don't overwrite user config)
    const existing = new Set(mergedConfig.instructions);
    let added = 0;
    for (const p of instructionPaths) {
      if (!existing.has(p)) {
        mergedConfig.instructions.push(p);
        added++;
      }
    }
    if (added > 0) {
      console.log(`Config: appended ${added} svc instruction(s) to existing ${mergedConfig.instructions.length - added}`);
    }
  } else {
    mergedConfig.instructions = instructionPaths;
    console.log(`Config: added ${instructionPaths.length} instruction file(s)`);
  }
}

writeJSON(CONFIG_FILE, mergedConfig);
console.log(`Config: wrote ${CONFIG_FILE}`);

// ---------------------------------------------------------------------------
// Step 3: Generate AGENTS.md from rules
// ---------------------------------------------------------------------------

function stripFrontmatter(content) {
  // Remove YAML frontmatter (--- ... ---)
  const lines = content.split("\n");
  let inFrontmatter = false;
  let frontmatterCount = 0;
  const result = [];

  for (const line of lines) {
    if (line.trim() === "---") {
      frontmatterCount++;
      if (frontmatterCount <= 2) {
        inFrontmatter = frontmatterCount === 1;
        continue;
      }
    }
    if (!inFrontmatter) {
      result.push(line);
    }
  }

  return result.join("\n").trim();
}

// Collect universal rules and discover stack-specific rules
const ruleSections = [];
const stackRules = {}; // { stackName: [{ name, path }] }

for (const entry of rulesRegistry) {
  const rulePath = path.join(SOURCE_REPO, entry.path);
  if (!fs.existsSync(rulePath)) continue;

  try {
    const content = fs.readFileSync(rulePath, "utf8");
    const body = stripFrontmatter(content);
    if (!body) continue;

    if (entry.stack === "universal") {
      // Universal rule — embed body directly
      ruleSections.push(`## Rule: ${entry.path}\n\n${body}`);
    } else {
      // Stack-specific rule — record for lazy-load table
      const stackName = entry.stack || path.dirname(entry.path).split("/")[0] || "general";
      if (!stackRules[stackName]) stackRules[stackName] = [];
      const installedPath = path.join(skillsPath, "rules", entry.path.replace("rules/", ""));
      stackRules[stackName].push({ name: path.basename(entry.path), path: installedPath, relPath: entry.path, type: entry.type });
    }
  } catch { /* skip unreadable files */ }
}

// Build AGENTS.md
const stackRuleSections = [];

if (Object.keys(stackRules).length > 0) {
  stackRuleSections.push(`## Stack-Specific Rules (Load When Relevant)

These rules are available for specific technology stacks. When you identify the project's tech stack, read the relevant rule file and follow its instructions.

| Stack | Rule File | When to Load |
|-------|-----------|--------------|`);

  for (const [stack, rules] of Object.entries(stackRules).sort()) {
    for (const rule of rules) {
      stackRuleSections.push(`| ${stack} | \`${rule.path}\` | Project uses ${stack} (check package.json, Cargo.toml, go.mod, etc.) |`);
    }
  }

  stackRuleSections.push(`
**How to use:** When starting work on a project, check \`package.json\`, \`Cargo.toml\`, \`go.mod\`, \`pyproject.toml\`, or similar config files to determine the tech stack. Then use the \`read\` tool to load the relevant rule file(s) from the table above. Follow the rules as mandatory instructions for that stack.`);
}

const agentsMd = `# SVC Framework Rules (Auto-Generated)

This file is auto-generated by svc's wire-opencode-hooks.mjs.
Do not edit manually — re-run \`./setup --host opencode\` to regenerate.

## Project Rules

When working on a project, also read the project's AGENTS.md file in the project root.

${ruleSections.join("\n\n---\n\n")}

${stackRuleSections.join("\n")}
`;

if (!dryRun) {
  fs.writeFileSync(AGENTS_FILE, agentsMd, "utf8");
}
console.log(`Rules:  generated ${AGENTS_FILE} (${ruleSections.length} universal rule(s))`);

// ---------------------------------------------------------------------------
// Step 4: Verify
// ---------------------------------------------------------------------------

console.log("");
console.log("Verification:");

const checks = [
  { name: "Plugin installed", check: () => fs.existsSync(path.join(PLUGINS_DIR, "svc-opencode-plugin.ts")) },
  { name: "Config exists", check: () => fs.existsSync(CONFIG_FILE) },
  { name: "AGENTS.md exists", check: () => fs.existsSync(AGENTS_FILE) },
  { name: "MiMo provider configured", check: () => {
    const cfg = readJSON(CONFIG_FILE);
    return !!cfg?.provider?.mimo;
  }},
  { name: "Skills discoverable", check: () => fs.existsSync(path.join(skillsPath, "route-workflow/SKILL.md")) },
];

let errors = 0;
for (const { name, check } of checks) {
  if (check()) {
    console.log(`  ✓ ${name}`);
  } else {
    console.log(`  ✗ ${name}`);
    errors++;
  }
}

if (errors > 0) {
  console.error(`\nWiring completed with ${errors} error(s).`);
  process.exit(1);
}

console.log("");
console.log("OpenCode is ready. Start it in any project:");
console.log("  cd your-project && opencode");
console.log("");
console.log("For MiMo models, ensure ~/.config/opencode/opencode.json has");
console.log("the mimo provider with a valid MIMO_API_KEY.");
