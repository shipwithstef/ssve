#!/usr/bin/env node
/** Tier 1: hooks/lib/git-query.mjs memoizes location queries only when enabled, and the worktree list follows added worktrees. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { enableGitQueryMemo, clearGitQueryMemo, gitRevParse, gitWorktreeList } from "../../../hooks/lib/git-query.mjs";

const git = (cwd, ...a) => execFileSync("git", ["-C", cwd, ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "git-query-")));
git(repo, "init", "-q");
git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x");
const quiet = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] };

test("disabled: every call asks git, so a recreated repository is seen", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-query-re-"));
  assert.throws(() => gitRevParse(dir, "--show-toplevel", quiet));
  git(dir, "init", "-q");
  assert.equal(fs.realpathSync(gitRevParse(dir, "--show-toplevel", quiet).trim()), fs.realpathSync(dir));
});

test("enabled: same answers as git, failures are never cached, unsupported flags refuse", () => {
  enableGitQueryMemo();
  assert.equal(gitRevParse(repo, "--show-toplevel"), git(repo, "rev-parse", "--show-toplevel"));
  assert.equal(gitRevParse(repo, "--git-common-dir"), git(repo, "rev-parse", "--git-common-dir"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "git-query-late-"));
  assert.throws(() => gitRevParse(dir, "--show-toplevel", quiet));
  git(dir, "init", "-q");
  assert.equal(fs.realpathSync(gitRevParse(dir, "--show-toplevel", quiet).trim()), fs.realpathSync(dir), "a failed lookup is retried");
  assert.throws(() => gitRevParse(repo, "--abbrev-ref"), /unsupported flag/);
});

test("enabled: the worktree list picks up a worktree added after the first call", () => {
  enableGitQueryMemo();
  clearGitQueryMemo();
  const roots = (out) => out.split("\n").filter((l) => l.startsWith("worktree ")).length;
  assert.equal(roots(gitWorktreeList(repo)), 1);
  const wt = path.join(path.dirname(repo), path.basename(repo) + "-wt");
  git(repo, "worktree", "add", "-q", "-b", "side", wt);
  assert.equal(roots(gitWorktreeList(repo)), 2, "adding a worktree invalidates the cached list");
  git(repo, "worktree", "remove", "--force", wt);
  assert.equal(roots(gitWorktreeList(repo)), 1, "removing one invalidates it again");
});
