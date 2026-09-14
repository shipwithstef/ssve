#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/json-schema-validator.mjs";
import { validateGenerationBindings } from "./lib/generation-bindings-v2.mjs";

const SCHEMA_PATH = fileURLToPath(new URL("../schemas/product-improvement-protocol-v2.schema.json", import.meta.url));
const SCHEMA = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const SHA256 = /^[a-f0-9]{64}$/;
const TERMINAL_PRODUCT_CONSUMERS = new Set(["CUSTOMER", "OWNER", "OPERATIONS", "METRIC"]);
const INTERNAL_TERMINAL_CONSUMERS = new Set(["RUNTIME", "LEARNING"]);
const REQUIRED_HARD_CONSTRAINTS = new Set(["quality", "reliability", "authority", "safety"]);
const REQUIRED_RANKING = ["expected_product_value", "evidence_strength", "risk_reduction", "reversibility", "critical_path", "cost"];
const REQUIRED_QUESTION_FIELDS = new Set(["MISSING_CONTEXT", "PLAIN_LANGUAGE_MEANING", "OPTIONS", "CONSEQUENCES", "RECOMMENDATION"]);
const REQUIRED_DECISION_TECHNIQUES = [
  "HARD_CONSTRAINT_FILTER",
  "EVIDENCE_WEIGHTING",
  "EXPECTED_PRODUCT_VALUE",
  "VALUE_OF_INFORMATION",
  "MINIMAX_REGRET",
  "REVERSIBILITY",
  "CRITICAL_PATH_FIT"
];
const REQUIRED_DELIVERY_CLOSURE = new Set([
  "OUTCOME_SELECTED",
  "PRODUCT_PROOF_COMPILED",
  "IMPLEMENTED",
  "BEHAVIOR_VALIDATED",
  "HOLISTIC_REVIEW_PASSED",
  "FINAL_SHA_BOUND",
  "PRODUCTION_RELEASED",
  "LIVE_VERIFIED",
  "ROLLBACK_READY",
  "OUTCOME_OBSERVATION_SCHEDULED"
]);
const PRODUCTION_OBLIGATION_IDS = [
  "OUTCOME_AND_SCOPE", "PRODUCT_CODE", "DATA_AND_MIGRATION", "AUTH_AND_PRIVACY",
  "EXTERNAL_INTEGRATIONS", "PLATFORM_AND_DEVICE", "VALIDATION", "HOLISTIC_REVIEW",
  "FINAL_SHA_AND_LANDING", "RELEASE_AND_CONFIG", "LIVE_VERIFICATION", "ROLLBACK",
  "OPERABILITY", "OUTCOME_OBSERVATION"
];
const ALWAYS_REQUIRED_PRODUCTION_OBLIGATIONS = new Set([
  "OUTCOME_AND_SCOPE", "PRODUCT_CODE", "VALIDATION", "HOLISTIC_REVIEW",
  "FINAL_SHA_AND_LANDING", "RELEASE_AND_CONFIG", "LIVE_VERIFICATION", "ROLLBACK",
  "OPERABILITY", "OUTCOME_OBSERVATION"
]);
const PRODUCTION_COMPLETION_EXTRA_IDS = new Set([
  "VALIDATION", "HOLISTIC_REVIEW", "FINAL_SHA_AND_LANDING", "RELEASE_AND_CONFIG",
  "LIVE_VERIFICATION", "ROLLBACK", "OPERABILITY", "OUTCOME_OBSERVATION"
]);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

function unique(values) {
  return [...new Set(values)];
}

function duplicateIds(rows) {
  const seen = new Set();
  return rows.map((row) => row?.id).filter((id) => seen.has(id) || !seen.add(id));
}

