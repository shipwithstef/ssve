#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  MUTATION_CLASSES,
  RUNTIME_TRANSITION_MUTANTS,
  collectRuntimeTransitionMutationReceipts,
  evaluateRuntimeClosure,
  executeRuntimeTransitionMutant
} from '../../../scripts/lib/runtime-assurance-v2.mjs';

assert.equal(MUTATION_CLASSES.length, 130, 'mutation catalog must contain 130 executable transition classes');
assert.equal(new Set(MUTATION_CLASSES).size, MUTATION_CLASSES.length, 'mutation classes must be distinct');
assert.equal(new Set(RUNTIME_TRANSITION_MUTANTS.map(mutant => `${mutant.detector}:${mutant.prior_state}:${mutant.attempted_transition}`)).size, 130);
const receipts = collectRuntimeTransitionMutationReceipts();
assert.equal(receipts.length, 130);
for (const [index, mutant] of RUNTIME_TRANSITION_MUTANTS.entries()) {
  const receipt = executeRuntimeTransitionMutant(mutant);
  assert.equal(receipt.outcome, 'KILLED', `${mutant.id} was not rejected by ${mutant.detector}`);
  assert.match(receipt.rejection, /illegal/i);
  assert.equal(receipt.receipt_digest, receipts[index].receipt_digest);
}
const baseline = { mutation_receipts: receipts, delivery_state: 'DELIVERY_VERIFIED', outcome_state: 'OUTCOME_DECIDED', production_proven: true };
assert.deepEqual(evaluateRuntimeClosure(baseline), { valid: true, failed_mutations: [], unknown_mutations: [], delivery_closed: true, outcome_closed: true });
const missing = structuredClone(baseline); missing.mutation_receipts.splice(17, 1);
assert.equal(evaluateRuntimeClosure(missing).valid, false, 'missing actual mutation receipt escaped closure');
const forged = structuredClone(baseline); forged.mutation_receipts[0].outcome = 'KILLED'; forged.mutation_receipts[0].rejection = 'invented';
assert.equal(evaluateRuntimeClosure(forged).valid, false, 'forged mutation receipt escaped closure');
assert.equal(evaluateRuntimeClosure({ ...baseline, production_proven: false }).delivery_closed, false);
assert.equal(evaluateRuntimeClosure({ ...baseline, delivery_state: 'TASK_ACCEPTED' }).delivery_closed, false);
assert.equal(evaluateRuntimeClosure({ ...baseline, outcome_state: 'LEARNING_PROMOTED' }).outcome_closed, false);
console.log(`PASS validate-runtime-assurance-mutations-v2 (${MUTATION_CLASSES.length} distinct executable transition mutants, zero false closure)`);
