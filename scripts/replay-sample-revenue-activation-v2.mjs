#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  appendExecutionEvent,
  authorizeEffect,
  classifyFailure,
  compileCapsule,
  compileExecutionGraph,
  planExecutionWaves,
  projectExecutionStatus,
  putEvidenceObject,
  selectValidations
} from "./svc-execution-controller-v2.mjs";
import { compileProductionDeliveryForecast } from "./svc-runtime-v2.mjs";

const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;
const HISTORICAL_ROUTES = new Map([
  ["source-candidate-cardinality", "COMPILE_REJECT"],
  ["ready-shape-drift", "COMPILE_REJECT"],
  ["timestamp-serialization", "COMPILE_REJECT"],
  ["sql-scope-alias", "EXECUTOR_RETRY"],
  ["legacy-fingerprint-propagation", "EXECUTOR_RETRY"],
  ["owner-isolation-semantic-change", "PLAN_FROZEN"],
  ["missing-rpc-grant-owner-edge", "PLAN_FROZEN"],
  ["log-wording-only", "CACHE_REUSE"],
  ["assertion-or-grant-weakened", "VALIDATION_RERUN"],
  ["runner-residue", "EXECUTOR_RETRY"],
  ["mechanical-budget-exhausted", "IMPLEMENTATION_TERMINAL"],
  ["final-review-semantic-conflict", "PLAN_FROZEN"]
]);
const PRODUCTION_OBLIGATION_IDS = [
  "OUTCOME_AND_SCOPE", "PRODUCT_CODE", "DATA_AND_MIGRATION", "AUTH_AND_PRIVACY",
  "EXTERNAL_INTEGRATIONS", "PLATFORM_AND_DEVICE", "VALIDATION", "HOLISTIC_REVIEW",
  "FINAL_SHA_AND_LANDING", "RELEASE_AND_CONFIG", "LIVE_VERIFICATION", "ROLLBACK",
  "OPERABILITY", "OUTCOME_OBSERVATION"
];

function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}

