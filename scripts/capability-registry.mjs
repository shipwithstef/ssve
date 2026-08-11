#!/usr/bin/env node
/**
 * Capability Registry Manager
 *
 * Maintains `.svc/capability-registry.json` per project.
 * The auto-router checks this before creating lane-tasks.
 *
 * Usage:
 *   node capability-registry.mjs init <project-root>
 *   node capability-registry.mjs check <project-root> <capability-name>
 *   node capability-registry.mjs add <project-root> <capability-name> [<source>]
 *   node capability-registry.mjs list <project-root>
 *   node capability-registry.mjs auto-detect <project-root>
 */

import { existsSync } from "fs";
import { join, resolve } from "path";
import { execSync } from "child_process";
import { readJsonAtomic, writeJsonAtomic } from "./state-io.mjs";

const REGISTRY_FILE = ".svc/capability-registry.json";

function loadRegistry(projectRoot) {
  const path = join(resolve(projectRoot), REGISTRY_FILE);
  try {
    return readJsonAtomic(path);
  } catch {
    return null;
  }
}

function saveRegistry(projectRoot, registry) {
  const path = join(resolve(projectRoot), REGISTRY_FILE);
  writeJsonAtomic(path, registry);
}

function defaultRegistry() {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    capabilities: {},
    sources: {},
  };
}

function autoDetect(projectRoot) {
  const root = resolve(projectRoot);
  const caps = {};
  const sources = {};

  // Check for common tools
  const checks = [
    ["node", "node", "node --version"],
    ["npm", "npm", "npm --version"],
    ["git", "git", "git --version"],
    ["docker", "docker", "docker --version"],
    ["playwright", "npx playwright", "npx playwright --version"],
    ["vite", "npx vite", "npx vite --version"],
    ["wrangler", "npx wrangler", "npx wrangler --version"],
    ["base44", "env", "BASE44_APP_ID"],
    ["stripe", "env", "STRIPE_SECRET_KEY"],
    ["dodo", "env", "DODO_WEBHOOK_SECRET"],
    ["posthog", "env", "POSTHOG_KEY"],
    ["supabase", "env", "SUPABASE_URL"],
    ["firebase", "env", "FIREBASE_PROJECT_ID"],
    ["vercel", "env", "VERCEL_TOKEN"],
  ];

  for (const [name, type, check] of checks) {
    if (type === "env") {
      if (process.env[check]) {
        caps[name] = true;
        sources[name] = `env:${check}`;
      }
    } else if (type === "node") {
      try {
        execSync(check, { cwd: root, stdio: "pipe" });
        caps[name] = true;
        sources[name] = `cmd:${check}`;
      } catch {
        caps[name] = false;
      }
    }
  }

  // Detect framework skills
  const skillsDir = join(process.env.HOME || "/root", ".kimi/skills");
  const skillChecks = [
    "route-workflow", "plan-changeset", "execute-changeset",
    "review-gate", "land-changeset", "evolve-framework", "improve-framework",
    "base44-environment", "base44-sdk", "base44-cli",
  ];
  for (const skill of skillChecks) {
    const skillPath = join(skillsDir, skill, "SKILL.md");
    if (existsSync(skillPath)) {
      caps[`skill:${skill}`] = true;
      sources[`skill:${skill}`] = skillPath;
    } else {
      caps[`skill:${skill}`] = false;
    }
  }

  return { capabilities: caps, sources };
}

const [,, cmd, ...args] = process.argv;

if (cmd === "init") {
  const root = args[0] || ".";
  const reg = defaultRegistry();
  saveRegistry(root, reg);
  console.log(JSON.stringify({ status: "initialized", path: join(resolve(root), REGISTRY_FILE) }));
  process.exit(0);
}

if (cmd === "auto-detect") {
  const root = args[0] || ".";
  const detected = await autoDetect(root);
  let reg = loadRegistry(root) || defaultRegistry();
  reg.capabilities = { ...reg.capabilities, ...detected.capabilities };
  reg.sources = { ...reg.sources, ...detected.sources };
  reg.lastUpdated = new Date().toISOString();
  saveRegistry(root, reg);
  console.log(JSON.stringify({ status: "auto-detected", capabilities: reg.capabilities }, null, 2));
  process.exit(0);
}

if (cmd === "check") {
  const [root, cap] = args;
  if (!root || !cap) {
    console.error("Usage: check <project-root> <capability>");
    process.exit(1);
  }
  const reg = loadRegistry(root);
  if (!reg) {
    console.log(JSON.stringify({ capability: cap, available: false, reason: "registry_not_initialized" }));
    process.exit(0);
  }
  const available = reg.capabilities[cap] === true;
  console.log(JSON.stringify({
    capability: cap,
    available,
    source: reg.sources[cap] || null,
    lastUpdated: reg.lastUpdated,
  }));
  process.exit(0);
}

if (cmd === "add") {
  const [root, cap, source] = args;
  if (!root || !cap) {
    console.error("Usage: add <project-root> <capability> [<source>]");
    process.exit(1);
  }
  let reg = loadRegistry(root) || defaultRegistry();
  reg.capabilities[cap] = true;
  if (source) reg.sources[cap] = source;
  reg.lastUpdated = new Date().toISOString();
  saveRegistry(root, reg);
  console.log(JSON.stringify({ status: "added", capability: cap }));
  process.exit(0);
}

if (cmd === "list") {
  const root = args[0] || ".";
  const reg = loadRegistry(root);
  if (!reg) {
    console.log(JSON.stringify({ error: "registry_not_initialized" }));
    process.exit(0);
  }
  console.log(JSON.stringify(reg, null, 2));
  process.exit(0);
}

console.error("Unknown command:", cmd);
console.error("Usage: init | auto-detect | check | add | list");
process.exit(1);
