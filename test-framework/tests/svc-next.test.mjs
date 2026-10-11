// @organism-suite
// svc-next: the lane driver. No model, no network: it builds real graphs with the compiler
// and drives them through run() (and the CLI where the process boundary matters) in temp dirs.
import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileDeliveryGraph } from '../../scripts/compile-delivery-graph.mjs';
import { run, __testing, recipeFor, candidateDigestFor, planSealReasons, acceptanceReasons, launcherEvidence, resolveOrchestrator } from '../../scripts/svc-next.mjs';
import { candidateTreeIdentity } from '../../scripts/lib/external-review-provenance.mjs';
import { createExternalReviewFixture } from '../evals/tier-1/fixtures/external-review-fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
process.env.SVC_ROOT = ROOT;
const NEXT = path.join(ROOT, 'scripts', 'svc-next.mjs');
const EMIT_CLI = path.join(ROOT, 'scripts', 'emit-receipt.mjs');
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

/** In-process run with captured output. */
function next(dir, ...args) {
  const out = [];
  const err = [];
  const ow = process.stdout.write;
  const ew = process.stderr.write;
  process.stdout.write = (c) => { out.push(String(c)); return true; };
  process.stderr.write = (c) => { err.push(String(c)); return true; };
  let code;
  try { code = run(['--root', dir, ...args]); } finally { process.stdout.write = ow; process.stderr.write = ew; }
  const stdout = out.join('');
  const card = {};
  for (const line of stdout.split('\n').filter(Boolean)) {
    const i = line.indexOf(' ');
    card[line.slice(0, i)] = line.slice(i + 1);
  }
  return { code, card, stdout, stderr: err.join('') };
}

/**
 * Lane-flow tests exercise ordering and bookkeeping with fixture receipts (marked fixture_loose); the seam
 * leaves every other receipt to the real checks. It is reset after every test.
 */
function withLooseEmitter(fn) {
  __testing.emitterValidator = (root, type, body) => (body && body.fixture_loose === true ? [] : null);
  return fn();
}
afterEach(() => { __testing.emitterValidator = null; });
const useRealEmitter = () => { __testing.emitterValidator = null; };

function stagedReceipt(dir, wi, type, extra = {}) {
  const tree = crypto.randomBytes(20).toString('hex');
  const d = path.join(dir, '.svc', 'receipts', 'staging', tree);
  fs.mkdirSync(d, { recursive: true });
  const file = path.join(d, `${type}--${wi}.json`);
  const bytes = JSON.stringify({ receipt_type: type, schema_version: 1, wi, verdict: 'pass', fixture_loose: true, timestamp: new Date().toISOString(), ...extra });
  fs.writeFileSync(file, bytes);
  return { file, sha: crypto.createHash('sha256').update(bytes).digest('hex') };
}

const readGraph = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const skillOf = (t) => t.metadata.skill;

function driveUntil(p, stopAt) {
  for (let guard = 0; guard < 40; guard += 1) {
    const r = next(p.dir);
    const skill = r.card.SKILL;
    if (skill === stopAt || r.card.STATUS === 'done') return r;
    const type = EMIT[skill];
    const receipt = type ? `${type}:${stagedReceipt(p.dir, p.wi, type).sha}` : 'load-skill';
    const d = next(p.dir, '--done', skill, '--receipt', receipt);
    assert.equal(d.code, 0, `done ${skill}: ${d.stderr}`);
  }
  throw new Error('did not converge');
}

function gitProject(p) {
  const git = (...a) => spawnSync('git', a, { cwd: p.dir, encoding: 'utf8' });
  git('init', '-q');
  git('config', 'user.name', 'Fixture');
  git('config', 'user.email', 'fixture@invalid');
  fs.writeFileSync(path.join(p.dir, '.gitignore'), '.svc/\n');
  fs.writeFileSync(path.join(p.dir, 'app.txt'), 'hello\n');
  git('add', '-A');
  git('commit', '-qm', 'root');
  return git;
}

