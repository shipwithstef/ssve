// @organism-suite
// svc-next: the lane driver. No model, no network: it builds real graphs with the compiler
// and drives them through run() (and the CLI where the process boundary matters) in temp dirs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileDeliveryGraph } from '../../scripts/compile-delivery-graph.mjs';
import { run, __testing, recipeFor } from '../../scripts/svc-next.mjs';

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

/** Lane-flow tests exercise ordering and bookkeeping; the emitter's own acceptance is tested separately. */
function withLooseEmitter(fn) {
  const previous = __testing.emitterValidator;
  __testing.emitterValidator = () => [];
  try { return fn(); } finally { __testing.emitterValidator = previous; }
}

function stagedReceipt(dir, wi, type, extra = {}) {
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
  assert.equal(__testing.emitterValidator, null, 'the real emitter validator is in force');
  withLooseEmitter(() => driveUntil(p, 'audit-implementation'));
  const before = fs.readFileSync(p.file);

  const identityOnly = stagedReceipt(p.dir, p.wi, 'audit-implementation', { verdict: undefined });
  const a = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${identityOnly.sha}`);
  assert.equal(a.code, 4);
  assert.match(a.stderr, /not a receipt emit-receipt\.mjs would accept/);

  const failed = realEmit(p, 'audit-implementation', { verdict: 'fail', findings: [{ id: 'F1', severity: 'critical' }] });
  const b = next(p.dir, '--done', 'audit-implementation', '--receipt', `audit-implementation:${failed.sha}`);
  assert.equal(b.code, 4);
  assert.match(b.stderr, /not passing/);
  assert.deepEqual(fs.readFileSync(p.file), before);

});

test('R1 [real receipts]: a receipt written by the real emitter completes audit-implementation and exec-record', () => {
  const p = project('bugfix');
  gitProject(p);
  assert.equal(__testing.emitterValidator, null);
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
      const ok = stagedReceipt(p.dir, p.wi, type, { verdict: 'pass-with-acks' });
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
  assert.match(recipeFor('review-exec', { rootArg: '.', wi: p.wi }).join('\n'), /run-external-review\.mjs --orchestrator "\$\{SVC_HOST:-claude\}" --review-kind exec/);
});
