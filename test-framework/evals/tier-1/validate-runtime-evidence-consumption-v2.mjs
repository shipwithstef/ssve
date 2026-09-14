#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acknowledgeEvidenceConsumer,
  applyEvidenceGarbageCollection,
  calculateLedgerDigest,
  contentDigest,
  createConsumptionLedger,
  evaluateCausalProgress,
  evaluateConsumptionCloseout,
  evaluateTaskContribution,
  invalidateEvidenceArtifact,
  planEvidenceGarbageCollection,
  readCasEvidence,
  recordCausalProgress,
  recordEvidenceProduced,
  resolveEvidenceForConsumer,
  validateConsumptionLedger
} from "../../../scripts/lib/runtime-evidence-consumption-v2.mjs";

const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const CREATED = "2026-08-10T08:00:00.000Z";
const LATER = "2026-08-10T08:01:00.000Z";
const MUCH_LATER = "2030-08-10T08:00:00.000Z";

const generationBindings = Object.freeze({
  protocol_generation_digest: sha("protocol-generation"),
  product_generation_digest: sha("product-generation"),
  context_generation_digest: sha("context-generation"),
  concern_generation_digest: sha("concern-generation"),
  control_generation_digest: sha("control-generation"),
  authority_generation_digest: sha("authority-generation"),
  layer_inventory_digest: sha("layer-inventory")
});
const protocolDigest = sha("compiled-protocol");
const productGraphDigest = sha("compiled-product-graph");

function source(id) {
  return { path: `fixtures/${id}.json`, digest: sha(`source:${id}`), span: "1:1" };
}

function graphFixture() {
  return {
    schema_version: 2,
    product: "evidence-consumption-fixture",
    generation_bindings: generationBindings,
    layer_inventory_digest: generationBindings.layer_inventory_digest,
    nodes: [
      { id: "O1", type: "OUTCOME", title: "Outcome", context_scope: "global", status: "RESOLVED", source: source("outcome") },
      { id: "EV1", type: "EVIDENCE", title: "Evidence", context_scope: "evidence", status: "RESOLVED", source: source("evidence") },
      { id: "CODE1", type: "CODE", title: "Relevant code state", context_scope: "task", status: "RESOLVED", source: source("code") },
      { id: "OBL1", type: "LAYER_OBLIGATION", title: "Resolved obligation", context_scope: "task", status: "RESOLVED", source: source("obligation") },
      { id: "D1", type: "DECISION", title: "Authorized decision", context_scope: "global", status: "RESOLVED", source: source("decision"), attributes: { decision_record_id: "DREC" } },
      { id: "U1", type: "UNCERTAINTY", title: "Measured uncertainty", context_scope: "global", status: "RESOLVED", source: source("uncertainty") },
      { id: "OPS1", type: "OPERATIONS", title: "Operations consumer", context_scope: "global", status: "RESOLVED", source: source("operations") }
    ],
    edges: [
      { from: "D1", to: "O1", type: "DELIVERS" },
      { from: "EV1", to: "D1", type: "INFORMS" },
      { from: "CODE1", to: "EV1", type: "PROVED_BY" },
      { from: "OBL1", to: "EV1", type: "SATISFIED_BY" },
      { from: "O1", to: "OPS1", type: "OPERATED_BY" },
      { from: "U1", to: "D1", type: "INFORMS" }
    ]
  };
}

const consumer = (kind, id, condition) => ({
  kind,
  id,
  required: true,
  condition,
  acknowledgement: { state: "DECLARED", evidence_digest: null }
});

function artifactContract(id, overrides = {}) {
  return {
    id,
    kind: overrides.kind ?? "VALIDATION_EVIDENCE",
    producer_id: overrides.producer_id ?? "validator-1",
    consumer_ids: overrides.consumer_ids ?? [consumer("RUNTIME", "task-acceptor", "BEFORE_TASK_ACCEPTANCE")],
    outcome_ids: ["O1"],
    source_digest: sha(`source:${id}`),
    required: true,
    invalidation_input_digests: [sha(`input:${id}`)],
    freshness: overrides.freshness ?? { mode: "IMMUTABLE", max_age_seconds: null },
    idempotency_key: `produce:${id}`,
    retention: overrides.retention ?? "RUN"
  };
}

