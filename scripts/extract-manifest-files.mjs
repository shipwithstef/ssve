#!/usr/bin/env node
/**
 * Extract planned file paths from a plan-changeset manifest's "Files Planned"
 * tables. Emits sorted TSV: <action><tab><path> where action ∈ A|M|D
 * (Add/Modify/Delete), matching `git diff --name-status` format.
 *
 * Usage: node scripts/extract-manifest-files.mjs docs/plans/.../manifest.md
 *        diff <(node scripts/extract-manifest-files.mjs <manifest>) \
 *             <(git diff main...HEAD --name-status | sort)
 *
 * Exit 0 = extracted; 1 = no Files Planned tables found; 2 = arg error.
 */

import fs from "node:fs";

const ACTION_MAP = { CREATE: "A", MODIFY: "M", DELETE: "D" };

if (process.argv.length < 3) {
  console.error("Usage: extract-manifest-files.mjs <manifest.md>");
  process.exit(2);
}
const manifest = fs.readFileSync(process.argv[2], "utf8");
const entries = new Set();

// Walk lines; when we're inside a "Files Planned" section's table, parse rows
let inFilesPlanned = false;
let inTable = false;
const lines = manifest.split("\n");
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/^### Phase \d+|^## Files Planned/.test(line)) inFilesPlanned = true;
  else if (/^## /.test(line) && !line.includes("Files Planned")) {
    if (!/^## (Lane Compliance|External State|Rollback|Implementation Summary|Problem Archetype)/.test(line)) {
      // Stop only when leaving major sections that aren't Files-Planned-related
    }
  }
  if (!inFilesPlanned) continue;

  if (/^\| File \|.*Action \|/.test(line)) { inTable = true; continue; }
  if (inTable && /^\| \`/.test(line)) {
    const cells = line.split("|").map((c) => c.trim());
    // Format: | `path` | ACTION | task | purpose |
    const pathCell = cells[1]?.replace(/^`|`$/g, "").trim();
    const actionCell = cells[2]?.toUpperCase().trim();
    const action = ACTION_MAP[actionCell];
    if (pathCell && action) {
      entries.add(`${action}\t${pathCell}`);
    }
  } else if (inTable && /^\s*$/.test(line)) {
    inTable = false;  // table ended
  }
}

if (!entries.size) {
  console.error("No Files Planned tables parsed.");
  process.exit(1);
}

[...entries].sort().forEach((e) => console.log(e));
