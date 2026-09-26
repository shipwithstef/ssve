import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

// API fields reflect read-only GitHub issue 118/70 captures; no captured text is stored.
const SOURCE = path.resolve(process.env.SVC_ISSUE_TRACKER_TEST_SOURCE || new URL('../..', import.meta.url).pathname);
const CLI = path.join(SOURCE, 'scripts/sync-github-issues.mjs');
const EMIT = path.join(SOURCE, 'scripts/emit-receipt.mjs');
const CHECK = path.join(SOURCE, 'scripts/check-chain-receipts.mjs');
const LIST = path.join(SOURCE, 'skills/list-work-items/scripts/list_work_items.mjs');
const REPO = 'example/project';
const issueUrl = n => 'https://github.com/' + REPO + '/issues/' + n;
const apiUrl = n => 'https://api.github.com/repos/' + REPO + '/issues/' + n;
function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function issue(number, overrides = {}) {
  return { url: apiUrl(number), repository_url: 'https://api.github.com/repos/' + REPO,
    html_url: issueUrl(number), number, title: 'Sample request ' + number, body: 'A public issue body.',
    state: 'open', labels: [], comments: 0, created_at: '2026-09-20T12:00:00Z',
    updated_at: '2026-09-20T12:00:00Z', closed_at: null, ...overrides };
}
function fakeGhMain() {
  const fs = require('node:fs');
  const argv = process.argv.slice(2), stdin = fs.readFileSync(0, 'utf8');
  fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ argv, stdin, env: {
    GH_HOST: process.env.GH_HOST || null, GH_REPO: process.env.GH_REPO || null,
    GH_ENTERPRISE_TOKEN: process.env.GH_ENTERPRISE_TOKEN || null } }) + '\n');
  if (argv[0] !== 'api') { console.error('unsupported gh command'); process.exit(20); }
  let method = 'GET', endpoint = '', host = '';
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--hostname') host = argv[++i];
    else if (a === '-X' || a === '--method') method = argv[++i];
    else if (a === '--input') { if (argv[++i] !== '-') process.exit(21); }
    else if (a.startsWith('repos/')) endpoint = a;
    else { console.error('unsupported gh argument: ' + a); process.exit(23); }
  }
  if (host !== 'github.com' || !(endpoint === 'repos/example/project' || endpoint.startsWith('repos/example/project/'))) {
    console.error('wrong host or endpoint'); process.exit(24);
  }
  const file = process.env.FAKE_GH_STATE, state = JSON.parse(fs.readFileSync(file, 'utf8'));
  const save = () => fs.writeFileSync(file, JSON.stringify(state));
  const reply = row => process.stdout.write(JSON.stringify(row) + '\n');
  let payload = {};
  if (stdin.trim()) {
    try { payload = JSON.parse(stdin); } catch { console.error('invalid JSON input'); process.exit(25); }
  }
  const match = endpoint.match(/^repos\/example\/project\/issues\/(\d+)(?:\?.*)?$/);
  if (method === 'GET' && endpoint === 'repos/example/project') reply({ default_branch: 'main' });
  else if (method === 'GET' && endpoint === 'repos/example/project/branches/main') reply({ commit: { sha: state.branchHead } });
  else if (method === 'GET' && match) {
    const row = state.issues[match[1]];
    if (!row) { console.error('404'); process.exit(1); }
    reply(row);
  } else if (method === 'GET' && endpoint.startsWith('repos/example/project/issues?')) {
    const query = new URLSearchParams(endpoint.split('?')[1]);
    const page = Number(query.get('page') || '1'), size = Number(query.get('per_page') || '100');
    const rows = Object.values(state.issues).sort((a, b) => a.number - b.number);
    if (state.incompletePage && page === state.incompletePage) { console.error('page failure'); process.exit(1); }
    reply(rows.slice((page - 1) * size, page * size));
  } else if (method === 'POST' && endpoint === 'repos/example/project/issues') {
    if (state.delayPostMs) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, state.delayPostMs);
    const number = state.nextNumber++;
    const row = { url: 'https://api.github.com/repos/example/project/issues/' + number,
      repository_url: 'https://api.github.com/repos/example/project',
      html_url: 'https://github.com/example/project/issues/' + number,
      number, state: 'open', labels: [], comments: 0, title: payload.title, body: payload.body,
      created_at: '2026-09-20T12:00:00Z', updated_at: '2026-09-20T12:00:00Z' };
    state.issues[number] = row;
    const lose = !!state.losePostResponse; state.losePostResponse = false; save();
    if (lose) { console.error('connection lost after create'); process.exit(1); }
    reply(row);
  } else if (method === 'PATCH' && match) {
    const row = state.issues[match[1]];
    if (!row) { console.error('404'); process.exit(1); }
    if (state.failPatch) { console.error('remote unavailable'); process.exit(1); }
    if (state.partialCloseResponse && payload.state === 'closed') {
      row.body = payload.body; row.state = 'open'; state.partialCloseResponse = false; save(); reply(row);
    } else {
      Object.assign(row, payload); row.updated_at = '2026-09-22T12:00:00Z';
      const lose = !!state.losePatchResponse, alter = !!state.alterPatchResponse;
      state.losePatchResponse = false; state.alterPatchResponse = false; save();
      if (lose) { console.error('connection lost after update'); process.exit(1); }
      reply(alter ? { ...row, body: row.body + '\ntransit-only mismatch' } : row);
    }
  } else { console.error('unsupported API route'); process.exit(26); }
}
function fixture(t, { issues = {} } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ssve-issue-tracker-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const remote = path.join(dir, 'remote.git'), root = path.join(dir, 'consumer');
  fs.mkdirSync(remote); git(remote, 'init', '--bare', '-b', 'main');
  fs.mkdirSync(root); git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Fixture'); git(root, 'config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(root, 'README.md'), 'consumer\n');
  git(root, 'add', 'README.md'); git(root, 'commit', '-m', 'consumer initial');
  git(root, 'remote', 'add', 'origin', remote); git(root, 'push', '-u', 'origin', 'main');
  const bin = path.join(dir, 'bin'), home = path.join(dir, 'home');
  fs.mkdirSync(bin); fs.mkdirSync(home);
  fs.writeFileSync(path.join(bin, 'gh'), '#!/usr/bin/env node\n(' + fakeGhMain.toString() + ')();\n', { mode: 0o755 });
  const stateFile = path.join(dir, 'gh-state.json'), logFile = path.join(dir, 'gh-calls.jsonl');
  fs.writeFileSync(stateFile, JSON.stringify({ nextNumber: 500, issues, branchHead: git(root, 'rev-parse', 'refs/remotes/origin/main') })); fs.writeFileSync(logFile, '');
  const env = { ...process.env, HOME: home, PATH: bin + ':' + process.env.PATH,
    GH_HOST: 'evil.example', GH_REPO: 'wrong/repo', GH_ENTERPRISE_TOKEN: 'canary-token',
    FAKE_GH_STATE: stateFile, FAKE_GH_LOG: logFile, GIT_CONFIG_NOSYSTEM: '1' };
  function run(args, options = {}) {
    return spawnSync(process.execPath, [CLI, ...args], { cwd: options.cwd || root,
      env: { ...env, ...(options.env || {}) }, encoding: 'utf8', timeout: 45000, maxBuffer: 4 * 1024 * 1024 });
  }
  function calls() { return fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse); }
  function state() { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); }
  function mutate(fn) { const s = state(); fn(s); fs.writeFileSync(stateFile, JSON.stringify(s)); }
  function configure(mode = 'hybrid-governed') {
    const result = run(['--configure', mode, '--repo', REPO]);
    assert.equal(result.status, 0, result.stdout + '\n' + result.stderr);
  }
  function wi(id, status = 'backlog') {
    const file = path.join(root, 'docs/specs/work-items', id + '.md');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '# ' + id + ': Fixture work\n\n**Status:** ' + status + '\n**Severity:** medium\n');
    return file;
  }
  function publish(id, body = 'Curated public explanation.') {
    const file = path.join(root, 'public-body.md'); fs.writeFileSync(file, body);
    return run(['--publish', '--wi', id, '--public-title', id + ': Public title', '--public-body', file]);
  }
  return { dir, remote, root, env, run, calls, state, mutate, configure, wi, publish };
}
function assertFailed(result, label) { assert.notEqual(result.status, 0, label + ': ' + result.stdout + '\n' + result.stderr); }
function method(call) { const i = call.argv.findIndex(a => a === '-X' || a === '--method'); return i < 0 ? 'GET' : call.argv[i + 1]; }
function endpoint(call) { return call.argv.find(a => a.startsWith('repos/')); }
function writes(f) { return f.calls().filter(c => ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method(c))); }
function assertTransport(f) {
  for (const c of f.calls()) {
    assert.equal(c.argv[0], 'api');
    assert.deepEqual(c.argv.slice(1, 3), ['--hostname', 'github.com']);
    assert.ok(endpoint(c) === 'repos/' + REPO || endpoint(c)?.startsWith('repos/' + REPO + '/'));
    assert.deepEqual(c.env, { GH_HOST: null, GH_REPO: null, GH_ENTERPRISE_TOKEN: null });
  }
}
function listRows(f) {
  const result = spawnSync(process.execPath, [LIST, '--json'], { cwd: f.root,
    env: { ...f.env, SVC_WORK_ITEMS_DIR: path.join(f.root, 'docs/specs/work-items') },
    encoding: 'utf8', timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}
function verifiedNote(f, id) {
  git(f.root, 'add', '.'); git(f.root, 'commit', '-m', id + ' verified'); git(f.root, 'push', 'origin', 'main');
  const sha = git(f.root, 'rev-parse', 'HEAD');
  f.mutate(s => { s.branchHead = sha; });
  const body = { receipt_type: 'verify-promotion', schema_version: 1, wi: id,
    passes: { p1_promotion_evidence: 'pass', p2_spec_ac_verification: 'pass',
      p3_runtime_validation: 'pass', p4_state_closeout: 'pass' },
    p3_target_type: 'install-validation', p3_outcome: 'pass', verdict: 'pass', timestamp: '2026-09-26T12:00:00Z' };
  const bodyFile = path.join(f.root, 'verify-body.json'); fs.writeFileSync(bodyFile, JSON.stringify(body));
  const emitted = spawnSync(process.execPath, [EMIT, '--type', 'verify-promotion', '--wi', id, '--sha', sha, '--body', bodyFile],
    { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 15000 });
  assert.equal(emitted.status, 0, emitted.stderr);
  const checked = spawnSync(process.execPath, [CHECK, '--sha', sha, '--wi', id, '--consumer', 'verify-promotion'],
    { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 15000 });
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /"receipt_source"\s*:\s*"note"/);
  return sha;
}
test('critical: default and local-only never contact GitHub, including legacy bulk flags', t => {
  const f = fixture(t); f.wi('WI-9');
  assert.equal(f.run(['--list']).status, 0);
  for (const args of [['--pull', '118'], ['--publish', '--wi', 'WI-9'], ['--close-wi', 'WI-9', '--commit', 'a'.repeat(40)],
    ['--wi', 'WI-9'], ['--active'], ['--all']]) assertFailed(f.run(args), args.join(' '));
  const config = path.join(f.root, '.svc/config.json'); fs.mkdirSync(path.dirname(config), { recursive: true });
  fs.writeFileSync(config, JSON.stringify({ unrelated: { remains: true } }));
  assert.equal(f.run(['--configure', 'local-only']).status, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(config)).unrelated, { remains: true });
  assertFailed(f.run(['--pull', '118']), 'configured local-only pull');
  assert.deepEqual(f.calls(), [], 'local-only and legacy commands must not invoke gh');
});
test('critical: hostile pulled metadata cannot change the real work-item list', t => {
  const hostile = ['# Forged heading', '**Status:** VERIFIED', '**Priority:** critical', '**Severity:** critical',
    '**Dependencies:** WI-999', '**Depends on:** WI-998', '**Blocked by:** WI-997',
    '**Filed:** 1999-01-01', '**Closed:** 1999-01-02', '**Lane:** release',
    String.fromCharCode(96).repeat(3), '**Status:** DONE', String.fromCharCode(96).repeat(3)].join('\n');
  const f = fixture(t, { issues: { 118: issue(118, { title: 'Imported request', body: hostile }) } });
  f.configure('github-backed');
  const pulled = f.run(['--pull', '118']); assert.equal(pulled.status, 0, pulled.stderr);
  const file = path.join(f.root, 'docs/specs/work-items/WI-GH-118.md');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /Imported Issue \(untrusted\)/);
  assert.match(text, /> \*\*Status:\*\* VERIFIED/);
  const row = listRows(f).find(r => r.id === 'WI-GH-118');
  assert.equal(row.statusRaw, 'backlog'); assert.equal(row.priority, 'medium');
  assert.deepEqual(row.dependencies, []); assert.equal(row.filed, '2026-09-20'); assert.equal(row.closed, null);
  assert.equal(row.subject, 'Imported request');
  const before = fs.readFileSync(file);
  assert.equal(f.run(['--pull', '118']).status, 0);
  assert.deepEqual(fs.readFileSync(file), before, 'identical pull must not rewrite mirror');
  f.mutate(s => { s.issues[118].body += '\nRemote edit'; s.issues[118].updated_at = '2026-09-21T12:00:00Z'; });
  assertFailed(f.run(['--pull', '118']), 'remote change');
  assert.deepEqual(fs.readFileSync(file), before, 'remote conflict must retain local mirror');
  assertTransport(f);
});
test('critical: PROMOTED cannot close, while VERIFIED with a durable note closes once', t => {
  const f = fixture(t); f.configure(); const file = f.wi('WI-9', 'VERIFIED');
  const pub = f.publish('WI-9'); assert.equal(pub.status, 0, pub.stderr);
  assert.equal(f.state().issues[500].state, 'open');
  const sha = verifiedNote(f, 'WI-9');
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('VERIFIED', 'PROMOTED'));
  assertFailed(f.run(['--close-wi', 'WI-9', '--commit', sha]), 'PROMOTED close');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 0);
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('PROMOTED', 'VERIFIED'));
  const close = f.run(['--close-wi', 'WI-9', '--commit', sha]); assert.equal(close.status, 0, close.stderr);
  assert.equal(f.state().issues[500].state, 'closed');
  const patch = writes(f).filter(c => method(c) === 'PATCH');
  assert.equal(patch.length, 1);
  const payload = JSON.parse(patch[0].stdin);
  assert.equal(payload.state, 'closed'); assert.equal(payload.state_reason, 'completed');
  assert.match(payload.body, new RegExp(sha));
  assert.doesNotMatch(payload.body, /verify-body\.json|\/home\//);
  assertTransport(f);
});

