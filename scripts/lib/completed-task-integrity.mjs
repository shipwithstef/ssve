import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { externalizedLegacyGraphAuthority } from "./history-epoch.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

export const CLASSIFICATIONS = Object.freeze({
  EXECUTED: "executed",
  AUTHORIZED_SKIP: "authorized-skip",
  LEGACY_COMPATIBLE: "legacy-compatible",
  INVALID: "invalid",
});

export const PHASE_ENFORCE_AFTER = "2026-05-10T16:00:00Z";
export const PHASE_ENFORCEMENT_ANCHOR = "060e3278afb26117034c4ed529a0e03da3869c32";

export const REASON_CODES = Object.freeze([
  "not-completed",
  "missing-task-skill",
  "task-skill-conflict",
  "missing-skill-receipt",
  "receipt-skill-mismatch",
  "invalid-loaded-at",
  "invalid-loaded-via",
  "legacy-backfill-not-execution",
  "invalid-skip-reason",
  "missing-phases",
  "malformed-phases",
  "invalid-phase-id",
  "invalid-phase-timestamp",
  "empty-phase-evidence",
  "invalid-evidence-type",
  "unsafe-evidence-path",
  "skip-authorization-missing",
  "skip-authorization-ambiguous",
  "skip-condition-unregistered",
  "skip-condition-wrong-skill",
  "skip-condition-inapplicable",
  "skip-justification-missing",
  "skip-reason-mismatch",
  "unsupported-legacy-receipt",
]);

const REASON_CODE_SET = new Set(REASON_CODES);
const PHASE_ID_RE = /^P[0-9]+(?:\.[0-9]+)?-[A-Za-z][A-Za-z0-9-]*$/;
const EVIDENCE_TYPES = new Set(["file", "command_output", "screenshot", "live_dom"]);
const TEMP_EVIDENCE_TYPES = new Set(["file", "command_output"]);

function reason(code, message, evidencePath) {
  if (!REASON_CODE_SET.has(code)) throw new Error(`unknown reason code: ${code}`);
  return {
    code,
    message,
    ...(evidencePath ? { path: evidencePath } : {}),
  };
}

function taskSkill(task) {
  const metadataSkill = task?.metadata?.skill;
  if (typeof metadataSkill === "string" && metadataSkill.trim()) return metadataSkill.trim();
  const directSkill = task?.skill;
  return typeof directSkill === "string" && directSkill.trim() ? directSkill.trim() : null;
}

function taskSkillConflict(task) {
  const metadataSkill = typeof task?.metadata?.skill === "string" ? task.metadata.skill.trim() : "";
  const directSkill = typeof task?.skill === "string" ? task.skill.trim() : "";
  return metadataSkill && directSkill && metadataSkill !== directSkill;
}

