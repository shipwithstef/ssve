#!/usr/bin/env node
import {
  assertConfiguredRootSafe,
  DEFAULT_WORKTREES_ROOT,
  loadWorktreePolicy,
  repoIdentifier,
  resolveWorktreesRoot,
} from "../../hooks/lib/worktree-policy.mjs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const branch = process.argv[3];
const policy = loadWorktreePolicy();
const repoName = repoIdentifier(repoRoot);
const project = policy.projects?.[repoName];
const configuredPath = project?.root || policy.default_root || DEFAULT_WORKTREES_ROOT;
// Check the un-canonicalized policy/env path first so symlink evidence is not
// erased by realpathSync inside resolveWorktreesRoot().
assertConfiguredRootSafe(configuredPath);
const base = resolveWorktreesRoot(repoRoot);
assertConfiguredRootSafe(base);
if (branch) {
  // Sanitize slash branches into safe leaf
  const safeLeaf = branch.replace(/\//g, "-");
  const resolved = path.join(base, safeLeaf);
  assertConfiguredRootSafe(resolved);
  process.stdout.write(resolved + "\n");
} else {
  process.stdout.write(base + "\n");
}
