#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import http from 'node:http';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { init, atomicJson, readJson, taskPath, bootId, withLocks, lockPath, sleep } from './common.mjs';
import { recover, parentResume } from './recover.mjs';
import { checkpointEvents, readImds, signalCollector } from './preempt-watch.mjs';
import { collect, classify } from './collect.mjs';
import { html } from './serve.mjs';
import { transact, readRegistry } from './goals.mjs';
import { recoverySessions, sessionFile } from './sessions.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));

async function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-recovery-')); init(root);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const worktree = path.join(root, 'worktree'); fs.mkdirSync(worktree);
  assert.equal(spawnSync('git', ['init', '-q', worktree]).status, 0);
  const planning = path.join(root, 'planning'); fs.mkdirSync(planning);
  assert.equal(spawnSync('git', ['init', '-q', planning]).status, 0); fs.writeFileSync(path.join(planning, 'PLAN.md'), '# Plan');
  await transact('create', { id: 'orch', title: 'Orch', objective: 'ship', plan: path.join(planning, 'PLAN.md'), claude_turn_cap: 10, codex_runs: 20, cursor_runs: 20, agy_runs: 20, expected_revision: 0 }, root);
  await transact('grant-worktree', { id: 'orch', lane: 'recovery', worktree, expected_revision: 1 }, root);
  await transact('set-state', { id: 'orch', state: 'active', expected_revision: 2 }, root);
  const config = path.join(root, 'config'); fs.mkdirSync(config); fs.writeFileSync(path.join(config, 'parent-session'), 'parent-exact-id\n');
  const dispatch = path.join(root, 'fake-dispatch.mjs');
  fs.writeFileSync(dispatch, `import fs from 'node:fs';import path from 'node:path';
const args=process.argv.slice(2), root=process.env.ORCH_STATE_DIR;
fs.appendFileSync(path.join(root,'calls.jsonl'),JSON.stringify(args)+'\\n');
if(fs.existsSync(path.join(root,'fail')))process.exit(1);
const file=path.join(root,'tasks',args[1]+'.json'), task=JSON.parse(fs.readFileSync(file));
task.attempt_history.push({attempt_id:task.attempt_id,state:task.state});
task.attempt_id+='-resumed';task.state='running';task.finished_at=null;
task.process_identity={pid:2147483647,boot_id:args[4],start_ticks:'0'};
task.supervisor_identity=null;task.recovery.status='dispatched';fs.writeFileSync(file,JSON.stringify(task));`);
  const task = extra => ({ schema_version: 1, id: 'work', state: 'running', goal_id: 'orch', goal_generation: 1, lane: 'recovery', title: 'Work', description: 'Fake work', executor: { cli: 'codex', model: 'gpt-6.1-sol', effort: 'high' }, worktree, session_id: 'exact-session', resume_text: 'Reconcile first; continue exactly.', process_identity: { pid: 2147483647, boot_id: 'boot-old', start_ticks: '0' }, attempt_id: 'first', attempt_history: [], log_path: path.join(root, 'log'), started_at: new Date().toISOString(), exit_code: null, finished_at: null, expected_minutes: null, acceptance: [], depends_on: [], ...extra });
  const put = record => atomicJson(taskPath(record.id, root), record);
  const calls = () => fs.existsSync(path.join(root, 'calls.jsonl')) ? fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : [];
  const run = currentBoot => recover({ root, config, dispatch, currentBoot, restart: async () => {} });
  return { root, worktree, planning, config, task, put, calls, run };
}

