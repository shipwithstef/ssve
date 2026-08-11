#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { finalizeDriveOutcome, legacyReportProjection, missingFromReceiptResult, readDriveOutcome, scheduleDetachedDrive } from "./scripts/lib/reconcile-core.mjs";

const states = [
  { name: "clean", report: { mode: "refuse", main: "main", unaccounted_count: 0, unaccounted_commits: [], merged_unverified_count: 0, merged_unverified_prs: [], gh_available: true, auto_drive_runs: [] } },
  { name: "warn", report: { mode: "warn", main: "main", unaccounted_count: 1, unaccounted_commits: [{ sha: "a", missing: ["plan-manifest"] }], merged_unverified_count: 0, merged_unverified_prs: [], gh_available: true, auto_drive_runs: [] } },
  { name: "refuse", report: { mode: "refuse", main: "main", unaccounted_count: 1, unaccounted_commits: [{ sha: "b", missing: ["review-exec"] }], merged_unverified_count: 0, merged_unverified_prs: [], gh_available: true, auto_drive_runs: [] } },
  { name: "github-degraded", report: { mode: "refuse", main: "main", unaccounted_count: 0, unaccounted_commits: [], merged_unverified_count: 0, merged_unverified_prs: [], gh_available: false, auto_drive_runs: [] } },
  { name: "merged-unverified", report: { mode: "refuse", main: "main", unaccounted_count: 0, unaccounted_commits: [], merged_unverified_count: 1, merged_unverified_prs: [{ pr: 1, sha: "c" }], gh_available: true, auto_drive_runs: [{ pr: 1, sha: "c", ok: true }] } }
];
for (const { name, report } of states) {
  assert.deepEqual(legacyReportProjection({ ...report, timing: { total_ms: 1 }, drive: { scheduled: 1 } }), report, name);
}
const perSha = [
  { ok: true, results: [{ sha: "a", ok: true, missing: [] }] },
  { ok: false, results: [{ sha: "b", ok: false, missing: ["review-plan"] }] }
].flatMap(missingFromReceiptResult);
const batched = missingFromReceiptResult({ ok: false, results: [{ sha: "a", ok: true, missing: [] }, { sha: "b", ok: false, missing: ["review-plan"] }] });
assert.deepEqual(batched, perSha);
const prePush = fs.readFileSync("hooks/git/pre-push.d/10-receipts-complete", "utf8");
assert.equal((prePush.match(/check-chain-receipts\.mjs --range/g) || []).length, 1);
assert.equal(/for\s+sha\s+in/.test(prePush), false);
const driveRoot = fs.mkdtempSync(path.join(os.tmpdir(), "wi472-drive-"));
const noop = path.join(driveRoot, "noop.mjs");
fs.writeFileSync(noop, "setTimeout(() => process.exit(0), 500);\n");
const first = scheduleDetachedDrive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { root: driveRoot, script: noop });
const duplicate = scheduleDetachedDrive("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", { root: driveRoot, script: noop });
assert.equal(first.scheduled, true);
assert.equal(duplicate.scheduled, false);
assert.equal(duplicate.reason, "already-running");
assert.equal(readDriveOutcome("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", driveRoot).state, "running");
// A stale lock is reclaimable; a crashed detached child cannot suppress a SHA forever.
const staleSha = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const stale = scheduleDetachedDrive(staleSha, { root: driveRoot, script: noop });
assert.equal(stale.scheduled, true);
await new Promise((resolve) => setTimeout(resolve, 20));
const reclaimed = scheduleDetachedDrive(staleSha, { root: driveRoot, script: noop, staleLockMs: 0 });
assert.equal(reclaimed.scheduled, true);
const terminal = (sha) => ({schema_version:1,target_sha:sha,pid:1,state:"terminal",exit_classification:"success",started_at:new Date().toISOString(),ended_at:new Date().toISOString(),watcher_cutoff:null,diagnostic:"fixture"});
// The stale generation cannot overwrite the replacement or unlink its lock.
assert.equal(finalizeDriveOutcome({lockPath:reclaimed.paths.lock,outcomePath:reclaimed.paths.outcome,generation:stale.generation,outcome:terminal(staleSha)}), false);
assert.equal(fs.existsSync(reclaimed.paths.lock), true);
assert.equal(readDriveOutcome(staleSha, driveRoot).generation, reclaimed.generation);
// The current generation can publish terminal success. A later preflight
// consumes it without rescheduling/overwriting it, allowing watcher advance.
assert.equal(finalizeDriveOutcome({lockPath:reclaimed.paths.lock,outcomePath:reclaimed.paths.outcome,generation:reclaimed.generation,outcome:terminal(staleSha)}), true);
const terminalReuse = scheduleDetachedDrive(staleSha, { root: driveRoot, script: noop });
assert.equal(terminalReuse.scheduled, false);
assert.equal(terminalReuse.reason, "terminal-success");
assert.equal(readDriveOutcome(staleSha, driveRoot).state, "terminal");
fs.rmSync(driveRoot, { recursive: true, force: true });
console.log("validate-svc-reconcile-golden: PASS (5 legacy states + batch equality)");
NODE
