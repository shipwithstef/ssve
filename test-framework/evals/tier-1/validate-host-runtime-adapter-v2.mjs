#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveDeliveryProjection, loadHostIngressPolicy, normalizeHostIngress, projectLegacyViews } from '../../../scripts/svc-host-runtime-adapter-v2.mjs';

const hosts = fs.readdirSync('provision/hosts').filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
for (const host of hosts) {
  const policy = loadHostIngressPolicy(host, process.cwd());
  assert.equal(policy.canonical_journal, true); assert.equal(policy.projection_only, true);
  if (['antigravity'].includes(host)) assert.equal(policy.transport, 'cli-adapter');
}
const generations = Object.fromEntries(['protocol_generation_digest','product_generation_digest','context_generation_digest','concern_generation_digest','control_generation_digest','authority_generation_digest','layer_inventory_digest'].map((key, i) => [key, String(i + 1).repeat(64)]));
const normalized = normalizeHostIngress({ host: 'antigravity', transport: 'cli-adapter', run_id: 'r1', host_event_id: 'e1', canonical_type: 'PROJECTION_EMITTED', observed_at: '2026-08-10T00:00:00.000Z', principal: 'operator', generation_bindings: generations }, process.cwd());
assert.equal(normalized.host, 'antigravity');
assert.throws(() => normalizeHostIngress({ ...normalized, transport: 'hook-adapter' }, process.cwd()), /not allowed/);
for (const forgedType of ['TASK_ACCEPTED', 'TASK_CONSUMED', 'FINAL_REVIEW_RECORDED', 'PRODUCTION_RELEASED', 'LIVE_VERIFIED']) {
  assert.throws(() => normalizeHostIngress({ ...normalized, canonical_type: forgedType }, process.cwd()), /projection-only/);
}
const compiled = { schema_version: 2, run_id: 'r1', sequence: 1, type: 'RUN_COMPILED', task_id: null, observed_at: '2026-08-10T00:00:00.000Z', idempotency_key: 'compile:1', generation_bindings: generations, previous_event_digest: null, payload: {}, event_digest: '' };
assert.equal(typeof projectLegacyViews, 'function');
assert.deepEqual(deriveDeliveryProjection({ status: 'FROZEN', tasks: {}, blocker: { blocker_id: 'dep-1', stage: 'integration', dependency: 'WI-368 on main', next_permitted_action: 'land feature commit' } }), {
  status: 'INTEGRATION_BLOCKED', locally_completed: true, blocker: { blocker_id: 'dep-1', stage: 'integration', dependency: 'WI-368 on main', next_permitted_action: 'land feature commit' }
});
assert.equal(deriveDeliveryProjection({ status: 'FROZEN', tasks: {}, blocker: { blocker_id: 'dep-2', stage: 'production', dependency: 'WI-368 production adapter', next_permitted_action: 'run staging gates' } }).status, 'RELEASE_BLOCKED');
assert.equal(deriveDeliveryProjection({ status: 'FROZEN', tasks: {}, blocker: null }).status, 'LOCALLY_COMPLETED');
assert(hosts.length >= 8); assert(compiled.type === 'RUN_COMPILED');
console.log('PASS validate-host-runtime-adapter-v2');
