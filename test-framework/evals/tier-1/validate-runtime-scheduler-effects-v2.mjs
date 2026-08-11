#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  claimReadyTaskLeases,
  claimTaskLease,
  closeTaskLease,
  expireTaskLeases,
  heartbeatTaskLease,
  readLeaseStore,
  reclaimExpiredTaskLease,
  taskConflict,
  validateExecutionLease
} from "../../../scripts/lib/runtime-scheduler-v2.mjs";
import {
  BUILT_IN_EFFECT_ADAPTER_IDS,
  compensateAuthorizedEffect,
  executeAuthorizedEffect,
  executeValidatorArgv,
  readEffectReceipt
} from "../../../scripts/lib/runtime-effects-v2.mjs";

const generationBindings = Object.freeze({
  protocol_generation_digest: "a".repeat(64), product_generation_digest: "b".repeat(64),
  context_generation_digest: "c".repeat(64), concern_generation_digest: "d".repeat(64),
  control_generation_digest: "e".repeat(64), authority_generation_digest: "f".repeat(64),
  layer_inventory_digest: "1".repeat(64)
});

function sha(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function baseCapsule(taskId = "A", file = "src/a.mjs", mergeKey = "010-A") {
  return {
    schema_version: 2, wi: "WI-P5", task_id: taskId, product_outcome: `deliver ${taskId}`,
    generation_bindings: generationBindings, dependencies: [], merge_dependencies: [],
    interfaces: { provides: [], consumes: [] }, revision: 1, plan_digest: "2".repeat(64),
    accepted_parent_sha: "3".repeat(40), allowed_files: [{ path: file, action: "MODIFY" }],
    forbidden_writes: ["secrets/**"],
    decisions: [{ id: "direction", status: "RESOLVED", source_digest: "4".repeat(64) }],
    authorities: [{ id: "executor", status: "RESOLVED", source_digest: "5".repeat(64) }],
    effect_capabilities: [{
      id: `write-${taskId}`, principal: "executor", kind: "filesystem_write", targets: [file],
      max_cost_usd: 0, root_only: false, requires_idempotency: false, reversible: true
    }],
    resource_claims: [{ key: `repo:${taskId}`, mode: "exclusive" }],
    parallel_policy: { eligible: true, merge_order_key: mergeKey }, active_budget_seconds: 60,
    validations: [{
      id: "unit", argv: [process.execPath, "-e", "process.stdout.write('ok')"], inputs: [file],
      validator_digest: "6".repeat(64), environment_class: "hermetic", cost_class: "micro", required_at_freeze: true
    }],
    failure_policy: { local_attempts: 2, assist_attempts: 1, plan_freeze_categories: ["PRODUCT_CONTRACT", "SECURITY_AUTHORITY"] }
  };
}

if (process.argv[2] === "--claim-worker") {
  const capsule = JSON.parse(fs.readFileSync(process.argv[3], "utf8"));
  const result = claimTaskLease({
    store_path: process.argv[4], run_id: "run-race", capsule, principal_id: process.argv[5],
    now: "2026-08-10T00:00:00.000Z", ttl_ms: 10_000
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(result.valid ? 0 : 1);
}

let passed = 0;
async function check(name, action) {
  try { await action(); passed += 1; }
  catch (error) { console.error(`not ok ${name}: ${error.stack ?? error.message}`); process.exitCode = 1; }
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-runtime-p5-"));
fs.mkdirSync(path.join(temp, "src"), { recursive: true });
for (const name of ["a", "b", "c", "shared"]) fs.writeFileSync(path.join(temp, `src/${name}.mjs`), `export const ${name} = 1;\n`);

await check("durable scheduler claims multiple independent tasks", () => {
  const storePath = path.join(temp, "leases-independent.json");
  const capsules = [baseCapsule("A", "src/a.mjs", "010-A"), baseCapsule("B", "src/b.mjs", "020-B")];
  const result = claimReadyTaskLeases({
    store_path: storePath, run_id: "run-independent", capsules, completed_task_ids: [],
    principals: { A: "worker-a", B: "worker-b" }, now: "2026-08-10T00:00:00.000Z", ttl_ms: 1000, max_active: 4
  });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.deepEqual(result.claimed_task_ids, ["A", "B"]);
  assert.deepEqual(result.active_task_ids, ["A", "B"]);
  assert.deepEqual(result.deterministic_merge_order, ["A", "B"]);
  assert.equal(readLeaseStore(storePath, "run-independent").leases.filter((lease) => lease.status === "ACTIVE").length, 2);
});

await check("dependency, file, resource and effect sets each serialize", () => {
  const a = baseCapsule("A", "src/a.mjs", "010-A");
  const dependency = baseCapsule("B", "src/b.mjs", "020-B");
  dependency.dependencies = ["A"];
  assert.equal(taskConflict(a, dependency).kind, "dependency");

  const file = baseCapsule("B", "src/a.mjs", "020-B");
  assert.equal(taskConflict(a, file).kind, "file");

  const resource = baseCapsule("B", "src/b.mjs", "020-B");
  resource.resource_claims[0].key = "repo:A";
  assert.equal(taskConflict(a, resource).kind, "resource");

  const effectA = baseCapsule("A", "src/a.mjs", "010-A");
  const effectB = baseCapsule("B", "src/b.mjs", "020-B");
  effectA.effect_capabilities[0] = { ...effectA.effect_capabilities[0], kind: "provider_write", targets: ["https://api.example.test/items/*"] };
  effectB.effect_capabilities[0] = { ...effectB.effect_capabilities[0], kind: "network_read", targets: ["https://api.example.test/items/42"] };
  assert.equal(taskConflict(effectA, effectB).kind, "effect");
});

await check("ready graph waits for dependencies and serializes active conflicts", () => {
  const storePath = path.join(temp, "leases-conflicts.json");
  const a = baseCapsule("A", "src/shared.mjs", "010-A");
  const b = baseCapsule("B", "src/shared.mjs", "020-B");
  const c = baseCapsule("C", "src/c.mjs", "030-C");
  c.dependencies = ["A"];
  c.merge_dependencies = ["A"];
  const result = claimReadyTaskLeases({
    store_path: storePath, run_id: "run-conflicts", capsules: [a, b, c], completed_task_ids: [],
    principals: { A: "worker-a", B: "worker-b", C: "worker-c" }, now: "2026-08-10T00:00:00.000Z", ttl_ms: 1000
  });
  assert.deepEqual(result.claimed_task_ids, ["A"]);
  assert(result.deferred.some((entry) => entry.task_id === "B" && entry.reason.includes("file:src/shared.mjs")));
  assert(!result.deferred.some((entry) => entry.task_id === "C"));
});

await check("heartbeat binds principal, task, generation and extends durable expiry", () => {
  const storePath = path.join(temp, "leases-heartbeat.json");
  const acquired = claimTaskLease({
    store_path: storePath, run_id: "run-heartbeat", capsule: baseCapsule(), principal_id: "worker-a",
    now: "2026-08-10T00:00:00.000Z", ttl_ms: 1000
  });
  assert.equal(validateExecutionLease(acquired.lease).valid, true);
  const denied = heartbeatTaskLease({
    store_path: storePath, run_id: "run-heartbeat", task_id: "A", principal_id: "worker-b",
    generation: acquired.lease.generation, lease_id: acquired.lease.lease_id, now: "2026-08-10T00:00:00.500Z"
  });
  assert.equal(denied.valid, false);
  const heartbeat = heartbeatTaskLease({
    store_path: storePath, run_id: "run-heartbeat", task_id: "A", principal_id: "worker-a",
    generation: acquired.lease.generation, lease_id: acquired.lease.lease_id, now: "2026-08-10T00:00:00.500Z"
  });
  assert.equal(heartbeat.valid, true);
  assert.equal(heartbeat.lease.heartbeat_sequence, 1);
  assert.equal(heartbeat.lease.expires_at, "2026-08-10T00:00:01.500Z");
});

await check("expiry and compare-and-swap reclaim advance generation exactly once", () => {
  const storePath = path.join(temp, "leases-reclaim.json");
  const first = claimTaskLease({
    store_path: storePath, run_id: "run-reclaim", capsule: baseCapsule(), principal_id: "worker-a",
    now: "2026-08-10T00:00:00.000Z", ttl_ms: 100
  });
  const expired = expireTaskLeases({ store_path: storePath, run_id: "run-reclaim", now: "2026-08-10T00:00:00.100Z" });
  assert.deepEqual(expired.expired_lease_ids, [first.lease.lease_id]);
  const reclaimed = reclaimExpiredTaskLease({
    store_path: storePath, run_id: "run-reclaim", capsule: baseCapsule(), principal_id: "worker-b",
    expected_predecessor_lease_id: first.lease.lease_id, now: "2026-08-10T00:00:00.101Z", ttl_ms: 100
  });
  assert.equal(reclaimed.valid, true);
  assert.equal(reclaimed.lease.generation, 2);
  assert.equal(reclaimed.lease.predecessor_lease_id, first.lease.lease_id);
  const stale = reclaimExpiredTaskLease({
    store_path: storePath, run_id: "run-reclaim", capsule: baseCapsule(), principal_id: "worker-c",
    expected_predecessor_lease_id: first.lease.lease_id, now: "2026-08-10T00:00:00.102Z", ttl_ms: 100
  });
  assert.equal(stale.valid, false);
});

await check("closing a lease requires the exact active authority tuple", () => {
  const storePath = path.join(temp, "leases-close.json");
  const acquired = claimTaskLease({ store_path: storePath, run_id: "run-close", capsule: baseCapsule(), principal_id: "worker-a", now: "2026-08-10T00:00:00.000Z", ttl_ms: 1000 });
  const stale = closeTaskLease({
    store_path: storePath, run_id: "run-close", task_id: "A", principal_id: "worker-a",
    generation: 2, lease_id: acquired.lease.lease_id, status: "RELEASED", now: "2026-08-10T00:00:00.001Z"
  });
  assert.equal(stale.valid, false);
  const closed = closeTaskLease({
    store_path: storePath, run_id: "run-close", task_id: "A", principal_id: "worker-a",
    generation: 1, lease_id: acquired.lease.lease_id, status: "RELEASED", reason: "task-accepted", now: "2026-08-10T00:00:00.001Z"
  });
  assert.equal(closed.valid, true);
  assert.equal(closed.lease.status, "RELEASED");
});

function runClaimWorker(capsulePath, storePath, principal) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--claim-worker", capsulePath, storePath, principal], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

await check("real concurrent claims produce one winner and one active lease", async () => {
  const capsulePath = path.join(temp, "race-capsule.json");
  const storePath = path.join(temp, "leases-race.json");
  fs.writeFileSync(capsulePath, `${JSON.stringify(baseCapsule())}\n`);
  const results = await Promise.all([runClaimWorker(capsulePath, storePath, "worker-a"), runClaimWorker(capsulePath, storePath, "worker-b")]);
  assert.equal(results.filter((result) => result.code === 0).length, 1, results.map((result) => result.stderr).join(";"));
  const store = readLeaseStore(storePath, "run-race");
  assert.equal(store.leases.filter((lease) => lease.status === "ACTIVE").length, 1);
  assert.equal(store.leases.length, 1);
});

await check("validator dispatch passes metacharacters as argv without shell parsing", () => {
  const marker = path.join(temp, "argv-injection-marker");
  const capsule = baseCapsule();
  capsule.validations[0].argv = [process.execPath, "-e", "process.stdout.write(process.argv[1])", `$(touch ${marker})`];
  const result = executeValidatorArgv(capsule, "unit", { cwd: temp });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.passed, true);
  assert.equal(result.receipt.stdout, `$(touch ${marker})`);
  assert.equal(fs.existsSync(marker), false);
  assert.deepEqual(result.receipt.argv, capsule.validations[0].argv);
});

await check("validator dispatch reports actual nonzero exit and unknown validators fail closed", () => {
  const capsule = baseCapsule();
  capsule.validations[0].argv = [process.execPath, "-e", "process.exit(7)"];
  const failed = executeValidatorArgv(capsule, "unit", { cwd: temp });
  assert.equal(failed.passed, false);
  assert.equal(failed.receipt.exit_code, 7);
  assert.equal(executeValidatorArgv(capsule, "missing", { cwd: temp }).valid, false);
});

await check("validator dispatch rejects shell command strings", () => {
  const marker = path.join(temp, "shell-command-marker");
  const capsule = baseCapsule();
  capsule.validations[0].argv = ["bash", "-c", `touch ${marker}`];
  const result = executeValidatorArgv(capsule, "unit", { cwd: temp });
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("shell command string")));
  assert.equal(fs.existsSync(marker), false);
});

function filesystemEffect(overrides = {}) {
  return {
    capability_id: "write-A", principal: "executor", kind: "filesystem_write", target: "src/a.mjs",
    file_action: "MODIFY", idempotency_key: "edit-a-once", adapter_id: "filesystem.write-file-v2",
    adapter_input: { content_utf8: "export const a = 2;\n" }, ...overrides
  };
}

await check("authorized filesystem effect executes once, readbacks and compensates", async () => {
  const receiptRoot = path.join(temp, "effect-receipts");
  const capsule = baseCapsule();
  const before = fs.readFileSync(path.join(temp, "src/a.mjs"), "utf8");
  const first = await executeAuthorizedEffect(capsule, filesystemEffect(), { repo_root: temp, receipt_root: receiptRoot });
  assert.equal(first.valid, true, first.errors?.join("; "));
  assert.equal(first.executed, true);
  assert.equal(first.receipt.status, "CONFIRMED");
  assert.equal(first.receipt.readback.sha256, sha("export const a = 2;\n"));
  const second = await executeAuthorizedEffect(capsule, filesystemEffect(), { repo_root: temp, receipt_root: receiptRoot });
  assert.equal(second.valid, true);
  assert.equal(second.executed, false);
  assert.equal(second.idempotent, true);
  const conflict = await executeAuthorizedEffect(capsule, filesystemEffect({ adapter_input: { content_utf8: "different\n" } }), { repo_root: temp, receipt_root: receiptRoot });
  assert.equal(conflict.valid, false);
  assert(conflict.errors[0].includes("different effect request"));
  const compensated = await compensateAuthorizedEffect(capsule, filesystemEffect(), { repo_root: temp, receipt_root: receiptRoot });
  assert.equal(compensated.valid, true, compensated.errors?.join("; "));
  assert.equal(fs.readFileSync(path.join(temp, "src/a.mjs"), "utf8"), before);
  const compensationReplay = await compensateAuthorizedEffect(capsule, filesystemEffect(), { repo_root: temp, receipt_root: receiptRoot });
  assert.equal(compensationReplay.idempotent, true);
  assert(readEffectReceipt(receiptRoot, capsule, filesystemEffect()).compensation);
});

await check("concurrent duplicate effects cross one idempotency boundary", async () => {
  const capsule = baseCapsule("B", "src/b.mjs", "020-B");
  const effect = {
    capability_id: "write-B", principal: "executor", kind: "filesystem_write", target: "src/b.mjs",
    file_action: "MODIFY", idempotency_key: "edit-b-concurrently", adapter_id: "filesystem.write-file-v2",
    adapter_input: { content_utf8: "export const b = 2;\n" }
  };
  const receiptRoot = path.join(temp, "concurrent-effect-receipts");
  const results = await Promise.all([
    executeAuthorizedEffect(capsule, effect, { repo_root: temp, receipt_root: receiptRoot }),
    executeAuthorizedEffect(capsule, effect, { repo_root: temp, receipt_root: receiptRoot })
  ]);
  assert.equal(results.filter((result) => result.executed).length, 1);
  assert.equal(results.filter((result) => result.idempotent).length, 1);
  assert.equal(fs.readFileSync(path.join(temp, "src/b.mjs"), "utf8"), "export const b = 2;\n");
});

await check("tampered effect receipts cannot authorize idempotent reuse", async () => {
  const capsule = baseCapsule("TAMPER", "src/shared.mjs", "025-TAMPER");
  const effect = {
    capability_id: "write-TAMPER", principal: "executor", kind: "filesystem_write", target: "src/shared.mjs",
    file_action: "MODIFY", idempotency_key: "tamper-receipt", adapter_id: "filesystem.write-file-v2",
    adapter_input: { content_utf8: "export const shared = 2;\n" }
  };
  const options = { repo_root: temp, receipt_root: path.join(temp, "tampered-effect-receipts") };
  const first = await executeAuthorizedEffect(capsule, effect, options);
  assert.equal(first.valid, true, first.errors?.join("; "));
  const receipt = JSON.parse(fs.readFileSync(first.receipt_path, "utf8"));
  receipt.readback.sha256 = "0".repeat(64);
  fs.writeFileSync(first.receipt_path, `${JSON.stringify(receipt)}\n`);
  const replay = await executeAuthorizedEffect(capsule, effect, options);
  assert.equal(replay.valid, false);
  assert(replay.errors.some((error) => error.includes("integrity mismatch")));
});

await check("unknown or kind-confused adapters cannot reach execution", async () => {
  const capsule = baseCapsule();
  const before = fs.readFileSync(path.join(temp, "src/a.mjs"), "utf8");
  const unknown = await executeAuthorizedEffect(capsule, filesystemEffect({ adapter_id: "shell.eval-v1" }), { repo_root: temp, receipt_root: path.join(temp, "denied-effects") });
  assert.equal(unknown.valid, false);
  const confused = await executeAuthorizedEffect(capsule, filesystemEffect({ adapter_id: "network.fetch-v2" }), { repo_root: temp, receipt_root: path.join(temp, "denied-effects") });
  assert.equal(confused.valid, false);
  assert.equal(fs.readFileSync(path.join(temp, "src/a.mjs"), "utf8"), before);
  assert(!BUILT_IN_EFFECT_ADAPTER_IDS.some((adapter) => adapter.includes("shell") || adapter.includes("eval") || adapter.includes("argv")));
});

function deployCapsule() {
  const capsule = baseCapsule("DEPLOY", "src/c.mjs", "090-DEPLOY");
  capsule.effect_capabilities = [{
    id: "deploy-production", principal: "root", kind: "deploy", targets: ["https://deploy.example.test/releases"],
    max_cost_usd: 0, root_only: true, requires_idempotency: true, reversible: true
  }];
  capsule.resource_claims = [{ key: "effect:deploy:https://deploy.example.test/releases", mode: "exclusive" }];
  return capsule;
}

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async text() { return body; } };
}

