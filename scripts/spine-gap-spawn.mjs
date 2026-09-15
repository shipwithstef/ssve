#!/usr/bin/env node
/**
 * spine-gap-spawn.mjs — knowledge-gap helper (D-RESEARCH-02).
 * Usage: node scripts/spine-gap-spawn.mjs <lane-tasks.json> <skill> <topic> [<wi>] [--question <JSONfile>]
 */
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { argv, exit } from "node:process";
import { compileDeliveryGraph } from "./compile-delivery-graph.mjs";
import {
  ANALYSIS_REQUIRED,
  EXTERNAL_RESEARCH_REQUIRED,
  isValidQuestionRecord,
  matchingResearchTask,
  reevaluateQuestion,
  researchDecision,
} from "./lib/research-decision.mjs";
import { NO_WRITE, appendJsonlLine, readJsonAtomic, updateJsonAtomic } from "./state-io.mjs";

const USAGE = "Usage: spine-gap-spawn.mjs <lane-tasks.json> <skill> <topic> [<wi>] [--question <JSONfile>]";

function parseCli(args) {
  const positional = [];
  let questionPath = null;
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === "--question") {
      const value = args[i + 1];
      if (value == null || value.startsWith("--")) throw new Error(USAGE);
      questionPath = value;
      i += 1;
      continue;
    }
    if (token.startsWith("--")) throw new Error(`Unknown flag: ${token}`);
    positional.push(token);
  }
  return { positional, questionPath };
}

function assertRegularFile(path, label) {
  if (!existsSync(path)) throw new Error(`${label} not found: ${path}`);
  const st = lstatSync(path);
  if (st.isSymbolicLink() || !st.isFile() || realpathSync(path) !== resolve(path)) throw new Error(`${label} must be a regular file: ${path}`);
}

function loadQuestion(path) {
  assertRegularFile(path, "question file");
  let parsed;
  try { parsed = JSON.parse(readFileSync(path, "utf8")); } catch { throw new Error("malformed question record"); }
  if (!isValidQuestionRecord(parsed)) throw new Error("malformed question record");
  return parsed;
}

function compatibleDeliveryGraph(graph) {
  const dg = graph?.delivery_graph;
  return Boolean(
    graph && typeof graph === "object" && !Array.isArray(graph)
    && typeof graph.wi === "string" && graph.wi.trim()
    && typeof graph.lane === "string" && graph.lane.trim()
    && dg && typeof dg === "object" && !Array.isArray(dg)
    && typeof dg.user_intent === "string" && dg.user_intent.trim()
    && typeof dg.change_type === "string" && dg.change_type.trim()
    && (dg.lane == null || dg.lane === graph.lane)
  );
}

function resolveRequester(tasks, sourceSkill, requestedId) {
  const matches = (Array.isArray(tasks) ? tasks : []).filter(
    (task) => (task?.metadata?.skill || task?.skill) === sourceSkill
  );
  if (requestedId != null) {
    const found = matches.find((task) => task.id === requestedId);
    if (!found) throw new Error(`requesting_task_id ${requestedId} is not a ${sourceSkill} task in the graph`);
    return found;
  }
  if (matches.length === 1) return matches[0];
  if (matches.length === 0) throw new Error(`no graph task matching source skill ${sourceSkill}`);
  throw new Error("ambiguous source-skill matches require requesting_task_id");
}

export function mergeQuestionById(questions, incoming) {
  const list = (Array.isArray(questions) ? questions : []).filter(
    (item) => item && typeof item === "object" && !Array.isArray(item)
  );
  const idx = list.findIndex((item) => item.id === incoming.id);
  if (idx === -1) return [...list, incoming];
  return list.map((item, index) => (index === idx ? incoming : item));
}

function compilerInput(graph, questions) {
  const dg = graph.delivery_graph;
  return {
    wi: graph.wi,
    lane: graph.lane,
    user_intent: dg.user_intent,
    repo_mode: dg.repo_mode,
    change_type: dg.change_type,
    delivery_mode: dg.delivery_mode,
    delivery_tier: dg.delivery_tier,
    risk_flags: dg.risk_flags,
    planned_files: dg.planned_files,
    platform_contracts: dg.platform_contracts,
    solution_confidence: dg.solution_confidence,
    compression: dg.compression,
    questions,
    delivery_graph: { ...dg, research: { ...(dg.research || {}), questions } },
    existing_graph: graph,
  };
}

