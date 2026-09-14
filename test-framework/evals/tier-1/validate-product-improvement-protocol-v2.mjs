#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import { compileProductImprovementProtocol, validateProductProgress } from "../../../scripts/svc-product-improvement-protocol-v2.mjs";

const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const consumer = (kind, id, condition = "BEFORE_DELIVERY_CLOSE") => ({
  kind,
  id,
  required: true,
  condition,
  acknowledgement: { state: "DECLARED", evidence_digest: null }
});
const artifact = (id, kind, producerId, consumerIds) => ({
  id,
  kind,
  producer_id: producerId,
  consumer_ids: consumerIds,
  outcome_ids: ["O1"],
  source_digest: sha(`source:${id}`),
  required: true,
  invalidation_input_digests: [sha(`input:${id}`)],
  freshness: { mode: "IMMUTABLE", max_age_seconds: null },
  idempotency_key: `artifact:${id}`,
  retention: "PRODUCT_LIFETIME"
});
const obligationIds = [
  "OUTCOME_AND_SCOPE", "PRODUCT_CODE", "DATA_AND_MIGRATION", "AUTH_AND_PRIVACY",
  "EXTERNAL_INTEGRATIONS", "PLATFORM_AND_DEVICE", "VALIDATION", "HOLISTIC_REVIEW",
  "FINAL_SHA_AND_LANDING", "RELEASE_AND_CONFIG", "LIVE_VERIFICATION", "ROLLBACK",
  "OPERABILITY", "OUTCOME_OBSERVATION"
];
const optionalObligationIds = new Set([
  "DATA_AND_MIGRATION", "AUTH_AND_PRIVACY", "EXTERNAL_INTEGRATIONS", "PLATFORM_AND_DEVICE"
]);
const productionObligations = () => obligationIds.map((id) => {
  const applicable = !optionalObligationIds.has(id);
  return {
    id,
    disposition: applicable ? "REQUIRED" : "NOT_APPLICABLE",
    reason: applicable ? `${id} is required to complete this product delivery` : `${id} is not activated by the bounded example`,
    evidence_digests: [sha(`production-surface:${id}`)],
    task_ids: applicable ? [`task-${id.toLowerCase().replaceAll("_", "-")}`] : [],
    readiness: applicable ? "READY" : "NOT_APPLICABLE",
    external_wait_seconds: applicable ? 0 : null,
    proof_condition: applicable ? `${id} receipt is consumed before delivery close` : `${id} applicability remains digest-bound`
  };
});

