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
  migrateV1Claim,
  rearmReleasedController,
  rearmExpiredController,
  resumeController,
  renewControllerIfCurrent,
  takeoverController,
  recoverController,
  prepareHandover,
  acceptHandover,
  finalizeHandover,
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
    const principal = principalId({ host: 'codex', session_id: sid });
    assert.throws(
      () => resumeController({ ...f.origCtx, principal, worktreeRoot: f.original }),
      /generation-bound expired recovery required/,
    );
    const recovered = adoptExistingWorktree({ wi: origWi, cwd: f.original, prepareSession: true, sessionId: sid }, f.env);
    assert.equal(recovered.absolute_worktree, f.original);
    const after = readController(f.origCtx);
    assert.equal(after.state, 'active');
    assert.ok(Date.parse(after.expires_at) > Date.now());
    assert.equal(after.lease_id, live.lease_id);
    assert.equal(after.generation, live.generation + 1);
    const staleRenew = renewControllerIfCurrent({
      ...f.origCtx, worktreeRoot: f.original, principal,
      leaseId: live.lease_id, generation: live.generation,
    });
    assert.equal(staleRenew.status, 'stale_decision');
    assert.match(staleRenew.reason, /generation changed/);
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

function newestHandoff(stateRoot, wi) {
  const dir = path.join(stateRoot, 'receipts', 'handoff');
  if (!fs.existsSync(dir)) return { dir, record: null };
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.json'));
  const rows = files.map((name) => {
    const record = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    return { name, record, ts: Date.parse(record.ts) };
  }).filter((row) => row.record.wi === wi).sort((a, b) => a.ts - b.ts);
  return { dir, ...(rows[rows.length - 1] || { record: null }) };
}

function lifecycleRows(stateRoot, wi) {
  const dir = path.join(stateRoot, 'receipts');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')))
    .filter((row) => row.wi === wi);
}

function handoffRows(stateRoot, wi) {
  const dir = path.join(stateRoot, 'receipts', 'handoff');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8')))
    .filter((row) => row.wi === wi);
}

function withFailpoint(name, fn) {
  process.env.SVC_AUTHORITY_TRANSITION_FAILPOINT = name;
  try { return fn(); }
  finally { delete process.env.SVC_AUTHORITY_TRANSITION_FAILPOINT; }
}

function expireOriginal(f) {
  process.env.NODE_ENV = 'test';
  const live = readController(f.origCtx);
  writeControllerForTest({
    stateRoot: f.origCtx.stateRoot,
    lease: { ...live, expires_at: new Date(Date.now() - 60_000).toISOString() },
    expectedRevision: live.backend_revision,
  });
  return readController(f.origCtx);
}

