// @organism-suite
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRuntimeEvent, readRuntimeJournal, runtimeStatus } from '../../scripts/svc-runtime-v2.mjs';
import { runRuntimeToFreeze } from '../../scripts/lib/runtime-engine-v2.mjs';
import { contentDigest, createConsumptionLedger } from '../../scripts/lib/runtime-evidence-consumption-v2.mjs';

const generations = Object.fromEntries(['protocol_generation_digest', 'product_generation_digest', 'context_generation_digest', 'concern_generation_digest', 'control_generation_digest', 'authority_generation_digest', 'layer_inventory_digest'].map((key, i) => [key, String(i + 1).repeat(64)]));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const T0 = Date.parse('2026-08-10T00:00:00.000Z');
const TTL_MS = 1000;

// One task with one reversible filesystem effect. `clock` decides what time the engine sees.
function fixture(name) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `effect-expiry-${name}-`));
  const repositoryRoot = path.join(root, 'repository');
  const runDir = path.join(root, 'state', 'runs', 'run-effect');
  fs.mkdirSync(repositoryRoot, { recursive: true });
  const paths = {
    runDir, manifest: path.join(runDir, 'manifest.json'), journal: path.join(runDir, 'journal.jsonl'), journalLock: path.join(runDir, '.journal.lock'),
    projections: path.join(runDir, 'projections'), leases: path.join(runDir, 'leases.json'), ledger: path.join(runDir, 'consumption-ledger.json'),
    evidenceStore: path.join(runDir, 'evidence'), effectReceipts: path.join(runDir, 'effects'),
  };
  const protocolDigest = sha('protocol');
  const productGraphDigest = sha('graph');
  const contract = {
    id: 'artifact-e', kind: 'VALIDATOR_RESULT', producer_id: 'producer-e',
    consumer_ids: [{ id: 'consumer-e', kind: 'RUNTIME', condition: 'BEFORE_TASK_ACCEPTANCE' }], outcome_ids: ['outcome-e'],
    source_digest: sha('source'), invalidation_input_digests: [sha('input')], freshness: { mode: 'IMMUTABLE', max_age_seconds: null },
    idempotency_key: 'produce-e', retention: 'RUN',
  };
  const protocol = { generation_bindings: generations, artifacts: [contract] };
  const graph = { generation_bindings: generations, nodes: [{ id: 'outcome-e', type: 'OUTCOME', status: 'RESOLVED' }, { id: 'evidence-e', type: 'EVIDENCE', status: 'RESOLVED' }], edges: [] };
  const capsule = {
    schema_version: 2, wi: 'WI-EFFECT', task_id: 'E', product_outcome: 'outcome E', generation_bindings: generations,
    dependencies: [], merge_dependencies: [], interfaces: { provides: [], consumes: [] }, revision: 1,
    plan_digest: sha('plan'), accepted_parent_sha: 'a'.repeat(40), allowed_files: [{ path: 'effect-output.txt', action: 'CREATE' }],
    forbidden_writes: ['secrets/**'], decisions: [{ id: 'direction', status: 'RESOLVED', source_digest: sha('direction') }],
    authorities: [{ id: 'runtime', status: 'RESOLVED', source_digest: sha('authority') }],
    effect_capabilities: [{ id: 'write-E', principal: 'executor', kind: 'filesystem_write', targets: ['effect-output.txt'], max_cost_usd: 0, root_only: false, requires_idempotency: false, reversible: true }],
    resource_claims: [{ key: 'task:E', mode: 'exclusive' }], parallel_policy: { eligible: true, merge_order_key: 'E' }, active_budget_seconds: 30,
    validations: [{ id: 'ok', argv: [process.execPath, '-e', 'process.exit(0)'], inputs: ['effect-output.txt'], validator_digest: sha('validator'), environment_class: 'hermetic', cost_class: 'micro', required_at_freeze: true }],
    failure_policy: { local_attempts: 2, assist_attempts: 1, plan_freeze_categories: ['PRODUCT_CONTRACT', 'SECURITY_AUTHORITY'] },
  };
  const created = createConsumptionLedger({
    run_id: 'run-effect', generation_bindings: generations, protocol_digest: protocolDigest, product_graph_digest: productGraphDigest,
    artifact_contracts: [contract], producer_task_ids: { 'artifact-e': 'E' }, invalidation_input_names: { 'artifact-e': ['input:0'] },
    minimum_trust_levels: { 'artifact-e': 'hermetic' }, validation_options: { protocol, productGraph: graph, protocolDigest, productGraphDigest },
  });
  assert.equal(created.valid, true, created.errors?.join('; '));
  const evidence = {
    schema_version: 2, kind: contract.kind, trust_level: 'hermetic', subject: contract.id, producer_id: contract.producer_id,
    consumer_ids: ['consumer-e'], generation_bindings: generations,
    relevant_digests: { protocol_digest: protocolDigest, product_graph_digest: productGraphDigest, source_digest: contract.source_digest, 'input:0': contract.invalidation_input_digests[0] },
    environment_identity: 'effect-expiry-local', created_at: '2026-08-10T00:00:10.000Z', expires_at: null,
    payload: { artifact_id: contract.id, graph_node_id: 'evidence-e' },
  };
  evidence.object_digest = contentDigest(evidence);
  const effect = { capability_id: 'write-E', principal: 'executor', kind: 'filesystem_write', target: 'effect-output.txt', file_action: 'CREATE', idempotency_key: 'write-once', adapter_id: 'filesystem.write-file-v2', adapter_input: { content_utf8: 'done\n' } };
  const actions = { max_active: 1, ttl_ms: TTL_MS, tasks: { E: {
    principal_id: 'worker-e', validator_ids: ['ok'], effects: [effect],
    evidence_objects: [{ artifact_id: contract.id, object: evidence, idempotency_key: contract.idempotency_key, produced_at: '2026-08-10T00:00:10.000Z' }],
    acknowledgements: [{ artifact_id: contract.id, object_digest: evidence.object_digest, consumer_id: 'consumer-e', condition: 'BEFORE_TASK_ACCEPTANCE', idempotency_key: 'ack-e', acknowledged_at: '2026-08-10T00:00:11.000Z' }],
    required_artifact_ids: [contract.id],
    progress: { idempotency_key: 'progress-e', prior_state_digest: sha('prior'), next_state_digest: sha('next'), causal_fingerprint: sha('cause'), evidence_refs: [{ object_digest: evidence.object_digest, artifact_id: contract.id, graph_node_id: 'evidence-e', consumer_id: 'consumer-e', role: 'NEW_EVIDENCE' }], resolved_obligations: [], authorized_decisions: [], uncertainty_reductions: [], recorded_at: '2026-08-10T00:00:12.000Z' },
  } } };
  const manifest = { schema_version: 2, run_id: 'run-effect', repository_root: repositoryRoot, generation_bindings: generations, protocol_digest: protocolDigest, product_graph_digest: productGraphDigest, protocol, product_graph: graph, capsules: [capsule], manifest_digest: sha('manifest') };
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(paths.manifest, `${JSON.stringify(manifest)}\n`);
  fs.writeFileSync(paths.ledger, `${JSON.stringify(created.ledger)}\n`);
  assert.equal(appendRuntimeEvent(paths, { run_id: 'run-effect', type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T00:00:00.000Z', idempotency_key: 'compile', generation_bindings: generations, payload: { manifest_digest: manifest.manifest_digest } }).valid, true);
  const append = (input) => appendRuntimeEvent(paths, { ...input, run_id: 'run-effect', generation_bindings: generations });
  const run = (now) => runRuntimeToFreeze(paths, manifest, JSON.parse(fs.readFileSync(paths.ledger)), actions, append, () => runtimeStatus(paths), { validator_timeout_ms: 5000, now });
  return { paths, manifest, repositoryRoot, effectFile: path.join(repositoryRoot, 'effect-output.txt'), run, effect };
}

// Time advances 1ms per call, except once the effect has landed on disk: then the lease is already gone.
function expiringClock(effectFile) {
  let tick = 0;
  return () => new Date(T0 + (fs.existsSync(effectFile) ? 10 * TTL_MS : 0) + (++tick)).toISOString();
}
const steadyClock = () => { let tick = 0; return () => new Date(T0 + 60 * TTL_MS + (++tick)).toISOString(); };

test('a completed effect stays visible in the journal when the lease expires right after it', async () => {
  const fx = fixture('race');
  const result = await fx.run(expiringClock(fx.effectFile));
  assert.equal(result.valid, false);
  assert.equal(fs.readFileSync(fx.effectFile, 'utf8'), 'done\n', 'the effect really happened');
  const events = readRuntimeJournal(fx.paths.journal);
  const executed = events.filter((e) => e.type === 'EFFECT_EXECUTED');
  assert.equal(executed.length, 1, `completion is journaled: ${events.map((e) => e.type).join(',')}`);
  assert.match(executed[0].payload.receipt_digest, /^[0-9a-f]{64}$/);
  const lost = events.find((e) => e.type === 'TASK_LEASE_EXPIRED' || e.type === 'TASK_ATTEMPT_FAILED');
  assert.ok(lost, 'the lost attempt is journaled');
  assert.deepEqual(lost.payload.unreconciled_effects?.map((x) => x.receipt_digest), [executed[0].payload.receipt_digest],
    'recovery gets an explicit hand-off of the unresolved effect');
});

test('a stale worker does not mutate to clean up after losing its lease', async () => {
  const fx = fixture('no-stale-mutation');
  await fx.run(expiringClock(fx.effectFile));
  assert.equal(fs.existsSync(fx.effectFile), true, 'no compensation under an expired lease');
  assert.equal(readRuntimeJournal(fx.paths.journal).some((e) => e.type === 'EFFECT_COMPENSATED'), false);
});

test('the next owner reconciles the receipt: reclaim reuses the effect without repeating it', async () => {
  const fx = fixture('reclaim');
  await fx.run(expiringClock(fx.effectFile));
  const resumed = await fx.run(steadyClock());
  assert.equal(resumed.valid, true, resumed.errors?.join('; '));
  assert.equal(fs.readFileSync(fx.effectFile, 'utf8'), 'done\n');
  const executed = readRuntimeJournal(fx.paths.journal).filter((e) => e.type === 'EFFECT_EXECUTED');
  assert.ok(executed.length >= 1);
  assert.equal(new Set(executed.map((e) => e.payload.receipt_digest)).size, 1, 'one receipt, never a second write');
  assert.equal(executed.at(-1).payload.idempotent, true, 'the new owner replays the stored receipt');
});

test('a normal attempt journals the effect once and freezes', async () => {
  const fx = fixture('normal');
  const result = await fx.run(steadyClock());
  assert.equal(result.valid, true, result.errors?.join('; '));
  assert.equal(readRuntimeJournal(fx.paths.journal).filter((e) => e.type === 'EFFECT_EXECUTED').length, 1);
});
