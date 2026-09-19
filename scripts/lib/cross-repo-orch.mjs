#!/usr/bin/env node
/**
 * WI-FW-CROSS-REPO-ORCH-01 — Cursor origin orchestrates a named WI/worktree.
 *
 * Same-owner session migrate + Grok PLAN/EXEC + owner-policy REVIEW dispatch.
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
export const ORIGIN_HOSTS = new Set(["cursor", "grok", "codex", "claude", "kimi", "gemini", "opencode"]);

export function resolveOriginHost(host) {
  const originHost = String(host || "").toLowerCase();
  if (!ORIGIN_HOSTS.has(originHost)) fail(`unsupported origin host: ${originHost || "(empty)"}`, "orch_host_invalid");
  return originHost;
}

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

function sleepMs(ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { /* spin for exclusive migrate lock */ }
}

function withMigrateLock(worktree, sessionId, fn) {
  const lockDir = path.join(worktree, ".svc", "orchestration", `.lock-${sessionId}`);
  fs.mkdirSync(path.dirname(lockDir), { recursive: true, mode: 0o700 });
  for (let i = 0; i < 80; i += 1) {
    try {
      fs.mkdirSync(lockDir);
      try {
        return fn();
      } finally {
        try { fs.rmdirSync(lockDir); } catch { /* ignore */ }
      }
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      sleepMs(15);
    }
  }
  return fn();
}

export function migrateSession(options = {}, env = process.env) {
  const originHost = resolveOriginHost(options.origin_host || env.SVC_HOST || "cursor");
  const sessionId = sessionIdFrom(env, options.session_id);
  if (!sessionId) fail("same-owner migrate requires a session-shaped id", "orch_session_missing");
  const target = resolveNamedWork(options);
  const originCwd = options.origin_cwd ? path.resolve(options.origin_cwd) : path.resolve(env.PWD || process.cwd());
  fs.mkdirSync(path.join(target.worktree, ".svc"), { recursive: true, mode: 0o700 });
  return withMigrateLock(target.worktree, sessionId, () => {
    const existing = readJson(bindingFile(target.worktree, sessionId));
    const sameTuple = existing
      && existing.session_id === sessionId
      && existing.wi === target.wi
      && !existing.released_at;
    const receipt = path.join(target.worktree, ".svc", "orchestration", `${target.wi}.migrate.json`);
    if (sameTuple) {
      const baton = {
        schema_version: 1,
        wi: target.wi,
        branch: target.branch,
        absolute_worktree: target.worktree,
        repo_root: target.repo_root,
        session_id: sessionId,
        origin_host: originHost,
        binding_path: bindingFile(target.worktree, sessionId),
        contract_path: path.join(target.worktree, ".svc", "session-contract.jsonl"),
        retired_origin_binding: false,
        paste_required: false,
        agy_required: false,
        next: "dispatch",
        skipped_contract_append: true,
      };
      if (!fs.existsSync(receipt)) atomicWriteJson(receipt, { ...baton, recorded_at: new Date().toISOString() });
      baton.receipt_path = receipt;
      return baton;
    }
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
      skipped_contract_append: false,
    };
    atomicWriteJson(receipt, { ...baton, recorded_at: new Date().toISOString() });
    baton.receipt_path = receipt;
    return baton;
  });
}

function handoffPrompt({ wi, role, worktree }) {
  if (role === "PLAN") {
    return `Assemble and write the plan for ${wi} in ${worktree}. Do not ask the user to paste. After the plan exists, stop for independent review.`;
  }
  if (role === "EXEC") {
    return `Execute the reviewed plan for ${wi} in ${worktree}. Do not paste. Stay inside this worktree.`;
  }
  return `Review ${wi} in ${worktree}.`;
}

function policyHome(env = process.env) {
  return env.HOME || os.homedir();
}

export function ownerReviewPolicyPaths(env = process.env) {
  const home = policyHome(env);
  const reviewerDefault = path.join(home, ".svc", "reviewer-policy-v2.json");
  const dispatchDefault = path.join(home, ".svc", "dispatch-policy.json");
  const reviewer = env.SVC_REVIEWER_POLICY
    ? path.resolve(env.SVC_REVIEWER_POLICY)
    : (fs.existsSync(reviewerDefault) ? reviewerDefault : null);
  const dispatch = env.SVC_DISPATCH_POLICY
    ? path.resolve(env.SVC_DISPATCH_POLICY)
    : (fs.existsSync(dispatchDefault) ? dispatchDefault : null);
  return { reviewer, dispatch, reviewerDefault, dispatchDefault };
}

