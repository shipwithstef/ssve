#!/usr/bin/env node

import assert from 'node:assert/strict';
import { decideRuntimeCutover } from '../../../scripts/svc-cutover-v2.mjs';

const base = { candidate_digest: 'a'.repeat(64), local_state: 'shadow-ready', publication: 'uncommitted', production_proven: false, rollback_proven: false };
const local = decideRuntimeCutover(base);
assert.equal(local.default_cutover, false); assert.equal(local.slo_status, 'TARGET'); assert.equal(local.production_proven, false);
assert.equal(local.required_speedup, 24); assert.equal(local.calibration.comparable_runs, 0);
const canary = { authorized: true, product: 'Sample', baseline_feature_minutes: 1440, direction_accepted_at: '2026-08-10T00:00:00Z', live_verified_at: '2026-08-10T00:59:00Z', active_minutes: 59, achieved_speedup: null, evidence_ids: ['live', 'rollback'] };
const pass = decideRuntimeCutover({ ...base, production_proven: true, rollback_proven: true, real_canary: canary });
assert.equal(pass.default_cutover, false); assert.equal(pass.slo_status, 'CANARY_PASS'); assert.equal(pass.real_canary.achieved_speedup, 24.41);
assert(pass.blockers.some(blocker => blocker.includes('three-run')));
const calibrated = decideRuntimeCutover({
  ...base, production_proven: true, rollback_proven: true, real_canary: canary,
  calibration: { comparable_runs: 3, measured_p95_active_minutes: 59.5, confidence: 'HIGH', evidence_ids: ['run-1', 'run-2', 'run-3'] }
});
assert.equal(calibrated.default_cutover, false); assert.equal(calibrated.cutover_authority_verified, false); assert.equal(calibrated.slo_status, 'CANARY_PASS');
assert(calibrated.blockers.some(blocker => blocker.includes('journal/CAS cutover authority')));
const slow = decideRuntimeCutover({ ...base, production_proven: true, rollback_proven: true, real_canary: { ...canary, live_verified_at: '2026-08-10T01:01:00Z', active_minutes: 61 } });
assert.equal(slow.default_cutover, false); assert.equal(slow.slo_status, 'CANARY_FAIL');
const shortBaseline = decideRuntimeCutover({ ...base, production_proven: true, rollback_proven: true, real_canary: { ...canary, baseline_feature_minutes: 480, active_minutes: 25 } });
assert.equal(shortBaseline.slo_status, 'CANARY_FAIL', '24x is stricter than 60 minutes for shorter baseline features');
console.log('PASS validate-runtime-cutover-v2');