function fileDigest(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function interfaceDigest(id) {
  return digest(`sample-shadow-interface:${id}`);
}

function generationBindings(fixture) {
  return {
    protocol_generation_digest: digest("product-outcome-protocol-v2"),
    product_generation_digest: fixture.source_snapshot.manifest_sha256,
    context_generation_digest: digest([fixture.source_snapshot.branch, fixture.source_snapshot.head]),
    concern_generation_digest: digest("sample-concerns-r21"),
    control_generation_digest: fixture.source_snapshot.contract_sha256,
    authority_generation_digest: digest("founder-approved-revenue-contract"),
    layer_inventory_digest: digest("shadow-layer-inventory-r21")
  };
}

function validation(stage, index, file) {
  return {
    id: `${stage.id.toLowerCase()}-proof-${String(index + 1).padStart(2, "0")}`,
    argv: ["shadow-proof", stage.id, String(index + 1)],
    inputs: [file],
    validator_digest: digest(`validator:${stage.id}:${index}`),
    environment_class: stage.id === "T13" ? "external" : stage.id === "T15" || stage.id === "V1" ? "external" : "hermetic",
    cost_class: stage.id === "H1" ? "external" : stage.id === "E6" ? "full" : "focused",
    required_at_freeze: true
  };
}

function buildCapsules(fixture) {
  return fixture.stages.map((stage, index) => {
    const file = `shadow/sample-revenue/${stage.id.toLowerCase()}.json`;
    const deployTarget = stage.id === "T13" ? "staging/example-marketplace" : stage.id === "R1" ? "rollback/example-marketplace" : stage.id === "T15" ? "production/example-marketplace" : null;
    const effectCapabilities = [{
      id: `write-${stage.id.toLowerCase()}-evidence`,
      principal: "executor",
      kind: "filesystem_write",
      targets: [file],
      max_cost_usd: 0,
      root_only: false,
      requires_idempotency: false,
      reversible: true
    }];
    const resourceClaims = [{ key: stage.resource, mode: "exclusive" }];
    if (deployTarget) {
      effectCapabilities.push({
        id: `deploy-${stage.id.toLowerCase()}`,
        principal: "root",
        kind: "deploy",
        targets: [deployTarget],
        max_cost_usd: 0,
        root_only: true,
        requires_idempotency: true,
        reversible: true
      });
      resourceClaims.push({ key: `effect:deploy:${deployTarget}`, mode: "exclusive" });
    }
    return {
      schema_version: 2,
      wi: fixture.wi,
      task_id: stage.id,
      product_outcome: `complete Sample revenue activation lifecycle stage ${stage.id}`,
      generation_bindings: generationBindings(fixture),
      dependencies: stage.dependencies,
      merge_dependencies: stage.merge_dependencies,
      interfaces: {
        provides: (stage.provides ?? []).map((id) => ({ id, digest: interfaceDigest(id) })),
        consumes: (stage.consumes ?? []).map((item) => ({ id: item.id, digest: interfaceDigest(item.id), producer_task_id: item.producer }))
      },
      revision: 21,
      plan_digest: fixture.source_snapshot.manifest_sha256,
      accepted_parent_sha: fixture.source_snapshot.head,
      allowed_files: [{ path: file, action: "CREATE" }],
      forbidden_writes: [".git/**", "production/**"],
      decisions: [{ id: "one-immutable-activation-per-referral", status: "RESOLVED", source_digest: fixture.source_snapshot.manifest_sha256 }],
      authorities: [{ id: "founder-approved-revenue-contract", status: "RESOLVED", source_digest: fixture.source_snapshot.contract_sha256 }],
      effect_capabilities: effectCapabilities,
      resource_claims: resourceClaims,
      parallel_policy: {
        eligible: !new Set(["H1", "T13", "T15"]).has(stage.id),
        merge_order_key: `${String(index + 1).padStart(3, "0")}-${stage.id}`,
        ...new Set(["H1", "T13", "T15"]).has(stage.id) ? { serialization_reason: `${stage.id.toLowerCase()}-single-authority-gate` } : {}
      },
      active_budget_seconds: stage.budget_seconds,
      collections: {},
      collection_contracts: [],
      relationships: [],
      validations: Array.from({ length: stage.validation_count }, (_, validationIndex) => validation(stage, validationIndex, file)),
      failure_policy: {
        local_attempts: 2,
        assist_attempts: 1,
        plan_freeze_categories: ["PRODUCT_CONTRACT", "SECURITY_AUTHORITY"]
      }
    };
  });
}

function buildDeliverySlo(fixture) {
  const tasksByObligation = new Map(PRODUCTION_OBLIGATION_IDS.map((id) => [id, []]));
  for (const stage of fixture.stages) tasksByObligation.get(stage.production_obligation_id)?.push(stage.id);
  const externalReleaseWait = (fixture.external_dependencies ?? []).some((row) => row.required && row.blocks_before_stage === "T13");
  return {
    active_minutes_max: 60,
    forecast_before_dispatch: true,
    slice_policy: "SMALLEST_COMPLETE_PRODUCT_OUTCOME",
    external_wait_clock: "VISIBLE_SEPARATE",
    timeout_result: "NOT_COMPLETE",
    baseline_feature_minutes: fixture.delivery_forecast.baseline_feature_minutes,
    required_speedup: fixture.delivery_forecast.required_speedup,
    risk_reserve_seconds: fixture.delivery_forecast.risk_reserve_seconds,
    max_parallel: fixture.max_parallel,
    forecast_mode: fixture.delivery_forecast.forecast_mode,
    estimate_basis: fixture.delivery_forecast.estimate_basis,
    calibration_samples: fixture.delivery_forecast.calibration_samples,
    estimate_confidence: fixture.delivery_forecast.estimate_confidence,
    production_obligations: PRODUCTION_OBLIGATION_IDS.map((id) => {
      const taskIds = tasksByObligation.get(id);
      const applicable = taskIds.length > 0;
      const externalWait = id === "RELEASE_AND_CONFIG" && externalReleaseWait;
      return {
        id,
        disposition: applicable ? "REQUIRED" : "NOT_APPLICABLE",
        reason: applicable ? `Sample source graph activates ${id}` : `Sample source graph does not activate ${id}`,
        evidence_digests: [fixture.delivery_forecast.evidence_digest],
        task_ids: taskIds,
        readiness: applicable ? externalWait ? "EXTERNAL_WAIT" : "READY" : "NOT_APPLICABLE",
        external_wait_seconds: applicable ? externalWait ? fixture.delivery_forecast.external_wait_seconds : 0 : null,
        proof_condition: applicable ? `${id} task receipts are consumed before delivery close` : `${id} remains digest-bound not-applicable`
      };
    }),
    delivery_closure: [
      "OUTCOME_SELECTED", "PRODUCT_PROOF_COMPILED", "IMPLEMENTED", "BEHAVIOR_VALIDATED",
      "HOLISTIC_REVIEW_PASSED", "FINAL_SHA_BOUND", "PRODUCTION_RELEASED", "LIVE_VERIFIED",
      "ROLLBACK_READY", "OUTCOME_OBSERVATION_SCHEDULED"
    ]
  };
}

function acceptedEvents(capsule, index) {
  let events = [];
  const base = {
    run_id: `shadow-${capsule.task_id.toLowerCase()}`,
    task_id: `${capsule.task_id}.r${capsule.revision}`,
    generation_bindings: capsule.generation_bindings,
    observed_at: new Date(Date.UTC(2026, 7, 10, 0, index, 0)).toISOString()
  };
  const append = (type, payload) => {
    const result = appendExecutionEvent(events, { ...base, type, payload });
    if (!result.valid) throw new Error(`${capsule.task_id} event ${type}: ${result.errors.join("; ")}`);
    events = result.events;
  };
  append("RUN_CREATED", { capsule_digest: compileCapsule(capsule).capsule_digest, plan_digest: capsule.plan_digest });
  append("TASK_STARTED", { attempt: 1 });
  append("STATIC_PASSED", { receipt_digest: digest(`static:${capsule.task_id}`) });
  append("RUNTIME_PASSED", { receipt_digest: digest(`runtime:${capsule.task_id}`) });
  append("CHECKPOINT_CREATED", { commit_sha: digest(`commit:${capsule.task_id}`).slice(0, 40) });
  append("TASK_ACCEPTED", { acceptance_digest: digest(`accept:${capsule.task_id}`) });
  return events;
}

function failureCapsule(template) {
  const capsule = structuredClone(template);
  const row = (id) => ({ id, evidence_fingerprint: "a".repeat(64), observed_at: "2026-08-10T00:00:00.000Z" });
  capsule.collections = {
    sources: [row("legacy"), row("subscription"), row("lightning"), row("deal")],
    candidates: [row("legacy"), row("subscription-a"), row("subscription-b"), row("lightning"), row("deal")]
  };
  capsule.collection_contracts = [
    { collection: "sources", exact_count: 4, exact_fields: ["id", "evidence_fingerprint", "observed_at"], unique_by: ["id"], formats: { evidence_fingerprint: "sha256", observed_at: "iso_timestamp" } },
    { collection: "candidates", exact_count: 5, exact_fields: ["id", "evidence_fingerprint", "observed_at"], unique_by: ["id"], formats: { evidence_fingerprint: "sha256", observed_at: "iso_timestamp" } }
  ];
  capsule.relationships = [];
  return capsule;
}

function replayFailureCase(item, template) {
  if (item.engine_case.startsWith("capsule-")) {
    const input = failureCapsule(template);
    if (item.engine_case === "capsule-cardinality") input.collection_contracts[0].exact_count = 5;
    if (item.engine_case === "capsule-shape") input.collections.candidates[0].stale_field = true;
    if (item.engine_case === "capsule-timestamp") input.collections.candidates[0].observed_at = "2026-08-10 00:00:00Z";
    return compileCapsule(input).valid ? "FALSE_GREEN" : "COMPILE_REJECT";
  }
  if (item.engine_case === "irrelevant-cache") {
    const selected = selectValidations(template, { changedPaths: ["docs/unrelated-log.md"], repoRoot: process.cwd(), environmentIdentity: "shadow" });
    return selected.valid && selected.summary.run === 0 ? "CACHE_REUSE" : "FALSE_INVALIDATION";
  }
  if (item.engine_case === "relevant-rerun") {
    const selected = selectValidations(template, { changedPaths: [template.allowed_files[0].path], repoRoot: process.cwd(), environmentIdentity: "shadow" });
    return selected.valid && selected.summary.run === template.validations.length ? "VALIDATION_RERUN" : "FALSE_REUSE";
  }
  const base = {
    stage: "shadow-replay",
    command_id: item.id,
    exit_code: 3,
    causal_code: item.id.toUpperCase().replaceAll("-", "_"),
    relevant_digest: digest(item.id),
    attempt: 1
  };
  if (item.engine_case === "mechanical-retry") return classifyFailure({ ...base, category: "HARNESS_TRANSPORT" }).route;
  if (item.engine_case === "assertion-retry") return classifyFailure({ ...base, category: "ASSERTION_SEMANTICS" }).route;
  if (item.engine_case === "product-freeze") return classifyFailure({ ...base, category: "PRODUCT_CONTRACT" }).route;
  if (item.engine_case === "security-freeze") return classifyFailure({ ...base, category: "SECURITY_AUTHORITY" }).route;
  if (item.engine_case === "terminal-after-assist") return classifyFailure({ ...base, category: "FIXTURE", attempt: 4, assist_already_used: true }).route;
  return "UNKNOWN_CASE";
}

function sectionDigest(file, start, end) {
  const lines = fs.readFileSync(file, "utf8").split(/\n/).slice(start - 1, end);
  return digest(`${lines.join("\n")}\n`);
}

function verifyLiveSnapshot(fixture, sourceRoot) {
  const errors = [];
  const root = path.resolve(sourceRoot);
  const manifest = path.join(root, "docs/plans/2026-08-08-sample-revenue-activation/manifest.md");
  const contract = path.join(root, "docs/plans/2026-08-08-sample-revenue-activation/persistent-executor-contract.json");
  const lane = path.join(root, ".svc/lane-tasks-WI-SAMPLE-REVENUE-ACTIVATION-01.json");
  const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim();
  const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  const stateRelative = execFileSync("git", ["rev-parse", "--git-path", "svc/sample-revenue-executor-state.json"], { cwd: root, encoding: "utf8" }).trim();
  const state = path.isAbsolute(stateRelative) ? stateRelative : path.join(root, stateRelative);
  const checks = [
    [branch, fixture.source_snapshot.branch, "branch"],
    [head, fixture.source_snapshot.head, "head"],
    [fileDigest(manifest), fixture.source_snapshot.manifest_sha256, "manifest"],
    [fileDigest(contract), fixture.source_snapshot.contract_sha256, "contract"],
    [fileDigest(lane), fixture.source_snapshot.lane_sha256, "lane"],
    [fileDigest(state), fixture.source_snapshot.executor_state_sha256, "executor state"],
    [sectionDigest(manifest, 1586, 1757), fixture.source_snapshot.ac_task_test_mapping_sha256, "AC mapping"],
    [sectionDigest(manifest, 4761, 4777), fixture.source_snapshot.journey_scenario_coverage_sha256, "journey coverage"],
    [sectionDigest(manifest, 1562, 1579), fixture.source_snapshot.lifecycle_graph_sha256, "lifecycle graph"]
  ];
  for (const [actual, expected, label] of checks) if (actual !== expected) errors.push(`${label} digest/value drifted: ${actual} != ${expected}`);

  const stateJson = JSON.parse(fs.readFileSync(state, "utf8"));
  const accepted = (stateJson.accepted ?? []).filter((item) => item.active !== false).map((item) => `${item.unit}@${item.revision}:${item.commit_sha}`);
  const expectedAccepted = fixture.accepted_prefix.map((item) => `${item.unit}@${item.revision}:${item.commit_sha}`);
  if (JSON.stringify(accepted) !== JSON.stringify(expectedAccepted)) errors.push("accepted prefix drifted");
  const e1b2 = (stateJson.validation_runs ?? []).filter((run) => run.active !== false && run.unit === fixture.in_progress_evidence.unit && run.unit_revision === fixture.in_progress_evidence.revision);
  const latest = e1b2.slice(-fixture.in_progress_evidence.latest_validation_count);
  if (latest.length !== fixture.in_progress_evidence.latest_validation_count || latest.some((run) => run.exit_code !== 0)) errors.push("latest E1B2 validation matrix is not exact PASS");
  return { valid: errors.length === 0, errors, state_path: state, accepted_prefix: accepted, latest_e1b2_passes: latest.length };
}

export function validateSampleShadowFixture(fixture) {
  const errors = [];
  if (!fixture || fixture.schema_version !== 2 || fixture.wi !== "WI-SAMPLE-REVENUE-ACTIVATION-01") errors.push("fixture identity/schema mismatch");
  for (const [key, value] of Object.entries(fixture?.source_snapshot ?? {})) {
    if (key.endsWith("sha256") && !SHA256.test(value)) errors.push(`bad source snapshot digest ${key}`);
  }
  if (!GIT_SHA.test(fixture?.source_snapshot?.head ?? "")) errors.push("source snapshot head must be a Git SHA");
  const coverage = fixture?.coverage ?? {};
  for (const key of ["acceptance_criteria", "task_mappings", "test_mappings"]) if (coverage[key] !== 81) errors.push(`${key} must remain exactly 81`);
  if (coverage.journey_scenarios !== 12 || coverage.journey_assertions !== 74) errors.push("journey coverage must remain 12 scenarios / 74 assertions");
  if (coverage.accepted_units + coverage.remaining_units !== coverage.implementation_units || coverage.implementation_units !== 9) errors.push("implementation unit cardinality must remain 2 accepted + 7 remaining = 9");
  if (fixture.in_progress_evidence?.latest_validation_count !== 6 || fixture.in_progress_evidence?.latest_pass_count !== 6) errors.push("E1B2 latest evidence must retain 6/6 PASS");
  const stageIds = (fixture.stages ?? []).map((stage) => stage.id);
  if (JSON.stringify(stageIds) !== JSON.stringify(fixture.required_stage_ids)) errors.push("required lifecycle stages changed or reordered");
  if ((fixture.external_dependencies ?? []).length !== 1 || fixture.external_dependencies[0].blocks_before_stage !== "T13" || fixture.external_dependencies[0].counts_as_active_engineering_time !== false) errors.push("WI-368 external integration wait contract changed");
  const failureIds = (fixture.historical_failures ?? []).map((item) => item.id);
  if (JSON.stringify(failureIds) !== JSON.stringify([...HISTORICAL_ROUTES.keys()])) errors.push("historical failure archetype set changed");
  for (const item of fixture.historical_failures ?? []) {
    if (HISTORICAL_ROUTES.get(item.id) !== item.expected_route) errors.push(`${item.id} expected route changed`);
  }
  if (errors.length > 0) return { valid: false, errors };

  const capsules = buildCapsules(fixture);
  const graph = compileExecutionGraph(capsules);
  if (!graph.valid) return { valid: false, errors: graph.errors };
  const schedule = planExecutionWaves(capsules, { max_parallel: fixture.max_parallel, global_active_budget_seconds: fixture.active_budget_seconds });
  if (!schedule.valid) return schedule;
  if (!schedule.deadline_feasible) errors.push(`active schedule exceeds 60 minutes by ${schedule.budget_deficit_seconds}s`);
  const deliveryForecast = compileProductionDeliveryForecast(buildDeliverySlo(fixture), capsules);
  if (!deliveryForecast.valid) errors.push(...deliveryForecast.errors.map((error) => `delivery forecast: ${error}`));
  const starts = Object.fromEntries(schedule.schedule.map((entry) => [entry.task_id, entry.start_offset_seconds]));
  if (!(starts.E2 === starts.E3 && starts.E3 === starts.E4 && starts.E4 === starts.E5)) errors.push("E2-E5 are not dispatched as one parallel feature wave");
  if (!(starts.E1C >= schedule.schedule.find((entry) => entry.task_id === "E1B2").finish_offset_seconds)) errors.push("E1B2/E1C migration conflict was not serialized");
  return { valid: errors.length === 0, errors, coverage, capsules, graph, schedule, deliveryForecast };
}

export function simulateSampleShadow(fixture, options = {}) {
  const preflight = validateSampleShadowFixture(fixture);
  if (!preflight.valid) return { valid: false, errors: preflight.errors };
  const { coverage, capsules, schedule, deliveryForecast } = preflight;
  const errors = [];

  const failureRoutes = fixture.historical_failures.map((item) => ({ ...item, actual_route: replayFailureCase(item, capsules[1]) }));
  for (const item of failureRoutes) if (item.actual_route !== item.expected_route) errors.push(`${item.id} routed ${item.actual_route} != ${item.expected_route}`);
  if (failureRoutes.length !== 12) errors.push("historical replay must retain exactly 12 failure archetypes");

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-sample-shadow-"));
  const eventsByTask = {};
  let authorizedEffects = 0;
  let evidenceObjects = 0;
  try {
    for (const [index, capsule] of capsules.entries()) {
      const write = authorizeEffect(capsule, {
        capability_id: `write-${capsule.task_id.toLowerCase()}-evidence`, principal: "executor", kind: "filesystem_write",
        target: capsule.allowed_files[0].path, file_action: "CREATE"
      });
      if (!write.authorized) errors.push(`${capsule.task_id} evidence effect denied: ${write.errors.join("; ")}`);
      else authorizedEffects += 1;
      const deploy = capsule.effect_capabilities.find((effect) => effect.kind === "deploy");
      if (deploy) {
        const permission = authorizeEffect(capsule, {
          capability_id: deploy.id, principal: "root", kind: "deploy", target: deploy.targets[0], idempotency_key: `${fixture.source_snapshot.head}:${capsule.task_id}`
        });
        if (!permission.authorized) errors.push(`${capsule.task_id} deploy effect denied: ${permission.errors.join("; ")}`);
        else authorizedEffects += 1;
      }
      eventsByTask[capsule.task_id] = acceptedEvents(capsule, index);
      const trust = new Set(["T13", "R1"]).has(capsule.task_id) ? "staging" : new Set(["T15", "V1"]).has(capsule.task_id) ? "production" : "hermetic";
      const put = putEvidenceObject(temp, {
        kind: "shadow-lifecycle-receipt",
        trust_level: trust,
        subject: `${fixture.wi}/${capsule.task_id}`,
        producer_id: `validator:${capsule.task_id}`,
        consumer_ids: [`task-acceptance:${capsule.task_id}`, "shadow-final-review"],
        generation_bindings: capsule.generation_bindings,
        relevant_digests: { capsule: compileCapsule(capsule).capsule_digest, plan: capsule.plan_digest },
        environment_identity: "sample-r21-shadow-v2",
        created_at: "2026-08-10T00:00:00.000Z",
        expires_at: null,
        payload: { exit_code: 0, validation_count: capsule.validations.length, simulated: true }
      });
      if (!put.valid) errors.push(`${capsule.task_id} evidence CAS failed: ${put.errors.join("; ")}`);
      else evidenceObjects += 1;
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  const finalStatus = projectExecutionStatus(capsules, eventsByTask);
  if (!finalStatus.valid || finalStatus.summary.completed !== capsules.length || finalStatus.summary.remaining !== 0) errors.push("full lifecycle event replay did not reach all-accepted");

  let liveSnapshot = null;
  if (options.source_root) {
    try {
      liveSnapshot = verifyLiveSnapshot(fixture, options.source_root);
      if (!liveSnapshot.valid) errors.push(...liveSnapshot.errors);
    } catch (error) {
      errors.push(`live snapshot verification failed: ${error.message}`);
    }
  }
  return {
    valid: errors.length === 0,
    errors,
    source_snapshot_verified: liveSnapshot?.valid ?? false,
    source_snapshot: liveSnapshot,
    coverage,
    accepted_prefix: fixture.accepted_prefix,
    imported_in_progress_evidence: fixture.in_progress_evidence,
    schedule: {
      predicted_active_wall_seconds: schedule.predicted_active_wall_seconds,
      predicted_active_wall_minutes: Number((schedule.predicted_active_wall_seconds / 60).toFixed(2)),
      sequential_active_seconds: schedule.sequential_active_seconds,
      parallel_speedup: schedule.predicted_speedup,
      active_budget_seconds: fixture.active_budget_seconds,
      reserve_seconds: fixture.active_budget_seconds - schedule.predicted_active_wall_seconds,
      max_parallel: fixture.max_parallel,
      task_schedule: schedule.schedule,
      deterministic_merge_order: schedule.deterministic_merge_order
    },
    delivery_forecast: deliveryForecast,
    proof: {
      lifecycle_stages: capsules.length,
      declared_validations: capsules.reduce((total, capsule) => total + capsule.validations.length, 0),
      authorized_effects: authorizedEffects,
      evidence_objects: evidenceObjects,
      accepted_event_chains: finalStatus.summary.completed,
      historical_failures_routed: failureRoutes.filter((item) => item.actual_route === item.expected_route).length,
      historical_failure_routes: failureRoutes
    },
    claim_boundary: "shadow controller simulation only; not implementation, external-review, landing, deployment or live-production proof"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = process.argv.slice(2);
    const fixtureIndex = args.indexOf("--fixture");
    const sourceIndex = args.indexOf("--source-root");
    if (fixtureIndex === -1 || !args[fixtureIndex + 1]) throw new Error("usage: replay-sample-revenue-activation-v2.mjs --fixture <json> [--source-root <Sample worktree>]");
    const fixture = JSON.parse(fs.readFileSync(args[fixtureIndex + 1], "utf8"));
    const result = simulateSampleShadow(fixture, { source_root: sourceIndex === -1 ? null : args[sourceIndex + 1] });
    (result.valid ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error.message] })}\n`);
    process.exitCode = 2;
  }
}
