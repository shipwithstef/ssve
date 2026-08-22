#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants as fsConstants } from 'node:fs';
import { hostname } from 'node:os';
import {
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { WI_ID_RE } from "../hooks/lib/wi-id.mjs";
import { resolveExternalReviewer } from './review-topology-v2.mjs';
import { candidateTreeIdentity, issueExternalReviewProvenance } from './lib/external-review-provenance.mjs';
import { relocateTree } from './lib/review-evidence-store.mjs';

const LAUNCHER_VERSION = '2.4.0';
export const EXTERNAL_REVIEW_LAUNCHER_VERSION = LAUNCHER_VERSION;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINDINGS_SCHEMA = path.join(ROOT, 'schemas/external-review-findings.schema.json');
const RECEIPT_SCHEMA = path.join(ROOT, 'schemas/external-review-receipt.schema.json');
const MODEL_REGISTRY = path.join(ROOT, 'references/model-registry.json');
const AGY_DISPATCHER = path.join(ROOT, 'skills/research/scripts/dispatch-agy.mjs');
const REVIEW_HOST_TRANSPORTS = Object.freeze({
  codex: { env: 'SVC_EXTERNAL_REVIEW_CODEX_BIN', binary: 'codex' },
  agy: { env: 'SVC_EXTERNAL_REVIEW_AGY_BIN', binary: 'agy' },
  claude: { env: 'SVC_EXTERNAL_REVIEW_CLAUDE_BIN', binary: 'claude' },
});

function reviewTransport(host) {
  return REVIEW_HOST_TRANSPORTS[host] || null;
}
const ELIGIBLE_FALLBACKS = new Set(['model_unavailable', 'model_entitlement', 'provider_overload']);
const DEFAULT_TIMEOUT_SECONDS = 1200;
const DEFAULT_REVIEW_BUDGET_USD = 50;
const DEFAULT_LOCK_STALE_SECONDS = 2460;
const DEFAULT_CACHE_TTL_DAYS = 30;
const HEARTBEAT_MS = 30_000;
const MAX_OWNER_OVERRIDE_AGE_MS = 24 * 60 * 60 * 1000;
const OVERRIDE_CLOCK_SKEW_MS = 5 * 60 * 1000;
const CLAUDE_AUXILIARY_MODELS = new Set(['claude-haiku-4-5-20251001']);
let procfsAvailable;
let emergencyReceipt;

function usage(message = '') {
  const prefix = message ? `external-review: ${message}\n` : '';
  return `${prefix}usage: run-external-review.mjs --orchestrator HOST --review-kind KIND --artifacts-dir DIR [--context-root DIR] [--reviewer-config FILE --reviewer-mode MODE --reviewer-phase plan|exec|design --reviewer-station ID] [--owner-override-file FILE] [--phase-binding FILE] [--phase-override-file FILE]\n       run-external-review.mjs --validate-capabilities --orchestrator HOST --artifacts-dir DIR [reviewer config options]\n       run-external-review.mjs --policy-status --orchestrator HOST\n       run-external-review.mjs --select-profile fable-high --reason TEXT [--expires-at ISO]\n       run-external-review.mjs --clear-profile-selection --reason TEXT\n       run-external-review.mjs --gc-cache [--artifacts-dir DIR]`;
}

function parseArgs(argv) {
  const options = { validateCapabilities: false, gcCache: false, policyStatus: false, clearProfileSelection: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--validate-capabilities') options.validateCapabilities = true;
    else if (arg === '--gc-cache') options.gcCache = true;
    else if (arg === '--policy-status') options.policyStatus = true;
    else if (arg === '--clear-profile-selection') options.clearProfileSelection = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (['--orchestrator', '--review-kind', '--candidate-digest', '--artifacts-dir', '--context-root', '--reviewer-config', '--reviewer-mode', '--reviewer-phase', '--reviewer-station', '--owner-override-file', '--phase-binding', '--phase-override-file', '--select-profile', '--reason', '--expires-at'].includes(arg)) {
      if (!argv[index + 1]) throw new Error(`missing value for ${arg}`);
      const key = { '--orchestrator': 'orchestrator', '--review-kind': 'reviewKind', '--candidate-digest': 'candidateDigest', '--artifacts-dir': 'artifactsDir', '--context-root': 'contextRoot', '--reviewer-config': 'reviewerConfig', '--reviewer-mode': 'reviewerMode', '--reviewer-phase': 'reviewerPhase', '--reviewer-station': 'reviewerStation', '--owner-override-file': 'ownerOverrideFile', '--phase-binding': 'phaseBinding', '--phase-override-file': 'phaseOverrideFile', '--select-profile': 'selectProfile', '--reason': 'reason', '--expires-at': 'expiresAt' }[arg];
      options[key] = argv[index + 1];
      index += 1;
    } else throw new Error(`unsupported option ${arg}`);
  }
  return options;
}

function positiveInteger(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1) throw new Error(`${name} must be a positive integer`);
  return Number(raw);
}

