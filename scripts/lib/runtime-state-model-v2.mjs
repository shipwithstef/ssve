#!/usr/bin/env node

export const TASK_EVENT_TRANSITIONS = Object.freeze({
  PLANNED: Object.freeze({ TASK_LEASE_ACQUIRED: 'LEASED', TASK_LEASE_RECLAIMED: 'LEASED', TASK_LEGACY_ACCEPTED_IMPORTED: 'ACCEPTED' }),
  LEASED: Object.freeze({ TASK_HEARTBEAT: 'LEASED', TASK_LEASE_EXPIRED: 'PLANNED', TASK_DISPATCHED: 'RUNNING' }),
  RUNNING: Object.freeze({
    TASK_HEARTBEAT: 'RUNNING', TASK_LEASE_EXPIRED: 'PLANNED', TASK_ATTEMPT_FAILED: 'PLANNED', VALIDATOR_STARTED: 'RUNNING',
    VALIDATOR_FINISHED: 'RUNNING', EFFECT_AUTHORIZED: 'RUNNING', EFFECT_EXECUTED: 'RUNNING',
    EFFECT_COMPENSATED: 'RUNNING', EVIDENCE_PRODUCED: 'RUNNING', EVIDENCE_CONSUMED: 'RUNNING',
    EVIDENCE_INVALIDATED: 'RUNNING', CAUSAL_PROGRESS_RECORDED: 'RUNNING', TASK_ACCEPTED: 'ACCEPTED'
  }),
  ACCEPTED: Object.freeze({ EVIDENCE_CONSUMED: 'ACCEPTED', EVIDENCE_INVALIDATED: 'RUNNING', TASK_CONSUMED: 'CONSUMED' }),
  CONSUMED: Object.freeze({})
});

export const TASK_EVENT_TYPES = Object.freeze([...new Set(Object.values(TASK_EVENT_TRANSITIONS).flatMap(row => Object.keys(row)))]);

export function transitionTaskState(state, eventType) {
  const next = TASK_EVENT_TRANSITIONS[state]?.[eventType];
  return next ? { valid: true, prior_state: state, next_state: next } : { valid: false, prior_state: state, next_state: null, errors: [`illegal task event ${eventType} from ${state}`] };
}
