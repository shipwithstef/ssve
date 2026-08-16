#!/usr/bin/env node

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { readJsonAtomic, writeJsonAtomic, updateJsonAtomic, NO_WRITE } from "./state-io.mjs";
import { loadStageRegistry } from "./lib/stage-registry.mjs";

// WI-498: inlined here because task-graph.mjs is a standalone CLI that runs from
// REDUCED/copied source sets (onboarded repos vendor scripts/ but NOT hooks/lib/),
// so it cannot `import` from ../hooks/lib/. Kept byte-faithful to the canonical
// `recoverableId` in hooks/lib/validate-task-graph-shape.mjs: numeric 1 and the
// command-line string "1" collapse to the same key; a non-numeric string is kept
// verbatim; anything else confers no recoverable id.
// canonical: hooks/lib/validate-task-graph-shape.mjs
function recoverableId(id) {
  if (typeof id === "number") return Number.isFinite(id) ? String(id) : null;
  if (typeof id === "string") return id.length > 0 ? id : null;
  return null;
}

// The first pending task whose blockers are all completed, but ONLY when no task
// is in_progress (the pre-first-load branch). Mirrors the enforcer's predicate in
// hooks/codex/svc-codex-skill-load-enforcer.mjs so an enforcer-authorized loader
// resolves to the same target activate-skill will act on.
function firstRunnablePendingTask(graph) {
  const tasks = graph.tasks || [];
  if (tasks.some((t) => t.status === "in_progress")) return null;
  const byKey = new Map(tasks.map((t) => [recoverableId(t.id), t]));
  for (const t of tasks) {
    if (t.status !== "pending") continue;
    const runnable = (t.blocked_by || []).every((b) => byKey.get(recoverableId(b))?.status === "completed");
    if (runnable) return t;
  }
  return null;
}

const VALID_STATUSES = new Set(["pending", "in_progress", "completed", "blocked", "skipped"]);
const VALID_GRAPH_STATUSES = new Set(["pending", "in_progress", "completed", "blocked", "skipped"]);
const COMPLETED_STATUS = "completed";
const PERSONA_COVERAGE_GATE_CUTOFF = Date.parse("2026-06-05T00:00:00.000Z");
const PERSONA_GATED_LANES = new Set(["greenfield", "brownfield-feature"]);
const PERSONA_COVERAGE_STATUSES = new Set(["satisfied", "not_required"]);
// Aligned with hook + tier-1 validator default (4h). Both must move together
// or dispatch can pass one gate and fail the next — the freshness-threshold
// split WI-155 originally closed. See hooks/svc-session-contract-freshness.mjs
// and test-framework/evals/tier-1/validate-session-contract-freshness.sh.
const SESSION_CONTRACT_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const TASK_GRAPH_CONTRACT_BOUND_TO = new Set(["wi-backlog", "user-request", "framework-evolution"]);
const NON_SKIPPABLE_SKILLS = new Set(["plan-changeset", "review-plan", "execute-changeset", "review-gate", "review-exec", "audit-implementation", "land-changeset", "verify-promotion"]);

function evidenceDigest(file) { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function assertRequiredProcesses(task) {
  for (const step of task?.metadata?.required_process_steps || []) {
    const receipt = (task.process_receipts || []).find((row) => row?.skill === step.skill && String(row?.mode || "") === String(step.mode || ""));
    if (!receipt?.evidence?.path || !/^[0-9a-f]{64}$/.test(String(receipt.evidence.sha256 || ""))) throw new Error(`task ${task.id} requires a digest-bound ${step.skill}${step.mode ? `/${step.mode}` : ""} process receipt before completion`);
    const file = path.resolve(receipt.evidence.path); if (!fs.existsSync(file) || evidenceDigest(file) !== receipt.evidence.sha256) throw new Error(`task ${task.id} process evidence is missing or stale for ${step.skill}`);
  }
}

function die(message) {
  console.error(message);
  process.exit(1);
}

function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) {
      die(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value == null || value.startsWith("--")) {
      die(`Missing value for --${key}`);
    }
    flags[key] = value;
    i += 1;
  }
  return flags;
}

function readGraph(filePath) {
  return readJsonAtomic(filePath);
}

// OPT-12: task graphs are meant to be portable across machines/worktrees.
// Relativize ONLY paths that actually live under the current working
// directory (the repo root, in normal invocations) — anything outside stays
// absolute (e.g. a path on another disk). No migration of existing absolute
// paths already recorded in older graphs; readers fall back to the literal
// string if relative-resolve doesn't exist.
function relativizeUnderCwd(candidatePath) {
  if (typeof candidatePath !== "string" || !path.isAbsolute(candidatePath)) return candidatePath;
  const rel = path.relative(process.cwd(), candidatePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return candidatePath;
  return rel;
}

function parseTime(ts) {
  if (typeof ts !== "string" || ts.length === 0) return null;
  const epoch = Date.parse(ts);
  return Number.isNaN(epoch) ? null : epoch;
}

function readSessionContracts(contractPath) {
  try {
    return fs
      .readFileSync(contractPath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line, index) => {
        try {
          return { index: index + 1, value: JSON.parse(line) };
        } catch {
          return { index: index + 1, value: null };
        }
      });
  } catch {
    return [];
  }
}

