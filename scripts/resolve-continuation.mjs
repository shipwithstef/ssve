#!/usr/bin/env node
/**
 * resolve-continuation.mjs — WI-552 autonomous restart-boundary continuation
 * lifecycle controller.
 *
 * Persists a hash-bound continuation baton before land/deploy, launches the
 * configured fresh-session transport EXACTLY ONCE through the WI-551 owner
 * dispatch resolver (role "verify.restart"), consumes structured child
 * evidence, and closes out. No owner copy/paste. No silent Claude/Codex
 * remap: if the resolver has no route or the target host lacks the
 * `fresh_session_launch` capability, this returns one explicit
 * capability-limited blocker.
 *
 * State: an append-only, hash-chained event ledger at
 *   .svc/continuation/<WI>.ledger.jsonl
 * The current baton is always the fold of that ledger — this is what makes
 * `reconcile` crash-safe (AC-552-9): a fresh process re-derives the exact
 * same state from receipts, never from memory.
 *
 * Commands:
 *   create        --wi --host --event --proof-query [--kind] [--not-before]
 *                 [--max-launches] [--forbidden-phases csv] [--task-graph]
 *                 [--next-task] [--run-id] [--session-id]
 *   stamp-deploy  --wi --merge-sha [--deploy-receipt-at]
 *   launch        --wi [--orchestrator] [--fake] [--child-session-id]
 *                 [--dispatch-policy ...same flags as resolve-dispatch...]
 *   consume       --wi --result <json-string-or-path>
 *   reconcile     --wi [--fake] [--orchestrator] [--now]
 *   status        --wi
 *   deny-check    --wi --skill [--session-id]
 *
 * Out of scope (per WI-552 Boundaries): re-implementing WI-502 authority,
 * Execution Controller v2, and dispatch policy itself (WI-551) — this module
 * only ASKS scripts/resolve-dispatch.mjs, never reimplements it.
 */

import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validate } from './lib/json-schema-validator.mjs';
import { resolveDispatchRoleTuple } from './resolve-dispatch.mjs';
import { withStateLock } from './state-io.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BATON_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/continuation-baton.schema.json'), 'utf8'));
const RESULT_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/continuation-result.schema.json'), 'utf8'));

export const DEFAULT_FORBIDDEN_PHASES = ['diagnose-bug', 'plan-changeset', 'execute-changeset'];
export const DISPATCH_ROLE = 'verify.restart';
const BOUNDARY_KINDS = new Set(['fresh_process', 'service_restart', 'host_session_start', 'post_install_bootstrap']);

function fail(message, code = 'continuation_invalid') {
  const error = new Error(`resolve-continuation: ${message}`);
  error.code = code;
  throw error;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(canonical(value)).digest('hex');
}

function ledgerRoot(cwd = process.cwd()) {
  return path.join(path.resolve(cwd), '.svc', 'continuation');
}

function ledgerPath(wi, cwd = process.cwd()) {
  if (!String(wi || '').trim()) fail('a WI id is required', 'continuation_input_invalid');
  return path.join(ledgerRoot(cwd), `${wi}.ledger.jsonl`);
}