export function ownerReviewPolicyPath(env = process.env) {
  const paths = ownerReviewPolicyPaths(env);
  const chosen = paths.reviewer || paths.dispatch;
  if (chosen) return chosen;
  fail(
    `REVIEW dispatch requires owner policy at ${paths.reviewerDefault} or ${paths.dispatchDefault} (or SVC_DISPATCH_POLICY / SVC_REVIEWER_POLICY). Missing policy is fail-closed; there is no default station.`,
    "orch_review_policy_missing",
  );
}

function readOwnerReviewPolicy(policyPath) {
  let info;
  try {
    info = fs.lstatSync(policyPath);
  } catch (error) {
    fail(
      `REVIEW dispatch cannot read owner policy ${policyPath}: ${error.code || error.message}`,
      "orch_review_policy_missing",
    );
  }
  if (info.isSymbolicLink() || !info.isFile()) {
    fail(`REVIEW dispatch owner policy must be a regular file: ${policyPath}`, "orch_review_policy_invalid");
  }
  let policy;
  try {
    policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  } catch {
    fail(`REVIEW dispatch owner policy is not valid JSON: ${policyPath}`, "orch_review_policy_invalid");
  }
  if (!policy || typeof policy !== "object") {
    fail(`REVIEW dispatch owner policy is not an object: ${policyPath}`, "orch_review_policy_invalid");
  }
  return policy;
}

function extractPhaseStations(policy, { phase, orchestrator }) {
  const version = Number(policy.schema_version);
  if (version !== 1 && version !== 2) {
    fail(
      `REVIEW dispatch owner policy schema_version must be 1 or 2, got ${policy.schema_version ?? "<missing>"}`,
      "orch_review_policy_invalid",
    );
  }
  const modeName = policy.default_mode;
  const mode = policy.modes?.[modeName];
  if (!mode || typeof mode !== "object") return null;
  const reviewLabelDeclared = Boolean(mode.labels && Object.prototype.hasOwnProperty.call(mode.labels, "REVIEW"));
  const reviewLabel = reviewLabelDeclared ? mode.labels.REVIEW : null;
  if (version === 1) {
    const stations = mode.review?.[phase]?.stations;
    if (!Array.isArray(stations) || stations.length === 0) {
      return { stations: [], orchestrator, reviewLabel, reviewLabelDeclared, format: "dispatch-v1" };
    }
    return { stations, orchestrator, reviewLabel, reviewLabelDeclared, format: "dispatch-v1" };
  }
  const orchestrators = mode.orchestrators && typeof mode.orchestrators === "object" ? mode.orchestrators : {};
  const selected = orchestrator && orchestrators[orchestrator]?.[phase]?.stations;
  if (Array.isArray(selected) && selected.length > 0) {
    return { stations: selected, orchestrator, reviewLabel, reviewLabelDeclared, format: "legacy-v2" };
  }
  return { stations: [], orchestrator, reviewLabel, reviewLabelDeclared, format: "legacy-v2" };
}

function completeReviewLabel(label) {
  if (!label || typeof label !== "object") return null;
  const keys = ["host", "family", "model", "effort"];
  const complete = {};
  for (const key of keys) {
    if (typeof label[key] !== "string" || !label[key].trim()) return null;
    complete[key] = label[key];
  }
  return complete;
}

function tupleMatchesReviewLabel(tuple, label) {
  const complete = completeReviewLabel(label);
  if (!complete) return false;
  return ["host", "family", "model", "effort"].every((key) => tuple?.[key] === complete[key]);
}

function requiredExternalCandidates(policyPath, { phase, orchestrator }) {
  const policy = readOwnerReviewPolicy(policyPath);
  const extracted = extractPhaseStations(policy, { phase, orchestrator });
  if (!extracted) return { reviewLabel: null, reviewLabelDeclared: false, candidates: [] };
  const required = extracted.stations.filter((station) =>
    station
    && station.kind === "external"
    && station.required === true
    && typeof station.id === "string"
    && station.id.trim(),
  );
  return {
    reviewLabel: extracted.reviewLabel,
    reviewLabelDeclared: extracted.reviewLabelDeclared,
    candidates: required.map((station) => ({
      station,
      policy_path: policyPath,
      orchestrator: extracted.orchestrator,
      format: extracted.format,
    })),
  };
}

