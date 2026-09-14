#!/usr/bin/env node
/**
 * spine-gap-spawn.mjs — gap → research auto-loop helper
 *
 * Called by recall-stack-knowledge when a topic in caller's requires_topics[]
 * returns 0 hits across all 5 Spine layers. Inserts a `research` task at the
 * head of the active lane-tasks graph, scoped to the missing topic.
 *
 * Usage:
 *   node scripts/spine-gap-spawn.mjs <lane-tasks.json> <skill> <topic> [<wi>]
 *
 * Effects:
 *   1. Appends `knowledge-gap` entry to .svc/knowledge-recall.jsonl
 *   2. Inserts a new `research` task at index 0 of lane-tasks.json with
 *      blockedBy: [] and metadata { spawned_by: "spine-gap-loop", topic, source_skill }
 *   3. Sets the requesting task to status `blocked` until research completes
 *   4. Appends a `mechanical` entry to .svc/pipeline-decisions.jsonl
 *
 * Source: proposals/done/2026-04-30-infra-project-support.md § 3.2 (gap → research auto-loop).
 *         WI-SPINE-002 deliverable 3.
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { argv, exit } from "node:process";
import { appendJsonlLine, readJsonAtomic, updateJsonAtomic } from "./state-io.mjs";

const [, , laneTasksPath, sourceSkill, topic, wi] = argv;
if (!laneTasksPath || !sourceSkill || !topic) {
  console.error("Usage: spine-gap-spawn.mjs <lane-tasks.json> <skill> <topic> [<wi>]");
  exit(2);
}

if (!existsSync(laneTasksPath)) {
  console.error(`lane-tasks file not found: ${laneTasksPath}`);
  exit(1);
}

const initialGraph = readJsonAtomic(laneTasksPath);
const wiId = wi || initialGraph.wi || "UNKNOWN";
const ts = new Date().toISOString();

// 1. Append knowledge-gap entry to recall log
const repoRoot = dirname(dirname(resolve(laneTasksPath)));
const recallLog = resolve(repoRoot, ".svc/knowledge-recall.jsonl");
appendJsonlLine(
  recallLog,
  {
    ts,
    wi: wiId,
    skill: sourceSkill,
    event: "knowledge-gap",
    topic,
    outcome: "miss-all",
    action: "gap-loop-spawned-research"
  }
);

let nextId = null;
let blockedTaskId = null;
updateJsonAtomic(laneTasksPath, (lt) => {
  // Insert research task at head of pending tasks under the same lock used for write.
  nextId = Math.max(0, ...lt.tasks.map(t => t.id || 0)) + 1;
  const researchTask = {
    id: nextId,
    skill: "research",
    status: "pending",
    subject: `research: populate domain knowledge for topic '${topic}' (gap-loop spawn)`,
    metadata: {
      spawned_by: "spine-gap-loop",
      topic,
      source_skill: sourceSkill,
      spawned_at: ts
    }
  };

  const blockingIdx = lt.tasks.findIndex(t => t.status === "pending" || t.status === "in_progress");
  if (blockingIdx >= 0) {
    const blockedTask = lt.tasks[blockingIdx];
    blockedTaskId = blockedTask.id;
    blockedTask.status = "blocked";
    blockedTask.blocked_reason = `awaiting Spine research for topic '${topic}' (gap-loop)`;
    blockedTask.blockedBy = [...(blockedTask.blockedBy || []), nextId];
    lt.tasks.splice(blockingIdx, 0, researchTask);
  } else {
    lt.tasks.unshift(researchTask);
  }
  return lt;
}, initialGraph);

// 3. Append mechanical decision
const decisionsLog = resolve(repoRoot, ".svc/pipeline-decisions.jsonl");
appendJsonlLine(
  decisionsLog,
  {
    ts,
    wi: wiId,
    skill: "recall-stack-knowledge",
    decision_class: "mechanical",
    decision: `Gap-loop: 0-hit on topic '${topic}' from ${sourceSkill}; spawned research task #${nextId} at head of lane-tasks; blocked downstream task pending knowledge population.`,
    next_skill: "research"
  }
);

console.log(JSON.stringify({
  spawned_task_id: nextId,
  blocked_task_id: blockedTaskId,
  topic,
  source_skill: sourceSkill,
  wi: wiId
}));
