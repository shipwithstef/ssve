#!/usr/bin/env bash
# Tier 1: skill contracts must not embed host-specific executable skill paths.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

node - "$REPO_ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");

const repoRoot = process.argv[2];
const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".worktrees" || entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.name === "SKILL.md") {
      checkSkill(full);
    }
  }
}

function isTableLine(line) {
  return /^\s*\|/.test(line);
}

function checkSkill(file) {
  const rel = path.relative(repoRoot, file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (isTableLine(line)) return;

    const lineNo = index + 1;
    const executableHostSkillPath = /\b(?:node|bash|sh|python3?|npx)\s+(?:~\/\.(?:claude|kimi|codex|gemini|cursor)\/skills|~\/\.config\/opencode\/skills)\//;
    const executableRelativeParent = /\b(?:node|bash|sh|python3?|npx)\s+(?:\.\.\/)+/;

    if (executableHostSkillPath.test(line)) {
      violations.push(`${rel}:${lineNo}: executable command uses a host-specific skills root; use <SKILLS_PATH>`);
    }
    if (executableRelativeParent.test(line)) {
      violations.push(`${rel}:${lineNo}: executable command uses a parent-relative path; use <SKILLS_PATH> or a repo-root variable`);
    }
  });
}

walk(repoRoot);

console.log("=== Tier 1: Skill Host-Portability Paths ===");
if (violations.length) {
  for (const violation of violations) console.log(`  FAIL: ${violation}`);
  process.exit(1);
}

console.log("  PASS - executable skill paths are host-portable");
NODE