export function resolveOwnerReviewStation({
  reviewKind = "plan",
  planHost,
  execHost,
  env = process.env,
  configPath = null,
} = {}) {
  const phase = String(reviewKind || "plan").toLowerCase();
  if (phase !== "plan" && phase !== "exec") {
    fail(`REVIEW dispatch review_kind must be plan or exec, got ${reviewKind}`, "orch_review_kind_invalid");
  }
  const orchestrator = String((phase === "exec" ? execHost : planHost) || "grok").toLowerCase();
  const files = [];
  if (configPath) {
    files.push(path.resolve(configPath));
  } else {
    const paths = ownerReviewPolicyPaths(env);
    if (paths.reviewer) files.push(paths.reviewer);
    if (paths.dispatch) files.push(paths.dispatch);
    if (!files.length) {
      fail(
        `REVIEW dispatch requires owner policy at ${paths.reviewerDefault} or ${paths.dispatchDefault} (or SVC_DISPATCH_POLICY / SVC_REVIEWER_POLICY). Missing policy is fail-closed; there is no default station.`,
        "orch_review_policy_missing",
      );
    }
  }
  let reviewLabel = null;
  let reviewLabelDeclared = false;
  const candidates = [];
  for (const file of [...new Set(files)]) {
    const extracted = requiredExternalCandidates(file, { phase, orchestrator });
    if (extracted.reviewLabelDeclared) {
      const complete = completeReviewLabel(extracted.reviewLabel);
      if (!complete) {
        fail(
          `REVIEW dispatch owner policy ${file} labels.REVIEW must declare host, family, model, and effort`,
          "orch_review_policy_invalid",
        );
      }
      reviewLabelDeclared = true;
      reviewLabel = complete;
    }
    candidates.push(...extracted.candidates);
  }
  if (!candidates.length) {
    fail(`REVIEW dispatch owner policy has no required external ${phase} station`, "orch_review_station_missing");
  }
  let pool = candidates;
  if (reviewLabelDeclared) {
    const complete = completeReviewLabel(reviewLabel);
    if (!complete) {
      fail(
        "REVIEW dispatch owner policy labels.REVIEW must declare host, family, model, and effort",
        "orch_review_policy_invalid",
      );
    }
    const matched = candidates.filter((row) => tupleMatchesReviewLabel(row.station.tuple, complete));
    if (!matched.length) {
      fail(
        `REVIEW dispatch owner policy labels.REVIEW ${complete.host}/${complete.model} matches no required external ${phase} station`,
        "orch_review_station_missing",
      );
    }
    pool = matched;
  }
  const independent = pool.filter((row) => row.station.authority === "independent");
  if (independent.length) pool = independent;
  const chosen = phase === "exec" ? pool[pool.length - 1] : pool[0];
  const stationId = String(chosen?.station?.id || "").trim();
  if (!stationId) {
    fail(`REVIEW dispatch owner policy ${phase} station id is missing`, "orch_review_station_missing");
  }
  return {
    policy_path: chosen.policy_path,
    phase,
    orchestrator: chosen.orchestrator,
    station_id: stationId,
    format: chosen.format,
  };
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
  let reviewStation = null;
  if (role === "REVIEW") {
    host = origin.review_host || "cursor";
    const reviewKind = options.review_kind || "plan";
    reviewStation = resolveOwnerReviewStation({
      reviewKind,
      planHost: origin.plan_host,
      execHost: origin.exec_host,
      env,
      configPath: options.reviewer_config || null,
    });
    argv = [
      process.execPath,
      path.join(options.manifest_root || ROOT, "scripts", "run-external-review.mjs"),
      "--orchestrator", reviewStation.orchestrator,
      "--review-kind", reviewKind,
      "--artifacts-dir", path.join(target.worktree, ".svc", "external-review-artifacts", target.wi),
      "--context-root", target.worktree,
      "--reviewer-config", reviewStation.policy_path,
      "--reviewer-phase", reviewKind,
      "--reviewer-station", reviewStation.station_id,
    ];
  } else {
    host = role === "PLAN" ? (origin.plan_host || "grok") : (origin.exec_host || "grok");
    if (host === "agy") fail("PLAN/EXEC must not escape to agy", "orch_agy_escape");
    if (!fs.existsSync(promptFile)) fail("dispatch refuses spawn without a prompt file", "orch_prompt_missing");
    argv = [
      "grok",
      "--cwd", target.worktree,
      "--model", "grok-4.6",
      "--effort", role === "PLAN" ? "xhigh" : "high",
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
    effort: role === "PLAN" ? "xhigh" : role === "EXEC" ? "high" : null,
    svc_grok_effort: role === "PLAN" ? "xhigh" : role === "EXEC" ? "high" : null,
    reviewer_station: reviewStation?.station_id || null,
    reviewer_policy_path: reviewStation?.policy_path || null,
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
