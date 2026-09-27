#!/usr/bin/env node
/**
 * Read a project-local communication and learning profile.
 *
 * This module is deliberately a small, read-only boundary. Other features may
 * share .svc/project-preferences.json through additional top-level keys; this
 * reader validates only the communication and learning sections it owns.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const LEARNING_MODES = new Set(["off", "opportunistic"]);
const MAX_CONFIG_BYTES = 16 * 1024;

export const DEFAULT_PROJECT_PREFERENCES = Object.freeze({
  communication: Object.freeze({
    explanation_level: "beginner",
    style: "plain_stepwise",
  }),
  learning: Object.freeze({
    mode: "off",
    difficulty: "beginner",
  }),
});

function defaults(source = "default", diagnostics = []) {
  return {
    communication: { ...DEFAULT_PROJECT_PREFERENCES.communication },
    learning: { ...DEFAULT_PROJECT_PREFERENCES.learning },
    source,
    diagnostics,
  };
}

function invalid(message) {
  return defaults("invalid", [message]);
}

function section(value, name) {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${name} must be an object`);
  }
  return value;
}

function choice(value, options, name) {
  if (value !== undefined && !options.has(value)) {
    throw new Error(`${name} must be one of: ${[...options].join(", ")}`);
  }
}

/**
 * Return safe defaults for an absent or invalid file. Never writes to the
 * project or reads the global builder profile. Diagnostics name the bad field
 * without echoing private values or the JSON payload.
 */
export function loadProjectPreferences(root = process.cwd()) {
  let projectRoot;
  try {
    projectRoot = fs.realpathSync(path.resolve(root));
    if (!fs.statSync(projectRoot).isDirectory()) return invalid("project root must be a directory");
  } catch {
    return invalid("project root is not a readable directory");
  }

  const svcDir = path.join(projectRoot, ".svc");
  const configPath = path.join(svcDir, "project-preferences.json");
  let svcStat;
  try { svcStat = fs.lstatSync(svcDir); }
  catch (error) {
    if (error.code === "ENOENT") return defaults();
    return invalid("cannot inspect .svc directory");
  }
  if (!svcStat.isDirectory() || svcStat.isSymbolicLink()) return invalid(".svc must be a regular directory");

  let stat;
  try { stat = fs.lstatSync(configPath); }
  catch (error) {
    if (error.code === "ENOENT") return defaults();
    return invalid("cannot inspect .svc/project-preferences.json");
  }
  if (!stat.isFile() || stat.isSymbolicLink()) return invalid("project-preferences.json must be a regular file");
  if (stat.size > MAX_CONFIG_BYTES) return invalid("project-preferences.json exceeds 16 KiB");

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    return invalid("project-preferences.json is not readable JSON");
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return invalid("project-preferences.json must contain an object");
  }

  try {
    const communication = section(config.communication, "communication");
    const learning = section(config.learning, "learning");
    choice(communication.explanation_level, LEVELS, "communication.explanation_level");
    choice(communication.style, new Set(["plain_stepwise"]), "communication.style");
    choice(learning.mode, LEARNING_MODES, "learning.mode");
    choice(learning.difficulty, LEVELS, "learning.difficulty");
    return {
      communication: {
        explanation_level: communication.explanation_level ?? DEFAULT_PROJECT_PREFERENCES.communication.explanation_level,
        style: communication.style ?? DEFAULT_PROJECT_PREFERENCES.communication.style,
      },
      learning: {
        mode: learning.mode ?? DEFAULT_PROJECT_PREFERENCES.learning.mode,
        difficulty: learning.difficulty ?? DEFAULT_PROJECT_PREFERENCES.learning.difficulty,
      },
      source: "project",
      diagnostics: [],
    };
  } catch (error) {
    return invalid(error.message);
  }
}

/**
 * An optional offer is eligible only during a natural wait, against a concrete
 * project source, and at most once while an earlier offer remains unanswered.
 * The caller owns session state; this function neither waits nor persists it.
 */
export function microlearningEligibility({ preferences, naturalWait = false, evidencePath = "", unansweredOffer = false, skipped = false } = {}) {
  if (preferences?.learning?.mode !== "opportunistic") return { eligible: false, reason: "learning-off" };
  if (skipped) return { eligible: false, reason: "user-skipped" };
  if (unansweredOffer) return { eligible: false, reason: "offer-outstanding" };
  if (!naturalWait) return { eligible: false, reason: "no-natural-wait" };
  if (typeof evidencePath !== "string" || !evidencePath.trim()) return { eligible: false, reason: "no-project-evidence" };
  return { eligible: true, reason: "eligible" };
}

function main(argv) {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("Usage: node scripts/project-preferences.mjs [--root DIR]\n");
    return 0;
  }
  if (argv.length > 2 || (argv.length === 2 && argv[0] !== "--root") || argv.length === 1) {
    process.stderr.write("Usage: node scripts/project-preferences.mjs [--root DIR]\n");
    return 2;
  }
  process.stdout.write(JSON.stringify(loadProjectPreferences(argv[1]), null, 2) + "\n");
  return 0;
}

function isDirectInvocation() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(path.resolve(process.argv[1]))
      === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  process.exitCode = main(process.argv.slice(2));
}