function protocolFixture(contracts) {
  return {
    generation_bindings: generationBindings,
    decision_record: { id: "DREC", authority_digest: sha("decision-authority") },
    artifacts: contracts
  };
}

function writeEvidence(storeRoot, input) {
  const object = {
    schema_version: 2,
    kind: input.kind ?? "VALIDATION_EVIDENCE",
    trust_level: input.trust_level ?? "hermetic",
    subject: input.subject ?? input.artifact_id,
    producer_id: input.producer_id,
    consumer_ids: input.consumer_ids,
    generation_bindings: input.generation_bindings ?? generationBindings,
    relevant_digests: {
      product_graph_digest: input.product_graph_digest ?? productGraphDigest,
      protocol_digest: input.protocol_digest ?? protocolDigest,
      source_digest: input.source_digest,
      "input:0": input.invalidation_digest,
      ...(input.relevant_digests ?? {})
    },
    environment_identity: "fixture-env",
    created_at: input.created_at ?? CREATED,
    expires_at: input.expires_at ?? null,
    payload: {
      artifact_id: input.artifact_id,
      graph_node_id: input.graph_node_id ?? "EV1",
      ...(input.payload ?? {})
    },
    object_digest: ""
  };
  object.object_digest = contentDigest(Object.fromEntries(Object.entries(object).filter(([key]) => key !== "object_digest")));
  const objectPath = path.join(storeRoot, "objects", "sha256", object.object_digest.slice(0, 2), `${object.object_digest}.json`);
  fs.mkdirSync(path.dirname(objectPath), { recursive: true });
  fs.writeFileSync(objectPath, `${JSON.stringify(object)}\n`);
  return { object, objectPath };
}

function makeFixture(options = {}) {
  const validation = artifactContract("validation-evidence", {
    freshness: options.freshness,
    retention: options.retention,
    consumer_ids: options.validation_consumers
  });
  const release = artifactContract("product-release", {
    kind: "PRODUCT_RELEASE",
    producer_id: "release-runtime",
    retention: options.release_retention ?? "RELEASE",
    consumer_ids: [consumer("OPERATIONS", "product-operations", "BEFORE_DELIVERY_CLOSE")]
  });
  const contracts = options.only_validation ? [validation] : [validation, release];
  const protocol = protocolFixture(contracts);
  const productGraph = graphFixture();
  const storeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "svc-consumption-v2-"));
  const created = createConsumptionLedger({
    run_id: "run-fixture",
    generation_bindings: generationBindings,
    protocol_digest: protocolDigest,
    product_graph_digest: productGraphDigest,
    artifact_contracts: contracts,
    invalidation_input_names: Object.fromEntries(contracts.map((contract) => [contract.id, ["input:0"]])),
    minimum_trust_levels: Object.fromEntries(contracts.map((contract) => [contract.id, options.minimum_trust ?? "hermetic"])),
    producer_task_ids: { "validation-evidence": "task-1" },
    consumer_graph_nodes: { "product-release": { "product-operations": "OPS1" } },
    validation_options: { protocol, protocolDigest, productGraph, productGraphDigest }
  });
  assert.equal(created.valid, true, created.errors?.join("; "));
  return {
    storeRoot,
    ledger: created.ledger,
    protocol,
    productGraph,
    contracts,
    runtimeOptions: { storeRoot, protocol, protocolDigest, productGraph, productGraphDigest },
    cleanup: () => fs.rmSync(storeRoot, { recursive: true, force: true })
  };
}

function evidenceFor(fixture, artifactId, overrides = {}) {
  const contract = fixture.contracts.find((item) => item.id === artifactId);
  return writeEvidence(fixture.storeRoot, {
    artifact_id: artifactId,
    kind: overrides.kind ?? contract.kind,
    producer_id: overrides.producer_id ?? contract.producer_id,
    consumer_ids: overrides.consumer_ids ?? contract.consumer_ids.map((item) => item.id),
    invalidation_digest: overrides.invalidation_digest ?? contract.invalidation_input_digests[0],
    source_digest: overrides.source_digest ?? contract.source_digest,
    ...overrides
  });
}

function produce(fixture, artifactId, evidence, at = CREATED) {
  const result = recordEvidenceProduced(fixture.ledger, {
    artifact_id: artifactId,
    object_digest: evidence.object.object_digest,
    idempotency_key: `produce:${artifactId}`,
    produced_at: at
  }, fixture.runtimeOptions);
  if (result.valid) fixture.ledger = result.ledger;
  return result;
}

