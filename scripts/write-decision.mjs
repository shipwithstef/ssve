#!/usr/bin/env node
// write-decision.mjs — Uncertainty Quantification (#4) + Meta-Learning (#8) writer.
// Appends a decision OR meta-learning record to .svc/agent-decisions.jsonl
// (consolidated per the JSONL plan; distinguished by `type`). Append-only, gitignored.
//
// Optional --skill <name> attributes either record type to a skill for assessment.
// Decision (T4):
//   node scripts/write-decision.mjs --type decision --task_id T3 \
//     --decision_point "auth library" --choice jsonwebtoken --confidence 0.75 \
//     --reasoning "most common JWT lib" [--evidence_level training_data]
// Meta-learning (T8):
//   node scripts/write-decision.mjs --type meta-learning --category verification_approach \
//     --observation "cross-review finds 3x more than self-review" --confidence 0.85 \
//     [--applies_to review-gate,review-exec]

import fs from "node:fs";
import path from "node:path";
import { appendJsonlLine } from "./state-io.mjs";

const projectDir = process.env.SVC_PROJECT_DIR || ".";
/**
 * Parse required option/value pairs without interpreting literal values as flags.
 * @param {string[]} argv Node process arguments.
 * @returns {Object<string, string>} Parsed options; later duplicates retain precedence.
 */
function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--") || argv[i + 1] === undefined) {
      throw new Error(`${argv[i] || "option"} requires a value`);
    }
    a[argv[i].slice(2)] = argv[i + 1];
  }
  return a;
}
let args;
try { args = parseArgs(process.argv); }
catch (error) { console.error(error.message); process.exit(1); }
const confidence = args.confidence === undefined ? null : Number(args.confidence);
if (args.confidence !== undefined && (!args.confidence.trim() || !Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
  console.error("--confidence must be a finite number between 0 and 1"); process.exit(1);
}
if (args.skill !== undefined && !args.skill.trim()) {
  console.error("--skill must not be empty"); process.exit(1);
}
const type = args.type;
if (type !== "decision" && type !== "meta-learning") {
  console.error("--type must be 'decision' or 'meta-learning'");
  process.exit(1);
}

const entry = { ts: new Date().toISOString(), type };
if (args.skill !== undefined) entry.skill = args.skill.trim();
if (type === "decision") {
  if (!args.decision_point || !args.choice) {
    console.error("decision requires --decision_point and --choice");
    process.exit(1);
  }
  Object.assign(entry, {
    task_id: args.task_id || null,
    decision_point: args.decision_point,
    choice: args.choice,
    confidence,
    reasoning: args.reasoning || null,
    evidence_level: args.evidence_level || "training_data",
  });
} else {
  if (!args.category || !args.observation) {
    console.error("meta-learning requires --category and --observation");
    process.exit(1);
  }
  Object.assign(entry, {
    category: args.category,
    observation: args.observation,
    confidence,
    applies_to: args.applies_to ? [...new Set(args.applies_to.split(",").map((value) => value.trim()).filter(Boolean))] : [],
  });
}

const outPath = path.join(projectDir, ".svc", "agent-decisions.jsonl");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
appendJsonlLine(outPath, entry);
console.log(JSON.stringify(entry));