function hasTerminalPath(startArtifactId, artifactsById, layersById) {
  const artifactQueue = [startArtifactId];
  const seenArtifacts = new Set();
  const seenLayers = new Set();
  while (artifactQueue.length > 0) {
    const artifactId = artifactQueue.shift();
    if (seenArtifacts.has(artifactId)) continue;
    seenArtifacts.add(artifactId);
    const artifact = artifactsById.get(artifactId);
    if (!artifact) continue;
    if (artifact.consumer_ids.some((consumer) => TERMINAL_PRODUCT_CONSUMERS.has(consumer.kind))) return true;
    for (const consumer of artifact.consumer_ids.filter((item) => item.kind === "LAYER")) {
      if (seenLayers.has(consumer.id)) continue;
      seenLayers.add(consumer.id);
      for (const produced of layersById.get(consumer.id)?.produces ?? []) artifactQueue.push(produced);
    }
  }
  return false;
}

export function evaluateProductionObligationCensus(deliverySlo) {
  const errors = [];
  const obligations = Array.isArray(deliverySlo?.production_obligations) ? deliverySlo.production_obligations : [];
  const byId = new Map();
  const taskOwners = new Map();
  for (const obligation of obligations) {
    if (byId.has(obligation?.id)) errors.push(`duplicate production obligation ${obligation.id}`);
    byId.set(obligation?.id, obligation);
    if (obligation?.disposition === "UNRESOLVED") errors.push(`production obligation ${obligation.id} is unresolved`);
    if (obligation?.disposition === "REQUIRED") {
      if ((obligation.task_ids ?? []).length === 0) errors.push(`required production obligation ${obligation.id} has no task`);
      if (obligation.readiness === "NOT_APPLICABLE") errors.push(`required production obligation ${obligation.id} cannot be not-applicable`);
      if (obligation.readiness === "OWNER_REQUIRED") errors.push(`production obligation ${obligation.id} requires owner authority before dispatch`);
      if (obligation.readiness === "EXTERNAL_WAIT" && obligation.external_wait_seconds !== null && (!Number.isInteger(obligation.external_wait_seconds) || obligation.external_wait_seconds < 1)) {
        errors.push(`external wait for production obligation ${obligation.id} must be unknown or a visible positive estimate`);
      }
      if (obligation.readiness === "READY" && obligation.external_wait_seconds !== 0) {
        errors.push(`ready production obligation ${obligation.id} must have zero external wait`);
      }
    }
    if (obligation?.disposition === "NOT_APPLICABLE") {
      if ((obligation.task_ids ?? []).length > 0) errors.push(`not-applicable production obligation ${obligation.id} cannot own tasks`);
      if (obligation.readiness !== "NOT_APPLICABLE") errors.push(`not-applicable production obligation ${obligation.id} has invalid readiness`);
      if (obligation.external_wait_seconds !== null && obligation.external_wait_seconds !== 0) errors.push(`not-applicable production obligation ${obligation.id} cannot declare external wait`);
    }
    for (const taskId of obligation?.task_ids ?? []) {
      if (taskOwners.has(taskId)) errors.push(`production task ${taskId} is assigned to both ${taskOwners.get(taskId)} and ${obligation.id}`);
      taskOwners.set(taskId, obligation.id);
    }
  }
  for (const id of PRODUCTION_OBLIGATION_IDS) if (!byId.has(id)) errors.push(`production obligation census omitted ${id}`);
  for (const id of byId.keys()) if (!PRODUCTION_OBLIGATION_IDS.includes(id)) errors.push(`unknown production obligation ${id}`);
  for (const id of ALWAYS_REQUIRED_PRODUCTION_OBLIGATIONS) {
    if (byId.get(id)?.disposition !== "REQUIRED") errors.push(`production delivery always requires ${id}`);
  }
  const baselineMinutes = deliverySlo?.baseline_feature_minutes;
  const requiredSpeedup = deliverySlo?.required_speedup;
  const targetMinutes = Number.isFinite(baselineMinutes) && Number.isFinite(requiredSpeedup)
    ? Math.min(deliverySlo.active_minutes_max ?? 60, baselineMinutes / requiredSpeedup)
    : null;
  if (requiredSpeedup < 24) errors.push("production delivery speedup target must be at least 24x");
  if (Number.isFinite(targetMinutes) && (deliverySlo.risk_reserve_seconds ?? 0) >= targetMinutes * 60) {
    errors.push("risk reserve consumes the entire accelerated delivery budget");
  }
  const estimateProven = deliverySlo?.estimate_basis === "MEASURED_P95" &&
    Number.isInteger(deliverySlo?.calibration_samples) && deliverySlo.calibration_samples >= 3 &&
    deliverySlo?.estimate_confidence === "HIGH";
  if (deliverySlo?.estimate_basis === "MEASURED_P95" && (deliverySlo?.calibration_samples ?? 0) < 1) {
    errors.push("measured-p95 forecast requires calibration samples");
  }
  if (deliverySlo?.forecast_mode === "DEFAULT" && !estimateProven) {
    errors.push("default production forecast requires high-confidence measured p95 from at least three runs");
  }
  const required = obligations.filter((row) => row.disposition === "REQUIRED");
  const extra = required.filter((row) => PRODUCTION_COMPLETION_EXTRA_IDS.has(row.id));
  const externalWaits = required.filter((row) => row.readiness === "EXTERNAL_WAIT");
  return {
    valid: errors.length === 0,
    errors: unique(errors).sort(),
    target_active_minutes: targetMinutes === null ? null : Number(targetMinutes.toFixed(2)),
    baseline_feature_minutes: baselineMinutes ?? null,
    required_speedup: requiredSpeedup ?? null,
    forecast_mode: deliverySlo?.forecast_mode ?? null,
    estimate_basis: deliverySlo?.estimate_basis ?? null,
    estimate_confidence: deliverySlo?.estimate_confidence ?? null,
    calibration_samples: deliverySlo?.calibration_samples ?? null,
    estimate_proven: estimateProven,
    required_obligations: required.map((row) => row.id),
    production_completion_extras: extra.map((row) => row.id),
    external_wait_known: externalWaits.every((row) => Number.isInteger(row.external_wait_seconds)),
    external_wait_seconds: externalWaits.some((row) => row.external_wait_seconds === null)
      ? null
      : externalWaits.reduce((total, row) => total + row.external_wait_seconds, 0),
    task_owners: Object.fromEntries([...taskOwners.entries()].sort())
  };
}

