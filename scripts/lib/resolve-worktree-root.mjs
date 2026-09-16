#!/usr/bin/env node

import path from "node:path";
import { resolveWorktreesRoot, ensureWorktreesDirectory, loadWorktreePolicy } from "../../hooks/lib/worktree-policy.mjs";

function parseArgs(argv) {
  const args = { repo: process.cwd(), ensure: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--repo" && argv[i + 1]) {
      args.repo = argv[++i];
    } else if (argv[i] === "--ensure") {
      args.ensure = true;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const repoRoot = path.resolve(args.repo);
const resolved = resolveWorktreesRoot(repoRoot);

if (args.ensure) {
  const policy = loadWorktreePolicy();
  ensureWorktreesDirectory(resolved, policy.permissions || "0700");
}

process.stdout.write(`${resolved}\n`);
