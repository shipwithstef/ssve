import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CS = path.join(ROOT, 'scripts/company-state.mjs');
const run = (...args) => spawnSync(process.execPath, [CS, ...args], { encoding: 'utf8' });
const jsonl = (file) => fs.existsSync(file)
  ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line)) : [];

function fixture() {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cs-recovery-')), 'co');
  assert.equal(run('scaffold', '--state-dir', dir, '--name', 'testco').status, 0);
  const card = { proposed_by: 'growth-lead', title: 'cold-email batch', door: 'two-way', recommendation: 'send 50', cost_of_delay: 'high', ask: 'approve', confidence: 0.7, evidence: ['state.md'] };
  assert.equal(run('append-decision', '--state-dir', dir, '--card', JSON.stringify(card)).status, 0);
  const id = jsonl(path.join(dir, 'decisions-pending.jsonl'))[0].id;
  return { dir, id };
}

// A crash after the durable log append leaves the card in the log, still in pending, with no role-ledger row.
function crashAfterDurableVerdict({ dir, id }, verdict) {
  const [card] = jsonl(path.join(dir, 'decisions-pending.jsonl'));
  fs.appendFileSync(path.join(dir, 'decisions-log.jsonl'), JSON.stringify({ ...card, status: verdict, resolved_ts: new Date().toISOString() }) + '\n');
  assert.equal(fs.existsSync(path.join(dir, 'growth-lead/ledger.jsonl')) && jsonl(path.join(dir, 'growth-lead/ledger.jsonl')).length > 0, false);
}

test('crash after the durable verdict: a retry with a different verdict recovers the durable one', () => {
  const fx = fixture();
  crashAfterDurableVerdict(fx, 'approved');
  const retry = run('resolve', '--state-dir', fx.dir, '--id', fx.id, '--verdict', 'rejected');
  const rows = jsonl(path.join(fx.dir, 'growth-lead/ledger.jsonl')).filter((r) => r.decision_id === fx.id);
  assert.equal(rows.length, 1, 'exactly one role-ledger row');
  assert.equal(rows[0].verdict, 'approved', 'ledger materialised from the durable card, not the retry argument');
  assert.equal(jsonl(path.join(fx.dir, 'decisions-log.jsonl')).filter((d) => d.id === fx.id)[0].status, 'approved');
  assert.equal(jsonl(path.join(fx.dir, 'decisions-pending.jsonl')).length, 0, 'the interrupted move completes');
  assert.notEqual(retry.status, 0, 'a conflicting retry is reported, not silently accepted');
  assert.match(retry.stderr, /durable verdict|approved/i);
});

test('crash after the durable verdict: a matching retry converges and succeeds', () => {
  const fx = fixture();
  crashAfterDurableVerdict(fx, 'deferred');
  const retry = run('resolve', '--state-dir', fx.dir, '--id', fx.id, '--verdict', 'deferred');
  assert.equal(retry.status, 0, retry.stderr);
  const rows = jsonl(path.join(fx.dir, 'growth-lead/ledger.jsonl')).filter((r) => r.decision_id === fx.id);
  assert.deepEqual(rows.map((r) => r.verdict), ['deferred']);
});

test('a normal resolve still records the requested verdict', () => {
  const fx = fixture();
  assert.equal(run('resolve', '--state-dir', fx.dir, '--id', fx.id, '--verdict', 'rejected').status, 0);
  assert.equal(jsonl(path.join(fx.dir, 'growth-lead/ledger.jsonl'))[0].verdict, 'rejected');
});
