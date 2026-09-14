#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/verify-journey-e2e-bridge.mjs <journey.feature.md> [...]");
  process.exit(2);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function scenarioBlocks(text) {
  const matches = [...text.matchAll(/^#{1,4}\s+Scenario:[^\n]*(?:\n(?!#{1,4}\s+Scenario:)[\s\S]*?)?/gim)];
  if (matches.length === 0) return [];
  return matches.map((match, index) => {
    const start = match.index;
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    return text.slice(start, end);
  });
}

function stepLines(block) {
  return block
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[- ]*(Given|When|Then|And|But)\b/i.test(line));
}

function validateFile(file) {
  const issues = [];
  const text = read(file);
  const scenarios = scenarioBlocks(text);
  if (scenarios.length === 0) issues.push("no parseable Scenario blocks");
  if (!/`?@[A-Z][A-Z0-9-]*-\d+[A-Z0-9-]*`?/i.test(text) && !/@chrome-control:|@capability:/i.test(text)) {
    issues.push("no parseable AC/chrome/capability trace tags");
  }
  if (!/^##\s+E2E Coverage\b/im.test(text)) {
    issues.push("missing ## E2E Coverage section");
  }
  if (/^\s*-\s*(Given|When|Then|And|But).*\b(primary CTA|the button|a button|the link|a link|the field|a field|the dropdown|a dropdown)\b\s*$/im.test(text)) {
    issues.push("contains generic UI element wording without a specific label/context");
  }

  for (const [index, block] of scenarios.entries()) {
    const steps = stepLines(block);
    if (steps.length === 0) issues.push(`scenario ${index + 1} has no Given/When/Then steps`);
    if (steps.length > 7) issues.push(`scenario ${index + 1} has ${steps.length} steps; split or simplify before write-e2e`);
  }
  return issues;
}

const files = process.argv.slice(2);
if (files.length === 0) usage();

const allIssues = [];
for (const file of files) {
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) {
    allIssues.push(`${file}: file not found`);
    continue;
  }
  for (const issue of validateFile(resolved)) {
    allIssues.push(`${file}: ${issue}`);
  }
}

if (allIssues.length === 0) {
  console.log(`journey-e2e bridge: PASS (${files.length} journey file(s))`);
  process.exit(0);
}

console.error(`journey-e2e bridge: FAIL - ${allIssues.length} issue(s)`);
for (const issue of allIssues) console.error(`  - ${issue}`);
process.exit(1);
