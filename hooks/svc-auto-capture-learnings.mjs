#!/usr/bin/env node
// Auto-capture high-signal learning candidates to a gitignored audit log.
// Observe-only hook: never blocks, never writes tracked learning files.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { appendJsonlLine } from "../scripts/state-io.mjs";
import { runAll } from "../scripts/lib/learning-candidate-detector.mjs";
import { dedupAgainstPaths } from "../scripts/lib/learning-dedup.mjs";
import { redactSecretsDeep } from "../scripts/lib/secret-redaction.mjs";
import { resolveSvcStateDir } from "./lib/svc-state-dir.mjs";
import { resolveOperationScope } from "./lib/operation-scope.mjs";

const DEFAULT_BUDGET_MS = 200;

function argValue(name) {
  const idx = process.argv.indexOf(name);
  return idx === -1 ? null : process.argv[idx + 1] || null;
}

function remaining(deadline) {
  return Math.max(0, deadline - Date.now());
}

function git(args, cwd, timeoutMs) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: timeoutMs }).trim();
  } catch {
    return "";
  }
}

function readStdin() {
  try {
    if (process.stdin.isTTY) return "";
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function loadRepoRoot(payload = {}) {
  const envRoot = process.env.SVC_AUTO_LEARN_ROOT;
  if (envRoot) return resolve(envRoot);
  const host = String(payload.host || process.env.SVC_HOST ||
    (process.env.CLAUDE_PROJECT_DIR ? "claude" : (process.env.CODEX_SESSION_ID ? "codex" : ""))).toLowerCase();
  if (host === "codex") {
    const scope = resolveOperationScope({ ...payload, host: "codex" }, { host: "codex", env: process.env });
    if (!scope.ok) return null;
    return resolve(scope.operation_repository?.worktree_root || scope.operation_cwd || process.cwd());
  }
  return process.cwd();
}

function candidatePaths(root) {
  return [
    resolve(root, ".svc/auto-learnings.jsonl"),
    resolve(root, ".svc/auto-learnings.draft.jsonl"),
    resolve(root, "references/framework-learnings.jsonl"),
    resolve(root, "docs/learnings/learnings.jsonl"),
  ];
}

function appendCandidate(path, candidate, timeoutMs) {
  appendJsonlLine(path, candidate, {
    timeoutMs: Math.max(25, timeoutMs),
    retryMs: 10,
    staleMs: 10_000,
  });
}

function main() {
  const budgetMs = Number(process.env.SVC_AUTO_LEARN_TIMEOUT_MS || DEFAULT_BUDGET_MS);
  const deadline = Date.now() + Math.max(25, budgetMs);
  const trigger = argValue("--trigger") || "unknown";
  const reviewMode = process.env.SVC_AUTO_LEARN_REVIEW === "1";
  const summaryMode = process.env.SVC_AUTO_LEARN_SUMMARY === "1";
  const verbose = process.env.SVC_AUTO_LEARN_VERBOSE === "1";
  // Consume and parse the hook payload so host runtimes do not see EPIPE-style
  // surprises and Codex PostToolUse state follows the actual operation cwd.
  let payload = {};
  try { payload = JSON.parse(readStdin() || "{}"); } catch { payload = {}; }
  const root = loadRepoRoot(payload);
  if (!root) return;

  try {
    if (process.env.SVC_AUTO_LEARN_DISABLE === "1") return;
    if (remaining(deadline) <= 25) return;

    const gitTimeoutMs = Math.min(100, Math.max(25, remaining(deadline) - 25));
    const branch = git(["branch", "--show-current"], root, gitTimeoutMs);
    const head = git(["rev-parse", "--short", "HEAD"], root, gitTimeoutMs);
    const mergeBase = process.env.SVC_AUTO_LEARN_BASE || git(["merge-base", "origin/main", "HEAD"], root, gitTimeoutMs);
    const sessionId = process.env.SVC_AUTO_LEARN_SESSION_ID || `${branch || "detached"}-${head || "unknown"}`;
    const warnings = [];

    const candidates = runAll({
      cwd: root,
      branch,
      mergeBase,
      sessionId,
      trigger,
      gitTimeoutMs,
      warn: (msg) => warnings.push(msg),
    });

    // WI-452: only capture into an svc-governed repo's .svc; never seed .svc in a
    // non-repo cwd (/tmp scratch, sandbox). No svc repo → skip capture entirely.
    const svcDir = resolveSvcStateDir(root);
    if (!svcDir) return;
    const paths = candidatePaths(root);
    const outPath = reviewMode
      ? resolve(svcDir, "auto-learnings.draft.jsonl")
      : resolve(svcDir, "auto-learnings.jsonl");
    const existingPaths = paths.filter((p) => existsSync(p));
    let appended = 0;

    for (const candidate of candidates) {
      if (remaining(deadline) <= 25) break;
      if (dedupAgainstPaths(candidate, existingPaths)) continue;
      appendCandidate(outPath, redactSecretsDeep({ ...candidate, trigger }), remaining(deadline) - 5);
      existingPaths.push(outPath);
      appended += 1;
    }

    if (summaryMode) {
      const target = reviewMode ? ".svc/auto-learnings.draft.jsonl" : ".svc/auto-learnings.jsonl";
      process.stdout.write(`Auto-captured ${appended} learning candidate(s) into ${target}.\n`);
      process.stdout.write("Tracked learning files were not modified.\n");
      process.stdout.write("Run `node scripts/promote-auto-learnings.mjs` to review/promote.\n");
    } else if (verbose && warnings.length > 0) {
      process.stderr.write(`[svc-auto-capture-learnings] ${warnings.join("; ")}\n`);
    }
  } catch (error) {
    if (verbose) process.stderr.write(`[svc-auto-capture-learnings] skipped: ${error.message}\n`);
  }
}

main();
process.exit(0);
