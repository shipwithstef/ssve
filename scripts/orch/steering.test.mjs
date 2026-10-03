import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { init, readJson, atomicJson, taskPath, sleep, sameProcess, lockBusy, lockPath } from './common.mjs';
import { updateTaskRecord } from './interruption.mjs';
import { transact } from './goals.mjs';
import { collect } from './collect.mjs';
import { userMessage, enqueueSteer, consumeSteers, autoResumeBudget } from './steering.mjs';
import { html } from './serve.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
async function until(fn, ms = 12000) { const deadline = Date.now() + ms; while (Date.now() < deadline) { const value = fn(); if (value) return value; await sleep(25); } throw new Error('Fixture timed out'); }
async function fixture(t, cli = 'codex', extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'st1-')); init(root);
  const repo = name => { const dir = path.join(root, name); fs.mkdirSync(dir); assert.equal(spawnSync('git', ['init', '-q', dir]).status, 0); return dir; };
  const wt = repo('worker'), planning = repo('planning'), plan = path.join(planning, 'PLAN.md'); fs.writeFileSync(plan, '# Fake plan');
  await transact('create', { id: 'test', title: 'test', objective: 'fake', plan, codex_runs: 10, cursor_runs: 10, agy_runs: 10, claude_runs: 10, expected_revision: 0, ...extra }, root);
  await transact('grant-worktree', { id: 'test', worktree: wt, lane: 'build', expected_revision: 1 }, root);
  await transact('set-state', { id: 'test', state: 'active', expected_revision: 2 }, root);
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, 'systemd-run'), `#!${process.execPath}
const cp=require('node:child_process'),fs=require('node:fs');const args=process.argv.slice(2);const unit=args.find(a=>a.startsWith('--unit=')).slice(7);const child=cp.spawn(args[args.indexOf('--')+1],args.slice(args.indexOf('--')+2),{stdio:'inherit'});fs.writeFileSync(process.env.ORCH_STATE_DIR+'/'+unit,String(child.pid));child.on('exit',code=>process.exit(code??1));`, { mode: 0o700 });
  fs.writeFileSync(path.join(bin, 'systemctl'), `#!${process.execPath}
const fs=require('node:fs'),args=process.argv.slice(2);if(args.includes('is-active'))process.exit(3);const file=process.env.ORCH_STATE_DIR+'/'+args.at(-1);if(fs.existsSync(file)){try{process.kill(-Number(fs.readFileSync(file,'utf8')),args.some(a=>a==='--signal=KILL')?'SIGKILL':'SIGTERM')}catch{}}`, { mode: 0o700 });
  const fake = `#!${process.execPath}
const fs=require('node:fs'),readline=require('node:readline'),args=process.argv.slice(2),root=process.env.ORCH_STATE_DIR;
if(args.includes('--version')){console.log('fake-cli 1');process.exit(0)}
if(args[0]==='app-server'){console.log('experimental daemon proxy');process.exit(process.env.FAKE_PROBE_FAIL==='yes'?1:0)}
fs.appendFileSync(root+'/calls',JSON.stringify(args)+'\\n');
const cli=process.env.FAKE_CLI,id='exact-'+cli;
console.log(JSON.stringify(cli==='codex'?{type:'thread.started',thread_id:id}:cli==='agy'?{type:'init',conversation_id:id}:{type:'system',session_id:id}));
function message(text){fs.appendFileSync(root+'/messages',JSON.stringify(text)+'\\n');}
if(args.includes('--input-format')){
readline.createInterface({input:process.stdin}).on('line',line=>{const e=JSON.parse(line);message(e.message.content);console.log(JSON.stringify({type:'result',session_id:id,result:cli==='agy'?{status:'SUCCESS',conversation_id:id,response:'done'}:'done',subtype:'success'}));if(e.message.content==='finish')process.exit(0)});
}else{
const prompt=args.at(-1);message(prompt);
if(args.includes('resume')||args.includes('--resume')){if(prompt==='wait-again'){setInterval(()=>{},100)}else process.exit(0)}
else setInterval(()=>{if(fs.existsSync(root+'/release'))process.exit(fs.existsSync(root+'/fail')?1:0)},25);
}
process.on('SIGTERM',()=>process.exit(1));
`;
  for (const name of ['codex', 'cursor-agent', 'agy', 'claude']) fs.writeFileSync(path.join(bin, name), fake, { mode: 0o700 });
  const prompt = path.join(root, 'prompt'); fs.writeFileSync(prompt, 'initial');
  const config = path.join(root, 'config'); fs.mkdirSync(config); fs.writeFileSync(path.join(config, 'no-claude-autoresume'), '');
  const env = { ...process.env, ORCH_STATE_DIR: root, ORCH_CONFIG_DIR: config, PATH: bin + ':' + process.env.PATH, FAKE_CLI: cli };
  const call = async (args, script = 'dispatch.mjs') => {
    const child = spawn(process.execPath, [path.join(here, script), ...args], { env }); let out = '', err = '';
    child.stdout.on('data', chunk => out += chunk); child.stderr.on('data', chunk => err += chunk);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    return { code, out, err };
  };
  const load = () => readJson(taskPath('one', root));
  const lines = name => fs.existsSync(path.join(root, name)) ? fs.readFileSync(path.join(root, name), 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const start = async () => { const result = await call(['start', '--id', 'one', '--title', 'fake', '--goal', 'test', '--lane', 'build', '--cli', cli, '--model', cli === 'cursor' ? 'grok-4.7' : 'fake', '--effort', 'high', '--worktree', wt, '--prompt-file', prompt, '--expected-minutes', '1', '--hard-timeout', '60', '--resume-text', 'recover', '--memory-cap', '512M']); assert.equal(result.code, 0, result.err); await until(() => load()?.session_id); };
  const steer = async (text, now = false) => { const result = await call(['steer', 'one', text, ...(now ? ['--now'] : [])]); assert.equal(result.code, 0, result.err); return result; };
  const change = fn => updateTaskRecord('one', root, task => { fn(task); atomicJson(taskPath('one', root), task); });
  const idle = async () => { await until(() => load()?.finished_at && !sameProcess(load().supervisor_identity) && !lockBusy(lockPath(wt, root))); };
  t.after(async () => {
    const task = load();
    if (task && sameProcess(task.supervisor_identity)) await call(['stop', 'one']);
    if (task && sameProcess(task.process_identity)) { try { process.kill(-task.process_group, 'SIGKILL'); } catch {} }
    if (fs.existsSync(taskPath('one', root))) await until(() => !lockBusy(lockPath(wt, root)));
    fs.rmSync(root, { recursive: true, force: true });
  });
  return { root, wt, env, call, load, lines, start, steer, change, idle };
}
for (const cli of ['codex', 'cursor']) test(`${cli}: queued FIFO order auto-resumes exact session on done/failed, snapshots and no replay`, async t => {
  const f = await fixture(t, cli); await f.start();
  if (cli === 'cursor') fs.writeFileSync(path.join(f.root, 'fail'), '');
  const first = 'first $() `literal`\nline', second = 'second';
  await f.steer(first); await f.steer(second);
  assert.equal(f.lines('calls').length, 1); assert.deepEqual(f.load().steer_queue.map(e => e.text), [first, second]);
  assert.equal(f.load().steering.mode, 'queue');
  if (cli === 'codex') assert.equal(f.load().steering.app_server_help_available, true);
  const row = collect(f.root).tasks[0]; assert.deepEqual(row.queued_steers.map(e => e.text), [first, second]); assert.ok(html.includes('queued_steers'));
  fs.writeFileSync(path.join(f.root, 'release'), ''); await f.idle();
  assert.deepEqual(f.lines('messages'), ['initial', first + '\n\n' + second]);
  assert.equal(f.load().session_id, 'exact-' + cli); assert.equal(f.load().auto_resume_count, 1);
  assert.equal(f.load().attempt_history[0].state, cli === 'cursor' ? 'failed' : 'done'); assert.equal(f.load().steer_queue.length, 0);
  assert.equal(f.load().steer_deliveries.length, 2);
  const argv = f.lines('calls')[1]; assert.equal(argv[argv.indexOf(cli === 'codex' ? 'resume' : '--resume') + 1], 'exact-' + cli);
  await f.call([], 'recover.mjs'); await f.call([], 'recover.mjs'); assert.equal(f.lines('calls').length, 2);
  await f.steer('idle continuation'); await f.idle(); assert.equal(f.lines('messages').at(-1), 'idle continuation');
});
for (const cli of ['agy', 'claude']) test(`${cli}: live private FIFO delivers NDJSON without replacing the attempt`, async t => {
  const f = await fixture(t, cli); await f.start(); await until(() => f.lines('messages').length === 1);
  const original = f.load(); assert.equal(original.steering.mode, 'stdin'); assert.ok(fs.statSync(original.stdin_fifo).isFIFO()); assert.equal(fs.statSync(original.stdin_fifo).mode & 0o777, 0o600);
  const text = 'owner\'s $() `literal`\nsecond line'; await f.steer(text); await f.steer('second');
  await until(() => f.lines('messages').length === 3); assert.deepEqual(f.lines('messages'), ['initial', text, 'second']);
  assert.equal(f.lines('calls').length, 1); assert.equal(f.load().attempt_id, original.attempt_id); assert.equal(f.load().attempt_history.length, 0);
  assert.ok(f.lines('calls')[0].includes('--input-format')); assert.equal(f.load().steer_queue.length, 0); await until(() => f.load().steer_deliveries.every(e => e.state === 'sent'));
  await f.steer('finish'); await f.idle(); assert.equal(fs.existsSync(original.stdin_fifo), false);
});
for (const cli of ['codex', 'cursor', 'agy', 'claude']) test(`${cli}: --now gracefully stops then resumes once with ordered pending text`, async t => {
  const f = await fixture(t, cli); await f.start(); const original = f.load().attempt_id;
  if (['codex', 'cursor'].includes(cli)) await f.steer('pending');
  await f.steer(['agy', 'claude'].includes(cli) ? 'finish' : 'immediate', true); await f.idle();
  assert.equal(f.lines('calls').length, 2); assert.notEqual(f.load().attempt_id, original); assert.equal(f.load().attempt_history[0].state, 'stopped');
  assert.equal(f.load().session_id, 'exact-' + cli); assert.equal(f.load().steer_queue.length, 0);
  assert.equal(f.lines('messages').at(-1), ['agy', 'claude'].includes(cli) ? 'finish' : 'pending\n\nimmediate');
});
test('owner stop retains queued messages and never auto-resumes', async t => {
  const f = await fixture(t); await f.start(); await f.steer('pending'); assert.equal((await f.call(['stop', 'one'])).code, 0); await f.idle();
  assert.equal(f.lines('calls').length, 1); assert.equal(f.load().state, 'stopped'); assert.equal(f.load().steer_queue[0].text, 'pending');
});
for (const kind of ['stop', 'steer']) test(`CP3 ${kind}: changed confirmation attempt/session refuses before mutation`, async t => {
  const f = await fixture(t); await f.start();
  const original = f.load();
  for (const flags of [
    ['--expected-attempt', 'old-attempt', '--expected-session', original.session_id],
    ['--expected-attempt', original.attempt_id, '--expected-session', 'old-session']
  ]) {
    const result = await f.call([kind, 'one', ...(kind === 'steer' ? ['must not deliver'] : []), ...flags]);
    assert.equal(result.code, 1); assert.match(result.err, /Control (attempt|session) changed/);
    assert.equal(f.load().owner_stop_requested, false); assert.equal(f.load().steer_queue.length, 0);
    assert.equal(f.load().attempt_id, original.attempt_id); assert.equal(f.lines('calls').length, 1);
  }
  const unknown = await f.call([kind, 'one', ...(kind === 'steer' ? ['must not deliver'] : []), '--unknown', 'bad']);
  assert.equal(unknown.code, 1); assert.match(unknown.err, /Unknown control option/);
  const flags = ['--expected-attempt', original.attempt_id, '--expected-session', original.session_id];
  assert.equal((await f.call([kind, 'one', ...(kind === 'steer' ? ['accepted'] : []), ...flags])).code, 0);
  if (kind === 'steer') assert.equal(f.load().steer_queue[0].text, 'accepted');
  else { await f.idle(); assert.equal(f.load().state, 'stopped'); }
});
for (const hold of ['limit', 'goal', 'cap']) test(`queued auto-resume respects ${hold} and preserves undelivered messages`, async t => {
  const f = await fixture(t, 'codex', hold === 'cap' ? { codex_runs: 1 } : {}); await f.start(); await f.steer('pending');
  if (hold === 'limit') f.change(task => task.max_auto_resume = 0);
  if (hold === 'goal') await transact('set-state', { id: 'test', state: 'paused', expected_revision: 3 }, f.root);
  fs.writeFileSync(path.join(f.root, 'release'), ''); await f.idle();
  assert.equal(f.lines('calls').length, 1); assert.equal(f.load().steer_queue.length, 1); assert.ok(f.load().steering_blocker); assert.equal(f.load().steer_deliveries.length, 0);
  assert.ok(collect(f.root).tasks[0].blockers.some(e => e.code === 'steering_hold'));
});
test('crash then boot recovery never redelivers a claimed resume message', async t => {
  const f = await fixture(t); await f.start(); await f.steer('wait-again'); fs.writeFileSync(path.join(f.root, 'release'), '');
  await until(() => f.lines('messages').length === 2); const crashed = f.load(); assert.equal(crashed.steer_deliveries.length, 1);
  process.kill(crashed.supervisor_pid, 'SIGKILL'); process.kill(-crashed.process_group, 'SIGKILL');
  await until(() => !lockBusy(lockPath(f.wt, f.root)));
  f.change(task => { task.supervisor_identity.boot_id = 'prior-boot'; task.process_identity.boot_id = 'prior-boot'; });
  assert.equal((await f.call([], 'recover.mjs')).code, 0); await f.idle();
  assert.equal((await f.call([], 'recover.mjs')).code, 0);
  assert.deepEqual(f.lines('messages'), ['initial', 'wait-again', 'recover']); assert.equal(f.load().steer_deliveries.length, 1); assert.equal(f.load().auto_resume_count, 2);
});
test('live grant revocation holds FIFO delivery; owner can stop without losing pending text', async t => {
  const f = await fixture(t, 'agy'); await f.start(); await transact('set-state', { id: 'test', state: 'paused', expected_revision: 3 }, f.root); await f.steer('held');
  await until(() => f.load().steering_blocker); assert.deepEqual(f.lines('messages'), ['initial']); assert.equal(f.load().steer_queue.length, 1);
});
test('bounded queue and claim helpers preserve exact literal text and reject invalid budgets', () => {
  const task = { attempt_id: 'attempt' }; const a = enqueueSteer(task, 'a'), b = enqueueSteer(task, 'b');
  assert.equal(consumeSteers(task, [a.id, b.id], 'stdin'), 'a\n\nb'); assert.throws(() => consumeSteers(task, [a.id], 'stdin'), /changed/);
  assert.throws(() => enqueueSteer(task, ' ')); assert.throws(() => enqueueSteer(task, 'x'.repeat(8193)));
  assert.equal(JSON.parse(userMessage('a\nb')).message.content, 'a\nb');
  for (const changes of [{ max_auto_resume: -1 }, { auto_resume_count: 2 }, { auto_resume_count: '0' }, { paid: true }]) assert.throws(() => autoResumeBudget(changes));
});

