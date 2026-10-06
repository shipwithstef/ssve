#!/usr/bin/env bash
# Tier 1: skill contracts must not embed host-specific executable skill paths.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

node - "$REPO_ROOT" <<'NODE'
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = process.argv[2];
const violations = [];

// Inspect declared source, including new unignored skills. Parallel validators
// create and remove ignored fixture homes; those are not skill contracts.
const skillFiles = execFileSync('git', ['-C', repoRoot, 'ls-files', '-z',
  '--cached', '--others', '--exclude-standard', '--', 'SKILL.md', '**/SKILL.md'],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\0').filter(Boolean);

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

for (const file of [...new Set(skillFiles)]) checkSkill(path.join(repoRoot, file));

console.log("=== Tier 1: Skill Host-Portability Paths ===");
if (violations.length) {
  for (const violation of violations) console.log(`  FAIL: ${violation}`);
  process.exit(1);
}

console.log("  PASS - executable skill paths are host-portable");
NODE
