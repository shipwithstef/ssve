#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { test, after } from 'node:test';
import { fileURLToPath } from 'node:url';
import { evaluatePreToolObservation } from '../../../hooks/lib/pretool-decision-engine.mjs';

const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'side01-hooks-'));
const repo = path.join(home, 'governed');
const foreign = path.join(home, 'foreign');
const installed = path.join(home, 'installed');
// Materialize the candidate into a disposable home; no live wiring/activation.
fs.mkdirSync(installed);
// Real activation HOME is a dotfiles Git worktree. Scratch output remains an
// explicit exception to that enclosing repository, with nested repos denied.
assert.equal(spawnSync('git', ['init', '-q', home]).status, 0);
fs.cpSync(path.join(source, 'hooks'), path.join(installed, 'hooks'), { recursive: true });
fs.cpSync(path.join(source, 'scripts'), path.join(installed, 'scripts'), { recursive: true });
const { evaluatePreToolObservation: installedObservation } = await import(path.join(installed, 'hooks/lib/pretool-decision-engine.mjs'));
for (const root of [repo, foreign]) {
  fs.mkdirSync(root);
  assert.equal(spawnSync('git', ['init', '-q', root]).status, 0);
}
fs.mkdirSync(path.join(repo, '.svc'));
fs.writeFileSync(path.join(repo, 'input.txt'), 'read me');
const contract = path.join(repo, '.svc/session-contract.jsonl');
const env = { ...process.env, HOME: home, CODEX_HOME: path.join(home, '.codex'), SVC_CODEX_RUNTIME_DIR: path.join(home, 'runtime'),
  SVC_RUNTIME_DIR: '', XDG_RUNTIME_DIR: '', SVC_HOST: 'codex', SVC_SESSION_ID: '', CLAUDE_SESSION_ID: '', CODEX_THREAD_ID: '', SVC_HOOK_MODE: 'advisory' };
fs.mkdirSync(env.SVC_CODEX_RUNTIME_DIR, { mode: 0o700 });
const materialized = spawnSync(process.execPath, [path.join(source, 'scripts/svc-migrate-install.mjs'), 'materialize',
  '--host', 'codex', '--repo-root', source, '--skills-path', installed, '--json'], { env, encoding: 'utf8' });
assert.equal(materialized.status, 0, materialized.stderr);
const bundle = JSON.parse(materialized.stdout.trim().split('\n').at(-1)).hosts[0];
assert.equal(bundle.status, 'ok');
const durableBoundary = path.join(path.dirname(path.dirname(bundle.launcher_path)), 'hooks/svc-hook-boundary.mjs');
const fixtureRoot = path.join(source, 'test-framework/evals/fixtures/side01');
const recordedFailure = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'installed-failure.json')));
const nativeEnvelopes = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'native-code-envelopes.json')));
const installedShapes = JSON.parse(fs.readFileSync(path.join(fixtureRoot, 'installed-hook-shapes.json')));
after(() => fs.rmSync(home, { recursive: true, force: true }));
const payload = (cmd, sid = 'read-session') => ({ session_id: sid, cwd: repo, tool_name: 'exec_command', tool_input: { cmd, workdir: repo } });
function run(script, p, extra = {}, args = []) {
  return spawnSync(process.execPath, [path.isAbsolute(script) ? script : path.join(installed, script), ...args], { input: JSON.stringify(p), cwd: repo,
    env: { ...env, ...extra }, encoding: 'utf8', timeout: 30000 });
}
function boundary(p, host = 'codex', extra = {}, script = 'hooks/codex/svc-codex-pretool-dispatcher.mjs', args = []) {
  const spec = Buffer.from(JSON.stringify({ command: `${process.execPath} ${path.join(installed, script)} ${args.join(' ')}`.trim(),
    host, event: 'PreToolUse', timeoutMs: 20000 })).toString('base64url');
  return run(durableBoundary, p, extra, ['svc-side01', '--spec', spec]);
}
function recordedBoundary(shape, p, extra = {}) {
  const command = shape.command.replaceAll('@SOURCE@', installed).replaceAll('@LAUNCHER@', bundle.launcher_path);
  const spec = Buffer.from(JSON.stringify({ command, host: shape.host, event: shape.event, timeoutMs: 20000 })).toString('base64url');
  return run(durableBoundary, { ...p, hook_event_name: shape.event }, { SVC_HOST: shape.host, ...extra }, [shape.marker, '--spec', spec]);
}
function snapshot(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).sort().flatMap(name => {
    const file = path.join(root, name), stat = fs.lstatSync(file);
    return stat.isDirectory() ? snapshot(file).map(x => `${name}/${x}`)
      : [name + ':' + crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')];
  });
}

