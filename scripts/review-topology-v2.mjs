#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from './lib/json-schema-validator.mjs';
import { resolveDispatchExternalReviewer, resolveDispatchReviewTopology } from './resolve-dispatch.mjs';

const DEFAULT_DISPATCH_CONFIG = path.join(os.homedir(), '.svc', 'dispatch-policy.json');
const DEFAULT_LEGACY_CONFIG = path.join(os.homedir(), '.svc', 'reviewer-policy-v2.json');
const DIGEST = /^[a-f0-9]{64}$/;
const OPTIONAL_UNAVAILABLE = new Set(['capability', 'model_unavailable', 'model_entitlement', 'authentication', 'shared_quota', 'provider_overload']);
const HOST_FAMILY = {
  codex: 'openai',
  claude: 'anthropic',
  gemini: 'google',
  agy: 'google',
  grok: 'xai',
};
// Multi-model harnesses (cursor, opencode, kimi) intentionally ABSENT:
// their family comes from the dispatch policy tuple, not from the host name.
// This prevents independence laundering where a multi-model harness running
// the same provider as the orchestrator counts as "different-family".
const STATION_KINDS = new Set(['inline-self', 'subagent', 'external']);
const SCHEMA_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schemas');
const EXTERNAL_RECEIPT_SCHEMA = JSON.parse(fs.readFileSync(path.join(SCHEMA_ROOT, 'external-review-receipt.schema.json'), 'utf8'));
const EXTERNAL_FINDINGS_SCHEMA = JSON.parse(fs.readFileSync(path.join(SCHEMA_ROOT, 'external-review-findings.schema.json'), 'utf8'));
const STATION_RECEIPT_SCHEMA = JSON.parse(fs.readFileSync(path.join(SCHEMA_ROOT, 'review-station-receipt-v2.schema.json'), 'utf8'));

const canonical = value => Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const hash = value => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : typeof value === 'string' ? value : canonical(value)).digest('hex');
function fail(message) { throw new Error(`review-topology-v2: ${message}`); }

export function reviewerPolicyPath(explicit = null) {
  return path.resolve(explicit || process.env.SVC_DISPATCH_POLICY || process.env.SVC_REVIEWER_POLICY || DEFAULT_DISPATCH_CONFIG);
}

function validateTupleLegacy(tuple, station, orchestrator) {
  if (!tuple || typeof tuple !== 'object') fail(`${orchestrator}/${station.id} tuple is required`);
  const keys = Object.keys(tuple).sort().join(',');
  if (keys !== 'effort,family,host,model') fail(`${orchestrator}/${station.id} tuple keys must be effort,family,host,model`);
  if (!['low', 'medium', 'high', 'xhigh', 'max', 'provider-managed'].includes(tuple.effort) || !tuple.host || !tuple.family || !tuple.model) fail(`${orchestrator}/${station.id} tuple values are invalid`);
  if (station.kind === 'external' && HOST_FAMILY[tuple.host] && HOST_FAMILY[tuple.host] !== tuple.family) fail(`${orchestrator}/${station.id} external host/family mismatch`);
  if (tuple.effort === 'provider-managed') fail(`${orchestrator}/${station.id} provider-managed effort is not a verifiable reviewer tuple; configure an exact host effort`);
  if (tuple.host === 'agy' && !new RegExp(`(?:\\(|-)${tuple.effort}\\)?$`, 'i').test(tuple.model)) fail(`${orchestrator}/${station.id} AGY model preset must encode the configured effort`);
  if (station.kind === 'inline-self' && tuple.host !== 'current') fail(`${orchestrator}/${station.id} inline self host must be current`);
  if (station.kind === 'subagent' && HOST_FAMILY[orchestrator] && tuple.family !== HOST_FAMILY[orchestrator]) fail(`${orchestrator}/${station.id} subagent must remain in the orchestrator family`);
}

