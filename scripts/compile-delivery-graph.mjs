#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeJsonAtomic } from "./state-io.mjs";
import { injectMandatoryDeliveryChain, validateMandatoryDeliveryChain } from "./lib/mandatory-delivery-chain.mjs";

const EVIDENCE_FAMILIES = [
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

const SOLUTION_CONFIDENCE_MODES = new Set(["design_auto", "post_design_human_gate", "intake_only"]);

const LANE_BASE_SKILLS = {
  greenfield: [
    "write-vision", "analyze-domain", "analyze-competitors", "build-personas",
    "validate-feature", "write-spec", "audit-ac", "write-journeys",
    "design-ux", "design-ui", "design-tech", "plan-changeset",
    "review-plan", "execute-changeset", "review-gate", "audit-implementation",
    "land-changeset", "verify-promotion",
  ],
  "brownfield-feature": [
    "validate-feature", "write-spec", "audit-ac", "write-journeys",
    "design-ux", "design-ui", "design-tech", "plan-changeset",
    "review-plan", "execute-changeset", "review-gate", "audit-implementation",
    "land-changeset", "verify-promotion",
  ],
  bugfix: ["diagnose-bug", "execute-changeset", "review-gate", "audit-implementation", "land-changeset", "verify-promotion"],
  drift: ["sync-spec-code", "plan-changeset", "execute-changeset", "review-gate", "audit-implementation", "land-changeset", "verify-promotion"],
  refactor: ["sync-spec-code", "design-tech", "plan-changeset", "review-plan", "execute-changeset", "review-gate", "audit-implementation", "land-changeset", "verify-promotion"],
  framework: ["improve-framework", "plan-changeset", "execute-changeset", "review-gate", "audit-implementation", "land-changeset", "verify-promotion", "test-framework"],
  "brownfield-conversion": ["onboard-repo", "plan-capabilities", "review-gate", "verify-promotion"],
};

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = value;
      i += 1;
    }
  }
  return args;
}

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== "string" || value.trim() === "") return [];
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function bool(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function loadInput(args) {
  if (args.input) {
    return JSON.parse(readFileSync(args.input, "utf8"));
  }
  return {
    wi: args.wi,
    user_intent: args.intent,
    repo_mode: args["repo-mode"],
    change_type: args["change-type"],
    lane: args.lane,
    delivery_mode: args["delivery-mode"],
    delivery_tier: {
      mode: args["delivery-tier"],
      rationale: args["delivery-tier-rationale"],
      decision_log_ref: args["delivery-tier-decision"],
    },
    risk_flags: list(args["risk-flags"]),
    platform_contracts: list(args["platform-contracts"]),
    compression: {
      ratio: args["compression-ratio"],
      threshold: args["compression-threshold"],
      rationale: args["compression-rationale"],
    },
    solution_confidence_required: args["solution-confidence-required"],
    solution_confidence_mode: args["solution-confidence-mode"],
    solution_confidence_artifact: args["solution-confidence-artifact"],
    solution_confidence_approved_at: args["solution-confidence-approved-at"],
  };
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Missing required ${name}`);
  }
  return value.trim();
}

function isUserOrAdminFacingFeature({ changeType, riskFlags }) {
  return changeType === "feature" && (riskFlags.includes("user-facing") || riskFlags.includes("admin-facing"));
}

function requiresProviderFidelity({ riskFlags }) {
  return riskFlags.some((flag) => [
    "provider-backed",
    "generated-content",
    "ai-generation",
    "primary-provider",
    "saved-outcome",
  ].includes(flag));
}

function evidenceStatus({ family, changeType, riskFlags, platformContracts }) {
  const has = (flag) => riskFlags.includes(flag);
  const isDocsOnly = changeType === "docs" || has("docs-only");
  if (isDocsOnly) {
    if (["plan_review", "code_review", "promotion"].includes(family)) return "required";
    return "n/a";
  }
  if (family === "feature_validation_closeout") {
    return isUserOrAdminFacingFeature({ changeType, riskFlags }) ? "required" : "n/a";
  }
  if (family === "provider_fidelity") return requiresProviderFidelity({ riskFlags }) ? "required" : "n/a";
  if (family === "visual") return has("browser-visible") ? "required" : "n/a";
  if (family === "runtime") return (has("user-facing") || has("admin-facing") || has("backend-function")) ? "required" : "n/a";
  if (family === "deploy") return (has("deploy-affecting") || platformContracts.length > 0) ? "required" : "n/a";
  if (family === "session_forensics") return (has("retroactive") || has("graph-mismatch")) ? "required" : "n/a";
  if (["feature", "bugfix", "regression", "drift", "refactor", "framework"].includes(changeType)) return "required";
  return "n/a";
}

function normalizeSolutionConfidence(input, wi, riskFlags) {
  const raw = input.solution_confidence && typeof input.solution_confidence === "object"
    ? input.solution_confidence
    : {};
  const mode = String(input.solution_confidence_mode || raw.mode || "").trim();
  const required =
    bool(input.solution_confidence_required) ||
    bool(raw.required) ||
    mode.length > 0 ||
    riskFlags.includes("solution-confidence") ||
    riskFlags.includes("solution-confidence-required");

  if (!required) {
    return { required: false, mode: "none", status: "not_required" };
  }

  const normalizedMode = mode || "design_auto";
  if (!SOLUTION_CONFIDENCE_MODES.has(normalizedMode)) {
    throw new Error(`Unsupported solution_confidence_mode: ${normalizedMode}`);
  }

  const artifact = String(
    input.solution_confidence_artifact ||
    raw.artifact ||
    `docs/specs/decisions/${wi.toLowerCase()}-solution-confidence/SOLUTION-CONFIDENCE.md`
  ).trim();

  return {
    required: true,
    mode: normalizedMode,
    status: raw.status || "required",
    artifact,
    approved_at: input.solution_confidence_approved_at || raw.approved_at || null,
  };
}

function conditionalInsertions({ changeType, riskFlags, platformContracts, solutionConfidence }) {
  const out = [];
  const add = (skill, signal, reason, metadata = {}) => out.push({ skill, signal, reason, ...metadata });
  const has = (flag) => riskFlags.includes(flag);
  const featureCloseout = isUserOrAdminFacingFeature({ changeType, riskFlags });
  if (solutionConfidence.required) {
    add("research", "solution-confidence", "Solution confidence requires sourced world/provider grounding before design closes.", { before: "design-tech" });
    if (has("cost") || has("cache") || has("paid-provider") || has("metered-platform") || has("base44-platform")) {
      add("manage-finops", "solution-confidence-cost-cache", "Cost/cache-sensitive solution confidence requires explicit cost modeling.", { before: "design-tech" });
    }
    add("design-tech", "solution-confidence", "Solution confidence requires a technical confidence artifact before planning.", { before: "plan-changeset" });
    add("explore-solutions", "solution-confidence", "Solution confidence requires alternatives to challenge the baseline before planning.", { before: "plan-changeset" });
  }
  if (featureCloseout) {
    add("build-personas", "feature-validation-closeout", "User/admin-facing feature closeout requires persona coverage before AC validation.");
    add("write-e2e", "feature-validation-closeout", "User/admin-facing feature closeout requires E2E coverage when automatable or a ledger-recorded fixture gap.");
  }
  if (has("browser-visible")) {
    add("track-visuals", "browser-visible", "Browser-visible changes require visual baseline evidence before implementation.", { mode: "baseline" });
    add("track-visuals", "browser-visible", "Browser-visible changes require visual diff evidence after implementation.", { mode: "diff" });
  }
  if (has("user-facing") || has("admin-facing")) add("test-journeys", "runtime-facing", "User/admin-facing behavior requires runtime journey proof.");
  if (has("backend-function") || has("external-integration") || has("data-model-change") || has("concurrency")) {
    add("design-tech", "technical-risk", "Backend, data, integration, or concurrency risk requires technical design.");
    add("audit-implementation", "technical-risk", "Technical-risk implementation requires implementation audit.");
  }
  if (has("auth-sensitive")) add("review-security", "auth-sensitive", "Auth-sensitive changes require security review.");
  if (has("base44-platform") || platformContracts.includes("base44-environment")) {
    add("base44-environment", "base44-platform", "Base44/platform-affecting work requires environment verification.");
  }
  if (has("deploy-affecting")) add("base44-environment", "deploy-affecting", "Deploy-affecting work requires platform deployment checks when Base44 is present.");
  if (has("retroactive") || has("graph-mismatch")) {
    add("audit-session-execution", "retroactive-or-graph-mismatch", "Retroactive or mismatched closure requires session execution audit.");
  }
  return out;
}

function normalizeCompression(input) {
  const raw = input.compression || {};
  const ratio = Number(raw.ratio ?? input.compression_ratio ?? input.compressionRatio ?? 1);
  const threshold = Number(raw.threshold ?? input.compression_threshold ?? input.compressionThreshold ?? 2);
  const rationale = raw.rationale ?? input.compression_rationale ?? input.compressionRationale ?? "";
  return {
    ratio: Number.isFinite(ratio) && ratio > 0 ? ratio : 1,
    threshold: Number.isFinite(threshold) && threshold > 0 ? threshold : 2,
    rationale: String(rationale || "").trim(),
  };
}

function normalizeDeliveryTier(input, { requiredSkills, skipped, evidenceFamilies }) {
  const raw = input.delivery_tier || input.deliveryTier || {};
  const mode = String(raw.mode || input["delivery-tier"] || input.delivery_tier_mode || "full").trim();
  const validModes = new Set(["full", "compressed", "rush", "end_to_end"]);
  if (!validModes.has(mode)) throw new Error(`Unsupported delivery tier: ${mode}`);

  const rationale = String(raw.rationale || input["delivery-tier-rationale"] || "").trim();
  const decisionLogRef = String(raw.decision_log_ref || input["delivery-tier-decision"] || "").trim();
  const mandatorySkills = unique(raw.mandatory_skills || requiredSkills);
  const skippableSkills = unique(raw.skippable_skills || skipped.map((entry) => entry.skill));
  const blockedBehindOverride = mode === "full" || mode === "end_to_end"
    ? []
    : mandatorySkills.filter((skill) => {
        const familyRequired = Object.values(evidenceFamilies).includes("required");
        return familyRequired || ["validate-feature", "audit-ac", "write-journeys", "write-e2e", "test-journeys", "track-visuals", "review-gate", "verify-promotion"].includes(skill);
      });

  return {
    mode,
    selected_by: "route-workflow",
    rationale: rationale || (mode === "full" ? "Full framework validation is the default delivery tier." : ""),
    decision_log_ref: decisionLogRef,
    validation_policy: {
      mandatory_skills: mandatorySkills,
      skippable_skills: skippableSkills,
      blocked_behind_explicit_override: unique(blockedBehindOverride),
    },
  };
}

function skippedSkills({ changeType, riskFlags }) {
  if (changeType !== "docs" && !riskFlags.includes("docs-only")) return [];
  return [
    {
      skill: "design-ui",
      skip_condition_id: "design-ui:no-visual-surface",
      reason: "Docs-only change has no browser-visible product surface.",
      evidence: "change_type=docs or risk_flags includes docs-only",
    },
    {
      skill: "track-visuals",
      skip_condition_id: "track-visuals:no-browser-visible-change",
      reason: "Docs-only change has no UI/CSS/layout/asset delta.",
      evidence: "change_type=docs or risk_flags includes docs-only",
    },
    {
      skill: "test-journeys",
      skip_condition_id: "test-journeys:no-runtime-behavior-change",
      reason: "Docs-only change has no runtime behavior path.",
      evidence: "change_type=docs or risk_flags includes docs-only",
    },
  ];
}

function buildTaskSteps(baseSkills, conditionals) {
  const preLandProcesses = new Set(["test-framework", "review-security", "audit-session-execution"]);
  const rawSteps = baseSkills.map((skill) => ({ skill, source: "lane" }));
  const steps = rawSteps.filter((step) => !preLandProcesses.has(step.skill));
  const audit = steps.find((step) => step.skill === "audit-implementation");
  if (audit) for (const step of rawSteps.filter((candidate) => preLandProcesses.has(candidate.skill))) {
    audit.required_process_steps = [...(audit.required_process_steps || []), { skill: step.skill, before: "land-changeset", evidence_required: true }];
  }
  const insertAroundExecute = (entry) => {
    const planIndex = steps.findIndex((step) => step.skill === "plan-changeset");
    const executeIndex = steps.findIndex((step) => step.skill === "execute-changeset");
    if (planIndex === -1 || executeIndex === -1) {
      steps.push(entry);
      return;
    }
    // The mandatory delivery chain is one indivisible authority transition.
    // Baseline remains an explicit upstream node. The visual diff is a required
    // process step owned by execute-changeset so G5 consumes it before review;
    // it is not a top-level node that can split or trail the authority chain.
    if (entry.mode === "diff") {
      const processStep = { skill: "track-visuals", mode: "diff", before: "review-gate", signal: entry.signal };
      steps[executeIndex].required_process_steps = [...(steps[executeIndex].required_process_steps || []), processStep];
      return;
    }
    steps.splice(planIndex, 0, entry);
  };
  const insertRelative = (entry) => {
    const existingIndex = steps.findIndex((step) => step.skill === entry.skill);
    if (existingIndex !== -1) {
      steps[existingIndex] = { ...steps[existingIndex], ...entry, source: steps[existingIndex].source };
      return;
    }
    const beforeIndex = entry.before ? steps.findIndex((step) => step.skill === entry.before) : -1;
    if (beforeIndex !== -1) {
      steps.splice(beforeIndex, 0, { ...entry, source: "conditional" });
      return;
    }
    const afterIndex = entry.after ? steps.findIndex((step) => step.skill === entry.after) : -1;
    if (afterIndex !== -1) {
      steps.splice(afterIndex + 1, 0, { ...entry, source: "conditional" });
      return;
    }
    const planIndex = steps.findIndex((step) => step.skill === "plan-changeset");
    if (planIndex !== -1) {
      steps.splice(planIndex, 0, { ...entry, source: "conditional" });
      return;
    }
    const executeIndex = steps.findIndex((step) => step.skill === "execute-changeset");
    if (executeIndex !== -1) {
      steps.splice(executeIndex, 0, { ...entry, source: "conditional" });
      return;
    }
    steps.push({ ...entry, source: "conditional" });
  };

  for (const entry of conditionals) {
    if (entry.skill === "track-visuals" && entry.mode) {
      if (!steps.some((step) => step.skill === "track-visuals" && step.mode === entry.mode)) {
        insertAroundExecute({ ...entry, source: "conditional" });
      }
      continue;
    }
    if (entry.before || entry.after) {
      insertRelative(entry);
      continue;
    }
    if (preLandProcesses.has(entry.skill)) {
      const auditStep = steps.find((step) => step.skill === "audit-implementation");
      if (!auditStep) throw new Error(`${entry.skill} requires audit-implementation to own its pre-land process receipt`);
      if (!auditStep.required_process_steps?.some((step) => step.skill === entry.skill)) auditStep.required_process_steps = [...(auditStep.required_process_steps || []), { skill: entry.skill, before: "land-changeset", evidence_required: true, signal: entry.signal }];
      continue;
    }
    if (!steps.some((step) => step.skill === entry.skill)) {
      steps.push({ ...entry, source: "conditional" });
    }
  }

  return steps;
}

function taskList(steps, solutionConfidence) {
  const tasks = steps.map((step, index) => ({
    id: index + 1,
    subject: `${step.skill}${step.mode ? ` ${step.mode}` : ""}: delivery graph required step`,
    status: "pending",
    blocked_by: index === 0 ? [] : [index],
    metadata: {
      skill: step.skill,
      ...(step.mode ? { mode: step.mode } : {}),
      ...(step.signal ? { signal: step.signal } : {}),
      ...(step.required_process_steps ? { required_process_steps: step.required_process_steps } : {}),
    },
  }));
  if (solutionConfidence.required) {
    for (const task of tasks) {
      const skill = task.metadata?.skill;
      if (["design-tech", "explore-solutions", "plan-changeset"].includes(skill)) {
        task.metadata.solution_confidence_required = true;
        task.metadata.solution_confidence_mode = solutionConfidence.mode;
        task.metadata.solution_confidence_artifact = solutionConfidence.artifact;
      }
      if (solutionConfidence.mode === "post_design_human_gate" && skill === "plan-changeset" && !solutionConfidence.approved_at) {
        task.status = "blocked";
        task.metadata.solution_confidence_waits_for_approval = true;
      }
      if (solutionConfidence.mode === "intake_only" && [
        "research",
        "manage-finops",
        "design-tech",
        "explore-solutions",
        "plan-changeset",
        "review-plan",
        "execute-changeset",
        "review-gate",
        "audit-implementation",
        "land-changeset",
        "verify-promotion",
      ].includes(skill)) {
        task.status = "blocked";
        task.metadata.solution_confidence_intake_stop = true;
      }
    }
  }
  return tasks;
}

export function compileDeliveryGraph(input) {
  const wi = requireString(input.wi, "wi");
  const lane = requireString(input.lane, "lane");
  const changeType = requireString(input.change_type, "change_type");
  if (!LANE_BASE_SKILLS[lane]) throw new Error(`Unsupported lane: ${lane}`);

  const laneSkills = injectMandatoryDeliveryChain(LANE_BASE_SKILLS[lane]);
  const riskFlags = unique(list(input.risk_flags));
  const platformContracts = unique(list(input.platform_contracts));
  const solutionConfidence = normalizeSolutionConfidence(input, wi, riskFlags);
  const compression = normalizeCompression(input);
  const conditionals = conditionalInsertions({ changeType, riskFlags, platformContracts, solutionConfidence });
  const requiredSkills = unique([...laneSkills, ...conditionals.map((item) => item.skill)]);
  const requiredSteps = buildTaskSteps(laneSkills, conditionals);
  const chainValidation = validateMandatoryDeliveryChain(requiredSteps.map((step) => step.skill));
  if (!chainValidation.pass) {
    throw new Error(`compiler produced an invalid mandatory delivery chain: ${chainValidation.errors.join("; ")}`);
  }
  const evidenceFamilies = Object.fromEntries(EVIDENCE_FAMILIES.map((family) => [
    family,
    evidenceStatus({ family, changeType, riskFlags, platformContracts }),
  ]));
  const skipped = skippedSkills({ changeType, riskFlags });
  const deliveryTier = normalizeDeliveryTier(input, { requiredSkills, skipped, evidenceFamilies });

  const deliveryGraph = {
    compiler_version: 1,
    user_intent: requireString(input.user_intent, "user_intent"),
    repo_mode: input.repo_mode || "convert",
    change_type: changeType,
    lane,
    delivery_mode: input.delivery_mode || "interactive",
    delivery_tier: deliveryTier,
    risk_flags: riskFlags,
    platform_contracts: platformContracts,
    solution_confidence: solutionConfidence,
    compression,
    evidence_families: evidenceFamilies,
    required_skills: requiredSkills,
    conditional_mandatory_skills: conditionals,
    optional_skills: [],
    skipped_skills: skipped,
    verification_tiers: {
      local: ["tier-1"],
      runtime: evidenceFamilies.runtime === "required" ? ["targeted-runtime-smoke"] : [],
      production: evidenceFamilies.deploy === "required" ? ["platform-deploy-verification"] : [],
    },
    mutation_history: [
      {
        ts: new Date().toISOString(),
        source: "route-workflow",
        action: "initial_compile",
        reason: "Compiled delivery graph at lane entry before downstream mutation.",
      },
    ],
    closeout_classification_required: true,
  };

  return {
    wi,
    lane,
    created: new Date().toISOString(),
    status: "pending",
    delivery_graph: deliveryGraph,
    tasks: taskList(requiredSteps, solutionConfidence),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const graph = compileDeliveryGraph(loadInput(args));
    if (args.out) {
      const out = resolve(args.out);
      if (existsSync(out) && !args.force) {
        throw new Error(`${out} already exists; pass --force to overwrite`);
      }
      writeJsonAtomic(out, graph);
      console.log(`compiled ${out}`);
    } else {
      console.log(JSON.stringify(graph, null, 2));
    }
  } catch (error) {
    console.error(`compile-delivery-graph: ${error.message}`);
    process.exit(1);
  }
}