test('1,000 installed engine envelopes and 108 Claude/Codex/Cursor boundary replays: zero advisory or state writes', () => {
  const commands = ['cat input.txt', 'grep read input.txt', 'ls -la', 'git log -1', 'git status --short', 'pwd && ls; cat input.txt',
    'rg --no-config -n "alpha|beta" input.txt || true', "sed -n '1,3p' input.txt", 'cat input.txt > /tmp/side01-read-output',
    'cat input.txt >> /tmp/side01-read-output', `cat input.txt > ${home}/.local/state/orch/output`, `cat input.txt > ${home}/scratch/output`];
  const scratchEnv = { SVC_SESSION_SCRATCHPAD: path.join(home, 'scratch') };
  fs.mkdirSync(path.join(home, 'scratch'));
  for (const state of ['absent', 'stale', 'foreign']) {
    fs.rmSync(contract, { force: true });
    if (state !== 'absent') fs.writeFileSync(contract, JSON.stringify({ ts: '2000-01-01T00:00:00Z', wi: 'WI-OLD', session_id: state === 'stale' ? 'read-session' : 'other-session' }) + '\n');
    const beforeRepo = snapshot(repo), beforeRuntime = snapshot(env.SVC_CODEX_RUNTIME_DIR);
    for (let i = state === 'absent' ? 0 : state === 'stale' ? 334 : 667; i < (state === 'absent' ? 334 : state === 'stale' ? 667 : 1000); i++) {
      const host = ['codex', 'claude', 'cursor'][i % 3];
      let p = payload(commands[i % commands.length]);
      if (host === 'claude') p = { ...p, tool_name: 'Bash', tool_input: { command: p.tool_input.cmd } };
      if (i % 7 === 0 && host === 'codex') p = { ...p, tool_name: 'functions.exec', tool_input: `text(await tools.exec_command(${JSON.stringify(p.tool_input, null, i % 2 ? 2 : 0)}));` };
      if (host === 'cursor') p = { conversation_id: 'read-session', workspace_roots: [repo], command: p.tool_input.cmd };
      assert.ok(installedObservation(p, { ...env, ...scratchEnv }), `${state}/${host}/${i}`);
      if (i - (state === 'absent' ? 0 : state === 'stale' ? 334 : 667) >= 36) continue;
      const probe = boundary(p, host, scratchEnv, host === 'cursor' ? 'hooks/cursor/svc-cursor-ssve-adapter.mjs' : undefined, host === 'cursor' ? ['--before-shell-execution'] : []);
      assert.equal(probe.status, 0, probe.stderr);
      assert.equal(probe.stderr, '', `${state}/${host}/${i}`);
      assert.doesNotMatch(probe.stdout, /advisory|denied|CIRCUIT|blocked|AUTH_BINDING/);
    }
    assert.deepEqual(snapshot(repo), beforeRepo);
    assert.deepEqual(snapshot(env.SVC_CODEX_RUNTIME_DIR), beforeRuntime);
  }
});

