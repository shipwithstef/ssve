#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/validate-security-rule-probe-evidence.mjs --evidence <probe-evidence.json>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--evidence") args.evidence = argv[++i];
    else usage();
  }
  if (!args.evidence) usage();
  return args;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

const args = parseArgs(process.argv.slice(2));
const evidencePath = path.resolve(args.evidence);
const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
const issues = [];

if (!hasText(evidence.rule_target)) issues.push("rule_target is required");
if (!hasText(evidence.non_privileged_actor)) issues.push("non_privileged_actor is required");
if (!hasText(evidence.probe_command)) issues.push("probe_command is required");
if (!evidence.before || typeof evidence.before !== "object") issues.push("before probe result is required");
if (!evidence.after || typeof evidence.after !== "object") issues.push("after probe result is required");

if (issues.length === 0) {
  const beforeStatus = evidence.before.status;
  const afterStatus = evidence.after.status;
  const beforeOk = ["exploitable", "already-blocked", "ambiguous-seeded-then-exploitable"].includes(beforeStatus);
  const afterOk = ["blocked", "filtered", "forbidden"].includes(afterStatus);

  if (!beforeOk) issues.push("before.status must be exploitable, already-blocked, or ambiguous-seeded-then-exploitable");
  if (!afterOk) issues.push("after.status must be blocked, filtered, or forbidden");
  if (beforeStatus === "already-blocked" && !hasText(evidence.defense_in_depth_rationale)) {
    issues.push("already-blocked before probe requires defense_in_depth_rationale");
  }
  if (!hasText(evidence.before.output_excerpt)) issues.push("before.output_excerpt is required");
  if (!hasText(evidence.after.output_excerpt)) issues.push("after.output_excerpt is required");
  if (!hasText(evidence.regression_test)) issues.push("regression_test path/name is required");
}

if (issues.length === 0) {
  console.log("security rule probe evidence: PASS");
  process.exit(0);
}

console.error(`security rule probe evidence: FAIL - ${issues.length} issue(s)`);
for (const issue of issues) console.error(`  - ${issue}`);
process.exit(1);