function validatePhaseLegacy(phase, orchestrator, phaseName) {
  if (!phase || typeof phase !== 'object' || !Array.isArray(phase.stations) || phase.stations.length === 0) fail(`${orchestrator}/${phaseName} stations are required`);
  if (typeof phase.release_authority !== 'boolean') fail(`${orchestrator}/${phaseName} release_authority must be boolean`);
  const ids = new Set();
  for (const station of phase.stations) {
    if (!station?.id || ids.has(station.id)) fail(`${orchestrator}/${phaseName} station ids must be unique`);
    ids.add(station.id);
    if (!STATION_KINDS.has(station.kind) || typeof station.required !== 'boolean' || !['advisory', 'independent'].includes(station.authority)) fail(`${orchestrator}/${phaseName}/${station.id} station contract is invalid`);
    validateTupleLegacy(station.tuple, station, orchestrator);
    if (station.kind === 'inline-self' && station.authority !== 'advisory') fail(`${orchestrator}/${phaseName}/${station.id} self-review cannot be independent`);
    if (station.kind === 'subagent' && station.authority !== 'advisory') fail(`${orchestrator}/${phaseName}/${station.id} subagent cannot be independent release authority`);
    if (station.kind === 'external' && station.authority === 'independent' && HOST_FAMILY[orchestrator] && station.tuple.family === HOST_FAMILY[orchestrator]) fail(`${orchestrator}/${phaseName}/${station.id} independent external authority must be different-family`);
  }
  if (phase.stations[0].kind !== 'inline-self') fail(`${orchestrator}/${phaseName} must start with inline self-review`);
  if (phase.release_authority && HOST_FAMILY[orchestrator] && !phase.stations.some(station => station.kind === 'external' && station.required && station.authority === 'independent' && station.tuple.family !== HOST_FAMILY[orchestrator])) fail(`${orchestrator}/${phaseName} release authority requires a required different-family external station`);
}

function loadLegacyReviewerPolicy(configPath = null) {
  const file = path.resolve(configPath || process.env.SVC_REVIEWER_POLICY || DEFAULT_LEGACY_CONFIG);
  let info;
  try { info = fs.lstatSync(file); } catch (error) { fail(`cannot read owner config ${file}: ${error.code || error.message}`); }
  if (!info.isFile()) fail(`owner config is not a regular file: ${file}`);
  if (info.isSymbolicLink()) fail(`owner config must not be a symlink: ${file}`);
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) fail(`owner config must be owned by the current principal: ${file}`);
  if ((info.mode & 0o022) !== 0) fail(`owner config must not be group/world writable: ${file}`);
  const parent = fs.statSync(path.dirname(file));
  if (typeof process.getuid === 'function' && parent.uid !== process.getuid()) fail(`owner config directory must be owned by the current principal: ${path.dirname(file)}`);
  if ((parent.mode & 0o022) !== 0) fail(`owner config directory must not be group/world writable: ${path.dirname(file)}`);
  const bytes = fs.readFileSync(file);
  let policy;
  try { policy = JSON.parse(bytes); } catch { fail(`owner config is not valid JSON: ${file}`); }
  if (policy.schema_version !== 2 || policy.authority !== 'repository-owner' || typeof policy.default_mode !== 'string' || !policy.modes?.[policy.default_mode]) fail('owner config header/default mode is invalid');
  for (const [modeName, mode] of Object.entries(policy.modes)) {
    if (!mode?.orchestrators || typeof mode.orchestrators !== 'object') fail(`${modeName} has no orchestrators`);
    if (modeName === 'fast-local' && Object.values(mode.orchestrators).some(phases => phases?.plan?.release_authority || phases?.exec?.release_authority)) fail('fast-local mode can never carry release authority');
    for (const [orchestrator, phases] of Object.entries(mode.orchestrators)) {
      if (!HOST_FAMILY[orchestrator]) fail(`${modeName} has unsupported orchestrator ${orchestrator}`);
      for (const phaseName of ['plan', 'exec']) validatePhaseLegacy(phases?.[phaseName], orchestrator, phaseName);
    }
  }
  return { file, sha256: hash(bytes), policy };
}

export function loadReviewerPolicy(configPath = null) {
  const file = reviewerPolicyPath(configPath);
  let bytes;
  try { bytes = fs.readFileSync(file); } catch (error) { fail(`cannot read owner config ${file}: ${error.code || error.message}`); }
  let policy;
  try { policy = JSON.parse(bytes); } catch { fail(`owner config is not valid JSON: ${file}`); }
  if (policy.schema_version === 1) {
    return { file, sha256: hash(bytes), policy, format: 'dispatch-v1' };
  }
  if (policy.schema_version === 2) {
    const loaded = loadLegacyReviewerPolicy(file);
    return { ...loaded, format: 'legacy-v2' };
  }
  fail(`unsupported reviewer policy schema_version ${policy.schema_version ?? '<missing>'}`);
}

