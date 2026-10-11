#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { rebuildReopenedEdges } from "./lib/reopened-edges.mjs";
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
import { realpathSync as __svcRealpath } from "node:fs";
import { fileURLToPath as __svcToPath } from "node:url";
// Real paths on both sides, so the entry runs through install symlinks; built-ins only,
// so a copied subset of files still loads.
const __svcIsMain = (url) => { try { return Boolean(process.argv[1]) && __svcRealpath(process.argv[1]) === __svcRealpath(__svcToPath(url)); } catch { return false; } };

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

// Lanes, conditions and the prototype keep-list live in data. The lane arrays
// are the lists this compiler ran before the switch, so a non-docs graph is unchanged.
const DELIVERY_CHAIN = JSON.parse(readFileSync(new URL("../references/delivery-lanes.json", import.meta.url), "utf8"));
const LANE_BASE_SKILLS = DELIVERY_CHAIN.lanes;
const INVARIANT_TAIL = new Set(DELIVERY_CHAIN.invariant_tail);
const DOC_PATHS = (DELIVERY_CHAIN.doc_paths || []).map((pattern) => new RegExp(pattern, "i"));
const EXECUTABLE_PATHS = (DELIVERY_CHAIN.executable_paths || []).map((pattern) => new RegExp(pattern, "i"));

// Bounded planning (docs/decisions/2026-10-10-bounded-delivery.md). For a prototype or
// MVP profile the upstream design skills fold into a one-page brief: analyze-domain names
// the expert terms and the first question, plan-changeset writes the brief, and
// execute-changeset runs the probe loop. The mandatory delivery chain and its receipts
// are unchanged; only the depth of each stage changes. Full review depth returns
// whenever the change touches an irreversible zone.
const BOUNDED_UPSTREAM = DELIVERY_CHAIN.bounded_upstream;
const IRREVERSIBLE_PATH = /(^|\/)(auth|login|session|payments?|billing|checkout|stripe|wallet|ledger|migrations?|secrets?|deploy|infra|terraform)(\/|\.|-|_|$)|(^|\/)(\.env[^/]*|wrangler\.toml|Dockerfile)$/i;
const IRREVERSIBLE_FLAGS = new Set(["auth", "payments", "money", "data-migration", "data-deletion", "deploy-affecting", "secrets", "security-sensitive"]);

export function irreversibleZones(plannedFiles = [], riskFlags = []) {
  return unique([
    ...plannedFiles.filter((f) => IRREVERSIBLE_PATH.test(String(f))),
    ...riskFlags.filter((f) => IRREVERSIBLE_FLAGS.has(f)).map((f) => `flag:${f}`),
  ]);
}

// Documentation is prose only. A docs/ prefix does not make a file prose.
// Extensionless secrets (.env) and executable or UI files (.html, .vue, .js)
// stay on the code path, including when they live under docs/, so a security
// path or flag cannot be hidden by a documentation claim.
function isExecutablePath(file) {
  return EXECUTABLE_PATHS.some((pattern) => pattern.test(String(file)));
}

function isDocPath(file) {
  const value = String(file);
  // Prose wins over a secret-shaped basename (id_rsa.md is still a document).
  if (/\.(md|mdx|txt|rst|adoc)$/i.test(value)) return true;
  if (isExecutablePath(value)) return false;
  return DOC_PATHS.some((pattern) => pattern.test(value));
}

function isDocsOnly(changeType, riskFlags) {
  return changeType === "docs" || riskFlags.includes("docs-only");
}

// A documentation claim is valid only when the planned files agree. Security-sensitive
// code, or any non-doc file paired with a security flag, used to require review-security
// (auth-sensitive). Suppressing that is a contradictory declaration, not a docs change.
function contradictoryDocsClassification({ changeType, riskFlags, plannedFiles }) {
  if (!isDocsOnly(changeType, riskFlags)) return null;
  const codeFiles = plannedFiles.filter((file) => !isDocPath(file));
  const security = DELIVERY_CHAIN.conditions?.security || {};
  const patterns = Object.values(security.zone_classes || {}).flat();
  const securityFiles = codeFiles.filter((file) => matchesAny(file, patterns));
  const securityFlag = (security.flags || []).some((flag) => riskFlags.includes(flag));
  if (securityFiles.length) {
    return `contradictory documentation classification: planned files include security-sensitive code: ${securityFiles.join(", ")}`;
  }
  if (securityFlag && codeFiles.length) {
    return `contradictory documentation classification: a security flag is set alongside non-doc planned files: ${codeFiles.join(", ")}`;
  }
  return null;
}

