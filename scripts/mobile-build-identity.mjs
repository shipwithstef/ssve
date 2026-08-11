#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const EXIT_STATE = 1;
const EXIT_INPUT = 2;
const LOCK_TIMEOUT_MS = 10_000;
const ADAPTER_OUTPUT_KEYS = new Set([
  'schema_version', 'mode', 'project', 'platform', 'application_id', 'bundle_id',
  'version_code', 'code', 'build_number', 'version_name', 'display_name', 'label',
  'artifact', 'artifact_path', 'artifact_name', 'artifact_filename', 'artifact_sha256',
  'source_sha', 'timestamp', 'branch_slug', 'branch_hash', 'status', 'allocation_status',
  'remote_floor', 'ledger_floor',
]);

class CliError extends Error {
  constructor(message, exitCode = EXIT_INPUT) {
    super(message);
    this.exitCode = exitCode;
  }
}

function usage() {
  return `Usage:
  mobile-build-identity.mjs derive --contract FILE --branch NAME --sha SHA [--now EPOCH]
  mobile-build-identity.mjs allocate-dev --contract FILE --branch NAME --sha SHA [--now EPOCH]
  mobile-build-identity.mjs allocate-release --contract FILE --remote-floor N --ledger-floor N --sha SHA --platform android|ios [--now EPOCH]
  mobile-build-identity.mjs verify --contract FILE --receipt FILE --artifact-metadata FILE`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    if (!command) throw new CliError(usage());
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  }
  const options = {};
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index];
    const value = rest[index + 1];
    if (!flag?.startsWith('--') || value === undefined || value.startsWith('--')) {
      throw new CliError(`invalid option near ${flag ?? '<end>'}\n${usage()}`);
    }
    const name = flag.slice(2);
    if (Object.hasOwn(options, name)) throw new CliError(`duplicate option: ${flag}`);
    options[name] = value;
  }
  return { command, options };
}

function requireOption(options, name) {
  const value = options[name];
  if (typeof value !== 'string' || value.length === 0) throw new CliError(`missing --${name}`);
  return value;
}

function readJson(file, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new CliError(`cannot read ${label} ${file}: ${error.message}`);
  }
}

function integer(value, label, { min = 0, max = Number.MAX_SAFE_INTEGER, exitCode = EXIT_INPUT } = {}) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new CliError(`${label} must be an integer from ${min} to ${max}`, exitCode);
  }
  return parsed;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalJson(value[key])]));
  }
  return value;
}

function output(value) {
  process.stdout.write(`${JSON.stringify(canonicalJson(value))}\n`);
}

function requireClosedObject(value, label, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CliError(`${label} must be an object`);
  const allowed = new Set([...required, ...optional]);
  const missing = required.filter((key) => !Object.hasOwn(value, key));
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (missing.length || extra.length) {
    throw new CliError(`${label} has invalid fields (missing: ${missing.join(',') || 'none'}; extra: ${extra.join(',') || 'none'})`);
  }
}

function requireClosedAdapterOutput(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CliError(`${label} must be an adapter-output object`, EXIT_STATE);
  }
  const extra = Object.keys(value).filter((key) => !ADAPTER_OUTPUT_KEYS.has(key));
  if (extra.length) throw new CliError(`${label} has undeclared adapter-output fields: ${extra.join(',')}`, EXIT_STATE);
}

function validateArtifactTemplate(template, label, development = false) {
  if (typeof template !== 'string' || template.length === 0) throw new CliError(`${label} must be a non-empty string`);
  const required = ['project', 'code', 'platform', ...(development ? ['branch_slug', 'branch_hash', 'timestamp'] : [])];
  for (const token of required) {
    if (!template.includes(`{${token}}`)) throw new CliError(`${label} must contain {${token}}`);
  }
  if (!template.includes('{source_sha}') && !template.includes('{source_short_sha}')) {
    throw new CliError(`${label} must contain {source_sha} or {source_short_sha}`);
  }
}