function selectLegacyExternalStation(topology, stationId = null) {
  if (stationId) {
    const station = topology.stations.find(row => row.id === stationId);
    if (!station || station.kind !== 'external') fail(`station ${stationId} is not an external reviewer in the selected topology`);
    return station;
  }
  const requiredIndependent = topology.stations.find((station) =>
    station.kind === 'external' && station.required === true && station.authority === 'independent');
  if (requiredIndependent) return requiredIndependent;
  const firstExternal = topology.stations.find(station => station.kind === 'external');
  if (!firstExternal) fail('selected topology has no external stations');
  return firstExternal;
}

export function resolveReviewTopology({
  configPath = null,
  mode = null,
  orchestrator,
  phase,
  wi = null,
  workOverlayPath = null,
  sessionId = null,
  sessionOverrideSpec = null,
  sessionOverrideRequested = null,
  sessionOverrideReceiptSpec = null,
}) {
  if (!orchestrator || !['plan', 'exec', 'design'].includes(phase)) fail('orchestrator is required and phase must be plan|exec|design');
  const loaded = loadReviewerPolicy(configPath);
  if (loaded.format === 'dispatch-v1') {
    const topology = resolveDispatchReviewTopology({
      configPath: loaded.file,
      mode,
      orchestrator,
      phase,
      wi,
      workOverlayPath,
      sessionId,
      sessionOverrideSpec,
      sessionOverrideRequested,
      sessionOverrideReceiptSpec,
    });
    return {
      schema_version: 2,
      config_path: topology.config_path,
      config_sha256: topology.config_sha256,
      mode: topology.mode,
      orchestrator: topology.orchestrator,
      orchestrator_family: topology.orchestrator_family,
      phase: topology.phase,
      release_authority: topology.release_authority,
      final_receipt_count: 1,
      stations: topology.stations.map(station => ({ ...station })),
    };
  }
  if (!['plan','exec'].includes(phase)) fail('phase must be plan|exec');
  const selectedMode = mode || loaded.policy.default_mode;
  const selected = loaded.policy.modes?.[selectedMode]?.orchestrators?.[orchestrator]?.[phase];
  if (!selected) fail(`mode ${selectedMode} has no ${orchestrator}/${phase} route`);
  return {
    schema_version: 2,
    config_path: loaded.file,
    config_sha256: loaded.sha256,
    mode: selectedMode,
    orchestrator,
    orchestrator_family: HOST_FAMILY[orchestrator],
    phase,
    release_authority: selected.release_authority,
    final_receipt_count: 1,
    stations: selected.stations.map((station, index) => ({ order: index + 1, ...station })),
  };
}

export function resolveExternalReviewer({
  configPath = null,
  mode = null,
  orchestrator,
  phase,
  stationId = null,
  wi = null,
  workOverlayPath = null,
  sessionId = null,
  sessionOverrideSpec = null,
  sessionOverrideRequested = null,
  sessionOverrideReceiptSpec = null,
  explicitAsk = false,
  unavailableStations = [],
}) {
  const loaded = loadReviewerPolicy(configPath);
  if (loaded.format === 'dispatch-v1') {
    const resolved = resolveDispatchExternalReviewer({
      configPath: loaded.file,
      mode,
      orchestrator,
      phase,
      stationId,
      wi,
      workOverlayPath,
      sessionId,
      sessionOverrideSpec,
      sessionOverrideRequested,
      sessionOverrideReceiptSpec,
      explicitAsk,
      unavailableStations,
    });
    return { topology: resolveReviewTopology({ configPath: loaded.file, mode, orchestrator, phase, wi, workOverlayPath, sessionId, sessionOverrideSpec, sessionOverrideRequested, sessionOverrideReceiptSpec }), station: resolved.station, tuple: resolved.tuple };
  }
  const topology = resolveReviewTopology({ configPath: loaded.file, mode, orchestrator, phase });
  const station = selectLegacyExternalStation(topology, stationId);
  return { topology, station, tuple: { orchestrator, ...station.tuple } };
}