/** Emit through the REAL emit-receipt.mjs and return {file, sha}. */
function realEmit(p, type, body) {
  fs.writeFileSync(path.join(p.dir, `${type}.in.json`), JSON.stringify(body));
  const r = spawnSync(process.execPath, [EMIT_CLI, '--type', type, '--wi', p.wi, '--body', `${type}.in.json`], { cwd: p.dir, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  const bytes = fs.readFileSync(path.join(p.dir, out.mirror_path));
  return { file: path.join(p.dir, out.mirror_path), sha: crypto.createHash('sha256').update(bytes).digest('hex') };
}

// ------------------------------------------------------------------ gf-F2 §3

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
  assert.equal(next(project('bugfix').dir).card.SKILL, 'diagnose-bug');
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

test('--done plan-changeset with its receipt marks only that task; next is review-plan, never execute-changeset', () => {
  const p = project('bugfix');
  assert.equal(next(p.dir, '--done', 'diagnose-bug', '--receipt', 'load-skill').card.SKILL, 'plan-changeset');
  const before = readGraph(p.file);
  const rec = stagedReceipt(p.dir, p.wi, 'plan-manifest');
  const r = withLooseEmitter(() => next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${rec.sha}`));
  assert.equal(r.code, 0);
  assert.equal(r.card.SKILL, 'review-plan');
  assert.match(r.card.EMIT, /--recipe review-plan$/);
  const after = readGraph(p.file);
  const changed = after.tasks.filter((t, i) => JSON.stringify(t) !== JSON.stringify(before.tasks[i]));
  assert.deepEqual(changed.map(skillOf), ['plan-changeset']);
  assert.equal(changed[0].status, 'completed');
  assert.equal(changed[0].chain_receipt.type, 'plan-manifest');
  assert.equal(changed[0].chain_receipt.sha256, rec.sha);
  assert.equal(changed[0].skill_receipt.skill, 'plan-changeset');
  const v = spawnSync(process.execPath, [TASK_GRAPH, 'validate', p.file], { encoding: 'utf8' });
  assert.equal(v.status, 0, v.stderr + v.stdout);
});

test('a receipt that is not on disk, for another WI or type, a load-skill for a chain skill, or a placeholder exits 4', () => {
  const p = project('bugfix');
  next(p.dir, '--done', 'diagnose-bug', '--receipt', 'load-skill');
  const before = fs.readFileSync(p.file);
  const good = stagedReceipt(p.dir, p.wi, 'plan-manifest');
  const foreign = stagedReceipt(p.dir, 'WI-FOREIGN', 'plan-manifest');
  const placeholder = stagedReceipt(p.dir, p.wi, 'plan-manifest', { risk_rollback: 'FILL: rollback' });
  withLooseEmitter(() => {
    for (const receipt of [`plan-manifest:${'0'.repeat(64)}`, 'plan-manifest:not-a-sha', `review-plan:${good.sha}`, `plan-manifest:${foreign.sha}`, `plan-manifest:${placeholder.sha}`, 'load-skill']) {
      assert.equal(next(p.dir, '--done', 'plan-changeset', '--receipt', receipt).code, 4, receipt);
    }
    assert.equal(next(p.dir, '--done', 'plan-changeset').code, 4, 'missing --receipt');
    assert.equal(next(p.dir, '--receipt', `plan-manifest:${good.sha}`).code, 4, '--receipt without --done');
    assert.deepEqual(fs.readFileSync(p.file), before);
    const listing = next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${'0'.repeat(64)}`);
    assert.match(listing.stderr, new RegExp(good.sha), 'the error lists the receipts that do exist');
    assert.equal(next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${good.sha}`).code, 0);
  });
});

test('a non-chain skill must complete with load-skill, not a typed receipt', () => {
  const p = project('bugfix');
  assert.equal(next(p.dir, '--done', 'diagnose-bug', '--receipt', `plan-manifest:${'a'.repeat(64)}`).code, 4);
  assert.equal(next(p.dir, '--done', 'diagnose-bug', '--receipt', 'load-skill').code, 0);
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
  withLooseEmitter(() => {
    const done = driveUntil(p, '__never__');
    assert.equal(done.card.STATUS, 'done');
    assert.equal(done.code, 0);
  });
  const audit = readGraph(p.file).tasks.find((t) => skillOf(t) === 'audit-implementation');
  const file = path.join(p.dir, audit.chain_receipt.path);
  const bytes = fs.readFileSync(file);
  bytes[bytes.length - 2] ^= 1;
  fs.writeFileSync(file, bytes);
  const r = next(p.dir);
  assert.equal(r.code, 5);
  assert.match(r.card.MISSING, /audit-implementation/);
  assert.equal(r.card.SKILL, 'audit-implementation');
});

test('a complete lane reaches STATUS done, exit 0, running every mandatory stage in order (bugfix and greenfield)', () => {
  for (const lane of ['bugfix', 'greenfield']) {
    const p = project(lane);
    const seen = [];
    withLooseEmitter(() => {
      for (let i = 0; i < 40; i += 1) {
        const r = next(p.dir);
        if (r.card.STATUS === 'done') break;
        seen.push(r.card.SKILL);
        const type = EMIT[r.card.SKILL];
        const d = next(p.dir, '--done', r.card.SKILL, '--receipt', type ? `${type}:${stagedReceipt(p.dir, p.wi, type).sha}` : 'load-skill');
        assert.equal(d.code, 0, `${r.card.SKILL}: ${d.stderr}`);
      }
    });
    const final = next(p.dir);
    assert.equal(final.code, 0, `${lane}: ${final.stderr}`);
    assert.equal(final.card.STATUS, 'done');
    assert.equal(final.card.SKILL, '-');
    assert.equal(final.card.MISSING, '-');
    for (const must of ['plan-changeset', 'review-plan', 'execute-changeset', 'review-gate', 'review-exec', 'audit-implementation', 'land-changeset', 'verify-promotion']) assert.ok(seen.includes(must), `${lane} ran ${must}`);
    assert.ok(seen.indexOf('review-plan') < seen.indexOf('execute-changeset'));
    assert.equal(readGraph(p.file).status, 'completed');
  }
});

test('a stale predecessor receipt blocks everything downstream until it is re-emitted and re-recorded', () => {
  const p = project('bugfix');
  withLooseEmitter(() => {
    driveUntil(p, 'review-exec');
    const exec = readGraph(p.file).tasks.find((t) => skillOf(t) === 'execute-changeset');
    fs.writeFileSync(path.join(p.dir, exec.chain_receipt.path), '{"receipt_type":"exec-record","wi":"WI-NEXT","tampered":true}');
    const r = next(p.dir);
    assert.equal(r.code, 5);
    assert.equal(r.card.SKILL, 'execute-changeset');
    const fixed = next(p.dir, '--done', 'execute-changeset', '--receipt', `exec-record:${stagedReceipt(p.dir, p.wi, 'exec-record').sha}`);
    assert.equal(fixed.code, 0);
    assert.equal(fixed.card.SKILL, 'review-exec');
  });
});

test('a required_process_steps entry without a digest exits 4 and the card lists it under PROCESS', () => {
  const p = project('bugfix');
  withLooseEmitter(() => {
    driveUntil(p, 'audit-implementation');
    const g = readGraph(p.file);
    const audit = g.tasks.find((t) => skillOf(t) === 'audit-implementation');
    audit.metadata.required_process_steps = [{ skill: 'review-security', before: 'land-changeset', evidence_required: true }];
    fs.writeFileSync(p.file, JSON.stringify(g));
    const card = next(p.dir);
    assert.equal(card.card.SKILL, 'audit-implementation');
    assert.equal(card.card.PROCESS, 'review-security');
    const rec = stagedReceipt(p.dir, p.wi, 'audit-implementation');
    const before = fs.readFileSync(p.file);
    const r = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${rec.sha}`);
    assert.equal(r.code, 4);
    assert.match(r.stderr, /process receipt/);
    assert.deepEqual(fs.readFileSync(p.file), before);
    const evidence = path.join(p.dir, 'security.md');
    fs.writeFileSync(evidence, 'reviewed');
    const rp = spawnSync(process.execPath, [TASK_GRAPH, 'record-process', p.file, String(audit.id), 'review-security', '--evidence', `report:${evidence}`], { encoding: 'utf8', cwd: p.dir });
    assert.equal(rp.status, 0, rp.stderr);
    const ok = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${rec.sha}`);
    assert.equal(ok.code, 0, ok.stderr);
    assert.equal(ok.card.SKILL, 'land-changeset');
  });
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
  const git = gitProject(p);
  fs.writeFileSync(path.join(p.dir, 'more.txt'), 'x');
  git('add', 'more.txt');
  const body = JSON.parse(next(p.dir, '--template', 'exec-record', '--wi', p.wi).stdout);
  assert.deepEqual(body.files_touched, ['more.txt']);
  assert.match(body.diff_hash, /^[0-9a-f]{64}$/);
  const rec = stagedReceipt(p.dir, p.wi, 'exec-record');
  assert.equal(next(p.dir, '--wi', p.wi, '--sha', 'exec-record').stdout.trim(), `exec-record:${rec.sha}`);
  assert.match(JSON.parse(next(p.dir, '--template', 'audit-implementation', '--wi', p.wi).stdout).verdict, /^FILL: /);
});

// ------------------------------------------------- codex review round 1 findings

test('R1 [schema/verdict]: identity-only JSON and a fail verdict never complete a stage; the emitter\'s own receipt does', () => {
  const p = project('bugfix');
  gitProject(p);
  withLooseEmitter(() => driveUntil(p, 'audit-implementation'));
  const before = fs.readFileSync(p.file);

  const identityOnly = stagedReceipt(p.dir, p.wi, 'audit-implementation', { verdict: undefined });
  const a = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${identityOnly.sha}`);
  assert.equal(a.code, 4);
  assert.match(a.stderr, /not a receipt emit-receipt\.mjs would accept/);

  const failed = realEmit(p, 'audit-implementation', { verdict: 'fail', findings: [{ id: 'F1', severity: 'critical' }] });
  const b = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${failed.sha}`);
  assert.equal(b.code, 4);
  assert.match(b.stderr, /not an allowed passing verdict/);
  assert.deepEqual(fs.readFileSync(p.file), before);

});

test('R1 [real receipts]: a receipt written by the real emitter completes audit-implementation and exec-record', () => {
  const p = project('bugfix');
  gitProject(p);
  withLooseEmitter(() => driveUntil(p, 'execute-changeset'));
  fs.writeFileSync(path.join(p.dir, 'work.txt'), 'x');
  spawnSync('git', ['add', '-A'], { cwd: p.dir });
  const tpl = JSON.parse(next(p.dir, '--template', 'exec-record', '--wi', p.wi).stdout);
  const exec = realEmit(p, 'exec-record', tpl);
  const a = next(p.dir, '--done', 'execute-changeset', '--receipt', `exec-record:${exec.sha}`);
  assert.equal(a.code, 0, a.stderr);
  withLooseEmitter(() => driveUntil(p, 'audit-implementation'));
  const passed = realEmit(p, 'audit-implementation', { verdict: 'pass', findings: [] });
  const c = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${passed.sha}`);
  assert.equal(c.code, 0, c.stderr);
  assert.equal(c.card.SKILL, 'land-changeset');
});