function fixture() {
  const generationBindings = {
    protocol_generation_digest: sha("protocol-generation"),
    product_generation_digest: sha("product-generation"),
    context_generation_digest: sha("context-generation"),
    concern_generation_digest: sha("concern-generation"),
    control_generation_digest: sha("control-generation"),
    authority_generation_digest: sha("authority-generation"),
    layer_inventory_digest: sha("layer-inventory")
  };
  return {
    schema_version: 2,
    protocol_id: "hours-hub-product-improvement-v2",
    product_graph_digest: sha("product-graph"),
    generation_bindings: generationBindings,
    canonical_layer_inventory_digest: generationBindings.layer_inventory_digest,
    direction: {
      statement: "Turn owner direction into a verified customer and business outcome",
      owner_authority_digest: sha("owner-authority"),
      constraints: ["preserve product truth", "no weakened quality gates"]
    },
    decision_record: {
      id: "decision-outcome-1",
      uncertainties: [{ id: "U1", status: "RESOLVED", resolution: "market and owner evidence agree", evidence_artifact_ids: ["market-evidence", "competitor-evidence"] }],
      options: [
        { id: "OPT-A", outcome_id: "O1", hard_constraints_passed: true, expected_product_value: 0.9, evidence_strength: 0.8, risk_reduction: 0.7, reversible: true, critical_path_seconds: 3000, cost: 10 },
        { id: "OPT-B", outcome_id: "O1", hard_constraints_passed: true, expected_product_value: 0.6, evidence_strength: 0.7, risk_reduction: 0.5, reversible: true, critical_path_seconds: 2500, cost: 5 }
      ],
      selected_option_id: "OPT-A",
      rejected_options: [{ id: "OPT-B", reason: "lower expected product value under adequate evidence" }],
      authority_digest: sha("owner-authority")
    },
    target_outcomes: [{
      id: "O1",
      description: "Customers receive a reliable improvement whose effect is observed",
      authority: "OWNER",
      metric: { id: "outcome-success-rate", direction: "INCREASE", baseline: 0, target: 1, unit: "ratio" },
      source_artifact_ids: ["owner-direction", "market-evidence", "competitor-evidence", "selected-outcome"]
    }],
    layers: [
      { id: "evidence-discovery", applicable: true, applicability_reason: "owner supplied direction but not a complete outcome", unique_benefit: "grounds choices in market, competitor and domain evidence", consumes: ["owner-direction"], produces: ["market-evidence", "competitor-evidence", "domain-evidence"] },
      { id: "outcome-synthesis", applicable: true, applicability_reason: "multiple evidence sources require synthesis", unique_benefit: "turns evidence into comparable outcome options", consumes: ["owner-direction", "market-evidence", "competitor-evidence", "domain-evidence"], produces: ["outcome-options"] },
      { id: "strategic-decision", applicable: true, applicability_reason: "one outcome option must receive authority", unique_benefit: "selects a sane evidence-ranked outcome without implementation questions", consumes: ["outcome-options"], produces: ["selected-outcome"] },
      { id: "product-proof", applicable: true, applicability_reason: "selected outcome needs journeys, acceptance and execution mappings", unique_benefit: "preserves total product truth while compiling focused work", consumes: ["selected-outcome"], produces: ["proof-graph", "task-capsules"] },
      { id: "execution", applicable: true, applicability_reason: "the selected outcome requires product changes", unique_benefit: "produces the candidate through conflict-aware bounded work", consumes: ["task-capsules", "proof-graph"], produces: ["product-candidate"] },
      { id: "validation", applicable: true, applicability_reason: "candidate behavior requires proof", unique_benefit: "kills false-green product and regression states", consumes: ["product-candidate", "proof-graph"], produces: ["validation-evidence"] },
      { id: "holistic-review", applicable: true, applicability_reason: "cross-task composition must be evaluated", unique_benefit: "checks cumulative product, security and authority interactions", consumes: ["product-candidate", "validation-evidence"], produces: ["release-decision"] },
      { id: "release", applicable: true, applicability_reason: "verified candidate must reach its customers safely", unique_benefit: "performs canary, rollback-capable release and verification", consumes: ["product-candidate", "release-decision"], produces: ["product-release"] },
      { id: "outcome-observation", applicable: true, applicability_reason: "shipping alone does not prove improvement", unique_benefit: "measures the actual customer and business result", consumes: ["product-release"], produces: ["outcome-observation"] },
      { id: "next-priority", applicable: true, applicability_reason: "observed delta must drive the next best decision", unique_benefit: "converts outcome evidence into continue, revise, expand, rollback or stop", consumes: ["outcome-observation", "selected-outcome"], produces: ["next-decision"] },
      { id: "framework-learning", applicable: true, applicability_reason: "real product evidence may expose a reusable delivery lesson", unique_benefit: "improves future delivery only after product evidence exists", consumes: ["validation-evidence", "outcome-observation"], produces: ["framework-learning"] }
    ],
    artifacts: [
      artifact("owner-direction", "OWNER_DIRECTION", "EXTERNAL:OWNER", [consumer("LAYER", "evidence-discovery"), consumer("LAYER", "outcome-synthesis")]),
      artifact("market-evidence", "MARKET_EVIDENCE", "evidence-discovery", [consumer("LAYER", "outcome-synthesis")]),
      artifact("competitor-evidence", "COMPETITOR_EVIDENCE", "evidence-discovery", [consumer("LAYER", "outcome-synthesis")]),
      artifact("domain-evidence", "DOMAIN_EVIDENCE", "evidence-discovery", [consumer("LAYER", "outcome-synthesis")]),
      artifact("outcome-options", "OUTCOME_OPTIONS", "outcome-synthesis", [consumer("LAYER", "strategic-decision")]),
      artifact("selected-outcome", "SELECTED_OUTCOME", "strategic-decision", [consumer("LAYER", "product-proof"), consumer("LAYER", "next-priority")]),
      artifact("proof-graph", "PRODUCT_PROOF_GRAPH", "product-proof", [consumer("LAYER", "execution"), consumer("LAYER", "validation")]),
      artifact("task-capsules", "TASK_CAPSULES", "product-proof", [consumer("LAYER", "execution")]),
      artifact("product-candidate", "PRODUCT_CANDIDATE", "execution", [consumer("LAYER", "validation"), consumer("LAYER", "holistic-review"), consumer("LAYER", "release")]),
      artifact("validation-evidence", "VALIDATION_EVIDENCE", "validation", [consumer("LAYER", "holistic-review"), consumer("LAYER", "framework-learning")]),
      artifact("release-decision", "RELEASE_DECISION", "holistic-review", [consumer("LAYER", "release")]),
      artifact("product-release", "PRODUCT_RELEASE", "release", [consumer("CUSTOMER", "target-users"), consumer("OPERATIONS", "product-operations"), consumer("LAYER", "outcome-observation")]),
      artifact("outcome-observation", "OUTCOME_OBSERVATION", "outcome-observation", [consumer("METRIC", "outcome-success-rate"), consumer("OWNER", "product-owner"), consumer("LAYER", "next-priority"), consumer("LAYER", "framework-learning")]),
      artifact("next-decision", "NEXT_DECISION", "next-priority", [consumer("OWNER", "product-owner"), consumer("RUNTIME", "svc-controller")]),
      artifact("framework-learning", "FRAMEWORK_LEARNING", "framework-learning", [consumer("RUNTIME", "regression-corpus")])
    ],
    priority_policy: {
      hard_constraints: ["quality", "reliability", "authority", "safety"],
      rank_by: ["expected_product_value", "evidence_strength", "risk_reduction", "reversibility", "critical_path", "cost"]
    },
    delivery_slo: {
      active_minutes_max: 60,
      forecast_before_dispatch: true,
      slice_policy: "SMALLEST_COMPLETE_PRODUCT_OUTCOME",
      external_wait_clock: "VISIBLE_SEPARATE",
      timeout_result: "NOT_COMPLETE",
      baseline_feature_minutes: 1440,
      required_speedup: 24,
      risk_reserve_seconds: 600,
      max_parallel: 4,
      forecast_mode: "SHADOW",
      estimate_basis: "DECLARED_TARGETS",
      calibration_samples: 0,
      estimate_confidence: "LOW",
      production_obligations: productionObligations(),
      delivery_closure: [
        "OUTCOME_SELECTED", "PRODUCT_PROOF_COMPILED", "IMPLEMENTED", "BEHAVIOR_VALIDATED",
        "HOLISTIC_REVIEW_PASSED", "FINAL_SHA_BOUND", "PRODUCTION_RELEASED", "LIVE_VERIFIED",
        "ROLLBACK_READY", "OUTCOME_OBSERVATION_SCHEDULED"
      ]
    },
    decision_policy: {
      technique_order: [
        "HARD_CONSTRAINT_FILTER", "EVIDENCE_WEIGHTING", "EXPECTED_PRODUCT_VALUE",
        "VALUE_OF_INFORMATION", "MINIMAX_REGRET", "REVERSIBILITY", "CRITICAL_PATH_FIT"
      ],
      research_rule: "ONLY_IF_DECISION_RELEVANT_AND_VALUE_EXCEEDS_COST",
      owner_question_rule: "ONLY_CONSEQUENTIAL_UNDELEGATED_OR_EVIDENCE_TIED",
      no_fit_rule: "RESLICE_OR_STOP_NEVER_WEAKEN_QUALITY"
    },
    owner_interaction_policy: {
      mode: "STRATEGIC_QUESTIONS",
      language: "bg",
      explanation_level: "SIMPLIFIED",
      implementation_questions: "INTERNAL",
      strategic_question_fields: ["MISSING_CONTEXT", "PLAIN_LANGUAGE_MEANING", "OPTIONS", "CONSEQUENCES", "RECOMMENDATION"]
    },
    autonomy_policy: {
      reversible_bounded: "AUTO_WITH_EVIDENCE",
      consequential_irreversible: "OWNER_REQUIRED",
      insufficient_evidence: "RESEARCH_OR_ASK",
      delegation_digest: null
    },
    loop_policy: {
      same_state_same_fingerprint: "REJECT",
      progress_evidence_required: true,
      framework_learning_role: "DOWNSTREAM_ONLY",
      on_no_progress: "STOP_WITH_EVIDENCE"
    },
    completion_policy: {
      all_required_consumers_acknowledged: true,
      delivery_closure_verified: true,
      outcome_observation_scheduled: true,
      outcome_cycle_closure: "OBSERVE_THEN_DECIDE",
      no_blocking_obligations: true,
      next_decision_recorded_after_observation: true
    }
  };
}

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    process.stderr.write(`not ok ${name}: ${error.message}\n`);
    process.exitCode = 1;
  }
}