await check("root-only deploy performs explicit readback and reversible compensation", async () => {
  const capsule = deployCapsule();
  const activeBody = JSON.stringify({ release: "sha-1", state: "active" });
  const priorBody = JSON.stringify({ release: "sha-0", state: "active" });
  const queue = [response(202, "accepted"), response(200, activeBody), response(202, "rollback-accepted"), response(200, priorBody)];
  const calls = [];
  const fetch = async (url, options) => { calls.push({ url, method: options.method, idempotency: options.headers["idempotency-key"] }); return queue.shift(); };
  const effect = {
    capability_id: "deploy-production", principal: "root", kind: "deploy", target: "https://deploy.example.test/releases",
    idempotency_key: "deploy-sha-1", adapter_id: "deploy.fetch-v2",
    adapter_input: { url: "https://deploy.example.test/releases", method: "POST", body: { sha: "sha-1" } },
    readback: { url: "https://deploy.example.test/releases/sha-1", expected: { status: 200, body_sha256: sha(activeBody) } },
    compensation: {
      request: { url: "https://deploy.example.test/releases/sha-1/rollback", method: "POST", idempotency_key: "deploy-sha-1:rollback", body: { to: "sha-0" } },
      readback: { url: "https://deploy.example.test/releases/current", expected: { status: 200, body_sha256: sha(priorBody) } }
    }
  };
  const receiptRoot = path.join(temp, "deploy-receipts");
  const executed = await executeAuthorizedEffect(capsule, effect, { repo_root: temp, receipt_root: receiptRoot, fetch });
  assert.equal(executed.valid, true, executed.errors?.join("; "));
  assert.equal(executed.receipt.status, "CONFIRMED");
  const compensated = await compensateAuthorizedEffect(capsule, effect, { repo_root: temp, receipt_root: receiptRoot, fetch });
  assert.equal(compensated.valid, true, compensated.errors?.join("; "));
  assert.equal(calls.length, 4);
  assert.deepEqual(calls.filter((call) => call.method === "POST").map((call) => call.idempotency), ["deploy-sha-1", "deploy-sha-1:rollback"]);
});

