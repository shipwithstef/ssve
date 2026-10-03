import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { publishUpdates, pushUpdate } from './collect.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-updates-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const status = { tasks: [{ id: 'task', attempt_id: 'one', goal_id: 'demo', lane: 'build', title: 'Ship\nthing token=secret', state: 'running', blockers: [] }], goals: [{ id: 'demo', title: 'Demo', desired_state: 'active', observed_state: 'active', blockers: [] }] };
  const now = Date.parse('2026-10-03T12:00:00Z');
  const publish = time => publishUpdates(status, root, root, time ?? now, () => {});
  const log = () => fs.readFileSync(path.join(root, 'updates.log'), 'utf8').trimEnd().split('\n');
  return { root, status, now, publish, log };
}
test('events deduplicate across reloads, sanitize titles, skip progress noise and retain last 20', t => {
  const { status, now, publish, log } = fixture(t);
  assert.equal(publish().length, 2);
  assert.equal(log()[0], '12:00 demo/build: Ship thing token=[redacted] started');
  status.tasks[0].elapsed_ms = 1000; publish(now + 60000); assert.equal(log().length, 2);
  for (const state of ['failed', 'interrupted', 'needs_owner', 'done']) {
    status.tasks[0].state = state; publish(); publish();
  }
  assert.deepEqual(log().slice(2).map(line => line.split(' ').at(-1)), ['failed', 'interrupted', 'blocked', 'done']);
  status.goals[0].observed_state = 'needs_owner'; publish(); publish();
  assert.match(log().at(-1), /demo\/goal: Demo \(needs_owner\) blocked$/);
  status.goals[0].desired_state = 'paused'; status.goals[0].observed_state = 'paused'; publish();
  for (let i = 0; i < 25; i++) { status.tasks[0].attempt_id = `attempt-${i}`; status.tasks[0].state = 'running'; publish(); }
  assert.equal(publish().length, 20); assert.ok(log().length > 20);
});
test('30 minute digests count UTC completions including history, ignore ticks, suppress inactive goals', t => {
  const { status, now, publish, log } = fixture(t);
  publish(); publish(now + 29 * 60000); assert.equal(log().length, 2);
  publish(now + 30 * 60000); assert.match(log().at(-1), /demo: 1 running, 0 done today, blockers: none$/);
  const size = log().length; publish(now + 60 * 60000); assert.equal(log().length, size);
  status.tasks[0].state = 'done'; status.tasks[0].finished_at = new Date(now).toISOString();
  status.tasks[0].attempt_history = [{ attempt_id: 'yesterday', state: 'done', finished_at: '2026-10-02T12:00:00Z' }, { attempt_id: 'one', state: 'done', finished_at: new Date(now).toISOString() }];
  status.goals[0].blockers = [{ code: 'owner', description: 'Review required' }];
  publish(now + 61 * 60000); publish(now + 90 * 60000);
  assert.match(log().at(-1), /demo: 0 running, 1 done today, blockers: Review required$/);
  status.goals[0].desired_state = 'paused'; publish(now + 91 * 60000);
  const paused = log().length; publish(now + 121 * 60000); assert.equal(log().length, paused);
});
test('write-ahead recovery finishes partial append without duplicate lines', t => {
  const { root, publish, log } = fixture(t); publish();
  const file = path.join(root, 'updates-cursor.json'); const cursor = JSON.parse(fs.readFileSync(file));
  const line = '12:01 demo/build: recovered done\n';
  cursor.pending = { offset: fs.statSync(path.join(root, 'updates.log')).size, text: line };
  cursor.recent.push(line.trim()); fs.writeFileSync(file, JSON.stringify(cursor));
  fs.appendFileSync(path.join(root, 'updates.log'), line.slice(0, 12));
  publish(); publish(); assert.equal(log().filter(x => x === line.trim()).length, 1);
  assert.equal(JSON.parse(fs.readFileSync(file)).pending, undefined);
});
test('optional ntfy skips absent/invalid config and failed push cannot fail collection', async t => {
  const { root, status, now } = fixture(t); const requests = [];
  const request = async (...args) => { requests.push(args); throw Error('offline'); };
  await pushUpdate('line', root, request); assert.equal(requests.length, 0);
  fs.writeFileSync(path.join(root, 'ntfy-topic'), 'private-topic\n'); await pushUpdate('line', root, request);
  assert.equal(requests[0][0], 'https://ntfy.sh/private-topic'); assert.equal(requests[0][1].body, 'line');
  assert.equal(requests[0][1].method, 'POST'); assert.ok(requests[0][1].signal);
  fs.writeFileSync(path.join(root, 'ntfy-topic'), 'bad/topic'); await pushUpdate('line', root, request); assert.equal(requests.length, 1);
  publishUpdates(status, root, root, now, () => { throw Error('offline'); });
  await new Promise(resolve => setImmediate(resolve));
});