check("compiles a consumption-closed product improvement graph", () => {
  const result = compileProductImprovementProtocol(fixture());
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(result.summary.outcomes, 1);
  assert.equal(result.summary.applicable_layers, 11);
  assert.equal(result.summary.artifacts, 15);
  assert.equal(result.summary.baseline_feature_minutes, 1440);
  assert.equal(result.summary.target_active_minutes, 60);
  assert.equal(result.summary.required_speedup, 24);
  assert.equal(result.summary.forecast_mode, "SHADOW");
  assert.equal(result.summary.estimate_proven, false);
  assert.equal(result.summary.production_completion_extras, 8);
});

check("autonomous mode requires and accepts explicit delegated scope", () => {
  const input = fixture();
  input.owner_interaction_policy.mode = "AUTONOMOUS";
  input.autonomy_policy.consequential_irreversible = "DELEGATED_WITH_EXPLICIT_SCOPE";
  input.autonomy_policy.delegation_digest = sha("full-delegation-within-constraints");
  assert.equal(compileProductImprovementProtocol(input).valid, true);
});

check("strategic-question mode keeps consequential authority with owner", () => {
  const input = fixture();
  input.autonomy_policy.consequential_irreversible = "DELEGATED_WITH_EXPLICIT_SCOPE";
  input.autonomy_policy.delegation_digest = sha("unexpected-delegation");
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("retain owner authority")));
});