function positiveNumber(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  if (!/^\d+(?:\.\d+)?$/.test(raw) || !Number.isFinite(Number(raw)) || Number(raw) <= 0) throw new Error(`${name} must be a positive number`);
  return Number(raw);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function buildReviewPackage(baseBytes, reviewKind, contextRoot) {
  const targetCandidates = ['AGENTS.md', 'CLAUDE.md'];
  const targetFiles = [];
  for (const relative of targetCandidates) {
    try {
      const bytes = await readFile(path.join(contextRoot, relative));
      targetFiles.push({ label: `target:${relative}`, bytes });
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  if (targetFiles.length === 0) throw Object.assign(new Error(`review context root has no AGENTS.md or CLAUDE.md: ${contextRoot}`), { classification: 'input_invalid' });

  const frameworkPaths = reviewKind === 'plan'
    ? ['skills/review-plan/SKILL.md', 'skills/review-cross-model/SKILL.md', 'references/plan-review-protocol.md', 'rules/plan-changeset-trigger.md']
    : reviewKind === 'exec'
      ? ['skills/review-exec/SKILL.md', 'skills/review-cross-model/SKILL.md']
      : ['skills/review-cross-model/SKILL.md'];
  const files = [...targetFiles];
  for (const relative of frameworkPaths) files.push({ label: `framework:${relative}`, bytes: await readFile(path.join(ROOT, relative)) });
  const manifest = {
    version: 1,
    files: files.map(({ label, bytes }) => ({ path: label, sha256: sha256(bytes), bytes: bytes.length })),
  };
  const chunks = [Buffer.from(`SVC_REVIEW_CONTEXT_MANIFEST_V1 ${JSON.stringify(manifest)}\n`)];
  for (const file of files) {
    chunks.push(Buffer.from(`\n<<<SVC_CONTEXT ${file.label} sha256=${sha256(file.bytes)}>>>\n`));
    chunks.push(file.bytes);
    chunks.push(Buffer.from(`\n<<<END_SVC_CONTEXT ${file.label}>>>\n`));
  }
  chunks.push(Buffer.from(`\n<<<SVC_REVIEW_REQUEST sha256=${sha256(baseBytes)}>>>\n`));
  chunks.push(baseBytes);
  chunks.push(Buffer.from('\n<<<END_SVC_REVIEW_REQUEST>>>\n'));
  return {
    bytes: Buffer.concat(chunks),
    context: { version: 1, context_root: contextRoot, base_package_sha256: sha256(baseBytes), files: manifest.files },
  };
}

function redactDiagnostic(value) {
  return String(value)
    .replace(/(?:sk-ant-|sk-proj-|sk-)[A-Za-z0-9._-]+/gi, '[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/((?:api[_-]?key|token|secret)\s*[=:]\s*)[^\s,;]+/gi, '$1[REDACTED]');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function contentKey(parts) {
  const hash = createHash('sha256');
  for (const part of parts) {
    const bytes = Buffer.isBuffer(part) ? part : Buffer.from(part);
    hash.update(Buffer.from(String(bytes.length)));
    hash.update(Buffer.from(':'));
    hash.update(bytes);
  }
  return hash.digest('hex');
}

function tupleEqual(left, right) {
  return Boolean(left && right && canonical(left) === canonical(right));
}

function validateExternalReviewPolicy(policy) {
  const fail = (message) => { throw Object.assign(new Error(`external review policy invalid: ${message}`), { classification: 'config_invalid' }); };
  if (!policy || policy.version !== 3) fail('version must be 3');
  if (policy.cutover_utc !== '2026-07-19T21:00:00Z' || policy.cutover_local !== '2026-07-20 00:00:00 EEST' || policy.timezone !== 'Europe/Sofia') fail('cutover metadata mismatch');
  if (!Number.isFinite(Date.parse(policy.cutover_utc))) fail('cutover is not an ISO instant');
  const profiles = policy.profiles || {};
  const expected = {
    'codex-high': ['claude', 'codex', 'openai', 'gpt-5.6-sol', 'high'],
    'fable-high': ['codex', 'claude', 'anthropic', 'claude-fable-5', 'high'],
    'opus-high': ['codex', 'claude', 'anthropic', 'claude-opus-4-8', 'high'],
  };
  for (const [name, values] of Object.entries(expected)) {
    const tuple = profiles[name]?.tuple;
    if (!tuple || [tuple.orchestrator, tuple.host, tuple.family, tuple.model, tuple.effort].some((value, index) => value !== values[index])) fail(`profile ${name} tuple mismatch`);
  }
  if (profiles['codex-high'].fallback !== null || profiles['opus-high'].fallback !== null) fail('Codex and Opus profiles must not fall back');
  const fableFallback = profiles['fable-high'].fallback;
  if (!fableFallback || fableFallback.tuple?.model !== 'claude-opus-4-8' || fableFallback.tuple?.effort !== 'xhigh' || canonical(fableFallback.eligible_after) !== canonical([...ELIGIBLE_FALLBACKS])) fail('Fable fallback contract mismatch');
  const schedule = policy.orchestrators?.codex?.schedule;
  if (!Array.isArray(schedule) || schedule.length !== 2 || schedule[0].profile !== 'fable-high' || schedule[0].ends_at !== policy.cutover_utc || schedule[1].profile !== 'opus-high' || schedule[1].starts_at !== policy.cutover_utc) fail('Codex schedule mismatch');
  if (policy.orchestrators?.claude?.profile !== 'codex-high') fail('Claude fixed profile mismatch');
  if (policy.selection?.applies_to_orchestrator !== 'codex') fail('profile selection must apply only to Codex orchestration');
  return policy;
}

async function loadExternalReviewPolicy() {
  const registry = JSON.parse(await readFile(MODEL_REGISTRY, 'utf8'));
  return validateExternalReviewPolicy(registry.externalReviewPolicy);
}

function policyNow(fixture) {
  const injected = process.env.SVC_EXTERNAL_REVIEW_NOW;
  if (injected && !fixture) throw Object.assign(new Error('SVC_EXTERNAL_REVIEW_NOW is fixture-only'), { classification: 'config_invalid' });
  const now = injected ? new Date(injected) : new Date();
  if (!Number.isFinite(now.getTime())) throw Object.assign(new Error('SVC_EXTERNAL_REVIEW_NOW must be an ISO instant'), { classification: 'config_invalid' });
  return now;
}

async function selectionFile(fixture, fixtureRoot) {
  const configured = process.env.SVC_EXTERNAL_REVIEW_POLICY_DIR;
  if (configured && !fixture) throw Object.assign(new Error('SVC_EXTERNAL_REVIEW_POLICY_DIR is fixture-only'), { classification: 'config_invalid' });
  const directory = path.resolve(configured || path.join(ROOT, '.svc/external-review-policy/v1'));
  if (fixture) {
    const root = await realpath(fixtureRoot);
    const relative = path.relative(root, directory);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Object.assign(new Error('fixture policy directory escapes fixture root'), { classification: 'config_invalid' });
  }
  return path.join(directory, 'selection.json');
}

function selectionEvidence(bytes, document) {
  return {
    selection_sha256: sha256(bytes),
    selection_expires_at: document.expires_at,
    selection_authority: document.authority,
  };
}

async function validateSelectionDirectory(directory) {
  const reject = (message) => { throw Object.assign(new Error(`profile selection invalid: ${message}`), { classification: 'profile_selection_invalid' }); };
  const info = await lstat(directory);
  if (info.isSymbolicLink() || !info.isDirectory()) reject('selection directory must be a regular non-symlink directory');
  if (typeof process.getuid === 'function' && info.uid !== process.getuid()) reject('selection directory owner does not match current user');
  if ((info.mode & 0o022) !== 0) reject('selection directory must not be group/world writable');
}

async function readSelection(file, policy, now) {
  const reject = (message) => { throw Object.assign(new Error(`profile selection invalid: ${message}`), { classification: 'profile_selection_invalid' }); };
  try { await lstat(path.dirname(file)); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  await validateSelectionDirectory(path.dirname(file));
  let handle;
  try { handle = await open(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW); } catch (error) { if (error.code === 'ENOENT') return null; reject(error.code === 'ELOOP' ? 'selection must not be a symlink' : `selection cannot be opened safely (${error.code || 'unknown'})`); }
  let bytes;
  try {
    const info = await handle.stat();
    if (!info.isFile()) reject('selection must be a regular file');
    if (typeof process.getuid === 'function' && info.uid !== process.getuid()) reject('selection owner does not match current user');
    if ((info.mode & 0o077) !== 0) reject('selection mode must be 0600');
    bytes = await handle.readFile();
  } finally { await handle.close(); }
  let document;
  try { document = JSON.parse(bytes.toString('utf8')); } catch { reject('selection is not valid JSON'); }
  const keys = Object.keys(document || {}).sort().join(',');
  if (keys !== 'authority,expires_at,profile,reason,schema_version,selected_at') reject('selection keys do not match schema');
  if (document.schema_version !== policy.selection.schema_version || document.authority !== policy.selection.authority || !policy.selection.allowed_profiles.includes(document.profile) || typeof document.reason !== 'string' || !document.reason.trim()) reject('selection provenance or profile is unsupported');
  const selected = Date.parse(document.selected_at);
  const expires = document.expires_at === null ? null : Date.parse(document.expires_at);
  if (!Number.isFinite(selected) || selected > now.getTime() + 60_000 || (document.expires_at !== null && (!Number.isFinite(expires) || expires <= now.getTime()))) reject('selection timestamps are invalid or expired');
  return { document, ...selectionEvidence(bytes, document) };
}

async function writeSelection(file, profile, reason, expiresAt, policy, now) {
  if (!policy.selection.allowed_profiles.includes(profile)) throw Object.assign(new Error(`profile selection invalid: unsupported profile ${profile}`), { classification: 'profile_selection_invalid' });
  if (typeof reason !== 'string' || !reason.trim()) throw Object.assign(new Error('profile selection invalid: --reason is required'), { classification: 'profile_selection_invalid' });
  const expiry = expiresAt || null;
  if (expiry !== null && (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now.getTime())) throw Object.assign(new Error('profile selection invalid: expiry must be a future ISO instant'), { classification: 'profile_selection_invalid' });
  const document = { schema_version: policy.selection.schema_version, profile, authority: policy.selection.authority, reason: reason.trim(), selected_at: now.toISOString(), expires_at: expiry };
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await validateSelectionDirectory(path.dirname(file));
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  const handle = await open(temporary, 'wx', 0o600);
  try { await handle.writeFile(`${JSON.stringify(document, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
  await rename(temporary, file);
  const bytes = await readFile(file);
  return { document, ...selectionEvidence(bytes, document) };
}

async function clearSelection(file, reason) {
  if (typeof reason !== 'string' || !reason.trim()) throw Object.assign(new Error('profile selection invalid: --reason is required'), { classification: 'profile_selection_invalid' });
  try {
    await validateSelectionDirectory(path.dirname(file));
    const info = await lstat(file);
    if (info.isSymbolicLink() || !info.isFile()) throw Object.assign(new Error('profile selection invalid: refusing to clear non-regular selection'), { classification: 'profile_selection_invalid' });
    await rm(file);
    return true;
  } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function resolvePolicy(policy, orchestrator, now, selectionPath) {
  if (orchestrator === 'claude') {
    const profile = policy.orchestrators.claude.profile;
    return { tuple: policy.profiles[profile].tuple, fallback: null, metadata: { version: policy.version, profile, source: 'fixed-policy', resolved_at: now.toISOString(), effective_window: { starts_at: null, ends_at: null }, cutover_utc: policy.cutover_utc, cutover_local: policy.cutover_local, timezone: policy.timezone, selection_sha256: null, selection_expires_at: null, selection_authority: null } };
  }
  if (orchestrator !== 'codex') throw Object.assign(new Error(`unsupported orchestrator ${orchestrator || '<missing>'}`), { classification: 'input_invalid' });
  const selection = await readSelection(selectionPath, policy, now);
  let profile;
  let source;
  let window;
  if (selection) {
    profile = selection.document.profile;
    source = 'explicit-selection';
    window = { starts_at: selection.document.selected_at, ends_at: selection.document.expires_at };
  } else {
    const scheduled = policy.orchestrators.codex.schedule.find((entry) => (entry.starts_at === null || now >= new Date(entry.starts_at)) && (entry.ends_at === null || now < new Date(entry.ends_at)));
    if (!scheduled) throw Object.assign(new Error('no reviewer profile covers the current instant'), { classification: 'config_invalid' });
    profile = scheduled.profile;
    source = 'schedule';
    window = { starts_at: scheduled.starts_at, ends_at: scheduled.ends_at };
  }
  const configured = policy.profiles[profile];
  return { tuple: configured.tuple, fallback: configured.fallback, metadata: { version: policy.version, profile, source, resolved_at: now.toISOString(), effective_window: window, cutover_utc: policy.cutover_utc, cutover_local: policy.cutover_local, timezone: policy.timezone, selection_sha256: selection?.selection_sha256 || null, selection_expires_at: selection?.document.expires_at || null, selection_authority: selection?.document.authority || null } };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, file);
}

function validateSchema(value, schema, root = schema, location = '$') {
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/')) return [`${location}: unsupported schema reference ${schema.$ref}`];
    const target = schema.$ref.slice(2).split('/').reduce((cursor, key) => cursor?.[key], root);
    return target ? validateSchema(value, target, root, location) : [`${location}: unresolved schema reference ${schema.$ref}`];
  }
  if (schema.anyOf) {
    const branches = schema.anyOf.map((branch) => validateSchema(value, branch, root, location));
    if (!branches.some((errors) => errors.length === 0)) return [`${location}: no anyOf branch matched`];
  }
  if (Object.prototype.hasOwnProperty.call(schema, 'const') && canonical(value) !== canonical(schema.const)) return [`${location}: value does not match const`];
  const errors = [];
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  const actual = value === null ? 'null' : Array.isArray(value) ? 'array' : Number.isInteger(value) ? 'integer' : typeof value;
  if (types.length && !types.includes(actual) && !(actual === 'integer' && types.includes('number'))) return [`${location}: expected ${types.join('|')}, got ${actual}`];
  if (schema.enum && !schema.enum.some((entry) => canonical(entry) === canonical(value))) errors.push(`${location}: value is outside enum`);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${location}: missing ${key}`);
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!Object.prototype.hasOwnProperty.call(schema.properties || {}, key)) errors.push(`${location}: unexpected ${key}`);
    }
    for (const [key, child] of Object.entries(schema.properties || {})) if (Object.prototype.hasOwnProperty.call(value, key)) errors.push(...validateSchema(value[key], child, root, `${location}.${key}`));
  }
  if (Array.isArray(value) && schema.items) value.forEach((entry, index) => errors.push(...validateSchema(entry, schema.items, root, `${location}[${index}]`)));
  return errors;
}

function validateFindings(findings, tuple, reviewKind, schema) {
  const errors = validateSchema(findings, schema);
  if (findings?.review_kind !== reviewKind) errors.push('$.review_kind: does not match request');
  if (reviewKind === 'plan' && !Number.isInteger(findings?.rubric_score)) errors.push('$.rubric_score: plan review requires an integer score from 0 through 10');
  if (findings?.reviewer) {
    // WI-489: host + family are the real trust boundary — a codex/openai request
    // must never be satisfied by an anthropic-family response, and vice versa;
    // these hard-fail. model + effort are MODEL-AUTHORED self-reports: a model
    // reliably knows neither its exact deployment alias (gpt-5.6-sol self-reports
    // "gpt-5") nor the effort level it was launched at, so matching them exactly
    // rejected every real gpt-5.6-sol review. The authoritative model routing
    // evidence is the process-level model_attestation (argv + auth + runtime
    // modelUsage), NOT this self-report. So model/effort are advisory here.
    for (const key of ['host', 'family']) if (findings.reviewer[key] !== tuple[key]) errors.push(`$.reviewer.${key}: does not match invoked tuple`);
  }
  return errors;
}

export function validateExternalReviewReceiptSemantics(receipt) {
  const errors = [];
  if (receipt.protocol?.process_invocations !== receipt.attempts?.length) errors.push('$.protocol.process_invocations: must equal attempts length');
  if (receipt.status === 'failure' && receipt.route?.kind !== 'hard_failure') errors.push('$.route.kind: failures must be hard_failure');
  if (receipt.status === 'success' && receipt.route?.kind === 'hard_failure') errors.push('$.route.kind: successes cannot use hard_failure');
  if (receipt.status === 'success' && receipt.fallback?.used && receipt.route?.kind !== 'launcher_availability_fallback') errors.push('$.route.kind: successful launcher fallback route required');
  if (receipt.review_kind !== 'capability-probe' && ['exact_primary', 'scheduled_primary', 'explicit_profile_primary', 'owner_config_primary'].includes(receipt.route?.kind)) {
    if (receipt.status !== 'success' || receipt.fallback?.used || !tupleEqual(receipt.requested_tuple, receipt.invocation_tuple) || !tupleEqual(receipt.requested_tuple, receipt.effective_tuple)) errors.push('$.route: exact primary routes require matching requested, invoked, and effective tuples with no fallback');
  }
  if (receipt.route?.kind === 'launcher_availability_fallback') {
    const first = receipt.attempts?.[0]?.tuple;
    const last = receipt.attempts?.at(-1)?.tuple;
    if (receipt.status !== 'success' || !receipt.fallback?.used || receipt.attempts?.length !== 2 || !tupleEqual(first, receipt.requested_tuple) || !tupleEqual(last, receipt.invocation_tuple) || !tupleEqual(last, receipt.effective_tuple) || tupleEqual(receipt.requested_tuple, receipt.effective_tuple)) errors.push('$.route: launcher fallback must bind requested primary and final fallback attempt tuples');
  }
  if (receipt.route?.kind === 'provider_safety_route') {
    if (receipt.requested_tuple?.model !== 'claude-fable-5' || receipt.invocation_tuple?.model !== 'claude-fable-5' || receipt.effective_tuple?.model !== 'claude-opus-4-8' || receipt.fallback?.used || receipt.effective_effort?.value !== null || receipt.effective_effort?.provenance !== 'provider-managed' || receipt.route?.evidence !== 'provider_model_usage_envelope_inferred') errors.push('$.route: contradictory provider safety route');
  }
  if (receipt.cache?.reusable) {
    if (receipt.status !== 'success' || receipt.fallback?.used || !tupleEqual(receipt.requested_tuple, receipt.invocation_tuple) || !tupleEqual(receipt.requested_tuple, receipt.effective_tuple) || !['exact_primary', 'scheduled_primary', 'explicit_profile_primary', 'owner_config_primary', 'cache_hit'].includes(receipt.route?.kind)) errors.push('$.cache.reusable: only exact no-fallback primary evidence is reusable');
  }
  if (receipt.route?.kind === 'cache_hit' && (receipt.classification !== 'cache_hit' || receipt.route?.evidence !== 'cache_receipt_replay')) errors.push('$.classification: cache route requires cache_hit replay evidence');
  if (receipt.route?.kind === 'launcher_availability_fallback' && receipt.route?.evidence !== 'launcher_attempt_chain') errors.push('$.route.evidence: launcher fallback requires attempt-chain evidence');
  if (receipt.route?.kind === 'hard_failure' && receipt.route?.evidence !== 'failure') errors.push('$.route.evidence: hard failure requires failure evidence');
  if (['exact_primary', 'scheduled_primary', 'explicit_profile_primary', 'owner_config_primary'].includes(receipt.route?.kind) && receipt.route?.evidence !== 'requested_primary') errors.push('$.route.evidence: primary route requires requested-primary evidence');
  if (receipt.route?.kind === 'cache_hit' && receipt.model_attestation?.level !== 'cache_replay') errors.push('$.model_attestation.level: cache route requires cache_replay');
  if (receipt.route?.kind === 'provider_safety_route' && receipt.model_attestation?.level !== 'server_observed') errors.push('$.model_attestation.level: provider safety route requires server_observed');
  if (receipt.status === 'success' && receipt.route?.kind !== 'cache_hit' && receipt.review_kind !== 'capability-probe') {
    if (receipt.model_attestation?.requested_model !== receipt.invocation_tuple?.model) errors.push('$.model_attestation.requested_model: must match invocation tuple');
    if (receipt.invocation_tuple?.host === 'claude' && receipt.model_attestation?.level !== 'server_observed') errors.push('$.model_attestation.level: Claude success requires server_observed');
    if (['codex', 'agy'].includes(receipt.invocation_tuple?.host) && !['requested_accepted', 'server_observed'].includes(receipt.model_attestation?.level)) errors.push('$.model_attestation.level: Codex/AGY success requires requested_accepted or server_observed');
  }
  if (receipt.policy?.source === 'schedule' && receipt.route?.kind === 'explicit_profile_primary') errors.push('$.route.kind: scheduled policy cannot be explicit primary');
  if (receipt.policy?.source === 'explicit-selection' && receipt.route?.kind === 'scheduled_primary') errors.push('$.route.kind: explicit policy cannot be scheduled primary');
  if (receipt.policy?.source === 'owner-config' && receipt.review_kind !== 'capability-probe' && !/^[a-f0-9]{64}$/.test(receipt.candidate_digest ?? '')) errors.push('$.candidate_digest: owner-configured review must bind the frozen candidate');
  if (receipt.status === 'success' && receipt.review_kind !== 'capability-probe' && !/^[a-f0-9]{64}$/.test(receipt.findings_sha256 ?? '')) errors.push('$.findings_sha256: successful review must bind canonical findings bytes');
  if ((receipt.status === 'failure' || receipt.review_kind === 'capability-probe') && receipt.findings_sha256 !== null) errors.push('$.findings_sha256: failures and capability probes cannot claim findings');
  return errors;
}

async function processIdentity(pid = process.pid) {
  try {
    const data = await readFile(`/proc/${pid}/stat`, 'utf8');
    const end = data.lastIndexOf(')');
    if (end < 0) return { state: 'unknown', token: null };
    const fieldsAfterComm = data.slice(end + 1).trim().split(/\s+/);
    const token = fieldsAfterComm[19] || null;
    return token ? { state: 'live', token } : { state: 'unknown', token: null };
  } catch (error) {
    if (procfsAvailable === undefined) {
      try { await readFile('/proc/self/stat', 'utf8'); procfsAvailable = true; } catch { procfsAvailable = false; }
    }
    return procfsAvailable && (error.code === 'ENOENT' || error.code === 'ESRCH')
      ? { state: 'dead', token: null }
      : { state: 'unknown', token: null };
  }
}

async function processStartToken(pid = process.pid) {
  return (await processIdentity(pid)).token;
}

function classifyProviderFailure(stdout, stderr, timedOut) {
  if (timedOut) return 'timeout';
  const structuredCodes = [];
  let structuredTerminalClassification = null;
  for (const line of `${stdout}\n${stderr}`.split(/\r?\n/)) {
    try {
      const parsed = JSON.parse(line);
      if (parsed?.error && typeof parsed.error === 'object') {
        for (const candidate of [parsed.error.code, parsed.error.type]) if (typeof candidate === 'string') structuredCodes.push(candidate.toLowerCase());
      }
      if (parsed?.type === 'result' && parsed.is_error === true && parsed.terminal_reason === 'api_error' && parsed.api_error_status === 403 && typeof parsed.result === 'string' && /^Your organization has disabled Claude subscription access for Claude Code\b/.test(parsed.result)) structuredTerminalClassification = 'model_entitlement';
    } catch {}
  }
  if (structuredTerminalClassification) return structuredTerminalClassification;
  const joinedCodes = structuredCodes.join(' ');
  const diagnostics = `${joinedCodes}\n${stderr}`.toLowerCase();
  const forbiddenRules = [
    ['model_entitlement', /(?:^|\b)(?:ineligibletiererror|ineligible tier|client is no longer supported for gemini code assist)(?:\b|$)/],
    ['model_unavailable', /(?:^|\b)invalid model selection(?:\b|$)/],
    ['authentication', /(?:^|\b)(?:authentication|unauthenticated|unauthorized|invalid api key|login required|oauth)(?:\b|$)/],
    ['shared_quota', /(?:^|\b)(?:shared quota|quota exhausted|credit balance|billing limit|insufficient credits)(?:\b|$)/],
    ['network', /(?:^|\b)(?:network|econnreset|enotfound|eai_again|connection refused|connection timed out|dns)(?:\b|$)/],
    ['capability', /(?:^|\b)(?:unknown option|unrecognized option|unexpected argument|invalid configuration key|unsupported flag)(?:\b|$)/],
  ];
  const forbidden = forbiddenRules.find(([, pattern]) => pattern.test(diagnostics))?.[0];
  if (forbidden) return forbidden;
  const eligibleStructuredRules = [
    ['model_entitlement', /(?:^|\b)(?:model[_ -]?entitlement|not[_ -]?entitled|access[_ -]?denied[_ -]?for[_ -]?model|model[_ -]?access)(?:\b|$)/],
    ['model_unavailable', /(?:^|\b)(?:model[_ -]?unavailable|model[_ -]?not[_ -]?found|unknown[_ -]?model|unsupported[_ -]?model)(?:\b|$)/],
    ['provider_overload', /(?:^|\b)(?:provider[_ -]?overload|overloaded|capacity|temporarily[_ -]?unavailable|service[_ -]?unavailable)(?:\b|$)/],
  ];
  const structured = eligibleStructuredRules.find(([, pattern]) => pattern.test(joinedCodes))?.[0];
  if (structured) return structured;
  const diagnosticLines = stderr.toLowerCase().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const eligibleDiagnosticRules = [
    ['model_entitlement', /^(?:error:\s*)?(?:model entitlement required|not entitled to (?:use )?(?:the )?(?:requested )?model)$/],
    ['model_unavailable', /^(?:error:\s*)?(?:model unavailable|model not found|unknown model|unsupported model)$/],
    ['provider_overload', /^(?:error:\s*)?(?:provider overloaded|provider overload|service unavailable|temporarily unavailable)$/],
  ];
  for (const line of diagnosticLines) {
    const matched = eligibleDiagnosticRules.find(([, pattern]) => pattern.test(line));
    if (matched) return matched[0];
  }
  return 'unknown_provider';
}

function actionableDiagnostic(classification) {
  const actions = {
    input_invalid: 'provide a non-empty review package on stdin and the required launcher options',
    config_invalid: 'repair the named SVC_EXTERNAL_REVIEW configuration value before retrying',
    internal_failure: 'inspect the preserved internal diagnostic and repair the launcher or filesystem state before retrying',
    disabled: 'unset SVC_EXTERNAL_REVIEW_DISABLED only when paid external review is authorized',
    capability: 'upgrade or repair the selected CLI so every required isolation and schema flag is available',
    model_unavailable: 'restore availability for the requested model; no unapproved substitution was made',
    model_entitlement: 'grant the configured account access to the requested model',
    provider_overload: 'retry the same requested tuple after provider capacity recovers',
    authentication: 'repair the existing CLI OAuth, keychain, or CODEX_HOME login outside this launcher',
    shared_quota: 'restore shared provider quota or budget, then retry the same tuple',
    network: 'restore network and DNS connectivity, then retry the same tuple',
    timeout: 'retry after resolving provider latency or set an authorized larger SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS bound',
    budget_exhausted: 'set an explicitly authorized larger review dollar ceiling before retrying the unchanged package; never treat local budget exhaustion as provider unavailability',
    cancelled: 'retry the same requested tuple after the external cancellation is intentionally cleared',
    schema_invalid: 'repair the provider response or shared schema; malformed findings are never accepted',
    schema_turn_budget: 'repair the review package or schema handshake; do not increase effort, start a second model, or treat agentic turns as paid invocations',
    model_mismatch: 'repair model routing so runtime usage and findings match the requested tuple',
    profile_selection_invalid: 'clear or replace the local profile selection with the canonical launcher command and secure owner-only state',
    provider_safety_failure: 'retry only after the provider or CLI safeguard-routing state changes; do not launch a separate Opus fallback',
    override_invalid: 'supply a fresh repository-owner override whose exact bytes match SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256',
    phase_violation: 'run a frozen implementation review with --review-kind exec; a paid plan review is refused once execute-changeset has begun or implementation files diverged from the bound pre-execution base. A retro-plan exception requires a receipted --phase-override-file',
    fallback_failed: 'restore the separately invoked Opus fallback or retry after its classified failure is resolved',
    lock_failure: 'inspect the reported cache-key lock owner; do not delete a live lock',
    unknown_provider: 'inspect the preserved provider diagnostic artifact and classify the failure before retrying',
  };
  return actions[classification] || actions.unknown_provider;
}

function fixtureBinary(variable, fallback, fixtureRoot) {
  if (!fixtureRoot) return fallback;
  const candidate = process.env[variable];
  if (!candidate) throw new Error(`${variable} is required in fixture mode`);
  return realpath(candidate).then(async (resolved) => {
    const root = await realpath(fixtureRoot);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) throw new Error(`${variable} escapes SVC_EXTERNAL_REVIEW_FIXTURE_ROOT`);
    return resolved;
  });
}

async function runProcess(binary, args, input, timeoutMs, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { env, stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32' });
    const stdout = [];
    const stderr = [];
    let timedOut = false;
    let cancelled = false;
    let settled = false;
    let escalationTimer;
    const terminate = (isTimeout) => {
      if (isTimeout) timedOut = true;
      else cancelled = true;
      clearTimeout(timer);
      try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGTERM'); } catch {}
      if (!escalationTimer) {
        escalationTimer = setTimeout(() => { try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, 'SIGKILL'); } catch {} }, 1000);
        escalationTimer.unref();
      }
    };
    const timer = setTimeout(() => {
      terminate(true);
    }, timeoutMs);
    const onSigint = () => terminate(false);
    const onSigterm = () => terminate(false);
    process.on('SIGINT', onSigint);
    process.on('SIGTERM', onSigterm);
    const cleanup = () => {
      process.off('SIGINT', onSigint);
      process.off('SIGTERM', onSigterm);
      clearTimeout(timer);
      if (escalationTimer) clearTimeout(escalationTimer);
    };
    child.stdout.on('data', (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on('data', (chunk) => stderr.push(Buffer.from(chunk)));
    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    });
    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ code, signal, timedOut, cancelled, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}

async function capabilityCheck(tuple, binary, timeoutMs) {
  if (!reviewTransport(tuple.host)) {
    return { ok: false, missing: [`no review transport for host ${tuple.host}`], output: '' };
  }
  const required = tuple.host === 'codex'
    ? ['--config', '--strict-config', '--model', '--sandbox', 'read-only', '--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--output-schema', '--json', '--output-last-message', '--color']
    : tuple.host === 'agy'
      ? ['--sandbox', '--mode', '--model', '--effort', '--add-dir', '--json-schema', '--output-format', '--print-timeout', '--print']
      : ['--print', '--model', '--effort', '--safe-mode', '--tools', '--strict-mcp-config', '--mcp-config', '--permission-mode', '--no-session-persistence', '--disable-slash-commands', '--no-chrome', '--settings', '--json-schema', '--output-format', '--max-budget-usd'];
  let result;
  try {
    result = await runProcess(binary, tuple.host === 'codex' ? ['exec', '--help'] : ['--help'], Buffer.alloc(0), Math.min(timeoutMs, 30_000));
  } catch (error) {
    return { ok: false, missing: [`executable (${error.message})`], output: '' };
  }
  const output = `${result.stdout.toString('utf8')}\n${result.stderr.toString('utf8')}`;
  if (result.cancelled) return { ok: false, cancelled: true, missing: [], version: null, output };
  const missing = required.filter((flag) => !output.includes(flag));
  if (result.code !== 0) missing.unshift(`help exited ${result.code}`);
  const parserArgs = tuple.host === 'codex'
    ? ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--strict-config', '--model', tuple.model, '-c', `model_reasoning_effort="${tuple.effort}"`, '--color', 'never', '--version']
    : tuple.host === 'agy'
      ? ['--version']
      : ['--print', '--model', tuple.model, '--effort', tuple.effort, '--safe-mode', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--permission-mode', 'plan', '--no-session-persistence', '--max-turns', '4', '--disable-slash-commands', '--no-chrome', ...(tuple.model === 'claude-fable-5' ? ['--settings', '{"switchModelsOnFlag":true}'] : []), '--json-schema', '{"type":"object"}', '--output-format', 'json', '--max-budget-usd', '1', '--version'];
  const parser = await runProcess(binary, parserArgs, Buffer.alloc(0), Math.min(timeoutMs, 30_000));
  if (parser.cancelled) return { ok: false, cancelled: true, missing: [], version: null, output: `${output}\n${parser.stdout}\n${parser.stderr}` };
  if (parser.code !== 0) missing.push(`configured argv parser exited ${parser.code}`);
  const version = `${parser.stdout.toString('utf8')}\n${parser.stderr.toString('utf8')}`.trim().split(/\r?\n/).find(Boolean) || null;
  return { ok: missing.length === 0, missing, version, output: `${output}\n${parser.stdout}\n${parser.stderr}` };
}

async function parseOwnerOverride(file, primary) {
  const empty = { used: false, authority: null, source: null, path: null, expected_sha256: null, actual_sha256: null };
  if (!file) return { tuple: primary, evidence: empty };
  const absolute = path.resolve(file);
  const expected = process.env.SVC_EXTERNAL_REVIEW_OWNER_OVERRIDE_SHA256 || null;
  let bytes;
  try { bytes = await readFile(absolute); }
  catch { throw Object.assign(new Error('owner override is unreadable'), { classification: 'override_invalid', overrideEvidence: { ...empty, used: true, path: absolute, expected_sha256: expected } }); }
  const actual = sha256(bytes);
  let document;
  try { document = JSON.parse(bytes.toString('utf8')); } catch { throw Object.assign(new Error('owner override is not valid JSON'), { classification: 'override_invalid', overrideEvidence: { ...empty, used: true, path: absolute, expected_sha256: expected, actual_sha256: actual } }); }
  const requested = document.requested_tuple;
  const timestamp = Date.parse(document.timestamp);
  const evidence = { used: true, authority: document.authority || null, source: document.source || null, path: absolute, expected_sha256: expected, actual_sha256: actual };
  const expectedFamily = primary.family;
  const tupleKeys = requested && typeof requested === 'object' ? Object.keys(requested).sort().join(',') : '';
  const validHostFamily = (requested?.host === 'codex' && requested?.family === 'openai') || (requested?.host === 'claude' && requested?.family === 'anthropic') || (requested?.host === 'agy' && requested?.family === 'google');
  const validTuple = requested && tupleKeys === 'effort,family,host,model,orchestrator' && requested.orchestrator === primary.orchestrator && requested.host === primary.host && requested.family === expectedFamily && requested.model === primary.model && validHostFamily && ['low', 'medium', 'high', 'xhigh', 'max'].includes(requested.effort);
  if (!expected || expected !== actual || document.authority !== 'repository-owner' || typeof document.source !== 'string' || !document.source || typeof document.reason !== 'string' || !document.reason || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > MAX_OWNER_OVERRIDE_AGE_MS || !validTuple) {
    throw Object.assign(new Error('owner override failed trust, freshness, provenance, or tuple validation'), { classification: 'override_invalid', overrideEvidence: evidence });
  }
  return { tuple: requested, evidence };
}

// --- Phase-to-review-kind guard (WI-489) -------------------------------------
// A paid `plan` review must run BEFORE execute-changeset. Once execution has
// begun for the bound WI — proven by a durable exec-record receipt OR by
// implementation files diverging from the bound pre-execution base — a paid
// plan review is refused before any provider spawn. The lane-tasks graph/status
// is never trusted for this decision; only durable receipt evidence and the
// implementation diff are, so a backward graph edit cannot bypass the gate.
const PHASE_EXEMPT_PREFIXES = [
  /^docs\//,
  /^proposals\//,
  /^\.svc\//,
  /^NOTICES$/,
  /^references\/blend-registry\.json$/,
];
const PHASE_KNOWLEDGE_EVIDENCE = /^references\/knowledge\/(?:[^/]+\/)*(?:\.version|[^/]+\.(?:md|json|jsonl))$/;
function isPhaseExemptFile(file) {
  return PHASE_EXEMPT_PREFIXES.some((re) => re.test(file)) || PHASE_KNOWLEDGE_EVIDENCE.test(file);
}

function normalizePhaseGuard(partial = {}) {
  const overrideDefault = { used: false, authority: null, source: null, path: null, expected_sha256: null, actual_sha256: null, kind: null };
  return {
    applicable: partial.applicable ?? false,
    kind: partial.kind ?? null,
    decision: partial.decision ?? 'not-applicable',
    reason: partial.reason ?? null,
    wi: partial.wi ?? null,
    pre_execution_base: partial.pre_execution_base ?? null,
    plan_manifest_sha256: partial.plan_manifest_sha256 ?? null,
    exec_record_present: partial.exec_record_present ?? null,
    exec_record_path: partial.exec_record_path ?? null,
    implementation_diverged: partial.implementation_diverged ?? null,
    diverged_files: Array.isArray(partial.diverged_files) ? partial.diverged_files.slice(0, 50) : [],
    base_resolved: partial.base_resolved ?? null,
    override: { ...overrideDefault, ...(partial.override || {}) },
  };
}

function gitCapture(cwd, gitArgs) {
  return new Promise((resolve) => {
    let child;
    try { child = spawn('git', ['-C', cwd, ...gitArgs], { stdio: ['ignore', 'pipe', 'pipe'] }); }
    catch (error) { resolve({ code: 127, stdout: '', stderr: String(error?.message || error) }); return; }
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (error) => resolve({ code: 127, stdout, stderr: String(error?.message || error) }));
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

async function findExecRecordForWi(root, wi, base = null, depth = 0) {
  // Scan the working-tree receipt mirror (.svc/receipts, incl. staging/) for a
  // durable exec-record whose wi matches. This is what execute-changeset writes
  // pre-merge; it cannot be produced without execution having begun.
  const walk = async (dir, level) => {
    if (level > 4) return null;
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return null; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const found = await walk(full, level + 1);
        if (found) return found;
      } else if (entry.name === 'exec-record.json') {
        try {
          const doc = JSON.parse(await readFile(full, 'utf8'));
          if (doc?.wi === wi) return path.relative(root, full);
        } catch { /* malformed mirror is ignored; the diff check still applies */ }
      }
    }
    return null;
  };
  const mirrorHit = await walk(path.join(root, '.svc/receipts'), depth);
  if (mirrorHit) return mirrorHit;
  // Durable authority is refs/notes/svc-receipts (the mirror is a regenerable
  // cache). An exec-record note may sit on an ANCESTOR commit, not HEAD — e.g.
  // when HEAD advanced past the execution commit with a revert or exempt-only
  // commits and no divergence remains. So scan every commit in <base>..HEAD
  // (plus HEAD), not HEAD alone. Falls back to HEAD when the base is unresolvable.
  const commits = [];
  if (base) {
    const range = await gitCapture(root, ['log', '--format=%H', `${base}..HEAD`]);
    if (range.code === 0) for (const sha of range.stdout.split('\n').map((s) => s.trim()).filter(Boolean)) commits.push(sha);
  }
  if (!commits.includes('HEAD')) commits.push('HEAD');
  for (const sha of commits) {
    const note = await gitCapture(root, ['notes', '--ref', 'refs/notes/svc-receipts', 'show', sha]);
    if (note.code !== 0) continue;
    try {
      const doc = JSON.parse(note.stdout);
      if (doc?.['exec-record']?.wi === wi) return `refs/notes/svc-receipts:${sha}#exec-record`;
    } catch { /* absent or non-JSON note */ }
  }
  return null;
}

async function implementationDivergedFromBase(root, base) {
  // Files changed between the bound pre-execution base and the current worktree
  // (committed + uncommitted + untracked), minus planning/doc/state paths. Any
  // remaining implementation file means execution has begun.
  const inRepo = await gitCapture(root, ['rev-parse', '--is-inside-work-tree']);
  if (inRepo.code !== 0 || inRepo.stdout.trim() !== 'true') return { diverged: false, base_ok: false, files: [] };
  const resolved = await gitCapture(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`]);
  if (resolved.code !== 0) return { diverged: false, base_ok: false, files: [] };
  // Disable rename detection so both sides of a move are classified. Otherwise
  // Git can report only an exempt destination and hide removal of implementation.
  const tracked = await gitCapture(root, ['diff', '--no-renames', '--name-only', base, '--']);
  const untracked = await gitCapture(root, ['ls-files', '--others', '--exclude-standard']);
  if (tracked.code !== 0) return { diverged: false, base_ok: false, files: [] };
  const files = [...tracked.stdout.split('\n'), ...untracked.stdout.split('\n')]
    .map((line) => line.trim())
    .filter(Boolean);
  const implementation = [...new Set(files.filter((file) => !isPhaseExemptFile(file)))];
  return { diverged: implementation.length > 0, base_ok: true, files: implementation };
}

async function parsePhaseBinding(file) {
  const absolute = path.resolve(file);
  let bytes;
  try { bytes = await readFile(absolute); }
  catch { throw Object.assign(new Error('phase binding is unreadable'), { classification: 'phase_violation' }); }
  let document;
  try { document = JSON.parse(bytes.toString('utf8')); }
  catch { throw Object.assign(new Error('phase binding is not valid JSON'), { classification: 'phase_violation' }); }
  if (typeof document.wi !== 'string' || !WI_ID_RE.test(document.wi)) throw Object.assign(new Error('phase binding wi must match WI-<number>'), { classification: 'phase_violation' });
  if (typeof document.pre_execution_base !== 'string' || !document.pre_execution_base.trim()) throw Object.assign(new Error('phase binding pre_execution_base is required'), { classification: 'phase_violation' });
  // plan_manifest_sha256 is REQUIRED: the sanctioned adapter always supplies the
  // hash of the exact plan being reviewed, so a binding that omits it is not a
  // trustworthy pre-execution attestation. (Recomputing it against durable
  // receipt state is the deeper hardening tracked as a follow-up WI.)
  if (typeof document.plan_manifest_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(document.plan_manifest_sha256)) throw Object.assign(new Error('phase binding requires a sha256 plan_manifest_sha256'), { classification: 'phase_violation' });
  return { wi: document.wi, pre_execution_base: document.pre_execution_base.trim(), plan_manifest_sha256: document.plan_manifest_sha256 };
}

async function parsePhaseOverride(file, wi) {
  const empty = { used: false, authority: null, source: null, path: null, expected_sha256: null, actual_sha256: null, kind: null };
  if (!file) return { used: false, evidence: empty };
  const absolute = path.resolve(file);
  const expected = process.env.SVC_EXTERNAL_REVIEW_PHASE_OVERRIDE_SHA256 || null;
  let bytes;
  try { bytes = await readFile(absolute); }
  catch { throw Object.assign(new Error('phase override is unreadable'), { classification: 'override_invalid', overrideEvidence: { ...empty, used: true, path: absolute, expected_sha256: expected } }); }
  const actual = sha256(bytes);
  let document;
  try { document = JSON.parse(bytes.toString('utf8')); }
  catch { throw Object.assign(new Error('phase override is not valid JSON'), { classification: 'override_invalid', overrideEvidence: { ...empty, used: true, path: absolute, expected_sha256: expected, actual_sha256: actual } }); }
  const timestamp = Date.parse(document.timestamp);
  const evidence = { used: true, authority: document.authority || null, source: document.source || null, path: absolute, expected_sha256: expected, actual_sha256: actual, kind: document.kind || null };
  // Freshness: reject a future timestamp beyond a small clock-skew allowance (no
  // ~48h replay window from `Math.abs`) and reject anything older than the lifetime.
  const overrideFuture = Number.isFinite(timestamp) && timestamp - Date.now() > OVERRIDE_CLOCK_SKEW_MS;
  const overrideStale = Number.isFinite(timestamp) && Date.now() - timestamp > MAX_OWNER_OVERRIDE_AGE_MS;
  if (!expected || expected !== actual || document.authority !== 'repository-owner' || document.kind !== 'retro-plan-review' || typeof document.source !== 'string' || !document.source || typeof document.reason !== 'string' || !document.reason || document.wi !== wi || !Number.isFinite(timestamp) || overrideFuture || overrideStale) {
    throw Object.assign(new Error('phase override failed trust, freshness, provenance, kind, or wi validation'), { classification: 'override_invalid', overrideEvidence: evidence });
  }
  return { used: true, evidence };
}

async function evaluatePhaseGuard(binding, contextRoot, phaseOverride) {
  const execRecord = await findExecRecordForWi(contextRoot, binding.wi, binding.pre_execution_base);
  const divergence = await implementationDivergedFromBase(contextRoot, binding.pre_execution_base);
  const evidence = normalizePhaseGuard({
    applicable: true,
    kind: 'plan',
    wi: binding.wi,
    pre_execution_base: binding.pre_execution_base,
    plan_manifest_sha256: binding.plan_manifest_sha256,
    exec_record_present: Boolean(execRecord),
    exec_record_path: execRecord,
    implementation_diverged: divergence.diverged,
    diverged_files: divergence.files,
    base_resolved: divergence.base_ok,
    override: phaseOverride.evidence,
  });
  if (!divergence.base_ok) {
    evidence.decision = 'reject';
    evidence.reason = 'pre_execution_base_unresolved';
    return { allowed: false, evidence };
  }
  const executionBegun = Boolean(execRecord) || divergence.diverged;
  if (executionBegun) {
    if (phaseOverride.used) {
      evidence.decision = 'allow-override';
      evidence.reason = 'owner_retro_plan_override';
      return { allowed: true, evidence };
    }
    evidence.decision = 'reject';
    evidence.reason = execRecord ? 'exec_record_present' : 'implementation_diverged';
    return { allowed: false, evidence };
  }
  evidence.decision = 'allow';
  evidence.reason = 'pre_execution_state_verified';
  return { allowed: true, evidence };
}

async function acquireLockMutationGuard(lockDir, timeoutMs = 15_000) {
  const guardDir = `${lockDir}.guard`;
  const deadline = Date.now() + timeoutMs;
  const staleMs = process.env.SVC_EXTERNAL_REVIEW_FIXTURE === '1' ? Number(process.env.SVC_EXTERNAL_REVIEW_GUARD_STALE_MS || 10_000) : 10_000;
  if (!Number.isInteger(staleMs) || staleMs < 100 || staleMs > 60_000) throw new Error('SVC_EXTERNAL_REVIEW_GUARD_STALE_MS must be an integer from 100 to 60000');
  const owner = { hostname: hostname(), pid: process.pid, process_start_token: await processStartToken(), owner_token: randomUUID(), heartbeat_at: new Date().toISOString() };
  while (Date.now() < deadline) {
    try {
      await mkdir(guardDir, { mode: 0o700 });
      try { await writeJson(path.join(guardDir, 'owner.json'), owner); }
      catch (error) { await rm(guardDir, { recursive: true, force: true }); throw error; }
      return { guardDir, owner };
    } catch (error) { if (error.code !== 'EEXIST') throw error; }
    let existing = null;
    try { existing = JSON.parse(await readFile(path.join(guardDir, 'owner.json'), 'utf8')); } catch {}
    const heartbeat = Date.parse(existing?.heartbeat_at || '');
    let age = Number.isFinite(heartbeat) ? Date.now() - heartbeat : 0;
    if (!Number.isFinite(heartbeat)) {
      try { age = Date.now() - (await stat(guardDir)).mtimeMs; } catch { age = 0; }
    }
    let reclaim = age > staleMs;
    if (existing?.hostname === hostname() && Number.isInteger(existing.pid)) {
      const identity = await processIdentity(existing.pid);
      if (identity.state === 'dead') reclaim = true;
      else if (identity.state === 'live') reclaim = identity.token !== existing.process_start_token;
      else reclaim = false;
    }
    if (reclaim) {
      const expectedToken = existing?.owner_token || null;
      let current = null;
      try { current = JSON.parse(await readFile(path.join(guardDir, 'owner.json'), 'utf8')); } catch {}
      if ((current?.owner_token || null) !== expectedToken) continue;
      const tombstone = `${guardDir}.stale-${randomUUID()}`;
      try {
        await rename(guardDir, tombstone);
        let moved = null;
        try { moved = JSON.parse(await readFile(path.join(tombstone, 'owner.json'), 'utf8')); } catch {}
        if ((moved?.owner_token || null) === expectedToken) await rm(tombstone, { recursive: true, force: true });
        else await rename(tombstone, guardDir).catch(() => {});
      } catch {}
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error('timed out waiting for cache-lock mutation guard');
}

async function withLockMutationGuard(lockDir, callback) {
  const { guardDir, owner } = await acquireLockMutationGuard(lockDir);
  try { return await callback(); }
  finally {
    try {
      const current = JSON.parse(await readFile(path.join(guardDir, 'owner.json'), 'utf8'));
      if (current.owner_token === owner.owner_token) await rm(guardDir, { recursive: true, force: true });
    } catch {}
  }
}

async function lockReclaimable(lockDir, staleSeconds, existing) {
  const parsedHeartbeat = Date.parse(existing?.heartbeat_at || '');
  let age;
  if (Number.isFinite(parsedHeartbeat)) age = Date.now() - parsedHeartbeat;
  else {
    try { age = Date.now() - (await stat(lockDir)).mtimeMs; } catch { return false; }
  }
  let reclaim = age > staleSeconds * 1000;
  if (reclaim && existing?.hostname === hostname() && Number.isInteger(existing.pid)) {
    const identity = await processIdentity(existing.pid);
    if (identity.state === 'dead') reclaim = true;
    else if (identity.state === 'live') reclaim = identity.token !== existing.process_start_token;
    else reclaim = false;
  }
  return reclaim;
}

async function acquireLock(lockDir, staleSeconds, owner) {
  const recordFile = path.join(lockDir, 'owner.json');
  const deadline = Date.now() + staleSeconds * 1000;
  const fixtureHoldMs = process.env.SVC_EXTERNAL_REVIEW_FIXTURE === '1' ? Number(process.env.SVC_EXTERNAL_REVIEW_LOCK_GUARD_HOLD_MS || 0) : 0;
  if (!Number.isInteger(fixtureHoldMs) || fixtureHoldMs < 0 || fixtureHoldMs > 10_000) throw new Error('SVC_EXTERNAL_REVIEW_LOCK_GUARD_HOLD_MS must be an integer from 0 to 10000');
  while (Date.now() < deadline) {
    const acquired = await withLockMutationGuard(lockDir, async () => {
      if (fixtureHoldMs) await new Promise((resolve) => setTimeout(resolve, fixtureHoldMs));
      try {
        await mkdir(lockDir, { mode: 0o700 });
        try { await writeJson(recordFile, owner); }
        catch (error) { await rm(lockDir, { recursive: true, force: true }); throw error; }
        return true;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
      let existing;
      try { existing = JSON.parse(await readFile(recordFile, 'utf8')); } catch { existing = null; }
      if (await lockReclaimable(lockDir, staleSeconds, existing)) {
        const tombstone = `${lockDir}.stale-${randomUUID()}`;
        try { await rename(lockDir, tombstone); await rm(tombstone, { recursive: true }); } catch {}
      }
      return false;
    });
    if (acquired) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('timed out waiting for live cache-key lock');
}

async function refreshLock(lockDir, owner) {
  try {
    await withLockMutationGuard(lockDir, async () => {
      const file = path.join(lockDir, 'owner.json');
      let current;
      try { current = JSON.parse(await readFile(file, 'utf8')); } catch { return; }
      if (current.owner_token !== owner.owner_token) return;
      owner.heartbeat_at = new Date().toISOString();
      await writeJson(file, owner);
    });
  } catch {}
}

async function releaseLock(lockDir, owner) {
  try {
    await withLockMutationGuard(lockDir, async () => {
      const current = JSON.parse(await readFile(path.join(lockDir, 'owner.json'), 'utf8'));
      if (current.owner_token === owner.owner_token) await rm(lockDir, { recursive: true });
    });
  } catch {}
}

async function cacheHit(entryDir, cacheKey, tuple, reviewKind, candidateDigest, packageHash, findingsSchemaHash, ttlDays, findingsSchema, receiptSchema, fixture) {
  try {
    const entryStat = await lstat(entryDir);
    if (!entryStat.isDirectory() || entryStat.isSymbolicLink()) return null;
    const receipt = JSON.parse(await readFile(path.join(entryDir, 'receipt.json'), 'utf8'));
    const findings = JSON.parse(await readFile(path.join(entryDir, 'findings.json'), 'utf8'));
    const finishedAt = Date.parse(receipt.finished_at || '');
    if (!Number.isFinite(finishedAt) || finishedAt > Date.now() + 60_000 || Date.now() - finishedAt > ttlDays * 86_400_000) return null;
    const findingsBytes = await readFile(path.join(entryDir, 'findings.json'));
    if (receipt.launcher_version !== LAUNCHER_VERSION || receipt.fixture_mode !== fixture || receipt.review_kind !== reviewKind || receipt.candidate_digest !== candidateDigest || receipt.cache_key !== cacheKey || receipt.package_sha256 !== packageHash || receipt.findings_schema_sha256 !== findingsSchemaHash || receipt.findings_sha256 !== sha256(findingsBytes) || validateSchema(receipt, receiptSchema).length || validateExternalReviewReceiptSemantics(receipt).length || validateFindings(findings, tuple, reviewKind, findingsSchema).length) return null;
    if (receipt.status !== 'success' || receipt.classification !== 'success' || receipt.fallback.used || !receipt.cache.reusable || receipt.cache.disposition !== 'published' || receipt.cache.entry !== entryDir) return null;
    if (!tupleEqual(receipt.requested_tuple, tuple) || !tupleEqual(receipt.invocation_tuple, tuple) || !tupleEqual(receipt.effective_tuple, tuple)) return null;
    if (receipt.attempts.length !== 1 || receipt.attempts[0].index !== 1 || receipt.attempts[0].classification !== 'success' || !tupleEqual(receipt.attempts[0].tuple, tuple)) return null;
    return { receipt, findings };
  } catch { return null; }
}

async function tryAcquireGcLock(lockDir, owner) {
  return withLockMutationGuard(lockDir, async () => {
    try { await mkdir(lockDir, { mode: 0o700 }); }
    catch (error) { if (error.code === 'EEXIST') return false; throw error; }
    try { await writeJson(path.join(lockDir, 'owner.json'), owner); return true; }
    catch (error) { await rm(lockDir, { recursive: true, force: true }); throw error; }
  });
}

async function gcCache(cacheRoot, ttlDays, staleSeconds, fixture) {
  await mkdir(cacheRoot, { recursive: true, mode: 0o700 });
  let removed = 0;
  const locksRoot = path.join(cacheRoot, 'locks');
  await mkdir(locksRoot, { recursive: true, mode: 0o700 });
  const processStart = await processStartToken();
  const fixtureHoldMs = fixture ? Number(process.env.SVC_EXTERNAL_REVIEW_GC_HOLD_MS || 0) : 0;
  if (!Number.isInteger(fixtureHoldMs) || fixtureHoldMs < 0 || fixtureHoldMs > 10_000) throw new Error('SVC_EXTERNAL_REVIEW_GC_HOLD_MS must be an integer from 0 to 10000');
  const removeExpired = async (target, key) => {
    let info;
    try { info = await stat(target); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    if (Date.now() - info.mtimeMs <= ttlDays * 86_400_000) return false;
    const lockDir = path.join(locksRoot, `${key}.lock`);
    const owner = { hostname: hostname(), pid: process.pid, process_start_token: processStart, owner_token: randomUUID(), heartbeat_at: new Date().toISOString() };
    if (!(await tryAcquireGcLock(lockDir, owner))) return false;
    try {
      if (fixtureHoldMs) await new Promise((resolve) => setTimeout(resolve, fixtureHoldMs));
      try { info = await stat(target); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      if (Date.now() - info.mtimeMs <= ttlDays * 86_400_000) return false;
      const tombstone = `${target}.gc-${randomUUID()}`;
      try { await rename(target, tombstone); } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
      await rm(tombstone, { recursive: true, force: true });
      return true;
    } finally {
      await releaseLock(lockDir, owner);
    }
  };
  for (const lock of await readdir(locksRoot, { withFileTypes: true }).catch(() => [])) {
    if (!lock.isDirectory() || lock.isSymbolicLink()) continue;
    const lockPath = path.join(locksRoot, lock.name);
    if (/\.lock\.stale-[0-9a-f-]+$/.test(lock.name)) { await rm(lockPath, { recursive: true }); removed += 1; continue; }
    if (!lock.name.endsWith('.lock')) continue;
    const reclaimed = await withLockMutationGuard(lockPath, async () => {
      let owner = null;
      try { owner = JSON.parse(await readFile(path.join(lockPath, 'owner.json'), 'utf8')); } catch {}
      if (!(await lockReclaimable(lockPath, staleSeconds, owner))) return false;
      const tombstone = `${lockPath}.stale-${randomUUID()}`;
      try { await rename(lockPath, tombstone); await rm(tombstone, { recursive: true }); return true; }
      catch { return false; }
    });
    if (reclaimed) removed += 1;
  }
  for (const entry of await readdir(cacheRoot, { withFileTypes: true })) {
    const target = path.join(cacheRoot, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.name === 'locks') continue;
    if (entry.name === 'staging') {
      for (const staged of await readdir(target, { withFileTypes: true }).catch(() => [])) {
        if (!staged.isDirectory() || staged.isSymbolicLink()) continue;
        const stagedPath = path.join(target, staged.name);
        const key = staged.name.split('-')[0];
        if (await removeExpired(stagedPath, key)) removed += 1;
      }
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (/\.gc-[0-9a-f-]+$/.test(entry.name)) { await rm(target, { recursive: true, force: true }); removed += 1; continue; }
    if (await removeExpired(target, entry.name)) removed += 1;
  }
  return removed;
}

async function invoke(tuple, binary, packageBytes, reviewKind, schemaBytes, artifactsDir, attemptIndex, timeoutMs, budgetUsd) {
  const prefix = `attempt-${attemptIndex}`;
  const finalFile = path.join(artifactsDir, `${prefix}-findings.json`);
  const eventsFile = path.join(artifactsDir, `${prefix}-events.jsonl`);
  const stderrFile = path.join(artifactsDir, `${prefix}-stderr.log`);
  const startedAt = new Date().toISOString();
  const env = { ...process.env, SVC_REVIEW_KIND: reviewKind };
  const suppressSafetyEnvelope = process.env.SVC_EXTERNAL_REVIEW_FIXTURE === '1' && process.env.SVC_EXTERNAL_REVIEW_FIXTURE_DISABLE_SAFETY_ENVELOPE === '1';
  const switchingEnabled = tuple.model === 'claude-fable-5' && !suppressSafetyEnvelope;
  let args;
  let result = null;
  if (tuple.host === 'codex') {
    args = ['exec', '--skip-git-repo-check', '--sandbox', 'read-only', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--strict-config', '--model', tuple.model, '-c', `model_reasoning_effort="${tuple.effort}"`, '--output-schema', FINDINGS_SCHEMA, '--json', '--output-last-message', finalFile, '--color', 'never', '-'];
  } else if (tuple.host === 'agy') {
    const transportDir = path.join(artifactsDir, `${prefix}-agy-transport`);
    const reviewInstruction = Buffer.from(`You are the independent SVC ${reviewKind} reviewer. Work read-only. Return exactly one raw JSON object and no markdown or commentary. It must match the following schema, which SVC validates fail-closed after transport. The reviewer object must use host=agy, family=google, model=${tuple.model}, effort=${tuple.effort}.\nJSON_SCHEMA:\n${schemaBytes.toString('utf8')}\nEND_JSON_SCHEMA\n\n`);
    packageBytes = Buffer.concat([reviewInstruction, packageBytes]);
    args = [AGY_DISPATCHER, '--stdin', '--model', tuple.model, '--timeout-seconds', String(Math.max(1, Math.floor(timeoutMs / 1000))), '--artifacts-dir', transportDir];
    if (process.env.SVC_EXTERNAL_REVIEW_FIXTURE === '1') env.PATH = `${path.dirname(binary)}${path.delimiter}${env.PATH || ''}`;
    binary = process.execPath;
  } else if (tuple.host === 'claude') {
    const inlineSchema = JSON.stringify(JSON.parse(schemaBytes.toString('utf8')));
    for (const key of ['CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK', 'ANTHROPIC_MODEL', 'CLAUDE_MODEL', 'CLAUDE_CODE_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL']) delete env[key];
    args = ['--print', '--model', tuple.model, '--effort', tuple.effort, '--safe-mode', '--tools', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--permission-mode', 'plan', '--no-session-persistence', '--max-turns', '4', '--disable-slash-commands', '--no-chrome', ...(switchingEnabled ? ['--settings', '{"switchModelsOnFlag":true}'] : []), '--json-schema', inlineSchema, '--output-format', 'json', '--max-budget-usd', String(budgetUsd)];
  } else {
    args = [];
    result = { code: null, signal: null, timedOut: false, stdout: Buffer.alloc(0), stderr: Buffer.from(`no review transport for host ${tuple.host}`), spawnError: true };
  }
  if (!result) {
    try { result = await runProcess(binary, args, packageBytes, timeoutMs, env); }
    catch (error) { result = { code: null, signal: null, timedOut: false, stdout: Buffer.alloc(0), stderr: Buffer.from(error.message), spawnError: true }; }
  }
  await writeFile(eventsFile, redactDiagnostic(result.stdout.toString('utf8')), { mode: 0o600 });
  await writeFile(stderrFile, redactDiagnostic(result.stderr.toString('utf8')), { mode: 0o600 });
  let findings = null;
  let usage = {};
  let routeKind = 'exact_primary';
  let effectiveTuple = tuple;
  let modelAttestation = { level: 'none', requested_model: tuple.model, observed_models: [], evidence: null };
  let protocol = { process_invocations: 1, configured_turn_ceiling: tuple.host === 'claude' ? 4 : null, configured_budget_usd: tuple.host === 'claude' ? budgetUsd : null, reported_turns: null, stop_reason: null, terminal_reason: null, errors: [] };
  let classification = result.cancelled ? 'cancelled' : result.timedOut ? 'timeout' : result.code === 0 ? 'success' : classifyProviderFailure(result.stdout.toString('utf8'), result.stderr.toString('utf8'), false);
  if (result.spawnError) classification = 'capability';
  if (!result.cancelled && !result.timedOut && !result.spawnError) {
    try {
      if (tuple.host === 'codex') {
        if (result.code === 0) findings = JSON.parse(await readFile(finalFile, 'utf8'));
        const observedModels = [];
        for (const line of result.stdout.toString('utf8').trim().split(/\r?\n/).filter(Boolean)) {
          try {
            const event = JSON.parse(line);
            if (event.usage) usage = event.usage;
            for (const candidate of [event.model, event.response?.model, event.turn?.model]) if (typeof candidate === 'string') observedModels.push(candidate);
          } catch {}
        }
        const uniqueObservedModels = [...new Set(observedModels)];
        usage = { ...usage, observed_models: uniqueObservedModels };
        if (result.code === 0) {
          if (uniqueObservedModels.length === 0) {
            modelAttestation = {
              level: 'requested_accepted',
              requested_model: tuple.model,
              observed_models: [],
              evidence: 'exact_model_argv_plus_successful_auth_schema_exit_no_server_model_echo',
            };
          } else {
            modelAttestation = { level: 'server_observed', requested_model: tuple.model, observed_models: uniqueObservedModels, evidence: 'codex_jsonl_model_field' };
            if (!uniqueObservedModels.every((model) => model === tuple.model)) classification = 'model_mismatch';
          }
        }
      } else if (tuple.host === 'agy') {
        const outer = JSON.parse(result.stdout.toString('utf8'));
        const transportReceiptPath = path.join(artifactsDir, `${prefix}-agy-transport`, 'receipt.json');
        const transportReceiptBytes = await readFile(transportReceiptPath);
        const transportReceipt = JSON.parse(transportReceiptBytes.toString('utf8'));
        usage = { ...(outer.stats && typeof outer.stats === 'object' ? outer.stats : {}), agy_transport_receipt: transportReceiptPath, agy_transport_receipt_sha256: sha256(transportReceiptBytes) };
        if (transportReceipt.status !== 'success') {
          classification = ['authentication', 'quota', 'network', 'timeout', 'model_unavailable'].includes(transportReceipt.classification)
            ? ({ quota: 'shared_quota' }[transportReceipt.classification] || transportReceipt.classification)
            : classifyProviderFailure(result.stdout.toString('utf8'), '', false);
        } else if (transportReceipt.requested_model !== tuple.model || transportReceipt.requested_effort !== tuple.effort || transportReceipt.response_schema_sha256 !== null) {
          classification = 'model_mismatch';
        } else {
          const response = typeof outer.response === 'string'
            ? outer.response.trim()
            : typeof outer.result === 'string'
              ? outer.result.trim()
              : null;
          if (outer.structured_output && typeof outer.structured_output === 'object') findings = outer.structured_output;
          else if (response !== null) findings = JSON.parse(response.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim());
          else findings = outer;
          modelAttestation = { level: 'requested_accepted', requested_model: tuple.model, observed_models: [], evidence: 'canonical_agy_dispatch_receipt_exact_model_preset_package_schema' };
          if (findings) await writeJson(finalFile, findings);
        }
      } else {
        const outer = JSON.parse(result.stdout.toString('utf8'));
        findings = outer.structured_output;
        protocol = {
          process_invocations: 1,
          configured_turn_ceiling: 4,
          configured_budget_usd: budgetUsd,
          reported_turns: Number.isInteger(outer.num_turns) ? outer.num_turns : null,
          stop_reason: typeof outer.stop_reason === 'string' ? outer.stop_reason : null,
          terminal_reason: typeof outer.terminal_reason === 'string' ? outer.terminal_reason : null,
          errors: Array.isArray(outer.errors) ? outer.errors.filter((entry) => typeof entry === 'string').map(redactDiagnostic) : [],
        };
        usage = { modelUsage: outer.modelUsage || {}, total_cost_usd: outer.total_cost_usd ?? null, num_turns: protocol.reported_turns, configured_budget_usd: budgetUsd };
        const allObservedModels = Object.keys(outer.modelUsage || {});
        const observedModels = allObservedModels.filter((model) => !CLAUDE_AUXILIARY_MODELS.has(model));
        if (allObservedModels.length > 0) modelAttestation = { level: 'server_observed', requested_model: tuple.model, observed_models: allObservedModels, evidence: 'claude_modelUsage' };
        if (outer.subtype === 'error_max_budget_usd' || outer.terminal_reason === 'budget_exhausted') classification = 'budget_exhausted';
        else if (outer.subtype === 'error_max_turns' || outer.terminal_reason === 'max_turns') classification = 'schema_turn_budget';
        else if (result.code === 0) {
          if (!findings || observedModels.length === 0) classification = 'schema_invalid';
          else if (switchingEnabled && tuple.model === 'claude-fable-5' && observedModels.includes('claude-opus-4-8') && observedModels.every((model) => model === 'claude-fable-5' || model === 'claude-opus-4-8')) {
            routeKind = 'provider_safety_route';
            effectiveTuple = { ...tuple, model: 'claude-opus-4-8' };
            findings = { ...findings, reviewer: { host: 'claude', family: 'anthropic', model: 'claude-opus-4-8', effort: tuple.effort } };
          } else if (!observedModels.includes(tuple.model) || !observedModels.every((model) => model === tuple.model)) classification = 'model_mismatch';
        } else if (tuple.model === 'claude-fable-5' && observedModels.includes('claude-opus-4-8')) classification = 'provider_safety_failure';
        if (findings) await writeJson(finalFile, findings);
      }
    } catch {
      if (result.code === 0) classification = 'schema_invalid';
    }
  }
  const attempt = {
    index: attemptIndex,
    tuple,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    exit_code: result.code,
    classification,
    command: { binary, argv: args },
    artifacts: { events: eventsFile, stderr: stderrFile, findings: findings ? finalFile : null },
    usage,
  };
  return { attempt, findings, effectiveTuple, routeKind, protocol, switchingEnabled, modelAttestation };
}

async function main() {
  let options;
  try { options = parseArgs(process.argv.slice(2)); } catch (error) { process.stderr.write(`${usage(error.message)}\n`); process.exitCode = 2; return; }
  if (options.help) { process.stdout.write(`${usage()}\n`); return; }

  const fixture = process.env.SVC_EXTERNAL_REVIEW_FIXTURE === '1';
  const fixtureRoot = fixture ? process.env.SVC_EXTERNAL_REVIEW_FIXTURE_ROOT : null;
  let policy;
  let now;
  let selectionPath;
  try {
    policy = await loadExternalReviewPolicy();
    now = policyNow(fixture);
    selectionPath = await selectionFile(fixture, fixtureRoot);
  } catch (error) {
    process.stderr.write(`external-review: ${error.classification || 'config_invalid'}: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }
  const policyOperations = Number(options.policyStatus) + Number(Boolean(options.selectProfile)) + Number(options.clearProfileSelection);
  if (policyOperations > 1) {
    process.stderr.write(`${usage('select exactly one policy operation')}\n`);
    process.exitCode = 2;
    return;
  }
  if (options.policyStatus) {
    try {
      const external = resolveExternalReviewer({
        configPath: options.reviewerConfig,
        mode: options.reviewerMode,
        orchestrator: options.orchestrator,
        phase: options.reviewerPhase || 'plan',
        stationId: options.reviewerStation || null,
        wi: process.env.SVC_WI || null,
        workOverlayPath: process.env.SVC_DISPATCH_WORK_OVERLAY || null,
        sessionId: process.env.SVC_SESSION_ID || null,
        sessionOverrideSpec: process.env.SVC_DISPATCH_OVERRIDE || null,
        sessionOverrideRequested: process.env.SVC_DISPATCH_OVERRIDE_REQUESTED || null,
        sessionOverrideReceiptSpec: process.env.SVC_DISPATCH_OVERRIDE_RECEIPT || null,
        explicitAsk: process.env.SVC_DISPATCH_EXPLICIT_ASK === '1' || process.env.SVC_DISPATCH_EXPLICIT_ASK === 'true',
        unavailableStations: process.env.SVC_DISPATCH_UNAVAILABLE_STATIONS || '',
      });
      process.stdout.write(`${JSON.stringify({
        ok: true,
        orchestrator: options.orchestrator,
        policy_version: external.topology.schema_version || null,
        profile: `${external.topology.mode}:${external.station.id}`,
        profile_source: 'owner-config',
        tuple: external.tuple,
        fallback: null,
        effective_window: { starts_at: null, ends_at: null },
        resolved_at: now.toISOString(),
        cutover_utc: null,
        cutover_local: null,
        timezone: null,
        next_cutover: null,
        selection: { sha256: external.topology.config_sha256, expires_at: null, authority: 'repository-owner' },
      })}\n`);
    } catch (error) {
      process.stderr.write(`external-review: ${error.classification || 'config_invalid'}: ${actionableDiagnostic(error.classification || 'config_invalid')}; detail=${error.message}\n`);
      process.exitCode = 1;
    }
    return;
  }
  if (options.selectProfile) {
    try {
      const selected = await writeSelection(selectionPath, options.selectProfile, options.reason, options.expiresAt, policy, now);
      process.stdout.write(`${JSON.stringify({ ok: true, profile: selected.document.profile, profile_source: 'explicit-selection', selection_sha256: selected.selection_sha256, expires_at: selected.document.expires_at, path: selectionPath })}\n`);
    } catch (error) {
      process.stderr.write(`external-review: ${error.classification || 'profile_selection_invalid'}: ${actionableDiagnostic(error.classification || 'profile_selection_invalid')}; detail=${error.message}\n`);
      process.exitCode = 1;
    }
    return;
  }
  if (options.clearProfileSelection) {
    try {
      const removed = await clearSelection(selectionPath, options.reason);
      process.stdout.write(`${JSON.stringify({ ok: true, removed, profile_source: 'schedule', path: selectionPath })}\n`);
    } catch (error) {
      process.stderr.write(`external-review: ${error.classification || 'profile_selection_invalid'}: ${actionableDiagnostic(error.classification || 'profile_selection_invalid')}; detail=${error.message}\n`);
      process.exitCode = 1;
    }
    return;
  }
  const cacheRoot = path.resolve(process.env.SVC_EXTERNAL_REVIEW_CACHE_DIR || path.join(ROOT, '.svc/external-review-cache/v1'));
  let timeoutSeconds;
  let staleSeconds;
  let ttlDays;
  let heartbeatMs;
  let reviewBudgetUsd;
  let configError = null;
  try {
    timeoutSeconds = positiveInteger('SVC_EXTERNAL_REVIEW_TIMEOUT_SECONDS', DEFAULT_TIMEOUT_SECONDS);
    reviewBudgetUsd = positiveNumber('SVC_EXTERNAL_REVIEW_MAX_BUDGET_USD', DEFAULT_REVIEW_BUDGET_USD);
    staleSeconds = positiveInteger('SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS', DEFAULT_LOCK_STALE_SECONDS);
    ttlDays = positiveInteger('SVC_EXTERNAL_REVIEW_CACHE_TTL_DAYS', DEFAULT_CACHE_TTL_DAYS);
    heartbeatMs = fixture ? positiveInteger('SVC_EXTERNAL_REVIEW_HEARTBEAT_MS', HEARTBEAT_MS) : HEARTBEAT_MS;
    if (staleSeconds < 2 * timeoutSeconds + 60) throw new Error(`SVC_EXTERNAL_REVIEW_LOCK_STALE_SECONDS must be at least ${2 * timeoutSeconds + 60}`);
  } catch (error) {
    configError = error;
    timeoutSeconds = DEFAULT_TIMEOUT_SECONDS;
    reviewBudgetUsd = DEFAULT_REVIEW_BUDGET_USD;
    staleSeconds = DEFAULT_LOCK_STALE_SECONDS;
    ttlDays = DEFAULT_CACHE_TTL_DAYS;
    heartbeatMs = HEARTBEAT_MS;
  }
  if (options.gcCache) {
    if (configError) { process.stderr.write(`external-review: ${configError.message}\n`); process.exitCode = 2; return; }
    const removed = await gcCache(cacheRoot, ttlDays, staleSeconds, fixture);
    process.stdout.write(`${JSON.stringify({ ok: true, cache: cacheRoot, removed })}\n`);
    return;
  }

  const artifactsDir = path.resolve(options.artifactsDir || path.join(ROOT, '.svc/external-review-artifacts', randomUUID()));
  await mkdir(artifactsDir, { recursive: true, mode: 0o700 });
  const findingsPath = path.join(artifactsDir, 'findings.json');
  const receiptPath = path.join(artifactsDir, 'receipt.json');
  const packagePath = path.join(artifactsDir, 'review-package.bin');
  const startedAt = new Date().toISOString();
  const requestId = randomUUID();
  const schemaBytes = await readFile(FINDINGS_SCHEMA);
  const findingsSchema = JSON.parse(schemaBytes.toString('utf8'));
  const receiptSchema = JSON.parse(await readFile(RECEIPT_SCHEMA, 'utf8'));
  const rawPackageBytes = options.validateCapabilities ? Buffer.alloc(0) : await readStdin();
  const contextRoot = path.resolve(options.contextRoot || process.env.SVC_EXTERNAL_REVIEW_CONTEXT_ROOT || process.cwd());
  let packageBundle = { bytes: rawPackageBytes, context: { version: 1, context_root: contextRoot, base_package_sha256: sha256(rawPackageBytes), files: [] } };
  let packageError = null;
  if (!options.validateCapabilities && rawPackageBytes.length > 0) {
    try { packageBundle = await buildReviewPackage(rawPackageBytes, options.reviewKind, contextRoot); }
    catch (error) { packageError = error; }
  }
  const packageBytes = packageBundle.bytes;
  if (!options.validateCapabilities) await writeFile(packagePath, packageBytes, { mode: 0o600 });
  let resolvedPolicy = null;
  let policyError = null;
  try {
    const inferredPhase = options.reviewerPhase || (options.reviewKind === 'plan' || options.reviewKind === 'prompt-floor' || options.reviewKind === 'blind-floor' ? 'plan' : 'exec');
    if (!['plan', 'exec', 'design'].includes(inferredPhase)) throw Object.assign(new Error(`unsupported reviewer phase ${inferredPhase}`), { classification: 'input_invalid' });
    if (options.reviewKind && ['plan', 'exec'].includes(options.reviewKind) && options.reviewKind !== inferredPhase) throw Object.assign(new Error('review-kind must match reviewer phase when both are explicit'), { classification: 'input_invalid' });
    const external = resolveExternalReviewer({
      configPath: options.reviewerConfig,
      mode: options.reviewerMode,
      orchestrator: options.orchestrator,
      phase: inferredPhase,
      stationId: options.reviewerStation || null,
      wi: process.env.SVC_WI || null,
      workOverlayPath: process.env.SVC_DISPATCH_WORK_OVERLAY || null,
      sessionId: process.env.SVC_SESSION_ID || null,
      sessionOverrideSpec: process.env.SVC_DISPATCH_OVERRIDE || null,
      sessionOverrideRequested: process.env.SVC_DISPATCH_OVERRIDE_REQUESTED || null,
      sessionOverrideReceiptSpec: process.env.SVC_DISPATCH_OVERRIDE_RECEIPT || null,
      explicitAsk: process.env.SVC_DISPATCH_EXPLICIT_ASK === '1' || process.env.SVC_DISPATCH_EXPLICIT_ASK === 'true',
      unavailableStations: process.env.SVC_DISPATCH_UNAVAILABLE_STATIONS || '',
    });
    resolvedPolicy = {
      tuple: external.tuple,
      fallback: null,
      metadata: {
        version: external.topology.schema_version || 1,
        profile: `${external.topology.mode}:${external.station.id}`,
        source: 'owner-config',
        resolved_at: now.toISOString(),
        effective_window: { starts_at: null, ends_at: null },
        cutover_utc: null,
        cutover_local: null,
        timezone: null,
        selection_sha256: external.topology.config_sha256,
        selection_expires_at: null,
        selection_authority: 'repository-owner',
      },
    };
  } catch (error) {
    policyError = error;
  }
  const defaultTuple = resolvedPolicy?.tuple || null;
  const configuredFallback = resolvedPolicy?.fallback || null;
  let requestedTuple = defaultTuple;
  let override = { used: false, authority: null, source: null, path: null, expected_sha256: null, actual_sha256: null };
  let cliVersion = null;
  let capabilityArtifact = null;
  const reviewKind = options.reviewKind || (options.validateCapabilities ? 'capability-probe' : 'generic');
  let phaseGuardState = normalizePhaseGuard({ applicable: false, kind: reviewKind === 'generic' ? null : reviewKind, decision: 'not-applicable' });
  const makeReceipt = (classification, overrides = {}) => {
    const attempts = overrides.attempts || [];
    const invocationTuple = Object.prototype.hasOwnProperty.call(overrides, 'invocationTuple')
      ? overrides.invocationTuple
      : attempts.length ? attempts.at(-1).tuple : null;
    return ({
    schema_version: 2,
    launcher_version: LAUNCHER_VERSION,
    cli_version: overrides.cliVersion ?? cliVersion,
    request_id: requestId,
    review_kind: reviewKind,
    candidate_digest: options.candidateDigest ?? null,
    package_sha256: sha256(packageBytes),
    findings_schema_sha256: sha256(schemaBytes),
    findings_sha256: overrides.findingsSha256 ?? null,
    cache_key: overrides.cacheKey || '',
    fixture_mode: fixture,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    status: classification === 'success' || classification === 'cache_hit' ? 'success' : 'failure',
    classification,
    requested_tuple: requestedTuple,
    invocation_tuple: invocationTuple,
    effective_tuple: overrides.effectiveTuple ?? null,
    attempts,
    reviewer_run: {
      commands: attempts.map((attempt) => attempt.command),
      output_artifacts: attempts.flatMap((attempt) => Object.values(attempt.artifacts || {}).filter(Boolean)),
    },
    fallback: overrides.fallback || { eligible: false, used: false, reason: null },
    override,
    policy: resolvedPolicy?.metadata || { version: policy?.version || null, profile: null, source: null, resolved_at: now?.toISOString() || null, effective_window: null, cutover_utc: policy?.cutover_utc || null, cutover_local: policy?.cutover_local || null, timezone: policy?.timezone || null, selection_sha256: null, selection_expires_at: null, selection_authority: null },
    protocol: overrides.protocol || { process_invocations: attempts.length, configured_turn_ceiling: requestedTuple?.host === 'claude' ? 4 : null, configured_budget_usd: requestedTuple?.host === 'claude' ? reviewBudgetUsd : null, reported_turns: null, stop_reason: null, terminal_reason: null, errors: [] },
    route: overrides.route || { kind: classification === 'cache_hit' ? 'cache_hit' : classification === 'success' ? (resolvedPolicy?.metadata.source === 'schedule' ? 'scheduled_primary' : resolvedPolicy?.metadata.source === 'explicit-selection' ? 'explicit_profile_primary' : resolvedPolicy?.metadata.source === 'owner-config' ? 'owner_config_primary' : 'exact_primary') : 'hard_failure', switching_enabled: requestedTuple?.model === 'claude-fable-5', cli_fallback_configured: false, evidence: classification === 'cache_hit' ? 'cache_receipt_replay' : classification === 'success' ? 'requested_primary' : 'failure' },
    effective_effort: overrides.effectiveEffort || { value: overrides.effectiveTuple?.effort ?? null, provenance: overrides.effectiveTuple?.effort === 'provider-managed' ? 'provider-managed' : overrides.effectiveTuple ? 'requested' : 'none' },
    model_attestation: overrides.modelAttestation || { level: 'none', requested_model: invocationTuple?.model ?? null, observed_models: [], evidence: null },
    phase_guard: phaseGuardState,
    package_context: packageBundle.context,
    cache: overrides.cache || { disposition: 'skipped', reusable: false, entry: null },
    artifacts: { findings: overrides.hasFindings ? findingsPath : null, receipt: receiptPath, package: options.validateCapabilities ? null : packagePath, capabilities: capabilityArtifact, ...(overrides.artifacts || {}) },
    usage: overrides.usage || {},
    });
  };
  const writeReceipt = async (receipt) => {
    const errors = [...validateSchema(receipt, receiptSchema), ...validateExternalReviewReceiptSemantics(receipt)];
    if (errors.length) throw new Error(`internal receipt schema failure: ${errors.join('; ')}`);
    await writeJson(receiptPath, receipt);
    if (!fixture && receipt.status === 'success' && receipt.artifacts?.findings && receipt.artifacts?.package) issueExternalReviewProvenance({ receiptPath, packagePath: receipt.artifacts.package, findingsPath: receipt.artifacts.findings });
    if (!fixture && receipt.status === 'success') {
      relocateTree(artifactsDir, { kind: reviewKind, candidate_digest: receipt.candidate_digest || null });
    }
  };
  emergencyReceipt = async (error) => {
    const diagnostic = path.join(artifactsDir, 'internal-error.txt');
    await writeFile(diagnostic, `${redactDiagnostic(error.message)}\n`, { mode: 0o600 });
    const receipt = makeReceipt('internal_failure', { artifacts: { internal_error: diagnostic } });
    await writeReceipt(receipt);
    return receiptPath;
  };
  const finishFailure = async (classification, overrides = {}) => {
    const receipt = makeReceipt(classification, overrides);
    await writeReceipt(receipt);
    const detail = overrides.detail ? `; detail=${redactDiagnostic(overrides.detail).replace(/\s+/g, ' ')}` : '';
    process.stderr.write(`external-review: ${classification}: ${actionableDiagnostic(classification)}${detail}; receipt=${receiptPath}\n`);
    process.exitCode = 1;
  };

  if (!options.orchestrator || options.orchestrator === 'agy' || !options.artifactsDir || (!options.validateCapabilities && (!options.reviewKind || rawPackageBytes.length === 0))) {
    await finishFailure('input_invalid');
    return;
  }
  if (options.reviewerStation && !options.validateCapabilities && (!/^[a-f0-9]{64}$/.test(options.candidateDigest ?? '') || !rawPackageBytes.includes(Buffer.from(options.candidateDigest)))) {
    await finishFailure('input_invalid', { detail: 'owner-configured review requires --candidate-digest and the exact digest in the review package' });
    return;
  }
  if (options.reviewerStation && !options.validateCapabilities && options.reviewKind === 'exec') {
    try {
      const identity=candidateTreeIdentity(contextRoot);
      if (identity.candidate_digest!==options.candidateDigest) { await finishFailure('input_invalid',{detail:`candidate digest must bind current git tree ${identity.tree_hash}`}); return; }
    } catch(error) { await finishFailure('input_invalid',{detail:`cannot bind review candidate to git tree: ${error.message}`}); return; }
  }
  if (packageError) {
    await finishFailure(packageError.classification || 'input_invalid', { detail: packageError.message });
    return;
  }
  if (process.env.SVC_EXTERNAL_REVIEW_DISABLED === '1') {
    await finishFailure('disabled');
    return;
  }
  if (configError) {
    await finishFailure('config_invalid', { detail: configError.message });
    return;
  }
  if (policyError) {
    await finishFailure(policyError.classification || 'config_invalid', { detail: policyError.message });
    return;
  }
  try {
    const parsedOverride = await parseOwnerOverride(options.ownerOverrideFile, defaultTuple);
    requestedTuple = parsedOverride.tuple;
    override = parsedOverride.evidence;
  } catch (error) {
    if (error.overrideEvidence) override = error.overrideEvidence;
    await finishFailure(error.classification || 'override_invalid');
    return;
  }

  // Phase-to-review-kind guard (WI-489): refuse a paid plan review once
  // execution has begun. Runs before any lock, cache, capability probe, or
  // provider spawn so a rejection makes zero provider calls.
  if (reviewKind === 'plan') {
    if (!options.phaseBinding) {
      if (process.env.SVC_EXTERNAL_REVIEW_REQUIRE_PHASE_BINDING === '1') {
        phaseGuardState = normalizePhaseGuard({ applicable: true, kind: 'plan', decision: 'reject', reason: 'phase_binding_missing' });
        await finishFailure('phase_violation', { detail: 'plan review requires --phase-binding under SVC_EXTERNAL_REVIEW_REQUIRE_PHASE_BINDING=1' });
        return;
      }
      phaseGuardState = normalizePhaseGuard({ applicable: false, kind: 'plan', decision: 'not-applicable', reason: 'no_binding_supplied' });
    } else {
      let binding;
      try { binding = await parsePhaseBinding(options.phaseBinding); }
      catch (error) {
        phaseGuardState = normalizePhaseGuard({ applicable: true, kind: 'plan', decision: 'reject', reason: 'phase_binding_invalid' });
        await finishFailure(error.classification || 'phase_violation', { detail: error.message });
        return;
      }
      let phaseOverride;
      try { phaseOverride = await parsePhaseOverride(options.phaseOverrideFile, binding.wi); }
      catch (error) {
        phaseGuardState = normalizePhaseGuard({ applicable: true, kind: 'plan', decision: 'reject', reason: 'phase_override_invalid', wi: binding.wi, pre_execution_base: binding.pre_execution_base, plan_manifest_sha256: binding.plan_manifest_sha256, override: error.overrideEvidence || undefined });
        await finishFailure(error.classification || 'override_invalid', { detail: error.message });
        return;
      }
      const guard = await evaluatePhaseGuard(binding, contextRoot, phaseOverride);
      phaseGuardState = guard.evidence;
      if (!guard.allowed) {
        await finishFailure('phase_violation', { detail: `${guard.evidence.reason} for ${binding.wi}` });
        return;
      }
    }
  } else if (options.phaseBinding) {
    // Non-plan review: record the frozen binding as evidence; never block.
    try {
      const binding = await parsePhaseBinding(options.phaseBinding);
      phaseGuardState = normalizePhaseGuard({ applicable: true, kind: reviewKind, decision: 'allow', reason: 'frozen_binding_recorded', wi: binding.wi, pre_execution_base: binding.pre_execution_base, plan_manifest_sha256: binding.plan_manifest_sha256 });
    } catch {
      phaseGuardState = normalizePhaseGuard({ applicable: false, kind: reviewKind, decision: 'not-applicable', reason: 'binding_invalid_ignored' });
    }
  }

  const packageHash = sha256(packageBytes);
  const findingsSchemaHash = sha256(schemaBytes);
  const cacheKey = contentKey([packageBytes, canonical(requestedTuple), reviewKind, options.candidateDigest ?? '', schemaBytes, LAUNCHER_VERSION, fixture ? 'fixture:1' : 'fixture:0']);
  const entryDir = path.join(cacheRoot, cacheKey);
  const lockDir = path.join(cacheRoot, 'locks', `${cacheKey}.lock`);
  const owner = { hostname: hostname(), pid: process.pid, process_start_token: await processStartToken(), owner_token: randomUUID(), heartbeat_at: new Date().toISOString() };
  await mkdir(path.dirname(lockDir), { recursive: true, mode: 0o700 });
  let heartbeat;
  let heartbeatWork = Promise.resolve();
  try {
    await acquireLock(lockDir, staleSeconds, owner);
    heartbeat = setInterval(() => {
      heartbeatWork = heartbeatWork.then(() => refreshLock(lockDir, owner)).catch(() => {});
    }, heartbeatMs);
    heartbeat.unref();
  } catch {
    await finishFailure('lock_failure', { cacheKey, cache: { disposition: 'miss', reusable: false, entry: entryDir } });
    return;
  }

  try {
    const hit = options.validateCapabilities ? null : await cacheHit(entryDir, cacheKey, requestedTuple, reviewKind, options.candidateDigest ?? null, packageHash, findingsSchemaHash, ttlDays, findingsSchema, receiptSchema, fixture);
    if (hit) {
      await writeJson(findingsPath, hit.findings);
      const findingsSha256 = sha256(await readFile(findingsPath));
      capabilityArtifact = hit.receipt.artifacts?.capabilities || null;
      const receipt = makeReceipt('cache_hit', {
        cacheKey,
        invocationTuple: hit.receipt.invocation_tuple,
        effectiveTuple: requestedTuple,
        hasFindings: true,
        findingsSha256,
        cache: { disposition: 'hit', reusable: true, entry: entryDir },
        cliVersion: hit.receipt.cli_version,
        usage: hit.receipt.usage,
        protocol: { process_invocations: 0, configured_turn_ceiling: requestedTuple.host === 'claude' ? 4 : null, configured_budget_usd: requestedTuple.host === 'claude' ? reviewBudgetUsd : null, reported_turns: null, stop_reason: null, terminal_reason: 'cache_hit', errors: [] },
        route: { kind: 'cache_hit', switching_enabled: requestedTuple.model === 'claude-fable-5', cli_fallback_configured: false, evidence: 'cache_receipt_replay' },
        modelAttestation: { level: 'cache_replay', requested_model: requestedTuple.model, observed_models: hit.receipt.model_attestation?.observed_models || [], evidence: 'validated_content_addressed_receipt' },
      });
      await writeReceipt(receipt);
      process.stdout.write(`${JSON.stringify({ ok: true, findings: findingsPath, receipt: receiptPath, cache_disposition: 'hit' })}\n`);
      return;
    }
    if (!options.validateCapabilities) {
      try {
        const existing = await lstat(entryDir);
        await rm(entryDir, { recursive: existing.isDirectory() && !existing.isSymbolicLink(), force: true });
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }

    let binary;
    try {
      const transport = reviewTransport(requestedTuple.host);
      if (!transport) {
        await finishFailure('capability', {
          cacheKey,
          detail: `no review transport for host ${requestedTuple.host}`,
          cache: { disposition: 'miss', reusable: false, entry: entryDir },
        });
        return;
      }
      binary = await fixtureBinary(transport.env, transport.binary, fixtureRoot);
    } catch {
      await finishFailure('capability', { cacheKey, cache: { disposition: 'miss', reusable: false, entry: entryDir } });
      return;
    }
    const capabilities = await capabilityCheck(requestedTuple, binary, timeoutSeconds * 1000);
    capabilityArtifact = path.join(artifactsDir, 'capabilities.log');
    cliVersion = capabilities.version;
    await writeFile(capabilityArtifact, capabilities.output, { mode: 0o600 });
    if (capabilities.cancelled) {
      await finishFailure('cancelled', { cacheKey, cache: { disposition: 'miss', reusable: false, entry: entryDir } });
      return;
    }
    if (!capabilities.ok) {
      await writeFile(path.join(artifactsDir, 'capability-missing.txt'), `${capabilities.missing.join('\n')}\n`, { mode: 0o600 });
      await finishFailure('capability', { cacheKey, detail: `missing ${capabilities.missing.join(', ')}`, artifacts: { capability_missing: path.join(artifactsDir, 'capability-missing.txt') }, cache: { disposition: 'miss', reusable: false, entry: entryDir } });
      return;
    }
    if (options.validateCapabilities) {
      const receipt = makeReceipt('success', { cacheKey, cache: { disposition: 'skipped', reusable: false, entry: null } });
      await writeReceipt(receipt);
      process.stdout.write(`${JSON.stringify({ ok: true, receipt: receiptPath, capability: true })}\n`);
      return;
    }

    const attempts = [];
    const primaryResult = await invoke(requestedTuple, binary, packageBytes, reviewKind, schemaBytes, artifactsDir, 1, timeoutSeconds * 1000, reviewBudgetUsd);
    attempts.push(primaryResult.attempt);
    if (primaryResult.attempt.classification === 'success') {
      const validationErrors = validateFindings(primaryResult.findings, primaryResult.effectiveTuple, reviewKind, findingsSchema);
      if (validationErrors.length) {
        await writeFile(path.join(artifactsDir, 'schema-errors.txt'), `${validationErrors.join('\n')}\n`, { mode: 0o600 });
        const mismatch = validationErrors.some((error) => error.includes('does not match invoked tuple'));
        await finishFailure(mismatch ? 'model_mismatch' : 'schema_invalid', { cacheKey, attempts, modelAttestation: primaryResult.modelAttestation, cache: { disposition: 'not_reusable', reusable: false, entry: entryDir } });
        return;
      }
      await writeJson(findingsPath, primaryResult.findings);
      const findingsSha256 = sha256(await readFile(findingsPath));
      if (primaryResult.routeKind === 'provider_safety_route') {
        const receipt = makeReceipt('success', {
          cacheKey,
          effectiveTuple: primaryResult.effectiveTuple,
          attempts,
          hasFindings: true,
          findingsSha256,
          cache: { disposition: 'not_reusable', reusable: false, entry: entryDir },
          usage: primaryResult.attempt.usage,
          protocol: primaryResult.protocol,
          route: { kind: 'provider_safety_route', switching_enabled: primaryResult.switchingEnabled, cli_fallback_configured: false, evidence: 'provider_model_usage_envelope_inferred' },
          effectiveEffort: { value: null, provenance: 'provider-managed' },
          modelAttestation: primaryResult.modelAttestation,
        });
        await writeReceipt(receipt);
        process.stdout.write(`${JSON.stringify({ ok: true, findings: findingsPath, receipt: receiptPath, cache_disposition: 'not_reusable' })}\n`);
        return;
      }
      const primaryRoute = resolvedPolicy.metadata.source === 'schedule' ? 'scheduled_primary' : resolvedPolicy.metadata.source === 'explicit-selection' ? 'explicit_profile_primary' : resolvedPolicy.metadata.source === 'owner-config' ? 'owner_config_primary' : 'exact_primary';
      let receipt = makeReceipt('success', {
        cacheKey,
        effectiveTuple: primaryResult.effectiveTuple,
        attempts,
        hasFindings: true,
        findingsSha256,
        cache: { disposition: 'published', reusable: true, entry: entryDir },
        usage: primaryResult.attempt.usage,
        protocol: primaryResult.protocol,
        route: { kind: primaryRoute, switching_enabled: requestedTuple.model === 'claude-fable-5', cli_fallback_configured: false, evidence: 'requested_primary' },
        modelAttestation: primaryResult.modelAttestation,
      });
      const stagingRoot = path.join(cacheRoot, 'staging');
      const staging = path.join(stagingRoot, `${cacheKey}-${randomUUID()}`);
      let cacheDisposition = 'published';
      try {
        await mkdir(staging, { recursive: true, mode: 0o700 });
        await copyFile(findingsPath, path.join(staging, 'findings.json'));
        await writeJson(path.join(staging, 'receipt.json'), receipt);
        await mkdir(cacheRoot, { recursive: true, mode: 0o700 });
        try { await rename(staging, entryDir); } catch (error) { if (error.code !== 'EEXIST' && error.code !== 'ENOTEMPTY') throw error; await rm(staging, { recursive: true }); }
      } catch (error) {
        cacheDisposition = 'not_reusable';
        const diagnostic = path.join(artifactsDir, 'cache-publish-error.txt');
        await writeFile(diagnostic, `${error.message}\n`, { mode: 0o600 });
        await rm(staging, { recursive: true, force: true }).catch(() => {});
        receipt = makeReceipt('success', {
          cacheKey,
          effectiveTuple: requestedTuple,
          attempts,
          hasFindings: true,
          findingsSha256,
          cache: { disposition: 'not_reusable', reusable: false, entry: entryDir },
          artifacts: { cache_publish_error: diagnostic },
          usage: primaryResult.attempt.usage,
          protocol: primaryResult.protocol,
          route: { kind: primaryRoute, switching_enabled: requestedTuple.model === 'claude-fable-5', cli_fallback_configured: false, evidence: 'requested_primary' },
          modelAttestation: primaryResult.modelAttestation,
        });
      }
      await writeReceipt(receipt);
      process.stdout.write(`${JSON.stringify({ ok: true, findings: findingsPath, receipt: receiptPath, cache_disposition: cacheDisposition })}\n`);
      return;
    }

    const classification = primaryResult.attempt.classification;
    if (!configuredFallback || requestedTuple.orchestrator !== 'codex' || requestedTuple.host !== 'claude' || requestedTuple.model !== 'claude-fable-5' || !configuredFallback.eligible_after.includes(classification)) {
      await finishFailure(classification, { cacheKey, attempts, fallback: { eligible: false, used: false, reason: classification }, protocol: primaryResult.protocol, modelAttestation: primaryResult.modelAttestation, cache: { disposition: 'not_reusable', reusable: false, entry: entryDir } });
      return;
    }

    const fallbackTuple = configuredFallback.tuple;
    const primaryCostValue = primaryResult.attempt.usage?.total_cost_usd;
    const primaryReportedCost = typeof primaryCostValue === 'number' && Number.isFinite(primaryCostValue) && primaryCostValue >= 0 ? primaryCostValue : null;
    if (primaryReportedCost === null) {
      await finishFailure('budget_exhausted', { cacheKey, attempts, detail: 'primary reported no trustworthy cost, so the launcher cannot prove a safe fallback remainder', fallback: { eligible: true, used: false, reason: classification }, protocol: { ...primaryResult.protocol, configured_budget_usd: reviewBudgetUsd }, cache: { disposition: 'not_reusable', reusable: false, entry: entryDir } });
      return;
    }
    const fallbackBudgetUsd = Math.max(0, reviewBudgetUsd - primaryReportedCost);
    if (fallbackBudgetUsd <= 0) {
      await finishFailure('budget_exhausted', { cacheKey, attempts, fallback: { eligible: true, used: false, reason: classification }, protocol: { ...primaryResult.protocol, configured_budget_usd: reviewBudgetUsd }, cache: { disposition: 'not_reusable', reusable: false, entry: entryDir } });
      return;
    }
    const fallbackResult = await invoke(fallbackTuple, binary, packageBytes, reviewKind, schemaBytes, artifactsDir, 2, timeoutSeconds * 1000, fallbackBudgetUsd);
    attempts.push(fallbackResult.attempt);
    const fallbackProtocol = { ...fallbackResult.protocol, process_invocations: attempts.length, configured_budget_usd: reviewBudgetUsd };
    if (fallbackResult.attempt.classification !== 'success') {
      await finishFailure('fallback_failed', { cacheKey, attempts, invocationTuple: fallbackTuple, fallback: { eligible: true, used: true, reason: classification }, protocol: fallbackProtocol, cache: { disposition: 'not_reusable', reusable: false, entry: entryDir } });
      return;
    }
    const fallbackErrors = validateFindings(fallbackResult.findings, fallbackTuple, reviewKind, findingsSchema);
    if (fallbackErrors.length) {
      await finishFailure(fallbackErrors.some((error) => error.includes('does not match invoked tuple')) ? 'model_mismatch' : 'schema_invalid', { cacheKey, attempts, invocationTuple: fallbackTuple, fallback: { eligible: true, used: true, reason: classification }, protocol: fallbackProtocol, cache: { disposition: 'not_reusable', reusable: false, entry: entryDir } });
      return;
    }
    await writeJson(findingsPath, fallbackResult.findings);
    const findingsSha256 = sha256(await readFile(findingsPath));
    const receipt = makeReceipt('success', {
      cacheKey,
      invocationTuple: fallbackTuple,
      effectiveTuple: fallbackTuple,
      attempts,
      hasFindings: true,
      findingsSha256,
      fallback: { eligible: true, used: true, reason: classification },
      cache: { disposition: 'not_reusable', reusable: false, entry: entryDir },
      usage: fallbackResult.attempt.usage,
      protocol: fallbackProtocol,
      route: { kind: 'launcher_availability_fallback', switching_enabled: false, cli_fallback_configured: false, evidence: 'launcher_attempt_chain' },
      modelAttestation: fallbackResult.modelAttestation,
    });
    await writeReceipt(receipt);
    process.stdout.write(`${JSON.stringify({ ok: true, findings: findingsPath, receipt: receiptPath, cache_disposition: 'not_reusable' })}\n`);
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    await heartbeatWork;
    await releaseLock(lockDir, owner);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(async (error) => {
    let receipt = null;
    try { receipt = emergencyReceipt ? await emergencyReceipt(error) : null; } catch {}
    process.stderr.write(`external-review: internal failure: ${redactDiagnostic(error.message)}${receipt ? `; receipt=${receipt}` : ''}\n`);
    process.exitCode = 1;
  });
}
