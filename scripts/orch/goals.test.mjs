import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { init, atomicJson, taskPath, procIdentity } from './common.mjs';
import { transact, readRegistry, admitTask, childContract, validateChild, goalUsage } from './goals.mjs';
import { collect } from './collect.mjs';
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ho1-')); init(root);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repo = name => { const wt = path.join(root, name); fs.mkdirSync(wt); assert.equal(spawnSync('git', ['init', '-q', wt]).status, 0); return wt; };
  const planning = repo('plan'); fs.writeFileSync(path.join(planning, 'PLAN.md'), '# plan');
  return { root, planning, repo, create: (id = 'one', extra = {}) => transact('create', { id, title: id, objective: 'ship', plan: path.join(planning, 'PLAN.md'), expected_revision: 0, claude_turn_cap: 10, codex_runs: 2, ...extra }, root) };
}
test('concurrent parent transactions yield one revision; stale/foreign/depth writes fail', async t => {
  const f = fixture(t); await f.create();
  const results = await Promise.allSettled([1, 2].map(priority => transact('set-priority', { id: 'one', priority, expected_revision: 1 }, f.root)));
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1); assert.equal(readRegistry(f.root).revision, 2);
  for (const extra of [{ role: 'child' }, { depth: 2 }, { principal: 'foreign' }, { expected_revision: 0 }]) {
    await assert.rejects(transact('set-state', { id: 'one', state: 'active', expected_revision: 2, ...extra }, f.root));
  }
  assert.equal(fs.statSync(path.join(f.root, 'goals.json')).mode & 0o777, 0o600);
});
test('canonical grants deny aliases, nested paths and planning ownership; child uses existing plan worktree', async t => {
  const f = fixture(t); await f.create(); const wt = f.repo('worker');
  await transact('grant-worktree', { id: 'one', worktree: wt, lane: 'build', expected_revision: 1 }, f.root);
  const alias = path.join(f.root, 'alias'); fs.symlinkSync(wt, alias);
  await assert.rejects(transact('grant-worktree', { id: 'one', worktree: alias, lane: 'other', expected_revision: 2 }, f.root), /conflict/);
  const nested = path.join(wt, 'nested'); fs.mkdirSync(nested); spawnSync('git', ['init', '-q', nested]);
  await assert.rejects(transact('grant-worktree', { id: 'one', worktree: nested, lane: 'other', expected_revision: 2 }, f.root), /conflict/);
  await assert.rejects(transact('grant-worktree', { id: 'one', worktree: f.planning, lane: 'other', expected_revision: 2 }, f.root), /conflict/);
  const goal = readRegistry(f.root).goals[0]; const contract = childContract(goal, readRegistry(f.root));
  assert.equal(contract.planning_worktree, f.planning); assert.equal(contract.spawn_orchestrators, false);
  for (const extra of [{ generation: 0 }, { goal_id: 'foreign' }, { depth: 2 }, { planning_worktree: wt }]) assert.throws(() => validateChild(goal, { ...contract, ...extra }));
  fs.writeFileSync(path.join(f.planning, 'outside'), ''); fs.symlinkSync(path.join(f.planning, 'outside'), path.join(wt, 'linked'));
  await assert.rejects(transact('grant-worktree', { id: 'one', worktree: wt, lane: 'other', paths: '["linked"]', expected_revision: 2 }, f.root));
});
test('large grant listings succeed and still reject tracked and untracked escaping links', async t => {
  const f = fixture(t); await f.create(); const wt = f.repo('large-worker');
  fs.mkdirSync(path.join(wt, 'scripts'));
  for (let i = 0; i < 800; i++) fs.writeFileSync(path.join(wt, 'scripts', `${String(i).padStart(4, '0')}-${'x'.repeat(180)}`), '');
  const listing = spawnSync('git', ['-C', wt, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { maxBuffer: 1024 * 1024 });
  assert.equal(listing.status, 0); assert.ok(listing.stdout.length > 128 * 1024);
  const args = { id: 'one', worktree: wt, lane: 'build', paths: '["scripts"]', expected_revision: 1 };
  const before = fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8');
  const escape = path.join(wt, 'scripts', 'zz-escape');
  fs.symlinkSync(path.join(f.planning, 'PLAN.md'), escape);
  await assert.rejects(transact('grant-worktree', args, f.root), /Linked file escapes grant/);
  assert.equal(spawnSync('git', ['-C', wt, 'add', 'scripts/zz-escape']).status, 0);
  await assert.rejects(transact('grant-worktree', args, f.root), /Linked file escapes grant/);
  assert.equal(spawnSync('git', ['-C', wt, 'rm', '--cached', 'scripts/zz-escape']).status, 0);
  fs.unlinkSync(escape);
  // A leading space in the first filename must survive enumeration unchanged.
  const first = path.join(wt, ' leading-escape');
  fs.symlinkSync(path.join(f.planning, 'PLAN.md'), first);
  await assert.rejects(transact('grant-worktree', { ...args, paths: '["."]' }, f.root), /Linked file escapes grant/);
  fs.unlinkSync(first);
  assert.equal(fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8'), before);
  const registry = await transact('grant-worktree', args, f.root);
  assert.equal(registry.revision, 2);
  assert.deepEqual(readRegistry(f.root).goals[0].grants[0].paths, ['scripts']);
});
test('grant inspection reports Git failures and buffer overflow without writing the registry', async t => {
  const f = fixture(t); await f.create(); const wt = f.repo('worker');
  const bin = path.join(f.root, 'bin'); fs.mkdirSync(bin);
  const realGit = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
  fs.writeFileSync(path.join(bin, 'git'), `#!/bin/sh
for arg do
  if [ "$arg" = ls-files ]; then
    if [ "$GRANTFIX_OVERFLOW" = yes ]; then
      exec "$GRANTFIX_NODE" -e 'process.stdout.write(Buffer.alloc(9 * 1024 * 1024))'
    fi
    echo 'grant inspection fixture failure' >&2
    exit 73
  fi
done
exec "$GRANTFIX_REAL_GIT" "$@"
`, { mode: 0o700 });
  const before = fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8');
  for (const overflow of ['no', 'yes']) {
    const result = spawnSync(process.execPath, [path.resolve('scripts/orch/goals.mjs'), 'grant-worktree', '--id', 'one', '--lane', 'build', '--worktree', wt, '--expected-revision', '1'], {
      encoding: 'utf8', env: { ...process.env, ORCH_STATE_DIR: f.root, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GRANTFIX_REAL_GIT: realGit, GRANTFIX_NODE: process.execPath, GRANTFIX_OVERFLOW: overflow }
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Cannot inspect grant paths/);
    assert.match(result.stderr, overflow === 'yes' ? /ENOBUFS/ : /grant inspection fixture failure; exit 73/);
    assert.equal(fs.readFileSync(path.join(f.root, 'goals.json'), 'utf8'), before);
  }
});
test('admission requires active granted goal; concurrent attempts reserve the last run safely', async t => {
  const f = fixture(t); await f.create('one', { codex_runs: 1 }); const wt = f.repo('worker'), wt2 = f.repo('worker2');
  const task = (id, worktree = wt, extra = {}) => ({ id, goal_id: 'one', lane: 'build', worktree, executor: { cli: 'codex' }, attempt_id: id, started_at: new Date().toISOString(), ...extra });
  await assert.rejects(admitTask(task('one-a'), f.root), /active/);
  await transact('set-state', { id: 'one', state: 'active', expected_revision: 1 }, f.root);
  await assert.rejects(admitTask(task('one-a'), f.root), /grant/);
  await transact('grant-worktree', { id: 'one', lane: 'build', worktree: wt, expected_revision: 2 }, f.root);
  await transact('grant-worktree', { id: 'one', lane: 'build', worktree: wt2, expected_revision: 3 }, f.root);
  await assert.rejects(admitTask(task('one-foreign', wt, { goal_generation: 0 }), f.root), /generation/);
  await assert.rejects(admitTask(task('one-child', wt, { child_session: 'foreign', child_depth: 1 }), f.root), /child/);
  const results = await Promise.allSettled([admitTask(task('one-a'), f.root), admitTask(task('one-b', wt2), f.root)]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  await assert.rejects(admitTask(task('one-c'), f.root), /cap|lock/);
  await assert.rejects(admitTask(task('one-agy', wt, { executor: { cli: 'agy' } }), f.root), /unknown/);
});
test('count-only usage deduplicates turns/attempts; cumulative provider snapshots stay reported', async t => {
  const f = fixture(t); await f.create(); fs.mkdirSync(path.join(f.root, 'sessions'));
  const event = { type: 'turn.completed', goal_id: 'one', session_id: 'child-1', turn_id: 'turn-1', usage: { input_tokens: 100 } };
  fs.writeFileSync(path.join(f.root, 'sessions', 'child.events.jsonl'), [event, event, { ...event, turn_id: 'turn-2', usage: { input_tokens: 200 } }].map(JSON.stringify).join('\n') + '\n');
  const attempt = { attempt_id: 'a', started_at: '2026-10-03T00:00:00Z', finished_at: '2026-10-03T00:00:01Z', usage: { input_tokens: 200 } };
  atomicJson(taskPath('one-a', f.root), { id: 'one-a', goal_id: 'one', executor: { cli: 'codex' }, ...attempt, attempt_history: [attempt] });
  const usage = goalUsage('one', f.root);
  assert.equal(usage.claude.turns, 2); assert.equal(usage.workers.codex.attempts, 1); assert.equal(usage.workers.codex.elapsed_ms, 1000);
  assert.equal(usage.workers.codex.reported_usage[0].usage.input_tokens, 200);
  assert.deepEqual(goalUsage('one', f.root), usage); assert.equal(usage.claude.token_proxy, undefined);
});
test('empty registered goals survive collector, orphan goals visible, authority corruption preserves prior status', async t => {
  const f = fixture(t); await f.create(); const status = collect(f.root);
  assert.equal(status.registry_revision, 1); assert.equal(status.goals[0].id, 'one'); assert.deepEqual(status.goals[0].lanes, []);
  assert.equal(status.goals[0].desired_state, 'registered'); assert.deepEqual(collect(f.root).changed_goal_ids, []);
  fs.writeFileSync(path.join(f.root, 'goals.json'), '{'); const before = fs.readFileSync(path.join(f.root, 'status.json'), 'utf8');
  assert.throws(() => collect(f.root)); assert.equal(fs.readFileSync(path.join(f.root, 'status.json'), 'utf8'), before);
});
test('bound child admission checks session, generation, depth and known turn allowance', async t => {
  const f = fixture(t); await f.create(); const wt = f.repo('worker');
  await transact('grant-worktree', { id: 'one', lane: 'build', worktree: wt, expected_revision: 1 }, f.root);
  await transact('set-state', { id: 'one', state: 'active', child_session: 'exact-child', child_principal: 'child-one', expected_revision: 2 }, f.root);
  const goal = readRegistry(f.root).goals[0];
  assert.equal(goal.generation, 2); assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.root, goal.child.contract_ref))).allowed_writes, ['PLAN.md', 'BOARD.md']);
  const task = { id: 'one-build', attempt_id: 'a', goal_id: 'one', lane: 'build', worktree: wt, executor: { cli: 'codex' }, goal_generation: 2, child_session: 'exact-child', child_principal: 'child-one', child_depth: 1 };
  for (const extra of [{ child_depth: 2 }, { child_session: 'foreign' }, { goal_generation: 1 }]) await assert.rejects(admitTask({ ...task, ...extra }, f.root));
  fs.mkdirSync(path.join(f.root, 'sessions'));
  await assert.rejects(admitTask(task, f.root), /acknowledged/);
  const observation = { goal_id: 'one', session_id: 'exact-child', principal: 'child-one', generation: 2, launch_nonce: 'fake-launch', state: 'idle', effort: 'low',
    worktree: f.planning, contract: path.join(f.root, goal.child.contract_ref), supervisor_identity: procIdentity(process.pid), process_identity: procIdentity(process.pid), usage: { turns: null } };
  atomicJson(path.join(f.root, 'sessions', 'child-one.json'), observation);
  await assert.rejects(admitTask(task, f.root), /unknown/);
  atomicJson(path.join(f.root, 'sessions', 'child-one.json'), { ...observation, usage: { turns: 0 } });
  await admitTask(task, f.root);
  await transact('set-state', { id: 'one', state: 'paused', expected_revision: 3 }, f.root);
  await assert.rejects(admitTask({ ...task, id: 'one-next' }, f.root), /active/);
});
test('session cumulative counters and resumed event replay count once; unknown caps deny', async t => {
  const f = fixture(t); await f.create('one', { codex_runs: null }); const wt = f.repo('worker');
  await transact('grant-worktree', { id: 'one', lane: 'build', worktree: wt, expected_revision: 1 }, f.root);
  await transact('set-state', { id: 'one', state: 'active', expected_revision: 2 }, f.root);
  await assert.rejects(admitTask({ id: 'one-a', attempt_id: 'a', goal_id: 'one', lane: 'build', worktree: wt, executor: { cli: 'codex' } }, f.root), /unknown/);
  fs.mkdirSync(path.join(f.root, 'sessions'));
  for (const [name, turns] of [['first', 2], ['resumed', 2]]) atomicJson(path.join(f.root, 'sessions', name + '.json'), { goal_id: 'one', session_id: 'same-transcript', usage: { turns } });
  const e = { type: 'turn.completed', goal_id: 'one', session_id: 'same-transcript', turn_id: 'a' };
  fs.writeFileSync(path.join(f.root, 'sessions', 'replay.events.jsonl'), [e, e].map(JSON.stringify).join('\n'));
  assert.equal(goalUsage('one', f.root).claude.turns, 2);
});
test('orphan tasks stay visible and public projection excludes private task fields', t => {
  const f = fixture(t), wt = f.repo('worker'), log = path.join(f.root, 'log'); fs.writeFileSync(log, '');
  atomicJson(taskPath('orphan-task', f.root), { schema_version: 1, id: 'orphan-task', goal_id: 'orphan', title: 'Orphan', lane: 'build', executor: { cli: 'codex' }, worktree: wt, log_path: log,
    attempt_id: 'a', started_at: new Date().toISOString(), process_identity: null, exit_code: null, attempt_history: [], resume_text: 'private instructions', private_token: 'private value', contract: { authorization: 'private value' }, prompt_file: '/private/brief' });
  const status = collect(f.root);
  assert.equal(status.goals[0].observed_state, 'orphan'); assert.equal(status.goals[0].blockers[0].code, 'goal_ownership_missing');
  for (const key of ['resume_text', 'private_token', 'contract', 'prompt_file']) assert.equal(status.tasks[0][key], undefined);
});
test('provider usage keeps known native fields as latest snapshots without cumulative addition', async () => {
  const { ingestLines } = await import('./common.mjs');
  const e = n => JSON.stringify({ type: 'turn.completed', usage: { input_tokens: n, total_tokens: n + 1, subscription_units: 2, known_charge: 0.5 } }) + '\n';
  const parsed = ingestLines(e(100) + e(200), 'codex');
  assert.equal(parsed.usage.input_tokens, 200); assert.equal(parsed.usage.total_tokens, 201);
  assert.equal(parsed.usage.subscription_units, 2); assert.equal(parsed.usage.known_charge, 0.5);
});