function validTimestamp(value) {
  if (typeof value !== "string") return false;
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/,
  );
  if (!match) return false;
  const [, year, month, day, hour, minute, second, , zone] = match;
  const numbers = [year, month, day, hour, minute, second].map(Number);
  const [yearNumber, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber] = numbers;
  if (monthNumber < 1 || monthNumber > 12
    || dayNumber < 1
    || dayNumber > new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate()
    || hourNumber > 23
    || minuteNumber > 59
    || secondNumber > 59) {
    return false;
  }
  if (zone !== "Z") {
    const [offsetHour, offsetMinute] = zone.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function normalizedReason(value) {
  return value.trim().toLowerCase().replace(/\s+/g, " ").replace(/[.!?]+$/g, "");
}

function containedRelativePath(value) {
  if (typeof value !== "string" || !value.trim() || /[\x00-\x1F\x7F]/.test(value)) return false;
  const portable = value.replaceAll("\\", "/");
  if (path.posix.isAbsolute(portable) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(portable)) return false;
  const normalized = path.posix.normalize(portable);
  return normalized !== "."
    && normalized !== ".."
    && !normalized.startsWith("../");
}

function containedTemporaryPath(value) {
  if (typeof value !== "string" || !value.trim() || /[\x00-\x1F\x7F]/.test(value) || !path.isAbsolute(value)) {
    return false;
  }
  const normalized = path.normalize(value);
  const temporaryRoots = new Set([
    path.resolve(os.tmpdir()),
    ...(process.platform === "win32" ? [] : ["/tmp", "/var/tmp"]),
  ]);
  return [...temporaryRoots].some((temporaryRoot) => {
    const relative = path.relative(temporaryRoot, normalized);
    return Boolean(relative)
      && relative !== ".."
      && !relative.startsWith(`..${path.sep}`)
      && !path.isAbsolute(relative);
  });
}

function gitAuthority(repoRoot, args, options = {}) {
  const {
    GIT_DIR: _gitDir,
    GIT_WORK_TREE: _gitWorkTree,
    GIT_COMMON_DIR: _gitCommonDir,
    GIT_OBJECT_DIRECTORY: _gitObjectDirectory,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: _gitAlternateObjectDirectories,
    GIT_INDEX_FILE: _gitIndexFile,
    GIT_NAMESPACE: _gitNamespace,
    GIT_REPLACE_REF_BASE: _gitReplaceRefBase,
    ...inheritedEnv
  } = process.env;
  const sanitizedEnv = Object.fromEntries(
    Object.entries(inheritedEnv).filter(([key]) => !key.startsWith("GIT_CONFIG_")),
  );
  return execFileSync("git", ["--no-replace-objects", "-C", repoRoot, ...args], {
    ...options,
    env: {
      ...sanitizedEnv,
      GIT_CONFIG_GLOBAL: os.devNull,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_NO_REPLACE_OBJECTS: "1",
    },
  });
}

function validEvidenceReference(artifact) {
  if (!artifact || typeof artifact !== "object" || Array.isArray(artifact)) return false;
  if (!EVIDENCE_TYPES.has(artifact.type)) return false;
  if (path.isAbsolute(String(artifact.path ?? ""))) {
    return TEMP_EVIDENCE_TYPES.has(artifact.type) && containedTemporaryPath(artifact.path);
  }
  return containedRelativePath(artifact.path);
}

function resolveSkipCondition(registry, skill, conditionId) {
  const skillEntry = registry?.skills?.[skill];
  const graphEntry = registry?.graph_level_skip_conditions?.[conditionId];

  if (conditionId === `${skill}:registry-skip`) {
    if (!skillEntry) return { ok: false, code: "skip-condition-unregistered" };
    const applicable = typeof skillEntry.skip_when === "string"
      && skillEntry.skip_when.trim()
      && Array.isArray(skillEntry.signals)
      && skillEntry.signals.some((entry) => typeof entry === "string" && entry.trim());
    return applicable
      ? { ok: true }
      : { ok: false, code: "skip-condition-inapplicable" };
  }

  if (skillEntry && skillEntry.skip_condition_id === conditionId) {
    const applicable = typeof skillEntry.skip_when === "string"
      && skillEntry.skip_when.trim()
      && Array.isArray(skillEntry.signals)
      && skillEntry.signals.some((entry) => typeof entry === "string" && entry.trim());
    return applicable
      ? { ok: true }
      : { ok: false, code: "skip-condition-inapplicable" };
  }

  if (graphEntry) {
    if (graphEntry.id !== conditionId) return { ok: false, code: "skip-condition-unregistered" };
    if (graphEntry.skill !== skill) return { ok: false, code: "skip-condition-wrong-skill" };
    const applicable = typeof graphEntry.applies_when === "string"
      && graphEntry.applies_when.trim()
      && typeof graphEntry.required_evidence === "string"
      && graphEntry.required_evidence.trim();
    return applicable
      ? { ok: true }
      : { ok: false, code: "skip-condition-inapplicable" };
  }

  for (const [registeredSkill, entry] of Object.entries(registry?.skills ?? {})) {
    if (entry?.skip_condition_id === conditionId || `${registeredSkill}:registry-skip` === conditionId) {
      return { ok: false, code: "skip-condition-wrong-skill" };
    }
  }
  return { ok: false, code: "skip-condition-unregistered" };
}

function validateCommonReceipt(task, skill) {
  const issues = [];
  const receipt = task?.skill_receipt;
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    issues.push(reason("missing-skill-receipt", "completed task has no structured skill_receipt"));
    return { issues, receipt: null };
  }
  if (receipt.skill !== skill) {
    issues.push(reason("receipt-skill-mismatch", `receipt skill '${receipt.skill ?? ""}' does not match '${skill}'`));
  }
  if (!validTimestamp(receipt.loaded_at)) {
    issues.push(reason("invalid-loaded-at", "skill_receipt.loaded_at must be an ISO-8601 timestamp"));
  }
  if (typeof receipt.loaded_via !== "string" || !receipt.loaded_via.trim()) {
    issues.push(reason("invalid-loaded-via", "skill_receipt.loaded_via must be non-empty"));
  }
  if (receipt.loaded_via === "legacy-backfill") {
    issues.push(reason("legacy-backfill-not-execution", "legacy-backfill is not execution evidence"));
  }
  return { issues, receipt };
}

