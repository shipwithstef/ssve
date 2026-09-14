#!/usr/bin/env node
/**
 * Copy exact external-review artifact bytes into the repository-shared
 * digest store and record historical-path → object-id mappings.
 * Does not edit source files, launcher receipts, or git notes.
 */
import fs from "node:fs";
import path from "node:path";
import { relocatePath, relocateTree } from "./lib/review-evidence-store.mjs";

function fail(message) {
  process.stderr.write(`relocate-review-evidence: ${message}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const out = { from: [], paths: [], kind: null, candidate: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--from") out.from.push(argv[++i]);
    else if (arg === "--path") out.paths.push(argv[++i]);
    else if (arg === "--kind") out.kind = argv[++i];
    else if (arg === "--candidate-digest") out.candidate = argv[++i];
    else fail(`unknown argument: ${arg}`);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.from.length === 0 && args.paths.length === 0) {
  fail("usage: node scripts/relocate-review-evidence.mjs --from DIR [--path FILE] [--kind plan|exec]");
}

const opts = { kind: args.kind, candidate_digest: args.candidate };
const results = [];
for (const dir of args.from) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`not a directory: ${dir}`);
  results.push(...relocateTree(dir, opts));
}
for (const file of args.paths) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`not a file: ${file}`);
  results.push(relocatePath(path.resolve(file), [], opts));
}

const created = results.filter((row) => row.created).length;
process.stdout.write(`${JSON.stringify({
  ok: true,
  files: results.length,
  objects_created: created,
  objects_existing: results.length - created,
}, null, 2)}\n`);