const WI_ID_RE = /^WI-[A-Z0-9]+(-[A-Z0-9]+)*$/;  // canonical: hooks/lib/wi-id.mjs (inlined — task-graph runs standalone from reduced/copied source)

// FIX 6 (review round): `command` defaults to "init" so every pre-existing
// caller's message text is byte-identical; "generate" (C2) passes its own
// name so a blocked run reads correctly instead of naming the wrong command.
function assertFreshSessionContractForInit(targetPath, wi, command = "init") {
  if (!WI_ID_RE.test(wi)) return;

  const svcDir = path.basename(path.dirname(targetPath)) === ".svc" ? path.dirname(targetPath) : null;
  if (!svcDir) return;

  const fileName = path.basename(targetPath);
  if (!new RegExp(`^lane-tasks-${wi}\\.json$`).test(fileName)) {
    die(
      `task-graph ${command} for ${wi} must write .svc/lane-tasks-${wi}.json. ` +
        `Got ${path.relative(process.cwd(), targetPath)}.`
    );
  }

  const contractPath = path.join(svcDir, "session-contract.jsonl");
  const contracts = readSessionContracts(contractPath);
  if (contracts.length === 0) {
    die(
      `task-graph ${command} blocked: ${path.relative(process.cwd(), contractPath)} is missing or empty.\n` +
        `Recovery: append a fresh session-contract entry for ${wi} before creating ` +
        `.svc/lane-tasks-${wi}.json.`
    );
  }

  const now = Date.now();
  const match = contracts
    .slice()
    .reverse()
    .find(({ value }) => {
      if (!value || value.wi !== wi || !TASK_GRAPH_CONTRACT_BOUND_TO.has(value.bound_to)) {
        return false;
      }
      const ts = parseTime(value.ts);
      return ts != null && now - ts <= SESSION_CONTRACT_MAX_AGE_MS;
    });

  if (!match) {
    const maxAgeHours = SESSION_CONTRACT_MAX_AGE_MS / (60 * 60 * 1000);
    die(
      `task-graph ${command} blocked: no fresh session-contract entry references ${wi} ` +
        `within the last ${maxAgeHours} hour(s).\n` +
        `Recovery: append a new .svc/session-contract.jsonl row before dispatching ${wi}. ` +
        `The row must include wi="${wi}" and bound_to one of: ` +
        `${Array.from(TASK_GRAPH_CONTRACT_BOUND_TO).join(", ")}.`
    );
  }
}

function writeGraph(filePath, graph) {
  // Validate before every write to prevent corrupt data from persisting
  validateGraph(graph);
  writeJsonAtomic(filePath, graph);
}

function expectedTaskSkill(task) {
  if (typeof task.metadata?.skill === "string" && task.metadata.skill.length > 0) {
    return task.metadata.skill;
  }
  if (typeof task.skill === "string" && task.skill.length > 0) {
    return task.skill;
  }
  return null;
}

function compactString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function taskSkillSet(tasks) {
  return new Set(tasks.map(expectedTaskSkill).filter(Boolean));
}

function deriveGraphStatus(tasks) {
  if (tasks.length === 0) {
    return "pending";
  }
  if (tasks.every((task) => task.status === COMPLETED_STATUS)) {
    return COMPLETED_STATUS;
  }
  if (tasks.some((task) => task.status === "in_progress")) {
    return "in_progress";
  }
  if (tasks.some((task) => task.status === "pending")) {
    return "pending";
  }
  if (tasks.some((task) => task.status === "blocked")) {
    return "blocked";
  }
  // No open work remains (nothing in_progress/pending/blocked) — every task is
  // terminal (completed or skipped). A skipped task is a deliberate terminal
  // disposition, not open work, so the bare "pending" fallthrough mis-reported
  // terminal graphs (WI-446). All-skipped → "skipped"; otherwise ≥1 completed
  // task means the graph is done → "completed".
  if (tasks.every((task) => task.status === "skipped")) {
    return "skipped";
  }
  return COMPLETED_STATUS;
}

function syncGraphStatus(graph) {
  graph.status = deriveGraphStatus(graph.tasks);
}

