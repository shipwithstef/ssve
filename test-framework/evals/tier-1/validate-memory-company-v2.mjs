#!/usr/bin/env node

import assert from 'node:assert/strict';
import { compileMemoryEvidence, disposeMemoryEvidence, compileApprovedCompanyRoute, compileOutcomeLearning, companyOutcomeEffect } from '../../../scripts/lib/runtime-memory-company-v2.mjs';

const generations = Object.fromEntries(['protocol_generation_digest','product_generation_digest','context_generation_digest','concern_generation_digest','control_generation_digest','authority_generation_digest','layer_inventory_digest'].map((key, i) => [key, String(i + 1).repeat(64)]));
const memory = compileMemoryEvidence({ source_path: 'DOCTRINE.md', consumer_id: 'decision-1', fresh_until: '2026-08-11T00:00:00Z', generation_bindings: generations }, process.cwd());
assert.equal(disposeMemoryEvidence(memory, 'used', 'changed selected option').disposition, 'used');
assert.throws(() => disposeMemoryEvidence(memory, 'ignored'), /reason/);
const route = compileApprovedCompanyRoute({ id: 'D-2026-08-10-001', status: 'approved', evidence_resolved: true, recommendation: 'Ship activation' }, { product_id: 'scout', authority_principal: 'owner', generation_bindings: generations });
assert.equal(route.verdict, 'approved');
assert.throws(() => compileApprovedCompanyRoute({ id: 'D', status: 'pending', evidence_resolved: true }, { product_id: 'p', authority_principal: 'o', generation_bindings: generations }), /approved/);
const learning = compileOutcomeLearning({ learning_id: 'l1', product_id: 'scout', source_consumption: { state: 'consumed', ack_id: 'ack-1', product_consumer_id: 'owner', evidence_id: memory.evidence_id }, outcome: { state: 'OUTCOME_OBSERVED', evidence_id: 'metric-1', next_decision_id: 'd2' } });
assert.equal(learning.promoted, true);
assert.throws(() => compileOutcomeLearning({ learning_id: 'l2', product_id: 'p', source_consumption: { state: 'accepted' }, outcome: { state: 'OUTCOME_OBSERVED' } }), /consumed/);
const outcomeEffect = companyOutcomeEffect({ company_state_dir: '/private/company-state', company_decision_id: 'D-2026-08-10-001', outcome: { state: 'OUTCOME_OBSERVED', evidence_id: 'metric-1', result: 'activation improved', worked: 'true', metric_id: 'activation', observed: 3 } });
assert.equal(outcomeEffect.authorization_required, true); assert.equal(outcomeEffect.execute_via, 'typed-effect-runner');
assert.throws(() => companyOutcomeEffect({ company_state_dir: '/x', company_decision_id: 'D', outcome: { state: 'TASK_ACCEPTED' } }), /observed outcome/);
console.log('PASS validate-memory-company-v2');
