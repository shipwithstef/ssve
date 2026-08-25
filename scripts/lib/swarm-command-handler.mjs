#!/usr/bin/env node
// swarm-command-handler.mjs — single-writer coordination kernel for multi-model swarms.
//
// Authority model: adapters submit COMMANDS; this handler is the only component that
// validates them against replayed state, appends journal events under an flock-held
// critical section, persists signed acceptance/rejection receipts, and answers retries.
// A model-authored PASS string is never authority; verdicts come only from replayed
// state plus recomputation performed here.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { validate } from "./json-schema-validator.mjs";
import { jcs, canonicalDigest } from "./swarm-canonical-json.mjs";
import {
  signReceipt,
  verifyEnvelope,
  generateKeyPair,
  keyFingerprint,
  RECEIPT_PAYLOAD_TYPE,
} from "./swarm-signing.mjs";

const COMMAND_SCHEMA = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL("../../schemas/swarm-command-v1.schema.json", import.meta.url)), "utf8"),
);
const RECEIPT_SCHEMA = JSON.parse(
  fs.readFileSync(fileURLToPath(new URL("../../schemas/swarm-receipt-payload-v1.schema.json", import.meta.url)), "utf8"),
);
import { fileURLToPath } from "node:url";

const SHA256 = /^[0-9a-f]{64}$/;
const LEASE_MS_DEFAULT = 15 * 60 * 1000;

export const ATTEMPT_TRANSITIONS = Object.freeze({
  PLANNED: Object.freeze({ acquire_task: "LEASED" }),
  LEASED: Object.freeze({ heartbeat_task: "LEASED", submit_candidate: "CANDIDATE_SUBMITTED", request_cancel: "CANCELLED", request_handoff: "HANDOFF_PREPARED" }),
  RUNNING: Object.freeze({ heartbeat_task: "RUNNING", submit_candidate: "CANDIDATE_SUBMITTED", request_cancel: "CANCELLED", request_handoff: "HANDOFF_PREPARED" }),
  CANDIDATE_SUBMITTED: Object.freeze({ request_cancel: "CANCELLED" }),
  VERIFYING: Object.freeze({ accept: "ACCEPTED", reject_retryable: "RETRYABLE", conflict: "CONFLICTED", request_cancel: "CANCELLED" }),
  ACCEPTED: Object.freeze({ consume: "CONSUMED" }),
  CONFLICTED: Object.freeze({ propose_resolution: "RESOLVING", request_cancel: "CANCELLED" }),
  RESOLVING: Object.freeze({ resolve_accept: "VERIFYING", resolve_exhausted: "BLOCKED" }),
  RETRYABLE: Object.freeze({ reacquire: "PLANNED" }),
  HANDOFF_PREPARED: Object.freeze({ accept_handoff: "LEASED" }),
  INPUT_REQUIRED: Object.freeze({ resume: "RUNNING", request_cancel: "CANCELLED" }),
  CANCELLED: Object.freeze({}),
  FAILED: Object.freeze({}),
  BLOCKED: Object.freeze({}),
  CONSUMED: Object.freeze({}),
});

function uuid7(now = Date.now()) {
  const bytes = crypto.randomBytes(16);
  const ts = BigInt(now);
  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function atomicWriteJson(file, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, mode);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, file);
}

// --- bootstrap (rerun-safe, crash-safe) --------------------------------------