test('no-history expired rearm crash forwards via durable intent without inventing prior handoff', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const expired = expireOriginal(f);
    assert.equal(newestHandoff(f.origCtx.stateRoot, origWi).record, null);
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    })), /injected failpoint: after-lease-before-freeze/);
    const afterCrash = readController(f.origCtx);
    assert.equal(afterCrash.generation, expired.generation + 1);
    assert.equal(newestHandoff(f.origCtx.stateRoot, origWi).record, null);
    const recovered = rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    });
    assert.equal(recovered.generation, expired.generation + 1);
    assert.equal(recovered.lease_id, expired.lease_id);
    const handoff = newestHandoff(f.origCtx.stateRoot, origWi);
    assert.equal(handoff.record.kind, 'recovery');
    assert.equal(handoff.record.generation, recovered.generation);
    assert.equal(handoff.record.old_generation, expired.generation);
    const again = rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    });
    assert.equal(again.generation, recovered.generation);
    assert.equal(again.lease_id, recovered.lease_id);
    assert.throws(() => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.temp, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    }), /worktree mismatch/);
    assert.equal(readController(f.origCtx).generation, recovered.generation);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('released rearm crash forwards freeze and handoff without a second generation bump', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const released = releaseController({ ...f.origCtx, principal });
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => rearmReleasedController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(released.generation), expectedLeaseId: released.lease_id,
    })), /injected failpoint: after-lease-before-freeze/);
    const mid = readController(f.origCtx);
    assert.equal(mid.state, 'active');
    assert.equal(mid.generation, released.generation + 1);
    plantUnreleasedBinding(f.original, sid, origWi, f.repo, 'feature/original');
    const recovered = adoptExistingWorktree({ wi: origWi, cwd: f.original, prepareSession: true, sessionId: sid }, f.env);
    assert.equal(recovered.absolute_worktree, f.original);
    const after = readController(f.origCtx);
    assert.equal(after.generation, mid.generation);
    assert.equal(after.lease_id, mid.lease_id);
    const handoff = newestHandoff(f.origCtx.stateRoot, origWi);
    assert.equal(handoff.record.kind, 'recovery');
    assert.equal(handoff.record.old_generation, released.generation);
    assert.throws(() => rearmReleasedController({
      ...f.origCtx, worktreeRoot: f.temp, principal,
      expectedGeneration: Number(released.generation), expectedLeaseId: released.lease_id,
    }), /worktree mismatch/);
    assert.equal(readController(f.origCtx).generation, after.generation);
    assert.equal(readController(f.origCtx).lease_id, after.lease_id);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('release crash after lease write forward-completes freeze and handoff on retry', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const live = readController(f.origCtx);
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => releaseController({
      ...f.origCtx, principal, expectedGeneration: Number(live.generation), expectedLeaseId: live.lease_id,
    })), /injected failpoint: after-lease-before-freeze/);
    assert.equal(readController(f.origCtx).state, 'released');
    const retry = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-authority.mjs'), 'release',
      '--wi', origWi, '--worktree', f.original, '--session-id', sid,
    ], { env: f.env, encoding: 'utf8' });
    assert.equal(retry.status, 0, retry.stderr);
    const after = JSON.parse(retry.stdout);
    assert.equal(after.state, 'released');
    assert.equal(after.generation, live.generation);
    const handoff = newestHandoff(f.origCtx.stateRoot, origWi);
    assert.equal(handoff.record.kind, 'release');
    assert.ok(readSessionBinding(f.original, sid).released_at);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('wrong expected lease id, stale generation, foreign owner and worktree, and ambiguous live state fail closed', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const foreign = principalId({ host: 'codex', session_id: foreignSid });
    const expired = expireOriginal(f);
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    })), /injected failpoint/);
    assert.throws(() => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: '00000000-0000-4000-8000-000000000000',
    }), /lease id mismatch|lease id changed|generation changed/);
    assert.throws(() => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation) + 3, expectedLeaseId: expired.lease_id,
    }), /generation mismatch|generation changed/);
    assert.throws(() => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal: foreign,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    }), /different principal/);
    assert.throws(() => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.temp, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    }), /worktree mismatch/);
    const mid = readController(f.origCtx);
    writeControllerForTest({
      stateRoot: f.origCtx.stateRoot,
      lease: { ...mid, generation: mid.generation + 4 },
      expectedRevision: mid.backend_revision,
    });
    assert.throws(() => rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    }), /conflicts with the durable transition intent|generation changed|inspect again/);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('tampered open intent planned principal cannot fabricate authority', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const foreign = principalId({ host: 'codex', session_id: foreignSid });
    const released = releaseController({ ...f.origCtx, principal });
    assert.throws(() => withFailpoint('after-intent-before-lease', () => rearmReleasedController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(released.generation), expectedLeaseId: released.lease_id,
    })), /injected failpoint: after-intent-before-lease/);
    const tdir = path.join(f.origCtx.stateRoot, 'transitions');
    const files = fs.readdirSync(tdir).filter((name) => name.endsWith('.json'));
    assert.equal(files.length, 1);
    const intentPath = path.join(tdir, files[0]);
    const intent = JSON.parse(fs.readFileSync(intentPath, 'utf8'));
    intent.planned_lease.controller_principal = foreign;
    fs.writeFileSync(intentPath, `${JSON.stringify(intent, null, 2)}\n`);
    assert.throws(() => rearmReleasedController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(released.generation), expectedLeaseId: released.lease_id,
    }), /different principal|tuple conflict|identity conflict/);
    const live = readController(f.origCtx);
    assert.equal(live.state, 'released');
    assert.equal(live.lease_id, released.lease_id);
    assert.equal(live.generation, released.generation);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('tampered missing recovery handoff is not reconstructed from generation arithmetic', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const expired = expireOriginal(f);
    const recovered = rearmExpiredController({
      ...f.origCtx, worktreeRoot: f.original, principal,
      expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
    });
    const newest = newestHandoff(f.origCtx.stateRoot, origWi);
    assert.equal(newest.record.kind, 'recovery');
    fs.unlinkSync(path.join(newest.dir, newest.name));
    assert.throws(
      () => resumeController({ ...f.origCtx, principal, worktreeRoot: f.original }),
      /lifecycle evidence missing/,
    );
    assert.equal(readController(f.origCtx).generation, recovered.generation);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('v1 generation-nine migration provenance allows canonical resume', () => {
  const f = fixture();
  try {
    const migrateWi = 'WI-MIGRATE-09';
    const claimPath = path.join(f.tmp, 'legacy-claim.json');
    fs.writeFileSync(claimPath, `${JSON.stringify({ wi: migrateWi, session_id: sid, generation: 9 })}\n`, { mode: 0o600 });
    const ctx = { stateRoot: f.origCtx.stateRoot, repoId: f.origCtx.repoId, wi: migrateWi };
    const principal = principalId({ host: 'codex', session_id: sid });
    const migrated = migrateV1Claim({
      ...ctx, claimPath, worktreeRoot: f.original, host: 'codex',
    });
    assert.equal(migrated.lease.generation, 9);
    assert.equal(newestHandoff(f.origCtx.stateRoot, migrateWi).record, null);
    const resumed = resumeController({ ...ctx, worktreeRoot: f.original, principal });
    assert.equal(resumed.generation, 9);
    assert.equal(resumed.lease_id, migrated.lease.lease_id);
    const again = resumeController({ ...ctx, worktreeRoot: f.original, principal });
    assert.equal(again.generation, 9);
    assert.equal(again.lease_id, migrated.lease.lease_id);
    assert.equal(resumed.lifecycle_bound, undefined);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('legacy unmarked generation-nine bootstrap from prior software can resume', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const ctx = { stateRoot: f.origCtx.stateRoot, repoId: f.origCtx.repoId, wi: 'WI-LEGACY-BOOTSTRAP-09' };
    process.env.NODE_ENV = 'test';
    const created = bootstrapController({
      ...ctx, worktreeRoot: f.original, principal, initialGeneration: 9,
    });
    assert.equal(created.generation, 9);
    assert.equal(created.lifecycle_bound, undefined);
    const unmarked = writeControllerForTest({
      stateRoot: ctx.stateRoot,
      lease: { ...created, lifecycle_bound: undefined },
      expectedRevision: created.backend_revision,
    });
    assert.equal(unmarked.lifecycle_bound, undefined);
    const resumed = resumeController({ ...ctx, worktreeRoot: f.original, principal });
    assert.equal(resumed.generation, 9);
    assert.equal(resumed.lease_id, created.lease_id);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('bootstrap initialGeneration greater than one resumes without invented lifecycle evidence', () => {
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const ctx = { stateRoot: f.origCtx.stateRoot, repoId: f.origCtx.repoId, wi: 'WI-BOOTSTRAP-04' };
    const created = bootstrapController({
      ...ctx, worktreeRoot: f.original, principal, initialGeneration: 4,
    });
    assert.equal(created.generation, 4);
    assert.equal(newestHandoff(f.origCtx.stateRoot, ctx.wi).record, null);
    const resumed = resumeController({ ...ctx, worktreeRoot: f.original, principal });
    assert.equal(resumed.generation, 4);
    assert.equal(resumed.lease_id, created.lease_id);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('bootstrap refuses any existing released lease including foreign CLI; recovery uses rearm', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const foreign = principalId({ host: 'codex', session_id: foreignSid });
    const released = releaseController({ ...f.origCtx, principal: owner });
    assert.equal(released.state, 'released');
    assert.throws(
      () => bootstrapController({ ...f.origCtx, worktreeRoot: f.original, principal: owner }),
      /already exists/,
    );
    assert.throws(
      () => bootstrapController({ ...f.origCtx, worktreeRoot: f.original, principal: foreign }),
      /already exists/,
    );
    const foreignEnv = {
      ...f.env,
      SVC_SESSION_ID: foreignSid,
      CODEX_THREAD_ID: foreignSid,
      CODEX_SESSION_ID: foreignSid,
    };
    const foreignCli = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-authority.mjs'), 'bootstrap',
      '--wi', origWi, '--worktree', f.original, '--session-id', foreignSid,
    ], { env: foreignEnv, encoding: 'utf8' });
    assert.notEqual(foreignCli.status, 0, foreignCli.stdout);
    assert.match(`${foreignCli.stderr}\n${foreignCli.stdout}`, /different principal|handover|already exists/);
    const still = readController(f.origCtx);
    assert.equal(still.state, 'released');
    assert.equal(still.controller_principal, owner);
    assert.equal(still.lease_id, released.lease_id);
    const ownerCli = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-authority.mjs'), 'bootstrap',
      '--wi', origWi, '--worktree', f.original, '--session-id', sid,
    ], { env: f.env, encoding: 'utf8' });
    assert.equal(ownerCli.status, 0, ownerCli.stderr);
    const rearmed = JSON.parse(ownerCli.stdout);
    assert.equal(rearmed.state, 'active');
    assert.equal(rearmed.controller_principal, owner);
    assert.equal(rearmed.generation, released.generation + 1);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('authority atomic writes fsync the parent directory after rename and unlink', () => {
  const source = fs.readFileSync(path.join(root, 'hooks/lib/authority-store.mjs'), 'utf8');
  const atomic = source.slice(source.indexOf('function atomicWrite(file, value)'), source.indexOf('function atomicWriteBytes'));
  assert.match(atomic, /fs\.renameSync\(temp, file\)/);
  assert.match(atomic, /fsyncDirectory\(path\.dirname\(file\)\)/);
  assert.doesNotMatch(atomic, /catch \{\s*\}/);
  const bytes = source.slice(source.indexOf('function atomicWriteBytes'), source.indexOf('function durableUnlink'));
  assert.match(bytes, /fsyncDirectory\(path\.dirname\(file\)\)/);
  const unlink = source.slice(source.indexOf('function durableUnlink'), source.indexOf('function withLock'));
  assert.match(unlink, /fsyncDirectory\(path\.dirname\(file\)\)/);
  assert.match(source, /function ensureDir[\s\S]*fsyncDirectory\(createdDir\)/);
  const f = fixture();
  try {
    const principal = principalId({ host: 'codex', session_id: sid });
    const ctx = { stateRoot: f.origCtx.stateRoot, repoId: f.origCtx.repoId, wi: 'WI-FSYNC-01' };
    bootstrapController({ ...ctx, worktreeRoot: f.original, principal });
    const live = readController(ctx);
    const released = releaseController({ ...ctx, principal });
    assert.equal(released.state, 'released');
    assert.equal(readController(ctx).lease_id, live.lease_id);
    const transitionDir = path.join(ctx.stateRoot, 'transitions');
    const leftover = fs.existsSync(transitionDir)
      ? fs.readdirSync(transitionDir).filter((name) => name.endsWith('.json'))
      : [];
    assert.deepEqual(leftover, []);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('migrateV1Claim refuses an existing released v2 lease for same-owner and foreign claims', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const released = releaseController({ ...f.origCtx, principal: owner });
    const ownerClaim = path.join(f.tmp, 'owner-claim.json');
    const foreignClaim = path.join(f.tmp, 'foreign-claim.json');
    fs.writeFileSync(ownerClaim, `${JSON.stringify({ wi: origWi, session_id: sid, generation: 9 })}\n`, { mode: 0o600 });
    fs.writeFileSync(foreignClaim, `${JSON.stringify({ wi: origWi, session_id: foreignSid, generation: 9 })}\n`, { mode: 0o600 });
    assert.throws(
      () => migrateV1Claim({ ...f.origCtx, claimPath: ownerClaim, worktreeRoot: f.original, host: 'codex' }),
      /already exists|rearm|handover/,
    );
    assert.throws(
      () => migrateV1Claim({ ...f.origCtx, claimPath: foreignClaim, worktreeRoot: f.original, host: 'codex' }),
      /already exists|rearm|handover/,
    );
    const still = readController(f.origCtx);
    assert.equal(still.state, 'released');
    assert.equal(still.lease_id, released.lease_id);
    const foreignCli = spawnSync(process.execPath, [
      path.join(root, 'scripts/svc-authority.mjs'), 'migrate',
      '--wi', origWi, '--worktree', f.original, '--session-id', foreignSid,
      '--claim', foreignClaim,
    ], {
      env: { ...f.env, SVC_SESSION_ID: foreignSid, CODEX_THREAD_ID: foreignSid, CODEX_SESSION_ID: foreignSid },
      encoding: 'utf8',
    });
    assert.notEqual(foreignCli.status, 0, foreignCli.stdout);
    assert.match(`${foreignCli.stderr}\n${foreignCli.stdout}`, /already exists|session owner|handover|rearm/);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('matching legacy claim cannot resume an expired v2 controller', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const ctx = { stateRoot: f.origCtx.stateRoot, repoId: f.origCtx.repoId, wi: 'WI-MIGRATE-EXPIRED' };
    const before = bootstrapController({
      ...ctx, worktreeRoot: f.original, principal: owner, initialGeneration: 9,
      now: Date.now() - 10_000, ttlMs: 1_000,
    });
    const claimPath = path.join(f.tmp, 'expired-claim.json');
    fs.writeFileSync(claimPath, `${JSON.stringify({ wi: ctx.wi, session_id: sid, generation: 9 })}\n`, { mode: 0o600 });
    assert.throws(
      () => migrateV1Claim({ ...ctx, claimPath, worktreeRoot: f.original, host: 'codex' }),
      /already exists|rearm|handover|recover/,
    );
    assert.deepEqual(readController(ctx), before);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('takeover and recover persist durable intent and resume cannot skip lifecycle evidence', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const live = readController(f.origCtx);
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => takeoverController({
      ...f.origCtx, principal: successor, expectedPrincipal: owner, expectedGeneration: live.generation, reason: 'bounded-test',
    })), /injected failpoint: after-lease-before-freeze/);
    const stranded = readController(f.origCtx);
    assert.equal(stranded.controller_principal, successor);
    assert.equal(stranded.lifecycle_bound, true);
    assert.throws(
      () => resumeController({ ...f.origCtx, principal: owner, worktreeRoot: f.original }),
      /principal/,
    );
    const forwarded = resumeController({ ...f.origCtx, principal: successor, worktreeRoot: f.original });
    assert.equal(forwarded.generation, live.generation + 1);
    assert.equal(forwarded.lifecycle_bound, true);
    assert.equal(newestHandoff(f.origCtx.stateRoot, origWi).record.kind, 'explicit_takeover');
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('exact takeover retry completes a stranded after-lease intent', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const live = readController(f.origCtx);
    const args = {
      ...f.origCtx, principal: successor, expectedPrincipal: owner, expectedGeneration: live.generation, reason: 'exact-retry',
    };
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => takeoverController(args)), /injected failpoint/);
    const retried = takeoverController(args);
    assert.equal(retried.lease.generation, live.generation + 1);
    assert.equal(retried.lease.controller_principal, successor);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).length, 1);
    assert.equal(lifecycleRows(f.origCtx.stateRoot, origWi).length, 1);
    takeoverController(args);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).length, 1);
    assert.equal(lifecycleRows(f.origCtx.stateRoot, origWi).length, 1);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('exact recover retry completes a stranded after-lease intent', () => {
  const f = fixture();
  try {
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const childScript = `import fs from 'node:fs';import {bootstrapController} from ${JSON.stringify(path.join(root, 'hooks/lib/authority-store.mjs'))};process.stdout.write(JSON.stringify(bootstrapController(JSON.parse(fs.readFileSync(0,'utf8')))));`;
    const ctx = { stateRoot: f.origCtx.stateRoot, repoId: f.origCtx.repoId, wi: 'WI-RECOVER-RETRY', worktreeRoot: f.original, principal: principalId({ host: 'codex', session_id: sid }) };
    const old = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', childScript], { input: JSON.stringify(ctx), encoding: 'utf8' }));
    process.env.NODE_ENV = 'test';
    writeControllerForTest({
      stateRoot: ctx.stateRoot,
      lease: {
        ...old,
        owner_process: { hostname: 'fixture', pid: 2147483647, start_token: 'missing' },
        owner_harness_tracked: false,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      },
      expectedRevision: old.backend_revision,
    });
    const args = {
      ...ctx, principal: successor, expectedGeneration: old.generation, evidence: { same_host_dead: true }, reason: 'exact-retry',
    };
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => recoverController(args)), /injected failpoint/);
    const retried = recoverController(args);
    assert.equal(retried.lease.generation, old.generation + 1);
    assert.equal(retried.lease.controller_principal, successor);
    assert.equal(handoffRows(f.origCtx.stateRoot, 'WI-RECOVER-RETRY').length, 1);
    assert.equal(lifecycleRows(f.origCtx.stateRoot, 'WI-RECOVER-RETRY').length, 1);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('interrupted takeover then token handover completes the prior transition first', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const third = principalId({ host: 'codex', session_id: '019a0000-0000-7000-8000-00000000cc03' });
    const live = readController(f.origCtx);
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => takeoverController({
      ...f.origCtx, principal: successor, expectedPrincipal: owner, expectedGeneration: live.generation, reason: 'bounded-test',
    })), /injected failpoint/);
    const persisted = readController(f.origCtx);
    const prepared = prepareHandover({
      ...f.origCtx, principal: successor, intendedPrincipal: third, ttlMs: 60_000,
    });
    acceptHandover({ ...f.origCtx, principal: third, token: prepared.token });
    const resumed = resumeController({ ...f.origCtx, principal: third, worktreeRoot: f.original });
    assert.equal(resumed.generation, persisted.generation + 1);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).filter((row) => row.kind === 'explicit_takeover' && row.generation === persisted.generation).length, 1);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('discovery completes proven pending lifecycle before exposing a mutation baton', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const live = readController(f.origCtx);
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => takeoverController({
      ...f.origCtx, principal: successor, expectedPrincipal: owner, expectedGeneration: live.generation, reason: 'bounded-test',
    })), /injected failpoint/);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).length, 0);
    const baton = collectSessionBatons({ repo: f.repo, sessionId: foreignSid, host: 'codex', env: f.env });
    assert.equal(baton?.worktree, f.original);
    assert.equal(baton?.binding?.wi, origWi);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).length, 1);
    assert.equal(lifecycleRows(f.origCtx.stateRoot, origWi).length, 1);
    const originalBinding = readSessionBinding(f.original, sid);
    assert.equal(isAuthoritativeMutatingBinding(originalBinding, { sessionId: sid, host: 'codex', env: f.env }), false);
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('post-lease intent prior and planned revision corruption is refused without completing evidence', () => {
  for (const field of ['prior-revision', 'planned-revision']) {
    const f = fixture();
    try {
      const owner = principalId({ host: 'codex', session_id: sid });
      const expired = expireOriginal(f);
      assert.throws(() => withFailpoint('after-lease-before-freeze', () => rearmExpiredController({
        ...f.origCtx, worktreeRoot: f.original, principal: owner,
        expectedGeneration: Number(expired.generation), expectedLeaseId: expired.lease_id,
      })), /injected failpoint/);
      const tdir = path.join(f.origCtx.stateRoot, 'transitions');
      const files = fs.readdirSync(tdir).filter((name) => name.endsWith('.json'));
      assert.equal(files.length, 1, field);
      const intentPath = path.join(tdir, files[0]);
      const intent = JSON.parse(fs.readFileSync(intentPath, 'utf8'));
      if (field === 'prior-revision') intent.prior_lease.backend_revision += 10;
      else intent.planned_lease.backend_revision += 10;
      fs.writeFileSync(intentPath, JSON.stringify(intent));
      const before = readController(f.origCtx);
      const intentBytes = fs.readFileSync(intentPath);
      const originalBinding = readSessionBinding(f.original, sid);
      assert.equal(
        isAuthoritativeMutatingBinding(originalBinding, { sessionId: sid, host: 'codex', env: f.env }),
        false,
        field,
      );
      assert.throws(
        () => resumeController({ ...f.origCtx, principal: owner, worktreeRoot: f.original }),
        /revision|conflicts with the durable transition intent|open transition/,
      );
      assert.deepEqual(readController(f.origCtx), before);
      assert.deepEqual(fs.readFileSync(intentPath), intentBytes);
      assert.equal(lifecycleRows(f.origCtx.stateRoot, origWi).length, 0, field);
      assert.equal(handoffRows(f.origCtx.stateRoot, origWi).length, 0, field);
    } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
  }
});

