// WI-562 IP-H1: shared git ground-truth recomputation for ALL merge-back paths.
//
// Extracted from validate-execution-merge-back.mjs so the delegated path and the
// parallel-wave path enforce IDENTICAL evidence rules: no merge-back may accept
// worker-authored status strings — changed files, diff digest, commit range, and
// clean-tree state are recomputed from git, never trusted from result JSON.
//
// Pure module: no process.exit, no argv access. Consumers wire their own CLI.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function git(worktree, args, options = {}) {
  return execFileSync("git", ["-C", worktree, ...args], {
    encoding: options.binary ? undefined : "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...(options.env ? { env: options.env } : {}),
  });
}

export function digest(buffer) {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

export function normalize(value) {
  const text = String(value).replaceAll("\\", "/").replace(/^\.\//, "");
  if (!text || text.startsWith("/") || text.split("/").includes("..")) throw new Error(`unsafe changed path: ${value}`);
  return path.posix.normalize(text);
}

export function isGitWorktree(dir) {
  try { git(dir, ["rev-parse", "--is-inside-work-tree"]); return true; } catch { return false; }
}

/**
 * Recompute worker ground truth from git.
 * @returns {{head_sha: string, base_sha: string|null, files: string[], diff_digest: string,
 *            commits: string[], clean: boolean, committed: boolean}}
 *  - committed: true iff HEAD != baseSha AND tree is clean (work actually landed).
 *  - clean: porcelain-empty tree right now.
 */
export function recomputeWorkerGroundTruth({ worktree, baseSha = null }) {
  const root = fs.realpathSync(path.resolve(worktree));
  const head_sha = git(root, ["rev-parse", "HEAD"]).trim();
  // "Clean" ignores the .svc/ workflow-state namespace: dispatch artifacts
  // (.svc/dispatch/*.result.json, lane-task graphs, receipt staging) are
  // orchestrator-owned bookkeeping written around validation time, not worker
  // work product. Any OTHER porcelain entry makes the tree dirty.
  const porcelain = git(root, ["status", "--porcelain"]).trim();
  const workDirty = porcelain.split(/\r?\n/).filter(Boolean)
    .filter((line) => !/^\S+\s+\.svc\//.test(line))
    .length > 0;
  const clean = !workDirty;
  let base = baseSha && /^[0-9a-f]{40}$/.test(baseSha) ? baseSha : null;
  if (!base) {
    // No explicit base: fall back to HEAD~1 when it exists so single-commit
    // workers still get a meaningful diff window.
    try { base = git(root, ["rev-parse", "HEAD~1"]).trim(); } catch { base = null; }
  }
  const range = base ? `${base}..${head_sha}` : head_sha;
  const files = base
    ? git(root, ["diff", "--name-only", range]).trim().split(/\r?\n/).filter(Boolean).map(normalize).sort()
    : [];
  const diff_digest = base
    ? digest(git(root, ["diff", "--binary", range], { binary: true }))
    : digest(Buffer.alloc(0));
  const commits = base
    ? git(root, ["rev-list", "--reverse", range]).trim().split(/\r?\n/).filter(Boolean)
    : [];
  return {
    head_sha,
    base_sha: base,
    files,
    diff_digest,
    commits,
    clean,
    committed: Boolean(base) && commits.length > 0 && clean,
  };
}

/**
 * Scope verification over normalized file paths.
 * allowed/denied are glob-ish pattern arrays consumed via matchesAny semantics;
 * callers import matchesAny from delegation-authority to keep ONE matcher.
 */
export function verifyScope(files, { matchesAny, allowed = [], denied = [] }) {
  const failures = [];
  for (const file of files) {
    if (denied.length && matchesAny(file, denied)) failures.push(`denied file changed: ${file}`);
    else if (allowed.length && !matchesAny(file, allowed)) failures.push(`file outside ownership scope: ${file}`);
  }
  return { ok: failures.length === 0, failures };
}