function externalRootCapsule(kind, capabilityId, target, taskId) {
  const capsule = baseCapsule(taskId, "src/c.mjs", `095-${taskId}`);
  capsule.effect_capabilities = [{
    id: capabilityId, principal: "root", kind, targets: [target], max_cost_usd: 0,
    root_only: true, requires_idempotency: true, reversible: true
  }];
  capsule.resource_claims = [{ key: `effect:${kind}:${target}`, mode: "exclusive" }];
  return capsule;
}

function validDeployEffect(idempotencyKey) {
  return {
    capability_id: "deploy-production", principal: "root", kind: "deploy", target: "https://deploy.example.test/releases",
    idempotency_key: idempotencyKey, adapter_id: "deploy.fetch-v2",
    adapter_input: { url: "https://deploy.example.test/releases", method: "POST" },
    readback: { url: "https://deploy.example.test/releases/current", expected: { status: 200 } },
    compensation: {
      request: { url: "https://deploy.example.test/releases/rollback", method: "POST", idempotency_key: `${idempotencyKey}:rollback` },
      readback: { url: "https://deploy.example.test/releases/current", expected: { status: 200 } }
    }
  };
}

await check("12 distinct adapter, authority and fail-closed cases cannot reach an external effect", async () => {
  const deploy = deployCapsule();
  const paid = externalRootCapsule("paid_write", "paid-production", "https://billing.example.test/charges", "PAID");
  const device = externalRootCapsule("device", "device-production", "android/device-01", "DEVICE");
  const cases = [];
  const addDeploy = (name, error, mutate) => {
    const effect = validDeployEffect(`denial-${cases.length}`);
    mutate(effect);
    cases.push({ name, error, capsule: deploy, effect });
  };
  addDeploy("unknown adapter", "unknown built-in effect adapter", (effect) => { effect.adapter_id = "deploy.unknown-v2"; });
  addDeploy("adapter kind confusion", "cannot execute deploy", (effect) => { effect.adapter_id = "provider.fetch-v2"; });
  addDeploy("root capability delegated to executor", "principal does not own capability", (effect) => { effect.principal = "executor"; });
  addDeploy("deploy target outside capability", "target is outside capability patterns", (effect) => { effect.target = "https://foreign.example.test/releases"; });
  addDeploy("missing deploy idempotency key", "idempotency_key is required", (effect) => { delete effect.idempotency_key; });
  addDeploy("deploy exceeds cost ceiling", "exceeds capability ceiling", (effect) => { effect.cost_usd = 1; });
  addDeploy("reversible deploy omits compensation", "requires compensation", (effect) => { delete effect.compensation; });
  addDeploy("compensation reuses forward idempotency key", "distinct idempotency_key", (effect) => { effect.compensation.request.idempotency_key = effect.idempotency_key; });
  addDeploy("adapter URL differs from authorized target", "URL must equal authorized target", (effect) => { effect.adapter_input.url = "https://deploy.example.test/other"; });
  addDeploy("readback crosses authorized origin", "must stay on the authorized target origin", (effect) => { effect.readback.url = "https://foreign.example.test/current"; });
  const paidEffect = {
    capability_id: "paid-production", principal: "executor", kind: "paid_write", target: "https://billing.example.test/charges",
    idempotency_key: "paid-denied", adapter_id: "paid.fetch-v2", adapter_input: { url: "https://billing.example.test/charges", method: "POST" }
  };
  cases.push({ name: "paid capability delegated to executor", error: "principal does not own capability", capsule: paid, effect: paidEffect });
  const deviceEffect = {
    capability_id: "device-production", principal: "root", kind: "device", target: "android/device-01",
    idempotency_key: "device-denied", adapter_id: "device.adb-v2"
  };
  cases.push({ name: "unsupported device adapter", error: "unknown built-in effect adapter", capsule: device, effect: deviceEffect });

  assert.equal(cases.length, 12);
  let externalCalls = 0;
  for (const [index, item] of cases.entries()) {
    const result = await executeAuthorizedEffect(item.capsule, item.effect, {
      repo_root: temp, receipt_root: path.join(temp, `denied-effect-${index}`),
      fetch: async () => { externalCalls += 1; return response(200, "{}"); }
    });
    assert.equal(result.valid, false, item.name);
    assert(result.errors.some((error) => error.includes(item.error)), `${item.name}: ${result.errors.join("; ")}`);
  }
  assert.equal(externalCalls, 0);
});