test('tampered post-lease transition freeze is refused and not completed by discovery', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const live = readController(f.origCtx);
    assert.throws(() => withFailpoint('after-lease-before-freeze', () => takeoverController({
      ...f.origCtx, principal: successor, expectedPrincipal: owner, expectedGeneration: live.generation, reason: 'bounded-test',
    })), /injected failpoint/);
    const tdir = path.join(f.origCtx.stateRoot, 'transitions');
    const files = fs.readdirSync(tdir).filter((name) => name.endsWith('.json'));
    assert.equal(files.length, 1);
    const intentPath = path.join(tdir, files[0]);
    const intent = JSON.parse(fs.readFileSync(intentPath, 'utf8'));
    intent.freeze.generation = Number(intent.freeze.generation) + 7;
    fs.writeFileSync(intentPath, `${JSON.stringify(intent, null, 2)}\n`);
    assert.equal(collectSessionBatons({ repo: f.repo, sessionId: foreignSid, host: 'codex', env: f.env }), null);
    assert.equal(fs.existsSync(intentPath), true);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).length, 0);
    assert.throws(
      () => resumeController({ ...f.origCtx, principal: successor, worktreeRoot: f.original }),
      /freeze tuple conflict|corrupt transition|open transition/,
    );
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('half-accepted handover is completed before prepare, release, takeover, recover, migrate, or accept retry', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const live = readController(f.origCtx);
    const prepared = prepareHandover({
      ...f.origCtx, principal: owner, intendedPrincipal: successor, ttlMs: 60_000,
    });
    process.env.NODE_ENV = 'test';
    const advanced = writeControllerForTest({
      stateRoot: f.origCtx.stateRoot,
      lease: {
        ...live,
        controller_principal: successor,
        generation: live.generation + 1,
        accepted_handover_id: prepared.record.handover_id,
        accepted_token_hash: prepared.record.token_hash,
        lifecycle_bound: true,
        owner_process: { hostname: 'fixture', pid: 2147483647, start_token: 'missing' },
      },
      expectedRevision: readController(f.origCtx).backend_revision,
    });
    assert.equal(advanced.generation, live.generation + 1);
    const acceptedRetry = acceptHandover({ ...f.origCtx, principal: successor, token: prepared.token });
    assert.equal(acceptedRetry.lease.generation, live.generation + 1);
    assert.equal(lifecycleRows(f.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
    assert.equal(handoffRows(f.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);

    const f2 = fixture();
    try {
      const live2 = readController(f2.origCtx);
      const prepared2 = prepareHandover({
        ...f2.origCtx, principal: owner, intendedPrincipal: successor, ttlMs: 60_000,
      });
      process.env.NODE_ENV = 'test';
      writeControllerForTest({
        stateRoot: f2.origCtx.stateRoot,
        lease: {
          ...live2,
          controller_principal: successor,
          generation: live2.generation + 1,
          accepted_handover_id: prepared2.record.handover_id,
          accepted_token_hash: prepared2.record.token_hash,
          lifecycle_bound: true,
        },
        expectedRevision: readController(f2.origCtx).backend_revision,
      });
      const preparedAgain = prepareHandover({
        ...f2.origCtx, principal: successor, intendedPrincipal: owner, ttlMs: 60_000,
      });
      assert.ok(preparedAgain.record.handover_id !== prepared2.record.handover_id);
      assert.equal(lifecycleRows(f2.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
      assert.equal(handoffRows(f2.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
      const released = releaseController({ ...f2.origCtx, principal: successor });
      assert.equal(released.state, 'released');
      assert.equal(lifecycleRows(f2.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
    } finally { fs.rmSync(f2.tmp, { recursive: true, force: true }); }

    const f3 = fixture();
    try {
      const live3 = readController(f3.origCtx);
      const prepared3 = prepareHandover({
        ...f3.origCtx, principal: owner, intendedPrincipal: successor, ttlMs: 60_000,
      });
      process.env.NODE_ENV = 'test';
      writeControllerForTest({
        stateRoot: f3.origCtx.stateRoot,
        lease: {
          ...live3,
          controller_principal: successor,
          generation: live3.generation + 1,
          accepted_handover_id: prepared3.record.handover_id,
          accepted_token_hash: prepared3.record.token_hash,
          lifecycle_bound: true,
          owner_process: { hostname: 'fixture', pid: 2147483647, start_token: 'missing' },
        },
        expectedRevision: readController(f3.origCtx).backend_revision,
      });
      const third = principalId({ host: 'codex', session_id: '019a0000-0000-7000-8000-00000000cc03' });
      takeoverController({
        ...f3.origCtx, principal: third, expectedPrincipal: successor, expectedGeneration: live3.generation + 1, reason: 'after-handover',
      });
      assert.equal(lifecycleRows(f3.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
      assert.equal(handoffRows(f3.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
      const claimPath = path.join(f3.tmp, 'post-handover-claim.json');
      fs.writeFileSync(claimPath, `${JSON.stringify({ wi: origWi, session_id: sid, generation: 1 })}\n`, { mode: 0o600 });
      assert.throws(
        () => migrateV1Claim({ ...f3.origCtx, claimPath, worktreeRoot: f3.original, host: 'codex' }),
        /already exists|rearm|handover|recover/,
      );
      assert.equal(lifecycleRows(f3.origCtx.stateRoot, origWi).filter((row) => row.kind === 'handover').length, 1);
    } finally { fs.rmSync(f3.tmp, { recursive: true, force: true }); }
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('handover acceptance is lifecycle-bound and resume forward-completes stranded token proof', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const prepared = prepareHandover({
      ...f.origCtx, principal: owner, intendedPrincipal: successor, ttlMs: 60_000,
    });
    const accepted = acceptHandover({ ...f.origCtx, principal: successor, token: prepared.token });
    assert.equal(accepted.lease.lifecycle_bound, true);
    const resumed = resumeController({ ...f.origCtx, principal: successor, worktreeRoot: f.original });
    assert.equal(resumed.controller_principal, successor);
    assert.equal(newestHandoff(f.origCtx.stateRoot, origWi).record.kind, 'handover');
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('handover finalization reuses existing lifecycle and handoff evidence', () => {
  const f = fixture();
  try {
    const owner = principalId({ host: 'codex', session_id: sid });
    const successor = principalId({ host: 'codex', session_id: foreignSid });
    const prepared = prepareHandover({
      ...f.origCtx, principal: owner, intendedPrincipal: successor, ttlMs: 60_000,
    });
    const accepted = acceptHandover({ ...f.origCtx, principal: successor, token: prepared.token });
    assert.equal(accepted.lease.lifecycle_bound, true);
    const handoverDir = path.join(f.origCtx.stateRoot, 'handovers');
    const handoverFile = fs.readdirSync(handoverDir).map((name) => path.join(handoverDir, name))
      .find((file) => JSON.parse(fs.readFileSync(file, 'utf8')).wi === origWi);
    const handover = JSON.parse(fs.readFileSync(handoverFile, 'utf8'));
    fs.writeFileSync(handoverFile, `${JSON.stringify({ ...handover, status: 'prepared', consumed_at: undefined }, null, 2)}\n`);
    const first = finalizeHandover({ ...f.origCtx });
    assert.equal(first.completed, true);
    const second = finalizeHandover({ ...f.origCtx });
    assert.equal(second.completed, false);
    const lifecycle = fs.readdirSync(path.join(f.origCtx.stateRoot, 'receipts'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(f.origCtx.stateRoot, 'receipts', name), 'utf8')))
      .filter((row) => row.wi === origWi);
    assert.equal(lifecycle.length, 1);
    const handoff = fs.readdirSync(path.join(f.origCtx.stateRoot, 'receipts', 'handoff'))
      .filter((name) => name.endsWith('.json'))
      .map((name) => JSON.parse(fs.readFileSync(path.join(f.origCtx.stateRoot, 'receipts', 'handoff', name), 'utf8')))
      .filter((row) => row.wi === origWi);
    assert.equal(handoff.length, 1);
    assert.equal(handoff[0].kind, 'handover');
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('collectSessionBatons conflicts when two live v2 controllers share one worktree', () => {
  const f = fixture();
  try {
    bootstrapController({
      stateRoot: f.origCtx.stateRoot, repoId: f.origCtx.repoId, wi: `${origWi}-SECOND`,
      worktreeRoot: f.original, principal: principalId({ host: 'codex', session_id: sid }),
    });
    const across = collectSessionBatons({ repo: f.repo, sessionId: sid, host: 'codex', env: f.env });
    assert.equal(across?.conflict, true, JSON.stringify(across));
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});

test('collectSessionBatons conflicts when an authoritative v1 baton and a v2-only controller coexist', () => {
  const f = fixture();
  try {
    fs.unlinkSync(bindingPath(f.original, sid));
    const extra = path.join(f.repo, '.worktrees', 'v1-only');
    git(f.repo, 'worktree', 'add', extra, '-b', 'feature/v1-only');
    plantUnreleasedBinding(extra, sid, 'WI-V1-ONLY', f.repo, 'feature/v1-only');
    const across = collectSessionBatons({ repo: f.repo, sessionId: sid, host: 'codex', env: f.env });
    assert.equal(across?.conflict, true, JSON.stringify(across));
  } finally { fs.rmSync(f.tmp, { recursive: true, force: true }); }
});
