import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_PERMISSIONS,
  DEFAULT_WORKTREES_ROOT,
  assertConfiguredRootSafe,
  defaultPolicy,
  ensureWorktreesDirectory,
  expandHome,
  loadWorktreePolicy,
  resetWorktreePolicyCache,
  resolveApprovedRoots,
  resolveWorktreesRoot,
} from '../../hooks/lib/worktree-policy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worktreeSh = path.join(root, 'scripts/worktree.sh');

function isolatedEnv(tmp, extra = {}) {
  return {
    ...process.env,
    HOME: tmp,
    SVC_WORKTREE_POLICY: path.join(tmp, 'missing-worktree-policy.json'),
    SVC_WORKTREES_ROOT: undefined,
    SVC_APPROVED_WORKTREE_ROOTS: '',
    ...extra,
  };
}

function writePolicy(tmp, policy) {
  const policyPath = path.join(tmp, 'worktree-policy.json');
  fs.writeFileSync(policyPath, JSON.stringify(policy, null, 2));
  fs.chmodSync(policyPath, 0o600);
  resetWorktreePolicyCache();
  return policyPath;
}

test('default root is ~/worktrees with 0700 permissions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-default-'));
  try {
    const env = isolatedEnv(tmp);
    const policy = defaultPolicy(env);
    assert.equal(policy.default_root, DEFAULT_WORKTREES_ROOT);
    assert.equal(policy.default_root, '~/worktrees');
    assert.equal(policy.permissions, DEFAULT_PERMISSIONS);
    assert.equal(policy.permissions, '0700');
    assert.equal(policy.naming_strategy, 'hierarchical');
    const loaded = loadWorktreePolicy(env);
    assert.equal(loaded.default_root, '~/worktrees');
    assert.equal(loaded.permissions, '0700');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadWorktreePolicy loads custom config via env', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-custom-'));
  try {
    const customRoot = path.join(tmp, 'custom-trees');
    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: customRoot,
      naming_strategy: 'flat',
      permissions: '0750',
      projects: { demo: { root: path.join(tmp, 'demo-root') } },
    });
    const env = isolatedEnv(tmp, { SVC_WORKTREE_POLICY: policyPath });
    const loaded = loadWorktreePolicy(env);
    assert.equal(loaded.default_root, customRoot);
    assert.equal(loaded.naming_strategy, 'flat');
    assert.equal(loaded.permissions, '0750');
    assert.equal(loaded.projects.demo.root, path.join(tmp, 'demo-root'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadWorktreePolicy fails closed on corrupt JSON', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-corrupt-'));
  try {
    const policyPath = path.join(tmp, 'worktree-policy.json');
    fs.writeFileSync(policyPath, '{not-json');
    fs.chmodSync(policyPath, 0o600);
    resetWorktreePolicyCache();
    const env = isolatedEnv(tmp, { SVC_WORKTREE_POLICY: policyPath });
    assert.throws(
      () => loadWorktreePolicy(env),
      (err) => {
        assert.match(String(err.message), /WORKTREE_POLICY_INVALID/);
        assert.match(String(err.message), /invalid JSON or structure/);
        return true;
      },
    );
    fs.writeFileSync(policyPath, JSON.stringify({ schema_version: 'nope', default_root: '~/worktrees' }));
    fs.chmodSync(policyPath, 0o600);
    resetWorktreePolicyCache();
    assert.throws(
      () => loadWorktreePolicy(env),
      /WORKTREE_POLICY_INVALID/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveApprovedRoots includes centralized, legacy in-repo, and project roots', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-roots-'));
  try {
    const repo = path.join(tmp, 'myrepo');
    const central = path.join(tmp, 'worktrees');
    const projectRoot = path.join(tmp, 'project-root');
    const extra = path.join(tmp, 'extra-approved');
    fs.mkdirSync(repo, { recursive: true });
    fs.mkdirSync(path.join(repo, '.worktrees'), { recursive: true });
    fs.mkdirSync(central, { recursive: true });
    fs.mkdirSync(projectRoot, { recursive: true });
    fs.mkdirSync(extra, { recursive: true });
    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: central,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: { otherproj: { root: projectRoot } },
    });
    const env = isolatedEnv(tmp, {
      SVC_WORKTREE_POLICY: policyPath,
      SVC_APPROVED_WORKTREE_ROOTS: extra,
    });
    const roots = resolveApprovedRoots(repo, env);
    const centralized = resolveWorktreesRoot(repo, env);
    assert.equal(centralized, path.join(central, 'myrepo'));
    assert.ok(roots.includes(centralized), `missing centralized root: ${JSON.stringify(roots)}`);
    assert.ok(roots.includes(path.resolve(central)), `missing parent base: ${JSON.stringify(roots)}`);
    assert.ok(roots.includes(path.join(repo, '.worktrees')), `missing legacy in-repo: ${JSON.stringify(roots)}`);
    assert.ok(roots.includes(path.resolve(projectRoot)), `missing project root: ${JSON.stringify(roots)}`);
    assert.ok(roots.includes(path.resolve(extra)), `missing env approved root: ${JSON.stringify(roots)}`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('ensureWorktreesDirectory creates directory with 0700 permissions', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-mkdir-'));
  try {
    const dir = path.join(tmp, 'nested', 'worktrees');
    const created = ensureWorktreesDirectory(dir);
    assert.equal(created, path.resolve(dir));
    assert.equal(fs.statSync(created).isDirectory(), true);
    assert.equal(fs.statSync(created).mode & 0o777, 0o700);
    assert.equal(fs.statSync(path.join(tmp, 'nested')).mode & 0o777, 0o700);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadWorktreePolicy rejects policy file with mode 0666', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-mode-'));
  try {
    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: '~/worktrees',
    });
    fs.chmodSync(policyPath, 0o666);
    resetWorktreePolicyCache();
    const env = isolatedEnv(tmp, { SVC_WORKTREE_POLICY: policyPath });
    assert.throws(
      () => loadWorktreePolicy(env),
      (err) => {
        assert.match(String(err.message), /WORKTREE_POLICY_INVALID/);
        assert.match(String(err.message), /permissions are too open/);
        return true;
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadWorktreePolicy rejects policy file that is a symlink', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-symlink-'));
  try {
    const realPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: '~/worktrees',
    });
    const linkPath = path.join(tmp, 'worktree-policy.link.json');
    fs.symlinkSync(realPath, linkPath);
    resetWorktreePolicyCache();
    const env = isolatedEnv(tmp, { SVC_WORKTREE_POLICY: linkPath });
    assert.throws(
      () => loadWorktreePolicy(env),
      (err) => {
        assert.match(String(err.message), /WORKTREE_POLICY_INVALID/);
        return true;
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('loadWorktreePolicy rejects a dangling policy symlink instead of defaulting', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-dangling-'));
  try {
    const dangling = path.join(tmp, 'dangling-policy.json');
    fs.symlinkSync(path.join(tmp, 'missing-target.json'), dangling);
    resetWorktreePolicyCache();
    const env = isolatedEnv(tmp, { SVC_WORKTREE_POLICY: dangling });
    assert.throws(
      () => loadWorktreePolicy(env),
      (err) => {
        assert.match(String(err.message), /WORKTREE_POLICY_INVALID/);
        assert.match(String(err.message), /symlink/);
        return true;
      },
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('assertConfiguredRootSafe rejects a symlink ancestor before realpath', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-ancestor-link-'));
  try {
    const realRoot = path.join(tmp, 'real-root');
    const linked = path.join(tmp, 'linked-root');
    const nested = path.join(linked, 'worktrees');
    fs.mkdirSync(realRoot, { recursive: true });
    fs.symlinkSync(realRoot, linked);
    assert.throws(
      () => assertConfiguredRootSafe(nested),
      /WORKTREE_POLICY_INVALID/,
    );
    const extra = path.join(linked, 'extra');
    const repo = path.join(tmp, 'myrepo');
    fs.mkdirSync(repo, { recursive: true });
    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: path.join(tmp, 'plain-root'),
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    fs.mkdirSync(path.join(tmp, 'plain-root'), { recursive: true });
    resetWorktreePolicyCache();
    const env = isolatedEnv(tmp, {
      SVC_WORKTREE_POLICY: policyPath,
      SVC_APPROVED_WORKTREE_ROOTS: extra,
    });
    assert.throws(
      () => resolveApprovedRoots(repo, env),
      /WORKTREE_POLICY_INVALID/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolveApprovedRoots rejects a configured root that is a symlink', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-rootlink-'));
  try {
    const repo = path.join(tmp, 'myrepo');
    const realRoot = path.join(tmp, 'real-root');
    const linkedRoot = path.join(tmp, 'linked-root');
    fs.mkdirSync(repo, { recursive: true });
    fs.mkdirSync(realRoot, { recursive: true });
    fs.symlinkSync(realRoot, linkedRoot);
    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: linkedRoot,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    const env = isolatedEnv(tmp, { SVC_WORKTREE_POLICY: policyPath });
    assert.throws(
      () => resolveApprovedRoots(repo, env),
      /WORKTREE_POLICY_INVALID/,
    );
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cmd_remove refuses rm -rf on a directory that is not this repository worktree', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-cross-repo-'));
  try {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main');
    git('config', 'user.name', 'cross-tester');
    git('config', 'user.email', 'cross@example.invalid');
    fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
    git('add', '.');
    git('commit', '-qm', 'seed');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');

    const central = path.join(tmp, 'worktrees');
    const leaf = path.join(central, 'repo', 'feature-foreign');
    fs.mkdirSync(leaf, { recursive: true });
    fs.symlinkSync(path.join(root, 'hooks'), path.join(leaf, 'hooks'));
    fs.mkdirSync(path.join(leaf, '.svc', 'bindings'), { recursive: true });
    const canary = path.join(leaf, 'DO-NOT-DELETE.txt');
    fs.writeFileSync(canary, 'foreign-canary\n');

    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: central,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    const res = spawnSync('bash', [worktreeSh, 'remove', 'feature-foreign', '--force'], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: tmp,
        SVC_WORKTREE_POLICY: policyPath,
        SVC_SESSION_ID: '',
        CURSOR_CONVERSATION_ID: '',
        CODEX_THREAD_ID: '',
        CODEX_SESSION_ID: '',
      },
    });
    assert.notEqual(res.status, 0, `expected refusal, got 0:\n${res.stdout}\n${res.stderr}`);
    assert.equal(fs.existsSync(canary), true, 'foreign directory must not be rm -rfed');
    assert.equal(fs.existsSync(path.dirname(leaf)), true, 'parent container must be preserved');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cmd_remove requires this-repo worktree membership and never swallows git worktree remove', () => {
  const src = fs.readFileSync(worktreeSh, 'utf8');
  const removeFn = src.slice(src.indexOf('cmd_remove()'), src.indexOf('# LIST'));
  assert.match(removeFn, /_assert_target_belongs_to_this_repo/);
  assert.match(src, /git worktree list --porcelain/);
  assert.match(src, /rev-parse --git-common-dir/);
  assert.match(removeFn, /refusing leftover rm -rf/);
  assert.doesNotMatch(removeFn, /rm -rf -- "\$TARGET"/);
  assert.doesNotMatch(removeFn, /git worktree remove --force "\$TARGET" 2>&1 \|\| true/);
  assert.doesNotMatch(removeFn, /git worktree remove --force "\$TARGET" \|\| true/);
});

test('slash branch path resolves via git worktree list porcelain', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-slash-branch-'));
  try {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main');
    git('config', 'user.name', 'slash-tester');
    git('config', 'user.email', 'slash@example.invalid');
    fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
    git('add', '.');
    git('commit', '-qm', 'seed');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    fs.symlinkSync(path.join(root, 'scripts'), path.join(repo, 'scripts'));
    fs.symlinkSync(path.join(root, 'hooks'), path.join(repo, 'hooks'));

    const central = path.join(tmp, 'worktrees');
    const hashed = path.join(central, 'repo', 'wi-feat-foo-0123456789ab');
    fs.mkdirSync(path.dirname(hashed), { recursive: true });
    git('worktree', 'add', '-b', 'feat/foo', hashed);

    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: central,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    const res = spawnSync('bash', [worktreeSh, 'enter', 'feat/foo'], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: tmp,
        SVC_WORKTREE_POLICY: policyPath,
        SVC_SESSION_ID: '',
        CURSOR_CONVERSATION_ID: '',
        CODEX_THREAD_ID: '',
        SESSION_ID: '',
        CODEX_SESSION_ID: '',
      },
    });
    assert.equal(res.status, 0, `enter should resolve hashed slash-branch leaf:\n${res.stdout}\n${res.stderr}`);
    assert.match(res.stdout, /wi-feat-foo-0123456789ab/);
    assert.doesNotMatch(res.stdout, /cd into worktree/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('leaf removal preserves parent directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-leaf-'));
  try {
    const src = fs.readFileSync(worktreeSh, 'utf8');
    const removeFn = src.slice(src.indexOf('cmd_remove()'), src.indexOf('# LIST'));
    assert.doesNotMatch(removeFn, /rm -rf -- "\$TARGET"/);
    assert.doesNotMatch(removeFn, /rm -rf -- "\$parent_dir"/);
    assert.doesNotMatch(removeFn, /rm -rf "\$\(dirname/);
    assert.match(removeFn, /_assert_worktree_leaf/);
    assert.doesNotMatch(removeFn, /rmdir "\$WORKTREE_DIR"/);

    const parent = path.join(tmp, 'worktrees', 'leafrepo');
    const leaf = path.join(parent, 'feature-leaf');
    fs.mkdirSync(leaf, { recursive: true });
    fs.writeFileSync(path.join(leaf, 'keep-parent-probe.txt'), 'leaf\n');
    assert.equal(path.dirname(leaf), parent);
    assert.notEqual(leaf, parent);
    fs.rmSync(leaf, { recursive: true, force: true });
    assert.equal(fs.existsSync(leaf), false, 'leaf directory must be removed');
    assert.equal(fs.existsSync(parent), true, 'parent worktree container must be preserved');
    assert.equal(expandHome('~/worktrees'), path.join(os.homedir(), 'worktrees'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cmd_create existing-directory branch asserts this-repo membership before binding', () => {
  const src = fs.readFileSync(worktreeSh, 'utf8');
  const createFn = src.slice(src.indexOf('cmd_create()'), src.indexOf('cmd_enter()'));
  assert.match(createFn, /_assert_target_belongs_to_this_repo "\$wt_path"/);
  const cleanupFn = src.slice(src.indexOf('cmd_cleanup()'), src.indexOf('_run_setup()'));
  assert.match(cleanupFn, /_dir_gitdir_belongs_to_this_repo "\$dir" "\$GIT_COMMON_DIR"/);
  assert.match(cleanupFn, /GIT_COMMON_DIR=/);
});

test('cmd_cleanup never quarantines a foreign repository directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-cleanup-foreign-'));
  try {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main');
    git('config', 'user.name', 'cleanup-tester');
    git('config', 'user.email', 'cleanup@example.invalid');
    fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
    git('add', '.');
    git('commit', '-qm', 'seed');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');

    const central = path.join(tmp, 'worktrees');
    const leafParent = path.join(central, 'repo');
    const foreign = path.join(leafParent, 'foreign-clone');
    fs.mkdirSync(foreign, { recursive: true });
    const foreignGit = (...args) => execFileSync('git', ['-C', foreign, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    foreignGit('init', '-b', 'main');
    foreignGit('config', 'user.name', 'foreign');
    foreignGit('config', 'user.email', 'foreign@example.invalid');
    const canary = path.join(foreign, 'DO-NOT-QUARANTINE.txt');
    fs.writeFileSync(canary, 'foreign-canary\n');
    foreignGit('add', '.');
    foreignGit('commit', '-qm', 'foreign seed');

    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: central,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    const res = spawnSync('bash', [worktreeSh, '__inner_cleanup'], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: tmp,
        SVC_WORKTREE_POLICY: policyPath,
        SVC_SESSION_ID: '',
        CURSOR_CONVERSATION_ID: '',
        CODEX_THREAD_ID: '',
        CODEX_SESSION_ID: '',
      },
    });
    assert.equal(res.status, 0, `cleanup should skip foreign dirs:\n${res.stdout}\n${res.stderr}`);
    assert.equal(fs.existsSync(canary), true, 'foreign clone must not be moved');
    assert.match(res.stdout + res.stderr, /Skipping foreign directory/);
    const quarantined = fs.existsSync(path.join(leafParent, '.quarantine'))
      ? execFileSync('find', [path.join(leafParent, '.quarantine'), '-name', 'DO-NOT-QUARANTINE.txt'], { encoding: 'utf8' }).trim()
      : '';
    assert.equal(quarantined, '', 'foreign clone must not appear in quarantine');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cmd_create refuses to bind a foreign existing directory', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-create-foreign-'));
  try {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main');
    git('config', 'user.name', 'create-tester');
    git('config', 'user.email', 'create@example.invalid');
    fs.writeFileSync(path.join(repo, '.gitignore'), '.worktrees/\n.svc/\n');
    fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
    git('add', '.');
    git('commit', '-qm', 'seed');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');

    const central = path.join(tmp, 'worktrees');
    const leaf = path.join(central, 'repo', 'feature-foreign');
    fs.mkdirSync(leaf, { recursive: true });
    const foreignGit = (...args) => execFileSync('git', ['-C', leaf, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    foreignGit('init', '-b', 'main');
    foreignGit('config', 'user.name', 'foreign');
    foreignGit('config', 'user.email', 'foreign@example.invalid');
    fs.writeFileSync(path.join(leaf, 'seed.txt'), 'foreign\n');
    foreignGit('add', '.');
    foreignGit('commit', '-qm', 'foreign seed');

    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: central,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    const res = spawnSync('bash', [worktreeSh, 'create', 'feature-foreign', '--role', 'read-only'], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: tmp,
        SVC_WORKTREE_POLICY: policyPath,
        SVC_SESSION_ID: 'session-create-foreign',
        CURSOR_CONVERSATION_ID: '',
        CODEX_THREAD_ID: '',
        CODEX_SESSION_ID: '',
      },
    });
    assert.notEqual(res.status, 0, `expected refusal, got 0:\n${res.stdout}\n${res.stderr}`);
    assert.equal(fs.existsSync(path.join(leaf, '.svc', 'bindings')), false, 'foreign worktree must not receive .svc bindings');
    assert.match(res.stdout + res.stderr, /not registered|git-common-dir mismatch|not this repository/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('resolve-worktree-root.mjs asserts the un-canonicalized configured path', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-resolve-symlink-'));
  const cli = path.join(root, 'scripts/lib/resolve-worktree-root.mjs');
  try {
    const repo = path.join(tmp, 'myrepo');
    const realRoot = path.join(tmp, 'real-root');
    const linkedRoot = path.join(tmp, 'linked-root');
    fs.mkdirSync(repo, { recursive: true });
    fs.mkdirSync(realRoot, { recursive: true });
    fs.symlinkSync(realRoot, linkedRoot);
    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: linkedRoot,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    const res = spawnSync(process.execPath, [cli, repo], {
      encoding: 'utf8',
      env: isolatedEnv(tmp, { SVC_WORKTREE_POLICY: policyPath }),
    });
    assert.notEqual(res.status, 0, `expected fail-closed, got 0:\n${res.stdout}\n${res.stderr}`);
    assert.match(`${res.stdout}\n${res.stderr}`, /WORKTREE_POLICY_INVALID/);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('cmd_cleanup skips directories without this-repo gitdir metadata', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-cleanup-nogit-'));
  try {
    const repo = path.join(tmp, 'repo');
    fs.mkdirSync(repo, { recursive: true });
    const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    git('init', '-b', 'main');
    git('config', 'user.name', 'cleanup-tester');
    git('config', 'user.email', 'cleanup@example.invalid');
    fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
    git('add', '.');
    git('commit', '-qm', 'seed');
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');

    const central = path.join(tmp, 'worktrees');
    const leafParent = path.join(central, 'repo');
    const stray = path.join(leafParent, 'random-folder');
    fs.mkdirSync(stray, { recursive: true });
    const canary = path.join(stray, 'DO-NOT-QUARANTINE.txt');
    fs.writeFileSync(canary, 'stray-canary\n');

    const orphan = path.join(leafParent, 'this-repo-orphan');
    fs.mkdirSync(orphan, { recursive: true });
    let common = git('rev-parse', '--git-common-dir');
    if (!path.isAbsolute(common)) common = path.resolve(repo, common);
    fs.writeFileSync(path.join(orphan, '.git'), `gitdir: ${common}/worktrees/this-repo-orphan\n`);

    const policyPath = writePolicy(tmp, {
      schema_version: 1,
      default_root: central,
      naming_strategy: 'hierarchical',
      permissions: '0700',
      projects: {},
    });
    const res = spawnSync('bash', [worktreeSh, '__inner_cleanup'], {
      cwd: repo,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: tmp,
        SVC_WORKTREE_POLICY: policyPath,
        SVC_SESSION_ID: '',
        CURSOR_CONVERSATION_ID: '',
        CODEX_THREAD_ID: '',
        CODEX_SESSION_ID: '',
      },
    });
    assert.equal(res.status, 0, `cleanup should skip no-git dirs:\n${res.stdout}\n${res.stderr}`);
    assert.equal(fs.existsSync(canary), true, 'directory without this-repo gitdir must not be moved');
    assert.equal(fs.existsSync(orphan), false, 'this-repo gitdir leftover must be quarantined');
    const quarantinedOrphan = execFileSync('find', [leafParent, '-path', '*/.quarantine/*', '-name', 'this-repo-orphan'], {
      encoding: 'utf8',
    }).trim();
    assert.notEqual(quarantinedOrphan, '', 'this-repo leftover must appear in quarantine');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
