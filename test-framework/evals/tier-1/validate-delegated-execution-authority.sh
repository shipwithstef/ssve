#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
MODULE="$ROOT/hooks/lib/delegation-authority.mjs"
if [[ ! -f "$MODULE" ]]; then
  echo "WI502-RED delegated-execution: scoped delegation authority missing"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

node --input-type=module - "$ROOT" "$TMP" <<'NODE'
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const [root, tmp] = process.argv.slice(2);
const delegation = await import(pathToFileURL(path.join(root, "hooks/lib/delegation-authority.mjs")));
const mergeBack = await import(pathToFileURL(path.join(root, "scripts/validate-execution-merge-back.mjs")));
const authority = await import(pathToFileURL(path.join(root, "hooks/lib/authority-store.mjs")));
const isolation = await import(pathToFileURL(path.join(root, "hooks/svc-worktree-isolation-guard.mjs")));
const git = (cwd, args, binary = false) => execFileSync("git", ["-C", cwd, ...args], { encoding: binary ? undefined : "utf8" });
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const tasks = [
  { id: "A", paths: ["src/a/**"], blocked_by: [] },
  { id: "B", paths: ["src/b/**"], blocked_by: [] },
  { id: "C", paths: ["src/a/shared.ts"], blocked_by: [] },
  { id: "D", paths: [], blocked_by: [] },
];
const graph = delegation.planExecutionGraph({ wi: "WI-502", baseSha: "a".repeat(40), tasks });
assert.equal(graph.schema_version, 1);
const waveA = graph.waves.find((wave) => wave.tasks.includes("A"));
const waveB = graph.waves.find((wave) => wave.tasks.includes("B"));
assert.equal(waveA.id, waveB.id, "disjoint tasks were not parallelized");
assert.notEqual(graph.waves.find((wave) => wave.tasks.includes("C")).id, waveA.id, "overlap was not serialized");
assert.equal(graph.tasks.D.serialization_reason, "unknown-scope");
assert.throws(() => delegation.planExecutionGraph({
  wi: "WI-502", baseSha: "a".repeat(40), tasks: [{ id: "bad", paths: ["src/**"], blocked_by: ["missing"] }],
}), /unknown blocker/i);

const stateRoot = path.join(tmp, "delegations");
const inner = path.join(tmp, "inner");
fs.mkdirSync(inner);
const issued = delegation.issueDelegation({
  stateRoot, lease: { lease_id: "lease-1", generation: 7, wi: "WI-502", state: "active" },
  childPrincipal: "principal-child", taskId: "A", waveId: waveA.id,
  innerWorktree: inner, allowedPaths: ["src/a/**", "tests/a/**"],
  deniedPaths: [".svc/**", ".git/**"], baseSha: "a".repeat(40), ttlMs: 60_000,
});
assert.ok(issued.token);
const accepted = delegation.acceptDelegation({ stateRoot, delegationId: issued.capability.delegation_id, childPrincipal: "principal-child", token: issued.token });
assert.equal(accepted.status, "accepted");
assert.throws(() => delegation.acceptDelegation({ stateRoot, delegationId: issued.capability.delegation_id, childPrincipal: "principal-child", token: issued.token }), /accepted|token/i);
const skillReceipt = JSON.parse(fs.readFileSync(accepted.skill_receipt_path, "utf8"));

const allowed = delegation.authorizeDelegatedMutation({
  stateRoot, delegationId: issued.capability.delegation_id, childPrincipal: "principal-child",
  lease: { lease_id: "lease-1", generation: 7, wi: "WI-502", state: "active" },
  worktreeRoot: inner, targets: ["src/a/index.ts", "tests/a/index.test.ts"], taskState: "running", skillReceipt,
});
assert.equal(allowed.ok, true);
for (const bad of [
  { targets: ["src/b/index.ts"] },
  { targets: [".svc/lane-tasks-WI-502.json"] },
  { childPrincipal: "sibling" },
  { worktreeRoot: tmp },
  { lease: { lease_id: "lease-1", generation: 8, wi: "WI-502", state: "active" } },
]) {
  const result = delegation.authorizeDelegatedMutation({
    stateRoot, delegationId: issued.capability.delegation_id, childPrincipal: "principal-child",
    lease: { lease_id: "lease-1", generation: 7, wi: "WI-502", state: "active" },
    worktreeRoot: inner, targets: ["src/a/index.ts"], taskState: "running", skillReceipt,
    ...bad,
  });
  assert.equal(result.ok, false);
}
delegation.updateDelegationStatus({ stateRoot, delegationId: issued.capability.delegation_id, status: "completed" });
const frozen = delegation.freezeDelegations({ stateRoot, leaseId: "lease-1", oldGeneration: 7 });
assert.equal(frozen.length, 1);
assert.equal(frozen[0].status, "frozen");