function loadContract(fileOption) {
  const file = path.resolve(fileOption);
  const contract = readJson(file, 'contract');
  requireClosedObject(contract, 'contract',
    ['schema_version', 'project', 'platforms', 'canonical_identity', 'development', 'release', 'commands']);
  if (contract.schema_version !== 1) throw new CliError('contract schema_version must be 1');
  if (typeof contract.project !== 'string' || contract.project.length > 64 ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(contract.project)) {
    throw new CliError('contract project must match ^[A-Za-z0-9][A-Za-z0-9._-]*$ and be at most 64 characters');
  }
  if (!Array.isArray(contract.platforms) || contract.platforms.length === 0 ||
      contract.platforms.length > 2 ||
      new Set(contract.platforms).size !== contract.platforms.length ||
      contract.platforms.some((item) => !['android', 'ios'].includes(item))) {
    throw new CliError('contract platforms must be a non-empty android/ios array');
  }
  const canonical = contract.canonical_identity;
  requireClosedObject(canonical, 'contract canonical_identity', ['application_id', 'display_name'], ['bundle_id']);
  if (typeof canonical.application_id !== 'string' || canonical.application_id.length > 223 ||
      !/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(canonical.application_id)) {
    throw new CliError('contract canonical application_id is invalid');
  }
  if (typeof canonical.display_name !== 'string' || canonical.display_name.length < 1 || canonical.display_name.length > 64) {
    throw new CliError('contract canonical display_name must contain 1 to 64 characters');
  }
  if (canonical.bundle_id !== undefined &&
      (typeof canonical.bundle_id !== 'string' || canonical.bundle_id.length > 255 ||
       !/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(canonical.bundle_id))) {
    throw new CliError('contract canonical bundle_id is invalid');
  }
  if (contract.platforms.includes('ios') && typeof canonical.bundle_id !== 'string') {
    throw new CliError('contract canonical_identity.bundle_id is required for ios');
  }
  const development = contract.development;
  requireClosedObject(development, 'contract development',
    ['id_suffix_template', 'label_template', 'artifact_template', 'state_file', 'max_code', 'signing_profile']);
  if (development.id_suffix_template !== '.wt_{branch_slug}_{branch_hash}') {
    throw new CliError('contract development.id_suffix_template must equal .wt_{branch_slug}_{branch_hash}');
  }
  if (typeof development.label_template !== 'string' || development.label_template.length === 0 ||
      !development.label_template.includes('{branch_slug}') || !development.label_template.includes('{branch_hash}')) {
    throw new CliError('contract development.label_template must contain branch slug and hash tokens');
  }
  validateArtifactTemplate(development.artifact_template, 'contract development.artifact_template', true);
  if (typeof development.state_file !== 'string' || development.state_file.length === 0) {
    throw new CliError('contract development.state_file must be a non-empty string');
  }
  if (!Number.isSafeInteger(development.max_code)) throw new CliError('contract development.max_code must be an integer');
  integer(development.max_code, 'contract development.max_code', { min: 1, max: 2_100_000_000 });
  if (!['debug', 'adhoc'].includes(development.signing_profile)) {
    throw new CliError('contract development.signing_profile must be debug or adhoc');
  }
  const release = contract.release;
  requireClosedObject(release, 'contract release',
    ['ledger', 'monotonic_floor_source', 'artifact_template'], ['max_code']);
  if (typeof release.ledger !== 'string' || release.ledger.length === 0 || path.isAbsolute(release.ledger) ||
      /^[A-Za-z]:[\\/]/.test(release.ledger) ||
      /(^|[\\/])\.\.([\\/]|$)/.test(release.ledger)) {
    throw new CliError('contract release.ledger must be a non-empty relative path without traversal');
  }
  if (!['remote', 'ledger', 'max'].includes(release.monotonic_floor_source)) {
    throw new CliError('contract release.monotonic_floor_source must be remote, ledger, or max');
  }
  validateArtifactTemplate(release.artifact_template, 'contract release.artifact_template');
  if (release.max_code !== undefined) {
    if (!Number.isSafeInteger(release.max_code)) throw new CliError('contract release.max_code must be an integer');
    integer(release.max_code, 'contract release.max_code', { min: 1, max: 2_100_000_000 });
  }
  const commandNames = ['prepare_dev', 'build_dev', 'inspect_artifact', 'allocate_release', 'build_release'];
  requireClosedObject(contract.commands, 'contract commands', commandNames);
  if (commandNames.some((name) =>
    !Array.isArray(contract.commands[name]) || contract.commands[name].length === 0 ||
    contract.commands[name].some((argument) => typeof argument !== 'string' || argument.length === 0))) {
    throw new CliError('contract commands must be non-empty JSON argv arrays');
  }
  const loaded = { contract, file, root: path.dirname(file) };
  validateStateSeparation(loaded);
  return loaded;
}

function normalizeBranch(branch) {
  if (typeof branch !== 'string' || branch.length === 0) throw new CliError('branch must not be empty');
  const slug = branch.toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18)
    .replace(/_+$/g, '') || 'branch';
  const hash = crypto.createHash('sha256').update(branch, 'utf8').digest('hex').slice(0, 8);
  return { slug, hash };
}

function validateSha(sha) {
  if (!/^[0-9a-f]{7,64}$/i.test(sha)) throw new CliError('sha must contain 7 to 64 hexadecimal characters');
  return sha.toLowerCase();
}

