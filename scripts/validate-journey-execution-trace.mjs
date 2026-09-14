#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const TERMINAL = new Set(["executed", "skipped-infeasible", "skipped-user-approved"]);

function usage() {
  console.error("Usage: node scripts/validate-journey-execution-trace.mjs --summary <SUMMARY.md> --scenarios <scenarios.json>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--summary") args.summary = argv[++i];
    else if (token === "--scenarios") args.scenarios = argv[++i];
    else usage();
  }
  if (!args.summary || !args.scenarios) usage();
  return args;
}

function scenarioEvidence(entry) {
  return entry.evidence || entry.evidence_path || entry.screenshot || entry.screenshot_path || entry.report_path;
}

const args = parseArgs(process.argv.slice(2));
const summaryPath = path.resolve(args.summary);
const scenariosPath = path.resolve(args.scenarios);
const issues = [];

if (!fs.existsSync(summaryPath)) issues.push(`summary not found: ${args.summary}`);
if (!fs.existsSync(scenariosPath)) issues.push(`scenarios not found: ${args.scenarios}`);

let summary = "";
let scenarios = [];
if (issues.length === 0) {
  summary = fs.readFileSync(summaryPath, "utf8");
  scenarios = JSON.parse(fs.readFileSync(scenariosPath, "utf8"));
  if (!Array.isArray(scenarios) || scenarios.length === 0) issues.push("scenarios.json must be a non-empty array");
}

if (issues.length === 0) {
  if (!/\bviewport_stage=(desktop|mobile|tablet)\b/i.test(summary)) {
    issues.push("SUMMARY.md must record viewport_stage=desktop|mobile|tablet");
  }
  if (!/\bverify-skill-contract\.mjs\s+test-journeys-closeout\b/.test(summary)) {
    issues.push("SUMMARY.md must record test-journeys closeout validator command");
  }
  if (!/(✅.*\(code\)|S0\s+(static|code))/i.test(summary)) {
    issues.push("SUMMARY.md must record at least one S0/static code pre-check");
  }

  for (const [index, entry] of scenarios.entries()) {
    const id = entry.id || `scenario-${index + 1}`;
    if (!TERMINAL.has(entry.status)) {
      issues.push(`${id}: status '${entry.status || ""}' is not an allowed terminal status`);
      continue;
    }
    if (entry.status === "executed" && !scenarioEvidence(entry)) {
      issues.push(`${id}: executed scenario lacks evidence path`);
    }
    if (entry.status === "skipped-infeasible" && !entry.wi_path) {
      issues.push(`${id}: skipped-infeasible scenario lacks wi_path`);
    }
    if (entry.status === "skipped-user-approved" && !entry.approval) {
      issues.push(`${id}: skipped-user-approved scenario lacks approval quote/timestamp`);
    }
    if (/efficien|low.value|time/i.test(`${entry.skip_reason || ""} ${entry.reason || ""}`)) {
      issues.push(`${id}: efficiency/time skip is forbidden`);
    }
  }
}

if (issues.length === 0) {
  console.log(`journey execution trace: PASS (${scenarios.length} scenario(s))`);
  process.exit(0);
}

console.error(`journey execution trace: FAIL - ${issues.length} issue(s)`);
for (const issue of issues) console.error(`  - ${issue}`);
process.exit(1);