export function rankProductOptions(options) {
  return [...(options ?? [])].filter((option) => option.hard_constraints_passed === true).sort((left, right) =>
    right.expected_product_value - left.expected_product_value ||
    right.evidence_strength - left.evidence_strength ||
    right.risk_reduction - left.risk_reduction ||
    Number(right.reversible) - Number(left.reversible) ||
    left.critical_path_seconds - right.critical_path_seconds ||
    left.cost - right.cost ||
    left.id.localeCompare(right.id));
}

export function compileProductImprovementProtocol(protocol, options = {}) {
  const errors = [...validate(SCHEMA, protocol).errors];
  if (!protocol || typeof protocol !== "object") return { valid: false, errors: unique(errors.length > 0 ? errors : ["protocol must be an object"]) };

  const outcomes = Array.isArray(protocol.target_outcomes) ? protocol.target_outcomes : [];
  const layers = Array.isArray(protocol.layers) ? protocol.layers : [];
  const artifacts = Array.isArray(protocol.artifacts) ? protocol.artifacts : [];
  errors.push(...validateGenerationBindings(protocol.generation_bindings));
  if (protocol.canonical_layer_inventory_digest !== protocol.generation_bindings?.layer_inventory_digest) errors.push("canonical layer inventory digest must match generation bindings");
  if (options.layerInventory) {
    if (options.layerInventory.inventory_digest !== protocol.canonical_layer_inventory_digest) errors.push("protocol layer inventory digest does not match resolved canonical inventory");
    const expected = new Set((options.layerInventory.layers ?? []).map((row) => row.id));
    const actual = new Set(layers.map((row) => row.id));
    for (const id of expected) if (!actual.has(id)) errors.push(`protocol omitted canonical layer ${id}`);
    for (const id of actual) if (!expected.has(id)) errors.push(`protocol declared non-canonical layer ${id}`);
  }
  for (const id of duplicateIds(outcomes)) errors.push(`duplicate outcome ${id}`);
  for (const id of duplicateIds(layers)) errors.push(`duplicate layer ${id}`);
  for (const id of duplicateIds(artifacts)) errors.push(`duplicate artifact ${id}`);

  const outcomesById = new Map(outcomes.map((row) => [row.id, row]));
  const layersById = new Map(layers.map((row) => [row.id, row]));
  const artifactsById = new Map(artifacts.map((row) => [row.id, row]));
  const decision = protocol.decision_record ?? {};
  const ranked = rankProductOptions(decision.options);
  if (ranked.length === 0) errors.push("decision record has no hard-constraint-compatible option");
  if (ranked[0]?.id !== decision.selected_option_id) errors.push("selected option is not first under the canonical ranking order");
  const optionIds = new Set((decision.options ?? []).map((row) => row.id));
  const rejectedIds = new Set((decision.rejected_options ?? []).map((row) => row.id));
  if (optionIds.size !== (decision.options ?? []).length) errors.push("decision record has duplicate option ids");
  for (const option of decision.options ?? []) if (!outcomesById.has(option.outcome_id)) errors.push(`option ${option.id} references missing outcome ${option.outcome_id}`);
  for (const id of optionIds) if (id !== decision.selected_option_id && !rejectedIds.has(id)) errors.push(`option ${id} lacks a rejection record`);
  for (const id of rejectedIds) if (!optionIds.has(id) || id === decision.selected_option_id) errors.push(`invalid rejected option ${id}`);
  for (const uncertainty of decision.uncertainties ?? []) {
    for (const artifactId of uncertainty.evidence_artifact_ids ?? []) if (!artifactsById.has(artifactId)) errors.push(`uncertainty ${uncertainty.id} references missing evidence ${artifactId}`);
  }

  for (const layer of layers) {
    if (layer.applicable && layer.consumes.length === 0) errors.push(`applicable layer ${layer.id} consumes nothing`);
    if (layer.applicable && layer.produces.length === 0) errors.push(`applicable layer ${layer.id} produces no typed output`);
    if (!layer.applicable && layer.produces.length > 0) errors.push(`non-applicable layer ${layer.id} cannot produce artifacts`);
    if (unique(layer.consumes).length !== layer.consumes.length) errors.push(`layer ${layer.id} has duplicate consumes`);
    if (unique(layer.produces).length !== layer.produces.length) errors.push(`layer ${layer.id} has duplicate produces`);
    for (const artifactId of [...layer.consumes, ...layer.produces]) {
      if (!artifactsById.has(artifactId)) errors.push(`layer ${layer.id} references missing artifact ${artifactId}`);
    }
  }

  for (const artifact of artifacts) {
    if (unique(artifact.outcome_ids).length !== artifact.outcome_ids.length) errors.push(`artifact ${artifact.id} has duplicate outcome ids`);
    for (const outcomeId of artifact.outcome_ids) if (!outcomesById.has(outcomeId)) errors.push(`artifact ${artifact.id} references missing outcome ${outcomeId}`);
    if (!artifact.producer_id.startsWith("EXTERNAL:")) {
      const producer = layersById.get(artifact.producer_id);
      if (!producer) errors.push(`artifact ${artifact.id} has missing producer ${artifact.producer_id}`);
      else if (!producer.applicable) errors.push(`artifact ${artifact.id} is produced by non-applicable layer ${producer.id}`);
      else if (!producer.produces.includes(artifact.id)) errors.push(`producer ${producer.id} does not declare artifact ${artifact.id}`);
    }
    if (!artifact.consumer_ids.some((consumer) => consumer.kind !== "LEARNING")) {
      errors.push(`artifact ${artifact.id} is consumed only by framework learning`);
    }
    if (unique(artifact.invalidation_input_digests ?? []).length !== (artifact.invalidation_input_digests ?? []).length) {
      errors.push(`artifact ${artifact.id} has duplicate invalidation inputs`);
    }
    if (artifact.freshness?.mode === "IMMUTABLE" && artifact.freshness?.max_age_seconds !== null) {
      errors.push(`immutable artifact ${artifact.id} cannot declare max_age_seconds`);
    }
    if (artifact.freshness?.mode !== "IMMUTABLE" && !Number.isInteger(artifact.freshness?.max_age_seconds)) {
      errors.push(`fresh artifact ${artifact.id} requires max_age_seconds`);
    }
    for (const consumer of artifact.consumer_ids) {
      if (consumer.required !== true) errors.push(`artifact ${artifact.id} consumer ${consumer.id} must be required`);
      if (consumer.acknowledgement?.state === "ACKNOWLEDGED" && !SHA256.test(consumer.acknowledgement?.evidence_digest ?? "")) {
        errors.push(`artifact ${artifact.id} consumer ${consumer.id} acknowledgement must resolve evidence`);
      }
      if (consumer.acknowledgement?.state !== "ACKNOWLEDGED" && consumer.acknowledgement?.evidence_digest !== null) {
        errors.push(`artifact ${artifact.id} consumer ${consumer.id} cannot bind evidence before acknowledgement`);
      }
      if (consumer.kind !== "LAYER") continue;
      const layer = layersById.get(consumer.id);
      if (!layer) errors.push(`artifact ${artifact.id} has missing consumer layer ${consumer.id}`);
      else if (!layer.applicable) errors.push(`artifact ${artifact.id} targets non-applicable consumer layer ${consumer.id}`);
      else if (!layer.consumes.includes(artifact.id)) errors.push(`consumer layer ${consumer.id} does not declare artifact ${artifact.id}`);
    }
  }

  for (const layer of layers.filter((row) => row.applicable)) {
    for (const artifactId of layer.consumes) {
      const artifact = artifactsById.get(artifactId);
      if (artifact && !artifact.consumer_ids.some((consumer) => consumer.kind === "LAYER" && consumer.id === layer.id)) {
        errors.push(`layer ${layer.id} consumes ${artifactId} without a matching consumer contract`);
      }
    }
  }

  for (const outcome of outcomes) {
    for (const artifactId of outcome.source_artifact_ids) if (!artifactsById.has(artifactId)) errors.push(`outcome ${outcome.id} has missing source artifact ${artifactId}`);
    const linked = artifacts.filter((artifact) => artifact.outcome_ids.includes(outcome.id));
    const releases = linked.filter((artifact) => artifact.kind === "PRODUCT_RELEASE");
    if (!releases.some((artifact) => artifact.consumer_ids.some((consumer) => new Set(["CUSTOMER", "OPERATIONS"]).has(consumer.kind)))) {
      errors.push(`outcome ${outcome.id} has no customer/operations-consumed product release`);
    }
    const observations = linked.filter((artifact) => artifact.kind === "OUTCOME_OBSERVATION");
    if (!observations.some((artifact) => artifact.consumer_ids.some((consumer) => consumer.kind === "METRIC" && consumer.id === outcome.metric.id))) {
      errors.push(`outcome ${outcome.id} has no metric-consumed observation`);
    }
    if (!linked.some((artifact) => artifact.kind === "NEXT_DECISION" && artifact.consumer_ids.some((consumer) => consumer.kind === "OWNER"))) {
      errors.push(`outcome ${outcome.id} has no consumed next decision`);
    }
  }

  for (const artifact of artifacts) {
    if (artifact.kind === "FRAMEWORK_LEARNING") {
      if (!artifact.consumer_ids.some((consumer) => INTERNAL_TERMINAL_CONSUMERS.has(consumer.kind))) {
        errors.push(`framework learning ${artifact.id} has no regression/runtime consumer`);
      }
      continue;
    }
    if (!hasTerminalPath(artifact.id, artifactsById, layersById)) errors.push(`artifact ${artifact.id} has no path to a product consumer`);
  }

  const hardConstraints = new Set(protocol.priority_policy?.hard_constraints ?? []);
  for (const required of REQUIRED_HARD_CONSTRAINTS) if (!hardConstraints.has(required)) errors.push(`priority policy lacks hard constraint ${required}`);
  if (stable(protocol.priority_policy?.rank_by ?? []) !== stable(REQUIRED_RANKING)) {
    errors.push(`priority policy rank_by must equal ${REQUIRED_RANKING.join(" -> ")}`);
  }
  const deliverySlo = protocol.delivery_slo ?? {};
  if (deliverySlo.active_minutes_max !== 60) errors.push("production delivery active budget must equal 60 minutes");
  if (deliverySlo.forecast_before_dispatch !== true) errors.push("delivery budget must be forecast before dispatch");
  if (deliverySlo.slice_policy !== "SMALLEST_COMPLETE_PRODUCT_OUTCOME") errors.push("delivery must select the smallest complete product outcome");
  if (deliverySlo.external_wait_clock !== "VISIBLE_SEPARATE") errors.push("external waits must remain visible on a separate clock");
  if (deliverySlo.timeout_result !== "NOT_COMPLETE") errors.push("a delivery timeout cannot be reported complete");
  const deliveryClosure = new Set(deliverySlo.delivery_closure ?? []);
  for (const item of REQUIRED_DELIVERY_CLOSURE) if (!deliveryClosure.has(item)) errors.push(`delivery closure lacks ${item}`);
  const productionCensus = evaluateProductionObligationCensus(deliverySlo);
  errors.push(...productionCensus.errors);
  const decisionPolicy = protocol.decision_policy ?? {};
  if (stable(decisionPolicy.technique_order ?? []) !== stable(REQUIRED_DECISION_TECHNIQUES)) {
    errors.push(`decision technique order must equal ${REQUIRED_DECISION_TECHNIQUES.join(" -> ")}`);
  }
  if (decisionPolicy.research_rule !== "ONLY_IF_DECISION_RELEVANT_AND_VALUE_EXCEEDS_COST") errors.push("research must have positive decision value");
  if (decisionPolicy.owner_question_rule !== "ONLY_CONSEQUENTIAL_UNDELEGATED_OR_EVIDENCE_TIED") errors.push("owner questions must be consequential and unresolved");
  if (decisionPolicy.no_fit_rule !== "RESLICE_OR_STOP_NEVER_WEAKEN_QUALITY") errors.push("a non-fitting slice must re-slice or stop without weakening quality");
  const interaction = protocol.owner_interaction_policy ?? {};
  const autonomy = protocol.autonomy_policy ?? {};
  const questionFields = new Set(interaction.strategic_question_fields ?? []);
  for (const field of REQUIRED_QUESTION_FIELDS) if (!questionFields.has(field)) errors.push(`strategic question contract lacks ${field}`);
  if (interaction.implementation_questions !== "INTERNAL") errors.push("implementation questions must remain internal");
  if (interaction.mode === "AUTONOMOUS") {
    if (autonomy.consequential_irreversible !== "DELEGATED_WITH_EXPLICIT_SCOPE") {
      errors.push("autonomous mode requires explicit delegated scope for consequential decisions");
    }
    if (!SHA256.test(autonomy.delegation_digest ?? "")) errors.push("autonomous mode requires a delegation digest");
  }
  if (interaction.mode === "STRATEGIC_QUESTIONS") {
    if (autonomy.consequential_irreversible !== "OWNER_REQUIRED") errors.push("strategic-question mode must retain owner authority for consequential decisions");
    if (autonomy.delegation_digest !== null) errors.push("strategic-question mode cannot carry an autonomous delegation digest");
  }
  if (protocol.loop_policy?.same_state_same_fingerprint !== "REJECT") errors.push("same state and fingerprint must be rejected");
  if (protocol.loop_policy?.progress_evidence_required !== true) errors.push("loop progress must require evidence");
  if (protocol.loop_policy?.framework_learning_role !== "DOWNSTREAM_ONLY") errors.push("framework learning must remain downstream only");
  if (protocol.loop_policy?.on_no_progress !== "STOP_WITH_EVIDENCE") errors.push("no-progress loops must stop with evidence");
  if (protocol.completion_policy?.delivery_closure_verified !== true) errors.push("completion requires verified production delivery closure");
  if (protocol.completion_policy?.outcome_observation_scheduled !== true) errors.push("delivery completion requires a scheduled outcome observation");
  if (protocol.completion_policy?.outcome_cycle_closure !== "OBSERVE_THEN_DECIDE") errors.push("outcome cycle must observe then decide");
  if (protocol.completion_policy?.next_decision_recorded_after_observation !== true) errors.push("outcome cycle requires a next decision after observation");

  const normalizedErrors = unique(errors).sort();
  return {
    valid: normalizedErrors.length === 0,
    errors: normalizedErrors,
    protocol_digest: normalizedErrors.length === 0 ? digest(protocol) : null,
    summary: {
      outcomes: outcomes.length,
      applicable_layers: layers.filter((layer) => layer.applicable).length,
      artifacts: artifacts.length,
      ranked_options: ranked.length,
      external_inputs: artifacts.filter((artifact) => artifact.producer_id.startsWith("EXTERNAL:")).length,
      product_consumers: artifacts.reduce((count, artifact) => count + artifact.consumer_ids.filter((consumer) => TERMINAL_PRODUCT_CONSUMERS.has(consumer.kind)).length, 0),
      target_active_minutes: productionCensus.target_active_minutes,
      baseline_feature_minutes: productionCensus.baseline_feature_minutes,
      required_speedup: productionCensus.required_speedup,
      forecast_mode: productionCensus.forecast_mode,
      estimate_basis: productionCensus.estimate_basis,
      estimate_confidence: productionCensus.estimate_confidence,
      calibration_samples: productionCensus.calibration_samples,
      estimate_proven: productionCensus.estimate_proven,
      production_obligations: productionCensus.required_obligations.length,
      production_completion_extras: productionCensus.production_completion_extras.length,
      external_wait_known: productionCensus.external_wait_known,
      external_wait_seconds: productionCensus.external_wait_seconds
    }
  };
}