function compactUtc(epoch) {
  const date = new Date(epoch * 1000);
  if (!Number.isFinite(date.getTime())) throw new CliError('now is outside the supported date range');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function render(template, values) {
  return template.replace(/\{([a-z0-9_]+)\}/gi, (whole, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : whole);
}

function assertIdentity(platform, identity) {
  if (identity.length > 255) throw new CliError(`${platform} identity exceeds 255 characters`);
  if (platform === 'android') {
    if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(identity)) {
      throw new CliError(`invalid Android application id: ${identity}`);
    }
  } else if (!/^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/.test(identity)) {
    throw new CliError(`invalid iOS bundle id: ${identity}`);
  }
}

function artifactFor(platform, template, values) {
  const extension = platform === 'android' ? 'apk' : 'ipa';
  const fallback = '{project}-{branch_slug}-{branch_hash}-{timestamp}-{code}-{source_short_sha}.{extension}';
  const filename = render(template || fallback, { ...values, platform, extension });
  if (filename.includes('{') || filename.includes('}')) throw new CliError(`unresolved artifact template token: ${filename}`);
  if (path.basename(filename) !== filename || filename === '.' || filename === '..') {
    throw new CliError('artifact template must render a filename, not a path');
  }
  return filename;
}

function deriveIdentity(contract, branch, sha, epoch, code = epoch) {
  const maxCode = integer(contract.development?.max_code, 'development.max_code', { min: 1, max: 2_100_000_000 });
  if (code > maxCode) throw new CliError(`development code ${code} exceeds max_code ${maxCode}`);
  const { slug, hash } = normalizeBranch(branch);
  const suffixTemplate = contract.development?.id_suffix_template || '.wt_{branch_slug}_{branch_hash}';
  const suffix = render(suffixTemplate, { branch_slug: slug, branch_hash: hash });
  if (!/^\.wt_[a-z0-9_]+_[0-9a-f]{8}$/.test(suffix)) {
    throw new CliError(`development id suffix is invalid: ${suffix}`);
  }
  const applicationId = `${contract.canonical_identity.application_id}${suffix}`;
  assertIdentity('android', applicationId);
  const bundleId = contract.canonical_identity.bundle_id
    ? `${contract.canonical_identity.bundle_id}${suffix.replaceAll('_', '-')}`
    : undefined;
  if (bundleId) assertIdentity('ios', bundleId);
  const labelTemplate = contract.development?.label_template || '{display_name} [{branch_slug}-{branch_hash}]';
  const label = render(labelTemplate, {
    display_name: contract.canonical_identity.display_name,
    branch_slug: slug,
    branch_hash: hash,
  });
  const timestamp = compactUtc(epoch);
  const sourceSha = validateSha(sha);
  const values = {
    project: contract.project,
    branch_slug: slug,
    branch_hash: hash,
    timestamp,
    code,
    source_sha: sourceSha,
    source_short_sha: sourceSha.slice(0, 8),
  };
  const artifactTemplate = contract.development?.artifact_template;
  const artifacts = Object.fromEntries(contract.platforms.map((platform) =>
    [platform, artifactFor(platform, artifactTemplate, values)]));
  return {
    schema_version: 1,
    mode: 'dev',
    project: contract.project,
    branch,
    branch_slug: slug,
    branch_hash: hash,
    source_sha: sourceSha,
    source_short_sha: sourceSha.slice(0, 8),
    timestamp,
    epoch,
    code,
    version_code: code,
    build_number: code,
    application_id: applicationId,
    ...(bundleId ? { bundle_id: bundleId } : {}),
    canonical_display_name: contract.canonical_identity.display_name,
    display_name: label,
    label,
    version_name: `0.0.0-wt.${slug}.${hash}`,
    artifacts,
    artifact_names: artifacts,
  };
}

function controlledPath(root, configured, label) {
  if (typeof configured !== 'string' || configured.length === 0) throw new CliError(`${label} is required`);
  if (path.isAbsolute(configured)) throw new CliError(`${label} must be relative to the contract`);
  const target = path.resolve(root, configured);
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new CliError(`${label} escapes the contract directory`);
  }
  let cursor = root;
  for (const component of relative.split(path.sep)) {
    cursor = path.join(cursor, component);
    if (!fs.existsSync(cursor)) continue;
    if (fs.lstatSync(cursor).isSymbolicLink()) throw new CliError(`${label} traverses a symbolic link`);
  }
  return target;
}

function validateStateSeparation(loaded) {
  const stateConfigured = loaded.contract.development?.state_file;
  const normalizedState = typeof stateConfigured === 'string' ? stateConfigured.replaceAll('\\', '/') : '';
  if (typeof stateConfigured !== 'string' ||
      /(^|\/)\.\.(\/|$)/.test(normalizedState) ||
      !/^(?:\.svc|\.cache|build|tmp)\//.test(normalizedState)) {
    throw new CliError('development.state_file must be under .svc, .cache, build, or tmp');
  }
  const ledgerConfigured = loaded.contract.release?.ledger ?? loaded.contract.release?.ledger_file;
  const state = controlledPath(loaded.root, stateConfigured, 'development.state_file');
  const ledger = controlledPath(loaded.root, ledgerConfigured, 'release.ledger');
  const stateDomain = new Set([state, `${state}.lock`]);
  const releaseDomain = new Set([ledger, `${ledger}.lock`]);
  if ([...stateDomain].some((item) => releaseDomain.has(item))) {
    throw new CliError('development state and release ledger paths or locks collide');
  }
  if (stateDomain.has(loaded.file) || releaseDomain.has(loaded.file)) {
    throw new CliError('allocation state must not overwrite the mobile build contract');
  }
}

function ensureParent(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
}