function hasLegacySummaryEvidence(receipt) {
  return [receipt?.output_artifact, receipt?.validation_output]
    .some((value) => typeof value === "string" && value.trim());
}

function validateCurrentPhases({ receiptState }) {
  const issues = [...receiptState.issues];
  const phases = receiptState.receipt?.phases_executed;
  if (!Object.prototype.hasOwnProperty.call(receiptState.receipt ?? {}, "phases_executed")) {
    issues.push(reason("missing-phases", "current completed task is missing phases_executed"));
    return issues;
  }
  if (!Array.isArray(phases)) {
    issues.push(reason("malformed-phases", "phases_executed must be an array"));
    return issues;
  }
  if (phases.length === 0) {
    issues.push(reason("missing-phases", "phases_executed must not be empty"));
    return issues;
  }

  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index];
    const evidencePath = `skill_receipt.phases_executed[${index}]`;
    if (!phase || typeof phase !== "object" || Array.isArray(phase)) {
      issues.push(reason("malformed-phases", "phase entry must be an object", evidencePath));
      continue;
    }
    if (typeof phase.id !== "string" || !PHASE_ID_RE.test(phase.id)) {
      issues.push(reason("invalid-phase-id", `invalid phase id '${phase.id ?? ""}'`, evidencePath));
    }
    if (!validTimestamp(phase.ts)) {
      issues.push(reason("invalid-phase-timestamp", "phase ts must be ISO-8601", evidencePath));
    }
    if (!Array.isArray(phase.evidence_artifacts) || phase.evidence_artifacts.length === 0) {
      issues.push(reason("empty-phase-evidence", `phase '${phase.id ?? index}' has no evidence artifacts`, evidencePath));
      continue;
    }
    for (let artifactIndex = 0; artifactIndex < phase.evidence_artifacts.length; artifactIndex += 1) {
      const artifact = phase.evidence_artifacts[artifactIndex];
      const artifactPath = `${evidencePath}.evidence_artifacts[${artifactIndex}]`;
      if (!artifact || !EVIDENCE_TYPES.has(artifact.type)) {
        issues.push(reason("invalid-evidence-type", `invalid evidence type '${artifact?.type ?? ""}'`, artifactPath));
      } else if (!validEvidenceReference(artifact)) {
        issues.push(reason("unsafe-evidence-path", `unsafe evidence path '${artifact.path ?? ""}'`, artifactPath));
      }
    }
  }
  return issues;
}

