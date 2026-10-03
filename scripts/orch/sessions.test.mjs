import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { init, readJson, atomicJson, procIdentity, withLocks } from './common.mjs';
import { transact, readRegistry, goalUsage, admitTask } from './goals.mjs';
import { launchSession, attachSession, releaseSession, sessionFile, launchCommand, verifyLive, checkedSession, recoverySessions } from './sessions.mjs';
import { reconcileWake, acknowledgeWake, watchStatus, receiveMessage, deliveryBlocker, actionable } from './events.mjs';

async function fixture(t, role = 'child') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ho1-sessions-')); init(root);
  const planning = path.join(root, 'plan'); fs.mkdirSync(planning);
  assert.equal(spawnSync('git', ['init', '-q', planning]).status, 0); fs.writeFileSync(path.join(planning, 'PLAN.md'), '# plan');
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin);
  const fake = path.join(bin, 'claude');
  fs.writeFileSync(fake, `#!${process.execPath}
import fs from 'node:fs';
const root=process.env.FAKE_ROOT, args=process.argv.slice(2);
fs.appendFileSync(root+'/calls.jsonl',JSON.stringify({args,cwd:process.cwd()})+'\\n');
if(args[0]==='--resume' && args.length===2){if(process.env.FAKE_ATTACH_HOLD)setInterval(()=>{},1000);else process.exit(0);}
else {
const mode=process.env.FAKE_MODE;
if(mode==='trust')process.exit(7);
const stat=fs.readFileSync('/proc/'+process.pid+'/stat','utf8').split(') ')[1].split(' ');
fs.writeFileSync(root+'/native.pid',String(process.pid));
if(mode!=='lost') {
 const a={role:process.env.ORCH_ROLE,goal_id:process.env.ORCH_GOAL,generation:Number(process.env.ORCH_GENERATION),session_id:process.env.ORCH_SESSION_ID,
 launch_nonce:process.env.ORCH_LAUNCH_NONCE,contract:process.env.ORCH_CONTRACT,worktree:process.cwd(),effort:'low',model:'fake-claude',pid:process.pid,
 boot_id:fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim(),start_ticks:stat[19]};
 if(mode==='id')a.session_id='copied-id';if(mode==='cwd')a.worktree=root;if(mode==='low')a.effort='high';if(mode==='nonce')a.launch_nonce='foreign';
 if(mode==='pid'){const s=fs.readFileSync('/proc/'+process.ppid+'/stat','utf8').split(') ')[1].split(' ');a.pid=process.ppid;a.start_ticks=s[19];}
 const file=process.env.ORCH_ACK_FILE;fs.writeFileSync(file+'.tmp',JSON.stringify(a));fs.renameSync(file+'.tmp',file);
}
setInterval(()=>{},1000);
}
`, { mode: 0o700 });
  // Node treats extensionless scripts as ESM on this runtime.
  const saved = Object.fromEntries(['PATH', 'FAKE_ROOT', 'FAKE_MODE', 'ORCH_PRINCIPAL', 'ORCH_ROLE', 'ORCH_DEPTH'].map(k => [k, process.env[k]]));
  process.env.PATH = `${bin}:${process.env.PATH}`; process.env.FAKE_ROOT = root;
  delete process.env.FAKE_MODE; delete process.env.ORCH_PRINCIPAL; delete process.env.ORCH_ROLE; delete process.env.ORCH_DEPTH;
  t.after(() => {
    if (fs.existsSync(path.join(root, 'native.pid'))) { try { process.kill(Number(fs.readFileSync(path.join(root, 'native.pid'))), 'SIGTERM'); } catch {} }
    for (const [key, value] of Object.entries(saved)) { if (value == null) delete process.env[key]; else process.env[key] = value; }
    fs.rmSync(root, { recursive: true, force: true });
  });
  await transact('create', { id: 'one', title: 'One', objective: 'ship', plan: path.join(planning, 'PLAN.md'), claude_turn_cap: 5, expected_revision: 0 }, root);
  await transact('bind-parent', { id: 'one', parent_session: 'parent-exact', expected_revision: 1 }, root);
  if (role === 'child') await transact('set-state', { id: 'one', state: 'active', child_session: 'child-exact', child_principal: 'child-one', expected_revision: 2 }, root);
  const registry = readRegistry(root), authority = role === 'parent' ? registry.parent : { ...registry.goals[0].child, generation: registry.goals[0].generation };
  const o = { role, goal: 'one', generation: authority.generation, principal: authority.principal, session_id: authority.session_id,
    worktree: planning, contract: path.join(root, authority.contract_ref), live_verified: 'true' };
  const calls = () => fs.existsSync(path.join(root, 'calls.jsonl')) ? fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : [];
  const status = (revision = 1, state = 'running', extra = {}) => atomicJson(path.join(root, 'status.json'), { revision, registry_revision: registry.revision,
    goals: [{ id: 'one', desired_state: 'active', priority: 1, child: { session_id: o.session_id, generation: o.generation }, blockers: [] }],
    tasks: [{ id: 'one-a', goal_id: 'one', attempt_id: 'a', state }], ...extra });
  const live = async callback => {
    const controller = new AbortController(); let ready, failed;
    const readiness = new Promise((resolve, reject) => { ready = resolve; failed = reject; });
    const running = launchSession(o, { root, signal: controller.signal, ackTimeout: 2000, onReady: record => ready(record) });
    running.then(r => { if (r.state === 'needs_owner') failed(new Error(r.blocker)); }, failed);
    try {
      const record = await readiness; o.nonce = record.launch_nonce;
      return await callback(record, controller);
    } finally { controller.abort(); await running; }
  };
  return { root, planning, o, calls, status, live };
}

