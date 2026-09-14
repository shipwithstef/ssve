#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/validate-journey-format.mjs --root <repo-or-fixture>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") args.root = argv[++i];
    else usage();
  }
  if (!args.root) usage();
  return args;
}

function listJourneyFiles(root) {
  const journeyDir = path.join(root, "docs/specs/journeys");
  if (!fs.existsSync(journeyDir)) return { journeyDir, files: [] };
  const files = fs
    .readdirSync(journeyDir)
    .filter((name) => /^J.*\.feature\.md$/.test(name))
    .sort()
    .map((name) => path.join(journeyDir, name));
  return { journeyDir, files };
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const { journeyDir, files } = listJourneyFiles(root);
const issues = [];

if (files.length === 0) {
  issues.push("no J*.feature.md journey files found");
}

for (const file of files) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  if (!/^#\s+J[A-Z0-9-]+:/m.test(text) && !/^#\s+J\d+/m.test(text)) {
    issues.push(`${rel}: missing journey header`);
  }
  if (!/@AC-[A-Za-z0-9_.-]+/.test(text)) {
    issues.push(`${rel}: missing @AC trace tag`);
  }
  if (!/(^|\n)(\*\*Persona:\*\*|Persona:)\s*\S/i.test(text)) {
    issues.push(`${rel}: missing persona reference`);
  }
  if (!/Layer 3/i.test(text)) {
    issues.push(`${rel}: missing Layer 3 section`);
  }
  if (!/Ungrounded Preconditions/i.test(text)) {
    issues.push(`${rel}: missing Ungrounded Preconditions section`);
  }
}

const indexPath = path.join(journeyDir, "JOURNEY_INDEX.md");
if (!fs.existsSync(indexPath)) {
  issues.push("docs/specs/journeys/JOURNEY_INDEX.md missing");
} else {
  const index = fs.readFileSync(indexPath, "utf8");
  for (const file of files) {
    const base = path.basename(file);
    if (!index.includes(base)) {
      issues.push(`JOURNEY_INDEX.md does not reference ${base}`);
    }
  }
}

if (issues.length > 0) {
  console.error(`journey format: FAIL - ${issues.length} issue(s)`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(`journey format: PASS (${files.length} journey file(s) scanned)`);
