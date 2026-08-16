#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readHookPayload, extractCommand } from "./lib/hook-payload.mjs";
import { detectHost, emitDecision, DENY } from "./lib/hook-decision.mjs";
import { isReadOnlyTool } from "./codex/lib/codex-hook-context.mjs";
import { resolveAuthorityHost, resolveWI } from "./lib/resolve-wi.mjs";
import { WI_ID_BODY } from "./lib/wi-id.mjs";
import { resolveOperationScope } from "./lib/operation-scope.mjs";
import { resolveRuntimeDirectory } from "./lib/svc-runtime-root.mjs";
import { authorizeDelegatedMutation, readDelegation } from "./lib/delegation-authority.mjs";
import { readController, repositoryId } from "./lib/authority-store.mjs";
import { parseBootstrapCommand } from "./codex/lib/bootstrap-command.mjs";
import { readOwnerLease } from "./codex/lib/owner-lease.mjs";

const SHELL_TOOLS = new Set(["Bash", "Shell", "run_shell_command", "shell"]);
const WRITE_TOOLS = new Set([
  "apply_patch", "Edit", "Write", "WriteFile", "StrReplaceFile",
  "write_file", "replace", "edit",
]);
const BOOTSTRAP_RE = new RegExp("^node\\s+scripts\\/svc-ensure-worktree\\.mjs\\s+--wi\\s+" + WI_ID_BODY + "\\s+--branch\\s+[A-Za-z0-9][A-Za-z0-9._-]*(?:\\s+--from\\s+(?:origin\\/main|[0-9a-f]{40}))?(?:\\s+--(?:print-cd|json))*$");  // WI-497: WI-id from canonical WI_ID_BODY

function inside(candidate, root) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function realExistingParent(candidate) {
  let cursor = path.resolve(candidate);
  const tail = [];
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return path.resolve(candidate);
    tail.unshift(path.basename(cursor));
    cursor = parent;
  }
  const real = fs.realpathSync(cursor);
  return path.resolve(real, ...tail);
}

