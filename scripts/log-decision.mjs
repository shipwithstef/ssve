#!/usr/bin/env node
// Canonical writer for .svc/pipeline-decisions.jsonl.
// Validates schema fields then appends one JSON line.
//
// Usage:
//   node scripts/log-decision.mjs --skill <name> --decision <text> [--ts <iso>] [--wi WI-123] [--kind mechanical|taste|user] [--run-id <id>]

import { resolve } from "node:path";
import { appendJsonlLine } from "./state-io.mjs";

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    out[key] = val;
  }
  return out;
}

function fail(msg) {
  process.stderr.write(`log-decision: ${msg}\n`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const ts = args.ts || new Date().toISOString();
const skill = args.skill;
const decision = args.decision;
const wi = args.wi;
const kind = args.kind;
const runId = args["run-id"];

const isoRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
import { WI_ID_RE as wiRe } from "../hooks/lib/wi-id.mjs";
const kinds = new Set(["mechanical", "taste", "user"]);

if (typeof ts !== "string" || !isoRe.test(ts)) fail("invalid --ts");
if (typeof skill !== "string" || skill.length < 1) fail("missing/invalid --skill");
if (typeof decision !== "string" || decision.length < 1) fail("missing/invalid --decision");
if (wi !== undefined && !wiRe.test(wi)) fail(`invalid --wi (must match ${wiRe})`);
if (kind !== undefined && !kinds.has(kind)) fail(`invalid --kind (must be one of ${[...kinds].join(",")})`);

const entry = { ts, skill, decision };
if (wi) entry.wi = wi;
if (kind) entry.kind = kind;
if (runId) entry.run_id = runId;

const cwd = process.cwd();
const dir = resolve(cwd, ".svc");
appendJsonlLine(resolve(dir, "pipeline-decisions.jsonl"), entry);
process.stdout.write(JSON.stringify(entry) + "\n");