async function acquireLock(target) {
  const lock = `${target}.lock`;
  ensureParent(lock);
  const started = Date.now();
  while (true) {
    try {
      const handle = fs.openSync(lock, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, created_at: new Date().toISOString() }));
      fs.fsyncSync(handle);
      fs.closeSync(handle);
      return () => {
        try { fs.unlinkSync(lock); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      };
    } catch (error) {
      if (error.code !== 'EEXIST') throw new CliError(`cannot acquire allocation lock: ${error.message}`, EXIT_STATE);
      if (Date.now() - started >= LOCK_TIMEOUT_MS) {
        let owner = 'owner metadata unavailable';
        try {
          const metadata = JSON.parse(fs.readFileSync(lock, 'utf8'));
          owner = `recorded pid=${metadata.pid ?? 'unknown'} created_at=${metadata.created_at ?? 'unknown'}`;
        } catch {}
        throw new CliError(
          `timed out waiting for allocation lock ${lock} (${owner}); confirm the recorded process is no longer running, preserve the lock as evidence, then remove it manually before retrying`,
          EXIT_STATE,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 10 + Math.floor(Math.random() * 15)));
    }
  }
}

function atomicWriteJson(file, value) {
  ensureParent(file);
  const temporary = `${file}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let handle;
  try {
    handle = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    fs.writeFileSync(handle, `${JSON.stringify(canonicalJson(value), null, 2)}\n`);
    fs.fsyncSync(handle);
    fs.closeSync(handle);
    handle = undefined;
    fs.renameSync(temporary, file);
    const directory = fs.openSync(path.dirname(file), fs.constants.O_RDONLY);
    fs.fsyncSync(directory);
    fs.closeSync(directory);
  } finally {
    if (handle !== undefined) fs.closeSync(handle);
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

function readOptionalJson(file, fallback, label) {
  if (!fs.existsSync(file)) return fallback;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new CliError(`${label} must be a regular file`, EXIT_STATE);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new CliError(`invalid ${label}: ${error.message}`, EXIT_STATE);
  }
}

function normalizeDevelopmentState(value, maxCode) {
  if (!value || value.schema_version !== 1 || !Object.hasOwn(value, 'last_code') ||
      Object.hasOwn(value, 'reservations') || Object.hasOwn(value, 'last_canonical')) {
    throw new CliError('development state has an unexpected shape', EXIT_STATE);
  }
  integer(value.last_code, 'development state last_code', { max: maxCode, exitCode: EXIT_STATE });
  return value;
}

async function allocateDevelopment(loaded, options) {
  const branch = requireOption(options, 'branch');
  const sha = requireOption(options, 'sha');
  const epoch = integer(options.now ?? Math.floor(Date.now() / 1000), 'now');
  const development = loaded.contract.development;
  if (!development) throw new CliError('contract development section is required');
  const maxCode = integer(development.max_code, 'development.max_code', { min: 1, max: 2_100_000_000 });
  const stateFile = controlledPath(loaded.root, development.state_file, 'development.state_file');
  const unlock = await acquireLock(stateFile);
  try {
    const state = normalizeDevelopmentState(readOptionalJson(
      stateFile, { schema_version: 1, last_code: 0 }, 'development state'), maxCode);
    const lastCode = integer(state.last_code ?? 0, 'development state last_code', { max: maxCode, exitCode: EXIT_STATE });
    const code = Math.max(epoch, lastCode + 1);
    if (code > maxCode) throw new CliError(`development code ${code} exceeds max_code ${maxCode}`);
    const identity = deriveIdentity(loaded.contract, branch, sha, epoch, code);
    atomicWriteJson(stateFile, {
      schema_version: 1,
      last_code: code,
      updated_at: new Date().toISOString(),
      last_branch_hash: identity.branch_hash,
      last_source_sha: identity.source_sha,
    });
    return { ...identity, state_file: path.relative(loaded.root, stateFile) };
  } finally {
    unlock();
  }
}

function ledgerPath(loaded) {
  const configured = loaded.contract.release?.ledger ?? loaded.contract.release?.ledger_file;
  return controlledPath(loaded.root, configured, 'release.ledger');
}

function normalizeLedger(value) {
  if (!value || value.schema_version !== 1 || !Array.isArray(value.reservations)) {
    throw new CliError('release ledger must have schema_version 1 and reservations array', EXIT_STATE);
  }
  integer(value.last_canonical, 'release ledger last_canonical', { max: 2_100_000_000, exitCode: EXIT_STATE });
  const codes = new Set();
  const activeKeys = new Set();
  for (const row of value.reservations) {
    const code = integer(row?.code, 'release ledger reservation code', { min: 1, max: 2_100_000_000, exitCode: EXIT_STATE });
    if (codes.has(code)) throw new CliError(`release ledger contains duplicate reservation code ${code}`, EXIT_STATE);
    codes.add(code);
    if (!['reserved', 'built', 'failed', 'committed'].includes(row.status) ||
        !/^[0-9a-f]{7,64}$/.test(row.source_sha ?? '') ||
        !['android', 'ios'].includes(row.platform) ||
        !/^\d{8}T\d{6}Z$/.test(row.timestamp ?? '') ||
        typeof row.artifact_filename !== 'string' || path.basename(row.artifact_filename) !== row.artifact_filename) {
      throw new CliError(`release ledger reservation ${code} has an unexpected shape`, EXIT_STATE);
    }
    integer(row.remote_floor, `release ledger reservation ${code} remote_floor`, { max: 2_100_000_000, exitCode: EXIT_STATE });
    integer(row.ledger_floor, `release ledger reservation ${code} ledger_floor`, { max: 2_100_000_000, exitCode: EXIT_STATE });
    verifyTimestamp(row.timestamp);
    if (!Number.isFinite(Date.parse(row.created_at))) {
      throw new CliError(`release ledger reservation ${code} has invalid created_at`, EXIT_STATE);
    }
    if (['built', 'committed'].includes(row.status) &&
        (typeof row.artifact_path !== 'string' || !/^[0-9a-f]{64}$/.test(row.artifact_sha256 ?? ''))) {
      throw new CliError(`release ledger reservation ${code} lacks built artifact evidence`, EXIT_STATE);
    }
    if (row.status === 'failed' && (row.artifact_path !== undefined || row.artifact_sha256 !== undefined)) {
      throw new CliError(`failed release ledger reservation ${code} must not contain artifact evidence`, EXIT_STATE);
    }
    if (['reserved', 'built', 'committed'].includes(row.status)) {
      const key = `${row.source_sha}\0${row.platform}`;
      if (activeKeys.has(key)) throw new CliError('release ledger contains duplicate active source/platform reservations', EXIT_STATE);
      activeKeys.add(key);
    }
  }
  return value;
}

function releaseOutput(loaded, file, row, lastCanonical, highestReserved, idempotent) {
  const canonical = loaded.contract.canonical_identity;
  return {
    schema_version: 1,
    mode: 'release',
    project: loaded.contract.project,
    status: row.status,
    code: row.code,
    version_code: row.code,
    build_number: row.code,
    remote_floor: row.remote_floor,
    ledger_floor: row.ledger_floor,
    last_canonical: lastCanonical,
    highest_reserved: Math.max(highestReserved, row.code),
    previous_highest_reserved: highestReserved,
    application_id: canonical.application_id,
    ...(canonical.bundle_id ? { bundle_id: canonical.bundle_id } : {}),
    display_name: canonical.display_name,
    version_name: String(row.code),
    source_sha: row.source_sha,
    platform: row.platform,
    timestamp: row.timestamp,
    artifact_filename: row.artifact_filename,
    artifact_name: row.artifact_filename,
    idempotent,
    ledger: path.relative(loaded.root, file),
  };
}

async function allocateRelease(loaded, options) {
  if (!loaded.contract.release) throw new CliError('contract release section is required');
  const remoteFloor = integer(requireOption(options, 'remote-floor'), 'remote-floor');
  const ledgerFloor = integer(requireOption(options, 'ledger-floor'), 'ledger-floor');
  const sourceSha = validateSha(requireOption(options, 'sha'));
  const platform = requireOption(options, 'platform');
  if (!loaded.contract.platforms.includes(platform)) throw new CliError(`platform ${platform} is not enabled by contract`);
  const epoch = integer(options.now ?? Math.floor(Date.now() / 1000), 'now');
  const timestamp = compactUtc(epoch);
  const file = ledgerPath(loaded);
  const unlock = await acquireLock(file);
  try {
    const ledger = normalizeLedger(readOptionalJson(file, {
      schema_version: 1,
      last_canonical: 0,
      reservations: [],
    }, 'release ledger'));
    const lastCanonical = integer(ledger.last_canonical ?? 0, 'release ledger last_canonical', { exitCode: EXIT_STATE });
    let highestReserved = 0;
    for (const reservation of ledger.reservations) highestReserved = Math.max(highestReserved, reservation.code);
    const existing = ledger.reservations.find((reservation) =>
      reservation.source_sha === sourceSha && reservation.platform === platform &&
      ['reserved', 'built', 'committed'].includes(reservation.status));
    if (existing) {
      if (existing.status === 'committed' && Math.max(remoteFloor, ledgerFloor) >= existing.code) {
        throw new CliError(
          `source/platform is already committed at ${existing.code}; the new release floor reaches that code, so a new release needs a new source SHA`,
          EXIT_STATE,
        );
      }
      if (existing.status !== 'committed' && Math.max(remoteFloor, ledgerFloor, lastCanonical) >= existing.code) {
        throw new CliError(
          `existing ${existing.status} release allocation ${existing.code} no longer clears the current floor; do not use it as proof—resolve or mark it failed where permitted, then reallocate a higher code`,
          EXIT_STATE,
        );
      }
      return releaseOutput(loaded, file, existing, lastCanonical, highestReserved, true);
    }
    const code = Math.max(remoteFloor, ledgerFloor, lastCanonical, highestReserved) + 1;
    const maxCode = integer(loaded.contract.release.max_code ?? 2_100_000_000,
      'release.max_code', { min: 1, max: 2_100_000_000 });
    if (code > maxCode) throw new CliError(`release code ${code} exceeds max_code ${maxCode}`);
    const createdAt = new Date(epoch * 1000).toISOString();
    const artifactFilename = artifactFor(platform, loaded.contract.release.artifact_template, {
      project: loaded.contract.project,
      code,
      source_sha: sourceSha,
      source_short_sha: sourceSha.slice(0, 8),
      platform,
      timestamp,
    });
    const row = {
      code,
      status: 'reserved',
      created_at: createdAt,
      remote_floor: remoteFloor,
      ledger_floor: ledgerFloor,
      source_sha: sourceSha,
      platform,
      timestamp,
      artifact_filename: artifactFilename,
    };
    ledger.reservations.push(row);
    atomicWriteJson(file, ledger);
    return releaseOutput(loaded, file, row, lastCanonical, highestReserved, false);
  } finally {
    unlock();
  }
}

function firstDefined(object, names) {
  for (const name of names) if (object[name] !== undefined) return object[name];
  return undefined;
}

function consistentValue(object, names, label, required = true) {
  const present = names.filter((name) => object[name] !== undefined);
  if (required && present.length === 0) throw new CliError(`verification missing ${label}`, EXIT_STATE);
  if (present.length === 0) return undefined;
  const value = object[present[0]];
  if (present.some((name) => object[name] !== value)) {
    throw new CliError(`verification has inconsistent ${label} aliases`, EXIT_STATE);
  }
  return value;
}

function verifyEqual(receipt, metadata, names, label = names[0], required = true) {
  const left = consistentValue(receipt, names, `receipt ${label}`, required);
  const right = consistentValue(metadata, names, `metadata ${label}`, required);
  if ((left !== undefined || right !== undefined) && left !== right) {
    throw new CliError(`verification mismatch for ${label}`, EXIT_STATE);
  }
  return left;
}

function verificationSha(value, label) {
  if (typeof value !== 'string' || !/^[0-9a-f]{7,64}$/.test(value)) {
    throw new CliError(`verification ${label} must be 7 to 64 lowercase hexadecimal characters`, EXIT_STATE);
  }
  return value;
}

function verifyTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{8}T\d{6}Z$/.test(value)) {
    throw new CliError('verification timestamp must use compact UTC YYYYMMDDTHHMMSSZ', EXIT_STATE);
  }
  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(9, 11)}:${value.slice(11, 13)}:${value.slice(13, 15)}Z`;
  const milliseconds = Date.parse(iso);
  if (!Number.isFinite(milliseconds) || compactUtc(Math.floor(milliseconds / 1000)) !== value) {
    throw new CliError('verification timestamp is not a valid UTC instant', EXIT_STATE);
  }
  return value;
}