test('R1 [verdict]: a failing verdict is refused for every verdict-bearing type, even when the schema check is loose', () => {
  for (const [lane, stage, type] of [['bugfix', 'review-plan', 'review-plan'], ['bugfix', 'review-exec', 'review-exec'], ['bugfix', 'verify-promotion', 'verify-promotion']]) {
    const p = project(lane);
    withLooseEmitter(() => {
      driveUntil(p, stage);
      for (const verdict of ['fail', 'FAIL', 'blocked', '']) {
        const rec = stagedReceipt(p.dir, p.wi, type, { verdict });
        assert.equal(next(p.dir, '--done', stage, '--receipt', `${type}:${rec.sha}`).code, 4, `${type} ${verdict}`);
      }
      const ok = stagedReceipt(p.dir, p.wi, type, { verdict: type === 'verify-promotion' ? 'pass' : 'pass-with-acks' });
      assert.equal(next(p.dir, '--done', stage, '--receipt', `${type}:${ok.sha}`).code, 0);
    });
  }
});

test('R3 [active blockers]: an in_progress task with unfinished blockers is not the current stage and cannot be completed', () => {
  const p = project('bugfix');
  const g = readGraph(p.file);
  const plan = g.tasks.find((t) => skillOf(t) === 'plan-changeset');
  plan.status = 'in_progress';
  fs.writeFileSync(p.file, JSON.stringify(g));
  const card = next(p.dir);
  assert.equal(card.card.SKILL, 'diagnose-bug', 'the unfinished blocker comes first');
  const rec = stagedReceipt(p.dir, p.wi, 'plan-manifest');
  const before = fs.readFileSync(p.file);
  const r = withLooseEmitter(() => next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${rec.sha}`));
  assert.equal(r.code, 4);
  assert.match(r.stderr, /OUT_OF_ORDER/);
  assert.deepEqual(fs.readFileSync(p.file), before);
  assert.equal(readGraph(p.file).tasks.find((t) => skillOf(t) === 'diagnose-bug').status, 'pending');
});

test('R4 [process receipts]: deleting or changing process evidence after completion reopens the lane', () => {
  const p = project('bugfix');
  withLooseEmitter(() => {
    driveUntil(p, 'audit-implementation');
    const g = readGraph(p.file);
    const audit = g.tasks.find((t) => skillOf(t) === 'audit-implementation');
    audit.metadata.required_process_steps = [{ skill: 'review-security', before: 'land-changeset', evidence_required: true }];
    fs.writeFileSync(p.file, JSON.stringify(g));
    const evidence = path.join(p.dir, 'security.md');
    fs.writeFileSync(evidence, 'reviewed');
    assert.equal(spawnSync(process.execPath, [TASK_GRAPH, 'record-process', p.file, String(audit.id), 'review-security', '--evidence', `report:${evidence}`], { encoding: 'utf8', cwd: p.dir }).status, 0);
    const rec = stagedReceipt(p.dir, p.wi, 'audit-implementation');
    assert.equal(next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${rec.sha}`).code, 0);
    assert.equal(driveUntil(p, '__never__').card.STATUS, 'done');
    for (const damage of [() => fs.rmSync(evidence), () => fs.writeFileSync(evidence, 'rewritten after the fact')]) {
      fs.writeFileSync(evidence, 'reviewed');
      assert.equal(next(p.dir).code, 0);
      damage();
      const r = next(p.dir);
      assert.equal(r.code, 5, 'STATUS done is withdrawn');
      assert.equal(r.card.STATUS, 'not_done');
      assert.match(r.card.MISSING, /process:review-security/);
      assert.equal(r.card.SKILL, 'audit-implementation');
      assert.equal(r.card.PROCESS, 'review-security');
    }
  });
});

