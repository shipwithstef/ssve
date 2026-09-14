#!/usr/bin/env node
// check-blocking-hook-inventory.mjs — WI-487 F-017.
//
// Asserts every row of the STRUCTURED blocking-hook inventory maps to exactly one
// reviewed repo file OR an explicit non-file disposition, and (re)emits the
// derived normalized, sorted, unique repo-path list (file-disposition rows only)
// that staging/hashing consume. hook_id/installed_command are hook metadata;
// repo_path is a repository path — the two are never conflated.
//
// Usage:
//   node scripts/check-blocking-hook-inventory.mjs \
//     --inventory docs/specs/test-evidence/WI-487/blocking-hook-inventory.json \
//     --repo-paths docs/specs/test-evidence/WI-487/blocking-hook-repo-paths.txt \
//     [--repo-root <dir>] [--check]     # --check verifies the emitted list matches on disk

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT_DEFAULT = path.resolve(SELF_DIR, "..");

function arg(name, dflt) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : dflt;
}
function has(name) { return process.argv.includes(name); }

const inventoryPath = arg("--inventory", path.join(REPO_ROOT_DEFAULT, "docs/specs/test-evidence/WI-487/blocking-hook-inventory.json"));
const repoPathsOut = arg("--repo-paths", path.join(REPO_ROOT_DEFAULT, "docs/specs/test-evidence/WI-487/blocking-hook-repo-paths.txt"));
const repoRoot = path.resolve(arg("--repo-root", REPO_ROOT_DEFAULT));
const checkOnly = has("--check");

function fail(msg) { process.stderr.write(`check-blocking-hook-inventory: ${msg}\n`); process.exit(1); }

let inv;
try { inv = JSON.parse(fs.readFileSync(inventoryPath, "utf8")); } catch (e) { fail(`cannot read inventory: ${e.message}`); }
if (!inv || !Array.isArray(inv.rows)) fail("inventory has no rows[]");

// Exact file dispositions that ARE runtime denial-driven (each routes its block
// through the emitDenial envelope + receipt, or through the durable launcher).
const VALID_DISPOSITIONS = new Set(["route-through-launcher", "adopt-emitDenial"]);
// WI-487 R2-F003: file dispositions that map to a real reviewed repo file but own
// NO independent runtime block path. Prefix form ("<disposition>:<free-text reason>").
// They still require repo_path to exist and are staged like any other file row;
// they are just NOT asserted to emit a runtime denial by the fixture.
const VALID_DISPOSITION_PREFIXES = ["passthrough-delegated:", "context-injection-no-block:"];

function isValidFileDisposition(d) {
  return VALID_DISPOSITIONS.has(d) || VALID_DISPOSITION_PREFIXES.some((p) => d.startsWith(p));
}

const filePaths = new Set();
const seenHookIds = new Set();

for (const row of inv.rows) {
  if (!row.hook_id || typeof row.hook_id !== "string") fail(`row missing hook_id: ${JSON.stringify(row)}`);
  if (seenHookIds.has(row.hook_id)) fail(`duplicate hook_id: ${row.hook_id}`);
  seenHookIds.add(row.hook_id);
  if (!row.disposition || typeof row.disposition !== "string") fail(`row ${row.hook_id} missing disposition`);
  if (row.disposition.startsWith("non-file:")) continue; // explicit non-file wiring row (recorded, not staged)
  if (!isValidFileDisposition(row.disposition)) fail(`row ${row.hook_id} has unknown disposition '${row.disposition}'`);
  if (!row.repo_path || typeof row.repo_path !== "string") fail(`file-disposition row ${row.hook_id} missing repo_path`);
  const abs = path.join(repoRoot, row.repo_path);
  if (!fs.existsSync(abs)) fail(`row ${row.hook_id} repo_path does not exist: ${row.repo_path}`);
  filePaths.add(row.repo_path);
}

// Derived normalized, sorted, unique repo-path list (file-disposition rows only).
const sorted = Array.from(filePaths).sort();
const emitted = sorted.join("\n") + "\n";

if (checkOnly) {
  let onDisk = "";
  try { onDisk = fs.readFileSync(repoPathsOut, "utf8"); } catch { fail(`repo-paths file missing for --check: ${repoPathsOut}`); }
  if (onDisk !== emitted) fail(`repo-paths file is stale; re-run without --check to regenerate: ${repoPathsOut}`);
  process.stderr.write(`check-blocking-hook-inventory: OK (${sorted.length} unique repo paths, ${inv.rows.length} rows)\n`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(repoPathsOut), { recursive: true });
fs.writeFileSync(repoPathsOut, emitted);
process.stderr.write(`check-blocking-hook-inventory: wrote ${sorted.length} repo paths (${inv.rows.length} rows) -> ${repoPathsOut}\n`);
process.exit(0);