function readLedger(wi, cwd = process.cwd()) {
  const file = ledgerPath(wi, cwd);
  if (!fs.existsSync(file)) return [];
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// Hash-chained append: every entry binds to the previous entry's hash, so the
// ledger is tamper-evident and the baton is "hash-bound" by construction —
// its identity IS the fold of this chain, not a mutable JSON blob.
function appendEvent(wi, type, payload, cwd = process.cwd()) {
  const file = ledgerPath(wi, cwd);
  // Single lock covers read-modify-append as one transaction (concurrent
  // appenders must not compute the same seq/prev_sha256). Raw fs append
  // here, NOT the shared appendJsonlLine helper, which takes its own lock
  // on this same path and would deadlock nested under this one.
  return withStateLock(file, () => {
    const entries = readLedger(wi, cwd);
    const prevHash = entries.length ? entries[entries.length - 1].event_sha256 : null;
    const base = {
      schema_version: 1,
      wi,
      seq: entries.length + 1,
      type,
      prev_sha256: prevHash,
      recorded_at: new Date().toISOString(),
      ...payload,
    };
    const event_sha256 = hash(base);
    const entry = { ...base, event_sha256 };
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`, 'utf8');
    return entry;
  });
}

// Folds the append-only ledger into the current baton view. This is the
// single source of truth `status`/`launches`/`result` are derived from —
// never mutated directly, always re-derived (crash-safe by construction).
export function foldBaton(entries) {
  let baton = null;
  for (const entry of entries) {
    if (entry.type === 'baton_created') {
      baton = {
        wi: entry.wi,
        run_id: entry.run_id,
        task_graph_path: entry.task_graph_path || null,
        next_task_id: entry.next_task_id || null,
        boundary: entry.boundary,
        max_launches: entry.max_launches,
        forbidden_phases: entry.forbidden_phases,
        dispatch_role: entry.dispatch_role,
        implementation_session_id: entry.implementation_session_id,
        status: 'pending',
        created_at: entry.recorded_at,
        generation: 1,
        baton_sha256: entry.event_sha256,
        merge_sha: null,
        deploy_receipt_at: null,
        launches: [],
        result: null,
        block_reason: null,
        block_code: null,
      };
      continue;
    }
    if (!baton) continue; // events before creation are unreachable but never trusted
    if (entry.type === 'deploy_stamped') {
      baton.merge_sha = entry.merge_sha;
      baton.deploy_receipt_at = entry.deploy_receipt_at;
      baton.status = 'deploy_stamped';
      baton.generation += 1;
    } else if (entry.type === 'launch_blocked') {
      baton.launches.push({
        attempt: entry.attempt, blocked: true, reason: entry.reason, code: entry.code, at: entry.recorded_at,
      });
      baton.status = 'blocked';
      baton.block_reason = entry.reason;
      baton.block_code = entry.code;
      baton.generation += 1;
    } else if (entry.type === 'launch_receipted') {
      baton.launches.push({
        attempt: entry.attempt,
        blocked: false,
        session_id: entry.session_id,
        pid: entry.pid,
        transport: entry.transport,
        tuple: entry.tuple,
        started_at: entry.started_at,
        config_sha256: entry.config_sha256,
        launch_command: entry.launch_command || null,
        fake: Boolean(entry.fake),
      });
      baton.status = 'launched';
      baton.generation += 1;
    } else if (entry.type === 'result_received') {
      baton.result = entry.result;
      baton.status = entry.result.verdict === 'pass' ? 'closed_pass' : 'closed_fail';
      baton.generation += 1;
    }
  }
  return baton;
}

export function readBaton(wi, cwd = process.cwd()) {
  return foldBaton(readLedger(wi, cwd));
}

function latestLaunch(baton) {
  if (!baton || !Array.isArray(baton.launches) || baton.launches.length === 0) return null;
  return baton.launches[baton.launches.length - 1];
}

function launchAttemptCount(baton) {
  return baton && Array.isArray(baton.launches) ? baton.launches.length : 0;
}

function successfulLaunchCount(baton) {
  return baton && Array.isArray(baton.launches) ? baton.launches.filter((entry) => !entry.blocked).length : 0;
}

// ---------------------------------------------------------------------------
// create — persist the hash-bound baton BEFORE land/deploy (AC-552-2/9).
// Idempotent: re-creating for the same WI with the exact same core fields is
// a no-op; a differing re-create for an existing WI is refused so the baton
// identity cannot be silently swapped out from under a launch in flight.
// ---------------------------------------------------------------------------
export function createBaton(options = {}) {
  const wi = String(options.wi || '').trim();
  if (!wi) fail('create requires --wi', 'continuation_input_invalid');
  const cwd = options.cwd || process.cwd();
  const existing = readBaton(wi, cwd);
  const boundary = {
    kind: options.kind || 'host_session_start',
    host: String(options.host || '').trim(),
    event: String(options.event || '').trim(),
    proof_query: String(options.proofQuery || options['proof-query'] || '').trim(),
    not_before: options.notBefore || options['not-before'] || null,
  };
  if (!BOUNDARY_KINDS.has(boundary.kind)) fail(`boundary.kind must be one of ${[...BOUNDARY_KINDS].join(', ')}`, 'continuation_input_invalid');
  if (!boundary.host) fail('create requires --host', 'continuation_input_invalid');
  if (!boundary.event) fail('create requires --event', 'continuation_input_invalid');
  if (!boundary.proof_query) fail('create requires --proof-query', 'continuation_input_invalid');
  const forbiddenPhases = options.forbiddenPhases
    ? String(options.forbiddenPhases).split(',').map((entry) => entry.trim()).filter(Boolean)
    : [...DEFAULT_FORBIDDEN_PHASES];
  const maxLaunches = Number.isInteger(options.maxLaunches) ? options.maxLaunches : Number(options.maxLaunches || 1);
  if (!Number.isInteger(maxLaunches) || maxLaunches < 1) fail('max_launches must be a positive integer', 'continuation_input_invalid');
  const implementationSessionId = String(
    options.sessionId || process.env.SVC_SESSION_ID || ''
  ).trim();
  if (!implementationSessionId) fail('create requires --session-id or SVC_SESSION_ID (the IMPLEMENTATION session, so the proof session can be proven different)', 'continuation_input_invalid');
  const runId = String(options.runId || `${wi}-${crypto.randomUUID()}`);
  const payload = {
    run_id: runId,
    task_graph_path: options.taskGraph || null,
    next_task_id: options.nextTask || null,
    boundary,
    max_launches: maxLaunches,
    forbidden_phases: forbiddenPhases,
    dispatch_role: DISPATCH_ROLE,
    implementation_session_id: implementationSessionId,
  };
  const schemaResult = validate(BATON_SCHEMA, { schema_version: 1, wi, ...payload });
  if (!schemaResult.valid) fail(`baton schema violation: ${schemaResult.errors.join('; ')}`, 'continuation_invalid');

  if (existing) {
    const sameCore = existing.boundary.kind === boundary.kind
      && existing.boundary.host === boundary.host
      && existing.boundary.event === boundary.event
      && existing.boundary.proof_query === boundary.proof_query
      && existing.max_launches === maxLaunches
      && existing.implementation_session_id === implementationSessionId
      && JSON.stringify(existing.forbidden_phases) === JSON.stringify(forbiddenPhases);
    if (sameCore) return { ok: true, created: false, baton: existing };
    fail(`a continuation baton already exists for ${wi} with different core fields — hash-bound identity cannot be swapped in place`, 'continuation_conflict');
  }
  appendEvent(wi, 'baton_created', payload, cwd);
  return { ok: true, created: true, baton: readBaton(wi, cwd) };
}

// ---------------------------------------------------------------------------
// stamp-deploy — bind the baton to the exact merge SHA + deploy receipt time.
// Everything downstream (not_before, freshness) is measured from this.
// ---------------------------------------------------------------------------
export function stampDeploy(options = {}) {
  const wi = String(options.wi || '').trim();
  if (!wi) fail('stamp-deploy requires --wi', 'continuation_input_invalid');
  const cwd = options.cwd || process.cwd();
  const mergeSha = String(options.mergeSha || options['merge-sha'] || '').trim();
  if (!mergeSha) fail('stamp-deploy requires --merge-sha', 'continuation_input_invalid');
  const deployReceiptAt = options.deployReceiptAt || options['deploy-receipt-at'] || new Date().toISOString();
  const baton = readBaton(wi, cwd);
  if (!baton) fail(`no continuation baton exists for ${wi} — call create first`, 'continuation_missing');
  if (baton.merge_sha) {
    if (baton.merge_sha === mergeSha && baton.deploy_receipt_at === deployReceiptAt) {
      return { ok: true, stamped: false, baton };
    }
    fail(`baton for ${wi} is already deploy-stamped at ${baton.merge_sha} — cannot rebind`, 'continuation_conflict');
  }
  appendEvent(wi, 'deploy_stamped', { merge_sha: mergeSha, deploy_receipt_at: deployReceiptAt }, cwd);
  return { ok: true, stamped: true, baton: readBaton(wi, cwd) };
}

function hostManifestPath(host, cwd) {
  return path.join(path.resolve(cwd), 'provision', 'hosts', `${host}.json`);
}

function readHostCapability(host, cwd) {
  const file = hostManifestPath(host, cwd);
  if (!fs.existsSync(file)) return { present: false, enabled: false, manifest: null };
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { present: false, enabled: false, manifest: null };
  }
  const capability = manifest.authority_capabilities?.fresh_session_launch;
  if (!capability || typeof capability !== 'object') return { present: false, enabled: false, manifest };
  return { present: true, enabled: capability.enabled === true, manifest, capability };
}

// ---------------------------------------------------------------------------
// launch — ask the WI-551 resolver for role "verify.restart", then launch
// EXACTLY ONCE through the target host's declared fresh_session_launch
// transport. Never remaps to Claude/Codex: a missing route or missing host
// capability is one explicit blocked event, not a fallback.
// ---------------------------------------------------------------------------
export function launch(options = {}) {
  const wi = String(options.wi || '').trim();
  if (!wi) fail('launch requires --wi', 'continuation_input_invalid');
  const cwd = options.cwd || process.cwd();
  const baton = readBaton(wi, cwd);
  if (!baton) fail(`no continuation baton exists for ${wi}`, 'continuation_missing');
  if (baton.status === 'closed_pass' || baton.status === 'closed_fail') {
    return { ok: true, action: 'already-closed', baton };
  }
  if (baton.status === 'launched') {
    // AC-552-3: never spawn a second session while one is outstanding.
    return { ok: true, action: 'already-launched', baton, launch: latestLaunch(baton) };
  }
  if (baton.status === 'pending') {
    return { ok: false, action: 'waiting-for-deploy', baton };
  }
  const notBefore = baton.boundary.not_before || baton.deploy_receipt_at;
  const now = options.now ? new Date(options.now) : new Date();
  if (notBefore && now.getTime() < Date.parse(notBefore)) {
    return { ok: false, action: 'not-yet-eligible', baton, not_before: notBefore };
  }
  if (launchAttemptCount(baton) >= baton.max_launches) {
    // Bounded failure: exhausted budget returns the same terminal state,
    // never an unbounded retry loop.
    return { ok: false, action: 'launch-budget-exhausted', baton };
  }
  const attempt = launchAttemptCount(baton) + 1;

  let resolved;
  try {
    resolved = resolveDispatchRoleTuple({
      role: DISPATCH_ROLE,
      orchestrator: options.orchestrator || process.env.SVC_HOST || 'cursor',
      configPath: options.dispatchPolicyPath || options['dispatch-policy'] || null,
      mode: options.mode || null,
      wi,
      sessionId: baton.implementation_session_id,
      workOverlayPath: options.workOverlayPath || null,
    });
  } catch (error) {
    appendEvent(wi, 'launch_blocked', {
      attempt,
      reason: `dispatch resolver refused role "${DISPATCH_ROLE}": ${error.message}`,
      code: error.code || 'dispatch_error',
    }, cwd);
    return { ok: false, action: 'blocked', baton: readBaton(wi, cwd) };
  }

  const targetHost = resolved.tuple.host;
  if (baton.boundary.host && baton.boundary.host !== targetHost) {
    // AC-552-6: the resolver's answer is authoritative. If the owner policy
    // resolved a DIFFERENT host than the boundary declared, that is the
    // owner's call (policy changed) — proceed with the resolver's host,
    // never silently substitute the boundary's stale host.
  }
  const capability = readHostCapability(targetHost, cwd);
  if (!capability.present || !capability.enabled) {
    appendEvent(wi, 'launch_blocked', {
      attempt,
      reason: capability.present
        ? `host "${targetHost}" declares fresh_session_launch but it is disabled`
        : `host "${targetHost}" does not declare a fresh_session_launch capability`,
      code: 'capability_limited',
    }, cwd);
    return { ok: false, action: 'blocked', baton: readBaton(wi, cwd) };
  }

  const fake = Boolean(options.fake);
  const childSessionId = String(
    options.childSessionId || options['child-session-id']
    || `svc-continuation-${wi.toLowerCase()}-${crypto.randomUUID()}`
  );
  if (childSessionId === baton.implementation_session_id) {
    fail('generated child session id collided with the implementation session id', 'continuation_invalid');
  }
  const configDigest = hash({ tuple: resolved.tuple, boundary: baton.boundary, attempt });
  const launchCommand = capability.capability?.launch_command || null;
  let pid = null;
  if (!fake && launchCommand) {
    // Best-effort real transport: fire-and-forget, never awaited (the whole
    // point is a NEW process/session). Live host wiring/fixtures are WI-546's
    // unit budget, not WI-552's (AC-552-10) — this call site is the seam.
    try {
      const child = spawn('bash', ['-lc', launchCommand], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, SVC_SESSION_ID: childSessionId, SVC_WI: wi, SVC_CONTINUATION_TOKEN: configDigest },
      });
      child.unref();
      pid = child.pid || null;
    } catch (error) {
      appendEvent(wi, 'launch_blocked', {
        attempt,
        reason: `launch command for host "${targetHost}" failed to start: ${error.message}`,
        code: 'launch_spawn_failed',
      }, cwd);
      return { ok: false, action: 'blocked', baton: readBaton(wi, cwd) };
    }
  }
  const entry = appendEvent(wi, 'launch_receipted', {
    attempt,
    session_id: childSessionId,
    pid,
    transport: targetHost,
    tuple: resolved.tuple,
    started_at: new Date().toISOString(),
    config_sha256: configDigest,
    launch_command: launchCommand,
    fake,
  }, cwd);
  return { ok: true, action: 'launched', baton: readBaton(wi, cwd), entry };
}

// ---------------------------------------------------------------------------
// consume — validate and bind the child's structured result. Rejects stale,
// foreign, or free-text results (AC-552-2/7).
// ---------------------------------------------------------------------------
export function consume(options = {}) {
  const wi = String(options.wi || '').trim();
  if (!wi) fail('consume requires --wi', 'continuation_input_invalid');
  const cwd = options.cwd || process.cwd();
  let result = options.result;
  if (typeof result === 'string') {
    const trimmed = result.trim();
    if (trimmed.startsWith('{')) {
      try {
        result = JSON.parse(trimmed);
      } catch {
        fail('consume requires a structured result object — free text ("looks good", "prompt to send") is not valid evidence', 'continuation_result_invalid');
      }
    } else if (fs.existsSync(trimmed) && fs.statSync(trimmed).isFile()) {
      try {
        result = JSON.parse(fs.readFileSync(trimmed, 'utf8'));
      } catch {
        fail(`consume result file "${trimmed}" is not valid JSON`, 'continuation_result_invalid');
      }
    } else {
      fail('consume requires a structured result object — free text ("looks good", "prompt to send") is not valid evidence', 'continuation_result_invalid');
    }
  }
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    fail('consume requires a structured result object — free text ("looks good", "prompt to send") is not valid evidence', 'continuation_result_invalid');
  }
  const schemaResult = validate(RESULT_SCHEMA, result);
  if (!schemaResult.valid) fail(`result schema violation: ${schemaResult.errors.join('; ')}`, 'continuation_result_invalid');

  const baton = readBaton(wi, cwd);
  if (!baton) fail(`no continuation baton exists for ${wi}`, 'continuation_missing');
  if (baton.status === 'closed_pass' || baton.status === 'closed_fail') {
    const sameResult = JSON.stringify(baton.result) === JSON.stringify(result);
    if (sameResult) return { ok: true, action: 'already-closed', baton };
    fail(`baton for ${wi} is already closed with a different result`, 'continuation_conflict');
  }
  if (baton.status !== 'launched') fail(`baton for ${wi} has no outstanding launch to consume (status=${baton.status})`, 'continuation_no_launch');
  const launchEntry = latestLaunch(baton);

  // Freshness (AC-552-2): the proof session must differ from the
  // implementation session, must be the EXACT session this launch created,
  // and must start strictly after the deploy receipt.
  if (result.session_id === baton.implementation_session_id) {
    fail('result session_id equals the implementation session — this is not a fresh session', 'continuation_stale');
  }
  if (result.session_id !== launchEntry.session_id) {
    fail(`result session_id does not match the launched session (expected ${launchEntry.session_id})`, 'continuation_foreign_session');
  }
  const startedAt = Date.parse(result.started_at);
  const deployAt = Date.parse(baton.deploy_receipt_at);
  if (!Number.isFinite(startedAt) || !Number.isFinite(deployAt) || startedAt <= deployAt) {
    fail('result started_at is not strictly after the deploy receipt timestamp', 'continuation_stale');
  }
  if (result.proof_query !== baton.boundary.proof_query) {
    fail(`result proof_query "${result.proof_query}" does not match the declared boundary proof_query "${baton.boundary.proof_query}"`, 'continuation_proof_mismatch');
  }

  // Mechanical defense-in-depth: even if the PreToolUse phase guard was
  // bypassed, a child that reports having executed a forbidden phase cannot
  // close the baton as if it were in scope (AC-552-4).
  const executed = Array.isArray(result.tasks_executed) ? result.tasks_executed : [];
  const forbiddenHit = executed.find((task) => baton.forbidden_phases.includes(task));
  if (forbiddenHit) {
    fail(`result reports executing forbidden phase "${forbiddenHit}" outside the delegated scope`, 'continuation_scope_violation');
  }

  appendEvent(wi, 'result_received', { result }, cwd);
  return { ok: true, action: 'closed', baton: readBaton(wi, cwd) };
}

// ---------------------------------------------------------------------------
// reconcile — idempotent resume. Never spawns a second session when a valid
// launch/result receipt exists (AC-552-3); resumes correctly after parent
// process death because state lives entirely in the ledger (AC-552-9).
// ---------------------------------------------------------------------------
export function reconcile(options = {}) {
  const wi = String(options.wi || '').trim();
  if (!wi) fail('reconcile requires --wi', 'continuation_input_invalid');
  const cwd = options.cwd || process.cwd();
  const baton = readBaton(wi, cwd);
  if (!baton) return { ok: true, action: 'absent', baton: null };
  if (baton.status === 'closed_pass' || baton.status === 'closed_fail') {
    return { ok: true, action: 'done', baton };
  }
  if (baton.status === 'launched') {
    return { ok: true, action: 'waiting-for-result', baton, launch: latestLaunch(baton) };
  }
  if (baton.status === 'pending') {
    return { ok: true, action: 'waiting-for-deploy', baton };
  }
  // status === 'deploy_stamped' (eligible) or 'blocked' (retryable within budget)
  return launch(options);
}

export function status(options = {}) {
  const wi = String(options.wi || '').trim();
  if (!wi) fail('status requires --wi', 'continuation_input_invalid');
  const cwd = options.cwd || process.cwd();
  return { ok: true, baton: readBaton(wi, cwd) };
}

// ---------------------------------------------------------------------------
// isPhaseForbiddenForSession — mechanical scope check consumed by the
// svc-continuation-phase-guard PreToolUse hook (AC-552-4). Scans every
// continuation ledger for a session currently bound to a launched-but-not-
// closed baton, and denies the skill if it is outside the delegated scope.
// ---------------------------------------------------------------------------
export function isPhaseForbiddenForSession({ sessionId, skill, cwd = process.cwd() } = {}) {
  if (!sessionId || !skill) return { forbidden: false };
  const root = ledgerRoot(cwd);
  if (!fs.existsSync(root)) return { forbidden: false };
  for (const file of fs.readdirSync(root)) {
    if (!file.endsWith('.ledger.jsonl')) continue;
    const wi = file.replace(/\.ledger\.jsonl$/, '');
    const baton = readBaton(wi, cwd);
    if (!baton || baton.status !== 'launched') continue;
    const active = latestLaunch(baton);
    if (!active || active.session_id !== sessionId) continue;
    if (baton.forbidden_phases.includes(skill)) {
      return { forbidden: true, wi, forbidden_phases: baton.forbidden_phases };
    }
  }
  return { forbidden: false };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) fail(`unsupported argument ${token}`, 'continuation_input_invalid');
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function camelize(options) {
  const out = { ...options };
  const map = {
    'proof-query': 'proofQuery', 'not-before': 'notBefore', 'max-launches': 'maxLaunches',
    'forbidden-phases': 'forbiddenPhases', 'task-graph': 'taskGraph', 'next-task': 'nextTask',
    'run-id': 'runId', 'session-id': 'sessionId', 'merge-sha': 'mergeSha',
    'deploy-receipt-at': 'deployReceiptAt', 'child-session-id': 'childSessionId',
    'dispatch-policy': 'dispatchPolicyPath', 'work-overlay': 'workOverlayPath',
  };
  for (const [flag, camel] of Object.entries(map)) {
    if (flag in out) out[camel] = out[flag];
  }
  if ('max-launches' in out) out.maxLaunches = Number(out['max-launches']);
  return out;
}

function cli() {
  const { command, options: rawOptions } = parseArgs(process.argv.slice(2));
  const options = camelize(rawOptions);
  options.fake = rawOptions.fake === 'true' || rawOptions.fake === true;
  if (command === 'create') return process.stdout.write(`${JSON.stringify(createBaton(options), null, 2)}\n`);
  if (command === 'stamp-deploy') return process.stdout.write(`${JSON.stringify(stampDeploy(options), null, 2)}\n`);
  if (command === 'launch') return process.stdout.write(`${JSON.stringify(launch(options), null, 2)}\n`);
  if (command === 'consume') return process.stdout.write(`${JSON.stringify(consume(options), null, 2)}\n`);
  if (command === 'reconcile') return process.stdout.write(`${JSON.stringify(reconcile(options), null, 2)}\n`);
  if (command === 'status') return process.stdout.write(`${JSON.stringify(status(options), null, 2)}\n`);
  if (command === 'deny-check') {
    const outcome = isPhaseForbiddenForSession({
      sessionId: options.sessionId || process.env.SVC_SESSION_ID,
      skill: options.skill,
    });
    process.stdout.write(`${JSON.stringify(outcome, null, 2)}\n`);
    process.exitCode = outcome.forbidden ? 1 : 0;
    return;
  }
  fail('usage: resolve-continuation.mjs create|stamp-deploy|launch|consume|reconcile|status|deny-check ...', 'continuation_input_invalid');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
