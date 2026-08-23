#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validate } from './lib/json-schema-validator.mjs';
import { readProtectedFileSync } from './lib/protected-file.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DISPATCH_SCHEMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'schemas/dispatch-policy.schema.json'), 'utf8'));
const DEFAULT_DISPATCH_POLICY = path.join(os.homedir(), '.svc', 'dispatch-policy.json');
const DIGEST = /^[a-f0-9]{64}$/;
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max', 'provider-managed']);
const STATION_KINDS = new Set(['inline-self', 'subagent', 'external']);
const STATION_AUTHORITIES = new Set(['advisory', 'independent']);
const VALID_LABELS = new Set(['STRAT', 'PLAN', 'EXEC', 'REVIEW', 'SENSE', 'DISC', 'PASS']);
const ROLE_BY_LABEL = {
  STRAT: 'plan',
  PLAN: 'plan',
  EXEC: 'implementor',
  REVIEW: 'self_review',
  SENSE: 'sense',
  DISC: 'disc',
  PASS: 'pass',
};
const HOST_FAMILY = {
  claude: 'anthropic',
  codex: 'openai',
  gemini: 'google',
  agy: 'google',
  grok: 'xai',
};

function fail(message, code = 'dispatch_invalid') {
  const error = new Error(`resolve-dispatch: ${message}`);
  error.code = code;
  throw error;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return null;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return null;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepMerge(base, overlay) {
  if (Array.isArray(base) && Array.isArray(overlay)) return deepClone(overlay);
  if (isObject(base) && isObject(overlay)) {
    const merged = { ...base };
    for (const [key, value] of Object.entries(overlay)) {
      if (Object.prototype.hasOwnProperty.call(base, key)) merged[key] = deepMerge(base[key], value);
      else merged[key] = deepClone(value);
    }
    return merged;
  }
  return deepClone(overlay);
}

export function readProtectedJson(file, purpose) {
  const absolute = path.resolve(file);
  let protectedFile;
  try {
    protectedFile = readProtectedFileSync(absolute, { label: purpose, ownerOnly: true, protectParent: true });
  } catch (error) {
    const code = error?.code === 'ENOENT' ? 'dispatch_missing_global_file' : 'dispatch_policy_invalid';
    fail(error.message, code);
  }
  const bytes = protectedFile.bytes;
  let document;
  try {
    document = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail(`${purpose} is not valid JSON: ${absolute}`, 'dispatch_policy_invalid');
  }
  return { absolute, bytes, sha256: hash(bytes), document };
}

function validateTuple(tuple, scope) {
  if (!isObject(tuple)) fail(`${scope} tuple must be an object`);
  for (const key of ['host', 'family', 'model', 'effort']) {
    if (typeof tuple[key] !== 'string' || !tuple[key].trim()) fail(`${scope} tuple.${key} is required`);
  }
  if (!EFFORTS.has(tuple.effort)) fail(`${scope} tuple.effort must be one of: ${[...EFFORTS].join(', ')}`);
}

function validateStation(station, scope) {
  if (!isObject(station)) fail(`${scope} station must be an object`);
  if (typeof station.id !== 'string' || !station.id.trim()) fail(`${scope} station.id is required`);
  if (!STATION_KINDS.has(station.kind)) fail(`${scope} station.kind is invalid`);
  if (typeof station.required !== 'boolean') fail(`${scope} station.required must be boolean`);
  if (!STATION_AUTHORITIES.has(station.authority)) fail(`${scope} station.authority is invalid`);
  validateTuple(station.tuple, `${scope}/${station.id}`);
}

function validateDispatchPolicy(policy) {
  const schemaResult = validate(DISPATCH_SCHEMA, policy);
  if (!schemaResult.valid) fail(`dispatch policy schema violation: ${schemaResult.errors.join('; ')}`, 'dispatch_policy_invalid');
  if (!policy.modes?.[policy.default_mode]) fail(`dispatch default_mode "${policy.default_mode}" is missing from modes`, 'dispatch_policy_invalid');
  for (const [modeName, mode] of Object.entries(policy.modes || {})) {
    if (!isObject(mode)) fail(`mode "${modeName}" must be an object`, 'dispatch_policy_invalid');
    if (isObject(mode.labels)) {
      for (const [label, tuple] of Object.entries(mode.labels)) {
        if (!VALID_LABELS.has(label)) fail(`mode "${modeName}" labels contains unsupported label "${label}"`, 'dispatch_policy_invalid');
        validateTuple(tuple, `mode "${modeName}" labels.${label}`);
      }
    }
    const review = mode.review;
    if (isObject(review)) {
      for (const phase of ['plan', 'exec', 'design']) {
        if (!Object.prototype.hasOwnProperty.call(review, phase)) continue;
        const phaseConfig = review[phase];
        if (!isObject(phaseConfig)) fail(`mode "${modeName}" review.${phase} must be an object`, 'dispatch_policy_invalid');
        if (!Array.isArray(phaseConfig.stations) || phaseConfig.stations.length === 0) fail(`mode "${modeName}" review.${phase} stations are required`, 'dispatch_policy_invalid');
        phaseConfig.stations.forEach((station, index) => validateStation(station, `mode "${modeName}" review.${phase}[${index}]`));
      }
    }
  }
}

function normalizeRoleEntry(modeConfig, role, label) {
  if (isObject(modeConfig.labels) && label && isObject(modeConfig.labels[label])) return modeConfig.labels[label];
  if (isObject(modeConfig.roles) && isObject(modeConfig.roles[role])) return modeConfig.roles[role];
  if (isObject(modeConfig[role])) return modeConfig[role];
  if (isObject(modeConfig[`label.${label}`])) return modeConfig[`label.${label}`];
  return null;
}

function tupleFromRoleEntry(entry, role, orchestrator) {
  if (!isObject(entry)) fail(`role "${role}" route is missing`, 'dispatch_policy_invalid');
  if (isObject(entry.tuple)) {
    validateTuple(entry.tuple, `role "${role}"`);
    return entry.tuple;
  }
  if (typeof entry.host === 'string' && typeof entry.family === 'string' && typeof entry.model === 'string' && typeof entry.effort === 'string') {
    validateTuple(entry, `role "${role}"`);
    return { host: entry.host, family: entry.family, model: entry.model, effort: entry.effort };
  }
  if (typeof entry.native === 'string') {
    const host = entry.native === 'current' ? orchestrator : entry.native;
    if (!host) fail(`role "${role}" native route requires orchestrator`, 'dispatch_policy_invalid');
    const tuple = { host, family: entry.family, model: entry.model, effort: entry.effort };
    validateTuple(tuple, `role "${role}" native`);
    return tuple;
  }
  fail(`role "${role}" route must define tuple or host/family/model/effort`, 'dispatch_policy_invalid');
}

function applyDenyAllow(policy, tuple, role) {
  const deny = new Set([...(policy.deny?.['*'] || []), ...(policy.deny?.[role] || [])]);
  if (!deny.has(tuple.model)) return;
  const allow = new Set(policy.allow?.[role] || []);
  if (allow.has(tuple.model)) return;
  fail(`model "${tuple.model}" is denied for role "${role}"`, 'dispatch_denied');
}

function selectMode(policy, requestedMode = null) {
  const selectedMode = requestedMode || policy.default_mode;
  const modeConfig = policy.modes?.[selectedMode];
  if (!isObject(modeConfig)) fail(`mode "${selectedMode}" is not configured`, 'dispatch_policy_invalid');
  return { selectedMode, modeConfig };
}

function parseOverlay(pathSpec, wi) {
  if (!pathSpec) return { applied: false, scope: null, sha256: null, patch: null, reason: 'not-requested', path: null };
  const loaded = readProtectedJson(pathSpec, 'work overlay');
  const overlay = loaded.document;
  const scope = isObject(overlay.scope) ? overlay.scope : {};
  const patch = isObject(overlay.patch) ? overlay.patch : isObject(overlay.overlay) ? overlay.overlay : overlay;
  if (!isObject(patch)) fail(`work overlay patch must be an object: ${loaded.absolute}`, 'dispatch_overlay_invalid');
  const scopeWi = typeof scope.wi === 'string' ? scope.wi.trim() : '';
  if (!scopeWi) fail('work overlay requires a non-empty scope.wi matching the current WI', 'dispatch_overlay_invalid');
  if (!wi) fail('scoped work overlay requires the current WI; refusing global leak', 'dispatch_overlay_invalid');
  if (scopeWi !== wi) {
    return { applied: false, scope, sha256: loaded.sha256, patch: null, reason: 'wi-mismatch', path: loaded.absolute };
  }
  return { applied: true, scope, sha256: loaded.sha256, patch, reason: 'applied', path: loaded.absolute };
}

function parseJsonSpec(spec, label) {
  if (!spec) return null;
  if (typeof spec !== 'string') fail(`${label} must be a JSON string or file path`, 'dispatch_override_invalid');
  const trimmed = spec.trim();
  if (trimmed.startsWith('{')) {
    try {
      return { document: JSON.parse(trimmed), absolute: null, sha256: hash(Buffer.from(trimmed, 'utf8')) };
    } catch {
      fail(`${label} JSON is invalid`, 'dispatch_override_invalid');
    }
  }
  const loaded = readProtectedJson(trimmed, label);
  return { document: loaded.document, absolute: loaded.absolute, sha256: loaded.sha256 };
}

function parseSessionOverride({
  sessionOverrideSpec = null,
  sessionOverrideRequested = null,
  sessionOverrideReceiptSpec = null,
  sessionId = null,
  wi = null,
}) {
  const loadedOverride = parseJsonSpec(sessionOverrideSpec, 'session override');
  const requestedFlag = parseBoolean(sessionOverrideRequested);
  const overrideRequested = requestedFlag ?? Boolean(loadedOverride?.document?.requested);
  if (!overrideRequested) {
    return {
      applied: false,
      patch: null,
      sha256: loadedOverride?.sha256 || null,
      receipt_sha256: null,
      reason: 'not-requested',
      receipt: null,
      source_path: loadedOverride?.absolute || null,
    };
  }
  if (!loadedOverride) fail('session override was requested but no override payload was supplied', 'dispatch_override_invalid');
  const document = loadedOverride.document;
  const patch = isObject(document.patch) ? document.patch : isObject(document.override) ? document.override : document;
  if (!isObject(patch)) fail('session override patch must be an object', 'dispatch_override_invalid');
  if (!sessionOverrideReceiptSpec) fail('session override was requested but no receipt was supplied', 'dispatch_override_invalid');
  if (String(sessionOverrideReceiptSpec).trim().startsWith('{')) {
    fail('session override receipt must be a protected owner file, not inline JSON', 'dispatch_override_invalid');
  }
  const loadedReceipt = parseJsonSpec(sessionOverrideReceiptSpec, 'session override receipt');
  if (!loadedReceipt) fail('session override was requested but no receipt was supplied', 'dispatch_override_invalid');
  if (!loadedReceipt.absolute) fail('session override receipt must be a protected owner file, not inline JSON', 'dispatch_override_invalid');
  const receipt = loadedReceipt.document;
  if (!isObject(receipt)) fail('session override receipt must be an object', 'dispatch_override_invalid');
  if (receipt.type !== 'dispatch-session-override') fail('session override receipt type must be dispatch-session-override', 'dispatch_override_invalid');
  if (receipt.authority !== 'repository-owner') fail('session override receipt authority must be repository-owner', 'dispatch_override_invalid');
  if (typeof receipt.session_id !== 'string' || !receipt.session_id.trim()) fail('session override receipt session_id is required', 'dispatch_override_invalid');
  if (sessionId && receipt.session_id !== sessionId) fail(`session override receipt session_id mismatch (expected ${sessionId}, got ${receipt.session_id})`, 'dispatch_override_invalid');
  if (!wi) fail('session override receipt requires the current WI', 'dispatch_override_invalid');
  if (typeof receipt.wi !== 'string' || !receipt.wi.trim()) fail('session override receipt wi is required', 'dispatch_override_invalid');
  if (receipt.wi !== wi) fail(`session override receipt wi mismatch (expected ${wi}, got ${receipt.wi})`, 'dispatch_override_invalid');
  if (typeof receipt.override_sha256 !== 'string' || !DIGEST.test(receipt.override_sha256)) {
    fail('session override receipt override_sha256 must be a sha256 of the override payload', 'dispatch_override_invalid');
  }
  if (receipt.override_sha256 !== loadedOverride.sha256) {
    fail('session override receipt override_sha256 does not bind the override payload', 'dispatch_override_invalid');
  }
  if (typeof receipt.issued_at !== 'string' || !Number.isFinite(Date.parse(receipt.issued_at))) {
    fail('session override receipt issued_at is required', 'dispatch_override_invalid');
  }
  if (!receipt.expires_at) fail('session override receipt expires_at is required', 'dispatch_override_invalid');
  const expires = Date.parse(receipt.expires_at);
  if (!Number.isFinite(expires) || expires <= Date.now()) fail('session override receipt is expired', 'dispatch_override_invalid');
  return {
    applied: true,
    patch,
    sha256: loadedOverride.sha256,
    receipt_sha256: loadedReceipt.sha256,
    reason: 'applied',
    receipt,
    source_path: loadedOverride.absolute || null,
    receipt_path: loadedReceipt.absolute || null,
  };
}

function readSessionContractOverride({ cwd = process.cwd(), sessionId = null, wi = null }) {
  const contractPath = path.join(path.resolve(cwd), '.svc', 'session-contract.jsonl');
  if (!fs.existsSync(contractPath)) return null;
  let lines;
  try {
    lines = fs.readFileSync(contractPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  } catch {
    return null;
  }
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    let row;
    try {
      row = JSON.parse(lines[index]);
    } catch {
      continue;
    }
    if (!isObject(row) || !isObject(row.dispatch_override)) continue;
    const override = row.dispatch_override;
    if (sessionId && override.session_id && override.session_id !== sessionId) continue;
    if (wi && override.wi && override.wi !== wi) continue;
    if (typeof override.requested !== 'boolean' && typeof override.requested !== 'string') continue;
    return override;
  }
  return null;
}

function normalizeDispatchContext(options = {}) {
  const configPath = path.resolve(options.configPath || process.env.SVC_DISPATCH_POLICY || DEFAULT_DISPATCH_POLICY);
  const wi = options.wi || process.env.SVC_WI || null;
  const sessionId = options.sessionId || process.env.SVC_SESSION_ID || null;
  const overlayPath = options.workOverlayPath || process.env.SVC_DISPATCH_WORK_OVERLAY || null;
  const contractOverride = readSessionContractOverride({ cwd: options.cwd || process.cwd(), sessionId, wi });
  const sessionOverrideSpec = options.sessionOverrideSpec || process.env.SVC_DISPATCH_OVERRIDE
    || (contractOverride?.patch ? JSON.stringify({ patch: contractOverride.patch, requested: contractOverride.requested, receipt: contractOverride.receipt || null }) : null);
  const sessionOverrideRequested = options.sessionOverrideRequested ?? process.env.SVC_DISPATCH_OVERRIDE_REQUESTED ?? contractOverride?.requested ?? null;
  const sessionOverrideReceiptSpec = options.sessionOverrideReceiptSpec || process.env.SVC_DISPATCH_OVERRIDE_RECEIPT
    || (typeof contractOverride?.receipt_path === 'string' ? contractOverride.receipt_path : null);
  const globalPolicy = options.policySnapshot || readProtectedJson(configPath, 'owner dispatch policy');
  if (path.resolve(globalPolicy.absolute || '') !== configPath || !Buffer.isBuffer(globalPolicy.bytes) || !isObject(globalPolicy.document) || !DIGEST.test(globalPolicy.sha256 || '')) {
    fail('owner dispatch policy snapshot is missing, malformed, or bound to another path', 'dispatch_policy_invalid');
  }
  if (globalPolicy.document?.schema_version !== 1) {
    const error = new Error(`resolve-dispatch: unsupported policy schema_version ${globalPolicy.document?.schema_version ?? '<missing>'}`);
    error.code = 'DISPATCH_POLICY_UNSUPPORTED';
    throw error;
  }
  validateDispatchPolicy(globalPolicy.document);
  let effective = deepClone(globalPolicy.document);
  const overlay = parseOverlay(overlayPath, wi);
  if (overlay.applied && overlay.patch) effective = deepMerge(effective, overlay.patch);
  const sessionOverride = parseSessionOverride({
    sessionOverrideSpec,
    sessionOverrideRequested,
    sessionOverrideReceiptSpec,
    sessionId,
    wi,
  });
  if (sessionOverride.applied && sessionOverride.patch) effective = deepMerge(effective, sessionOverride.patch);
  validateDispatchPolicy(effective);
  const { selectedMode, modeConfig } = selectMode(effective, options.mode || null);
  return {
    config_path: globalPolicy.absolute,
    config_sha256: globalPolicy.sha256,
    policy_snapshot: globalPolicy,
    mode: selectedMode,
    mode_config: modeConfig,
    policy: effective,
    wi,
    session_id: sessionId,
    overlay,
    session_override: sessionOverride,
  };
}

function parseUnavailable(unavailableStations) {
  if (Array.isArray(unavailableStations)) return new Set(unavailableStations.filter(Boolean));
  if (typeof unavailableStations === 'string' && unavailableStations.trim()) return new Set(unavailableStations.split(',').map((entry) => entry.trim()).filter(Boolean));
  return new Set();
}

function normalizeStation(station, index) {
  validateStation(station, `review station[${index}]`);
  return {
    id: station.id,
    kind: station.kind,
    required: station.required,
    authority: station.authority,
    tuple: station.tuple,
    max_invocations: station.max_invocations ?? null,
    round_trip: station.round_trip ?? null,
    fallback_only: Boolean(station.fallback_only),
    explicit_request_only: Boolean(station.explicit_request_only),
  };
}

function isAgyStation(station) {
  return station.tuple.host === 'agy' || /(?:^|-)agy(?:-|$)|gemini/i.test(station.id);
}

function inferOrchestratorFamily(orchestrator, stations) {
  return HOST_FAMILY[orchestrator] || stations.find((station) => station.kind === 'inline-self')?.tuple?.family || null;
}

function selectExternalStation(topology, {
  stationId = null,
  explicitAsk = false,
  unavailableStations = [],
} = {}) {
  const unavailable = parseUnavailable(unavailableStations);
  const externals = topology.stations.filter((station) => station.kind === 'external');
  if (externals.length === 0) fail(`mode "${topology.mode}" has no external reviewer stations for phase "${topology.phase}"`, 'dispatch_no_external_station');
  const preferred = externals.filter((station) => !isAgyStation(station));
  const preferredAvailable = preferred.filter((station) => !unavailable.has(station.id));
  const preferredUnavailable = preferred.length > 0 && preferredAvailable.length === 0;
  const eligible = (station) => {
    if (unavailable.has(station.id)) return false;
    if (station.explicit_request_only && !explicitAsk && !preferredUnavailable) return false;
    if (station.fallback_only && !explicitAsk && !preferredUnavailable) return false;
    if (isAgyStation(station) && !explicitAsk && !preferredUnavailable && preferredAvailable.length > 0) return false;
    return true;
  };
  if (stationId) {
    const station = externals.find((row) => row.id === stationId);
    if (!station) fail(`requested external station "${stationId}" is not present in ${topology.phase} topology`, 'dispatch_station_not_found');
    if (!eligible(station)) fail(`requested station "${stationId}" is not eligible under fallback/explicit-request policy`, 'dispatch_station_not_allowed');
    return station;
  }
  if (explicitAsk) {
    const explicitAgy = externals.find((station) => isAgyStation(station) && eligible(station));
    if (explicitAgy) return explicitAgy;
  }
  const primary = preferredAvailable.find((station) => eligible(station));
  if (primary) return primary;
  const fallback = externals.find((station) => eligible(station));
  if (fallback) return fallback;
  fail(`no eligible external station remains for phase "${topology.phase}"`, 'dispatch_station_unavailable');
}

export function resolveDispatchModel(options = {}) {
  const label = String(options.label || '').toUpperCase();
  if (!VALID_LABELS.has(label)) fail(`model resolution requires one of ${[...VALID_LABELS].join(', ')}`, 'dispatch_input_invalid');
  const orchestrator = options.orchestrator || process.env.SVC_HOST || null;
  if (!orchestrator) fail('model resolution requires --orchestrator or SVC_HOST', 'dispatch_input_invalid');
  if (orchestrator === 'agy') fail('AGY is reviewer transport only and cannot be an orchestrator', 'dispatch_input_invalid');
  const context = normalizeDispatchContext(options);
  const role = ROLE_BY_LABEL[label] || `label.${label}`;
  const entry = normalizeRoleEntry(context.mode_config, role, label);
  const tuple = tupleFromRoleEntry(entry, role, orchestrator);
  applyDenyAllow(context.policy, tuple, role);
  return {
    schema_version: 1,
    source: 'owner-dispatch-policy',
    config_path: context.config_path,
    config_sha256: context.config_sha256,
    mode: context.mode,
    orchestrator,
    label,
    role,
    tuple: { orchestrator, ...tuple },
    harness: tuple.host,
    provider: tuple.host,
    model: tuple.model,
    effort: tuple.effort,
    thinking: entry?.thinking ?? null,
    invocation: entry?.invocation ?? null,
    layering: {
      overlay: {
        requested: Boolean(options.workOverlayPath || process.env.SVC_DISPATCH_WORK_OVERLAY),
        applied: context.overlay.applied,
        reason: context.overlay.reason,
        path: context.overlay.path,
        sha256: context.overlay.sha256,
      },
      session_override: {
        requested: parseBoolean(options.sessionOverrideRequested ?? process.env.SVC_DISPATCH_OVERRIDE_REQUESTED) ?? false,
        applied: context.session_override.applied,
        reason: context.session_override.reason,
        source_path: context.session_override.source_path,
        override_sha256: context.session_override.sha256,
        receipt_sha256: context.session_override.receipt_sha256,
      },
    },
  };
}

// WI-552: generic role resolution independent of the seven cognitive labels.
// Continuation lifecycle roles (e.g. "verify.restart") are not STRAT/PLAN/EXEC/
// REVIEW/SENSE/DISC/PASS — they name a lifecycle capability directly. This asks
// the SAME owner dispatch policy (modes.<mode>.roles.<role> or modes.<mode>.<role>)
// with the SAME fail-closed, no-silent-remap semantics as resolveDispatchModel.
// A host with no configured route for the role fails closed — it is never
// silently remapped to Claude/Codex (WI-552 AC-552-6).
export function resolveDispatchRoleTuple(options = {}) {
  const role = String(options.role || '').trim();
  if (!role) fail('role resolution requires --role', 'dispatch_input_invalid');
  const orchestrator = options.orchestrator || process.env.SVC_HOST || null;
  if (!orchestrator) fail('role resolution requires --orchestrator or SVC_HOST', 'dispatch_input_invalid');
  if (orchestrator === 'agy') fail('AGY is reviewer transport only and cannot be an orchestrator', 'dispatch_input_invalid');
  const context = normalizeDispatchContext(options);
  const entry = normalizeRoleEntry(context.mode_config, role, null);
  if (!entry) fail(`role "${role}" is not configured in mode "${context.mode}"`, 'dispatch_policy_invalid');
  const tuple = tupleFromRoleEntry(entry, role, orchestrator);
  applyDenyAllow(context.policy, tuple, role);
  return {
    schema_version: 1,
    source: 'owner-dispatch-policy',
    config_path: context.config_path,
    config_sha256: context.config_sha256,
    mode: context.mode,
    orchestrator,
    role,
    tuple: { orchestrator, ...tuple },
    harness: tuple.host,
    provider: tuple.host,
    model: tuple.model,
    effort: tuple.effort,
    thinking: entry?.thinking ?? null,
    invocation: entry?.invocation ?? null,
    layering: {
      overlay: {
        requested: Boolean(options.workOverlayPath || process.env.SVC_DISPATCH_WORK_OVERLAY),
        applied: context.overlay.applied,
        reason: context.overlay.reason,
        path: context.overlay.path,
        sha256: context.overlay.sha256,
      },
      session_override: {
        requested: parseBoolean(options.sessionOverrideRequested ?? process.env.SVC_DISPATCH_OVERRIDE_REQUESTED) ?? false,
        applied: context.session_override.applied,
        reason: context.session_override.reason,
        source_path: context.session_override.source_path,
        override_sha256: context.session_override.sha256,
        receipt_sha256: context.session_override.receipt_sha256,
      },
    },
  };
}

export function resolveDispatchReviewTopology(options = {}) {
  const orchestrator = options.orchestrator || process.env.SVC_HOST || null;
  const phase = String(options.phase || '').toLowerCase();
  if (!orchestrator) fail('review topology requires --orchestrator or SVC_HOST', 'dispatch_input_invalid');
  if (!['plan', 'exec', 'design'].includes(phase)) fail('review topology phase must be plan|exec|design', 'dispatch_input_invalid');
  if (orchestrator === 'agy') fail('AGY is reviewer transport only and cannot be an orchestrator', 'dispatch_input_invalid');
  const context = normalizeDispatchContext(options);
  const phaseConfig = context.mode_config.review?.[phase];
  if (!isObject(phaseConfig)) fail(`mode "${context.mode}" does not define review.${phase}`, 'dispatch_policy_invalid');
  if (!Array.isArray(phaseConfig.stations) || phaseConfig.stations.length === 0) fail(`mode "${context.mode}" review.${phase} stations are required`, 'dispatch_policy_invalid');
  const role = `review.${phase}`;
  const stations = phaseConfig.stations.map(normalizeStation).map((station, index) => {
    applyDenyAllow(context.policy, station.tuple, role);
    if (station.kind === 'inline-self' && station.authority !== 'advisory') fail(`review.${phase} station "${station.id}" cannot be independent inline self-review`, 'dispatch_policy_invalid');
    if (station.kind === 'subagent' && station.authority !== 'advisory') fail(`review.${phase} station "${station.id}" cannot be independent`, 'dispatch_policy_invalid');
    return { order: index + 1, ...station };
  });
  const orchestratorFamily = inferOrchestratorFamily(orchestrator, stations);
  if (phaseConfig.release_authority === true && orchestratorFamily) {
    const hasDifferentFamilyIndependent = stations.some((station) =>
      station.kind === 'external'
      && station.required
      && station.authority === 'independent'
      && station.tuple.family !== orchestratorFamily);
    if (!hasDifferentFamilyIndependent) fail(`review.${phase} release_authority=true requires at least one required different-family independent external station`, 'dispatch_policy_invalid');
  }
  return {
    schema_version: 1,
    source: 'owner-dispatch-policy',
    config_path: context.config_path,
    config_sha256: context.config_sha256,
    mode: context.mode,
    orchestrator,
    orchestrator_family: orchestratorFamily,
    phase,
    release_authority: phaseConfig.release_authority === true,
    feedback_sink: phaseConfig.feedback_sink || null,
    on_sink_reject: phaseConfig.on_sink_reject || null,
    stations,
    layering: {
      overlay: {
        requested: Boolean(options.workOverlayPath || process.env.SVC_DISPATCH_WORK_OVERLAY),
        applied: context.overlay.applied,
        reason: context.overlay.reason,
        path: context.overlay.path,
        sha256: context.overlay.sha256,
      },
      session_override: {
        requested: parseBoolean(options.sessionOverrideRequested ?? process.env.SVC_DISPATCH_OVERRIDE_REQUESTED) ?? false,
        applied: context.session_override.applied,
        reason: context.session_override.reason,
        source_path: context.session_override.source_path,
        override_sha256: context.session_override.sha256,
        receipt_sha256: context.session_override.receipt_sha256,
      },
    },
  };
}

export function resolveDispatchExternalReviewer(options = {}) {
  const explicitAsk = parseBoolean(options.explicitAsk ?? process.env.SVC_DISPATCH_EXPLICIT_ASK) ?? false;
  const topology = resolveDispatchReviewTopology(options);
  const station = selectExternalStation(topology, {
    stationId: options.stationId || null,
    explicitAsk,
    unavailableStations: options.unavailableStations || process.env.SVC_DISPATCH_UNAVAILABLE_STATIONS || [],
  });
  return {
    topology,
    station,
    tuple: { orchestrator: topology.orchestrator, ...station.tuple },
    selection: {
      explicit_ask: explicitAsk,
      unavailable_stations: [...parseUnavailable(options.unavailableStations || process.env.SVC_DISPATCH_UNAVAILABLE_STATIONS || [])],
    },
  };
}

export function resolveDispatchPolicyStatus(options = {}) {
  const orchestrator = options.orchestrator || process.env.SVC_HOST || null;
  const phase = options.phase || 'plan';
  if (!orchestrator) fail('policy-status requires --orchestrator or SVC_HOST', 'dispatch_input_invalid');
  const context = normalizeDispatchContext(options);
  const topology = resolveDispatchReviewTopology({ ...options, orchestrator, phase, policySnapshot: context.policy_snapshot });
  const defaultExternal = selectExternalStation(topology, {
    stationId: null,
    explicitAsk: false,
    unavailableStations: [],
  });
  return {
    ok: true,
    schema_version: 1,
    source: 'owner-dispatch-policy',
    orchestrator,
    mode: context.mode,
    phase: topology.phase,
    config_path: context.config_path,
    config_sha256: context.config_sha256,
    default_external_station: defaultExternal.id,
    default_external_tuple: { orchestrator, ...defaultExternal.tuple },
    release_authority: topology.release_authority,
    stations: topology.stations,
  };
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) fail(`unsupported argument ${token}`, 'dispatch_input_invalid');
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next === undefined || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = next;
    index += 1;
  }
  return { command, options };
}

