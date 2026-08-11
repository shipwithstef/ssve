#!/usr/bin/env node
/**
 * Validate a route-workflow delivery_graph.
 *
 * This is the WI-299 closeout guard: completed graphs must not leave required
 * evidence families unresolved, required/conditional skills must be represented
 * as executable tasks or registry-backed skips, and legacy graphs without the
 * additive delivery_graph must be explicitly historical.
 */

import fs from "node:fs";
import path from "node:path";

const CUTOFF = Date.parse("2026-05-11T00:00:00.000Z");
const EVIDENCE_KEYS = [
  "product",
  "acceptance_criteria",
  "journey",
  "visual",
  "runtime",
  "plan_review",
  "code_review",
  "implementation_audit",
  "deploy",
  "promotion",
  "session_forensics",
  "feature_validation_closeout",
  "provider_fidelity",
];
const STATUS_VALUES = new Set(["required", "n/a", "satisfied"]);
const DELIVERY_TIERS = new Set(["full", "compressed", "rush", "end_to_end"]);
const SOLUTION_CONFIDENCE_MODES = new Set(["design_auto", "post_design_human_gate", "intake_only"]);
const BACKEND_FLAGS = new Set([
  "backend-function",
  "external-integration",
  "auth-sensitive",
  "data-model-change",
  "concurrency",
  "high-blast-radius",
]);
const USER_RUNTIME_FLAGS = new Set(["user-facing", "admin-facing"]);
const RETROACTIVE_FLAGS = new Set(["retroactive", "graph-mismatch", "user-challenged-closeout"]);
const PROVIDER_FIDELITY_FLAGS = new Set([
  "provider-backed",
  "generated-content",
  "ai-generation",
  "primary-provider",
  "saved-outcome",
]);

function usage() {
  console.error("Usage: node scripts/validate-delivery-graph.mjs <lane-tasks.json> [--registry references/skip-conditions.json]");
  process.exit(2);
}

function parseArgs(argv) {
  const out = { file: null, registry: "references/skip-conditions.json" };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--registry") {
      out.registry = argv[i + 1];
      i += 1;
    } else if (!out.file) {
      out.file = arg;
    } else {
      usage();
    }
  }
  if (!out.file) usage();
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function taskSkill(task) {
  return task?.metadata?.skill || task?.skill || null;
}

function tasksWithSkill(tasks, skill) {
  return tasks.filter((task) => taskSkill(task) === skill);
}

function firstTaskWithSkill(tasks, skill) {
  return tasks.find((task) => taskSkill(task) === skill) || null;
}

function isLegacyGraph(graph) {
  if (graph.delivery_graph) return false;
  if (graph.delivery_graph_legacy === true || graph.legacy_delivery_graph === true) return true;
  if (graph.metadata?.delivery_graph_legacy === true || graph.metadata?.legacy_delivery_graph === true) {
    return true;
  }
  const created = Date.parse(graph.created || "");
  return Number.isFinite(created) && created < CUTOFF;
}

function loadSkipIds(registryPath) {
  const registry = readJson(registryPath);
  const ids = new Set();
  for (const [skill, entry] of Object.entries(registry.skills || {})) {
    ids.add(`${skill}:registry-skip`);
    if (typeof entry.skip_condition_id === "string") ids.add(entry.skip_condition_id);
  }
  for (const entry of Object.values(registry.graph_level_skip_conditions || {})) {
    if (typeof entry.id === "string") ids.add(entry.id);
  }
  return ids;
}

function hasFlag(flags, candidates) {
  return flags.some((flag) => candidates.has(flag));
}

function skipsFor(graph, skill, validSkipIds) {
  const skipped = graph.delivery_graph?.skipped_skills || [];
  return skipped.filter((entry) => {
    return entry?.skill === skill && entry.skip_condition_id && validSkipIds.has(entry.skip_condition_id);
  });
}

function addIssue(issues, issue) {
  issues.push(issue);
}

