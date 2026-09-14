#!/usr/bin/env node
/**
 * validate-makeRelative-regression.mjs — Tier 1 regression test for
 * makeRelative() path normalization in svc-workflow-guard.mjs.
 *
 * COST: $0 — no LLM calls.
 *
 * Tests:
 *   - Normal subpath under cwd is correctly stripped
 *   - Sibling directory with same prefix is NOT incorrectly stripped
 *   - Exact cwd path is left unchanged
 *   - Relative paths pass through unchanged
 *
 * Exit 0: all checks pass
 * Exit 1: one or more checks fail
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

let PASS = 0;
let FAIL = 0;
const ERRORS = [];

function pass(msg) {
  PASS++;
  console.log(`  ✓ ${msg}`);
}

function fail(msg) {
  FAIL++;
  ERRORS.push(msg);
  console.log(`  ✗ ${msg}`);
}

// Extract makeRelative from the hook file
const HOOK_PATH = new URL("../../../hooks/svc-workflow-guard.mjs", import.meta.url).pathname;
const HOOK_SOURCE = fs.readFileSync(HOOK_PATH, "utf8");
const makeRelativeMatch = HOOK_SOURCE.match(/function makeRelative[\s\S]*?^\}/m);
if (!makeRelativeMatch) {
  console.error("  ✗ Could not extract makeRelative from svc-workflow-guard.mjs");
  process.exit(1);
}
const MAKE_RELATIVE_SRC = makeRelativeMatch[0];

// Create a temp directory structure for testing
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "makeRelative-test-"));
fs.mkdirSync(path.join(TMP_DIR, "project", "src"), { recursive: true });
fs.mkdirSync(path.join(TMP_DIR, "project-suffix"), { recursive: true });

function makeRelative(filePath, cwd) {
  const code = `
    const path = require('path');
    const operationRoot = ${JSON.stringify(cwd)};
    ${MAKE_RELATIVE_SRC}
    process.chdir(${JSON.stringify(cwd)});
    console.log(JSON.stringify(makeRelative(${JSON.stringify(filePath)})));
  `;
  return JSON.parse(execFileSync(process.execPath, ["-e", code], { encoding: "utf8" }).trim());
}

console.log("=== Tier 1: makeRelative Regression Validation ===");

const CWD = path.join(TMP_DIR, "project");

// Test 1: Normal subpath should be stripped
const r1 = makeRelative(path.join(TMP_DIR, "project", "src", "file.js"), CWD);
if (r1 === "src/file.js") {
  pass("normal subpath project/src/file.js -> src/file.js");
} else {
  fail(`normal subpath expected src/file.js, got ${JSON.stringify(r1)}`);
}

// Test 2: Sibling directory with same prefix must NOT be stripped
const r2 = makeRelative(path.join(TMP_DIR, "project-suffix", "file.md"), CWD);
if (r2.endsWith("project-suffix/file.md")) {
  pass("sibling prefix project-suffix/file.md -> untouched");
} else {
  fail(`sibling prefix expected untouched, got ${JSON.stringify(r2)}`);
}

// Test 3: Exact cwd path should be left unchanged
const r3 = makeRelative(path.join(TMP_DIR, "project"), CWD);
if (r3.endsWith("/project")) {
  pass("exact cwd /.../project -> unchanged");
} else {
  fail(`exact cwd expected unchanged, got ${JSON.stringify(r3)}`);
}

// Test 4: Relative path should pass through unchanged
const r4 = makeRelative("src/file.js", CWD);
if (r4 === "src/file.js") {
  pass("relative path src/file.js -> unchanged");
} else {
  fail(`relative path expected unchanged, got ${JSON.stringify(r4)}`);
}

// Test 5: Double-slash edge case (absolute path with redundant slash)
const r5 = makeRelative(path.join(TMP_DIR, "project") + "/" + path.join("src", "file.js"), CWD);
if (r5 === "src/file.js") {
  pass("double-slash project//src/file.js -> src/file.js");
} else {
  fail(`double-slash expected src/file.js, got ${JSON.stringify(r5)}`);
}

console.log("");
if (FAIL === 0) {
  console.log(`  PASS — all ${PASS} makeRelative assertions passed`);
  process.exit(0);
} else {
  console.log(`  ${FAIL} failed`);
  for (const e of ERRORS) {
    console.log(`    - ${e}`);
  }
  process.exit(1);
}
