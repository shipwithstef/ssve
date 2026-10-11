#!/usr/bin/env node
/**
 * svc-bootstrap-repo.mjs
 *
 * Gives a fresh project the git facts the framework's own scripts assume, so that
 * worktree isolation, receipts and reconcile work in a repository that has only been
 * `git init`ed. Idempotent: a second run changes nothing and makes no commit.
 *
 *   node scripts/svc-bootstrap-repo.mjs [--repo <path>] [--json]
 *
 * What it does, in order:
 *   1. Unborn HEAD  -> point it at refs/heads/main, set a repo-local identity only if
 *      none is configured, `git add -A` and commit "Initialize repository" (run it after
 *      init-project-state has written .gitignore, so ignored files stay untracked).
 *      If HEAD already resolves nothing is committed.
 *   2. Chain policy -> when nothing else decides the mode (no env override, no shared
 *      file, no owner-home file), write {"schema_version":1,"mode":"refuse"} to
 *      $(git-common-dir)/svc-chain-policy.json. Never writes .svc/chain-policy.json.
 *   3. No `origin` remote -> make refs/remotes/origin/main (and origin/HEAD) follow the
 *      local default branch, so `origin/main...HEAD` style commands work. No network
 *      remote is added. An existing origin is never touched.
 *
 * Output (JSON): { ok, head, created_root_commit, branch, chain_policy_path,
 *   chain_policy_written, chain_policy_source, baseline_sha, identity_assumed }
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function run(repo, args, options = {}) {
  try {
    return execFileSync("git", ["-C", repo, ...args], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: options.env || process.env,
    }).trim();
  } catch (error) {
    if (options.throws) throw error;
    return null;
  }
}

function resolveCommit(repo, ref) {
  return run(repo, ["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`]);
}

function firstResolving(repo, refs) {
  for (const ref of refs) {
    const sha = resolveCommit(repo, ref);
    if (sha) return sha;
  }
  return null;
}

function writeFileAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, text, { mode: 0o644 });
  fs.renameSync(tmp, file);
}

export function bootstrapRepo({ repo = process.cwd(), env = process.env } = {}) {
  const requested = fs.realpathSync(path.resolve(repo));
  const top = run(requested, ["rev-parse", "--show-toplevel"]);
  if (!top) return { ok: false, reason: "not_a_git_repository", repo: requested };
  const root = fs.realpathSync(top);
  if (root !== requested) {
    return { ok: false, reason: "not_repository_root", repo: requested, repository_root: root };
  }
  const result = {
    ok: true, head: null, created_root_commit: false, branch: null,
    chain_policy_path: null, chain_policy_written: false, chain_policy_source: null,
    baseline_sha: null, identity_assumed: false,
  };

  // 1. Root commit on an unborn repository.
  if (!resolveCommit(root, "HEAD")) {
    run(root, ["symbolic-ref", "HEAD", "refs/heads/main"], { throws: true });
    const haveName = run(root, ["config", "--get", "user.name"]);
    const haveEmail = run(root, ["config", "--get", "user.email"]);
    if (!haveName) { run(root, ["config", "--local", "user.name", "project"], { throws: true }); result.identity_assumed = true; }
    if (!haveEmail) { run(root, ["config", "--local", "user.email", "project@localhost"], { throws: true }); result.identity_assumed = true; }
    run(root, ["add", "-A"], { throws: true });
    run(root, ["-c", "commit.gpgsign=false", "commit", "--no-verify", "--allow-empty", "-q", "-m", "Initialize repository"], { throws: true });
    result.created_root_commit = true;
  }
  result.head = resolveCommit(root, "HEAD");
  result.branch = run(root, ["symbolic-ref", "--quiet", "--short", "HEAD"]) || null;

  // 2. Chain policy under the git common dir (never a working-tree file).
  const commonRaw = run(root, ["rev-parse", "--git-common-dir"], { throws: true });
  const commonDir = fs.realpathSync(path.resolve(root, commonRaw));
  const sharedPath = path.join(commonDir, "svc-chain-policy.json");
  result.chain_policy_path = sharedPath;
  const homeDir = typeof env.HOME === "string" && env.HOME ? env.HOME : os.homedir();
  const homePolicy = path.join(homeDir, ".svc", "chain-policy.json");
  const envPolicy = typeof env.SVC_CHAIN_POLICY === "string" && env.SVC_CHAIN_POLICY.trim() !== "";
  if (fs.existsSync(sharedPath)) {
    result.chain_policy_source = "shared";
  } else if (envPolicy) {
    result.chain_policy_source = "env";
  } else if (fs.existsSync(homePolicy)) {
    // The owner already chose a mode; a shared file would override it silently.
    result.chain_policy_source = "home";
  } else {
    writeFileAtomic(sharedPath, `${JSON.stringify({ schema_version: 1, mode: "refuse" })}\n`);
    result.chain_policy_written = true;
    result.chain_policy_source = "shared";
  }

  // 3. Local stand-in for origin/main when there is no remote called origin.
  if (run(root, ["remote", "get-url", "origin"]) === null) {
    const base = firstResolving(root, ["refs/heads/main", "refs/heads/master", "HEAD"]);
    if (base) {
      const current = resolveCommit(root, "refs/remotes/origin/main");
      const advance = !current || (current !== base && run(root, ["merge-base", "--is-ancestor", current, base]) !== null);
      if (advance) run(root, ["update-ref", "refs/remotes/origin/main", base], { throws: true });
      if (!run(root, ["symbolic-ref", "--quiet", "refs/remotes/origin/HEAD"])) {
        run(root, ["symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/main"], { throws: true });
      }
    }
  }
  result.baseline_sha = resolveCommit(root, "refs/remotes/origin/main");
  return result;
}

function parseArgs(argv) {
  const out = { repo: process.cwd(), json: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--repo") out.repo = argv[++i];
    else if (argv[i] === "--json") out.json = true;
    else throw new Error(`unexpected argument: ${argv[i]}`);
  }
  return out;
}

function isMain() {
  try { return Boolean(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); }
  catch { return false; }
}

if (isMain()) {
  try {
    const args = parseArgs(process.argv.slice(2));
    const result = bootstrapRepo({ repo: args.repo });
    process.stdout.write(`${JSON.stringify(result, null, args.json ? 0 : 2)}\n`);
    process.exit(result.ok ? 0 : 2);
  } catch (error) {
    process.stderr.write(`[svc-bootstrap-repo] ${error.message}\n`);
    process.exit(2);
  }
}
