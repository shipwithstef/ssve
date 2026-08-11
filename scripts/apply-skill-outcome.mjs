#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { updateJsonAtomic } from "./state-io.mjs";

const ACTIONS = new Set([
  "insert_task",
  "mark_n_a",
  "escalate_review",
  "reclassify_lane",
  "return_to_prior_gate",
  "block_until_user_input",
  "block_on_discovery",
  "close_as_runtime_accepted",
  "close_as_corrective_closure_complete",
  "close_as_framework_complete",
]);

function usage() {
  console.error("Usage: node scripts/apply-skill-outcome.mjs --graph <lane-tasks.json> --outcome <skill-outcome.json>");
  process.exit(2);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) usage();
    const key = token.slice(2);
    const value = argv[i + 1];
    if (!value || value.startsWith("--")) usage();
    args[key] = value;
    i += 1;
  }
  if (!args.graph || !args.outcome) usage();
  return args;
}

function list(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function taskSkill(task) {
  return task?.metadata?.skill || task?.skill || null;
}

function nextTaskId(tasks) {
  return tasks.reduce((max, task) => Math.max(max, Number(task.id) || 0), 0) + 1;
}

function ensureDeliveryGraph(graph) {
  if (!graph.delivery_graph || typeof graph.delivery_graph !== "object") {
    throw new Error("graph is missing delivery_graph");
  }
  if (!Array.isArray(graph.delivery_graph.mutation_history)) {
    graph.delivery_graph.mutation_history = [];
  }
}

function normalizeOutcome(raw) {
  const outcome = raw.skill_outcome || raw;
  if (!outcome || typeof outcome !== "object") {
    throw new Error("outcome must be an object or { skill_outcome: object }");
  }
  if (typeof outcome.skill !== "string" || outcome.skill.length === 0) {
    throw new Error("skill_outcome.skill is required");
  }
  if (!["pass", "partial", "blocked", "fail"].includes(outcome.status)) {
    throw new Error("skill_outcome.status must be pass, partial, blocked, or fail");
  }
  if (!Array.isArray(outcome.graph_mutations_requested)) {
    outcome.graph_mutations_requested = [];
  }
  return outcome;
}

function addUnique(target, values) {
  const set = new Set(target);
  for (const value of values) set.add(value);
  return [...set];
}

function ensureTask(graph, skill, reason) {
  graph.tasks = Array.isArray(graph.tasks) ? graph.tasks : [];
  const existing = graph.tasks.find((task) => taskSkill(task) === skill);
  if (existing) return { id: existing.id, inserted: false };

  const id = nextTaskId(graph.tasks);
  const blockers = graph.tasks.length === 0 ? [] : [graph.tasks[graph.tasks.length - 1].id];
  graph.tasks.push({
    id,
    subject: `${skill}: inserted by skill outcome`,
    status: "pending",
    blocked_by: blockers,
    metadata: { skill, inserted_by_skill_outcome: true, insertion_reason: reason },
  });
  graph.delivery_graph.required_skills = addUnique(graph.delivery_graph.required_skills || [], [skill]);
  return { id, inserted: true };
}

function reopenPriorGate(graph, skill, reason) {
  const affected = [];
  let reopen = false;
  for (const task of graph.tasks || []) {
    if (taskSkill(task) === skill) reopen = true;
    if (!reopen) continue;
    task.status = "pending";
    delete task.completed_at;
    delete task.skip_reason;
    affected.push(task.id);
  }
  if (affected.length === 0) {
    affected.push(ensureTask(graph, skill, reason).id);
  }
  graph.status = "in_progress";
  return affected;
}

function applyMutation(graph, outcome, mutation) {
  if (!ACTIONS.has(mutation.action)) {
    throw new Error(`unsupported mutation action: ${mutation.action}`);
  }

  const affectedTasks = [];
  const affectedEvidenceFamilies = list(mutation.evidence_family || mutation.evidence_families);
  const reason = mutation.reason || "skill outcome requested graph mutation";

  if (mutation.action === "insert_task" || mutation.action === "escalate_review") {
    const target = mutation.target || (mutation.action === "escalate_review" ? "review-gate" : null);
    if (!target) throw new Error(`${mutation.action} requires target`);
    affectedTasks.push(ensureTask(graph, target, reason).id);
    if (mutation.signal) {
      graph.delivery_graph.conditional_mandatory_skills = graph.delivery_graph.conditional_mandatory_skills || [];
      graph.delivery_graph.conditional_mandatory_skills.push({
        skill: target,
        signal: mutation.signal,
        reason,
      });
    }
  }

  if (mutation.action === "mark_n_a") {
    const target = mutation.target;
    if (!target) throw new Error("mark_n_a requires target");
    if (graph.delivery_graph.evidence_families?.[target] !== undefined) {
      graph.delivery_graph.evidence_families[target] = "n/a";
      affectedEvidenceFamilies.push(target);
    } else {
      graph.delivery_graph.skipped_skills = graph.delivery_graph.skipped_skills || [];
      graph.delivery_graph.skipped_skills.push({
        skill: target,
        skip_condition_id: mutation.skip_condition_id,
        reason,
        evidence: mutation.validator_proof || "skill_outcome mark_n_a",
      });
    }
  }

  if (mutation.action === "reclassify_lane") {
    if (!mutation.target) throw new Error("reclassify_lane requires target lane");
    graph.lane = mutation.target;
    graph.delivery_graph.lane = mutation.target;
  }

  if (mutation.action === "return_to_prior_gate") {
    if (!mutation.target) throw new Error("return_to_prior_gate requires target");
    affectedTasks.push(...reopenPriorGate(graph, mutation.target, reason));
  }

  if (mutation.action === "block_until_user_input") {
    graph.status = "blocked";
    graph.delivery_graph.blocked_until_user_input = {
      source_skill: outcome.skill,
      reason,
      question: mutation.question || null,
    };
  }

  if (mutation.action === "block_on_discovery") {
    const target = mutation.target || mutation.recommended_skill || "diagnose-bug";
    if (!mutation.artifact && !mutation.blocking_discovery_artifact) {
      throw new Error("block_on_discovery requires artifact");
    }

    graph.status = "blocked";
    affectedTasks.push(ensureTask(graph, target, reason).id);
    graph.delivery_graph.risk_flags = addUnique(graph.delivery_graph.risk_flags || [], [
      mutation.signal || "BLOCKING_DISCOVERY",
    ]);
    graph.delivery_graph.closeout_blockers = addUnique(graph.delivery_graph.closeout_blockers || [], [
      "BLOCKING_DISCOVERY",
    ]);
    graph.delivery_graph.conditional_mandatory_skills =
      graph.delivery_graph.conditional_mandatory_skills || [];
    graph.delivery_graph.conditional_mandatory_skills.push({
      skill: target,
      signal: mutation.signal || "BLOCKING_DISCOVERY",
      reason,
    });
    graph.delivery_graph.blocking_discovery = {
      source_skill: outcome.skill,
      signal: mutation.signal || "BLOCKING_DISCOVERY",
      artifact: mutation.artifact || mutation.blocking_discovery_artifact,
      follow_up_wi: mutation.follow_up_wi || null,
      follow_up_status: mutation.follow_up_status || null,
      recommended_skill: target,
      parent_state: "BLOCKED_ON_DISCOVERY",
      reason,
    };
  }

  if (mutation.action.startsWith("close_as_")) {
    const state = mutation.action.replace(/^close_as_/, "").replaceAll("_", "-");
    graph.delivery_graph.closeout_classification = state;
    if (state === "framework-complete") graph.status = "completed";
  }

  return {
    ts: new Date().toISOString(),
    source_skill: outcome.skill,
    action: mutation.action,
    signal_discovered: mutation.signal || null,
    reason,
    affected_tasks: [...new Set(affectedTasks)],
    affected_evidence_families: [...new Set(affectedEvidenceFamilies)],
    validator_proof: mutation.validator_proof || outcome.validator_proof || null,
  };
}

function applyOutcome(graph, outcome) {
  ensureDeliveryGraph(graph);

  graph.delivery_graph.risk_flags = addUnique(graph.delivery_graph.risk_flags || [], list(outcome.signals_added));
  graph.delivery_graph.skill_outcomes = graph.delivery_graph.skill_outcomes || [];
  graph.delivery_graph.skill_outcomes.push({
    skill: outcome.skill,
    status: outcome.status,
    signals_added: list(outcome.signals_added),
    artifacts_produced: list(outcome.artifacts_produced),
    closeout_impact: outcome.closeout_impact || null,
  });

  for (const mutation of outcome.graph_mutations_requested) {
    const history = applyMutation(graph, outcome, mutation);
    graph.delivery_graph.mutation_history.push(history);
  }

  return graph;
}

const args = parseArgs(process.argv.slice(2));
const outcome = normalizeOutcome(JSON.parse(readFileSync(resolve(args.outcome), "utf8")));

try {
  const graphPath = resolve(args.graph);
  const graph = await updateJsonAtomic(graphPath, (current) => applyOutcome(current, outcome));
  console.log(JSON.stringify({
    file: graphPath,
    mutations: outcome.graph_mutations_requested.length,
    mutation_history: graph.delivery_graph.mutation_history.length,
    status: graph.status,
  }, null, 2));
} catch (error) {
  console.error(`apply-skill-outcome: ${error.message}`);
  process.exit(1);
}