test('R6 [closeout keeps WI and root]: following a card chosen with --wi works while several graphs are open', () => {
  const p = project('bugfix', { second: 'WI-OTHER' });
  const card = next(p.dir, '--wi', 'WI-OTHER');
  assert.match(card.card.CLOSEOUT, /--root \S+ --wi WI-OTHER --done diagnose-bug --receipt load-skill$/);
  const command = card.card.CLOSEOUT.replace('"$SVC_ROOT"', ROOT);
  const ran = spawnSync('bash', ['-c', command.replace('--root ' + p.dir, '--root ' + p.dir)], { encoding: 'utf8', env: { ...process.env, SVC_ROOT: ROOT } });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /^SKILL plan-changeset$/m);
  assert.equal(readGraph(path.join(p.dir, '.svc', 'lane-tasks-WI-OTHER.json')).tasks[0].status, 'completed');
  assert.equal(readGraph(p.file).tasks[0].status, 'pending', 'the other graph is untouched');
  // A project root that is not "." and has a space survives quoting.
  const spaced = fs.mkdtempSync(path.join(os.tmpdir(), 'svc next '));
  fs.cpSync(p.dir, spaced, { recursive: true });
  const c2 = next(spaced, '--wi', 'WI-OTHER');
  assert.match(c2.card.CLOSEOUT, /--root '.* .*' --wi WI-OTHER /);
});

test('R7 [symlinked install]: invoking the script through a symlink still prints the card', () => {
  const p = project('bugfix');
  const link = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'svc-next-link-')), 'svc-next.mjs');
  fs.symlinkSync(NEXT, link);
  const r = spawnSync(process.execPath, [link, '--root', p.dir], { encoding: 'utf8', env: { ...process.env, SVC_ROOT: ROOT } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^STATUS next$/m);
  assert.match(r.stdout, /^SKILL diagnose-bug$/m);
});

