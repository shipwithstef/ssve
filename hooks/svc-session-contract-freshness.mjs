#!/usr/bin/env node

/**
 * svc Session Contract Freshness — PreToolUse hook.
 *
 * Origin: audit-session-execution finding F2 (May 6 2026).
 * Problem: Stale session contracts cause drift, ghost-completions, and
 *   incorrect backlog dispatch. Prior fix was detection-only (validator
 *   script). This hook is mechanical prevention.
 *
 * Scope (WI-399 A3): the gate applies to the TARGET FILE's own repository.
 *   - Target outside any git repo (e.g. /tmp scratch files) → exit 0. A
 *     session contract governs repo state, not the filesystem at large.
 *   - Contract is resolved from the target file's repo root, not the hook
 *     process cwd — multi-repo / worktree sessions gate against the right
 *     ledger.
 *
 * Checks (hard block on failure):
 *   1. Contract timestamp is < SVC_CONTRACT_MAX_AGE_HOURS old (default 4h).
 *   2. Contract.skill matches SVC_CURRENT_SKILL (if env var is set).
 *
 * Fail-open on: missing/unparsable payload, no file path, target outside any
 *   repo, target repo without a .svc dir (not svc-governed), unparsable
 *   contract timestamp.
 *
 * Warn-only on: fresh-worktree bootstrap — a linked worktree (.git is a file)
 *   whose tracked contract file is untouched since checkout carries the LAST
 *   COMMITTED line, which is stale by construction, not by negligence. The
 *   first mutating session in a new worktree appends a fresh line; blocking
 *   before that append is a chicken-and-egg trap (live-hit 2026-06-10).
 *
 * Hard block on: stale contract for an in-repo target (outside the bootstrap
 *   window), missing contract file in the target repo, skill mismatch.
 *
 * Disable: SVC_DISABLED_HOOKS=svc-session-contract-freshness
 * Bypass stale check only: SVC_CONTRACT_MAX_AGE_HOURS=0
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// WI-452: never treat the system temp ROOT as a repo. A stray /tmp/.git (e.g. the
// Codex sandbox tmpfs) otherwise makes /tmp look like a repo; combined with an
// already-polluted /tmp/.svc the gate hard-blocked legit /tmp scratch writes.
const TEMP_ROOTS = (() => {
  const s = new Set();
  for (const t of [os.tmpdir(), "/tmp", process.env.TMPDIR]) {
    if (!t) continue;
    try { s.add(path.resolve(t)); } catch {}
    try { s.add(fs.realpathSync(t)); } catch {}
  }
  return s;
})();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { readHookPayload, extractFilePath, extractCommand } = await import(
  path.join(__dirname, "lib", "hook-payload.mjs")
);
const { resolveOperationScope } = await import(path.join(__dirname, "lib", "operation-scope.mjs"));
const { classifyBashMutationTargets } = await import(path.join(__dirname, "lib", "bash-mutation-targets.mjs"));
const { isShellTool } = await import(path.join(__dirname, "lib", "shell-tools.mjs"));
const { blockViaExit } = await import(path.join(__dirname, "lib", "hook-decision.mjs"));

// WI-487 (F-003/AC-487-7): route BLOCK paths through the 5-field actionable-denial
// envelope + durable receipt. Falls back to plain stderr+exit-2 on older installs.
let emitDenial = null;
try { ({ emitDenial } = await import(path.join(__dirname, "lib", "hook-denial.mjs"))); } catch { /* older install */ }
function denyContract(reasonCode, humanReason, { target, recovery } = {}) {
  // ADDITIVE (WI-487 R2): always write the full human reason (prior blockViaExit
  // contract), then layer the 5-field envelope + receipt via emitDenial.
  if (humanReason) process.stderr.write(humanReason + "\n");
  if (emitDenial) {
    emitDenial({
      hook_id: "svc-session-contract-freshness",
      reason_code: reasonCode,
      cause: String(humanReason || "").slice(0, 1200),
      operation: target ? `Edit/Write of ${target}` : "Edit/Write under a stale/absent session contract",
      recovery: recovery || "Append a fresh line to .svc/session-contract.jsonl (or run route-workflow) before editing.",
      resolved_command_path: target || reasonCode,
      session_id: process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "",
    });
  }
  process.exit(2);
}