test('remote modes enforce origin and publish a complete curated body', t => {
  const f = fixture(t); f.wi('WI-10', 'PROMOTED');
  f.configure('github-backed');
  assertFailed(f.publish('WI-10'), 'github-backed local WI');
  assert.deepEqual(f.calls(), []);
  f.configure('hybrid-governed');
  const longBody = 'Public explanation.\n' + 'A'.repeat(5000) + '\nEnd of complete text.';
  const sent = f.publish('WI-10', longBody); assert.equal(sent.status, 0, sent.stderr);
  const posts = writes(f).filter(c => method(c) === 'POST');
  assert.equal(posts.length, 1);
  const body = JSON.parse(posts[0].stdin).body;
  assert.ok(body.includes('End of complete text.'));
  assert.ok(body.length > 5000);
  assert.equal(f.state().issues[500].state, 'open');
  const unchanged = f.publish('WI-10', longBody); assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.equal(writes(f).length, 1, 'unchanged publish has no second remote write');
  assertTransport(f);
});
test('pull then close appends owned text, retaining human title/body/comments/labels', t => {
  const human = 'Human introduction.\n\nPlease keep this text and the comments.';
  const original = issue(118, { title: 'Human title', body: human, comments: 2, labels: [{ name: 'triage' }] });
  const f = fixture(t, { issues: { 118: original } }); f.configure('github-backed');
  assert.equal(f.run(['--pull', '118']).status, 0);
  const mirror = path.join(f.root, 'docs/specs/work-items/WI-GH-118.md');
  fs.writeFileSync(mirror, fs.readFileSync(mirror, 'utf8').replace('**Status:** backlog', '**Status:** VERIFIED'));
  const sha = verifiedNote(f, 'WI-GH-118');
  const closed = f.run(['--close-wi', 'WI-GH-118', '--commit', sha]);
  assert.equal(closed.status, 0, closed.stderr);
  const row = f.state().issues[118];
  assert.equal(row.title, 'Human title');
  assert.ok(row.body.startsWith(human));
  assert.equal(row.comments, 2); assert.deepEqual(row.labels, [{ name: 'triage' }]);
  const patches = writes(f).filter(c => method(c) === 'PATCH');
  assert.equal(patches.length, 1);
  assert.equal(Object.keys(JSON.parse(patches[0].stdin)).sort().join(','), 'body,state,state_reason');
  assertTransport(f);
});
test('private content and PR-shaped intake fail before any API write', t => {
  const f = fixture(t, { issues: { 119: issue(119, { pull_request: { url: 'https://api.github.com/prs/119' } }) } });
  f.configure('hybrid-governed'); f.wi('WI-11');
  assertFailed(f.run(['--pull', '119']), 'PR intake');
  assert.equal(fs.existsSync(path.join(f.root, 'docs/specs/work-items/WI-GH-119.md')), false);
  assertFailed(f.publish('WI-11', 'Authorization: Bearer ghp_123456789012345678901234567890123456'), 'credential');
  assert.equal(writes(f).length, 0);
  assertTransport(f);
});
test('critical: lost POST response never triggers a blind second POST', t => {
  const f = fixture(t); f.configure(); f.wi('WI-12');
  f.mutate(s => { s.losePostResponse = true; });
  assertFailed(f.publish('WI-12'), 'lost create response');
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  f.publish('WI-12');
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  assert.equal(Object.keys(f.state().issues).length, 1);
  assertTransport(f);
});
test('sibling Git worktrees share one issue identity', t => {
  const f = fixture(t); f.configure(); f.wi('WI-13');
  const first = f.publish('WI-13'); assert.equal(first.status, 0, first.stderr);
  const sibling = path.join(f.dir, 'sibling'); git(f.root, 'worktree', 'add', '-b', 'sibling', sibling);
  fs.mkdirSync(path.join(sibling, '.svc'), { recursive: true });
  fs.copyFileSync(path.join(f.root, '.svc/config.json'), path.join(sibling, '.svc/config.json'));
  fs.mkdirSync(path.join(sibling, 'docs/specs/work-items'), { recursive: true });
  fs.copyFileSync(path.join(f.root, 'docs/specs/work-items/WI-13.md'), path.join(sibling, 'docs/specs/work-items/WI-13.md'));
  const body = path.join(sibling, 'public-body.md'); fs.writeFileSync(body, 'Curated public explanation.');
  const second = f.run(['--publish', '--wi', 'WI-13', '--public-title', 'WI-13: Public title', '--public-body', body], { cwd: sibling });
  assert.equal(second.status, 0, second.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  assert.equal(Object.keys(f.state().issues).length, 1);
  assertTransport(f);
});
test('self-authored receipt mirror and unmerged commit cannot close', t => {
  const f = fixture(t); f.configure(); f.wi('WI-14', 'VERIFIED');
  assert.equal(f.publish('WI-14').status, 0);
  git(f.root, 'add', '.'); git(f.root, 'commit', '-m', 'unmerged verified WI');
  const sha = git(f.root, 'rev-parse', 'HEAD');
  const mirror = path.join(f.root, '.svc/receipts', sha.slice(0, 7), 'verify-promotion--WI-14.json');
  fs.mkdirSync(path.dirname(mirror), { recursive: true });
  fs.writeFileSync(mirror, JSON.stringify({ receipt_type: 'verify-promotion', schema_version: 1, wi: 'WI-14', verdict: 'pass', passes: {
    p1_promotion_evidence: 'pass', p2_spec_ac_verification: 'pass', p3_runtime_validation: 'pass', p4_state_closeout: 'pass' },
    p3_target_type: 'install-validation', p3_outcome: 'pass', timestamp: '2026-09-26T12:00:00Z' }));
  assertFailed(f.run(['--close-wi', 'WI-14', '--commit', sha]), 'mirror-only proof');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 0);
  const noteSha = verifiedNote(f, 'WI-14');
  git(f.root, 'commit', '--allow-empty', '-m', 'later unmerged commit');
  const unmerged = git(f.root, 'rev-parse', 'HEAD');
  assertFailed(f.run(['--close-wi', 'WI-14', '--commit', unmerged]), 'stale note');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 0);
  assert.notEqual(noteSha, unmerged);
});