function gitContext(cwd) {
  try {
    const current = fs.realpathSync(execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim());
    const common = execFileSync("git", ["-C", cwd, "rev-parse", "--git-common-dir"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const commonReal = fs.realpathSync(path.resolve(current, common));
    const defaultRoot = fs.realpathSync(path.dirname(commonReal));
    const worktrees = execFileSync("git", ["-C", cwd, "worktree", "list", "--porcelain"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).split(/\r?\n/).filter((line) => line.startsWith("worktree "))
      .map((line) => fs.realpathSync(line.slice("worktree ".length)));
    return { current, defaultRoot, repoRoots: [...new Set(worktrees)] };
  } catch {
    return null;
  }
}

function gitContextForTarget(target) {
  let cursor = path.resolve(target);
  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor);
    if (parent === cursor) return null;
    cursor = parent;
  }
  try {
    if (!fs.statSync(cursor).isDirectory()) cursor = path.dirname(cursor);
  } catch {
    return null;
  }
  return gitContext(cursor);
}

function canonicalToolName(name) {
  return SHELL_TOOLS.has(name) ? "Bash" : name;
}

function canonicalReadContext(call) {
  return {
    tool_name: canonicalToolName(call.toolName),
    tool_input: call.toolInput,
  };
}

function extraReadOnly(call) {
  if (!SHELL_TOOLS.has(call.toolName)) return false;
  const command = extractCommand(call.toolInput).trim();
  if (!command || /[;&|`$<>\n'"\\]/.test(command)) return false;
  const tokens = command.split(/\s+/).filter(Boolean);
  const safeNodeCheck = tokens[0] === "node" && tokens[1] === "--check" && tokens.length === 3 &&
    !tokens[2].startsWith("-");
  return safeNodeCheck;
}

function patchPaths(text) {
  return [...String(text || "").matchAll(/^\*\*\* (?:Update|Add|Delete) File: (.+)$/gm)]
    .map((match) => match[1].trim());
}

function shellMutationPaths(call) {
  if (!SHELL_TOOLS.has(call.toolName)) return [];
  const command = extractCommand(call.toolInput).trim();
  if (!command || /[;&|$<>\n'"\\]/.test(command) || command.includes(String.fromCharCode(96))) return [];
  const tokens = command.split(/\s+/).filter(Boolean);
  if (!new Set(["touch", "mkdir", "rm", "rmdir"]).has(tokens[0])) return [];
  return tokens.slice(1)
    .filter((token) => token !== "--" && !token.startsWith("-"))
    .map((value) => realExistingParent(path.isAbsolute(value) ? value : path.resolve(call.cwd, value)));
}

function targetPaths(call) {
  const input = call.toolInput && typeof call.toolInput === "object" ? call.toolInput : {};
  const direct = [input.file_path, input.filePath, input.path, input.file]
    .filter((value) => typeof value === "string" && value.trim());
  const patch = patchPaths(input.patch || input.command || input.cmd || "");
  const structured = [...new Set([...direct, ...patch])].map((value) =>
    realExistingParent(path.isAbsolute(value) ? value : path.resolve(call.cwd, value)));
  return [...new Set([...structured, ...shellMutationPaths(call)])];
}

function approvedTempRoots(env) {
  // WI-506 observation-only temp roots; this is not runtime-state selection.
  const roots = [env.SVC_JOB_TEMP_ROOT, env.XDG_RUNTIME_DIR, os.tmpdir()]
    .filter(Boolean)
    .flatMap((candidate) => {
      try { return [fs.realpathSync(path.resolve(candidate))]; } catch { return []; }
    });
  return [...new Set(roots)];
}

function allExternalTemp(targets, repoRoots, env) {
  if (!targets.length) return false;
  const tempRoots = approvedTempRoots(env);
  return targets.every((target) =>
    tempRoots.some((root) => inside(target, root)) && !repoRoots.some((root) => inside(target, root)));
}

function validOverride(call, env, now) {
  if (env.SVC_ISOLATION_OVERRIDE !== "1") return false;
  if (!String(env.SVC_ISOLATION_OVERRIDE_REASON || "").trim()) return false;
  const session = String(call.sessionId || "");
  if (!session || session !== String(env.SVC_ISOLATION_OVERRIDE_SESSION || "")) return false;
  const expiry = Date.parse(env.SVC_ISOLATION_OVERRIDE_EXPIRES_AT || "");
  return Number.isFinite(expiry) && expiry > now && expiry - now <= 30 * 60_000;
}

function delegatedDecision({ env, operationGit, targets, now }) {
  const delegationId = String(env.SVC_DELEGATION_ID || "");
  if (!delegationId) return null;
  try {
    const stateRootValue = String(env.SVC_DELEGATION_STATE_ROOT || "");
    const childPrincipal = String(env.SVC_DELEGATION_CHILD_PRINCIPAL || "");
    if (!stateRootValue || !childPrincipal) throw new Error("delegation runtime identity is incomplete");
    const stateRoot = path.resolve(stateRootValue);
    const graphPath = fs.realpathSync(String(env.SVC_EXECUTION_GRAPH || ""));
    const graphStat = fs.lstatSync(graphPath);
    if (!graphStat.isFile() || graphStat.isSymbolicLink()) throw new Error("insecure delegated execution graph");
    const graph = JSON.parse(fs.readFileSync(graphPath, "utf8"));
    const capability = readDelegation({ stateRoot, delegationId });
    const task = graph.tasks?.[capability.task_id];
    const receiptPath = fs.realpathSync(String(env.SVC_DELEGATION_SKILL_RECEIPT || ""));
    const expectedReceipt = fs.realpathSync(capability.skill_receipt_path || "");
    if (receiptPath !== expectedReceipt) throw new Error("delegated skill receipt path mismatch");
    const receiptStat = fs.lstatSync(receiptPath);
    if (!receiptStat.isFile() || receiptStat.isSymbolicLink()) throw new Error("insecure delegated skill receipt");
    const skillReceipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
    const lease = readController({ stateRoot, repoId: capability.repo_id || repositoryId(operationGit.current), wi: capability.wi });
    const relativeTargets = targets.map((target) => {
      const relative = path.relative(operationGit.current, target).replaceAll(path.sep, "/");
      if (!relative || relative.startsWith("../") || relative === "..") throw new Error("delegated target escapes inner worktree");
      return relative;
    });
    const decision = authorizeDelegatedMutation({
      stateRoot, delegationId, childPrincipal, lease, worktreeRoot: operationGit.current,
      targets: relativeTargets, taskState: task?.state, skillReceipt, now,
    });
    if (!decision.ok) throw new Error(decision.reason);
    return { allow: true, capability: decision.capability, task };
  } catch (error) { return { allow: false, reason: `delegated mutation denied: ${error.message}` }; }
}

export function classifyMutation(call, env = process.env, now = Date.now()) {
  const normalized = {
    toolName: String(call?.toolName || ""),
    toolInput: call?.toolInput || {},
    sessionId: String(call?.sessionId || ""),
    cwd: path.resolve(call?.cwd || process.cwd()),
    raw: call?.raw || {},
  };
  const cwdGit = gitContext(normalized.cwd);

  if (isReadOnlyTool(canonicalReadContext(normalized)) || extraReadOnly(normalized)) {
    return { classification: "read-only", allow: true, ...(cwdGit || {}) };
  }

  const scopeHost = resolveAuthorityHost(normalized.raw, env);
  const scope = resolveOperationScope({
    ...normalized.raw,
    host: scopeHost,
    tool_name: canonicalToolName(normalized.toolName),
    tool_input: normalized.toolInput,
    cwd: normalized.cwd,
    session_id: normalized.sessionId,
  }, { host: scopeHost, env });
  if (!scope.ok) {
    const reason = scope.contradictions.map((item) => item.code).join(", ") || "invalid operation scope";
    return { classification: "repo-mutation", allow: false, reason, targets: scope.targets.map((target) => target.canonical), operation_scope: scope };
  }

  const operation = scope.operation_repository;
  const operationGit = operation ? {
    current: operation.worktree_root,
    defaultRoot: operation.default_worktree_root,
    repoRoots: operation.worktree_roots,
  } : null;
  const command = SHELL_TOOLS.has(normalized.toolName) ? extractCommand(normalized.toolInput).trim() : "";
  if (parseBootstrapCommand(command) && operationGit?.current === operationGit?.defaultRoot) {
    return { classification: "bootstrap-isolation", allow: true, operation_scope: scope, ...operationGit };
  }

  const targets = [...new Set([
    ...scope.targets.map((target) => target.canonical),
    ...(scope.shell_boundary?.targets || []),
  ])];
  if (scopeHost === "codex" && operationGit && normalized.sessionId) {
    const lease = readOwnerLease(operationGit.current, normalized.sessionId, env) ||
      readOwnerLease(operationGit.defaultRoot, normalized.sessionId, env);
    if (lease && path.resolve(lease.worktree_root) === operationGit.current) {
      return { classification: "owner-recovery", allow: true, targets, operation_scope: scope, ...operationGit };
    }
  }
  if (scope.framework_maintenance) {
    return { classification: "framework-maintenance", allow: true, targets, operation_scope: scope, ...(operationGit || {}) };
  }
  const repositoryRoots = operation?.worktree_roots || [];
  if (allExternalTemp(targets, repositoryRoots, env)) {
    return { classification: "external-temp-mutation", allow: true, targets, operation_scope: scope, ...(operationGit || cwdGit || {}) };
  }

  const knownWrite = WRITE_TOOLS.has(normalized.toolName) || SHELL_TOOLS.has(normalized.toolName);
  const classification = knownWrite ? "repo-mutation" : "ambiguous-write";
  if (operationGit && operationGit.current === operationGit.defaultRoot) {
    if (validOverride(normalized, env, now)) {
      return { classification, allow: true, override: true, targets, operation_scope: scope, ...operationGit };
    }
    return { classification, allow: false, reason: "repository mutation in or from the default checkout is forbidden", targets, operation_scope: scope, ...operationGit };
  }
  if (!operationGit) {
    return { classification, allow: true, reason: "mutation is outside every repository worktree", targets, operation_scope: scope };
  }

  const delegated = delegatedDecision({ env, operationGit, targets, now });
  if (delegated) {
    return { classification, ...delegated, targets, operation_scope: scope, ...operationGit };
  }

  const resolution = resolveWI({
    ...normalized.raw,
    cwd: operationGit.current,
    session_id: normalized.sessionId,
  }, { ...env, PWD: operationGit.current, SVC_REQUIRE_SESSION_BINDING: "1" });
  const boundWorktree = resolution.binding?.worktree_root || resolution.tuple?.worktree_root || "";
  if (!resolution.authority || !boundWorktree || path.resolve(boundWorktree) !== operationGit.current) {
    return { classification, allow: false, reason: resolution.diagnostics?.reason || "linked worktree lacks an authoritative session/WI binding", targets, operation_scope: scope, ...operationGit };
  }
  return { classification, allow: true, binding: resolution.binding || resolution.tuple, targets, operation_scope: scope, ...operationGit };
}

function appendOverrideReceipt(decision, call, env) {
  const uid = typeof process.getuid === "function" ? process.getuid() : "user";
  const root = resolveRuntimeDirectory({ env, leaf: `svc-isolation-overrides-${uid}` }).path;
  const repoHash = crypto.createHash("sha256").update(decision.defaultRoot).digest("hex").slice(0, 24);
  const receipt = {
    schema_version: 1,
    at: new Date().toISOString(),
    repo_root: decision.defaultRoot,
    session_id: call.sessionId,
    reason: env.SVC_ISOLATION_OVERRIDE_REASON,
    expires_at: env.SVC_ISOLATION_OVERRIDE_EXPIRES_AT,
    classification: decision.classification,
  };
  const receiptPath = path.join(root, repoHash + ".jsonl");
  const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND |
    (fs.constants.O_NOFOLLOW || 0);
  const fd = fs.openSync(receiptPath, flags, 0o600);
  try {
    const fileStat = fs.fstatSync(fd);
    if (!fileStat.isFile() || (fileStat.mode & 0o777) !== 0o600 ||
        (typeof process.getuid === "function" && fileStat.uid !== process.getuid())) {
      throw new Error("unsafe isolation override receipt");
    }
    fs.writeSync(fd, JSON.stringify(receipt) + "\n");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

async function main() {
  const call = readHookPayload();
  if (!call) return;
  const decision = classifyMutation(call);
  if (decision.override) appendOverrideReceipt(decision, call, process.env);
  if (decision.allow) return;
  const branch = String(process.env.SVC_WORKTREE_BRANCH || "framework-WI-N-description");
  const wi = String(process.env.SVC_WORKER_WI || "WI-N");
  emitDecision({
    host: detectHost(),
    event: detectHost() === "gemini" ? "BeforeTool" : "PreToolUse",
    decision: DENY,
    reason: `[svc-worktree-isolation] ${decision.reason}. Run: node scripts/svc-ensure-worktree.mjs --wi ${wi} --branch ${branch} --from origin/main --print-cd`,
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const operation = process.argv.includes("--check-default-commit")
    ? async () => {
        const sessionId = String(process.env.SVC_SESSION_ID || process.env.CODEX_THREAD_ID ||
          process.env.CODEX_SESSION_ID || process.env.CLAUDE_SESSION_ID ||
          process.env.KIMI_SESSION_ID || process.env.GEMINI_SESSION_ID || "");
        const call = {
          toolName: "Bash",
          toolInput: { command: "git commit" },
          sessionId,
          cwd: process.cwd(),
          raw: { cwd: process.cwd(), session_id: sessionId },
        };
        const decision = classifyMutation(call);
        if (decision.override) appendOverrideReceipt(decision, call, process.env);
        if (!decision.allow) {
          throw new Error(decision.reason || "default-checkout commit denied");
        }
      }
    : main;
  operation().catch((error) => {
    process.stderr.write(`[svc-worktree-isolation] ${error.message}\n`);
    process.exit(2);
  });
}
