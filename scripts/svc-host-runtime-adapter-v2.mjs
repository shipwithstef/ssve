#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendRuntimeEvent, readRuntimeJournal, replayRuntimeJournal } from './svc-runtime-v2.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '..');
const EVENT_TYPES = new Set(JSON.parse(fs.readFileSync(path.join(root, 'schemas/runtime-journal-event-v2.schema.json'), 'utf8')).properties.type.enum);
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
function fail(message) { throw new Error(`host-runtime-adapter-v2: ${message}`); }

export function loadHostIngressPolicy(host, repoRoot = root) {
  const manifestPath = path.join(repoRoot, 'provision', 'hosts', `${host}.json`);
  if (!fs.existsSync(manifestPath)) fail(`unknown host ${host}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!manifest.runtime_ingress_v2?.canonical_journal || !manifest.runtime_ingress_v2?.projection_only) fail(`host ${host} lacks fail-closed runtime ingress policy`);
  return manifest.runtime_ingress_v2;
}

export function normalizeHostIngress(raw, repoRoot = root) {
  const policy = loadHostIngressPolicy(raw.host, repoRoot);
  if (!EVENT_TYPES.has(raw.canonical_type)) fail(`unknown canonical event type ${raw.canonical_type}`);
  if (raw.transport !== policy.transport && raw.transport !== policy.fallback) fail(`transport ${raw.transport} not allowed for ${raw.host}`);
  if (policy.projection_only === true && raw.canonical_type !== 'PROJECTION_EMITTED') {
    fail(`host ${raw.host} ingress is projection-only and cannot author workflow event ${raw.canonical_type}`);
  }
  if (!raw.run_id || !raw.host_event_id || !raw.principal || !raw.observed_at || !raw.generation_bindings) fail('run, event, principal, time and generation bindings are required');
  return {
    schema_version: 'host-ingress-v2', host: raw.host, transport: raw.transport, run_id: raw.run_id,
    host_event_id: raw.host_event_id, canonical_type: raw.canonical_type, task_id: raw.task_id ?? null,
    observed_at: raw.observed_at, principal: raw.principal, payload: raw.payload ?? {}, generation_bindings: raw.generation_bindings,
  };
}

export function ingestHostEvent(paths, raw, repoRoot = root) {
  const normalized = normalizeHostIngress(raw, repoRoot);
  return appendRuntimeEvent(paths, {
    run_id: normalized.run_id, type: normalized.canonical_type, task_id: normalized.task_id,
    observed_at: normalized.observed_at, idempotency_key: `host:${normalized.host}:${normalized.host_event_id}`,
    generation_bindings: normalized.generation_bindings,
    payload: { ...normalized.payload, ingress: { host: normalized.host, transport: normalized.transport, principal: normalized.principal } },
  });
}

export function deriveDeliveryProjection(state) {
  const locallyCompleteStates = new Set([
    'FROZEN', 'FINAL_REVIEW_PASSED', 'FINAL_SHA_BOUND', 'RELEASING', 'PRODUCTION_RELEASED', 'SIMULATED_RELEASED',
    'LIVE_VERIFIED', 'SIMULATED_LIVE_VERIFIED', 'DELIVERY_VERIFIED', 'SIMULATED_DELIVERY_EXERCISED',
    'OUTCOME_OBSERVED', 'SIMULATED_OUTCOME_OBSERVED', 'OUTCOME_DECIDED', 'SIMULATED_OUTCOME_DECIDED'
  ]);
  const locally_completed = locallyCompleteStates.has(state.status) || (Object.keys(state.tasks ?? {}).length > 0 && Object.values(state.tasks).every(task => task.status === 'CONSUMED'));
  let status = locally_completed ? 'LOCALLY_COMPLETED' : 'IN_PROGRESS';
  if (state.status === 'DELIVERY_VERIFIED') status = 'DELIVERY_VERIFIED';
  else if (state.blocker && ['integration', 'staging'].includes(state.blocker.stage)) status = 'INTEGRATION_BLOCKED';
  else if (state.blocker && ['release', 'production'].includes(state.blocker.stage)) status = 'RELEASE_BLOCKED';
  return {
    status,
    locally_completed,
    blocker: state.blocker ? {
      blocker_id: state.blocker.blocker_id,
      stage: state.blocker.stage,
      dependency: state.blocker.dependency,
      next_permitted_action: state.blocker.next_permitted_action,
    } : null,
  };
}

export function projectLegacyViews(manifest, events) {
  const replay = replayRuntimeJournal(events, { run_id: manifest.run_id, generation_bindings: manifest.generation_bindings });
  if (!replay.valid) return replay;
  const state = replay.state;
  const tasks = manifest.capsules.map(capsule => ({ id: capsule.task_id, status: state.tasks[capsule.task_id]?.status ?? 'PLANNED', blocked_by: capsule.dependencies ?? [] }));
  const source = { run_id: manifest.run_id, event_count: state.event_count, journal_digest: state.last_event_digest };
  return {
    valid: true,
    lane_tasks: { schema_version: 'runtime-projection-v2', source, tasks },
    orchestrator_state: { schema_version: 'runtime-projection-v2', source, status: state.status, delivery: deriveDeliveryProjection(state), blocker: state.blocker },
    receipt_mirror: { schema_version: 'runtime-projection-v2', source, evidence: state.evidence, consumers: state.consumers, final_sha: state.final_sha },
    decision_log: { schema_version: 'runtime-projection-v2', source, final_review: state.final_review, release: state.release, observation: state.observation, next_decision: state.next_decision },
  };
}

function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  fs.renameSync(temporary, file);
}

export function writeLegacyProjections(outDir, projections) {
  if (!projections.valid) return projections;
  const names = { lane_tasks: 'lane-tasks.json', orchestrator_state: 'orchestrator-state.json', receipt_mirror: 'receipts.json', decision_log: 'decisions.json' };
  for (const [key, name] of Object.entries(names)) atomicWrite(path.join(outDir, name), projections[key]);
  return { valid: true, output_digest: digest(projections), files: Object.values(names).map(name => path.join(outDir, name)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = Object.fromEntries(process.argv.slice(2).flatMap((token, index, all) => token.startsWith('--') ? [[token.slice(2), all[index + 1]]] : []));
  const command = process.argv[2];
  if (command === 'ingest') {
    const raw = JSON.parse(fs.readFileSync(args.event, 'utf8')); const runDir = path.resolve(args['run-dir']);
    const result = ingestHostEvent({ runDir, manifest: path.join(runDir, 'manifest.json'), journal: path.join(runDir, 'journal.jsonl'), journalLock: path.join(runDir, '.journal.lock'), projections: path.join(runDir, 'projections') }, raw);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exit(result.valid ? 0 : 1);
  }
  if (command === 'project') {
    const runDir = path.resolve(args['run-dir']); const manifest = JSON.parse(fs.readFileSync(path.join(runDir, 'manifest.json'), 'utf8'));
    const result = writeLegacyProjections(path.resolve(args.out ?? path.join(runDir, 'projections')), projectLegacyViews(manifest, readRuntimeJournal(path.join(runDir, 'journal.jsonl'))));
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); process.exit(result.valid ? 0 : 1);
  }
  fail('usage: svc-host-runtime-adapter-v2.mjs ingest --event FILE --run-dir DIR | project --run-dir DIR [--out DIR]');
}