function validateExternalReceipt(report, station, candidateDigest, topology) {
  if (typeof report.receipt_path !== 'string' || !path.isAbsolute(report.receipt_path)) fail(`external station ${station.id} requires an absolute receipt path`);
  let info;
  try { info = fs.lstatSync(report.receipt_path); } catch { fail(`external station ${station.id} receipt is unreadable`); }
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o022) !== 0) fail(`external station ${station.id} receipt must be a protected regular file`);
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) fail(`external station ${station.id} receipt owner mismatch`);
  const bytes = fs.readFileSync(report.receipt_path);
  const expectedDigest = report.status === 'pass' ? report.receipt_digest : report.capability_receipt_digest;
  if (!DIGEST.test(expectedDigest ?? '') || hash(bytes) !== expectedDigest) fail(`external station ${station.id} receipt digest mismatch`);
  let receipt;
  try { receipt = JSON.parse(bytes); } catch { fail(`external station ${station.id} receipt is not JSON`); }
  const schemaResult = validate(EXTERNAL_RECEIPT_SCHEMA, receipt);
  if (!schemaResult.valid) fail(`external station ${station.id} receipt violates canonical schema: ${schemaResult.errors.join('; ')}`);
  const tuple = receipt.effective_tuple ?? receipt.requested_tuple;
  if (receipt.schema_version !== 2 || receipt.candidate_digest !== candidateDigest || receipt.review_kind !== topology.phase || receipt.policy?.source !== 'owner-config' || receipt.policy?.selection_sha256 !== topology.config_sha256) fail(`external station ${station.id} receipt is not bound to the candidate/config/phase`);
  if (tuple?.host !== station.tuple.host || tuple?.family !== station.tuple.family || tuple?.model !== station.tuple.model || tuple?.effort !== station.tuple.effort) fail(`external station ${station.id} invocation tuple mismatch`);
  if (report.status === 'pass' && (receipt.status !== 'success' || !['success', 'cache_hit'].includes(receipt.classification) || !['owner_config_primary', 'cache_hit'].includes(receipt.route?.kind))) fail(`external station ${station.id} does not carry a successful canonical launcher receipt`);
  if (report.status === 'unavailable' && (receipt.status !== 'failure' || receipt.classification !== report.classification)) fail(`external station ${station.id} unavailable classification does not match its receipt`);
  if (receipt.status !== 'success') return null;
  const findingsPath = receipt.artifacts?.findings;
  if (typeof findingsPath !== 'string' || !path.isAbsolute(findingsPath)) fail(`external station ${station.id} successful receipt requires an absolute findings artifact`);
  let findingsInfo;
  try { findingsInfo = fs.lstatSync(findingsPath); } catch { fail(`external station ${station.id} findings artifact is unreadable`); }
  if (!findingsInfo.isFile() || findingsInfo.isSymbolicLink() || (findingsInfo.mode & 0o022) !== 0) fail(`external station ${station.id} findings must be a protected regular file`);
  if (typeof process.getuid === 'function' && findingsInfo.uid !== process.getuid()) fail(`external station ${station.id} findings owner mismatch`);
  const findingsBytes = fs.readFileSync(findingsPath);
  if (!DIGEST.test(receipt.findings_sha256 ?? '') || hash(findingsBytes) !== receipt.findings_sha256) fail(`external station ${station.id} findings digest mismatch`);
  let findings;
  try { findings = JSON.parse(findingsBytes); } catch { fail(`external station ${station.id} findings are not JSON`); }
  const findingsSchema = validate(EXTERNAL_FINDINGS_SCHEMA, findings);
  if (!findingsSchema.valid) fail(`external station ${station.id} findings violate canonical schema: ${findingsSchema.errors.join('; ')}`);
  if (findings.review_kind !== topology.phase || findings.reviewer?.host !== station.tuple.host || findings.reviewer?.family !== station.tuple.family) fail(`external station ${station.id} findings are not bound to the phase/reviewer family`);
  const critical = findings.findings.filter(row => row.severity === 'critical').length;
  const high = findings.findings.filter(row => row.severity === 'high').length;
  const pass = ['pass', 'pass-with-findings'].includes(findings.verdict) && critical === 0 && high === 0;
  if (report.unresolved_critical !== critical || report.undispositioned_high !== high) fail(`external station ${station.id} report counts do not match canonical findings`);
  if ((report.status === 'pass') !== pass) fail(`external station ${station.id} report status does not match canonical findings verdict`);
  return { verdict: findings.verdict, critical, high };
}

