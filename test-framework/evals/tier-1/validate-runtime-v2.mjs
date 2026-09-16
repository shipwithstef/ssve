#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { appendRuntimeEvent, compileProductionDeliveryForecast, readRuntimeJournal, replayRuntimeJournal, runtimeStatus } from '../../../scripts/svc-runtime-v2.mjs';
import { runRuntimeToFreeze } from '../../../scripts/lib/runtime-engine-v2.mjs';
import { contentDigest, createConsumptionLedger } from '../../../scripts/lib/runtime-evidence-consumption-v2.mjs';

const generations = Object.fromEntries(['protocol_generation_digest','product_generation_digest','context_generation_digest','concern_generation_digest','control_generation_digest','authority_generation_digest','layer_inventory_digest'].map((key, i) => [key, String(i + 1).repeat(64)]));
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-runtime-v2-'));
const paths = { runDir: root, manifest: path.join(root, 'manifest.json'), journal: path.join(root, 'journal.jsonl'), journalLock: path.join(root, '.journal.lock'), projections: path.join(root, 'projections'), leases: path.join(root, 'leases.json'), ledger: path.join(root, 'consumption-ledger.json'), evidenceStore: path.join(root, 'evidence'), effectReceipts: path.join(root, 'effects') };
try {
  const first = appendRuntimeEvent(paths, { run_id: 'runtime-test', type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T00:00:00.000Z', idempotency_key: 'compile', generation_bindings: generations, payload: { manifest_digest: 'a'.repeat(64) } });
  assert.equal(first.valid, true); assert.equal(first.idempotent, false);
  const duplicate = appendRuntimeEvent(paths, { run_id: 'runtime-test', type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T00:00:00.000Z', idempotency_key: 'compile', generation_bindings: generations, payload: { manifest_digest: 'a'.repeat(64) } });
  assert.equal(duplicate.valid, true); assert.equal(duplicate.idempotent, true); assert.equal(readRuntimeJournal(paths.journal).length, 1);
  const started = appendRuntimeEvent(paths, { run_id: 'runtime-test', type: 'RUN_STARTED', task_id: null, observed_at: '2026-08-10T00:00:01.000Z', idempotency_key: 'run', generation_bindings: generations, payload: {} });
  assert.equal(started.valid, true); assert.equal(replayRuntimeJournal(readRuntimeJournal(paths.journal), { run_id: 'runtime-test', generation_bindings: generations }).state.status, 'RUNNING');
  fs.appendFileSync(paths.journal, '{"torn":');
  assert.throws(() => readRuntimeJournal(paths.journal), /torn final record/);

  const reclaimedRoot = path.join(root, 'reclaimed-lock');
  const reclaimedPaths = { ...paths, runDir: reclaimedRoot, journal: path.join(reclaimedRoot, 'journal.jsonl'), journalLock: path.join(reclaimedRoot, '.journal.lock') };
  fs.mkdirSync(reclaimedPaths.journalLock, { recursive: true });
  fs.writeFileSync(path.join(reclaimedPaths.journalLock, 'owner.json'), `${JSON.stringify({ pid: 99999999, process_start_token: 'dead', owner_token: 'dead-owner' })}\n`);
  const reclaimed = appendRuntimeEvent(reclaimedPaths, { run_id: 'runtime-lock-reclaim', type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T00:00:00.000Z', idempotency_key: 'compile', generation_bindings: generations, payload: { manifest_digest: 'b'.repeat(64) } });
  assert.equal(reclaimed.valid, true, reclaimed.errors?.join('; '));
  assert.equal(fs.existsSync(reclaimedPaths.journalLock), false);

  const integratedRoot = path.join(root, 'integrated');
  const repositoryRoot = path.join(integratedRoot, 'repository');
  const runDir = path.join(integratedRoot, 'state', 'runs', 'runtime-integrated');
  fs.mkdirSync(repositoryRoot, { recursive: true });
  const integratedPaths = {
    runDir, manifest: path.join(runDir, 'manifest.json'), journal: path.join(runDir, 'journal.jsonl'), journalLock: path.join(runDir, '.journal.lock'),
    projections: path.join(runDir, 'projections'), leases: path.join(runDir, 'leases.json'), ledger: path.join(runDir, 'consumption-ledger.json'),
    evidenceStore: path.join(runDir, 'evidence'), effectReceipts: path.join(runDir, 'effects')
  };
  const protocolDigest = sha('integrated-protocol');
  const productGraphDigest = sha('integrated-product-graph');
  const contracts = ['A', 'B'].map(id => ({
    id: `artifact-${id.toLowerCase()}`, kind: 'VALIDATOR_RESULT', producer_id: `producer-${id.toLowerCase()}`,
    consumer_ids: [{ id: `consumer-${id.toLowerCase()}`, kind: 'RUNTIME', condition: 'BEFORE_TASK_ACCEPTANCE' }],
    outcome_ids: [`outcome-${id.toLowerCase()}`], source_digest: sha(`source-${id}`), invalidation_input_digests: [sha(`input-${id}`)],
    freshness: { mode: 'IMMUTABLE', max_age_seconds: null }, idempotency_key: `produce-${id.toLowerCase()}`, retention: 'RUN'
  }));
  const protocol = { generation_bindings: generations, artifacts: contracts };
  const productGraph = {
    generation_bindings: generations,
    nodes: ['A', 'B'].flatMap(id => [
      { id: `outcome-${id.toLowerCase()}`, type: 'OUTCOME', status: 'RESOLVED' },
      { id: `evidence-${id.toLowerCase()}`, type: 'EVIDENCE', status: 'RESOLVED' }
    ]), edges: []
  };
  const capsule = (id) => ({
    schema_version: 2, wi: 'WI-RUNTIME', task_id: id, product_outcome: `outcome ${id}`, generation_bindings: generations,
    dependencies: [], merge_dependencies: [], interfaces: { provides: [], consumes: [] }, revision: 1,
    plan_digest: sha('plan'), accepted_parent_sha: 'a'.repeat(40), allowed_files: [{ path: `marker-${id}.json`, action: 'CREATE' }],
    forbidden_writes: ['secrets/**'], decisions: [{ id: 'direction', status: 'RESOLVED', source_digest: sha('direction') }],
    authorities: [{ id: 'runtime', status: 'RESOLVED', source_digest: sha('authority') }],
    effect_capabilities: [{ id: `read-${id}`, principal: 'executor', kind: 'filesystem_read', targets: [`marker-${id}.json`], max_cost_usd: 0, root_only: false, requires_idempotency: false, reversible: false }],
    resource_claims: [{ key: `task:${id}`, mode: 'exclusive' }], parallel_policy: { eligible: true, merge_order_key: id }, active_budget_seconds: 30,
    validations: [{
      id: 'overlap',
      argv: [process.execPath, '-e', "const fs=require('fs');const self=process.argv[1],peer=process.argv[2];const r={start:Date.now(),peer_observed:false};const write=()=>{const tmp=self+'.tmp.'+process.pid;fs.writeFileSync(tmp,JSON.stringify(r));fs.renameSync(tmp,self);};const readPeer=()=>{try{return JSON.parse(fs.readFileSync(peer,'utf8'));}catch{return null;}};write();const deadline=Date.now()+5000;while(Date.now()<deadline&&!fs.existsSync(peer))Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);if(!fs.existsSync(peer))throw Error('peer validator did not become ready');r.peer_observed=true;write();while(Date.now()<deadline){const p=readPeer();if(p&&p.peer_observed)break;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);}const done=readPeer();if(!done||!done.peer_observed)throw Error('peer validator did not complete handshake');r.end=Date.now()+1;write();", path.join(repositoryRoot, `marker-${id}.json`), path.join(repositoryRoot, `marker-${id === 'A' ? 'B' : 'A'}.json`)],
      inputs: [`marker-${id}.json`], validator_digest: sha(`validator-${id}`), environment_class: 'hermetic', cost_class: 'micro', required_at_freeze: true
    }], failure_policy: { local_attempts: 2, assist_attempts: 1, plan_freeze_categories: ['PRODUCT_CONTRACT', 'SECURITY_AUTHORITY'] }
  });
  const capsules = [capsule('A'), capsule('B')];
  const createdLedger = createConsumptionLedger({
    run_id: 'runtime-integrated', generation_bindings: generations, protocol_digest: protocolDigest, product_graph_digest: productGraphDigest,
    artifact_contracts: contracts, producer_task_ids: { 'artifact-a': 'A', 'artifact-b': 'B' },
    invalidation_input_names: { 'artifact-a': ['input:0'], 'artifact-b': ['input:0'] },
    minimum_trust_levels: { 'artifact-a': 'hermetic', 'artifact-b': 'hermetic' },
    validation_options: { protocol, productGraph, protocolDigest, productGraphDigest }
  });
  assert.equal(createdLedger.valid, true, createdLedger.errors?.join('; '));
  const evidenceFor = (id) => {
    const contract = contracts.find(row => row.id === `artifact-${id.toLowerCase()}`);
    const object = {
      schema_version: 2, kind: contract.kind, trust_level: 'hermetic', subject: contract.id, producer_id: contract.producer_id,
      consumer_ids: contract.consumer_ids.map(row => row.id), generation_bindings: generations,
      relevant_digests: { protocol_digest: protocolDigest, product_graph_digest: productGraphDigest, source_digest: contract.source_digest, 'input:0': contract.invalidation_input_digests[0] },
      environment_identity: 'runtime-integrated-local', created_at: '2026-08-10T01:00:10.000Z', expires_at: null,
      payload: { artifact_id: contract.id, graph_node_id: `evidence-${id.toLowerCase()}` }
    };
    object.object_digest = contentDigest(object);
    return { contract, object };
  };
  const actions = { max_active: 2, tasks: {} };
  for (const id of ['A', 'B']) {
    const { contract, object } = evidenceFor(id);
    const lower = id.toLowerCase();
    actions.tasks[id] = {
      principal_id: `worker-${lower}`, validator_ids: ['overlap'], effects: [],
      evidence_objects: [{ artifact_id: contract.id, object, idempotency_key: contract.idempotency_key, produced_at: '2026-08-10T01:00:10.000Z' }],
      acknowledgements: [{ artifact_id: contract.id, object_digest: object.object_digest, consumer_id: `consumer-${lower}`, condition: 'BEFORE_TASK_ACCEPTANCE', idempotency_key: `ack-${lower}`, acknowledged_at: '2026-08-10T01:00:11.000Z' }],
      required_artifact_ids: [contract.id],
      progress: {
        idempotency_key: `progress-${lower}`, prior_state_digest: sha(`prior-${id}`), next_state_digest: sha(`next-${id}`), causal_fingerprint: sha(`cause-${id}`),
        evidence_refs: [{ object_digest: object.object_digest, artifact_id: contract.id, graph_node_id: `evidence-${lower}`, consumer_id: `consumer-${lower}`, role: 'NEW_EVIDENCE' }],
        resolved_obligations: [], authorized_decisions: [], uncertainty_reductions: [], recorded_at: '2026-08-10T01:00:12.000Z'
      }
    };
  }
  const manifest = {
    schema_version: 2, run_id: 'runtime-integrated', repository_root: repositoryRoot, generation_bindings: generations,
    protocol_digest: protocolDigest, product_graph_digest: productGraphDigest, protocol, product_graph: productGraph,
    capsules, manifest_digest: sha('integrated-manifest')
  };
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(integratedPaths.manifest, `${JSON.stringify(manifest)}\n`);
  fs.writeFileSync(integratedPaths.ledger, `${JSON.stringify(createdLedger.ledger)}\n`);
  assert.equal(appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T01:00:00.000Z', idempotency_key: 'integrated-compile', generation_bindings: generations, payload: { manifest_digest: manifest.manifest_digest } }).valid, true);
  let tick = 0;
  const append = input => appendRuntimeEvent(integratedPaths, { ...input, run_id: manifest.run_id, generation_bindings: generations });
  const executed = await runRuntimeToFreeze(integratedPaths, manifest, createdLedger.ledger, actions, append, () => runtimeStatus(integratedPaths), { validator_timeout_ms: 5000, now: () => new Date(Date.parse('2026-08-10T01:00:00.000Z') + (++tick * 1000)).toISOString() });
  assert.equal(executed.valid, true, executed.errors?.join('; '));
  assert.equal(executed.frozen, true);
  const intervals = ['A', 'B'].map(id => JSON.parse(fs.readFileSync(path.join(repositoryRoot, `marker-${id}.json`), 'utf8')));
  assert(intervals.every(row => row.peer_observed === true), `validator concurrency handshake incomplete: ${JSON.stringify(intervals)}`);
  assert(Math.max(...intervals.map(row => row.start)) < Math.min(...intervals.map(row => row.end)), `validator intervals did not overlap: ${JSON.stringify(intervals)}`);
  const integratedEvents = readRuntimeJournal(integratedPaths.journal);
  const firstFinish = integratedEvents.findIndex(event => event.type === 'VALIDATOR_FINISHED');
  assert.equal(integratedEvents.filter((event, index) => event.type === 'VALIDATOR_STARTED' && index < firstFinish).length, 2);
  assert.deepEqual(integratedEvents.filter(event => event.type === 'TASK_CONSUMED').map(event => event.task_id), ['A', 'B']);
  const integratedStatus = runtimeStatus(integratedPaths);
  assert.deepEqual(integratedStatus.completed, ['A', 'B']);
  assert.equal(integratedEvents.filter(event => event.type === 'CAUSAL_PROGRESS_RECORDED').length, 2);

  const blockedDelivery = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'DELIVERY_BLOCKED', task_id: null, observed_at: '2026-08-10T01:45:00.000Z', idempotency_key: 'integration-blocked', generation_bindings: generations, payload: { blocker_id: 'wi-368-main', stage: 'integration', dependency: 'WI-368 must be present on main', next_permitted_action: 'land the locally completed feature commit' } });
  assert.equal(blockedDelivery.valid, true, blockedDelivery.errors?.join('; '));
  assert.equal(blockedDelivery.state.status, 'FROZEN', 'delivery blocker must not erase local completion state');
  assert.equal(blockedDelivery.state.blocker.dependency, 'WI-368 must be present on main');
  const badUnblock = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'DELIVERY_UNBLOCKED', task_id: null, observed_at: '2026-08-10T01:45:01.000Z', idempotency_key: 'wrong-unblock', generation_bindings: generations, payload: { blocker_id: 'forged' } });
  assert.equal(badUnblock.valid, false);
  const unblockedDelivery = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'DELIVERY_UNBLOCKED', task_id: null, observed_at: '2026-08-10T01:45:02.000Z', idempotency_key: 'integration-unblocked', generation_bindings: generations, payload: { blocker_id: 'wi-368-main' } });
  assert.equal(unblockedDelivery.valid, true, unblockedDelivery.errors?.join('; '));
  const eventCountAfterBlockerCycle = readRuntimeJournal(integratedPaths.journal).length;

  // Simulate a crash after journal fsync but before the derived ledger mirror was replaced.
  fs.writeFileSync(integratedPaths.ledger, `${JSON.stringify(createdLedger.ledger)}\n`);
  const recoveredRun = await runRuntimeToFreeze(integratedPaths, manifest, createdLedger.ledger, actions, append, () => runtimeStatus(integratedPaths), {
    validator_timeout_ms: 5000,
    now: () => new Date(Date.parse('2026-08-10T01:30:00.000Z') + (++tick * 1000)).toISOString()
  });
  assert.equal(recoveredRun.valid, true, recoveredRun.errors?.join('; '));
  assert.equal(recoveredRun.idempotent, true);
  assert.equal(JSON.parse(fs.readFileSync(integratedPaths.ledger, 'utf8')).ledger_digest, executed.ledger.ledger_digest);
  assert.equal(readRuntimeJournal(integratedPaths.journal).length, eventCountAfterBlockerCycle, 'ledger recovery must not repeat work or append events');

  const forgedReview = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'FINAL_REVIEW_RECORDED', task_id: null, observed_at: '2026-08-10T02:00:00.000Z', idempotency_key: 'forged-review', generation_bindings: generations, payload: { verdict: 'PASS' } });
  assert.equal(forgedReview.valid, false);
  assert(forgedReview.errors.some(error => error.includes('receipt_digest')));
  const candidateDigest = blockedDelivery.state.candidate_digest;
  const reviewReceiptDigest = sha('integrated-review');
  const localOnlyReview = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'FINAL_REVIEW_RECORDED', task_id: null, observed_at: '2026-08-10T02:00:01.000Z', idempotency_key: 'local-only-review', generation_bindings: generations, payload: { receipt_type: 'FINAL_REVIEW_PANEL', release_authorized: false, verdict: 'PASS', review_kind: 'exec', receipt_digest: sha('local-review'), candidate_digest: candidateDigest, base_sha: 'b'.repeat(40), reviewer_family: 'openai', unowned_critical_high: 0 } });
  assert.equal(localOnlyReview.valid, false, 'fast-local review panel must not authorize release');
  assert(localOnlyReview.errors.some(error => error.includes('not release-authorized')));
  const acceptedReview = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'FINAL_REVIEW_RECORDED', task_id: null, observed_at: '2026-08-10T02:00:02.000Z', idempotency_key: 'accepted-review', generation_bindings: generations, payload: { receipt_type: 'FINAL_REVIEW_PANEL', release_authorized: true, verdict: 'PASS', review_kind: 'exec', receipt_digest: reviewReceiptDigest, candidate_digest: candidateDigest, base_sha: 'b'.repeat(40), reviewer_family: 'google', unowned_critical_high: 0 } });
  assert.equal(acceptedReview.valid, true, acceptedReview.errors?.join('; '));
  const forgedSha = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'FINAL_SHA_BOUND', task_id: null, observed_at: '2026-08-10T02:00:03.000Z', idempotency_key: 'forged-sha', generation_bindings: generations, payload: { sha: 'c'.repeat(40), review_receipt_digest: sha('wrong'), candidate_digest: candidateDigest } });
  assert.equal(forgedSha.valid, false);
  const boundSha = appendRuntimeEvent(integratedPaths, { run_id: manifest.run_id, type: 'FINAL_SHA_BOUND', task_id: null, observed_at: '2026-08-10T02:00:04.000Z', idempotency_key: 'bound-sha', generation_bindings: generations, payload: { sha: 'c'.repeat(40), review_receipt_digest: reviewReceiptDigest, candidate_digest: candidateDigest } });
  assert.equal(boundSha.valid, true, boundSha.errors?.join('; '));

  const retryRunId = 'runtime-retry';
  const retryDir = path.join(integratedRoot, 'state', 'runs', retryRunId);
  const retryPaths = {
    runDir: retryDir, manifest: path.join(retryDir, 'manifest.json'), journal: path.join(retryDir, 'journal.jsonl'), journalLock: path.join(retryDir, '.journal.lock'),
    projections: path.join(retryDir, 'projections'), leases: path.join(retryDir, 'leases.json'), ledger: path.join(retryDir, 'consumption-ledger.json'),
    evidenceStore: path.join(retryDir, 'evidence'), effectReceipts: path.join(retryDir, 'effects')
  };
  const retryContract = {
    id: 'artifact-retry', kind: 'VALIDATOR_RESULT', producer_id: 'producer-retry',
    consumer_ids: [{ id: 'consumer-retry', kind: 'RUNTIME', condition: 'BEFORE_TASK_ACCEPTANCE' }], outcome_ids: ['outcome-retry'],
    source_digest: sha('source-retry'), invalidation_input_digests: [sha('input-retry')], freshness: { mode: 'IMMUTABLE', max_age_seconds: null },
    idempotency_key: 'produce-retry', retention: 'RUN'
  };
  const retryProtocol = { generation_bindings: generations, artifacts: [retryContract] };
  const retryGraph = { generation_bindings: generations, nodes: [{ id: 'outcome-retry', type: 'OUTCOME', status: 'RESOLVED' }, { id: 'evidence-retry', type: 'EVIDENCE', status: 'RESOLVED' }], edges: [] };
  const retryCapsule = capsule('RETRY');
  const retryFlag = path.join(repositoryRoot, 'retry-once.flag');
  retryCapsule.allowed_files = [{ path: 'retry-once.flag', action: 'CREATE' }];
  retryCapsule.effect_capabilities[0].targets = ['retry-once.flag'];
  retryCapsule.validations[0] = {
    id: 'retry-once', argv: [process.execPath, '-e', "const fs=require('fs');const f=process.argv[1];if(!fs.existsSync(f)){fs.writeFileSync(f,'failed-once');process.exit(7)}", retryFlag],
    inputs: ['retry-once.flag'], validator_digest: sha('retry-validator'), environment_class: 'hermetic', cost_class: 'micro', required_at_freeze: true
  };
  const retryLedger = createConsumptionLedger({
    run_id: retryRunId, generation_bindings: generations, protocol_digest: protocolDigest, product_graph_digest: productGraphDigest,
    artifact_contracts: [retryContract], producer_task_ids: { 'artifact-retry': 'RETRY' }, invalidation_input_names: { 'artifact-retry': ['input:0'] },
    minimum_trust_levels: { 'artifact-retry': 'hermetic' }, validation_options: { protocol: retryProtocol, productGraph: retryGraph, protocolDigest, productGraphDigest }
  });
  assert.equal(retryLedger.valid, true, retryLedger.errors?.join('; '));
  const retryObject = {
    schema_version: 2, kind: retryContract.kind, trust_level: 'hermetic', subject: retryContract.id, producer_id: retryContract.producer_id,
    consumer_ids: ['consumer-retry'], generation_bindings: generations,
    relevant_digests: { protocol_digest: protocolDigest, product_graph_digest: productGraphDigest, source_digest: retryContract.source_digest, 'input:0': retryContract.invalidation_input_digests[0] },
    environment_identity: 'runtime-retry-local', created_at: '2026-08-10T03:00:10.000Z', expires_at: null,
    payload: { artifact_id: retryContract.id, graph_node_id: 'evidence-retry' }
  };
  retryObject.object_digest = contentDigest(retryObject);
  const retryActions = { max_active: 1, tasks: { RETRY: {
    principal_id: 'retry-worker', validator_ids: ['retry-once'], effects: [],
    evidence_objects: [{ artifact_id: retryContract.id, object: retryObject, idempotency_key: retryContract.idempotency_key, produced_at: '2026-08-10T03:00:10.000Z' }],
    acknowledgements: [{ artifact_id: retryContract.id, object_digest: retryObject.object_digest, consumer_id: 'consumer-retry', condition: 'BEFORE_TASK_ACCEPTANCE', idempotency_key: 'ack-retry', acknowledged_at: '2026-08-10T03:00:11.000Z' }],
    required_artifact_ids: [retryContract.id],
    progress: { idempotency_key: 'progress-retry', prior_state_digest: sha('retry-prior'), next_state_digest: sha('retry-next'), causal_fingerprint: sha('retry-cause'), evidence_refs: [{ object_digest: retryObject.object_digest, artifact_id: retryContract.id, graph_node_id: 'evidence-retry', consumer_id: 'consumer-retry', role: 'NEW_EVIDENCE' }], resolved_obligations: [], authorized_decisions: [], uncertainty_reductions: [], recorded_at: '2026-08-10T03:00:12.000Z' }
  } } };
  const retryManifest = { schema_version: 2, run_id: retryRunId, repository_root: repositoryRoot, generation_bindings: generations, protocol_digest: protocolDigest, product_graph_digest: productGraphDigest, protocol: retryProtocol, product_graph: retryGraph, capsules: [retryCapsule], manifest_digest: sha('retry-manifest') };
  fs.mkdirSync(retryDir, { recursive: true });
  fs.writeFileSync(retryPaths.manifest, `${JSON.stringify(retryManifest)}\n`);
  fs.writeFileSync(retryPaths.ledger, `${JSON.stringify(retryLedger.ledger)}\n`);
  assert.equal(appendRuntimeEvent(retryPaths, { run_id: retryRunId, type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T03:00:00.000Z', idempotency_key: 'retry-compile', generation_bindings: generations, payload: { manifest_digest: retryManifest.manifest_digest } }).valid, true);
  let retryTick = 0;
  const retryAppend = input => appendRuntimeEvent(retryPaths, { ...input, run_id: retryRunId, generation_bindings: generations });
  const retryNow = () => new Date(Date.parse('2026-08-10T03:00:00.000Z') + (++retryTick * 1000)).toISOString();
  const firstAttempt = await runRuntimeToFreeze(retryPaths, retryManifest, retryLedger.ledger, retryActions, retryAppend, () => runtimeStatus(retryPaths), { validator_timeout_ms: 5000, now: retryNow });
  assert.equal(firstAttempt.valid, false);
  assert.equal(firstAttempt.stopped, true);
  assert.equal(runtimeStatus(retryPaths).status, 'STOPPED');
  assert.equal(runtimeStatus(retryPaths).tasks[0].status, 'PLANNED');
  const resumed = await runRuntimeToFreeze(retryPaths, retryManifest, JSON.parse(fs.readFileSync(retryPaths.ledger)), retryActions, retryAppend, () => runtimeStatus(retryPaths), { validator_timeout_ms: 5000, now: retryNow });
  assert.equal(resumed.valid, true, resumed.errors?.join('; '));
  assert.equal(resumed.frozen, true);
  const retryEvents = readRuntimeJournal(retryPaths.journal);
  assert(retryEvents.some(event => event.type === 'TASK_ATTEMPT_FAILED'));
  assert(retryEvents.some(event => event.type === 'RUN_RESUMED'));
  assert(retryEvents.some(event => event.type === 'TASK_LEASE_RECLAIMED' && event.payload.generation === 2));
  assert.equal(retryEvents.filter(event => event.type === 'TASK_CONSUMED').length, 1);

  const mandatoryProductionObligations = [
    'OUTCOME_AND_SCOPE', 'PRODUCT_CODE', 'VALIDATION', 'HOLISTIC_REVIEW',
    'FINAL_SHA_AND_LANDING', 'RELEASE_AND_CONFIG', 'LIVE_VERIFICATION', 'ROLLBACK',
    'OPERABILITY', 'OUTCOME_OBSERVATION', 'PLATFORM_AND_DEVICE'
  ];
  const allProductionObligations = [
    'OUTCOME_AND_SCOPE', 'PRODUCT_CODE', 'DATA_AND_MIGRATION', 'AUTH_AND_PRIVACY',
    'EXTERNAL_INTEGRATIONS', 'PLATFORM_AND_DEVICE', 'VALIDATION', 'HOLISTIC_REVIEW',
    'FINAL_SHA_AND_LANDING', 'RELEASE_AND_CONFIG', 'LIVE_VERIFICATION', 'ROLLBACK',
    'OPERABILITY', 'OUTCOME_OBSERVATION'
  ];
  const forecastCapsules = mandatoryProductionObligations.map((obligation, index) => {
    const row = capsule(`F${index}`);
    row.active_budget_seconds = 1;
    if (obligation === 'PLATFORM_AND_DEVICE') row.effect_capabilities.push({
      id: 'android-device-proof', principal: 'root', kind: 'device', targets: ['android:serial-1'],
      max_cost_usd: 0, root_only: true, requires_idempotency: true, reversible: false
    });
    return row;
  });
  const unsupportedDeviceForecast = compileProductionDeliveryForecast({
    active_minutes_max: 60, baseline_feature_minutes: 1440, required_speedup: 24,
    risk_reserve_seconds: 60, max_parallel: 16, forecast_mode: 'SHADOW',
    estimate_basis: 'DECLARED_TARGETS', calibration_samples: 0, estimate_confidence: 'LOW',
    external_wait_clock: 'VISIBLE_SEPARATE',
    production_obligations: allProductionObligations.map(obligation => {
      const index = mandatoryProductionObligations.indexOf(obligation);
      const required = index !== -1;
      return {
        id: obligation, disposition: required ? 'REQUIRED' : 'NOT_APPLICABLE',
        task_ids: required ? [`F${index}`] : [], readiness: required ? 'READY' : 'NOT_APPLICABLE',
        external_wait_seconds: required ? 0 : null
      };
    })
  }, forecastCapsules);
  assert.equal(unsupportedDeviceForecast.valid, false);
  assert.deepEqual(unsupportedDeviceForecast.unsupported_effect_kinds, ['device']);
  assert(unsupportedDeviceForecast.errors.some(error => error.includes('product-specific adapter')));

  const source = fs.readFileSync('scripts/svc-runtime-v2.mjs', 'utf8');
  for (const command of ['compile', 'run', 'resume', 'status', 'release', 'observe']) assert(source.includes(`command === "${command}"`) || source.includes(`command === \"${command}\"`), `missing ${command} command`);
  assert(!source.includes('execSync(')); assert(source.includes('runRuntimeToFreeze')); assert(source.includes('executeReleaseEffect'));
  console.log('PASS validate-runtime-v2');
} finally { fs.rmSync(root, { recursive: true, force: true }); }
