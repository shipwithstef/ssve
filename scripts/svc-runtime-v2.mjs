#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./lib/json-schema-validator.mjs";
import { sameGenerationBindings, validateGenerationBindings } from "./lib/generation-bindings-v2.mjs";
import { compileCanonicalLayerInventory } from "./svc-layer-inventory-v2.mjs";
import { compileProductImprovementProtocol, evaluateProductionObligationCensus } from "./svc-product-improvement-protocol-v2.mjs";
import { compileProductProofGraph } from "./svc-product-proof-compiler-v2.mjs";
import { compileExecutionGraph, planExecutionWaves } from "./svc-execution-controller-v2.mjs";
import { createConsumptionLedger } from "./lib/runtime-evidence-consumption-v2.mjs";
import { executeReleaseEffect, runRuntimeToFreeze } from "./lib/runtime-engine-v2.mjs";
import { BUILT_IN_EFFECT_KINDS } from "./lib/runtime-effects-v2.mjs";
import { TASK_EVENT_TYPES, transitionTaskState } from "./lib/runtime-state-model-v2.mjs";

const EVENT_SCHEMA = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../schemas/runtime-journal-event-v2.schema.json", import.meta.url)), "utf8"));
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^[a-f0-9]{40}$/;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : stable(value)).digest("hex");
}

function canonicalTime(value = new Date().toISOString()) {
  if (!ISO_TIMESTAMP.test(value) || new Date(value).toISOString() !== value) throw new Error(`non-canonical timestamp ${value}`);
  return value;
}

function safeId(value, label) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(value ?? "")) throw new Error(`${label} is invalid`);
  return value;
}

