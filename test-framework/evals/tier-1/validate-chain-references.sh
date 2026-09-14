#!/usr/bin/env bash
# - Every chain.lanes.*.next and *.prev references a real skill in includedSkills
# - Manifest laneDefinitions membership matches skill frontmatter lane declarations
# WI-558: the entire validation runs in ONE node process. The previous shell
# round-trip (node prints list -> bash word-splits -> grep -qx per ref) produced
# rotating single-victim failures under parallel sweep load (truncated command
# substitution output read as a missing includedSkill).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/skills-manifest.json"

echo "=== Tier 1: Chain Reference Validation ==="

node --input-type=module - "$MANIFEST" "$REPO_ROOT" <<'NODE'
import fs from "node:fs";
import path from "node:path";

const [manifestPath, repoRoot] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const included = new Set(m.includedSkills);

let pass = 0, fail = 0;
const errors = [];
const failMsg = (msg) => { errors.push(`  FAIL: ${msg}`); fail += 1; };

function frontmatter(skill) {
  const file = path.join(repoRoot, "skills", skill, "SKILL.md");
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const parts = text.split(/^---$/m);
  return parts.length >= 3 ? parts[1] : null;
}
function chainRefs(fm) {
  const out = [];
  for (const match of fm.matchAll(/(prev|next):\s*(\S+)/g)) {
    const ref = match[2].replace(/[,}\s]+$/, "");
    if (ref && ref !== "null") out.push(ref);
  }
  return out;
}

// 1. chain.lanes prev/next must reference included skills
for (const skill of m.includedSkills) {
  const fm = frontmatter(skill);
  if (fm === null) continue;
  for (const ref of chainRefs(fm)) {
    if (included.has(ref)) pass += 1;
    else failMsg(`${skill} — chain references '${ref}' which is not in includedSkills`);
  }
}

// 2. manifest laneDefinitions <-> skill frontmatter lane declarations
const lanes = Object.keys(m.laneDefinitions || {});
const laneMembers = new Map(lanes.map((l) => [l, new Set(m.laneDefinitions[l].skills || [])]));
for (const lane of lanes) {
  for (const laneSkill of laneMembers.get(lane)) {
    const fm = frontmatter(laneSkill);
    if (fm === null) continue;
    if (fm.includes(`${lane}:`)) pass += 1;
    else failMsg(`${laneSkill} listed in manifest lane '${lane}' but doesn't declare that lane in frontmatter`);
  }
  // Reverse check: skills declaring this lane but absent from manifest list.
  // Pre-lane entry points (route-workflow) are exempt — they route INTO lanes
  // but are not part of the progressive skill chain within any lane.
  for (const skill of m.includedSkills) {
    const fm = frontmatter(skill);
    if (fm === null) continue;
    if (!fm.includes(`    ${lane}:`)) continue;
    if (skill === "route-workflow") { pass += 1; continue; }
    if (!laneMembers.get(lane).has(skill)) {
      failMsg(`${skill} declares lane '${lane}' in frontmatter but is not in manifest laneDefinitions.${lane}.skills`);
    } else {
      pass += 1;
    }
  }
}

console.log(`  ${pass} passed, ${fail} failed`);
if (errors.length) {
  console.log("");
  for (const e of errors) console.log(e);
  process.exit(1);
}
console.log("  PASS — all chain references valid");
NODE
