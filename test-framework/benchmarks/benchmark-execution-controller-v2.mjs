#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  compileCapsule,
  selectValidations
} from "../../scripts/svc-execution-controller-v2.mjs";
import { executeValidatorArgv } from "../../scripts/lib/runtime-effects-v2.mjs";
import { claimTaskLease } from "../../scripts/lib/runtime-scheduler-v2.mjs";
import {
  appendRuntimeEvent,
  readRuntimeJournal,
  replayRuntimeJournal
} from "../../scripts/svc-runtime-v2.mjs";

const fileCount = 4000;
const validatorCount = 200;
const warmupIterations = 2;
const iterations = 20;
const nativeGateMs = 2000;
const optimizationWatchMs = 100;
const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), "svc-ecv2-benchmark-"));

const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function distribution(values) {
  return {
    p50: Number(percentile(values, 0.5).toFixed(3)),
    p95: Number(percentile(values, 0.95).toFixed(3))
  };
}

function benchmarkPaths(root, runId) {
  const runDir = path.join(root, "runtime", "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  return {
    runDir,
    manifest: path.join(runDir, "manifest.json"),
    journal: path.join(runDir, "journal.jsonl"),
    journalLock: path.join(runDir, ".journal.lock"),
    projections: path.join(runDir, "projections")
  };
}

