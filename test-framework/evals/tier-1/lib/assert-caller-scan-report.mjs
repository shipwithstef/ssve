/** Shared caller-report assertions for scanner and downstream plan validators. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Validate coverage accounting without equating partial coverage with absence.
 * @param {object} report Parsed output from find-callers.mjs.
 * @returns {void} Throws on inconsistent or incomplete report fields.
 */
export function assertCallerScanReport(report) {
  for (const key of ["scanned_files", "denominator", "matched_files"]) {
    assert.ok(Number.isSafeInteger(report[key]) && report[key] >= 0, `${key} must be a nonnegative integer`);
  }
  assert.ok(Array.isArray(report.skipped), "skipped paths must be explicit");
  assert.ok(Array.isArray(report.matches), "matches must be explicit");
  for (const entry of report.skipped) {
    assert.ok(entry && ["file", "directory"].includes(entry.kind), "skipped path kind must be explicit");
    assert.ok(typeof entry.path === "string" && entry.path.length > 0, "skipped path must be named");
    assert.ok(typeof entry.reason === "string" && entry.reason.length > 0, "skipped path must have a reason");
  }
  const skippedFiles = report.skipped.filter((entry) => entry.kind === "file").length;
  assert.equal(report.denominator, report.scanned_files + skippedFiles, "denominator includes discovered skipped files only");
  assert.equal(report.matched_files, report.matches.length, "matched_files must reflect matches");
  assert.ok(report.matched_files <= report.scanned_files, "matches cannot exceed successful reads");
  assert.equal(report.scan_complete, report.skipped.length === 0, "scan_complete must reflect every skipped path");
  assert.equal(report.canonical_absence_proven,
    report.scanned_files > 0 && report.scan_complete && report.matched_files === 0,
    "absence requires complete nonempty negative coverage");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assertCallerScanReport(JSON.parse(fs.readFileSync(process.argv[2], "utf8")));
}
