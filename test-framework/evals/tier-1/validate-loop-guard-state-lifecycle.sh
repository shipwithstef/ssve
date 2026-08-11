#!/usr/bin/env bash
# Tier 1: bounded lifecycle cleanup for per-session loop-guard state (WI-511).
# Proves exact target selection, strict age boundaries, deterministic zero-wait
# contention, fail-open hook integration, and no lock-sidecar residue.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
HELPER="$REPO_ROOT/hooks/lib/loop-guard-state-lifecycle.mjs"
HOOK="$REPO_ROOT/hooks/svc-loop-guard.mjs"
STATE_IO="$REPO_ROOT/scripts/state-io.mjs"

if [[ ! -f "$HELPER" ]]; then
  echo "FAIL: loop-guard lifecycle helper unavailable" >&2
  exit 1
fi

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT

node --input-type=module - "$HELPER" "$HOOK" "$STATE_IO" "$TMP_ROOT" <<'NODE'
import assert from "node:assert/strict";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const [helperPath, hookPath, stateIoPath, tmpRoot] = process.argv.slice(2);
const {
  LOOP_GUARD_PRUNE_BATCH_SIZE,
  LOOP_GUARD_PRUNE_INTERVAL_MS,
  LOOP_GUARD_STATE_MAX_AGE_MS,
  pruneExpiredLoopGuardStates,
  shouldPruneLoopGuardState,
} = await import(pathToFileURL(helperPath));

