#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendExecutionEvent,
  authorizeEffect,
  buildEvidenceObject,
  classifyFailure,
  compileCapsule,
  compileExecutionGraph,
  planExecutionWaves,
  projectExecutionStatus,
  putEvidenceObject,
  replayExecutionEvents,
  scheduleExecutionWave,
  selectValidations,
  verifyEvidenceObject
} from "../../../scripts/svc-execution-controller-v2.mjs";

let passed = 0;

const generationBindings = Object.freeze({
  protocol_generation_digest: "a".repeat(64),
  product_generation_digest: "b".repeat(64),
  context_generation_digest: "c".repeat(64),
  concern_generation_digest: "d".repeat(64),
  control_generation_digest: "e".repeat(64),
  authority_generation_digest: "f".repeat(64),
  layer_inventory_digest: "1".repeat(64)
});

function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`not ok ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

function row(id, timestamp = "2026-08-10T00:00:00.000Z") {
  return {
    id,
    evidence_fingerprint: "a".repeat(64),
    observed_at: timestamp
  };
}

function capsule() {
  return {
    schema_version: 2,
    wi: "WI-SAMPLE-REVENUE-ACTIVATION-01",
    task_id: "E1B1",
    product_outcome: "classify exact revenue activation candidates",
    generation_bindings: generationBindings,
    dependencies: [],
    merge_dependencies: [],
    interfaces: { provides: [], consumes: [] },
    revision: 22,
    plan_digest: "1".repeat(64),
    accepted_parent_sha: "829be5921a179661048b1b4382961f6f98c76914",
    allowed_files: [
      { path: "src/classifier.mjs", action: "MODIFY" },
      { path: "test/classifier.test.mjs", action: "MODIFY" }
    ],
    forbidden_writes: ["src/auth/**", "migrations/**"],
    decisions: [{ id: "one-winner-per-referral", status: "RESOLVED", source_digest: "2".repeat(64) }],
    authorities: [{ id: "subscription-owner-isolation", status: "RESOLVED", source_digest: "3".repeat(64) }],
    effect_capabilities: [
      {
        id: "edit-classifier",
        principal: "executor",
        kind: "filesystem_write",
        targets: ["src/classifier.mjs", "test/classifier.test.mjs"],
        max_cost_usd: 0,
        root_only: false,
        requires_idempotency: false,
        reversible: true
      },
      {
        id: "deploy-production",
        principal: "root",
        kind: "deploy",
        targets: ["production/example-marketplace"],
        max_cost_usd: 0,
        root_only: true,
        requires_idempotency: true,
        reversible: true
      }
    ],
    resource_claims: [
      { key: "repo:classifier", mode: "exclusive" },
      { key: "effect:deploy:production/example-marketplace", mode: "exclusive" }
    ],
    parallel_policy: {
      eligible: true,
      merge_order_key: "010-E1B1"
    },
    active_budget_seconds: 240,
    collections: {
      sources: [row("legacy"), row("subscription"), row("lightning"), row("deal")],
      candidates: [row("legacy"), row("subscription-a"), row("subscription-b"), row("lightning"), row("deal")],
      quarantine: [row("self"), row("unowned"), row("zero-fee"), row("dead"), row("ambiguous"), row("duplicate")]
    },
    collection_contracts: [
      {
        collection: "sources",
        exact_count: 4,
        exact_fields: ["id", "evidence_fingerprint", "observed_at"],
        unique_by: ["id"],
        formats: { evidence_fingerprint: "sha256", observed_at: "iso_timestamp" }
      },
      {
        collection: "candidates",
        exact_count: 5,
        exact_fields: ["id", "evidence_fingerprint", "observed_at"],
        unique_by: ["id"],
        formats: { evidence_fingerprint: "sha256", observed_at: "iso_timestamp" }
      },
      {
        collection: "quarantine",
        exact_count: 6,
        exact_fields: ["id", "evidence_fingerprint", "observed_at"],
        unique_by: ["id"],
        formats: { evidence_fingerprint: "sha256", observed_at: "iso_timestamp" }
      }
    ],
    relationships: [{ id: "classified-total", sum: ["candidates", "quarantine"], equals: 11 }],
    validations: [
      {
        id: "classifier-unit",
        argv: ["node", "--test", "test/classifier.test.mjs"],
        inputs: ["src/classifier.mjs", "test/classifier.test.mjs"],
        validator_digest: "4".repeat(64),
        environment_class: "hermetic",
        cost_class: "micro",
        required_at_freeze: true
      },
      {
        id: "authority-full",
        argv: ["node", "test/authority.mjs"],
        inputs: ["src/auth/**", "migrations/**"],
        validator_digest: "5".repeat(64),
        environment_class: "repository",
        cost_class: "full",
        required_at_freeze: true
      }
    ],
    failure_policy: {
      local_attempts: 2,
      assist_attempts: 1,
      plan_freeze_categories: ["PRODUCT_CONTRACT", "SECURITY_AUTHORITY"]
    }
  };
}

function failure(overrides = {}) {
  return {
    category: "FIXTURE",
    stage: "classification",
    command_id: "classifier-unit",
    exit_code: 3,
    causal_code: "READY_COUNT_MISMATCH",
    relevant_digest: "6".repeat(64),
    attempt: 1,
    ...overrides
  };
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-ecv2-"));
fs.mkdirSync(path.join(temp, "src"), { recursive: true });
fs.mkdirSync(path.join(temp, "test"), { recursive: true });
fs.writeFileSync(path.join(temp, "src/classifier.mjs"), "export const value = 1;\n");
fs.writeFileSync(path.join(temp, "test/classifier.test.mjs"), "// fixture\n");

check("valid Sample capsule compiles", () => {
  const result = compileCapsule(capsule());
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.match(result.capsule_digest, /^[a-f0-9]{64}$/);
});

check("4-source versus stale 5-source count fails before dispatch", () => {
  const input = capsule();
  input.collection_contracts[0].exact_count = 5;
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("sources count 4 != 5")));
});

check("ready row with stale extra field fails exact shape", () => {
  const input = capsule();
  input.collections.candidates[0].existing_activation = true;
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("candidates[0] fields")));
});

check("non-canonical timestamp fails inside capsule compiler", () => {
  const input = capsule();
  input.collections.candidates[0].observed_at = "2026-08-10 00:00:00Z";
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("canonical ISO timestamp")));
});

check("impossible calendar timestamp fails inside capsule compiler", () => {
  const input = capsule();
  input.collections.candidates[0].observed_at = "2026-99-99T00:00:00.000Z";
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("canonical ISO timestamp")));
});

check("candidate plus quarantine relationship is compiled", () => {
  const input = capsule();
  input.relationships[0].equals = 12;
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("sum 11 != 12")));
});

check("unresolved founder decision blocks execution", () => {
  const input = capsule();
  input.decisions[0].status = "OPEN";
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("decisions[0] is unresolved")));
});

check("path traversal is rejected", () => {
  const input = capsule();
  input.allowed_files[0].path = "../outside.mjs";
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("unsafe or non-concrete path")));
});

check("allowed and forbidden write overlap is rejected", () => {
  const input = capsule();
  input.forbidden_writes.push("src/classifier.mjs");
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("overlaps forbidden write")));
});

check("allowed file entries must be concrete rather than globbed", () => {
  const input = capsule();
  input.allowed_files[0].path = "src/**";
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("non-concrete")));
});

check("root-only effect kinds cannot be delegated to executor", () => {
  const input = capsule();
  input.effect_capabilities[1].principal = "executor";
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("must be root-only with root principal")));
});

check("external write capability requires idempotency", () => {
  const input = capsule();
  input.effect_capabilities[1].requires_idempotency = false;
  const result = compileCapsule(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("must require idempotency")));
});

check("parallel scheduling contract and external resource claims are mandatory", () => {
  const missingPolicy = capsule();
  delete missingPolicy.parallel_policy;
  assert(compileCapsule(missingPolicy).errors.some((error) => error.includes("parallel_policy")));

  const missingClaim = capsule();
  missingClaim.resource_claims = missingClaim.resource_claims.filter((claim) => !claim.key.startsWith("effect:deploy:"));
  const compiled = compileCapsule(missingClaim);
  assert.equal(compiled.valid, false);
  assert(compiled.errors.some((error) => error.includes("requires exclusive resource claim")));
});

check("executor filesystem write is authorized only inside exact allowlist", () => {
  const allowed = authorizeEffect(capsule(), {
    capability_id: "edit-classifier",
    principal: "executor",
    kind: "filesystem_write",
    target: "src/classifier.mjs",
    file_action: "MODIFY"
  });
  assert.equal(allowed.authorized, true, allowed.errors.join("; "));
  assert.match(allowed.effect_digest, /^[a-f0-9]{64}$/);

  const denied = authorizeEffect(capsule(), {
    capability_id: "edit-classifier",
    principal: "executor",
    kind: "filesystem_write",
    target: "src/unlisted.mjs",
    file_action: "MODIFY"
  });
  assert.equal(denied.authorized, false);
  assert(denied.errors.some((error) => error.includes("outside capability patterns")));
  assert(denied.errors.some((error) => error.includes("outside allowed_files")));
});

check("filesystem action cannot exceed capsule action", () => {
  const denied = authorizeEffect(capsule(), {
    capability_id: "edit-classifier",
    principal: "executor",
    kind: "filesystem_write",
    target: "src/classifier.mjs",
    file_action: "DELETE"
  });
  assert.equal(denied.authorized, false);
  assert(denied.errors.some((error) => error.includes("does not match allowed action MODIFY")));
});

check("root deploy requires exact target and idempotency key", () => {
  const missingKey = authorizeEffect(capsule(), {
    capability_id: "deploy-production",
    principal: "root",
    kind: "deploy",
    target: "production/example-marketplace"
  });
  assert.equal(missingKey.authorized, false);
  assert(missingKey.errors.includes("idempotency_key is required"));

  const allowed = authorizeEffect(capsule(), {
    capability_id: "deploy-production",
    principal: "root",
    kind: "deploy",
    target: "production/example-marketplace",
    idempotency_key: "release-sha-123"
  });
  assert.equal(allowed.authorized, true, allowed.errors.join("; "));
});

check("fixture attempts one and two stay executor-local", () => {
  assert.equal(classifyFailure(failure({ attempt: 1 })).route, "EXECUTOR_RETRY");
  assert.equal(classifyFailure(failure({ attempt: 2 })).route, "EXECUTOR_RETRY");
});

check("third mechanical attempt requests one assist, never plan repair", () => {
  const result = classifyFailure(failure({ attempt: 3 }));
  assert.equal(result.route, "ASSIST_REQUIRED");
  assert.equal(result.plan_impact, false);
  assert.equal(result.mutation_allowed, false);
});

check("authorized third mechanical attempt is bounded executor retry", () => {
  const result = classifyFailure(failure({ attempt: 3, assist_authorized: true }));
  assert.equal(result.route, "EXECUTOR_ASSIST_RETRY");
  assert.equal(result.mutation_allowed, true);
});

check("mechanical failure after used assist is terminal without plan freeze", () => {
  const result = classifyFailure(failure({ attempt: 4, assist_already_used: true }));
  assert.equal(result.route, "IMPLEMENTATION_TERMINAL");
  assert.equal(result.requires_product_authority, false);
});

check("product and security conflicts freeze immediately", () => {
  assert.equal(classifyFailure(failure({ category: "PRODUCT_CONTRACT" })).route, "PLAN_FROZEN");
  assert.equal(classifyFailure(failure({ category: "SECURITY_AUTHORITY" })).route, "PLAN_FROZEN");
});

check("assertion failure freezes only with signed-contract conflict", () => {
  assert.equal(classifyFailure(failure({ category: "ASSERTION_SEMANTICS" })).route, "EXECUTOR_RETRY");
  assert.equal(classifyFailure(failure({ category: "ASSERTION_SEMANTICS", signed_contract_conflict: true })).route, "PLAN_FROZEN");
});

check("failure fingerprint ignores log and timestamp noise", () => {
  const first = classifyFailure(failure({ stderr: "path /tmp/a at 10:00", observed_at: "one" }));
  const second = classifyFailure(failure({ stderr: "path /tmp/b at 11:00", observed_at: "two" }));
  assert.equal(first.failure_fingerprint, second.failure_fingerprint);
});

check("different causal code changes failure fingerprint", () => {
  const first = classifyFailure(failure());
  const second = classifyFailure(failure({ causal_code: "FIELD_ORDER_MISMATCH" }));
  assert.notEqual(first.failure_fingerprint, second.failure_fingerprint);
});

check("focused validation selects only changed dependency closure", () => {
  const result = selectValidations(capsule(), {
    changedPaths: ["src/classifier.mjs"],
    repoRoot: temp,
    environmentIdentity: "fixture"
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.selected.map((item) => item.id), ["classifier-unit"]);
  assert.equal(result.summary.run, 1);
  assert.equal(result.summary.skipped, 1);
});

check("exact PASS evidence is reused on focused rerun", () => {
  const first = selectValidations(capsule(), {
    changedPaths: ["src/classifier.mjs"],
    repoRoot: temp,
    environmentIdentity: "fixture"
  });
  const cache = { [first.selected[0].cache_key]: { status: "PASS" } };
  const second = selectValidations(capsule(), {
    changedPaths: ["src/classifier.mjs"],
    repoRoot: temp,
    environmentIdentity: "fixture",
    cacheIndex: cache
  });
  assert.equal(second.selected[0].action, "reuse");
  assert.equal(second.summary.reuse, 1);
});

check("validator version change invalidates cached PASS", () => {
  const input = capsule();
  const first = selectValidations(input, {
    changedPaths: ["src/classifier.mjs"],
    repoRoot: temp,
    environmentIdentity: "fixture"
  });
  const cache = { [first.selected[0].cache_key]: { status: "PASS" } };
  input.validations[0].validator_digest = "7".repeat(64);
  const second = selectValidations(input, {
    changedPaths: ["src/classifier.mjs"],
    repoRoot: temp,
    environmentIdentity: "fixture",
    cacheIndex: cache
  });
  assert.equal(second.selected[0].action, "run");
  assert.equal(second.selected[0].cache_hit, false);
});

check("freeze selects every validator and forces required validators to run", () => {
  const focused = selectValidations(capsule(), {
    changedPaths: ["src/classifier.mjs"],
    repoRoot: temp,
    environmentIdentity: "fixture"
  });
  const cache = { [focused.selected[0].cache_key]: { status: "PASS" } };
  const frozen = selectValidations(capsule(), {
    changedPaths: [],
    repoRoot: temp,
    environmentIdentity: "fixture",
    cacheIndex: cache,
    mode: "freeze"
  });
  assert.equal(frozen.selected.length, 2);
  assert(frozen.selected.every((item) => item.action === "run"));
});

const baseEvent = {
  run_id: "run-sample-e1b1",
  task_id: "E1B1.r22",
  generation_bindings: generationBindings,
  observed_at: "2026-08-10T00:00:00.000Z",
  payload: {}
};

function append(events, type, payload = {}, observedAt = baseEvent.observed_at) {
  const requiredPayloads = {
    RUN_CREATED: { capsule_digest: "8".repeat(64), plan_digest: "1".repeat(64) },
    TASK_STARTED: { attempt: 1 },
    STATIC_PASSED: { receipt_digest: "9".repeat(64) },
    RUNTIME_PASSED: { receipt_digest: "a".repeat(64) },
    CHECKPOINT_CREATED: { commit_sha: "b".repeat(40) },
    TASK_ACCEPTED: { acceptance_digest: "c".repeat(64) },
    ASSIST_AUTHORIZED: { authorization_digest: "d".repeat(64) },
    PLAN_AMENDED: { plan_digest: "e".repeat(64) },
    EXTERNAL_WAIT_STARTED: { resource: "external" },
    EXTERNAL_WAIT_ENDED: { resource: "external" },
    RUN_CANCELLED: { reason: "cancelled by test" }
  };
  const result = appendExecutionEvent(events, {
    ...baseEvent,
    type,
    payload: { ...(requiredPayloads[type] ?? {}), ...payload },
    observed_at: observedAt
  });
  assert.equal(result.valid, true, result.errors?.join("; "));
  return result.events;
}

check("event journal replays a complete accepted task deterministically", () => {
  let events = append([], "RUN_CREATED");
  events = append(events, "TASK_STARTED");
  events = append(events, "STATIC_PASSED");
  events = append(events, "RUNTIME_PASSED");
  events = append(events, "CHECKPOINT_CREATED");
  events = append(events, "TASK_ACCEPTED", { accepted_by: "root" });
  const first = replayExecutionEvents(events);
  const second = replayExecutionEvents(JSON.parse(JSON.stringify(events)));
  assert.equal(first.valid, true, first.errors?.join("; "));
  assert.equal(first.state.status, "ACCEPTED");
  assert.equal(first.event_chain_digest, second.event_chain_digest);
});

check("event hash chain rejects payload tampering", () => {
  let events = append([], "RUN_CREATED");
  events = append(events, "TASK_STARTED");
  events[1].payload.injected = true;
  const result = replayExecutionEvents(events);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("event_digest mismatch")));
});

check("illegal task-state transition fails closed", () => {
  let events = append([], "RUN_CREATED");
  const result = appendExecutionEvent(events, {
    ...baseEvent,
    type: "TASK_ACCEPTED",
    payload: { acceptance_digest: "c".repeat(64) }
  });
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("illegal transition")));
});

check("mechanical failure event returns same run to ready", () => {
  let events = append([], "RUN_CREATED");
  events = append(events, "TASK_STARTED");
  events = append(events, "FAILURE_RECORDED", {
    route: "EXECUTOR_RETRY",
    failure_fingerprint: "b".repeat(64)
  });
  const replayed = replayExecutionEvents(events);
  assert.equal(replayed.state.status, "READY");
  assert.equal(replayed.state.run_id, baseEvent.run_id);
});

check("plan-frozen event cannot resume without plan amendment", () => {
  let events = append([], "RUN_CREATED");
  events = append(events, "TASK_STARTED");
  events = append(events, "FAILURE_RECORDED", {
    route: "PLAN_FROZEN",
    failure_fingerprint: "c".repeat(64)
  });
  const denied = appendExecutionEvent(events, { ...baseEvent, type: "TASK_STARTED", payload: { attempt: 2 } });
  assert.equal(denied.valid, false);
  events = append(events, "PLAN_AMENDED");
  events = append(events, "TASK_STARTED");
  assert.equal(replayExecutionEvents(events).state.status, "RUNNING");
});

check("external wait preserves and restores exact prior state", () => {
  let events = append([], "RUN_CREATED");
  events = append(events, "TASK_STARTED");
  events = append(events, "STATIC_PASSED");
  events = append(events, "EXTERNAL_WAIT_STARTED", { resource: "provider" });
  assert.equal(replayExecutionEvents(events).state.status, "EXTERNAL_WAIT");
  events = append(events, "EXTERNAL_WAIT_ENDED", { resource: "provider" });
  assert.equal(replayExecutionEvents(events).state.status, "STATIC_GREEN");
});

function taskCapsules() {
  const first = capsule();
  const second = capsule();
  second.task_id = "E1B2";
  second.product_outcome = "apply classified activation candidates exactly once";
  second.dependencies = ["E1B1"];
  second.merge_dependencies = ["E1B1"];
  second.revision = 1;
  second.parallel_policy.merge_order_key = "020-E1B2";
  const third = capsule();
  third.task_id = "E2";
  third.product_outcome = "project accepted activation into Sample status";
  third.dependencies = ["E1B2"];
  third.merge_dependencies = ["E1B2"];
  third.revision = 1;
  third.parallel_policy.merge_order_key = "030-E2";
  return [first, second, third];
}

function schedulingCapsule(taskId, dependencies, file, resource, budget, mergeOrderKey) {
  const input = capsule();
  input.task_id = taskId;
  input.revision = 1;
  input.product_outcome = `deliver ${taskId}`;
  input.dependencies = dependencies;
  input.merge_dependencies = [...dependencies];
  input.allowed_files = [{ path: file, action: "MODIFY" }];
  input.effect_capabilities = [input.effect_capabilities[0]];
  input.effect_capabilities[0].targets = [file];
  input.resource_claims = [{ key: resource, mode: "exclusive" }];
  input.parallel_policy.merge_order_key = mergeOrderKey;
  input.active_budget_seconds = budget;
  return input;
}

function parallelGraph() {
  return [
    schedulingCapsule("A", [], "src/a.mjs", "repo:a", 60, "010-A"),
    schedulingCapsule("B", ["A"], "src/b.mjs", "repo:b", 120, "020-B"),
    schedulingCapsule("C", ["A"], "src/c.mjs", "repo:c", 120, "030-C"),
    schedulingCapsule("D", ["B", "C"], "src/d.mjs", "repo:d", 60, "040-D")
  ];
}

check("capsule graph rejects missing dependency and cycles", () => {
  const missing = taskCapsules();
  missing[1].dependencies = ["UNKNOWN"];
  const missingResult = compileExecutionGraph(missing);
  assert.equal(missingResult.valid, false);
  assert(missingResult.errors.some((error) => error.includes("missing dependency UNKNOWN")));

  const cyclic = taskCapsules();
  cyclic[0].dependencies = ["E2"];
  const cycleResult = compileExecutionGraph(cyclic);
  assert.equal(cycleResult.valid, false);
  assert(cycleResult.errors.some((error) => error.includes("dependency cycle")));
});

check("capsule graph rejects ambiguous merge order", () => {
  const input = parallelGraph();
  input[2].parallel_policy.merge_order_key = input[1].parallel_policy.merge_order_key;
  const result = compileExecutionGraph(input);
  assert.equal(result.valid, false);
  assert(result.errors.includes("parallel_policy.merge_order_key must be unique across the graph"));
});

check("frozen interface allows parallel execution but enforces producer-first merge", () => {
  const producer = schedulingCapsule("E2", [], "src/e2.mjs", "repo:e2", 120, "020-E2");
  producer.interfaces.provides = [{ id: "sample-revenue-facts-v1", digest: "7".repeat(64) }];
  const consumer = schedulingCapsule("E3", [], "src/e3.mjs", "repo:e3", 120, "030-E3");
  consumer.merge_dependencies = ["E2"];
  consumer.interfaces.consumes = [{ id: "sample-revenue-facts-v1", digest: "7".repeat(64), producer_task_id: "E2" }];
  const graphResult = compileExecutionGraph([consumer, producer]);
  assert.equal(graphResult.valid, true, graphResult.errors?.join("; "));
  assert.deepEqual(graphResult.merge_task_order, ["E2", "E3"]);
  const schedule = planExecutionWaves([consumer, producer], { max_parallel: 2, global_active_budget_seconds: 120 });
  assert.equal(schedule.valid, true, schedule.errors?.join("; "));
  assert.deepEqual(schedule.schedule.map((entry) => [entry.task_id, entry.start_offset_seconds]), [["E2", 0], ["E3", 0]]);
  assert.deepEqual(schedule.deterministic_merge_order, ["E2", "E3"]);
});

check("interface mismatch and missing merge dependency fail before dispatch", () => {
  const producer = schedulingCapsule("E2", [], "src/e2.mjs", "repo:e2", 120, "020-E2");
  producer.interfaces.provides = [{ id: "sample-revenue-facts-v1", digest: "7".repeat(64) }];
  const consumer = schedulingCapsule("E3", [], "src/e3.mjs", "repo:e3", 120, "030-E3");
  consumer.interfaces.consumes = [{ id: "sample-revenue-facts-v1", digest: "8".repeat(64), producer_task_id: "E2" }];
  let result = compileExecutionGraph([producer, consumer]);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("must be a merge dependency")));
  consumer.merge_dependencies = ["E2"];
  result = compileExecutionGraph([producer, consumer]);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("digest mismatch")));
});

check("parallel planner compresses independent feature work inside active budget", () => {
  const result = planExecutionWaves(parallelGraph(), { max_parallel: 4, global_active_budget_seconds: 240 });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.predicted_active_wall_seconds, 240);
  assert.equal(result.sequential_active_seconds, 360);
  assert.equal(result.predicted_speedup, 1.5);
  assert.equal(result.deadline_feasible, true);
  const starts = Object.fromEntries(result.schedule.map((entry) => [entry.task_id, entry.start_offset_seconds]));
  assert.deepEqual(starts, { A: 0, B: 60, C: 60, D: 180 });
});

check("parallel planner reports an honest deadline deficit", () => {
  const result = planExecutionWaves(parallelGraph(), { max_parallel: 4, global_active_budget_seconds: 180 });
  assert.equal(result.valid, true);
  assert.equal(result.deadline_feasible, false);
  assert.equal(result.budget_deficit_seconds, 60);
});

check("parallel planner serial fallback preserves truth and exposes cost", () => {
  const result = planExecutionWaves(parallelGraph(), { max_parallel: 1, global_active_budget_seconds: 360 });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.predicted_active_wall_seconds, 360);
  assert.equal(result.predicted_speedup, 1);
});

check("runtime wave selects independent tasks and deterministic merge order", () => {
  const input = [
    schedulingCapsule("B", [], "src/b.mjs", "repo:b", 120, "020-B"),
    schedulingCapsule("C", [], "src/c.mjs", "repo:c", 90, "030-C")
  ];
  const result = scheduleExecutionWave(input, {}, { max_parallel: 4, global_active_budget_seconds: 120 });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.deepEqual(result.selected_task_ids, ["B", "C"]);
  assert.deepEqual(result.deterministic_merge_order, ["B", "C"]);
  assert.equal(result.deadline_feasible, true);
});

check("runtime wave serializes resource and write conflicts", () => {
  const input = [
    schedulingCapsule("B", [], "src/shared.mjs", "repo:shared", 120, "020-B"),
    schedulingCapsule("C", [], "src/c.mjs", "repo:shared", 90, "030-C")
  ];
  let result = scheduleExecutionWave(input, {}, { max_parallel: 4 });
  assert.deepEqual(result.selected_task_ids, ["B"]);
  assert(result.deferred[0].reason.includes("resource:repo:shared"));

  input[1].resource_claims[0].key = "repo:c";
  input[1].allowed_files[0].path = "src/shared.mjs";
  input[1].effect_capabilities[0].targets = ["src/shared.mjs"];
  result = scheduleExecutionWave(input, {}, { max_parallel: 4 });
  assert.deepEqual(result.selected_task_ids, ["B"]);
  assert(result.deferred[0].reason.includes("write:src/shared.mjs"));
});

check("nonparallel task records why it monopolizes a wave", () => {
  const input = [
    schedulingCapsule("B", [], "src/b.mjs", "repo:b", 120, "020-B"),
    schedulingCapsule("C", [], "src/c.mjs", "repo:c", 90, "030-C")
  ];
  input[0].parallel_policy = { eligible: false, merge_order_key: "020-B", serialization_reason: "irreversible-migration-freeze" };
  const result = scheduleExecutionWave(input, {}, { max_parallel: 4 });
  assert.deepEqual(result.selected_task_ids, ["B"]);
  assert.equal(result.deferred[0].reason, "serial-peer:B");
});

function permutations(values) {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) => permutations(values.filter((_, candidate) => candidate !== index)).map((suffix) => [value, ...suffix]));
}

check("all 24 distinct graph input permutations keep one deterministic parallel schedule", () => {
  const baseline = planExecutionWaves(parallelGraph(), { max_parallel: 4 });
  const expected = JSON.stringify(baseline.schedule);
  let drift = 0;
  const byId = new Map(parallelGraph().map((capsule) => [capsule.task_id, capsule]));
  const orders = permutations([...byId.keys()]);
  assert.equal(orders.length, 24);
  assert.equal(new Set(orders.map((order) => order.join(","))).size, 24);
  for (const order of orders) {
    const input = order.map((taskId) => structuredClone(byId.get(taskId)));
    const result = planExecutionWaves(input, { max_parallel: 4 });
    if (!result.valid || JSON.stringify(result.schedule) !== expected) drift += 1;
  }
  assert.equal(drift, 0);
});

check("operator status reports exact completed, ready, blocked and remaining work", () => {
  let acceptedEvents = append([], "RUN_CREATED");
  acceptedEvents = append(acceptedEvents, "TASK_STARTED");
  acceptedEvents = append(acceptedEvents, "STATIC_PASSED");
  acceptedEvents = append(acceptedEvents, "RUNTIME_PASSED");
  acceptedEvents = append(acceptedEvents, "CHECKPOINT_CREATED");
  acceptedEvents = append(acceptedEvents, "TASK_ACCEPTED");
  const result = projectExecutionStatus(taskCapsules(), { E1B1: acceptedEvents });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.deepEqual(result.completed_task_ids, ["E1B1"]);
  assert.deepEqual(result.ready_task_ids, ["E1B2"]);
  assert.deepEqual(result.remaining_task_ids, ["E1B2", "E2"]);
  assert.equal(result.tasks.find((task) => task.task_id === "E2").status, "BLOCKED");
  assert.equal(result.next_permitted_task_id, "E1B2");
  assert.deepEqual(result.summary, {
    total: 3,
    completed: 1,
    remaining: 2,
    progress_percent: 33.33,
    remaining_active_budget_seconds: 480
  });
});

check("operator status exposes causal plan blocker", () => {
  let events = append([], "RUN_CREATED");
  events = append(events, "TASK_STARTED");
  events = append(events, "FAILURE_RECORDED", {
    route: "PLAN_FROZEN",
    failure_fingerprint: "f".repeat(64)
  });
  const result = projectExecutionStatus(taskCapsules(), { E1B1: events });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.blockers.length, 1);
  assert.equal(result.blockers[0].task_id, "E1B1");
  assert.equal(result.blockers[0].status, "PLAN_FROZEN");
  assert.equal(result.next_permitted_task_id, "E1B1");
});

check("event time cannot move backwards", () => {
  let result = appendExecutionEvent([], {
    ...baseEvent,
    type: "RUN_CREATED",
    observed_at: "2026-08-10T00:00:01.000Z",
    payload: { capsule_digest: "8".repeat(64), plan_digest: "1".repeat(64) }
  });
  assert.equal(result.valid, true, result.errors?.join("; "));
  result = appendExecutionEvent(result.events, {
    ...baseEvent,
    type: "TASK_STARTED",
    observed_at: "2026-08-10T00:00:00.000Z",
    payload: { attempt: 1 }
  });
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("moved backwards")));
});

check("append-event rejects non-array history", () => {
  const result = appendExecutionEvent({}, { ...baseEvent, type: "RUN_CREATED" });
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors, ["events must be an array"]);
});

check("CLI compile and replay use one bounded JSON result", () => {
  const script = path.resolve(import.meta.dirname, "../../../scripts/svc-execution-controller-v2.mjs");
  const capsulePath = path.join(temp, "capsule.json");
  fs.writeFileSync(capsulePath, `${JSON.stringify(capsule())}\n`);
  const compiled = spawnSync(process.execPath, [script, "compile", "--capsule", capsulePath], { encoding: "utf8" });
  assert.equal(compiled.status, 0, compiled.stderr);
  assert.equal(compiled.stderr, "");
  assert.equal(JSON.parse(compiled.stdout).valid, true);

  let events = append([], "RUN_CREATED");
  const eventsPath = path.join(temp, "events.json");
  fs.writeFileSync(eventsPath, `${JSON.stringify(events)}\n`);
  const replayed = spawnSync(process.execPath, [script, "replay-events", "--input", eventsPath], { encoding: "utf8" });
  assert.equal(replayed.status, 0, replayed.stderr);
  assert.equal(JSON.parse(replayed.stdout).state.status, "READY");
});

check("8 distinct scope and authority denial cases produce zero bypasses", () => {
  const cases = [
    {
      name: "filesystem target outside capability and allowlist",
      effect: {
        capability_id: "edit-classifier",
        principal: "executor",
        kind: "filesystem_write",
        target: "src/unlisted.mjs",
        file_action: "MODIFY"
      },
      error: "outside capability patterns"
    },
    {
      name: "capability principal mismatch",
      effect: {
        capability_id: "edit-classifier",
        principal: "root",
        kind: "filesystem_write",
        target: "src/classifier.mjs",
        file_action: "MODIFY"
      },
      error: "principal does not own capability"
    },
    {
      name: "deploy target outside capability",
      effect: {
        capability_id: "deploy-production",
        principal: "root",
        kind: "deploy",
        target: "production/foreign",
        idempotency_key: "foreign-release"
      },
      error: "target is outside capability patterns"
    },
    {
      name: "deploy cost above capability ceiling",
      effect: {
        capability_id: "deploy-production",
        principal: "root",
        kind: "deploy",
        target: "production/example-marketplace",
        idempotency_key: "costly-release",
        cost_usd: 1
      },
      error: "exceeds capability ceiling"
    },
    {
      name: "unknown capability",
      effect: {
        capability_id: "missing-capability", principal: "executor", kind: "filesystem_write",
        target: "src/classifier.mjs", file_action: "MODIFY"
      },
      error: "unknown capability"
    },
    {
      name: "effect kind differs from capability",
      effect: {
        capability_id: "edit-classifier", principal: "executor", kind: "filesystem_read",
        target: "src/classifier.mjs"
      },
      error: "effect kind does not match capability"
    },
    {
      name: "deploy omits required idempotency key",
      effect: {
        capability_id: "deploy-production", principal: "root", kind: "deploy",
        target: "production/example-marketplace"
      },
      error: "idempotency_key is required"
    },
    {
      name: "filesystem action exceeds capsule action",
      effect: {
        capability_id: "edit-classifier", principal: "executor", kind: "filesystem_write",
        target: "src/classifier.mjs", file_action: "DELETE"
      },
      error: "does not match allowed action"
    }
  ];
  assert.equal(cases.length, 8);
  for (const item of cases) {
    const result = authorizeEffect(capsule(), item.effect);
    assert.equal(result.authorized, false, item.name);
    assert(result.errors.some((error) => error.includes(item.error)), `${item.name}: ${result.errors.join("; ")}`);
  }
});

check("3 independent stale-proof dimensions produce zero false cache accepts", () => {
  const originalSource = fs.readFileSync(path.join(temp, "src/classifier.mjs"), "utf8");
  const cases = [
    {
      name: "environment identity changed",
      mutate(input) { return { input, environmentIdentity: "fixture-node-upgraded" }; }
    },
    {
      name: "validator digest changed",
      mutate(input) { input.validations[0].validator_digest = "7".repeat(64); return { input, environmentIdentity: "fixture" }; }
    },
    {
      name: "validator input content changed",
      mutate(input) { fs.writeFileSync(path.join(temp, "src/classifier.mjs"), "export const value = 2;\n"); return { input, environmentIdentity: "fixture" }; }
    }
  ];
  assert.equal(cases.length, 3);
  for (const item of cases) {
    const input = capsule();
    const baseline = selectValidations(input, {
      changedPaths: ["src/classifier.mjs"],
      repoRoot: temp,
      environmentIdentity: "fixture"
    });
    const cache = { [baseline.selected[0].cache_key]: { status: "PASS" } };
    const mutated = item.mutate(input);
    const selected = selectValidations(input, {
      changedPaths: ["src/classifier.mjs"],
      repoRoot: temp,
      environmentIdentity: mutated.environmentIdentity,
      cacheIndex: cache
    });
    assert.equal(selected.selected[0].action, "run", item.name);
    fs.writeFileSync(path.join(temp, "src/classifier.mjs"), originalSource);
  }
});

function evidence() {
  return {
    kind: "validation-receipt",
    trust_level: "hermetic",
    subject: "WI-SAMPLE/E1B1/classifier-unit",
    producer_id: "validator:classifier-unit",
    consumer_ids: ["task-acceptance:E1B1", "final-review"],
    generation_bindings: generationBindings,
    relevant_digests: {
      capsule: "d".repeat(64),
      validator: "e".repeat(64)
    },
    environment_identity: "node-v24-linux-fixture",
    created_at: "2026-08-10T00:00:00.000Z",
    expires_at: "2026-08-11T00:00:00.000Z",
    payload: { command: ["node", "--test"], exit_code: 0, result: "39 passed" }
  };
}

check("evidence builder rejects malformed relevant digest", () => {
  const input = evidence();
  input.relevant_digests.validator = "not-a-digest";
  const result = buildEvidenceObject(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("must be lowercase sha256")));
});

check("content-addressed evidence round-trips with integrity", () => {
  const store = path.join(temp, "evidence-store");
  const put = putEvidenceObject(store, evidence());
  assert.equal(put.valid, true, put.errors?.join("; "));
  assert.equal(put.stored, true);
  assert.match(put.object.object_digest, /^[a-f0-9]{64}$/);
  const verified = verifyEvidenceObject(store, put.object.object_digest, {
    at_time: "2026-08-10T01:00:00.000Z"
  });
  assert.equal(verified.valid, true, verified.errors?.join("; "));
  assert.equal(verified.reusable, true);
  assert.equal(verified.object.payload.exit_code, 0);
});

check("putting identical evidence is idempotent", () => {
  const store = path.join(temp, "idempotent-store");
  const first = putEvidenceObject(store, evidence());
  const second = putEvidenceObject(store, evidence());
  assert.equal(first.valid, true);
  assert.equal(first.stored, true);
  assert.equal(second.valid, true);
  assert.equal(second.stored, false);
  assert.equal(first.object.object_digest, second.object.object_digest);
});

check("expired evidence remains integral but cannot be reused", () => {
  const store = path.join(temp, "expiry-store");
  const put = putEvidenceObject(store, evidence());
  const verified = verifyEvidenceObject(store, put.object.object_digest, {
    at_time: "2026-08-12T00:00:00.000Z"
  });
  assert.equal(verified.valid, true);
  assert.equal(verified.expired, true);
  assert.equal(verified.reusable, false);
});

check("tampered evidence object fails closed", () => {
  const store = path.join(temp, "tamper-store");
  const put = putEvidenceObject(store, evidence());
  const stored = JSON.parse(fs.readFileSync(put.object_path, "utf8"));
  stored.payload.exit_code = 1;
  fs.writeFileSync(put.object_path, `${JSON.stringify(stored)}\n`);
  const verified = verifyEvidenceObject(store, put.object.object_digest, {
    at_time: "2026-08-10T01:00:00.000Z"
  });
  assert.equal(verified.valid, false);
  assert.equal(verified.reusable, false);
  assert(verified.errors.includes("stored object integrity mismatch"));
});

fs.rmSync(temp, { recursive: true, force: true });

if (process.exitCode) {
  console.error(`execution controller v2: ${passed} passed, failures present`);
} else {
  console.log(`execution controller v2: ${passed} passed, 0 failed`);
}
