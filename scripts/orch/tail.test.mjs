#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logTail } from './tail.mjs';

test('details tails large logs without full-file reads and redacts credentials/control codes', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-tail-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'log');
  fs.writeFileSync(file, 'old line\n'.repeat(600000) + 'recent event\n'.repeat(300) + '\x1b[31mBearer abc\ntoken=private\nghp_secretvalue\n');
  const tail = logTail(file);
  assert.equal(tail.truncated, true); assert.ok(tail.text.length <= 65536);
  assert.ok(tail.text.split('\n').length <= 200); assert.ok(!tail.text.includes('old line'));
  assert.ok(tail.text.includes('Bearer [redacted]')); assert.ok(tail.text.includes('token=[redacted]'));
  assert.ok(!tail.text.includes('secretvalue')); assert.ok(!tail.text.includes('\x1b'));
  assert.equal(tail.path, file); assert.ok(Number.isFinite(Date.parse(tail.at)));
  fs.writeFileSync(file, 'short\n'); assert.equal(logTail(file).text, 'short\n'); assert.equal(logTail(file).truncated, false);
  assert.throws(() => logTail(root), /regular file/);
  assert.throws(() => logTail(path.join(root, 'missing')), /ENOENT/);
});
test('recorded mod fixture TS export matches its status.json source', () => {
  const root = new URL('../../mods/orchestrator-pane/tests/fixtures/', import.meta.url);
  const json = JSON.parse(fs.readFileSync(new URL('status.json', root), 'utf8'));
  const source = fs.readFileSync(new URL('status.ts', root), 'utf8');
  assert.deepEqual(JSON.parse(source.slice(source.indexOf('export const recorded = ') + 24).trim().replace(/;$/, '')), json);
});
