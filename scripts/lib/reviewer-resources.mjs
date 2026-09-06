// Owner policy declares access pools. Runtime observations can only restrict.
import fs from 'node:fs';
import { readJsonAtomic, updateJsonAtomic } from '../state-io.mjs';
const FAILURES = new Set(['authentication', 'model_entitlement', 'shared_quota', 'provider_overload', 'network', 'model_unavailable', 'capability']);
const date = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const fail = message => { throw new Error(`reviewer-resources: ${message}`); };

export function validateResourcePolicy(resource) {
  if (resource === undefined) return;
  if (!resource || !Array.isArray(resource.routes) || !resource.observations || typeof resource.observations !== 'object' || Array.isArray(resource.observations)) fail('routes and observations required');
  const seen = new Set(); const pools = new Set();
  for (const route of resource.routes) {
    if (![route.host, route.model, route.pool_id].every(v => typeof v === 'string' && v.trim())) fail('exact route and pool_id required');
    const key = JSON.stringify([route.host, route.model]);
    if (seen.has(key)) fail('duplicate route');
    seen.add(key); pools.add(route.pool_id);
  }
  for (const [pool, row] of Object.entries(resource.observations)) {
    if (!pools.has(pool) || !row || !['available', 'unavailable', 'unknown'].includes(row.status) || !date(row.observed_at)) fail('invalid owner observation');
    if (row.remaining !== null && row.remaining !== undefined) fail('remaining balances are unknown; omit or use null');
    if (row.retry_after != null && (!date(row.retry_after) || Date.parse(row.retry_after) <= Date.parse(row.observed_at))) fail('retry_after must follow observation');
    if (row.status === 'unavailable' && !FAILURES.has(row.classification)) fail('unavailable observation requires classified reason');
  }
}
function stateFile(configPath) { return `${configPath}.resources.json`; }
function readFailures(file) {
  const state = readJsonAtomic(file);
  if (state === null) return { schema_version: 1, failures: {} };
  if (state.schema_version !== 1 || !state.failures || typeof state.failures !== 'object' || Array.isArray(state.failures)) fail('invalid failure state');
  for (const [pool, row] of Object.entries(state.failures)) {
    if (row.pool_id !== pool || row.source !== 'invocation' || row.status !== 'unavailable' || !FAILURES.has(row.classification) || !date(row.observed_at) || !/^[a-f0-9]{64}$/.test(row.policy_sha256 || '') || !row.host || !row.model || row.remaining !== null || (row.retry_after != null && (!date(row.retry_after) || Date.parse(row.retry_after) <= Date.parse(row.observed_at)))) fail('runtime state may contain only classified invocation failures');
  }
  return state;
}
export function reviewerAvailability({ configPath, policySha256, resource, tuple, now = Date.now() }) {
  validateResourcePolicy(resource);
  if (!resource) return { allowed: true, status: 'unknown', remaining: null };
  const route = resource.routes.find(row => row.host === tuple.host && row.model === tuple.model);
  if (!route) return { allowed: false, status: 'unavailable', classification: 'capability', reason: 'route excluded by owner resource policy', remaining: null };
  const owner = resource.observations[route.pool_id];
  const automatic = readFailures(stateFile(configPath)).failures[route.pool_id];
  // A policy edit alone never clears an account failure; only a newer owner
  // observation can. Equal timestamps conservatively retain the failure.
  const row = automatic && (!owner || Date.parse(automatic.observed_at) >= Date.parse(owner.observed_at)) ? automatic : owner;
  if (!row || row.status === 'unknown') return { allowed: true, status: 'unknown', remaining: null, pool_id: route.pool_id };
  const expired = row.retry_after != null && Date.parse(row.retry_after) <= now;
  return { allowed: row.status !== 'unavailable' || expired, status: expired ? 'unknown' : row.status, classification: row.classification, pool_id: route.pool_id, remaining: null, policy_sha256: policySha256 };
}
export function recordReviewerFailure({ configPath, policySha256, resource, tuple, classification, now = Date.now(), retryAfter = null }) {
  if (!resource || !FAILURES.has(classification)) return;
  validateResourcePolicy(resource);
  const route = resource.routes.find(row => row.host === tuple.host && row.model === tuple.model);
  if (!route) return;
  const file = stateFile(configPath);
  // Validation happens again under the same state lock as the update.
  updateJsonAtomic(file, () => {
    const state = readFailures(file);
    const observed_at = new Date(now).toISOString();
    const prior = state.failures[route.pool_id];
    if (!prior || Date.parse(prior.observed_at) <= now) state.failures[route.pool_id] = {
      pool_id: route.pool_id, host: tuple.host, model: tuple.model, policy_sha256: policySha256,
      source: 'invocation', status: 'unavailable', observed_at, classification,
      retry_after: retryAfter, remaining: null,
    };
    return state;
  });
  fs.chmodSync(file, 0o600);
}