function validateGraph(graph, filePath, validSkipIds) {
  const issues = [];
  if (!graph.delivery_graph) {
    if (isLegacyGraph(graph)) {
      return { pass: true, issues, legacy: true };
    }
    addIssue(issues, "missing delivery_graph without legacy marker or pre-WI-299 created timestamp");
    return { pass: false, issues, legacy: false };
  }

  const dg = graph.delivery_graph;
  const tasks = graph.tasks || [];
  const taskSkills = new Set(tasks.map(taskSkill).filter(Boolean));
  const skipped = dg.skipped_skills || [];
  const riskFlags = Array.isArray(dg.risk_flags) ? dg.risk_flags : [];
  const platformContracts = Array.isArray(dg.platform_contracts) ? dg.platform_contracts : [];
  const completed = graph.status === "completed";
  const deployedUnverified = graph.status === "deployed-unverified";
  const evidence = dg.evidence_families || {};
  const solutionConfidence = dg.solution_confidence || {};
  const compression = dg.compression || {};
  const deliveryTier = dg.delivery_tier || {};
  const compressionRatio = Number(compression.ratio ?? 1);
  const compressionThreshold = Number(compression.threshold ?? 2);

  if (!deliveryTier || typeof deliveryTier !== "object" || Array.isArray(deliveryTier)) {
    addIssue(issues, "delivery_tier object is missing");
  } else {
    if (!DELIVERY_TIERS.has(deliveryTier.mode)) {
      addIssue(issues, `delivery_tier.mode has invalid value '${deliveryTier.mode || ""}'`);
    }
    if (!deliveryTier.selected_by) {
      addIssue(issues, "delivery_tier.selected_by is required");
    }
    const policy = deliveryTier.validation_policy || {};
    if (!Array.isArray(policy.mandatory_skills) || policy.mandatory_skills.length === 0) {
      addIssue(issues, "delivery_tier.validation_policy.mandatory_skills must be a non-empty array");
    }
    if (!Array.isArray(policy.skippable_skills)) {
      addIssue(issues, "delivery_tier.validation_policy.skippable_skills must be an array");
    }
    if (!Array.isArray(policy.blocked_behind_explicit_override)) {
      addIssue(issues, "delivery_tier.validation_policy.blocked_behind_explicit_override must be an array");
    }
    if (deliveryTier.mode === "compressed" || deliveryTier.mode === "rush") {
      if (!deliveryTier.rationale || typeof deliveryTier.rationale !== "string") {
        addIssue(issues, `${deliveryTier.mode} delivery tier requires rationale`);
      }
      if (!deliveryTier.decision_log_ref || typeof deliveryTier.decision_log_ref !== "string") {
        addIssue(issues, `${deliveryTier.mode} delivery tier requires decision_log_ref`);
      }
      if (policy.blocked_behind_explicit_override?.length === 0) {
        addIssue(issues, `${deliveryTier.mode} delivery tier must declare validation blocked behind explicit override`);
      }
    }
  }

  for (const key of EVIDENCE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(evidence, key)) {
      addIssue(issues, `evidence_families.${key} is missing`);
      continue;
    }
    if (!STATUS_VALUES.has(evidence[key])) {
      addIssue(issues, `evidence_families.${key} has invalid status '${evidence[key]}'`);
    }
    if (completed && evidence[key] === "required") {
      addIssue(issues, `completed graph still has required evidence_families.${key}`);
    }
  }

  for (const entry of skipped) {
    if (!entry?.skill) {
      addIssue(issues, "skipped_skills entry is missing skill");
    }
    if (!entry?.skip_condition_id || !validSkipIds.has(entry.skip_condition_id)) {
      addIssue(issues, `skipped skill ${entry?.skill || "<unknown>"} has unregistered skip_condition_id '${entry?.skip_condition_id || ""}'`);
    }
    if (!entry?.reason || !entry?.evidence) {
      addIssue(issues, `skipped skill ${entry?.skill || "<unknown>"} must include reason and evidence`);
    }
  }

  const requiredSkills = new Set(dg.required_skills || []);
  for (const entry of dg.conditional_mandatory_skills || []) {
    if (entry?.skill) requiredSkills.add(entry.skill);
  }

  if (solutionConfidence.required === true || riskFlags.includes("solution-confidence") || riskFlags.includes("solution-confidence-required")) {
    const mode = solutionConfidence.mode || "";
    if (!SOLUTION_CONFIDENCE_MODES.has(mode)) {
      addIssue(issues, `solution_confidence.mode has invalid value '${mode}'`);
    }
    if (typeof solutionConfidence.artifact !== "string" || !solutionConfidence.artifact.endsWith("SOLUTION-CONFIDENCE.md")) {
      addIssue(issues, "solution_confidence.artifact must point to SOLUTION-CONFIDENCE.md");
    }
    for (const skill of ["design-tech", "explore-solutions"]) {
      if (!taskSkills.has(skill) && skipsFor(graph, skill, validSkipIds).length === 0) {
        addIssue(issues, `solution confidence graph lacks ${skill} task or valid skip`);
      }
      if (!requiredSkills.has(skill)) {
        addIssue(issues, `solution confidence required_skills omits ${skill}`);
      }
    }
    if (mode !== "intake_only" && !taskSkills.has("research") && skipsFor(graph, "research", validSkipIds).length === 0) {
      addIssue(issues, "solution confidence graph lacks research task or valid skip for world grounding");
    }
    const planTask = firstTaskWithSkill(tasks, "plan-changeset");
    if (!planTask && mode !== "intake_only") {
      addIssue(issues, "solution confidence graph lacks plan-changeset task");
    }
    if (mode === "post_design_human_gate" && !solutionConfidence.approved_at) {
      if (!planTask || planTask.status !== "blocked") {
        addIssue(issues, "post_design_human_gate must block plan-changeset until explicit approval");
      }
      if (planTask && planTask.metadata?.solution_confidence_waits_for_approval !== true) {
        addIssue(issues, "post_design_human_gate plan task must record solution_confidence_waits_for_approval");
      }
    }
    if (completed && solutionConfidence.status !== "satisfied") {
      addIssue(issues, "completed solution confidence graph must mark solution_confidence.status as satisfied");
    }
  }

  if (deployedUnverified && evidence.promotion !== "required") {
    addIssue(issues, "DEPLOYED-UNVERIFIED graph must keep promotion evidence required until verify-promotion closes it");
  }

  if (compressionRatio > compressionThreshold) {
    if (!compression.rationale || typeof compression.rationale !== "string") {
      addIssue(issues, "high-compression graph must record compression.rationale");
    }
    const auditIndex = tasks.findIndex((task) => taskSkill(task) === "audit-implementation");
    const landIndex = tasks.findIndex((task) => taskSkill(task) === "land-changeset");
    if (auditIndex === -1) {
      addIssue(issues, "high-compression graph lacks audit-implementation task");
    } else if (landIndex !== -1 && auditIndex > landIndex) {
      addIssue(issues, "high-compression graph must run audit-implementation before land-changeset");
    }
    if (!deployedUnverified && !completed) {
      addIssue(issues, "high-compression in-flight graph must use status deployed-unverified until promotion evidence closes");
    }
  }

  for (const skill of requiredSkills) {
    if (!taskSkills.has(skill) && skipsFor(graph, skill, validSkipIds).length === 0) {
      addIssue(issues, `required skill '${skill}' is neither a task nor a registry-backed skip`);
    }
  }

  for (const skill of requiredSkills) {
    if (deliveryTier.validation_policy?.mandatory_skills &&
        !deliveryTier.validation_policy.mandatory_skills.includes(skill)) {
      addIssue(issues, `delivery_tier mandatory_skills omits required skill '${skill}'`);
    }
  }

  if (riskFlags.includes("browser-visible")) {
    const visualTasks = tasksWithSkill(tasks, "track-visuals");
    if (visualTasks.length === 0 && skipsFor(graph, "track-visuals", validSkipIds).length === 0) {
      addIssue(issues, "browser-visible graph lacks track-visuals task or valid visual N/A skip");
    }
    const visualModes = new Set(visualTasks.map((task) => task?.metadata?.mode).filter(Boolean));
    if (visualTasks.length > 0 && (!visualModes.has("baseline") || !visualModes.has("diff"))) {
      addIssue(issues, "browser-visible graph must include track-visuals tasks with metadata.mode baseline and diff");
    }
    if (completed && evidence.visual !== "satisfied" && evidence.visual !== "n/a") {
      addIssue(issues, "browser-visible completed graph lacks visual evidence satisfaction or valid N/A");
    }
  }

  if (hasFlag(riskFlags, USER_RUNTIME_FLAGS)) {
    const hasRuntimeSkill = taskSkills.has("test-journeys") || taskSkills.has("write-e2e");
    const hasRuntimeSkip =
      skipsFor(graph, "test-journeys", validSkipIds).length > 0 ||
      skipsFor(graph, "write-e2e", validSkipIds).length > 0;
    if (!hasRuntimeSkill && !hasRuntimeSkip) {
      addIssue(issues, "user/admin-facing graph lacks runtime journey/e2e task or valid N/A skip");
    }
    if (completed && evidence.runtime !== "satisfied" && evidence.runtime !== "n/a") {
      addIssue(issues, "user/admin-facing completed graph lacks runtime evidence satisfaction or valid N/A");
    }
  }

  const userOrAdminFacingFeature =
    dg.change_type === "feature" && hasFlag(riskFlags, USER_RUNTIME_FLAGS);
  if (userOrAdminFacingFeature) {
    if (evidence.feature_validation_closeout !== "required" &&
        evidence.feature_validation_closeout !== "satisfied" &&
        evidence.feature_validation_closeout !== "n/a") {
      addIssue(issues, "user/admin-facing feature graph has invalid feature_validation_closeout evidence state");
    }
    if (completed && evidence.feature_validation_closeout !== "satisfied" && evidence.feature_validation_closeout !== "n/a") {
      addIssue(issues, "user/admin-facing completed feature lacks feature validation closeout ledger evidence satisfaction");
    }
    if (!taskSkills.has("build-personas") && skipsFor(graph, "build-personas", validSkipIds).length === 0) {
      addIssue(issues, "user/admin-facing feature graph lacks build-personas task or valid persona N/A skip");
    }
    if (!taskSkills.has("write-e2e") && skipsFor(graph, "write-e2e", validSkipIds).length === 0) {
      addIssue(issues, "user/admin-facing feature graph lacks write-e2e task or valid fixture-gap skip");
    }
  }

  if (hasFlag(riskFlags, PROVIDER_FIDELITY_FLAGS)) {
    if (evidence.provider_fidelity !== "required" &&
        evidence.provider_fidelity !== "satisfied" &&
        evidence.provider_fidelity !== "n/a") {
      addIssue(issues, "provider-backed/generated graph has invalid provider_fidelity evidence state");
    }
    if (completed && evidence.provider_fidelity !== "satisfied" && evidence.provider_fidelity !== "n/a") {
      addIssue(issues, "provider-backed/generated completed graph lacks provider fidelity evidence satisfaction");
    }
    if (!taskSkills.has("review-gate") && skipsFor(graph, "review-gate", validSkipIds).length === 0) {
      addIssue(issues, "provider-backed/generated graph lacks review-gate task or valid review skip");
    }
  }

  if (hasFlag(riskFlags, BACKEND_FLAGS)) {
    if (!taskSkills.has("audit-implementation") && skipsFor(graph, "audit-implementation", validSkipIds).length === 0) {
      addIssue(issues, "backend/auth/data/concurrency graph lacks audit-implementation task or valid N/A skip");
    }
    if (completed && evidence.implementation_audit !== "satisfied" && evidence.implementation_audit !== "n/a") {
      addIssue(issues, "technical-risk completed graph lacks implementation audit evidence satisfaction or valid N/A");
    }
  }

  const trivialPlan = riskFlags.includes("trivial-plan") || dg.delivery_mode === "trivial";
  if (!trivialPlan) {
    if (!taskSkills.has("review-plan") && skipsFor(graph, "review-plan", validSkipIds).length === 0) {
      addIssue(issues, "non-trivial graph lacks review-plan task or valid prior/trivial review skip");
    }
  }

  const base44OrDeploy =
    riskFlags.includes("base44-platform") ||
    riskFlags.includes("deploy-affecting") ||
    platformContracts.includes("base44-environment");
  if (base44OrDeploy) {
    if (!taskSkills.has("base44-environment") && skipsFor(graph, "base44-environment", validSkipIds).length === 0) {
      addIssue(issues, "Base44/deploy-affecting graph lacks base44-environment task or valid N/A skip");
    }
    if (completed && evidence.deploy !== "satisfied" && evidence.deploy !== "n/a") {
      addIssue(issues, "Base44/deploy-affecting completed graph lacks deploy evidence satisfaction or valid N/A");
    }
  }

  if (hasFlag(riskFlags, RETROACTIVE_FLAGS)) {
    if (!taskSkills.has("audit-session-execution") && skipsFor(graph, "audit-session-execution", validSkipIds).length === 0) {
      addIssue(issues, "retroactive/challenged graph lacks audit-session-execution task or valid N/A skip");
    }
    if (completed && evidence.session_forensics !== "satisfied" && evidence.session_forensics !== "n/a") {
      addIssue(issues, "retroactive/challenged completed graph lacks session forensics evidence satisfaction or valid N/A");
    }
  }

  return { pass: issues.length === 0, issues, legacy: false };
}

const args = parseArgs(process.argv.slice(2));
const filePath = path.resolve(args.file);
const registryPath = path.resolve(args.registry);
const graph = readJson(filePath);
const validSkipIds = loadSkipIds(registryPath);
const result = validateGraph(graph, filePath, validSkipIds);

if (result.pass) {
  const label = result.legacy ? "legacy graph accepted" : "delivery graph valid";
  console.log(`${path.relative(process.cwd(), filePath)}: PASS - ${label}`);
  process.exit(0);
}

console.error(`${path.relative(process.cwd(), filePath)}: FAIL - ${result.issues.length} issue(s)`);
for (const issue of result.issues) {
  console.error(`  - ${issue}`);
}
process.exit(1);
