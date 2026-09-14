#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$ROOT"

check_source() {
  node --input-type=module - "$1" <<'NODE'
import fs from "node:fs";
const source = fs.readFileSync(process.argv[2], "utf8");
if (/\b(?:execSync|spawnSync)\s*\(/.test(source)) {
  console.error("validate-svc-reconcile-bounded: direct synchronous child call bypasses bounded adapter");
  process.exit(1);
}
if (!source.includes("runBounded")) {
  console.error("validate-svc-reconcile-bounded: bounded adapter is not wired");
  process.exit(1);
}
NODE
}

check_source scripts/svc-reconcile.mjs
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
sed 's/runBounded/runUnbounded/g' scripts/svc-reconcile.mjs > "$tmp"
if check_source "$tmp" >/dev/null 2>&1; then
  echo "validate-svc-reconcile-bounded: mutation did not prove red" >&2
  exit 1
fi

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import { runBounded } from "./scripts/lib/reconcile-core.mjs";
const start = Date.now();
const result = runBounded(process.execPath, ["-e", "setTimeout(()=>{}, 10000)"], { timeoutMs: 100 });
assert.equal(result.ok, false);
assert.equal(result.classification, "timeout");
assert.ok(Date.now() - start < 2000);
const missing = runBounded("wi472-command-does-not-exist", [], { timeoutMs: 100 });
assert.equal(missing.ok, false);
assert.equal(missing.classification, "spawn-error");
console.log("validate-svc-reconcile-bounded: PASS (mutation red, timeout + spawn-error green)");
NODE

node --input-type=module <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const dir=fs.mkdtempSync(path.join(os.tmpdir(),"wi472-git-timeout-"));
const realGit=spawnSync("which",["git"],{encoding:"utf8"}).stdout.trim();
fs.writeFileSync(path.join(dir,"git"),`#!/usr/bin/env bash\n[[ "$1" == "log" ]] && { sleep 10; exit 0; }\nexec "${realGit}" "$@"\n`); fs.chmodSync(path.join(dir,"git"),0o755);
fs.writeFileSync(path.join(dir,"gh"),"#!/usr/bin/env bash\nif [[ \"$1 $2\" == \"auth status\" ]]; then echo 'github.com account s7an-it'; echo '  Active account: true'; else echo '[]'; fi\n"); fs.chmodSync(path.join(dir,"gh"),0o755);
const base="6b026ea9fbcee849e682d7aa47c3eec894512de3", checkpoint=path.join(dir,"checkpoint.json");
fs.writeFileSync(checkpoint,JSON.stringify({last_reconciled_sha:base,last_pr_watcher_run:"2026-07-20T00:00:00.000Z"}));
// WI-549: mode is resolved through the shared chain-policy resolver; force it
// via the SVC_CHAIN_POLICY env override instead of a bespoke policy-path file.
const result=spawnSync(process.execPath,["scripts/svc-reconcile.mjs"],{encoding:"utf8",timeout:5000,env:{...process.env,PATH:`${dir}:${process.env.PATH}`,SVC_RECONCILE_CHECKPOINT_PATH:checkpoint,SVC_CHAIN_POLICY:"refuse",SVC_GH_AUTH_RECOVERY_PATH:path.join(dir,"auth.json"),SVC_RECONCILE_DRIVE_ROOT:path.join(dir,"drive"),SVC_RECONCILE_CHILD_TIMEOUT_MS:"100"}});
assert.equal(result.status,1,result.stderr); const report=JSON.parse(result.stdout), after=JSON.parse(fs.readFileSync(checkpoint));
assert.equal(report.reconcile_metadata.receipt_check.classification,"timeout"); assert.equal(report.reconcile_metadata.receipt_check.mode,"discovery-failed");
assert.equal(report.unaccounted_count,1); assert.equal(after.last_reconciled_sha,base);
fs.rmSync(dir,{recursive:true,force:true});
console.log("validate-svc-reconcile-bounded: PASS (git-log timeout blocks checkpoint advancement)");
NODE
