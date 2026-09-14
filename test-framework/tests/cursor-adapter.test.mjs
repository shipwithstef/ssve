import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const adapterPath = path.join(root, 'hooks/cursor/svc-cursor-ssve-adapter.mjs');
const dispatcherPath = path.join(root, 'hooks/codex/svc-codex-pretool-dispatcher.mjs');
const loaderPath = path.join(root, 'scripts/codex-load-skill.mjs');

function runAdapter(mode, input, env = process.env) {
  const res = spawnSync(process.execPath, [adapterPath, mode], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  let json = null;
  try {
    const lines = (res.stdout || '').trim().split(/\r?\n/).filter(Boolean);
    json = JSON.parse(lines.at(-1) || '{}');
  } catch {}
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', json };
}

function setupCursorSessionFixture(tmp, wi = 'WI-CURSOR-FIXTURE-01', cursorSid = '2f538175-c2a2-461e-a2ab-29a7042adf73') {
  const repo = path.join(tmp, 'repo');
  const target = path.join(repo, '.worktrees', `wt-${wi.toLowerCase()}`);
  fs.mkdirSync(repo, { recursive: true });

  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'cursor-fixture');
  git('config', 'user.email', 'cursor@example.invalid');
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
        subject: 'Cursor test task',
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
  fs.chmodSync(runtimeDir, 0o700);

  const env = {
    SVC_HOST: 'cursor',
    SVC_CODEX_RUNTIME_DIR: runtimeDir,
  };

  return { repo, target, env, wi, cursorSid };
}

test('Cursor adapter: malformed payload fails closed on beforeSubmitPrompt and pretool', () => {
  // Malformed JSON string
  const badPrompt = runAdapter('--before-submit-prompt', '{ not json:');
  assert.equal(badPrompt.status, 0);
  assert.equal(badPrompt.json?.continue, false);
  assert.match(badPrompt.json?.user_message || '', /malformed payload/i);

  const badPretool = runAdapter('--pretool', '{ invalid json');
  assert.equal(badPretool.status, 0);
  assert.equal(badPretool.json?.permission, 'deny');
  assert.match(badPretool.json?.user_message || '', /malformed payload/i);

  const arrayPretool = runAdapter('--pretool', '[1, 2, 3]');
  assert.equal(arrayPretool.status, 0);
  assert.equal(arrayPretool.json?.permission, 'deny');
  assert.match(arrayPretool.json?.user_message || '', /malformed payload/i);
});

test('Cursor adapter: observation fast-path allows reads and rewrites git status without dispatcher', () => {
  const readRes = runAdapter('--pretool', {
    tool_name: 'Shell',
    tool_input: { command: 'cat sample.txt' },
    session_id: 'cur-test-1',
    cwd: root,
  });
  assert.equal(readRes.status, 0);
  assert.equal(readRes.json?.permission, 'allow');

  const gitStatusRes = runAdapter('--pretool', {
    tool_name: 'Shell',
    tool_input: { command: 'git status' },
    session_id: 'cur-test-1',
    cwd: root,
  });
  assert.equal(gitStatusRes.status, 0);
  assert.equal(gitStatusRes.json?.permission, 'allow');
  assert.ok(gitStatusRes.json?.updated_input?.command?.includes('--no-optional-locks'));
  assert.ok(gitStatusRes.json?.updated_input?.command?.includes('status'));
});

