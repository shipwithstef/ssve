#!/usr/bin/env bash
# Tier 1: rulesRegistry must not register the same rule path twice.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"

node - "$REPO_ROOT/skills-manifest.json" <<'NODE'
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const entries = manifest.rulesRegistry?.entries || [];
const counts = new Map();
for (const entry of entries) {
  if (!entry.path) continue;
  counts.set(entry.path, (counts.get(entry.path) || 0) + 1);
}

const duplicates = [...counts.entries()].filter(([, count]) => count > 1);
console.log("=== Tier 1: Rules Registry No Duplicates ===");
if (duplicates.length > 0) {
  for (const [rulePath, count] of duplicates) {
    console.log(`  FAIL: ${rulePath} appears ${count} times`);
  }
  process.exit(1);
}
console.log(`  PASS - ${entries.length} rule entries are unique by path`);
NODE