test('exact activation failure and log-derived envelopes are silent through the installed boundary AND durable launcher', () => {
  fs.rmSync(contract, { force: true });
  const shape = installedShapes.find(s => s.host === 'codex' && s.event === 'PreToolUse');
  assert.match(shape.command, /@LAUNCHER@/); // The old test skipped this layer.
  assert.match(recordedFailure.stderr, /AUTH_BINDING_MISSING_SELF_HEAL_INELIGIBLE.*origin\/main is missing/);
  const beforeRepo = snapshot(repo), beforeRuntime = snapshot(env.SVC_CODEX_RUNTIME_DIR);
  // Replay the EXACT recorded payload without changing spaces, keys or paths.
  for (const mode of ['advisory', 'enforce']) {
    const exact = recordedBoundary(shape, recordedFailure.payload, { SVC_HOOK_MODE: mode });
    assert.equal(exact.status, 0, exact.stderr);
    assert.equal(exact.stderr, '');
    assert.doesNotMatch(exact.stdout, /advisory|AUTH_BINDING|origin\/main|CIRCUIT|deny/);
  }
  for (const fixture of nativeEnvelopes) {
    for (const name of ['exec', 'functions.exec']) {
      const p = { ...payload(''), tool_name: name, tool_input: fixture.tool_input.replaceAll('@REPO@', repo) };
      assert.ok(installedObservation(p, env), fixture.shape);
      const read = recordedBoundary(shape, p);
      assert.equal(read.status, 0, read.stderr); assert.equal(read.stderr, '', fixture.shape);
      assert.doesNotMatch(read.stdout, /advisory|AUTH_BINDING|origin\/main|CIRCUIT|deny/, fixture.shape);
    }
  }
  assert.deepEqual(snapshot(repo), beforeRepo);
  assert.deepEqual(snapshot(env.SVC_CODEX_RUNTIME_DIR), beforeRuntime);
  for (const fixture of nativeEnvelopes) {
    for (const name of ['exec', 'functions.exec']) {
      const p = { ...payload(''), tool_name: name, tool_input: fixture.tool_input.replaceAll('@REPO@', repo) };
      // Change just one nested literal command in the SAME transport/renderer.
      const mutation = { ...p, session_id: 'native-mutation-' + fixture.shape + name,
        tool_input: p.tool_input.replace('cat input.txt', 'touch changed') };
      assert.equal(installedObservation(mutation, env), null, fixture.shape);
      assert.match(recordedBoundary(shape, mutation).stderr, /svc advisory/, fixture.shape);
      assert.match(recordedBoundary(shape, mutation, { SVC_HOOK_MODE: 'enforce' }).stdout, /deny/, fixture.shape);
    }
  }
  assert.equal(fs.existsSync(path.join(repo, 'changed')), false);
});

test('every recorded applicable Codex/Cursor/Claude hook command stays quiet on native read envelopes', () => {
  for (const shape of installedShapes) {
    const name = shape.host === 'claude' ? 'Bash' : shape.host === 'cursor' ? 'Shell' : 'exec_command';
    if (shape.matcher !== '*' && !new RegExp(shape.matcher).test('Bash')) continue;
    const p = shape.host === 'cursor'
      ? { conversation_id: 'recorded-shapes', workspace_roots: [repo], command: 'cat input.txt' }
      : { ...payload('cat input.txt', 'recorded-shapes'), tool_name: name, tool_input: { command: 'cat input.txt', workdir: repo } };
    const read = recordedBoundary(shape, p);
    assert.equal(read.status, 0, read.stderr); assert.equal(read.stderr, '', `${shape.host}/${shape.event}/${shape.marker}`);
    assert.doesNotMatch(read.stdout, /advisory|AUTH_BINDING|origin\/main|CIRCUIT|deny/);
  }
});

test('post-tool reads bypass receipt IO and never propose a completed input rewrite', () => {
  const shape = installedShapes.find(s => s.host === 'codex' && s.event === 'PostToolUse');
  const before = snapshot(env.SVC_CODEX_RUNTIME_DIR);
  const result = recordedBoundary(shape, payload('git status --short'), { SVC_HOOK_MODE: 'enforce' });
  assert.equal(result.status, 0); assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {});
  assert.deepEqual(snapshot(env.SVC_CODEX_RUNTIME_DIR), before);
});

