#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const STATES = new Set(["confirmed", "decision-recorded", "migration-deferred", "migrated", "false-positive"]);
const SCOPES = new Set(["targeted", "whole-codebase"]);

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    ledger: ".svc/deprecated-foundation-findings.jsonl"
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = path.resolve(argv[++i]);
    else if (arg === "--ledger") args.ledger = path.resolve(args.root, argv[++i]);
    else if (arg === "-h" || arg === "--help") args.help = true;
  }
  return args;
}

function usage() {
  return [
    "Usage: node scripts/validate-deprecated-foundation-findings.mjs [--root <dir>] [--ledger <jsonl>]",
    "",
    "Validates promoted deprecated-foundation findings ledger rows."
  ].join("\n");
}

function readRows(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        return [index + 1, JSON.parse(line)];
      } catch (err) {
        throw new Error(`${filePath}:${index + 1}: invalid JSON: ${err.message}`);
      }
    });
}

function hasText(value) {
  return typeof value === "string" && value.trim() !== "";
}

function validateRow(row) {
  const errors = [];
  if (row.schema !== 1) errors.push("schema must be 1");
  if (!hasText(row.ts) || Number.isNaN(Date.parse(row.ts))) errors.push("ts must be ISO timestamp");
  if (!hasText(row.source)) errors.push("source is required");
  if (!STATES.has(row.state)) errors.push(`state must be one of ${[...STATES].join(", ")}`);
  if (!hasText(row.project_root)) errors.push("project_root is required");
  if (!hasText(row.registry)) errors.push("registry is required");
  if (!hasText(row.foundation_id)) errors.push("foundation_id is required");
  if (!SCOPES.has(row.scan_scope)) errors.push("scan_scope must be targeted or whole-codebase");
  if (!hasText(row.file)) errors.push("file is required");
  if (!Number.isInteger(row.line) || row.line <= 0) errors.push("line must be a positive integer");
  if (!hasText(row.match)) errors.push("match is required");
  if (!hasText(row.successor)) errors.push("successor is required");
  if (!hasText(row.decision_required)) errors.push("decision_required is required");
  if (!Array.isArray(row.promotion_targets) || row.promotion_targets.length === 0) {
    errors.push("promotion_targets must be a non-empty array");
  }
  return errors;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(usage());
  process.exit(0);
}

let rows;
try {
  rows = readRows(args.ledger);
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

const errors = [];
for (const [line, row] of rows) {
  for (const error of validateRow(row)) {
    errors.push(`${args.ledger}:${line}: ${error}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`PASS: deprecated foundation findings ledger valid (${rows.length} row(s))`);
