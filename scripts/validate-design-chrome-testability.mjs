#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/validate-design-chrome-testability.mjs --root <repo-or-fixture>");
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

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.md$/.test(entry.name)) out.push(full);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const uiDir = path.join(root, "docs/specs/ui");
const techDir = path.join(root, "docs/specs/technical");
const files = [...walk(uiDir), ...walk(techDir)];
const issues = [];

for (const file of files) {
  const rel = path.relative(root, file);
  const text = fs.readFileSync(file, "utf8");
  const blocks = text.split(/^###\s+/m).slice(1);
  for (const block of blocks) {
    if (!/\b(chrome control|layout control|header control|sidebar control|nav control)\b/i.test(block)) {
      continue;
    }
    if (!/\b(accessible_name|accessible name|aria-label)\b/i.test(block)) {
      issues.push(`${rel}: chrome control missing accessible name`);
    }
    if (!/\b(data-testid|stable selector|@chrome-control:)\b/i.test(block)) {
      issues.push(`${rel}: chrome control missing stable selector/test id`);
    }
  }
}

if (issues.length > 0) {
  console.error(`design chrome testability: FAIL - ${issues.length} issue(s)`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(`design chrome testability: PASS (${files.length} design file(s) scanned)`);
