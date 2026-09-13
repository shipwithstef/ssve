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
    SVC_SESSION_ID: cursorSid,
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