let passCount = 0;
const pass = (label) => {
  passCount += 1;
  process.stdout.write(`  PASS: ${label}\n`);
};
const setMtime = (file, millis) => {
  const seconds = millis / 1000;
  utimesSync(file, seconds, seconds);
};
const waitFor = async (predicate, timeoutMs, label) => {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`timed out waiting for ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
};

const now = Date.parse("2026-07-24T00:00:00.000Z");
const svcDir = path.join(tmpRoot, "selection", ".svc");
mkdirSync(svcDir, { recursive: true });
const current = path.join(svcDir, "loop-guard-state-current_session.json");
const staleLegacy = path.join(svcDir, "loop-guard-state.json");
const staleSession = path.join(svcDir, "loop-guard-state-old-session.json");
const exactCutoff = path.join(svcDir, "loop-guard-state-exact.json");
const fresh = path.join(svcDir, "loop-guard-state-fresh.json");
const unrelated = path.join(svcDir, "pipeline-decisions.jsonl");
const matchingDirectory = path.join(svcDir, "loop-guard-state-directory.json");
const matchingSymlink = path.join(svcDir, "loop-guard-state-link.json");
const symlinkTarget = path.join(svcDir, "symlink-target.json");
const invalidLookalikes = [
  path.join(svcDir, "loop-guard-state-.json"),
  path.join(svcDir, `loop-guard-state-${"x".repeat(49)}.json`),
  path.join(svcDir, "loop-guard-state-bad.name.json"),
];

for (const file of [
  current,
  staleLegacy,
  staleSession,
  exactCutoff,
  fresh,
  unrelated,
  symlinkTarget,
  ...invalidLookalikes,
]) {
  writeFileSync(file, "{}\n");
}
mkdirSync(matchingDirectory);
symlinkSync(symlinkTarget, matchingSymlink);
setMtime(current, now - LOOP_GUARD_STATE_MAX_AGE_MS - 10_000);
setMtime(staleLegacy, now - LOOP_GUARD_STATE_MAX_AGE_MS - 1);
setMtime(staleSession, now - LOOP_GUARD_STATE_MAX_AGE_MS - 60_000);
setMtime(exactCutoff, now - LOOP_GUARD_STATE_MAX_AGE_MS);
setMtime(fresh, now - LOOP_GUARD_STATE_MAX_AGE_MS + 1);
for (const file of invalidLookalikes) {
  setMtime(file, now - LOOP_GUARD_STATE_MAX_AGE_MS - 1);
}

const selection = pruneExpiredLoopGuardStates({ svcDir, currentStateFile: current, now });
assert.deepEqual(selection, { scanned: 6, removed: 2 });
assert.equal(existsSync(staleLegacy), false);
assert.equal(existsSync(staleSession), false);
for (const file of [
  current,
  exactCutoff,
  fresh,
  unrelated,
  matchingDirectory,
  matchingSymlink,
  symlinkTarget,
  ...invalidLookalikes,
]) {
  assert.equal(existsSync(file), true, `${file} must be preserved`);
}
pass("strict target selection rejects hostile lookalikes and removes only expired regular sibling state");

const cadence = path.join(svcDir, "loop-guard-state-cadence.json");
assert.equal(shouldPruneLoopGuardState(cadence, now), true);
writeFileSync(cadence, "{}\n");
setMtime(cadence, now - LOOP_GUARD_PRUNE_INTERVAL_MS);
assert.equal(shouldPruneLoopGuardState(cadence, now), true);
setMtime(cadence, now - LOOP_GUARD_PRUNE_INTERVAL_MS + 1);
assert.equal(shouldPruneLoopGuardState(cadence, now), false);
pass("24-hour cadence is inclusive at cutoff and false one millisecond newer");

assert.deepEqual(
  pruneExpiredLoopGuardStates({
    svcDir,
    currentStateFile: path.join(tmpRoot, "different", "loop-guard-state-current.json"),
    now,
  }),
  { scanned: 0, removed: 0 },
);
pass("directory mismatch fails open without scanning");

const symlinkRoot = path.join(tmpRoot, "symlinked-state-dir");
const symlinkRepo = path.join(symlinkRoot, "repo");
const externalState = path.join(symlinkRoot, "external-state");
mkdirSync(symlinkRepo, { recursive: true });
mkdirSync(externalState, { recursive: true });
const symlinkedSvcDir = path.join(symlinkRepo, ".svc");
symlinkSync(externalState, symlinkedSvcDir, "dir");
const externalVictim = path.join(externalState, "loop-guard-state-victim.json");
writeFileSync(externalVictim, "{}\n");
setMtime(externalVictim, now - LOOP_GUARD_STATE_MAX_AGE_MS - 1);
assert.deepEqual(
  pruneExpiredLoopGuardStates({
    svcDir: symlinkedSvcDir,
    currentStateFile: path.join(symlinkedSvcDir, "loop-guard-state-current.json"),
    now,
  }),
  { scanned: 0, removed: 0 },
);
assert.equal(existsSync(externalVictim), true);
pass("symlinked state directory cannot redirect cleanup outside the repository");

const lockDir = path.join(tmpRoot, "contention", ".svc");
mkdirSync(lockDir, { recursive: true });
const lockedCandidate = path.join(lockDir, "loop-guard-state-locked.json");
const lockCurrent = path.join(lockDir, "loop-guard-state-current.json");
const ready = path.join(tmpRoot, "holder-ready");
const release = path.join(tmpRoot, "holder-release");
writeFileSync(lockedCandidate, "{}\n");
writeFileSync(lockCurrent, JSON.stringify({
  history: [],
  warningsIssued: [],
  lastGitChecksum: null,
  noProgressCount: 0,
}) + "\n");
setMtime(lockedCandidate, now - LOOP_GUARD_STATE_MAX_AGE_MS - 1);

const holderSource = `
  import { existsSync, writeFileSync } from "node:fs";
  import { pathToFileURL } from "node:url";
  const [stateIo, candidate, ready, release] = process.argv.slice(1);
  const { withStateLock } = await import(pathToFileURL(stateIo));
  withStateLock(candidate, () => {
    writeFileSync(ready, "ready\\n");
    const deadline = Date.now() + 5000;
    while (!existsSync(release) && Date.now() < deadline) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
    }
    if (!existsSync(release)) process.exitCode = 3;
  });