const WORKTREE_BOOTSTRAP_WINDOW_MS = 60 * 60 * 1000; // contract untouched ≤1h after worktree creation

function isDisabled() {
  const disabled = (process.env.SVC_DISABLED_HOOKS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return disabled.includes("svc-session-contract-freshness");
}

// Walk up from dir looking for a .git entry (directory = main checkout,
// file = linked worktree). Returns { root, gitPath, isWorktree } or null.
function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    if (!TEMP_ROOTS.has(dir)) {   // WI-452: skip the system temp root (stray /tmp/.git pollution)
      const gitPath = path.join(dir, ".git");
      try {
        const st = fs.statSync(gitPath);
        return { root: dir, gitPath, isWorktree: st.isFile() };
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readLastContract(repoRoot) {
  const file = path.join(repoRoot, ".svc", "session-contract.jsonl");
  try {
    const content = fs.readFileSync(file, "utf8").trim();
    if (!content) return null;
    const lines = content.split("\n").filter(Boolean);
    if (lines.length === 0) return null;
    return { contract: JSON.parse(lines[lines.length - 1]), file };
  } catch {
    return null;
  }
}

function parseTs(ts) {
  if (!ts || typeof ts !== "string") return null;
  const epoch = Date.parse(ts);
  return isNaN(epoch) ? null : epoch;
}

// Fresh-worktree bootstrap: linked worktree whose contract file has not been
// appended to since the worktree was created (file mtime within the bootstrap
// window of the .git file's mtime). The staleness is the checkout's, not the
// session's — warn instead of block (WI-399 A3).
function isWorktreeBootstrap(repo, contractFile) {
  if (!repo.isWorktree) return false;
  try {
    const gitMtime = fs.statSync(repo.gitPath).mtimeMs;
    const contractMtime = fs.statSync(contractFile).mtimeMs;
    return contractMtime <= gitMtime + WORKTREE_BOOTSTRAP_WINDOW_MS;
  } catch {
    return false;
  }
}

function checkFreshness(contract) {
  // WI-558: freshness guards a stale WI BINDING drifting into edits.
  //  - Any row carrying a wi id is ACTIVE (governed), whatever bound_to says.
  //  - A row with NO wi is TERMINAL only when it carries a recognized
  //    non-wi boundary marker (user-request | framework-evolution); those are
  //    session closeouts and cannot go stale.
  //  - Legacy/ambiguous rows (no wi, unknown or absent bound_to) stay ACTIVE —
  //    fail closed rather than inventing an exemption.
  const boundTo = String(contract.bound_to || "");
  const boundWi = typeof contract.wi === "string" ? contract.wi.trim() : "";
  const isTerminalUnbound = !boundWi && (boundTo === "user-request" || boundTo === "framework-evolution");
  if (isTerminalUnbound) {
    return null;
  }
  const maxAgeHours = parseInt(process.env.SVC_CONTRACT_MAX_AGE_HOURS || "4", 10);
  if (maxAgeHours === 0) {
    return null; // bypass age check
  }
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;

  const ts = parseTs(contract.ts);
  if (ts === null) {
    return null;
  }

  const now = Date.now();
  const ageMs = now - ts;

  if (ageMs > maxAgeMs) {
    const ageHours = Math.round(ageMs / (60 * 60 * 1000));
    return (
      `[svc-session-contract-freshness] BLOCKED: Session contract is ${ageHours}h old ` +
      `(max ${maxAgeHours}h).\n` +
      `The session contract has gone stale. Before making edits, either:\n` +
      `  1. Append a fresh contract line via Bash:\n` +
      `     printf '%s\\n' "{\\"ts\\":\\"$(date -Iseconds)\\",\\"wi\\":...,\\"intent\\":\\"...\\"}" >> .svc/session-contract.jsonl\n` +
      `  2. Run route-workflow (refreshes it automatically), OR\n` +
      `  3. Set SVC_CONTRACT_MAX_AGE_HOURS=0 to bypass for this session.\n` +
      `Stale contracts cause drift and ghost-completions. See audit-session-execution F2.`
    );
  }

  const currentSkill = process.env.SVC_CURRENT_SKILL || "";
  if (currentSkill && contract.skill && contract.skill !== currentSkill) {
    return (
      `[svc-session-contract-freshness] BLOCKED: Session contract.skill="${contract.skill}" ` +
      `does not match SVC_CURRENT_SKILL="${currentSkill}".\n` +
      `This indicates a routing mismatch — the agent is working on the wrong skill.\n` +
      `Before making edits, run route-workflow to reconcile, or set SVC_CURRENT_SKILL ` +
      `to match the contract.`
    );
  }

  return null;
}

async function main() {
  if (isDisabled()) {
    process.exit(0);
  }

  const call = readHookPayload();
  if (!call) process.exit(0);

  const { toolName, toolInput } = call;
  if (!/^(Edit|Write|WriteFile|StrReplaceFile)$/.test(toolName) && !isShellTool(toolName)) {
    process.exit(0);
  }

  const requestedPath = extractFilePath(toolInput);

  // WI-399 A3: resolve the TARGET's repo. Outside any repo → not governed.
  // A repo WITHOUT a .svc directory is not svc-governed (scratch repos, /tmp
  // junk checkouts, foreign projects) → also not governed: this hook prevents
  // drift in active svc repos, it does not conscript every repo on disk.
  const operationHost = call.raw?.host || process.env.SVC_HOST ||
    (process.env.CLAUDE_PLUGIN_ROOT || process.env.CLAUDE_CODE_REMOTE || process.env.CLAUDE_PROJECT_DIR ? "claude" : "codex");
  const operationScope = resolveOperationScope({
    ...call.raw, host: operationHost,
    tool_name: call.toolName, tool_input: call.toolInput, cwd: call.session_cwd || call.cwd,
  });
  const operationRoot = operationScope.operation_repository?.worktree_root || operationScope.operation_cwd || call.cwd || process.cwd();
  const mutationTargets = isShellTool(toolName)
    ? classifyBashMutationTargets(extractCommand(toolInput), { cwd: operationRoot })
    : [operationScope.targets[0]?.canonical || path.resolve(operationRoot, requestedPath)].filter(Boolean);
  if (!mutationTargets.length) process.exit(0);
  const checkedRepos = new Set();
  for (const absTarget of mutationTargets) {
    const repo = findRepoRoot(path.dirname(absTarget));
    if (!repo || checkedRepos.has(repo.root)) continue;
    checkedRepos.add(repo.root);
    try {
      if (!fs.statSync(path.join(repo.root, ".svc")).isDirectory()) continue;
    } catch {
      continue;
    }

    const found = readLastContract(repo.root);
    if (!found) {
      denyContract("SVC-SESSION-CONTRACT-MISSING",
      `[svc-session-contract-freshness] BLOCKED: Session contract is MISSING in ${repo.root}.\n` +
      `Before any Edit, Write, or Bash tool call, write a session contract entry to .svc/session-contract.jsonl:\n` +
      `  {\"ts\":\"ISO-8601\",\"bound_to\":\"user-request|wi-backlog|framework-evolution\",\"request\":\"<summary>\",\"wi\":null_or_id,\"skill\":null_or_name,\"guard_override_count\":0}\n` +
      `Route-workflow does this automatically when invoked. Direct edits without a contract destroy the audit trail.\n` +
      `See route-workflow/SKILL.md §Session Contract and audit-session-execution F1/F2/F3.\n` +
      `Bypass: SVC_DISABLED_HOOKS=svc-session-contract-freshness (emergency only).`,
      { target: absTarget, recovery: "Write a session-contract entry to .svc/session-contract.jsonl (route-workflow does this automatically) before editing." }
      );
    }

    const blockReason = checkFreshness(found.contract);
    if (blockReason) {
      if (isWorktreeBootstrap(repo, found.file)) {
        process.stderr.write(
        `[svc-session-contract-freshness] WARN (fresh-worktree bootstrap): the tracked ` +
        `contract in ${repo.root} carries the last COMMITTED line, which is stale. ` +
        `Append a fresh contract line for this worktree session:\n` +
        `  printf '%s\\n' "{\\"ts\\":\\"$(date -Iseconds)\\",...}" >> ${path.join(repo.root, ".svc", "session-contract.jsonl")}\n`
        );
        continue;
      }
      denyContract("SVC-SESSION-CONTRACT-STALE", blockReason, {
        target: absTarget,
        recovery: "Append a fresh contract line to .svc/session-contract.jsonl (or run route-workflow); set SVC_CONTRACT_MAX_AGE_HOURS=0 to bypass the age check for this session.",
      });
    }
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
