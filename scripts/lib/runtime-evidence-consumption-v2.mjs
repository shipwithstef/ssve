import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./json-schema-validator.mjs";
import { sameGenerationBindings, validateGenerationBindings } from "./generation-bindings-v2.mjs";

const LEDGER_SCHEMA = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../schemas/consumption-ledger-v2.schema.json", import.meta.url)), "utf8"));
const SHA256 = /^[a-f0-9]{64}$/;
const SHA_SHAPED_ID = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const TRUST_RANK = Object.freeze({ static: 0, hermetic: 1, sandbox: 2, device: 3, staging: 4, production: 5 });
const CONDITION_RANK = Object.freeze({
  BEFORE_DISPATCH: 0,
  BEFORE_TASK_ACCEPTANCE: 1,
  BEFORE_REVIEW: 2,
  BEFORE_DELIVERY_CLOSE: 3,
  BEFORE_OUTCOME_CLOSE: 4
});
const PRODUCT_TERMINAL_KINDS = new Set(["CUSTOMER", "OWNER", "OPERATIONS", "METRIC"]);
const PROGRESS_KEYS = new Set([
  "idempotency_key", "prior_state_digest", "next_state_digest", "causal_fingerprint",
  "evidence_refs", "resolved_obligations", "authorized_decisions", "uncertainty_reductions", "recorded_at"
]);
const FORBIDDEN_PROGRESS_KEYS = new Set([
  "diff_stat", "diff_stats", "changed_lines", "commit_sha", "sha", "receipt", "receipt_id",
  "receipt_ids", "framework_note", "framework_notes", "reviewer_opinion", "reviewer_opinions",
  "tool_calls", "message_count"
]);
const LEDGER_KEYS = new Set(["schema_version", "run_id", "generation_bindings", "protocol_digest", "product_graph_digest", "artifacts", "progress_attempts", "ledger_digest"]);
const ARTIFACT_KEYS = new Set([
  "artifact_id", "artifact_kind", "source_digest", "object_digest", "producer_id", "producer_task_id", "outcome_ids",
  "required_consumers", "invalidation_inputs", "minimum_trust_level", "freshness", "production_idempotency_key",
  "invalidation_idempotency_key", "retention", "state", "produced_at", "invalidated_at", "invalidation_reason"
]);
const CONSUMER_KEYS = new Set([
  "consumer_id", "consumer_kind", "graph_node_id", "condition", "acknowledgement_state", "acknowledged_object_digest",
  "acknowledged_at", "acknowledgement_digest", "idempotency_key"
]);
const ATTEMPT_KEYS = new Set([
  "idempotency_key", "prior_state_digest", "next_state_digest", "causal_fingerprint", "evidence_refs", "resolved_obligations",
  "authorized_decisions", "uncertainty_reductions", "accepted", "reason_codes", "recorded_at", "attempt_digest"
]);

export const EVIDENCE_TRUST_LEVELS = Object.freeze(Object.keys(TRUST_RANK));
export const CONSUMPTION_CONDITIONS = Object.freeze(Object.keys(CONDITION_RANK));

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort()
      .map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function contentDigest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function unique(values) {
  return [...new Set(values)];
}

function canonicalTime(value) {
  return typeof value === "string" && ISO_TIMESTAMP.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
}

function namedId(value) {
  return typeof value === "string" && SAFE_ID.test(value) && !SHA_SHAPED_ID.test(value);
}

function exactKeys(object, allowed, label, errors) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return;
  for (const key of Object.keys(object)) if (!allowed.has(key)) errors.push(`${label} contains unknown field ${key}`);
}

function arraysEqual(left = [], right = []) {
  return stable([...left].sort()) === stable([...right].sort());
}

function payloadWithoutDigest(object, digestField) {
  const payload = { ...object };
  delete payload[digestField];
  return payload;
}

export function calculateLedgerDigest(ledger) {
  return contentDigest(payloadWithoutDigest(ledger, "ledger_digest"));
}

function withLedgerDigest(ledger) {
  const next = clone(ledger);
  next.ledger_digest = calculateLedgerDigest(next);
  return next;
}

function graphIndex(productGraph) {
  const nodes = new Map((productGraph?.nodes ?? []).map((node) => [node.id, node]));
  return { nodes, edges: productGraph?.edges ?? [] };
}

function graphNode(index, id, allowedTypes, label, errors) {
  if (!namedId(id)) {
    errors.push(`${label} must be a named product-graph ID, not an arbitrary or SHA-shaped string`);
    return null;
  }
  const node = index.nodes.get(id);
  if (!node) {
    errors.push(`${label} does not resolve in the product graph`);
    return null;
  }
  if (allowedTypes && !allowedTypes.has(node.type)) errors.push(`${label} resolves to ${node.type}, expected ${[...allowedTypes].join("|")}`);
  return node;
}

function evidenceObjectPath(storeRoot, objectDigest) {
  if (!SHA256.test(objectDigest ?? "")) throw new Error("object digest must be lowercase sha256");
  return path.join(path.resolve(storeRoot), "objects", "sha256", objectDigest.slice(0, 2), `${objectDigest}.json`);
}

function evidencePayload(object) {
  return payloadWithoutDigest(object, "object_digest");
}

function safeCasFile(storeRoot, objectPath) {
  const root = path.join(path.resolve(storeRoot), "objects", "sha256");
  const prefix = path.dirname(objectPath);
  try {
    const rootStat = fs.lstatSync(root);
    const prefixStat = fs.lstatSync(prefix);
    const objectStat = fs.lstatSync(objectPath);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return "CAS root is not a real directory";
    if (!prefixStat.isDirectory() || prefixStat.isSymbolicLink()) return "CAS prefix is not a real directory";
    if (!objectStat.isFile() || objectStat.isSymbolicLink()) return "CAS object is not a regular file";
    if (fs.realpathSync(objectPath) !== path.resolve(objectPath)) return "CAS object path crosses a symlink";
  } catch (error) {
    return `CAS path unavailable: ${error.code ?? error.message}`;
  }
  return null;
}

export function readCasEvidence(storeRoot, objectDigest, options = {}) {
  let objectPath;
  try { objectPath = evidenceObjectPath(storeRoot, objectDigest); }
  catch (error) { return { valid: false, fresh: false, errors: [error.message], object: null, object_path: null }; }
  const unsafePath = safeCasFile(storeRoot, objectPath);
  if (unsafePath) return { valid: false, fresh: false, errors: [unsafePath], object: null, object_path: objectPath };
  let object;
  try { object = JSON.parse(fs.readFileSync(objectPath, "utf8")); }
  catch (error) {
    return { valid: false, fresh: false, errors: [`evidence object unavailable: ${error.code ?? error.message}`], object: null, object_path: objectPath };
  }
  const errors = [];
  if (object?.object_digest !== objectDigest) errors.push("stored object digest does not match requested digest");
  if (contentDigest(evidencePayload(object)) !== object?.object_digest) errors.push("stored object integrity mismatch");
  if (!canonicalTime(object?.created_at)) errors.push("stored created_at is invalid");
  if (object?.expires_at !== null && !canonicalTime(object?.expires_at)) errors.push("stored expires_at is invalid");
  if (!(object?.trust_level in TRUST_RANK)) errors.push(`stored trust_level ${object?.trust_level} is invalid`);
  errors.push(...validateGenerationBindings(object?.generation_bindings, "evidence.generation_bindings"));
  if (!object?.relevant_digests || typeof object.relevant_digests !== "object" || Array.isArray(object.relevant_digests)) {
    errors.push("stored relevant_digests must be an object");
  } else {
    for (const [name, value] of Object.entries(object.relevant_digests)) {
      if (!name || !SHA256.test(value)) errors.push(`stored relevant_digests.${name} must be lowercase sha256`);
    }
  }
  const atTime = options.at_time ?? new Date().toISOString();
  if (!canonicalTime(atTime)) errors.push("at_time must be a canonical ISO timestamp");
  const expired = errors.length === 0 && object.expires_at !== null && Date.parse(object.expires_at) <= Date.parse(atTime);
  return {
    valid: errors.length === 0,
    fresh: errors.length === 0 && !expired,
    expired,
    errors: unique(errors).sort(),
    object: errors.length === 0 ? object : null,
    object_path: objectPath
  };
}

