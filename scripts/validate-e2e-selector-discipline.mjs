#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

function usage() {
  console.error("Usage: node scripts/validate-e2e-selector-discipline.mjs [--root <dir>] [--glob <relative-glob>]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { root: process.cwd(), glob: "e2e/specs" };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") args.root = argv[++i];
    else if (token === "--glob") args.glob = argv[++i];
    else usage();
  }
  return args;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", ".worktrees"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(spec|test)\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function hasException(text, index) {
  const before = text.slice(Math.max(0, index - 500), index);
  return /selector-exception|no stable alternative|data-testid unavailable|position asserted stable/i.test(before);
}

function issuesFor(file, root) {
  const text = fs.readFileSync(file, "utf8");
  const issues = [];
  const patterns = [
    {
      regex: /getByRole\s*\([^)]*\)\s*\.\s*(first|last)\s*\(/g,
      message: "positional getByRole().first()/last() selector",
    },
    {
      regex: /getByRole\s*\([^)]*\)\s*\.\s*nth\s*\(/g,
      message: "positional getByRole().nth() selector",
    },
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern.regex)) {
      if (hasException(text, match.index)) continue;
      const line = text.slice(0, match.index).split(/\r?\n/).length;
      issues.push(`${path.relative(root, file)}:${line} ${pattern.message} without selector-exception justification`);
    }
  }
  return issues;
}

const args = parseArgs(process.argv.slice(2));
const root = path.resolve(args.root);
const scanDir = path.resolve(root, args.glob);
const files = fs.existsSync(scanDir) && fs.statSync(scanDir).isDirectory()
  ? walk(scanDir)
  : (fs.existsSync(scanDir) ? [scanDir] : []);

const issues = files.flatMap((file) => issuesFor(file, root));

if (issues.length === 0) {
  console.log(`selector discipline: PASS (${files.length} E2E spec file(s) scanned)`);
  process.exit(0);
}

console.error(`selector discipline: FAIL - ${issues.length} issue(s)`);
for (const issue of issues) console.error(`  - ${issue}`);
process.exit(1);
