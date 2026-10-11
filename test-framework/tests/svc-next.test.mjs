// @organism-suite
// svc-next: the lane driver. No model, no network: it builds real graphs with the compiler
// and drives them through the CLI in temp dirs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileDeliveryGraph } from '../../scripts/compile-delivery-graph.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NEXT = path.join(ROOT, 'scripts', 'svc-next.mjs');
const TASK_GRAPH = path.join(ROOT, 'scripts', 'task-graph.mjs');
const ALL_TYPES = ['plan-manifest', 'review-plan', 'exec-record', 'review-exec', 'audit-implementation', 'verify-promotion'];
const EMIT = { 'plan-changeset': 'plan-manifest', 'review-plan': 'review-plan', 'execute-changeset': 'exec-record', 'review-exec': 'review-exec', 'audit-implementation': 'audit-implementation', 'verify-promotion': 'verify-promotion' };

function project(lane, { wi = 'WI-NEXT', changeType = lane === 'bugfix' ? 'bugfix' : 'feature', second } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-next-'));
  fs.mkdirSync(path.join(dir, '.svc'), { recursive: true });
  const graphOf = (id) => compileDeliveryGraph({ wi: id, lane, change_type: changeType, user_intent: 'Build what spec.md asks for' });
  const file = path.join(dir, '.svc', `lane-tasks-${wi}.json`);
  fs.writeFileSync(file, JSON.stringify(graphOf(wi), null, 2));
  if (second) fs.writeFileSync(path.join(dir, '.svc', `lane-tasks-${second}.json`), JSON.stringify(graphOf(second), null, 2));
  return { dir, file, wi };
}

function next(dir, ...args) {
  const r = spawnSync(process.execPath, [NEXT, '--root', dir, ...args], { encoding: 'utf8', env: { ...process.env, SVC_ROOT: ROOT } });
  const card = {};
  for (const line of r.stdout.split('\n').filter(Boolean)) {
    const i = line.indexOf(' ');
    card[line.slice(0, i)] = line.slice(i + 1);
  }
  return { code: r.status, card, stdout: r.stdout, stderr: r.stderr };
}

function emitReceipt(dir, wi, type, extra = {}) {
  const tree = crypto.randomBytes(20).toString('hex');
  const d = path.join(dir, '.svc', 'receipts', 'staging', tree);
  fs.mkdirSync(d, { recursive: true });
  const file = path.join(d, `${type}--${wi}.json`);
  const bytes = JSON.stringify({ receipt_type: type, schema_version: 1, wi, verdict: 'pass', timestamp: new Date().toISOString(), ...extra });
  fs.writeFileSync(file, bytes);
  return { file, sha: crypto.createHash('sha256').update(bytes).digest('hex') };
}

const readGraph = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const skillOf = (t) => t.metadata.skill;

/** Complete every stage up to (not including) `stopAt`, emitting real receipts for chain skills. */
function driveUntil(p, stopAt) {
  for (let guard = 0; guard < 40; guard += 1) {
    const r = next(p.dir);
    const skill = r.card.SKILL;
    if (skill === stopAt || r.card.STATUS === 'done') return r;
    const type = EMIT[skill];
    const receipt = type ? `${type}:${emitReceipt(p.dir, p.wi, type).sha}` : 'load-skill';
    const d = next(p.dir, '--done', skill, '--receipt', receipt);
    assert.equal(d.code, 0, `done ${skill}: ${d.stderr}`);
  }
  throw new Error('did not converge');
}

test('no lane graph exits 3 and names compile-delivery-graph.mjs; two graphs exit 3', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-next-empty-'));
  const none = next(dir);
  assert.equal(none.code, 3);
  assert.match(none.stdout + none.stderr, /compile-delivery-graph\.mjs/);
  assert.match(none.stdout, /^STATUS not_done$/m);

  const p = project('bugfix', { second: 'WI-OTHER' });
  const two = next(p.dir);
  assert.equal(two.code, 3);
  assert.match(two.stderr, /ambiguous/);
  const picked = next(p.dir, '--wi', 'WI-OTHER');
  assert.equal(picked.code, 0);
  assert.equal(picked.card.SKILL, 'diagnose-bug');
});