function acknowledge(fixture, artifactId, evidence, consumerId, condition, at = LATER, key = `ack:${artifactId}:${consumerId}`) {
  const result = acknowledgeEvidenceConsumer(fixture.ledger, {
    artifact_id: artifactId,
    object_digest: evidence.object.object_digest,
    consumer_id: consumerId,
    condition,
    acknowledged_at: at,
    idempotency_key: key
  }, fixture.runtimeOptions);
  if (result.valid) fixture.ledger = result.ledger;
  return result;
}

function consumedValidationFixture(options = {}) {
  const fixture = makeFixture(options);
  const evidence = evidenceFor(fixture, "validation-evidence", { graph_node_id: options.graph_node_id ?? "EV1" });
  assert.equal(produce(fixture, "validation-evidence", evidence).valid, true);
  assert.equal(acknowledge(fixture, "validation-evidence", evidence, "task-acceptor", "BEFORE_TASK_ACCEPTANCE").valid, true);
  return { ...fixture, evidence };
}

function progressInput(overrides = {}) {
  return {
    idempotency_key: overrides.idempotency_key ?? "progress:1",
    prior_state_digest: overrides.prior_state_digest ?? sha("state:before"),
    next_state_digest: overrides.next_state_digest ?? sha("state:after"),
    causal_fingerprint: overrides.causal_fingerprint ?? sha("failure:fingerprint"),
    evidence_refs: overrides.evidence_refs ?? [],
    resolved_obligations: overrides.resolved_obligations ?? [],
    authorized_decisions: overrides.authorized_decisions ?? [],
    uncertainty_reductions: overrides.uncertainty_reductions ?? [],
    recorded_at: overrides.recorded_at ?? LATER
  };
}

let passed = 0;
let failed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    failed += 1;
    process.stderr.write(`not ok ${name}: ${error.stack ?? error.message}\n`);
  }
}

check("creates a digest-bound ledger from authoritative artifact contracts", () => {
  const fixture = makeFixture();
  try {
    assert.equal(validateConsumptionLedger(fixture.ledger, fixture.runtimeOptions).valid, true);
    assert.equal(fixture.ledger.artifacts.length, 2);
    assert.equal(calculateLedgerDigest(fixture.ledger), fixture.ledger.ledger_digest);
  } finally { fixture.cleanup(); }
});

check("rejects a forged ledger digest", () => {
  const fixture = makeFixture();
  try {
    fixture.ledger.artifacts[0].producer_id = "forged-producer";
    const result = validateConsumptionLedger(fixture.ledger, fixture.runtimeOptions);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /ledger digest mismatch|differs from protocol/);
  } finally { fixture.cleanup(); }
});

check("rejects digest-valid receipt fields outside the authoritative ledger contract", () => {
  const fixture = makeFixture();
  try {
    fixture.ledger.artifacts[0].receipt_ids = [sha("receipt-churn")];
    fixture.ledger.ledger_digest = calculateLedgerDigest(fixture.ledger);
    const result = validateConsumptionLedger(fixture.ledger, fixture.runtimeOptions);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /unknown field receipt_ids/);
  } finally { fixture.cleanup(); }
});

check("rejects a CAS object from the wrong producer", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence", { producer_id: "attacker" });
    const result = produce(fixture, "validation-evidence", evidence);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /producer/);
  } finally { fixture.cleanup(); }
});

check("rejects a CAS object that omits a required named consumer", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence", { consumer_ids: ["somebody-else"] });
    const result = produce(fixture, "validation-evidence", evidence);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /consumers/);
  } finally { fixture.cleanup(); }
});

check("rejects evidence bound to a stale product graph", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence", { product_graph_digest: sha("stale-graph") });
    const result = produce(fixture, "validation-evidence", evidence);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /product graph digest/);
  } finally { fixture.cleanup(); }
});

check("rejects evidence bound to a stale protocol", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence", { protocol_digest: sha("stale-protocol") });
    const result = produce(fixture, "validation-evidence", evidence);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /protocol digest/);
  } finally { fixture.cleanup(); }
});

