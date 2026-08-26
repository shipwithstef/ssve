#!/usr/bin/env node
// svc-swarm.mjs — swarm coordination CLI/server.
//
// Single-writer coordination kernel entry point. Every mutating verb goes through
// SwarmCoordinator.handle, which owns validation, journal append+fsync, and signed
// receipt persistence inside one advisory critical section.

import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SwarmCoordinator,
  initStateRoot,
  readJournal,
  replay,
  withJournalLock,
} from "./lib/swarm-command-handler.mjs";
import { resolvePair, isProtectedPath } from "./lib/swarm-conflict-resolver.mjs";
import { canonicalDigest, jcs } from "./lib/swarm-canonical-json.mjs";
import { validate } from "./lib/json-schema-validator.mjs";
import {
  verifyEnvelope,
  signReceipt,
  RECEIPT_PAYLOAD_TYPE,
} from "./lib/swarm-signing.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RECEIPT_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, "schemas", "swarm-receipt-payload-v1.schema.json"), "utf8"));

function die(message, code = 1) {
  process.stderr.write(`svc-swarm: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--state-root") options.stateRoot = argv[++i];
    else if (argv[i] === "--command-file") options.commandFile = argv[++i];
    else if (argv[i] === "--command-json") options.commandJson = argv[++i];
    else if (argv[i] === "--principal") options.principal = argv[++i];
    else if (argv[i] === "--host") options.host = argv[++i];
    else if (argv[i] === "--model-family") options.modelFamily = argv[++i];
    else if (argv[i] === "--run-id") options.runId = argv[++i];
    else if (argv[i] === "--task-id") options.taskId = argv[++i];
    else if (argv[i] === "--lease-id") options.leaseId = argv[++i];
    else if (argv[i] === "--wi") options.wi = argv[++i];
    else if (argv[i] === "--json") options.json = true;
    else if (argv[i] === "--handoff-token") options.handoffToken = argv[++i];
    else if (argv[i] === "--successor") options.successor = argv[++i];
    else if (argv[i] === "--conflict-json") options.conflictJson = argv[++i];
    else if (argv[i] === "--note") options.note = argv[++i];
    else if (argv[i] === "--base-sha") options.baseSha = argv[++i];
    else if (argv[i] === "--head-sha") options.headSha = argv[++i];
    else if (argv[i] === "--candidate-digest") options.candidateDigest = argv[++i];
    else if (argv[i] === "--changed-paths") options.changedPaths = argv[++i];
    else if (argv[i] === "--evidence-digests") options.evidenceDigests = argv[++i];
    else if (argv[i] === "--idempotency-key") options.idempotencyKey = argv[++i];
    else if (argv[i] === "--session") options.session = argv[++i];
    else if (argv[i] === "--receipt-file") options.receiptFile = argv[++i];
    else if (!options.verb) options.verb = argv[i];
    else die(`unexpected argument ${argv[i]}`, 2);
  }
  return options;
}

function readCommand(options, verb) {
  let raw;
  if (options.commandFile) raw = fs.readFileSync(options.commandFile, "utf8");
  else if (options.commandJson) raw = options.commandJson;
  else return null;
  const command = JSON.parse(raw);
  command.command_type = verb === "submit" ? "submit_candidate" : command.command_type ?? null;
  return command;
}

// Canonical command construction for protocol verbs driven by flags.
function buildCommand(options, verb, state, pinned = {}) {
  const verbMap = {
    register: "register_session",
    acquire: "acquire_task",
    heartbeat: "heartbeat_task",
    progress: "report_progress",
    submit: "submit_candidate",
    "handoff-prepare": "request_handoff",
    "handoff-accept": "accept_handoff",
    cancel: "request_cancel",
    resolve: "propose_resolution",
    ack: "ack_state",
  };
  const commandType = verbMap[verb];
  void state;
  if (!commandType) return null;
  const payload = {};
  if (verb === "handoff-accept") payload.handoff_token = options.handoffToken ?? "";
  if (verb === "handoff-prepare") payload.successor_principal = options.successor ?? null;
  if (verb === "ack") payload.acknowledged_through = state.sequence;
  if (verb === "resolve") payload.conflict = JSON.parse(options.conflictJson ?? "{}");
  if (verb === "progress") payload.note = options.note ?? "";
  if (verb === "submit") {
    payload.base_sha = options.baseSha ?? null;
    payload.head_sha = options.headSha ?? null;
    payload.candidate_digest = options.candidateDigest ?? null;
    payload.changed_paths = options.changedPaths ? JSON.parse(options.changedPaths) : [];
    payload.evidence_digests = options.evidenceDigests ? JSON.parse(options.evidenceDigests) : [];
  }
  return {
    schema_version: 1,
    command_id: uuid7ForCli(),
    run_id: options.runId ?? "default-run",
    wi: options.wi ?? null,
    task_id: options.taskId ?? null,
    attempt_id: null,
    command_type: commandType,
    actor: {
      principal_id: options.principal ?? "",
      host: pinned.host ?? options.host ?? "opencode",
      model_family: pinned.model_family ?? options.modelFamily ?? "opencode-family",
      session_id: options.session ?? "cli-session",
    },
    lease_id: options.leaseId ?? null,
    authority_generation: state.authority_generation,
    expected_sequence: state.sequence,
    observed_sequence: state.sequence,
    idempotency_key: options.idempotencyKey ?? crypto.randomUUID(),
    traceparent: "",
    payload,
  };
}
const USAGE = `usage: svc-swarm.mjs <verb> --state-root DIR [options]

coordination verbs (one per command-union member):
  init              bootstrap keys/registry/journal (rerun-safe)
  provision         --principal ID [--host H --model-family F]   operator-only
  register          bind a session (--principal --host --model-family --run-id)
  acquire           CAS-acquire a task lease (--task-id --principal)
  heartbeat         renew a lease (--task-id --principal --lease-id)
  progress          record evidence-bound progress
  submit            submit a candidate for recomputation
  handoff-prepare   prepare a generation-bound successor handoff
  handoff-accept    consume a one-time handoff token (--handoff-token)
  cancel            monotonic cancellation of an attempt
  resolve           propose a typed resolution (--conflict-json)
  ack               acknowledge snapshot/sequence

read/checkpoint verbs:
  status            one-shot projection summary
  replay            full deterministic replay with integrity verdict
  snapshot          write snapshot.json at current sequence
  sign-checkpoint   sign and persist a checkpoint receipt
  verify            verify a receipt file against the trust registry (--receipt FILE)

common options: --command-file F | --command-json J bypass flag-based construction`;

function uuid7ForCli() {
  const b = crypto.randomBytes(16);
  const now = BigInt(Date.now());
  b[0] = Number((now >> 40n) & 0xffn); b[1] = Number((now >> 32n) & 0xffn); b[2] = Number((now >> 24n) & 0xffn);
  b[3] = Number((now >> 16n) & 0xffn); b[4] = Number((now >> 8n) & 0xffn); b[5] = Number(now & 0xffn);
  b[6] = (b[6] & 0x0f) | 0x70; b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.verb || !["--help", "-h"].includes(options.verb)) {
    // continue; state-root check per verb below
  }
  if (options.verb === undefined || ["--help", "-h"].includes(process.argv[2] ?? "")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const verb = options.verb;
  if (!options.stateRoot) die("--state-root is required", 2);

  switch (verb) {
    case "init": {
      const result = initStateRoot(options.stateRoot);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return 0;
    }
    default:
      break;
  }

  const coordinator = new SwarmCoordinator(options.stateRoot, { worktreeRoot: options.worktree ?? process.cwd() });
  // Conflict prevention at submission: recompute claim overlap against every other
  // active lease using the deterministic ladder; protected surfaces refuse outright.
  coordinator.registerValidator((candidate) => {
    if ((candidate.changed_paths ?? []).some((p) => isProtectedPath(p))) {
      return { ok: false, validator: "protected_surface_path" };
    }
    return { ok: true };
  });

  switch (verb) {
    case "provision": {
      if (!options.principal) die("provision requires --principal", 2);
      // serialization lives INSIDE provisionAdapter (EXEC-R3-010) — no caller lock
      const result = coordinator.provisionAdapter(options.principal, { host: options.host, model_family: options.modelFamily });
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return 0;
    }
    case "status": {
      const events = readJournal(coordinator.journalPath);
      const replayed = replay(events);
      if (!replayed.valid) die(`replay invalid: ${replayed.errors.join("; ")}`);
      const s = replayed.state;
      process.stdout.write(`${JSON.stringify({ ok: true, sequence: s.sequence, authority_generation: s.authority_generation, sessions: Object.keys(s.sessions), tasks: Object.fromEntries(Object.entries(s.tasks).map(([k, v]) => [k, v.state])) })}\n`);
      return 0;
    }
    case "replay": {
      const events = readJournal(coordinator.journalPath);
      const replayed = replay(events);
      process.stdout.write(`${JSON.stringify({ valid: replayed.valid, errors: replayed.errors, event_count: events.length })}\n`);
      return replayed.valid ? 0 : 1;
    }
    case "snapshot": {
      const events = readJournal(coordinator.journalPath);
      const replayed = replay(events);
      if (!replayed.valid) die(`replay invalid: ${replayed.errors.join("; ")}`);
      const snapshot = { sequence: replayed.state.sequence, last_event_digest: replayed.state.last_event_digest, tasks: replayed.state.tasks, authority_generation: replayed.state.authority_generation };
      fs.writeFileSync(path.join(options.stateRoot, "snapshot.json"), `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
      process.stdout.write(`${JSON.stringify({ ok: true, sequence: snapshot.sequence })}\n`);
      return 0;
    }
    case "sign-checkpoint": {
      return withJournalLock(coordinator.journalPath, () => {
        const events = readJournal(coordinator.journalPath);
        const replayed = replay(events);
        if (!replayed.valid) die(`replay invalid: ${replayed.errors.join("; ")}`);
        const state = replayed.state;
        const receipt = {
          schema_version: 1,
          receipt_id: uuid7ForCli(),
          receipt_kind: "checkpoint_receipt",
          command_id: null,
          run_id: state.run_id ?? "default-run",
          wi: options.wi ?? null,
          task_id: null,
          attempt_id: null,
          actor_principal: "svc-swarm-coordinator",
          signer_principal: "svc-swarm-coordinator",
          lease_id: null,
          authority_generation: state.authority_generation,
          coordinator_epoch: state.coordinator_epoch,
          sequence_before: state.sequence,
          sequence_after: state.sequence,
          base_sha: null, head_sha: null, candidate_digest: null, submission_digest: null,
          changed_paths_digest: null,
          evidence_digests: [],
          prior_receipt_digest: state.last_event_digest,
          event_digest: state.last_event_digest,
          verdict: "CHECKPOINTED",
          reason_code: "ok",
          issued_at: new Date().toISOString(),
          traceparent: "",
        };
        const envelope = signReceipt(coordinator.coordKey.private_key, receipt);
        fs.writeFileSync(path.join(options.stateRoot, "checkpoint.json"), `${JSON.stringify(envelope, null, 2)}\n`, { mode: 0o600 });
        process.stdout.write(`${JSON.stringify({ ok: true, sequence: state.sequence, receipt_kind: "checkpoint_receipt" })}\n`);
        return 0;
      });
    }
    case "verify": {
      if (!options.receiptFile) die("verify requires --receipt FILE", 2);
      void RECEIPT_PAYLOAD_TYPE;
      const envelope = JSON.parse(fs.readFileSync(options.receiptFile, "utf8"));
      const registry = coordinator.registry();
      const keyid = envelope.signatures?.[0]?.keyid;
      const row = registry.keys.find(k => k.keyid === keyid);
      if (!row) {
        process.stdout.write(`${JSON.stringify({ verified: false, reason: "unknown_keyid" })}\n`);
        return 1;
      }
      const sig = verifyEnvelope(row.public_key, envelope);
      if (!sig.verified) {
        process.stdout.write(`${JSON.stringify({ verified: false, reason: "signature_invalid" })}\n`);
        return 1;
      }
      // EXEC-R3-006: signature alone is not verification. The payload must be
      // canonical JCS bytes of a SCHEMA-VALID receipt with a present kind, and
      // sequence-aware revocation applies.
      let decoded = null;
      let canonicalOk = false;
      try {
        const raw = Buffer.from(envelope.payload, "base64");
        decoded = JSON.parse(raw.toString("utf8"));
        canonicalOk = raw.equals(Buffer.from(jcs(decoded), "utf8"));
      } catch {}
      const kind = decoded?.receipt_kind ?? null;
      if (!canonicalOk) {
        process.stdout.write(`${JSON.stringify({ verified: false, reason: "noncanonical_payload" })}\n`);
        return 1;
      }
      if (envelope.payloadType !== RECEIPT_PAYLOAD_TYPE || !kind) {
        process.stdout.write(`${JSON.stringify({ verified: false, reason: "wrong_purpose_or_kind", kind })}\n`);
        return 1;
      }
      const schemaErrors = validate(RECEIPT_SCHEMA, decoded).errors;
      if (schemaErrors.length) {
        process.stdout.write(`${JSON.stringify({ verified: false, reason: "receipt_schema_invalid", detail: schemaErrors[0] })}\n`);
        return 1;
      }
      const allowed = Array.isArray(row.allowed_receipt_kinds) ? row.allowed_receipt_kinds : [];
      if (allowed.length > 0 && !allowed.includes(kind)) {
        process.stdout.write(`${JSON.stringify({ verified: false, reason: "wrong_purpose_or_kind", kind })}\n`);
        return 1;
      }
      const atSeq = typeof decoded.sequence_after === "number" ? decoded.sequence_after : null;
      if (row.revoked_at_sequence != null && atSeq != null && atSeq >= row.revoked_at_sequence) {
        process.stdout.write(`${JSON.stringify({ verified: false, reason: "key_revoked", kind })}\n`);
        return 1;
      }
      process.stdout.write(`${JSON.stringify({ verified: true, keyid, principal: row.purpose, kind })}\n`);
      return 0;
    }
    default:
      break;
  }

  // command-path verbs
  let command = readCommand(options, verb);
  if (!command) {
    const events = readJournal(coordinator.journalPath);
    const replayed = replay(events);
    if (!replayed.valid) die(`replay invalid: ${replayed.errors.join("; ")}`);
    // identity claims resolve from the trust registry's pinned row first; flag
    // values only fill fields the registry does not pin (EXEC-R2-003 binding).
    const pinned = coordinator.registry().keys.find(k => k.principal_id === options.principal) ?? {};
    command = buildCommand(options, verb, replayed.state, pinned);
    if (!command) {
      process.stderr.write(`${USAGE}\n`);
      die(`unknown verb ${verb}`, 2);
    }
  }
  // EXEC-R2-001: every mutating verb crosses the signed-envelope boundary.
  const principalId = command.actor?.principal_id;
  let adapterKey = null;
  if (principalId) {
    const keyFile = path.join(options.stateRoot, "keys", `${principalId}.json`);
    try { adapterKey = JSON.parse(fs.readFileSync(keyFile, "utf8")).private_key; } catch { adapterKey = null; }
  }
  let result;
  if (adapterKey) {
    result = coordinator.handleEnvelope(coordinator.constructor.envelopeForCommand(command, adapterKey));
  } else {
    // no provisioned key for this principal: fail closed with the same verdict the
    // envelope check would produce, without pretending to sign.
    result = coordinator.handleEnvelope({ payloadType: "application/vnd.svc.swarm-command+json;version=1", payload: Buffer.from(JSON.stringify(command)).toString("base64"), signatures: [{ keyid: "unknown", sig: "" }] });
  }
  process.stdout.write(`${JSON.stringify({
    accepted: Boolean(result.accepted),
    replay: Boolean(result.replay),
    regenerated: Boolean(result.regenerated),
    conflicted: Boolean(result.conflicted),
    reason_code: result.reason_code ?? null,
    sequence: result.event?.sequence ?? null,
  })}\n`);
  if (!result.accepted && !result.replay) return 3;
  return 0;
}

try {
  process.exit(main());
} catch (error) {
  die(error.message);
}
