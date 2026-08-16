#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { updateJsonAtomic } from "./state-io.mjs";

const TECHNICAL_RISK_FLAGS = new Set([
  "backend-function",
  "external-integration",
  "auth-sensitive",
  "data-model-change",
  "concurrency",
  "high-blast-radius",
]);

function usage() {
  console.error("Usage: node scripts/classify-delivery-graph-closeout.mjs <lane-tasks.json> [--write]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { file: null, write: false };
  for (const arg of argv) {
    if (arg === "--write") args.write = true;
    else if (!args.file) args.file = arg;
    else usage();
  }
  if (!args.file) usage();
  return args;
}

function taskSkill(task) {
  return task?.metadata?.skill || task?.skill || null;
}

function skipsSkill(graph, skill) {
  return (graph.delivery_graph?.skipped_skills || []).some((entry) => entry.skill === skill);
}

function allEvidenceClosed(evidence) {
  return Object.entries(evidence || {}).every(([, status]) => status === "satisfied" || status === "n/a");
}

function openEvidence(evidence) {
  return Object.entries(evidence || {})
    .filter(([, status]) => status === "required")
    .map(([family]) => family);
}

function isUserOrAdminFacingFeature(graph) {
  const dg = graph.delivery_graph || {};
  const flags = dg.risk_flags || [];
  return dg.change_type === "feature" && (flags.includes("user-facing") || flags.includes("admin-facing"));
}

function allRequiredTasksClosed(graph) {
  const tasks = graph.tasks || [];
  const bySkill = new Map(tasks.map((task) => [taskSkill(task), task]));
  const processClosed = (skill) => tasks.some((task) => task.status === "completed" &&
    (task.metadata?.required_process_steps || []).some((step) => step?.skill === skill) &&
    (task.process_receipts || []).some((receipt) => receipt?.skill === skill));
  for (const skill of graph.delivery_graph?.required_skills || []) {
    const task = bySkill.get(skill);
    if (task && task.status === "completed") continue;
    if (processClosed(skill)) continue;
    if (skipsSkill(graph, skill)) continue;
    return false;
  }
  for (const entry of graph.delivery_graph?.conditional_mandatory_skills || []) {
    const skill = entry.skill;
    const task = bySkill.get(skill);
    if (task && task.status === "completed") continue;
    if (processClosed(skill)) continue;
    if (skipsSkill(graph, skill)) continue;
    return false;
  }
  return true;
}

function hasTechnicalRisk(graph) {
  return (graph.delivery_graph?.risk_flags || []).some((flag) => TECHNICAL_RISK_FLAGS.has(flag));
}

function correctiveRequirements(graph) {
  const corrective = graph.delivery_graph?.corrective_evidence || {};
  const required = [
    "route_workflow_phase_receipts",
    "route_decision_log",
    "upstream_skip_ledger",
    "post_merge_verification",
  ];
  if (hasTechnicalRisk(graph)) required.push("audit_implementation_mode_selection");
  return required.filter((key) => corrective[key] !== true);
}

function isCorrective(graph) {
  const flags = graph.delivery_graph?.risk_flags || [];
  return flags.includes("retroactive") || flags.includes("graph-mismatch") || flags.includes("user-challenged-closeout");
}

export function classifyDeliveryGraphCloseout(graph) {
  if (!graph.delivery_graph) {
    return { classification: "runtime-accepted", reasons: ["missing delivery_graph"] };
  }
  const tier = graph.delivery_graph.delivery_tier?.mode || "undeclared";
  const withTier = (result) => ({
    ...result,
    delivery_tier: tier,
  });
  if (graph.status === "blocked") {
    return withTier({ classification: "blocked", reasons: [`delivery_tier=${tier}`, "graph status is blocked"] });
  }
  if (graph.status === "deployed-unverified") {
    return withTier({
      classification: "runtime-accepted",
      reasons: [`delivery_tier=${tier}`, "graph status is deployed-unverified; verify-promotion evidence is still required"],
    });
  }

  const evidenceOpen = openEvidence(graph.delivery_graph.evidence_families);
  if (isUserOrAdminFacingFeature(graph) &&
      graph.delivery_graph.evidence_families?.feature_validation_closeout !== "satisfied" &&
      graph.delivery_graph.evidence_families?.feature_validation_closeout !== "n/a" &&
      !evidenceOpen.includes("feature_validation_closeout")) {
    evidenceOpen.push("feature_validation_closeout");
  }
  const requiredTasksClosed = allRequiredTasksClosed(graph);
  const evidenceClosed = allEvidenceClosed(graph.delivery_graph.evidence_families);
  const reasons = [];
  if (evidenceOpen.length > 0) reasons.push(`open evidence families: ${evidenceOpen.join(", ")}`);
  if (!requiredTasksClosed) reasons.push("required or conditional mandatory tasks are not completed or skipped");

  if (isCorrective(graph)) {
    const missingCorrective = correctiveRequirements(graph);
    if (missingCorrective.length > 0) {
      return withTier({
        classification: "runtime-accepted",
        reasons: [`delivery_tier=${tier}`, ...reasons, `missing corrective evidence: ${missingCorrective.join(", ")}`],
      });
    }
    if (evidenceClosed && requiredTasksClosed) {
      return withTier({ classification: "corrective-closure-complete", reasons: [`delivery_tier=${tier}`, "corrective evidence and graph obligations are complete"] });
    }
    return withTier({ classification: "runtime-accepted", reasons: [`delivery_tier=${tier}`, ...reasons] });
  }

  if (evidenceClosed && requiredTasksClosed) {
    return withTier({ classification: "framework-complete", reasons: [`delivery_tier=${tier}`, "all evidence families and required tasks are closed"] });
  }
  return withTier({ classification: "runtime-accepted", reasons: [`delivery_tier=${tier}`, ...reasons] });
}

// WI-395 closeout-green gate (CLI --write path only — the exported pure function
// stays hermetic, and non-binding previews are never gated). A WI cannot RECORD a
// *complete* closeout while tier-1 is red. The canary scripts/validate-main-green.sh
// writes the verdict, bound to BOTH HEAD and a working-tree fingerprint so a
// post-canary edit cannot ride a stale green (codex G6: HIGH-4, MED-1, MED-3).
function mainGreenGate() {
  let root = "";
  try { root = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim(); } catch { /* ignore */ }
  if (!root) return { ok: false, reason: "WI-395 closeout gate: cannot resolve repo root" };
  let head = "";
  try { head = execSync("git rev-parse HEAD", { cwd: root, encoding: "utf8" }).trim(); } catch { /* ignore */ }
  if (!head) return { ok: false, reason: "WI-395 closeout gate: cannot resolve HEAD" };
  let status;
  try {
    const statusPath = process.env.MAIN_GREEN_STATUS_FILE || `${root}/.svc/main-green-status.json`;
    status = JSON.parse(readFileSync(statusPath, "utf8"));
  } catch {
    return { ok: false, reason: "WI-395 closeout gate: no main-green verdict — run scripts/validate-main-green.sh before recording closeout" };
  }
  if (status.head_sha !== head) {
    return { ok: false, reason: `WI-395 closeout gate: verdict is for ${String(status.head_sha).slice(0, 8)}, HEAD is ${head.slice(0, 8)} — re-run scripts/validate-main-green.sh` };
  }
  let dirty = "";
  try { dirty = execSync("git diff HEAD | sha256sum | cut -d' ' -f1", { cwd: root, encoding: "utf8", shell: "/bin/bash" }).trim(); } catch { /* ignore */ }
  if (dirty && status.dirty_sha && status.dirty_sha !== dirty) {
    return { ok: false, reason: "WI-395 closeout gate: tracked files changed since the green verdict — re-run scripts/validate-main-green.sh" };
  }
  if (status.status !== "green" && status.status !== "green-known-debt") {
    return { ok: false, reason: `WI-395 closeout gate: tier-1 is '${status.status}' (failing: ${(status.failing || []).join(", ")}) — cannot record complete while main is red` };
  }
  return { ok: true };
}

const args = parseArgs(process.argv.slice(2));
const filePath = resolve(args.file);
const graph = JSON.parse(readFileSync(filePath, "utf8"));
const result = classifyDeliveryGraphCloseout(graph);
// Gate only the binding (--write) closeout that RECORDS the verdict; previews stay ungated.
if (args.write && (result.classification === "framework-complete" || result.classification === "corrective-closure-complete")) {
  const gate = mainGreenGate();
  if (!gate.ok) {
    result.reasons = [...(result.reasons || []), gate.reason];
    result.classification = "runtime-accepted";
    result.main_green_gate = "blocked";
  }
}

if (args.write) {
  await updateJsonAtomic(filePath, (current) => {
    if (!current.delivery_graph) current.delivery_graph = {};
    current.delivery_graph.closeout_classification = result.classification;
    current.delivery_graph.closeout_classification_reasons = result.reasons;
    current.delivery_graph.closeout_delivery_tier = result.delivery_tier;
    current.delivery_graph.mutation_history = current.delivery_graph.mutation_history || [];
    current.delivery_graph.mutation_history.push({
      ts: new Date().toISOString(),
      source: "classify-delivery-graph-closeout",
      action: `close_as_${result.classification.replaceAll("-", "_")}`,
      reason: result.reasons.join("; ") || "classification computed",
      affected_tasks: [],
      affected_evidence_families: [],
      validator_proof: "scripts/classify-delivery-graph-closeout.mjs --write",
    });
    return current;
  });
}

console.log(JSON.stringify(result, null, 2));
