import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';
import { evaluatePreToolObservation } from '../../hooks/lib/pretool-decision-engine.mjs';
import { isReadOnlyTool } from '../../hooks/codex/lib/codex-hook-context.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const payload = (command, key = 'command') => ({ tool_name: 'Bash', tool_input: { [key]: command }, cwd: '/nonexistent/no-work-item' });
const reads = [
  'systemctl show codex-durability.service --property=ActiveState,SubState,UnitFileState,NRestarts',
  'systemctl status codex-durability.service',
  'systemctl --user is-active codex-durability.service',
  'systemctl list-units --type service --all',
  'systemctl cat codex-durability.service',
  "journalctl -u codex-durability.service --since '2026-09-08 15:00:00 UTC' --no-pager -o cat",
  'journalctl -u codex-durability.service -b -1 -n 50',
  'journalctl --boot=-1 --list-boots',
  'journalctl --disk-usage',
  'journalctl --file /var/log/journal/test.journal --verify',
  "journalctl --no-pager --grep 'alpha|beta' | head -n 20",
  'systemctl show codex-durability.service 2>/dev/null && git status --short',
  'git ls-remote origin',
];
for (const command of reads) test(`authority-free observation: ${command}`, () => {
  const original = payload(command);
  const snapshot = JSON.stringify(original);
  const result = evaluatePreToolObservation(original);
  assert.equal(result?.classification, 'observation');
  assert.equal(result?.authority, null);
  assert.equal(result?.renewal.status, 'not_applicable');
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(isReadOnlyTool({ ...original, tool_input: result.execution_input || original.tool_input }), true);
});
const writes = [
  'git --paginate log HEAD',
  'git -p log HEAD',
  'git --no-pager --paginate log HEAD',
  'git ls-remote --upload-pack=custom origin',
  'git branch --list --set-upstream-to origin/topic',
  'git branch -r -d origin/topic',
  'git branch -a -D topic',
  'git branch --list --edit-description',
  'sort -ro/tmp/out input',
  'file -bC -m magic',
  'systemctl restart codex-durability.service',
  'systemctl --no-pager stop codex-durability.service',
  'systemctl enable --now codex-durability.service',
  'systemctl daemon-reload',
  'systemctl edit codex-durability.service',
  'systemctl set-property x MemoryMax=1G',
  'systemctl status x --now',
  'systemctl status x --root=/tmp/root',
  'systemctl --host host status x',
  'systemctl --image /tmp/image status x',
  'systemctl --property --no-pager status x',
  'systemctl status x --unknown',
  'journalctl --vacuum-time=1s',
  'journalctl --rotate',
  'journalctl --sync',
  'journalctl --flush',
  'journalctl --setup-keys',
  'journalctl --update-catalog',
  'journalctl --cursor-file=/tmp/cursor',
  "journalctl --cursor'-file' /tmp/cursor",
  'journalctl --image=/tmp/disk',
  'journalctl --no-pager > /tmp/log',
  'journalctl -f',
  'journalctl --no-pager -fu x',
  'journalctl --no-pager --pager=cat',
  'systemctl status x --pager=cat',
  'systemctl status x && touch /tmp/write',
  'systemctl status $(touch /tmp/write)',
  'journalctl --unit --no-pager',
];
for (const command of writes) test(`unproven effect stays governed: ${command}`, () => {
  assert.equal(evaluatePreToolObservation(payload(command)), null);
});
test('direct classifier requires explicit pager suppression', () => {
  assert.equal(isReadOnlyTool(payload('systemctl status x')), false);
  assert.equal(isReadOnlyTool(payload('journalctl -n 10')), false);
});
for (const key of ['command', 'cmd']) test(`normalization preserves ${key} host envelope`, () => {
  const result = evaluatePreToolObservation(payload('systemctl show x && git status', key));
  assert.ok(result.execution_input[key].includes('systemctl --no-pager show x'));
  assert.ok(result.execution_input[key].includes('git --no-optional-locks --no-pager status'));
  assert.equal(Object.hasOwn(result.execution_input, key === 'cmd' ? 'command' : 'cmd'), false);
});
test('ambiguous command aliases cannot authorize a different command', () => {
  assert.equal(evaluatePreToolObservation({ ...payload('systemctl status x'), tool_input: { command: 'systemctl status x', cmd: 'systemctl stop x' } }), null);
  const p = { ...payload('git status'), tool_input: { command: 'git status', cmd: 'git status' } };
  const r = evaluatePreToolObservation(p);
  assert.equal(r.execution_input.cmd, r.execution_input.command);
});
for (const entry of ['svc-codex-pretool-dispatcher.mjs', 'svc-codex-skill-load-enforcer.mjs']) test(`${entry} permits observations without identity or work item`, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-readonly-dispatch-'));
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(SVC_|CODEX_|GROK_)/.test(k)));
    env.HOME = temp;
    const r = spawnSync('node', [path.join(root, 'hooks/codex', entry)], {
      env, cwd: temp, input: JSON.stringify({ ...payload('systemctl show x', 'cmd'), cwd: temp }), encoding: 'utf8',
    });
    assert.equal(r.status, 0, r.stderr);
    const result = JSON.parse(r.stdout);
    assert.equal(result.hookSpecificOutput.permissionDecision, 'allow');
    assert.equal(result.hookSpecificOutput.updatedInput.cmd, 'systemctl --no-pager show x');
    assert.deepEqual(fs.readdirSync(temp), [], 'read must not create runtime/authority files');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
