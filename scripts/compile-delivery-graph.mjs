#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeJsonAtomic } from "./state-io.mjs";
import { injectMandatoryDeliveryChain, validateMandatoryDeliveryChain } from "./lib/mandatory-delivery-chain.mjs";
import {
  EXTERNAL_RESEARCH_REQUIRED,
  RESOLVED,
  collectResearchQuestions,
  matchingResearchTask,
  reevaluateQuestion,
  researchDecision,
  researchInputMatches,
} from "./lib/research-decision.mjs";

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
    planned_files: list(args["planned-files"] || args["files-planned"] || args.files),
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

function conditionalInsertions({ changeType, riskFlags, platformContracts, solutionConfidence, researchInsertions = [] }) {
  const out = [];
  const add = (skill, signal, reason, metadata = {}) => out.push({ skill, signal, reason, ...metadata });
  const has = (flag) => riskFlags.includes(flag);
  const featureCloseout = isUserOrAdminFacingFeature({ changeType, riskFlags });
  for (const insertion of researchInsertions) {
    add("research", "external-research-required", insertion.reason, {
      before: insertion.before || "design-tech",
      requesting_decision_id: insertion.requesting_decision_id,
      question_id: insertion.question_id,
    });
  }
  if (solutionConfidence.required) {
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
    const existingIndex = steps.findIndex((step) => {
      if (step.skill !== entry.skill) return false;
      if (entry.skill === "research") {
        return String(step.requesting_decision_id || "") === String(entry.requesting_decision_id || "");
      }
      return true;
    });
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
      ...(step.requesting_decision_id ? { requesting_decision_id: step.requesting_decision_id } : {}),
      ...(step.question_id ? { question_id: step.question_id } : {}),
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

function taskMatchKey(task) {
  const skill = task?.metadata?.skill || task?.skill || "";
  if (skill === "research") return "research:" + String(task.metadata?.requesting_decision_id || "");
  return skill + ":" + String(task.metadata?.mode || "");
}

function applyExistingGraph(tasks, existingGraph) {
  const existing = Array.isArray(existingGraph?.tasks) ? existingGraph.tasks : [];
  if (!existing.length) return tasks;
  const reserved = new Set();
  const queues = new Map();
  for (const task of existing) {
    if (!Number.isInteger(task.id) || task.id < 1 || reserved.has(task.id)) throw new Error("invalid existing task identity");
    reserved.add(task.id);
    const key = taskMatchKey(task);
    if (!queues.has(key)) queues.set(key, []);
    queues.get(key).push(task);
  }
  let nextId = Math.max(...reserved) + 1;
  const remap = new Map(), matched = new Set(), pairs = [];
  for (const task of tasks) {
    const prev = queues.get(taskMatchKey(task))?.shift();
    const id = prev ? prev.id : nextId++;
    remap.set(task.id, id);
    if (prev) matched.add(prev.id);
    const clone = {
      ...structuredClone(prev || {}), ...task, id,
      status: prev?.status || task.status,
      metadata: { ...structuredClone(prev?.metadata || {}), ...task.metadata },
    };
    if (task.metadata?.solution_confidence_mode) {
      for (const flag of ["solution_confidence_waits_for_approval", "solution_confidence_intake_stop"]) {
        if (!task.metadata[flag]) {
          delete clone.metadata[flag];
          if (prev?.metadata?.[flag] && clone.status === "blocked") clone.status = "pending";
        }
      }
    }
    pairs.push({ task, prev, clone });
  }
  const out = pairs.map(({ task, prev, clone }) => {
    const required = (task.blocked_by || []).map(id => remap.get(id));
    clone.blocked_by = prev?.status === "completed"
      ? [...(prev.blocked_by || [])]
      : [...new Set([...(prev?.blocked_by || []), ...required])];
    return clone;
  });
  for (const prev of existing) {
    if (matched.has(prev.id)) continue;
    // Retain completed evidence and unrelated work. Unstarted research that is
    // no longer needed is archived separately, never marked completed.
    if ((prev.metadata?.skill || prev.skill) === "research" && prev.status !== "completed") continue;
    out.push(structuredClone(prev));
  }
  const ids = new Set(out.map(task => task.id));
  const retired = new Set(existing.filter(task => !ids.has(task.id)).map(task => task.id));
  for (const task of out) task.blocked_by = (task.blocked_by || []).filter(id => !retired.has(id));
  return out;
}

function attachResearchRequestors(tasks, questions) {
  const defaultRequestor = tasks.find(task => task.metadata?.skill === "design-tech")
    || tasks.find(task => task.metadata?.skill === "explore-solutions")
    || tasks.find(task => task.metadata?.skill === "plan-changeset");
  const touched = new Set();
  for (const task of tasks) {
    if (task.metadata?.research_waits_for_decisions) {
      task.metadata.research_waits_for_decisions = [];
      touched.add(task);
    }
  }
  for (const task of tasks) {
    if (task.metadata?.skill !== "research") continue;
    const question = questions.find(item => item.id === task.metadata.requesting_decision_id);
    const requestedId = question?.requesting_task_id ?? task.metadata.requesting_task_id;
    const requestor = requestedId != null ? tasks.find(item => item.id === requestedId)
      : question?.requesting_skill ? tasks.find(item => item.metadata?.skill === question.requesting_skill) : defaultRequestor;
    if (!requestor || requestor === task) throw new Error("research has no valid requesting task");
    task.metadata.requesting_task_id = requestor.id;
    if (task.status === "completed" && !researchInputMatches(question, task) && researchDecision(question) === EXTERNAL_RESEARCH_REQUIRED) {
      const archived = structuredClone(task);
      delete archived.metadata.research_history;
      task.metadata.research_history = [...(task.metadata.research_history || []), archived];
      for (const key of ["skill_receipt", "phase_receipts", "completed_at", "started_at", "process_tasks"]) delete task[key];
      for (const key of ["observed_evidence", "observed_confidence", "fulfilled_scope"]) delete task.metadata[key];
      task.metadata.research_trigger_question = structuredClone(question);
      task.status = "pending";
    }
    if (!task.metadata.research_trigger_question && researchDecision(question) === EXTERNAL_RESEARCH_REQUIRED) {
      task.metadata.research_trigger_question = structuredClone(question);
    }
    const decision = researchDecision(reevaluateQuestion(question, task));
    touched.add(requestor);
    requestor.metadata.research_waits_for_decisions ||= [];
    if (decision !== RESOLVED) {
      if (!Object.hasOwn(requestor.metadata, "research_previous_status")) requestor.metadata.research_previous_status = requestor.status;
      requestor.metadata.research_waits_for_decisions.push(question?.id || task.metadata.requesting_decision_id);
      requestor.metadata.research_next_action = decision;
      if (!requestor.blocked_by.includes(task.id)) requestor.blocked_by.push(task.id);
      requestor.status = "blocked";
    } else if (task.status === "completed") {
      requestor.blocked_by = requestor.blocked_by.filter(id => id !== task.id);
    }
  }
  for (const task of touched) {
    if (task.metadata.research_waits_for_decisions.length) continue;
    const prior = task.metadata.research_previous_status;
    if (prior && task.status === "blocked" && !task.metadata.solution_confidence_waits_for_approval && !task.metadata.solution_confidence_intake_stop) {
      task.status = prior === "completed" ? "pending" : prior;
    }
    delete task.metadata.research_waits_for_decisions;
    delete task.metadata.research_previous_status;
    delete task.metadata.research_next_action;
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
  const plannedFiles = unique(list(input.planned_files || input.files_planned || input.files));
  const platformContracts = unique(list(input.platform_contracts));
  const solutionConfidence = normalizeSolutionConfidence(input, wi, riskFlags);
  const compression = normalizeCompression(input);
  const existingGraph = input.existing_graph && typeof input.existing_graph === "object" ? input.existing_graph : null;
  if (existingGraph && (existingGraph.wi !== wi || existingGraph.lane !== lane)) throw new Error("existing graph has a different WI/lane identity");
  const questions = collectResearchQuestions(input);
  const existingTasks = Array.isArray(existingGraph?.tasks) ? existingGraph.tasks : [];
  const researchInsertions = [];
  if (solutionConfidence.mode !== "intake_only") {
    for (const question of questions) {
      const working = reevaluateQuestion(question, matchingResearchTask(existingTasks, question.id));
      if (researchDecision(working) !== EXTERNAL_RESEARCH_REQUIRED) continue;
      if (typeof question.id !== "string" || question.id.trim() === "") continue;
      researchInsertions.push({
        requesting_decision_id: question.id,
        question_id: question.id,
        before: question.requesting_skill || existingTasks.find(task => task.id === question.requesting_task_id)?.metadata?.skill || "design-tech",
        reason: "researchDecision returned external_research_required for " + question.id,
      });
    }
  }
  const conditionals = conditionalInsertions({ changeType, riskFlags, platformContracts, solutionConfidence, researchInsertions });
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
    planned_files: plannedFiles,
    platform_contracts: platformContracts,
    solution_confidence: solutionConfidence,
    research: { questions },
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
      ...(existingGraph?.delivery_graph?.mutation_history || []),
      {
        ts: new Date().toISOString(),
        source: "route-workflow",
        action: existingGraph ? "resume_compile" : "initial_compile",
        reason: "Compiled delivery graph at lane entry before downstream mutation.",
      },
    ],
    closeout_classification_required: true,
  };

  const tasks = attachResearchRequestors(applyExistingGraph(taskList(requiredSteps, solutionConfidence), existingGraph), questions);
  const superseded = [...(existingGraph?.delivery_graph?.research?.superseded_tasks || []),
    ...existingTasks.filter(task => !tasks.some(current => current.id === task.id)).map(task => ({
      task: structuredClone(task), disposition: "research no longer required; no completion receipt issued",
    }))];
  deliveryGraph.research.superseded_tasks = [...new Map(superseded.map(row => [JSON.stringify(row), row])).values()];
  return {
    wi,
    lane,
    created: existingGraph?.created || new Date().toISOString(),
    status: existingGraph?.status === "completed" && tasks.some(task => task.status !== "completed") ? "in_progress" : existingGraph?.status || "pending",
    delivery_graph: deliveryGraph,
    tasks,
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
