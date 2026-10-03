#!/usr/bin/env node
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ingestLines, procIdentity, sameProcess, lockPath, lockBusy, init, atomicJson, taskPath, sleep, digest } from './common.mjs';
import { workerCommand, scopeCommand } from './dispatch.mjs';
import { readStream, classify, collect, adopt, observedAlive } from './collect.mjs';
import { createServer } from './serve.mjs';
const dir = path.dirname(fileURLToPath(import.meta.url));
function fixture(cli) { return fs.readFileSync(path.join(dir, 'fixtures', `${cli}.jsonl`), 'utf8'); }
function temp(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-test-')); t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root; }
function repo(root) { const wt = path.join(root, 'worktree'); fs.mkdirSync(wt); assert.equal(spawnSync('git', ['init', '-q', wt]).status, 0); return wt; }
function task(worktree, extra = {}) { return { schema_version: 1, id: 'cp1', goal_id: 'orchestrator-os', title: 'Collector', lane: 'control', description: 'Collect local status', acceptance: [], depends_on: [], executor: { cli: 'codex', model: 'gpt-6.1-sol', effort: 'high', cli_version: 'fixture' }, worktree, session_id: 'exact-id', started_at: new Date(Date.now() - 60000).toISOString(), expected_minutes: 10, hard_timeout_ms: 120000, deadline_at: new Date(Date.now() + 60000).toISOString(), finished_at: null, exit_code: null, attempt_id: 'one', process_identity: procIdentity(process.pid), attempt_history: [], ...extra }; }
async function waitFor(fn, timeout = 10000) { const start = Date.now(); while (Date.now() - start < timeout) { const result = fn(); if (result) return result; await sleep(30); } throw new Error('Wait timed out'); }
for (const [cli, id] of [['codex', '1'], ['cursor', '2'], ['agy', '3']]) {
  test(`recorded ${cli}: exact session, terminal, report and measured usage`, () => {
    const parsed = ingestLines(fixture(cli), cli);
    assert.equal(parsed.session_id, `00000000-0000-4000-8000-00000000000${id}`);
    assert.equal(parsed.terminal, 'done'); assert.ok(parsed.completion_report.includes('Reported:'));
    if (cli !== 'agy') assert.ok(parsed.usage.output_tokens > 0);
    assert.ok(parsed.events_last_3.length <= 3);
  });
}
test('split JSON, malformed lines, replay checkpoints and log rotation', t => {
  const root = temp(t); const file = path.join(root, 'log.jsonl'); const content = fixture('codex');
  fs.writeFileSync(file, content.slice(0, 30)); let cache = readStream(file, 'codex'); assert.equal(cache.session_id, undefined); assert.equal(cache.offset, 0);
  fs.appendFileSync(file, content.slice(30) + 'not-json\n'); cache = readStream(file, 'codex', cache);
  assert.equal(cache.terminal, 'done'); assert.equal(cache.malformed_lines, 1); const original = structuredClone(cache);
  cache = readStream(file, 'codex', JSON.parse(JSON.stringify(cache))); assert.deepEqual(cache, original);
  fs.renameSync(file, `${file}.old`); fs.writeFileSync(file, fixture('cursor'));
  cache = readStream(file, 'cursor', cache); assert.equal(cache.rotated, true); assert.equal(cache.session_id.slice(-1), '2');
});
test('log mtime touch does not count as log growth', t => {
  const file = path.join(temp(t), 'log'); fs.writeFileSync(file, fixture('codex'));
  const cache = readStream(file, 'codex'); const progress = cache.last_progress_at;
  fs.utimesSync(file, new Date(), new Date(Date.now() + 60000)); assert.equal(readStream(file, 'codex', cache).last_progress_at, progress);
});
test('classification requires durable exit; timeout and stale activity independent of estimate', () => {
  const now = Date.now(); const base = task('/example');
  assert.equal(classify(base, { alive: true, terminal: 'done', last_progress_at: new Date(now).toISOString() }, now), 'running');
  assert.equal(classify({ ...base, expected_minutes: 0.01 }, { alive: true, last_progress_at: new Date(now).toISOString() }, now), 'running');
  assert.equal(classify(base, { alive: true, last_progress_at: new Date(now - 301000).toISOString() }, now), 'stalled');
  assert.equal(classify({ ...base, deadline_at: new Date(now - 1).toISOString() }, { alive: true }, now), 'running');
  assert.equal(classify({ ...base, finished_at: new Date(now).toISOString(), exit_code: 0, state: 'done' }, { alive: false }, now), 'done');
  assert.equal(classify(base, { alive: false, terminal: 'done' }, now), 'exited (unknown)');
  assert.equal(classify({ ...base, adopted: true, deadline_at: new Date(now - 1).toISOString() }, { alive: true, last_progress_at: new Date(now).toISOString() }, now), 'running');
});
test('resume commands use exact session, model/effort and original workspace; VM bypass and limits', () => {
  const base = task('/example'); const codex = workerCommand(base, 'literal $() `text`', true);
  assert.deepEqual(codex.slice(0, 4), ['codex', 'exec', 'resume', 'exact-id']); assert.ok(codex.includes('--dangerously-bypass-approvals-and-sandbox')); assert.equal(codex.at(-1), 'literal $() `text`'); assert.ok(!codex.includes('--cd'));
  for (const cli of ['cursor', 'agy']) {
    const current = { ...base, executor: { cli, model: cli === 'cursor' ? 'grok-4.7' : 'gemini-3.7-flash', effort: 'high' } };
    const argv = workerCommand(current, 'resume', true); assert.equal(argv[argv.indexOf(cli === 'cursor' ? '--resume' : '--conversation') + 1], 'exact-id'); assert.ok(!argv.includes('--last')); if (cli === 'cursor') assert.ok(argv.includes('grok-4.7-high'));
  }
  assert.throws(() => workerCommand({ ...base, session_id: null }, 'x', true), /session/);
  const argv = scopeCommand({ ...base, unit: 'orch-test.scope', memory_cap: '4G' }, codex);
  assert.ok(argv.includes('MemoryMax=4G')); assert.ok(argv.includes('MemorySwapMax=0')); assert.ok(argv.includes('timeout')); assert.ok(argv.includes('--kill-after=10s'));
});
test('single-writer kernel lease survives stale metadata and excludes worktree aliases', async t => {
  const root = temp(t); init(root); const wt = repo(root); const alias = path.join(root, 'alias'); fs.symlinkSync(wt, alias);
  assert.equal(lockPath(alias, root), lockPath(wt, root));
  const ready = path.join(root, 'ready'); const release = path.join(root, 'release');
  const holder = spawn('flock', ['-n', lockPath(wt, root), process.execPath, '-e', "require('fs').writeFileSync(process.argv[1],'ready');setInterval(()=>{if(require('fs').existsSync(process.argv[2]))process.exit(0)},20)", ready, release]);
  t.after(() => holder.kill()); await waitFor(() => fs.existsSync(ready));
  assert.equal(lockBusy(lockPath(wt, root)), true); atomicJson(`${lockPath(wt, root)}.owner.json`, { pid: 999999, boot_id: 'stale' }); assert.equal(lockBusy(lockPath(wt, root)), true);
  fs.writeFileSync(release, 'yes'); await waitFor(() => !lockBusy(lockPath(wt, root))); assert.equal(lockBusy(lockPath(wt, root)), false);
});
test('PID reuse and cmdline mutation cannot establish ownership', () => {
  const identity = procIdentity(process.pid); assert.equal(sameProcess(identity), true);
  for (const changes of [{ boot_id: 'other-boot' }, { start_ticks: '0' }, { cmdline: ['other-worker'] }]) assert.equal(sameProcess({ ...identity, ...changes }), false);
});
test('status schema groups goals/lanes/tasks, unknown cost, redacted identity and unknown exit', t => {
  const root = temp(t); init(root); const wt = repo(root); const log_path = path.join(root, 'worker.jsonl'); fs.writeFileSync(log_path, fixture('codex'));
  atomicJson(taskPath('cp1', root), task(wt, { log_path, process_identity: { ...procIdentity(process.pid), start_ticks: '0' }, resume_text: 'private instructions' }));
  const s = collect(root); assert.equal(s.schema_version, 1); assert.equal(s.goals[0].lanes[0].tasks[0].id, 'cp1'); const row = s.tasks[0];
  assert.equal(row.state, 'done (unverified exit)'); assert.equal(row.design_state, 'awaiting_verification'); assert.ok(row.blockers.some(b => b.code === 'unknown_exit')); assert.equal(row.cost_so_far.known_amount, null); assert.ok(row.events_last_3.length <= 3); assert.equal(row.process_identity.cmdline, undefined); assert.equal(row.resume_text, undefined); assert.equal(row.estimate_ms.high, 600000);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'status.json'))), s);
  const s2 = collect(root); assert.equal(s2.revision, 2); assert.deepEqual(s2.changed_task_ids, []); assert.equal(s2.tasks[0].stream.offset, row.stream.offset);
  fs.writeFileSync(path.join(root, 'tasks', 'bad.json'), '{'); assert.equal(collect(root).warnings[0].code, 'task_read_error');
});
test('read-only adoption detects CLI without changing the worker or log', t => {
  const root = temp(t); init(root); const wt = repo(root); const log = path.join(root, 'log'); fs.writeFileSync(log, fixture('agy'));
  const before = digest(fs.readFileSync(log)); const adopted = adopt({ adopt: 'p1b', pid: process.pid, worktree: wt, log }, root);
  assert.equal(adopted.executor.cli, 'agy'); assert.equal(adopted.adopted, true); assert.equal(adopted.session_id.slice(-1), '3'); assert.equal(adopted.hard_timeout_ms, null); assert.equal(digest(fs.readFileSync(log)), before);
  assert.equal(collect(root).tasks[0].state, 'running'); assert.throws(() => adopt({ adopt: 'p1b', pid: process.pid, worktree: wt, log: path.join(root, 'missing') }, root));
});
test('HTTP view serves only status and static HTML; refuses writes and arbitrary files', async t => {
  const root = temp(t); fs.writeFileSync(path.join(root, 'status.json'), '{"schema_version":1}'); const server = createServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(url)).status, 200); assert.equal((await fetch(url + '/status.json')).status, 200);
  assert.equal((await fetch(url + '/status.json', { method: 'POST' })).status, 405); assert.equal((await fetch(url + '/tasks/cp1.json')).status, 404); assert.equal((await fetch(url + '/status.json', { method: 'HEAD' })).status, 200);
  fs.unlinkSync(path.join(root, 'status.json')); assert.equal((await fetch(url + '/status.json')).status, 503);
});
test('live systemd scope with fake CLI: launch, exclusion, stop, exact resume, timeout and descendants', async t => {
  const root = temp(t); init(root); const wt = repo(root); const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  // No model calls: this executable replaces codex for this process tree only.
  fs.writeFileSync(path.join(bin, 'codex'), `#!${process.execPath}
const fs=require('node:fs');const cp=require('node:child_process');
if(process.argv.includes('--version')){console.log('fake-codex 1');process.exit(0)}
fs.appendFileSync(process.env.FAKE_ARGS,JSON.stringify(process.argv.slice(2))+'\\n');
console.log(JSON.stringify({type:'thread.started',thread_id:'fake-exact-session'}));
const prompt=process.argv.at(-1);
if(prompt==='complete'){console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));process.exit(0)}
const child=cp.spawn('/bin/sleep',['1000'],{stdio:'ignore'});fs.writeFileSync(process.env.FAKE_DESCENDANT,String(child.pid));
setInterval(()=>{},1000);
`, { mode: 0o700 });
  const promptFile = path.join(root, 'prompt'); fs.writeFileSync(promptFile, 'wait');
  const env = { ...process.env, ORCH_STATE_DIR: root, PATH: bin + path.delimiter + process.env.PATH, FAKE_ARGS: path.join(root, 'args'), FAKE_DESCENDANT: path.join(root, 'descendant') };
  const call = async args => {
    let stdout = '', stderr = '';
    const child = spawn(process.execPath, [path.join(dir, 'dispatch.mjs'), ...args], { env });
    child.stdout.on('data', x => { stdout += x; }); child.stderr.on('data', x => { stderr += x; });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); }); return { code, stdout, stderr };
  };
  const startArgs = (id, seconds) => ['start', '--id', id, '--title', 'Fake worker', '--goal', 'test', '--lane', 'cp1', '--cli', 'codex', '--model', 'fake', '--effort', 'high', '--worktree', wt, '--prompt-file', promptFile, '--expected-minutes', '1', '--hard-timeout', String(seconds), '--resume-text', 'complete', '--memory-cap', '512M'];
  const load = id => JSON.parse(fs.readFileSync(taskPath(id, root), 'utf8'));
  t.after(async () => { for (const id of ['live', 'timeout']) { if (fs.existsSync(taskPath(id, root)) && sameProcess(load(id).supervisor_identity)) await call(['stop', id]); } });
  const observedLog = path.join(root, 'observed.jsonl'); fs.writeFileSync(observedLog, fixture('cursor'));
  adopt({ adopt: 'external', pid: process.pid, worktree: wt, log: observedLog }, root);
  const adoptedConflict = await call(startArgs('live', 30)); assert.equal(adoptedConflict.code, 1); assert.match(adoptedConflict.stderr, /live writer/);
  fs.unlinkSync(taskPath('external', root));
  const started = await call(startArgs('live', 30)); assert.equal(started.code, 0, started.stderr);
  await waitFor(() => load('live').session_id === 'fake-exact-session');
  const liveDescendant = await waitFor(() => fs.existsSync(env.FAKE_DESCENDANT) && procIdentity(Number(fs.readFileSync(env.FAKE_DESCENDANT, 'utf8'))));
  const second = await call(startArgs('second', 30)); assert.equal(second.code, 1); assert.match(second.stderr, /live writer/); assert.equal(fs.existsSync(taskPath('second', root)), false);
  const resumeLive = await call(['resume', 'live', 'complete']); assert.equal(resumeLive.code, 1); assert.match(resumeLive.stderr, /still running/);
  const stopped = await call(['stop', 'live']); assert.equal(stopped.code, 0, stopped.stderr); assert.equal(load('live').stop_requested, true); assert.equal(sameProcess(liveDescendant), false);
  const resumed = await call(['resume', 'live', 'complete']); assert.equal(resumed.code, 0, resumed.stderr); await waitFor(() => load('live').finished_at); assert.equal(load('live').state, 'done'); assert.equal(load('live').attempt_history.length, 1);
  const invocations = fs.readFileSync(env.FAKE_ARGS, 'utf8').trim().split('\n').map(JSON.parse); assert.deepEqual(invocations[1].slice(0, 3), ['exec', 'resume', 'fake-exact-session']);
  const timed = await call(startArgs('timeout', 1)); assert.equal(timed.code, 0, timed.stderr);
  const timeoutDescendant = await waitFor(() => { const identity = procIdentity(Number(fs.readFileSync(env.FAKE_DESCENDANT, 'utf8'))); return identity && identity.start_ticks !== liveDescendant.start_ticks ? identity : null; });
  await waitFor(() => load('timeout').finished_at, 15000); assert.equal(load('timeout').state, 'timeout'); assert.equal(sameProcess(timeoutDescendant), false);
  await waitFor(() => !lockBusy(lockPath(wt, root))); assert.equal(collect(root).tasks.find(x => x.id === 'timeout').state, 'timeout');
});
test('adoption of already exited PID retains report but cannot invent success', t => {
  const root = temp(t); init(root); const wt = repo(root); const log = path.join(root, 'log'); fs.writeFileSync(log, fixture('cursor'));
  fs.mkdirSync(path.join(wt, '.worker')); fs.writeFileSync(path.join(wt, '.worker', 'P1b-report.md'), 'Worker reported tests passed');
  const adopted = adopt({ adopt: 'p1b', pid: 2147483647, worktree: wt, log }, root); assert.equal(adopted.process_identity, null);
  const row = collect(root).tasks[0]; assert.equal(row.state, 'done (unverified exit)'); assert.equal(row.design_state, 'awaiting_verification'); assert.equal(row.artifacts[0].kind, 'completion_report'); assert.ok(row.completion_report.includes('Worker reported')); assert.equal(row.exit_code, null);
});
test('oversized lines stay bounded and never parse a discarded remainder as JSON', t => {
  const file = path.join(temp(t), 'log'); fs.writeFileSync(file, 'x'.repeat(1024 * 1024 + 100) + '\n' + fixture('codex'));
  let cache = readStream(file, 'codex'); assert.equal(cache.offset, 1024 * 1024); assert.equal(cache.skip_line, true); assert.ok(cache.backlog_bytes > 0);
  cache = readStream(file, 'codex', cache); assert.equal(cache.terminal, 'done'); assert.equal(cache.skip_line, false); assert.equal(cache.backlog_bytes, 0);
});
test('watch runs repeated zero-model collections under the collector singleton lock', async t => {
  const root = temp(t); init(root);
  const child = spawn(process.execPath, [path.join(dir, 'collect.mjs'), '--watch', '0.05'], { env: { ...process.env, ORCH_STATE_DIR: root }, stdio: 'ignore' });
  const exited = new Promise(resolve => child.on('exit', resolve)); t.after(async () => { child.kill('SIGTERM'); await exited; });
  const file = path.join(root, 'status.json'); await waitFor(() => fs.existsSync(file) && JSON.parse(fs.readFileSync(file)).revision >= 2);
  child.kill('SIGTERM'); await exited;
  await waitFor(() => !lockBusy(path.join(root, 'locks', 'collector.lock')));
  assert.deepEqual(JSON.parse(fs.readFileSync(file)).tasks, []);
});
test('status exposes recent stream tail while an incremental backlog catches up', t => {
  const root = temp(t); init(root); const wt = repo(root); const log_path = path.join(root, 'log');
  fs.writeFileSync(log_path, fixture('codex').split('\n')[0] + '\n' + 'x'.repeat(1024 * 1024 + 100) + '\n' + fixture('codex'));
  atomicJson(taskPath('cp1', root), task(wt, { log_path })); const row = collect(root).tasks[0];
  assert.ok(row.stream.backlog_bytes > 0); assert.equal(row.events_last_3.at(-1), 'turn.completed'); assert.ok(row.completion_report.includes('Reported:')); assert.equal(row.state, 'running');
});

