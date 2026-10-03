import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readUpdatesConfig, cheapDigest, inQuietHours } from './updates-config.mjs';

test('cheap digest uses only Cursor/Grok, reserves durable hourly quota and falls back on provider errors', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-summary-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const settings = readUpdatesConfig(root), file = path.join(root, 'updates-cursor.json'); const calls = [];
  const now = Date.parse('2026-10-03T12:00:00Z');
  const run = (...args) => { calls.push(args); return { status: 0, stdout: 'One\nworker running', stderr: '' }; };
  assert.equal(cheapDigest('facts', settings, {}, file, now, run), 'facts'); assert.equal(calls.length, 0);
  settings.summary.mode = 'cheap';
  assert.equal(cheapDigest('facts', settings, {}, file, now, run), 'facts · One worker running');
  assert.equal(calls[0][0], 'cursor-agent'); assert.ok(calls[0][1].includes('ask')); assert.ok(calls[0][1].includes('grok-4.7-medium'));
  assert.equal(calls[0][2].timeout, 15000); assert.ok(calls[0][2].maxBuffer <= 4096);
  assert.equal(cheapDigest('facts', settings, {}, file, now + 1, () => { calls.push('quota'); return { status: 0, stdout: 'quota exceeded' }; }), 'facts');
  cheapDigest('other goal', settings, {}, file, now + 2, run); assert.equal(calls.length, 2);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'summary-rate.json'))).calls.length, 2);
  assert.equal(fs.existsSync(file), false); // Reserving model quota cannot advance event cursor.
  cheapDigest('facts', settings, {}, file, now + 3600001, run); assert.equal(calls.length, 3);
  settings.summary.cli = 'claude'; cheapDigest('facts', settings, {}, file, now + 7200000, run); assert.equal(calls.length, 3);
  settings.summary.cli = 'cursor'; settings.summary.model = 'claude-opus'; cheapDigest('facts', settings, {}, file, now + 7200000, run); assert.equal(calls.length, 3);
  settings.summary.model = 'grok-4.7-medium'; settings.quiet_hours = { start: '11:00', end: '13:00' };
  cheapDigest('facts', settings, {}, file, now, run); assert.equal(calls.length, 3);
  assert.ok(inQuietHours(settings, now)); assert.ok(!inQuietHours(settings, now + 7200000));
});
test('malformed or unsafe hot-reloaded config cannot enable summaries', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-config-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const settings = readUpdatesConfig(root); const file = path.join(root, 'updates.json');
  for (const value of ['{bad', JSON.stringify({ ...settings, summary: { ...settings.summary, mode: 'cheap', cli: 'claude' } }), JSON.stringify({ ...settings, quiet_hours: { start: '26:00', end: '07:00' } })]) {
    fs.writeFileSync(file, value); assert.equal(readUpdatesConfig(root).summary.mode, 'none');
  }
});
