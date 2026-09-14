#!/usr/bin/env node

// WI-391: test-source side of the journey/E2E linker family.
// verify-journey-e2e-bridge.mjs validates AC trace tags inside journey
// `.feature.md` files; verify-journey-coverage.mjs validates AC tags inside
// journeys against JOURNEY_INDEX.md. Neither reads test SOURCE. This script
// closes that gap: it derives the set of `@AC-<ID>` annotations that tests
// actually carry and verifies each one resolves to a real spec AC. An orphan
// tag (a `@AC-<ID>` in a test that names an AC the spec no longer declares)
// is the rename/removal rot that audit-ac:122-126 and sync-spec-code Step 3
// otherwise reconcile by hand. Derive-then-verify, per WI-364.
//
// Hermetic: filesystem only, no network, no LLM. Used both as a tier-1
// fixture target and as a write-e2e closeout verifier.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.error("Usage: node scripts/verify-test-ac-tags.mjs --root <repo-or-fixture>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--root") args.root = argv[++i];
    else usage();
  }
  if (!args.root) usage();
  return args;
}

// AC-ID convention is case-sensitive (`{SECTION-PREFIX}-{NN}`, e.g. NAV-01,
// PAY-3). Do NOT add IGNORECASE — the uppercase prefix is the contract
// (rules/common/regex-identifier-conventions.md).
const AC_TAG_RE = /@AC-([A-Z][A-Z0-9]*-\d+)\b/g;
// First column of the shared 5-column AC table (audit-ac "AC Table Format").
const AC_ROW_RE = /^\|\s*([A-Z][A-Z0-9]*-\d+)\s*\|/gm;

const TEST_FILE_RE = /\.(spec|test)\.(ts|tsx|js|jsx|mjs|cjs)$/;
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".svc", "coverage"]);

function walk(dir, predicate, acc) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), predicate, acc);
    } else if (predicate(entry.name)) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

function extractAll(regex, text) {
  // Fresh lastIndex per call — these regexes are module-level and stateful.
  regex.lastIndex = 0;
  const out = [];
  let match;
  while ((match = regex.exec(text)) !== null) out.push(match[1]);
  return out;
}

function collectSpecAcIds(root) {
  const ids = new Set();
  const featuresDir = path.join(root, "docs/specs/features");
  const files = walk(featuresDir, (name) => name.endsWith(".md"), []);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const id of extractAll(AC_ROW_RE, text)) ids.add(id);
  }
  return ids;
}

function collectTestTags(root) {
  // Tags found in test source, keyed by AC-ID -> list of rel paths.
  const tagsById = new Map();
  const files = walk(root, (name) => TEST_FILE_RE.test(name), []);
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    const rel = path.relative(root, file);
    for (const id of extractAll(AC_TAG_RE, text)) {
      if (!tagsById.has(id)) tagsById.set(id, []);
      tagsById.get(id).push(rel);
    }
  }
  return tagsById;
}

export function verifyTestAcTags(options) {
  const root = path.resolve(options.root || process.cwd());
  const issues = [];

  const specIds = collectSpecAcIds(root);
  const tagsById = collectTestTags(root);

  // Orphan-tag check (freshness): every test-source `@AC-<ID>` must resolve to
  // a spec AC. A tag with no matching spec AC is rename/removal rot.
  const orphans = [];
  for (const [id, files] of tagsById) {
    if (!specIds.has(id)) orphans.push({ id, files: [...new Set(files)].sort() });
  }
  orphans.sort((a, b) => a.id.localeCompare(b.id));
  for (const orphan of orphans) {
    issues.push(
      `orphan @AC-${orphan.id} in ${orphan.files.join(", ")} — no matching spec AC (renamed/removed? update the tag or restore the AC)`
    );
  }

  const taggedIds = new Set(tagsById.keys());
  const coveredSpecIds = [...specIds].filter((id) => taggedIds.has(id)).sort();

  return {
    status: issues.length === 0 ? "pass" : "fail",
    issues,
    specAcCount: specIds.size,
    taggedAcCount: taggedIds.size,
    coveredSpecAcCount: coveredSpecIds.length,
    orphanCount: orphans.length,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = verifyTestAcTags(args);
  if (result.status !== "pass") {
    console.error(`test-ac tags: FAIL - ${result.issues.length} issue(s)`);
    for (const issue of result.issues) console.error(`  - ${issue}`);
    process.exit(1);
  }
  console.log(
    `test-ac tags: PASS (${result.coveredSpecAcCount}/${result.specAcCount} spec AC(s) carry a tagged test, ${result.taggedAcCount} distinct tag(s), 0 orphans)`
  );
  process.exit(0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