for (const state of ['pending', 'blocked', 'completed', 'empty', 'mixed-blocked', 'graph-blocked']) test(`owned ${state} graph never prescribes new-worktree bootstrap`, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-recovery-guidance-'));
  try {
    execFileSync('git', ['init', '-q', dir]);
    fs.mkdirSync(path.join(dir, '.svc'));
    fs.mkdirSync(path.join(dir, 'runtime'), { mode: 0o700 });
    const graphPath = path.join(dir, '.svc/lane-tasks-WI-OBS-01.json');
    const graph = { wi: 'WI-OBS-01', lane: 'bugfix', status: state, tasks: [{ id: 1, skill: 'route-workflow', status: state, subject: 'route', blocked_by: [] }] };
    if (state === 'empty') { graph.status = 'pending'; graph.tasks = []; }
    if (state === 'mixed-blocked') { graph.status = 'blocked'; graph.tasks = [{ ...graph.tasks[0], status: 'blocked' }, { ...graph.tasks[0], id: 2, status: 'pending' }]; }
    if (state === 'graph-blocked') { graph.status = 'blocked'; graph.tasks[0].status = 'pending'; }
    fs.writeFileSync(graphPath, JSON.stringify(graph));
    const before = fs.readFileSync(graphPath);
    const env = { ...process.env, HOME: dir, SVC_CODEX_TEST_MODE: '1', SVC_CODEX_TEST_REPO: dir, SVC_CODEX_TASK_GRAPH: graphPath, SVC_CODEX_RUNTIME_DIR: path.join(dir, 'runtime'), CODEX_SESSION_ID: 'fixture-observation', CODEX_THREAD_ID: '', SVC_SESSION_ID: 'fixture-observation', SVC_HOST: 'codex' };
    delete env.SVC_BREAK_GLASS;
    const result = spawnSync('node', [path.join(root, 'hooks/codex/svc-codex-skill-load-enforcer.mjs')], { env, cwd: dir, input: JSON.stringify({ session_id: 'fixture-observation', cwd: dir, tool_name: 'Bash', tool_input: { command: 'touch artifact.txt', workdir: dir } }), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const decision = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(decision.permissionDecision, 'deny');
    assert.doesNotMatch(decision.permissionDecisionReason, /bootstrap one/);
    if (state === 'pending') {
      assert.match(decision.permissionDecisionReason, /codex-load-skill.mjs/);
      assert.ok(decision.permissionDecisionReason.includes(`--graph ${graphPath} --task 1 --skill route-workflow`));
    } else if (state === 'empty') {
      assert.doesNotMatch(decision.permissionDecisionReason, /is complete|codex-load-skill.mjs/);
    } else if (state.includes('blocked')) assert.match(decision.permissionDecisionReason, /unresolved blockers/);
    else assert.match(decision.permissionDecisionReason, /is complete; route the new request/);
    assert.deepEqual(fs.readFileSync(graphPath), before);
    assert.equal(fs.existsSync(path.join(dir, 'artifact.txt')), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

for (const command of ['git status', 'systemctl show x']) test(`normalization preserves quoted earlier occurrence of ${command}`, () => {
  const source = `rg '${command}' README.md && ${command} && ${command}`;
  const result = evaluatePreToolObservation(payload(source));
  assert.ok(result.execution_input.command.startsWith(`rg '${command}' README.md && `));
  assert.equal(isReadOnlyTool(payload(result.execution_input.command)), true);
  assert.equal(result.execution_input.command.split(command === 'git status' ? '--no-optional-locks' : '--no-pager').length - 1, 2);
});

for (const command of writes) test(`real dispatcher refuses unowned effect: ${command}`, () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-unowned-effect-'));
  try {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(SVC_|CODEX_|GROK_)/.test(k)));
    const result = spawnSync('node', [path.join(root, 'hooks/codex/svc-codex-pretool-dispatcher.mjs')], {
      env: { ...env, HOME: temp }, cwd: temp, input: JSON.stringify({ ...payload(command, 'cmd'), cwd: temp }), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).hookSpecificOutput.permissionDecision, 'deny');
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('Git log/show/diff suppress configured pagers and diff helpers', () => {
  for (const verb of ['log', 'show', 'diff']) {
    const result = evaluatePreToolObservation(payload(`git ${verb} HEAD`));
    for (const flag of ['--no-pager', '--no-ext-diff', '--no-textconv']) assert.ok(result.execution_input.command.includes(flag));
    assert.equal(evaluatePreToolObservation(payload(result.execution_input.command)).execution_input, null);
  }
});

test('production resolver never recommends a same-UID foreign owner graph', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-foreign-owned-'));
  try {
    execFileSync('git', ['init', '-q', '-b', 'main', dir]);
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Fixture']);
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'fixture@example.invalid']);
    fs.writeFileSync(path.join(dir, '.gitignore'), '.worktrees/\n');
    execFileSync('git', ['-C', dir, 'add', '.gitignore']);
    execFileSync('git', ['-C', dir, 'commit', '-qm', 'fixture']);
    execFileSync('git', ['-C', dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD']);
    const clean = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(SVC_|CODEX_|GROK_)/.test(k)));
    const owner = '11111111-1111-4111-8111-111111111111';
    const env = { ...clean, HOME: dir, SVC_SESSION_ID: owner, SVC_HOST: 'codex' };
    const create = spawnSync('node', [path.join(root, 'scripts/svc-ensure-worktree.mjs'), '--wi', 'WI-FOREIGN-READ-01', '--branch', 'bugfix-fixture', '--from', 'origin/main', '--json'], { cwd: dir, env, encoding: 'utf8' });
    assert.equal(create.status, 0, create.stderr);
    const worktree = path.join(dir, '.worktrees/bugfix-fixture');
    const graphPath = path.join(worktree, '.svc/lane-tasks-WI-FOREIGN-READ-01.json');
    const before = fs.readFileSync(graphPath);
    const foreign = '22222222-2222-4222-8222-222222222222';
    const result = spawnSync('node', [path.join(root, 'hooks/codex/svc-codex-skill-load-enforcer.mjs')], { cwd: worktree, env: { ...clean, HOME: dir }, input: JSON.stringify({ session_id: foreign, cwd: worktree, tool_name: 'Bash', tool_input: { command: 'touch never-executed' } }), encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const decision = JSON.parse(result.stdout).hookSpecificOutput;
    assert.equal(decision.permissionDecision, 'deny');
    assert.doesNotMatch(decision.permissionDecisionReason, /--graph|codex-load-skill/);
    assert.deepEqual(fs.readFileSync(graphPath), before);
    assert.equal(fs.existsSync(path.join(worktree, 'never-executed')), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
