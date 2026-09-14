#!/bin/bash
# validate-preflight-coverage.sh — Tier-1 blocking validator for WI-179.
#
# A skill is covered when it either has a direct `## Preflight` section or is
# listed in references/preflight-registry.json under exactly one family.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"
REGISTRY="$REPO_ROOT/references/preflight-registry.json"
cd "$REPO_ROOT" || exit 1

echo "=== Tier 1: Skill Preflight Coverage (BLOCKING — WI-179) ==="

if [ ! -f "$REGISTRY" ]; then
  echo "FAIL: missing $REGISTRY"
  exit 1
fi

node <<'NODE'
const fs = require("fs");
const manifest = JSON.parse(fs.readFileSync("skills-manifest.json", "utf8"));
const registry = JSON.parse(fs.readFileSync("references/preflight-registry.json", "utf8"));
const included = manifest.includedSkills || [];
const includedSet = new Set(included);
const direct = new Set();
const familyCoverage = new Map();
const errors = [];

for (const skill of included) {
  const skillMd = `skills/${skill}/SKILL.md`;
  if (!fs.existsSync(skillMd)) {
    errors.push(`included skill missing SKILL.md: ${skill}`);
    continue;
  }
  if (/^## Preflight\b/m.test(fs.readFileSync(skillMd, "utf8"))) {
    direct.add(skill);
  }
}

if (!Array.isArray(registry.families) || registry.families.length === 0) {
  errors.push("preflight registry must contain at least one family");
} else {
  for (const family of registry.families) {
    if (!family.id) errors.push("preflight family missing id");
    if (!Array.isArray(family.skills) || family.skills.length === 0) {
      errors.push(`preflight family ${family.id || "(unknown)"} has no skills`);
      continue;
    }
    for (const field of ["required_context", "input_policy", "output_policy"]) {
      if (!family[field] || (Array.isArray(family[field]) && family[field].length === 0)) {
        errors.push(`preflight family ${family.id || "(unknown)"} missing ${field}`);
      }
    }
    for (const skill of family.skills) {
      if (!includedSet.has(skill)) errors.push(`preflight registry names non-included skill: ${skill}`);
      const current = familyCoverage.get(skill) || [];
      current.push(family.id || "(unknown)");
      familyCoverage.set(skill, current);
    }
  }
}

const missing = [];
for (const skill of included) {
  const families = familyCoverage.get(skill) || [];
  if (!direct.has(skill) && families.length === 0) missing.push(skill);
  if (families.length > 1) errors.push(`preflight registry covers ${skill} more than once: ${families.join(", ")}`);
}

if (missing.length > 0) {
  errors.push(`skills lacking direct or family preflight coverage: ${missing.join(", ")}`);
}

const registryCovered = [...familyCoverage.keys()].filter((s) => includedSet.has(s)).length;
console.log(`  direct ## Preflight sections: ${direct.size}`);
console.log(`  registry-covered skills: ${registryCovered}`);
console.log(`  total included skills: ${included.length}`);

if (errors.length > 0) {
  for (const error of errors) console.log(`  FAIL: ${error}`);
  process.exit(1);
}

console.log("");
console.log("  PASS — every included skill has direct or family-level preflight coverage");
NODE