check("requires every strategic question to explain the decision in owner language", () => {
  const input = fixture();
  input.owner_interaction_policy.strategic_question_fields = ["OPTIONS", "CONSEQUENCES", "RECOMMENDATION"];
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("PLAIN_LANGUAGE_MEANING")));
});

check("rejects a plan that cannot honestly close production delivery inside 60 active minutes", () => {
  const input = fixture();
  input.delivery_slo.active_minutes_max = 90;
  input.delivery_slo.timeout_result = "COMPLETE_WITHOUT_LIVE_PROOF";
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("60 minutes")));
  assert(result.errors.some((error) => error.includes("cannot be reported complete")));
});

check("rejects a production forecast that omits or leaves a real-product surface unresolved", () => {
  const input = fixture();
  input.delivery_slo.production_obligations = input.delivery_slo.production_obligations.filter((row) => row.id !== "OPERABILITY");
  input.delivery_slo.production_obligations.find((row) => row.id === "AUTH_AND_PRIVACY").disposition = "UNRESOLVED";
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("omitted OPERABILITY")));
  assert(result.errors.some((error) => error.includes("AUTH_AND_PRIVACY is unresolved")));
});

check("keeps production waits visible and outside the active 24x clock", () => {
  const input = fixture();
  const release = input.delivery_slo.production_obligations.find((row) => row.id === "RELEASE_AND_CONFIG");
  release.readiness = "EXTERNAL_WAIT";
  release.external_wait_seconds = 900;
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(result.summary.target_active_minutes, 60);
  assert.equal(result.summary.external_wait_seconds, 900);
});

check("prevents an uncalibrated target from becoming a default-production claim", () => {
  const input = fixture();
  input.delivery_slo.forecast_mode = "DEFAULT";
  const unproven = compileProductImprovementProtocol(input);
  assert.equal(unproven.valid, false);
  assert(unproven.errors.some((error) => error.includes("high-confidence measured p95")));
  input.delivery_slo.estimate_basis = "MEASURED_P95";
  input.delivery_slo.calibration_samples = 3;
  input.delivery_slo.estimate_confidence = "HIGH";
  const provenForecast = compileProductImprovementProtocol(input);
  assert.equal(provenForecast.valid, true, provenForecast.errors.join("; "));
  assert.equal(provenForecast.summary.estimate_proven, true);
});

check("rejects decision machinery that drops value-of-information or weakens quality to fit", () => {
  const input = fixture();
  input.decision_policy.technique_order = input.decision_policy.technique_order.filter((item) => item !== "VALUE_OF_INFORMATION");
  input.decision_policy.no_fit_rule = "DROP_EXPENSIVE_PROOF";
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("decision technique order")));
  assert(result.errors.some((error) => error.includes("without weakening quality")));
});