await check("3 independent stale lease authority dimensions produce zero heartbeats", () => {
  const storePath = path.join(temp, "leases-mutations.json");
  const acquired = claimTaskLease({ store_path: storePath, run_id: "run-mutations", capsule: baseCapsule(), principal_id: "worker-a", now: "2026-08-10T00:00:00.000Z", ttl_ms: 10_000 });
  const cases = [
    { name: "wrong principal", principal_id: "worker-b", generation: 1, lease_id: acquired.lease.lease_id, error: "principal_id does not own" },
    { name: "stale generation", principal_id: "worker-a", generation: 2, lease_id: acquired.lease.lease_id, error: "lease generation is stale" },
    { name: "wrong lease identity", principal_id: "worker-a", generation: 1, lease_id: "0".repeat(64), error: "lease_id does not own" }
  ];
  assert.equal(cases.length, 3);
  for (const [index, item] of cases.entries()) {
    const result = heartbeatTaskLease({
      store_path: storePath, run_id: "run-mutations", task_id: "A",
      principal_id: item.principal_id, generation: item.generation, lease_id: item.lease_id,
      now: `2026-08-10T00:00:00.00${index + 1}Z`
    });
    assert.equal(result.valid, false, item.name);
    assert(result.errors.some((error) => error.includes(item.error)), `${item.name}: ${result.errors.join("; ")}`);
  }
});

fs.rmSync(temp, { recursive: true, force: true });
if (process.exitCode) console.error(`runtime scheduler/effects v2: ${passed} passed, failures present`);
else console.log(`runtime scheduler/effects v2: ${passed} passed, 0 failed`);