function matchesAny(file, patterns = []) {
  return patterns.some((pattern) => new RegExp(pattern, "i").test(String(file)));
}

// Conditions are decided before any stage is kept. Code and config only:
// a docs path never activates ui, security, or the other code conditions.
export function evaluateDeliveryConditions({ changeType, riskFlags = [], plannedFiles = [] }) {
  const contradiction = contradictoryDocsClassification({ changeType, riskFlags, plannedFiles });
  if (contradiction) throw new Error(contradiction);
  const docsOnly = isDocsOnly(changeType, riskFlags);
  const codeFiles = plannedFiles.filter((file) => !isDocPath(file));
  const fileHit = (patterns) => codeFiles.some((file) => matchesAny(file, patterns));
  const out = {};
  for (const [name, def] of Object.entries(DELIVERY_CHAIN.conditions || {})) {
    if (def.match === "code-and-config-only" && docsOnly) {
      out[name] = false;
      continue;
    }
    if (name === "security") {
      const flagHit = (def.flags || []).some((flag) => riskFlags.includes(flag));
      const classHit = Object.values(def.zone_classes || {}).some((patterns) => fileHit(patterns));
      const zoneHit = irreversibleZones(plannedFiles, riskFlags).some((zone) => {
        if (String(zone).startsWith("flag:") || isDocPath(zone)) return false;
        return Object.values(def.zone_classes || {}).some((patterns) => matchesAny(zone, patterns));
      });
      out[name] = flagHit || classHit || zoneHit;
      continue;
    }
    out[name] = fileHit(def.patterns || []);
  }
  out.docs_only = docsOnly;
  return out;
}

function profileKeeps(profile, stageKey) {
  if (!profile || profile === "mvp" || profile === "production") return true;
  const keeps = DELIVERY_CHAIN.profile_keeps?.[profile];
  if (!Array.isArray(keeps)) return true;
  return keeps.includes(stageKey);
}

function applyStageConditions(skills, conditions) {
  return skills.filter((skill) => {
    const condition = DELIVERY_CHAIN.stages?.[skill]?.activation_condition;
    if (!condition) return true;
    return conditions[condition] === true;
  });
}

export function planningMode(input, lane) {
  const profile = String(input.delivery_profile || "").trim();
  if (profile && !["prototype", "mvp", "production"].includes(profile)) throw new Error(`Unsupported delivery profile: ${profile}`);
  const bounded = ["prototype", "mvp"].includes(profile) && lane !== "framework";
  return { mode: bounded ? "bounded" : "contract", profile: profile || null };
}

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
    delivery_profile: args["delivery-profile"],
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