check("runtime, release and learning consumers cannot impersonate a product terminal", () => {
  const input = fixture();
  input.artifacts.find((row) => row.id === "product-release").consumer_ids = [
    consumer("RUNTIME", "release-runtime"),
    consumer("LAYER", "outcome-observation")
  ];
  input.artifacts.find((row) => row.id === "outcome-observation").consumer_ids = [
    consumer("RUNTIME", "metrics-runtime"),
    consumer("LAYER", "next-priority"),
    consumer("LAYER", "framework-learning")
  ];
  input.artifacts.find((row) => row.id === "next-decision").consumer_ids = [consumer("RUNTIME", "svc-controller")];
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("no customer/operations-consumed product release")));
  assert(result.errors.some((error) => error.includes("no metric-consumed observation")));
  assert(result.errors.some((error) => error.includes("no consumed next decision")));
});

check("acknowledgement claims must resolve immutable evidence", () => {
  const input = fixture();
  input.artifacts[0].consumer_ids[0].acknowledgement = { state: "ACKNOWLEDGED", evidence_digest: null };
  const result = compileProductImprovementProtocol(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("acknowledgement must resolve evidence")));
});

check("10 distinct orphan, applicability, outcome and loop mutations produce zero false-valid protocols", () => {
  let falseValid = 0;
  for (let index = 0; index < 10; index += 1) {
    const input = fixture();
    switch (index) {
      case 0: input.artifacts[1].consumer_ids = []; break;
      case 1: input.layers[1].consumes = input.layers[1].consumes.filter((id) => id !== "competitor-evidence"); break;
      case 2: input.artifacts[5].producer_id = "missing-strategy"; break;
      case 3: input.layers[4].applicable = false; break;
      case 4: input.artifacts[9].consumer_ids = [consumer("LEARNING", "framework-learning")]; break;
      case 5: input.artifacts[11].consumer_ids = [consumer("LAYER", "outcome-observation")]; break;
      case 6: input.artifacts[12].consumer_ids = input.artifacts[12].consumer_ids.filter((item) => item.kind !== "METRIC"); break;
      case 7: input.artifacts[13].consumer_ids = [consumer("LEARNING", "framework-learning")]; break;
      case 8: input.priority_policy.rank_by.reverse(); break;
      case 9: input.loop_policy.framework_learning_role = "PRIMARY"; break;
    }
    if (compileProductImprovementProtocol(input).valid) falseValid += 1;
  }
  assert.equal(falseValid, 0);
});

const progress = {
  input_state_digest: sha("state-a"),
  output_state_digest: sha("state-b"),
  failure_fingerprint: sha("failure-a"),
  new_evidence_ids: ["evidence-2"],
  resolved_obligation_ids: [],
  authorized_decision_digest: null,
  uncertainty_before: 0.6,
  uncertainty_after: 0.6,
  framework_learning_ids: []
};

check("accepts a transition that consumes genuinely new product evidence", () => {
  const result = validateProductProgress([{ new_evidence_ids: ["evidence-1"] }], progress);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(result.progress.new_evidence, 1);
});

check("rejects the same state and causal fingerprint instead of looping", () => {
  const result = validateProductProgress([{ ...progress }], { ...progress, output_state_digest: sha("state-c"), new_evidence_ids: ["evidence-3"] });
  assert.equal(result.valid, false);
  assert(result.errors.includes("same state and failure fingerprint already attempted"));
});

check("rejects an unchanged product state", () => {
  const result = validateProductProgress([], { ...progress, output_state_digest: progress.input_state_digest });
  assert.equal(result.valid, false);
  assert(result.errors.includes("product state did not change"));
});

check("rejects receipt churn with no product progress proof", () => {
  const result = validateProductProgress([], { ...progress, new_evidence_ids: [], uncertainty_before: 0.5, uncertainty_after: 0.5 });
  assert.equal(result.valid, false);
  assert(result.errors.includes("iteration has no product progress proof"));
});

check("framework learning alone cannot impersonate product progress", () => {
  const result = validateProductProgress([], { ...progress, new_evidence_ids: [], framework_learning_ids: ["learning-1"], uncertainty_before: 0.5, uncertainty_after: 0.5 });
  assert.equal(result.valid, false);
  assert(result.errors.includes("framework learning alone is not product progress"));
});

check("measured uncertainty reduction is valid progress", () => {
  const result = validateProductProgress([], { ...progress, new_evidence_ids: [], uncertainty_before: 0.7, uncertainty_after: 0.3 });
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(result.progress.uncertainty_reduced, true);
});

if (process.exitCode) process.stderr.write(`product improvement protocol v2: ${passed} passed, failures present\n`);
else process.stdout.write(`product improvement protocol v2: ${passed} passed, 0 failed\n`);