try {
  const allowedFiles = [];
  for (let index = 0; index < fileCount; index += 1) {
    const shard = String(index % validatorCount).padStart(3, "0");
    const relative = `src/shard-${shard}/file-${String(index).padStart(4, "0")}.mjs`;
    const absolute = path.join(repoRoot, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `export const value = ${index};\n`);
    allowedFiles.push({ path: relative, action: "MODIFY" });
  }

  const validations = Array.from({ length: validatorCount }, (_, index) => {
    const shard = String(index).padStart(3, "0");
    return {
      id: `validator-${shard}`,
      argv: index === 0 ? [process.execPath, "-e", "process.exit(0)"] : [process.execPath, "--version"],
      inputs: [`src/shard-${shard}/**`],
      validator_digest: sha(`validator:${index}`),
      environment_class: "hermetic",
      cost_class: "micro",
      required_at_freeze: true
    };
  });

  const generationBindings = {
    protocol_generation_digest: sha("protocol-generation"),
    product_generation_digest: sha("product-generation"),
    context_generation_digest: sha("context-generation"),
    concern_generation_digest: sha("concern-generation"),
    control_generation_digest: sha("control-generation"),
    authority_generation_digest: sha("authority-generation"),
    layer_inventory_digest: sha("layer-inventory")
  };
  const capsule = {
    schema_version: 2,
    wi: "WI-ECV2-BENCHMARK",
    task_id: "graph-4000",
    product_outcome: "benchmark affected graph selection",
    generation_bindings: generationBindings,
    dependencies: [],
    merge_dependencies: [],
    interfaces: { provides: [], consumes: [] },
    revision: 1,
    plan_digest: "1".repeat(64),
    accepted_parent_sha: "0".repeat(40),
    allowed_files: allowedFiles,
    forbidden_writes: ["production/**"],
    decisions: [{ id: "benchmark", status: "RESOLVED", source_digest: "2".repeat(64) }],
    authorities: [{ id: "local-only", status: "RESOLVED", source_digest: "3".repeat(64) }],
    effect_capabilities: [{
      id: "benchmark-read",
      principal: "executor",
      kind: "filesystem_read",
      targets: ["src/**"],
      max_cost_usd: 0,
      root_only: false,
      requires_idempotency: false,
      reversible: true
    }],
    resource_claims: [{ key: "repo:benchmark", mode: "shared" }],
    parallel_policy: { eligible: true, merge_order_key: "010-graph-4000" },
    active_budget_seconds: 5,
    validations,
    failure_policy: {
      local_attempts: 2,
      assist_attempts: 1,
      plan_freeze_categories: ["PRODUCT_CONTRACT", "SECURITY_AUTHORITY"]
    }
  };
  const changedPaths = Array.from({ length: 20 }, (_, index) => allowedFiles[index * 199].path);
  const runtimePaths = benchmarkPaths(repoRoot, "benchmark-replay");
  for (const event of [
    { type: "RUN_COMPILED", key: "compile", payload: { manifest_digest: sha("manifest") } },
    { type: "RUN_STARTED", key: "start", payload: {} }
  ]) {
    const appended = appendRuntimeEvent(runtimePaths, {
      run_id: "benchmark-replay",
      type: event.type,
      idempotency_key: event.key,
      observed_at: "2026-08-10T08:00:00.000Z",
      generation_bindings: generationBindings,
      payload: event.payload
    });
    assert.equal(appended.valid, true, appended.errors?.join("; "));
  }
  const replayEvents = readRuntimeJournal(runtimePaths.journal);

  const measurements = {
    compile: [],
    affected_selection: [],
    durable_scheduler_claim: [],
    argv_dispatch: [],
    runtime_journal_replay: [],
    full_freeze_selection: []
  };

  for (let iteration = 0; iteration < warmupIterations + iterations; iteration += 1) {
    let started = performance.now();
    const compiled = compileCapsule(capsule);
    const compileDuration = performance.now() - started;
    assert.equal(compiled.valid, true, compiled.errors?.join("; "));

    started = performance.now();
    const selected = selectValidations(capsule, {
      changedPaths,
      repoRoot,
      environmentIdentity: "node-benchmark",
      mode: "focused"
    });
    const selectionDuration = performance.now() - started;
    assert.equal(selected.valid, true, selected.errors?.join("; "));
    assert.equal(selected.summary.run, 20);
    assert.equal(selected.summary.skipped, 180);

    const leaseStore = path.join(repoRoot, "leases", `iteration-${iteration}.json`);
    started = performance.now();
    const claimed = claimTaskLease({
      store_path: leaseStore,
      run_id: `benchmark-${iteration}`,
      capsule,
      principal_id: "benchmark-runner",
      now: "2026-08-10T08:00:00.000Z",
      ttl_ms: 30_000
    });
    const claimDuration = performance.now() - started;
    assert.equal(claimed.valid, true, claimed.errors?.join("; "));
    assert.equal(fs.existsSync(leaseStore), true, "claim must be durable before it returns");

    started = performance.now();
    const dispatched = executeValidatorArgv(capsule, "validator-000", {
      cwd: repoRoot,
      started_at: "2026-08-10T08:00:00.000Z",
      finished_at: "2026-08-10T08:00:01.000Z"
    });
    const dispatchDuration = performance.now() - started;
    assert.equal(dispatched.valid, true, dispatched.errors?.join("; "));
    assert.equal(dispatched.passed, true, dispatched.receipt?.stderr);
    assert.equal(dispatched.receipt.argv[0], process.execPath);

    started = performance.now();
    const replayed = replayRuntimeJournal(replayEvents, {
      run_id: "benchmark-replay",
      generation_bindings: generationBindings
    });
    const replayDuration = performance.now() - started;
    assert.equal(replayed.valid, true, replayed.errors?.join("; "));
    assert.equal(replayed.state.status, "RUNNING");

    started = performance.now();
    const frozen = selectValidations(capsule, {
      changedPaths: [],
      repoRoot,
      environmentIdentity: "node-benchmark",
      mode: "freeze"
    });
    const freezeDuration = performance.now() - started;
    assert.equal(frozen.valid, true, frozen.errors?.join("; "));
    assert.equal(frozen.summary.run, validatorCount);
    assert.equal(frozen.summary.reuse, 0);
    assert.equal(frozen.summary.skipped, 0);

    if (iteration >= warmupIterations) {
      measurements.compile.push(compileDuration);
      measurements.affected_selection.push(selectionDuration);
      measurements.durable_scheduler_claim.push(claimDuration);
      measurements.argv_dispatch.push(dispatchDuration);
      measurements.runtime_journal_replay.push(replayDuration);
      measurements.full_freeze_selection.push(freezeDuration);
    }
  }

  const operations = Object.fromEntries(Object.entries(measurements).map(([name, values]) => [name, distribution(values)]));
  const nativeCandidates = Object.entries(operations).filter(([, values]) => values.p95 > nativeGateMs).map(([name]) => name);
  const optimizationCandidates = Object.entries(operations).filter(([, values]) => values.p95 > optimizationWatchMs).map(([name]) => name);
  const result = {
    valid: nativeCandidates.length === 0,
    runtime: process.version,
    files: fileCount,
    validators: validatorCount,
    changed_paths: changedPaths.length,
    warmup_iterations: warmupIterations,
    iterations,
    operations,
    compile_ms: { median: operations.compile.p50, ...operations.compile },
    affected_selection_ms: { median: operations.affected_selection.p50, ...operations.affected_selection },
    native_gate: {
      threshold_ms: nativeGateMs,
      decision: nativeCandidates.length === 0 ? "STAY_NODE" : "NATIVE_REWRITE_REQUIRED",
      violating_operations: nativeCandidates
    },
    optimization_watch_ms: optimizationWatchMs,
    optimization_watch_triggered: optimizationCandidates.length > 0,
    optimization_watch_operations: optimizationCandidates,
    native_rewrite_candidate: nativeCandidates.length > 0
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.valid) process.exitCode = 1;
} finally {
  fs.rmSync(repoRoot, { recursive: true, force: true });
}
