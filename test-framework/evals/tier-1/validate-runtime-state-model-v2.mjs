#!/usr/bin/env node

import assert from 'node:assert/strict';
import { TASK_EVENT_TRANSITIONS, TASK_EVENT_TYPES, transitionTaskState } from '../../../scripts/lib/runtime-state-model-v2.mjs';

let allowed = 0; let rejected = 0;
for (const [state, transitions] of Object.entries(TASK_EVENT_TRANSITIONS)) {
  for (const eventType of TASK_EVENT_TYPES) {
    const result = transitionTaskState(state, eventType);
    if (eventType in transitions) {
      assert.equal(result.valid, true, `${state} -> ${eventType} should be allowed`);
      assert.equal(result.next_state, transitions[eventType]); allowed += 1;
    } else {
      assert.equal(result.valid, false, `${state} -> ${eventType} should be rejected`); rejected += 1;
    }
  }
}
let state = 'PLANNED';
for (const eventType of ['TASK_LEASE_ACQUIRED', 'TASK_DISPATCHED', 'VALIDATOR_STARTED', 'VALIDATOR_FINISHED', 'EFFECT_AUTHORIZED', 'EFFECT_EXECUTED', 'EVIDENCE_PRODUCED', 'EVIDENCE_CONSUMED', 'TASK_ACCEPTED', 'TASK_CONSUMED']) {
  const result = transitionTaskState(state, eventType); assert.equal(result.valid, true); state = result.next_state;
}
assert.equal(state, 'CONSUMED'); assert(allowed >= 15); assert(rejected >= 40);
let failedState = 'PLANNED';
for (const eventType of ['TASK_LEASE_ACQUIRED', 'TASK_DISPATCHED', 'VALIDATOR_STARTED', 'VALIDATOR_FINISHED', 'TASK_ATTEMPT_FAILED', 'TASK_LEASE_RECLAIMED']) {
  const result = transitionTaskState(failedState, eventType); assert.equal(result.valid, true, `${failedState} -> ${eventType}`); failedState = result.next_state;
}
assert.equal(failedState, 'LEASED');
console.log(`PASS validate-runtime-state-model-v2 (${allowed} allowed, ${rejected} rejected transitions)`);
