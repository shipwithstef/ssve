#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const evalsPath = path.join(repoRoot, "test-framework/evals/evals.json");
const baselinePath = path.join(repoRoot, "test-framework/evals/tier-3/skill-baselines.json");

/** Read an input snapshot without changing it. */
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Preserve scenario fields and order while checking the source collection. */
function tier2Scenarios(evals) {
  const scenarios = evals?.tiers?.["tier-2"]?.scenarios;
  if (!Array.isArray(scenarios) || scenarios.some((item) => !item || typeof item !== "object")) {
    throw new Error("tier-2 scenarios must be an array of scenario objects");
  }
  return scenarios.map((scenario) => ({
    name: scenario.name,
    path: scenario.path,
    skill: scenario.skill_under_test,
  }));
}

/** Require real integer budgets, never coercible strings or non-finite numbers. */
function requireBudget(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive safe integer`);
}

/** Refuse empty and duplicate identities before counting coverage. */
function requireIdentities(values, label) {
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error(`${label} must contain nonempty strings`);
  }
  if (new Set(values.map((value) => value.trim())).size !== values.length) {
    throw new Error(`${label} must be unique`);
  }
}

/** Build an offline plan only after validating numeric and identity inputs. */
function buildPlan() {
  const evals = readJson(evalsPath);
  const baselines = readJson(baselinePath);
  const scenarios = tier2Scenarios(evals);
  const dimensions = baselines.dimensions ?? ["completeness", "actionability", "consistency"];
  requireBudget(baselines.max_judgments, "max_judgments");
  requireBudget(baselines.estimated_tokens_per_judgment, "estimated_tokens_per_judgment");
  requireIdentities(dimensions, "dimensions");
  requireIdentities(scenarios.map((scenario) => scenario.name), "scenario names");
  const count = scenarios.length * dimensions.length;
  const tokens = count * baselines.estimated_tokens_per_judgment;
  if (!Number.isSafeInteger(count) || !Number.isSafeInteger(tokens)) throw new Error("coverage totals exceed safe integer precision");
  if (count > baselines.max_judgments) throw new Error(`judgment count ${count} exceeds max_judgments ${baselines.max_judgments}`);
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

/** Retain the existing scenario floor, dimensions, score range, and judgment cap. */
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

try {
  const plan = buildPlan();
  const errors = validate(plan);
  if (errors.length) {
    for (const error of errors) console.error(`ERROR: ${error}`);
    process.exitCode = 1;
  } else if (process.argv.includes("--json")) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    console.log(`tier3 coverage plan: ${plan.scenario_count} scenarios, ${plan.dimensions.length} dimensions, ${plan.judgments.length} judgments, max ${plan.max_judgments}`);
  }
} catch (error) { console.error(`ERROR: ${error.message}`); process.exitCode = 1; }