test('negative controls: mixed mutation, shell substitution, executable flags and scratch symlink escapes stay governed', () => {
  assert.ok(evaluatePreToolObservation(payload('cat input.txt > ~/.local/state/orch/output'), env));
  assert.ok(evaluatePreToolObservation(payload("git status --short && echo '---' && git diff && echo '---LOG---' && git log -5 --format='%s'"), env));
  assert.ok(evaluatePreToolObservation(payload("git status --short && echo '---' && git log -5 --oneline && echo '---' && git check-ignore -v input.txt || true"), env));
  assert.ok(evaluatePreToolObservation({ ...payload(''), tool_name: 'functions.exec', tool_input:
    'const rs=await Promise.allSettled([tools.exec_command({cmd:"cat input.txt"}),tools.exec_command({cmd:"ls"})]);rs.forEach((r,i)=>text({i,...r}));' }, env));
  const escape = path.join(home, 'scratch', 'escape');
  fs.symlinkSync(repo, escape);
  const nested = path.join(home, 'scratch', 'nested-repo');
  fs.mkdirSync(nested); assert.equal(spawnSync('git', ['init', '-q', nested]).status, 0);
  for (const cmd of ['cat input.txt; touch changed', 'cat $(touch changed)', 'rg --pre touch input.txt', "sed -n '1w changed' input.txt",
    'git log --output=changed', 'echo literal > changed', 'echo $(touch changed)', 'echo literal; touch changed', 'cat input.txt > changed', "cat input.txt > '~/.local/state/orch/output'", 'cd /tmp; cat input.txt > changed', `cat input.txt > ${escape}/changed`, `cat input.txt > ${repo}/changed`, `cat input.txt > ${nested}/changed`, `cat input.txt > ${home}/scratch/.git/config`]) {
    assert.equal(evaluatePreToolObservation(payload(cmd), env), null, cmd);
    const result = run('hooks/codex/svc-codex-pretool-dispatcher.mjs', payload(cmd, 'negative-' + cmd), { SVC_HOOK_MODE: 'enforce' });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
    assert.match(result.stdout, /deny/, cmd + result.stderr);
  }
  for (const code of ['text(await tools.exec_command({cmd:"cat input.txt; touch changed"}));',
    'text(await tools.exec_command({cmd:"cat input.txt"})); await tools.apply_patch("bad");',
    'text(await tools.exec_command({cmd:compute()}));', 'text(await tools.exec_command({cmd:`cat input.txt ${evil()}`}));',
    'const r=await tools.exec_command({cmd:"cat input.txt"});text(r.constructor("touch changed")());',
    'const r=await tools.exec_command({cmd:"cat input.txt"});r["constructor"]["constructor"]("return tools.exec_command({cmd: \'touch changed\'})")(1);',
    'const r=await tools.exec_command({cmd:"cat input.txt"});const key=r.output;r[key]("touch changed");',
    'const r=await tools.exec_command({cmd:"cat input.txt"});text(r.output)\n("touch changed");',
    'const tools=await tools.exec_command({cmd:"cat input.txt"});text(tools);',
    'const rs=await Promise.allSettled([tools.exec_command({cmd:"cat input.txt"})]);rs.forEach((r,i)=>text(await tools.exec_command({cmd:"touch changed"})));',
    'const r=await tools.exec_command({cmd:"cat input.txt"});text(`${tools.exec_command({cmd:"touch changed"})}`);',
    'const r=await tools.exec_command({cmd:"cat input.txt"}); /* output */ await tools.apply_patch("bad");',
    ...['\r', '\u2028', '\u2029'].map(end => 'text(await tools.exec_command({cmd:"cat input.txt"})); // read' + end + 'await tools.apply_patch("bad");')]) {
    assert.equal(evaluatePreToolObservation({ ...payload(''), tool_name: 'functions.exec', tool_input: code }, env), null);
  }
});