test('regression: exec/title changes keep dispatched and adopted live rows running across ticks', async t => {
  const root = temp(t); init(root); const wt = repo(root); const log = path.join(root, 'live.jsonl');
  fs.writeFileSync(log, fixture('codex'));
  const child = spawn(process.execPath, ['-e', "console.log('ready');process.stdin.once('data',()=>{process.title='orch-exec-regression';console.log('changed')});setInterval(()=>{},1000)"], { stdio: ['pipe', 'pipe', 'ignore'] });
  const exited = new Promise(resolve => child.on('exit', resolve));
  t.after(async () => { child.kill(); await exited; });
  let output = ''; child.stdout.on('data', bytes => { output += bytes; });
  await waitFor(() => output.includes('ready'));
  const identity = procIdentity(child.pid);
  const dispatched = task(wt, { id: 'p1c-r', pid: child.pid, process_identity: identity, log_path: log, state: 'running' });
  atomicJson(taskPath('p1c-r', root), dispatched);
  adopt({ adopt: 'd1a', pid: child.pid, worktree: wt, log }, root);
  child.stdin.write('exec'); await waitFor(() => output.includes('changed'));
  assert.equal(sameProcess(identity), false); assert.equal(observedAlive(identity), true);
  for (let tick = 0; tick < 3; tick++) {
    fs.appendFileSync(log, '{"type":"turn.started"}\n');
    const snapshot = collect(root);
    assert.equal(snapshot.tasks.length, 2);
    for (const row of snapshot.tasks) { assert.equal(row.state, 'running'); assert.equal(row.health, 'live_process'); assert.ok(!row.blockers.some(b => b.code === 'unknown_exit')); }
  }
  for (const change of [{ boot_id: 'other' }, { start_ticks: '0' }]) assert.equal(observedAlive({ ...identity, ...change }), false);
});
test('regression: live identity outranks terminal records and unknown adopted exits never fail', () => {
  const now = Date.now(); const base = task('/example');
  for (const state of ['failed', 'timeout', 'done']) {
    const record = { ...base, state, finished_at: new Date(now).toISOString(), exit_code: 1 };
    assert.equal(classify(record, { alive: true, last_progress_at: new Date(now).toISOString() }, now), 'running');
    assert.equal(classify(record, { alive: true, last_progress_at: new Date(now - 301000).toISOString() }, now), 'stalled');
  }
  for (const finished_at of [null, new Date(now).toISOString()]) {
    const record = { ...base, adopted: true, state: 'failed', finished_at };
    assert.equal(classify(record, { alive: false, terminal: 'failed' }, now), 'exited (unknown)');
    assert.equal(classify(record, { alive: false, completion_report: 'Reported completion' }, now), 'done (unverified exit)');
  }
});
test('adopted exit without completion report is unknown even after a stream error', t => {
  const root = temp(t); init(root); const wt = repo(root); const log = path.join(root, 'log');
  fs.writeFileSync(log, '{"type":"turn.failed","error":{"message":"reported error"}}\n');
  adopt({ adopt: 'no-report', pid: 2147483647, worktree: wt, log }, root);
  const row = collect(root).tasks[0]; assert.equal(row.state, 'exited (unknown)'); assert.equal(row.design_state, 'unknown'); assert.equal(row.exit_code, null);
});
