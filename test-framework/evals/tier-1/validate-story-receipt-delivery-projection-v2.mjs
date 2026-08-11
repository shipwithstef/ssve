#!/usr/bin/env node

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-story-projection-'));
const receipt = path.join(temporary, 'WI-TEST-LOCAL-COMPLETE.receipts.json');
const legacy = {
  wi: 'WI-TEST-LOCAL-COMPLETE',
  story_type: 'feature',
  scope: 'locally complete sample',
  status: 'VALIDATION_MATRIX_DECLARED',
  audit: { mode: 'implementation-ready' },
  validation_runs: [{ id: 'focused-proof', verdict: 'PASS' }],
  dependency_reds: ['WI-368'],
  stages: []
};
fs.writeFileSync(receipt, `${JSON.stringify(legacy)}\n`);

const projected = spawnSync(process.execPath, ['scripts/audit-story-receipts.mjs', receipt, '--json'], { cwd: root, encoding: 'utf8' });
assert.equal(projected.status, 1, projected.stderr);
const output = JSON.parse(projected.stdout);
assert.equal(output.status, 'not-closable');
assert.equal(output.receipt_shape, 'legacy-validation-matrix');
assert.equal(output.delivery_projection.status, 'INTEGRATION_BLOCKED');
assert.equal(output.delivery_projection.locally_completed, true);
assert.equal(output.delivery_projection.proof_level, 'legacy-declared');
assert.deepEqual(output.delivery_projection.dependencies, ['WI-368']);
assert.match(output.delivery_projection.next_permitted_action, /do not restart (?:feature )?implementation/i);
assert(output.failures > 0, 'legacy proof must not synthesize canonical closure receipts');

legacy.status = 'DRAFT';
fs.writeFileSync(receipt, `${JSON.stringify(legacy)}\n`);
const draft = spawnSync(process.execPath, ['scripts/audit-story-receipts.mjs', receipt, '--json'], { cwd: root, encoding: 'utf8' });
assert.equal(draft.status, 1, draft.stderr);
assert.equal(JSON.parse(draft.stdout).delivery_projection, null, 'ordinary missing receipts must not be called locally complete');

console.log('validate-story-receipt-delivery-projection-v2: 9 passed, 0 failed');
