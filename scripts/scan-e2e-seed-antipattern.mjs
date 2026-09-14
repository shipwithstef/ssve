#!/usr/bin/env node
/**
 * scan-e2e-seed-antipattern.mjs — mechanical pattern scan for E2E tests that
 * seed state via the entity API and then page.reload to assert UI state.
 *
 * WI-087 archetype (2026-04-19): tests that do
 *
 *     await client.entities.<Entity>.update(id, patch);
 *     await page.reload();
 *     // assert UI reflects patch
 *
 * ...are vulnerable to TWO platform-level consistency bugs:
 *
 * 1. Cache invalidation: Base44 (and similar platforms) wire filter-query
 *    cache invalidation to the UI-save path (secureOperation / equivalent),
 *    NOT the low-level entity API. Direct entity writes leave the browser's
 *    read cache STALE for seconds, causing the UI to render pre-update data
 *    even after the reload.
 *
 * 2. Auth bypass: direct entity updates may silently no-op for non-owner
 *    callers (platform drops field writes from unauthorized callers without
 *    returning an error). secureOperation correctly 403s. So a test using
 *    the entity API can appear to write successfully while nothing persists.
 *
 * The fix: seed via the same API the UI uses. See
 * `e2e/helpers/base44-client.ts → seedLocationViaUIPath` for the reference
 * pattern, or `feedback_seed_via_ui_path_not_entity_api.md` in project memory.
 *
 * Usage:
 *   node scripts/scan-e2e-seed-antipattern.mjs [<repo-path>]
 *
 * Exit codes:
 *   0 — no antipattern matches
 *   1 — antipattern found (lists locations)
 *   2 — bad invocation (repo has no e2e/ directory)
 */

import fs from "node:fs";
import path from "node:path";

const repoPath = process.argv[2] || process.cwd();
const e2eRoot = path.join(repoPath, "e2e");

if (!fs.existsSync(e2eRoot)) {
  console.error(`ERROR: ${e2eRoot} does not exist. Is this an svc-managed E2E-enabled repo?`);
  process.exit(2);
}

// Walk e2e/ recursively and collect .spec.ts + .ts files
function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === "node_modules" || name === "test-results" || name === "playwright-report") continue;
      walk(full, acc);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx") || name.endsWith(".mjs") || name.endsWith(".js")) {
      acc.push(full);
    }
  }
  return acc;
}

const files = walk(e2eRoot);

// Scan for the antipattern. Look for:
//   client.entities.<X>.update(<id>, <patch>)
//   ...followed within 30 lines by...
//   page.reload()
// Capturing the relative positions allows us to flag the dangerous pattern
// while not flagging entity.update calls that exist for non-UI setup.
const antipatternMatches = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split("\n");
  const updateLineIdxs = [];
  const reloadLineIdxs = [];

  lines.forEach((line, idx) => {
    if (/\.entities\.\w+\.update\s*\(/.test(line)) updateLineIdxs.push(idx);
    if (/page\.reload\s*\(/.test(line)) reloadLineIdxs.push(idx);
  });

  // Pair any update with a following reload within 30 lines
  for (const u of updateLineIdxs) {
    const nearby = reloadLineIdxs.find((r) => r > u && r - u <= 30);
    if (nearby !== undefined) {
      antipatternMatches.push({
        file: path.relative(repoPath, file),
        updateLine: u + 1,
        reloadLine: nearby + 1,
        updateSnippet: lines[u].trim().substring(0, 120),
        reloadSnippet: lines[nearby].trim().substring(0, 80),
      });
    }
  }
}

// Report
console.log(`scanned ${files.length} files under ${path.relative(process.cwd(), e2eRoot) || "e2e"}/`);
console.log(`antipattern matches: ${antipatternMatches.length}`);
console.log("");

if (antipatternMatches.length === 0) {
  console.log("✅ No entity-API-seed → page.reload antipattern found.");
  process.exit(0);
}

console.log("❌ Antipattern matches:\n");
for (const m of antipatternMatches) {
  console.log(`  ${m.file}:${m.updateLine} → reload at line ${m.reloadLine}`);
  console.log(`    update:  ${m.updateSnippet}`);
  console.log(`    reload:  ${m.reloadSnippet}`);
  console.log("");
}

console.log(
  "These tests seed state via the low-level entity API and then reload the\n" +
  "page to assert UI state. Two platform-level bugs are likely:\n" +
  "  1. Filter-query cache stale for 6+s (direct entity writes don't invalidate it)\n" +
  "  2. Silent auth no-op if the test account isn't the owner of the seeded entity\n\n" +
  "Fix: seed via the same endpoint the UI uses (e.g. secureOperation).\n" +
  "Reference: WI-087 (example-marketplace 2026-04-19) + feedback_seed_via_ui_path_not_entity_api.md.\n"
);
process.exit(1);