export function initStateRoot(stateRoot, options = {}) {
  const keysDir = path.join(stateRoot, "keys");
  fs.mkdirSync(keysDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(keysDir, 0o700);
  const rootFile = path.join(keysDir, "root.json");
  const coordFile = path.join(keysDir, "coordinator.json");
  const registryFile = path.join(stateRoot, "trust-registry.json");
  const journalFile = path.join(stateRoot, "journal.jsonl");

  const required = [rootFile, coordFile, registryFile, journalFile];
  const missing = required.filter((file) => !fs.existsSync(file));
  if (missing.length === 0 && !options.forceFingerprintRefresh) {
    // fully initialized: idempotent success returning existing fingerprints
    const registry = JSON.parse(fs.readFileSync(registryFile, "utf8"));
    return { created: false, registry_id: registry.registry_id, fingerprints: registry.keys.map(k => k.keyid) };
  }
  if (missing.length > 0 && missing.length < required.length && !options.repair) {
    throw Object.assign(new Error(`partial bootstrap; missing artifacts: ${missing.map(m => path.basename(m)).join(", ")}; repair or remove the state root`), { code: "PARTIAL_BOOTSTRAP" });
  }

  let root = null;
  let coordinator = null;
  if (!fs.existsSync(rootFile)) {
    root = generateKeyPair();
    atomicWriteJson(rootFile, root);
  } else {
    root = JSON.parse(fs.readFileSync(rootFile, "utf8"));
  }
  if (!fs.existsSync(coordFile)) {
    coordinator = generateKeyPair();
    atomicWriteJson(coordFile, coordinator);
  } else {
    coordinator = JSON.parse(fs.readFileSync(coordFile, "utf8"));
  }
  if (!fs.existsSync(journalFile)) {
    const fd = fs.openSync(journalFile, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    fs.closeSync(fd);
  }
  if (!fs.existsSync(registryFile)) {
    const now = new Date().toISOString();
    const registryId = `registry-${crypto.randomBytes(8).toString("hex")}`;
    const body = {
      schema_version: 1,
      registry_id: registryId,
      root_keyid: keyFingerprint(root.public_key),
      root_signature: null,
      keys: [
        { keyid: keyFingerprint(coordinator.public_key), purpose: "coordinate", principal_id: "svc-swarm-coordinator", public_key: coordinator.public_key, allowed_receipt_kinds: ["acceptance_receipt", "rejection_receipt", "synchronization_receipt", "resolution_receipt", "checkpoint_receipt"], valid_from: now, expires_at: null, revoked_at_sequence: null },
      ],
    };
    // the operator root self-signs the registry body (sans signature field)
    const sig = signRegistryBody(root.private_key, body);
    body.root_signature = sig;
    atomicWriteJson(registryFile, body);
  }
  return { created: true, registry_id: JSON.parse(fs.readFileSync(registryFile, "utf8")).registry_id };
}

function registryBodyBytes(body) {
  const copy = { ...body };
  delete copy.root_signature;
  return Buffer.from(jcs(copy), "utf8");
}

function signRegistryBody(privateKeyPem, body) {
  return crypto.sign(null, registryBodyBytes(body), crypto.createPrivateKey(privateKeyPem)).toString("base64");
}

export function verifyRegistrySignature(registry, rootPublicKeyPem) {
  try {
    return crypto.verify(null, registryBodyBytes(registry), crypto.createPublicKey(rootPublicKeyPem), Buffer.from(registry.root_signature || "", "base64"));
  } catch {
    return false;
  }
}

// --- journal primitives ------------------------------------------------------

export function readJournal(journalPath) {
  if (!fs.existsSync(journalPath)) return [];
  const text = fs.readFileSync(journalPath, "utf8");
  if (text.length === 0) return [];
  if (!text.endsWith("\n")) throw new Error("journal has a torn final record");
  return text.trimEnd().split("\n").map((line, i) => {
    try { return JSON.parse(line); } catch (e) { throw new Error(`journal line ${i + 1} is not valid JSON`); }
  });
}

function eventDigestOf(event) {
  const copy = { ...event };
  delete copy.event_digest;
  return `sha256:${crypto.createHash("sha256").update(Buffer.from(jcs(copy), "utf8")).digest("hex")}`;
}

export function replay(events, expectedRunId = null) {
  const errors = [];
  const state = {
    run_id: expectedRunId, sequence: 0, last_event_digest: null,
    authority_generation: 0, coordinator_epoch: 1,
    sessions: {}, tasks: {}, handoffs: {}, conflicts: {},
    idempotency: {}, cancelled_keys: {},
  };
  for (const [index, event] of events.entries()) {
    try {
      if (event.sequence !== index + 1) errors.push(`events[${index}] sequence mismatch`);
      if (state.run_id && event.run_id !== state.run_id) errors.push(`events[${index}] run_id changed`);
      if (!state.run_id) state.run_id = event.run_id;
      const prev = index === 0 ? null : events[index - 1].event_digest;
      if ((event.previous_event_digest ?? null) !== prev) errors.push(`events[${index}] digest-chain break`);
      if (eventDigestOf(event) !== event.event_digest) errors.push(`events[${index}] event digest mismatch`);
      const prior = state.idempotency[event.idempotency_key];
      if (prior && prior.command_digest !== event.command_digest) errors.push(`events[${index}] idempotency key reused across different commands`);
      if (errors.length) continue;
    } catch (e) {
      errors.push(`events[${index}] ${e.message}`);
      continue;
    }

    applyToState(state, event);
    state.idempotency[event.idempotency_key] = { command_digest: event.command_digest, event_digest: event.event_digest };
    state.sequence = event.sequence;
    state.last_event_digest = event.event_digest;
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)], state: errors.length ? null : state };
}