function normalizeConsumer(contract, graphNodeIds = {}) {
  return {
    consumer_id: contract.id,
    consumer_kind: contract.kind,
    graph_node_id: graphNodeIds[contract.id] ?? null,
    condition: contract.condition,
    acknowledgement_state: "PENDING",
    acknowledged_object_digest: null,
    acknowledged_at: null,
    acknowledgement_digest: null,
    idempotency_key: null
  };
}

export function createConsumptionLedger(input) {
  const errors = [];
  if (!namedId(input?.run_id)) errors.push("run_id must be a named ID");
  if (!SHA256.test(input?.protocol_digest ?? "")) errors.push("protocol_digest must be lowercase sha256");
  if (!SHA256.test(input?.product_graph_digest ?? "")) errors.push("product_graph_digest must be lowercase sha256");
  errors.push(...validateGenerationBindings(input?.generation_bindings));
  if (!Array.isArray(input?.artifact_contracts) || input.artifact_contracts.length === 0) errors.push("artifact_contracts must be non-empty");
  if (errors.length > 0) return { valid: false, errors: unique(errors).sort() };

  const artifactIds = input.artifact_contracts.map((artifact) => artifact.id);
  if (unique(artifactIds).length !== artifactIds.length) errors.push("artifact_contracts contains duplicate IDs");
  const productionKeys = input.artifact_contracts.map((artifact) => artifact.idempotency_key);
  if (unique(productionKeys).length !== productionKeys.length) errors.push("artifact_contracts contains duplicate idempotency keys");
  const artifacts = input.artifact_contracts.map((contract) => {
    const graphNodeIds = input.consumer_graph_nodes?.[contract.id] ?? {};
    const pins = input.retention_pins?.[contract.id] ?? [];
    const invalidationNames = input.invalidation_input_names?.[contract.id] ?? [];
    return {
      artifact_id: contract.id,
      artifact_kind: contract.kind,
      source_digest: contract.source_digest,
      object_digest: null,
      producer_id: contract.producer_id,
      producer_task_id: input.producer_task_ids?.[contract.id] ?? null,
      outcome_ids: [...contract.outcome_ids],
      required_consumers: contract.consumer_ids.map((consumer) => normalizeConsumer(consumer, graphNodeIds)),
      invalidation_inputs: contract.invalidation_input_digests.map((value, index) => ({
        name: invalidationNames[index] ?? `input:${index}`,
        digest: value
      })),
      minimum_trust_level: input.minimum_trust_levels?.[contract.id] ?? "static",
      freshness: clone(contract.freshness),
      production_idempotency_key: contract.idempotency_key,
      invalidation_idempotency_key: null,
      retention: {
        class: contract.retention,
        pinned_by: clone(pins),
        legal_hold: Boolean(input.legal_holds?.includes(contract.id)),
        incident_hold: Boolean(input.incident_holds?.includes(contract.id)),
        retain_until: input.retain_until?.[contract.id] ?? null
      },
      state: "DECLARED",
      produced_at: null,
      invalidated_at: null,
      invalidation_reason: null
    };
  });
  const ledger = withLedgerDigest({
    schema_version: 2,
    run_id: input.run_id,
    generation_bindings: clone(input.generation_bindings),
    protocol_digest: input.protocol_digest,
    product_graph_digest: input.product_graph_digest,
    artifacts,
    progress_attempts: [],
    ledger_digest: ""
  });
  const validated = validateConsumptionLedger(ledger, input.validation_options ?? {});
  return validated.valid ? { valid: true, errors: [], ledger } : validated;
}

function derivedArtifactState(artifact) {
  if (artifact.invalidated_at !== null) return "INVALIDATED";
  if (artifact.object_digest === null) return "DECLARED";
  const consumers = artifact.required_consumers ?? [];
  const acknowledged = consumers.filter((consumer) => consumer.acknowledgement_state === "ACKNOWLEDGED").length;
  if (consumers.length > 0 && acknowledged === consumers.length) return "CONSUMED";
  if (acknowledged > 0) return "PARTIALLY_CONSUMED";
  return "PRODUCED";
}