function requireOption(options, key, hint) {
  if (!options[key]) fail(hint || `missing --${key}`, 'dispatch_input_invalid');
  return options[key];
}

function printModel(result, format) {
  if (format === '--json' || format === 'json') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (format === '--harness-only') {
    process.stdout.write(`${result.harness}\n`);
    return;
  }
  if (format === '--thinking') {
    process.stdout.write(`${result.thinking ? 'true' : 'false'}\n`);
    return;
  }
  if (format === '--effort') {
    process.stdout.write(`${result.effort || ''}\n`);
    return;
  }
  if (format === '--invocation') {
    process.stdout.write(`${result.invocation || ''}\n`);
    return;
  }
  process.stdout.write(`${result.provider}:${result.model}\n`);
}

function cli() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const shared = {
    configPath: options.config || options['dispatch-policy'] || null,
    mode: options.mode || null,
    orchestrator: options.orchestrator || process.env.SVC_HOST || null,
    wi: options.wi || process.env.SVC_WI || null,
    sessionId: options['session-id'] || process.env.SVC_SESSION_ID || null,
    workOverlayPath: options['work-overlay'] || null,
    sessionOverrideSpec: options['session-override'] || null,
    sessionOverrideRequested: options['session-override-requested'] ?? null,
    sessionOverrideReceiptSpec: options['session-override-receipt'] || null,
    explicitAsk: options['explicit-ask'] ?? null,
    unavailableStations: options['unavailable-stations'] || null,
  };
  if (command === 'model') {
    const label = requireOption(options, 'label', 'model command requires --label');
    const result = resolveDispatchModel({ ...shared, label });
    printModel(result, options.format || null);
    return;
  }
  if (command === 'role') {
    const role = requireOption(options, 'role', 'role command requires --role');
    const result = resolveDispatchRoleTuple({ ...shared, role });
    printModel(result, options.format || null);
    return;
  }
  if (command === 'topology') {
    const phase = requireOption(options, 'phase', 'topology command requires --phase');
    const result = resolveDispatchReviewTopology({ ...shared, phase });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'external') {
    const phase = requireOption(options, 'phase', 'external command requires --phase');
    const result = resolveDispatchExternalReviewer({ ...shared, phase, stationId: options.station || null });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === 'policy-status') {
    const result = resolveDispatchPolicyStatus({ ...shared, phase: options.phase || 'plan' });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  fail('usage: resolve-dispatch.mjs model|role|topology|external|policy-status ...', 'dispatch_input_invalid');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