test('Codex help probe refusal selects documented queue fallback', async t => {
  const f = await fixture(t); f.env.FAKE_PROBE_FAIL = 'yes'; await f.start();
  assert.equal(f.load().steering.mode, 'queue'); assert.equal(f.load().steering.app_server_help_available, false);
});
test('--now refuses a mismatching supervisor PID before any signal', async t => {
  const f = await fixture(t); await f.start(); const original = f.load().supervisor_pid;
  f.change(task => task.supervisor_pid = process.pid);
  const result = await f.call(['steer', 'one', 'retained', '--now']);
  assert.equal(result.code, 1); assert.match(result.err, /PID\/identity mismatch/);
  assert.equal(f.lines('calls').length, 1); assert.equal(f.load().steer_queue[0].text, 'retained');
  f.change(task => task.supervisor_pid = original);
});
test('live stdin delivery survives a simulated reboot without duplicate message replay', async t => {
  const f = await fixture(t, 'claude'); await f.start(); await f.steer('live-once');
  await until(() => f.load().steer_deliveries[0]?.state === 'sent'); const old = f.load();
  process.kill(old.supervisor_pid, 'SIGKILL');
  const scopePid = Number(fs.readFileSync(path.join(f.root, old.unit), 'utf8'));
  process.kill(-scopePid, 'SIGKILL');
  try { process.kill(-old.process_group, 'SIGKILL'); } catch {}
  await until(() => !lockBusy(lockPath(f.wt, f.root)));
  f.change(task => { task.supervisor_identity.boot_id = 'prior-boot'; task.process_identity.boot_id = 'prior-boot'; });
  assert.equal((await f.call([], 'recover.mjs')).code, 0);
  await until(() => f.lines('messages').includes('recover'));
  assert.equal((await f.call([], 'recover.mjs')).code, 0);
  assert.deepEqual(f.lines('messages'), ['initial', 'live-once', 'recover']);
  await f.steer('finish'); await f.idle();
});
test('large initial streaming prompt is written fully before live steering', async t => {
  const f = await fixture(t, 'agy'), text = 'card'.repeat(20000); fs.writeFileSync(path.join(f.root, 'prompt'), text);
  await f.start(); await until(() => f.lines('messages').length);
  await f.steer('finish'); await f.idle(); assert.deepEqual(f.lines('messages'), [text, 'finish']);
});
