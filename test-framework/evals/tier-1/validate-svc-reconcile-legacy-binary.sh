#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "wi472-old-new-"));
const run = (cmd, args, options = {}) => execFileSync(cmd, args, { cwd: temp, encoding: "utf8", ...options }).trim();
fs.mkdirSync(path.join(temp, "scripts"), { recursive: true });
fs.mkdirSync(path.join(temp, ".svc"), { recursive: true });
run("git", ["init", "-b", "main"]);
run("git", ["config", "user.name", "WI472 fixture"]);
run("git", ["config", "user.email", "wi472@example.invalid"]);
fs.writeFileSync(path.join(temp, "fixture.txt"), "one\n");
run("git", ["add", "fixture.txt"]); run("git", ["commit", "-m", "fixture one"]);
const parent = run("git", ["rev-parse", "HEAD"]);
fs.appendFileSync(path.join(temp, "fixture.txt"), "two\n");
run("git", ["add", "fixture.txt"]); run("git", ["commit", "-m", "fixture two"]);
const head = run("git", ["rev-parse", "HEAD"]);
run("git", ["remote", "add", "origin", "git@github.com:test/repo.git"]);
run("git", ["update-ref", "refs/remotes/origin/main", head]);
run("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

fs.writeFileSync(path.join(temp, "scripts/check-chain-receipts.mjs"), `import {execFileSync} from "node:child_process"; const a=process.argv; let shas=[]; if(a.includes("--range")){const r=a[a.indexOf("--range")+1]; shas=execFileSync("git",["log","--format=%H",r],{encoding:"utf8"}).trim().split("\\n").filter(Boolean)}else{shas=[a[a.indexOf("--sha")+1]]} const ok=process.env.FIX_RECEIPTS!=="missing"; console.log(JSON.stringify({ok,results:shas.map(sha=>({sha,ok,missing:ok?[]:["plan-manifest"]}))})); process.exit(ok?0:1);\n`);
fs.writeFileSync(path.join(temp, "scripts/svc-auto-drive.mjs"), "process.exit(0);\n");
const newRuntime = path.join(temp, "new-runtime", "scripts");
fs.mkdirSync(path.join(newRuntime, "lib"), { recursive: true });
fs.copyFileSync(path.join(root, "scripts/svc-reconcile.mjs"), path.join(newRuntime, "svc-reconcile.mjs"));
fs.symlinkSync(path.join(root, "scripts/state-io.mjs"), path.join(newRuntime, "state-io.mjs"));
fs.symlinkSync(path.join(root, "scripts/lib/reconcile-core.mjs"), path.join(newRuntime, "lib/reconcile-core.mjs"));
fs.copyFileSync(path.join(temp, "scripts/check-chain-receipts.mjs"), path.join(newRuntime, "check-chain-receipts.mjs"));
fs.copyFileSync(path.join(temp, "scripts/svc-auto-drive.mjs"), path.join(newRuntime, "svc-auto-drive.mjs"));
const bin = path.join(temp, "bin"); fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, "gh"), `#!/usr/bin/env bash
if [[ "$1 $2" == "auth status" ]]; then echo "github.com account test (keyring)"; echo "  Active account: true"; exit 0; fi
if [[ "$1 $2 $3" == "pr list --state" ]]; then
  [[ "$FIX_GH" == "down" ]] && exit 1
  [[ "$FIX_GH" == "merged" ]] && printf '[{"number":7,"mergeCommit":{"oid":"%s"},"mergedAt":"2099-01-01T00:00:00Z"}]\\n' "$FIX_HEAD" || echo '[]'
  exit 0
fi
exit 0
`);
fs.chmodSync(path.join(bin, "gh"), 0o755);

function invoke(script, state) {
  fs.writeFileSync(path.join(temp, ".svc/chain-policy.json"), JSON.stringify({ mode: state.mode }));
  fs.writeFileSync(path.join(temp, ".svc/reconcile-checkpoint.json"), JSON.stringify({ last_reconciled_sha: state.base, last_pr_watcher_run: "2000-01-01T00:00:00.000Z" }));
  const result = spawnSync(process.execPath, [script], { cwd: temp, encoding: "utf8", env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FIX_RECEIPTS: state.receipts, FIX_GH: state.gh, FIX_HEAD: head, SVC_RECONCILE_CHILD_TIMEOUT_MS: "2000" } });
  const parsed = JSON.parse(result.stdout);
  delete parsed.reconcile_metadata;
  return { status: result.status, report: parsed };
}
const states = [
  { name: "clean", mode: "refuse", base: head, receipts: "ok", gh: "ok" },
  { name: "unaccounted-warn", mode: "warn", base: parent, receipts: "missing", gh: "ok" },
  { name: "unaccounted-refuse", mode: "refuse", base: parent, receipts: "missing", gh: "ok" },
  { name: "github-degraded", mode: "refuse", base: head, receipts: "ok", gh: "down" },
  { name: "merged-unverified", mode: "refuse", base: head, receipts: "ok", gh: "merged" },
];
for (const state of states) {
  const newResult = invoke(path.join(newRuntime, "svc-reconcile.mjs"), state);
  const expectedStatus = state.name === "unaccounted-refuse" ? 1 : 0;
  assert.equal(newResult.status, expectedStatus, `${state.name} exit status`);
  assert.equal(newResult.report.mode, state.mode, `${state.name} mode`);
  assert.equal(newResult.report.main, "main", `${state.name} main branch`);
  assert.equal(newResult.report.unaccounted_count, state.receipts === "missing" ? 1 : 0, `${state.name} unaccounted count`);
  assert.equal(newResult.report.gh_available, state.gh !== "down", `${state.name} GitHub availability`);
  assert.equal(newResult.report.merged_unverified_count, state.gh === "merged" ? 1 : 0, `${state.name} merged-unverified count`);
  if (state.receipts === "missing") {
    assert.deepEqual(newResult.report.unaccounted_commits, [{ sha: head, missing: ["plan-manifest"] }], `${state.name} locked receipt projection`);
  }
  if (state.gh === "merged") {
    assert.deepEqual(newResult.report.merged_unverified_prs, [{ pr: 7, sha: head, mergedAt: "2099-01-01T00:00:00Z" }], `${state.name} locked PR projection`);
  }
}
console.log("validate-svc-reconcile-legacy-binary: PASS (frozen legacy projection contract, 5 states)");
NODE