test('the first card follows the lane: greenfield starts at write-vision, bugfix at diagnose-bug, EMIT is -', () => {
  const g = next(project('greenfield').dir);
  assert.equal(g.code, 0);
  assert.equal(g.card.STATUS, 'next');
  assert.equal(g.card.SKILL, 'write-vision');
  assert.equal(g.card.EMIT, '-');
  assert.equal(g.card.TASK, '1');
  assert.match(g.card.CLOSEOUT, /--done write-vision --receipt load-skill$/);
  assert.deepEqual(Object.keys(g.card), ['STATUS', 'SKILL', 'TASK', 'INPUTS', 'EMIT', 'PROCESS', 'CLOSEOUT', 'MISSING']);

  const b = next(project('bugfix').dir);
  assert.equal(b.card.SKILL, 'diagnose-bug');
});

test('--done for a later stage while an earlier one is pending exits 4 and does not touch the file', () => {
  const p = project('bugfix');
  const before = fs.readFileSync(p.file);
  const r = next(p.dir, '--done', 'execute-changeset', '--receipt', 'exec-record:' + 'a'.repeat(64));
  assert.equal(r.code, 4);
  assert.match(r.stderr, /OUT_OF_ORDER/);
  assert.equal(r.card.SKILL, 'diagnose-bug', 'the card still names the real current stage');
  assert.deepEqual(fs.readFileSync(p.file), before);
});