test('parent-orchestrated unbound child and unknown Claude allowance are info; bound missing child stays blocked', async t => {
  const f = fixture(t); await f.create('one', { claude_turn_cap: null });
  await transact('set-state', { id: 'one', state: 'active', expected_revision: 1 }, f.root);
  const goal = collect(f.root, 5, f.root).goals[0];
  assert.equal(goal.observed_state, 'active'); assert.equal(goal.child.state, 'parent_orchestrated');
  assert.ok(goal.info.some(b => b.code === 'parent_orchestrated'));
  assert.ok(goal.info.some(b => b.code === 'budget_unknown' && b.description.startsWith('Claude')));
  assert.ok(!goal.blockers.some(b => b.code === 'needs_owner' || b.description.startsWith('Claude')));
  // Existing binding authority is never downgraded just because observation is missing.
  await transact('set-state', { id: 'one', state: 'paused', expected_revision: 2 }, f.root);
  await transact('set-state', { id: 'one', state: 'active', child_session: 'child-one', child_principal: 'child-owner', expected_revision: 3 }, f.root);
  const bound = collect(f.root, 5, f.root).goals[0];
  assert.equal(bound.observed_state, 'needs_owner');
  assert.ok(bound.blockers.some(b => b.description === 'Child has no supervised session observation'));
});