test('changed boot resumes each supported CLI once, with exact recorded text; repeated/concurrent boots never duplicate', async t => {
  const f = await fixture(t);
  for (const cli of ['codex', 'cursor', 'agy']) f.put(f.task({ id: cli, executor: { cli } }));
  const runs = await Promise.allSettled([f.run('boot-new'), f.run('boot-new')]);
  assert.ok(runs.some(run => run.status === 'fulfilled'));
  await f.run('boot-new');
  assert.equal(f.calls().length, 3);
  for (const args of f.calls()) {
    assert.equal(args[0], 'resume'); assert.equal(args[2], 'Reconcile first; continue exactly.');
    assert.deepEqual(args.slice(3), ['--auto-recover', 'boot-new', '--expected-attempt', 'first']);
    const record = readJson(taskPath(args[1], f.root));
    assert.equal(record.auto_resume_count, 1); assert.equal(record.attempt_history[0].state, 'interrupted');
  }
  const summary = readJson(path.join(f.root, 'recovery-boot-new.json'));
  assert.equal(summary.parent.resume_command, null); assert.match(summary.parent.reason, /differs/); assert.equal(summary.parent.auto_start, false);
  assert.equal(summary.tasks.filter(task => task.action === 'resumed').length, 3);
});
test('paid/live, adopted, unknown boot, missing continuation and terminal records never dispatch', async t => {
  const f = await fixture(t);
  for (const [id, extra] of [['paid', { paid: true }], ['card-paid', { card: { paid: true } }], ['adopted', { adopted: true }], ['unknown', { process_identity: null }], ['no-text', { resume_text: '' }], ['terminal', { state: 'done' }], ['same-boot', { process_identity: { boot_id: 'boot-new' } }]]) f.put(f.task({ id, ...extra }));
  await f.run('boot-new'); await f.run('boot-new');
  assert.deepEqual(f.calls(), []);
  for (const id of ['paid', 'card-paid', 'adopted', 'unknown', 'no-text']) assert.equal(readJson(taskPath(id, f.root)).state, 'needs_owner');
  assert.equal(readJson(taskPath('paid', f.root)).interrupted_attempt.state, 'interrupted');
  assert.equal(readJson(taskPath('terminal', f.root)).state, 'done');
  assert.equal(readJson(taskPath('same-boot', f.root)).state, 'running');
});
test('two successive auto-resumes exhaust the per-task budget across boots; owner cannot raise the hard cap', async t => {
  const f = await fixture(t); f.put(f.task({ max_auto_resume: 99 }));
  await f.run('boot-one'); await f.run('boot-two'); await f.run('boot-three');
  assert.equal(f.calls().length, 2);
  const task = readJson(taskPath('work', f.root)); assert.equal(task.auto_resume_count, 2); assert.equal(task.state, 'needs_owner');
  assert.match(task.recovery.reason, /limit/);
});
test('ambiguous failed dispatch consumes reservation once and publishes an owner hold', async t => {
  const f = await fixture(t); f.put(f.task()); fs.writeFileSync(path.join(f.root, 'fail'), 'true');
  await f.run('boot-new'); await f.run('boot-new'); await f.run('boot-later');
  assert.equal(f.calls().length, 1); assert.equal(readJson(taskPath('work', f.root)).state, 'needs_owner');
  assert.equal(readJson(taskPath('work', f.root)).auto_resume_count, 1);
});
test('busy worktree blocks recovery without touching the task or dispatching', async t => {
  const f = await fixture(t); const record = f.task(); f.put(record);
  await withLocks([lockPath(f.worktree, f.root)], async () => {
    const summary = await f.run('boot-new'); assert.equal(summary.tasks[0].action, 'held');
    assert.deepEqual(readJson(taskPath('work', f.root)), record); assert.deepEqual(f.calls(), []);
  });
  await f.run('boot-new'); assert.equal(f.calls().length, 1);
});
test('malformed records hold budget admission and safe boot/path identifiers are required', async t => {
  const f = await fixture(t); fs.writeFileSync(path.join(f.root, 'tasks', 'bad.json'), '{'); f.put(f.task());
  const summary = await f.run('boot-new'); assert.equal(f.calls().length, 0); assert.equal(summary.tasks[0].action, 'held');
  assert.match(readJson(taskPath('work', f.root)).recovery.reason, /Goal recovery denied/);
  await assert.rejects(f.run('../escape'), /Invalid boot/);
  fs.writeFileSync(path.join(f.config, 'parent-session'), 'id; touch /bad'); assert.equal(parentResume(f.config).resume_command, null);
});
test('Preempt/Terminate checkpoint local VM only and deduplicate notices across watcher restarts', async t => {
  const f = await fixture(t); let signals = 0;
  const event = (id, type = 'Preempt', resource = 'this-vm') => ({ EventId: id, EventType: type, EventStatus: 'Scheduled', Resources: [resource], NotBefore: new Date(Date.now() + 30000).toISOString() });
  const payload = { Events: [event('p'), event('t', 'Terminate'), event('other', 'Preempt', 'other-vm'), event('r', 'Reboot')] };
  const o = { root: f.root, vmName: 'this-vm', currentBoot: 'boot-new', signal: () => { signals++; } };
  assert.equal(checkpointEvents(payload, o).length, 2); assert.equal(signals, 2);
  assert.equal(checkpointEvents(payload, o).length, 0); assert.equal(signals, 2);
  assert.equal(readJson(path.join(f.root, 'checkpoint.json')).collector_signal, 'sent');
  const failed = checkpointEvents({ Events: [event('failed')] }, { ...o, signal: () => { throw new Error('offline'); } });
  assert.equal(failed[0].collector_signal, 'offline'); assert.ok(fs.existsSync(path.join(f.root, 'checkpoint.json')));
  assert.throws(() => checkpointEvents({}, o), /Invalid/);
});
test('IMDS request supplies Metadata header, refuses redirects and invalid JSON', async t => {
  const server = http.createServer((req, res) => {
    assert.equal(req.headers.metadata, 'true');
    if (req.url === '/redirect') { res.writeHead(302, { Location: '/ok' }); res.end(); }
    else res.end(req.url === '/bad' ? '{' : '{"Events":[]}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await readImds(url + '/ok'), { Events: [] });
  await assert.rejects(readImds(url + '/redirect'), /HTTP 302/); await assert.rejects(readImds(url + '/bad'));
});
test('collector watch flushes immediately on a checkpoint signal and remains the sole status writer', async t => {
  const f = await fixture(t);
  const child = spawn(process.execPath, [path.join(here, 'collect.mjs'), '--watch', '60'], { env: { ...process.env, ORCH_STATE_DIR: f.root }, stdio: 'ignore' });
  const exited = new Promise(resolve => child.once('exit', resolve));
  t.after(async () => { child.kill('SIGTERM'); await exited; });
  async function until(fn) { for (let i = 0; i < 150; i++) { if (fn()) return; await sleep(20); } throw new Error('Flush timeout'); }
  await until(() => readJson(path.join(f.root, 'status.json'))?.revision >= 1);
  assert.throws(() => signalCollector(path.join(f.root, 'config')), /verified collector/);
  checkpointEvents({ Events: [{ EventId: 'flush', EventType: 'Preempt', EventStatus: 'Started', Resources: ['vm'] }] }, { root: f.root, vmName: 'vm' });
  await until(() => readJson(path.join(f.root, 'status.json'))?.checkpoint?.event.EventId === 'flush');
  assert.ok(readJson(path.join(f.root, 'status.json')).revision >= 2);
  await assert.rejects(withLocks([path.join(f.root, 'locks', 'collector.lock')], () => {}), /busy/);
});
test('status publishes owner attachment and holds; generated web script parses', async t => {
  const f = await fixture(t); f.put(f.task({ state: 'needs_owner', recovery: { reason: 'Paid/live card' } }));
  atomicJson(path.join(f.root, `recovery-${bootId()}.json`), { boot_id: bootId(), parent: parentResume(f.config), tasks: [] });
  const status = collect(f.root);
  assert.equal(status.recovery.parent.resume_command, null); // Registry exists, but parent is unbound.
  assert.match(status.recovery.parent.reason, /Parent not bound/);
  assert.equal(status.tasks[0].state, 'needs_owner');
  assert.ok(status.tasks[0].blockers.some(b => b.code === 'recovery_hold'));
  assert.equal(classify({ state: 'interrupted' }, { alive: false }), 'interrupted');
  assert.doesNotThrow(() => new vm.Script(html.match(/<script>([\s\S]*)<\/script>/)[1]));
  fs.unlinkSync(path.join(f.root, 'goals.json')); // Legacy SR1 installation still exposes its parent output.
  assert.equal(collect(f.root).recovery.parent.resume_command, 'claude --resume parent-exact-id');
});
test('installer requires linger without sudo and renders systemd-verifiable units before enabling services', async t => {
  const f = await fixture(t), bin = path.join(f.root, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'loginctl'), '#!/bin/sh\nprintf "%s\\n" "$FAKE_LINGER"\n', { mode: 0o700 });
  fs.writeFileSync(path.join(bin, 'systemctl'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$HOME/systemctl.calls"\n', { mode: 0o700 });
  const env = { ...process.env, HOME: f.root, PATH: `${bin}:${process.env.PATH}`, FAKE_LINGER: 'no' };
  const denied = spawnSync('bash', [path.join(here, 'install-units.sh')], { env, encoding: 'utf8' });
  assert.equal(denied.status, 1); assert.match(denied.stdout, /sudo loginctl enable-linger/);
  assert.equal(fs.existsSync(path.join(f.root, 'systemctl.calls')), false);
  const installed = spawnSync('bash', [path.join(here, 'install-units.sh')], { env: { ...env, FAKE_LINGER: 'yes' }, encoding: 'utf8' });
  assert.equal(installed.status, 0, installed.stderr);
  const calls = fs.readFileSync(path.join(f.root, 'systemctl.calls'), 'utf8');
  assert.match(calls, /--user enable orch-recover.service/); assert.match(calls, /--user enable --now orch-collect.service orch-serve.service orch-preempt.service/);
  const recoverUnit = fs.readFileSync(path.join(f.root, '.config/systemd/user/orch-recover.service'), 'utf8');
  assert.ok(!recoverUnit.includes('@ORCH_')); assert.match(recoverUnit, /Type=oneshot/); assert.match(recoverUnit, /After=network-online.target/);
});

test('HO1 reboot twice: persisted child grant resumes one worker; Claude and paid/live attempts stay held', async t => {
  const f = await fixture(t);
  await transact('bind-parent', { id: 'orch', parent_session: 'parent-exact-id', expected_revision: 3 }, f.root);
  await transact('set-state', { id: 'orch', state: 'paused', expected_revision: 4 }, f.root);
  const registry = await transact('set-state', { id: 'orch', state: 'active', child_session: 'child-exact-id', child_principal: 'child-orch', expected_revision: 5 }, f.root);
  fs.mkdirSync(path.join(f.root, 'sessions'));
  for (const role of ['parent', 'child']) {
    const authority = role === 'parent' ? registry.parent : { ...registry.goals[0].child, generation: registry.goals[0].generation };
    atomicJson(sessionFile(role, 'orch', f.root), { schema_version: 1, role, goal_id: 'orch', session_id: authority.session_id,
      generation: authority.generation, principal: authority.principal, contract: path.join(f.root, authority.contract_ref), worktree: f.planning,
      launch_nonce: role + '-nonce', state: 'idle', effort: 'low', boot_id: 'boot-old', process_identity: { boot_id: 'boot-old', pid: 2147483647 },
      supervisor_identity: { boot_id: 'boot-old', pid: 2147483647 }, usage: { turns: 1 } });
  }
  const task = f.task({ goal_generation: 2, child_session: 'child-exact-id', child_principal: 'child-orch', child_depth: 1 });
  f.put(task); f.put({ ...task, id: 'paid', paid: true });
  const before = fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8');
  const sessionsBefore = fs.readFileSync(sessionFile('child', 'orch', f.root), 'utf8');
  await f.run('boot-new'); const result = await f.run('boot-new');
  assert.equal(f.calls().length, 1); assert.equal(f.calls()[0][1], 'work');
  assert.equal(readJson(taskPath('paid', f.root)).state, 'needs_owner');
  assert.equal(fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8'), before);
  assert.equal(fs.readFileSync(sessionFile('child', 'orch', f.root), 'utf8'), sessionsBefore);
  assert.deepEqual(result.orchestrators.map(o => o.role), ['parent', 'child']);
  for (const entry of result.orchestrators) {
    assert.equal(entry.state, 'needs_owner'); assert.equal(entry.auto_start, false); assert.equal(entry.cwd, f.planning);
    assert.ok(entry.resume_command.includes(`'--session-id' '${entry.session_id}'`));
    assert.ok(entry.resume_command.includes(`'--generation' '${entry.generation}'`));
    assert.ok(entry.resume_command.includes(`'--nonce' '${entry.role}-nonce'`));
    assert.ok(entry.resume_command.includes(`'--contract' '${path.join(f.root, entry.contract_ref)}'`));
    assert.ok(entry.resume_command.includes("'--native-stopped' 'true' '--live-verified' 'true'"));
  }
  // A real-boot receipt is projected, with commands and needs_owner goal health.
  atomicJson(path.join(f.root, `recovery-${bootId()}.json`), result);
  const status = collect(f.root);
  assert.equal(status.orchestrators.length, 2); assert.equal(status.goals[0].child.state, 'needs_owner');
  assert.ok(status.goals[0].blockers.some(b => b.description.includes('paid')));
  assert.ok(!JSON.stringify(status).includes(task.resume_text));
  fs.writeFileSync(path.join(f.config, 'parent-session'), 'foreign-parent');
  // Current compatibility checks hold commands even before recovery reruns.
  assert.equal(collect(f.root, 5, f.config).orchestrators[0].resume_command, null);
  const mismatched = await f.run('boot-new'); assert.equal(mismatched.parent.resume_command, null);
  assert.equal(mismatched.orchestrators[0].attach_command, null); assert.match(mismatched.parent.reason, /differs/);
});
for (const [name, change] of [
  ['missing grant', { lane: 'foreign' }], ['stale generation', { goal_generation: 0 }],
  ['foreign child', { child_session: 'foreign', child_depth: 1 }], ['missing generation', { goal_generation: null }],
  ['unknown goal', { goal_id: 'absent' }]
]) test(`reboot holds ${name} without consuming a resume or launching`, async t => {
  const f = await fixture(t); f.put(f.task(change)); await f.run('boot-new'); await f.run('boot-new');
  const task = readJson(taskPath('work', f.root));
  assert.deepEqual(f.calls(), []); assert.equal(task.state, 'needs_owner'); assert.equal(task.auto_resume_count, undefined);
  assert.match(task.recovery.reason, /Goal recovery denied/);
});
for (const [name, options] of [ ['paused', { state: 'paused' }], ['unknown cap', { state: 'active' }], ['exhausted cap', { state: 'active', codex_runs: 1 }] ])
  test(`reboot holds ${name} budget/state under the registry lock`, async t => {
    const f = await fixture(t); await transact('set-state', { id: 'orch', expected_revision: 3, ...options }, f.root);
    if (name === 'unknown cap') { const registry = readRegistry(f.root); registry.goals[0].budget.worker_caps.codex.runs = null; atomicJson(path.join(f.root, 'goals.json'), registry); }
    f.put(f.task()); await f.run('boot-new'); assert.equal(f.calls().length, 0);
    assert.match(readJson(taskPath('work', f.root)).recovery.reason, /Goal recovery denied/);
  });