test('invalid configuration and changed repository fail before a remote call', t => {
  const f = fixture(t); f.wi('WI-15');
  assertFailed(f.run(['--configure', 'hybrid-governed', '--repo', 'bad host/repo']), 'invalid repository');
  assert.deepEqual(f.calls(), []);
  f.configure();
  const first = f.publish('WI-15'); assert.equal(first.status, 0, first.stderr);
  const beforeCalls = f.calls().length;
  const changed = f.run(['--configure', 'hybrid-governed', '--repo', 'other/project']);
  assert.equal(changed.status, 0, changed.stderr);
  assertFailed(f.publish('WI-15'), 'mapped WI after repository change');
  assert.equal(f.calls().length, beforeCalls, 'repository conflict must be local');
  const config = path.join(f.root, '.svc/config.json');
  const value = JSON.parse(fs.readFileSync(config)); value.issue_tracker.private_terms = ['internal'];
  fs.writeFileSync(config, JSON.stringify(value));
  assertFailed(f.run(['--pull', '118']), 'repo config with private terms');
  assert.equal(f.calls().length, beforeCalls);
});
test('pull refuses a symlink mirror and leaves its target unchanged', t => {
  const f = fixture(t, { issues: { 120: issue(120) } }); f.configure('github-backed');
  const outside = path.join(f.dir, 'outside.md'); fs.writeFileSync(outside, 'owner text');
  const dir = path.join(f.root, 'docs/specs/work-items'); fs.mkdirSync(dir, { recursive: true });
  fs.symlinkSync(outside, path.join(dir, 'WI-GH-120.md'));
  assertFailed(f.run(['--pull', '120']), 'symlink pull target');
  assert.equal(fs.readFileSync(outside, 'utf8'), 'owner text');
  assertTransport(f);
});
test('duplicate-marker recovery refuses creation; explicit adoption finds exact issue', t => {
  const f = fixture(t); f.configure(); f.wi('WI-16');
  f.mutate(s => { s.losePostResponse = true; });
  assertFailed(f.publish('WI-16'), 'lost response');
  const first = f.state().issues[500];
  f.mutate(s => { s.issues[501] = issue(501, { title: first.title, body: first.body }); });
  assertFailed(f.publish('WI-16'), 'duplicate exact markers');
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  f.mutate(s => { delete s.issues[501]; });
  const adopted = f.run(['--adopt-issue', '500', '--wi', 'WI-16']);
  assert.equal(adopted.status, 0, adopted.stderr);
  const again = f.publish('WI-16'); assert.equal(again.status, 0, again.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  assertTransport(f);
});
test('explicit recovery cannot steal a live lock but can clear a proven dead holder', t => {
  const f = fixture(t); f.configure();
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const lock = path.resolve(f.root, common, 'svc-issue-tracker/lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, host: os.hostname(), time: Date.now() }));
  assertFailed(f.run(['--recover-lock']), 'live holder');
  assert.equal(fs.existsSync(lock), true);
  fs.writeFileSync(lock, JSON.stringify({ pid: 99999999, host: os.hostname(), time: Date.now() }));
  const recovered = f.run(['--recover-lock']); assert.equal(recovered.status, 0, recovered.stderr);
  assert.equal(fs.existsSync(lock), false);
  assert.deepEqual(f.calls(), []);
});
test('failed remote close retains VERIFIED locally and exposes retryable close-pending', t => {
  const f = fixture(t); f.configure(); const file = f.wi('WI-17', 'VERIFIED');
  assert.equal(f.publish('WI-17').status, 0);
  const sha = verifiedNote(f, 'WI-17');
  f.mutate(s => { s.failPatch = true; });
  assertFailed(f.run(['--close-wi', 'WI-17', '--commit', sha]), 'remote close failure');
  assert.match(fs.readFileSync(file, 'utf8'), /\*\*Status:\*\* VERIFIED/);
  assert.equal(f.state().issues[500].state, 'open');
  const list = f.run(['--list']); assert.equal(list.status, 0, list.stderr);
  assert.match(list.stdout, /close-pending/);
  f.mutate(s => { s.failPatch = false; });
  const retried = f.run(['--close-wi', 'WI-17', '--commit', sha]);
  assert.equal(retried.status, 0, retried.stderr);
  assert.equal(f.state().issues[500].state, 'closed');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 2);
  assertTransport(f);
});

function emitNoteAt(f, id, sha, verdict) {
  const body = { receipt_type: 'verify-promotion', schema_version: 1, wi: id,
    passes: { p1_promotion_evidence: verdict, p2_spec_ac_verification: verdict,
      p3_runtime_validation: verdict, p4_state_closeout: verdict },
    p3_target_type: 'install-validation', p3_outcome: verdict, verdict,
    timestamp: '2026-09-26T12:00:00Z' };
  const file = path.join(f.root, 'receipt-' + id + '-' + sha.slice(0, 7) + '.json');
  fs.writeFileSync(file, JSON.stringify(body));
  return spawnSync(process.execPath, [EMIT, '--type', 'verify-promotion', '--wi', id, '--sha', sha, '--body', file],
    { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 15000 });
}
test('wrong-WI, failed G7, and a valid note on an unmerged commit cannot close', t => {
  const f = fixture(t); f.configure(); f.wi('WI-18', 'VERIFIED'); f.wi('WI-19', 'VERIFIED');
  assert.equal(f.publish('WI-18').status, 0); assert.equal(f.publish('WI-19').status, 0);
  git(f.root, 'add', '.'); git(f.root, 'commit', '-m', 'two verified items'); git(f.root, 'push', 'origin', 'main');
  const merged = git(f.root, 'rev-parse', 'HEAD');
  f.mutate(s => { s.branchHead = merged; });
  assert.equal(emitNoteAt(f, 'WI-18', merged, 'pass').status, 0);
  assertFailed(f.run(['--close-wi', 'WI-19', '--commit', merged]), 'wrong WI note');
  const failed = emitNoteAt(f, 'WI-19', merged, 'fail');
  assert.equal(failed.status, 0, failed.stderr);
  const checkFailed = spawnSync(process.execPath, [CHECK, '--sha', merged, '--wi', 'WI-19', '--consumer', 'verify-promotion'],
    { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 15000 });
  assert.notEqual(checkFailed.status, 0, 'actual receipt validator must reject a failed G7 note');
  assertFailed(f.run(['--close-wi', 'WI-19', '--commit', merged]), 'failed G7 note');
  git(f.root, 'commit', '--allow-empty', '-m', 'unmerged candidate');
  const unmerged = git(f.root, 'rev-parse', 'HEAD');
  assert.equal(emitNoteAt(f, 'WI-19', unmerged, 'pass').status, 0);
  const checkPass = spawnSync(process.execPath, [CHECK, '--sha', unmerged, '--wi', 'WI-19', '--consumer', 'verify-promotion'],
    { cwd: f.root, env: f.env, encoding: 'utf8', timeout: 15000 });
  assert.equal(checkPass.status, 0, checkPass.stderr);
  assertFailed(f.run(['--close-wi', 'WI-19', '--commit', unmerged]), 'valid note on unmerged commit');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 0);
});