check("rejects evidence below the required trust level", () => {
  const fixture = makeFixture({ minimum_trust: "production" });
  try {
    const evidence = evidenceFor(fixture, "validation-evidence", { trust_level: "sandbox" });
    const result = produce(fixture, "validation-evidence", evidence);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /below production/);
  } finally { fixture.cleanup(); }
});

check("rejects evidence whose declared invalidation input is stale", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence", { invalidation_digest: sha("stale-input") });
    const result = produce(fixture, "validation-evidence", evidence);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /invalidation input/);
  } finally { fixture.cleanup(); }
});

check("enforces the contract freshness window independently of object expiry", () => {
  const fixture = makeFixture({ freshness: { mode: "MAX_AGE_SECONDS", max_age_seconds: 10 } });
  try {
    const evidence = evidenceFor(fixture, "validation-evidence", { expires_at: "2026-08-10T09:00:00.000Z" });
    const result = produce(fixture, "validation-evidence", evidence, "2026-08-10T08:00:11.000Z");
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /freshness bound/);
  } finally { fixture.cleanup(); }
});

check("produces and acknowledges the same CAS object idempotently", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence");
    const first = produce(fixture, "validation-evidence", evidence);
    assert.equal(first.valid, true);
    const repeated = recordEvidenceProduced(fixture.ledger, {
      artifact_id: "validation-evidence", object_digest: evidence.object.object_digest,
      idempotency_key: "produce:validation-evidence", produced_at: CREATED
    }, fixture.runtimeOptions);
    assert.equal(repeated.idempotent, true);
    const ack = acknowledge(fixture, "validation-evidence", evidence, "task-acceptor", "BEFORE_TASK_ACCEPTANCE");
    assert.equal(ack.valid, true);
    const repeatedAck = acknowledgeEvidenceConsumer(fixture.ledger, {
      artifact_id: "validation-evidence", object_digest: evidence.object.object_digest, consumer_id: "task-acceptor",
      condition: "BEFORE_TASK_ACCEPTANCE", acknowledged_at: LATER, idempotency_key: "ack:validation-evidence:task-acceptor"
    }, fixture.runtimeOptions);
    assert.equal(repeatedAck.idempotent, true);
  } finally { fixture.cleanup(); }
});

check("rejects acknowledgement idempotency-key reuse with different input", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = acknowledgeEvidenceConsumer(fixture.ledger, {
      artifact_id: "validation-evidence", object_digest: fixture.evidence.object.object_digest, consumer_id: "task-acceptor",
      condition: "BEFORE_TASK_ACCEPTANCE", acknowledged_at: "2026-08-10T08:02:00.000Z", idempotency_key: "ack:validation-evidence:task-acceptor"
    }, fixture.runtimeOptions);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /reused/);
  } finally { fixture.cleanup(); }
});

check("rejects an acknowledgement under the wrong consumption condition", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence");
    assert.equal(produce(fixture, "validation-evidence", evidence).valid, true);
    const result = acknowledge(fixture, "validation-evidence", evidence, "task-acceptor", "BEFORE_DELIVERY_CLOSE");
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /condition/);
  } finally { fixture.cleanup(); }
});

check("blocks delivery close while a required product consumer is unacknowledged", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = evaluateConsumptionCloseout(fixture.ledger, { ...fixture.runtimeOptions, condition: "BEFORE_DELIVERY_CLOSE" });
    assert.equal(result.closed, false);
    assert.ok(result.missing.some((item) => item.consumer_id === "product-operations"));
  } finally { fixture.cleanup(); }
});

check("closes delivery only after every due consumer including a product terminal acknowledges", () => {
  const fixture = consumedValidationFixture();
  try {
    const releaseEvidence = evidenceFor(fixture, "product-release");
    assert.equal(produce(fixture, "product-release", releaseEvidence).valid, true);
    assert.equal(acknowledge(fixture, "product-release", releaseEvidence, "product-operations", "BEFORE_DELIVERY_CLOSE").valid, true);
    const result = evaluateConsumptionCloseout(fixture.ledger, { ...fixture.runtimeOptions, condition: "BEFORE_DELIVERY_CLOSE" });
    assert.equal(result.closed, true, JSON.stringify(result.missing));
    assert.deepEqual(result.acknowledged_product_terminals.map((item) => item.consumer_id), ["product-operations"]);
  } finally { fixture.cleanup(); }
});

