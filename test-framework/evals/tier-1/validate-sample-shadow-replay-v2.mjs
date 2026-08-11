#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { simulateSampleShadow, validateSampleShadowFixture } from "../../../scripts/replay-sample-revenue-activation-v2.mjs";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`not ok ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

const fixturePath = path.resolve(import.meta.dirname, "../../fixtures/execution-controller-v2/sample-revenue-activation-r21-shadow.json");
const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
const baseline = simulateSampleShadow(fixture);

check("real-snapshot-bound lifecycle stays under 60 active minutes without coverage reduction", () => {
  const result = baseline;
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.coverage.acceptance_criteria, 81);
  assert.equal(result.coverage.task_mappings, 81);
  assert.equal(result.coverage.test_mappings, 81);
  assert.equal(result.coverage.journey_scenarios, 12);
  assert.equal(result.coverage.journey_assertions, 74);
  assert.equal(result.schedule.predicted_active_wall_seconds, 2190);
  assert.equal(result.schedule.reserve_seconds, 1410);
  assert.equal(result.schedule.sequential_active_seconds, 3390);
  assert.equal(result.delivery_forecast.status, "SHADOW_ONLY");
  assert.equal(result.delivery_forecast.estimate_proven, false);
  assert.equal(result.delivery_forecast.estimate_basis, "DECLARED_TARGETS");
  assert.equal(result.delivery_forecast.core_active_wall_seconds, 1020);
  assert.equal(result.delivery_forecast.production_completion_extra_wall_seconds, 1170);
  assert.equal(result.delivery_forecast.risk_reserve_seconds, 600);
  assert.equal(result.delivery_forecast.forecast_active_seconds, 2790);
  assert.equal(result.delivery_forecast.forecast_speedup, 71.61);
  assert.equal(result.delivery_forecast.external_wait_seconds, null);
});

check("complete controller loop retains implementation review and production closeout", () => {
  const result = baseline;
  assert.deepEqual(result.schedule.deterministic_merge_order, fixture.required_stage_ids);
  assert.equal(result.proof.lifecycle_stages, 16);
  assert.equal(result.proof.declared_validations, 65);
  assert.equal(result.proof.authorized_effects, 19);
  assert.equal(result.proof.evidence_objects, 16);
  assert.equal(result.proof.accepted_event_chains, 16);
  assert.equal(result.proof.historical_failures_routed, 12);
  assert(result.schedule.task_schedule.some((stage) => stage.task_id === "H1"));
  assert(result.schedule.task_schedule.some((stage) => stage.task_id === "T13"));
  assert(result.schedule.task_schedule.some((stage) => stage.task_id === "R1"));
  assert(result.schedule.task_schedule.some((stage) => stage.task_id === "T15"));
  assert(result.schedule.task_schedule.some((stage) => stage.task_id === "V1"));
  assert(result.schedule.task_schedule.some((stage) => stage.task_id === "L2"));
});

check("parallel implementation and serialized migration both remain enforced", () => {
  const result = baseline;
  const byId = Object.fromEntries(result.schedule.task_schedule.map((stage) => [stage.task_id, stage]));
  assert.equal(byId.E2.start_offset_seconds, byId.E3.start_offset_seconds);
  assert.equal(byId.E3.start_offset_seconds, byId.E4.start_offset_seconds);
  assert.equal(byId.E4.start_offset_seconds, byId.E5.start_offset_seconds);
  assert(byId.E1C.start_offset_seconds >= byId.E1B2.finish_offset_seconds);
  assert(byId.E6.start_offset_seconds >= byId.E1C.finish_offset_seconds);
});

check("all historical Sample failure archetypes have causal routes", () => {
  const result = baseline;
  assert.equal(result.proof.historical_failure_routes.length, 12);
  assert(result.proof.historical_failure_routes.every((item) => item.actual_route === item.expected_route));
  assert.equal(result.proof.historical_failure_routes.filter((item) => item.plan_repair).length, 3);
});