test('Cursor adapter: child dispatcher errors, empty output, and unparseable output fail closed', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-err-'));
  try {
    const shadowDispatcher = path.join(tmp, 'shadow-dispatcher.mjs');
    fs.writeFileSync(shadowDispatcher, 'console.log("NOT_JSON_OUTPUT"); process.exit(0);');

    const crashDispatcher = path.join(tmp, 'crash-dispatcher.mjs');
    fs.writeFileSync(crashDispatcher, 'process.stderr.write("Fatal child crash\\n"); process.exit(2);');

    const emptyDispatcher = path.join(tmp, 'empty-dispatcher.mjs');
    fs.writeFileSync(emptyDispatcher, 'process.exit(0);');

    const payload = {
      tool_name: 'Shell',
      tool_input: { command: 'touch dangerous_mutation.txt' },
      session_id: 'cur-fail-1',
      cwd: tmp,
    };

    // 1. Unparseable stdout from dispatcher fails closed
    const shadowRes = runAdapter('--pretool', payload, { SVC_HOST: 'cursor', SVC_CURSOR_DISPATCHER_OVERRIDE: shadowDispatcher });
    assert.equal(shadowRes.status, 0);
    assert.equal(shadowRes.json?.permission, 'deny');
    assert.match(shadowRes.json?.user_message || '', /unparseable decision/i);

    // 2. Child crash / non-zero exit from dispatcher fails closed
    const crashRes = runAdapter('--pretool', payload, { SVC_HOST: 'cursor', SVC_CURSOR_DISPATCHER_OVERRIDE: crashDispatcher });
    assert.equal(crashRes.status, 0);
    assert.equal(crashRes.json?.permission, 'deny');
    assert.match(crashRes.json?.user_message || '', /Fatal child crash/i);

    // 3. Empty output from dispatcher fails closed
    const emptyRes = runAdapter('--pretool', payload, { SVC_HOST: 'cursor', SVC_CURSOR_DISPATCHER_OVERRIDE: emptyDispatcher });
    assert.equal(emptyRes.status, 0);
    assert.equal(emptyRes.json?.permission, 'deny');
    assert.match(emptyRes.json?.user_message || '', /child dispatcher emitted no output/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: end-to-end prompt capture, lease recovery, skill loading, and governed mutation', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-e2e-'));
  const repo = path.join(tmp, 'repo');
  const target = path.join(repo, '.worktrees', 'wt-cursor-live');
  fs.mkdirSync(repo);

  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'cursor-fixture');
  git('config', 'user.email', 'cursor@example.invalid');
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed');
  git('add', '.');
  git('commit', '-qm', 'seed');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  fs.mkdirSync(path.join(repo, '.worktrees'));
  git('worktree', 'add', '-b', 'fix/cursor-e2e', target);

  const wi = 'WI-CURSOR-E2E-01';
  const cursorSid = '2f538175-c2a2-461e-a2ab-29a7042adf73'; // Real Cursor conversation UUID format

  fs.mkdirSync(path.join(target, '.svc'));
  const graph = {
    schema_version: 1,
    wi,
    lane: 'bugfix',
    status: 'in_progress',
    tasks: [
      {
        id: 1,
        skill: 'execute-changeset',
        subject: 'Cursor governed mutation test',
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

  const env = {
    SVC_HOST: 'cursor',
    CURSOR_CONVERSATION_ID: cursorSid,
  };

  try {
    // Step 1: Prompt authority capture via beforeSubmitPrompt
    const promptRes = runAdapter(
      '--before-submit-prompt',
      {
        prompt: `Work on ${wi} and continue task 1`,
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(promptRes.status, 0);
    assert.equal(promptRes.json?.continue, true);

    // Step 2: Governed shell mutation before skill receipt is rewritten to the loader command
    const preSkillMutation = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "mutation" >> seed.txt' },
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(preSkillMutation.status, 0);
    assert.equal(preSkillMutation.json?.permission, 'allow');
    assert.match(preSkillMutation.json?.updated_input?.command || '', /codex-load-skill/);

    // Non-shell tool before skill receipt is denied with instruction to load skill
    const nonShellMutation = runAdapter(
      '--pretool',
      {
        tool_name: 'WriteFile',
        tool_input: { path: 'seed.txt', content: 'mutation' },
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(nonShellMutation.status, 0);
    assert.equal(nonShellMutation.json?.permission, 'deny');
    assert.match(nonShellMutation.json?.user_message || '', /Load its current skill before retrying/i);

    // Step 3: Load skill using codex-load-skill under Cursor host identity
    const loadRes = spawnSync(
      process.execPath,
      [loaderPath, '--graph', path.join(target, '.svc', `lane-tasks-${wi}.json`), '--task', '1', '--skill', 'execute-changeset', '--session', cursorSid],
      {
        encoding: 'utf8',
        cwd: target,
        env: { ...process.env, ...env, PWD: target },
      }
    );
    assert.equal(loadRes.status, 0, `skill load failed: ${loadRes.stderr}`);
    assert.ok(loadRes.stdout.includes('execute-changeset') || loadRes.stdout.length > 0);

    // Step 4: Governed mutation after skill load is now ALLOWED by PreTool!
    const postSkillMutation = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "mutation" >> seed.txt' },
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(postSkillMutation.status, 0);
    assert.equal(postSkillMutation.json?.permission, 'allow');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: SVC OWNER OVERRIDE arms lease and writes prompt-authority in same turn with multiline input', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-override-'));
  const repo = path.join(tmp, 'repo');
  const target = path.join(repo, '.worktrees', 'wt-cursor-override');
  fs.mkdirSync(repo);

  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'cursor-fixture');
  git('config', 'user.email', 'cursor@example.invalid');
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed');
  git('add', '.');
  git('commit', '-qm', 'seed');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  fs.mkdirSync(path.join(repo, '.worktrees'));
  git('worktree', 'add', '-b', 'fix/cursor-override', target);

  const wi = 'WI-CURSOR-OVERRIDE-01';
  const cursorSid = '5c8a9134-4b5b-4361-a5cf-5231c6a6552a';

  fs.mkdirSync(path.join(target, '.svc'));
  const graph = {
    schema_version: 1,
    wi,
    lane: 'bugfix',
    status: 'in_progress',
    tasks: [{ id: 1, skill: 'execute-changeset', subject: 'Override test', status: 'in_progress', metadata: { skill: 'execute-changeset', wi }, blocked_by: [] }],
  };
  fs.writeFileSync(path.join(target, '.svc', `lane-tasks-${wi}.json`), JSON.stringify(graph, null, 2));
  fs.writeFileSync(path.join(target, '.svc', 'session-contract.jsonl'), JSON.stringify({ wi, ts: new Date().toISOString(), authorization_envelope: { rules: [] } }) + '\n');

  const env = {
    SVC_HOST: 'cursor',
    CURSOR_CONVERSATION_ID: cursorSid,
    SVC_SESSION_ID: cursorSid,
  };

  const multilinePrompt = `<timestamp>2026-09-13T13:30:00Z</timestamp>
<user_query>
  SVC OWNER OVERRIDE: retain and resume active lease
    for ${wi} in this session.
    Work on
    ${wi} and continue execute-changeset task 1.
</user_query>`;

  try {
    const promptRes = runAdapter(
      '--before-submit-prompt',
      {
        prompt: multilinePrompt,
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(promptRes.status, 0);
    assert.equal(promptRes.json?.continue, true);
    assert.match(promptRes.json?.user_message || '', /SVC owner override armed/i);

    const { readOwnerLease } = await import('../../hooks/codex/lib/owner-lease.mjs');
    const armed = readOwnerLease(target, cursorSid, process.env);
    assert.ok(armed, 'owner-override.json must exist');
    assert.equal(armed.wi, wi);

    const { hookContext, authorityPath, readJson } = await import('../../hooks/codex/lib/codex-hook-context.mjs');
    const ctx = hookContext({ cwd: target, conversation_id: cursorSid }, process.env);
    const auth = readJson(authorityPath(ctx));
    assert.ok(auth, 'prompt-authority.json must be written in the same turn');
    assert.equal(auth.explicit_wi, wi);
    assert.equal(auth.continuation_intent, 'resume');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: controller-v2 takeover without existing binding file resolves via resolveWI and baton', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-v2-takeover-'));
  const repo = path.join(tmp, 'repo');
  const target = path.join(repo, '.worktrees', 'wt-cursor-takeover');
  fs.mkdirSync(repo);

  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-b', 'main');
  git('config', 'user.name', 'cursor-fixture');
  git('config', 'user.email', 'cursor@example.invalid');
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed');
  git('add', '.');
  git('commit', '-qm', 'seed');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  fs.mkdirSync(path.join(repo, '.worktrees'));
  git('worktree', 'add', '-b', 'fix/cursor-v2', target);

  const wi = 'WI-CURSOR-V2-01';
  const oldSid = '01a07605-754d-7a83-bfbe-70efdb565f93';
  const cursorSid = '2f538175-c2a2-461e-a2ab-29a7042adf73';

  fs.mkdirSync(path.join(target, '.svc'));
  fs.mkdirSync(path.join(target, '.svc', 'bindings'));
  const graph = {
    schema_version: 1,
    wi,
    lane: 'bugfix',
    status: 'in_progress',
    tasks: [
      {
        id: 1,
        skill: 'execute-changeset',
        subject: 'Cursor v2 takeover test',
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

  // Write old session binding to simulate post-reboot / handoff condition
  fs.writeFileSync(
    path.join(target, '.svc', 'bindings', `${oldSid.slice(0, 16)}.json`),
    JSON.stringify({ schema_version: 1, session_id: oldSid, role: 'mutating', wi, repo_root: repo, worktree_root: target, branch: 'fix/cursor-v2', generation: 1 })
  );

  const { authorityStateRoot, bootstrapController, takeoverController, repositoryId, principalId } = await import('../../hooks/lib/authority-store.mjs');
  const stateRoot = authorityStateRoot(target);
  const repoId = repositoryId(target);
  const oldPrincipal = principalId({ host: 'codex', session_id: oldSid });
  const cursorPrincipal = principalId({ host: 'cursor', session_id: cursorSid });

  bootstrapController({ stateRoot, repoId, wi, worktreeRoot: target, principal: oldPrincipal });
  takeoverController({
    stateRoot, repoId, wi, principal: cursorPrincipal,
    expectedPrincipal: oldPrincipal, expectedGeneration: 1, reason: 'takeover for cursor session'
  });

  const env = {
    SVC_HOST: 'cursor',
    CURSOR_CONVERSATION_ID: cursorSid,
  };

  try {
    const { resolveWI } = await import('../../hooks/lib/resolve-wi.mjs');
    const res = resolveWI({ cwd: target, conversation_id: cursorSid }, { ...process.env, ...env, PWD: target, SVC_REQUIRE_SESSION_BINDING: '1' });
    assert.equal(res.authority, true);
    assert.equal(res.classification, 'owned');
    assert.equal(res.tuple?.wi, wi);

    // Prompt authority without re-typing WI inherits active WI from governance tuple
    const promptRes = runAdapter(
      '--before-submit-prompt',
      {
        prompt: 'continue working on this task and implement changes',
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(promptRes.status, 0);
    assert.equal(promptRes.json?.continue, true);

    const { hookContext, authorityPath, readJson } = await import('../../hooks/codex/lib/codex-hook-context.mjs');
    const ctx = hookContext({ cwd: target, conversation_id: cursorSid }, { ...process.env, ...env });
    const auth = readJson(authorityPath(ctx));
    assert.ok(auth);
    assert.equal(auth.explicit_wi, wi, 'must resolve explicit_wi from governance tuple');
    assert.equal(auth.continuation_intent, 'continue');

    // Pretool call should find baton via controller lease and rewrite to load-skill
    const preMutation = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "mutation" >> seed.txt' },
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(preMutation.status, 0);
    assert.equal(preMutation.json?.permission, 'allow');
    assert.match(preMutation.json?.updated_input?.command || '', /codex-load-skill/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: sentence punctuation in WI is accepted by explicitWI and prompt authority', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-punct-'));
  try {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(path.join(repo, '.git'), { recursive: true });
    spawnSync('git', ['init', '-b', 'main'], { cwd: repo });
    const cursorSid = '5c8a9134-4b5b-4361-a5cf-punct0000001';
    const runtimeDir = path.join(tmp, 'runtime');
    fs.mkdirSync(runtimeDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(runtimeDir, 0o700);
    const env = {
      SVC_CODEX_RUNTIME_DIR: runtimeDir,
    };
    const { explicitWI, hookContext, authorityPath, readJson } = await import('../../hooks/codex/lib/codex-hook-context.mjs');

    // Test cases with sentence punctuation
    assert.equal(explicitWI('Work on WI-PUNCT-01.'), 'WI-PUNCT-01');
    assert.equal(explicitWI('WI-PUNCT-01: continue task 1'), 'WI-PUNCT-01');
    assert.equal(explicitWI('Work on WI-PUNCT-01, please continue'), 'WI-PUNCT-01');
    assert.equal(explicitWI('Is it WI-PUNCT-01?'), 'WI-PUNCT-01');
    assert.equal(explicitWI('(WI-PUNCT-01)'), 'WI-PUNCT-01');
    assert.equal(explicitWI('"WI-PUNCT-01"'), 'WI-PUNCT-01');
    assert.equal(explicitWI('WI-PUNCT-01; next'), 'WI-PUNCT-01');

    // Negative cases should not match
    assert.equal(explicitWI('Work on WI-PUNCT-01.md'), '');
    assert.equal(explicitWI('path/to/WI-PUNCT-01'), '');
    assert.equal(explicitWI('WI-PUNCT-01_foo'), '');
    assert.equal(explicitWI('WI-PUNCT-01-foo'), '');

    // Submit prompt with period after WI
    const promptRes = runAdapter(
      '--before-submit-prompt',
      {
        prompt: 'Work on WI-PUNCT-01. Resume task 1.',
        conversation_id: cursorSid,
        cwd: repo,
      },
      env
    );
    assert.equal(promptRes.status, 0);
    assert.equal(promptRes.json?.continue, true);

    const ctx = hookContext({ cwd: repo, conversation_id: cursorSid }, { ...process.env, ...env });
    const auth = readJson(authorityPath(ctx));
    assert.ok(auth);
    assert.equal(auth.explicit_wi, 'WI-PUNCT-01');
    assert.equal(auth.continuation_intent, 'work_on');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: recovers session identity when Cursor emits pretool event with empty conversation_id', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-empty-id-'));
  try {
    const { repo, target, env, wi, cursorSid } = setupCursorSessionFixture(tmp, 'WI-CURSOR-EMPTY-01');
    const { runtimeRoot } = await import('../../hooks/codex/lib/codex-hook-context.mjs');

    // 1. Submit prompt establishes active session and writes prompt authority
    const promptRes = runAdapter(
      '--before-submit-prompt',
      {
        prompt: `Work on ${wi} and continue task 1`,
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(promptRes.status, 0);

    // 2. Cursor emits pretool event with NO conversation_id or session_id (the upstream bug)
    const emptyIdPretool = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "mutation" >> seed.txt' },
        // Notice: conversation_id and session_id are completely omitted
        cwd: target,
      },
      env
    );
    assert.equal(emptyIdPretool.status, 0);
    assert.equal(emptyIdPretool.json?.permission, 'allow');
    assert.match(emptyIdPretool.json?.updated_input?.command || '', /codex-load-skill/);

    // 3. Verify event log recorded the empty-ID event with recovery
    const logFile = path.join(runtimeRoot(env), 'cursor-hook-events.jsonl');
    assert.ok(fs.existsSync(logFile), 'event log must exist');
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const emptyRecoveryEvent = lines.find(e => e.empty_id_recovered === true);
    assert.ok(emptyRecoveryEvent, 'must have an event with empty_id_recovered === true');
    assert.equal(emptyRecoveryEvent.payload_conversation_id, null);
    assert.equal(emptyRecoveryEvent.resolved_sid, cursorSid);
    assert.ok(emptyRecoveryEvent.authority_exists);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: logs failing events with identity fields, authority path, and rejection reason', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-fail-log-'));
  try {
    const { target, env, cursorSid, wi } = setupCursorSessionFixture(tmp, 'WI-CURSOR-FAIL-01');
    const { runtimeRoot } = await import('../../hooks/codex/lib/codex-hook-context.mjs');

    // Submit prompt establishes prompt authority
    const promptRes = runAdapter(
      '--before-submit-prompt',
      {
        prompt: `Work on ${wi} and continue task 1`,
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(promptRes.status, 0);

    // Non-shell tool before skill load is denied
    const nonShell = runAdapter(
      '--pretool',
      {
        tool_name: 'WriteFile',
        tool_input: { path: 'file.txt', content: 'hello' },
        conversation_id: cursorSid,
        cwd: target,
      },
      env
    );
    assert.equal(nonShell.status, 0);
    assert.equal(nonShell.json?.permission, 'deny');

    // Verify denial was logged with full diagnostic identity and reason
    const logFile = path.join(runtimeRoot(env), 'cursor-hook-events.jsonl');
    assert.ok(fs.existsSync(logFile));
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const denyEvent = lines.find(e => e.decision === 'deny' && e.tool_name === 'WriteFile');
    assert.ok(denyEvent, 'must have logged the denied event');
    assert.equal(denyEvent.resolved_sid, cursorSid);
    assert.match(denyEvent.rejection_reason, /Load its current skill before retrying/i);
    assert.ok(denyEvent.authority_path);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: Task tool with workdir update is allowed and strips workdir without blank loader denial', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-task-update-'));
  try {
    const shadowDispatcher = path.join(tmp, 'shadow-dispatcher.mjs');
    // Simulate dispatcher returning an updated_input containing workdir and task parameters
    fs.writeFileSync(
      shadowDispatcher,
      `console.log(JSON.stringify({
        permission: "allow",
        updated_input: {
          workdir: "/path/to/worktree",
          prompt: "Execute subtask 1",
          subtask_id: "sub-42"
        },
        user_message: "Dispatcher approved Task"
      })); process.exit(0);`
    );

    const payload = {
      tool_name: 'Task',
      tool_input: { prompt: 'Execute subtask 1', subtask_id: 'sub-42' },
      conversation_id: 'cur-task-chat-1',
      cwd: tmp,
    };

    const res = runAdapter('--pretool', payload, {
      SVC_HOST: 'cursor',
      SVC_CURSOR_DISPATCHER_OVERRIDE: shadowDispatcher,
    });

    assert.equal(res.status, 0);
    assert.equal(res.json?.permission, 'allow');
    assert.equal(res.json?.user_message, 'Dispatcher approved Task');
    // Must strip workdir for non-shell tool
    assert.equal(res.json?.updated_input?.workdir, undefined);
    assert.equal(res.json?.updated_input?.prompt, 'Execute subtask 1');
    assert.equal(res.json?.updated_input?.subtask_id, 'sub-42');

    // Case 2: When updated_input contains ONLY workdir, it is stripped and no empty updated_input is leaked
    const shadowWorkdirOnly = path.join(tmp, 'shadow-dispatcher-workdir-only.mjs');
    fs.writeFileSync(
      shadowWorkdirOnly,
      `console.log(JSON.stringify({
        permission: "allow",
        updated_input: {
          workdir: "/path/to/worktree"
        }
      })); process.exit(0);`
    );

    const res2 = runAdapter('--pretool', payload, {
      SVC_HOST: 'cursor',
      SVC_CURSOR_DISPATCHER_OVERRIDE: shadowWorkdirOnly,
    });
    assert.equal(res2.status, 0);
    assert.equal(res2.json?.permission, 'allow');
    assert.equal(res2.json?.updated_input, undefined);

    // Case 3: When a non-shell tool receives an actual skill-loader rewrite, it denies with the specific command
    const shadowSkillLoader = path.join(tmp, 'shadow-dispatcher-loader.mjs');
    fs.writeFileSync(
      shadowSkillLoader,
      `console.log(JSON.stringify({
        permission: "allow",
        updated_input: {
          command: "node /path/to/codex-load-skill.mjs --task 1",
          workdir: "/path/to/worktree"
        }
      })); process.exit(0);`
    );

    const res3 = runAdapter('--pretool', payload, {
      SVC_HOST: 'cursor',
      SVC_CURSOR_DISPATCHER_OVERRIDE: shadowSkillLoader,
    });
    assert.equal(res3.status, 0);
    assert.equal(res3.json?.permission, 'deny');
    assert.match(res3.json?.user_message || '', /SSVE restored the authorized WI\. Load its current skill before retrying: node \/path\/to\/codex-load-skill\.mjs --task 1/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('Cursor adapter: in-process chat switch/resume updates Prompt, Shell, and Task identity while in-flight preserves dispatch conversation', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-cursor-resume-identity-'));
  try {
    const wi = 'WI-CURSOR-RESUME-01';
    const chatA = '05fedae0-8d19-4f5a-8ffc-68b2cc606540';
    const chatB = '2f538175-c2a2-461e-a2ab-29a7042adf73';
    const { repo, target, env } = setupCursorSessionFixture(tmp, wi, chatA);
    const { runtimeRoot, hookContext, authorityPath, readJson } = await import('../../hooks/codex/lib/codex-hook-context.mjs');

    // 1. Chat A starts: submit prompt captures Prompt Authority for Chat A
    const promptA = runAdapter(
      '--before-submit-prompt',
      {
        prompt: `Work on ${wi} in chat A and execute task 1`,
        conversation_id: chatA,
        cwd: target,
      },
      env
    );
    assert.equal(promptA.status, 0);
    assert.equal(promptA.json?.continue, true);

    const authA = readJson(authorityPath(hookContext({ cwd: target, conversation_id: chatA }, env)));
    assert.ok(authA);
    assert.equal(authA.explicit_wi, wi);
    assert.equal(authA.session_id, chatA);

    // 2. Chat A performs Shell pretool call: identifies Chat A
    const shellA = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "chatA mutation" >> seed.txt' },
        conversation_id: chatA,
        cwd: target,
      },
      env
    );
    assert.equal(shellA.status, 0);
    assert.equal(shellA.json?.permission, 'allow');

    // 3. User switches / resumes to Chat B: beforeSubmitPrompt fires with Chat B and owner override
    const promptB = runAdapter(
      '--before-submit-prompt',
      {
        prompt: `SVC OWNER OVERRIDE: retain and resume active lease for ${wi} in this session.\nWork on ${wi} in resumed chat B and continue task 1`,
        conversation_id: chatB,
        cwd: target,
      },
      env
    );
    assert.equal(promptB.status, 0);
    assert.equal(promptB.json?.continue, true);
    assert.match(promptB.json?.user_message || '', /SVC owner override armed/i);

    const authB = readJson(authorityPath(hookContext({ cwd: target, conversation_id: chatB }, env)));
    assert.ok(authB);
    assert.equal(authB.explicit_wi, wi);
    assert.equal(authB.session_id, chatB);

    // 4. Following resume, Shell and Task in Chat B both carry Chat B identity dynamically
    const shellB = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "chatB mutation" >> seed.txt' },
        conversation_id: chatB,
        cwd: target,
      },
      env
    );
    assert.equal(shellB.status, 0);
    assert.equal(shellB.json?.permission, 'allow');

    // Task in Chat B is evaluated under Chat B and strips workdir if updated
    const taskB = runAdapter(
      '--pretool',
      {
        tool_name: 'Task',
        tool_input: { prompt: 'Subtask B work' },
        conversation_id: chatB,
        cwd: target,
      },
      env
    );
    assert.equal(taskB.status, 0);

    // 5. In-flight operation initiated under Chat A still preserves Chat A's conversation ID
    const inFlightShellA = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "in-flight chatA" >> seed.txt' },
        conversation_id: chatA,
        cwd: target,
      },
      env
    );
    assert.equal(inFlightShellA.status, 0);
    assert.equal(inFlightShellA.json?.permission, 'allow');

    // 6. Verify event log recorded separate identities for Chat A, Chat B, and in-flight operations
    const logFile = path.join(runtimeRoot(env), 'cursor-hook-events.jsonl');
    assert.ok(fs.existsSync(logFile));
    const events = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));

    const chatAEvents = events.filter(e => e.resolved_sid === chatA);
    const chatBEvents = events.filter(e => e.resolved_sid === chatB);
    assert.ok(chatAEvents.length >= 2, 'Chat A must have prompt and pretool events recorded under chatA');
    assert.ok(chatBEvents.length >= 2, 'Chat B must have prompt and pretool events recorded under chatB');
    assert.ok(chatAEvents.some(e => e.tool_name === 'Shell' && e.resolved_sid === chatA));
    assert.ok(chatBEvents.some(e => e.tool_name === 'Shell' && e.resolved_sid === chatB));

    // 7. Empty conversation_id post-resume recovers active session Chat B, NOT stale Chat A
    const emptyPostResume = runAdapter(
      '--pretool',
      {
        tool_name: 'Shell',
        tool_input: { command: 'echo "recovered chatB" >> seed.txt' },
        cwd: target,
      },
      env
    );
    assert.equal(emptyPostResume.status, 0);
    assert.equal(emptyPostResume.json?.permission, 'allow');

    const updatedEvents = fs.readFileSync(logFile, 'utf8').trim().split('\n').map(l => JSON.parse(l));
    const lastEmpty = updatedEvents.filter(e => e.empty_id_recovered === true).at(-1);
    assert.ok(lastEmpty, 'empty ID event must be recovered');
    assert.equal(lastEmpty.resolved_sid, chatB, 'must recover active Chat B rather than startup Chat A');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