function readJson(file, label) {
  if (!file) throw new Error(`${label} path is required`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runPaths(stateRoot, runId) {
  const root = path.resolve(stateRoot);
  const runDir = path.join(root, "runs", safeId(runId, "run_id"));
  return {
    root, runDir, manifest: path.join(runDir, "manifest.json"), journal: path.join(runDir, "journal.jsonl"),
    journalLock: path.join(runDir, ".journal.lock"), projections: path.join(runDir, "projections"),
    leases: path.join(runDir, "leases.json"), ledger: path.join(runDir, "consumption-ledger.json"),
    evidenceStore: path.join(runDir, "evidence"), effectReceipts: path.join(runDir, "effects")
  };
}

function atomicWrite(file, bytes, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, bytes, { flag: "wx", mode });
    fs.renameSync(temporary, file);
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function processStartToken(pid) {
  try {
    const fields = fs.readFileSync(`/proc/${pid}/stat`, "utf8").trim().split(" ");
    return fields[21] ?? null;
  } catch { return null; }
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

function clearAbandonedJournalLock(lockDir) {
  const ownerFile = path.join(lockDir, "owner.json");
  let owner = null;
  try { owner = JSON.parse(fs.readFileSync(ownerFile, "utf8")); } catch {}
  let reclaim = false;
  if (owner?.pid) {
    reclaim = !processAlive(owner.pid);
    if (!reclaim && owner.process_start_token) reclaim = processStartToken(owner.pid) !== owner.process_start_token;
  } else {
    try { reclaim = Date.now() - fs.statSync(lockDir).mtimeMs > 5000; } catch { return false; }
  }
  if (!reclaim) return false;
  const tombstone = `${lockDir}.stale-${crypto.randomUUID()}`;
  try {
    fs.renameSync(lockDir, tombstone);
    fs.rmSync(tombstone, { recursive: true, force: true });
    return true;
  } catch { return false; }
}

function withJournalLock(paths, action) {
  const deadline = Date.now() + 5000;
  const owner = { pid: process.pid, process_start_token: processStartToken(process.pid), owner_token: crypto.randomUUID(), created_at: new Date().toISOString() };
  while (true) {
    try {
      fs.mkdirSync(paths.journalLock, { mode: 0o700 });
      fs.writeFileSync(path.join(paths.journalLock, "owner.json"), `${JSON.stringify(owner)}\n`, { flag: "wx", mode: 0o600 });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (clearAbandonedJournalLock(paths.journalLock)) continue;
      if (Date.now() >= deadline) throw new Error("journal lock busy");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return action(); }
  finally {
    let current = null;
    try { current = JSON.parse(fs.readFileSync(path.join(paths.journalLock, "owner.json"), "utf8")); } catch {}
    if (current?.owner_token === owner.owner_token) {
      try { fs.unlinkSync(path.join(paths.journalLock, "owner.json")); } catch (error) { if (error.code !== "ENOENT") throw error; }
      fs.rmdirSync(paths.journalLock);
    }
  }
}

function eventDigest(event) {
  const payload = { ...event };
  delete payload.event_digest;
  return digest(payload);
}

export function readRuntimeJournal(journalPath) {
  if (!fs.existsSync(journalPath)) return [];
  const bytes = fs.readFileSync(journalPath, "utf8");
  if (!bytes) return [];
  if (!bytes.endsWith("\n")) throw new Error("journal has a torn final record");
  return bytes.trimEnd().split("\n").map((line, index) => {
    try { return JSON.parse(line); } catch { throw new Error(`journal line ${index + 1} is invalid JSON`); }
  });
}

export function replayRuntimeJournal(events, expected = {}) {
  const errors = [];
  if (!Array.isArray(events)) return { valid: false, errors: ["events must be an array"] };
  const state = {
    run_id: expected.run_id ?? null, status: "NEW", generation_bindings: expected.generation_bindings ?? null,
    event_count: 0, last_event_digest: null, tasks: {}, evidence: {}, consumers: {},
    candidate_digest: null, final_review: null, final_sha: null, rollback_ready: false, release: null, live_verification: null,
    observation: null, observed_delta: null, next_decision: null, blocker: null,
    simulation_only: false, production_proven: false
  };
  const idempotency = new Map();
  for (const [index, event] of events.entries()) {
    errors.push(...validate(EVENT_SCHEMA, event).errors.map((error) => `events[${index}] ${error}`));
    if (event.sequence !== index + 1) errors.push(`events[${index}] sequence mismatch`);
    const previous = index === 0 ? null : events[index - 1].event_digest;
    if (event.previous_event_digest !== previous) errors.push(`events[${index}] previous digest mismatch`);
    if (eventDigest(event) !== event.event_digest) errors.push(`events[${index}] digest mismatch`);
    if (index === 0 && event.type !== "RUN_COMPILED") errors.push("first runtime event must be RUN_COMPILED");
    if (state.run_id && event.run_id !== state.run_id) errors.push(`events[${index}] run_id changed`);
    if (!state.run_id) state.run_id = event.run_id;
    if (state.generation_bindings && !sameGenerationBindings(event.generation_bindings, state.generation_bindings)) errors.push(`events[${index}] generation bindings changed`);
    if (!state.generation_bindings) state.generation_bindings = event.generation_bindings;
    errors.push(...validateGenerationBindings(event.generation_bindings, `events[${index}].generation_bindings`));
    const prior = idempotency.get(event.idempotency_key);
    if (prior && prior !== event.event_digest) errors.push(`events[${index}] idempotency key reused with different event`);
    idempotency.set(event.idempotency_key, event.event_digest);
    if (errors.length) continue;

    const requireState = (...allowed) => {
      if (allowed.includes(state.status)) return true;
      errors.push(`illegal ${event.type} from ${state.status}; expected ${allowed.join("|")}`);
      return false;
    };
    if (event.type === "RUN_COMPILED") { if (requireState("NEW")) state.status = "COMPILED"; }
    else if (event.type === "RUN_STARTED") { if (requireState("COMPILED")) state.status = "RUNNING"; }
    else if (event.type === "RUN_RESUMED") { if (requireState("COMPILED", "RUNNING", "STOPPED")) state.status = "RUNNING"; }
    else if (event.type === "RUN_STOPPED") { state.status = "STOPPED"; state.blocker = event.payload; }
    else if (event.type === "DELIVERY_BLOCKED") {
      const validStage = ["integration", "staging", "release", "production"].includes(event.payload.stage);
      if (!event.payload.blocker_id || !validStage || typeof event.payload.dependency !== "string" || !event.payload.dependency || typeof event.payload.next_permitted_action !== "string" || !event.payload.next_permitted_action) errors.push("delivery blocker requires id, integration/staging/release/production stage, dependency, and next permitted action");
      else if (requireState("FROZEN", "FINAL_REVIEW_PASSED", "FINAL_SHA_BOUND", "RELEASING")) state.blocker = event.payload;
    }
    else if (event.type === "DELIVERY_UNBLOCKED") {
      if (!state.blocker?.blocker_id || event.payload.blocker_id !== state.blocker.blocker_id) errors.push("delivery unblock must match the active blocker id");
      else state.blocker = null;
    }
    else if (event.type === "CANDIDATE_FROZEN") {
      const tasks = Object.values(state.tasks);
      if (!SHA256.test(event.payload.candidate_digest ?? "")) errors.push("candidate freeze requires a lowercase sha256 candidate digest");
      else if (tasks.length === 0 || tasks.some(task => task.status !== "CONSUMED")) errors.push("candidate freeze requires every runtime task to be CONSUMED");
      else if (requireState("RUNNING")) { state.status = "FROZEN"; state.candidate_digest = event.payload.candidate_digest; }
    }
    else if (event.type === "FINAL_REVIEW_RECORDED") {
      const reviewErrors = [];
      if (event.payload.receipt_type !== "FINAL_REVIEW_PANEL") reviewErrors.push("final review must be a FINAL_REVIEW_PANEL receipt");
      if (event.payload.verdict !== "PASS") reviewErrors.push("final review must pass before release progression");
      if (event.payload.review_kind !== "exec") reviewErrors.push("final review must be the execution review station");
      for (const field of ["receipt_digest", "candidate_digest"]) if (!SHA256.test(event.payload[field] ?? "")) reviewErrors.push(`final review ${field} must be lowercase sha256`);
      if (!GIT_SHA.test(event.payload.base_sha ?? "")) reviewErrors.push("final review base_sha must be a 40-character Git SHA");
      if (!/^[a-z][a-z0-9_-]{1,31}$/.test(event.payload.reviewer_family ?? "")) reviewErrors.push("final review requires an attested reviewer_family");
      if (event.payload.unowned_critical_high !== 0) reviewErrors.push("final review has unowned Critical/High findings");
      if (event.payload.release_authorized !== true) reviewErrors.push("final review panel is not release-authorized");
      if (event.payload.candidate_digest !== state.candidate_digest) reviewErrors.push("final review candidate digest does not match the frozen runtime candidate");
      if (reviewErrors.length) errors.push(...reviewErrors);
      else if (requireState("FROZEN")) { state.status = "FINAL_REVIEW_PASSED"; state.final_review = event.payload; }
    } else if (event.type === "FINAL_SHA_BOUND") {
      if (!GIT_SHA.test(event.payload.sha ?? "")) errors.push("FINAL_SHA_BOUND requires a 40-character Git SHA");
      else if (event.payload.review_receipt_digest !== state.final_review?.receipt_digest || event.payload.candidate_digest !== state.final_review?.candidate_digest) errors.push("FINAL_SHA_BOUND does not bind the accepted final review receipt and candidate");
      else if (requireState("FINAL_REVIEW_PASSED")) { state.status = "FINAL_SHA_BOUND"; state.final_sha = event.payload.sha; }
    } else if (event.type === "ROLLBACK_READY") {
      if (!SHA256.test(event.payload.effect_receipt_digest ?? "") || !SHA256.test(event.payload.rollback_receipt_digest ?? "")) errors.push("rollback readiness requires executed effect and compensation receipt digests");
      else if (requireState("FINAL_SHA_BOUND", "RELEASING", "PRODUCTION_RELEASED")) state.rollback_ready = true;
    } else if (event.type === "RELEASE_STARTED") {
      if (!state.rollback_ready) errors.push("release cannot start before rollback readiness");
      else if (requireState("FINAL_SHA_BOUND")) state.status = "RELEASING";
    } else if (event.type === "PRODUCTION_RELEASED") {
      const simulation = event.payload.simulation_only === true || event.payload.production_proof === false;
      if (!SHA256.test(event.payload.effect_receipt_digest ?? "")) errors.push("production release requires a confirmed effect receipt digest");
      else if (!simulation && event.payload.production_proof !== true) errors.push("production release requires explicit production_proof=true or simulation_only=true");
      else if (requireState("RELEASING")) {
        state.simulation_only = simulation;
        state.production_proven = !state.simulation_only && event.payload.production_proof === true;
        state.status = state.simulation_only ? "SIMULATED_RELEASED" : "PRODUCTION_RELEASED";
        state.release = event.payload;
      }
    } else if (event.type === "LIVE_VERIFIED") {
      const simulation = state.simulation_only || event.payload.simulation_only === true || event.payload.production_proof === false;
      if (!SHA256.test(event.payload.effect_receipt_digest ?? "") || !SHA256.test(event.payload.evidence_object_digest ?? "")) errors.push("live verification requires effect and CAS evidence receipt digests");
      else if (!simulation && event.payload.trust_level !== "production") errors.push("live verification requires production trust");
      else if (!simulation && event.payload.production_proof !== true) errors.push("live verification requires explicit production_proof=true");
      else if (requireState("PRODUCTION_RELEASED", "SIMULATED_RELEASED")) {
        state.simulation_only = simulation;
        state.production_proven = !simulation && event.payload.production_proof === true;
        state.status = simulation ? "SIMULATED_LIVE_VERIFIED" : "LIVE_VERIFIED";
        state.live_verification = event.payload;
      }
    } else if (event.type === "OBSERVATION_SCHEDULED") {
      if (!["metric_id", "consumer_id", "window_starts_at", "window_ends_at"].every(field => typeof event.payload[field] === "string" && event.payload[field])) errors.push("observation schedule requires metric, named consumer and window bounds");
      else if (Date.parse(event.payload.window_ends_at) <= Date.parse(event.payload.window_starts_at)) errors.push("observation schedule window must end after it starts");
      else if (!state.rollback_ready) errors.push("delivery cannot close without rollback readiness");
      else if (requireState("LIVE_VERIFIED", "SIMULATED_LIVE_VERIFIED")) {
        state.status = state.simulation_only ? "SIMULATED_DELIVERY_EXERCISED" : "DELIVERY_VERIFIED";
        state.observation = event.payload;
      }
    } else if (event.type === "OUTCOME_OBSERVED") {
      if (requireState("DELIVERY_VERIFIED", "OUTCOME_OBSERVING", "SIMULATED_DELIVERY_EXERCISED")) {
        state.status = state.simulation_only ? "SIMULATED_OUTCOME_OBSERVED" : "OUTCOME_OBSERVED";
        state.observed_delta = event.payload;
      }
    } else if (event.type === "NEXT_DECISION_RECORDED") {
      if (requireState("OUTCOME_OBSERVED", "SIMULATED_OUTCOME_OBSERVED")) {
        state.status = state.simulation_only ? "SIMULATED_OUTCOME_DECIDED" : "OUTCOME_DECIDED";
        state.next_decision = event.payload;
      }
    } else if (event.type === "ROLLBACK_EXECUTED") {
      if (requireState("RELEASING", "PRODUCTION_RELEASED", "LIVE_VERIFIED", "SIMULATED_RELEASED", "SIMULATED_LIVE_VERIFIED", "SIMULATED_DELIVERY_EXERCISED")) { state.status = "ROLLED_BACK"; state.release = event.payload; }
    } else if (TASK_EVENT_TYPES.includes(event.type) && !event.task_id) {
      errors.push(`events[${index}] ${event.type} requires task_id`);
    } else if (event.task_id && TASK_EVENT_TYPES.includes(event.type)) {
      const task = state.tasks[event.task_id] ?? { status: "PLANNED", lease: null, validations: [], effects: [], evidence: [] };
      if (event.type === "TASK_LEGACY_ACCEPTED_IMPORTED") {
        if (![1, 2].includes(event.payload.source_version)) errors.push(`events[${index}] legacy import source_version must be N or N-1`);
        for (const field of ["source_digest", "source_task_digest", "migration_report_digest"]) {
          if (!SHA256.test(event.payload[field] ?? "")) errors.push(`events[${index}] legacy import ${field} must be lowercase sha256`);
        }
        if (event.payload.consumed !== false) errors.push(`events[${index}] legacy import cannot claim product consumption`);
        if (!Array.isArray(event.payload.evidence_references)) errors.push(`events[${index}] legacy import requires evidence references`);
        else for (const reference of event.payload.evidence_references) {
          if (typeof reference.id !== "string" || !SHA256.test(reference.source_reference_digest ?? "")) errors.push(`events[${index}] legacy evidence reference is not source-bound`);
        }
      }
      const transition = transitionTaskState(task.status, event.type);
      if (!transition.valid) errors.push(...transition.errors.map(error => `events[${index}] ${error}`));
      else task.status = transition.next_state;
      if (event.type === "TASK_LEASE_ACQUIRED" || event.type === "TASK_LEASE_RECLAIMED") task.lease = event.payload;
      else if (event.type === "VALIDATOR_FINISHED") task.validations.push(event.payload);
      else if (event.type === "EFFECT_EXECUTED") task.effects.push(event.payload);
      else if (event.type === "EVIDENCE_PRODUCED") { task.evidence.push(event.payload.object_digest); state.evidence[event.payload.object_digest] = event.payload; }
      else if (event.type === "EVIDENCE_CONSUMED") state.consumers[`${event.payload.object_digest}:${event.payload.consumer_id}`] = event.payload;
      else if (event.type === "EVIDENCE_INVALIDATED") delete state.evidence[event.payload.object_digest];
      else if (event.type === "TASK_LEGACY_ACCEPTED_IMPORTED") task.legacy_import = event.payload;
      state.tasks[event.task_id] = task;
    }
    state.event_count = index + 1;
    state.last_event_digest = event.event_digest;
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort(), state: errors.length ? null : state, idempotency };
}

export function appendRuntimeEvent(paths, input) {
  return withJournalLock(paths, () => {
    const events = readRuntimeJournal(paths.journal);
    const replayed = replayRuntimeJournal(events, { run_id: input.run_id, generation_bindings: input.generation_bindings });
    if (!replayed.valid) return replayed;
    const existing = events.find((event) => event.idempotency_key === input.idempotency_key);
    if (existing) return { valid: true, idempotent: true, event: existing, state: replayed.state };
    const event = {
      schema_version: 2, run_id: input.run_id, sequence: events.length + 1, type: input.type,
      task_id: input.task_id ?? null, observed_at: canonicalTime(input.observed_at), idempotency_key: input.idempotency_key,
      generation_bindings: input.generation_bindings, previous_event_digest: events.at(-1)?.event_digest ?? null,
      payload: input.payload ?? {}, event_digest: ""
    };
    event.event_digest = eventDigest(event);
    const candidate = replayRuntimeJournal([...events, event], { run_id: input.run_id, generation_bindings: input.generation_bindings });
    if (!candidate.valid) return candidate;
    fs.mkdirSync(path.dirname(paths.journal), { recursive: true, mode: 0o700 });
    const fd = fs.openSync(paths.journal, fs.constants.O_CREAT | fs.constants.O_APPEND | fs.constants.O_WRONLY, 0o600);
    try { fs.writeSync(fd, `${JSON.stringify(event)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    return { valid: true, idempotent: false, event, state: candidate.state };
  });
}

function requireSameBindings(objects) {
  const first = objects[0];
  for (const current of objects.slice(1)) if (!sameGenerationBindings(first, current)) throw new Error("compiled objects do not share generation bindings");
  return first;
}

export function compileProductionDeliveryForecast(deliverySlo, capsules) {
  const census = evaluateProductionObligationCensus(deliverySlo);
  if (!census.valid) return census;
  const errors = [];
  const detectedSignals = new Map();
  const requiredEffectKinds = new Set();
  const signal = (obligationId, reason) => {
    const reasons = detectedSignals.get(obligationId) ?? new Set();
    reasons.add(reason); detectedSignals.set(obligationId, reasons);
  };
  for (const capsule of capsules) {
    const surfaces = [
      ...(capsule.allowed_files ?? []).map(row => row.path),
      ...(capsule.resource_claims ?? []).map(row => row.key),
      ...(capsule.effect_capabilities ?? []).flatMap(row => row.targets ?? [])
    ];
    for (const value of surfaces) {
      if (/(^|[/:._-])(migration|migrations|schema|database|supabase|sql)([/:._-]|$)/i.test(value)) signal("DATA_AND_MIGRATION", `${capsule.task_id}:${value}`);
      if (/(^|[/:._-])(auth|authorization|privacy|security|permission|policy|rls|grant)([/:._-]|$)/i.test(value)) signal("AUTH_AND_PRIVACY", `${capsule.task_id}:${value}`);
      if (/(^|[/:._-])(android|ios|capacitor|native|device)([/:._-]|$)/i.test(value)) signal("PLATFORM_AND_DEVICE", `${capsule.task_id}:${value}`);
      if (/(^|[/:._-])(deploy|deployment|release|staging|production|environment|config)([/:._-]|$)/i.test(value)) signal("RELEASE_AND_CONFIG", `${capsule.task_id}:${value}`);
    }
    for (const capability of capsule.effect_capabilities ?? []) {
      requiredEffectKinds.add(capability.kind);
      if (new Set(["network_read", "provider_write", "paid_write"]).has(capability.kind)) signal("EXTERNAL_INTEGRATIONS", `${capsule.task_id}:effect:${capability.kind}`);
      if (capability.kind === "device") signal("PLATFORM_AND_DEVICE", `${capsule.task_id}:effect:device`);
      if (capability.kind === "deploy") signal("RELEASE_AND_CONFIG", `${capsule.task_id}:effect:deploy`);
    }
  }
  const builtInEffectKinds = new Set(BUILT_IN_EFFECT_KINDS);
  const unsupportedEffectKinds = [...requiredEffectKinds].filter(kind => !builtInEffectKinds.has(kind)).sort();
  for (const kind of unsupportedEffectKinds) {
    errors.push(`production path requires effect kind ${kind}, but runtime-v2 has no fixed executable adapter; add a product-specific adapter and proof before admission`);
  }
  const requiredObligations = new Set(census.required_obligations);
  for (const [obligationId, reasons] of detectedSignals) {
    if (!requiredObligations.has(obligationId)) errors.push(`product signals require ${obligationId}, but its production obligation is not REQUIRED (${[...reasons].sort().join(",")})`);
  }
  const capsuleIds = new Set(capsules.map((capsule) => capsule.task_id));
  const mappedIds = new Set(Object.keys(census.task_owners));
  for (const taskId of capsuleIds) if (!mappedIds.has(taskId)) errors.push(`runtime task ${taskId} is missing from the production obligation census`);
  for (const taskId of mappedIds) if (!capsuleIds.has(taskId)) errors.push(`production obligation references unknown runtime task ${taskId}`);
  const targetActiveSeconds = Math.floor(census.target_active_minutes * 60);
  const schedule = planExecutionWaves(capsules, {
    max_parallel: deliverySlo.max_parallel,
    global_active_budget_seconds: targetActiveSeconds
  });
  if (!schedule.valid) errors.push(...schedule.errors);
  const reserveSeconds = deliverySlo.risk_reserve_seconds;
  const forecastActiveSeconds = schedule.valid ? schedule.predicted_active_wall_seconds + reserveSeconds : null;
  if (schedule.valid && forecastActiveSeconds > targetActiveSeconds) {
    errors.push(`complete production path plus reserve needs ${forecastActiveSeconds}s but the ${census.required_speedup}x target permits ${targetActiveSeconds}s; re-slice or stop`);
  }
  const extraIds = new Set(census.production_completion_extras);
  const coreEntries = schedule.valid
    ? schedule.schedule.filter((entry) => !extraIds.has(census.task_owners[entry.task_id]))
    : [];
  const extraEntries = schedule.valid
    ? schedule.schedule.filter((entry) => extraIds.has(census.task_owners[entry.task_id]))
    : [];
  const coreWallSeconds = coreEntries.length > 0 ? Math.max(...coreEntries.map((entry) => entry.finish_offset_seconds)) : 0;
  const productionCompletionExtraWallSeconds = schedule.valid
    ? Math.max(0, schedule.predicted_active_wall_seconds - coreWallSeconds)
    : null;
  const baselineSeconds = deliverySlo.baseline_feature_minutes * 60;
  return {
    valid: errors.length === 0,
    errors: [...new Set(errors)].sort(),
    status: errors.length > 0 ? "RESLICE_OR_STOP"
      : census.forecast_mode === "SHADOW" ? "SHADOW_ONLY"
      : census.forecast_mode === "AUTHORIZED_CANARY" ? "CANARY_ADMIT"
      : "DEFAULT_ADMIT",
    baseline_feature_minutes: deliverySlo.baseline_feature_minutes,
    required_speedup: deliverySlo.required_speedup,
    forecast_mode: census.forecast_mode,
    estimate_basis: census.estimate_basis,
    estimate_confidence: census.estimate_confidence,
    calibration_samples: census.calibration_samples,
    estimate_proven: census.estimate_proven,
    target_active_seconds: targetActiveSeconds,
    predicted_active_seconds: schedule.valid ? schedule.predicted_active_wall_seconds : null,
    risk_reserve_seconds: reserveSeconds,
    forecast_active_seconds: forecastActiveSeconds,
    forecast_speedup: forecastActiveSeconds ? Number((baselineSeconds / forecastActiveSeconds).toFixed(2)) : null,
    core_active_wall_seconds: coreWallSeconds,
    production_completion_extra_wall_seconds: productionCompletionExtraWallSeconds,
    production_completion_extra_task_seconds: extraEntries.reduce((total, entry) => total + entry.active_budget_seconds, 0),
    identified_production_extras: census.production_completion_extras,
    detected_production_signals: Object.fromEntries([...detectedSignals.entries()].sort().map(([id, reasons]) => [id, [...reasons].sort()])),
    required_effect_kinds: [...requiredEffectKinds].sort(),
    built_in_effect_kinds: BUILT_IN_EFFECT_KINDS,
    unsupported_effect_kinds: unsupportedEffectKinds,
    external_wait_seconds: census.external_wait_seconds,
    external_wait_clock: deliverySlo.external_wait_clock,
    schedule: schedule.valid ? schedule.schedule : null
  };
}

export function compileRuntimeRun(input) {
  const repoRoot = path.resolve(input.repoRoot ?? process.cwd());
  const layerResult = input.layerInventory ? { valid: true, inventory: input.layerInventory } : compileCanonicalLayerInventory({ repoRoot, decisions: input.layerDecisions, generation: input.layerGeneration ?? 1 });
  if (!layerResult.valid) return layerResult;
  const layerInventory = layerResult.inventory;
  const protocolResult = compileProductImprovementProtocol(input.protocol, { layerInventory });
  const graphResult = compileProductProofGraph(input.productGraph, { repoRoot, layerInventory });
  const capsuleResult = compileExecutionGraph(input.capsules);
  const errors = [...(protocolResult.errors ?? []), ...(graphResult.errors ?? []), ...(capsuleResult.errors ?? [])];
  if (errors.length) return { valid: false, errors: [...new Set(errors)].sort() };
  let generationBindings;
  try { generationBindings = requireSameBindings([input.protocol.generation_bindings, input.productGraph.generation_bindings, ...input.capsules.map((capsule) => capsule.generation_bindings)]); }
  catch (error) { return { valid: false, errors: [error.message] }; }
  if (input.protocol.product_graph_digest !== graphResult.graph_digest) errors.push("protocol product_graph_digest does not match compiled product graph");
  if (generationBindings.layer_inventory_digest !== layerInventory.inventory_digest) errors.push("generation bindings do not match canonical layer inventory");
  const deliveryForecast = compileProductionDeliveryForecast(input.protocol.delivery_slo, input.capsules);
  if (!deliveryForecast.valid) errors.push(...deliveryForecast.errors);
  const consumptionResult = createConsumptionLedger({
    run_id: input.runId, generation_bindings: generationBindings,
    protocol_digest: protocolResult.protocol_digest, product_graph_digest: graphResult.graph_digest,
    artifact_contracts: input.protocol.artifacts, producer_task_ids: input.producerTaskIds ?? {},
    consumer_graph_nodes: input.consumerGraphNodes ?? {}, retention_pins: input.retentionPins ?? {},
    invalidation_input_names: input.invalidationInputNames ?? {}, minimum_trust_levels: input.minimumTrustLevels ?? {},
    validation_options: { protocol: input.protocol, productGraph: input.productGraph, protocolDigest: protocolResult.protocol_digest, productGraphDigest: graphResult.graph_digest }
  });
  if (!consumptionResult.valid) errors.push(...consumptionResult.errors.map((error) => `consumption ledger: ${error}`));
  if (errors.length) return { valid: false, errors };
  const manifest = {
    schema_version: 2, run_id: input.runId, repository_root: repoRoot, created_at: canonicalTime(input.observedAt),
    generation_bindings: generationBindings, protocol_digest: protocolResult.protocol_digest,
    product_graph_digest: graphResult.graph_digest, layer_inventory_digest: layerInventory.inventory_digest,
    execution_graph_digest: capsuleResult.graph_digest, protocol: input.protocol, product_graph: input.productGraph,
    layer_inventory: layerInventory, capsules: input.capsules, consumption_ledger: consumptionResult.ledger,
    delivery_forecast: deliveryForecast, forecast_active_seconds: deliveryForecast.forecast_active_seconds,
    slo_status: "TARGET"
  };
  manifest.manifest_digest = digest(manifest);
  return { valid: true, errors: [], manifest };
}

function persistCompiledRun(paths, result) {
  fs.mkdirSync(paths.runDir, { recursive: true, mode: 0o700 });
  const bytes = `${JSON.stringify(result.manifest)}\n`;
  if (fs.existsSync(paths.manifest)) {
    if (fs.readFileSync(paths.manifest, "utf8") !== bytes) return { valid: false, errors: ["run_id already exists with a different manifest"] };
  } else atomicWrite(paths.manifest, bytes);
  const ledgerBytes = `${JSON.stringify(result.manifest.consumption_ledger)}\n`;
  if (fs.existsSync(paths.ledger)) {
    if (fs.readFileSync(paths.ledger, "utf8") !== ledgerBytes) return { valid: false, errors: ["run_id already exists with a different consumption ledger"] };
  } else atomicWrite(paths.ledger, ledgerBytes);
  const appended = appendRuntimeEvent(paths, {
    run_id: result.manifest.run_id, type: "RUN_COMPILED", idempotency_key: `compile:${result.manifest.manifest_digest}`,
    observed_at: result.manifest.created_at, generation_bindings: result.manifest.generation_bindings,
    payload: { manifest_digest: result.manifest.manifest_digest, execution_graph_digest: result.manifest.execution_graph_digest }
  });
  return appended.valid ? { valid: true, manifest: result.manifest, event: appended.event, idempotent: appended.idempotent } : appended;
}

export function runtimeStatus(paths) {
  const manifest = readJson(paths.manifest, "runtime manifest");
  const replayed = replayRuntimeJournal(readRuntimeJournal(paths.journal), { run_id: manifest.run_id, generation_bindings: manifest.generation_bindings });
  if (!replayed.valid) return replayed;
  const state = replayed.state;
  const capsuleIds = manifest.capsules.map((capsule) => capsule.task_id);
  const tasks = capsuleIds.map((taskId) => ({ task_id: taskId, status: state.tasks[taskId]?.status ?? "PLANNED" }));
  return {
    valid: true, run_id: manifest.run_id, status: state.status, manifest_digest: manifest.manifest_digest,
    completed: tasks.filter((task) => task.status === "CONSUMED").map((task) => task.task_id),
    accepted_not_consumed: tasks.filter((task) => task.status === "ACCEPTED").map((task) => task.task_id),
    remaining: tasks.filter((task) => task.status !== "CONSUMED").map((task) => task.task_id),
    tasks, blocker: state.blocker, candidate_digest: state.candidate_digest, final_sha: state.final_sha, rollback_ready: state.rollback_ready,
    delivery_verified: state.status === "DELIVERY_VERIFIED" || new Set(["OUTCOME_OBSERVED", "OUTCOME_DECIDED"]).has(state.status),
    outcome_decided: state.status === "OUTCOME_DECIDED", event_count: state.event_count, last_event_digest: state.last_event_digest,
    simulation_only: state.simulation_only, production_proven: state.production_proven,
    journal_authoritative: true, projections_authoritative: false
  };
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) result._.push(token);
    else if (token.includes("=")) result[token.slice(2, token.indexOf("="))] = token.slice(token.indexOf("=") + 1);
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) result[token.slice(2)] = argv[++index];
    else result[token.slice(2)] = true;
  }
  return result;
}

function eventInput(manifest, args, type, payload) {
  return { run_id: manifest.run_id, type, task_id: args.task ?? null, observed_at: args.at ?? new Date().toISOString(), idempotency_key: args.idempotency, generation_bindings: manifest.generation_bindings, payload };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  const stateRoot = args["state-root"] ?? path.join(process.cwd(), ".svc", "runtime-v2");
  if (!command || !args["run-id"]) throw new Error("usage: svc-runtime-v2 compile|run|resume|status|release|observe --run-id <id> [options]");
  const paths = runPaths(stateRoot, args["run-id"]);
  if (command === "compile") {
    const result = compileRuntimeRun({
      repoRoot: args["repo-root"] ?? process.cwd(), runId: args["run-id"], observedAt: args.at ?? new Date().toISOString(),
      protocol: readJson(args.protocol, "protocol"), productGraph: readJson(args.graph, "graph"), capsules: readJson(args.capsules, "capsules"),
      layerInventory: args["layer-inventory"] ? readJson(args["layer-inventory"], "layer inventory") : undefined,
      layerDecisions: args["layer-decisions"] ? readJson(args["layer-decisions"], "layer decisions") : undefined,
      layerGeneration: args["layer-generation"] ? Number(args["layer-generation"]) : 1,
      producerTaskIds: args["producer-task-ids"] ? readJson(args["producer-task-ids"], "producer task IDs") : undefined,
      consumerGraphNodes: args["consumer-graph-nodes"] ? readJson(args["consumer-graph-nodes"], "consumer graph nodes") : undefined
    });
    return result.valid ? persistCompiledRun(paths, result) : result;
  }
  const manifest = readJson(paths.manifest, "runtime manifest");
  if (command === "status") return runtimeStatus(paths);
  if (!args.idempotency) throw new Error(`${command} requires --idempotency`);
  if (command === "run" || command === "resume") {
    const actions = readJson(args.input, "runtime actions");
    const ledger = readJson(paths.ledger, "consumption ledger");
    const append = input => appendRuntimeEvent(paths, { ...input, run_id: manifest.run_id, generation_bindings: manifest.generation_bindings });
    return runRuntimeToFreeze(paths, manifest, ledger, actions, append, () => runtimeStatus(paths));
  }
  if (command === "release") {
    const release = readJson(args.input, "release input");
    const effectTypes = new Set(["ROLLBACK_READY", "PRODUCTION_RELEASED", "LIVE_VERIFIED", "ROLLBACK_EXECUTED"]);
    let effectResult = null;
    if (effectTypes.has(release.type)) {
      effectResult = await executeReleaseEffect(paths, manifest, release, { phase: release.type });
      if (!effectResult.valid) return effectResult;
      if (release.type === "ROLLBACK_READY") {
        const compensation = await executeReleaseEffect(paths, manifest, { ...release, type: "ROLLBACK_EXECUTED" }, { phase: "ROLLBACK_REHEARSAL" });
        if (!compensation.valid) return compensation;
        effectResult = { ...effectResult, compensation };
      }
    }
    const payload = { ...(release.payload ?? {}) };
    if (effectResult?.receipt?.receipt_digest) payload.effect_receipt_digest = effectResult.receipt.receipt_digest;
    if (effectResult?.compensation?.receipt?.receipt_digest) payload.rollback_receipt_digest = effectResult.compensation.receipt.receipt_digest;
    return appendRuntimeEvent(paths, eventInput(manifest, args, release.type, payload));
  }
  if (command === "observe") {
    const observation = readJson(args.input, "observation input");
    if (!new Set(["OBSERVATION_SCHEDULED", "OUTCOME_OBSERVED", "NEXT_DECISION_RECORDED"]).has(observation.type)) throw new Error(`observe cannot append ${observation.type}`);
    return appendRuntimeEvent(paths, eventInput(manifest, args, observation.type, observation.payload ?? {}));
  }
  throw new Error(`unknown command ${command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await main();
    (result.valid ? process.stdout : process.stderr).write(`${JSON.stringify(result)}\n`);
    process.exitCode = result.valid ? 0 : 1;
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, errors: [error.message] })}\n`);
    process.exitCode = 2;
  }
}
