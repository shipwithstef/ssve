#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/verify-journey-coverage.mjs --root <repo-or-fixture>");
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

function extractAll(regex, text) {
  return [...text.matchAll(regex)].map((match) => match[1]);
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const journeyDir = path.join(root, "docs/specs/journeys");
const issues = [];
const files = fs.existsSync(journeyDir)
  ? fs.readdirSync(journeyDir).filter((name) => /^J.*\.feature\.md$/.test(name)).sort()
  : [];

if (files.length === 0) issues.push("no journey files found");

const acs = new Set();
const personas = new Set();
for (const file of files) {
  const text = fs.readFileSync(path.join(journeyDir, file), "utf8");
  for (const ac of extractAll(/@AC-([A-Za-z0-9_.-]+)/g, text)) acs.add(ac);
  const persona = text.match(/(?:^|\n)(?:\*\*Persona:\*\*|Persona:)\s*([^\n]+)/i);
  if (persona) personas.add(persona[1].trim());
}

if (acs.size === 0) issues.push("zero AC trace tags found across journeys");
if (personas.size === 0) issues.push("zero personas found across journeys");

const indexPath = path.join(journeyDir, "JOURNEY_INDEX.md");
if (!fs.existsSync(indexPath)) {
  issues.push("JOURNEY_INDEX.md missing");
} else {
  const index = fs.readFileSync(indexPath, "utf8");
  if (!/AC coverage/i.test(index)) issues.push("JOURNEY_INDEX.md missing AC coverage section");
  if (!/Persona coverage/i.test(index)) issues.push("JOURNEY_INDEX.md missing Persona coverage section");
  for (const ac of acs) {
    if (!index.includes(`AC-${ac}`)) issues.push(`JOURNEY_INDEX.md missing AC-${ac}`);
  }
  for (const persona of personas) {
    if (!index.includes(persona)) issues.push(`JOURNEY_INDEX.md missing persona ${persona}`);
  }
}

if (issues.length > 0) {
  console.error(`journey coverage: FAIL - ${issues.length} issue(s)`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(`journey coverage: PASS (${acs.size} AC tag(s), ${personas.size} persona(s))`);
