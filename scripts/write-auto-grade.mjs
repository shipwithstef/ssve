#!/usr/bin/env node
// write-auto-grade.mjs — append one grade record to .svc/auto-grades.jsonl
// Plan B prereq PR1/PR2 (cutting-edge-techniques): the writer that experience-replay
// (mine-trajectory-patterns), adaptive-temperature (assess-temperature), and the
// multi-agent-debate sequential fallback all read.
//
// Schema (one JSON object per line):
//   { ts, skill, grade('pass'|'fail'), task_id?, iterations?, findings?, verifier? }
//
// Usage:
//   node scripts/write-auto-grade.mjs --skill review-gate --grade pass [--task_id T3]
//        [--iterations 1] [--findings "2 medium"] [--verifier self]
//
// Append-only. Never rewrites. .svc/auto-grades.jsonl is gitignored (ephemeral).

import fs from "node:fs";
import path from "node:path";
import { appendJsonlLine } from "./state-io.mjs";

const projectDir = process.env.SVC_PROJECT_DIR || ".";

function parseArgs(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i += 2) {
    if (!argv[i] || !argv[i].startsWith("--")) continue;
    a[argv[i].slice(2)] = argv[i + 1];
  }
  return a;
}

const args = parseArgs(process.argv);

if (!args.skill || !args.grade) {
  console.error(
    "Usage: write-auto-grade.mjs --skill <name> --grade <pass|fail> [--task_id X] [--iterations N] [--findings '...'] [--verifier self|cross|sequential]"
  );
  process.exit(1);
}
if (args.grade !== "pass" && args.grade !== "fail") {
  console.error(`--grade must be 'pass' or 'fail' (got ${JSON.stringify(args.grade)})`);
  process.exit(1);
}

const entry = {
  ts: new Date().toISOString(),
  skill: args.skill,
  grade: args.grade,
};
if (args.task_id) entry.task_id = args.task_id;
if (args.iterations !== undefined) {
  const n = Number.parseInt(args.iterations, 10);
  if (Number.isFinite(n)) entry.iterations = n;
}
if (args.findings) entry.findings = args.findings;
if (args.verifier) entry.verifier = args.verifier;

const outPath = path.join(projectDir, ".svc", "auto-grades.jsonl");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
appendJsonlLine(outPath, entry);
console.log(JSON.stringify(entry));