const nestedState = path.join(tmp, "nested-state");
const parentInner = path.join(tmp, "parent-inner");
const childInner = path.join(tmp, "child-inner");
fs.mkdirSync(parentInner); fs.mkdirSync(childInner);
const parentIssued = delegation.issueDelegation({
  stateRoot: nestedState, lease: { lease_id: "lease-nested", generation: 2, wi: "WI-502", state: "active" },
  childPrincipal: "parent-child", taskId: "parent", waveId: "wave-1", innerWorktree: parentInner,
  allowedPaths: ["src/**"], baseSha: "b".repeat(40), maxDepth: 1,
});
fs.mkdirSync(path.join(nestedState, "delegation-locks"), { recursive: true });
fs.writeFileSync(path.join(nestedState, "delegation-locks", `${parentIssued.capability.delegation_id}.lock`), `99999999\n${(await import("node:os")).hostname()}\ndead\n`, { mode: 0o600 });
const parentAccepted = delegation.acceptDelegation({ stateRoot: nestedState, delegationId: parentIssued.capability.delegation_id, childPrincipal: "parent-child", token: parentIssued.token });
assert.throws(() => delegation.issueDelegation({
  stateRoot: nestedState, lease: { lease_id: "lease-nested", generation: 2, wi: "WI-502", state: "active" },
  childPrincipal: "grandchild", taskId: "grandchild", waveId: "wave-1", innerWorktree: childInner,
  allowedPaths: ["src/child/**"], baseSha: "b".repeat(40), maxDepth: 1, parentDelegation: parentAccepted,
}), /depth/i);
const nested = delegation.issueDelegation({
  stateRoot: nestedState, lease: { lease_id: "lease-nested", generation: 2, wi: "WI-502", state: "active" },
  childPrincipal: "grandchild", taskId: "grandchild", waveId: "wave-1", innerWorktree: childInner,
  allowedPaths: ["src/child/**"], baseSha: "b".repeat(40), maxDepth: 0, parentDelegation: parentAccepted,
});
assert.equal(nested.capability.parent_delegation_id, parentAccepted.delegation_id);
assert.throws(() => delegation.issueDelegation({
  stateRoot: nestedState, lease: { lease_id: "lease-nested", generation: 2, wi: "WI-502", state: "active" },
  childPrincipal: "widening-child", taskId: "widen", waveId: "wave-1", innerWorktree: childInner,
  allowedPaths: ["private/**"], baseSha: "b".repeat(40), maxDepth: 0, parentDelegation: parentAccepted,
}), /exceeds parent/i);
assert.equal(delegation.matchesAny("src/mod1/file.ts", ["src/mod?/**"]), true);