test('an incomplete recovery page cannot authorize a second create', t => {
  const seed = {};
  for (let n = 1; n <= 99; n++) seed[n] = issue(n);
  const f = fixture(t, { issues: seed }); f.configure(); f.wi('WI-20');
  f.mutate(s => { s.losePostResponse = true; s.incompletePage = 2; });
  assertFailed(f.publish('WI-20'), 'lost response');
  assertFailed(f.publish('WI-20'), 'incomplete recovery scan');
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  assert.equal(Object.keys(f.state().issues).length, 100);
  assertTransport(f);
});
test('concurrent sibling publications create one remote issue', async t => {
  const f = fixture(t); f.configure(); f.wi('WI-21');
  const sibling = path.join(f.dir, 'sibling'); git(f.root, 'worktree', 'add', '-b', 'sibling', sibling);
  fs.mkdirSync(path.join(sibling, '.svc'), { recursive: true });
  fs.copyFileSync(path.join(f.root, '.svc/config.json'), path.join(sibling, '.svc/config.json'));
  fs.mkdirSync(path.join(sibling, 'docs/specs/work-items'), { recursive: true });
  fs.copyFileSync(path.join(f.root, 'docs/specs/work-items/WI-21.md'), path.join(sibling, 'docs/specs/work-items/WI-21.md'));
  for (const root of [f.root, sibling]) fs.writeFileSync(path.join(root, 'public-body.md'), 'Curated public explanation.');
  const { spawn } = await import('node:child_process');
  function start(root) {
    return new Promise(resolve => {
      const child = spawn(process.execPath, [CLI, '--publish', '--wi', 'WI-21',
        '--public-title', 'WI-21: Public title', '--public-body', path.join(root, 'public-body.md')],
      { cwd: root, env: f.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      child.stdout.on('data', b => { stdout += b; });
      child.stderr.on('data', b => { stderr += b; });
      child.on('close', status => resolve({ status, stdout, stderr }));
    });
  }
  const results = await Promise.all([start(f.root), start(sibling)]);
  for (const result of results) assert.equal(result.status, 0, result.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  assert.equal(Object.keys(f.state().issues).length, 1);
  assertTransport(f);
});


test('slow GitHub POST holds the shared map lock until sibling publication reconciles', async t => {
  const f = fixture(t); f.configure(); f.wi('WI-21');
  const sibling = path.join(f.dir, 'slow-sibling'); git(f.root, 'worktree', 'add', '-b', 'slow-sibling', sibling);
  fs.mkdirSync(path.join(sibling, '.svc'), { recursive: true });
  fs.copyFileSync(path.join(f.root, '.svc/config.json'), path.join(sibling, '.svc/config.json'));
  fs.mkdirSync(path.join(sibling, 'docs/specs/work-items'), { recursive: true });
  fs.copyFileSync(path.join(f.root, 'docs/specs/work-items/WI-21.md'), path.join(sibling, 'docs/specs/work-items/WI-21.md'));
  for (const root of [f.root, sibling]) fs.writeFileSync(path.join(root, 'public-body.md'), 'Curated public explanation.');
  f.mutate(s => { s.delayPostMs = 20000; });
  const { spawn } = await import('node:child_process');
  function start(root) {
    return new Promise(resolve => {
      const child = spawn(process.execPath, [CLI, '--publish', '--wi', 'WI-21',
        '--public-title', 'WI-21: Public title', '--public-body', path.join(root, 'public-body.md')],
      { cwd: root, env: f.env, stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      const timeout = setTimeout(() => child.kill('SIGKILL'), 45000);
      child.stdout.on('data', b => { stdout += b; });
      child.stderr.on('data', b => { stderr += b; });
      child.on('error', error => { clearTimeout(timeout); resolve({ status: null, stdout, stderr: stderr + error.message }); });
      child.on('close', status => { clearTimeout(timeout); resolve({ status, stdout, stderr }); });
    });
  }
  const first = start(f.root);
  const enteredBy = Date.now() + 5000;
  while (!f.calls().some(c => method(c) === 'POST')) {
    assert.ok(Date.now() < enteredBy, 'first sibling did not enter the GitHub POST');
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  const second = start(sibling);
  const results = await Promise.all([first, second]);
  for (const result of results) assert.equal(result.status, 0, result.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  assert.equal(Object.keys(f.state().issues).length, 1);
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const map = JSON.parse(fs.readFileSync(path.resolve(f.root, common, 'svc-issue-tracker/map.json')));
  assert.deepEqual(Object.keys(map.repositories[REPO].issues), ['WI-21']);
  assert.equal(map.repositories[REPO].issues['WI-21'].number, 500);
  assertTransport(f);
});

test('curated publication removes configured private terms and consumer paths', t => {
  const f = fixture(t); f.configure(); f.wi('WI-22');
  const privateDir = path.join(f.env.HOME, '.svc'); fs.mkdirSync(privateDir, { recursive: true });
  const privateFile = path.join(privateDir, 'issue-tracker-private-terms.json');
  fs.writeFileSync(privateFile, JSON.stringify({ [REPO]: ['Internal Falcon'] }), { mode: 0o600 });
  const text = 'Public context.\n' + f.root + '/drafts/brief.md\nInternal Falcon may be omitted.\nPublic ending.';
  const sent = f.publish('WI-22', text); assert.equal(sent.status, 0, sent.stderr);
  const posts = writes(f).filter(c => method(c) === 'POST'); assert.equal(posts.length, 1);
  const payload = JSON.parse(posts[0].stdin);
  assert.ok(payload.body.includes('Public context.'));
  assert.ok(payload.body.includes('Public ending.'));
  assert.ok(!payload.body.includes(f.root));
  assert.ok(!payload.body.includes('Internal Falcon'));
  fs.chmodSync(privateFile, 0o644);
  assertFailed(f.publish('WI-22', 'Revised public ending.'), 'unsafe private terms file');
  assert.equal(writes(f).length, 1);
  assertTransport(f);
});

test('legacy map adopts one markerless issue without erasing its human body', t => {
  const title = 'WI-23: Public title', human = 'Historical issue text written by a person.';
  const f = fixture(t, { issues: { 121: issue(121, { title, body: human }) } });
  f.configure(); f.wi('WI-23');
  const legacyFile = path.join(f.root, '.svc/github-issues-map.json');
  const legacy = { schema_version: 1, repository: REPO,
    issues: { 'WI-23': { number: 121, url: issueUrl(121), title, state: 'open' } } };
  fs.writeFileSync(legacyFile, JSON.stringify(legacy));
  const published = f.publish('WI-23'); assert.equal(published.status, 0, published.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 0);
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1);
  assert.ok(f.state().issues[121].body.startsWith(human));
  assert.deepEqual(JSON.parse(fs.readFileSync(legacyFile)), legacy, 'legacy input remains intact');
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const map = JSON.parse(fs.readFileSync(path.resolve(f.root, common, 'svc-issue-tracker/map.json')));
  assert.equal(map.repositories[REPO].issues['WI-23'].number, 121);
  assertTransport(f);
});

test('symlinked installed scripts act on the invocation consumer repository', t => {
  const f = fixture(t); f.configure(); f.wi('WI-24');
  const installed = path.join(f.dir, 'installed-scripts');
  fs.symlinkSync(path.join(SOURCE, 'scripts'), installed, 'dir');
  const body = path.join(f.root, 'public-body.md');
  fs.writeFileSync(body, 'Public request from the consumer repository.');
  const nested = path.join(f.root, 'nested', 'operator');
  fs.mkdirSync(nested, { recursive: true });
  const result = spawnSync(process.execPath, [path.join(installed, 'sync-github-issues.mjs'),
    '--publish', '--wi', 'WI-24', '--public-title', 'WI-24: Consumer title', '--public-body', body],
    { cwd: nested, env: f.env, encoding: 'utf8', timeout: 45000 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(f.state().issues[500].title, 'WI-24: Consumer title');
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const map = JSON.parse(fs.readFileSync(path.resolve(f.root, common, 'svc-issue-tracker/map.json')));
  assert.equal(map.repositories[REPO].issues['WI-24'].number, 500);
  assertTransport(f);
});

test('canonical uppercase named WI IDs retain their identity', t => {
  const f = fixture(t); f.configure(); f.wi('WI-081-FOLLOWUP');
  const published = f.publish('WI-081-FOLLOWUP');
  assert.equal(published.status, 0, published.stderr);
  const posts = writes(f).filter(c => method(c) === 'POST');
  assert.equal(posts.length, 1);
  const payload = JSON.parse(posts[0].stdin);
  assert.match(payload.body, /WI-081-FOLLOWUP:begin/);
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const map = JSON.parse(fs.readFileSync(path.resolve(f.root, common, 'svc-issue-tracker/map.json')));
  assert.equal(map.repositories[REPO].issues['WI-081-FOLLOWUP'].number, 500);
  f.wi('WI-081-followup');
  assertFailed(f.publish('WI-081-followup'), 'lowercase suffix is outside canonical grammar');
  assert.equal(writes(f).filter(c => method(c) === 'POST').length, 1);
  assertTransport(f);
});
test('close dry-run reads durable proof without recreating a receipt mirror', t => {
  const f = fixture(t); f.configure(); f.wi('WI-25', 'VERIFIED');
  assert.equal(f.publish('WI-25').status, 0);
  const sha = verifiedNote(f, 'WI-25');
  const receipts = path.join(f.root, '.svc/receipts');
  fs.rmSync(receipts, { recursive: true, force: true });
  const beforeWrites = writes(f).length;
  const preview = f.run(['--close-wi', 'WI-25', '--commit', sha, '--dry-run']);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(fs.existsSync(receipts), false, 'preview must not regenerate receipt mirror');
  assert.equal(writes(f).length, beforeWrites, 'preview has no remote write');
  assert.equal(f.state().issues[500].state, 'open');
});

test('partial close response keeps pending state and retries one explicit PATCH', t => {
  const f = fixture(t); f.configure(); f.wi('WI-26', 'VERIFIED');
  assert.equal(f.publish('WI-26').status, 0);
  const sha = verifiedNote(f, 'WI-26');
  f.mutate(s => { s.partialCloseResponse = true; });
  assertFailed(f.run(['--close-wi', 'WI-26', '--commit', sha]), '200 response left issue open');
  assert.equal(f.state().issues[500].state, 'open');
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const mapFile = path.resolve(f.root, common, 'svc-issue-tracker/map.json');
  const pending = JSON.parse(fs.readFileSync(mapFile)).repositories[REPO].issues['WI-26'];
  assert.equal(pending.close_pending, true);
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1);
  const retry = f.run(['--close-wi', 'WI-26', '--commit', sha]);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(f.state().issues[500].state, 'closed');
  const settled = JSON.parse(fs.readFileSync(mapFile)).repositories[REPO].issues['WI-26'];
  assert.equal(settled.close_pending, undefined);
  assert.equal(settled.state, 'closed');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 2);
  assertTransport(f);
});
test('configured GitHub default head must match local origin before close', t => {
  const f = fixture(t); f.configure(); f.wi('WI-27', 'VERIFIED');
  assert.equal(f.publish('WI-27').status, 0);
  const sha = verifiedNote(f, 'WI-27');
  f.mutate(s => { s.branchHead = 'f'.repeat(40); });
  assertFailed(f.run(['--close-wi', 'WI-27', '--commit', sha]), 'foreign or stale origin head');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 0);
  assert.ok(f.calls().some(c => method(c) === 'GET' && endpoint(c) === 'repos/example/project/branches/main'));
  f.mutate(s => { s.branchHead = sha; });
  const valid = f.run(['--close-wi', 'WI-27', '--commit', sha]);
  assert.equal(valid.status, 0, valid.stderr);
  assert.equal(f.state().issues[500].state, 'closed');
  assertTransport(f);
});

test('adopted pull remains current after owned publish, but human edits conflict', t => {
  const f = fixture(t, { issues: { 118: issue(118, { title: 'Human intake title', body: 'Human intake body.' }) } });
  f.configure('github-backed');
  assert.equal(f.run(['--pull', '118']).status, 0);
  const mirror = path.join(f.root, 'docs/specs/work-items/WI-GH-118.md');
  const original = fs.readFileSync(mirror);
  const published = f.publish('WI-GH-118', 'Reviewed public explanation.');
  assert.equal(published.status, 0, published.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1);
  assert.equal(f.run(['--pull', '118']).status, 0, 'owned publication should not appear as a foreign edit');
  assert.deepEqual(fs.readFileSync(mirror), original, 'repeat pull must not replace original intake');
  f.mutate(s => { s.issues[118].body += '\nHuman follow-up outside owned block.'; });
  assertFailed(f.run(['--pull', '118']), 'human remote edit');
  assert.deepEqual(fs.readFileSync(mirror), original, 'conflict retains local mirror bytes');
  assertTransport(f);
});
test('local listing includes legacy lowercase WI files without allowing publication', t => {
  const f = fixture(t); f.wi('WI-081-followup');
  const listed = f.run(['--list']);
  assert.equal(listed.status, 0, listed.stderr);
  assert.match(listed.stdout, /WI-081-followup/);
  assert.deepEqual(f.calls(), [], 'local listing stays offline');
  f.configure('hybrid-governed');
  assertFailed(f.publish('WI-081-followup'), 'legacy lowercase ID is not publishable');
  assert.deepEqual(f.calls(), [], 'explicit publication rejects before GitHub');
});

test('human body edit between owned operations blocks republish and verified close', t => {
  const f = fixture(t, { issues: { 118: issue(118, { title: 'Original intake', body: 'Original human text.' }) } });
  f.configure('github-backed');
  assert.equal(f.run(['--pull', '118']).status, 0);
  const mirror = path.join(f.root, 'docs/specs/work-items/WI-GH-118.md');
  const originalMirror = fs.readFileSync(mirror);
  assert.equal(f.publish('WI-GH-118', 'First curated explanation.').status, 0);
  const patchCount = writes(f).filter(c => method(c) === 'PATCH').length;
  f.mutate(s => { s.issues[118].body += '\nMaintainer follow-up outside owned block.'; });
  assertFailed(f.publish('WI-GH-118', 'Revised curated explanation.'), 'human body edit before republish');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, patchCount, 'republish must refuse before PATCH');
  fs.writeFileSync(mirror, fs.readFileSync(mirror, 'utf8').replace('**Status:** backlog', '**Status:** VERIFIED'));
  const sha = verifiedNote(f, 'WI-GH-118');
  assertFailed(f.run(['--close-wi', 'WI-GH-118', '--commit', sha]), 'human body edit before close');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, patchCount, 'close must refuse before PATCH');
  fs.writeFileSync(mirror, originalMirror); // Isolate remote conflict from local mirror edits.
  assertFailed(f.run(['--pull', '118']), 'human body edit remains visible to pull');
  assert.deepEqual(fs.readFileSync(mirror), originalMirror);
  assertTransport(f);
});
test('applied publish PATCH with lost or altered response reconciles without a second write', t => {
  for (const mode of ['losePatchResponse', 'alterPatchResponse']) {
    const f = fixture(t, { issues: { 118: issue(118, { title: 'Intake title', body: 'Human intake.' }) } });
    f.configure('github-backed');
    assert.equal(f.run(['--pull', '118']).status, 0);
    const mirror = path.join(f.root, 'docs/specs/work-items/WI-GH-118.md');
    const originalMirror = fs.readFileSync(mirror);
    f.mutate(s => { s[mode] = true; });
    assertFailed(f.publish('WI-GH-118', 'Curated public explanation.'), mode + ' first publish');
    assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1);
    assert.equal(writes(f).filter(c => method(c) === 'POST').length, 0);
    const retry = f.publish('WI-GH-118', 'Curated public explanation.');
    assert.equal(retry.status, 0, mode + ': ' + retry.stderr);
    assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1, mode + ' must reconcile without another PATCH');
    const common = git(f.root, 'rev-parse', '--git-common-dir');
    const map = JSON.parse(fs.readFileSync(path.resolve(f.root, common, 'svc-issue-tracker/map.json')));
    assert.equal(map.repositories[REPO].issues['WI-GH-118'].marker, '<!-- ssve-issue-tracker:example/project:WI-GH-118:begin -->');
    assert.equal(f.run(['--pull', '118']).status, 0, mode + ' own publication should be current');
    f.mutate(s => { s.issues[118].body += '\nHuman later edit.'; });
    assertFailed(f.run(['--pull', '118']), mode + ' human edit must still conflict');
    assert.deepEqual(fs.readFileSync(mirror), originalMirror);
    assertTransport(f);
  }
  const contested = fixture(t, { issues: { 118: issue(118, { title: 'Intake title', body: 'Human intake.' }) } });
  contested.configure('github-backed');
  assert.equal(contested.run(['--pull', '118']).status, 0);
  const mirror = path.join(contested.root, 'docs/specs/work-items/WI-GH-118.md');
  const originalMirror = fs.readFileSync(mirror);
  contested.mutate(s => { s.losePatchResponse = true; });
  assertFailed(contested.publish('WI-GH-118', 'Curated public explanation.'), 'lost first response');
  contested.mutate(s => { s.issues[118].body += '\nHuman edit during uncertainty.'; });
  assertFailed(contested.publish('WI-GH-118', 'Curated public explanation.'), 'human edit before reconciliation');
  assert.equal(writes(contested).filter(c => method(c) === 'PATCH').length, 1, 'uncertain human edit must not be overwritten');
  assertFailed(contested.run(['--pull', '118']), 'human edit must remain visible to pull');
  assert.deepEqual(fs.readFileSync(mirror), originalMirror);
  assertTransport(contested);
});
test('title-only maintainer edit permits close but remains a later pull conflict', t => {
  const f = fixture(t, { issues: { 118: issue(118, { title: 'Original intake title', body: 'Human intake body.' }) } });
  f.configure('github-backed');
  assert.equal(f.run(['--pull', '118']).status, 0);
  const mirror = path.join(f.root, 'docs/specs/work-items/WI-GH-118.md');
  const originalMirror = fs.readFileSync(mirror);
  f.mutate(s => { s.issues[118].title = 'Maintainer revised title'; });
  fs.writeFileSync(mirror, fs.readFileSync(mirror, 'utf8').replace('**Status:** backlog', '**Status:** VERIFIED'));
  const sha = verifiedNote(f, 'WI-GH-118');
  const close = f.run(['--close-wi', 'WI-GH-118', '--commit', sha]);
  assert.equal(close.status, 0, close.stderr);
  assert.equal(f.state().issues[118].title, 'Maintainer revised title', 'close preserves human title');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1);
  fs.writeFileSync(mirror, originalMirror); // Isolate title provenance from local status.
  assertFailed(f.run(['--pull', '118']), 'maintainer title edit must remain visible');
  assert.deepEqual(fs.readFileSync(mirror), originalMirror);
  assertTransport(f);
});