async function inspectArtifact(loaded, artifactPath, expectedFilename, expectedDigest) {
  if (typeof artifactPath !== 'string' || artifactPath.length === 0) {
    throw new CliError('verification missing artifact_path', EXIT_STATE);
  }
  if (path.basename(artifactPath) !== expectedFilename) {
    throw new CliError(`artifact basename must exactly equal configured template output ${expectedFilename}`, EXIT_STATE);
  }
  if (typeof expectedDigest !== 'string' || !/^[0-9a-f]{64}$/.test(expectedDigest)) {
    throw new CliError('artifact_sha256 must be 64 lowercase hexadecimal characters', EXIT_STATE);
  }
  let actualPath;
  try {
    actualPath = controlledPath(loaded.root, artifactPath, 'artifact_path');
  } catch (error) {
    throw new CliError(error.message, EXIT_STATE);
  }
  let descriptor;
  try {
    const pathStat = fs.lstatSync(actualPath);
    if (pathStat.isSymbolicLink() || !pathStat.isFile()) {
      throw new Error('not a regular non-symbolic-link file');
    }
    const noFollow = fs.constants.O_NOFOLLOW ?? 0;
    descriptor = fs.openSync(actualPath, fs.constants.O_RDONLY | noFollow);
  } catch (error) {
    throw new CliError(`artifact path cannot be opened as a non-symbolic-link file: ${actualPath}`, EXIT_STATE);
  }
  const stat = fs.fstatSync(descriptor);
  if (!stat.isFile()) {
    fs.closeSync(descriptor);
    throw new CliError('artifact path must be a regular non-symbolic-link file', EXIT_STATE);
  }
  const digest = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(actualPath, { fd: descriptor, autoClose: true });
    descriptor = undefined;
    stream.on('data', (chunk) => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  }).catch((error) => {
    throw new CliError(`cannot hash artifact: ${error.message}`, EXIT_STATE);
  });
  if (descriptor !== undefined) fs.closeSync(descriptor);
  const actualDigest = digest.digest('hex');
  if (actualDigest !== expectedDigest) throw new CliError('artifact_sha256 does not match the actual artifact bytes', EXIT_STATE);
  return { actualPath, actualDigest };
}