test('governed mutations advise once per finding class/session; advisory never trips circuit breaker', () => {
  const tracker = path.join(env.SVC_CODEX_RUNTIME_DIR, 'deny-storm-tracker.json');
  const beforeTracker = fs.existsSync(tracker) ? fs.readFileSync(tracker, 'utf8') : null;
  const p = payload('touch changed', 'dedupe-session');
  const first = boundary(p);
  assert.match(first.stderr, /svc advisory/);
  for (let i = 0; i < 5; i++) {
    const next = boundary(payload('touch other-' + i, 'dedupe-session'));
    assert.equal(next.stderr, ''); assert.doesNotMatch(next.stdout, /advisory|CIRCUIT|AUTH_BINDING/);
  }
  assert.match(boundary({ ...p, session_id: 'new-session' }).stderr, /svc advisory/);
  const otherClass = { ...p, tool_input: { cmd: 'touch changed', workdir: '/side01-nonexistent' } };
  assert.match(boundary(otherClass).stderr, /invalid-explicit-workdir/);
  assert.equal(boundary(otherClass).stderr, '');
  assert.equal(fs.existsSync(tracker) ? fs.readFileSync(tracker, 'utf8') : null, beforeTracker);
  const enforced = boundary(p, 'codex', { SVC_HOOK_MODE: 'enforce' });
  assert.match(enforced.stdout, /deny/);
});

test('no-contract and foreign-contract freshness is silent; own stale contract still denies', () => {
  const p = { ...payload(''), tool_name: 'Write', tool_input: { file_path: path.join(repo, 'changed'), content: 'x' } };
  fs.rmSync(contract, { force: true });
  for (const row of [null, { ts: '2000-01-01', session_id: 'foreign', wi: 'WI-FOREIGN' }]) {
    if (row) fs.writeFileSync(contract, JSON.stringify(row) + '\n');
    const result = run('hooks/svc-session-contract-freshness.mjs', p);
    assert.equal(result.status, 0); assert.equal(result.stderr + result.stdout, '');
  }
  fs.writeFileSync(contract, JSON.stringify({ ts: '2000-01-01', session_id: 'read-session', wi: 'WI-OWN' }) + '\n');
  assert.equal(run('hooks/svc-session-contract-freshness.mjs', p).status, 2);
  const unrelated = boundary({ ...p, cwd: foreign, tool_input: { file_path: path.join(foreign, 'changed'), content: 'x' } });
  assert.equal(unrelated.stderr, ''); assert.doesNotMatch(unrelated.stdout, /advisory/);
});

test('rule pointer/full output is delivered once per session even across worktrees; reads do not inject Bash rules', () => {
  const rulesRoot = path.join(home, 'rule-fixture'); fs.mkdirSync(rulesRoot);
  fs.writeFileSync(path.join(rulesRoot, 'big.md'), 'A'.repeat(12000));
  fs.writeFileSync(path.join(rulesRoot, 'small.md'), 'A useful small rule.');
  const manifest = path.join(home, 'rules.json');
  fs.writeFileSync(manifest, JSON.stringify({ rulesRegistry: { entries: [{ path: 'big.md', auto_inject: 'signal', type: 'correction', signals: { paths: ['changed'], bash: ['git'] } },
    { path: 'small.md', auto_inject: 'signal', type: 'steering', signals: { paths: ['changed'] } }] } }));
  const extra = { SVC_RULES_ROOT: rulesRoot, SVC_RULES_MANIFEST: manifest };
  const p = { ...payload(''), session_id: 'rule-session', tool_name: 'Write', tool_input: { file_path: path.join(repo, 'changed'), content: 'x' } };
  assert.match(run('hooks/svc-rule-injector.mjs', p, extra).stdout, /big.md/);
  assert.equal(run('hooks/svc-rule-injector.mjs', p, extra).stdout, '');
  fs.mkdirSync(path.join(foreign, '.svc'));
  assert.equal(run('hooks/svc-rule-injector.mjs', { ...p, cwd: foreign, tool_input: { file_path: path.join(foreign, 'changed') } }, extra).stdout, '');
  assert.equal(run('hooks/svc-rule-injector.mjs', payload('git log', 'rule-read'), extra).stdout, '');
});
