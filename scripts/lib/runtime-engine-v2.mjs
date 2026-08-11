#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { authorizeEffect } from '../svc-execution-controller-v2.mjs';
import { claimReadyTaskLeases, closeTaskLease, heartbeatTaskLease } from './runtime-scheduler-v2.mjs';
import { executeAuthorizedEffect, executeValidatorArgvAsync, compensateAuthorizedEffect } from './runtime-effects-v2.mjs';
import { acknowledgeEvidenceConsumer, contentDigest, evaluateTaskContribution, recordCausalProgress, recordEvidenceProduced, replayConsumptionLedgerEvents, validateConsumptionLedger } from './runtime-evidence-consumption-v2.mjs';

function fail(message) { throw new Error(`runtime-engine-v2: ${message}`); }
function now(options) { return options.now?.() ?? new Date().toISOString(); }

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value)}\n`, { flag: 'wx', mode: 0o600 });
  const descriptor = fs.openSync(temporary, fs.constants.O_RDONLY); try { fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
  fs.renameSync(temporary, file);
}

export function writeCasEvidence(storeRoot, object) {
  const candidate = structuredClone(object); delete candidate.object_digest;
  const objectDigest = contentDigest(candidate);
  if (object.object_digest && object.object_digest !== objectDigest) fail('evidence object digest does not match content');
  const complete = { ...candidate, object_digest: objectDigest };
  const file = path.join(path.resolve(storeRoot), 'objects', 'sha256', objectDigest.slice(0, 2), `${objectDigest}.json`);
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (contentDigest(Object.fromEntries(Object.entries(existing).filter(([key]) => key !== 'object_digest'))) !== objectDigest) fail('existing CAS evidence is corrupt');
    if (JSON.stringify(existing) !== JSON.stringify(complete)) fail('CAS digest collision');
    return { object: existing, object_digest: objectDigest, object_path: file, idempotent: true };
  }
  atomicWrite(file, complete);
  return { object: complete, object_digest: objectDigest, object_path: file, idempotent: false };
}

function leaseInput(paths, manifest, lease, status, reason, options) {
  return { store_path: paths.leases, run_id: manifest.run_id, task_id: lease.task_id, lease_id: lease.lease_id, principal_id: lease.principal_id, generation: lease.generation, status, reason, now: now(options) };
}

function heartbeat(paths, manifest, lease, options) {
  return heartbeatTaskLease({ store_path: paths.leases, run_id: manifest.run_id, task_id: lease.task_id, lease_id: lease.lease_id, principal_id: lease.principal_id, generation: lease.generation, now: now(options) });
}

function readJournalEvents(file) {
  if (!fs.existsSync(file)) return [];
  const bytes = fs.readFileSync(file, 'utf8');
  if (!bytes) return [];
  if (!bytes.endsWith('\n')) fail('runtime journal has a torn final record during ledger recovery');
  return bytes.trimEnd().split('\n').map(line => JSON.parse(line));
}

function consumptionOptions(paths, manifest, atTime) {
  return {
    storeRoot: paths.evidenceStore,
    protocol: manifest.protocol,
    productGraph: manifest.product_graph,
    protocolDigest: manifest.protocol_digest,
    productGraphDigest: manifest.product_graph_digest,
    ...(atTime ? { at_time: atTime } : {})
  };
}

async function compensateEffects(paths, manifest, capsule, executedEffects, appendTask, options) {
  const errors = [];
  const compensation_receipt_digests = [];
  for (const row of [...executedEffects].reverse()) {
    if (!row.receipt?.reversible) continue;
    const compensated = await compensateAuthorizedEffect(capsule, row.effect, { repo_root: manifest.repository_root, receipt_root: paths.effectReceipts, fetch: options.fetch });
    if (!compensated.valid) { errors.push(...compensated.errors.map(error => `compensation ${row.effect.idempotency_key}: ${error}`)); continue; }
    const appended = appendTask('EFFECT_COMPENSATED', { effect_receipt_digest: row.receipt.receipt_digest, compensation_receipt_digest: compensated.receipt.receipt_digest }, `effect:${row.effect.idempotency_key}:compensated`);
    if (!appended.valid) errors.push(...appended.errors);
    else compensation_receipt_digests.push(compensated.receipt.receipt_digest);
  }
  return { valid: errors.length === 0, errors, compensation_receipt_digests };
}

async function failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, reason, errors) {
  const compensation = await compensateEffects(paths, manifest, capsule, executedEffects, appendTask, options);
  const closed = closeTaskLease(leaseInput(paths, manifest, lease, 'CANCELLED', reason, options));
  const eventType = closed.valid ? 'TASK_ATTEMPT_FAILED' : 'TASK_LEASE_EXPIRED';
  const appended = appendTask(eventType, { reason, errors, compensation_receipt_digests: compensation.compensation_receipt_digests }, 'attempt-failed');
  return { valid: false, errors: [...errors, ...compensation.errors, ...(closed.valid ? [] : closed.errors), ...(appended.valid ? [] : appended.errors)] };
}

async function executeLeasedTaskWork(paths, manifest, capsule, lease, action, append, options) {
  const at = () => now(options);
  const appendTask = (type, payload, suffix) => append({ type, task_id: capsule.task_id, observed_at: at(), idempotency_key: `${manifest.run_id}:${capsule.task_id}:${lease.generation}:${suffix}`, payload });
  const executedEffects = [];
  let result = appendTask(lease.predecessor_lease_id ? 'TASK_LEASE_RECLAIMED' : 'TASK_LEASE_ACQUIRED', lease, 'lease');
  if (!result.valid) return { valid: false, errors: result.errors, capsule, lease, action, executedEffects };
  result = appendTask('TASK_DISPATCHED', { principal_id: lease.principal_id, capsule_revision: capsule.revision }, 'dispatch');
  if (!result.valid) return { valid: false, errors: result.errors, capsule, lease, action, executedEffects };

  for (const validationId of action.validator_ids ?? capsule.validations.map(item => item.id)) {
    const beforeHeartbeat = heartbeat(paths, manifest, lease, options);
    if (!beforeHeartbeat.valid) return { ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, 'heartbeat-failed', beforeHeartbeat.errors)), capsule, lease, action, executedEffects };
    result = appendTask('VALIDATOR_STARTED', { validation_id: validationId }, `validator:${validationId}:started`);
    if (!result.valid) return { valid: false, errors: result.errors, capsule, lease, action, executedEffects };
    const validation = await executeValidatorArgvAsync(capsule, validationId, { cwd: manifest.repository_root, env: options.env, timeout_ms: options.validator_timeout_ms });
    const afterHeartbeat = heartbeat(paths, manifest, lease, options);
    if (!afterHeartbeat.valid) return { ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, 'heartbeat-failed', afterHeartbeat.errors)), capsule, lease, action, executedEffects };
    result = appendTask('VALIDATOR_FINISHED', validation.receipt ?? { validation_id: validationId, errors: validation.errors }, `validator:${validationId}:finished`);
    if (!result.valid || !validation.valid || !validation.passed) {
      const errors = result.valid ? (validation.errors?.length ? validation.errors : [`validator ${validationId} failed with exit ${validation.receipt?.exit_code}`]) : result.errors;
      return { ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, 'validator-failed', errors)), capsule, lease, action, executedEffects };
    }
  }

  for (const effect of action.effects ?? []) {
    const beforeHeartbeat = heartbeat(paths, manifest, lease, options);
    if (!beforeHeartbeat.valid) return { ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, 'heartbeat-failed', beforeHeartbeat.errors)), capsule, lease, action, executedEffects };
    const authorization = authorizeEffect(capsule, effect);
    if (!authorization.authorized) {
      return { ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, 'effect-denied', authorization.errors)), capsule, lease, action, executedEffects };
    }
    result = appendTask('EFFECT_AUTHORIZED', { effect_digest: authorization.effect_digest, capability_id: effect.capability_id, adapter_id: effect.adapter_id }, `effect:${effect.idempotency_key}:authorized`);
    if (!result.valid) return { valid: false, errors: result.errors, capsule, lease, action, executedEffects };
    const executed = await executeAuthorizedEffect(capsule, effect, { repo_root: manifest.repository_root, receipt_root: paths.effectReceipts, fetch: options.fetch });
    const afterHeartbeat = heartbeat(paths, manifest, lease, options);
    if (!afterHeartbeat.valid) return { ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, 'heartbeat-failed', afterHeartbeat.errors)), capsule, lease, action, executedEffects };
    if (!executed.valid) {
      return { ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, 'effect-failed', executed.errors)), capsule, lease, action, executedEffects };
    }
    executedEffects.push({ effect, receipt: executed.receipt });
    result = appendTask('EFFECT_EXECUTED', { effect_digest: authorization.effect_digest, receipt_digest: executed.receipt.receipt_digest, adapter_id: effect.adapter_id, idempotent: executed.idempotent }, `effect:${effect.idempotency_key}:executed`);
    if (!result.valid) return { valid: false, errors: result.errors, capsule, lease, action, executedEffects };
  }

  return { valid: true, errors: [], capsule, lease, action, appendTask, executedEffects };
}

async function mergeLeasedTaskWork(paths, manifest, ledger, work, options) {
  const { capsule, lease, action, appendTask, executedEffects } = work;
  const at = () => now(options);
  let currentLedger = ledger;
  let result;
  const failMerge = async (reason, errors) => ({ ...(await failAttempt(paths, manifest, capsule, lease, executedEffects, appendTask, options, reason, errors)), ledger: currentLedger, task_id: capsule.task_id });

  for (const evidence of action.evidence_objects ?? []) {
    const stored = writeCasEvidence(paths.evidenceStore, evidence.object);
    const produced = recordEvidenceProduced(currentLedger, { artifact_id: evidence.artifact_id, object_digest: stored.object_digest, idempotency_key: evidence.idempotency_key, produced_at: evidence.produced_at ?? at() }, { storeRoot: paths.evidenceStore, protocol: manifest.protocol, productGraph: manifest.product_graph, protocolDigest: manifest.protocol_digest, productGraphDigest: manifest.product_graph_digest, at_time: evidence.produced_at ?? at() });
    if (!produced.valid) return failMerge('evidence-production-failed', produced.errors);
    currentLedger = produced.ledger;
    result = appendTask('EVIDENCE_PRODUCED', produced.event_payload, `evidence:${evidence.artifact_id}:produced`);
    if (!result.valid) return failMerge('evidence-event-failed', result.errors);
  }

  for (const acknowledgement of action.acknowledgements ?? []) {
    const acknowledged = acknowledgeEvidenceConsumer(currentLedger, { ...acknowledgement, acknowledged_at: acknowledgement.acknowledged_at ?? at() }, { storeRoot: paths.evidenceStore, protocol: manifest.protocol, productGraph: manifest.product_graph, protocolDigest: manifest.protocol_digest, productGraphDigest: manifest.product_graph_digest, at_time: acknowledgement.acknowledged_at ?? at() });
    if (!acknowledged.valid) return failMerge('evidence-consumption-failed', acknowledged.errors);
    currentLedger = acknowledged.ledger;
    result = appendTask('EVIDENCE_CONSUMED', acknowledged.event_payload, `evidence:${acknowledgement.artifact_id}:${acknowledgement.consumer_id}:consumed`);
    if (!result.valid) return failMerge('consumption-event-failed', result.errors);
  }

  if (!action.progress) return failMerge('causal-progress-missing', [`task ${capsule.task_id} requires a CAS/graph-authorized causal progress claim`]);
  const progress = recordCausalProgress(currentLedger, { ...action.progress, recorded_at: action.progress.recorded_at ?? at() }, { storeRoot: paths.evidenceStore, protocol: manifest.protocol, productGraph: manifest.product_graph, protocolDigest: manifest.protocol_digest, productGraphDigest: manifest.product_graph_digest, at_time: action.progress.recorded_at ?? at() });
  if (!progress.valid || !progress.accepted) return failMerge('causal-progress-rejected', progress.errors);
  currentLedger = progress.ledger;
  result = appendTask('CAUSAL_PROGRESS_RECORDED', progress.event_payload, `progress:${action.progress.idempotency_key}`);
  if (!result.valid) return failMerge('causal-progress-event-failed', result.errors);
  const contribution = evaluateTaskContribution(currentLedger, { task_status: 'ACCEPTED', required_artifact_ids: action.required_artifact_ids }, { protocol: manifest.protocol, productGraph: manifest.product_graph, protocolDigest: manifest.protocol_digest, productGraphDigest: manifest.product_graph_digest });
  if (!contribution.valid) return failMerge('task-contribution-invalid', contribution.errors);
  if (contribution.next_status !== 'CONSUMED') return failMerge('task-output-unconsumed', [`task ${capsule.task_id} remains ACCEPTED; unconsumed outputs: ${contribution.unconsumed_artifact_ids.join(',')}`]);
  result = appendTask('TASK_ACCEPTED', { required_artifact_ids: action.required_artifact_ids, validators_passed: true, effects_confirmed: true, progress_attempt_digest: progress.attempt.attempt_digest }, 'accepted');
  if (!result.valid) return failMerge('task-acceptance-event-failed', result.errors);
  result = appendTask('TASK_CONSUMED', { required_artifact_ids: action.required_artifact_ids, progress_attempt_digest: progress.attempt.attempt_digest }, 'consumed');
  if (!result.valid) return { valid: false, errors: result.errors, ledger: currentLedger, task_id: capsule.task_id };
  const closed = closeTaskLease(leaseInput(paths, manifest, lease, 'RELEASED', 'task-consumed', options));
  if (!closed.valid) return { valid: false, errors: closed.errors, ledger: currentLedger };
  return { valid: true, errors: [], ledger: currentLedger, task_id: capsule.task_id };
}

export async function runRuntimeToFreeze(paths, manifest, ledger, actions, append, status, options = {}) {
  const recovered = replayConsumptionLedgerEvents(manifest.consumption_ledger ?? ledger, readJournalEvents(paths.journal), consumptionOptions(paths, manifest));
  if (!recovered.valid) return { valid: false, errors: recovered.errors.map(error => `consumption ledger recovery: ${error}`) };
  let currentLedger = recovered.ledger;
  if (!fs.existsSync(paths.ledger) || JSON.parse(fs.readFileSync(paths.ledger, 'utf8')).ledger_digest !== currentLedger.ledger_digest) atomicWrite(paths.ledger, currentLedger);
  let currentStatus = status();
  if (!currentStatus.valid) return currentStatus;
  if (currentStatus.status === 'FROZEN') return { valid: true, frozen: true, idempotent: true, ledger: currentLedger, state: currentStatus };
  if (currentStatus.status === 'COMPILED') {
    const started = append({ type: 'RUN_STARTED', task_id: null, observed_at: now(options), idempotency_key: `${manifest.run_id}:run:start`, payload: {} });
    if (!started.valid) return started;
  } else if (!['RUNNING', 'STOPPED'].includes(currentStatus.status)) return { valid: false, errors: [`run cannot execute from ${currentStatus.status}`] };
  if (currentStatus.status === 'STOPPED') {
    const resumed = append({ type: 'RUN_RESUMED', task_id: null, observed_at: now(options), idempotency_key: `${manifest.run_id}:run:resume:${currentStatus.last_event_digest}`, payload: {} });
    if (!resumed.valid) return resumed;
  }

  for (let wave = 0; wave <= manifest.capsules.length; wave += 1) {
    currentStatus = status();
    if (!currentStatus.valid) return currentStatus;
    if (currentStatus.remaining.length === 0) {
      const candidateDigest = contentDigest({ run_id: manifest.run_id, manifest_digest: manifest.manifest_digest, ledger_digest: currentLedger.ledger_digest, consumed_task_ids: [...currentStatus.completed].sort() });
      const frozen = append({ type: 'CANDIDATE_FROZEN', task_id: null, observed_at: now(options), idempotency_key: `${manifest.run_id}:candidate:frozen`, payload: { candidate_digest: candidateDigest, ledger_digest: currentLedger.ledger_digest, consumed_task_ids: currentStatus.completed } });
      if (frozen.valid) atomicWrite(paths.ledger, currentLedger);
      return frozen.valid ? { valid: true, frozen: true, ledger: currentLedger, state: frozen.state } : frozen;
    }
    const principals = Object.fromEntries(currentStatus.remaining.map(taskId => [taskId, actions.tasks?.[taskId]?.principal_id]).filter(([, principal]) => principal));
    const claimed = claimReadyTaskLeases({ store_path: paths.leases, run_id: manifest.run_id, capsules: manifest.capsules, completed_task_ids: currentStatus.completed, principals, max_active: actions.max_active ?? 4, ttl_ms: actions.ttl_ms ?? Math.max(30_000, (options.validator_timeout_ms ?? 300_000) + 5_000), now: now(options) });
    if (!claimed.valid) return claimed;
    if (claimed.claimed_task_ids.length === 0) return { valid: false, errors: [`no runnable task lease; deferred: ${JSON.stringify(claimed.deferred)}`] };
    const waveWork = await Promise.all(claimed.deterministic_merge_order.map(async taskId => {
      const capsule = manifest.capsules.find(item => item.task_id === taskId); const lease = claimed.claimed_leases.find(item => item.task_id === taskId);
      const action = actions.tasks?.[taskId];
      if (!action) return { valid: false, errors: [`missing run action for ${taskId}`], capsule, lease, action: null, executedEffects: [] };
      return executeLeasedTaskWork(paths, manifest, capsule, lease, action, append, options);
    }));
    const waveErrors = [];
    for (const taskId of claimed.deterministic_merge_order) {
      const work = waveWork.find(item => item.capsule?.task_id === taskId);
      if (!work?.valid) { waveErrors.push(...(work?.errors ?? [`missing execution result for ${taskId}`])); continue; }
      const executed = await mergeLeasedTaskWork(paths, manifest, currentLedger, work, options);
      currentLedger = executed.ledger ?? currentLedger;
      atomicWrite(paths.ledger, currentLedger);
      if (!executed.valid) waveErrors.push(...executed.errors);
    }
    if (waveErrors.length) {
      const stopped = append({ type: 'RUN_STOPPED', task_id: null, observed_at: now(options), idempotency_key: `${manifest.run_id}:run:stopped:${crypto.createHash('sha256').update(JSON.stringify(waveErrors)).digest('hex')}`, payload: { wave, errors: [...new Set(waveErrors)] } });
      return { valid: false, errors: [...new Set([...waveErrors, ...(stopped.valid ? [] : stopped.errors)])], ledger: currentLedger, stopped: stopped.valid };
    }
  }
  return { valid: false, errors: ['runtime exceeded deterministic wave bound'] };
}

export async function executeReleaseEffect(paths, manifest, input, options = {}) {
  const capsule = manifest.capsules.find(item => item.task_id === input.task_id);
  if (!capsule) return { valid: false, errors: ['release effect task does not resolve'] };
  if (!input.effect) return { valid: false, errors: ['release lifecycle event requires a typed effect'] };
  const realProduction = input.payload?.simulation_only !== true && input.payload?.production_proof === true;
  if (realProduction && input.type === 'PRODUCTION_RELEASED' && (input.effect.kind !== 'deploy' || input.effect.principal !== 'root')) {
    return { valid: false, errors: ['real production release requires a root-authorized deploy effect'] };
  }
  if (realProduction && input.type === 'LIVE_VERIFIED' && !new Set(['network_read', 'device']).has(input.effect.kind)) {
    return { valid: false, errors: ['real live verification requires a network or device probe effect'] };
  }
  if (input.type === 'ROLLBACK_EXECUTED') return compensateAuthorizedEffect(capsule, input.effect, { repo_root: manifest.repository_root, receipt_root: paths.effectReceipts, fetch: options.fetch });
  return executeAuthorizedEffect(capsule, input.effect, { repo_root: manifest.repository_root, receipt_root: paths.effectReceipts, fetch: options.fetch });
}

export function validatePersistedLedger(paths, manifest) {
  const ledger = JSON.parse(fs.readFileSync(paths.ledger, 'utf8'));
  return validateConsumptionLedger(ledger, { protocol: manifest.protocol, productGraph: manifest.product_graph, protocolDigest: manifest.protocol_digest, productGraphDigest: manifest.product_graph_digest });
}
