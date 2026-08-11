#!/usr/bin/env node

import fs from "node:fs";

function usage() {
  console.error("Usage: node scripts/validate-s2-justification.mjs --summary <SUMMARY.md>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--summary") args.summary = argv[++i];
    else usage();
  }
  if (!args.summary) usage();
  return args;
}

const args = parseArgs(process.argv.slice(2));
const text = fs.readFileSync(args.summary, "utf8");
const s2Lines = text.split("\n").filter((line) => /\bS2\b/i.test(line));
const issues = [];

for (const line of s2Lines) {
  const hasAllThree =
    /subjective_or_real_data=true/i.test(line) &&
    /automation_exhausted=true/i.test(line) &&
    /user_only_claim=true/i.test(line);
  if (!hasAllThree) {
    issues.push(`S2 line lacks all three required conditions: ${line.trim()}`);
  }
}

if (issues.length > 0) {
  console.error(`S2 justification: FAIL - ${issues.length} issue(s)`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(`S2 justification: PASS (${s2Lines.length} S2 line(s) scanned)`);
