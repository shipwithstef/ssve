#!/usr/bin/env node
/**
 * verify-wi-pillars.mjs — enforces framework gap G2 from proposal
 * 2026-04-19-session-audit-gemini-slim-refactor-wi071-and-wi085.md.
 *
 * A WI file (docs/specs/work-items/WI-NNN.md) MUST contain a Pillar Revisit
 * Audit table with all 8 pillars (product fit, journey, AC, UX, UI, tech,
 * cost, ops) explicitly addressed when its Status is VERIFIED.
 *
 * The eval-gate hook already enforces the 8-pillar matrix at the task-graph
 * level. This script is the complementary check at the WI-FILE level — it
 * catches the exact failure mode of WI-071 where the WI was marked
 * VERIFIED despite Pillar Revisit listing only 4 of 8 pillars.
 *
 * Usage:
 *   node scripts/verify-wi-pillars.mjs <wi-file>
 *   node scripts/verify-wi-pillars.mjs docs/specs/work-items/WI-071.md
 *
 * Exit codes:
 *   0 — WI status is not VERIFIED (skipping), OR 8/8 pillars present
 *   1 — Status is VERIFIED but pillars incomplete (< 8 rows found)
 *   2 — bad invocation or file not found
 */

import fs from "node:fs";

const wiFile = process.argv[2];

if (!wiFile) {
  console.error("Usage: verify-wi-pillars.mjs <wi-file>");
  process.exit(2);
}

if (!fs.existsSync(wiFile)) {
  console.error(`ERROR: ${wiFile} does not exist`);
  process.exit(2);
}

const content = fs.readFileSync(wiFile, "utf8");

function readFrontmatterStatus(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const statusMatch = match[1].match(/^status:\s*["']?([^"'\n#]+)["']?/im);
  return statusMatch ? statusMatch[1].trim() : null;
}

function readBodyStatus(text) {
  const statusMatch = text.match(/^\*\*Status:\*\*\s*(\S+)/m);
  return statusMatch ? statusMatch[1].trim() : null;
}

// Status check — only enforce on VERIFIED WIs. Non-VERIFIED WIs can have
// incomplete pillars while work is in progress. Frontmatter is the current WI
// source of truth; the body status fallback preserves legacy WI support.
const status = (readFrontmatterStatus(content) ?? readBodyStatus(content) ?? "UNKNOWN").toUpperCase();

if (status !== "VERIFIED") {
  console.log(`WI status: ${status} — pillar check skipped (only enforced on VERIFIED)`);
  process.exit(0);
}

// Extract the Pillar Revisit Audit table. Match the section header plus the
// table that follows, up to the next H2/H3 header or end-of-file.
const sectionMatch = content.match(/##+\s*Pillar Revisit Audit[^\n]*\n([\s\S]*?)(?=\n##+\s|\n?$)/i);

if (!sectionMatch) {
  console.error(`❌ VERIFIED WI has no "Pillar Revisit Audit" section: ${wiFile}`);
  console.error("Required format:");
  console.error("  ## Pillar Revisit Audit");
  console.error("  | # | Pillar | Affected? | Evidence / follow-up |");
  console.error("  | 1 | Product fit | ... |");
  console.error("  | ... through pillar 8 | ... |");
  process.exit(1);
}

const tableBody = sectionMatch[1];

// Count pillar rows. A valid pillar row starts with "| N |" where N is 1-8.
const pillarIds = new Set();
for (const m of tableBody.matchAll(/^\|\s*([1-8])\s*\|\s*(\S[^|]*?)\s*\|/gm)) {
  pillarIds.add(m[1]);
}

const required = new Set(["1", "2", "3", "4", "5", "6", "7", "8"]);
const missing = [...required].filter((id) => !pillarIds.has(id)).sort();

const pillarNames = {
  "1": "Product fit",
  "2": "Journey",
  "3": "Acceptance criteria",
  "4": "UX",
  "5": "UI",
  "6": "Tech architecture",
  "7": "Cost model",
  "8": "Operations",
};

console.log(`WI:             ${wiFile}`);
console.log(`Status:         ${status}`);
console.log(`Pillars found:  ${pillarIds.size} (${[...pillarIds].sort().join(",")})`);

if (missing.length === 0) {
  console.log(`✅ All 8 pillars present in Pillar Revisit Audit.`);
  process.exit(0);
}

console.log(`❌ VERIFIED WI is missing ${missing.length} pillar(s):`);
for (const id of missing) {
  console.log(`  - ${id}. ${pillarNames[id]}`);
}
console.log("");
console.log("Every VERIFIED WI MUST address all 8 pillars explicitly with");
console.log("[UPDATED] / [UNCHANGED — VERIFIED] / [N/A — justified].");
console.log("Add the missing rows before the WI can be considered complete.");
process.exit(1);
