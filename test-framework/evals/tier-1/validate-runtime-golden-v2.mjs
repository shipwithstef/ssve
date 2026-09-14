#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileCapsule } from "../../../scripts/svc-execution-controller-v2.mjs";
import {
  compensateAuthorizedEffect,
  executeAuthorizedEffect,
  executeValidatorArgv
} from "../../../scripts/lib/runtime-effects-v2.mjs";
import {
  closeTaskLease,
  claimTaskLease
} from "../../../scripts/lib/runtime-scheduler-v2.mjs";
import {
  acknowledgeEvidenceConsumer,
  contentDigest,
  createConsumptionLedger,
  evaluateTaskContribution,
  recordEvidenceProduced
} from "../../../scripts/lib/runtime-evidence-consumption-v2.mjs";
import {
  appendRuntimeEvent,
  readRuntimeJournal,
  replayRuntimeJournal,
  runtimeStatus
} from "../../../scripts/svc-runtime-v2.mjs";

const fixturePath = fileURLToPath(new URL("../../fixtures/execution-controller-v2/golden-local-feature-v2.json", import.meta.url));
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const clone = (value) => JSON.parse(JSON.stringify(value));

function at(sequence) {
  return new Date(Date.parse(fixture.timestamps.started) + sequence * 1000).toISOString();
}

function pathsFor(stateRoot, runId) {
  const runDir = path.join(stateRoot, "runs", runId);
  fs.mkdirSync(runDir, { recursive: true });
  return {
    runDir,
    manifest: path.join(runDir, "manifest.json"),
    journal: path.join(runDir, "journal.jsonl"),
    journalLock: path.join(runDir, ".journal.lock"),
    projections: path.join(runDir, "projections")
  };
}

function writeCasEvidence(storeRoot, input) {
  const object = {
    schema_version: 2,
    kind: input.contract.kind,
    trust_level: "hermetic",
    subject: input.contract.id,
    producer_id: input.contract.producer_id,
    consumer_ids: input.contract.consumer_ids.map((consumer) => consumer.id),
    generation_bindings: fixture.generation_bindings,
    relevant_digests: {
      protocol_digest: input.protocolDigest,
      product_graph_digest: input.productGraphDigest,
      source_digest: input.contract.source_digest,
      "input:0": input.contract.invalidation_input_digests[0]
    },
    environment_identity: "local-golden-runtime",
    created_at: fixture.timestamps.evidence_produced,
    expires_at: null,
    payload: {
      artifact_id: input.contract.id,
      validator_receipt_digest: input.validatorReceipt.receipt_digest,
      feature_effect_receipt_digest: input.featureEffectReceipt.receipt_digest,
      runner_exit_code: input.validatorReceipt.exit_code,
      runner_passed: true
    },
    object_digest: ""
  };
  const unsigned = { ...object };
  delete unsigned.object_digest;
  object.object_digest = contentDigest(unsigned);
  const objectPath = path.join(storeRoot, "objects", "sha256", object.object_digest.slice(0, 2), `${object.object_digest}.json`);
  fs.mkdirSync(path.dirname(objectPath), { recursive: true });
  fs.writeFileSync(objectPath, `${JSON.stringify(object)}\n`, { mode: 0o600 });
  return object;
}

const workRoot = fs.mkdtempSync(path.join(os.tmpdir(), "svc-runtime-golden-v2-"));
const repositoryRoot = path.join(workRoot, "repository");
const stateRoot = path.join(workRoot, "state");
const receiptRoot = path.join(workRoot, "receipts");
const evidenceRoot = path.join(workRoot, "evidence-cas");
const leaseStore = path.join(workRoot, "leases", "golden.json");
fs.mkdirSync(repositoryRoot, { recursive: true });