async function transitionLedger(loaded, evidence) {
  if (evidence.mode !== 'release') return;
  const desired = evidence.status;
  const file = ledgerPath(loaded);
  const unlock = await acquireLock(file);
  try {
    const ledger = normalizeLedger(readOptionalJson(file, null, 'release ledger'));
    const row = ledger.reservations.find((item) => item.code === evidence.code);
    if (!row) throw new CliError('release allocation is absent from ledger', EXIT_STATE);
    for (const field of ['remote_floor', 'ledger_floor', 'source_sha', 'platform', 'timestamp', 'artifact_filename']) {
      if (row[field] !== evidence[field]) throw new CliError(`release ${field} differs from reserved allocation`, EXIT_STATE);
    }
    if (desired !== 'failed' &&
        ((row.artifact_path !== undefined && row.artifact_path !== evidence.artifact_path) ||
         (row.artifact_sha256 !== undefined && row.artifact_sha256 !== evidence.artifact_sha256))) {
      throw new CliError('release artifact evidence differs from prior ledger evidence', EXIT_STATE);
    }
    const allowed = { reserved: ['built', 'failed'], built: ['committed'], failed: [], committed: [] };
    if (row.status !== desired) {
      if (!allowed[row.status]?.includes(desired)) {
        throw new CliError(`invalid release transition ${row.status} -> ${desired}`, EXIT_STATE);
      }
      row.status = desired;
      row.updated_at = new Date().toISOString();
      if (desired !== 'failed') {
        row.artifact_path = evidence.artifact_path;
        row.artifact_sha256 = evidence.artifact_sha256;
      }
      if (desired === 'committed') ledger.last_canonical = Math.max(ledger.last_canonical ?? 0, row.code);
      atomicWriteJson(file, ledger);
    }
  } finally {
    unlock();
  }
}