export function spineGapSpawn(rawArgv = argv.slice(2)) {
  const { positional, questionPath } = parseCli(rawArgv);
  if (positional.length < 3 || positional.length > 4) throw new Error(USAGE);
  const [laneTasksPath, sourceSkill, topic, wi] = positional;
  if (!laneTasksPath || !sourceSkill || !topic) throw new Error(USAGE);
  const laneAbs = resolve(laneTasksPath);
  assertRegularFile(laneAbs, "lane-tasks file");
  if (basename(dirname(laneAbs)) !== ".svc") throw new Error("lane-tasks file must be in the consumer .svc directory");
  const repoRoot = dirname(dirname(laneAbs));
  if (questionPath && (relative(repoRoot, resolve(questionPath)).startsWith("../") || basename(resolve(questionPath)).startsWith(".env"))) throw new Error("question file must be contained in the consumer repository");
  const question = questionPath ? loadQuestion(resolve(questionPath)) : null;
  const ts = new Date().toISOString();
  const initialGraph = readJsonAtomic(laneAbs);
  if (!initialGraph || typeof initialGraph !== "object" || Array.isArray(initialGraph)) {
    throw new Error(`lane-tasks file not found: ${laneTasksPath}`);
  }
  if (wi && initialGraph.wi && wi !== initialGraph.wi) {
    throw new Error(`WI ${wi} does not match graph WI ${initialGraph.wi}`);
  }
  const wiId = wi || initialGraph.wi || "UNKNOWN";
  const result = { decision: ANALYSIS_REQUIRED, spawned_task_id: null, blocked_task_id: null, topic, source_skill: sourceSkill, wi: wiId };
  if (!question) {
    appendJsonlLine(resolve(repoRoot, ".svc/knowledge-recall.jsonl"), {
      ts, wi: wiId, skill: sourceSkill, event: "knowledge-gap", topic, outcome: "miss-all", action: "analysis_required",
    });
    console.log(JSON.stringify(result));
    return result;
  }
  let spawnedTaskId = null;
  let blockedTaskId = null;
  let action = researchDecision(question);
  let mutated = false;
  let outDecision = action;
  updateJsonAtomic(laneAbs, (lt) => {
    if (wi && lt?.wi && wi !== lt.wi) throw new Error(`WI ${wi} does not match graph WI ${lt.wi}`);
    const prior = matchingResearchTask(lt?.tasks, question.id);
    outDecision = researchDecision(reevaluateQuestion(question, prior));
    if (outDecision !== EXTERNAL_RESEARCH_REQUIRED && !prior) return NO_WRITE;
    if (!compatibleDeliveryGraph(lt)) throw new Error("missing compatible delivery_graph; refusing to rebuild unknown graph");
    const requester = resolveRequester(lt.tasks, sourceSkill, question.requesting_task_id);
    const bound = { ...question, requesting_task_id: requester.id, requesting_skill: sourceSkill };
    const questions = mergeQuestionById(lt.delivery_graph.research?.questions, bound);
    const next = compileDeliveryGraph(compilerInput(lt, questions));
    const after = matchingResearchTask(next.tasks, bound.id);
    spawnedTaskId = !prior && after ? after.id : null;
    const req = next.tasks.find((task) => task.id === requester.id);
    blockedTaskId = req?.status === "blocked" ? req.id : null;
    action = spawnedTaskId != null ? "spawned-research" : after ? "reused-research" : "updated-research-decision";
    outDecision = researchDecision(reevaluateQuestion(bound, after));
    next.delivery_graph = {
      ...lt.delivery_graph,
      ...next.delivery_graph,
      mutation_history: [
        ...(Array.isArray(lt.delivery_graph.mutation_history) ? lt.delivery_graph.mutation_history : []),
        { ts, source: "spine-gap-spawn", action, reason: `topic '${topic}' decision ${bound.id}` },
      ],
    };
    mutated = true;
    return { ...lt, ...next, delivery_graph: next.delivery_graph, tasks: next.tasks };
  }, initialGraph);
  if (!mutated) action = outDecision;
  appendJsonlLine(resolve(repoRoot, ".svc/knowledge-recall.jsonl"), {
    ts, wi: wiId, skill: sourceSkill, event: "knowledge-gap", topic, outcome: "miss-all", action,
    requesting_decision_id: question.id, spawned_task_id: spawnedTaskId,
  });
  if (mutated) {
    appendJsonlLine(resolve(repoRoot, ".svc/pipeline-decisions.jsonl"), {
      ts, wi: wiId, skill: "recall-stack-knowledge", decision_class: "mechanical",
      decision: `Gap-loop topic '${topic}' from ${sourceSkill}: ${action} for ${question.id}`,
      next_skill: spawnedTaskId != null ? "research" : undefined,
    });
  }
  Object.assign(result, {
    decision: outDecision, spawned_task_id: spawnedTaskId, blocked_task_id: blockedTaskId,
    wi: initialGraph.wi || wiId, requesting_decision_id: question.id,
  });
  console.log(JSON.stringify(result));
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    spineGapSpawn(argv.slice(2));
  } catch (error) {
    console.error(error.message || error);
    exit(String(error.message || "").startsWith("Usage:") ? 2 : 1);
  }
}