try {
  assert.equal(fixture.schema_version, 2);
  assert.equal(fixture.simulation_only, true);
  assert.equal(fixture.expected.production_proof, false);

  const capsule = clone(fixture.capsule);
  capsule.validations[0].argv[0] = process.execPath;
  const compiled = compileCapsule(capsule);
  assert.equal(compiled.valid, true, compiled.errors?.join("; "));
  assert.deepEqual(capsule.generation_bindings, fixture.generation_bindings);

  const runtimePaths = pathsFor(stateRoot, fixture.run_id);
  let eventSequence = 0;
  const emittedTypes = [];
  function append(type, payload = {}, taskId = null) {
    eventSequence += 1;
    const result = appendRuntimeEvent(runtimePaths, {
      run_id: fixture.run_id,
      type,
      task_id: taskId,
      observed_at: at(eventSequence),
      idempotency_key: `golden:${eventSequence}:${type}`,
      generation_bindings: fixture.generation_bindings,
      payload
    });
    assert.equal(result.valid, true, result.errors?.join("; "));
    emittedTypes.push(type);
    return result;
  }

  append("RUN_COMPILED", {
    manifest_digest: sha("golden-runtime-manifest"),
    simulation_only: true
  });
  append("RUN_STARTED", { simulation_only: true });

  const lease = claimTaskLease({
    store_path: leaseStore,
    run_id: fixture.run_id,
    capsule,
    principal_id: "golden-runtime-runner",
    now: at(eventSequence + 1),
    ttl_ms: 30_000
  });
  assert.equal(lease.valid, true, lease.errors?.join("; "));
  assert.equal(fs.existsSync(leaseStore), true, "lease claim must be durable");
  append("TASK_LEASE_ACQUIRED", {
    lease_id: lease.lease.lease_id,
    generation: lease.lease.generation,
    store_revision: lease.store_revision
  }, capsule.task_id);
  append("TASK_DISPATCHED", {
    lease_id: lease.lease.lease_id,
    capsule_digest: compiled.capsule_digest
  }, capsule.task_id);

  append("EFFECT_AUTHORIZED", {
    capability_id: fixture.feature_effect.capability_id,
    idempotency_key: fixture.feature_effect.idempotency_key
  }, capsule.task_id);
  const featureEffect = await executeAuthorizedEffect(capsule, fixture.feature_effect, {
    repo_root: repositoryRoot,
    receipt_root: receiptRoot,
    started_at: at(eventSequence),
    finished_at: at(eventSequence + 1)
  });
  assert.equal(featureEffect.valid, true, featureEffect.errors?.join("; "));
  assert.equal(featureEffect.executed, true);
  assert.equal(featureEffect.receipt.status, "CONFIRMED");
  assert.equal(fs.readFileSync(path.join(repositoryRoot, "golden-output.txt"), "utf8"), "golden feature\n");
  append("EFFECT_EXECUTED", {
    receipt_digest: featureEffect.receipt.receipt_digest,
    readback: featureEffect.receipt.readback
  }, capsule.task_id);

  append("EFFECT_AUTHORIZED", {
    capability_id: fixture.rollback_probe_effect.capability_id,
    idempotency_key: fixture.rollback_probe_effect.idempotency_key,
    rollback_probe: true
  }, capsule.task_id);
  const rollbackProbe = await executeAuthorizedEffect(capsule, fixture.rollback_probe_effect, {
    repo_root: repositoryRoot,
    receipt_root: receiptRoot,
    started_at: at(eventSequence),
    finished_at: at(eventSequence + 1)
  });
  assert.equal(rollbackProbe.valid, true, rollbackProbe.errors?.join("; "));
  assert.equal(rollbackProbe.receipt.status, "CONFIRMED");
  assert.equal(fs.existsSync(path.join(repositoryRoot, "rollback-probe.txt")), true);
  append("EFFECT_EXECUTED", {
    receipt_digest: rollbackProbe.receipt.receipt_digest,
    rollback_probe: true
  }, capsule.task_id);
  const compensated = await compensateAuthorizedEffect(capsule, fixture.rollback_probe_effect, {
    repo_root: repositoryRoot,
    receipt_root: receiptRoot,
    compensated_at: at(eventSequence + 1)
  });
  assert.equal(compensated.valid, true, compensated.errors?.join("; "));
  assert.equal(compensated.compensated, true);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "rollback-probe.txt")), fixture.expected.rollback_probe_exists_after_compensation);
  append("EFFECT_COMPENSATED", {
    effect_receipt_digest: rollbackProbe.receipt.receipt_digest,
    compensation_receipt_digest: compensated.receipt.receipt_digest,
    rollback_probe: true
  }, capsule.task_id);

  append("VALIDATOR_STARTED", {
    validation_id: capsule.validations[0].id,
    argv: capsule.validations[0].argv
  }, capsule.task_id);
  const validator = executeValidatorArgv(capsule, capsule.validations[0].id, {
    cwd: repositoryRoot,
    started_at: at(eventSequence),
    finished_at: at(eventSequence + 1)
  });
  assert.equal(validator.valid, true, validator.errors?.join("; "));
  assert.equal(validator.passed, true, validator.receipt.stderr);
  assert.equal(validator.receipt.exit_code, 0);
  append("VALIDATOR_FINISHED", {
    validation_id: capsule.validations[0].id,
    passed: validator.passed,
    receipt_digest: validator.receipt.receipt_digest,
    exit_code: validator.receipt.exit_code
  }, capsule.task_id);

  const protocolDigest = sha("golden-protocol");
  const productGraphDigest = sha("golden-product-graph");
  const contract = fixture.evidence_contract;
  const createdLedger = createConsumptionLedger({
    run_id: fixture.run_id,
    generation_bindings: fixture.generation_bindings,
    protocol_digest: protocolDigest,
    product_graph_digest: productGraphDigest,
    artifact_contracts: [contract],
    invalidation_input_names: { [contract.id]: ["input:0"] },
    minimum_trust_levels: { [contract.id]: "hermetic" },
    producer_task_ids: { [contract.id]: capsule.task_id }
  });
  assert.equal(createdLedger.valid, true, createdLedger.errors?.join("; "));
  let ledger = createdLedger.ledger;
  const evidence = writeCasEvidence(evidenceRoot, {
    contract,
    protocolDigest,
    productGraphDigest,
    validatorReceipt: validator.receipt,
    featureEffectReceipt: featureEffect.receipt
  });
  const produced = recordEvidenceProduced(ledger, {
    artifact_id: contract.id,
    object_digest: evidence.object_digest,
    idempotency_key: contract.idempotency_key,
    produced_at: fixture.timestamps.evidence_produced
  }, { storeRoot: evidenceRoot });
  assert.equal(produced.valid, true, produced.errors?.join("; "));
  ledger = produced.ledger;
  append("EVIDENCE_PRODUCED", produced.event_payload, capsule.task_id);

  const consumer = contract.consumer_ids[0];
  const acknowledged = acknowledgeEvidenceConsumer(ledger, {
    artifact_id: contract.id,
    object_digest: evidence.object_digest,
    consumer_id: consumer.id,
    condition: consumer.condition,
    acknowledged_at: fixture.timestamps.evidence_consumed,
    idempotency_key: "ack-golden-task-acceptor"
  }, { storeRoot: evidenceRoot });
  assert.equal(acknowledged.valid, true, acknowledged.errors?.join("; "));
  ledger = acknowledged.ledger;
  assert.equal(ledger.artifacts[0].state, "CONSUMED");
  append("EVIDENCE_CONSUMED", acknowledged.event_payload, capsule.task_id);

  // These acceptance events are downstream of actual receipts and CAS resolution.
  assert.equal(featureEffect.receipt.status, "CONFIRMED");
  assert.equal(validator.passed, true);
  assert.equal(produced.object.object_digest, evidence.object_digest);
  assert.equal(acknowledged.event_payload.object_digest, evidence.object_digest);
  append("TASK_ACCEPTED", {
    derivation: "actual-runner-and-cas",
    validator_receipt_digest: validator.receipt.receipt_digest,
    effect_receipt_digest: featureEffect.receipt.receipt_digest,
    evidence_object_digest: evidence.object_digest,
    acknowledgement_digest: acknowledged.event_payload.acknowledgement_digest
  }, capsule.task_id);
  const contribution = evaluateTaskContribution(ledger, {
    task_status: "ACCEPTED",
    required_artifact_ids: [contract.id]
  }, { storeRoot: evidenceRoot });
  assert.equal(contribution.valid, true, contribution.errors?.join("; "));
  assert.equal(contribution.next_status, "CONSUMED");
  append("TASK_CONSUMED", {
    derivation: "named-consumer-acknowledgement",
    ledger_digest: ledger.ledger_digest,
    evidence_object_digest: evidence.object_digest
  }, capsule.task_id);

  const closedLease = closeTaskLease({
    store_path: leaseStore,
    run_id: fixture.run_id,
    task_id: capsule.task_id,
    lease_id: lease.lease.lease_id,
    principal_id: lease.lease.principal_id,
    generation: lease.lease.generation,
    status: "RELEASED",
    reason: "task-consumed",
    now: at(eventSequence + 1)
  });
  assert.equal(closedLease.valid, true, closedLease.errors?.join("; "));

  const candidateDigest = sha("golden-frozen-candidate");
  append("CANDIDATE_FROZEN", {
    candidate_digest: candidateDigest,
    capsule_digest: compiled.capsule_digest,
    validator_receipt_digest: validator.receipt.receipt_digest,
    ledger_digest: ledger.ledger_digest
  });
  const reviewReceiptDigest = sha("golden-final-review-receipt");
  append("FINAL_REVIEW_RECORDED", {
    receipt_type: "FINAL_REVIEW_PANEL",
    release_authorized: true,
    verdict: "PASS",
    review_kind: "exec",
    receipt_digest: reviewReceiptDigest,
    candidate_digest: candidateDigest,
    base_sha: "e".repeat(40),
    reviewer_family: "fixture",
    unowned_critical_high: 0,
    projection_kind: "golden-local-simulation",
    simulation_only: true,
    basis: [validator.receipt.receipt_digest, evidence.object_digest, ledger.ledger_digest]
  });
  append("FINAL_SHA_BOUND", { sha: "f".repeat(40), review_receipt_digest: reviewReceiptDigest, candidate_digest: candidateDigest, simulation_only: true });
  append("ROLLBACK_READY", {
    simulation_only: true,
    effect_receipt_digest: rollbackProbe.receipt.receipt_digest,
    rollback_receipt_digest: compensated.receipt.receipt_digest,
    compensation_receipt_digest: compensated.receipt.receipt_digest
  });
  append("RELEASE_STARTED", { adapter: "golden-simulator", simulation_only: true });
  append("PRODUCTION_RELEASED", {
    environment_identity: "local-golden-simulator",
    simulation_only: true,
    production_proof: false,
    effect_receipt_digest: featureEffect.receipt.receipt_digest,
    release_id: "simulated-golden-release"
  });
  append("LIVE_VERIFIED", {
    trust_level: "production",
    environment_identity: "local-golden-simulator",
    simulation_only: true,
    production_proof: false,
    effect_receipt_digest: validator.receipt.receipt_digest,
    evidence_object_digest: evidence.object_digest
  });
  append("OBSERVATION_SCHEDULED", {
    metric_id: "golden_runtime_completed",
    consumer_id: "golden-next-decision",
    window_starts_at: "2026-08-10T09:00:00.000Z",
    window_ends_at: "2026-08-10T10:00:00.000Z",
    observation_window: "immediate-simulation",
    simulation_only: true
  });
  append("OUTCOME_OBSERVED", {
    metric: "golden_runtime_completed",
    baseline: 0,
    observed: 1,
    delta: 1,
    simulation_only: true
  });
  append("NEXT_DECISION_RECORDED", {
    decision: "retain-golden-runtime-contract",
    simulation_only: true
  });

  assert.deepEqual(emittedTypes, fixture.journal_sequence);
  const replayed = replayRuntimeJournal(readRuntimeJournal(runtimePaths.journal), {
    run_id: fixture.run_id,
    generation_bindings: fixture.generation_bindings
  });
  assert.equal(replayed.valid, true, replayed.errors?.join("; "));
  assert.equal(replayed.state.status, fixture.expected.runtime_status);
  assert.equal(replayed.state.tasks[capsule.task_id].status, fixture.expected.task_status);
  assert.equal(replayed.state.live_verification.simulation_only, true);
  assert.equal(replayed.state.live_verification.production_proof, false);

  const manifest = {
    schema_version: 2,
    run_id: fixture.run_id,
    simulation_only: true,
    generation_bindings: fixture.generation_bindings,
    manifest_digest: sha("golden-runtime-manifest"),
    capsules: [capsule]
  };
  fs.writeFileSync(runtimePaths.manifest, `${JSON.stringify(manifest)}\n`, { mode: 0o600 });
  const status = runtimeStatus(runtimePaths);
  assert.equal(status.valid, true, status.errors?.join("; "));
  assert.deepEqual(status.completed, [capsule.task_id]);
  assert.deepEqual(status.accepted_not_consumed, []);
  assert.deepEqual(status.remaining, []);
  assert.equal(status.delivery_verified, false);
  assert.equal(status.outcome_decided, false);
  assert.equal(status.simulation_only, true);
  assert.equal(status.production_proven, false);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "golden-output.txt")), fixture.expected.feature_output_exists);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "rollback-probe.txt")), fixture.expected.rollback_probe_exists_after_compensation);

  process.stdout.write("PASS runtime golden v2: durable lease, runner, compensation, CAS consumption, journal, simulated release/live/observation\n");
} finally {
  fs.rmSync(workRoot, { recursive: true, force: true });
}