export function validateProductProgress(history, candidate) {
  const errors = [];
  if (!Array.isArray(history)) return { valid: false, errors: ["history must be an array"] };
  for (const field of ["input_state_digest", "output_state_digest", "failure_fingerprint"]) {
    if (!SHA256.test(candidate?.[field] ?? "")) errors.push(`${field} must be lowercase sha256`);
  }
  if (candidate?.input_state_digest === candidate?.output_state_digest) errors.push("product state did not change");
  const priorEvidence = new Set(history.flatMap((entry) => entry.new_evidence_ids ?? []));
  const newEvidence = unique(candidate?.new_evidence_ids ?? []).filter((id) => !priorEvidence.has(id));
  const resolved = unique(candidate?.resolved_obligation_ids ?? []);
  const authorizedDecision = SHA256.test(candidate?.authorized_decision_digest ?? "");
  const uncertaintyReduced = Number.isFinite(candidate?.uncertainty_before) && Number.isFinite(candidate?.uncertainty_after) &&
    candidate.uncertainty_after < candidate.uncertainty_before;
  if (newEvidence.length + resolved.length === 0 && !authorizedDecision && !uncertaintyReduced) {
    errors.push("iteration has no product progress proof");
  }
  if (history.some((entry) => entry.input_state_digest === candidate?.input_state_digest && entry.failure_fingerprint === candidate?.failure_fingerprint)) {
    errors.push("same state and failure fingerprint already attempted");
  }
  if ((candidate?.framework_learning_ids ?? []).length > 0 && newEvidence.length + resolved.length === 0 && !authorizedDecision && !uncertaintyReduced) {
    errors.push("framework learning alone is not product progress");
  }
  return {
    valid: errors.length === 0,
    errors: unique(errors).sort(),
    transition_digest: errors.length === 0 ? digest(candidate) : null,
    progress: errors.length === 0 ? {
      new_evidence: newEvidence.length,
      resolved_obligations: resolved.length,
      authorized_decision: authorizedDecision,
      uncertainty_reduced: uncertaintyReduced
    } : null
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [command, file] = process.argv.slice(2);
    if (command !== "compile" || !file) throw new Error("usage: svc-product-improvement-protocol-v2.mjs compile <protocol.json>");
    const result = compileProductImprovementProtocol(JSON.parse(fs.readFileSync(file, "utf8")));
    (result.valid ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error.message] })}\n`);
    process.exitCode = 2;
  }
}