test('pending publish blocks verified close until the original publish is retried', t => {
  const f = fixture(t, { issues: { 118: issue(118, { title: 'Intake title', body: 'Human intake.' }) } });
  f.configure('github-backed');
  assert.equal(f.run(['--pull', '118']).status, 0);
  f.mutate(s => { s.failPatch = true; });
  assertFailed(f.publish('WI-GH-118', 'Curated public explanation.'), 'publish failed before apply');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1);
  f.mutate(s => { s.failPatch = false; });
  const mirror = path.join(f.root, 'docs/specs/work-items/WI-GH-118.md');
  fs.writeFileSync(mirror, fs.readFileSync(mirror, 'utf8').replace('**Status:** backlog', '**Status:** VERIFIED'));
  const sha = verifiedNote(f, 'WI-GH-118');
  assertFailed(f.run(['--close-wi', 'WI-GH-118', '--commit', sha]), 'cross-operation close while publish pending');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1, 'close must not send PATCH');
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const mapFile = path.resolve(f.root, common, 'svc-issue-tracker/map.json');
  assert.ok(JSON.parse(fs.readFileSync(mapFile)).repositories[REPO].issues['WI-GH-118'].pending_publish);
  const retry = f.publish('WI-GH-118', 'Curated public explanation.');
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 2, 'original publish retry may apply once');
  assert.equal(JSON.parse(fs.readFileSync(mapFile)).repositories[REPO].issues['WI-GH-118'].pending_publish, undefined);
  assert.equal(f.state().issues[118].state, 'open');
  assertTransport(f);
});
test('pending close blocks publish until the original verified close is retried', t => {
  const f = fixture(t); f.configure(); f.wi('WI-28', 'VERIFIED');
  assert.equal(f.publish('WI-28').status, 0);
  const sha = verifiedNote(f, 'WI-28');
  f.mutate(s => { s.failPatch = true; });
  assertFailed(f.run(['--close-wi', 'WI-28', '--commit', sha]), 'close failed before apply');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1);
  f.mutate(s => { s.failPatch = false; });
  assertFailed(f.publish('WI-28'), 'cross-operation publish while close pending');
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 1, 'publish must not send PATCH');
  const common = git(f.root, 'rev-parse', '--git-common-dir');
  const mapFile = path.resolve(f.root, common, 'svc-issue-tracker/map.json');
  assert.equal(JSON.parse(fs.readFileSync(mapFile)).repositories[REPO].issues['WI-28'].close_pending, true);
  const retry = f.run(['--close-wi', 'WI-28', '--commit', sha]);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(writes(f).filter(c => method(c) === 'PATCH').length, 2);
  const settled = JSON.parse(fs.readFileSync(mapFile)).repositories[REPO].issues['WI-28'];
  assert.equal(settled.close_pending, undefined);
  assert.equal(settled.state, 'closed');
  assertTransport(f);
});
