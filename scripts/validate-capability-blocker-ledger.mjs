#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const STATES = new Set(["detected", "routed", "recovered", "blocked-on-user", "false-positive"]);
import { WI_ID_RE as WI_RE } from '../hooks/lib/wi-id.mjs';
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

function parseArgs(argv) {
  const args = { root: process.cwd(), ledger: "", registry: "" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = path.resolve(argv[++i] || ".");
    else if (arg === "--ledger") args.ledger = path.resolve(argv[++i] || "");
    else if (arg === "--registry") args.registry = path.resolve(argv[++i] || "");
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function usage() {
  return "Usage: node scripts/validate-capability-blocker-ledger.mjs --ledger .svc/capability-blockers.jsonl [--root .] [--registry references/capability-blockers.json]";
}

function loadRegistry(args) {
  const registryPath = args.registry || path.join(args.root, "references", "capability-blockers.json");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (registry.schema !== 1 || !Array.isArray(registry.classes)) {
    throw new Error(`Invalid capability blocker registry: ${registryPath}`);
  }
  return new Map(registry.classes.map((entry) => [entry.id, entry]));
}

function parseLedger(ledgerPath) {
  const raw = fs.readFileSync(ledgerPath, "utf8");
  return raw.split(/\r?\n/).map((line, index) => ({ line, number: index + 1 }))
    .filter((row) => row.line.trim())
    .map((row) => {
      try {
        return { number: row.number, entry: JSON.parse(row.line) };
      } catch (error) {
        return { number: row.number, parseError: error.message };
      }
    });
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateEntry(row, registryById) {
  const issues = [];
  const entry = row.entry;
  const prefix = `line ${row.number}`;
  if (row.parseError) return [`${prefix}: invalid JSON (${row.parseError})`];

  if (entry.schema !== 1) issues.push(`${prefix}: schema must be 1`);
  if (!hasText(entry.ts) || !ISO_RE.test(entry.ts) || Number.isNaN(Date.parse(entry.ts))) {
    issues.push(`${prefix}: ts must be ISO-8601`);
  }
  if (!hasText(entry.source)) issues.push(`${prefix}: source is required`);
  if (!STATES.has(entry.state)) issues.push(`${prefix}: state must be one of ${[...STATES].join(", ")}`);
  if (!hasText(entry.blocker_id)) issues.push(`${prefix}: blocker_id is required`);
  else if (!registryById.has(entry.blocker_id)) issues.push(`${prefix}: blocker_id '${entry.blocker_id}' is not in registry`);
  if (!hasText(entry.route_to)) issues.push(`${prefix}: route_to is required`);
  if (!hasText(entry.owner_skill)) issues.push(`${prefix}: owner_skill is required`);
  if (!Array.isArray(entry.matched_signals) || entry.matched_signals.length === 0) {
    issues.push(`${prefix}: matched_signals must be a non-empty array`);
  }
  if (!hasText(entry.diagnosis)) issues.push(`${prefix}: diagnosis is required`);
  if (entry.wi !== undefined && !WI_RE.test(entry.wi)) issues.push(`${prefix}: wi must match ${WI_RE}`);
  if (entry.evidence !== undefined && (!Array.isArray(entry.evidence) || !entry.evidence.every(hasText))) {
    issues.push(`${prefix}: evidence must be an array of non-empty strings`);
  }

  if (entry.state === "recovered") {
    if (!Array.isArray(entry.recovery_attempts) || entry.recovery_attempts.length === 0) {
      issues.push(`${prefix}: recovered entries require recovery_attempts[]`);
    } else {
      entry.recovery_attempts.forEach((attempt, index) => {
        if (!hasText(attempt.ts) || Number.isNaN(Date.parse(attempt.ts))) {
          issues.push(`${prefix}: recovery_attempts[${index}].ts must be ISO-8601`);
        }
        if (!hasText(attempt.action)) issues.push(`${prefix}: recovery_attempts[${index}].action is required`);
        if (!hasText(attempt.result)) issues.push(`${prefix}: recovery_attempts[${index}].result is required`);
        if (!Array.isArray(attempt.evidence) || attempt.evidence.length === 0 || !attempt.evidence.every(hasText)) {
          issues.push(`${prefix}: recovery_attempts[${index}].evidence must be a non-empty string array`);
        }
      });
    }
  }
  if (entry.state === "blocked-on-user" && !hasText(entry.blocked_on)) {
    issues.push(`${prefix}: blocked-on-user entries require blocked_on`);
  }
  if (entry.state === "false-positive" && !hasText(entry.false_positive_reason)) {
    issues.push(`${prefix}: false-positive entries require false_positive_reason`);
  }

  return issues;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.ledger) {
  console.log(usage());
  process.exit(args.help ? 0 : 1);
}

const registryById = loadRegistry(args);
const rows = parseLedger(args.ledger);
const issues = rows.flatMap((row) => validateEntry(row, registryById));

if (issues.length > 0) {
  console.error(`FAIL: ${args.ledger}`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(`PASS: capability blocker ledger valid (${rows.length} entries)`);
