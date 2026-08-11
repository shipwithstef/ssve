#!/usr/bin/env node

import assert from 'node:assert/strict';
import { compileOwnerDecision, compileResearchEvidence } from '../../../scripts/lib/runtime-owner-decision-v2.mjs';

const h = value => value.repeat(64);
const generations = Object.fromEntries([
  'protocol_generation_digest', 'product_generation_digest', 'context_generation_digest',
  'concern_generation_digest', 'control_generation_digest', 'authority_generation_digest',
  'layer_inventory_digest',
].map((key, index) => [key, String(index + 1).repeat(64)]));
const base = {
  decision_id: 'd1', run_id: 'r1', mode: 'autonomous', language: 'bg', question: 'Коя пълна опция?',
  options: [
    { option_id: 'a', hard_constraints_pass: true, evidence_weight: 5, expected_product_value: 9, value_of_information: 1, max_regret: 2, reversibility: 8, critical_path_minutes: 55 },
    { option_id: 'b', hard_constraints_pass: true, evidence_weight: 4, expected_product_value: 9, value_of_information: 1, max_regret: 2, reversibility: 8, critical_path_minutes: 40 },
  ],
  authority: { surface: 'decide', principal: 'owner', delegation_digest: h('a'), within_delegation: true },
  evidence_ids: ['e1'], uncertainty_ids: [], generation_bindings: generations,
};
const decision = compileOwnerDecision(base);
assert.equal(decision.selected_option_id, 'a');
assert.deepEqual(decision.rejected_option_ids, ['b']);
assert.throws(() => compileOwnerDecision({ ...base, authority: { ...base.authority, surface: 'chat' } }), /sole owner-facing/);
assert.throws(() => compileOwnerDecision({ ...base, authority: { ...base.authority, within_delegation: false } }), /exceeds signed delegation/);
assert.throws(() => compileOwnerDecision(base, [decision.question_digest]), /repeats/);
assert.throws(() => compileOwnerDecision({ ...base, selected_option_id: 'b' }), /top-ranked/);
assert.throws(() => compileResearchEvidence({ uncertainty_id: 'u1', consumer_id: 'd1', source: 'x', fresh_until: '2026-08-11', writes: [] }), /side-effect-free/);
assert.equal(compileResearchEvidence({ uncertainty_id: 'u1', consumer_id: 'd1', source: 'x', fresh_until: '2026-08-11', claim: 'c' }).consumer_ids[0], 'd1');
console.log('PASS validate-owner-decision-v2');