const repo = path.join(tmp, "repo"); const mergeInner = path.join(tmp, "merge-inner"); const mergeState = path.join(tmp, "merge-state");
fs.mkdirSync(repo); git(repo, ["init", "-q"]); git(repo, ["config", "user.email", "test@example.invalid"]); git(repo, ["config", "user.name", "WI-502 test"]);
fs.mkdirSync(path.join(repo, "src")); fs.writeFileSync(path.join(repo, "src", "base.txt"), "base\n"); git(repo, ["add", "."]); git(repo, ["commit", "-qm", "base"]);
const baseSha = git(repo, ["rev-parse", "HEAD"]).trim();
const repoId = authority.repositoryId(repo);
const mergeLease = authority.bootstrapController({ stateRoot: mergeState, repoId, wi: "WI-502", worktreeRoot: repo, principal: "controller-principal" });
const raceGraph = path.join(tmp, "race-graph.json"); const raceLease = path.join(tmp, "race-lease.json");
writeJson(raceGraph, { wi: "WI-502", base_sha: baseSha, tasks: { race: { state: "pending", skill: "execute-changeset", wave_id: "wave-1", paths: ["src/**"], validation_commands: ["test -f src/result.txt"] } } });
writeJson(raceLease, mergeLease);
const issueArgs = (principal) => [path.join(root, "scripts/dispatch-execution-task.mjs"), "issue", "--state-root", mergeState, "--repo", repo, "--graph", raceGraph, "--task", "race", "--lease", raceLease, "--child-principal", principal, "--inner-root", path.join(tmp, "race-inner")];
const launch = (principal) => new Promise((resolve) => { const child = spawn("node", issueArgs(principal), { stdio: "ignore" }); child.on("exit", (code) => resolve(code)); });
const raceCodes = await Promise.all([launch("race-child-a"), launch("race-child-b")]);
assert.deepEqual(raceCodes.sort(), [0, 2], "duplicate dispatch did not produce exactly one winner");
const raceCapabilities = fs.readdirSync(path.join(mergeState, "delegations")).map((name) => JSON.parse(fs.readFileSync(path.join(mergeState, "delegations", name), "utf8"))).filter((entry) => entry.task_id === "race");
assert.equal(raceCapabilities.length, 1, "duplicate dispatch issued more than one capability");
const mergeIssued = delegation.issueDelegation({ stateRoot: mergeState, lease: mergeLease, childPrincipal: "merge-child", taskId: "merge-task", waveId: "wave-1", innerWorktree: mergeInner, allowedPaths: ["src/**"], validationCommands: ["test -f src/result.txt"], baseSha });
git(repo, ["worktree", "add", "-qb", "delegated-test", mergeInner, baseSha]);
const mergeAccepted = delegation.acceptDelegation({ stateRoot: mergeState, delegationId: mergeIssued.capability.delegation_id, childPrincipal: "merge-child", token: mergeIssued.token });
const executionGraph = path.join(tmp, "execution-graph.json");
writeJson(executionGraph, { tasks: { "merge-task": { state: "running" } } });
const delegatedEnv = {
  ...process.env, SVC_DELEGATION_ID: mergeIssued.capability.delegation_id,
  SVC_DELEGATION_STATE_ROOT: mergeState, SVC_DELEGATION_CHILD_PRINCIPAL: "merge-child",
  SVC_EXECUTION_GRAPH: executionGraph, SVC_DELEGATION_SKILL_RECEIPT: mergeAccepted.skill_receipt_path,
};
const delegatedCall = (file) => ({ toolName: "Edit", toolInput: { file_path: file }, sessionId: "child-session", cwd: mergeInner, raw: { host: "codex", cwd: mergeInner, session_id: "child-session", tool_name: "Edit", tool_input: { file_path: file } } });
assert.equal(isolation.classifyMutation(delegatedCall(path.join(mergeInner, "src", "result.txt")), delegatedEnv).allow, true);
const deniedDelegated = isolation.classifyMutation(delegatedCall(path.join(mergeInner, ".svc", "forbidden.json")), delegatedEnv);
assert.equal(deniedDelegated.allow, false); assert.match(deniedDelegated.reason, /denied delegated path/i);
const delegatedShell = isolation.classifyMutation({
  toolName: "Bash", toolInput: { workdir: mergeInner, command: "printf x > README.md" }, sessionId: "child-session", cwd: mergeInner,
  raw: { host: "codex", cwd: mergeInner, session_id: "child-session", tool_name: "Bash", tool_input: { workdir: mergeInner, command: "printf x > README.md" } },
}, delegatedEnv);
assert.equal(delegatedShell.allow, false, "relative Bash redirection bypassed delegated allowed_paths");
fs.writeFileSync(path.join(mergeInner, "src", "result.txt"), "result\n"); git(mergeInner, ["add", "."]); git(mergeInner, ["commit", "-qm", "delegated result"]);
const validationFile = path.join(tmp, "validation.json"); const receiptFile = path.join(tmp, "completion.json");
writeJson(validationFile, [{ command: "test", exit_code: 0, output_digest: `sha256:${"1".repeat(64)}` }]);
execFileSync("node", [path.join(root, "scripts/dispatch-execution-task.mjs"), "complete", "--state-root", mergeState, "--delegation", mergeIssued.capability.delegation_id, "--child-principal", "merge-child", "--validation", validationFile, "--out", receiptFile], { stdio: ["ignore", "pipe", "pipe"] });
const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
const actualDigest = `sha256:${crypto.createHash("sha256").update(git(mergeInner, ["diff", "--binary", `${baseSha}..${receipt.head_sha}`], true)).digest("hex")}`;
assert.equal(receipt.diff_digest, actualDigest);
assert.equal(mergeBack.validateMergeBack({ stateRoot: mergeState, delegationId: mergeIssued.capability.delegation_id, lease: mergeLease, receipt }).ok, true);
assert.throws(() => mergeBack.validateMergeBack({ stateRoot: mergeState, delegationId: mergeIssued.capability.delegation_id, lease: mergeLease, receipt: { ...receipt, diff_digest: `sha256:${"0".repeat(64)}` } }), /digest/i);
assert.throws(() => mergeBack.validateMergeBack({ stateRoot: mergeState, delegationId: mergeIssued.capability.delegation_id, lease: mergeLease, receipt: { ...receipt, commits: [] } }), /commits/i);
const leaseFile = path.join(tmp, "merge-lease.json"); const mergeResultFile = path.join(tmp, "merge-result.json"); writeJson(leaseFile, mergeLease);
execFileSync("node", [path.join(root, "scripts/validate-execution-merge-back.mjs"), "--state-root", mergeState, "--delegation", mergeIssued.capability.delegation_id, "--lease", leaseFile, "--receipt", receiptFile, "--merge", "--integration-worktree", repo, "--expected-integration-head", baseSha, "--out", mergeResultFile], { stdio: ["ignore", "pipe", "pipe"] });
const mergeResult = JSON.parse(fs.readFileSync(mergeResultFile, "utf8"));
assert.equal(mergeResult.mapping.integration_before, baseSha);
assert.equal(git(repo, ["show", "HEAD:src/result.txt"]).trim(), "result");
assert.throws(() => mergeBack.validateMergeBack({ stateRoot: mergeState, delegationId: mergeIssued.capability.delegation_id, lease: mergeLease, receipt }), /already merged into/i);
assert.equal(delegation.freezeDelegations({ stateRoot: mergeState, leaseId: mergeLease.lease_id, oldGeneration: mergeLease.generation }).length, 1, "unmerged race result freezes while merged result stays terminal");
assert.equal(delegation.readDelegation({ stateRoot: mergeState, delegationId: mergeIssued.capability.delegation_id }).status, "merged");

console.log("TIER-1 PASS: partition fence, delegation authority, completion receipt, and merge-back validation");
NODE