export function resolveLegacyAuthority({
  graphPath,
  repoRoot,
}) {
  const absoluteGraph = path.resolve(graphPath);
  const absoluteRoot = path.resolve(repoRoot);
  const relative = path.relative(absoluteRoot, absoluteGraph);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return { eligible: false, source: "outside-repository", firstAddedAt: null };
  }
  const externalized = externalizedLegacyGraphAuthority(
    absoluteRoot,
    relative,
    fs.readFileSync(absoluteGraph),
  );
  if (externalized) return externalized;
  try {
    gitAuthority(absoluteRoot, ["cat-file", "-e", `${PHASE_ENFORCEMENT_ANCHOR}^{commit}`], {
      stdio: "ignore",
    });
    gitAuthority(absoluteRoot, [
      "merge-base", "--is-ancestor", PHASE_ENFORCEMENT_ANCHOR, "HEAD",
    ], { stdio: "ignore" });
    gitAuthority(absoluteRoot, ["ls-files", "--error-unmatch", "--", relative], {
      stdio: "ignore",
    });
    const output = gitAuthority(absoluteRoot, [
      "log", "--follow", "--diff-filter=A", "--format=%H%x00%cI", "--", relative,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const additions = output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    const [firstAddedCommit = null, firstAddedAt = null] = (additions.at(-1) ?? "").split("\0");
    gitAuthority(absoluteRoot, [
      "merge-base", "--is-ancestor", firstAddedCommit, PHASE_ENFORCEMENT_ANCHOR,
    ], { stdio: "ignore" });
    const snapshotCommit = gitAuthority(absoluteRoot, [
      "log", "-1", "--format=%H", PHASE_ENFORCEMENT_ANCHOR, "--", relative,
    ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    let snapshotTasks = [];
    if (snapshotCommit) {
      const snapshot = JSON.parse(gitAuthority(absoluteRoot, [
        "show", `${snapshotCommit}:${relative}`,
      ], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
      snapshotTasks = Array.isArray(snapshot?.tasks) ? snapshot.tasks : [];
    }
    return {
      eligible: Boolean(firstAddedCommit && snapshotCommit),
      source: snapshotCommit
        ? "git-enforcement-anchor-snapshot"
        : (firstAddedCommit ? "git-snapshot-missing" : "git-addition-missing"),
      firstAddedAt,
      firstAddedCommit,
      enforcementAnchor: PHASE_ENFORCEMENT_ANCHOR,
      snapshotCommit: snapshotCommit || null,
      snapshotTasks,
    };
  } catch {
    return {
      eligible: false,
      source: "untracked-unanchored-or-unresolvable",
      firstAddedAt: null,
      firstAddedCommit: null,
      enforcementAnchor: PHASE_ENFORCEMENT_ANCHOR,
    };
  }
}

function classifyCompletedTaskInternal({
  graph,
  task,
  registry,
  legacyAuthority = { eligible: false },
}) {
  const skill = taskSkill(task);
  const result = {
    task_id: task?.id ?? null,
    skill,
    classification: CLASSIFICATIONS.INVALID,
    ok: false,
    reasons: [],
  };
  if (task?.status !== "completed") {
    result.reasons.push(reason("not-completed", `task status is '${task?.status ?? ""}'`));
    return result;
  }
  if (taskSkillConflict(task)) {
    result.reasons.push(reason("task-skill-conflict", "metadata.skill and skill name different canonical skills"));
    return result;
  }
  if (!skill) {
    result.reasons.push(reason("missing-task-skill", "completed task has no canonical skill"));
    return result;
  }

  const receiptState = validateCommonReceipt(task, skill);
  const deliverySkips = Array.isArray(graph?.delivery_graph?.skipped_skills)
    ? graph.delivery_graph.skipped_skills.filter((entry) => entry?.skill === skill)
    : [];
  const hasSkipReason = Object.prototype.hasOwnProperty.call(task, "skip_reason");
  const invalidSkipReason = hasSkipReason && typeof task.skip_reason !== "string";
  const taskSkipReason = typeof task.skip_reason === "string" ? task.skip_reason.trim() : "";
  const skipIntent = hasSkipReason || deliverySkips.length > 0;

  if (skipIntent) {
    const issues = [...receiptState.issues];
    if (invalidSkipReason) {
      issues.push(reason("invalid-skip-reason", "task.skip_reason must be a string when present"));
    }
    if (!taskSkipReason) issues.push(reason("skip-justification-missing", "authorized skip requires task.skip_reason"));
    if (deliverySkips.length === 0) {
      issues.push(reason("skip-authorization-missing", "skip intent has no delivery-graph authorization"));
    } else if (deliverySkips.length > 1) {
      issues.push(reason("skip-authorization-ambiguous", "multiple delivery skips name the task skill"));
    } else {
      const entry = deliverySkips[0];
      if (typeof entry.reason !== "string" || !entry.reason.trim()
        || typeof entry.evidence !== "string" || !entry.evidence.trim()) {
        issues.push(reason("skip-justification-missing", "delivery skip requires non-empty reason and evidence"));
      } else if (taskSkipReason && normalizedReason(taskSkipReason) !== normalizedReason(entry.reason)) {
        issues.push(reason("skip-reason-mismatch", "task and delivery skip reasons must match"));
      }
      const condition = resolveSkipCondition(registry, skill, entry.skip_condition_id);
      if (!condition.ok) {
        issues.push(reason(condition.code, `skip condition '${entry.skip_condition_id ?? ""}' is not applicable to '${skill}'`));
      }
    }
    issues.push(...validateCurrentPhases({ receiptState: { ...receiptState, issues: [] } }));
    result.reasons = issues;
    if (issues.length === 0) {
      result.classification = CLASSIFICATIONS.AUTHORIZED_SKIP;
      result.ok = true;
    }
    return result;
  }

  if (receiptState.receipt && Object.prototype.hasOwnProperty.call(receiptState.receipt, "phases_executed")) {
    const issues = validateCurrentPhases({ receiptState });
    result.reasons = issues;
    if (issues.length === 0) {
      result.classification = CLASSIFICATIONS.EXECUTED;
      result.ok = true;
    }
    return result;
  }

  if (legacyAuthority?.eligible && receiptState.issues.length === 0) {
    result.classification = CLASSIFICATIONS.LEGACY_COMPATIBLE;
    result.ok = true;
    return result;
  }

  result.reasons = [...receiptState.issues];
  if (result.reasons.length === 0) {
    result.reasons.push(reason("unsupported-legacy-receipt", "phase-free receipt lacks Git-proven pre-enforcement authority"));
  }
  return result;
}

export function classifyCompletedTask({ graph, task, registry }) {
  return classifyCompletedTaskInternal({ graph, task, registry });
}

// OPT-11: isDeepStrictEqual walks the live object graph on every call; a
// sha256 over a recursively key-sorted canonical serialization is
// collision-free in practice and cheaper to compare (string equality) for the
// two equality checks below. Keys are sorted at EVERY depth so key-order
// differences (e.g. re-serialized JSON) never cause a false mismatch; arrays
// keep their original order since element order is semantically meaningful.
function canonicalJson(value) {
  // undefined must hash differently from null (isDeepStrictEqual(undefined,
  // null) is false, and a present-but-undefined skill_receipt is a real
  // distinction here) — the sentinel below is not producible by JSON.stringify.
  if (value === undefined) return "~undefined~";
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function canonicalEqual(a, b) {
  const hash = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");
  return hash(a) === hash(b);
}

export function classifyGraphCompletedTasks({
  graph,
  graphPath,
  registry,
  repoRoot,
  registeredSkillsOnly = false,
  structuredOrSkipOnly = false,
  phaseFreeCompatibility = "strict",
  taskIds = [],
}) {
  if (!["strict", "loaded", "summary"].includes(phaseFreeCompatibility)) {
    const error = new Error(`invalid phase-free compatibility scope: ${phaseFreeCompatibility}`);
    error.code = "INVALID_SCOPE";
    throw error;
  }
  const requested = new Set(taskIds.map(String));
  const knownIds = new Set((graph?.tasks ?? []).map((task) => String(task.id)));
  const missingRequested = [...requested].filter((id) => !knownIds.has(id));
  if (missingRequested.length > 0) {
    const error = new Error(`requested task id not found: ${missingRequested.join(", ")}`);
    error.code = "TASK_NOT_FOUND";
    throw error;
  }

  const registeredSkills = new Set([
    ...Object.keys(registry?.skills ?? {}),
    ...Object.values(registry?.graph_level_skip_conditions ?? {})
      .map((entry) => entry?.skill)
      .filter(Boolean),
  ]);
  const hasRegisteredCandidate = (task) => {
    const metadataSkill = task?.metadata?.skill;
    const directSkill = task?.skill;
    const receiptSkill = task?.skill_receipt?.skill;
    return [metadataSkill, directSkill, receiptSkill]
      .some((value) => typeof value === "string" && registeredSkills.has(value.trim()));
  };
  const hasStructuredOrSkipSurface = (task) => {
    const skill = taskSkill(task);
    const receiptState = skill
      ? validateCommonReceipt(task, skill)
      : { issues: [reason("missing-task-skill", "completed task has no canonical skill")], receipt: null };
    const hasTaskSkip = Object.prototype.hasOwnProperty.call(task ?? {}, "skip_reason");
    const skillCandidates = new Set([
      task?.metadata?.skill,
      task?.skill,
    ].filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()));
    const hasDeliverySkip = Array.isArray(graph?.delivery_graph?.skipped_skills)
      && graph.delivery_graph.skipped_skills.some((entry) => skillCandidates.has(entry?.skill));
    const hasPhases = Object.prototype.hasOwnProperty.call(
      receiptState.receipt ?? {},
      "phases_executed",
    );
    const strictSurface = hasTaskSkip
      || hasDeliverySkip
      || hasPhases
      || taskSkillConflict(task)
      || receiptState.issues.length > 0;
    if (strictSurface) return true;
    if (phaseFreeCompatibility === "loaded") return false;
    if (phaseFreeCompatibility === "summary") {
      return !hasLegacySummaryEvidence(receiptState.receipt);
    }
    return true;
  };
  if (requested.size > 0 && registeredSkillsOnly) {
    const filteredRequested = (graph?.tasks ?? [])
      .filter((task) => requested.has(String(task.id)) && !hasRegisteredCandidate(task))
      .map((task) => String(task.id));
    if (filteredRequested.length > 0) {
      const error = new Error(`requested task is outside the registered-skills filter: ${filteredRequested.join(", ")}`);
      error.code = "TASK_FILTERED";
      throw error;
    }
  }
  if (requested.size > 0 && structuredOrSkipOnly) {
    const filteredRequested = (graph?.tasks ?? [])
      .filter((task) => requested.has(String(task.id)) && !hasStructuredOrSkipSurface(task))
      .map((task) => String(task.id));
    if (filteredRequested.length > 0) {
      const error = new Error(`requested task is outside the structured-or-skip filter: ${filteredRequested.join(", ")}`);
      error.code = "TASK_FILTERED";
      throw error;
    }
  }
  const tasks = (graph?.tasks ?? []).filter((task) => {
    if (requested.size > 0 && !requested.has(String(task.id))) return false;
    if (requested.size === 0 && task.status !== "completed") return false;
    if (registeredSkillsOnly && !hasRegisteredCandidate(task)) return false;
    if (structuredOrSkipOnly && !hasStructuredOrSkipSurface(task)) return false;
    return true;
  });
  const needsLegacyAuthority = tasks.some((task) => {
    const skill = taskSkill(task);
    const hasTaskSkip = Object.prototype.hasOwnProperty.call(task ?? {}, "skip_reason");
    const hasDeliverySkip = Array.isArray(graph?.delivery_graph?.skipped_skills)
      && graph.delivery_graph.skipped_skills.some((entry) => entry?.skill === skill);
    const hasPhases = Object.prototype.hasOwnProperty.call(
      task?.skill_receipt ?? {},
      "phases_executed",
    );
    return !hasTaskSkip && !hasDeliverySkip && !hasPhases;
  });
  let graphMatchesPath = false;
  if (needsLegacyAuthority) {
    try {
      graphMatchesPath = canonicalEqual(
        graph,
        JSON.parse(fs.readFileSync(path.resolve(graphPath), "utf8")),
      );
    } catch {
      graphMatchesPath = false;
    }
  }
  const legacyAuthority = needsLegacyAuthority && graphMatchesPath
    ? resolveLegacyAuthority({ graphPath, repoRoot })
    : {
      eligible: false,
      source: needsLegacyAuthority ? "graph-path-mismatch" : "not-required",
      firstAddedAt: null,
    };
  const results = tasks.map((task) => {
    const historicalTask = legacyAuthority.snapshotTasks?.find(
      (candidate) => candidate?.id === task?.id,
    );
    const legacyTaskAuthority = {
      eligible: Boolean(
        legacyAuthority.eligible
        && historicalTask?.status === "completed"
        && taskSkill(historicalTask) === taskSkill(task)
        && canonicalEqual(historicalTask?.skill_receipt, task?.skill_receipt),
      ),
    };
    return classifyCompletedTaskInternal({
      graph,
      task,
      registry,
      legacyAuthority: legacyTaskAuthority,
    });
  });
  return {
    ok: results.every((entry) => entry.ok),
    graph: typeof graph?.wi === "string" ? graph.wi : null,
    checked: results.length,
    results,
  };
}
