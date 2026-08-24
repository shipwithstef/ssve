#!/usr/bin/env node

import path from "node:path";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { appendJsonlLine, withStateLock } from "./state-io.mjs";

const VALID_TYPES = new Set([
  "mechanical",
  "taste",
  "user",
  "question",
  "answer",
  "no-ship",
  "gate-result",
]);
const VALID_DECIDED_BY = new Set(["P0", "user", "review-gate", "cross-model"]);

function usage() {
  console.error(
    "Usage: node scripts/pipeline-log.mjs append --path <jsonl> --run-id <id> --skill <name> --phase <n> --type <type> --decision <text> --reasoning <text> --decided-by <actor> [--timestamp <iso>] [--evidence <text>] [--alternatives-json '[\"a\",\"b\"]'] [--overrideable true|false]\n" +
    "   or: node scripts/pipeline-log.mjs append-batch --path <jsonl> < events.ndjson  (one fully-formed event object per line)"
  );
  process.exit(1);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = value;
    i += 1;
  }
  return args;
}

function parseBoolean(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`Expected true|false, got: ${value}`);
}

function ensureRequired(args, keys) {
  for (const key of keys) {
    if (!args[key]) {
      throw new Error(`Missing required flag --${key}`);
    }
  }
}

// OPT-08: the single-invocation `append` CLI can't buffer in memory across
// calls (each invocation is a fresh process). append-batch is the faithful
// alternative — read fully-formed NDJSON events from stdin and append them
// all under ONE lock acquisition instead of one process per event.
function validateBatchEvent(event, lineNo) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error(`line ${lineNo}: not a JSON object`);
  }
  for (const key of ["run_id", "skill", "decision", "reasoning", "decided_by"]) {
    if (!event[key]) throw new Error(`line ${lineNo}: missing required field ${key}`);
  }
  if (!Number.isFinite(event.phase)) throw new Error(`line ${lineNo}: phase must be a number`);
  if (!VALID_TYPES.has(event.type)) {
    throw new Error(`line ${lineNo}: type must be one of ${Array.from(VALID_TYPES).join(", ")}`);
  }
  if (!VALID_DECIDED_BY.has(event.decided_by)) {
    throw new Error(`line ${lineNo}: decided-by must be one of ${Array.from(VALID_DECIDED_BY).join(", ")}`);
  }
  event.timestamp = event.timestamp ?? new Date().toISOString();
  event.overrideable = event.overrideable ?? true;
}

const [command, ...rest] = process.argv.slice(2);
if (command === "append-batch") {
  let batchArgs;
  try {
    batchArgs = parseArgs(rest);
    ensureRequired(batchArgs, ["path"]);
    const outputPath = path.resolve(batchArgs.path);
    const lines = readFileSync(0, "utf8").split("\n").filter((line) => line.trim());
    const events = lines.map((line, index) => {
      let event;
      try { event = JSON.parse(line); }
      catch (error) { throw new Error(`line ${index + 1}: invalid JSON: ${error.message}`); }
      validateBatchEvent(event, index + 1);
      return event;
    });
    withStateLock(outputPath, () => {
      mkdirSync(path.dirname(outputPath), { recursive: true });
      if (events.length > 0) {
        appendFileSync(outputPath, events.map((e) => JSON.stringify(e)).join("\n") + "\n", "utf8");
      }
    });
    console.log(`appended ${events.length} events to ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
if (command !== "append") {
  usage();
}

let args;
try {
  args = parseArgs(rest);
  ensureRequired(args, [
    "path",
    "run-id",
    "skill",
    "phase",
    "type",
    "decision",
    "reasoning",
    "decided-by",
  ]);
} catch (error) {
  console.error(error.message);
  usage();
}

const ts = args.timestamp ?? new Date().toISOString();
const event = {
  // WI-562 IP-R7 canonical fields (schema_version >= 1 entries validate
  // against schemas/pipeline-decision-entry.schema.json)...
  schema_version: 1,
  kind: args.type,
  ts,
  // ...written ALONGSIDE the legacy alias keys so every historical consumer
  // (e.g. svc-skill-artifact-authenticity requiring `timestamp`) keeps working.
  timestamp: ts,
  legacy_type: args.type,
  legacy_timestamp: ts,
  run_id: args["run-id"],
  skill: args.skill,
  phase: Number(args.phase),
  type: args.type,
  decision: args.decision,
  reasoning: args.reasoning,
  decided_by: args["decided-by"],
  overrideable: parseBoolean(args.overrideable ?? "true"),
};

if (!Number.isFinite(event.phase)) {
  console.error("--phase must be a number");
  process.exit(1);
}

if (!VALID_TYPES.has(event.type)) {
  console.error(
    `--type must be one of ${Array.from(VALID_TYPES).join(", ")}`
  );
  process.exit(1);
}

if (!VALID_DECIDED_BY.has(event.decided_by)) {
  console.error(
    `--decided-by must be one of ${Array.from(VALID_DECIDED_BY).join(", ")}`
  );
  process.exit(1);
}

if (args.evidence) {
  event.evidence = args.evidence;
}

if (args["alternatives-json"]) {
  try {
    const alternatives = JSON.parse(args["alternatives-json"]);
    if (!Array.isArray(alternatives)) {
      throw new Error("alternatives must be an array");
    }
    event.alternatives = alternatives;
  } catch (error) {
    console.error(`Invalid --alternatives-json: ${error.message}`);
    process.exit(1);
  }
}

const outputPath = path.resolve(args.path);
appendJsonlLine(outputPath, event);

console.log(`appended ${outputPath}`);
