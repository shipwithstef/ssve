#!/usr/bin/env node

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { aggregateReviewTopology, resolveExternalReviewer, resolveReviewTopology } from '../../../scripts/review-topology-v2.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-review-topology-'));
const config = path.join(root, 'reviewers.json');
const phase = (releaseAuthority, agyRequired) => ({ release_authority: releaseAuthority, stations: [
  { id: 'self', kind: 'inline-self', required: true, authority: 'advisory', tuple: { host: 'current', family: 'openai', model: 'current', effort: 'high' } },
  { id: 'sol', kind: 'subagent', required: true, authority: 'advisory', tuple: { host: 'codex-subagent', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' } },
  { id: 'agy', kind: 'external', required: agyRequired, authority: 'independent', tuple: { host: 'agy', family: 'google', model: 'Gemini 3.6 Flash (High)', effort: 'high' } },
  { id: 'opus', kind: 'external', required: false, authority: 'independent', tuple: { host: 'claude', family: 'anthropic', model: 'claude-opus-4-6', effort: 'xhigh' } },
] });
const policy = { schema_version: 2, authority: 'repository-owner', default_mode: 'fast', modes: {
  fast: { orchestrators: { codex: { plan: phase(false, false), exec: phase(false, false) } } },
  production: { orchestrators: { codex: { plan: phase(true, true), exec: phase(true, true) } } },
} };
fs.writeFileSync(config, `${JSON.stringify(policy, null, 2)}\n`, { mode: 0o600 });

const fast = resolveReviewTopology({ configPath: config, orchestrator: 'codex', phase: 'exec' });
assert.equal(fast.mode, 'fast'); assert.equal(fast.release_authority, false); assert.equal(fast.final_receipt_count, 1);
assert.deepEqual(fast.stations.map(row => row.id), ['self', 'sol', 'agy', 'opus']);
const selectedAgy = resolveExternalReviewer({ configPath: config, mode: 'production', orchestrator: 'codex', phase: 'exec', stationId: 'agy' });
assert.deepEqual(selectedAgy.tuple, { orchestrator: 'codex', host: 'agy', family: 'google', model: 'Gemini 3.6 Flash (High)', effort: 'high' });
assert.throws(() => resolveExternalReviewer({ configPath: config, orchestrator: 'codex', phase: 'exec', stationId: 'sol' }), /not an external reviewer/);

const candidate = 'a'.repeat(64);
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const externalReceipt = (mode, station, status, classification) => {
  const topology = resolveReviewTopology({ configPath: config, mode, orchestrator: 'codex', phase: 'exec' });
  const file = path.join(root, `${mode}-${station.id}-${status}.json`);
  const findingsFile = path.join(root, `${mode}-${station.id}-${status}-findings.json`);
  const tuple = { orchestrator: 'codex', ...station.tuple };
  const success = status === 'success';
  const findings = success ? {
    schema_version: 1, review_kind: 'exec', rubric_score: 10, rubric_failures: null, dependencies_needing_read: null,
    reviewer: station.tuple, verdict: 'pass', summary: 'fixture pass', findings: [], certifications: [],
  } : null;
  const findingsBytes = findings ? Buffer.from(`${JSON.stringify(findings)}\n`) : null;
  if (findingsBytes) fs.writeFileSync(findingsFile, findingsBytes, { mode: 0o600 });
  const body = {
    schema_version: 2, launcher_version: '2.4.0', cli_version: 'fixture', request_id: `fixture-${mode}-${station.id}`,
    review_kind: 'exec', candidate_digest: candidate, package_sha256: '1'.repeat(64), findings_schema_sha256: '2'.repeat(64), findings_sha256: findingsBytes ? digest(findingsBytes) : null, cache_key: '3'.repeat(64), fixture_mode: true,
    started_at: '2026-08-10T00:00:00.000Z', finished_at: '2026-08-10T00:00:01.000Z', status, classification,
    requested_tuple: tuple, invocation_tuple: tuple, effective_tuple: success ? tuple : null,
    attempts: [{ index: 1, tuple, started_at: '2026-08-10T00:00:00.000Z', finished_at: '2026-08-10T00:00:01.000Z', exit_code: success ? 0 : 1, classification, command: { binary: station.tuple.host, argv: ['--model', station.tuple.model] }, artifacts: { events: file, stderr: file, findings: success ? file : null }, usage: {} }],
    fallback: { eligible: false, used: false, reason: success ? null : classification },
    override: { used: false, authority: null, source: null, path: null, expected_sha256: null, actual_sha256: null },
    policy: { version: 2, profile: `${mode}:${station.id}`, source: 'owner-config', resolved_at: '2026-08-10T00:00:00.000Z', effective_window: { starts_at: null, ends_at: null }, cutover_utc: null, cutover_local: null, timezone: null, selection_sha256: topology.config_sha256, selection_expires_at: null, selection_authority: 'repository-owner' },
    protocol: { process_invocations: 1, configured_turn_ceiling: null, configured_budget_usd: null, reported_turns: null, stop_reason: null, terminal_reason: success ? 'success' : 'provider_error', errors: [] },
    route: { kind: success ? 'owner_config_primary' : 'hard_failure', switching_enabled: false, cli_fallback_configured: false, evidence: success ? 'requested_primary' : 'failure' },
    effective_effort: { value: success ? station.tuple.effort : null, provenance: success && station.tuple.effort === 'provider-managed' ? 'provider-managed' : success ? 'requested' : 'none' },
    model_attestation: { level: success ? 'requested_accepted' : 'none', requested_model: station.tuple.model, observed_models: [], evidence: success ? 'fixture-exact-tuple' : null },
    phase_guard: { applicable: false, kind: 'exec', decision: 'not-applicable', reason: null, wi: null, pre_execution_base: null, plan_manifest_sha256: null, exec_record_present: null, exec_record_path: null, implementation_diverged: null, diverged_files: [], base_resolved: null, override: { used: false, authority: null, source: null, path: null, expected_sha256: null, actual_sha256: null, kind: null } },
    package_context: { version: 1, context_root: root, base_package_sha256: '4'.repeat(64), files: [] },
    cache: { disposition: success ? 'published' : 'not_reusable', reusable: success, entry: success ? root : null },
    artifacts: { findings: success ? findingsFile : null, receipt: file, capabilities: file }, usage: {},
    reviewer_run: { commands: [{ binary: station.tuple.host, argv: ['--model', station.tuple.model] }], output_artifacts: [file, ...(success ? [findingsFile] : [])] }
  };
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`); fs.writeFileSync(file, bytes, { mode: 0o600 });
  return { file, findingsFile, digest: digest(bytes) };
};
let localReceiptSequence = 0;
const localReceipt = (id, reviewer) => {
  const file = path.join(root, `${id}-${localReceiptSequence += 1}-station-receipt.json`);
  const body = { schema_version: 2, receipt_type: 'REVIEW_STATION', station_id: id, station_kind: id === 'self' ? 'inline-self' : 'subagent', candidate_digest: candidate, reviewed_at: '2026-08-10T00:00:00.000Z', reviewer, verdict: 'pass', summary: 'fixture pass', findings: [] };
  const bytes = Buffer.from(`${JSON.stringify(body)}\n`); fs.writeFileSync(file, bytes, { mode: 0o600 });
  return { file, digest: digest(bytes) };
};
const report = (id, reviewer, extra = {}) => {
  const local = ['self', 'sol'].includes(id) ? localReceipt(id, reviewer) : null;
  return { id, status: 'pass', candidate_digest: candidate, reviewer, receipt_path: local?.file ?? null, receipt_digest: local?.digest ?? null, capability_receipt_digest: null, classification: null, unresolved_critical: 0, undispositioned_high: 0, notes: '', ...extra };
};
const input = mode => {
  const topology = resolveReviewTopology({ configPath: config, mode, orchestrator: 'codex', phase: 'exec' });
  const agyStation = topology.stations.find(row => row.id === 'agy');
  const opusStation = topology.stations.find(row => row.id === 'opus');
  const agyReceipt = externalReceipt(mode, agyStation, 'success', 'success');
  const opusReceipt = externalReceipt(mode, opusStation, 'failure', 'model_entitlement');
  return { schema_version: 2, config_path: config, config_sha256: topology.config_sha256, mode, orchestrator: 'codex', phase: 'exec', candidate_digest: candidate, stations: [
    report('self', { host: 'current', family: 'openai', model: 'current', effort: 'high' }),
    report('sol', { host: 'codex-subagent', family: 'openai', model: 'gpt-5.6-sol', effort: 'high' }),
    report('agy', { host: 'agy', family: 'google', model: 'Gemini 3.6 Flash (High)', effort: 'high' }, { receipt_path: agyReceipt.file, receipt_digest: agyReceipt.digest }),
    report('opus', { host: 'claude', family: 'anthropic', model: 'claude-opus-4-6', effort: 'xhigh' }, { status: 'unavailable', receipt_path: opusReceipt.file, receipt_digest: null, capability_receipt_digest: opusReceipt.digest, classification: 'model_entitlement' }),
  ] };
};

let result = aggregateReviewTopology(input('fast'));
assert.equal(result.verdict, 'PASS'); assert.equal(result.release_authorized, false);
result = aggregateReviewTopology(input('production'));
assert.equal(result.verdict, 'PASS'); assert.equal(result.release_authorized, true); assert.deepEqual(result.independent_families, ['google']);
const blocked = input('production'); blocked.stations[2].undispositioned_high = 1;
assert.throws(() => aggregateReviewTopology(blocked), /report counts do not match canonical findings/);
const missing = input('production'); missing.stations = missing.stations.filter(row => row.id !== 'agy');
assert.equal(aggregateReviewTopology(missing).verdict, 'FAIL');
const changed = input('production'); changed.config_sha256 = '9'.repeat(64);
assert.throws(() => aggregateReviewTopology(changed), /config digest changed/);
const wrongEffort = input('fast'); wrongEffort.stations[1].reviewer.effort = 'xhigh';
assert.throws(() => aggregateReviewTopology(wrongEffort), /tuple mismatch/);
const forgedSolReceipt = input('production'); forgedSolReceipt.stations[1].receipt_digest = '1'.repeat(64);
assert.throws(() => aggregateReviewTopology(forgedSolReceipt), /station sol receipt digest mismatch/);
const launderedSol = input('production'); const solPath = launderedSol.stations[1].receipt_path; const solReceipt = JSON.parse(fs.readFileSync(solPath));
solReceipt.verdict = 'fail'; solReceipt.findings = [{ id: 'H1', severity: 'high', claim: 'blocked', analysis: 'blocked', evidence: ['fixture'], proposed_fix: 'fix' }];
const solBytes = Buffer.from(`${JSON.stringify(solReceipt)}\n`); fs.writeFileSync(solPath, solBytes, { mode: 0o600 }); launderedSol.stations[1].receipt_digest = digest(solBytes);
assert.throws(() => aggregateReviewTopology(launderedSol), /station sol report counts do not match canonical receipt findings|station sol report status does not match canonical receipt verdict/);
const forgedReceipt = input('production'); forgedReceipt.stations[2].receipt_digest = '1'.repeat(64);
assert.throws(() => aggregateReviewTopology(forgedReceipt), /receipt digest mismatch/);
const forgedFindings = input('production'); fs.appendFileSync(JSON.parse(fs.readFileSync(forgedFindings.stations[2].receipt_path)).artifacts.findings, ' ');
assert.throws(() => aggregateReviewTopology(forgedFindings), /findings digest mismatch/);
const launderedFailure = input('production');
const launderedReceiptPath = launderedFailure.stations[2].receipt_path;
const launderedReceipt = JSON.parse(fs.readFileSync(launderedReceiptPath));
const failedFindings = { schema_version: 1, review_kind: 'exec', rubric_score: 0, rubric_failures: null, dependencies_needing_read: null, reviewer: launderedFailure.stations[2].reviewer, verdict: 'fail', summary: 'critical', findings: [{ id: 'C1', severity: 'critical', claim: 'blocked', analysis: 'blocked', evidence: ['fixture'], proposed_fix: 'fix' }], certifications: [] };
const failedBytes = Buffer.from(`${JSON.stringify(failedFindings)}\n`); fs.writeFileSync(launderedReceipt.artifacts.findings, failedBytes, { mode: 0o600 });
launderedReceipt.findings_sha256 = digest(failedBytes); const launderedBytes = Buffer.from(`${JSON.stringify(launderedReceipt)}\n`); fs.writeFileSync(launderedReceiptPath, launderedBytes, { mode: 0o600 }); launderedFailure.stations[2].receipt_digest = digest(launderedBytes);
assert.throws(() => aggregateReviewTopology(launderedFailure), /report counts do not match canonical findings|report status does not match canonical findings verdict/);
const incompleteReceipt = input('production');
const incompleteBytes = Buffer.from(`${JSON.stringify({ schema_version: 2, candidate_digest: candidate, review_kind: 'exec', status: 'success', classification: 'success', requested_tuple: { orchestrator: 'codex', ...selectedAgy.station.tuple }, effective_tuple: { orchestrator: 'codex', ...selectedAgy.station.tuple }, policy: { source: 'owner-config', selection_sha256: incompleteReceipt.config_sha256 }, route: { kind: 'owner_config_primary' } })}\n`);
fs.writeFileSync(incompleteReceipt.stations[2].receipt_path, incompleteBytes, { mode: 0o600 }); incompleteReceipt.stations[2].receipt_digest = digest(incompleteBytes);
assert.throws(() => aggregateReviewTopology(incompleteReceipt), /violates canonical schema/);

const unsafeFast = structuredClone(policy); unsafeFast.modes.fast.release_authority = true;
unsafeFast.modes['fast-local'] = unsafeFast.modes.fast; delete unsafeFast.modes.fast; unsafeFast.default_mode = 'fast-local';
for (const route of Object.values(unsafeFast.modes['fast-local'].orchestrators.codex)) route.release_authority = true;
const unsafeFastFile = path.join(root, 'unsafe-fast.json'); fs.writeFileSync(unsafeFastFile, `${JSON.stringify(unsafeFast)}\n`, { mode: 0o600 });
assert.throws(() => resolveReviewTopology({ configPath: unsafeFastFile, orchestrator: 'codex', phase: 'exec' }), /fast-local mode can never carry release authority/);

const unsafeSubagent = structuredClone(policy); unsafeSubagent.modes.fast.orchestrators.codex.exec.stations[1].authority = 'independent';
const unsafeSubagentFile = path.join(root, 'unsafe-subagent.json'); fs.writeFileSync(unsafeSubagentFile, `${JSON.stringify(unsafeSubagent)}\n`, { mode: 0o600 });
assert.throws(() => resolveReviewTopology({ configPath: unsafeSubagentFile, orchestrator: 'codex', phase: 'exec' }), /subagent cannot be independent/);

const launderedCursorAuto = structuredClone(policy);
launderedCursorAuto.modes.fast.orchestrators.codex.exec.stations.push({ id: 'cursor-auto', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'multi', model: 'cursor-auto', effort: 'high' } });
const launderedCursorAutoFile = path.join(root, 'laundered-cursor-auto.json'); fs.writeFileSync(launderedCursorAutoFile, `${JSON.stringify(launderedCursorAuto)}\n`, { mode: 0o600 });
assert.throws(() => resolveReviewTopology({ configPath: launderedCursorAutoFile, orchestrator: 'codex', phase: 'exec' }), /Cursor cannot be independent because its runtime provider family is not attested/);

const launderedPinnedCursor = structuredClone(policy);
launderedPinnedCursor.modes.fast.orchestrators.codex.exec.stations.push({ id: 'cursor-xai-claim', kind: 'external', required: true, authority: 'independent', tuple: { host: 'cursor', family: 'xai', model: 'cursor-grok-4.6-high', effort: 'high' } });
const launderedPinnedCursorFile = path.join(root, 'laundered-pinned-cursor.json'); fs.writeFileSync(launderedPinnedCursorFile, `${JSON.stringify(launderedPinnedCursor)}\n`, { mode: 0o600 });
assert.throws(() => resolveReviewTopology({ configPath: launderedPinnedCursorFile, orchestrator: 'codex', phase: 'exec' }), /Cursor cannot be independent because its runtime provider family is not attested/);

const falseCursorFamily = structuredClone(policy);
falseCursorFamily.modes.fast.orchestrators.codex.exec.stations.push({ id: 'cursor-auto', kind: 'external', required: true, authority: 'advisory', tuple: { host: 'cursor', family: 'anthropic', model: 'cursor-auto', effort: 'high' } });
const falseCursorFamilyFile = path.join(root, 'false-cursor-family.json'); fs.writeFileSync(falseCursorFamilyFile, `${JSON.stringify(falseCursorFamily)}\n`, { mode: 0o600 });
assert.throws(() => resolveReviewTopology({ configPath: falseCursorFamilyFile, orchestrator: 'codex', phase: 'exec' }), /Cursor Auto family must be multi because the provider family is not attested/);

const linkedConfig = path.join(root, 'linked.json'); fs.symlinkSync(config, linkedConfig);
assert.throws(() => resolveReviewTopology({ configPath: linkedConfig, orchestrator: 'codex', phase: 'exec' }), /not a regular file|must not be a symlink/);

console.log('validate-review-topology-v2: PASS (external config, host/phase routing, fast-local non-release panel, production independence, optional capability receipts, digest binding)');
