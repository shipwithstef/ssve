#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export function decideRuntimeCutover(input) {
  const canaryInput = input.real_canary ?? { authorized: false, product: null, baseline_feature_minutes: null, direction_accepted_at: null, live_verified_at: null, active_minutes: null, achieved_speedup: null, evidence_ids: [] };
  const baselineMinutes = canaryInput.baseline_feature_minutes;
  const activeMinutes = canaryInput.active_minutes;
  const targetMinutes = Number.isFinite(baselineMinutes) ? Math.min(60, baselineMinutes / 24) : null;
  const achievedSpeedup = Number.isFinite(baselineMinutes) && Number.isFinite(activeMinutes) && activeMinutes > 0 ? Number((baselineMinutes / activeMinutes).toFixed(2)) : null;
  const timestampsValid = Number.isFinite(Date.parse(canaryInput.direction_accepted_at)) && Number.isFinite(Date.parse(canaryInput.live_verified_at)) && Date.parse(canaryInput.live_verified_at) >= Date.parse(canaryInput.direction_accepted_at);
  const canary = { ...canaryInput, achieved_speedup: achievedSpeedup };
  const realCanaryPass = canary.authorized === true && canary.product === 'Sample' && timestampsValid && Number.isFinite(activeMinutes) && activeMinutes > 0 && activeMinutes <= targetMinutes && canary.evidence_ids.length >= 2;
  const calibration = input.calibration ?? { comparable_runs: 0, measured_p95_active_minutes: null, confidence: 'LOW', evidence_ids: [] };
  const calibrationPass = calibration.comparable_runs >= 3 && calibration.confidence === 'HIGH' &&
    Number.isFinite(calibration.measured_p95_active_minutes) && calibration.measured_p95_active_minutes <= targetMinutes &&
    calibration.evidence_ids.length >= 3;
  // v2 intentionally cannot authorize default cutover from caller-provided labels.
  // Production cutover remains quarantined until a journal/CAS resolver verifies the
  // candidate-bound release, live, rollback, canary, and comparable-run receipts.
  const cutover_authority_verified = false;
  const default_cutover = false;
  const blockers = [];
  if (input.local_state !== 'shadow-ready') blockers.push('local P0-P14 proof is incomplete');
  if (!canary.authorized) blockers.push('real Sample canary is not explicitly authorized');
  if (!realCanaryPass) blockers.push('direction-to-live <=60 active-minute Sample evidence is absent');
  if (!calibrationPass) blockers.push('three-run high-confidence measured p95 calibration for the 24x target is absent');
  if (!input.rollback_proven) blockers.push('real rollback proof is absent');
  if (!input.production_proven) blockers.push('candidate is not production-proven');
  blockers.push('candidate-bound journal/CAS cutover authority is not yet verified');
  return {
    schema_version: 'runtime-cutover-decision-v2', candidate_digest: input.candidate_digest,
    local_state: input.local_state, publication: input.publication ?? 'uncommitted',
    production_proven: input.production_proven === true, slo_minutes: 60, required_speedup: 24,
    slo_status: realCanaryPass && input.rollback_proven ? 'CANARY_PASS' : canary.authorized && Number.isFinite(canary.active_minutes) ? 'CANARY_FAIL' : 'TARGET',
    real_canary: canary, calibration, rollback_proven: input.rollback_proven === true, cutover_authority_verified, default_cutover, blockers: [...new Set(blockers)],
  };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const index = process.argv.indexOf('--input');
  if (index < 0) throw new Error('usage: svc-cutover-v2.mjs --input FILE');
  const result = decideRuntimeCutover(JSON.parse(fs.readFileSync(path.resolve(process.argv[index + 1]), 'utf8')));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
