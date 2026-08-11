#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const evalsPath = path.join(repoRoot, "test-framework/evals/evals.json");
const baselinePath = path.join(repoRoot, "test-framework/evals/tier-3/skill-baselines.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function tier2Scenarios(evals) {
  return evals.tiers["tier-2"].scenarios.map((scenario) => ({
    name: scenario.name,
    path: scenario.path,
    skill: scenario.skill_under_test,
  }));
}

function buildPlan() {
  const evals = readJson(evalsPath);
  const baselines = readJson(baselinePath);
  const scenarios = tier2Scenarios(evals);
  const dimensions = baselines.dimensions || ["completeness", "actionability", "consistency"];
  const judgments = scenarios.flatMap((scenario) =>
    dimensions.map((dimension) => ({
      scenario: scenario.name,
      skill: scenario.skill,
      dimension,
      min_score: baselines.skills?.[scenario.skill]?.[dimension] ?? baselines.default_min_score,
    }))
  );

  return {
    scenario_count: scenarios.length,
    dimensions,
    max_judgments: baselines.max_judgments,
    estimated_max_tokens: judgments.length * baselines.estimated_tokens_per_judgment,
    scenarios,
    judgments,
  };
}

function validate(plan) {
  const errors = [];
  if (plan.scenario_count < 35) errors.push(`expected at least 35 tier-2 scenarios, got ${plan.scenario_count}`);
  if (!plan.dimensions.includes("completeness")) errors.push("missing completeness dimension");
  if (!plan.dimensions.includes("actionability")) errors.push("missing actionability dimension");
  if (!plan.dimensions.includes("consistency")) errors.push("missing consistency dimension");
  if (plan.judgments.length > plan.max_judgments) {
    errors.push(`judgment count ${plan.judgments.length} exceeds max_judgments ${plan.max_judgments}`);
  }
  for (const judgment of plan.judgments) {
    if (!Number.isInteger(judgment.min_score) || judgment.min_score < 1 || judgment.min_score > 10) {
      errors.push(`${judgment.scenario}/${judgment.dimension} has invalid min_score`);
    }
  }
  return errors;
}

const plan = buildPlan();
const errors = validate(plan);
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(plan, null, 2));
}
if (errors.length > 0) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
if (!process.argv.includes("--json")) {
  console.log(
    `tier3 coverage plan: ${plan.scenario_count} scenarios, ${plan.dimensions.length} dimensions, ${plan.judgments.length} judgments, max ${plan.max_judgments}`
  );
}
