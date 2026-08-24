#!/usr/bin/env node
// WI-562 IP-H3: repo-wide worktree-verb mutex on the Git-CAS ref family.
//
// Thin wrapper over wi-claim's withExclusiveLock: one repository-shared
// update-ref CAS lock (`refs/svc/locks/...`) serializes promote/remove/cleanup.
// Crash-safe by construction (ref self-describes its holder with pid+start-token;
// provably-dead holders are CAS-reclaimed). Usage:
//   node worktree-verb-lock.mjs --verb promote --repo-root <dir> -- <cmd...>
// Exit codes: 0 = command succeeded; 1 = command failed; 2 = could not acquire.

import { pathToFileURL } from "node:url";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const SELF = path.resolve(process.argv[1] || ".");
const ROOT = path.resolve(SELF, "..", "..", "..");
const wiClaimPath = path.join(ROOT, "hooks", "lib", "wi-claim.mjs");

function parseArgs(argv) {
  const out = { verb: null, repoRoot: null, cmd: [] };
  let i = 0;
  while (i < argv.length) {
    if (argv[i] === "--verb") out.verb = argv[++i];
    else if (argv[i] === "--repo-root") out.repoRoot = argv[++i];
    else if (argv[i] === "--") { out.cmd = argv.slice(i + 1); break; }
    i += 1;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.verb || !args.repoRoot || args.cmd.length === 0) {
  console.error("usage: worktree-verb-lock.mjs --verb <promote|remove|cleanup> --repo-root <dir> -- <cmd...>");
  process.exit(2);
}

const { withExclusiveLock } = await import(pathToFileURL(wiClaimPath));

// One GLOBAL identity — every verb shares it, so cleanup (which has no branch
// argument and mutates shared metadata) serializes against promote/remove too.
const identity = `worktree-verb:_global:${path.resolve(args.repoRoot)}`;

const result = await withExclusiveLock(identity, () => {
  const run = spawnSync(args.cmd[0], args.cmd.slice(1), { stdio: "inherit" });
  return { code: run.status ?? 1 };
}, args.repoRoot);

if (!result || result.lock_error) {
  console.error(`worktree-verb-lock: cannot acquire the repository verb lock (${result?.warning || "unknown error"})`);
  process.exit(2);
}
if (result.lock_busy) {
  console.error(`worktree-verb-lock: another worktree verb holds the global lock (${result.warning})`);
  process.exit(2);
}
process.exit(typeof result.code === "number" ? result.code : 0);
