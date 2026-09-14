#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function walk(root, dir = root, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".git", ".worktrees", "node_modules", ".svc"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(root, full, files);
    else if (entry.isFile() && fs.statSync(full).size <= 2_000_000) files.push(full);
  }
  return files;
}
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const args = process.argv.slice(2); const at = args.indexOf("--identifier"); const rootAt = args.indexOf("--root");
if (at < 0 || !args[at + 1]) { process.stderr.write("usage: find-callers.mjs --identifier <name> [--root <dir>]\n"); process.exit(2); }
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
const files = walk(root); const matches = [];
for (const file of files) {
  let text; try { text = fs.readFileSync(file, "utf8"); } catch { continue; }
  const hits = patterns.map(({ query, pattern }) => ({ query, count: [...text.matchAll(pattern)].length })).filter((entry) => entry.count);
  if (hits.length) matches.push({ path: path.relative(root, file), count: hits.reduce((sum, entry) => sum + entry.count, 0), queries: hits });
}
process.stdout.write(JSON.stringify({ identifier, queries, scanned_files: files.length, denominator: files.length, matched_files: matches.length, canonical_absence_proven: files.length > 0 && matches.length === 0, matches }, null, 2) + "\n");
process.exitCode = matches.length ? 0 : 1;