`;
const holder = spawn(process.execPath, [
  "--input-type=module",
  "-e",
  holderSource,
  stateIoPath,
  lockedCandidate,
  ready,
  release,
], { stdio: ["ignore", "pipe", "pipe"] });
let holderStderr = "";
holder.stderr.on("data", (chunk) => { holderStderr += chunk.toString(); });
await waitFor(() => existsSync(ready), 2000, "lock-holder readiness");

const contentionStart = performance.now();
const contention = pruneExpiredLoopGuardStates({
  svcDir: lockDir,
  currentStateFile: lockCurrent,
  now,
});
const contentionMs = performance.now() - contentionStart;
assert.ok(contentionMs < 500, `contended prune took ${contentionMs.toFixed(2)}ms`);
assert.deepEqual(contention, { scanned: 1, removed: 0 });
assert.equal(existsSync(lockedCandidate), true);
assert.equal(existsSync(`${lockedCandidate}.lock`), true, "holder must still own the sidecar");

setMtime(lockedCandidate, Date.now() - LOOP_GUARD_STATE_MAX_AGE_MS - 1);
setMtime(lockCurrent, Date.now() - LOOP_GUARD_PRUNE_INTERVAL_MS - 1);
const lockedHookPayload = JSON.stringify({
  tool_name: "Bash",
  tool_input: { command: "printf locked-maintenance" },
  session_id: "current",
  cwd: path.dirname(lockDir),
});
const lockedHookRun = spawnSync(process.execPath, [hookPath], {
  input: lockedHookPayload,
  encoding: "utf8",
  timeout: 2000,
});
assert.equal(lockedHookRun.status, 0, lockedHookRun.stderr);
assert.equal(existsSync(lockedCandidate), true);
const lockedHookState = JSON.parse(readFileSync(lockCurrent, "utf8"));
assert.equal(lockedHookState.history.length, 1, "hook must persist the current call after cleanup contention");

writeFileSync(release, "release\n");
const holderExit = await new Promise((resolve) => holder.on("exit", resolve));
assert.equal(holderExit, 0, holderStderr);
assert.equal(existsSync(`${lockedCandidate}.lock`), false, "release must remove the sidecar");
pass(`held lock returns fail-fast and current-call enforcement persists (${contentionMs.toFixed(2)}ms)`);

const hookRoot = path.join(tmpRoot, "hook-integration");
const hookSvc = path.join(hookRoot, ".svc");
mkdirSync(hookSvc, { recursive: true });
const hookStale = path.join(hookSvc, "loop-guard-state-abandoned.json");
const hookCurrent = path.join(hookSvc, "loop-guard-state-current-session.json");
const seedPayload = JSON.stringify({
  tool_name: "Bash",
  tool_input: { command: "printf seed-abandoned-state" },
  session_id: "abandoned",
  cwd: hookRoot,
});
const seedRun = spawnSync(process.execPath, [hookPath], {
  input: seedPayload,
  encoding: "utf8",
  timeout: 2000,
});
assert.equal(seedRun.status, 0, seedRun.stderr);
assert.equal(existsSync(hookStale), true, "real stateFileFor producer must create the sibling");
writeFileSync(hookCurrent, "{malformed\n");
setMtime(hookStale, Date.now() - LOOP_GUARD_STATE_MAX_AGE_MS - 60_000);
setMtime(hookCurrent, Date.now() - LOOP_GUARD_PRUNE_INTERVAL_MS - 60_000);
const payload = JSON.stringify({
  tool_name: "Bash",
  tool_input: { command: "printf hook-lifecycle" },
  session_id: "current-session",
  cwd: hookRoot,
});
const hookRun = spawnSync(process.execPath, [hookPath], {
  input: payload,
  encoding: "utf8",
  timeout: 2000,
});
assert.equal(hookRun.status, 0, hookRun.stderr);
assert.equal(existsSync(hookStale), false);
const recovered = JSON.parse(readFileSync(hookCurrent, "utf8"));
assert.equal(recovered.history.length, 1);
pass("hook prunes before load and recovers malformed current state without changing allow behavior");

const failureDir = path.join(tmpRoot, "failure-families", ".svc");
mkdirSync(failureDir, { recursive: true });
const failureCurrent = path.join(failureDir, "loop-guard-state-current.json");
const failureCandidate = path.join(failureDir, "loop-guard-state-stale.json");
writeFileSync(failureCurrent, "{}\n");
writeFileSync(failureCandidate, "{}\n");
setMtime(failureCandidate, now - LOOP_GUARD_STATE_MAX_AGE_MS - 1);
assert.deepEqual(
  pruneExpiredLoopGuardStates(
    { svcDir: failureDir, currentStateFile: failureCurrent, now },
    { readdirSync: () => { throw new Error("enumeration denied"); } },
  ),
  { scanned: 0, removed: 0 },
);
assert.deepEqual(
  pruneExpiredLoopGuardStates(
    { svcDir: failureDir, currentStateFile: failureCurrent, now },
    {
      lstatSync: (file) => {
        if (file === failureCandidate) throw new Error("metadata denied");
        return lstatSync(file);
      },
    },
  ),
  { scanned: 1, removed: 0 },
);
assert.deepEqual(
  pruneExpiredLoopGuardStates(
    { svcDir: failureDir, currentStateFile: failureCurrent, now },
    { unlinkSync: () => { throw new Error("unlink denied"); } },
  ),
  { scanned: 1, removed: 0 },
);
assert.equal(existsSync(failureCandidate), true);
assert.equal(existsSync(`${failureCandidate}.lock`), false);
pass("enumeration, metadata, and unlink failures preserve state and return deterministically");

const budgetDir = path.join(tmpRoot, "bounded-batch", ".svc");
mkdirSync(budgetDir, { recursive: true });
const budgetCurrent = path.join(budgetDir, "loop-guard-state-current.json");
writeFileSync(budgetCurrent, "{}\n");
for (let index = 0; index < 100; index += 1) {
  const candidate = path.join(budgetDir, `loop-guard-state-budget-${String(index).padStart(3, "0")}.json`);
  writeFileSync(candidate, "{}\n");
  setMtime(candidate, now - LOOP_GUARD_STATE_MAX_AGE_MS - 1);
}
let budgetMetadataCalls = 0;
const firstBatchRemoved = [];
assert.equal(LOOP_GUARD_PRUNE_BATCH_SIZE, 32, "production cleanup batch contract must remain 32");
const budgetResult = pruneExpiredLoopGuardStates(
  { svcDir: budgetDir, currentStateFile: budgetCurrent, now },
  {
    lstatSync: (file) => {
      budgetMetadataCalls += 1;
      return lstatSync(file);
    },
    unlinkSync: (file) => {
      firstBatchRemoved.push(path.basename(file));
      unlinkSync(file);
    },
  },
);
assert.deepEqual(budgetResult, { scanned: 100, removed: 32 });
assert.equal(budgetMetadataCalls, 65);
assert.deepEqual(
  firstBatchRemoved,
  Array.from({ length: 32 }, (_, index) =>
    `loop-guard-state-budget-${String(index + 56).padStart(3, "0")}.json`),
);
assert.equal(
  Array.from({ length: 100 }, (_, index) =>
    path.join(budgetDir, `loop-guard-state-budget-${String(index).padStart(3, "0")}.json`))
    .filter(existsSync).length,
  68,
);
const secondBatchRemoved = [];
assert.deepEqual(
  pruneExpiredLoopGuardStates(
    { svcDir: budgetDir, currentStateFile: budgetCurrent, now: now + LOOP_GUARD_PRUNE_INTERVAL_MS },
    {
      unlinkSync: (file) => {
        secondBatchRemoved.push(path.basename(file));
        unlinkSync(file);
      },
    },
  ),
  { scanned: 68, removed: 32 },
);
assert.deepEqual(secondBatchRemoved, [
  ...Array.from({ length: 8 }, (_, index) =>
    `loop-guard-state-budget-${String(index + 92).padStart(3, "0")}.json`),
  ...Array.from({ length: 24 }, (_, index) =>
    `loop-guard-state-budget-${String(index).padStart(3, "0")}.json`),
]);
assert.equal(
  Array.from({ length: 100 }, (_, index) =>
    path.join(budgetDir, `loop-guard-state-budget-${String(index).padStart(3, "0")}.json`))
    .filter(existsSync).length,
  36,
);
pass("cleanup is pinned to 32 candidates and rotates to a different next-day batch");

const benchmarkDir = path.join(tmpRoot, "benchmark", ".svc");
mkdirSync(benchmarkDir, { recursive: true });
const benchmarkCurrent = path.join(benchmarkDir, "loop-guard-state-benchmark.json");
writeFileSync(benchmarkCurrent, "{}\n");
for (let index = 0; index < 109; index += 1) {
  writeFileSync(path.join(benchmarkDir, `unrelated-${index}.json`), "{}\n");
}
const samples = [];
let benchmarkMetadataCalls = 0;
for (let index = 0; index < 21; index += 1) {
  const start = performance.now();
  assert.deepEqual(
    pruneExpiredLoopGuardStates(
      { svcDir: benchmarkDir, currentStateFile: benchmarkCurrent, now },
      {
        lstatSync: (file) => {
          if (file !== benchmarkDir) benchmarkMetadataCalls += 1;
          return lstatSync(file);
        },
      },
    ),
    { scanned: 0, removed: 0 },
  );
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
const median = samples[Math.floor(samples.length / 2)];
assert.equal(benchmarkMetadataCalls, 0, "non-candidate entries must not trigger metadata or lock work");
pass(`109-entry no-op scan performs zero metadata/lock work (observed median ${median.toFixed(3)}ms)`);

const hookSource = readFileSync(hookPath, "utf8");
const pruneCallOffset = hookSource.indexOf(
  "pruneExpiredLoopGuardStates({ svcDir, currentStateFile: stateFile });",
);
const loadCallOffset = hookSource.indexOf("const state = loadState(stateFile);");
assert.ok(pruneCallOffset >= 0 && loadCallOffset >= 0 && pruneCallOffset < loadCallOffset);
pass("hook source pins stale-state pruning before current-state load");

process.stdout.write(`validate-loop-guard-state-lifecycle: ${passCount} passed, 0 failed\n`);
NODE