function validateLocalStationReceipt(report, station, candidateDigest) {
  if (typeof report.receipt_path !== 'string' || !path.isAbsolute(report.receipt_path)) fail(`station ${station.id} requires an absolute canonical receipt path`);
  let info;
  try { info = fs.lstatSync(report.receipt_path); } catch { fail(`station ${station.id} receipt is unreadable`); }
  if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o022) !== 0) fail(`station ${station.id} receipt must be a protected regular file`);
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) fail(`station ${station.id} receipt owner mismatch`);
  const bytes = fs.readFileSync(report.receipt_path);
  if (!DIGEST.test(report.receipt_digest ?? '') || hash(bytes) !== report.receipt_digest) fail(`station ${station.id} receipt digest mismatch`);
  let receipt;
  try { receipt = JSON.parse(bytes); } catch { fail(`station ${station.id} receipt is not JSON`); }
  const schemaResult = validate(STATION_RECEIPT_SCHEMA, receipt);
  if (!schemaResult.valid) fail(`station ${station.id} receipt violates canonical schema: ${schemaResult.errors.join('; ')}`);
  if (receipt.station_id !== station.id || receipt.station_kind !== station.kind || receipt.candidate_digest !== candidateDigest || canonical(receipt.reviewer) !== canonical(station.tuple)) fail(`station ${station.id} receipt is not bound to the candidate/station/reviewer`);
  const critical = receipt.findings.filter(row => row.severity === 'critical').length;
  const high = receipt.findings.filter(row => row.severity === 'high').length;
  const pass = ['pass', 'pass-with-findings'].includes(receipt.verdict) && critical === 0 && high === 0;
  if (report.unresolved_critical !== critical || report.undispositioned_high !== high) fail(`station ${station.id} report counts do not match canonical receipt findings`);
  if ((report.status === 'pass') !== pass) fail(`station ${station.id} report status does not match canonical receipt verdict`);
}

function validateReport(report, station, candidateDigest, topology) {
  if (!report || report.id !== station.id || report.candidate_digest !== candidateDigest) fail(`station ${station.id} report is missing or candidate-bound incorrectly`);
  if (!['pass', 'fail', 'unavailable', 'skipped'].includes(report.status)) fail(`station ${station.id} status is invalid`);
  if (!Number.isInteger(report.unresolved_critical) || report.unresolved_critical < 0 || !Number.isInteger(report.undispositioned_high) || report.undispositioned_high < 0) fail(`station ${station.id} finding counts are invalid`);
  const reviewer = report.reviewer ?? {};
  if (reviewer.host !== station.tuple.host || reviewer.family !== station.tuple.family || reviewer.model !== station.tuple.model || reviewer.effort !== station.tuple.effort) fail(`station ${station.id} reviewer tuple mismatch`);
  if (station.kind === 'external') validateExternalReceipt(report, station, candidateDigest, topology);
  else validateLocalStationReceipt(report, station, candidateDigest);
}

