import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifyNative1MiB } from '../../scripts/qualify-native-planning-request.mjs';

test('installed Codex qualifies a complete 1MiB frozen request without inference', { timeout: 360000 }, async () => {
  const evidence = await qualifyNative1MiB({ writeEvidence: false });
  assert.equal(evidence.frozen_request.byteLength, 1048576);
  assert.equal(evidence.frozen_request.transport, 'native_request_capture');
  assert.equal(evidence.inspection_authority, 'qualified_native_request_inspect');
  assert.equal(evidence.capture_inference, false);
  assert.equal(evidence.usable_live, false);
  assert.equal(evidence.token_budget.fits, false);
  assert.equal(evidence.token_budget.checked, true);
  assert.equal(evidence.inference_calls, 0);
  assert.equal(evidence.exact_prompt_count, 1);
});
