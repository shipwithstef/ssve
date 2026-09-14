#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

PASS=0
FAIL=0

pass() { echo "  PASS - $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL - $1"; FAIL=$((FAIL + 1)); }

echo "=== Tier 1: Terminal Skill Frontmatter ==="

if node --input-type=module - "$REPO_ROOT" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
const requiredTerminal = ["strategic-decision"];
const failures = [];

function frontmatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  return match[1];
}

for (const skill of requiredTerminal) {
  const fm = frontmatter(path.join(root, "skills", skill, "SKILL.md"));
  if (!/^chain:\n[\s\S]*?\n  terminal: true/m.test(fm)) {
    failures.push(`${skill}: missing chain.terminal: true`);
  }
}

const routeWorkflow = fs.readFileSync(path.join(root, "skills", "route-workflow", "SKILL.md"), "utf8");
if (!routeWorkflow.includes("Terminal skills may declare `terminal: true`")) {
  failures.push("route-workflow: terminal advisory behavior is undocumented");
}

const createSkill = fs.readFileSync(path.join(root, "skills", "create-skill", "SKILL.md"), "utf8");
if (!createSkill.includes("chain.terminal: true")) {
  failures.push("create-skill: terminal flag convention is undocumented");
}

if (failures.length > 0) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
NODE
then
  pass "terminal skill frontmatter and authoring convention are aligned"
else
  fail "terminal skill frontmatter and authoring convention are aligned"
fi

echo
echo "terminal skill frontmatter: $PASS passed, $FAIL failed"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
