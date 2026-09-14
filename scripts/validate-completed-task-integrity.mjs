#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  classifyGraphCompletedTasks,
} from "./lib/completed-task-integrity.mjs";

function usage(message) {
  if (message) process.stderr.write(`validate-completed-task-integrity: ${message}\n`);
  process.stderr.write(
    "Usage: node scripts/validate-completed-task-integrity.mjs --graph <path> --registry <path> "
    + "[--task <id>]... [--registered-skills-only] [--structured-or-skip-only] "
    + "[--phase-free-compat strict|loaded|summary] "
    + "[--repo-root <path>] [--json]\n",
  );
  process.exit(2);
}

function parseArgs(argv) {
  const args = {
    graph: null,
    registry: null,
    taskIds: [],
    registeredSkillsOnly: false,
    structuredOrSkipOnly: false,
    phaseFreeCompatibility: "strict",
    repoRoot: null,
    json: false,
  };
  const takeValue = (index, option) => {
    const value = argv[index + 1];
    if (typeof value !== "string" || !value.trim() || value.startsWith("--")) {
      usage(`${option} requires a value`);
    }
    return value;
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--graph") args.graph = takeValue(index++, value);
    else if (value === "--registry") args.registry = takeValue(index++, value);
    else if (value === "--task") args.taskIds.push(takeValue(index++, value));
    else if (value === "--registered-skills-only") args.registeredSkillsOnly = true;
    else if (value === "--structured-or-skip-only") args.structuredOrSkipOnly = true;
    else if (value === "--phase-free-compat") args.phaseFreeCompatibility = takeValue(index++, value);
    else if (value === "--repo-root") args.repoRoot = takeValue(index++, value);
    else if (value === "--json") args.json = true;
    else usage(`unknown argument '${value}'`);
  }
  if (!args.graph || !args.registry) usage("--graph and --registry are required");
  if (args.taskIds.some((id) => typeof id !== "string" || !id.trim())) usage("--task requires a non-empty id");
  if (!["strict", "loaded", "summary"].includes(args.phaseFreeCompatibility)) {
    usage("--phase-free-compat must be strict, loaded, or summary");
  }
  return args;
}

function readJson(filePath, label) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    usage(`cannot read ${label} '${filePath}': ${error.message}`);
  }
}

function defaultRepoRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
  } catch {
    return process.cwd();
  }
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(args.repoRoot ?? defaultRepoRoot());
const graphPath = path.resolve(args.graph);
const registryPath = path.resolve(args.registry);
const graph = readJson(graphPath, "graph");
const registry = readJson(registryPath, "registry");
if (!graph || typeof graph !== "object" || Array.isArray(graph) || !Array.isArray(graph.tasks)) {
  usage("graph must be an object with a tasks array");
}
if (!registry || typeof registry !== "object" || Array.isArray(registry)) {
  usage("registry must be an object");
}

let result;
try {
  result = classifyGraphCompletedTasks({
    graph,
    graphPath,
    registry,
    repoRoot,
    registeredSkillsOnly: args.registeredSkillsOnly,
    structuredOrSkipOnly: args.structuredOrSkipOnly,
    phaseFreeCompatibility: args.phaseFreeCompatibility,
    taskIds: args.taskIds,
  });
} catch (error) {
  usage(error.message);
}

if (args.json) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  for (const entry of result.results) {
    const codes = entry.reasons.map((item) => item.code).join(",");
    process.stdout.write(
      `${entry.ok ? "PASS" : "FAIL"} task ${entry.task_id} (${entry.skill ?? "<unknown>"}): `
      + `${entry.classification}${codes ? ` [${codes}]` : ""}\n`,
    );
  }
  process.stdout.write(
    `${result.ok ? "PASS" : "FAIL"} completed-task integrity: ${result.checked} task(s) checked\n`,
  );
}
process.exit(result.ok ? 0 : 1);