check("does not accept runtime-only acknowledgement as a product terminal", () => {
  const fixture = consumedValidationFixture({ only_validation: true });
  try {
    const result = evaluateConsumptionCloseout(fixture.ledger, { ...fixture.runtimeOptions, condition: "BEFORE_DELIVERY_CLOSE" });
    assert.equal(result.closed, false);
    assert.match(JSON.stringify(result.missing), /product terminal/);
  } finally { fixture.cleanup(); }
});

check("keeps TASK_ACCEPTED nonterminal until required evidence is CONSUMED", () => {
  const fixture = makeFixture();
  try {
    const before = evaluateTaskContribution(fixture.ledger, { task_status: "ACCEPTED", required_artifact_ids: ["validation-evidence"] }, fixture.runtimeOptions);
    assert.equal(before.terminal, false);
    assert.equal(before.next_status, "ACCEPTED");
    const evidence = evidenceFor(fixture, "validation-evidence");
    assert.equal(produce(fixture, "validation-evidence", evidence).valid, true);
    assert.equal(acknowledge(fixture, "validation-evidence", evidence, "task-acceptor", "BEFORE_TASK_ACCEPTANCE").valid, true);
    const ready = evaluateTaskContribution(fixture.ledger, { task_status: "ACCEPTED", required_artifact_ids: ["validation-evidence"] }, fixture.runtimeOptions);
    assert.equal(ready.terminal, false);
    assert.equal(ready.next_status, "CONSUMED");
    const terminal = evaluateTaskContribution(fixture.ledger, { task_status: "CONSUMED", required_artifact_ids: ["validation-evidence"] }, fixture.runtimeOptions);
    assert.equal(terminal.terminal, true);
  } finally { fixture.cleanup(); }
});

check("rejects invalidation without a changed declared input", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = invalidateEvidenceArtifact(fixture.ledger, {
      artifact_id: "validation-evidence", idempotency_key: "invalidate:1", invalidated_at: LATER,
      reason: "changed validator", changed_inputs: [{ name: "input:0", digest: sha("input:validation-evidence") }]
    }, fixture.runtimeOptions);
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /do not prove/);
  } finally { fixture.cleanup(); }
});

check("invalidates evidence only from a changed declared input and then denies reuse", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = invalidateEvidenceArtifact(fixture.ledger, {
      artifact_id: "validation-evidence", idempotency_key: "invalidate:1", invalidated_at: LATER,
      reason: "validator changed", changed_inputs: [{ name: "input:0", digest: sha("new-validator") }]
    }, fixture.runtimeOptions);
    assert.equal(result.valid, true, result.errors?.join("; "));
    fixture.ledger = result.ledger;
    const resolve = resolveEvidenceForConsumer(fixture.ledger, {
      artifact_id: "validation-evidence", object_digest: fixture.evidence.object.object_digest,
      consumer_id: "task-acceptor", condition: "BEFORE_TASK_ACCEPTANCE", at_time: LATER
    }, fixture.runtimeOptions);
    assert.equal(resolve.valid, false);
    assert.match(resolve.errors.join(" "), /invalidated/);
  } finally { fixture.cleanup(); }
});

check("accepts progress only from consumed CAS evidence resolved to the product graph", () => {
  const fixture = consumedValidationFixture();
  try {
    const input = progressInput({ evidence_refs: [{
      object_digest: fixture.evidence.object.object_digest,
      artifact_id: "validation-evidence",
      graph_node_id: "EV1",
      consumer_id: "task-acceptor",
      role: "NEW_EVIDENCE"
    }] });
    const result = evaluateCausalProgress(fixture.ledger, input, { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, true, result.errors.join("; "));
  } finally { fixture.cleanup(); }
});

check("rejects an arbitrary evidence graph ID", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ evidence_refs: [{
      object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence",
      graph_node_id: "invented-evidence", consumer_id: "task-acceptor", role: "NEW_EVIDENCE"
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, false);
    assert.match(result.errors.join(" "), /does not resolve/);
  } finally { fixture.cleanup(); }
});

check("rejects a SHA-shaped string masquerading as a product graph ID", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ evidence_refs: [{
      object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence",
      graph_node_id: sha("fake-node"), consumer_id: "task-acceptor", role: "NEW_EVIDENCE"
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, false);
    assert.match(result.errors.join(" "), /SHA-shaped/);
  } finally { fixture.cleanup(); }
});

