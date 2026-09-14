#!/usr/bin/env bash
# Tier 1: route-workflow Self-Verify rows must use contiguous numbering.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SKILL="$REPO_ROOT/skills/route-workflow/SKILL.md"

node - "$SKILL" <<'NODE'
const fs = require("fs");
const skillPath = process.argv[2];
const text = fs.readFileSync(skillPath, "utf8");
const section = text.match(/^### Self-Verify\n([\s\S]*?)(?:\n\*\*Terminal skill tagging:|\n### |\n## )/m)?.[1] || "";
const rows = [...section.matchAll(/^\|\s*(\d+)\s*\|/gm)].map((m) => Number(m[1]));
const failures = [];
if (rows.length === 0) {
  failures.push("no numbered Self-Verify rows found");
}
for (let i = 0; i < rows.length; i += 1) {
  const expected = i + 1;
  if (rows[i] !== expected) {
    failures.push(`row ${i + 1} is numbered ${rows[i]}, expected ${expected}`);
  }
}

console.log("=== Tier 1: route-workflow Self-Verify Numbering ===");
if (failures.length > 0) {
  for (const failure of failures) console.log(`  FAIL: ${failure}`);
  process.exit(1);
}
console.log(`  PASS - ${rows.length} rows are contiguous`);
NODE