function conditionalInsertions({ changeType, riskFlags, platformContracts, solutionConfidence, researchInsertions = [], conditions, deliveryProfile }) {
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
  if (conditions?.security && profileKeeps(deliveryProfile, "security")) {
    add("review-security", "security", "Security condition matched an auth, payments, secrets, or migration path, or a security flag.");
  }
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

// Stage activation and the docs-only tail apply to inserted skills too. A docs claim
// must not grow track-visuals or design-tech from browser-visible / backend-function.
function conditionalSurvives(item, conditions) {
  const condition = DELIVERY_CHAIN.stages?.[item.skill]?.activation_condition;
  if (condition && conditions[condition] !== true) return false;
  if (conditions.docs_only && !INVARIANT_TAIL.has(item.skill)) return false;
  return true;
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

// Prerequisite stages must come before the authority chain's late stages in every lane and
// profile (T3, review 6108295955). The chain is one contiguous transition, so a prerequisite
// either sits upstream of plan-changeset or, when it needs the implementation, becomes a
// required, evidence-backed process step of execute-changeset that runs before review-gate
// (the same shape as the visual diff). Which skills are compiled is not changed here.
const UPSTREAM_PREREQUISITES = { "build-personas": ["write-spec"], "write-journeys": ["design-ux"], "design-tech": [] };
const EXECUTION_PREREQUISITES = ["write-e2e", "test-journeys"];

function orderPrerequisites(steps) {
  const at = (skill) => steps.findIndex((step) => step.skill === skill);
  // Research a stage asked for runs before that stage, so it moves with it.
  const takeResearch = (skills) => {
    const taken = [];
    for (let i = steps.length - 1; i >= 0; i -= 1) {
      if (steps[i].skill === "research" && skills.includes(steps[i].before)) taken.unshift(...steps.splice(i, 1));
    }
    return taken;
  };
  for (const [skill, anchors] of Object.entries(UPSTREAM_PREREQUISITES)) {
    const plan = at("plan-changeset");
    const from = at(skill);
    if (plan === -1 || from === -1 || from < plan) continue;
    const [entry] = steps.splice(from, 1);
    const research = takeResearch([skill]);
    const anchor = anchors.map(at).find((i) => i !== -1 && i < plan);
    steps.splice(anchor ?? at("plan-changeset"), 0, ...research, entry);
  }
  const execute = steps.find((step) => step.skill === "execute-changeset");
  if (!execute) return steps;
  if (execute.required_process_steps) {
    const seen = new Set();
    execute.required_process_steps = execute.required_process_steps.filter((step) => {
      if (step.skill === "track-visuals") return true;
      if (seen.has(step.skill)) return false;
      seen.add(step.skill);
      return true;
    });
  }
  // Research asked for by a folded stage is now asked for by execute-changeset. The chain
  // must stay contiguous, so it runs upstream of plan-changeset.
  const folded = takeResearch(EXECUTION_PREREQUISITES);
  if (folded.length) steps.splice(at("plan-changeset"), 0, ...folded);
  for (const skill of EXECUTION_PREREQUISITES) {
    const k = at(skill);
    if (k === -1) continue;
    const [entry] = steps.splice(k, 1);
    const present = (execute.required_process_steps || []).some((step) => step.skill === skill);
    if (!present) execute.required_process_steps = [...(execute.required_process_steps || []), { skill, before: "review-gate", evidence_required: true, signal: entry.signal }];
  }
  return steps;
}

// Same derivation task-graph applies (and its validator requires): the graph status follows
// the tasks, so it is recomputed after every reopen, reset and block.
function deriveStatus(tasks) {
  if (tasks.length === 0) return "pending";
  if (tasks.every((task) => task.status === "completed")) return "completed";
  if (tasks.some((task) => task.status === "in_progress")) return "in_progress";
  if (tasks.some((task) => task.status === "pending")) return "pending";
  if (tasks.some((task) => task.status === "blocked")) return "blocked";
  if (tasks.every((task) => task.status === "skipped")) return "skipped";
  return "completed";
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

function applyExistingGraph(tasks, existingGraph, notes = { reopened: [], migrated: [], required: new Map() }) {
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
  const migratedIds = (existingGraph?.delivery_graph?.migrated_prerequisites || []).map((row) => row?.task?.id).filter(Number.isInteger);
  // Archived rows are not live tasks. Their ids stay reserved so a later
  // feature↔docs recompile cannot reuse one and then drop the newer evidence
  // in the archived-id dedupe.
  const archivedIds = (existingGraph?.delivery_graph?.archived_compiler_tasks || [])
    .map((row) => row?.task?.id)
    .filter((id) => Number.isInteger(id) && id >= 1);
  let nextId = Math.max(0, ...reserved, ...migratedIds, ...archivedIds) + 1;
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
    // Process obligations are whatever this compilation requires. A dropped
    // journey or visual step must not survive from the previous graph.
    if (!task.metadata?.required_process_steps) delete clone.metadata.required_process_steps;
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
  // Edges are rebuilt when a task moved earlier: an inherited edge to a task that now
  // comes later would make a cycle (a persona task that used to trail verify-promotion
  // and now precedes write-spec).
  const position = new Map(pairs.map(({ clone }, index) => [clone.id, index]));
  const out = pairs.map(({ task, prev, clone }, index) => {
    const required = (task.blocked_by || []).map(id => remap.get(id));
    notes.required?.set(clone.id, required);
    const inherited = [...(prev?.blocked_by || [])];
    const stale = inherited.filter(id => position.has(id) && position.get(id) >= index);
    if (stale.length) clone.blocked_by = [...new Set([...inherited.filter(id => !stale.includes(id)), ...required])];
    else clone.blocked_by = prev?.status === "completed" ? inherited : [...new Set([...inherited, ...required])];
    return clone;
  });
  reopenBehindMovedPrerequisites(out, pairs, position, notes);
  const deactivated = new Set();
  const retained = [];
  const unmatchedResearch = [];
  for (const prev of existing) {
    if (matched.has(prev.id)) continue;
    // Retain completed evidence and unrelated work. Research whose requester
    // disappeared is archived below for every status, including pending.
    const skill = prev.metadata?.skill || prev.skill;
    if (skill === "research") {
      unmatchedResearch.push(prev);
      continue;
    }
    // E2E and journey tasks from an older graph are now process steps of
    // execute-changeset. Their runnable tasks go; what they recorded is kept as history
    // only, because a task-level status is not a digest-bound process receipt.
    if (EXECUTION_PREREQUISITES.includes(skill)) {
      notes.migrated.push({ task: structuredClone(prev), disposition: "folded into an execute-changeset process step; historical evidence only, not executable" });
      continue;
    }
    // Lane and conditional tasks the compiler no longer emits are archived.
    // Completed research stays only while its requester is still a live task.
    if (skill !== "research" && /: delivery graph required step$/.test(String(prev.subject || ""))) {
      deactivated.add(prev.id);
      notes.archived ||= [];
      notes.archived.push({ task: structuredClone(prev), disposition: "compiler task deactivated; archived, not executable" });
      continue;
    }
    retained.push(prev);
  }
  for (const prev of retained) out.push(structuredClone(prev));
  // Archive or keep research only after deactivation is known. A pending
  // feature→docs task used to be dropped while its question stayed live, which
  // left an invalid graph. Status and whether this compile still emits the
  // research task do not matter: a missing requester archives the task.
  const liveIds = new Set(out.map((task) => task.id));
  for (const prev of unmatchedResearch) {
    const requesterId = prev.metadata?.requesting_task_id;
    if (requesterId != null && !liveIds.has(requesterId)) {
      notes.archived ||= [];
      notes.archived.push({ task: structuredClone(prev), disposition: "research requester deactivated; archived, not executable" });
      continue;
    }
    if (prev.status === "completed") out.push(structuredClone(prev));
  }
  const ids = new Set(out.map(task => task.id));
  const retired = new Set(existing.filter(task => !ids.has(task.id)).map(task => task.id));
  for (const task of out) task.blocked_by = (task.blocked_by || []).filter(id => !retired.has(id));
  // Dropped compiler tasks take their edges with them. Surviving pending tasks wait
  // on the obligations this compilation computed, plus research and unrelated work.
  if (notes.archived?.length) {
    const archivedIds = new Set(notes.archived.map((row) => row.task.id));
    for (const { clone } of pairs) {
      if (!ids.has(clone.id) || clone.status === "completed") continue;
      const required = (notes.required.get(clone.id) || []).filter((id) => ids.has(id) && id !== clone.id);
      const extra = (clone.blocked_by || []).filter((id) => {
        if (!ids.has(id) || archivedIds.has(id) || required.includes(id)) return false;
        const target = out.find((task) => task.id === id);
        if (!target) return false;
        if ((target.metadata?.skill || target.skill) === "research") return true;
        return !/: delivery graph required step$/.test(String(target.subject || ""));
      });
      clone.blocked_by = [...new Set([...required, ...extra])];
    }
  }
  reopenForNewProcessSteps(out, pairs, notes);
  return out;
}

// An unfinished prerequisite that is new, or moved ahead of planning, now precedes stages that
// may already be started or done. Those stages did not run behind it: they depend on it again
// and go back to pending, so the scheduler cannot select land-changeset ahead of it.
function reopenBehindMovedPrerequisites(out, pairs, position, notes) {
  const first = pairs.findIndex(({ task, prev, clone }) =>
    Object.hasOwn(UPSTREAM_PREREQUISITES, task.metadata?.skill) && clone.status !== "completed" &&
    (!prev || (prev.blocked_by || []).some((id) => position.has(id) && position.get(id) >= position.get(clone.id))));
  if (first === -1) return;
  const why = `unfinished prerequisite ${pairs[first].task.metadata.skill} now precedes this stage`;
  pairs.forEach(({ task, clone }, index) => {
    if (index <= first || !["completed", "in_progress"].includes(clone.status)) return;
    const previous = clone.status;
    clone.status = "pending";
    clone.metadata ||= {};
    clone.metadata.reopened = { reason: why, previous, at: new Date().toISOString() };
    const required = (task.blocked_by || []).map((id) => pairs.find((row) => row.task.id === id)?.clone.id).filter((id) => id != null);
    clone.blocked_by = [...new Set([...(clone.blocked_by || []), ...required])];
    notes.reopened.push({ id: clone.id, skill: clone.metadata.skill, reason: why });
  });
}

// A process receipt counts only when it names a digest-bound evidence file that still
// exists with the recorded contents (the same test task-graph applies on completion).
function receiptHolds(row) {
  const evidence = row?.evidence;
  if (!evidence || typeof evidence.path !== "string" || !/^[0-9a-f]{64}$/.test(String(evidence.sha256 || ""))) return false;
  try {
    const file = resolve(evidence.path);
    return createHash("sha256").update(readFileSync(file)).digest("hex") === evidence.sha256;
  } catch { return false; }
}

// Any completed task that gains a required process step has not done that step.
// Reopen it and every started or completed dependent until a digest-bound process
// receipt exists. review-security lands on audit-implementation, so a payment file
// added to a finished graph reopens audit, land and promotion, not only execute.
// In-progress dependents go back to pending so none is active but blocked.
function unmetProcessSteps(pair) {
  if (!pair?.prev || pair.prev.status !== "completed") return [];
  const had = pair.prev.metadata?.required_process_steps || [];
  return (pair.clone.metadata?.required_process_steps || []).filter((step) =>
    !had.some((old) => old.skill === step.skill && String(old.mode || "") === String(step.mode || "")) &&
    !(pair.clone.process_receipts || []).some((row) => row?.skill === step.skill && String(row?.mode || "") === String(step.mode || "") && receiptHolds(row)));
}

function reopenForNewProcessSteps(out, pairs, notes) {
  const origins = [];
  for (const pair of pairs) {
    const missing = unmetProcessSteps(pair);
    if (!missing.length) continue;
    origins.push({
      id: pair.clone.id,
      why: `required process evidence missing: ${missing.map((step) => step.skill + (step.mode ? "/" + step.mode : "")).join(", ")}`,
    });
  }
  if (!origins.length) return;
  const whyFor = new Map(origins.map((row) => [row.id, row.why]));
  const downstream = new Set(whyFor.keys());
  for (let grew = true; grew;) {
    grew = false;
    for (const task of out) {
      if (downstream.has(task.id)) continue;
      if ((task.blocked_by || []).some((id) => downstream.has(id))) { downstream.add(task.id); grew = true; }
    }
  }
  for (const task of out) {
    if (!downstream.has(task.id) || !["completed", "in_progress"].includes(task.status)) continue;
    const previous = task.status;
    task.status = "pending";
    task.metadata ||= {};
    const why = whyFor.get(task.id) || (task.blocked_by || []).map((id) => whyFor.get(id)).find(Boolean) || origins[0].why;
    task.metadata.reopened = { reason: why, previous, at: new Date().toISOString() };
    notes.reopened.push({ id: task.id, skill: task.metadata.skill, reason: why });
  }
}

function assertAcyclic(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const state = new Map();
  const visit = (id, trail) => {
    if (state.get(id) === 2 || !byId.has(id)) return;
    if (state.get(id) === 1) throw new Error(`compiled graph has a dependency cycle: ${[...trail, id].join(" -> ")}`);
    state.set(id, 1);
    for (const dep of byId.get(id).blocked_by || []) visit(dep, [...trail, id]);
    state.set(id, 2);
  };
  for (const task of tasks) visit(task.id, []);
}

function attachResearchRequestors(tasks, questions, remap = {}) {
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
    // A stage folded into execute-changeset (e2e, journey proof) no longer has its own task;
    // research it asked for is requested by execute-changeset. The remapping is stored in
    // the graph, so a later resume resolves the same old id the same way.
    // A requester that left the graph (design-ui dropped on a backend recompile, any
    // status, matched or not) remaps onto a live stage instead of failing the compile.
    const remappedSkill = requestedId != null ? remap[String(requestedId)] : undefined;
    const named = (skill) => tasks.find(item => item !== task && item.metadata?.skill === skill);
    let requestor = remappedSkill ? named(remappedSkill)
      : requestedId != null ? tasks.find(item => item.id === requestedId)
      : question?.requesting_skill ? named(question.requesting_skill) : defaultRequestor;
    if (requestor === task) requestor = undefined;
    if (!requestor && question?.requesting_skill) requestor = named(question.requesting_skill);
    if (!requestor && EXECUTION_PREREQUISITES.includes(question?.requesting_skill)) {
      requestor = named("execute-changeset");
    }
    if (!requestor) requestor = defaultRequestor && defaultRequestor !== task ? defaultRequestor : undefined;
    if (!requestor || requestor === task) throw new Error("research has no valid requesting task");
    // Rebind the task only. The question record stays byte-stable so a completed
    // research snapshot still matches; the live requesting_task_id is the binding.
    // Research runs before its requester. A remap onto a stage that used to precede
    // this task must drop that back-edge or the two tasks block each other.
    task.metadata.requesting_task_id = requestor.id;
    task.blocked_by = (task.blocked_by || []).filter((id) => id !== requestor.id);
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

// In bounded mode each stage records how deep it goes; validate-delivery-graph checks it.
export function boundedDepths(planning) {
  const zones = planning.irreversible_zones.length > 0;
  return {
    "analyze-domain": { teach_terms: 10, first_question: true },
    "plan-changeset": { plan_mode: "brief" },
    "review-plan": { review_depth: zones ? "full" : "single-pass" },
    "execute-changeset": { execution: "probe-loop" },
    "review-exec": { review_depth: zones ? "full" : "single-lens" },
    "audit-implementation": { review_depth: zones ? "full" : "single-lens" },
  };
}

const BOUNDED_KEYS = ["plan_mode", "review_depth", "execution", "teach_terms", "first_question"];
const LIGHT = new Set(["single-pass", "single-lens"]);

// Sets each stage's depth for the current planning mode. A stage that was completed at a
// lighter depth than it now needs (risk rose into an irreversible zone, or the work moved
// from a bounded to a contract plan) is reopened, not relabelled: relabelling would claim
// a full review that never happened. Returns the reopened tasks for mutation_history.
function applyPlanningDepth(tasks, planning) {
  const reopened = [];
  const reopen = (task, why, from) => {
    if (task.status !== "completed") return;
    task.status = "pending";
    task.metadata.reopened = { reason: why, previous: from, at: new Date().toISOString() };
    reopened.push({ id: task.id, skill: task.metadata.skill, reason: why });
  };
  const depths = planning.mode === "bounded" ? boundedDepths(planning) : {};
  for (const task of tasks) {
    const skill = task.metadata?.skill;
    const prior = { review_depth: task.metadata?.review_depth, plan_mode: task.metadata?.plan_mode };
    if (planning.mode === "bounded") {
      const extra = depths[skill];
      if (!extra) continue;
      if (extra.review_depth === "full" && LIGHT.has(prior.review_depth)) reopen(task, "irreversible zone touched: full review required", prior.review_depth);
      task.metadata = { ...task.metadata, ...extra };
    } else {
      if (LIGHT.has(prior.review_depth)) reopen(task, "contract planning requires full review depth", prior.review_depth);
      if (prior.plan_mode === "brief") reopen(task, "contract planning requires the full changeset, not a brief", "brief");
      for (const k of BOUNDED_KEYS) delete task.metadata[k];
    }
  }
  return reopened;
}

export function compileDeliveryGraph(input) {
  const wi = requireString(input.wi, "wi");
  const lane = requireString(input.lane, "lane");
  const changeType = requireString(input.change_type, "change_type");
  if (!LANE_BASE_SKILLS[lane]) throw new Error(`Unsupported lane: ${lane}`);

  const planning = planningMode(input, lane);
  const riskFlags = unique(list(input.risk_flags));
  const plannedFiles = unique(list(input.planned_files || input.files_planned || input.files));
  planning.irreversible_zones = irreversibleZones(plannedFiles, riskFlags);
  const conditions = evaluateDeliveryConditions({ changeType, riskFlags, plannedFiles });
  let upstream = planning.mode === "bounded" && BOUNDED_UPSTREAM[lane] ? BOUNDED_UPSTREAM[lane] : LANE_BASE_SKILLS[lane];
  upstream = applyStageConditions([...upstream], conditions);
  if (conditions.docs_only) upstream = upstream.filter((skill) => INVARIANT_TAIL.has(skill));
  const laneSkills = injectMandatoryDeliveryChain(upstream);
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
  const conditionals = conditionalInsertions({ changeType, riskFlags, platformContracts, solutionConfidence, researchInsertions, conditions, deliveryProfile: planning.profile })
    .filter((item) => conditionalSurvives(item, conditions));
  const requiredSkills = unique([...laneSkills, ...conditionals.map((item) => item.skill)]);
  const requiredSteps = buildTaskSteps(laneSkills, conditionals);
  orderPrerequisites(requiredSteps);
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
    planning,
    activation: conditions,
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

  const notes = { reopened: [], migrated: [], required: new Map(), archived: [] };
  const remap = { ...(existingGraph?.delivery_graph?.research?.requester_remap || {}) };
  const merged = applyExistingGraph(taskList(requiredSteps, solutionConfidence), existingGraph, notes);
  const archivedResearchDecisions = new Set(
    notes.archived
      .filter((row) => (row.task?.metadata?.skill || row.task?.skill) === "research")
      .map((row) => row.task?.metadata?.requesting_decision_id)
      .filter(Boolean),
  );
  for (const row of notes.archived) {
    const decisionId = row.task?.metadata?.requesting_decision_id;
    if ((row.task?.metadata?.skill || row.task?.skill) !== "research" || !decisionId) continue;
    const question = questions.find((item) => item.id === decisionId);
    if (question) row.question = structuredClone(question);
  }
  const liveQuestions = questions.filter((item) => !archivedResearchDecisions.has(item.id));
  deliveryGraph.research.questions = liveQuestions;
  const tasks = attachResearchRequestors(merged, liveQuestions, (() => {
    for (const row of notes.migrated) remap[String(row.task.id)] = "execute-changeset";
    return remap;
  })());
  assertAcyclic(tasks);
  if (Object.keys(remap).length) deliveryGraph.research.requester_remap = remap;
  deliveryGraph.migrated_prerequisites = [...(existingGraph?.delivery_graph?.migrated_prerequisites || []), ...notes.migrated];
  const priorArchived = existingGraph?.delivery_graph?.archived_compiler_tasks || [];
  const seenArchived = new Set(priorArchived.map((row) => row?.task?.id));
  deliveryGraph.archived_compiler_tasks = [
    ...priorArchived,
    ...notes.archived.filter((row) => !seenArchived.has(row.task.id)),
  ];
  if (notes.reopened.length) deliveryGraph.mutation_history.push({ ts: new Date().toISOString(), source: "route-workflow", action: "reopen_for_process_steps", reason: "A prerequisite moved upstream or gained a required process step; execution and downstream stages reopened until it is done and its evidence exists (per-task reasons below).", tasks: notes.reopened });
  const reopened = applyPlanningDepth(tasks, planning);
  if (reopened.length) deliveryGraph.mutation_history.push({ ts: new Date().toISOString(), source: "route-workflow", action: "reopen_for_depth", reason: "Planning depth increased; lighter completed stages reopened.", tasks: reopened });
  // A reopened stage waits for what the CURRENT obligations require, not for the edges the
  // lighter plan left on it. Research requestor edges stay with the research wiring.
  const edgeChanges = rebuildReopenedEdges(tasks, notes.required);
  if (edgeChanges.length) deliveryGraph.mutation_history.push({ ts: new Date().toISOString(), source: "route-workflow", action: "rebuild_reopened_edges", reason: "Reopened stages re-pointed at the edges their current obligations require.", edges: edgeChanges });
  assertAcyclic(tasks);
  const archivedIds = new Set(notes.archived.map((row) => row.task.id));
  const superseded = [...(existingGraph?.delivery_graph?.research?.superseded_tasks || []),
    ...existingTasks.filter(task => !tasks.some(current => current.id === task.id) && !archivedIds.has(task.id)).map(task => ({
      task: structuredClone(task), disposition: "research no longer required; no completion receipt issued",
    }))];
  deliveryGraph.research.superseded_tasks = [...new Map(superseded.map(row => [JSON.stringify(row), row])).values()];
  return {
    wi,
    lane,
    created: existingGraph?.created || new Date().toISOString(),
    status: deriveStatus(tasks),
    delivery_graph: deliveryGraph,
    tasks,
  };
}

if (__svcIsMain(import.meta.url)) {
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
