#!/usr/bin/env node
/**
 * validate-task-graph-lane.mjs — Validate a task graph against its lane model.
 *
 * Checks that all mandatory skills for the WI's lane are represented as tasks
 * in the task graph. This catches authoring errors where review-gate,
 * audit-implementation, or other mandatory steps are accidentally omitted.
 *
 * Host-agnostic: works identically in Kimi, Claude Code, Codex, and Gemini.
 *
 * Usage:
 *   node scripts/validate-task-graph-lane.mjs <path-to-lane-tasks-WI-XXX.json>
 *
 * Exit codes:
 *   0 — task graph covers all mandatory lane skills
 *   1 — validation failed (missing skills or invalid graph)
 *   2 — bad arguments
 */

import fs from "node:fs";
import path from "node:path";

// Lane model definitions — canonical skills per lane.
// Source: route-workflow/references/lane-model.md
// TODO: Consider loading dynamically from skills-manifest.json or lane-model.md
//       to avoid drift when lane definitions change.
const LANE_MODELS = {
  1: {
    name: "greenfield",
    mandatory: [
      "write-spec",
      "plan-changeset",
      "execute-changeset",
      "review-gate",
      "audit-implementation",
      "land-changeset",
      "verify-promotion",
    ],
    optional: [
      "write-vision",
      "analyze-domain",
      "analyze-competitors",
      "build-personas",
      "validate-feature",
      "audit-ac",
      "write-journeys",
      "design-ux",
      "design-ui",
      "track-visuals",
      "design-tech",
      "explore-solutions",
      "define-code-style",
    ],
  },
  2: {
    name: "conversion",
    mandatory: [
      "onboard-repo",
    ],
    optional: [
      "sync-work-items",
    ],
  },
  3: {
    name: "brownfield-feature",
    mandatory: [
      "write-spec",
      "plan-changeset",
      "execute-changeset",
      "review-gate",
      "audit-implementation",
      "land-changeset",
      "verify-promotion",
    ],
    optional: [
      "sync-spec-code",
      "validate-feature",
      "write-journeys",
      "design-ux",
      "design-ui",
      "track-visuals",
      "design-tech",
      "explore-solutions",
      "define-code-style",
    ],
  },
  4: {
    name: "bugfix",
    mandatory: [
      "diagnose-bug",
      "review-gate",
      "land-changeset",
      "verify-promotion",
    ],
    optional: [
      "plan-changeset",
      "execute-changeset",
      "write-e2e",
      "test-journeys",
      "review-security",
    ],
  },
  5: {
    name: "drift",
    mandatory: [
      "sync-spec-code",
      "land-changeset",
    ],
    optional: [
      "write-spec",
      "plan-changeset",
      "execute-changeset",
    ],
  },
  6: {
    name: "refactor",
    mandatory: [
      "plan-changeset",
      "execute-changeset",
      "review-gate",
      "land-changeset",
      "verify-promotion",
    ],
    optional: [
      "define-code-style",
    ],
  },
  7: {
    name: "framework",
    mandatory: [
      "plan-changeset",
      "execute-changeset",
      "review-gate",
      "land-changeset",
      "verify-promotion",
    ],
    optional: [
      "write-spec",
      "design-tech",
      "review-plan",
      "audit-implementation",
      "diagnose-bug",
      "improve-framework",
      "evolve-framework",
      "test-framework",
      "audit-session-execution",
      "blend-external",
      "blend-private",
      "explore-solutions",
      "research",
    ],
  },
};

function die(message) {
  console.error(message);
  process.exit(1);
}

function readGraph(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Extract the skill name from a task, handling both canonical format
 * (metadata.skill) and project-specific format (task.skill).
 */
function taskSkill(task) {
  if (typeof task.metadata?.skill === "string" && task.metadata.skill.length > 0) {
    return task.metadata.skill;
  }
  if (typeof task.skill === "string" && task.skill.length > 0) {
    return task.skill;
  }
  return null;
}

/**
 * Collect all unique skills represented in the task graph.
 */
function collectGraphSkills(graph) {
  const skills = new Set();
  for (const task of graph.tasks ?? []) {
    const skill = taskSkill(task);
    if (skill) skills.add(skill);
  }
  return skills;
}

function validateLane(graph, filePath) {
  const lane = graph.lane;
  if (lane == null) {
    throw new Error("task graph has no 'lane' field");
  }

  // Support both numeric (1-7) and named ("greenfield", "framework", etc.) lane references.
  const NAME_TO_NUM = Object.fromEntries(
    Object.entries(LANE_MODELS).map(([num, def]) => [def.name, num])
  );
  const laneKey = LANE_MODELS[lane] ? lane : NAME_TO_NUM[lane];
  const laneModel = LANE_MODELS[laneKey];
  if (!laneModel) {
    const known = Object.entries(LANE_MODELS).map(([n, d]) => `${n}=${d.name}`).join(", ");
    throw new Error(`lane ${lane} is not defined in lane models (known: ${known})`);
  }

  const graphSkills = collectGraphSkills(graph);
  const missing = [];

  for (const skill of laneModel.mandatory) {
    if (skill === "review-gate" && (graphSkills.has("review-gate") || graphSkills.has("review-exec"))) {
      continue;
    }
    if (!graphSkills.has(skill)) {
      missing.push(skill);
    }
  }

  return {
    lane,
    laneName: laneModel.name,
    graphSkills: Array.from(graphSkills),
    mandatory: laneModel.mandatory,
    missing,
    pass: missing.length === 0,
  };
}

function validateStatusConsistency(graph) {
  const tasks = graph.tasks ?? [];
  if (tasks.length === 0) return { consistent: true };

  const hasPending = tasks.some((t) => t.status === "pending" || t.status === "in_progress");
  const rootCompleted = graph.status === "completed";

  if (hasPending && rootCompleted) {
    return {
      consistent: false,
      issue: "root status is 'completed' but some tasks are still pending/in_progress",
      fix: "set root.status to 'in_progress'",
    };
  }
  return { consistent: true };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const filePath = process.argv[2];
if (!filePath) {
  die("Usage: node scripts/validate-task-graph-lane.mjs <path-to-lane-tasks-WI-XXX.json>");
}

const resolvedPath = path.resolve(filePath);
if (!fs.existsSync(resolvedPath)) {
  die(`file not found: ${resolvedPath}`);
}

let graph;
try {
  graph = readGraph(resolvedPath);
} catch (err) {
  die(`failed to parse JSON: ${err.message}`);
}

const result = {
  file: resolvedPath,
  wi: graph.wi ?? null,
  lane: graph.lane ?? null,
  status: graph.status ?? null,
  taskCount: (graph.tasks ?? []).length,
};

// Lane model validation
let laneResult;
try {
  laneResult = validateLane(graph, resolvedPath);
} catch (err) {
  result.error = err.message;
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

result.laneValidation = laneResult;

// Status consistency check
result.statusConsistency = validateStatusConsistency(graph);

// Output
console.log(JSON.stringify(result, null, 2));

if (!laneResult.pass || !result.statusConsistency.consistent) {
  process.exit(1);
}
