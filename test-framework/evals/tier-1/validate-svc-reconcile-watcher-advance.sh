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
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
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
import { spawnSync } from "node:child_process";
import { reconcileFixture } from "./test-framework/evals/tier-1/lib/reconcile-fixture.mjs";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wi472-gh-hang-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const gh = path.join(dir, "gh");
fs.writeFileSync(gh, "#!/usr/bin/env bash\nif [[ \"$1 $2\" == \"auth status\" ]]; then echo '  ✓ Logged in to github.com account shipwithstef (keyring)'; echo '  - Active account: true'; exit 0; fi\nsleep 30\n");
fs.chmodSync(gh, 0o755);
const checkpoint = path.join(dir, "checkpoint.json");
const { repo, sha: currentHead } = reconcileFixture(dir);
const before = { last_reconciled_sha: currentHead, last_pr_watcher_run: "2026-07-20T00:00:00.000Z" };
function checkTimeout({ child, github, minMs, maxMs, invalid = null, outerMs = 9000 }) {
  fs.writeFileSync(checkpoint, JSON.stringify(before));
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}`, SVC_RECONCILE_CHECKPOINT_PATH: checkpoint, SVC_GH_AUTH_RECOVERY_PATH: path.join(dir, "auth.json") };
  delete env.SVC_RECONCILE_CHILD_TIMEOUT_MS;
  delete env.SVC_RECONCILE_GH_TIMEOUT_MS;
  if (child !== undefined) env.SVC_RECONCILE_CHILD_TIMEOUT_MS = child;
  if (github !== undefined) env.SVC_RECONCILE_GH_TIMEOUT_MS = github;
  const run = spawnSync(process.execPath, ["scripts/svc-reconcile.mjs", "--repo", repo], { encoding: "utf8", timeout: outerMs, env });
  assert.equal(run.status, 0, `child=${child} gh=${github}: ${run.stderr || run.error}`);
  const report = JSON.parse(run.stdout);
  const elapsed = report.reconcile_metadata.gh_check?.duration_ms;
  assert.equal(report.reconcile_metadata.gh_check?.classification, "timeout");
  assert.ok(elapsed >= minMs && elapsed < maxMs, `child=${child} gh=${github}: timeout took ${elapsed}ms`);
  assert.equal(report.gh_available, false);
  assert.equal(report.reconcile_metadata.watcher_advanced, false);
  assert.equal(JSON.parse(fs.readFileSync(checkpoint, "utf8")).last_pr_watcher_run, before.last_pr_watcher_run);
  if (invalid) assert.match(run.stderr, new RegExp(`invalid ${invalid}; using \\d+ms`));
  else assert.doesNotMatch(run.stderr, /invalid SVC_RECONCILE_(?:GH_|CHILD_)TIMEOUT_MS/);
}

// Allow real Git discovery and fake authentication to start on a contended
// hosted runner. Only the intentional 30-second GitHub hang should time out.
checkTimeout({ child: "5000", github: "1000", minMs: 700, maxMs: 3000 });
checkTimeout({ child: "3000", github: "1000", minMs: 700, maxMs: 3000 });
checkTimeout({ child: "3000", github: "999999", minMs: 2200, maxMs: 5000 });
for (const bad of ["0", "-1", "1.5", "NaN", "9007199254740992", ""]) {
  checkTimeout({ child: "3000", github: bad, minMs: 2200, maxMs: 5000, invalid: "SVC_RECONCILE_GH_TIMEOUT_MS" });
}
for (const bad of ["-1", "1.5", "NaN", "9007199254740992"]) {
  checkTimeout({ child: bad, github: "1000", minMs: 700, maxMs: 3000, invalid: "SVC_RECONCILE_CHILD_TIMEOUT_MS" });
}
checkTimeout({ child: "0", minMs: 9000, maxMs: 12000, invalid: "SVC_RECONCILE_CHILD_TIMEOUT_MS", outerMs: 14000 });
console.log("validate-svc-reconcile-watcher-advance: PASS (hung GitHub bounded across valid, clamped, and invalid timeout inputs; watcher preserved)");
NODE

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { reconcileFixture } from "./test-framework/evals/tier-1/lib/reconcile-fixture.mjs";
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wi472-terminal-flow-"));
process.on("exit", () => fs.rmSync(dir, { recursive: true, force: true }));
const drive=path.join(dir,"drive"); fs.mkdirSync(drive);
const { repo, sha } = reconcileFixture(dir);
const generation="00000000-0000-4000-8000-000000000001";
const base=sha;
fs.writeFileSync(path.join(drive,`${sha}.outcome.json`),JSON.stringify({schema_version:1,target_sha:sha,generation,pid:1,state:"terminal",exit_classification:"success",started_at:"2026-07-21T00:00:00.000Z",ended_at:"2026-07-21T00:00:01.000Z",watcher_cutoff:null,diagnostic:"fixture"}));
const gh=path.join(dir,"gh");
fs.writeFileSync(gh,`#!/usr/bin/env bash\nif [[ "$1 $2" == "auth status" ]]; then echo 'github.com'; echo '  ✓ Logged in to github.com account shipwithstef (keyring)'; echo '  ✓ Logged in to github.com account s7an-it (keyring)'; echo '  - Active account: true'; exit 0; fi\nif [[ "$1 $2" == "auth switch" ]]; then exit 0; fi\nif [[ "$1 $2" == "pr list" ]]; then echo '[{"number":160,"mergeCommit":{"oid":"${sha}"},"mergedAt":"2099-01-01T00:00:00Z"}]'; exit 0; fi\nexit 0\n`); fs.chmodSync(gh,0o755);
const checkpoint=path.join(dir,"checkpoint.json"); fs.writeFileSync(checkpoint,JSON.stringify({last_reconciled_sha:base,last_pr_watcher_run:"2026-07-20T00:00:00.000Z"}));
const result=spawnSync(process.execPath,["scripts/svc-reconcile.mjs","--repo",repo],{encoding:"utf8",env:{...process.env,PATH:`${dir}:${process.env.PATH}`,SVC_RECONCILE_CHECKPOINT_PATH:checkpoint,SVC_GH_AUTH_RECOVERY_PATH:path.join(dir,"auth.json"),SVC_RECONCILE_DRIVE_ROOT:drive,SVC_RECONCILE_CHILD_TIMEOUT_MS:"2000"}});
assert.equal(result.status,0,result.stderr); const report=JSON.parse(result.stdout);
assert.equal(report.reconcile_metadata.watcher_advanced,true);
assert.equal(report.reconcile_metadata.auto_drive_scheduling[0].reason,"terminal-success");
assert.equal(JSON.parse(fs.readFileSync(path.join(drive,`${sha}.outcome.json`))).state,"terminal");
assert.equal(fs.existsSync(path.join(drive,`${sha}.lock.json`)),false);
fs.rmSync(dir,{recursive:true,force:true});
console.log("validate-svc-reconcile-watcher-advance: PASS (terminal success preserved through main flow)");
NODE