for (const role of ['parent', 'child']) test(`fake Claude ${role}: exact bg/LOW/contract/cwd, attach and lifetime launch fencing`, async t => {
  const f = await fixture(t, role);
  await f.live(async record => {
    assert.equal(record.state, 'idle'); assert.equal(record.effort, 'low'); assert.equal(record.usage.turns, null);
    const call = f.calls()[0]; assert.equal(call.cwd, f.planning);
    assert.deepEqual(call.args.slice(0, 8), ['--bg', '--effort', 'low', '--name', `orch-${role}-one`, '--session-id', f.o.session_id, call.args[7]]);
    assert.ok(call.args[7].includes(f.o.contract)); assert.ok(!call.args.includes('-p'));
    assert.equal(fs.statSync(sessionFile(role, 'one', f.root)).mode & 0o777, 0o600);
    await assert.rejects(launchSession(f.o, { root: f.root, ackTimeout: 50 }), /busy/);
    const preview = await attachSession(f.o, { root: f.root }); assert.deepEqual(preview.command, ['claude', '--resume', f.o.session_id]);
    const attached = await attachSession(f.o, { root: f.root, dryRun: false }); assert.equal(attached.code, 0);
    assert.deepEqual(f.calls()[1], { args: ['--resume', f.o.session_id], cwd: f.planning });
    await withLocks([path.join(f.root, 'locks', `attach-${role === 'parent' ? 'parent' : 'child-one'}.lock`)], async () => {
      await assert.rejects(attachSession(f.o, { root: f.root, dryRun: false }), /busy/);
    });
    for (const extra of [{ nonce: 'foreign' }, { generation: 0 }, { session_id: 'copied' }, { worktree: f.root }]) await assert.rejects(attachSession({ ...f.o, ...extra }, { root: f.root }));
    await assert.rejects(transact(role === 'parent' ? 'bind-parent' : 'set-state', { id: 'one', expected_revision: readRegistry(f.root).revision,
      state: 'paused', parent_session: 'replacement', child_session: 'replacement', child_principal: 'other' }, f.root), /handoff/);
  });
  assert.equal(readJson(sessionFile(role, 'one', f.root)).state, 'needs_owner');
  await assert.rejects(launchSession(f.o, { root: f.root, ackTimeout: 50 }), /held/); assert.equal(f.calls().length, 2);
  await assert.rejects(attachSession(f.o, { root: f.root }), /verified/);
});
for (const mode of ['lost', 'id', 'cwd', 'low', 'nonce', 'pid', 'trust']) test(`fake Claude ${mode}: hold intent; never retry lost/invalid acknowledgement`, async t => {
  const f = await fixture(t); process.env.FAKE_MODE = mode;
  const record = await launchSession(f.o, { root: f.root, ackTimeout: mode === 'trust' ? 150 : 500 });
  assert.equal(record.state, 'needs_owner'); assert.ok(record.launch_nonce); assert.ok(record.blocker);
  await assert.rejects(launchSession(f.o, { root: f.root, ackTimeout: 50 }), /held/); assert.equal(f.calls().length, 1);
});
test('live disabled by default; child/grandchild launch and foreign contracts rejected before spawn', async t => {
  const f = await fixture(t);
  for (const extra of [{ live_verified: null }, { session_id: '../../escape' }, { generation: 1 }, { contract: 'relative' }, { principal: 'foreign' }]) await assert.rejects(launchSession({ ...f.o, ...extra }, { root: f.root }));
  process.env.ORCH_ROLE = 'child'; process.env.ORCH_DEPTH = '1';
  await assert.rejects(launchSession(f.o, { root: f.root }), /Only parent/); assert.equal(f.calls().length, 0);
});
test('verify-live --dry-run prints exact runnable shell commands and performs no launch/state writes', async t => {
  const f = await fixture(t);
  const before = fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8');
  const commands = verifyLive(f.o, f.root);
  assert.ok(commands.includes("'--bg' '--effort' 'low' '--name' 'orch-child-one'"));
  assert.ok(commands.includes("'claude' '--resume' 'child-exact'")); assert.ok(commands.includes(f.o.contract)); assert.ok(commands.includes(f.planning));
  assert.equal(f.calls().length, 0); assert.equal(fs.existsSync(path.join(f.root, 'sessions')), false);
  assert.equal(fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8'), before);
  const cli = spawnSync(process.execPath, [path.join(import.meta.dirname, 'sessions.mjs'), 'verify-live', '--dry-run',
    ...Object.entries(f.o).filter(([k]) => k !== 'live_verified').flatMap(([k, v]) => ['--' + k.replaceAll('_', '-'), String(v)])], { env: { ...process.env, ORCH_STATE_DIR: f.root }, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr); assert.equal(f.calls().length, 0);
});
test('Monitor coalesces bursts, isolates goals and excludes 24 hours of idle heartbeats/renewal', async t => {
  const f = await fixture(t);
  await f.live(async () => {
    f.status(); const first = await reconcileWake(f.o, f.root); await acknowledgeWake(f.o, first.id, f.root);
    const wakes = []; const monitor = watchStatus(f.o, { root: f.root, durationMs: 10000, emit: e => wakes.push(e) });
    const duplicate = watchStatus(f.o, { root: f.root, durationMs: 10000, emit: e => wakes.push(e) });
    await assert.rejects(duplicate.done, /busy/);
    // 5,760 fifteen-second heartbeat samples have one actionable fingerprint.
    const original = actionable(readJson(path.join(f.root, 'status.json')), f.o);
    for (let i = 0; i < 5760; i++) {
      const idle = { ...readJson(path.join(f.root, 'status.json')), generated_at: new Date(i * 15000).toISOString(), revision: i + 2 };
      idle.tasks[0].elapsed_ms = i * 15000; idle.tasks[0].last_heartbeat_at = idle.generated_at;
      assert.deepEqual(actionable(idle, f.o), original);
    }
    f.status(6000, 'running', { collector_heartbeat_at: '24h', changed_goal_ids: ['other'] });
    await delay(100); assert.equal(wakes.length, 0);
    f.status(6001, 'done'); f.status(6002, 'done'); f.status(6003, 'done');
    await delay(150); assert.equal(wakes.length, 1);
    await monitor.rescan(); await monitor.rescan(); assert.equal(wakes.length, 1);
    await acknowledgeWake(f.o, wakes[0].id, f.root); await delay(80);
    assert.equal(await reconcileWake(f.o, f.root), null); await monitor.close();
    assert.equal(f.calls().length, 1); // No bridge model/API calls, only original bg launch.
  });
});
test('reload/overflow replay one pending ID; ack preserves changes received while busy', async t => {
  const f = await fixture(t);
  await f.live(async () => {
    f.status(); const first = await reconcileWake(f.o, f.root);
    const wakes = [], nativeWatchers = [], watcher = watchStatus(f.o, { root: f.root, emit: e => wakes.push(e), durationMs: 10000,
      watcherFactory: (...args) => { const w = fs.watch(...args); nativeWatchers.push(w); return w; } });
    await delay(80); assert.equal(wakes[0].id, first.id);
    await watcher.rescan(); await watcher.rescan(); assert.equal(wakes.length, 1);
    nativeWatchers[0].emit('error', new Error('simulated overflow')); await delay(80);
    assert.equal(wakes.length, 1); assert.match(readJson(path.join(f.root, 'events', 'child-one.json')).blocker, /overflow/);
    f.status(2, 'done'); await delay(80); assert.equal(wakes.length, 1);
    await acknowledgeWake(f.o, first.id, f.root); await delay(100);
    assert.equal(wakes.length, 2); assert.notEqual(wakes[1].id, first.id); await watcher.close();
    const replay = [], reloaded = watchStatus(f.o, { root: f.root, emit: e => replay.push(e), durationMs: 10000 });
    await delay(80); assert.equal(replay.length, 1); assert.equal(replay[0].id, wakes[1].id);
    await acknowledgeWake(f.o, replay[0].id, f.root); await delay(80); assert.equal(await reconcileWake(f.o, f.root), null);
    await reloaded.close(); await assert.rejects(acknowledgeWake(f.o, first.id, f.root), /Stale/);
  });
});
test('supervisor observes count checkpoints from files; resumed duplicates count once and unknown stays unknown', async t => {
  const f = await fixture(t);
  await f.live(async record => {
    assert.equal(goalUsage('one', f.root).claude.turns, null);
    const file = path.join(f.root, 'requests', `${record.launch_nonce}.observation.json`);
    const checkpoint = { launch_nonce: record.launch_nonce, session_id: record.session_id, generation: record.generation, turns: 2 };
    atomicJson(file, checkpoint); await delay(50);
    assert.equal(goalUsage('one', f.root).claude.turns, 2);
    atomicJson(file, checkpoint); await delay(50); assert.equal(goalUsage('one', f.root).claude.turns, 2);
    atomicJson(file, { ...checkpoint, turns: 1 }); await delay(50);
    assert.equal(readJson(sessionFile('child', 'one', f.root)).state, 'needs_owner');
    assert.equal(goalUsage('one', f.root).claude.turns, 2);
  });
});
test('explicit release/new generation archives pending cursor; stale events cannot wake replacement', async t => {
  const f = await fixture(t);
  let oldId;
  await f.live(async () => { f.status(); oldId = (await reconcileWake(f.o, f.root)).id; });
  const file = sessionFile('child', 'one', f.root), old = readJson(file);
  process.kill(old.process_identity.pid, 'SIGTERM'); await delay(50);
  old.supervisor_identity = { pid: 2147483647 }; atomicJson(file, old);
  await releaseSession({ ...f.o, native_stopped: 'true' }, f.root);
  await transact('set-state', { id: 'one', state: 'paused', expected_revision: 3 }, f.root);
  const r = await transact('set-state', { id: 'one', state: 'active', child_session: 'new-child', child_principal: 'child-one', expected_revision: 4 }, f.root);
  f.o.generation = r.goals[0].generation; f.o.session_id = 'new-child'; f.o.contract = path.join(f.root, r.goals[0].child.contract_ref);
  await f.live(async () => {
    f.status(2); const event = await reconcileWake(f.o, f.root); assert.notEqual(event.id, oldId);
    assert.ok(fs.existsSync(path.join(f.root, 'events', 'archive', 'child-one-2.json')));
    await assert.rejects(acknowledgeWake(f.o, oldId, f.root), /Stale/);
  });
});
test('Monitor 30-minute maximum, single expiry, unreadable status retains last cursor', async t => {
  const f = await fixture(t);
  await f.live(async () => {
    f.status(); const event = await reconcileWake(f.o, f.root); await acknowledgeWake(f.o, event.id, f.root);
    assert.throws(() => watchStatus(f.o, { root: f.root, durationMs: 1800001 }), /30 min/);
    // The same one-shot expiry path, accelerated to avoid a paid/wall-time wait.
    const emitted = [], watcher = watchStatus(f.o, { root: f.root, durationMs: 35, emit: e => emitted.push(e) });
    assert.equal(await watcher.done, 'monitor_expired'); assert.equal(emitted.length, 0);
    const stateFile = path.join(f.root, 'events', 'child-one.json');
    assert.equal(readJson(stateFile).attention_pending, true); assert.match(readJson(stateFile).blocker, /expired/);
    const before = fs.readFileSync(stateFile, 'utf8'); fs.writeFileSync(path.join(f.root, 'status.json'), '{');
    await assert.rejects(reconcileWake(f.o, f.root)); assert.equal(fs.readFileSync(stateFile, 'utf8'), before);
  });
});
test('message dedup, exact durable counterparts, stale/foreign directions, refused inbox and 12-hour expiry', async t => {
  const f = await fixture(t);
  await f.live(async () => {
    const registry = readRegistry(f.root), msg = { v: 1, id: 'decision-1', type: 'DECISION', goal_id: 'one', generation: f.o.generation, registry_revision: registry.revision, ref: 'decisions/one-1.json', summary: 'Reconcile committed decision' };
    const accepted = { root: f.root, senderSession: 'parent-exact', durable: () => true, now: 0, notifyUntil: 12 * 3600000 };
    assert.equal((await receiveMessage(f.o, msg, { ...accepted, delivery: 'refused' })).held, 'inbox_refused');
    assert.equal((await receiveMessage(f.o, msg, { ...accepted, now: 12 * 3600000 + 1 })).held, 'notification_expired');
    assert.equal((await receiveMessage(f.o, msg, { ...accepted, notifyUntil: null, now: 12 * 3600000 + 1 })).held, 'notification_expired');
    assert.equal((await receiveMessage(f.o, msg, { ...accepted, notifyUntil: 12 * 3600000 + 1 })).held, 'notification_expired');
    assert.equal((await receiveMessage(f.o, msg, { ...accepted, durable: () => false })).ignored, 'missing_durable_counterpart');
    assert.equal((await receiveMessage(f.o, msg, { ...accepted, senderSession: 'foreign' })).ignored, 'foreign_direction');
    for (const extra of [{ generation: 0 }, { goal_id: 'other' }, { registry_revision: 0 }]) assert.equal((await receiveMessage(f.o, { ...msg, ...extra }, accepted)).ignored, 'stale_or_foreign');
    assert.equal((await receiveMessage(f.o, msg, accepted)).reconciled, true);
    assert.equal((await receiveMessage(f.o, msg, accepted)).ignored, 'duplicate');
    await assert.rejects(receiveMessage(f.o, { ...msg, summary: 'x'.repeat(1024) }, accepted), /envelope/);
    await assert.rejects(receiveMessage(f.o, { ...msg, summary: Array(11).fill('x').join('\n') }, accepted), /envelope/);
  });
});
test('parent accepts only durable child escalation; release requires dead identities and native owner evidence', async t => {
  const f = await fixture(t, 'parent');
  await f.live(async () => {
    // Bind a child AFTER parent; no new session is actually launched.
    await transact('set-state', { id: 'one', state: 'active', child_session: 'child-exact', child_principal: 'child-one', expected_revision: 2 }, f.root);
    const msg = { v: 1, id: 'blocker-1', type: 'DECISION_REQUIRED', goal_id: 'one', generation: 2, registry_revision: 3, ref: 'BOARD.md#blocker', summary: 'Budget decision required' };
    assert.equal((await receiveMessage(f.o, msg, { root: f.root, senderSession: 'child-exact', durable: () => true })).reconciled, true);
    await assert.rejects(releaseSession({ ...f.o, native_stopped: 'true' }, f.root), /busy|dead/);
  });
  await assert.rejects(releaseSession({ ...f.o, native_stopped: 'true' }, f.root), /dead/);
  // Test crash/reboot identities rather than terminating this test process.
  const file = sessionFile('parent', 'one', f.root), record = readJson(file);
  record.supervisor_identity = { pid: 2147483647 }; record.process_identity = { pid: 2147483647 }; atomicJson(file, record);
  await assert.rejects(releaseSession(f.o, f.root), /owner/);
  assert.equal((await releaseSession({ ...f.o, native_stopped: 'true' }, f.root)).state, 'released');
  await assert.rejects(transact('bind-parent', { id: 'one', parent_session: 'new-parent', expected_revision: 3 }, f.root), /released children/);
  await transact('set-state', { id: 'one', state: 'paused', expected_revision: 3 }, f.root);
  atomicJson(sessionFile('child', 'one', f.root), { state: 'released', supervisor_identity: null, process_identity: null });
  const rebound = await transact('bind-parent', { id: 'one', parent_session: 'new-parent', expected_revision: 4 }, f.root);
  assert.equal(rebound.parent.session_id, 'new-parent'); assert.equal(rebound.goals[0].child.session_id, null);
  assert.equal(rebound.goals[0].generation, 3); assert.ok(fs.existsSync(path.join(f.root, rebound.parent.contract_ref)));
});
test('actual fake handshake and observed counts admit child dispatch; supervisor loss holds new work', async t => {
  const f = await fixture(t);
  const worker = path.join(f.root, 'worker'); fs.mkdirSync(worker); assert.equal(spawnSync('git', ['init', '-q', worker]).status, 0);
  await transact('set-state', { id: 'one', state: 'active', codex_runs: 2, expected_revision: 3 }, f.root);
  await transact('grant-worktree', { id: 'one', lane: 'build', worktree: worker, expected_revision: 4 }, f.root);
  await f.live(async record => {
    const task = { id: 'one-a', attempt_id: 'attempt-a', goal_id: 'one', lane: 'build', worktree: worker, executor: { cli: 'codex' },
      child_session: f.o.session_id, child_principal: f.o.principal, child_depth: 1, goal_generation: f.o.generation };
    await assert.rejects(admitTask(task, f.root), /unknown/);
    atomicJson(path.join(f.root, 'requests', `${record.launch_nonce}.observation.json`), { launch_nonce: record.launch_nonce, session_id: record.session_id, generation: record.generation, turns: 0 });
    await delay(80); assert.equal((await admitTask(task, f.root)).id, 'one-a');
    const file = sessionFile('child', 'one', f.root); atomicJson(file, { ...readJson(file), state: 'needs_owner' });
    await assert.rejects(admitTask({ ...task, id: 'one-b', attempt_id: 'attempt-b' }, f.root), /acknowledged/);
  });
});
test('lost ack reconciles same nonce/session without another Claude launch', async t => {
  const f = await fixture(t); process.env.FAKE_MODE = 'lost';
  const old = await launchSession(f.o, { root: f.root, ackTimeout: 250 });
  const identity = procIdentity(Number(fs.readFileSync(path.join(f.root, 'native.pid'))));
  old.supervisor_identity = { pid: 2147483647 }; atomicJson(sessionFile('child', 'one', f.root), old);
  const ack = { role: old.role, goal_id: old.goal_id, generation: old.generation, session_id: old.session_id, launch_nonce: old.launch_nonce,
    contract: old.contract, worktree: old.worktree, effort: 'low', model: 'fake-claude', pid: identity.pid, boot_id: identity.boot_id, start_ticks: identity.start_ticks };
  atomicJson(path.join(f.root, 'requests', `${old.launch_nonce}.session-ack.json`), ack);
  const controller = new AbortController(); let ready = false;
  const result = await launchSession({ ...f.o, reconcile: 'true', nonce: old.launch_nonce }, { root: f.root, signal: controller.signal, ackTimeout: 250,
    onReady: record => { ready = true; assert.equal(record.session_id, old.session_id); assert.equal(record.launch_nonce, old.launch_nonce); controller.abort(); } });
  assert.ok(ready); assert.equal(result.state, 'needs_owner'); assert.equal(f.calls().length, 1);
});

for (const role of ['parent', 'child']) test(`HO1 owner ${role} commands: live bare attach; stopped exact transcript with restored LOW/plugin/contract`, async t => {
  const f = await fixture(t, role);
  let pending;
  await f.live(async () => {
    f.status(); pending = await reconcileWake(f.o, f.root);
    const entry = recoverySessions(f.root).find(s => s.role === role);
    assert.equal(entry.auto_start, false);
    const attach = spawnSync('bash', ['-c', entry.attach_command], { encoding: 'utf8', timeout: 5000 });
    assert.equal(attach.status, 0, attach.stderr);
    assert.deepEqual(f.calls()[1], { args: ['--resume', f.o.session_id], cwd: f.planning });
    // A living native transcript/supervisor excludes any second writer.
    await assert.rejects(launchSession({ ...f.o, resume: 'true', native_stopped: 'true' }, { root: f.root }), /busy/);
  });
  const file = sessionFile(role, 'one', f.root), old = readJson(file);
  process.kill(old.process_identity.pid, 'SIGTERM'); await delay(50);
  old.supervisor_identity = { pid: 2147483647 }; atomicJson(file, old);
  const o = { ...f.o, resume: 'true', nonce: old.launch_nonce };
  await assert.rejects(launchSession(o, { root: f.root }), /owner-verified/);
  await assert.rejects(launchSession({ ...o, nonce: 'foreign', native_stopped: 'true' }, { root: f.root }), /exact/);
  const controller = new AbortController(); let restored = false, wakeError;
  const result = await launchSession({ ...o, native_stopped: 'true' }, { root: f.root, signal: controller.signal, ackTimeout: 1000,
    onReady: async record => {
      restored = true; assert.equal(record.session_id, old.session_id); assert.equal(record.generation, old.generation);
      assert.equal(record.worktree, old.worktree); assert.equal(record.contract, old.contract); assert.equal(record.principal, old.principal);
      assert.notEqual(record.launch_nonce, old.launch_nonce); assert.equal(record.resume_from_nonce, old.launch_nonce);
      try {
        const rebound = { ...f.o, nonce: record.launch_nonce };
        const replay = await reconcileWake(rebound, f.root); assert.equal(replay.id, pending.id);
        await acknowledgeWake(rebound, pending.id, f.root); assert.equal(await reconcileWake(rebound, f.root), null);
      } catch (e) { wakeError = e; } finally { controller.abort(); }
    } });
  assert.ifError(wakeError); assert.ok(restored, result.blocker);
  const call = f.calls().at(-1);
  assert.deepEqual(call.args.slice(0, 5), ['--resume', old.session_id, '--effort', 'low', '--plugin-dir']);
  assert.ok(call.args[5].endsWith('/mods/orchestrator-pane')); assert.ok(call.args.includes('--bg')); assert.equal(call.args[call.args.indexOf('--model') + 1], old.model); assert.equal(call.cwd, f.planning);
  assert.ok(call.args.at(-1).includes(old.contract)); assert.ok(call.args.at(-1).includes('SR1 recovery receipt'));
});

test('collector goal health, pending cursor and count blockers; heartbeat-only updates do not change goals', async t => {
  const f = await fixture(t);
  const { collect } = await import('./collect.mjs');
  await f.live(async record => {
    const file = sessionFile('child', 'one', f.root);
    let status = collect(f.root);
    assert.equal(status.goals[0].child.health, 'live'); assert.equal(status.goals[0].observed_state, 'active');
    assert.ok(status.goals[0].blockers.some(b => b.code === 'budget_unknown'));
    const saved = readJson(file); saved.last_heartbeat_at = new Date().toISOString(); atomicJson(file, saved);
    status = collect(f.root); assert.deepEqual(status.changed_goal_ids, []);
    atomicJson(path.join(f.root, 'events', 'child-one.json'), { generation: record.generation, session_id: record.session_id, launch_nonce: record.launch_nonce, attention_pending: true, blocker: 'Monitor expired' });
    status = collect(f.root); assert.equal(status.goals[0].child.attention_pending, true);
    assert.ok(status.goals[0].blockers.some(b => b.description === 'Monitor expired'));
    saved.last_heartbeat_at = new Date(Date.now() - 60000).toISOString(); atomicJson(file, saved);
    status = collect(f.root); assert.equal(status.goals[0].child.health, 'suspected_loss'); assert.equal(status.goals[0].observed_state, 'needs_owner');
    saved.generation++; atomicJson(file, saved); status = collect(f.root);
    assert.equal(status.goals[0].child.state, 'needs_owner'); assert.equal(status.orchestrators.find(s => s.role === 'child').resume_command, null);
  });
});