check("rejects produced but unconsumed CAS evidence as progress", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence");
    assert.equal(produce(fixture, "validation-evidence", evidence).valid, true);
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ evidence_refs: [{
      object_digest: evidence.object.object_digest, artifact_id: "validation-evidence",
      graph_node_id: "EV1", consumer_id: "task-acceptor", role: "NEW_EVIDENCE"
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, false);
    assert.match(result.errors.join(" "), /acknowledged/);
  } finally { fixture.cleanup(); }
});

for (const [name, field, value] of [
  ["diff-stat churn", "diff_stat", { insertions: 100 }],
  ["receipt churn", "receipt_ids", [sha("receipt")]],
  ["review-opinion churn", "reviewer_opinions", ["looks good"]]
]) {
  check(`rejects ${name} as causal progress`, () => {
    const fixture = consumedValidationFixture();
    try {
      const input = progressInput();
      input[field] = value;
      const result = evaluateCausalProgress(fixture.ledger, input, { ...fixture.runtimeOptions, at_time: LATER });
      assert.equal(result.accepted, false);
      assert.match(result.errors.join(" "), new RegExp(field));
    } finally { fixture.cleanup(); }
  });
}

check("rejects a claimed state change whose relevant state digest did not change", () => {
  const fixture = consumedValidationFixture({ graph_node_id: "CODE1" });
  try {
    const state = sha("same-state");
    const result = evaluateCausalProgress(fixture.ledger, progressInput({
      prior_state_digest: state,
      next_state_digest: state,
      evidence_refs: [{ object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence", graph_node_id: "CODE1", consumer_id: "task-acceptor", role: "STATE_CHANGE" }]
    }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, false);
    assert.match(result.errors.join(" "), /without a changed relevant state/);
  } finally { fixture.cleanup(); }
});

check("accepts a CAS-backed relevant state change", () => {
  const fixture = consumedValidationFixture({ graph_node_id: "CODE1" });
  try {
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ evidence_refs: [{
      object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence",
      graph_node_id: "CODE1", consumer_id: "task-acceptor", role: "STATE_CHANGE"
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, true, result.errors.join("; "));
  } finally { fixture.cleanup(); }
});

check("rejects the same relevant state and causal fingerprint on rerun", () => {
  const fixture = consumedValidationFixture();
  try {
    const firstInput = progressInput({ evidence_refs: [{
      object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence",
      graph_node_id: "EV1", consumer_id: "task-acceptor", role: "NEW_EVIDENCE"
    }] });
    const first = recordCausalProgress(fixture.ledger, firstInput, { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(first.accepted, true, first.errors.join("; "));
    fixture.ledger = first.ledger;
    const second = recordCausalProgress(fixture.ledger, { ...firstInput, idempotency_key: "progress:2" }, { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(second.accepted, false);
    assert.deepEqual(second.reason_codes, ["DUPLICATE_CAUSAL_STATE"]);
  } finally { fixture.cleanup(); }
});

check("returns the exact same progress transition idempotently", () => {
  const fixture = consumedValidationFixture();
  try {
    const input = progressInput({ evidence_refs: [{
      object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence",
      graph_node_id: "EV1", consumer_id: "task-acceptor", role: "NEW_EVIDENCE"
    }] });
    const first = recordCausalProgress(fixture.ledger, input, { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(first.valid, true);
    const repeated = recordCausalProgress(first.ledger, input, { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(repeated.idempotent, true);
    assert.equal(repeated.attempt.attempt_digest, first.attempt.attempt_digest);
  } finally { fixture.cleanup(); }
});

check("resolves an obligation only through graph state and consumed CAS evidence", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ resolved_obligations: [{
      graph_node_id: "OBL1", prior_status: "OPEN", resolution_evidence_digest: fixture.evidence.object.object_digest, consumer_id: "task-acceptor"
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, true, result.errors.join("; "));
  } finally { fixture.cleanup(); }
});

check("rejects a forged decision authority digest", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ authorized_decisions: [{
      decision_node_id: "D1", authority_digest: sha("attacker")
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, false);
    assert.match(result.errors.join(" "), /authority/);
  } finally { fixture.cleanup(); }
});

check("accepts a decision resolved through graph and protocol authority", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ authorized_decisions: [{
      decision_node_id: "D1", authority_digest: sha("decision-authority")
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, true, result.errors.join("; "));
  } finally { fixture.cleanup(); }
});

check("requires a measured decrease for uncertainty-reduction progress", () => {
  const fixture = consumedValidationFixture();
  try {
    const result = evaluateCausalProgress(fixture.ledger, progressInput({ uncertainty_reductions: [{
      graph_node_id: "U1", before: 0.5, after: 0.5,
      evidence_object_digest: fixture.evidence.object.object_digest, consumer_id: "task-acceptor"
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(result.accepted, false);
    assert.match(result.errors.join(" "), /uncertainty reduction/);
  } finally { fixture.cleanup(); }
});

check("does not count the same consumed evidence again under a new fingerprint", () => {
  const fixture = consumedValidationFixture();
  try {
    const ref = { object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence", graph_node_id: "EV1", consumer_id: "task-acceptor", role: "NEW_EVIDENCE" };
    const first = recordCausalProgress(fixture.ledger, progressInput({ evidence_refs: [ref] }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(first.accepted, true);
    const second = evaluateCausalProgress(first.ledger, progressInput({
      idempotency_key: "progress:new-fingerprint", causal_fingerprint: sha("another-fingerprint"), evidence_refs: [ref]
    }), { ...fixture.runtimeOptions, at_time: LATER });
    assert.equal(second.accepted, false);
    assert.match(second.errors.join(" "), /must resolve new/);
  } finally { fixture.cleanup(); }
});

check("detects CAS tampering before consumption", () => {
  const fixture = makeFixture();
  try {
    const evidence = evidenceFor(fixture, "validation-evidence");
    const stored = JSON.parse(fs.readFileSync(evidence.objectPath, "utf8"));
    stored.payload.forged = true;
    fs.writeFileSync(evidence.objectPath, `${JSON.stringify(stored)}\n`);
    const result = readCasEvidence(fixture.storeRoot, evidence.object.object_digest, { at_time: CREATED });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /integrity/);
  } finally { fixture.cleanup(); }
});

check("pins release evidence and pending-consumer evidence during GC", () => {
  const fixture = makeFixture();
  try {
    const validationEvidence = evidenceFor(fixture, "validation-evidence");
    const releaseEvidence = evidenceFor(fixture, "product-release");
    assert.equal(produce(fixture, "validation-evidence", validationEvidence).valid, true);
    assert.equal(produce(fixture, "product-release", releaseEvidence).valid, true);
    const result = planEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, {
      ...fixture.runtimeOptions, at_time: MUCH_LATER, run_closed: true, collect_consumed_run_evidence: true, grace_seconds: 0
    });
    assert.equal(result.valid, true);
    assert.equal(result.plan.delete.length, 0);
    const reasons = result.plan.keep.flatMap((row) => row.reasons);
    assert.ok(reasons.includes("required-consumer-pending"));
    assert.ok(reasons.includes("retention:RELEASE"));
  } finally { fixture.cleanup(); }
});

check("keeps evidence reachable from accepted causal progress", () => {
  const fixture = consumedValidationFixture();
  try {
    const progress = recordCausalProgress(fixture.ledger, progressInput({ evidence_refs: [{
      object_digest: fixture.evidence.object.object_digest, artifact_id: "validation-evidence",
      graph_node_id: "EV1", consumer_id: "task-acceptor", role: "NEW_EVIDENCE"
    }] }), { ...fixture.runtimeOptions, at_time: LATER });
    fixture.ledger = progress.ledger;
    const plan = planEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, {
      ...fixture.runtimeOptions, at_time: MUCH_LATER, run_closed: true, collect_consumed_run_evidence: true, grace_seconds: 0
    });
    assert.equal(plan.valid, true);
    assert.equal(plan.plan.delete.some((row) => row.object_digest === fixture.evidence.object.object_digest), false);
    assert.ok(plan.plan.keep.find((row) => row.object_digest === fixture.evidence.object.object_digest).reasons.includes("causal-progress-reachability"));
  } finally { fixture.cleanup(); }
});

check("keeps evidence under an explicit decision reachability pin", () => {
  const fixture = consumedValidationFixture();
  try {
    fixture.ledger.artifacts[0].retention.pinned_by.push({ kind: "DECISION", id: "D1", digest: sha("decision-authority") });
    fixture.ledger.ledger_digest = calculateLedgerDigest(fixture.ledger);
    const plan = planEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, {
      ...fixture.runtimeOptions, at_time: MUCH_LATER, run_closed: true, collect_consumed_run_evidence: true, grace_seconds: 0
    });
    assert.equal(plan.valid, true, plan.errors?.join("; "));
    const row = plan.plan.keep.find((item) => item.object_digest === fixture.evidence.object.object_digest);
    assert.ok(row.reasons.includes("pin:DECISION:D1"));
  } finally { fixture.cleanup(); }
});

check("collects only unreachable invalidated RUN evidence after the grace period", () => {
  const fixture = consumedValidationFixture();
  try {
    const invalidated = invalidateEvidenceArtifact(fixture.ledger, {
      artifact_id: "validation-evidence", idempotency_key: "invalidate:gc", invalidated_at: LATER,
      reason: "validator generation changed", changed_inputs: [{ name: "input:0", digest: sha("changed") }]
    }, fixture.runtimeOptions);
    assert.equal(invalidated.valid, true);
    fixture.ledger = invalidated.ledger;
    const result = planEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, {
      ...fixture.runtimeOptions, at_time: MUCH_LATER, run_closed: true, grace_seconds: 0
    });
    assert.equal(result.valid, true);
    assert.deepEqual(result.plan.delete.map((row) => row.object_digest), [fixture.evidence.object.object_digest]);
  } finally { fixture.cleanup(); }
});

check("requires exact plan confirmation and rechecks reachability before GC sweep", () => {
  const fixture = consumedValidationFixture();
  try {
    const invalidated = invalidateEvidenceArtifact(fixture.ledger, {
      artifact_id: "validation-evidence", idempotency_key: "invalidate:sweep", invalidated_at: LATER,
      reason: "validator generation changed", changed_inputs: [{ name: "input:0", digest: sha("changed-again") }]
    }, fixture.runtimeOptions);
    fixture.ledger = invalidated.ledger;
    const planned = planEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, {
      ...fixture.runtimeOptions, at_time: MUCH_LATER, run_closed: true, grace_seconds: 0
    });
    const denied = applyEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, planned.plan, {
      ...fixture.runtimeOptions, confirm_plan_digest: sha("wrong")
    });
    assert.equal(denied.valid, false);
    assert.equal(fs.existsSync(fixture.evidence.objectPath), true);
    const applied = applyEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, planned.plan, {
      ...fixture.runtimeOptions, ...planned.plan.policy, confirm_plan_digest: planned.plan.plan_digest
    });
    assert.equal(applied.valid, true, applied.errors?.join("; "));
    assert.equal(fs.existsSync(fixture.evidence.objectPath), false);
  } finally { fixture.cleanup(); }
});

check("rejects a GC plan after the ledger changes", () => {
  const fixture = consumedValidationFixture();
  try {
    const invalidated = invalidateEvidenceArtifact(fixture.ledger, {
      artifact_id: "validation-evidence", idempotency_key: "invalidate:stale-plan", invalidated_at: LATER,
      reason: "changed input", changed_inputs: [{ name: "input:0", digest: sha("changed-input") }]
    }, fixture.runtimeOptions);
    fixture.ledger = invalidated.ledger;
    const planned = planEvidenceGarbageCollection(fixture.storeRoot, fixture.ledger, {
      ...fixture.runtimeOptions, at_time: MUCH_LATER, run_closed: true, grace_seconds: 0
    });
    const changed = structuredClone(fixture.ledger);
    changed.artifacts[0].retention.legal_hold = true;
    changed.ledger_digest = calculateLedgerDigest(changed);
    const result = applyEvidenceGarbageCollection(fixture.storeRoot, changed, planned.plan, {
      ...fixture.runtimeOptions, ...planned.plan.policy, confirm_plan_digest: planned.plan.plan_digest
    });
    assert.equal(result.valid, false);
    assert.match(result.errors.join(" "), /stale/);
  } finally { fixture.cleanup(); }
});

if (failed > 0) {
  process.stderr.write(`FAIL: runtime evidence consumption v2 (${passed} passed, ${failed} failed)\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PASS: runtime evidence consumption v2 (${passed} checks)\n`);
}
