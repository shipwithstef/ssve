#!/usr/bin/env node

export const RELEASE_LIFECYCLE_TRANSITIONS = Object.freeze({
  FINAL_REVIEW_PASSED: ['FINAL_SHA_BOUND'], FINAL_SHA_BOUND: ['ROLLBACK_READY'],
  ROLLBACK_READY: ['PRODUCTION_RELEASED'], PRODUCTION_RELEASED: ['CANARY_RUNNING', 'ROLLED_BACK'],
  CANARY_RUNNING: ['LIVE_VERIFIED', 'ROLLED_BACK'], LIVE_VERIFIED: ['DELIVERY_VERIFIED', 'ROLLED_BACK'],
  DELIVERY_VERIFIED: ['OUTCOME_OBSERVING'], OUTCOME_OBSERVING: ['OUTCOME_OBSERVED'],
  OUTCOME_OBSERVED: ['NEXT_DECISION_RECORDED'], NEXT_DECISION_RECORDED: ['OUTCOME_DECIDED'],
  OUTCOME_DECIDED: [], ROLLED_BACK: [],
});

function fail(message) { throw new Error(`release-lifecycle-v2: ${message}`); }

export function createReleaseLifecycle(input) {
  if (!input?.final_review_evidence_id) fail('final review evidence is required');
  if (!/^[a-f0-9]{40,64}$/.test(input.final_sha ?? '')) fail('resolved final SHA is required');
  if (!input?.rollback?.effect_id || !input?.rollback?.target_digest) fail('typed rollback effect is required before release');
  if (!input?.release?.effect_id || !input?.release?.artifact_digest) fail('typed release effect and artifact are required');
  if (input.release.simulation_only !== true && input.release.production_proof !== true) fail('release must explicitly declare production proof or simulation-only status');
  if (!Array.isArray(input?.live?.probe_ids) || input.live.probe_ids.length === 0) fail('at least one live probe is required');
  if (!input?.observation?.metric_id || !input?.observation?.window_starts_at || !input?.observation?.window_ends_at || !input?.observation?.consumer_id) fail('durable outcome observation is required');
  return {
    schema_version: 'release-lifecycle-v2', run_id: input.run_id, state: 'FINAL_REVIEW_PASSED',
    final_review_evidence_id: input.final_review_evidence_id, final_sha: input.final_sha,
    release: { ...input.release, status: 'planned' }, rollback: { ...input.rollback, tested: false },
    live: { ...input.live, verified: false, evidence_ids: [] }, observation: { ...input.observation, status: 'scheduled' },
    active_minutes: input.active_minutes ?? 0, slo_status: 'TARGET', generation_bindings: input.generation_bindings,
  };
}

export function transitionReleaseLifecycle(current, nextState, evidence = {}) {
  if (!(RELEASE_LIFECYCLE_TRANSITIONS[current.state] ?? []).includes(nextState)) fail(`illegal transition ${current.state} -> ${nextState}`);
  const next = structuredClone(current); next.state = nextState;
  if (nextState === 'FINAL_SHA_BOUND' && evidence.final_sha !== current.final_sha) fail('final SHA evidence does not match bound SHA');
  if (nextState === 'ROLLBACK_READY') {
    if (evidence.effect_id !== current.rollback.effect_id || !evidence.evidence_id) fail('rollback readiness requires matching executed effect and evidence');
    next.rollback.tested = true; next.rollback.evidence_id = evidence.evidence_id;
  }
  if (nextState === 'PRODUCTION_RELEASED') {
    if (!current.rollback.tested) fail('release requires proven rollback readiness');
    if (evidence.effect_id !== current.release.effect_id || !evidence.evidence_id) fail('release requires matching executed effect and evidence');
    next.release.status = 'released'; next.release.evidence_id = evidence.evidence_id;
  }
  if (nextState === 'LIVE_VERIFIED') {
    const supplied = new Set(evidence.probe_ids ?? []);
    if (!current.live.probe_ids.every(id => supplied.has(id)) || !Array.isArray(evidence.evidence_ids) || evidence.evidence_ids.length === 0) fail('all live probes need evidence');
    next.live.verified = true; next.live.evidence_ids = evidence.evidence_ids;
  }
  if (nextState === 'DELIVERY_VERIFIED' && (!current.live.verified || !current.rollback.tested || current.release.simulation_only || !current.release.production_proof)) fail('delivery needs real production, live and rollback proof');
  if (nextState === 'OUTCOME_OBSERVING') next.observation.status = 'observing';
  if (nextState === 'OUTCOME_OBSERVED') {
    if (!Number.isFinite(evidence.observed) || !evidence.evidence_id) fail('observed metric and evidence are required');
    next.observation.status = 'observed'; next.observation.observed = evidence.observed;
    next.observation.delta = evidence.observed - (current.observation.baseline ?? 0); next.observation.evidence_id = evidence.evidence_id;
  }
  if (nextState === 'NEXT_DECISION_RECORDED') {
    if (!evidence.next_decision_id) fail('next product decision is required');
    next.observation.next_decision_id = evidence.next_decision_id;
  }
  if (nextState === 'ROLLED_BACK') {
    if (!current.rollback.tested || evidence.effect_id !== current.rollback.effect_id || !evidence.evidence_id) fail('rollback requires the authorized tested effect and evidence');
    next.release.status = 'rolled-back'; next.slo_status = 'CANARY_FAIL';
  }
  if (Number.isFinite(evidence.active_minutes)) next.active_minutes = evidence.active_minutes;
  if (nextState === 'DELIVERY_VERIFIED') next.slo_status = next.active_minutes <= 60 && current.release.production_proof && !current.release.simulation_only ? 'CANARY_PASS' : 'CANARY_FAIL';
  return next;
}

export function isDeliveryClosed(state) { return ['DELIVERY_VERIFIED', 'OUTCOME_OBSERVING', 'OUTCOME_OBSERVED', 'NEXT_DECISION_RECORDED', 'OUTCOME_DECIDED'].includes(state.state); }
export function isOutcomeClosed(state) { return state.state === 'OUTCOME_DECIDED'; }