check("10 distinct coverage, schedule, interface and routing mutations produce zero false PASS", () => {
  let falsePasses = 0;
  for (let index = 0; index < 10; index += 1) {
    const input = structuredClone(fixture);
    switch (index) {
      case 0: input.coverage.acceptance_criteria = 80; break;
      case 1: input.stages.splice(7, 1); break;
      case 2: input.stages.find((stage) => stage.id === "E3").consumes[1].id = "wrong-interface"; break;
      case 3: input.historical_failures[0].expected_route = "EXECUTOR_RETRY"; break;
      case 4: input.external_dependencies[0].counts_as_active_engineering_time = true; break;
      case 5: input.in_progress_evidence.latest_pass_count = 5; break;
      case 6: input.active_budget_seconds = 2000; break;
      case 7: input.stages.find((stage) => stage.id === "E6").validation_count = 0; break;
      case 8: input.coverage.accepted_units = 3; break;
      case 9: [input.stages[1], input.stages[2]] = [input.stages[2], input.stages[1]]; break;
    }
    if (validateSampleShadowFixture(input).valid) falsePasses += 1;
  }
  assert.equal(falsePasses, 0);
});

check("rollback and every other production completion extra are discovered before dispatch", () => {
  assert.deepEqual(baseline.delivery_forecast.identified_production_extras, [
    "VALIDATION", "HOLISTIC_REVIEW", "FINAL_SHA_AND_LANDING", "RELEASE_AND_CONFIG",
    "LIVE_VERIFICATION", "ROLLBACK", "OPERABILITY", "OUTCOME_OBSERVATION"
  ]);
  const input = structuredClone(fixture);
  input.stages = input.stages.filter((stage) => stage.id !== "R1");
  input.stages.find((stage) => stage.id === "T15").dependencies = ["T13"];
  input.stages.find((stage) => stage.id === "T15").merge_dependencies = ["T13"];
  input.stages.find((stage) => stage.id === "T15").consumes = input.stages.find((stage) => stage.id === "T15").consumes.filter((item) => item.producer !== "R1");
  input.required_stage_ids = input.required_stage_ids.filter((id) => id !== "R1");
  const result = validateSampleShadowFixture(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("always requires ROLLBACK")), result.errors.join("; "));
});

check("the 24-hour feature example admits only when its complete forecast remains below 60 minutes", () => {
  const input = structuredClone(fixture);
  input.delivery_forecast.baseline_feature_minutes = 24 * 60;
  const result = validateSampleShadowFixture(input);
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.deliveryForecast.target_active_seconds, 60 * 60);
  assert.equal(result.deliveryForecast.forecast_active_seconds, 2790);
  assert.equal(result.deliveryForecast.forecast_speedup, 30.97);
  assert(result.deliveryForecast.forecast_speedup >= 24);
});

check("repository and effect signals force product-specific extras even when the declaration omits them", () => {
  const input = structuredClone(fixture);
  for (const stage of input.stages.filter((row) => new Set(["E1B2", "E1C"]).has(row.id))) stage.production_obligation_id = "PRODUCT_CODE";
  const result = validateSampleShadowFixture(input);
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("signals require DATA_AND_MIGRATION")), result.errors.join("; "));
});

check("CLI labels simulation honestly rather than claiming deployment", () => {
  const script = path.resolve(import.meta.dirname, "../../../scripts/replay-sample-revenue-activation-v2.mjs");
  const result = spawnSync(process.execPath, [script, "--fixture", fixturePath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.valid, true);
  assert.equal(payload.source_snapshot_verified, false);
  assert(payload.claim_boundary.includes("simulation only"));
  assert(payload.claim_boundary.includes("not implementation"));
  assert(payload.claim_boundary.includes("deployment or live-production proof"));
});

if (process.exitCode) console.error(`Sample shadow replay v2: ${passed} passed, failures present`);
else console.log(`Sample shadow replay v2: ${passed} passed, 0 failed`);
