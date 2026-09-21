#!/usr/bin/env node
/** Regression coverage for the functional improvement; fixtures never use live project state. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
/** Create a disposable project and remove it after the test. */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssve-functional-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
/** Write a fixture file, creating only fixture-owned parents. */
function put(dir, name, value) {
  const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); return file;
}
/** Execute the real CLI with bounded runtime and isolated project state. */
function cli(script, args, cwd, env = {}) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd, env: { ...process.env, SVC_PROJECT_DIR: cwd, ...env }, encoding: "utf8", timeout: 10000,
  });
}
/** Require successful machine-readable output. */
function json(result) { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }


import { assertCallerScanReport } from "./lib/assert-caller-scan-report.mjs";

const script = "scripts/find-callers.mjs";
/** A no-match status is expected; the JSON still reports coverage. */
function scan(dir) { const r = cli(script, ["--root", dir, "--identifier", "targetFn"], dir); assert.ok([0, 1].includes(r.status), r.stderr); const report = JSON.parse(r.stdout); assertCallerScanReport(report); return report; }
test("oversized files prevent a false proof of absence", (t) => {
  const dir = fixture(t); put(dir, "small.js", "other();"); put(dir, "large.js", "x".repeat(2_000_001) + " targetFn();");
  const out = scan(dir); assert.equal(out.scanned_files, 1); assert.equal(out.denominator, 2);
  assert.equal(out.scan_complete, false); assert.equal(out.canonical_absence_proven, false); assert.equal(out.skipped[0].reason, "size-limit");
});
test("a complete nonempty negative scan retains absence reporting", (t) => {
  const dir = fixture(t); put(dir, "small.js", "other();");
  const out = scan(dir); assert.equal(out.canonical_absence_proven, true); assert.equal(out.scanned_files, 1);
});
test("matches and intentional directory exclusions are preserved", (t) => {
  const dir = fixture(t); put(dir, "z.js", "targetFn();"); put(dir, "a.js", "targetFn();"); put(dir, "node_modules/ignored.js", "targetFn();");
  const a = scan(dir); const b = scan(dir);
  assert.deepEqual(a, b); assert.deepEqual(a.matches.map((m) => m.path), ["a.js", "z.js"]); assert.equal(a.scanned_files, 2);
});
test("untraversed symlinks and absent roots remain explicitly incomplete", (t) => {
  const dir = fixture(t); put(dir, "small.js", "other();"); fs.symlinkSync("small.js", path.join(dir, "link.js"));
  assert.equal(scan(dir).canonical_absence_proven, false);
  const result = cli(script, ["--root", path.join(dir, "missing"), "--identifier", "targetFn"], dir);
  assert.equal(result.status, 1); assert.equal(JSON.parse(result.stdout).scan_complete, false);
});

test("downstream plan contract accepts partial positive scans and rejects dishonest accounting", (t) => {
  const dir = fixture(t); put(dir, "caller.mjs", "invokeValidatePlanContract();");
  put(dir, "large.mjs", "x".repeat(2_000_001)); fs.symlinkSync("caller.mjs", path.join(dir, "link.mjs"));
  const report = json(cli(script, ["--root", dir, "--identifier", "validate-plan-contract.mjs"], dir));
  assertCallerScanReport(report);
  assert.equal(report.scanned_files, 1); assert.equal(report.denominator, 3); assert.equal(report.matched_files, 1);
  assert.equal(report.scan_complete, false); assert.equal(report.canonical_absence_proven, false);
  const checker = "test-framework/evals/tier-1/lib/assert-caller-scan-report.mjs";
  const file = put(dir, "report.json", report); assert.equal(cli(checker, [file], dir).status, 0);
  for (const mutation of [
    { denominator: 1 }, { scan_complete: true }, { canonical_absence_proven: true },
    { matched_files: 0 }, { scanned_files: -1 }, { skipped: [] },
  ]) {
    put(dir, "report.json", { ...report, ...mutation });
    assert.equal(cli(checker, [file], dir).status, 1, JSON.stringify(mutation));
  }
  const consumer = fs.readFileSync(path.join(root, "test-framework/evals/tier-1/validate-plan-product-safety.sh"), "utf8");
  assert.match(consumer, /lib\/assert-caller-scan-report\.mjs/);
  assert.doesNotMatch(consumer, /denominator\s*!==\s*r\.scanned_files/);
});
test("empty roots and unreadable directories cannot create absence or invent candidate counts", (t) => {
  const dir = fixture(t); const empty = scan(dir);
  assert.equal(empty.denominator, 0); assert.equal(empty.canonical_absence_proven, false);
  const result = cli(script, ["--root", path.join(dir, "missing"), "--identifier", "targetFn"], dir);
  assert.equal(result.status, 1); const report = JSON.parse(result.stdout); assertCallerScanReport(report);
  assert.equal(report.denominator, 0); assert.equal(report.skipped[0].kind, "directory");
  assert.throws(() => assertCallerScanReport({ ...report, denominator: 1 }), /denominator/);
  assert.throws(() => assertCallerScanReport({ ...empty, canonical_absence_proven: true }), /absence/);
});