export function validateConsumptionLedger(ledger, options = {}) {
  const errors = [...validate(LEDGER_SCHEMA, ledger).errors];
  if (!ledger || typeof ledger !== "object" || Array.isArray(ledger)) return { valid: false, errors: unique(errors.length ? errors : ["ledger must be an object"]).sort() };
  exactKeys(ledger, LEDGER_KEYS, "ledger", errors);
  errors.push(...validateGenerationBindings(ledger.generation_bindings));
  if (!namedId(ledger.run_id)) errors.push("run_id must be a named ID");
  if (!SHA256.test(ledger.protocol_digest ?? "")) errors.push("protocol_digest must be lowercase sha256");
  if (!SHA256.test(ledger.product_graph_digest ?? "")) errors.push("product_graph_digest must be lowercase sha256");
  if (calculateLedgerDigest(ledger) !== ledger.ledger_digest) errors.push("ledger digest mismatch");
  const artifactIds = new Set();
  const productionKeys = new Set();
  const acknowledgementKeys = new Set();
  const protocolArtifacts = new Map((options.protocol?.artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const graph = graphIndex(options.productGraph);

  if (options.protocolDigest && ledger.protocol_digest !== options.protocolDigest) errors.push("ledger protocol digest does not match resolved protocol");
  if (options.productGraphDigest && ledger.product_graph_digest !== options.productGraphDigest) errors.push("ledger product graph digest does not match resolved graph");
  if (options.productGraph?.generation_bindings && !sameGenerationBindings(ledger.generation_bindings, options.productGraph.generation_bindings)) {
    errors.push("ledger generation bindings do not match product graph");
  }
  if (options.protocol?.generation_bindings && !sameGenerationBindings(ledger.generation_bindings, options.protocol.generation_bindings)) {
    errors.push("ledger generation bindings do not match protocol");
  }

  for (const [index, artifact] of (ledger.artifacts ?? []).entries()) {
    const label = `artifacts[${index}]`;
    exactKeys(artifact, ARTIFACT_KEYS, label, errors);
    if (!namedId(artifact.artifact_id)) errors.push(`${label}.artifact_id must be a named ID`);
    if (typeof artifact.artifact_kind !== "string" || artifact.artifact_kind === "") errors.push(`${label}.artifact_kind must be non-empty`);
    if (!SHA256.test(artifact.source_digest ?? "")) errors.push(`${label}.source_digest must be lowercase sha256`);
    if (artifactIds.has(artifact.artifact_id)) errors.push(`duplicate artifact ${artifact.artifact_id}`);
    artifactIds.add(artifact.artifact_id);
    if (artifact.object_digest !== null && !SHA256.test(artifact.object_digest ?? "")) errors.push(`${label}.object_digest must be null or lowercase sha256`);
    if (!namedId(artifact.producer_id)) errors.push(`${label}.producer_id must be a named ID`);
    if (artifact.producer_task_id !== null && !namedId(artifact.producer_task_id)) errors.push(`${label}.producer_task_id must be null or a named ID`);
    if (productionKeys.has(artifact.production_idempotency_key)) errors.push(`duplicate production idempotency key ${artifact.production_idempotency_key}`);
    productionKeys.add(artifact.production_idempotency_key);
    if (!(artifact.minimum_trust_level in TRUST_RANK)) errors.push(`${label}.minimum_trust_level is invalid`);
    if (!Array.isArray(artifact.required_consumers) || artifact.required_consumers.length === 0) errors.push(`${label} has no required consumers`);
    const consumerIds = new Set();
    for (const [consumerIndex, consumer] of (artifact.required_consumers ?? []).entries()) {
      const consumerLabel = `${label}.required_consumers[${consumerIndex}]`;
      exactKeys(consumer, CONSUMER_KEYS, consumerLabel, errors);
      if (!namedId(consumer.consumer_id)) errors.push(`${consumerLabel}.consumer_id must be a named ID`);
      if (consumerIds.has(consumer.consumer_id)) errors.push(`${label} has duplicate consumer ${consumer.consumer_id}`);
      consumerIds.add(consumer.consumer_id);
      if (!(consumer.condition in CONDITION_RANK)) errors.push(`${consumerLabel}.condition is invalid`);
      if (consumer.graph_node_id !== null && options.productGraph) graphNode(graph, consumer.graph_node_id, null, `${consumerLabel}.graph_node_id`, errors);
      if (consumer.idempotency_key !== null) {
        if (acknowledgementKeys.has(consumer.idempotency_key)) errors.push(`duplicate acknowledgement idempotency key ${consumer.idempotency_key}`);
        acknowledgementKeys.add(consumer.idempotency_key);
      }
      if (consumer.acknowledgement_state === "ACKNOWLEDGED") {
        if (consumer.acknowledged_object_digest !== artifact.object_digest) errors.push(`${consumerLabel} acknowledges the wrong object`);
        if (!canonicalTime(consumer.acknowledged_at)) errors.push(`${consumerLabel}.acknowledged_at is invalid`);
        const expected = contentDigest({
          artifact_id: artifact.artifact_id,
          object_digest: artifact.object_digest,
          consumer_id: consumer.consumer_id,
          condition: consumer.condition,
          acknowledged_at: consumer.acknowledged_at,
          generation_bindings: ledger.generation_bindings,
          product_graph_digest: ledger.product_graph_digest
        });
        if (consumer.acknowledgement_digest !== expected) errors.push(`${consumerLabel}.acknowledgement_digest mismatch`);
      } else if (consumer.acknowledgement_state === "PENDING") {
        for (const field of ["acknowledged_object_digest", "acknowledged_at", "acknowledgement_digest", "idempotency_key"]) {
          if (consumer[field] !== null) errors.push(`${consumerLabel}.${field} must be null while pending`);
        }
      }
    }
    const inputNames = artifact.invalidation_inputs?.map((item) => item.name) ?? [];
    if (unique(inputNames).length !== inputNames.length) errors.push(`${label} has duplicate invalidation input names`);
    for (const item of artifact.invalidation_inputs ?? []) {
      exactKeys(item, new Set(["name", "digest"]), `${label}.invalidation_inputs`, errors);
      if (!namedId(item.name) || !SHA256.test(item.digest ?? "")) errors.push(`${label} has an invalid invalidation input`);
    }
    exactKeys(artifact.freshness, new Set(["mode", "max_age_seconds"]), `${label}.freshness`, errors);
    if (artifact.freshness?.mode === "IMMUTABLE" && artifact.freshness.max_age_seconds !== null) errors.push(`${label} immutable freshness must have null max_age_seconds`);
    if (artifact.freshness?.mode !== "IMMUTABLE" && (!Number.isInteger(artifact.freshness?.max_age_seconds) || artifact.freshness.max_age_seconds < 1)) {
      errors.push(`${label} expiring freshness requires positive max_age_seconds`);
    }
    if (artifact.produced_at !== null && !canonicalTime(artifact.produced_at)) errors.push(`${label}.produced_at is invalid`);
    if (artifact.invalidation_idempotency_key !== null && !namedId(artifact.invalidation_idempotency_key)) errors.push(`${label}.invalidation_idempotency_key must be null or a named ID`);
    if (artifact.invalidated_at !== null && !canonicalTime(artifact.invalidated_at)) errors.push(`${label}.invalidated_at is invalid`);
    if (artifact.state !== derivedArtifactState(artifact)) errors.push(`${label}.state does not match its production/acknowledgement/invalidation state`);
    if (artifact.retention?.retain_until !== null && !canonicalTime(artifact.retention.retain_until)) errors.push(`${label}.retention.retain_until is invalid`);
    exactKeys(artifact.retention, new Set(["class", "pinned_by", "legal_hold", "incident_hold", "retain_until"]), `${label}.retention`, errors);
    for (const pin of artifact.retention?.pinned_by ?? []) {
      exactKeys(pin, new Set(["kind", "id", "digest"]), `${label}.retention.pinned_by`, errors);
      if (!namedId(pin.id) || !SHA256.test(pin.digest ?? "")) errors.push(`${label} has an invalid retention pin`);
    }

    const declared = protocolArtifacts.get(artifact.artifact_id);
    if (options.protocol && !declared) errors.push(`${label} does not resolve to a protocol artifact`);
    if (declared) {
      if (artifact.producer_id !== declared.producer_id) errors.push(`${label}.producer_id differs from protocol`);
      if (artifact.artifact_kind !== declared.kind) errors.push(`${label}.artifact_kind differs from protocol`);
      if (artifact.source_digest !== declared.source_digest) errors.push(`${label}.source_digest differs from protocol`);
      if (!arraysEqual(artifact.outcome_ids, declared.outcome_ids)) errors.push(`${label}.outcome_ids differ from protocol`);
      if (!arraysEqual((artifact.required_consumers ?? []).map((consumer) => consumer.consumer_id), (declared.consumer_ids ?? []).map((consumer) => consumer.id))) {
        errors.push(`${label}.required_consumers differ from protocol`);
      }
      for (const consumer of artifact.required_consumers ?? []) {
        const expected = (declared.consumer_ids ?? []).find((item) => item.id === consumer.consumer_id);
        if (expected && (consumer.consumer_kind !== expected.kind || consumer.condition !== expected.condition)) errors.push(`${label} consumer ${consumer.consumer_id} differs from protocol`);
      }
      if (!arraysEqual((artifact.invalidation_inputs ?? []).map((item) => item.digest), declared.invalidation_input_digests ?? [])) errors.push(`${label}.invalidation_inputs differ from protocol`);
      if (artifact.production_idempotency_key !== declared.idempotency_key) errors.push(`${label}.production_idempotency_key differs from protocol`);
      if (artifact.retention?.class !== declared.retention) errors.push(`${label}.retention.class differs from protocol`);
      if (stable(artifact.freshness) !== stable(declared.freshness)) errors.push(`${label}.freshness differs from protocol`);
    }
    if (options.productGraph) {
      for (const outcomeId of artifact.outcome_ids ?? []) graphNode(graph, outcomeId, new Set(["OUTCOME"]), `${label}.outcome_ids`, errors);
    }
  }
  if (options.protocol) {
    for (const id of protocolArtifacts.keys()) if (!artifactIds.has(id)) errors.push(`ledger omitted protocol artifact ${id}`);
  }

  const attemptIds = new Set();
  for (const [index, attempt] of (ledger.progress_attempts ?? []).entries()) {
    const label = `progress_attempts[${index}]`;
    exactKeys(attempt, ATTEMPT_KEYS, label, errors);
    if (attemptIds.has(attempt.idempotency_key)) errors.push(`duplicate progress idempotency key ${attempt.idempotency_key}`);
    attemptIds.add(attempt.idempotency_key);
    for (const field of ["prior_state_digest", "next_state_digest", "causal_fingerprint", "attempt_digest"]) {
      if (!SHA256.test(attempt[field] ?? "")) errors.push(`${label}.${field} must be lowercase sha256`);
    }
    if (!canonicalTime(attempt.recorded_at)) errors.push(`${label}.recorded_at is invalid`);
    for (const [refIndex, ref] of (attempt.evidence_refs ?? []).entries()) {
      exactKeys(ref, new Set(["object_digest", "artifact_id", "graph_node_id", "consumer_id", "role"]), `${label}.evidence_refs[${refIndex}]`, errors);
      if (!SHA256.test(ref.object_digest ?? "") || !namedId(ref.artifact_id) || !namedId(ref.graph_node_id) || !namedId(ref.consumer_id)) errors.push(`${label}.evidence_refs[${refIndex}] is invalid`);
    }
    for (const [rowIndex, row] of (attempt.resolved_obligations ?? []).entries()) {
      exactKeys(row, new Set(["graph_node_id", "prior_status", "resolution_evidence_digest", "consumer_id"]), `${label}.resolved_obligations[${rowIndex}]`, errors);
      if (!namedId(row.graph_node_id) || !SHA256.test(row.resolution_evidence_digest ?? "") || !namedId(row.consumer_id)) errors.push(`${label}.resolved_obligations[${rowIndex}] is invalid`);
    }
    for (const [rowIndex, row] of (attempt.authorized_decisions ?? []).entries()) {
      exactKeys(row, new Set(["decision_node_id", "authority_digest"]), `${label}.authorized_decisions[${rowIndex}]`, errors);
      if (!namedId(row.decision_node_id) || !SHA256.test(row.authority_digest ?? "")) errors.push(`${label}.authorized_decisions[${rowIndex}] is invalid`);
    }
    for (const [rowIndex, row] of (attempt.uncertainty_reductions ?? []).entries()) {
      exactKeys(row, new Set(["graph_node_id", "before", "after", "evidence_object_digest", "consumer_id"]), `${label}.uncertainty_reductions[${rowIndex}]`, errors);
      if (!namedId(row.graph_node_id) || !SHA256.test(row.evidence_object_digest ?? "") || !namedId(row.consumer_id)) errors.push(`${label}.uncertainty_reductions[${rowIndex}] is invalid`);
    }
    if (contentDigest(payloadWithoutDigest(attempt, "attempt_digest")) !== attempt.attempt_digest) errors.push(`${label}.attempt_digest mismatch`);
  }
  return { valid: errors.length === 0, errors: unique(errors).sort(), ledger: errors.length === 0 ? ledger : null };
}

function resolveArtifactObject(ledger, artifact, storeRoot, atTime) {
  const errors = [];
  const resolved = readCasEvidence(storeRoot, artifact.object_digest, { at_time: atTime });
  if (!resolved.valid) return resolved;
  const object = resolved.object;
  if (!sameGenerationBindings(object.generation_bindings, ledger.generation_bindings)) errors.push("evidence generation bindings do not match ledger");
  if (object.producer_id !== artifact.producer_id) errors.push("evidence producer does not match declared producer");
  if (object.kind !== artifact.artifact_kind) errors.push("evidence kind does not match declared artifact kind");
  if (!arraysEqual(object.consumer_ids ?? [], artifact.required_consumers.map((consumer) => consumer.consumer_id))) errors.push("evidence consumers do not match all required named consumers");
  if (object.subject !== artifact.artifact_id && object.payload?.artifact_id !== artifact.artifact_id) errors.push("evidence does not bind the declared artifact ID");
  const boundGraph = object.relevant_digests?.product_graph_digest ?? object.payload?.product_graph_digest;
  const boundProtocol = object.relevant_digests?.protocol_digest ?? object.payload?.protocol_digest;
  if (boundGraph !== ledger.product_graph_digest) errors.push("evidence does not bind the ledger product graph digest");
  if (boundProtocol !== ledger.protocol_digest) errors.push("evidence does not bind the ledger protocol digest");
  if (object.relevant_digests?.source_digest !== artifact.source_digest) errors.push("evidence does not bind the artifact source digest");
  for (const input of artifact.invalidation_inputs) {
    if (object.relevant_digests?.[input.name] !== input.digest) errors.push(`evidence has stale or missing invalidation input ${input.name}`);
  }
  if (TRUST_RANK[object.trust_level] < TRUST_RANK[artifact.minimum_trust_level]) errors.push(`evidence trust ${object.trust_level} is below ${artifact.minimum_trust_level}`);
  if (!resolved.fresh) errors.push("evidence is stale at the requested time");
  if (artifact.freshness.mode === "IMMUTABLE" && object.expires_at !== null) errors.push("immutable evidence must not expire");
  if (artifact.freshness.mode !== "IMMUTABLE" && canonicalTime(object.created_at)) {
    const contractExpiry = Date.parse(object.created_at) + artifact.freshness.max_age_seconds * 1000;
    if (Date.parse(atTime) >= contractExpiry) errors.push("evidence exceeded its contract freshness bound");
  }
  return { ...resolved, valid: errors.length === 0, fresh: errors.length === 0, errors: unique(errors).sort(), object: errors.length === 0 ? object : null };
}

export function recordEvidenceProduced(ledger, input, options = {}) {
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return validation;
  const artifact = ledger.artifacts.find((item) => item.artifact_id === input?.artifact_id);
  if (!artifact) return { valid: false, errors: ["artifact_id does not resolve in the consumption ledger"] };
  if (input.idempotency_key !== artifact.production_idempotency_key) return { valid: false, errors: ["production idempotency key does not match the artifact contract"] };
  if (!SHA256.test(input.object_digest ?? "")) return { valid: false, errors: ["object_digest must be lowercase sha256"] };
  if (!canonicalTime(input.produced_at)) return { valid: false, errors: ["produced_at must be a canonical ISO timestamp"] };
  if (artifact.object_digest !== null) {
    if (artifact.object_digest === input.object_digest && artifact.production_idempotency_key === input.idempotency_key) {
      const resolved = resolveArtifactObject(ledger, artifact, options.storeRoot, options.at_time ?? input.produced_at);
      return resolved.valid
        ? { valid: true, errors: [], idempotent: true, ledger, object: resolved.object, event_payload: producedEventPayload(ledger, artifact) }
        : resolved;
    }
    return { valid: false, errors: ["artifact was already produced with different evidence"] };
  }
  const candidateArtifact = { ...artifact, object_digest: input.object_digest };
  const resolved = resolveArtifactObject(ledger, candidateArtifact, options.storeRoot, input.produced_at);
  if (!resolved.valid) return resolved;
  const next = clone(ledger);
  const target = next.artifacts.find((item) => item.artifact_id === input.artifact_id);
  target.object_digest = input.object_digest;
  target.produced_at = input.produced_at;
  target.state = "PRODUCED";
  const updated = withLedgerDigest(next);
  return { valid: true, errors: [], idempotent: false, ledger: updated, object: resolved.object, event_payload: producedEventPayload(updated, target) };
}

function producedEventPayload(ledger, artifact) {
  return {
    artifact_id: artifact.artifact_id,
    object_digest: artifact.object_digest,
    idempotency_key: artifact.production_idempotency_key,
    produced_at: artifact.produced_at,
    producer_id: artifact.producer_id,
    consumer_ids: artifact.required_consumers.map((consumer) => consumer.consumer_id),
    ledger_digest: ledger.ledger_digest
  };
}

export function resolveEvidenceForConsumer(ledger, input, options = {}) {
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return validation;
  const artifact = ledger.artifacts.find((item) => item.artifact_id === input?.artifact_id);
  if (!artifact) return { valid: false, errors: ["artifact_id does not resolve in the consumption ledger"] };
  if (artifact.state === "DECLARED") return { valid: false, errors: ["artifact has not produced CAS evidence"] };
  if (artifact.state === "INVALIDATED") return { valid: false, errors: ["artifact evidence is invalidated"] };
  if (input.object_digest !== artifact.object_digest) return { valid: false, errors: ["requested object digest does not match the artifact"] };
  const consumer = artifact.required_consumers.find((item) => item.consumer_id === input.consumer_id);
  if (!consumer) return { valid: false, errors: ["consumer_id is not a required named consumer"] };
  if (input.condition !== consumer.condition) return { valid: false, errors: ["consumption condition does not match the consumer contract"] };
  if (consumer.graph_node_id !== null && options.productGraph) {
    const errors = [];
    graphNode(graphIndex(options.productGraph), consumer.graph_node_id, null, "consumer.graph_node_id", errors);
    if (errors.length) return { valid: false, errors };
  }
  const atTime = input.at_time ?? options.at_time ?? new Date().toISOString();
  if (!canonicalTime(atTime)) return { valid: false, errors: ["at_time must be a canonical ISO timestamp"] };
  const resolved = resolveArtifactObject(ledger, artifact, options.storeRoot, atTime);
  return resolved.valid ? { ...resolved, artifact, consumer } : resolved;
}

export function acknowledgeEvidenceConsumer(ledger, input, options = {}) {
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return validation;
  if (!namedId(input?.idempotency_key)) return { valid: false, errors: ["idempotency_key must be a named ID"] };
  if (!canonicalTime(input?.acknowledged_at)) return { valid: false, errors: ["acknowledged_at must be a canonical ISO timestamp"] };
  const collision = ledger.artifacts.flatMap((artifact) => artifact.required_consumers.map((consumer) => ({ artifact, consumer })))
    .find((row) => row.consumer.idempotency_key === input.idempotency_key);
  if (collision) {
    const exact = collision.artifact.artifact_id === input.artifact_id && collision.consumer.consumer_id === input.consumer_id &&
      collision.consumer.acknowledged_object_digest === input.object_digest && collision.consumer.acknowledged_at === input.acknowledged_at;
    if (!exact) return { valid: false, errors: ["acknowledgement idempotency key was reused with different input"] };
    const resolved = resolveArtifactObject(ledger, collision.artifact, options.storeRoot, input.acknowledged_at);
    return resolved.valid
      ? { valid: true, errors: [], idempotent: true, ledger, object: resolved.object, event_payload: acknowledgementEventPayload(ledger, input.artifact_id, collision.consumer) }
      : resolved;
  }
  const resolved = resolveEvidenceForConsumer(ledger, { ...input, at_time: input.acknowledged_at }, options);
  if (!resolved.valid) return resolved;
  const boundary = options.boundary_times?.[resolved.consumer.condition];
  if (boundary !== undefined && (!canonicalTime(boundary) || Date.parse(input.acknowledged_at) > Date.parse(boundary))) {
    return { valid: false, errors: ["consumer acknowledgement occurred after its required boundary"] };
  }
  const next = clone(ledger);
  const artifact = next.artifacts.find((item) => item.artifact_id === input.artifact_id);
  const consumer = artifact.required_consumers.find((item) => item.consumer_id === input.consumer_id);
  consumer.acknowledgement_state = "ACKNOWLEDGED";
  consumer.acknowledged_object_digest = input.object_digest;
  consumer.acknowledged_at = input.acknowledged_at;
  consumer.idempotency_key = input.idempotency_key;
  consumer.acknowledgement_digest = contentDigest({
    artifact_id: artifact.artifact_id,
    object_digest: artifact.object_digest,
    consumer_id: consumer.consumer_id,
    condition: consumer.condition,
    acknowledged_at: consumer.acknowledged_at,
    generation_bindings: next.generation_bindings,
    product_graph_digest: next.product_graph_digest
  });
  artifact.state = derivedArtifactState(artifact);
  const updated = withLedgerDigest(next);
  return { valid: true, errors: [], idempotent: false, ledger: updated, event_payload: acknowledgementEventPayload(updated, artifact.artifact_id, consumer) };
}

function acknowledgementEventPayload(ledger, artifactId, consumer) {
  return {
    artifact_id: artifactId,
    object_digest: consumer.acknowledged_object_digest,
    consumer_id: consumer.consumer_id,
    condition: consumer.condition,
    idempotency_key: consumer.idempotency_key,
    acknowledged_at: consumer.acknowledged_at,
    acknowledgement_digest: consumer.acknowledgement_digest,
    ledger_digest: ledger.ledger_digest
  };
}

export function invalidateEvidenceArtifact(ledger, input, options = {}) {
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return validation;
  if (!namedId(input?.idempotency_key)) return { valid: false, errors: ["idempotency_key must be a named ID"] };
  if (!canonicalTime(input?.invalidated_at)) return { valid: false, errors: ["invalidated_at must be a canonical ISO timestamp"] };
  if (typeof input?.reason !== "string" || input.reason.trim() === "") return { valid: false, errors: ["invalidation reason must be non-empty"] };
  const artifact = ledger.artifacts.find((item) => item.artifact_id === input?.artifact_id);
  if (!artifact) return { valid: false, errors: ["artifact_id does not resolve in the consumption ledger"] };
  if (artifact.state === "DECLARED") return { valid: false, errors: ["unproduced evidence cannot be invalidated"] };
  if (artifact.state === "INVALIDATED") {
    const exact = artifact.invalidation_idempotency_key === input.idempotency_key && artifact.invalidation_reason === input.reason && artifact.invalidated_at === input.invalidated_at;
    return exact ? { valid: true, errors: [], idempotent: true, ledger } : { valid: false, errors: ["artifact was already invalidated differently"] };
  }
  if (!Array.isArray(input.changed_inputs) || input.changed_inputs.length === 0) return { valid: false, errors: ["invalidation requires changed_inputs"] };
  const declared = new Map(artifact.invalidation_inputs.map((item) => [item.name, item.digest]));
  const errors = [];
  let changed = false;
  for (const item of input.changed_inputs) {
    if (!declared.has(item?.name)) errors.push(`invalidation input ${item?.name} is not declared`);
    else if (!SHA256.test(item?.digest ?? "")) errors.push(`invalidation input ${item.name} digest is invalid`);
    else if (declared.get(item.name) !== item.digest) changed = true;
  }
  if (!changed) errors.push("invalidation inputs do not prove a relevant digest change");
  if (errors.length) return { valid: false, errors: unique(errors).sort() };
  const next = clone(ledger);
  const target = next.artifacts.find((item) => item.artifact_id === input.artifact_id);
  target.invalidated_at = input.invalidated_at;
  target.invalidation_reason = input.reason;
  target.invalidation_idempotency_key = input.idempotency_key;
  target.state = "INVALIDATED";
  for (const consumer of target.required_consumers) consumer.acknowledgement_state = "INVALIDATED";
  const updated = withLedgerDigest(next);
  return {
    valid: true,
    errors: [],
    idempotent: false,
    ledger: updated,
    event_payload: {
      artifact_id: target.artifact_id,
      object_digest: target.object_digest,
      reason: target.invalidation_reason,
      changed_inputs: clone(input.changed_inputs),
      ledger_digest: updated.ledger_digest
    }
  };
}

export function evaluateConsumptionCloseout(ledger, options = {}) {
  const condition = options.condition ?? "BEFORE_DELIVERY_CLOSE";
  if (!(condition in CONDITION_RANK)) return { valid: false, closed: false, errors: ["unknown closeout condition"] };
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return { ...validation, closed: false };
  const required = [];
  const missing = [];
  const acknowledgedProductTerminals = [];
  for (const artifact of ledger.artifacts) {
    for (const consumer of artifact.required_consumers) {
      if (CONDITION_RANK[consumer.condition] > CONDITION_RANK[condition]) continue;
      const row = { artifact_id: artifact.artifact_id, consumer_id: consumer.consumer_id, condition: consumer.condition };
      required.push(row);
      if (artifact.state === "INVALIDATED" || consumer.acknowledgement_state !== "ACKNOWLEDGED") missing.push(row);
      else if (PRODUCT_TERMINAL_KINDS.has(consumer.consumer_kind)) acknowledgedProductTerminals.push(row);
    }
  }
  if (CONDITION_RANK[condition] >= CONDITION_RANK.BEFORE_DELIVERY_CLOSE && acknowledgedProductTerminals.length === 0) {
    missing.push({ artifact_id: null, consumer_id: null, condition, reason: "no acknowledged customer/owner/operations/metric product terminal" });
  }
  return {
    valid: true,
    closed: missing.length === 0,
    condition,
    required,
    missing,
    acknowledged_product_terminals: acknowledgedProductTerminals
  };
}

export function evaluateTaskContribution(ledger, input, options = {}) {
  const status = input?.task_status;
  const artifactIds = input?.required_artifact_ids;
  if (!Array.isArray(artifactIds) || artifactIds.length === 0) return { valid: false, terminal: false, errors: ["required_artifact_ids must be non-empty"] };
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return { ...validation, terminal: false };
  const missingArtifacts = artifactIds.filter((id) => !ledger.artifacts.some((artifact) => artifact.artifact_id === id));
  if (missingArtifacts.length) return { valid: false, terminal: false, errors: missingArtifacts.map((id) => `unknown required artifact ${id}`) };
  const unconsumed = artifactIds.filter((id) => ledger.artifacts.find((artifact) => artifact.artifact_id === id).state !== "CONSUMED");
  if (status === "ACCEPTED") return { valid: true, terminal: false, next_status: unconsumed.length === 0 ? "CONSUMED" : "ACCEPTED", unconsumed_artifact_ids: unconsumed };
  if (status === "CONSUMED" && unconsumed.length > 0) return { valid: false, terminal: false, errors: ["task claims CONSUMED before all required outputs were consumed"], unconsumed_artifact_ids: unconsumed };
  return { valid: true, terminal: status === "CONSUMED", next_status: status, unconsumed_artifact_ids: unconsumed };
}

function artifactForEvidence(ledger, objectDigest, consumerId) {
  return ledger.artifacts.find((artifact) => artifact.object_digest === objectDigest && artifact.required_consumers.some((consumer) =>
    consumer.consumer_id === consumerId && consumer.acknowledgement_state === "ACKNOWLEDGED" && consumer.acknowledged_object_digest === objectDigest));
}

function objectBindsGraphNode(object, graphNodeId) {
  return object.subject === graphNodeId || object.payload?.graph_node_id === graphNodeId || object.payload?.product_graph_node_id === graphNodeId ||
    (Array.isArray(object.payload?.product_graph_node_ids) && object.payload.product_graph_node_ids.includes(graphNodeId));
}

function resolveConsumedProgressEvidence(ledger, objectDigest, consumerId, options, label, errors) {
  const artifact = artifactForEvidence(ledger, objectDigest, consumerId);
  if (!artifact) {
    errors.push(`${label} does not resolve to CAS evidence acknowledged by the named consumer`);
    return null;
  }
  const consumer = artifact.required_consumers.find((item) => item.consumer_id === consumerId);
  const resolved = resolveEvidenceForConsumer(ledger, {
    artifact_id: artifact.artifact_id,
    object_digest: objectDigest,
    consumer_id: consumerId,
    condition: consumer.condition,
    at_time: options.at_time
  }, options);
  if (!resolved.valid) errors.push(...resolved.errors.map((error) => `${label}: ${error}`));
  return resolved.valid ? { artifact, object: resolved.object } : null;
}

function alreadyCounted(ledger, selector) {
  return ledger.progress_attempts.filter((attempt) => attempt.accepted).some(selector);
}

export function evaluateCausalProgress(ledger, input, options = {}) {
  const errors = [];
  const reasons = [];
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return { valid: false, accepted: false, errors: validation.errors, reason_codes: ["INVALID_LEDGER"] };
  exactKeys(input, PROGRESS_KEYS, "progress", errors);
  for (const key of Object.keys(input ?? {})) if (FORBIDDEN_PROGRESS_KEYS.has(key)) errors.push(`progress cannot be proven by ${key}`);
  if (!namedId(input?.idempotency_key)) errors.push("progress.idempotency_key must be a named ID");
  for (const field of ["prior_state_digest", "next_state_digest", "causal_fingerprint"]) {
    if (!SHA256.test(input?.[field] ?? "")) errors.push(`progress.${field} must be lowercase sha256`);
  }
  const recordedAt = input?.recorded_at ?? options.at_time;
  if (!canonicalTime(recordedAt)) errors.push("progress.recorded_at must be a canonical ISO timestamp");
  if (options.expected_prior_state_digest && input?.prior_state_digest !== options.expected_prior_state_digest) errors.push("progress prior state is stale");
  for (const field of ["evidence_refs", "resolved_obligations", "authorized_decisions", "uncertainty_reductions"]) {
    if (!Array.isArray(input?.[field])) errors.push(`progress.${field} must be an array`);
  }
  if (errors.length) return { valid: false, accepted: false, errors: unique(errors).sort(), reason_codes: ["MALFORMED_PROGRESS_CLAIM"] };

  const sameCausalState = ledger.progress_attempts.find((attempt) =>
    attempt.prior_state_digest === input.prior_state_digest && attempt.causal_fingerprint === input.causal_fingerprint);
  if (sameCausalState) {
    return { valid: false, accepted: false, errors: ["same relevant state and causal fingerprint cannot rerun"], reason_codes: ["DUPLICATE_CAUSAL_STATE"], prior_attempt: sameCausalState };
  }

  const graph = graphIndex(options.productGraph);
  let proven = 0;
  for (const [index, ref] of input.evidence_refs.entries()) {
    const label = `evidence_refs[${index}]`;
    exactKeys(ref, new Set(["object_digest", "artifact_id", "graph_node_id", "consumer_id", "role"]), label, errors);
    if (!new Set(["NEW_EVIDENCE", "STATE_CHANGE"]).has(ref?.role)) errors.push(`${label}.role is invalid`);
    const allowed = ref?.role === "STATE_CHANGE"
      ? new Set(["CODE", "TASK", "FINAL_SHA", "RELEASE", "OBSERVATION", "OPERATIONS", "EVIDENCE"])
      : new Set(["EVIDENCE", "EVIDENCE_CLAIM", "OBSERVED_DELTA", "RELEASE_PROBE", "FINAL_REVIEW", "ROLLBACK_PROOF", "OBSERVATION"]);
    const node = graphNode(graph, ref?.graph_node_id, allowed, `${label}.graph_node_id`, errors);
    const resolved = resolveConsumedProgressEvidence(ledger, ref?.object_digest, ref?.consumer_id, { ...options, at_time: recordedAt }, label, errors);
    if (resolved && resolved.artifact.artifact_id !== ref.artifact_id) errors.push(`${label}.artifact_id does not match resolved CAS evidence`);
    if (resolved && node && !objectBindsGraphNode(resolved.object, node.id)) errors.push(`${label} CAS object does not bind the resolved graph node`);
    const used = alreadyCounted(ledger, (attempt) => attempt.evidence_refs.some((item) => item.object_digest === ref.object_digest && item.role === ref.role));
    if (resolved && node && !used) {
      if (ref.role !== "STATE_CHANGE" || input.next_state_digest !== input.prior_state_digest) proven += 1;
      else errors.push(`${label} claims a state change without a changed relevant state digest`);
    }
  }

  for (const [index, obligation] of input.resolved_obligations.entries()) {
    const label = `resolved_obligations[${index}]`;
    exactKeys(obligation, new Set(["graph_node_id", "prior_status", "resolution_evidence_digest", "consumer_id"]), label, errors);
    const node = graphNode(graph, obligation?.graph_node_id, new Set(["LAYER_OBLIGATION", "AC", "AUTHORITY", "FAILURE_BEHAVIOR", "UNCERTAINTY"]), `${label}.graph_node_id`, errors);
    if (obligation?.prior_status !== "OPEN") errors.push(`${label}.prior_status must be OPEN`);
    if (node && node.status !== "RESOLVED") errors.push(`${label} graph node is not RESOLVED`);
    const resolved = resolveConsumedProgressEvidence(ledger, obligation?.resolution_evidence_digest, obligation?.consumer_id, { ...options, at_time: recordedAt }, label, errors);
    const used = alreadyCounted(ledger, (attempt) => attempt.resolved_obligations.some((item) => item.graph_node_id === obligation.graph_node_id));
    if (node && resolved && !used) proven += 1;
  }

  for (const [index, decision] of input.authorized_decisions.entries()) {
    const label = `authorized_decisions[${index}]`;
    exactKeys(decision, new Set(["decision_node_id", "authority_digest"]), label, errors);
    const node = graphNode(graph, decision?.decision_node_id, new Set(["DECISION", "FOUNDER_DECISION"]), `${label}.decision_node_id`, errors);
    const record = options.protocol?.decision_record;
    if (!record) errors.push(`${label} cannot resolve without protocol decision authority`);
    else {
      const matchesId = record.id === decision.decision_node_id || node?.attributes?.decision_record_id === record.id;
      if (!matchesId) errors.push(`${label} does not resolve to the protocol decision record`);
      if (record.authority_digest !== decision.authority_digest) errors.push(`${label}.authority_digest does not match decision authority`);
    }
    const used = alreadyCounted(ledger, (attempt) => attempt.authorized_decisions.some((item) => item.decision_node_id === decision.decision_node_id && item.authority_digest === decision.authority_digest));
    if (node && record && record.authority_digest === decision.authority_digest && !used) proven += 1;
  }

  for (const [index, reduction] of input.uncertainty_reductions.entries()) {
    const label = `uncertainty_reductions[${index}]`;
    exactKeys(reduction, new Set(["graph_node_id", "before", "after", "evidence_object_digest", "consumer_id"]), label, errors);
    const node = graphNode(graph, reduction?.graph_node_id, new Set(["UNCERTAINTY"]), `${label}.graph_node_id`, errors);
    if (typeof reduction?.before !== "number" || typeof reduction?.after !== "number" || reduction.after < 0 || reduction.after >= reduction.before) {
      errors.push(`${label} must prove a non-negative measured uncertainty reduction`);
    }
    const resolved = resolveConsumedProgressEvidence(ledger, reduction?.evidence_object_digest, reduction?.consumer_id, { ...options, at_time: recordedAt }, label, errors);
    const priorFloor = ledger.progress_attempts.filter((attempt) => attempt.accepted)
      .flatMap((attempt) => attempt.uncertainty_reductions).filter((item) => item.graph_node_id === reduction.graph_node_id)
      .reduce((minimum, item) => Math.min(minimum, item.after), Number.POSITIVE_INFINITY);
    if (Number.isFinite(priorFloor) && reduction.after >= priorFloor) errors.push(`${label} does not reduce uncertainty below the already-counted value`);
    if (node && resolved && reduction.after < reduction.before && (!Number.isFinite(priorFloor) || reduction.after < priorFloor)) proven += 1;
  }

  if (proven === 0) {
    errors.push("progress must resolve new consumed CAS evidence, a relevant state change, a resolved graph obligation, an authorized decision, or measured uncertainty reduction");
    reasons.push("NO_RESOLVED_CAUSAL_PROGRESS");
  }
  if (errors.length === 0) reasons.push("RESOLVED_CAUSAL_PROGRESS");
  return { valid: errors.length === 0, accepted: errors.length === 0, errors: unique(errors).sort(), reason_codes: reasons, proven_progress_count: proven };
}

function normalizedProgressAttempt(input, evaluation, recordedAt) {
  const attempt = {
    idempotency_key: input.idempotency_key,
    prior_state_digest: input.prior_state_digest,
    next_state_digest: input.next_state_digest,
    causal_fingerprint: input.causal_fingerprint,
    evidence_refs: clone(input.evidence_refs),
    resolved_obligations: clone(input.resolved_obligations),
    authorized_decisions: clone(input.authorized_decisions),
    uncertainty_reductions: clone(input.uncertainty_reductions),
    accepted: evaluation.accepted,
    reason_codes: clone(evaluation.reason_codes),
    recorded_at: recordedAt,
    attempt_digest: ""
  };
  attempt.attempt_digest = contentDigest(payloadWithoutDigest(attempt, "attempt_digest"));
  return attempt;
}

export function recordCausalProgress(ledger, input, options = {}) {
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return { ...validation, accepted: false, reason_codes: ["INVALID_LEDGER"] };
  const existing = ledger.progress_attempts?.find((attempt) => attempt.idempotency_key === input?.idempotency_key);
  if (existing) {
    const comparable = normalizedProgressAttempt(input, { accepted: existing.accepted, reason_codes: existing.reason_codes }, input.recorded_at ?? options.at_time);
    return comparable.attempt_digest === existing.attempt_digest
      ? { valid: existing.accepted, accepted: existing.accepted, idempotent: true, ledger, attempt: existing, errors: existing.accepted ? [] : ["previous causal progress attempt was rejected"], reason_codes: existing.reason_codes }
      : { valid: false, accepted: false, errors: ["progress idempotency key was reused with different input"], reason_codes: ["IDEMPOTENCY_CONFLICT"] };
  }
  const recordedAt = input?.recorded_at ?? options.at_time;
  const evaluation = evaluateCausalProgress(ledger, { ...input, recorded_at: recordedAt }, { ...options, at_time: recordedAt });
  if (evaluation.reason_codes?.includes("MALFORMED_PROGRESS_CLAIM") || evaluation.reason_codes?.includes("INVALID_LEDGER") || evaluation.reason_codes?.includes("DUPLICATE_CAUSAL_STATE")) {
    return { ...evaluation, idempotent: false, ledger };
  }
  const attempt = normalizedProgressAttempt({ ...input, recorded_at: recordedAt }, evaluation, recordedAt);
  const next = clone(ledger);
  next.progress_attempts.push(attempt);
  const updated = withLedgerDigest(next);
  return {
    ...evaluation,
    idempotent: false,
    ledger: updated,
    attempt,
    event_payload: {
      accepted: attempt.accepted,
      attempt_digest: attempt.attempt_digest,
      prior_state_digest: attempt.prior_state_digest,
      next_state_digest: attempt.next_state_digest,
      causal_fingerprint: attempt.causal_fingerprint,
      reason_codes: attempt.reason_codes,
      progress_input: {
        idempotency_key: attempt.idempotency_key,
        prior_state_digest: attempt.prior_state_digest,
        next_state_digest: attempt.next_state_digest,
        causal_fingerprint: attempt.causal_fingerprint,
        evidence_refs: clone(attempt.evidence_refs),
        resolved_obligations: clone(attempt.resolved_obligations),
        authorized_decisions: clone(attempt.authorized_decisions),
        uncertainty_reductions: clone(attempt.uncertainty_reductions),
        recorded_at: attempt.recorded_at
      },
      ledger_digest: updated.ledger_digest
    }
  };
}

export function replayConsumptionLedgerEvents(initialLedger, events, options = {}) {
  let ledger = clone(initialLedger);
  const errors = [];
  const applied = [];
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return { valid: false, errors: validation.errors, ledger: null, applied };
  for (const [index, event] of (events ?? []).entries()) {
    let result = null;
    if (event.type === "EVIDENCE_PRODUCED") {
      result = recordEvidenceProduced(ledger, {
        artifact_id: event.payload?.artifact_id,
        object_digest: event.payload?.object_digest,
        idempotency_key: event.payload?.idempotency_key,
        produced_at: event.payload?.produced_at
      }, options);
    } else if (event.type === "EVIDENCE_CONSUMED") {
      result = acknowledgeEvidenceConsumer(ledger, {
        artifact_id: event.payload?.artifact_id,
        object_digest: event.payload?.object_digest,
        consumer_id: event.payload?.consumer_id,
        condition: event.payload?.condition,
        idempotency_key: event.payload?.idempotency_key,
        acknowledged_at: event.payload?.acknowledged_at
      }, options);
    } else if (event.type === "CAUSAL_PROGRESS_RECORDED") {
      result = recordCausalProgress(ledger, event.payload?.progress_input, options);
    } else continue;
    if (!result?.valid) {
      errors.push(...(result?.errors ?? [`event ${index + 1} cannot reconstruct the consumption ledger`]).map(error => `events[${index}] ${error}`));
      break;
    }
    if (result.ledger.ledger_digest !== event.payload?.ledger_digest) {
      errors.push(`events[${index}] reconstructed ledger digest does not match journal payload`);
      break;
    }
    ledger = result.ledger;
    applied.push({ sequence: event.sequence ?? index + 1, type: event.type, ledger_digest: ledger.ledger_digest });
  }
  return { valid: errors.length === 0, errors: unique(errors).sort(), ledger: errors.length ? null : ledger, applied };
}

function scanDigests(value, output = new Set()) {
  if (typeof value === "string" && SHA256.test(value)) output.add(value);
  else if (Array.isArray(value)) for (const item of value) scanDigests(item, output);
  else if (value && typeof value === "object") for (const item of Object.values(value)) scanDigests(item, output);
  return output;
}

function enumerateCasObjects(storeRoot) {
  const root = path.join(path.resolve(storeRoot), "objects", "sha256");
  if (!fs.existsSync(root)) return [];
  const rootStat = fs.lstatSync(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return [];
  const rows = [];
  for (const prefix of fs.readdirSync(root)) {
    if (!/^[a-f0-9]{2}$/.test(prefix)) continue;
    const directory = path.join(root, prefix);
    if (!fs.lstatSync(directory).isDirectory()) continue;
    for (const name of fs.readdirSync(directory)) {
      const match = /^([a-f0-9]{64})\.json$/.exec(name);
      if (!match || !match[1].startsWith(prefix)) continue;
      const objectPath = path.join(directory, name);
      const objectStat = fs.lstatSync(objectPath);
      if (objectStat.isFile() && !objectStat.isSymbolicLink() && fs.realpathSync(objectPath) === path.resolve(objectPath)) {
        rows.push({ object_digest: match[1], object_path: objectPath });
      }
    }
  }
  return rows.sort((left, right) => left.object_digest.localeCompare(right.object_digest));
}

function retentionPinReasons(artifact, atTime) {
  const reasons = [];
  if (new Set(["RELEASE", "AUDIT", "PRODUCT_LIFETIME"]).has(artifact.retention.class)) reasons.push(`retention:${artifact.retention.class}`);
  if (artifact.retention.legal_hold) reasons.push("legal-hold");
  if (artifact.retention.incident_hold) reasons.push("incident-hold");
  if (artifact.retention.pinned_by.length > 0) reasons.push(...artifact.retention.pinned_by.map((pin) => `pin:${pin.kind}:${pin.id}`));
  if (artifact.retention.retain_until !== null && Date.parse(artifact.retention.retain_until) > Date.parse(atTime)) reasons.push("retain-until");
  if (artifact.required_consumers.some((consumer) => consumer.acknowledgement_state === "PENDING")) reasons.push("required-consumer-pending");
  return reasons;
}

export function planEvidenceGarbageCollection(storeRoot, ledger, options = {}) {
  const atTime = options.at_time ?? new Date().toISOString();
  if (!canonicalTime(atTime)) return { valid: false, errors: ["at_time must be a canonical ISO timestamp"] };
  const validation = validateConsumptionLedger(ledger, options);
  if (!validation.valid) return validation;
  const objects = enumerateCasObjects(storeRoot);
  const objectSet = new Set(objects.map((row) => row.object_digest));
  const reasons = new Map();
  const pin = (digestValue, reason) => {
    if (!objectSet.has(digestValue)) return;
    if (!reasons.has(digestValue)) reasons.set(digestValue, new Set());
    reasons.get(digestValue).add(reason);
  };
  for (const digestValue of options.additional_pins ?? []) {
    if (!SHA256.test(digestValue)) return { valid: false, errors: ["additional_pins must contain lowercase sha256 digests"] };
    pin(digestValue, "additional-pin");
  }
  for (const digestValue of scanDigests(options.productGraph ?? {})) pin(digestValue, "product-graph-reachability");
  for (const digestValue of scanDigests(options.protocol ?? {})) pin(digestValue, "protocol-reachability");
  for (const attempt of ledger.progress_attempts) {
    for (const digestValue of scanDigests(attempt)) if (objectSet.has(digestValue)) pin(digestValue, "causal-progress-reachability");
  }
  const artifactsByDigest = new Map();
  for (const artifact of ledger.artifacts) {
    if (artifact.object_digest === null) continue;
    if (!artifactsByDigest.has(artifact.object_digest)) artifactsByDigest.set(artifact.object_digest, []);
    artifactsByDigest.get(artifact.object_digest).push(artifact);
    for (const reason of retentionPinReasons(artifact, atTime)) pin(artifact.object_digest, reason);
  }

  const queue = [...reasons.keys()];
  const traversed = new Set();
  while (queue.length > 0) {
    const current = queue.shift();
    if (traversed.has(current)) continue;
    traversed.add(current);
    const resolved = readCasEvidence(storeRoot, current, { at_time: atTime });
    if (!resolved.valid) continue;
    for (const referenced of scanDigests(resolved.object)) {
      if (!objectSet.has(referenced) || reasons.has(referenced)) continue;
      pin(referenced, `reachable-from:${current}`);
      queue.push(referenced);
    }
  }

  const deleteRows = [];
  const keepRows = [];
  const graceSeconds = Number.isInteger(options.grace_seconds) && options.grace_seconds >= 0 ? options.grace_seconds : 3600;
  for (const row of objects) {
    const pinReasons = [...(reasons.get(row.object_digest) ?? [])].sort();
    const artifacts = artifactsByDigest.get(row.object_digest) ?? [];
    if (pinReasons.length > 0) {
      keepRows.push({ ...row, reasons: pinReasons });
      continue;
    }
    const stat = fs.statSync(row.object_path);
    const oldEnough = Date.parse(atTime) - stat.mtimeMs >= graceSeconds * 1000;
    const recognizedCollectible = artifacts.length > 0 && options.run_closed === true && artifacts.every((artifact) =>
      artifact.retention.class === "RUN" && new Set(["CONSUMED", "INVALIDATED"]).has(artifact.state));
    const orphanCollectible = artifacts.length === 0 && options.allow_orphans === true;
    const resolved = readCasEvidence(storeRoot, row.object_digest, { at_time: atTime });
    const staleOrInvalidated = resolved.expired === true || artifacts.some((artifact) => artifact.state === "INVALIDATED") || options.collect_consumed_run_evidence === true;
    if (oldEnough && staleOrInvalidated && (recognizedCollectible || orphanCollectible)) {
      deleteRows.push({ ...row, reason: orphanCollectible ? "unreachable-orphan" : "closed-run-unreachable" });
    } else {
      const why = [];
      if (!oldEnough) why.push("gc-grace");
      if (!staleOrInvalidated) why.push("fresh-evidence");
      if (!recognizedCollectible && !orphanCollectible) why.push("not-collectible-by-retention-policy");
      keepRows.push({ ...row, reasons: why });
    }
  }
  const policy = {
    at_time: atTime,
    run_closed: options.run_closed === true,
    allow_orphans: options.allow_orphans === true,
    collect_consumed_run_evidence: options.collect_consumed_run_evidence === true,
    grace_seconds: graceSeconds,
    additional_pins: [...(options.additional_pins ?? [])].sort()
  };
  const plan = {
    schema_version: 2,
    ledger_digest: ledger.ledger_digest,
    policy,
    delete: deleteRows,
    keep: keepRows,
    plan_digest: ""
  };
  plan.plan_digest = contentDigest(payloadWithoutDigest(plan, "plan_digest"));
  return { valid: true, errors: [], plan };
}

export function applyEvidenceGarbageCollection(storeRoot, ledger, plan, options = {}) {
  if (options.confirm_plan_digest !== plan?.plan_digest) return { valid: false, errors: ["GC requires exact confirm_plan_digest"] };
  if (contentDigest(payloadWithoutDigest(plan, "plan_digest")) !== plan.plan_digest) return { valid: false, errors: ["GC plan digest mismatch"] };
  if (ledger.ledger_digest !== plan.ledger_digest) return { valid: false, errors: ["GC plan is stale for the current ledger"] };
  const refreshed = planEvidenceGarbageCollection(storeRoot, ledger, {
    ...options,
    ...plan.policy,
    productGraph: options.productGraph,
    protocol: options.protocol,
    additional_pins: plan.policy.additional_pins
  });
  if (!refreshed.valid) return refreshed;
  if (refreshed.plan.plan_digest !== plan.plan_digest) return { valid: false, errors: ["GC reachability changed after planning"] };
  const casRoot = path.resolve(storeRoot, "objects", "sha256");
  const casRootStat = fs.lstatSync(casRoot);
  if (!casRootStat.isDirectory() || casRootStat.isSymbolicLink() || fs.realpathSync(casRoot) !== casRoot) {
    return { valid: false, errors: ["GC CAS root must be a real directory without symlinks"] };
  }
  const removed = [];
  for (const row of plan.delete) {
    const expected = evidenceObjectPath(storeRoot, row.object_digest);
    if (path.resolve(row.object_path) !== expected || !expected.startsWith(`${casRoot}${path.sep}`)) return { valid: false, errors: ["GC plan contains a path outside the CAS"] };
    const stat = fs.lstatSync(expected);
    if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(expected) !== expected) return { valid: false, errors: ["GC candidate is not a regular CAS file"] };
    const verified = readCasEvidence(storeRoot, row.object_digest, { at_time: plan.policy.at_time });
    if (!verified.valid) return { valid: false, errors: [`GC candidate ${row.object_digest} failed integrity recheck`] };
    fs.unlinkSync(expected);
    removed.push(row.object_digest);
  }
  return { valid: true, errors: [], removed, plan_digest: plan.plan_digest };
}
