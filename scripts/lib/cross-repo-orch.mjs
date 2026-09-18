#!/usr/bin/env node
/**
 * WI-FW-CROSS-REPO-ORCH-01 — Cursor origin orchestrates a named WI/worktree.
 *
 * Same-owner session migrate + Grok PLAN/EXEC + Fable REVIEW dispatch.
 * No paste. No agy-only escape. Foreign/ambiguous owners stay fail-closed.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WI_ID_RE } from "../../hooks/lib/wi-id.mjs";
import { sessionShaped } from "../../hooks/lib/claim-owner.mjs";
import { parseOrchestrateCommand } from "../../hooks/lib/orchestrate-command.mjs";
import { appendJsonlLine } from "../state-io.mjs";

export { parseOrchestrateCommand };

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ROLES = new Set(["PLAN", "EXEC", "REVIEW"]);
const ORIGIN_HOSTS = new Set(["cursor", "grok", "codex", "claude", "kimi", "gemini", "opencode"]);

function fail(message, code = "orch_invalid") {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function git(args, cwd) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function realExisting(candidate) {
  const resolved = path.resolve(candidate);
  if (resolved.includes("\0")) fail("path contains NUL", "orch_path_invalid");
  return fs.realpathSync(resolved);
}

export function readGrokLaunchCommand(repoRoot = ROOT) {
  const file = path.join(repoRoot, "provision", "hosts", "grok.json");
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  return manifest?.authority_capabilities?.fresh_session_launch?.launch_command ?? null;
}

export function readOriginOrchestrator(repoRoot = ROOT, host = "cursor") {
  const file = path.join(repoRoot, "provision", "hosts", `${host}.json`);
  if (!fs.existsSync(file)) return null;
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  return manifest?.authority_capabilities?.origin_orchestrator || null;
}

export function resolveNamedWork(options = {}) {
  const wi = String(options.wi || "").trim();
  if (!WI_ID_RE.test(wi)) fail(`invalid WI id: ${wi}`, "orch_wi_invalid");
  let worktree = options.worktree ? realExisting(options.worktree) : null;
  if (!worktree && options.repo_root && options.branch) {
    const repoRoot = realExisting(options.repo_root);
    const candidate = path.join(os.homedir(), "worktrees", path.basename(repoRoot), options.branch);
    if (fs.existsSync(candidate)) worktree = realExisting(candidate);
    else worktree = repoRoot;
  }
  if (!worktree) fail("migrate requires --worktree or --repo-root plus --branch", "orch_target_missing");
  const repoRoot = realExisting(git(["rev-parse", "--show-toplevel"], worktree));
  let branch = String(options.branch || "").trim();
  if (!branch) {
    try { branch = git(["branch", "--show-current"], worktree); } catch { branch = ""; }
  }
  if (!branch) fail("target worktree has no named branch", "orch_branch_missing");
  const gitDir = path.join(worktree, ".git");
  let gitStat = null;
  try { gitStat = fs.lstatSync(gitDir); } catch {}
  if (gitStat?.isDirectory()) {
    fail("migrate/dispatch refuse a repository default checkout; use a linked worktree", "orch_default_checkout");
  }
  return { wi, worktree, repo_root: repoRoot, branch, default_checkout: false };
}

function sessionIdFrom(env = process.env, explicit) {
  const fromEnv = String(env.CURSOR_CONVERSATION_ID || env.CURSOR_SESSION_ID
    || env.GROK_SESSION_ID || env.SVC_SESSION_ID || env.CODEX_THREAD_ID
    || env.CODEX_SESSION_ID || env.CLAUDE_SESSION_ID || "");
  const fromFlag = String(explicit || "");
  if (fromFlag && fromEnv && sessionShaped(fromEnv) && fromFlag !== fromEnv) {
    fail("session-id flag does not match host session identity", "orch_foreign");
  }
  const sid = sessionShaped(fromEnv) ? fromEnv : fromFlag;
  return sessionShaped(sid) ? sid : "";
}

function bindingFile(worktree, sessionId) {
  return path.join(worktree, ".svc", "bindings", `${sessionId}.json`);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function atomicWriteJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temp, file);
}

function retireSameSessionBinding(originWorktree, sessionId, targetWorktree) {
  if (!originWorktree || !sessionId) return { retired: false };
  let originReal;
  try { originReal = realExisting(originWorktree); } catch { return { retired: false }; }
  if (originReal === targetWorktree) return { retired: false, already_target: true };
  const file = bindingFile(originReal, sessionId);
  const existing = readJson(file);
  if (!existing || existing.released_at) return { retired: false };
  if (String(existing.session_id) !== sessionId) {
    fail("origin binding session mismatch; foreign state is immutable", "orch_foreign");
  }
  const now = new Date().toISOString();
  atomicWriteJson(file, {
    ...existing,
    released_at: now,
    updated_at: now,
    transfer_to_worktree: targetWorktree,
    transfer_reason: "same-owner-origin-migrate",
  });
  return { retired: true, from: originReal, path: file };
}

function writeTargetBinding({ worktree, repoRoot, wi, branch, sessionId, originHost }) {
  const now = new Date().toISOString();
  const file = bindingFile(worktree, sessionId);
  atomicWriteJson(file, {
    schema_version: 1,
    session_id: sessionId,
    role: "mutating",
    wi,
    branch,
    worktree_root: worktree,
    repo_root: repoRoot,
    host: originHost,
    generation: 1,
    created_at: now,
    updated_at: now,
    origin_migrated: true,
  });
  return file;
}

function appendSessionContract(worktree, { wi, sessionId, originHost, request }) {
  const file = path.join(worktree, ".svc", "session-contract.jsonl");
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  appendJsonlLine(file, {
    ts: new Date().toISOString(),
    bound_to: "framework-evolution",
    request: request || `orchestrate ${wi}`,
    wi,
    skill: "route-workflow",
    guard_override_count: 0,
    execution_mode: "end_to_end",
    origin_host: originHost,
    session_id: sessionId,
    migrated: true,
  });
  return file;
}

export function migrateSession(options = {}, env = process.env) {
  const originHost = String(options.origin_host || env.SVC_HOST || "cursor");
  if (!ORIGIN_HOSTS.has(originHost)) fail(`unsupported origin host: ${originHost}`, "orch_host_invalid");
  const sessionId = sessionIdFrom(env, options.session_id);
  if (!sessionId) fail("same-owner migrate requires a session-shaped id", "orch_session_missing");
  const target = resolveNamedWork(options);
  const originCwd = options.origin_cwd ? path.resolve(options.origin_cwd) : path.resolve(env.PWD || process.cwd());
  fs.mkdirSync(path.join(target.worktree, ".svc"), { recursive: true, mode: 0o700 });
  const retired = retireSameSessionBinding(originCwd, sessionId, target.worktree);
  const bindingPath = writeTargetBinding({
    worktree: target.worktree,
    repoRoot: target.repo_root,
    wi: target.wi,
    branch: target.branch,
    sessionId,
    originHost,
  });
  const contractPath = appendSessionContract(target.worktree, {
    wi: target.wi,
    sessionId,
    originHost,
    request: options.request,
  });
  const baton = {
    schema_version: 1,
    wi: target.wi,
    branch: target.branch,
    absolute_worktree: target.worktree,
    repo_root: target.repo_root,
    session_id: sessionId,
    origin_host: originHost,
    binding_path: bindingPath,
    contract_path: contractPath,
    retired_origin_binding: Boolean(retired.retired),
    paste_required: false,
    agy_required: false,
    next: "dispatch",
  };
  const receipt = path.join(target.worktree, ".svc", "orchestration", `${target.wi}.migrate.json`);
  atomicWriteJson(receipt, { ...baton, recorded_at: new Date().toISOString() });
  baton.receipt_path = receipt;
  return baton;
}

function handoffPrompt({ wi, role, worktree }) {
  if (role === "PLAN") {
    return `Assemble and write the plan for ${wi} in ${worktree}. Do not ask the user to paste. After the plan exists, stop for Fable review.`;
  }
  if (role === "EXEC") {
    return `Execute the reviewed plan for ${wi} in ${worktree}. Do not paste. Stay inside this worktree.`;
  }
  return `Review ${wi} in ${worktree}.`;
}

export function dispatchRole(options = {}, env = process.env) {
  const role = String(options.role || "").toUpperCase();
  if (!ROLES.has(role)) fail(`dispatch role must be PLAN, EXEC, or REVIEW`, "orch_role_invalid");
  const target = resolveNamedWork(options);
  const origin = readOriginOrchestrator(options.manifest_root || ROOT, options.origin_host || "cursor") || {
    enabled: true, paste_required: false, agy_required: false, plan_host: "grok", exec_host: "grok", review_host: "cursor",
  };
  if (origin.agy_required === true) fail("origin orchestrator must not require agy", "orch_agy_escape");
  if (origin.paste_required === true) fail("origin orchestrator must not require paste", "orch_paste");
  const promptDir = path.join(target.worktree, ".svc", "handoffs");
  fs.mkdirSync(promptDir, { recursive: true, mode: 0o700 });
  const promptFile = options.prompt_file
    ? path.resolve(options.prompt_file)
    : path.join(promptDir, `${target.wi}-${role.toLowerCase()}.md`);
  if (!options.prompt_file) {
    fs.writeFileSync(promptFile, `${handoffPrompt({ wi: target.wi, role, worktree: target.worktree })}\n`, { mode: 0o600 });
  }
  let argv;
  let host;
  if (role === "REVIEW") {
    host = origin.review_host || "cursor";
    const reviewKind = options.review_kind || "plan";
    const policy = env.SVC_REVIEWER_POLICY || path.join(os.homedir(), ".svc", "reviewer-policy-v2.json");
    const station = reviewKind === "exec" ? "cursor-fable-exec" : "cursor-fable-plan";
    argv = [
      process.execPath,
      path.join(options.manifest_root || ROOT, "scripts", "run-external-review.mjs"),
      "--orchestrator", options.origin_host || "cursor",
      "--review-kind", reviewKind,
      "--artifacts-dir", path.join(target.worktree, ".svc", "external-review-artifacts", target.wi),
      "--context-root", target.worktree,
      "--reviewer-config", policy,
      "--reviewer-phase", reviewKind,
      "--reviewer-station", station,
    ];
  } else {
    host = role === "PLAN" ? (origin.plan_host || "grok") : (origin.exec_host || "grok");
    if (host === "agy") fail("PLAN/EXEC must not escape to agy", "orch_agy_escape");
    if (!fs.existsSync(promptFile)) fail("dispatch refuses spawn without a prompt file", "orch_prompt_missing");
    argv = [
      "grok",
      "--cwd", target.worktree,
      "--permission-mode", "auto",
      "--output-format", "json",
      "--max-turns", env.SVC_GROK_MAX_TURNS || "80",
      "--prompt-file", promptFile,
    ];
  }
  const result = {
    schema_version: 1,
    role,
    host,
    wi: target.wi,
    worktree: target.worktree,
    argv,
    prompt_file: promptFile,
    paste_required: false,
    agy_required: false,
    dry_run: Boolean(options.dry_run),
  };
  if (!options.dry_run && role !== "REVIEW" && options.spawn === true) {
    const child = spawn(argv[0], argv.slice(1), {
      detached: true,
      stdio: "ignore",
      cwd: target.worktree,
      env: { ...env, SVC_WI: target.wi, SVC_LAUNCH_CWD: target.worktree, SVC_PROMPT_FILE: promptFile },
    });
    child.unref();
    result.pid = child.pid || null;
  }
  const receipt = path.join(target.worktree, ".svc", "orchestration", `${target.wi}.${role.toLowerCase()}.json`);
  atomicWriteJson(receipt, { ...result, recorded_at: new Date().toISOString() });
  result.receipt_path = receipt;
  return result;
}

export function assertLaunchCommandLive(repoRoot = ROOT) {
  const command = readGrokLaunchCommand(repoRoot);
  if (!command || typeof command !== "string") fail("grok launch_command is null", "orch_launch_null");
  if (!/\bgrok\b/.test(command)) fail("grok launch_command does not invoke grok", "orch_launch_invalid");
  if (!command.includes("--cwd") || !command.includes("--prompt-file")) {
    fail("grok launch_command must use --cwd and --prompt-file", "orch_launch_invalid");
  }
  return command;
}

export function replayIncident(fixture, repoRoot = ROOT) {
  const required = fixture?.required_after || [];
  const launch = readGrokLaunchCommand(repoRoot);
  const origin = readOriginOrchestrator(repoRoot, fixture?.origin_host || "cursor");
  const failures = [];
  if (!launch) failures.push("grok fresh_session_launch.launch_command is null");
  if (origin?.paste_required) failures.push("paste is still required");
  if (origin?.agy_required) failures.push("agy is still required");
  if (origin && origin.enabled !== true) failures.push("cursor origin_orchestrator is disabled");
  if (required.includes("grok launch_command is a real argv/template") && !launch) {
    failures.push("AC-2 missing");
  }
  return { ok: failures.length === 0, failures, launch_command: launch, origin };
}