export function aggregateReviewTopology(input) {
  if (input?.schema_version !== 2 || !DIGEST.test(input?.candidate_digest ?? '') || !Array.isArray(input?.stations)) fail('aggregate input is invalid');
  const topology = resolveReviewTopology({ configPath: input.config_path, mode: input.mode, orchestrator: input.orchestrator, phase: input.phase });
  if (input.config_sha256 !== topology.config_sha256) fail('owner config digest changed after review dispatch');
  const reports = new Map(input.stations.map(report => [report.id, report]));
  if (reports.size !== input.stations.length) fail('duplicate station reports');
  const errors = [];
  const normalized = [];
  for (const station of topology.stations) {
    const report = reports.get(station.id);
    if (!report) { errors.push(`${station.required ? 'required' : 'optional'} station ${station.id} missing`); continue; }
    validateReport(report, station, input.candidate_digest, topology);
    if (station.required && report.status !== 'pass') errors.push(`required station ${station.id} did not pass`);
    if (!station.required && report.status === 'unavailable') {
      if (!DIGEST.test(report.capability_receipt_digest ?? '') || !OPTIONAL_UNAVAILABLE.has(report.classification)) errors.push(`optional station ${station.id} unavailable state lacks classified capability receipt`);
    } else if (!station.required && report.status === 'skipped') {
      if (report.classification !== 'owner-disabled') errors.push(`optional station ${station.id} skip requires owner-disabled classification`);
    } else if (report.status !== 'pass') errors.push(`station ${station.id} returned ${report.status}`);
    if (report.unresolved_critical > 0 || report.undispositioned_high > 0) errors.push(`station ${station.id} has unresolved blocking findings`);
    normalized.push({ ...report, required: station.required, authority: station.authority, kind: station.kind });
  }
  if (reports.size !== normalized.length) errors.push('aggregate contains a station outside the selected topology');
  const independentFamilies = [...new Set(normalized.filter(row => row.kind === 'external' && row.authority === 'independent' && row.status === 'pass' && row.reviewer.family !== topology.orchestrator_family).map(row => row.reviewer.family))].sort();
  const releaseAuthorized = topology.release_authority && independentFamilies.length > 0 && errors.length === 0;
  const body = {
    schema_version: 2,
    receipt_type: 'FINAL_REVIEW_PANEL',
    mode: topology.mode,
    phase: topology.phase,
    orchestrator: topology.orchestrator,
    candidate_digest: input.candidate_digest,
    config_path: topology.config_path,
    config_sha256: topology.config_sha256,
    verdict: errors.length ? 'FAIL' : 'PASS',
    release_authorized: releaseAuthorized,
    unowned_critical_high: normalized.reduce((sum, row) => sum + row.unresolved_critical + row.undispositioned_high, 0),
    independent_families: independentFamilies,
    stations: normalized,
    errors,
  };
  return { ...body, receipt_digest: hash(body) };
}

function args(argv) {
  const [command, ...tokens] = argv; const options = {};
  for (let index = 0; index < tokens.length; index += 2) {
    if (!tokens[index]?.startsWith('--') || tokens[index + 1] === undefined) fail('options must be --name value pairs');
    options[tokens[index].slice(2)] = tokens[index + 1];
  }
  return { command, options };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { command, options } = args(process.argv.slice(2));
  if (command === 'plan') {
    process.stdout.write(`${JSON.stringify(resolveReviewTopology({
      configPath: options.config,
      mode: options.mode,
      orchestrator: options.orchestrator,
      phase: options.phase,
      wi: options.wi,
      workOverlayPath: options['work-overlay'],
      sessionId: options['session-id'],
      sessionOverrideSpec: options['session-override'],
      sessionOverrideRequested: options['session-override-requested'],
      sessionOverrideReceiptSpec: options['session-override-receipt'],
    }), null, 2)}\n`);
  } else if (command === 'external') {
    process.stdout.write(`${JSON.stringify(resolveExternalReviewer({
      configPath: options.config,
      mode: options.mode,
      orchestrator: options.orchestrator,
      phase: options.phase,
      stationId: options.station,
      wi: options.wi,
      workOverlayPath: options['work-overlay'],
      sessionId: options['session-id'],
      sessionOverrideSpec: options['session-override'],
      sessionOverrideRequested: options['session-override-requested'],
      sessionOverrideReceiptSpec: options['session-override-receipt'],
      explicitAsk: options['explicit-ask'] === 'true' || options['explicit-ask'] === '1',
      unavailableStations: options['unavailable-stations'] || '',
    }), null, 2)}\n`);
  } else if (command === 'aggregate') {
    if (!options.input || !options.out) fail('aggregate requires --input and --out');
    const result = aggregateReviewTopology(JSON.parse(fs.readFileSync(options.input, 'utf8')));
    fs.writeFileSync(options.out, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`${JSON.stringify({ ok: result.verdict === 'PASS', verdict: result.verdict, release_authorized: result.release_authorized, receipt: path.resolve(options.out), receipt_digest: result.receipt_digest })}\n`);
    process.exitCode = result.verdict === 'PASS' ? 0 : 1;
  } else fail('usage: review-topology-v2.mjs plan|external|aggregate ...');
}