function validateTask(task, index) {
  if (typeof task.id !== "number") {
    throw new Error(`tasks[${index}].id must be a number`);
  }
  if (typeof task.subject !== "string" || task.subject.length === 0) {
    throw new Error(`tasks[${index}].subject must be a non-empty string`);
  }
  if (!VALID_STATUSES.has(task.status)) {
    throw new Error(
      `tasks[${index}].status must be one of ${Array.from(VALID_STATUSES).join(", ")}`
    );
  }
  if (task.blocked_by != null && !Array.isArray(task.blocked_by)) {
    throw new Error(`tasks[${index}].blocked_by must be an array when present`);
  }
  if (task.blocked_by != null && task.blocked_by.some((blockerId) => !Number.isFinite(blockerId))) {
    throw new Error(`tasks[${index}].blocked_by entries must be numbers`);
  }
  if (task.metadata != null && (typeof task.metadata !== "object" || Array.isArray(task.metadata))) {
    throw new Error(`tasks[${index}].metadata must be an object when present`);
  }
  if (task.completed_at != null && typeof task.completed_at !== "string") {
    throw new Error(`tasks[${index}].completed_at must be a string when present`);
  }
  if (task.skip_reason != null && typeof task.skip_reason !== "string") {
    throw new Error(`tasks[${index}].skip_reason must be a string when present`);
  }
  if (task.skill_receipt != null) {
    if (typeof task.skill_receipt !== "object" || Array.isArray(task.skill_receipt)) {
      throw new Error(`tasks[${index}].skill_receipt must be an object when present`);
    }
    if (typeof task.skill_receipt.skill !== "string" || task.skill_receipt.skill.length === 0) {
      throw new Error(`tasks[${index}].skill_receipt.skill must be a non-empty string`);
    }
    if (
      typeof task.skill_receipt.loaded_at !== "string" ||
      task.skill_receipt.loaded_at.length === 0
    ) {
      throw new Error(`tasks[${index}].skill_receipt.loaded_at must be a non-empty string`);
    }
    if (
      typeof task.skill_receipt.loaded_via !== "string" ||
      task.skill_receipt.loaded_via.length === 0
    ) {
      throw new Error(`tasks[${index}].skill_receipt.loaded_via must be a non-empty string`);
    }
    const expectedSkill = expectedTaskSkill(task);
    if (expectedSkill && task.skill_receipt.skill !== expectedSkill) {
      throw new Error(
        `tasks[${index}].skill_receipt.skill must match the task skill (${expectedSkill})`
      );
    }
  }
  const expectedSkill = expectedTaskSkill(task);
  if (task.status === COMPLETED_STATUS && expectedSkill && !task.skill_receipt) {
    throw new Error(
      `tasks[${index}] (${expectedSkill}) is completed but missing skill_receipt. ` +
      `Run: node scripts/task-graph.mjs load-skill <path> ${task.id} ${expectedSkill}`
    );
  }
}

function buildTaskMap(graph) {
  const tasksById = new Map();
  for (const task of graph.tasks) {
    if (tasksById.has(task.id)) {
      throw new Error(`duplicate task id: ${task.id}`);
    }
    tasksById.set(task.id, task);
  }
  return tasksById;
}

function assertGraphIntegrity(graph, tasksById) {
  for (const task of graph.tasks) {
    const blockers = task.blocked_by ?? [];
    for (const blockerId of blockers) {
      if (blockerId === task.id) {
        throw new Error(`task ${task.id} cannot block itself`);
      }
      if (!tasksById.has(blockerId)) {
        throw new Error(`task ${task.id} references missing blocker ${blockerId}`);
      }
    }
  }

  const visiting = new Set();
  const visited = new Set();

  function walk(taskId, trail) {
    if (visiting.has(taskId)) {
      throw new Error(`dependency cycle detected: ${[...trail, taskId].join(" -> ")}`);
    }
    if (visited.has(taskId)) {
      return;
    }

    visiting.add(taskId);
    const task = tasksById.get(taskId);
    for (const blockerId of task.blocked_by ?? []) {
      walk(blockerId, [...trail, taskId]);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  }

  for (const taskId of tasksById.keys()) {
    walk(taskId, []);
  }
}

function isModernPersonaGateGraph(graph) {
  const created = parseTime(graph.created);
  return created == null || created >= PERSONA_COVERAGE_GATE_CUTOFF;
}

function isPersonaGatedFeatureGraph(graph, skills) {
  if (!isModernPersonaGateGraph(graph)) return false;
  if (!Array.isArray(graph.tasks) || graph.tasks.length === 0) return false;
  if (graph.status === "skipped") return false;

  const deliveryGraph = graph.delivery_graph;
  if (deliveryGraph && typeof deliveryGraph === "object") {
    const riskFlags = Array.isArray(deliveryGraph.risk_flags) ? deliveryGraph.risk_flags : [];
    return (
      deliveryGraph.change_type === "feature" &&
      (riskFlags.includes("user-facing") || riskFlags.includes("admin-facing"))
    );
  }

  const lane = compactString(graph.lane || graph.route?.lane || graph.metadata?.lane);
  const changeType = compactString(graph.change_type || graph.route?.change_type || graph.metadata?.change_type);
  if (changeType && changeType !== "feature") return false;
  if (PERSONA_GATED_LANES.has(lane)) return true;

  const featureSkillSignals = [
    "validate-feature",
    "write-spec",
    "write-journeys",
    "design-ux",
    "design-ui",
    "write-e2e",
    "test-journeys",
  ];
  return featureSkillSignals.some((skill) => skills.has(skill));
}

function validatePersonaCoverageDecision(graph) {
  const decision = graph.persona_coverage || graph.metadata?.persona_coverage || null;
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    throw new Error(
      "persona coverage gate: feature-class task graph must include build-personas " +
        "or a top-level persona_coverage decision"
    );
  }

  const status = compactString(decision.status);
  if (!PERSONA_COVERAGE_STATUSES.has(status)) {
    throw new Error(
      `persona coverage gate: persona_coverage.status must be one of ${Array.from(PERSONA_COVERAGE_STATUSES).join(", ")}`
    );
  }

  const reason = compactString(decision.reason);
  const artifact = compactString(decision.artifact || decision.evidence || decision.decision_ref);
  if (status === "satisfied" && !artifact) {
    throw new Error(
      "persona coverage gate: persona_coverage.status=satisfied requires artifact, evidence, or decision_ref"
    );
  }
  if (status === "not_required" && reason.length < 20) {
    throw new Error(
      "persona coverage gate: persona_coverage.status=not_required requires a concrete reason"
    );
  }
}