test('short completed attempts retain start/finish events and removed goals emit once', t => {
  const { status, publish, log } = fixture(t);
  status.tasks[0].started_at = '2026-10-03T11:59:00Z';
  status.tasks[0].state = 'done';
  publish(); publish();
  assert.deepEqual(log().slice(0, 2).map(x => x.split(' ').at(-1)), ['started', 'done']);
  status.goals = []; publish(); publish();
  assert.equal(log().filter(x => x.includes('Goal removed interrupted')).length, 1);
});


test('goal registry lifecycle maps registered/closing/closed to truthful event labels', t => {
  const { status, publish, log } = fixture(t);
  status.tasks = [];
  for (const state of ['registered', 'active', 'paused', 'blocked', 'closing', 'closed']) {
    status.goals[0].desired_state = state; status.goals[0].observed_state = state; publish(); publish();
  }
  assert.deepEqual(log().map(x => x.split(' ').at(-1)), ['started', 'started', 'interrupted', 'blocked', 'started', 'done']);
});

test('hot reload applies event/goal/channel filters without replay; absent config creates zero-LLM defaults', t => {
  const { root, status, publish, now, log } = fixture(t);
  publish();
  const file = path.join(root, 'updates.json'); const settings = JSON.parse(fs.readFileSync(file));
  assert.equal(settings.summary.mode, 'none'); assert.equal(settings.summary.model, 'grok-4.7-medium');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  settings.events = ['failed']; settings.channels.log = false; settings.channels.web = false; settings.channels.pane = false;
  fs.writeFileSync(file, JSON.stringify(settings)); status.tasks[0].state = 'failed'; publish(now + 60000);
  assert.equal(log().length, 2); assert.match(publish(now + 60000).at(-1), /failed$/);
  assert.deepEqual(status.update_channels, { web: false, pane: false });
  settings.channels.log = true; settings.goals = ['other']; fs.writeFileSync(file, JSON.stringify(settings));
  status.tasks[0].attempt_id = 'next'; assert.deepEqual(publish(), []); assert.equal(log().length, 2);
  settings.goals = 'all'; settings.events = ['needs_owner']; fs.writeFileSync(file, JSON.stringify(settings));
  status.tasks[0].state = 'blocked'; publish(); assert.equal(log().length, 2);
  status.tasks[0].state = 'needs_owner'; publish(); assert.equal(log().length, 3);
  publish(); assert.equal(log().length, 3);
});

test('digest interval/change policy hot reload; quiet hours suppress push but retain local lines', async t => {
  const { root, status, now, publish, log } = fixture(t); publish();
  const file = path.join(root, 'updates.json'); const settings = JSON.parse(fs.readFileSync(file));
  settings.digest_minutes = 1; settings.digest_only_on_change = false; settings.quiet_hours = { start: '23:00', end: '13:00', timezone: 'UTC' };
  fs.writeFileSync(file, JSON.stringify(settings)); const pushes = [];
  publishUpdates(status, root, root, now + 60000, line => pushes.push(line));
  publishUpdates(status, root, root, now + 120000, line => pushes.push(line));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(pushes.length, 0); assert.equal(log().filter(x => x.includes('done today')).length, 2);
  settings.quiet_hours = null; settings.channels.ntfy_topic = 'test-topic'; fs.writeFileSync(file, JSON.stringify(settings));
  publishUpdates(status, root, root, now + 180000, (...args) => pushes.push(args));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(pushes[0][3], 'test-topic');
});

test('adopted observations never emit blocked or enter digest blockers, but durable tasks still do', t => {
  const { root, status, now, publish, log } = fixture(t);
  status.tasks[0] = { ...status.tasks[0], id: 'p1b', title: 'p1b', adopted: true, state: 'done (unverified exit)', info: [{ code: 'unknown_exit', description: 'Observed only' }] };
  publish(); assert.ok(log().some(line => /p1b \(unverified exit\) done$/.test(line)));
  for (const state of ['needs_owner', 'stalled', 'exited (unknown)']) { status.tasks[0].state = state; publish(); }
  assert.ok(!log().some(line => /p1b.*blocked$/.test(line)));
  publish(now + 30 * 60000); assert.match(log().at(-1), /blockers: none$/);
  status.tasks[0].adopted = false; status.tasks[0].state = 'needs_owner'; publish();
  assert.match(log().at(-1), /p1b blocked$/);
});


test('legacy adopted blocker labels leave retained views while append-only history is preserved', t => {
  const { root, status, publish, log } = fixture(t);
  status.tasks[0].title = 'p1b'; status.tasks[0].state = 'needs_owner'; publish();
  const legacy = log()[0]; assert.match(legacy, /p1b blocked$/);
  status.tasks[0].adopted = true; status.tasks[0].state = 'done (unverified exit)';
  const recent = publish();
  assert.ok(!recent.includes(legacy)); assert.ok(log().includes(legacy));
  assert.ok(recent.some(line => /p1b \(unverified exit\) done$/.test(line)));
});
