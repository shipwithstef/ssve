#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createReleaseLifecycle, transitionReleaseLifecycle, isDeliveryClosed, isOutcomeClosed } from '../../../scripts/lib/runtime-release-lifecycle-v2.mjs';

const d = value => value.repeat(64);
const generations = Object.fromEntries(['protocol_generation_digest','product_generation_digest','context_generation_digest','concern_generation_digest','control_generation_digest','authority_generation_digest','layer_inventory_digest'].map((key, i) => [key, String(i + 1).repeat(64)]));
assert.throws(() => createReleaseLifecycle({ run_id: 'simulation', final_review_evidence_id: 'r', final_sha: 'a'.repeat(40), release: { environment: 'local', artifact_digest: d('b'), effect_id: 'e', simulation_only: false, production_proof: false }, rollback: { effect_id: 'rb', target_digest: d('c') }, live: { probe_ids: ['p'] }, observation: { metric_id: 'm', window_starts_at: '2026-08-10T00:00:00Z', window_ends_at: '2026-08-11T00:00:00Z', consumer_id: 'd' }, generation_bindings: generations }), /production proof or simulation-only/);
let state = createReleaseLifecycle({ run_id: 'r1', final_review_evidence_id: 'review-1', final_sha: 'a'.repeat(40), release: { environment: 'production', artifact_digest: d('b'), effect_id: 'release-1', simulation_only: false, production_proof: true }, rollback: { effect_id: 'rollback-1', target_digest: d('c') }, live: { probe_ids: ['probe-1'] }, observation: { metric_id: 'activation', window_starts_at: '2026-08-10T00:00:00Z', window_ends_at: '2026-08-11T00:00:00Z', consumer_id: 'next-decision', baseline: 1 }, generation_bindings: generations });
assert.throws(() => transitionReleaseLifecycle(state, 'PRODUCTION_RELEASED', {}), /illegal/);
state = transitionReleaseLifecycle(state, 'FINAL_SHA_BOUND', { final_sha: 'a'.repeat(40) });
state = transitionReleaseLifecycle(state, 'ROLLBACK_READY', { effect_id: 'rollback-1', evidence_id: 'rb-proof' });
state = transitionReleaseLifecycle(state, 'PRODUCTION_RELEASED', { effect_id: 'release-1', evidence_id: 'release-proof' });
state = transitionReleaseLifecycle(state, 'CANARY_RUNNING');
state = transitionReleaseLifecycle(state, 'LIVE_VERIFIED', { probe_ids: ['probe-1'], evidence_ids: ['live-proof'] });
state = transitionReleaseLifecycle(state, 'DELIVERY_VERIFIED', { active_minutes: 59 });
assert.equal(isDeliveryClosed(state), true); assert.equal(isOutcomeClosed(state), false); assert.equal(state.slo_status, 'CANARY_PASS');
state = transitionReleaseLifecycle(state, 'OUTCOME_OBSERVING');
state = transitionReleaseLifecycle(state, 'OUTCOME_OBSERVED', { observed: 3, evidence_id: 'metric-proof' });
state = transitionReleaseLifecycle(state, 'NEXT_DECISION_RECORDED', { next_decision_id: 'd2' });
state = transitionReleaseLifecycle(state, 'OUTCOME_DECIDED');
assert.equal(isOutcomeClosed(state), true);
console.log('PASS validate-release-lifecycle-v2');