function assertPersonaCoverageGate(graph) {
  const skills = taskSkillSet(graph.tasks);
  if (!isPersonaGatedFeatureGraph(graph, skills)) return;
  if (skills.has("build-personas")) return;
  validatePersonaCoverageDecision(graph);
}

function validateGraph(graph) {
  if (typeof graph !== "object" || graph == null || Array.isArray(graph)) {
    throw new Error("task graph must be a JSON object");
  }
  if (graph.status != null && !VALID_GRAPH_STATUSES.has(graph.status)) {
    throw new Error(
      `task graph status must be one of ${Array.from(VALID_GRAPH_STATUSES).join(", ")}`
    );
  }
  if (!Array.isArray(graph.tasks)) {
    throw new Error("task graph must contain a tasks array");
  }
  graph.tasks.forEach(validateTask);
  const tasksById = buildTaskMap(graph);
  assertGraphIntegrity(graph, tasksById);
  assertPersonaCoverageGate(graph);
  if (graph.status != null) {
    const derivedStatus = deriveGraphStatus(graph.tasks);
    if (graph.status !== derivedStatus) {
      throw new Error(
        `task graph status ${graph.status} does not match task-derived status ${derivedStatus}`
      );
    }
  }
  return tasksById;
}

function blockersComplete(task, tasksById) {
  return (task.blocked_by ?? []).every(
    (blockerId) => tasksById.get(blockerId)?.status === COMPLETED_STATUS
  );
}

function nextTask(graph, tasksById) {
  const inProgress = graph.tasks.find((task) => task.status === "in_progress") ?? null;
  if (inProgress) {
    if (!blockersComplete(inProgress, tasksById)) {
      const unresolved = (inProgress.blocked_by ?? []).filter(
        (blockerId) => tasksById.get(blockerId)?.status !== COMPLETED_STATUS
      );
      throw new Error(
        `task ${inProgress.id} is in_progress but still blocked by ${unresolved.join(", ")}`
      );
    }
    return inProgress;
  }

  return (
    graph.tasks.find(
      (task) => task.status === "pending" && blockersComplete(task, tasksById)
    ) ?? null
  );
}

const [command, fileArg, ...rest] = process.argv.slice(2);
if (!command || !fileArg) {
  die(
  "Usage: node scripts/task-graph.mjs <init|generate|validate|next|summary|graph-status|set-status|load-skill|activate-skill|record-process|record-phase|backfill-receipts> <path> [...]"
  );
}

const filePath = path.resolve(fileArg);

if (command === "init") {
  const flags = parseFlags(rest);
  if (!flags.wi || !flags.lane) {
    die("init requires --wi and --lane");
  }
  assertFreshSessionContractForInit(filePath, flags.wi);
  const graph = {
    wi: flags.wi,
    lane: flags.lane,
    created: flags.created ?? new Date().toISOString(),
    status: "pending",
    tasks: [],
  };
  writeGraph(filePath, graph);
  console.log(`initialized ${filePath}`);
  process.exit(0);
}

