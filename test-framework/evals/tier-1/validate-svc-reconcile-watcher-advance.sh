#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { shouldAdvanceWatcher } from "./scripts/lib/reconcile-core.mjs";

const generation = "00000000-0000-4000-8000-000000000000";
const terminal = (sha, exit="success") => ({ schema_version:1, target_sha:sha, generation, pid:1, state:"terminal", exit_classification:exit, started_at:"2026-07-21T00:00:00.000Z", ended_at:"2026-07-21T00:00:01.000Z", watcher_cutoff:null, diagnostic:"fixture" });
const running = (sha) => ({ schema_version:1, target_sha:sha, generation, pid:null, state:"running", exit_classification:null, started_at:"2026-07-21T00:00:00.000Z", ended_at:null, watcher_cutoff:null, diagnostic:"fixture" });
const complete = [{ sha: "a", verified: true }, { sha: "b", outcome: terminal("b") }];
assert.equal(shouldAdvanceWatcher({ ghAvailable: true, candidates: complete }), true);
for (const candidate of [
  { ghAvailable: false, candidates: complete },
  { ghAvailable: true, candidates: [{ sha: "a" }] },
  { ghAvailable: true, candidates: [{ sha: "a", outcome: running("a") }] },
  { ghAvailable: true, candidates: [{ sha: "a", outcome: terminal("a", "error") }] },
  { ghAvailable: true, candidates: [{ sha: "a", outcome: { state: "terminal", exit_classification: "success" } }] }
]) assert.equal(shouldAdvanceWatcher(candidate), false);

const stateIoUrl = pathToFileURL(path.resolve("scripts/state-io.mjs")).href;
const source = fs.readFileSync("scripts/lib/reconcile-core.mjs", "utf8").replace('"../state-io.mjs"', JSON.stringify(stateIoUrl));
const mutated = source.replace("if (!ghAvailable) return false;", "if (!ghAvailable) return true;");
assert.notEqual(mutated, source, "mutation target exists");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wi472-watcher-"));
const file = path.join(dir, "mutant.mjs");
fs.writeFileSync(file, mutated);
const mutant = await import(pathToFileURL(file));
let red = false;
try { assert.equal(mutant.shouldAdvanceWatcher({ ghAvailable: false, candidates: complete }), false); }
catch { red = true; }
assert.equal(red, true, "loosened watcher predicate proves red");
console.log("validate-svc-reconcile-watcher-advance: PASS (mutation red, state matrix green)");
NODE

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wi472-gh-hang-"));
const gh = path.join(dir, "gh");
fs.writeFileSync(gh, "#!/usr/bin/env bash\nsleep 10\n");
fs.chmodSync(gh, 0o755);
const checkpoint = path.join(dir, "checkpoint.json");
const currentHead = execFileSync("git", ["rev-parse", "origin/main"], { encoding: "utf8" }).trim();
const before = { last_reconciled_sha: currentHead, last_pr_watcher_run: "2026-07-20T00:00:00.000Z" };
fs.writeFileSync(checkpoint, JSON.stringify(before));
const started = Date.now();
const run = spawnSync(process.execPath, ["scripts/svc-reconcile.mjs"], {
  encoding: "utf8",
  timeout: 5000,
  env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, SVC_RECONCILE_CHECKPOINT_PATH: checkpoint, SVC_GH_AUTH_RECOVERY_PATH: path.join(dir, "auth.json"), SVC_RECONCILE_CHILD_TIMEOUT_MS: "100" }
});
const elapsed = Date.now() - started;
const report = JSON.parse(run.stdout);
const after = JSON.parse(fs.readFileSync(checkpoint, "utf8"));
assert.equal(run.status, 0);
assert.ok(elapsed < 2000, `hung GitHub path took ${elapsed}ms`);
assert.equal(report.gh_available, false);
assert.equal(report.reconcile_metadata.watcher_advanced, false);
assert.equal(after.last_pr_watcher_run, before.last_pr_watcher_run);
console.log("validate-svc-reconcile-watcher-advance: PASS (hung GitHub bounded, watcher preserved)");
NODE

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wi472-terminal-flow-"));
const drive=path.join(dir,"drive"); fs.mkdirSync(drive);
const sha="5b4cb61ed842890e5077b0dfe005dd07db16b83a", generation="00000000-0000-4000-8000-000000000001";
const base=spawnSync("git",["rev-parse","origin/main"],{encoding:"utf8"}).stdout.trim();
fs.writeFileSync(path.join(drive,`${sha}.outcome.json`),JSON.stringify({schema_version:1,target_sha:sha,generation,pid:1,state:"terminal",exit_classification:"success",started_at:"2026-07-21T00:00:00.000Z",ended_at:"2026-07-21T00:00:01.000Z",watcher_cutoff:null,diagnostic:"fixture"}));
const gh=path.join(dir,"gh");
fs.writeFileSync(gh,`#!/usr/bin/env bash\nif [[ "$1 $2" == "auth status" ]]; then echo 'github.com'; echo '  ✓ Logged in to github.com account s7an-it (keyring)'; echo '  - Active account: true'; exit 0; fi\nif [[ "$1 $2" == "pr list" ]]; then echo '[{"number":160,"mergeCommit":{"oid":"${sha}"},"mergedAt":"2099-01-01T00:00:00Z"}]'; exit 0; fi\nexit 0\n`); fs.chmodSync(gh,0o755);
const checkpoint=path.join(dir,"checkpoint.json"); fs.writeFileSync(checkpoint,JSON.stringify({last_reconciled_sha:base,last_pr_watcher_run:"2026-07-20T00:00:00.000Z"}));
const result=spawnSync(process.execPath,["scripts/svc-reconcile.mjs"],{encoding:"utf8",env:{...process.env,PATH:`${dir}:${process.env.PATH}`,SVC_RECONCILE_CHECKPOINT_PATH:checkpoint,SVC_GH_AUTH_RECOVERY_PATH:path.join(dir,"auth.json"),SVC_RECONCILE_DRIVE_ROOT:drive,SVC_RECONCILE_CHILD_TIMEOUT_MS:"2000"}});
assert.equal(result.status,0,result.stderr); const report=JSON.parse(result.stdout);
assert.equal(report.reconcile_metadata.watcher_advanced,true);
assert.equal(report.reconcile_metadata.auto_drive_scheduling[0].reason,"terminal-success");
assert.equal(JSON.parse(fs.readFileSync(path.join(drive,`${sha}.outcome.json`))).state,"terminal");
assert.equal(fs.existsSync(path.join(drive,`${sha}.lock.json`)),false);
fs.rmSync(dir,{recursive:true,force:true});
console.log("validate-svc-reconcile-watcher-advance: PASS (terminal success preserved through main flow)");
NODE
