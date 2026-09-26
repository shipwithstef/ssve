#!/usr/bin/env node
/** Find textual callers and report scan coverage; absence applies only to the declared scope. */
import fs from "node:fs";
import path from "node:path";
const EXCLUDED = [".git", ".worktrees", "node_modules", ".svc"];
const MAX_BYTES = 2_000_000;

/** Collect bounded files and retain every non-excluded traversal failure. */
function walk(root, dir, files, skipped) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch (error) { skipped.push({ path: path.relative(root, dir) || ".", reason: error.code || "unreadable-directory", kind: "directory" }); return; }
  entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  for (const entry of entries) {
    if (EXCLUDED.includes(entry.name)) continue;
    const full = path.join(dir, entry.name); const relative = path.relative(root, full);
    if (entry.isDirectory()) { walk(root, full, files, skipped); continue; }
    if (!entry.isFile()) { skipped.push({ path: relative, reason: "non-regular-file", kind: "file" }); continue; }
    try {
      if (fs.statSync(full).size > MAX_BYTES) skipped.push({ path: relative, reason: "size-limit", kind: "file" });
      else files.push(full);
    } catch (error) { skipped.push({ path: relative, reason: error.code || "stat-failed", kind: "file" }); }
  }
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const args = process.argv.slice(2); const at = args.indexOf("--identifier"); const rootAt = args.indexOf("--root");
if (at < 0 || !args[at + 1] || args[at + 1].startsWith("--") || (rootAt >= 0 && (!args[rootAt + 1] || args[rootAt + 1].startsWith("--")))) {
  process.stderr.write("usage: find-callers.mjs --identifier <name> [--root <dir>]\n"); process.exit(2);
}
const identifier = args[at + 1]; const root = path.resolve(rootAt >= 0 ? args[rootAt + 1] : process.cwd());
const basename = path.basename(identifier); const stem = basename.replace(/\.[^.]+$/, "");
const camel = stem.replace(/[-_]+([a-zA-Z0-9])/g, (_, value) => value.toUpperCase());
const pascal = camel ? camel[0].toUpperCase() + camel.slice(1) : camel;
const snake = stem.replace(/-/g, "_");
const queries = [...new Set([
  identifier, basename, stem, camel, snake,
  `invoke${pascal}`, `invoke_${snake}`, `/skill:${stem}`, `skill:${stem}`,
].filter(Boolean))];
const patterns = queries.map((query) => ({ query, pattern: new RegExp(`(?<![A-Za-z0-9_-])${escape(query)}(?![A-Za-z0-9_-])`, "g") }));
const files = []; const skipped = []; const matches = []; let scanned = 0;
walk(root, root, files, skipped);
for (const file of files) {
  let text;
  try { text = fs.readFileSync(file, "utf8"); scanned++; }
  catch (error) { skipped.push({ path: path.relative(root, file), reason: error.code || "read-failed", kind: "file" }); continue; }
  const hits = patterns.map(({ query, pattern }) => ({ query, count: [...text.matchAll(pattern)].length })).filter((entry) => entry.count);
  if (hits.length) matches.push({ path: path.relative(root, file), count: hits.reduce((sum, entry) => sum + entry.count, 0), queries: hits });
}
skipped.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
process.stdout.write(JSON.stringify({ identifier, queries, scanned_files: scanned,
  denominator: scanned + skipped.filter((entry) => entry.kind === "file").length,
  matched_files: matches.length, scan_complete: skipped.length === 0, skipped,
  excluded_directories: EXCLUDED, canonical_absence_proven: scanned > 0 && skipped.length === 0 && matches.length === 0, matches }, null, 2) + "\n");
process.exitCode = matches.length ? 0 : 1;
