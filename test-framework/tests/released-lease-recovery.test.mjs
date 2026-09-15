import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  bootstrapController,
  releaseController,
  authorityStateRoot,
  repositoryId,
  principalId,
  readController,
  writeControllerForTest,
  rearmReleasedController,
} from '../../hooks/lib/authority-store.mjs';
import {
  writeSessionBinding,
  readSessionBinding,
  bindingPath,
  releaseAssociatedCompatibilityBindings,
} from '../../hooks/lib/wi-claim.mjs';
import {
  collectSessionBatons,
  isAuthoritativeMutatingBinding,
  uniqueLaneWi,
} from '../../hooks/lib/authoritative-binding.mjs';
import { evaluateExactWorktreeRecovery } from '../../hooks/lib/pretool-decision-engine.mjs';
import { adoptExistingWorktree, ensureWorktree } from '../../scripts/svc-ensure-worktree.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const origWi = 'WI-RECOVERY-ORIG-01';
const tempWi = 'WI-RECOVERY-TEMP-01';
const sid = '019a0000-0000-7000-8000-00000000aa01';
const foreignSid = '019a0000-0000-7000-8000-00000000bb02';

function git(repo, ...args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function plantUnreleasedBinding(worktree, sessionId, wi, repo, branch) {
  const file = bindingPath(worktree, sessionId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const now = new Date().toISOString();
  const binding = {
    schema_version: 1,
    session_id: sessionId,
    role: 'mutating',
    wi,
    repo_root: repo,
    worktree_root: worktree,
    branch,
    claim_path: path.join(worktree, '.svc', 'claims', `${wi}.claim.json`),
    created_at: now,
    updated_at: now,
    generation: 1,
  };
  fs.writeFileSync(file, `${JSON.stringify(binding, null, 2)}\n`);
  return binding;
}

function fixture() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-released-lease-'));
  const repo = path.join(tmp, 'repo');
  const original = path.join(repo, '.worktrees', 'original');
  const temp = path.join(repo, '.worktrees', 'temp-compat');
  fs.mkdirSync(repo);
  git(repo, 'init', '-b', 'main');
  git(repo, 'config', 'user.name', 'fixture');
  git(repo, 'config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(repo, '.gitignore'), '.worktrees/\n');
  fs.writeFileSync(path.join(repo, 'base'), 'base');
  git(repo, 'add', '.');
  git(repo, 'commit', '-qm', 'base');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo, 'worktree', 'add', '-b', 'feature/original', original);
  git(repo, 'worktree', 'add', '-b', 'bugfix-temp-compat', temp);
  for (const worktree of [original, temp]) {
    fs.mkdirSync(path.join(worktree, '.svc'), { recursive: true });
  }
  const origGraph = {
    schema_version: 1,
    wi: origWi,
    lane: 'framework',
    status: 'in_progress',
    tasks: [{ id: 1, skill: 'land-changeset', subject: 'resume', status: 'in_progress', blocked_by: [] }],
  };
  fs.writeFileSync(path.join(original, '.svc', `lane-tasks-${origWi}.json`), JSON.stringify(origGraph));
  fs.writeFileSync(path.join(original, '.svc', 'session-contract.jsonl'), `${JSON.stringify({ wi: origWi, ts: '2026-09-15T00:00:00Z' })}\n`);
  const tempGraph = { ...origGraph, wi: tempWi };
  fs.writeFileSync(path.join(temp, '.svc', `lane-tasks-${tempWi}.json`), JSON.stringify(tempGraph));
  const env = {
    ...process.env,
    SVC_HOST: 'codex',
    SVC_SESSION_ID: sid,
    CODEX_THREAD_ID: sid,
    CODEX_SESSION_ID: sid,
    CURSOR_CONVERSATION_ID: '',
    CURSOR_SESSION_ID: '',
    GROK_SESSION_ID: '',
    SVC_AGENT_ID: '',
    SVC_AUTHORITY_STATE_ROOT: path.join(tmp, 'authority'),
  };
  const origBind = writeSessionBinding({
    worktree_root: original, repo_root: repo, wi: origWi, branch: 'feature/original',
    session_id: sid, role: 'mutating', host: 'codex',
  });
  assert.equal(origBind.ok, true, JSON.stringify(origBind));
  const origCtx = { stateRoot: authorityStateRoot(original, env), repoId: repositoryId(original), wi: origWi };
  const origLease = bootstrapController({ ...origCtx, worktreeRoot: original, principal: principalId({ host: 'codex', session_id: sid }) });
  const tempCtx = { stateRoot: authorityStateRoot(temp, env), repoId: repositoryId(temp), wi: tempWi };
  const tempLease = bootstrapController({ ...tempCtx, worktreeRoot: temp, principal: principalId({ host: 'codex', session_id: sid }) });
  const releasedTemp = releaseController({ ...tempCtx, principal: principalId({ host: 'codex', session_id: sid }) });
  plantUnreleasedBinding(temp, sid, tempWi, repo, 'bugfix-temp-compat');
  return { tmp, repo, original, temp, env, origCtx, origLease, tempCtx, tempLease: releasedTemp };
}

test('stale released-lease binding is not authoritative and does not mask the original controller', () => {
  const f = fixture();
  try {
    const stale = readSessionBinding(f.temp, sid);
    assert.equal(stale.released_at, undefined);
    assert.equal(isAuthoritativeMutatingBinding(stale, { sessionId: sid, host: 'codex', env: f.env }), false);
    const originalBinding = readSessionBinding(f.original, sid);
    assert.equal(isAuthoritativeMutatingBinding(originalBinding, { sessionId: sid, host: 'codex', env: f.env }), true);
    const across = collectSessionBatons({ repo: f.repo, sessionId: sid, host: 'codex', env: f.env });
    assert.equal(across?.conflict, undefined, JSON.stringify(across));
    assert.equal(across?.worktree, f.original);
    assert.equal(across?.binding?.wi, origWi);
    const explicit = collectSessionBatons({
      repo: f.repo, sessionId: sid, host: 'codex', env: f.env, explicitWorktree: f.original,
    });
    assert.equal(explicit?.worktree, f.original);
    const tempOnly = collectSessionBatons({
      repo: f.repo, sessionId: sid, host: 'codex', env: f.env, explicitWorktree: f.temp,
    });
    assert.equal(tempOnly, null);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('svc-authority release retires the associated v1 binding', () => {
  const f = fixture();
  try {
    const before = readSessionBinding(f.original, sid);
    assert.ok(!before.released_at);
    const result = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-authority.mjs'), 'release',
      '--wi', origWi, '--worktree', f.original, '--session-id', sid,
    ], { env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const lease = JSON.parse(result.stdout);
    assert.equal(lease.state, 'released');
    const after = readSessionBinding(f.original, sid);
    assert.ok(after.released_at);
    assert.equal(isAuthoritativeMutatingBinding(after, { sessionId: sid, host: 'codex', env: f.env }), false);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('same-owner exact worktree recovers a released lease without a magic phrase and is idempotent', () => {
  const f = fixture();
  try {
    const released = releaseController({
      ...f.origCtx,
      principal: principalId({ host: 'codex', session_id: sid }),
    });
    assert.equal(released.state, 'released');
    plantUnreleasedBinding(f.original, sid, origWi, f.repo, 'feature/original');
    const payload = {
      session_id: sid,
      turn_id: 'recover-1',
      cwd: f.original,
      tool_name: 'Bash',
      tool_input: { command: 'touch recovery-probe', workdir: f.original },
    };
    const exact = evaluateExactWorktreeRecovery(payload, f.env, { worktree_root: f.original });
    assert.equal(exact.eligible, true, JSON.stringify(exact));
    assert.equal(exact.wi, origWi);
    assert.equal(exact.reason_code, 'SAME_OWNER_RELEASED_LEASE');
    const first = adoptExistingWorktree({ wi: origWi, cwd: f.original, prepareSession: true, sessionId: sid }, f.env);
    assert.equal(first.absolute_worktree, f.original);
    assert.equal(readController(f.origCtx).state, 'active');
    assert.ok(readController(f.origCtx).generation > released.generation);
    const bound = readSessionBinding(f.original, sid);
    assert.ok(!bound.released_at);
    const second = adoptExistingWorktree({ wi: origWi, cwd: f.original, prepareSession: true, sessionId: sid }, f.env);
    assert.equal(second.authority_v2.lease.generation, first.authority_v2.lease.generation);
    const ensured = ensureWorktree({ wi: origWi, branch: 'feature/original', cwd: f.original }, f.env);
    assert.equal(ensured.absolute_worktree, f.original);
    const migrate = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-ensure-worktree.mjs'),
      '--wi', origWi, '--branch', 'feature/original', '--from', 'origin/main', '--authority-v2', '--json',
    ], { cwd: f.original, env: f.env, encoding: 'utf8' });
    assert.equal(migrate.status, 0, migrate.stderr);
    const migrated = JSON.parse(migrate.stdout);
    assert.equal(migrated.authority_v2.lease.state, 'active');
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('foreign principal and default checkout cannot auto-recover a released lease', () => {
  const f = fixture();
  try {
    releaseController({ ...f.origCtx, principal: principalId({ host: 'codex', session_id: sid }) });
    const foreignEnv = { ...f.env, SVC_SESSION_ID: foreignSid, CODEX_THREAD_ID: foreignSid, CODEX_SESSION_ID: foreignSid };
    const foreign = evaluateExactWorktreeRecovery({
      session_id: foreignSid, cwd: f.original, tool_name: 'Bash',
      tool_input: { command: 'touch x', workdir: f.original },
    }, foreignEnv, { worktree_root: f.original });
    assert.equal(foreign.eligible, false);
    assert.equal(foreign.reason_code, 'FOREIGN_RELEASED_LEASE');
    assert.throws(
      () => adoptExistingWorktree({ wi: origWi, cwd: f.original, prepareSession: true }, foreignEnv),
      /different principal|handover/i,
    );
    const main = evaluateExactWorktreeRecovery({
      session_id: sid, cwd: f.repo, tool_name: 'Bash',
      tool_input: { command: 'touch x' },
    }, f.env, { worktree_root: f.repo });
    assert.equal(main.eligible, false);
    assert.equal(main.reason_code, 'DEFAULT_CHECKOUT');
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('dispatcher recovers original worktree despite a stale released temp binding, without a new phrase', () => {
  const f = fixture();
  try {
    const runtime = path.join(f.tmp, 'runtime');
    fs.mkdirSync(runtime, { mode: 0o700 });
    const env = { ...f.env, SVC_CODEX_RUNTIME_DIR: runtime, NODE_ENV: 'test', SVC_CODEX_TEST_MODE: '1', SVC_CODEX_TEST_REPO: f.original, CODEX_SKILLS_DIR: path.join(root, 'skills') };
    const payload = {
      cwd: f.original,
      session_id: sid,
      turn_id: 'native-released',
      tool_use_id: 'native-released-1',
      tool_name: 'exec_command',
      tool_input: { cmd: 'touch recovery-probe', workdir: f.original },
    };
    const out = spawnSync(process.execPath, [path.join(root, 'hooks/codex/svc-codex-pretool-dispatcher.mjs')], {
      env, input: JSON.stringify(payload), encoding: 'utf8',
    });
    assert.equal(out.status, 0, out.stderr);
    const parsed = JSON.parse(out.stdout);
    const decision = parsed.hookSpecificOutput?.permissionDecision || parsed.permission;
    assert.equal(decision, 'allow', JSON.stringify(parsed));
    const cmd = parsed.hookSpecificOutput?.updatedInput?.cmd || parsed.updated_input?.cmd || '';
    assert.match(String(cmd || parsed.hookSpecificOutput?.permissionDecisionReason || ''), /codex-load-skill|touch recovery-probe/);
    assert.doesNotMatch(JSON.stringify(parsed), /controller lease is released/);
    assert.equal(collectSessionBatons({ repo: f.repo, sessionId: sid, host: 'codex', env: f.env })?.worktree, f.original);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('release cleanup retries after v2 release and before compatibility cleanup', () => {
  const f = fixture();
  try {
    const released = releaseController({
      ...f.origCtx,
      principal: principalId({ host: 'codex', session_id: sid }),
    });
    assert.equal(released.state, 'released');
    plantUnreleasedBinding(f.original, sid, origWi, f.repo, 'feature/original');
    assert.equal(readSessionBinding(f.original, sid).released_at, undefined);
    const retry = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-authority.mjs'), 'release',
      '--wi', origWi, '--worktree', f.original, '--session-id', sid,
    ], { env: f.env, encoding: 'utf8' });
    assert.equal(retry.status, 0, retry.stderr);
    assert.equal(JSON.parse(retry.stdout).state, 'released');
    assert.ok(readSessionBinding(f.original, sid).released_at);
    const again = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-authority.mjs'), 'release',
      '--wi', origWi, '--worktree', f.original, '--session-id', sid,
    ], { env: f.env, encoding: 'utf8' });
    assert.equal(again.status, 0, again.stderr);
    assert.ok(readSessionBinding(f.original, sid).released_at);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('release cleanup retry does not retire a binding after same-owner rearm', () => {
  const f = fixture();
  try {
    const released = releaseController({
      ...f.origCtx,
      principal: principalId({ host: 'codex', session_id: sid }),
    });
    plantUnreleasedBinding(f.original, sid, origWi, f.repo, 'feature/original');
    const rearms = rearmReleasedController({
      ...f.origCtx, worktreeRoot: f.original,
      principal: principalId({ host: 'codex', session_id: sid }),
      expectedGeneration: Number(released.generation), expectedLeaseId: released.lease_id,
    });
    const rebound = writeSessionBinding({
      worktree_root: f.original, repo_root: f.repo, wi: origWi, branch: 'feature/original',
      session_id: sid, role: 'mutating', host: 'codex', env: f.env, controller_lease: rearms,
    });
    assert.equal(rebound.ok, true, JSON.stringify(rebound));
    const cleanup = releaseAssociatedCompatibilityBindings({
      worktree_root: f.original, wi: origWi, session_id: sid,
      principal: principalId({ host: 'codex', session_id: sid }),
      generation: released.generation, env: f.env,
    });
    assert.equal(cleanup.ok, true, JSON.stringify(cleanup));
    assert.equal(cleanup.released, false);
    assert.equal(readSessionBinding(f.original, sid).released_at, undefined);
    assert.equal(readController(f.origCtx).lease_id, rearms.lease_id);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('expired same-owner lease is not a mutation baton and recovers without a phrase', () => {
  const f = fixture();
  try {
    process.env.NODE_ENV = 'test';
    const live = readController(f.origCtx);
    writeControllerForTest({
      stateRoot: f.origCtx.stateRoot,
      lease: { ...live, expires_at: new Date(Date.now() - 60_000).toISOString() },
      expectedRevision: live.backend_revision,
    });
    plantUnreleasedBinding(f.original, sid, origWi, f.repo, 'feature/original');
    assert.equal(isAuthoritativeMutatingBinding(readSessionBinding(f.original, sid), {
      sessionId: sid, host: 'codex', env: f.env,
    }), false);
    const across = collectSessionBatons({ repo: f.repo, sessionId: sid, host: 'codex', env: f.env, explicitWorktree: f.original });
    assert.equal(across, null);
    const exact = evaluateExactWorktreeRecovery({
      session_id: sid, cwd: f.original, tool_name: 'Bash',
      tool_input: { command: 'touch recovery-probe', workdir: f.original },
    }, f.env, { worktree_root: f.original });
    assert.equal(exact.eligible, true, JSON.stringify(exact));
    assert.equal(exact.reason_code, 'SAME_OWNER_EXPIRED_LEASE');
    const recovered = adoptExistingWorktree({ wi: origWi, cwd: f.original, prepareSession: true, sessionId: sid }, f.env);
    assert.equal(recovered.absolute_worktree, f.original);
    assert.equal(readController(f.origCtx).state, 'active');
    assert.ok(Date.parse(readController(f.origCtx).expires_at) > Date.now());
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('active v2 reconciles a live foreign v1 claim without swallowing errors', () => {
  const f = fixture();
  try {
    const foreignClaimSid = '019a0000-0000-7000-8000-00000000cc03';
    const claimPath = path.join(f.original, '.svc', 'claims', `${origWi}.claim.json`);
    const claim = JSON.parse(fs.readFileSync(claimPath, 'utf8'));
    claim.session_id = foreignClaimSid;
    claim.renewed_at = new Date().toISOString();
    delete claim.released_at;
    fs.writeFileSync(claimPath, `${JSON.stringify(claim, null, 2)}\n`);
    const lease = readController(f.origCtx);
    const blocked = writeSessionBinding({
      worktree_root: f.original, repo_root: f.repo, wi: origWi, branch: 'feature/original',
      session_id: sid, role: 'mutating', host: 'codex', env: f.env,
    });
    assert.equal(blocked.ok, false);
    assert.match(blocked.warning, /already claimed/);
    const synced = writeSessionBinding({
      worktree_root: f.original, repo_root: f.repo, wi: origWi, branch: 'feature/original',
      session_id: sid, role: 'mutating', host: 'codex', env: f.env, controller_lease: lease,
    });
    assert.equal(synced.ok, true, JSON.stringify(synced));
    assert.equal(synced.binding.session_id, sid);
    assert.equal(JSON.parse(fs.readFileSync(synced.binding.claim_path, 'utf8')).session_id, sid);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('historical extra lane graphs do not hide the owned v2 controller baton', () => {
  const f = fixture();
  try {
    for (let i = 2; i <= 8; i += 1) {
      const extraWi = `WI-HIST-${String(i).padStart(2, '0')}`;
      fs.writeFileSync(path.join(f.original, '.svc', `lane-tasks-${extraWi}.json`), JSON.stringify({
        schema_version: 1, wi: extraWi, lane: 'framework', status: 'in_progress',
        tasks: [{ id: 1, skill: 'land-changeset', subject: 'hist', status: 'in_progress', blocked_by: [] }],
      }));
    }
    assert.equal(uniqueLaneWi(f.original), '');
    const across = collectSessionBatons({ repo: f.repo, sessionId: sid, host: 'codex', env: f.env, explicitWorktree: f.original });
    assert.equal(across?.worktree, f.original);
    assert.equal(across?.binding?.wi, origWi);
    const exact = evaluateExactWorktreeRecovery({
      session_id: sid, cwd: f.original, tool_name: 'Bash',
      tool_input: { command: 'touch recovery-probe', workdir: f.original },
    }, f.env, { worktree_root: f.original });
    assert.equal(exact.eligible, true, JSON.stringify(exact));
    assert.equal(exact.wi, origWi);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('v2-only baton survives missing v1 binding plus historical graphs', () => {
  const f = fixture();
  try {
    const bindingFile = bindingPath(f.original, sid);
    fs.unlinkSync(bindingFile);
    for (let i = 2; i <= 8; i += 1) {
      const extraWi = `WI-MISSING-${String(i).padStart(2, '0')}`;
      fs.writeFileSync(path.join(f.original, '.svc', `lane-tasks-${extraWi}.json`), JSON.stringify({
        schema_version: 1, wi: extraWi, lane: 'framework', status: 'in_progress',
        tasks: [{ id: 1, skill: 'land-changeset', subject: 'hist', status: 'in_progress', blocked_by: [] }],
      }));
    }
    assert.equal(uniqueLaneWi(f.original), '');
    assert.equal(readSessionBinding(f.original, sid), null);
    const across = collectSessionBatons({ repo: f.repo, sessionId: sid, host: 'codex', env: f.env, explicitWorktree: f.original });
    assert.equal(across?.worktree, f.original);
    assert.equal(across?.binding?.wi, origWi);
    const exact = evaluateExactWorktreeRecovery({
      session_id: sid, cwd: f.original, tool_name: 'Bash',
      tool_input: { command: 'touch recovery-probe', workdir: f.original },
    }, f.env, { worktree_root: f.original });
    assert.equal(exact.eligible, true, JSON.stringify(exact));
    assert.equal(exact.wi, origWi);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('explicit stop/cancel blocks exact same-owner recovery', () => {
  const f = fixture();
  try {
    const runtime = path.join(f.tmp, 'runtime');
    fs.mkdirSync(runtime, { mode: 0o700 });
    const env = { ...f.env, SVC_CODEX_RUNTIME_DIR: runtime };
    const payload = {
      cwd: f.original, session_id: sid, turn_id: 'stop-1',
      prompt: 'stop this task',
      tool_name: 'Bash',
      tool_input: { command: 'touch recovery-probe', workdir: f.original },
    };
    const recorded = spawnSync(process.execPath, [path.join(root, 'hooks/codex/svc-codex-prompt-authority.mjs')], {
      env, input: JSON.stringify(payload), encoding: 'utf8',
    });
    assert.equal(recorded.status, 0, recorded.stderr);
    const exact = evaluateExactWorktreeRecovery(payload, env, { worktree_root: f.original });
    assert.equal(exact.eligible, false, JSON.stringify(exact));
    assert.equal(exact.reason_code, 'EXPLICIT_STOP_OR_CANCEL');
    const missingPhrase = evaluateExactWorktreeRecovery({
      session_id: sid, cwd: f.original, tool_name: 'Bash',
      tool_input: { command: 'touch recovery-probe', workdir: f.original },
    }, f.env, { worktree_root: f.original });
    assert.equal(missingPhrase.eligible, true, JSON.stringify(missingPhrase));
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});