if (command === "backfill-receipts") {
  let graph;
  try {
    graph = readGraph(filePath);
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
  let backfilled = 0;
  for (const task of graph.tasks) {
    if (task.status !== COMPLETED_STATUS) continue;
    const expectedSkill = expectedTaskSkill(task);
    if (!expectedSkill || task.skill_receipt) continue;
    task.skill_receipt = {
      skill: expectedSkill,
      loaded_at: task.completed_at ?? new Date().toISOString(),
      loaded_via: "legacy-backfill",
    };
    backfilled += 1;
  }
  syncGraphStatus(graph);
  try {
    validateGraph(graph);
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
  writeGraph(filePath, graph);
  console.log(`backfilled ${backfilled} receipts in ${filePath}`);
  process.exit(0);
}

// WI-521 Batch C (C2): generate a numeric-id task graph FROM the canonical
// stage registry's story-type profile, plus seed the matching story-receipts
// file — the "open everything as a pile of tasks the harness burns through"
// deliverable. Reuses writeGraph/validateGraph/syncGraphStatus (this file's
// own helpers) rather than reimplementing graph mechanics; task ids are
// numeric per this file's own validateTask.
if (command === "generate") {
  // --force is a boolean switch (no value); parseFlags requires every --flag
  // to carry one, so strip it before parsing rather than changing the shared
  // helper other commands also rely on.
  const force = rest.includes("--force");
  const flags = parseFlags(rest.filter((token) => token !== "--force"));
  const wi = flags.wi;
  const storyType = flags["story-type"];
  // FIX 6 (review round): --lane was previously optional and the graph always
  // emitted "lane": null — the one field every OTHER graph-producing command
  // in this file treats as load-bearing (init requires it outright).
  if (!wi || !storyType || !flags.lane) {
    die("generate requires --wi, --story-type, and --lane [--activation <json-file>] [--scope <text>] [--force]");
  }
  if (!WI_ID_RE.test(wi)) {
    die(`invalid --wi "${wi}" — must match ${WI_ID_RE}`);
  }
  // FIX 6 (review round): init requires a fresh session-contract entry before
  // writing .svc/lane-tasks-<WI>.json; generate was a second, ungated path to
  // the exact same artifact shape. The assertion no-ops for any path outside
  // .svc/ (scratch/dogfood targets), so this only bites the real target shape.
  assertFreshSessionContractForInit(filePath, wi, "generate");
  // FIX 8 (review round): generate previously overwrote any existing target
  // unconditionally — proven to destroy a curated graph/receipts pair on a
  // second run. Refuse unless --force says the overwrite is intended.
  if (fs.existsSync(filePath) && !force) {
    die(`${filePath} already exists — refusing to overwrite a possibly-curated graph. Pass --force to regenerate it.`);
  }
  // FIX S1 (review round): the receipts file is ALWAYS written, but the
  // session-contract gate above only fires for a real .svc/lane-tasks-<WI>.json
  // target — a scratch graph path exited 0 with no contract and still seeded
  // docs/specs/receipts/<WI>.receipts.json into the repo. Chosen resolution
  // (stated, per the review's ask): a scratch graph produces scratch receipts
  // — the receipts path follows the GRAPH path's directory whenever that graph
  // is not under .svc/, so a dogfood/test run never silently seeds a repo
  // artifact; only the real .svc/ target still resolves to the canonical
  // docs/specs/receipts/<WI>.receipts.json location.
  const graphUnderSvc = path.basename(path.dirname(filePath)) === ".svc";
  const receiptsPathPreflight = graphUnderSvc
    ? path.resolve(`docs/specs/receipts/${wi}.receipts.json`)
    : path.join(path.dirname(filePath), `${wi}.receipts.json`);
  if (fs.existsSync(receiptsPathPreflight) && !force) {
    die(`${receiptsPathPreflight} already exists — refusing to overwrite a possibly-curated receipts file. Pass --force to regenerate it.`);
  }

  const registryPath = path.resolve("references/stage-registry.json");
  let registry;
  try { registry = loadStageRegistry(registryPath); }
  catch (error) { die(error.message); }
  const profile = registry.story_type_profiles?.[storyType];
  if (!Array.isArray(profile)) {
    die(`unknown --story-type "${storyType}" — one of: ${Object.keys(registry.story_type_profiles || {}).join(", ")}`);
  }
  const profileSet = new Set(profile);
  // Registry array order IS the canonical stage order (references/stage-registry.json
  // `_comment`) — nothing else defines it, including the profile array's own order.
  const stagesInOrder = registry.stages.filter((s) => profileSet.has(s.key));

  // Optional activation results (scripts/stage-activation.mjs --diff ... output,
  // captured to a file): a stage with a matching entry and result:"na" is seeded
  // completed/na with the condition as evidence; everything else is active/pending.
  const activationByStage = new Map();
  if (flags.activation) {
    let activationRaw;
    try {
      activationRaw = JSON.parse(fs.readFileSync(path.resolve(flags.activation), "utf8"));
    } catch (error) {
      die(`--activation file invalid: ${flags.activation} — ${error.message}`);
    }
    if (!Array.isArray(activationRaw)) {
      die(`--activation file must be a JSON array (scripts/stage-activation.mjs output): ${flags.activation}`);
    }
    for (const entry of activationRaw) {
      if (entry && typeof entry.stage === "string") activationByStage.set(entry.stage, entry);
    }
  }

  const now = new Date().toISOString();
  const tasks = [];
  const receiptStages = [];
  let lastEssentialId = null;
  let nextId = 1;

  for (const stage of stagesInOrder) {
    const id = nextId++;
    const activation = activationByStage.get(stage.key);
    const isNa = Boolean(activation && activation.result === "na");
    // FIX 1 (review round): the producer's essential fence (scripts/stage-activation.mjs
    // refuses to even CONDITION an essential stage) has no effect on a hand-fed
    // --activation file, which is a second, independent input path into this consumer.
    // An essential stage can never be na regardless of what the file claims — refuse
    // outright rather than silently writing a completed/na essential task.
    if (isNa && stage.class === "essential") {
      die(
        `--activation marks essential stage "${stage.key}" as na — essential stages can ` +
        `never be conditioned (same fence scripts/stage-activation.mjs enforces on its ` +
        `own --conditions input); refusing to generate a graph or receipts file that ` +
        `would silently skip it`
      );
    }
    const blockedBy = lastEssentialId != null ? [lastEssentialId] : [];
    // FIX 7 (review round): the activation CONDITION text describes what would make
    // the stage active — stating it bare as the skip reason reads as though the
    // condition WAS met. Prefix it, and carry the whole record (stage/condition/
    // evaluated_against/result) so Self-Verify 2b's citation shape is reconstructible
    // from the skip_reason alone, not just the free-text half of it.
    const conditionEvidence = isNa ? `condition not met: ${JSON.stringify(activation)}` : "";
    const task = {
      id,
      subject: `${stage.key}: ${stage.owner_skill ?? "none"}`,
      status: isNa ? COMPLETED_STATUS : "pending",
      blocked_by: blockedBy,
    };
    if (stage.owner_skill) task.skill = stage.owner_skill;
    if (isNa) {
      task.skip_reason = conditionEvidence;
      task.completed_at = now;
      // A completed task naming an owner_skill requires a skill_receipt
      // (validateTask) — this one records a SKIP decision, not a real
      // invocation, so loaded_via says so rather than pretending the skill ran.
      if (stage.owner_skill) {
        task.skill_receipt = { skill: stage.owner_skill, loaded_at: now, loaded_via: "stage-activation-skip" };
      }
    }
    tasks.push(task);
    if (stage.class === "essential") lastEssentialId = id;

    receiptStages.push({
      stage: stage.key,
      status: isNa ? "na" : "pending",
      evidence: [],
      grounded_on: [],
      note: isNa ? conditionEvidence : "",
    });
  }

  const graph = {
    wi,
    lane: flags.lane,
    story_type: storyType,
    // change_type mirrors story_type so the pre-existing persona-coverage gate
    // (assertPersonaCoverageGate below) only applies to story_type "feature" —
    // unrelated to this batch's scope, just satisfied honestly: the "feature"
    // profile always includes the `personas` stage (owner_skill build-personas),
    // so the gate is naturally met without a fabricated persona_coverage decision.
    change_type: storyType,
    created: now,
    tasks,
  };
  syncGraphStatus(graph);
  try {
    writeGraph(filePath, graph);
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }

  const receiptsPath = receiptsPathPreflight;
  fs.mkdirSync(path.dirname(receiptsPath), { recursive: true });
  const receiptsDoc = { wi, story_type: storyType, scope: flags.scope ?? "", stages: receiptStages };
  fs.writeFileSync(receiptsPath, JSON.stringify(receiptsDoc, null, 2) + "\n", "utf8");

  console.log(`generated ${filePath} (${tasks.length} tasks) and seeded ${path.relative(process.cwd(), receiptsPath)}`);
  process.exit(0);
}

let graph;
let tasksById;
try {
  graph = readGraph(filePath);
  tasksById = validateGraph(graph);
} catch (error) {
  die(`${filePath}: ${error.message}`);
}

if (command === "validate") {
  console.log(
    JSON.stringify(
      {
        file: filePath,
        wi: graph.wi ?? null,
        lane: graph.lane ?? null,
        status: graph.status ?? deriveGraphStatus(graph.tasks),
        tasks: graph.tasks.length,
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (command === "next") {
  try {
    const task = nextTask(graph, tasksById);
    console.log(JSON.stringify(task, null, 2));
    process.exit(0);
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
}

if (command === "graph-status") {
  console.log(
    JSON.stringify(
      {
        file: filePath,
        wi: graph.wi ?? null,
        lane: graph.lane ?? null,
        status: graph.status ?? deriveGraphStatus(graph.tasks),
      },
      null,
      2
    )
  );
  process.exit(0);
}

if (command === "summary") {
  const counts = graph.tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  try {
    console.log(
      JSON.stringify(
        {
          wi: graph.wi ?? null,
          lane: graph.lane ?? null,
          status: graph.status ?? deriveGraphStatus(graph.tasks),
          total: graph.tasks.length,
          counts,
          next: nextTask(graph, tasksById),
        },
        null,
        2
      )
    );
    process.exit(0);
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
}

if (command === "set-status") {
  const [taskIdArg, status, ...flagArgs] = rest;
  if (!taskIdArg || !status) {
    die("set-status requires <task-id> <status>");
  }
  if (!VALID_STATUSES.has(status)) {
    die(`invalid status: ${status}`);
  }
  const taskId = Number(taskIdArg);
  if (!Number.isFinite(taskId)) {
    die(`invalid task id: ${taskIdArg}`);
  }
  const flags = parseFlags(flagArgs);
  if (status !== COMPLETED_STATUS && flags["skip-reason"]) {
    die("--skip-reason is only valid when status is completed");
  }
  if (status !== COMPLETED_STATUS && flags["completed-at"]) {
    die("--completed-at is only valid when status is completed");
  }
  if (flags["blocked-by-json"]) die("set-status cannot rewrite task dependencies; regenerate the validated graph instead");
  try {
    updateJsonAtomic(filePath, (current) => {
      validateGraph(current);
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`task ${taskId} not found`);
      const previousStatus = task.status;
      const taskSkill = expectedTaskSkill(task);
      if (status === "skipped" && NON_SKIPPABLE_SKILLS.has(taskSkill)) throw new Error(`mandatory task ${taskId} (${taskSkill}) cannot be skipped`);
      const byKey = new Map(current.tasks.map((item) => [recoverableId(item.id), item]));
      const blockersComplete = (task.blocked_by || []).every((id) => byKey.get(recoverableId(id))?.status === "completed");
      if (["in_progress", "completed"].includes(status) && !blockersComplete) throw new Error(`task ${taskId} cannot ${status === "completed" ? "complete" : "start"} before all blockers are completed`);
      if (status === "in_progress") {
        const active = current.tasks.find((item) => item.status === "in_progress" && item.id !== task.id);
        const runnable = active ? null : firstRunnablePendingTask(current);
        if (active || (previousStatus === "pending" && recoverableId(runnable?.id) !== recoverableId(task.id))) throw new Error(`task ${taskId} is not the single first runnable task`);
      }
      if (status === COMPLETED_STATUS && !["pending", "in_progress", "completed"].includes(previousStatus)) throw new Error(`illegal task transition ${previousStatus} -> completed`);
      if (status === COMPLETED_STATUS && previousStatus === "pending") {
        const active = current.tasks.find((item) => item.status === "in_progress"); const runnable = active ? null : firstRunnablePendingTask(current);
        if (active || recoverableId(runnable?.id) !== recoverableId(task.id)) throw new Error(`task ${taskId} is not the single first runnable task`);
      }
      task.status = status;
      if (status === COMPLETED_STATUS) {
        const expectedSkill = expectedTaskSkill(task);
        const hasMatchingReceipt = task.skill_receipt?.skill === expectedSkill;
        if (flags["skip-reason"] && (NON_SKIPPABLE_SKILLS.has(expectedSkill) || task.metadata?.skip_eligible !== true || !task.metadata?.skip_condition_id)) throw new Error(`task ${taskId} cannot use an unregistered skip reason`);
        if (expectedSkill && !hasMatchingReceipt) {
          throw new Error(`task ${taskId} cannot be completed without a matching load-skill receipt for ${expectedSkill}`);
        }
        assertRequiredProcesses(task);
        task.completed_at = flags["completed-at"] ??
          (previousStatus !== COMPLETED_STATUS || !task.completed_at ? new Date().toISOString() : task.completed_at);
        if (flags["skip-reason"]) task.skip_reason = flags["skip-reason"];
        else if (previousStatus !== COMPLETED_STATUS) delete task.skip_reason;
      } else {
        delete task.completed_at;
        delete task.skip_reason;
      }
      syncGraphStatus(current);
      validateGraph(current);
      return current;
    });
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
  console.log(`updated task ${taskId} in ${filePath}`);
  process.exit(0);
}

if (command === "record-process") {
  const [taskIdArg, processSkill, ...flagArgs] = rest; const taskId = Number(taskIdArg); const flags = parseFlags(flagArgs);
  if (!Number.isFinite(taskId) || !processSkill || !flags.evidence) die("record-process requires <task-id> <skill> --evidence <type>:<path> [--mode MODE]");
  const sep = flags.evidence.indexOf(":"); if (sep <= 0) die("--evidence must be formatted as <type>:<path>");
  const evidenceType = flags.evidence.slice(0, sep); const evidencePath = path.resolve(flags.evidence.slice(sep + 1));
  if (!fs.existsSync(evidencePath) || !fs.lstatSync(evidencePath).isFile()) die("record-process evidence must be an existing regular file");
  try {
    updateJsonAtomic(filePath, (current) => {
      validateGraph(current); const task = current.tasks.find((item) => item.id === taskId); if (!task) throw new Error(`task ${taskId} not found`);
      const required = (task.metadata?.required_process_steps || []).find((step) => step?.skill === processSkill && String(step?.mode || "") === String(flags.mode || ""));
      if (!required) throw new Error(`${processSkill}${flags.mode ? `/${flags.mode}` : ""} is not a required process for task ${taskId}`);
      task.process_receipts = (task.process_receipts || []).filter((row) => !(row.skill === processSkill && String(row.mode || "") === String(flags.mode || "")));
      task.process_receipts.push({ skill: processSkill, ...(flags.mode ? { mode: flags.mode } : {}), recorded_at: new Date().toISOString(), evidence: { type: evidenceType, path: relativizeUnderCwd(evidencePath), sha256: evidenceDigest(evidencePath) } });
      syncGraphStatus(current); validateGraph(current); return current;
    });
  } catch (error) { die(`${filePath}: ${error.message}`); }
  console.log(`recorded ${processSkill} process receipt for task ${taskId} in ${filePath}`); process.exit(0);
}

if (command === "load-skill") {
  const [taskIdArg, skillName, ...flagArgs] = rest;
  if (!taskIdArg || !skillName) {
    die("load-skill requires <task-id> <skill-name>");
  }
  const taskId = Number(taskIdArg);
  if (!Number.isFinite(taskId)) {
    die(`invalid task id: ${taskIdArg}`);
  }
  const flags = parseFlags(flagArgs);
  try {
    updateJsonAtomic(filePath, (current) => {
      validateGraph(current);
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`task ${taskId} not found`);
      const expectedSkill = expectedTaskSkill(task);
      if (expectedSkill && skillName !== expectedSkill) {
        throw new Error(`task ${taskId} expects skill ${expectedSkill}, received ${skillName}`);
      }
      task.skill_receipt = {
        skill: skillName,
        loaded_at: flags["loaded-at"] ?? new Date().toISOString(),
        loaded_via: flags.via ?? "manual",
      };
      syncGraphStatus(current);
      validateGraph(current);
      return current;
    });
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
  console.log(`recorded skill receipt for task ${taskId} in ${filePath}`);
  process.exit(0);
}

if (command === "activate-skill") {
  // WI-498: the ATOMIC first-skill activation. Records the skill_receipt AND
  // flips the task pending -> in_progress in ONE locked read-modify-write, so the
  // Codex enforcer's `active.ok` becomes true and governed mutations are then
  // authorized. Additive + Codex-only caller (scripts/codex-load-skill.mjs); the
  // existing load-skill / set-status commands are untouched, so the Claude host is
  // unaffected. Fails CLOSED (no write) for any task that is neither the exact
  // first-runnable-pending task nor an already-in_progress reload of itself.
  const [taskIdArg, skillName, ...flagArgs] = rest;
  if (!taskIdArg || !skillName) {
    die("activate-skill requires <task-id> <skill-name>");
  }
  const wantKey = recoverableId(taskIdArg);
  if (wantKey === null) {
    die(`invalid task id: ${taskIdArg}`);
  }
  const flags = parseFlags(flagArgs);
  let outcome = "";
  try {
    updateJsonAtomic(filePath, (current) => {
    // Re-validate the CURRENT (freshly-read, lock-held) graph — never the stale
    // top-level `graph`. This is what removes the TOCTOU window.
    validateGraph(current);
    const target = (current.tasks || []).find(
      (item) => recoverableId(item.id) !== null && recoverableId(item.id) === wantKey
    );
    if (!target) {
      throw new Error(`task ${taskIdArg} not found`);
    }
    const expectedSkill = expectedTaskSkill(target);
    if (expectedSkill && skillName !== expectedSkill) {
      throw new Error(`task ${taskIdArg} expects skill ${expectedSkill}, received ${skillName}`);
    }
    const anyInProgress = (current.tasks || []).some((t) => t.status === "in_progress");
    const runnable = anyInProgress ? null : firstRunnablePendingTask(current);
    const isFreshActivation =
      !anyInProgress && runnable !== null && recoverableId(runnable.id) === wantKey && target.status === "pending";
    const isReload = target.status === "in_progress";
    if (!isFreshActivation && !isReload) {
      // Fail CLOSED: not the first runnable pending task, not an in_progress reload.
      throw new Error(
        `task ${taskIdArg} (status=${target.status}) is not the first runnable pending task and is not already in_progress; refusing to activate`
      );
    }
    if (isReload) {
      if (target.skill_receipt && target.skill_receipt.skill === skillName) {
        // Idempotent reload: byte-stable, NO graph write (decision made under lock).
        outcome = "noop";
        return NO_WRITE;
      }
      // in_progress but missing/mismatched receipt (partial-failure recovery):
      // restore the receipt only; status already in_progress.
      target.skill_receipt = {
        skill: skillName,
        loaded_at: flags["loaded-at"] ?? new Date().toISOString(),
        loaded_via: flags.via ?? "activate-skill",
      };
      outcome = "receipt-restored";
    } else {
      // Fresh activation: receipt + status in ONE write.
      target.skill_receipt = {
        skill: skillName,
        loaded_at: flags["loaded-at"] ?? new Date().toISOString(),
        loaded_via: flags.via ?? "activate-skill",
      };
      target.status = "in_progress";
      outcome = "activated";
    }
    syncGraphStatus(current);
    validateGraph(current);
    return current;
  });
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
  console.log(`activate-skill ${outcome} for task ${taskIdArg} in ${filePath}`);
  process.exit(0);
}

if (command === "record-phase") {
  const [taskIdArg, phaseId, ...flagArgs] = rest;
  if (!taskIdArg || !phaseId) {
    die("record-phase requires <task-id> <phase-id> --evidence <type>:<path>");
  }
  if (!/^P[0-9]+(\.[0-9]+)?-[A-Za-z][A-Za-z0-9-]*$/.test(phaseId)) {
    die(`invalid phase id: ${phaseId}`);
  }
  const taskId = Number(taskIdArg);
  if (!Number.isFinite(taskId)) {
    die(`invalid task id: ${taskIdArg}`);
  }
  const flags = parseFlags(flagArgs);
  if (!flags.evidence) {
    die("record-phase requires --evidence <type>:<path>");
  }
  const evidenceSep = flags.evidence.indexOf(":");
  if (evidenceSep <= 0 || evidenceSep === flags.evidence.length - 1) {
    die("--evidence must be formatted as <type>:<path>");
  }
  const evidenceType = flags.evidence.slice(0, evidenceSep);
  const evidencePath = flags.evidence.slice(evidenceSep + 1);
  if (!["file", "command_output", "screenshot", "live_dom"].includes(evidenceType)) {
    die(`invalid evidence type: ${evidenceType}`);
  }
  try {
    updateJsonAtomic(filePath, (current) => {
      validateGraph(current);
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`task ${taskId} not found`);
      if (!task.skill_receipt || typeof task.skill_receipt !== "object") {
        throw new Error(`task ${taskId} must have a skill_receipt before recording phases`);
      }
      if (!Array.isArray(task.skill_receipt.phases_executed)) task.skill_receipt.phases_executed = [];
      task.skill_receipt.phases_executed.push({
        id: phaseId,
        ts: flags.ts ?? new Date().toISOString(),
        evidence_artifacts: [{ type: evidenceType, path: relativizeUnderCwd(evidencePath) }],
      });
      syncGraphStatus(current);
      validateGraph(current);
      return current;
    });
  } catch (error) {
    die(`${filePath}: ${error.message}`);
  }
  console.log(`recorded phase ${phaseId} for task ${taskId} in ${filePath}`);
  process.exit(0);
}

die(`Unknown command: ${command}`);
