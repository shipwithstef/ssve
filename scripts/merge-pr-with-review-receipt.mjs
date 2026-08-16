#!/usr/bin/env node
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

const root = path.resolve(argValue("--root") || process.cwd());
const pr = argValue("--pr");
const dryRun = hasFlag("--dry-run");
const explicitRepo = argValue("--repo");
const expectedRepo = argValue("--expected-repo");
const expectedHead = argValue("--expected-head");
const expectedHeadSha = argValue("--expected-head-sha");

if (!pr || !/^[0-9]+$/.test(pr)) {
  console.error(
    "Usage: node scripts/merge-pr-with-review-receipt.mjs --pr <number> [--root <dir>] [--repo owner/name] [--squash] [--delete-branch] [--dry-run]",
  );
  process.exit(2);
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}

function repoFromRemoteUrl(url) {
  const trimmed = String(url || "").trim();
  const match =
    trimmed.match(/github\.com[:/]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/) ||
    trimmed.match(/^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/);
  return match ? `${match[1]}/${match[2]}` : "";
}

function resolveRepo() {
  if (explicitRepo) return explicitRepo;
  const remote = gitOutput(["remote", "get-url", "origin"]);
  const repo = repoFromRemoteUrl(remote);
  if (repo) return repo;
  console.error(
    "[svc-pr-merge-review-receipt] BLOCKED: cannot resolve GitHub repo. Pass --repo owner/name.",
  );
  process.exit(2);
}

const validate = spawnSync(
  process.execPath,
  [path.join(__dirname, "validate-review-receipt.mjs"), "--root", root, "--pr", pr],
  { cwd: root, encoding: "utf8" },
);

if (validate.status !== 0) {
  if (validate.stdout) process.stdout.write(validate.stdout);
  if (validate.stderr) process.stderr.write(validate.stderr);
  console.error(
    `[svc-pr-merge-review-receipt] BLOCKED: PR ${pr} is not eligible for merge from this shell surface.`,
  );
  process.exit(validate.status || 1);
}

if (validate.stdout) process.stdout.write(validate.stdout);

const ghArgs = ["pr", "merge", pr];
const repo = resolveRepo();
if (expectedRepo || expectedHead || expectedHeadSha) {
  if (!expectedRepo || !expectedHead || !/^[0-9a-f]{40}$/.test(expectedHeadSha || "") || repo !== expectedRepo) {
    console.error("[svc-pr-merge-review-receipt] BLOCKED: exact expected repo/head/head-sha binding is required."); process.exit(2);
  }
  if (!dryRun) {
    const prView = spawnSync("gh", ["pr", "view", pr, "--repo", repo, "--json", "headRefName,headRefOid"], { encoding: "utf8" });
    let prIdentity;
    try { prIdentity = prView.status === 0 ? JSON.parse(prView.stdout) : null; } catch { prIdentity = null; }
    if (!prIdentity || prIdentity.headRefName !== expectedHead || prIdentity.headRefOid !== expectedHeadSha) {
      if (prView.stderr) process.stderr.write(prView.stderr);
      console.error("[svc-pr-merge-review-receipt] BLOCKED: PR head identity does not match the promotion tuple."); process.exit(2);
    }
  }
}
ghArgs.push("--repo", repo);
if (hasFlag("--squash")) ghArgs.push("--squash");
if (hasFlag("--delete-branch")) ghArgs.push("--delete-branch");
if (hasFlag("--rebase")) ghArgs.push("--rebase");
if (hasFlag("--merge")) ghArgs.push("--merge");
if (hasFlag("--auto")) ghArgs.push("--auto");
if (hasFlag("--admin")) ghArgs.push("--admin");

if (dryRun) {
  console.log(`DRY-RUN: gh ${ghArgs.join(" ")}`);
  process.exit(0);
}

// Run outside the git worktree so gh cannot try to check out local main after
// the remote merge. That checkout fails when main is already used by another
// worktree, even though the GitHub merge itself succeeded.
const merge = spawnSync("gh", ghArgs, { cwd: os.tmpdir(), stdio: "inherit" });
process.exit(merge.status || 0);
