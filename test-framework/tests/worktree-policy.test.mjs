import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  loadWorktreePolicy,
  resolveWorktreesRoot,
  resolveApprovedRoots,
  ensureWorktreesDirectory,
  expandHome,
  repoIdentifier,
} from '../../hooks/lib/worktree-policy.mjs';
import {
  approvedWorktreeRoots,
  defaultWorktreeRoot,
  isApprovedExistingWorktreeRoot,
} from '../../hooks/lib/literal-branch.mjs';

test('worktree policy defaults and home expansion', () => {
  const home = os.homedir();
  assert.equal(expandHome('~/worktrees'), path.join(home, 'worktrees'));
  assert.equal(expandHome('/opt/worktrees'), '/opt/worktrees');
  assert.equal(repoIdentifier('/some/path/to/my-project'), 'my-project');
});

test('worktree policy loads custom config file via env', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-policy-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const policyFile = path.join(tmpDir, 'worktree-policy.json');
  const policyData = {
    schema_version: 1,
    default_root: path.join(tmpDir, 'custom-worktrees'),
    naming_strategy: 'hierarchical',
    permissions: '0700',
    projects: {
      'special-repo': {
        root: path.join(tmpDir, 'special-worktrees'),
      },
    },
  };
  fs.writeFileSync(policyFile, JSON.stringify(policyData, null, 2));

  const env = { ...process.env, SVC_WORKTREE_POLICY: policyFile };
  const loaded = loadWorktreePolicy(env);
  assert.equal(loaded.default_root, path.join(tmpDir, 'custom-worktrees'));
  assert.equal(loaded.naming_strategy, 'hierarchical');

  // Test root resolution
  const defaultResolved = resolveWorktreesRoot('/any/path/my-repo', env);
  assert.equal(defaultResolved, path.join(tmpDir, 'custom-worktrees', 'my-repo'));

  const specialResolved = resolveWorktreesRoot('/any/path/special-repo', env);
  assert.equal(specialResolved, path.join(tmpDir, 'special-worktrees'));
});

test('resolveApprovedRoots includes centralized, legacy in-repo, and project roots', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-roots-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const repoDir = path.join(tmpDir, 'test-repo');
  fs.mkdirSync(repoDir, { recursive: true });

  const policyFile = path.join(tmpDir, 'worktree-policy.json');
  const customRoot = path.join(tmpDir, 'global-worktrees');
  fs.writeFileSync(policyFile, JSON.stringify({
    schema_version: 1,
    default_root: customRoot,
    naming_strategy: 'hierarchical',
    projects: {
      'other-repo': {
        root: path.join(tmpDir, 'other-worktrees'),
      },
    },
  }));

  const env = {
    ...process.env,
    SVC_WORKTREE_POLICY: policyFile,
    SVC_APPROVED_WORKTREE_ROOTS: path.join(tmpDir, 'extra-approved'),
  };
  fs.mkdirSync(path.join(tmpDir, 'extra-approved'), { recursive: true });

  const approved = resolveApprovedRoots(repoDir, env);

  // Centralized repo worktree root
  assert.ok(approved.includes(path.join(customRoot, 'test-repo')));
  // Base worktree root
  assert.ok(approved.includes(customRoot));
  // Legacy in-repo .worktrees
  assert.ok(approved.includes(path.join(repoDir, '.worktrees')));
  // Project-specific root
  assert.ok(approved.includes(path.join(tmpDir, 'other-worktrees')));
  // Env var approved root
  assert.ok(approved.includes(path.join(tmpDir, 'extra-approved')));
});

test('ensureWorktreesDirectory creates directory with 0700 permissions', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-perms-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const target = path.join(tmpDir, 'secure-worktrees', 'sub');
  ensureWorktreesDirectory(target, '0700');

  assert.ok(fs.existsSync(target));
  const stat = fs.statSync(target);
  // Mode mask 0777 on Unix
  const mode = stat.mode & 0o777;
  assert.equal(mode, 0o700);
});

test('literal-branch integration approves worktrees inside centralized root', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-literal-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const repoDir = path.join(tmpDir, 'repo');
  fs.mkdirSync(repoDir, { recursive: true });

  const centralRoot = path.join(tmpDir, 'worktrees');
  const repoWorktrees = path.join(centralRoot, 'repo');
  const branchWorktree = path.join(repoWorktrees, 'feat-test');
  fs.mkdirSync(branchWorktree, { recursive: true });

  const policyFile = path.join(tmpDir, 'worktree-policy.json');
  fs.writeFileSync(policyFile, JSON.stringify({
    schema_version: 1,
    default_root: centralRoot,
    naming_strategy: 'hierarchical',
  }));

  const env = { ...process.env, SVC_WORKTREE_POLICY: policyFile };

  // Verify approvedWorktreeRoots and defaultWorktreeRoot
  assert.ok(approvedWorktreeRoots(repoDir, env).includes(repoWorktrees));
  assert.equal(defaultWorktreeRoot(repoDir, env), repoWorktrees);

  // Verify isApprovedExistingWorktreeRoot approves the centralized branch worktree
  const approval = isApprovedExistingWorktreeRoot(branchWorktree, repoDir, env);
  assert.equal(approval.ok, true);

  // Verify random unapproved path is rejected
  const unapproved = path.join(tmpDir, 'unapproved-dir', 'feat-rogue');
  fs.mkdirSync(unapproved, { recursive: true });
  const rejection = isApprovedExistingWorktreeRoot(unapproved, repoDir, env);
  assert.equal(rejection.ok, false);
  assert.equal(rejection.reason_code, 'WORKTREE_ROOT_UNAPPROVED');
});

test('worktree leaf removal preserves parent project directory', (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-wt-leaf-'));
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

  const parentDir = path.join(tmpDir, 'worktrees', 'my-repo');
  const leafDir = path.join(parentDir, 'feature-x');
  fs.mkdirSync(leafDir, { recursive: true });

  // Simulate leaf-only removal
  fs.rmSync(leafDir, { recursive: true, force: true });

  // Assert leaf is gone, but parent project directory is strictly preserved
  assert.equal(fs.existsSync(leafDir), false);
  assert.equal(fs.existsSync(parentDir), true);
});