test('R5 [EMIT/recipes]: plan and review stages print a command sequence whose steps name real scripts and flags', () => {
  const p = project('bugfix');
  const ctx = { rootArg: p.dir, wi: p.wi };
  const plan = recipeFor('plan-manifest', ctx).join('\n');
  for (const script of ['prepare-plan-handoff.mjs', 'emit-receipt.mjs', 'svc-next.mjs']) assert.ok(fs.existsSync(path.join(ROOT, 'scripts', script)), script);
  assert.match(plan, /prepare-plan-handoff\.mjs --manifest docs\/plans\/WI-NEXT\/manifest\.md --write --out \.svc\/external-review-artifacts\/plan-handoff\/body\.json/);
  assert.match(plan, /--seal-after-review <review_ref>/);
  assert.ok(plan.indexOf('--build-review plan') > 0 && plan.indexOf('--build-review plan') < plan.indexOf('--seal-after-review'), 'the stored review object is built before the seal');
  assert.match(plan, /--build-review plan --summary \S+ --out \S+ --store/);
  assert.match(plan, /emit-receipt\.mjs --type plan-manifest --wi WI-NEXT --body \S+ --manifest \S+ --seal-ref/);
  assert.match(plan, /--sha plan-manifest/);
  const review = recipeFor('review-exec', ctx).join('\n');
  assert.match(review, /emit-receipt\.mjs --type review-exec --wi WI-NEXT --sha "\$\(git rev-parse HEAD\)" --body \.svc\/review-exec\.body\.json/);
  // The card's EMIT line for those stages is the command that prints the sequence, and it runs.
  withLooseEmitter(() => driveUntil(p, 'plan-changeset'));
  const emit = next(p.dir).card.EMIT;
  assert.match(emit, /svc-next\.mjs" --root \S+ --wi WI-NEXT --recipe plan-manifest$/);
  const ran = spawnSync('bash', ['-c', emit], { encoding: 'utf8', env: { ...process.env, SVC_ROOT: ROOT } });
  assert.equal(ran.status, 0, ran.stderr);
  assert.match(ran.stdout, /prepare-plan-handoff\.mjs/);
  // The one-line forms keep a placeholder guard: an unfilled body is never emitted.
  const audit = recipeFor('audit-implementation', ctx).join('\n');
  assert.match(audit, /grep -q 'FILL: '/);
});

test('R5 [templates]: the exec-record template passes the real emitter; unfilled templates are refused by the guard', () => {
  const p = project('bugfix');
  gitProject(p);
  fs.writeFileSync(path.join(p.dir, 'work.txt'), 'x');
  spawnSync('git', ['add', '-A'], { cwd: p.dir });
  const body = JSON.parse(next(p.dir, '--template', 'exec-record', '--wi', p.wi).stdout);
  const rec = realEmit(p, 'exec-record', body);
  const validated = next(p.dir, '--wi', p.wi, '--sha', 'exec-record');
  assert.equal(validated.stdout.trim(), `exec-record:${rec.sha}`);
  for (const type of ['plan-manifest', 'review-plan', 'review-exec', 'audit-implementation', 'verify-promotion']) {
    const tpl = next(p.dir, '--template', type, '--wi', p.wi).stdout;
    assert.match(tpl, /FILL: /, `${type} template is not emit-ready until filled`);
  }
  // A body that still has placeholders is refused even if it would otherwise parse.
  withLooseEmitter(() => {
    driveUntil(p, 'audit-implementation');
    const rec2 = stagedReceipt(p.dir, p.wi, 'audit-implementation', { note: 'FILL: x' });
    assert.equal(next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${rec2.sha}`).code, 4);
  });
});

test('cross-family only: a same-host or self review receipt never completes a review stage, and no recipe offers one', () => {
  const p = project('bugfix');
  withLooseEmitter(() => {
    driveUntil(p, 'review-plan');
    for (const extra of [
      { adversarial_review: { route: 'same_host_fresh_subagent', different_family: false } },
      { reviewer_evidence: { mode: 'same_host_fresh_subagent' } },
      { adversarial_review: { different_family: false } },
    ]) {
      const rec = stagedReceipt(p.dir, p.wi, 'review-plan', extra);
      const r = next(p.dir, '--done', 'review-plan', '--receipt', `review-plan:${rec.sha}`);
      assert.equal(r.code, 4, JSON.stringify(extra));
      assert.match(r.stderr, /cross-family/);
    }
  });
  for (const type of ['plan-manifest', 'review-plan', 'review-exec']) {
    const text = recipeFor(type, { rootArg: '.', wi: p.wi }).join('\n');
    assert.doesNotMatch(text, /in-host|same[-_ ]host(?! or self)|organism\/w-reviews/i, type);
    assert.match(text, /never substitute a same-host or self review/);
  }
  assert.match(recipeFor('plan-manifest', { rootArg: '.', wi: p.wi }).join('\n'), /two-box-plan\.mjs --input/);
  assert.match(recipeFor('review-plan', { rootArg: '.', wi: p.wi }).join('\n'), /review-plan-codex\.sh/);
  assert.match(recipeFor('review-exec', { rootArg: '.', wi: p.wi }).join('\n'), /run-external-review\.mjs --orchestrator "\$\(node "\$SVC_ROOT"\/scripts\/svc-next\.mjs --root \. --wi WI-NEXT --orchestrator-id\)" --review-kind exec/);
});

// ------------------------------------------------------------ round 2 findings

function stagedBody(dir, type, body) {
  const d = path.join(dir, '.svc', 'receipts', 'staging', crypto.randomBytes(20).toString('hex'));
  fs.mkdirSync(d, { recursive: true });
  const file = path.join(d, `${type}--${body.wi}.json`);
  const bytes = JSON.stringify(body);
  fs.writeFileSync(file, bytes);
  return { file, sha: crypto.createHash('sha256').update(bytes).digest('hex') };
}

test('W1 [legacy and same-family reviews]: v1/v2 review receipts and codex-reviewed-by-codex never complete review-plan or review-exec', () => {
  for (const type of ['review-plan', 'review-exec']) {
    const p = project('bugfix');
    withLooseEmitter(() => driveUntil(p, type));
    const before = fs.readFileSync(p.file);
    const review = (extra) => ({ receipt_type: type, wi: p.wi, verdict: 'pass', diff_hash: 'x', reviewed_plan_digest: 'x', timestamp: new Date().toISOString(), ...extra });
    const sameFamily = { self_review: { orchestrator: 'codex', findings_count: 0, notes: 'n' }, adversarial_review: { primary_reviewer_host: 'codex', primary_used: true, fallback_host: 'codex', fallback_used: false, findings: [], iteration_count: 1 } };
    const crossFamily = { self_review: { orchestrator: 'claude', findings_count: 0, notes: 'n' }, adversarial_review: { primary_reviewer_host: 'codex', primary_used: true, fallback_host: 'codex', fallback_used: false, findings: [], iteration_count: 1 } };
    for (const [label, body, expected] of [
      ['v1 legacy', review({ schema_version: 1, ...crossFamily }), /legacy v1\/v2|below the current 3/],
      ['v2 legacy', review({ schema_version: 2, ...crossFamily }), /legacy v1\/v2|below the current 3/],
      ['v3 same family', review({ schema_version: 3, ...sameFamily }), /not a genuine cross-family review/],
      ['v3 no reviewer evidence', review({ schema_version: 3, ...crossFamily }), /reviewer evidence/],
      ['string schema_version', review({ schema_version: '3', ...crossFamily }), /below the current 3/],
    ]) {
      const rec = stagedBody(p.dir, type, body);
      const r = next(p.dir, '--done', type, '--receipt', `${type}:${rec.sha}`);
      assert.equal(r.code, 4, `${type} ${label}`);
      assert.match(r.stderr, expected, `${type} ${label}`);
    }
    assert.deepEqual(fs.readFileSync(p.file), before);
  }
});

test('W2 [terminal completion revalidates receipts]: six identity-only fail receipts recorded in the graph never produce STATUS done', () => {
  const p = project('bugfix');
  const g = readGraph(p.file);
  for (const t of g.tasks) {
    t.status = 'completed';
    t.skill_receipt = { skill: skillOf(t), loaded_at: new Date().toISOString(), loaded_via: 'fixture' };
    const type = EMIT[skillOf(t)];
    if (type) {
      const rec = stagedBody(p.dir, type, { receipt_type: type, wi: p.wi, verdict: 'fail' });
      t.chain_receipt = { type, sha256: rec.sha, path: path.relative(p.dir, rec.file) };
    } else t.chain_receipt = { type: 'load-skill' };
  }
  g.status = 'completed';
  fs.writeFileSync(p.file, JSON.stringify(g));
  const r = next(p.dir);
  assert.equal(r.code, 5);
  assert.equal(r.card.STATUS, 'not_done');
  assert.equal(r.card.MISSING, ALL_TYPES.join(','));
  assert.equal(r.card.SKILL, 'plan-changeset');
});

test('W3 [explicit verdicts]: a null, missing, numeric or odd-cased verdict never completes audit-implementation or verify-promotion', () => {
  for (const [stage, type] of [['audit-implementation', 'audit-implementation'], ['verify-promotion', 'verify-promotion']]) {
    const p = project('bugfix');
    withLooseEmitter(() => driveUntil(p, stage));
    const before = fs.readFileSync(p.file);
    for (const verdict of [null, undefined, 0, true, [], {}, 'Pass', 'PASS', ' pass', 'passed', 'pass-with-findings', 'fail']) {
      const rec = stagedBody(p.dir, type, { receipt_type: type, wi: p.wi, ...(verdict === undefined ? {} : { verdict }) });
      const r = next(p.dir, '--done', stage, '--receipt', `${type}:${rec.sha}`);
      assert.equal(r.code, 4, `${stage} ${JSON.stringify(verdict)}`);
      assert.match(r.stderr, /not an allowed passing verdict/);
    }
    assert.deepEqual(fs.readFileSync(p.file), before);
  }
  // verify-promotion has no acks verdict: only "pass" is a pass.
  const p = project('bugfix');
  withLooseEmitter(() => {
    driveUntil(p, 'verify-promotion');
    const rec = stagedBody(p.dir, 'verify-promotion', { receipt_type: 'verify-promotion', wi: p.wi, verdict: 'pass-with-acks' });
    assert.equal(next(p.dir, '--done', 'verify-promotion', '--receipt', `verify-promotion:${rec.sha}`).code, 4);
  });
});

test('W4 [review body construction]: build-review proves a real launcher run, stores the object, and refuses same-family and failing runs', () => {
  const p = project('bugfix');
  const git = gitProject(p);
  fs.mkdirSync(path.join(p.dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'src', 'a.txt'), 'change');
  git('add', '-A');
  const saved = { ...process.env };
  try {
    process.env.SVC_HOST = 'codex';
    const summaryFor = (fx) => {
      const f = path.join(p.dir, `summary-${crypto.randomBytes(4).toString('hex')}.json`);
      fs.writeFileSync(f, JSON.stringify({ ok: true, findings: fx.output, receipt: fx.receiptPath }));
      return f;
    };
    const good = createExternalReviewFixture({ frameworkRoot: ROOT, repo: p.dir, reviewKind: 'exec', wi: p.wi, candidateSha: null });
    const out = path.join(p.dir, '.svc', 'review-exec.body.json');
    const built = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(good), '--out', out);
    assert.equal(built.code, 0, built.stderr);
    const body = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(body.schema_version, 3);
    assert.equal(body.verdict, 'pass');
    assert.equal(body.candidate_digest, candidateTreeIdentity(p.dir).candidate_digest);
    assert.equal(body.reviewer_evidence.independent, true);
    // a launcher run for another orchestrator than this session is refused
    const other = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(good), '--orchestrator', 'claude', '--out', path.join(p.dir, 'x.json'));
    assert.equal(other.code, 4);
    assert.match(other.stderr, /launcher ran for orchestrator "codex" but this session is "claude"/);
    assert.equal(fs.existsSync(path.join(p.dir, 'x.json')), false);
    // a failing reviewer verdict is refused
    const failing = createExternalReviewFixture({ frameworkRoot: ROOT, repo: p.dir, reviewKind: 'exec', wi: p.wi, roundLabel: 'failing', verdict: 'fail', findings: [{ id: 'F1', severity: 'high', claim: 'c', analysis: 'a', evidence: 'e', proposed_fix: 'p' }] });
    const refused = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(failing), '--out', path.join(p.dir, 'y.json'));
    assert.equal(refused.code, 4);
    assert.match(refused.stderr, /not an allowed passing verdict/);
    // missing or unsuccessful launcher summary
    const bad = path.join(p.dir, 'bad.json');
    fs.writeFileSync(bad, JSON.stringify({ ok: false }));
    assert.equal(next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', bad).code, 4);
    assert.equal(next(p.dir, '--wi', p.wi, '--build-review', 'exec').code, 4);
    // the emitter accepts the body and svc-next completes the stage with it
    withLooseEmitter(() => driveUntil(p, 'review-exec'));
    const rec = realEmit(p, 'review-exec', body);
    const done = next(p.dir, '--done', 'review-exec', '--receipt', `review-exec:${rec.sha}`);
    assert.equal(done.code, 0, done.stderr);
    assert.equal(done.card.SKILL, 'audit-implementation');
    // and a --store build persists an object a seal can find
    const stored = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(good), '--store', '--out', path.join(p.dir, 'z.json'));
    assert.match(stored.stdout, /^review_ref [0-9a-f]{64}$/m);
  } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
});

test('W5 [exec review recipe]: the frozen candidate digest is computed, put in the request, and passed with the selected WI', () => {
  const p = project('bugfix');
  const git = gitProject(p);
  fs.writeFileSync(path.join(p.dir, 'src.txt'), 'x');
  git('add', '-A');
  const text = recipeFor('review-exec', { rootArg: '.', wi: p.wi }).join('\n');
  assert.match(text, /--candidate-digest exec\)" && printf .*candidate_digest=%s.* "\$DIGEST" >> \.svc\/review-cross-model-package\.md/);
  assert.match(text, /SVC_WI=WI-NEXT node "\$SVC_ROOT"\/scripts\/run-external-review\.mjs .*--review-kind exec --candidate-digest "\$DIGEST" --input-file/);
  const exec = next(p.dir, '--candidate-digest', 'exec');
  assert.equal(exec.code, 0);
  assert.equal(exec.stdout.trim(), candidateTreeIdentity(p.dir).candidate_digest);
  assert.match(exec.stdout.trim(), /^[0-9a-f]{64}$/);
  fs.mkdirSync(path.join(p.dir, '.svc/external-review-artifacts/plan-handoff'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, '.svc/external-review-artifacts/plan-handoff/body.json'), '{"a":1}');
  assert.equal(next(p.dir, '--candidate-digest', 'plan').stdout.trim(), crypto.createHash('sha256').update('{"a":1}').digest('hex'));
  assert.equal(candidateDigestFor(p.dir, 'plan'), crypto.createHash('sha256').update('{"a":1}').digest('hex'));
  assert.equal(next(p.dir, '--candidate-digest', 'nonsense').code, 4);
  // the review-plan recipe also reaches the launcher through the plan adapter, then builds the body
  const plan = recipeFor('review-plan', { rootArg: '.', wi: p.wi }).join('\n');
  assert.match(plan, /review-plan-codex\.sh .*manifest\.md/);
  assert.match(plan, /--build-review plan/);
});

test('W6 [handback follows the printed CLOSEOUT]: no changed skill rebuilds the command, and execute-changeset is untouched', () => {
  const skills = fs.readdirSync(path.join(ROOT, 'skills'));
  let handbacks = 0;
  for (const name of skills) {
    const text = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8');
    const m = /\n## Handback\n([\s\S]*)$/.exec(text);
    if (!m) continue;
    handbacks += 1;
    assert.match(m[1], /CLOSEOUT/, name);
    assert.doesNotMatch(m[1], /--done|--root \./, `${name}: Handback must not rebuild the command`);
    assert.match(m[1], /verbatim/, name);
  }
  assert.ok(handbacks >= 20, `${handbacks} skills carry a Handback`);
  const exec = fs.readFileSync(path.join(ROOT, 'skills/execute-changeset/SKILL.md'), 'utf8');
  assert.doesNotMatch(exec, /## Handback|svc-next/, 'execute-changeset stays exactly as the base branch has it; its card carries the CLOSEOUT');
  // the card is the contract for that stage
  const p = project('bugfix');
  withLooseEmitter(() => driveUntil(p, 'execute-changeset'));
  const card = next(p.dir).card;
  assert.equal(card.SKILL, 'execute-changeset');
  assert.match(card.CLOSEOUT, /--wi WI-NEXT --done execute-changeset --receipt exec-record:<sha256>$/);
});

// ------------------------------------------------------------ round 3 findings

test('V1 [immutable plan structure]: a plan with null evidence fields is rejected on completion and when it is already recorded', () => {
  const nulls = { receipt_type: 'plan-manifest', schema_version: 5, wi: 'WI-NEXT', mode: 'inline', timestamp: null, scope: null, dependencies: null, decision_trace: null, task_graph: null, validation_plan: null, risk_rollback: null, execution_command_sequence: null, ac_digests: null, planning_contract: null, implementation_approach: null, executor_discretion: null };
  const p = project('bugfix');
  assert.ok(planSealReasons(p.dir, nulls).length > 0);
  assert.match(acceptanceReasons(p.dir, 'plan-manifest', nulls, { issuance: false }).join(';'), /plan schema/);
  assert.ok(acceptanceReasons(p.dir, 'plan-manifest', { ...nulls, schema_version: 4 }, { issuance: false }).length > 0);
  withLooseEmitter(() => driveUntil(p, 'plan-changeset'));
  const rec = stagedBody(p.dir, 'plan-manifest', nulls);
  const before = fs.readFileSync(p.file);
  const r = next(p.dir, '--done', 'plan-changeset', '--receipt', `plan-manifest:${rec.sha}`);
  assert.equal(r.code, 4);
  assert.match(r.stderr, /plan schema|sealed plan evidence/);
  assert.deepEqual(fs.readFileSync(p.file), before);
  // recorded in the graph as a finished stage, it does not hold: the lane reopens at plan-changeset
  const g = readGraph(p.file);
  const plan = g.tasks.find((t) => skillOf(t) === 'plan-changeset');
  plan.status = 'completed';
  plan.skill_receipt = { skill: 'plan-changeset', loaded_at: new Date().toISOString(), loaded_via: 'fixture' };
  plan.chain_receipt = { type: 'plan-manifest', sha256: rec.sha, path: path.relative(p.dir, rec.file) };
  fs.writeFileSync(p.file, JSON.stringify(g));
  const c = next(p.dir);
  assert.equal(c.code, 5);
  assert.equal(c.card.SKILL, 'plan-changeset');
  assert.match(c.card.MISSING, /plan-manifest/);
});

function execReviewProject() {
  const p = project('bugfix');
  const git = gitProject(p);
  fs.mkdirSync(path.join(p.dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(p.dir, 'src', 'a.txt'), 'change');
  git('add', '-A');
  const fx = (extra = {}) => createExternalReviewFixture({ frameworkRoot: ROOT, repo: p.dir, reviewKind: 'exec', wi: p.wi, candidateSha: null, ...extra });
  const summaryFor = (f) => {
    const file = path.join(p.dir, `summary-${crypto.randomBytes(4).toString('hex')}.json`);
    fs.writeFileSync(file, JSON.stringify({ ok: true, findings: f.output, receipt: f.receiptPath }));
    return file;
  };
  return { p, git, fx, summaryFor };
}

function withEnv(values, fn) {
  const saved = { ...process.env };
  Object.assign(process.env, values);
  try { return fn(); } finally {
    for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
    Object.assign(process.env, saved);
  }
}

test('V2 [candidate binding]: a review of an earlier tree never completes the stage once the code changed', () => {
  withEnv({ SVC_HOST: 'codex' }, () => {
    const { p, git, fx, summaryFor } = execReviewProject();
    const built = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(fx()), '--out', path.join(p.dir, '.svc', 'review-exec.body.json'));
    assert.equal(built.code, 0, built.stderr);
    const body = JSON.parse(fs.readFileSync(path.join(p.dir, '.svc', 'review-exec.body.json'), 'utf8'));
    withLooseEmitter(() => driveUntil(p, 'review-exec'));
    const rec = realEmit(p, 'review-exec', body);
    // the code changes after the review
    fs.writeFileSync(path.join(p.dir, 'src', 'b.txt'), 'late change');
    git('add', 'src/b.txt');
    const before = fs.readFileSync(p.file);
    const stale = next(p.dir, '--done', 'review-exec', '--receipt', `review-exec:${rec.sha}`);
    assert.equal(stale.code, 4);
    assert.match(stale.stderr, /changed code needs a fresh review/);
    assert.deepEqual(fs.readFileSync(p.file), before);
    // the unchanged candidate is accepted
    git('rm', '-q', '--cached', 'src/b.txt');
    const ok = next(p.dir, '--done', 'review-exec', '--receipt', `review-exec:${rec.sha}`);
    assert.equal(ok.code, 0, ok.stderr);
  });
});

test('V3 [orchestrator identity]: no guessed host; unknown, mismatched and same-family orchestrators are refused', () => {
  withEnv({ SVC_HOST: 'codex' }, () => {
    const { p, fx, summaryFor } = execReviewProject();
    const good = fx();
    const out = path.join(p.dir, 'o.json');
    const unknown = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(good), '--orchestrator', 'mystery', '--out', out);
    assert.equal(unknown.code, 4);
    assert.match(unknown.stderr, /cannot identify the orchestrator host/);
    const mismatch = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(good), '--orchestrator', 'claude', '--out', out);
    assert.match(mismatch.stderr, /launcher ran for orchestrator "codex" but this session is "claude"/);
    assert.equal(fs.existsSync(out), false);
    // author and reviewer in the same family
    const agy = { orchestrator: 'agy', host: 'agy', family: 'google', model: 'Gemini 3.6 Flash (High)', effort: 'high' };
    const same = next(p.dir, '--wi', p.wi, '--build-review', 'exec', '--summary', summaryFor(fx({ tupleOverride: agy, roundLabel: 'same' })), '--orchestrator', 'agy', '--out', out);
    assert.equal(same.code, 4);
    assert.match(same.stderr, /not a genuine cross-family review/);
    assert.equal(fs.existsSync(out), false);
    assert.equal(next(p.dir, '--orchestrator-id', '--orchestrator', 'codex').stdout.trim(), 'codex');
    assert.equal(resolveOrchestrator('gemini'), 'gemini');
  });
  assert.throws(() => resolveOrchestrator('mystery'), /cannot identify the orchestrator host/);
  const text = ['plan-manifest', 'review-plan', 'review-exec'].map((t) => recipeFor(t, { rootArg: '.', wi: 'WI-NEXT' }).join('\n')).join('\n');
  assert.doesNotMatch(text, /:-claude/, 'no recipe defaults the host to claude');
});

test('V4 [cache replay evidence]: a cache-hit launcher receipt carries its authenticated source receipt, commands and outputs', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-next-cache-'));
  const entry = path.join(dir, 'cache', 'entry');
  fs.mkdirSync(entry, { recursive: true });
  fs.writeFileSync(path.join(dir, 'findings.json'), '{"verdict":"pass"}');
  const command = { binary: 'agy', argv: ['review'] };
  fs.writeFileSync(path.join(entry, 'receipt.json'), JSON.stringify({ classification: 'success', reviewer_run: { commands: [command], output_artifacts: [path.join(dir, 'findings.json')] } }));
  const replayFile = path.join(dir, 'receipt.json');
  const replay = { classification: 'cache_hit', cache: { disposition: 'hit', entry }, reviewer_run: { commands: [], output_artifacts: [] } };
  fs.writeFileSync(replayFile, JSON.stringify(replay));
  const evidence = launcherEvidence(dir, replayFile, replay);
  assert.deepEqual(evidence.commands, [command]);
  assert.equal(evidence.output_artifacts.length, 1);
  assert.equal(evidence.output_artifacts[0].path, 'findings.json');
  assert.equal(evidence.cache_sources.length, 1);
  const replaySha = crypto.createHash('sha256').update(fs.readFileSync(replayFile)).digest('hex');
  assert.equal(evidence.cache_sources[0].replay_sha256, replaySha);
  assert.equal(evidence.launcher_receipts[0].sha256, replaySha);
  assert.equal(evidence.cache_sources[0].source.sha256, crypto.createHash('sha256').update(fs.readFileSync(path.join(entry, 'receipt.json'))).digest('hex'));
  assert.equal(evidence.independent, true);
  // a replay whose source is gone cannot be turned into evidence
  fs.rmSync(path.join(entry, 'receipt.json'));
  assert.throws(() => launcherEvidence(dir, replayFile, replay), /no readable source receipt/);
  // a plain run needs no cache source
  const plain = launcherEvidence(dir, replayFile, { classification: 'success', reviewer_run: { commands: [command], output_artifacts: [path.join(dir, 'findings.json')] } });
  assert.equal(plain.cache_sources, undefined);
});

test('V5 [land keeps its worktree]: the land skill defers worktree removal until the lane is done, and the Handback runs first', () => {
  const land = fs.readFileSync(path.join(ROOT, 'skills/land-changeset/SKILL.md'), 'utf8');
  const step5 = /### Step 5[\s\S]*?(?=### Step 6)/.exec(land)[0];
  assert.match(step5, /Do not remove it here/);
  assert.match(step5, /after `svc-next` reports `STATUS done`/);
  const handback = /\n## Handback\n([\s\S]*)$/.exec(land)[1];
  assert.match(handback, /before any worktree removal/);
  assert.match(handback, /until `svc-next` reports `STATUS done`/);
  assert.match(land, /with a lane graph: after `svc-next` reports `STATUS done`/);
});

test('V6 [standalone stays usable]: every Handback is conditional on a lane graph and standalone chaining is kept', () => {
  for (const name of fs.readdirSync(path.join(ROOT, 'skills'))) {
    const text = fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8');
    const m = /\n## Handback\n([\s\S]*)$/.exec(text);
    if (!m) continue;
    assert.match(m[1], /^\nWhen a compiled lane graph/, name);
    assert.match(m[1], /Without a lane graph there is no card: skip this section/, name);
  }
  const domain = fs.readFileSync(path.join(ROOT, 'skills/analyze-domain/SKILL.md'), 'utf8');
  assert.match(domain, /If standalone \(no lane graph\):\*\* report the domain profile summary and suggest: "Next: run `analyze-competitors`/);
  for (const name of ['review-gate', 'audit-implementation', 'land-changeset', 'verify-promotion']) {
    assert.match(fs.readFileSync(path.join(ROOT, 'skills', name, 'SKILL.md'), 'utf8'), /[Ss]tandalone/, name);
  }
});