test('--done plan-changeset with its staged receipt marks only that task; next is review-plan, never execute-changeset', () => {
  const p = project('bugfix');
  assert.equal(next(p.dir, '--done', 'diagnose-bug', '--receipt', 'load-skill').card.SKILL, 'plan-changeset');
  const before = readGraph(p.file);
  const rec = emitReceipt(p.dir, p.wi, 'plan-manifest');
  const r = next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${rec.sha}`);
  assert.equal(r.code, 0);
  assert.equal(r.card.SKILL, 'review-plan');
  assert.match(r.card.EMIT, /--type review-plan --wi WI-NEXT/);
  const after = readGraph(p.file);
  const changed = after.tasks.filter((t, i) => JSON.stringify(t) !== JSON.stringify(before.tasks[i]));
  assert.deepEqual(changed.map(skillOf), ['plan-changeset']);
  const done = changed[0];
  assert.equal(done.status, 'completed');
  assert.equal(done.chain_receipt.type, 'plan-manifest');
  assert.equal(done.chain_receipt.sha256, rec.sha);
  assert.equal(done.skill_receipt.skill, 'plan-changeset');
  // The graph stays valid for the framework's own validator.
  const v = spawnSync(process.execPath, [TASK_GRAPH, 'validate', p.file], { encoding: 'utf8' });
  assert.equal(v.status, 0, v.stderr + v.stdout);
});

test('receipt validation: bad sha, wrong WI, wrong type, load-skill for a chain skill, and placeholder bodies exit 4', () => {
  const p = project('bugfix');
  next(p.dir, '--done', 'diagnose-bug', '--receipt', 'load-skill');
  const before = fs.readFileSync(p.file);
  const good = emitReceipt(p.dir, p.wi, 'plan-manifest');
  const foreign = emitReceipt(p.dir, 'WI-FOREIGN', 'plan-manifest');
  const placeholder = emitReceipt(p.dir, p.wi, 'plan-manifest', { risk_rollback: 'FILL: rollback' });
  const bad = [
    `plan-manifest:${'0'.repeat(64)}`,
    'plan-manifest:not-a-sha',
    `review-plan:${good.sha}`,
    `plan-manifest:${foreign.sha}`,
    `plan-manifest:${placeholder.sha}`,
    'load-skill',
  ];
  for (const receipt of bad) {
    const r = next(p.dir, '--done', 'plan-changeset', '--receipt', receipt);
    assert.equal(r.code, 4, receipt);
  }
  assert.equal(next(p.dir, '--done', 'plan-changeset').code, 4, 'missing --receipt');
  assert.equal(next(p.dir, '--receipt', `plan-manifest:${good.sha}`).code, 4, '--receipt without --done');
  assert.deepEqual(fs.readFileSync(p.file), before);
  const listing = next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${'0'.repeat(64)}`);
  assert.match(listing.stderr, new RegExp(good.sha), 'the error lists the receipts that do exist');
  assert.equal(next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${good.sha}`).code, 0);
});

test('a non-chain skill must complete with load-skill, not a typed receipt', () => {
  const p = project('bugfix');
  assert.equal(next(p.dir, '--done', 'diagnose-bug', '--receipt', `plan-manifest:${'a'.repeat(64)}`).code, 4);
  const ok = next(p.dir, '--done', 'diagnose-bug', '--receipt', 'load-skill');
  assert.equal(ok.code, 0);
  assert.deepEqual(readGraph(p.file).tasks[0].chain_receipt, { type: 'load-skill' });
});

test('every task completed with no receipt files is not done: exit 5 and MISSING names all six types', () => {
  const p = project('bugfix');
  const g = readGraph(p.file);
  for (const t of g.tasks) t.status = 'completed';
  g.status = 'completed';
  fs.writeFileSync(p.file, JSON.stringify(g));
  const r = next(p.dir);
  assert.equal(r.code, 5);
  assert.equal(r.card.STATUS, 'not_done');
  assert.equal(r.card.MISSING, ALL_TYPES.join(','));
  assert.equal(r.card.SKILL, 'plan-changeset', 'the card points at the first stage whose receipt is missing');
});

test('a stale receipt (one byte flipped after a matching chain_receipt) is not done: exit 5', () => {
  const p = project('bugfix');
  const run = driveUntil(p, '__never__');
  assert.equal(run.card.STATUS, 'done');
  assert.equal(run.code, 0);
  const g = readGraph(p.file);
  const audit = g.tasks.find((t) => skillOf(t) === 'audit-implementation');
  const file = path.join(p.dir, audit.chain_receipt.path);
  const bytes = fs.readFileSync(file);
  bytes[bytes.length - 2] ^= 1; // keep it parseable JSON-ish; the digest must still mismatch
  fs.writeFileSync(file, Buffer.concat([bytes]));
  const r = next(p.dir);
  assert.equal(r.code, 5);
  assert.match(r.card.MISSING, /audit-implementation/);
  assert.equal(r.card.SKILL, 'audit-implementation');
});

test('a complete lane: six matching receipts and review-gate / land-changeset completed reach STATUS done, exit 0', () => {
  for (const lane of ['bugfix', 'greenfield']) {
    const p = project(lane);
    const seen = [];
    for (let i = 0; i < 40; i += 1) {
      const r = next(p.dir);
      if (r.card.STATUS === 'done') break;
      seen.push(r.card.SKILL);
      const type = EMIT[r.card.SKILL];
      const receipt = type ? `${type}:${emitReceipt(p.dir, p.wi, type).sha}` : 'load-skill';
      const d = next(p.dir, '--done', r.card.SKILL, '--receipt', receipt);
      assert.equal(d.code, 0, `${r.card.SKILL}: ${d.stderr}`);
    }
    const final = next(p.dir);
    assert.equal(final.code, 0, `${lane}: ${final.stderr}`);
    assert.equal(final.card.STATUS, 'done');
    assert.equal(final.card.SKILL, '-');
    assert.equal(final.card.MISSING, '-');
    for (const must of ['plan-changeset', 'review-plan', 'execute-changeset', 'review-gate', 'review-exec', 'audit-implementation', 'land-changeset', 'verify-promotion']) {
      assert.ok(seen.includes(must), `${lane} ran ${must}`);
    }
    assert.ok(seen.indexOf('review-plan') < seen.indexOf('execute-changeset'));
    assert.equal(readGraph(p.file).status, 'completed');
  }
});

test('a stale predecessor receipt blocks its successors until it is re-emitted and re-recorded', () => {
  const p = project('bugfix');
  driveUntil(p, 'review-exec');
  const g = readGraph(p.file);
  const exec = g.tasks.find((t) => skillOf(t) === 'execute-changeset');
  fs.writeFileSync(path.join(p.dir, exec.chain_receipt.path), '{"receipt_type":"exec-record","wi":"WI-NEXT","tampered":true}');
  const r = next(p.dir);
  assert.equal(r.code, 5);
  assert.equal(r.card.SKILL, 'execute-changeset');
  const fresh = emitReceipt(p.dir, p.wi, 'exec-record');
  const fixed = next(p.dir, '--done', 'execute-changeset', '--receipt', `exec-record:${fresh.sha}`);
  assert.equal(fixed.code, 0);
  assert.equal(fixed.card.SKILL, 'review-exec');
});

test('a required_process_steps entry without a digest exits 4 and the card lists it under PROCESS', () => {
  const p = project('bugfix');
  driveUntil(p, 'audit-implementation');
  const g = readGraph(p.file);
  const audit = g.tasks.find((t) => skillOf(t) === 'audit-implementation');
  audit.metadata.required_process_steps = [{ skill: 'review-security', before: 'land-changeset', evidence_required: true }];
  fs.writeFileSync(p.file, JSON.stringify(g));
  const card = next(p.dir);
  assert.equal(card.card.SKILL, 'audit-implementation');
  assert.equal(card.card.PROCESS, 'review-security');
  const rec = emitReceipt(p.dir, p.wi, 'audit-implementation');
  const before = fs.readFileSync(p.file);
  const r = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${rec.sha}`);
  assert.equal(r.code, 4);
  assert.match(r.stderr, /process receipt/);
  assert.deepEqual(fs.readFileSync(p.file), before);

  // Bind the process evidence to a digest and the stage can complete.
  const evidence = path.join(p.dir, 'security.md');
  fs.writeFileSync(evidence, 'reviewed');
  const rp = spawnSync(process.execPath, [TASK_GRAPH, 'record-process', p.file, String(audit.id), 'review-security', '--evidence', `report:${evidence}`], { encoding: 'utf8', cwd: p.dir });
  assert.equal(rp.status, 0, rp.stderr);
  const ok = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${rec.sha}`);
  assert.equal(ok.code, 0, ok.stderr);
  assert.equal(ok.card.SKILL, 'land-changeset');
});

test('INPUTS lists a skill\'s required inputs and marks a missing one ABSENT without skipping the skill', () => {
  const p = project('bugfix');
  next(p.dir, '--done', 'diagnose-bug', '--receipt', 'load-skill');
  const absent = next(p.dir);
  assert.equal(absent.card.SKILL, 'plan-changeset');
  assert.equal(absent.card.INPUTS, 'docs/specs/features/<name>.md:ABSENT');
  fs.mkdirSync(path.join(p.dir, 'docs', 'specs', 'features'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'docs', 'specs', 'features', 'thing.md'), '# spec');
  assert.equal(next(p.dir).card.INPUTS, 'docs/specs/features/<name>.md');
});

test('--template exec-record binds the staged diff; --sha prints the newest receipt as <type>:<sha256>', () => {
  const p = project('bugfix');
  const git = (...a) => spawnSync('git', a, { cwd: p.dir, encoding: 'utf8' });
  git('init', '-q');
  fs.writeFileSync(path.join(p.dir, 'app.txt'), 'hello');
  git('add', 'app.txt');
  const tpl = next(p.dir, '--template', 'exec-record', '--wi', p.wi);
  const body = JSON.parse(tpl.stdout);
  assert.equal(body.receipt_type, 'exec-record');
  assert.deepEqual(body.files_touched, ['app.txt']);
  assert.match(body.diff_hash, /^[0-9a-f]{64}$/);
  const rec = emitReceipt(p.dir, p.wi, 'exec-record');
  const sha = next(p.dir, '--wi', p.wi, '--sha', 'exec-record');
  assert.equal(sha.stdout.trim(), `exec-record:${rec.sha}`);
  const placeholder = JSON.parse(next(p.dir, '--template', 'audit-implementation', '--wi', p.wi).stdout);
  assert.match(placeholder.verdict, /^FILL: /);
});
