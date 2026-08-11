#!/usr/bin/env node
/**
 * verify-skill-refactor.mjs — mechanical content-preservation check for
 * progressive-disclosure skill refactors.
 *
 * Enforces framework gap G1 (from proposal
 * 2026-04-19-session-audit-gemini-slim-refactor-wi071-and-wi085.md).
 *
 * A "progressive disclosure" refactor moves content from a monolithic
 * SKILL.md to SKILL.md + references/*.md. The refactor is CORRECT if every
 * section header, self-verify check, and rationalization row from the old
 * SKILL.md is reachable in the new (SKILL.md OR references/*.md).
 *
 * The refactor is INCORRECT if content was silently dropped. This script
 * catches that exact failure — it saved WI-071 from persisting as a
 * compound-regression pattern.
 *
 * Usage:
 *   node scripts/verify-skill-refactor.mjs <skill-name> [<old-git-ref>]
 *
 * Examples:
 *   # Check route-workflow against HEAD's parent
 *   node scripts/verify-skill-refactor.mjs route-workflow
 *
 *   # Check against the pre-Gemini-refactor commit
 *   node scripts/verify-skill-refactor.mjs route-workflow 4c36a4e^
 *
 * Exit codes:
 *   0 — all content preserved (or new content added; additions are fine)
 *   1 — one or more markers from old SKILL.md not found in new state
 *   2 — bad invocation (missing args, skill not found, git ref invalid)
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const skillName = process.argv[2];
const oldRef = process.argv[3] || "HEAD~1";

if (!skillName) {
  console.error("Usage: verify-skill-refactor.mjs <skill-name> [<old-git-ref>]");
  process.exit(2);
}

const skillDir = skillName;
const skillFile = path.join(skillDir, "SKILL.md");
const refDir = path.join(skillDir, "references");

if (!fs.existsSync(skillFile)) {
  console.error(`ERROR: ${skillFile} does not exist`);
  process.exit(2);
}

// 1. Get the old SKILL.md content at oldRef
let oldContent;
try {
  oldContent = execSync(`git show ${oldRef}:${skillFile}`, { encoding: "utf8" });
} catch (e) {
  console.error(`ERROR: cannot read ${skillFile} at ${oldRef}: ${e.message.split("\n")[0]}`);
  process.exit(2);
}

// 2. Collect current state: new SKILL.md + all references/*.md
let currentContent = fs.readFileSync(skillFile, "utf8");
if (fs.existsSync(refDir)) {
  for (const f of fs.readdirSync(refDir)) {
    if (f.endsWith(".md")) {
      currentContent += "\n" + fs.readFileSync(path.join(refDir, f), "utf8");
    }
  }
}

// 3. Extract markers from OLD content. A "marker" is a stable content anchor
//    that should survive any legitimate refactor.
function extractMarkers(text) {
  const markers = new Set();

  // H2 / H3 / H4 headers (trimmed, normalized)
  for (const m of text.matchAll(/^#{2,4}\s+(.+?)$/gm)) {
    const h = m[1].trim();
    // Skip generic boilerplate that repeats across skills
    if (/^(Pipeline Continuation|Chaining|Task-graph mode)/.test(h)) continue;
    markers.add(`HEADER: ${h}`);
  }

  // Anti-pattern IDs (AP-NN)
  for (const m of text.matchAll(/\bAP-\d+\b/g)) {
    markers.add(`AP: ${m[0]}`);
  }

  // Phase / Step / Section numbering that appears at start-of-line
  for (const m of text.matchAll(/^(Phase|Step|Section)\s+\d+(?:\.\d+)?\s*[—:-]\s*(.+?)$/gm)) {
    markers.add(`PHASE: ${m[1]} ${m[2].trim().substring(0, 60)}`);
  }

  // Self-verify table rows with a numeric id column: "| 1 | ... |"
  for (const m of text.matchAll(/^\|\s*(\d+(?:\.\d+)?)\s*\|\s*([^|]+?)\s*\|/gm)) {
    const id = m[1];
    const label = m[2].trim().substring(0, 50);
    if (label && !/^[-=]+$/.test(label)) {
      markers.add(`CHECK: ${id} ${label}`);
    }
  }

  return markers;
}

const oldMarkers = extractMarkers(oldContent);
const currentMarkers = extractMarkers(currentContent);

// 4. For each old marker, check if it's reachable in current state.
//    Use substring match on the current content directly (not just markers set)
//    to allow for minor wording changes while catching silent deletions.
const missing = [];
for (const marker of oldMarkers) {
  // Fast path: exact marker present
  if (currentMarkers.has(marker)) continue;

  // Slow path: extract the semantic content after the type prefix and grep
  const colonIdx = marker.indexOf(": ");
  const needle = marker.substring(colonIdx + 2).trim();
  if (!needle) continue;

  // Loosen: check if the needle substring appears anywhere in current content
  // (handles renumbering, minor edits, or moved-to-ref-file cases)
  if (currentContent.includes(needle)) continue;

  // Further loosen: check first 30 chars of the needle (handles truncation)
  const short = needle.substring(0, Math.min(needle.length, 30)).trim();
  if (short.length >= 10 && currentContent.includes(short)) continue;

  missing.push(marker);
}

// 5. Report
const oldLines = oldContent.split("\n").length;
const currentLines = currentContent.split("\n").length;
const lineDelta = currentLines - oldLines;

console.log(`skill:          ${skillName}`);
console.log(`old ref:        ${oldRef}`);
console.log(`old SKILL.md:   ${oldLines} lines`);
console.log(`current total:  ${currentLines} lines (SKILL.md + references/*.md)`);
console.log(`line delta:     ${lineDelta >= 0 ? "+" : ""}${lineDelta}`);
console.log(`old markers:    ${oldMarkers.size}`);
console.log(`current markers: ${currentMarkers.size}`);
console.log(`missing markers: ${missing.length}`);
console.log("");

if (missing.length === 0) {
  console.log("✅ Content preservation verified — every marker from old SKILL.md reachable in current state.");
  process.exit(0);
}

console.log(`❌ ${missing.length} marker(s) from old SKILL.md not found in current state:`);
console.log("");
for (const m of missing.slice(0, 50)) {
  console.log(`  - ${m}`);
}
if (missing.length > 50) {
  console.log(`  ... and ${missing.length - 50} more`);
}
console.log("");
console.log("This refactor lost content. Either:");
console.log("  (a) move the missing content to SKILL.md or references/*.md, or");
console.log("  (b) if the deletion is intentional, suppress by documenting in FRAMEWORK-STATE.md Decisions.");
process.exit(1);