async function verify(loaded, options) {
  const receipt = readJson(path.resolve(requireOption(options, 'receipt')), 'receipt');
  const metadata = readJson(path.resolve(requireOption(options, 'artifact-metadata')), 'artifact metadata');
  requireClosedAdapterOutput(receipt, 'receipt');
  requireClosedAdapterOutput(metadata, 'artifact metadata');
  if (!['dev', 'release'].includes(receipt.mode) || receipt.mode !== metadata.mode) {
    throw new CliError('verification mode is missing or mismatched', EXIT_STATE);
  }
  if (receipt.schema_version !== 1 || metadata.schema_version !== 1) {
    throw new CliError('verification schema_version must be 1', EXIT_STATE);
  }
  const canonical = loaded.contract.canonical_identity;
  const applicationId = verifyEqual(receipt, metadata, ['application_id']);
  const bundleId = verifyEqual(receipt, metadata, ['bundle_id'], 'bundle_id', false);
  const codeValue = verifyEqual(receipt, metadata, ['code', 'version_code', 'build_number'], 'code');
  if (typeof codeValue !== 'number') throw new CliError('verification code must be a JSON number', EXIT_STATE);
  const code = integer(codeValue,
    'verification code', { min: 1, max: receipt.mode === 'dev' ? loaded.contract.development.max_code : (loaded.contract.release.max_code ?? 2_100_000_000), exitCode: EXIT_STATE });
  const platform = verifyEqual(receipt, metadata, ['platform'], 'platform');
  if (!loaded.contract.platforms.includes(platform)) throw new CliError('verification platform is not enabled by contract', EXIT_STATE);
  const project = verifyEqual(receipt, metadata, ['project'], 'project');
  if (project !== loaded.contract.project) throw new CliError('verification project differs from contract', EXIT_STATE);
  const timestamp = verifyTimestamp(verifyEqual(receipt, metadata, ['timestamp'], 'timestamp'));
  const versionName = verifyEqual(receipt, metadata, ['version_name'], 'version_name');
  const displayName = verifyEqual(receipt, metadata, ['display_name', 'label'], 'display_name');
  const sourceSha = verificationSha(verifyEqual(receipt, metadata, ['source_sha'], 'source_sha'), 'source_sha');
  const branchHash = verifyEqual(receipt, metadata, ['branch_hash'], 'branch_hash', receipt.mode === 'dev');
  const branchSlug = verifyEqual(receipt, metadata, ['branch_slug'], 'branch_slug', receipt.mode === 'dev');
  if (receipt.mode === 'dev' && (!/^[a-z0-9_]{1,18}$/.test(branchSlug) || !/^[0-9a-f]{8}$/.test(branchHash))) {
    throw new CliError('verification branch slug or hash is invalid', EXIT_STATE);
  }
  const status = receipt.mode === 'release'
    ? verifyEqual(receipt, metadata, ['allocation_status', 'status'], 'allocation_status')
    : undefined;
  const failed = status === 'failed';
  const artifactPath = verifyEqual(receipt, metadata, ['artifact', 'artifact_path'], 'artifact_path', !failed);
  const declaredFilename = verifyEqual(receipt, metadata, ['artifact_name', 'artifact_filename'], 'artifact_filename', false);
  const artifactSha256 = verifyEqual(receipt, metadata, ['artifact_sha256'], 'artifact_sha256', !failed);
  let expectedFilename;
  if (receipt.mode === 'release') {
    if (!['built', 'failed', 'committed'].includes(status)) {
      throw new CliError('release receipt status must be built, failed, or committed', EXIT_STATE);
    }
    const remoteFloor = verifyEqual(receipt, metadata, ['remote_floor'], 'remote_floor');
    const ledgerFloor = verifyEqual(receipt, metadata, ['ledger_floor'], 'ledger_floor');
    if (typeof remoteFloor !== 'number' || typeof ledgerFloor !== 'number') {
      throw new CliError('verification remote_floor and ledger_floor must be JSON numbers', EXIT_STATE);
    }
    integer(remoteFloor, 'remote_floor', { exitCode: EXIT_STATE });
    integer(ledgerFloor, 'ledger_floor', { exitCode: EXIT_STATE });
    if (code <= Math.max(remoteFloor, ledgerFloor)) {
      throw new CliError('release code does not clear its recorded floors', EXIT_STATE);
    }
    if (versionName !== String(code)) throw new CliError('release version_name must exactly equal its code', EXIT_STATE);
    if (applicationId !== canonical.application_id ||
        (platform === 'ios' && canonical.bundle_id && bundleId !== canonical.bundle_id) ||
        displayName !== canonical.display_name) {
      throw new CliError('release receipt does not use canonical identity', EXIT_STATE);
    }
    expectedFilename = artifactFor(platform, loaded.contract.release.artifact_template, {
      project, code, source_sha: sourceSha, source_short_sha: sourceSha.slice(0, 8), platform, timestamp,
    });
    if (declaredFilename !== undefined && declaredFilename !== expectedFilename) {
      throw new CliError('release artifact_filename differs from configured template', EXIT_STATE);
    }
    const evidence = {
      mode: 'release', status, code, remote_floor: remoteFloor, ledger_floor: ledgerFloor,
      source_sha: sourceSha, platform, timestamp, artifact_filename: expectedFilename,
    };
    if (!failed) {
      await inspectArtifact(loaded, artifactPath, expectedFilename, artifactSha256);
      evidence.artifact_path = artifactPath;
      evidence.artifact_sha256 = artifactSha256;
    }
    await transitionLedger(loaded, evidence);
  } else {
    const expectedApplicationId = `${canonical.application_id}.wt_${branchSlug}_${branchHash}`;
    const expectedBundleId = canonical.bundle_id
      ? `${canonical.bundle_id}.wt-${branchSlug.replaceAll('_', '-')}-${branchHash}`
      : undefined;
    const expectedDisplayName = render(loaded.contract.development.label_template, {
      display_name: canonical.display_name, branch_slug: branchSlug, branch_hash: branchHash,
    });
    if (applicationId !== expectedApplicationId ||
        (platform === 'ios' && expectedBundleId && bundleId !== expectedBundleId) ||
        displayName !== expectedDisplayName) {
      throw new CliError('development receipt identity is not the derived non-canonical identity', EXIT_STATE);
    }
    const expectedVersionName = `0.0.0-wt.${branchSlug}.${branchHash}`;
    if (versionName !== expectedVersionName) throw new CliError('development version_name differs from derived identity', EXIT_STATE);
    expectedFilename = artifactFor(platform, loaded.contract.development.artifact_template, {
      project, branch_slug: branchSlug, branch_hash: branchHash, timestamp, code,
      source_sha: sourceSha, source_short_sha: sourceSha.slice(0, 8), platform,
    });
    if (declaredFilename !== undefined && declaredFilename !== expectedFilename) {
      throw new CliError('development artifact_filename differs from configured template', EXIT_STATE);
    }
    await inspectArtifact(loaded, artifactPath, expectedFilename, artifactSha256);
  }
  return {
    schema_version: 1, verified: true, mode: receipt.mode, ...(status ? { status } : {}),
    code, project, platform, timestamp, artifact_filename: expectedFilename,
    ...(!failed ? { artifact_path: artifactPath, artifact_sha256: artifactSha256 } : {}),
  };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const loaded = loadContract(requireOption(options, 'contract'));
  if (command === 'derive') {
    const epoch = integer(options.now ?? Math.floor(Date.now() / 1000), 'now');
    output(deriveIdentity(loaded.contract, requireOption(options, 'branch'), requireOption(options, 'sha'), epoch));
  } else if (command === 'allocate-dev') {
    output(await allocateDevelopment(loaded, options));
  } else if (command === 'allocate-release') {
    output(await allocateRelease(loaded, options));
  } else if (command === 'verify') {
    output(await verify(loaded, options));
  } else {
    throw new CliError(`unknown command: ${command}\n${usage()}`);
  }
}

main().catch((error) => {
  const exitCode = error instanceof CliError ? error.exitCode : EXIT_STATE;
  process.stderr.write(`mobile-build-identity: ${error.message}\n`);
  process.exit(exitCode);
});
