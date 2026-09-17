import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  evaluateExactWorktreeRecovery,
  evaluateSelfHealAuthority,
  renewSlidingPromptAuthority,
} from '../../hooks/lib/pretool-decision-engine.mjs';
import { authorityPath } from '../../hooks/codex/lib/codex-hook-context.mjs';
import {
  authorityStateRoot,
  bootstrapController,
  principalId,
  readController,
  recoverController,
  repositoryId,
  writeControllerForTest,
} from '../../hooks/lib/authority-store.mjs';
import { sessionId, runtimeRoot, upsertCursorAlias } from '../../hooks/codex/lib/codex-hook-context.mjs';
import { findHarnessProcessIdentity, isPersistentHarness } from '../../hooks/lib/process-liveness.mjs';
import { extractWiId } from '../../hooks/lib/wi-id.mjs';
import { withStateLock } from '../../scripts/state-io.mjs';
import { assertIgnored } from '../../scripts/svc-ensure-worktree.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const adapterPath = path.join(root, 'hooks/cursor/svc-cursor-ssve-adapter.mjs');
const dispatcherPath = path.join(root, 'hooks/codex/svc-codex-pretool-dispatcher.mjs');

function isolatedSubprocessEnv(extra = {}) {
  return {
    PATH: process.env.PATH,
    HOME: extra.HOME || process.env.HOME,
    TMPDIR: process.env.TMPDIR,
    NODE_ENV: extra.NODE_ENV || process.env.NODE_ENV,
    ...extra,
    CODEX_THREAD_ID: '',
    CODEX_SESSION_ID: extra.CODEX_SESSION_ID || '',
    CURSOR_CONVERSATION_ID: extra.CURSOR_CONVERSATION_ID || '',
    CURSOR_SESSION_ID: extra.CURSOR_SESSION_ID || '',
    SVC_SESSION_ID: extra.SVC_SESSION_ID || '',
    SESSION_ID: extra.SESSION_ID || '',
    GROK_SESSION_ID: '',
    CLAUDE_SESSION_ID: '',
    KIMI_SESSION_ID: '',
    GEMINI_SESSION_ID: '',
    OPENCODE_SESSION_ID: '',
  };
}

function setupTestFixture(tmp, wi = 'WI-ZB-01', sid = 'session-zb-owner-1') {
  const repo = path.join(tmp, 'repo');
  const target = path.join(repo, '.worktrees', `wt-${wi.toLowerCase()}`);
  fs.mkdirSync(repo, { recursive: true });
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'zb-tester');
  git('config', 'user.email', 'zb@example.invalid');
  fs.writeFileSync(path.join(repo, '.gitignore'), ".worktrees/\n.svc/\n");
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed');
  git('add', '.');
  git('commit', '-qm', 'seed');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  fs.mkdirSync(path.join(repo, '.worktrees'), { recursive: true });
  git('worktree', 'add', '-b', `fix/${wi.toLowerCase()}`, target);

  fs.mkdirSync(path.join(target, '.svc'), { recursive: true });
  const graph = {
    schema_version: 1,
    wi,
    lane: 'bugfix',
    status: 'in_progress',
    tasks: [
      {
        id: 1,
        skill: 'execute-changeset',
        subject: 'ZB test task',
        status: 'in_progress',
        metadata: { skill: 'execute-changeset', wi },
        blocked_by: [],
      },
    ],
  };
  fs.writeFileSync(path.join(target, '.svc', `lane-tasks-${wi}.json`), JSON.stringify(graph, null, 2));
  fs.writeFileSync(
    path.join(target, '.svc', 'session-contract.jsonl'),
    JSON.stringify({ wi, ts: new Date().toISOString(), authorization_envelope: { rules: [] } }) + '\n'
  );

  const runtimeDir = path.join(tmp, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });

  const env = isolatedSubprocessEnv({
    SVC_HOST: 'cursor',
    SVC_CODEX_RUNTIME_DIR: runtimeDir,
    CODEX_SKILLS_DIR: path.join(root, 'skills'),
  });

  return { repo, target, env, wi, sid, runtimeDir };
}

