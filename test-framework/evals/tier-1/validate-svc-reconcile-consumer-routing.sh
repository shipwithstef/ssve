#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SCRIPT="$ROOT/scripts/svc-reconcile.mjs"

node --input-type=module - "$SCRIPT" <<'NODE'
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const script = process.argv[2];
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-reconcile-consumer-"));
const empty = path.join(temp, "empty");
fs.mkdirSync(empty);

const help = spawnSync(process.execPath, [script, "--help"], { cwd: empty, encoding: "utf8" });
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /Usage: .*svc-reconcile\.mjs/);
assert.equal(fs.existsSync(path.join(empty, ".svc")), false, "--help must not create consumer state");

const repo = path.join(temp, "consumer");
const bin = path.join(temp, "bin");
const outside = path.join(temp, "outside");
fs.mkdirSync(repo);
fs.mkdirSync(bin);
fs.mkdirSync(outside);
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { cwd: repo, encoding: "utf8", ...options });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
};
run("git", ["init", "-b", "main"]);
run("git", ["config", "user.name", "SVC fixture"]);
run("git", ["config", "user.email", "svc@example.invalid"]);
fs.writeFileSync(path.join(repo, "fixture.txt"), "consumer\n");
run("git", ["add", "fixture.txt"]);
run("git", ["commit", "-m", "consumer fixture"]);
const head = run("git", ["rev-parse", "HEAD"]);
run("git", ["remote", "add", "origin", "git@github.com:test/consumer.git"]);
run("git", ["update-ref", "refs/remotes/origin/main", head]);
run("git", ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"]);

const marker = path.join(temp, "consumer-checker-ran");
const driveMarker = path.join(temp, "consumer-auto-drive-ran");
fs.mkdirSync(path.join(repo, "scripts"));
fs.writeFileSync(path.join(repo, "scripts/check-chain-receipts.mjs"), `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(marker)}, "bad"); process.exit(0);\n`);
fs.writeFileSync(path.join(repo, "scripts/svc-auto-drive.mjs"), `import fs from "node:fs"; fs.writeFileSync(${JSON.stringify(driveMarker)}, "bad"); process.exit(0);\n`);
fs.writeFileSync(path.join(bin, "gh"), `#!/usr/bin/env bash
if [[ "$1 $2" == "auth status" ]]; then
  echo "github.com account test (keyring)"
  echo "  Active account: true"
  exit 0
fi
if [[ "$1 $2 $3" == "pr list --state" ]]; then printf '[{"number":7,"mergeCommit":{"oid":"%s"},"mergedAt":"2099-01-01T00:00:00Z"}]\n' ${JSON.stringify(head)}; exit 0; fi
exit 0
`);
fs.chmodSync(path.join(bin, "gh"), 0o755);

const state = path.join(temp, "state");
fs.mkdirSync(state);
// WI-549: mode is resolved through the shared chain-policy resolver; force it
// via the SVC_CHAIN_POLICY env override instead of a bespoke policy-path file.
const result = spawnSync(process.execPath, [script, "--repo", repo], {
  cwd: outside,
  encoding: "utf8",
  env: {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    SVC_RECONCILE_CHECKPOINT_PATH: path.join(state, "checkpoint.json"),
    SVC_CHAIN_POLICY: "warn",
    SVC_GH_AUTH_RECOVERY_PATH: path.join(state, "gh-recovery.json"),
    SVC_RECONCILE_DRIVE_ROOT: path.join(state, "drive"),
    SVC_RECONCILE_CHILD_TIMEOUT_MS: "3000",
  },
});
assert.equal(result.status, 0, result.stderr || result.stdout);
const report = JSON.parse(result.stdout);
assert.equal(report.main, "main");
assert.equal(report.gh_available, true, "fixture must reach merged-PR discovery");
assert.equal(report.merged_unverified_count, 1, "fixture must exercise one merged-unverified PR");
assert.equal(report.auto_drive_runs.length, 1, "fixture must schedule the packaged auto-drive path");
assert.equal(report.unaccounted_count > 0, true, "fixture commit must be inspected in consumer repo");
assert.doesNotMatch(result.stderr, /Receipt validation was unavailable/, "central receipt validation must remain available");
assert.equal(fs.existsSync(marker), false, "consumer-local helper must not shadow the central SVC helper");
const waitUntil = Date.now() + 1000;
while (Date.now() < waitUntil && !fs.existsSync(driveMarker)) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
}
assert.equal(fs.existsSync(driveMarker), false, "consumer-local auto-drive must not shadow the central SVC executable");
assert.equal(fs.existsSync(path.join(outside, ".svc")), false, "explicit --repo must anchor state away from caller cwd");

console.log("validate-svc-reconcile-consumer-routing: PASS (read-only help + explicit consumer repo + central helper)");
NODE