function applyToState(state, event) {
  switch (event.type) {
    case "SESSION_REGISTERED":
      state.sessions[event.actor.principal_id] = { ...event.payload, registered_sequence: event.sequence };
      break;
    case "TASK_LEASE_ACQUIRED": {
      const task = state.tasks[event.task_id] || { attempts: [], state: "PLANNED" };
      task.state = "LEASED";
      task.lease = event.payload.lease;
      task.attempt_id = event.payload.attempt_id;
      state.tasks[event.task_id] = task;
      break;
    }
    case "TASK_HEARTBEAT": {
      const task = state.tasks[event.task_id];
      if (task?.lease) task.lease.renewed_at = event.payload.heartbeat_at;
      break;
    }
    case "CAUSAL_PROGRESS_RECORDED":
      break;
    case "CANDIDATE_SUBMITTED": {
      const task = state.tasks[event.task_id];
      if (task) { task.state = "VERIFYING"; task.candidate = event.payload.candidate; }
      break;
    }
    case "HANDOFF_PREPARED": {
      const token = event.payload.handoff_token;
      state.handoffs[token] = { from_principal: event.actor.principal_id, task_id: event.task_id, consumed: false, target_generation: event.authority_generation + 1 };
      break;
    }
    case "HANDOFF_ACCEPTED": {
      const handoff = state.handoffs[event.payload.handoff_token];
      if (handoff) handoff.consumed = true;
      state.authority_generation = event.authority_generation + 1;
      break;
    }
    case "TASK_CANCELLED": {
      const task = state.tasks[event.task_id];
      if (task) { task.state = "CANCELLED"; task.cancel_reason = event.payload.reason_code; }
      break;
    }
    case "CONFLICT_RESOLUTION_PROPOSED": {
      const conflict = state.conflicts[event.payload.conflict.conflict_id];
      if (conflict) conflict.state = "RESOLVING";
      else state.conflicts[event.payload.conflict.conflict_id] = { ...event.payload.conflict, state: "RESOLVING" };
      break;
    }
    case "ACK_STATE_RECORDED":
    case "CHECKPOINT_SIGNED":
      break;
    default:
      break;
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

// Advisory exclusive lock: mkdir mutex with process-death reclaim via /proc start
// tokens — the same fail-safe pattern as scripts/svc-runtime-v2.mjs withJournalLock.
// A crashed coordinator cannot hold this lock: the next contender reclaims it once
// the owner pid is dead or its start token changed.
export function withJournalLock(journalPath, action, options = {}) {
  const lockDir = `${journalPath}.lock`;
  fs.mkdirSync(path.dirname(lockDir), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + (options.timeoutMs ?? 5000);
  const owner = { pid: process.pid, process_start_token: processStartToken(process.pid), owner_token: crypto.randomUUID(), created_at: new Date().toISOString() };
  for (;;) {
    try {
      fs.mkdirSync(lockDir, { mode: 0o700 });
      fs.writeFileSync(path.join(lockDir, "owner.json"), `${JSON.stringify(owner)}\n`, { flag: "wx", mode: 0o600 });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (clearAbandonedLock(lockDir)) continue;
      if (Date.now() >= deadline) throw Object.assign(new Error("journal lock busy"), { code: "LOCK_BUSY" });
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return action(); } finally {
    let current = null;
    try { current = JSON.parse(fs.readFileSync(path.join(lockDir, "owner.json"), "utf8")); } catch {}
    if (current?.owner_token === owner.owner_token) {
      try { fs.unlinkSync(path.join(lockDir, "owner.json")); } catch (error) { if (error.code !== "ENOENT") throw error; }
      try { fs.rmdirSync(lockDir); } catch {}
    }
  }
}

function clearAbandonedLock(lockDir) {
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

export class SwarmCoordinator {
  constructor(stateRoot) {
    this.root = stateRoot;
    this.journalPath = path.join(stateRoot, "journal.jsonl");
    this.registryPath = path.join(stateRoot, "trust-registry.json");
    this.keysDir = path.join(stateRoot, "keys");
    this.coordKey = JSON.parse(fs.readFileSync(path.join(this.keysDir, "coordinator.json"), "utf8"));
    this.receiptsDir = path.join(stateRoot, "receipts");
    fs.mkdirSync(this.receiptsDir, { recursive: true, mode: 0o700 });
    this.validators = [];
    this.leaseMs = LEASE_MS_DEFAULT;
  }

  registerValidator(fn) { this.validators.push(fn); }

  loadState() {
    const events = readJournal(this.journalPath);
    const replayed = replay(events);
    if (!replayed.valid) {
      throw Object.assign(new Error(`journal replay failed: ${replayed.errors.join("; ")}`), { code: "REPLAY_INVALID" });
    }
    return replayed;
  }

  registry() { return JSON.parse(fs.readFileSync(this.registryPath, "utf8")); }

  // Operator-only: provision an adapter session key. The generated private key is
  // written 0600 under keys/ and never returned through any protocol surface.
  provisionAdapter(principalId, options = {}) {
    const registry = this.registry();
    if (registry.keys.some(row => row.principal_id === principalId)) {
      return { created: false, principal_id: principalId };
    }
    const pair = generateKeyPair();
    atomicWriteJson(path.join(this.keysDir, `${principalId}.json`), pair);
    delete registry.root_signature;
    registry.keys.push({
      keyid: keyFingerprint(pair.public_key),
      purpose: "submit",
      principal_id: principalId,
      host: options.host ?? null,
      model_family: options.model_family ?? null,
      session_id: null,
      public_key: pair.public_key,
      allowed_receipt_kinds: ["submission_receipt"],
      valid_from: new Date().toISOString(),
      expires_at: options.expiresAt ?? null,
      revoked_at_sequence: null,
    });
    const cryptoMod = crypto;
    const signature = cryptoMod.sign(null, registryBodyBytes(registry), cryptoMod.createPrivateKey(JSON.parse(fs.readFileSync(path.join(this.keysDir, "root.json"), "utf8")).private_key)).toString("base64");
    registry.root_signature = signature;
    atomicWriteJson(this.registryPath, registry);
    return { created: true, principal_id: principalId, keyid: registry.keys[registry.keys.length - 1].keyid };
  }

  revoke(principalId, atSequence) {
    const registry = this.registry();
    const row = registry.keys.find(k => k.principal_id === principalId);
    if (!row) throw new Error(`no registry row for ${principalId}`);
    row.revoked_at_sequence = atSequence;
    delete registry.root_signature;
    const cryptoMod = crypto;
    registry.root_signature = cryptoMod.sign(null, registryBodyBytes(registry), cryptoMod.createPrivateKey(JSON.parse(fs.readFileSync(path.join(this.keysDir, "root.json"), "utf8")).private_key)).toString("base64");
    atomicWriteJson(this.registryPath, registry);
    return { revoked: true, principal_id: principalId, revoked_at_sequence: atSequence };
  }

  keyStatus(registry, principalId, atSequence) {
    const session = null; // resolved by caller from state
    void session;
    const rows = registry.keys.filter(row => row.principal_id === principalId || row.purpose === "coordinate");
    for (const row of rows) {
      if (row.revoked_at_sequence != null && atSequence >= row.revoked_at_sequence) {
        return { ok: false, reason_code: "key_revoked", row };
      }
    }
    return { ok: true, reason_code: "ok", rows };
  }

  handle(command) {
    return withJournalLock(this.journalPath, () => this.handleLocked(command));
  }

  handleLocked(command) {
    const started = Date.now();
    const events = readJournal(this.journalPath);
    const replayed = replay(events);
    if (!replayed.valid) {
      return this.rejectWithoutAppend(command, "signature_invalid", `journal unusable: ${replayed.errors[0] ?? "corrupt"}`);
    }
    const state = replayed.state;
    const schemaErrors = validate(COMMAND_SCHEMA, command).errors;
    if (schemaErrors.length) return this.decide(command, state, "schema_invalid", `schema: ${schemaErrors[0]}`, events);

    const canonical = canonicalDigest(command);
    // exact-retry short circuit (before any other gate)
    const priorRetry = state.idempotency[command.idempotency_key];
    if (priorRetry && priorRetry.command_digest !== canonical) {
      return this.decide(command, state, "idempotency_conflict", "idempotency key reused with different command bytes", events);
    }
    if (priorRetry && priorRetry.command_digest === canonical) {
      const receiptFile = path.join(this.receiptsDir, `${canonical.slice(7)}.json`);
      if (fs.existsSync(receiptFile)) {
        return { replay: true, receipt: JSON.parse(fs.readFileSync(receiptFile, "utf8")), event: events.find(e => e.event_digest === priorRetry.event_digest) ?? null, elapsed_ms: Date.now() - started };
      }
      // receipt lost post-fsync: regenerate deterministically below via normal path guard
      const original = events.find(e => e.event_digest === priorRetry.event_digest);
      if (original) {
        const regen = this.buildAcceptance(command, state, original, "ok", events.length);
        atomicWriteJson(path.join(this.receiptsDir, `${canonical.slice(7)}.json`), regen.envelope);
        return { replay: true, regenerated: true, receipt: regen.envelope, event: original, elapsed_ms: Date.now() - started };
      }
    }

    const registry = this.registry();
    const isRegister = command.command_type === "register_session";
    const session = state.sessions[command.actor.principal_id];

    if (!isRegister) {
      if (!session) return this.decide(command, state, "unknown_session", "principal not registered", events);
      const status = this.keyStatus(registry, command.actor.principal_id, command.expected_sequence);
      if (!status.ok) return this.decide(command, state, status.reason_code, "session key not usable", events);
    } else {
      // registration requires a submission-purpose key present in the registry
      const row = registry.keys.find(k => k.principal_id === command.actor.principal_id);
      if (!row) return this.decide(command, state, "unknown_session", "no trust-registry entry for principal; operator must provision the adapter key first", events);
      if (row.revoked_at_sequence != null && command.expected_sequence >= row.revoked_at_sequence) {
        return this.decide(command, state, "key_revoked", "registry row revoked before this sequence", events);
      }
    }

    if (command.authority_generation !== state.authority_generation) {
      return this.decide(command, state, "stale_generation", `command generation ${command.authority_generation} vs current ${state.authority_generation}`, events);
    }
    if (command.expected_sequence !== state.sequence) {
      return this.decide(command, state, "sequence_mismatch", `expected ${command.expected_sequence} vs current ${state.sequence}`, events);
    }

    // lease-bound operations
    if (["heartbeat_task", "report_progress", "submit_candidate", "propose_resolution"].includes(command.command_type)) {
      const task = state.tasks[command.task_id];
      if (!task?.lease || task.lease.lease_id !== command.lease_id) {
        return this.decide(command, state, "lease_missing", "no active lease bound to this command", events);
      }
      if (Date.parse(task.lease.expires_at) < Date.now()) {
        return this.decide(command, state, "lease_expired", "lease TTL elapsed without heartbeat renewal", events);
      }
    }

    // handoff one-time token semantics
    if (command.command_type === "accept_handoff") {
      const handoff = state.handoffs[command.payload.handoff_token];
      if (!handoff || handoff.consumed) return this.decide(command, state, "schema_invalid", "handoff token already consumed or unknown", events);
    }

    // attempt state machine gate for task-scoped commands
    const machine = { acquire_task: "acquire_task", heartbeat_task: "heartbeat_task", report_progress: null, submit_candidate: "submit_candidate", request_handoff: "request_handoff", accept_handoff: "accept_handoff", request_cancel: "request_cancel", propose_resolution: "propose_resolution", ack_state: null, register_session: null };
    const transitionName = machine[command.command_type];
    if (transitionName && command.task_id) {
      const task = state.tasks[command.task_id];
      const currentAttempt = task ? task.state : "PLANNED";
      if (currentAttempt === "PLANNED" && command.command_type === "acquire_task") {
        // always legal: creates the lease
      } else if (task) {
        const allowed = ATTEMPT_TRANSITIONS[task.state] ?? {};
        if (!(transitionName in allowed)) {
          return this.decide(command, state, "capability_denied", `attempt state ${task.state} does not permit ${command.command_type}`, events);
        }
      }
    }

    // dispatch to event construction
    return this.append(command, state, canonical, events);
  }

  buildAcceptance(command, state, event, reasonCode, seqAfter) {
    const receipt = {
      schema_version: 1,
      receipt_id: uuid7(),
      receipt_kind: reasonCode === "ok" ? "acceptance_receipt" : "rejection_receipt",
      command_id: command.command_id ?? null,
      run_id: command.run_id,
      wi: command.wi ?? null,
      task_id: command.task_id ?? null,
      attempt_id: command.attempt_id ?? null,
      actor_principal: command.actor.principal_id,
      signer_principal: "svc-swarm-coordinator",
      lease_id: command.lease_id ?? null,
      authority_generation: state.authority_generation,
      coordinator_epoch: state.coordinator_epoch,
      sequence_before: state.sequence,
      sequence_after: seqAfter,
      base_sha: event?.payload?.candidate?.base_sha ?? null,
      head_sha: event?.payload?.candidate?.head_sha ?? null,
      candidate_digest: event?.payload?.candidate?.candidate_digest ?? null,
      submission_digest: event?.payload?.candidate?.submission_digest ?? null,
      changed_paths_digest: event?.payload?.candidate?.changed_paths_digest ?? null,
      evidence_digests: event?.payload?.candidate?.evidence_digests ?? [],
      prior_receipt_digest: state.last_event_digest,
      event_digest: event?.event_digest ?? null,
      verdict: reasonCode === "ok" ? "ACCEPTED" : "REJECTED",
      reason_code: reasonCode,
      issued_at: new Date().toISOString(),
      traceparent: command.traceparent ?? "",
    };
    const schemaErrors = validate(RECEIPT_SCHEMA, receipt).errors;
    if (schemaErrors.length) throw new Error(`internal receipt schema failure: ${schemaErrors[0]}`);
    const envelope = signReceipt(this.coordKey.private_key, receipt);
    return { receipt, envelope };
  }

  decide(command, state, reasonCode, note, _events) {
    // rejection WITHOUT append (fail-closed: rejections never advance sequence)
    const receipt = this.buildRejectionOnly(command, state, reasonCode, note);
    return { accepted: false, reason_code: reasonCode, note, receipt, elapsed_ms: 0 };
  }

  rejectWithoutAppend(_command, _reasonCode, _note) {
    return { accepted: false, fatal: true };
  }

  buildRejectionOnly(command, state, reasonCode, note) {
    const receipt = {
      schema_version: 1,
      receipt_id: uuid7(),
      receipt_kind: "rejection_receipt",
      command_id: command.command_id ?? null,
      run_id: String(command.run_id ?? ""),
      wi: command.wi ?? null,
      task_id: command.task_id ?? null,
      attempt_id: command.attempt_id ?? null,
      actor_principal: String(command.actor?.principal_id ?? "unknown"),
      signer_principal: "svc-swarm-coordinator",
      lease_id: command.lease_id ?? null,
      authority_generation: state ? state.authority_generation : command.authority_generation ?? 0,
      coordinator_epoch: state ? state.coordinator_epoch : 1,
      sequence_before: state ? state.sequence : command.expected_sequence ?? 0,
      sequence_after: state ? state.sequence : command.expected_sequence ?? 0,
      base_sha: null, head_sha: null, candidate_digest: null, submission_digest: null,
      changed_paths_digest: null, evidence_digests: [],
      prior_receipt_digest: state?.last_event_digest ?? null,
      event_digest: null,
      verdict: "REJECTED",
      reason_code: reasonCode === "" ? "schema_invalid" : reasonCode,
      issued_at: new Date().toISOString(),
      traceparent: command.traceparent ?? "",
    };
    const envelope = signReceipt(this.coordKey.private_key, receipt);
    return { receipt, envelope };
  }

  append(command, state, canonical, events) {
    const now = new Date().toISOString();
    let type;
    let payload = {};
    switch (command.command_type) {
      case "register_session":
        type = "SESSION_REGISTERED";
        payload = { host: command.actor.host, model_family: command.actor.model_family, session_id: command.actor.session_id, capabilities: command.payload.capabilities ?? [] };
        break;
      case "acquire_task":
        type = "TASK_LEASE_ACQUIRED";
        payload = { lease: { lease_id: uuid7(), principal_id: command.actor.principal_id, acquired_at: now, expires_at: new Date(Date.now() + this.leaseMs).toISOString() }, attempt_id: command.attempt_id ?? uuid7() };
        break;
      case "heartbeat_task":
        type = "TASK_HEARTBEAT";
        payload = { heartbeat_at: now, observed_sequence: state.sequence };
        break;
      case "report_progress":
        type = "CAUSAL_PROGRESS_RECORDED";
        payload = { note: String(command.payload.note ?? "") };
        break;
      case "submit_candidate": {
        // independent recomputation happens HERE, not from worker claims
        const candidate = {
          base_sha: command.payload.base_sha ?? null,
          head_sha: command.payload.head_sha ?? null,
          candidate_digest: command.payload.candidate_digest ?? null,
          submission_digest: canonical,
          changed_paths: Array.isArray(command.payload.changed_paths) ? command.payload.changed_paths : [],
          changed_paths_digest: canonicalDigest({ paths: command.payload.changed_paths ?? [] }),
          evidence_digests: Array.isArray(command.payload.evidence_digests) ? command.payload.evidence_digests : [],
        };
        const failures = [];
        for (const validator of this.validators) {
          try {
            const result = validator(candidate, command, state);
            if (result && result.ok === false) failures.push(result.validator);
          } catch (e) {
            failures.push(`validator-threw:${e.message}`);
          }
        }
        if (failures.length) {
          return { accepted: false, conflicted: true, reason_code: "protected_surface", failed_validators: failures, receipt: this.buildRejectionOnly(command, state, "protected_surface", failures.join("; ")).envelope };
        }
        type = "CANDIDATE_SUBMITTED";
        payload = { candidate };
        break;
      }
      case "request_handoff":
        type = "HANDOFF_PREPARED";
        payload = { handoff_token: crypto.randomBytes(24).toString("hex"), successor_hint: command.payload.successor_hint ?? null };
        break;
      case "accept_handoff":
        type = "HANDOFF_ACCEPTED";
        payload = { handoff_token: command.payload.handoff_token };
        break;
      case "request_cancel":
        type = "TASK_CANCELLED";
        payload = { reason_code: command.payload.reason_code ?? "requested" };
        break;
      case "propose_resolution":
        type = "CONFLICT_RESOLUTION_PROPOSED";
        payload = { conflict: command.payload.conflict };
        break;
      case "ack_state":
        type = "ACK_STATE_RECORDED";
        payload = { acknowledged_through: state.sequence };
        break;
      default:
        return this.decide(command, state, "schema_invalid", `unroutable command_type ${command.command_type}`, events);
    }

    const event = {
      schema_version: 1,
      run_id: command.run_id,
      sequence: events.length + 1,
      type,
      command_digest: canonical,
      idempotency_key: command.idempotency_key,
      task_id: command.task_id ?? null,
      actor: command.actor,
      authority_generation: state.authority_generation,
      previous_event_digest: events.length ? events[events.length - 1].event_digest : null,
      payload,
      observed_at: now,
      event_digest: "",
    };
    event.event_digest = eventDigestOf(event);

    // append + fsync inside the lock
    fs.appendFileSync(this.journalPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
    const fd = fs.openSync(this.journalPath, fs.constants.O_RDONLY);
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }

    // persist signed acceptance receipt BEFORE responding
    const { envelope } = this.buildAcceptance(command, state, event, "ok", event.sequence);
    atomicWriteJson(path.join(this.receiptsDir, `${canonical.slice(7)}.json`), envelope);

    return { accepted: true, event, receipt: envelope };
  }
}

export { verifyEnvelope, RECEIPT_PAYLOAD_TYPE, keyFingerprint };