test('ZB-001: Dead-PID auto-reclaim allows new session to reclaim worktree without human phrase', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-deadpid-'));
  try {
    const { target, repo, env, wi } = setupTestFixture(tmp, 'WI-ZB-DEADPID-01');

    // Bootstrap controller with dead PID (9999999) and foreign principal
    const deadPrincipal = principalId({ host: 'codex', session_id: 'dead-session-999' });
    const v2ctx = {
      stateRoot: authorityStateRoot(target, env),
      repoId: repositoryId(target),
      wi,
      branch: 'fix/wi-zb-deadpid-01',
      base: 'refs/remotes/origin/main',
      worktreeRoot: target,
      principal: deadPrincipal,
    };
    bootstrapController({
      ...v2ctx,
      ttlMs: 24 * 60 * 60 * 1000,
    });

    const leasesDir = path.join(v2ctx.stateRoot, "leases");
    const leaseName = fs.readdirSync(leasesDir)[0];
    const leaseFile = path.join(leasesDir, leaseName);
    const leaseContent = JSON.parse(fs.readFileSync(leaseFile, "utf8"));
    leaseContent.owner_process = { hostname: os.hostname(), pid: 9999999, start_token: "nonexistent" };
    leaseContent.expires_at = new Date(Date.now() - 1000).toISOString();
    fs.writeFileSync(leaseFile, JSON.stringify(leaseContent, null, 2));

    const activeBefore = readController(v2ctx);
    assert.equal(activeBefore.state, 'active');

    // Evaluate exact worktree recovery from a fresh session
    const freshSid = 'fresh-session-123';
    const payload = {
      session_id: freshSid,
      cwd: target,
      tool_name: 'Bash',
      tool_input: { command: 'echo "test" >> seed.txt', workdir: target },
    };
    const recovery = evaluateExactWorktreeRecovery(payload, env, { worktree_root: target });
    assert.equal(recovery.eligible, true, `Expected eligible true, got: ${JSON.stringify(recovery)}`);
    assert.equal(recovery.reason_code, 'DEAD_OWNER_AUTO_RECLAIM');
    assert.equal(recovery.wi, wi);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-002: Cursor identity aliasing resolves child session_id to conversation_id', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-alias-'));
  try {
    const convoId = '5f8904a3-b6c6-4411-8ea6-c9db1675c663';
    const childId = '28f629d9-4567-4890-abcd-ef1234567890';
    const env = { SVC_CODEX_RUNTIME_DIR: tmp, SVC_HOST: 'cursor' };

    // 1. Payload with both establishes alias
    const resolved1 = sessionId({ conversation_id: convoId, session_id: childId }, env);
    assert.equal(resolved1, convoId, 'Must prefer conversation_id over session_id');

    // 2. Subsequent payload with ONLY child session_id resolves to parent conversation_id via alias
    const resolved2 = sessionId({ session_id: childId }, env);
    assert.equal(resolved2, convoId, 'Must resolve child session_id to aliased conversation_id');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-003: 24-hour authority TTL preserves prompt authority at 5 hours (300 minutes)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-ttl-'));
  try {
    const { target, repo, env, wi } = setupTestFixture(tmp, 'WI-ZB-TTL-01');
    const sid = 'session-ttl-test-01';

    // Mock prompt authority recorded 5 hours ago (300 min ago)
    const ctx = {
      repo_root: repo,
      session_id: sid,
      turn_id: 'turn-ttl-1',
      session_dir: path.join(tmp, 'session-dir'),
    };
    fs.mkdirSync(ctx.session_dir, { recursive: true });
    const fiveHoursAgo = new Date(Date.now() - 300 * 60 * 1000).toISOString();
    const doc = {
      schema_version: 1,
      session_id: sid,
      turn_id: 'turn-ttl-1',
      cwd: target,
      repo_root: repo,
      explicit_wi: wi,
      continuation_intent: 'resume',
      recorded_at: fiveHoursAgo,
    };
    fs.writeFileSync(path.join(ctx.session_dir, 'prompt-authority.json'), JSON.stringify(doc, null, 2));

    const payload = {
      session_id: sid,
      turn_id: 'turn-ttl-1',
      cwd: target,
    };
    const gate = evaluateSelfHealAuthority(payload, env, { repo_root: repo, customContext: ctx });
    // Under the new 1440m TTL, 5 hours (300m) is well within the 24h window
    assert.notEqual(gate.reason_code, 'PROMPT_AUTHORITY_EXPIRED', '5 hours must not be expired under 24h TTL');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-004: Deny-storm circuit breaker halts consecutive identical denials after 2 attempts', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-circuit-'));
  try {
    const env = isolatedSubprocessEnv({
      SVC_HOST: 'cursor',
      SVC_CODEX_RUNTIME_DIR: tmp,
      NODE_ENV: 'test',
    });
    const payload = {
      session_id: 'session-looping-agent',
      cwd: '/nonexistent/path',
      tool_name: 'Shell',
      tool_input: { command: 'echo loop' },
    };

    // First denial
    const res1 = spawnSync(process.execPath, [dispatcherPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env,
    });
    assert.equal(res1.status, 0);
    const json1 = JSON.parse((res1.stdout || '').trim().split('\n').at(-1) || '{}');
    assert.equal(json1.permission, 'deny');
    assert.ok(!json1.user_message.includes('CIRCUIT BREAKER'));

    // Second denial with identical input & reason triggers circuit breaker
    const res2 = spawnSync(process.execPath, [dispatcherPath], {
      input: JSON.stringify(payload),
      encoding: 'utf8',
      env,
    });
    assert.equal(res2.status, 0);
    const json2 = JSON.parse((res2.stdout || '').trim().split('\n').at(-1) || '{}');
    assert.equal(json2.permission, 'deny');
    assert.match(json2.user_message, /CIRCUIT BREAKER/i);
    assert.equal(json2.continue, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-005: scripts/worktree.sh create succeeds with zero flags, auto-deriving WI and session ID', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-wtcreate-'));
  try {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main');
    git('config', 'user.name', 'zb-tester');
    git('config', 'user.email', 'zb@example.invalid');
    fs.writeFileSync(path.join(repo, '.gitignore'), ".worktrees/\n.svc/\n");
    fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed');
    git('add', '.');
    git('commit', '-qm', 'seed');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');

    fs.symlinkSync(path.join(root, 'scripts'), path.join(repo, 'scripts'));
    fs.symlinkSync(path.join(root, 'hooks'), path.join(repo, 'hooks'));

    const central = path.join(tmp, 'worktrees');
    const policyPath = path.join(tmp, 'worktree-policy.json');
    fs.writeFileSync(policyPath, JSON.stringify({
      schema_version: 1,
      default_root: central,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    }));
    fs.chmodSync(policyPath, 0o600);

    const wtScript = path.join(root, 'scripts/worktree.sh');
    const res = spawnSync('bash', [wtScript, 'create', 'feature-auth-service'], {
      cwd: repo,
      encoding: 'utf8',
      env: isolatedSubprocessEnv({
        SVC_WORKTREE_POLICY: policyPath,
        HOME: tmp,
      }),
    });

    assert.equal(res.status, 0, `Failed to create worktree: ${res.stderr}\n${res.stdout}`);
    assert.match(res.stdout, /Worktree created/);
    assert.match(res.stdout, /WI:\s+WI-FEATURE-AUTH-SERVICE/);
    assert.match(res.stdout, /Owner:\s+session-/);

    const createdPath = path.join(central, 'repo', 'feature-auth-service');
    assert.ok(fs.existsSync(createdPath), `Worktree directory must exist at ${createdPath}`);
    assert.ok(fs.existsSync(path.join(createdPath, '.svc', 'lane-tasks-WI-FEATURE-AUTH-SERVICE.json')), 'Task graph must be materialized');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

function patchLeaseOwner(target, env, wi, mutate) {
  const v2ctx = {
    stateRoot: authorityStateRoot(target, env),
    repoId: repositoryId(target),
    wi,
  };
  const leasesDir = path.join(v2ctx.stateRoot, 'leases');
  const leaseFile = path.join(leasesDir, fs.readdirSync(leasesDir)[0]);
  const leaseContent = JSON.parse(fs.readFileSync(leaseFile, 'utf8'));
  mutate(leaseContent);
  fs.writeFileSync(leaseFile, JSON.stringify(leaseContent, null, 2));
  return leaseContent;
}

function recoveryPayload(target, sid) {
  return {
    session_id: sid,
    cwd: target,
    tool_name: 'Bash',
    tool_input: { command: 'echo "test" >> seed.txt', workdir: target },
  };
}

test('ZB-006: null/zero owner_process must not auto-reclaim a foreign lease', () => {
  for (const owner of [null, undefined, 0, { hostname: os.hostname(), pid: 0, start_token: 'x' }]) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-nullpid-'));
    try {
      const { target, env, wi } = setupTestFixture(tmp, 'WI-ZB-NULLPID-01');
      const deadPrincipal = principalId({ host: 'codex', session_id: 'dead-session-null' });
      bootstrapController({
        stateRoot: authorityStateRoot(target, env),
        repoId: repositoryId(target),
        wi,
        branch: 'fix/wi-zb-nullpid-01',
        base: 'refs/remotes/origin/main',
        worktreeRoot: target,
        principal: deadPrincipal,
        ttlMs: 24 * 60 * 60 * 1000,
      });
      patchLeaseOwner(target, env, wi, (lease) => {
        lease.owner_process = owner;
        lease.expires_at = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      });
      const recovery = evaluateExactWorktreeRecovery(
        recoveryPayload(target, 'fresh-session-null'),
        env,
        { worktree_root: target },
      );
      assert.equal(recovery.eligible, false, `owner_process=${JSON.stringify(owner)} must not reclaim`);
      assert.notEqual(recovery.reason_code, 'DEAD_OWNER_AUTO_RECLAIM');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
});

test('ZB-007: alive foreign process cannot be stolen; dead PID is immediately reclaimable', () => {
  const remaining = new Date(Date.now() + 60 * 60 * 1000).toISOString();

  const liveTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-live-foreign-'));
  try {
    const { target, env, wi } = setupTestFixture(liveTmp, 'WI-ZB-LIVE-FOREIGN-01');
    const livePrincipal = principalId({ host: 'codex', session_id: 'live-session-foreign' });
    bootstrapController({
      stateRoot: authorityStateRoot(target, env),
      repoId: repositoryId(target),
      wi,
      branch: 'fix/wi-zb-live-foreign-01',
      base: 'refs/remotes/origin/main',
      worktreeRoot: target,
      principal: livePrincipal,
      ttlMs: 24 * 60 * 60 * 1000,
    });
    patchLeaseOwner(target, env, wi, (lease) => {
      lease.owner_process = { hostname: os.hostname(), pid: process.pid };
      lease.expires_at = remaining;
    });
    const recovery = evaluateExactWorktreeRecovery(
      recoveryPayload(target, 'fresh-session-live-foreign'),
      env,
      { worktree_root: target },
    );
    assert.equal(recovery.eligible, false, `live foreign owner must not be stolen: ${JSON.stringify(recovery)}`);
    assert.equal(recovery.reason_code, 'FOREIGN_LIVE_OWNER');
  } finally {
    fs.rmSync(liveTmp, { recursive: true, force: true });
  }

  const deadTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-dead-immediate-'));
  try {
    const { target, env, wi } = setupTestFixture(deadTmp, 'WI-ZB-DEAD-IMMEDIATE-01');
    const deadPrincipal = principalId({ host: 'codex', session_id: 'dead-session-live-ttl' });
    bootstrapController({
      stateRoot: authorityStateRoot(target, env),
      repoId: repositoryId(target),
      wi,
      branch: 'fix/wi-zb-dead-immediate-01',
      base: 'refs/remotes/origin/main',
      worktreeRoot: target,
      principal: deadPrincipal,
      ttlMs: 24 * 60 * 60 * 1000,
    });
    patchLeaseOwner(target, env, wi, (lease) => {
      lease.owner_process = { hostname: os.hostname(), pid: 9999999, start_token: 'nonexistent' };
      lease.owner_harness_tracked = true;
      lease.expires_at = remaining;
    });
    const recovery = evaluateExactWorktreeRecovery(
      recoveryPayload(target, 'fresh-session-dead-immediate'),
      env,
      { worktree_root: target },
    );
    assert.equal(recovery.eligible, true, `dead PID must reclaim immediately: ${JSON.stringify(recovery)}`);
    assert.equal(recovery.reason_code, 'DEAD_OWNER_AUTO_RECLAIM');
  } finally {
    fs.rmSync(deadTmp, { recursive: true, force: true });
  }
});

test('ZB-010: recoverController ignores caller-supplied expiry and dead-pid evidence', () => {
  const remaining = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const forgedExpiry = '2000-01-01T00:00:00.000Z';

  const liveTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-forged-expiry-'));
  try {
    const { target, env, wi } = setupTestFixture(liveTmp, 'WI-ZB-FORGED-EVIDENCE-01');
    const livePrincipal = principalId({ host: 'codex', session_id: 'live-session-forged' });
    const successor = principalId({ host: 'codex', session_id: 'successor-forged' });
    const v2ctx = {
      stateRoot: authorityStateRoot(target, env),
      repoId: repositoryId(target),
      wi,
    };
    bootstrapController({
      ...v2ctx,
      branch: 'fix/wi-zb-forged-evidence-01',
      base: 'refs/remotes/origin/main',
      worktreeRoot: target,
      principal: livePrincipal,
      ttlMs: 24 * 60 * 60 * 1000,
    });
    const live = patchLeaseOwner(target, env, wi, (lease) => {
      lease.owner_process = { hostname: os.hostname(), pid: process.pid };
      lease.expires_at = remaining;
    });
    assert.throws(
      () => recoverController({
        ...v2ctx,
        principal: successor,
        reason: 'forged-expiry',
        evidence: {
          expires_at: forgedExpiry,
          owner_live: false,
          owner_process: 9999999,
        },
      }),
      /FOREIGN_LIVE_OWNER/,
    );
    const stillLive = readController(v2ctx);
    assert.equal(stillLive.generation, live.generation);
    assert.equal(stillLive.controller_principal, livePrincipal);
  } finally {
    fs.rmSync(liveTmp, { recursive: true, force: true });
  }

  const deadTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-stored-dead-'));
  try {
    const { target, env, wi } = setupTestFixture(deadTmp, 'WI-ZB-STORED-DEAD-01');
    const deadPrincipal = principalId({ host: 'codex', session_id: 'dead-session-stored' });
    const successor = principalId({ host: 'codex', session_id: 'successor-stored-dead' });
    const v2ctx = {
      stateRoot: authorityStateRoot(target, env),
      repoId: repositoryId(target),
      wi,
    };
    bootstrapController({
      ...v2ctx,
      branch: 'fix/wi-zb-stored-dead-01',
      base: 'refs/remotes/origin/main',
      worktreeRoot: target,
      principal: deadPrincipal,
      ttlMs: 24 * 60 * 60 * 1000,
    });
    const current = readController(v2ctx);
    const previousNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    writeControllerForTest({
      stateRoot: v2ctx.stateRoot,
      lease: {
        ...current,
        owner_process: { hostname: os.hostname(), pid: 9999999, start_token: 'nonexistent' },
        owner_harness_tracked: true,
        expires_at: remaining,
      },
      expectedRevision: current.backend_revision,
    });
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    const recovered = recoverController({
      ...v2ctx,
      principal: successor,
      reason: 'stored-dead-pid',
      evidence: {},
    });
    assert.equal(recovered.lease.controller_principal, successor);
    assert.equal(recovered.lease.generation, current.generation + 1);
  } finally {
    fs.rmSync(deadTmp, { recursive: true, force: true });
  }
});

test('ZB-008: sliding authority renewal writes session_dir prompt-authority.json', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-slide-'));
  try {
    const sessionDir = path.join(tmp, 'session-dir');
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(sessionDir, 0o700);
    const repoRoot = path.join(tmp, 'worktree');
    fs.mkdirSync(path.join(repoRoot, '.svc'), { recursive: true, mode: 0o700 });
    const ctx = { session_dir: sessionDir, session_id: 'slide-1', repo_root: repoRoot, wi: 'WI-SLIDE' };
    const authPath = authorityPath(ctx);
    const recorded = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const staleContractTs = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    fs.writeFileSync(authPath, JSON.stringify({
      schema_version: 1,
      session_id: 'slide-1',
      recorded_at: recorded,
    }, null, 2));
    fs.chmodSync(authPath, 0o600);
    const sessionContract = path.join(sessionDir, 'session-contract.jsonl');
    const worktreeContract = path.join(repoRoot, '.svc', 'session-contract.jsonl');
    const contractLine = JSON.stringify({ ts: staleContractTs, wi: 'WI-SLIDE', intent: 'resume' });
    fs.writeFileSync(sessionContract, `${contractLine}\n`);
    fs.writeFileSync(worktreeContract, `${contractLine}\n`);
    renewSlidingPromptAuthority(ctx);
    const next = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    assert.notEqual(next.recorded_at, recorded);
    assert.ok(Date.parse(next.recorded_at) > Date.parse(recorded));
    const sessionBytes = fs.readFileSync(sessionContract, 'utf8');
    const worktreeBytes = fs.readFileSync(worktreeContract, 'utf8');
    assert.equal(sessionBytes, `${contractLine}\n`);
    assert.equal(worktreeBytes, `${contractLine}\n`);
    const untouchedSession = JSON.parse(sessionBytes.trim().split('\n').at(-1));
    const untouchedWorktree = JSON.parse(worktreeBytes.trim().split('\n').at(-1));
    assert.equal(untouchedSession.ts, staleContractTs);
    assert.equal(untouchedWorktree.ts, staleContractTs);
    renewSlidingPromptAuthority({});
    renewSlidingPromptAuthority(null);
    const unchanged = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    assert.equal(unchanged.recorded_at, next.recorded_at);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-009: Cursor adapter preserves continue:false from child denial', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-continue-'));
  try {
    const fakeDispatcher = path.join(tmp, 'deny-continue.mjs');
    fs.writeFileSync(fakeDispatcher, `process.stdout.write(JSON.stringify({permission:"deny",user_message:"halted",continue:false})+"\\n");\n`);
    const res = spawnSync(process.execPath, [adapterPath, '--pretool'], {
      input: JSON.stringify({
        session_id: 'session-continue-false',
        cwd: tmp,
        tool_name: 'Shell',
        tool_input: { command: 'echo loop' },
      }),
      encoding: 'utf8',
      env: isolatedSubprocessEnv({
        SVC_HOST: 'cursor',
        SVC_CODEX_RUNTIME_DIR: tmp,
        SVC_CURSOR_DISPATCHER_OVERRIDE: fakeDispatcher,
      }),
    });
    assert.equal(res.status, 0, res.stderr);
    const json = JSON.parse((res.stdout || '').trim().split('\n').at(-1) || '{}');
    assert.equal(json.permission, 'deny');
    assert.equal(json.continue, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-011: Cursor aliases are not resolved under Codex or Claude', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-alias-host-'));
  try {
    const convoId = '5f8904a3-b6c6-4411-8ea6-c9db1675c663';
    const childId = '28f629d9-4567-4890-abcd-ef1234567890';
    for (const host of ['codex', 'claude']) {
      const env = { SVC_CODEX_RUNTIME_DIR: tmp, SVC_HOST: host };
      const first = sessionId({ conversation_id: convoId, session_id: childId }, env);
      assert.equal(first, convoId);
      const childOnly = sessionId({ session_id: childId }, env);
      assert.equal(childOnly, childId, `${host} must not apply Cursor aliases`);
      upsertCursorAlias(childId, convoId, env);
      const afterDirect = sessionId({ session_id: childId }, env);
      assert.equal(afterDirect, childId, `${host} must ignore upsertCursorAlias`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-012: untracked dead PID cannot reclaim until the lease expires', () => {
  const remaining = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-untracked-dead-'));
  try {
    const { target, env, wi } = setupTestFixture(tmp, 'WI-ZB-UNTRACKED-DEAD-01');
    const deadPrincipal = principalId({ host: 'codex', session_id: 'dead-session-untracked' });
    const successor = principalId({ host: 'codex', session_id: 'successor-untracked' });
    const v2ctx = {
      stateRoot: authorityStateRoot(target, env),
      repoId: repositoryId(target),
      wi,
    };
    bootstrapController({
      ...v2ctx,
      branch: 'fix/wi-zb-untracked-dead-01',
      base: 'refs/remotes/origin/main',
      worktreeRoot: target,
      principal: deadPrincipal,
      ttlMs: 24 * 60 * 60 * 1000,
    });
    patchLeaseOwner(target, env, wi, (lease) => {
      lease.owner_process = { hostname: os.hostname(), pid: 9999999, start_token: 'nonexistent' };
      lease.owner_harness_tracked = false;
      lease.expires_at = remaining;
    });
    const recovery = evaluateExactWorktreeRecovery(
      recoveryPayload(target, 'fresh-session-untracked-dead'),
      env,
      { worktree_root: target },
    );
    assert.equal(recovery.eligible, false, `untracked dead pid must wait for expiry: ${JSON.stringify(recovery)}`);
    assert.notEqual(recovery.reason_code, 'DEAD_OWNER_AUTO_RECLAIM');
    assert.throws(
      () => recoverController({
        ...v2ctx,
        principal: successor,
        reason: 'untracked-ephemeral-shell',
        evidence: {},
      }),
      /dead owner process|expired lease/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-013: sliding authority renewal does not rewrite other WI contract rows', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-slide-wi-'));
  try {
    const sessionDir = path.join(tmp, 'session-dir');
    fs.mkdirSync(sessionDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(sessionDir, 0o700);
    const repoRoot = path.join(tmp, 'worktree');
    fs.mkdirSync(path.join(repoRoot, '.svc'), { recursive: true, mode: 0o700 });
    const ctx = { session_dir: sessionDir, session_id: 'slide-wi', repo_root: repoRoot, wi: 'WI-SLIDE' };
    const authPath = authorityPath(ctx);
    fs.writeFileSync(authPath, JSON.stringify({
      schema_version: 1,
      session_id: 'slide-wi',
      recorded_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    }, null, 2));
    fs.chmodSync(authPath, 0o600);
    const sessionContract = path.join(sessionDir, 'session-contract.jsonl');
    const otherTs = '2026-01-01T00:00:00.000Z';
    const ownTs = '2026-01-02T00:00:00.000Z';
    const otherLine = JSON.stringify({ ts: otherTs, wi: 'WI-OTHER', intent: 'keep' });
    const ownLine = JSON.stringify({ ts: ownTs, wi: 'WI-SLIDE', intent: 'resume' });
    const original = `${ownLine}\n${otherLine}\n`;
    fs.writeFileSync(sessionContract, original);
    renewSlidingPromptAuthority(ctx);
    const bytes = fs.readFileSync(sessionContract, 'utf8');
    assert.equal(bytes, original, 'session-contract.jsonl must stay byte-stable');
    const lines = bytes.trim().split('\n');
    assert.equal(JSON.parse(lines[0]).wi, 'WI-SLIDE');
    assert.equal(JSON.parse(lines[0]).ts, ownTs, 'matching row must stay unmodified');
    assert.equal(JSON.parse(lines[1]).wi, 'WI-OTHER');
    assert.equal(JSON.parse(lines[1]).ts, otherTs, 'other WI rows must stay byte-stable');
    assert.equal(JSON.parse(lines[1]).intent, 'keep');
    assert.equal(lines.length, 2, 'renewal must not append a rewritten contract row');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-014: findHarnessProcessIdentity walks past shells to the persistent harness', () => {
  const tree = {
    100: { comm: 'node', cmdline: 'node\0hooks/lib/authority-store.mjs', ppid: 90 },
    90: { comm: 'bash', cmdline: 'bash', ppid: 80 },
    80: { comm: 'codex', cmdline: 'codex', ppid: 1 },
  };
  const found = findHarnessProcessIdentity({
    pid: 100,
    inspect: (pid) => tree[pid] || null,
  });
  assert.equal(found.pid, 80);
  assert.equal(found.harness_tracked, true);

  const shellsOnly = findHarnessProcessIdentity({
    pid: 50,
    inspect: (pid) => ({
      50: { comm: 'bash', cmdline: 'bash', ppid: 40 },
      40: { comm: 'sh', cmdline: 'sh', ppid: 1 },
    }[pid] || null),
  });
  assert.equal(shellsOnly.pid, process.pid);
  assert.equal(shellsOnly.harness_tracked, false);
});

test('ZB-015: upsertCursorAlias steals a lock only when the holder pid is dead', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-alias-lock-'));
  try {
    const runtimeDir = path.join(tmp, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(runtimeDir, 0o700);
    const env = { SVC_HOST: 'cursor', SVC_CODEX_RUNTIME_DIR: runtimeDir };
    const file = path.join(runtimeRoot(env), 'cursor-session-aliases.json');
    const lockPath = `${file}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999999, time: Date.now() }));
    upsertCursorAlias('child-dead', 'parent-dead', env);
    const aliases = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(aliases['child-dead'], 'parent-dead');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-016: upsertCursorAlias does not steal a living lock based on elapsed time', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb-alias-live-lock-'));
  try {
    const runtimeDir = path.join(tmp, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(runtimeDir, 0o700);
    const env = { SVC_HOST: 'cursor', SVC_CODEX_RUNTIME_DIR: runtimeDir };
    const file = path.join(runtimeRoot(env), 'cursor-session-aliases.json');
    const lockPath = `${file}.lock`;
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, time: Date.now() - 30_000 }));
    upsertCursorAlias('child-live', 'parent-live', env);
    assert.equal(fs.existsSync(lockPath), true, 'living lock must not be stolen');
    assert.equal(fs.existsSync(file), false, 'aliases must not be written while a live lock is held');
    const src = fs.readFileSync(path.join(root, 'hooks/codex/lib/codex-hook-context.mjs'), 'utf8');
    const fn = src.slice(src.indexOf('export function upsertCursorAlias'), src.indexOf('export function sessionId'));
    assert.match(fn, /processIsAlive\(lock\.pid\) === false/);
    assert.doesNotMatch(fn, /Date\.now\(\) - lock\.time > 10000/);
    assert.doesNotMatch(fn, /mtimeMs > 10000/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-017: findHarnessProcessIdentity walks past MainThread node v24 comm', () => {
  // Simulate: pid 100 = MainThread (Node v24 hook subprocess running a script)
  //           pid 200 = codex (the real harness)
  const tree = {
    100: { comm: 'MainThread', cmdline: 'node\0hooks/lib/authority-store.mjs', ppid: 200 },
    200: { comm: 'codex', cmdline: 'codex\0--session', ppid: 1 },
  };
  const result = findHarnessProcessIdentity({
    pid: 100,
    inspect: (pid) => tree[pid] || null,
  });
  assert.equal(result.pid, 200, 'should walk past MainThread to codex');
  assert.equal(result.harness_tracked, true);
});

test('ZB-018: freshness guard does not block writes to session-contract.jsonl', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb018-'));
  const hookPath = path.join(root, 'hooks/svc-session-contract-freshness.mjs');
  try {
    const repoDir = path.join(tmp, 'repo');
    const svcDir = path.join(repoDir, '.svc');
    fs.mkdirSync(svcDir, { recursive: true });
    execFileSync('git', ['init', '-b', 'main'], { cwd: repoDir, stdio: 'ignore' });

    const staleTs = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const contract = JSON.stringify({ ts: staleTs, wi: 'WI-TEST', bound_to: 'wi-backlog', skill: 'test' });
    const contractTarget = path.join(svcDir, 'session-contract.jsonl');
    fs.writeFileSync(contractTarget, contract + '\n');

    assert.ok(contractTarget.includes(path.join('.svc', 'session-contract.jsonl')));
    assert.equal(path.basename(contractTarget), 'session-contract.jsonl');

    const env = isolatedSubprocessEnv({ HOME: tmp });
    const allowed = spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: contractTarget, content: contract + '\n' },
        cwd: repoDir,
      }),
      encoding: 'utf8',
      cwd: repoDir,
      env,
    });
    assert.equal(allowed.status, 0, `session-contract.jsonl write must be exempt: ${allowed.stderr}`);

    const blocked = spawnSync(process.execPath, [hookPath], {
      input: JSON.stringify({
        tool_name: 'Write',
        tool_input: { file_path: path.join(repoDir, 'other.txt'), content: 'x' },
        cwd: repoDir,
      }),
      encoding: 'utf8',
      cwd: repoDir,
      env,
    });
    assert.equal(blocked.status, 2, 'stale contract must still block unrelated writes');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-019: upsertCursorAlias recovers from empty crash-orphaned lock file', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb019-'));
  try {
    const runtimeDir = path.join(tmp, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(runtimeDir, 0o700);
    const env = { SVC_HOST: 'cursor', SVC_CODEX_RUNTIME_DIR: runtimeDir };
    const file = path.join(runtimeRoot(env), 'cursor-session-aliases.json');
    const lockPath = `${file}.lock`;
    fs.writeFileSync(lockPath, '');

    const start = Date.now();
    upsertCursorAlias('child-session', 'parent-convo', env);
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 500, `took ${elapsed}ms, expected <500ms`);
    assert.ok(!fs.existsSync(lockPath) || fs.readFileSync(lockPath, 'utf8').includes('pid'));
    const aliases = JSON.parse(fs.readFileSync(file, 'utf8'));
    assert.equal(aliases['child-session'], 'parent-convo');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-020: state-io lock uses process.pid, not harness-walked PID', () => {
  const tmpFile = path.join(os.tmpdir(), `zb020-${Date.now()}.json`);
  try {
    withStateLock(tmpFile, () => {
      const lockContent = JSON.parse(fs.readFileSync(`${tmpFile}.lock`, 'utf8'));
      assert.equal(lockContent.pid, process.pid, 'lock should record process.pid, not harness PID');
      assert.ok(lockContent.start_token, 'lock should have a start_token');
      assert.equal(lockContent.hostname, os.hostname());
    });
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
    try { fs.unlinkSync(`${tmpFile}.lock`); } catch {}
  }
});

function bashHostSessionId(sessionEnv) {
  const src = fs.readFileSync(path.join(root, 'scripts/worktree.sh'), 'utf8');
  const start = src.indexOf('_host_session_id() {');
  assert.ok(start >= 0, '_host_session_id must exist in scripts/worktree.sh');
  const end = src.indexOf('\n}', start);
  const fn = src.slice(start, end + 2);
  const env = { PATH: process.env.PATH, HOME: os.tmpdir(), ...sessionEnv };
  const res = spawnSync('bash', ['-c', `${fn}\n_host_session_id`], { encoding: 'utf8', env });
  assert.equal(res.status, 0, `bash _host_session_id failed: ${res.stderr}`);
  return res.stdout;
}

test('ZB-021: session ID parity across harnesses and Cursor bound is defined on normal prompts', () => {
  const grokSid = 'grok-zb021-session';
  const bashGrok = bashHostSessionId({ GROK_SESSION_ID: grokSid });
  const jsGrok = sessionId({}, { GROK_SESSION_ID: grokSid });
  assert.equal(bashGrok, grokSid);
  assert.equal(jsGrok, grokSid);
  assert.equal(bashGrok, jsGrok, 'GROK_SESSION_ID must resolve identically in bash _host_session_id and JS sessionId()');

  const cursorSid = 'cursor-zb021-session';
  assert.equal(bashHostSessionId({ CURSOR_SESSION_ID: cursorSid }), cursorSid);
  assert.equal(sessionId({}, { CURSOR_SESSION_ID: cursorSid }), cursorSid);

  const opencodeSid = 'opencode-zb021-session';
  assert.equal(bashHostSessionId({ OPENCODE_SESSION_ID: opencodeSid }), opencodeSid);
  assert.equal(sessionId({}, { OPENCODE_SESSION_ID: opencodeSid }), opencodeSid);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb021-bound-'));
  try {
    const runtimeDir = path.join(tmp, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(runtimeDir, 0o700);
    const env = isolatedSubprocessEnv({
      SVC_HOST: 'cursor',
      SVC_CODEX_RUNTIME_DIR: runtimeDir,
      HOME: tmp,
    });
    const res = spawnSync(process.execPath, [adapterPath, '--before-submit-prompt'], {
      input: JSON.stringify({
        prompt: 'please implement the dashboard login form',
        session_id: 'zb021-cursor-session',
        conversation_id: 'zb021-cursor-session',
        cwd: root,
      }),
      encoding: 'utf8',
      env,
    });
    assert.equal(res.status, 0, `adapter exited ${res.status}: ${res.stderr}`);
    assert.doesNotMatch(res.stderr || '', /bound is not defined/);
    assert.doesNotMatch(res.stderr || '', /ReferenceError/);
    const lines = (res.stdout || '').trim().split(/\r?\n/).filter(Boolean);
    const json = JSON.parse(lines.at(-1) || '{}');
    assert.equal(json.continue, true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-022: findHarnessProcessIdentity identifies Node CLI harness (claude/grok/cursor-agent) as harness_tracked', () => {
  const tree = {
    10: { comm: 'node', cmdline: 'node\0hooks/svc-workflow-guard.js', ppid: 20 },
    20: { comm: 'node', cmdline: 'node\0/usr/local/bin/claude.js', ppid: 1 },
  };
  const result = findHarnessProcessIdentity({
    pid: 10,
    inspect: (pid) => tree[pid] || null,
  });
  assert.equal(result.pid, 20);
  assert.equal(result.harness_tracked, true);
});

test('ZB-023: transient python wrapper is classified as harness_tracked: false', () => {
  const tree = {
    10: { comm: 'node', cmdline: 'node\0hooks/lib/authority-store.mjs', ppid: 30 },
    30: { comm: 'python3', cmdline: 'python3\0run_wrapper.py', ppid: 1 },
  };
  const result = findHarnessProcessIdentity({
    pid: 10,
    inspect: (pid) => tree[pid] || null,
  });
  assert.equal(result.harness_tracked, false, 'python wrapper must not be marked tracked harness');
});

test('ZB-024: svc-worktree-isolation-guard does not command user with --print-cd', () => {
  const src = fs.readFileSync(path.join(root, 'hooks/svc-worktree-isolation-guard.mjs'), 'utf8');
  const emitStart = src.indexOf('emitDecision({');
  assert.ok(emitStart >= 0, 'isolation guard must emit a deny decision');
  const emitBlock = src.slice(emitStart, src.indexOf('});', emitStart) + 3);
  assert.doesNotMatch(emitBlock, /--print-cd/);
  assert.match(emitBlock, /Autonomous harness will resolve target/);
  assert.match(emitBlock, /Target worktree required/);

  const hookPath = path.join(root, 'hooks/svc-worktree-isolation-guard.mjs');
  const res = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify({
      tool_name: 'Write',
      tool_input: { file_path: path.join(root, 'docs/zb024-isolation.md'), content: 'x' },
      cwd: root,
    }),
    encoding: 'utf8',
    cwd: root,
    env: isolatedSubprocessEnv({ HOME: os.tmpdir() }),
  });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  assert.doesNotMatch(out, /--print-cd/);
});

test('ZB-025: assertIgnored exempts external worktrees root', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-zb025-'));
  try {
    execFileSync('git', ['init', '-b', 'main'], { cwd: tmp, stdio: 'ignore' });
    fs.writeFileSync(path.join(tmp, 'README.md'), 'x\n');
    execFileSync('git', ['add', 'README.md'], { cwd: tmp, stdio: 'ignore' });
    execFileSync('git', ['-c', 'user.name=zb025', '-c', 'user.email=zb025@example.test', 'commit', '-m', 'init'], {
      cwd: tmp,
      stdio: 'ignore',
    });
    assert.doesNotThrow(() => assertIgnored(tmp, '/home/user/worktrees'));
    assert.doesNotThrow(() => assertIgnored(tmp, path.join(os.homedir(), 'worktrees')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ZB-026: exact entrypoint matching, 9-host allowlist, and canonical branch WI extraction', () => {
  assert.equal(
    isPersistentHarness('node', 'node\0scripts/helper.mjs\0--branch\0codex'),
    false,
    'non-harness helper with --branch codex must not be treated as the codex harness'
  );

  for (const name of ['kimi', 'mimo-code', 'antigravity', 'agy', 'cursor']) {
    assert.equal(isPersistentHarness(name, name), true, `${name} comm must be a persistent harness`);
  }

  const reviewPlan = fs.readFileSync(path.join(root, 'scripts/review-plan-codex.sh'), 'utf8');
  const beforeLauncher = reviewPlan.slice(0, reviewPlan.indexOf('node "$LAUNCHER"'));
  assert.match(beforeLauncher, /extractWiId/);
  assert.doesNotMatch(beforeLauncher, /grep -oE 'WI-\[A-Za-z0-9-\]\+'/);

  const extracted = execFileSync(process.execPath, [
    '--input-type=module',
    '-e',
    'import {extractWiId} from "./hooks/lib/wi-id.mjs"; const raw = process.argv[1] || ""; const isolated = String(raw).match(/WI-[A-Z0-9]+(?:-[A-Z0-9]+)*/); process.stdout.write(extractWiId(raw) || extractWiId(isolated ? isolated[0] : "") || "")',
    'feature-WI-123-user-billing',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(extracted, 'WI-123');
  assert.equal(extractWiId('WI-123'), 'WI-123');
});

