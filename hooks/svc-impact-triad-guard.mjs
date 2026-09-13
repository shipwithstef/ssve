#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { findSvcDir, resolveWI } from "./lib/resolve-wi.mjs";
import { classifyFromGit } from "../scripts/classify-change-risk.mjs";
import { WI_ID_RE } from "./lib/wi-id.mjs";
import { resolveOperationScope } from "./lib/operation-scope.mjs";
import { isShellTool } from "./lib/shell-tools.mjs";

function hookAllow() { process.stdout.write("{}\n"); }
function hookDeny(reason) {
  process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })}\n`);
}
function fail(reason, cli) {
  const recovery = `${reason}. Recovery: update .svc/impact-triad/WI-N/task-N.json from the exact bound worktree and rerun required coverage/runtime proof; bind high-risk work to the one final review task.`;
  if (cli) { process.stderr.write(`svc impact triad: ${recovery}\n`); process.exit(2); }
  hookDeny(recovery);
  process.exit(0);
}
function readJsonRegular(file) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return null;
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
function readReceiptUnderRoot(file, root) {
  const absolute = path.resolve(file);
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) return null;
      if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return null;
    } catch { return null; }
  }
  return readJsonRegular(absolute);
}
function sessionId(payload, env) {
  return String(payload?.session_id || payload?.sessionId || payload?.thread_id || payload?.threadId || env.CURSOR_CONVERSATION_ID || env.CURSOR_SESSION_ID || env.SVC_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID || env.CLAUDE_SESSION_ID || env.KIMI_SESSION_ID || env.GEMINI_SESSION_ID || "");
}
function hookBoundary(payload) {
  const tool = String(payload.tool_name || payload.toolName || "");
  const input = payload.tool_input || payload.toolInput || {};
  if (/TaskUpdate/i.test(tool)) return String(input.status || "").toLowerCase() === "completed";
  if (isShellTool(tool) || tool === "exec_command") {
    const command = String(input.command || input.cmd || "");
    return /(^|[;&|(\n]\s*)git\b(?:\s+(?!commit(?:\s|$))[^\s;&|()]+)*\s+commit(?:\s|$)/.test(command);
  }
  return false;
}
function nonEmptyStrings(value) { return Array.isArray(value) && value.length > 0 && value.every((x) => typeof x === "string" && x.trim()); }
function validTriadField(value) {
  return value && typeof value.answer === "string" && value.answer.trim() && nonEmptyStrings(value.sources) && nonEmptyStrings(value.evidence);
}
function validateShape(receipt) {
  const required = ["schema_version", "wi", "session_id", "worktree_root", "task_graph", "task_id", "diff_sha256", "risk_tier", "risk_reasons", "breaks_what", "intended_behavior", "product_surface", "coverage_tasks", "independent_review", "runtime_proof", "created_at"];
  const allowed = new Set([...required, "subsumed_by"]);
  const missing = required.filter((key) => !(key in (receipt || {})));
  if (missing.length) return `receipt missing ${missing.join(", ")}`;
  const unknown = Object.keys(receipt || {}).filter((key) => !allowed.has(key));
  if (unknown.length) return `receipt has unknown fields ${unknown.join(", ")}`;
  if (![1, 2].includes(receipt.schema_version) || !WI_ID_RE.test(receipt.wi)) return "receipt schema_version or WI invalid";
  if (typeof receipt.session_id !== "string" || receipt.session_id.length < 8 || receipt.session_id.length > 160) return "receipt session_id invalid";
  if (typeof receipt.worktree_root !== "string" || !receipt.worktree_root || typeof receipt.task_graph !== "string" || !receipt.task_graph) return "receipt paths invalid";
  if (typeof receipt.created_at !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(receipt.created_at) || Number.isNaN(Date.parse(receipt.created_at))) return "receipt created_at invalid";
  if (!/^[0-9a-f]{64}$/.test(receipt.diff_sha256) || !["cosmetic", "logic", "high"].includes(receipt.risk_tier)) return "receipt diff hash or risk tier invalid";
  if (!nonEmptyStrings(receipt.risk_reasons)) return "receipt risk reasons missing";
  if (![receipt.breaks_what, receipt.intended_behavior, receipt.product_surface].every(validTriadField)) return "all three triad fields need answer, sources, and evidence";
  if (!Array.isArray(receipt.coverage_tasks) || receipt.coverage_tasks.length === 0) return "coverage_tasks must contain an explicit completed mapping";
  if (receipt.coverage_tasks.some((task) => !task || task.status !== "completed" || !String(task.owner || "").trim() || !String(task.validation || "").trim())) return "coverage task unresolved or incomplete";
  if (receipt.subsumed_by && (!Array.isArray(receipt.subsumed_by) || receipt.subsumed_by.length === 0 || receipt.subsumed_by.some((x) => !String(x?.phase || "").trim() || !nonEmptyStrings(x.artifacts)))) return "subsumption needs phases with exact artifacts";
  return null;
}
function validateProof(receipt, graph) {
  const review = receipt.independent_review || {};
  const proof = receipt.runtime_proof || {};
  if (receipt.risk_tier === "cosmetic") return proof.status === "pass" && proof.kind === "static" && nonEmptyStrings(proof.artifacts) ? null : "cosmetic risk requires passing static proof";
  if (receipt.risk_tier === "logic") return proof.status === "pass" && proof.kind === "mapped-test" && nonEmptyStrings(proof.artifacts) ? null : "logic risk requires a passing mapped test";
  if (proof.status !== "pass" || proof.kind !== "behavioral" || !nonEmptyStrings(proof.artifacts)) return "high risk requires passing behavioral runtime proof";
  if (review.status === "pass") {
    if (receipt.schema_version !== 1) return "schema v2 high receipt must defer to final review";
    if (!review.executor_family || !review.reviewer_family || review.executor_family === review.reviewer_family || !nonEmptyStrings(review.artifacts)) return "legacy per-task review receipt is malformed";
    return null;
  }
  if (review.status === "deferred-to-final") {
    if (receipt.schema_version !== 2) return "final-review deferral requires schema v2";
    if (!review.executor_family || review.executor_family === "n/a" || review.reviewer_family !== "n/a" || (review.artifacts || []).length !== 0) return "final-review deferral has invalid family/artifact fields";
    if (!/^[0-9a-f]{64}$/.test(review.plan_digest || "")) return "final-review deferral requires plan_digest";
    const finalTasks = (graph.tasks || []).filter((task) => (task.metadata?.skill || task.skill) === "review-exec");
    if (finalTasks.length !== 1 || String(finalTasks[0].id) !== String(review.final_review_task_id)) return "final-review deferral must bind the graph's exactly one review-exec task";
    return null;
  }
  return "high risk requires explicit final-review deferral (legacy different-family PASS remains N-1 compatible)";
}

export function validateImpactReceiptContract(receipt, graph) {
  const errors = [];
  const shape = validateShape(receipt);
  if (shape) errors.push(shape);
  if (!shape) {
    const proof = validateProof(receipt, graph || { tasks: [] });
    if (proof) errors.push(proof);
  }
  return { valid: errors.length === 0, errors };
}
function receiptTask(graph) {
  const active = (graph.tasks || []).filter((task) => task.status === "in_progress");
  if (active.length > 1) return { error: "multiple in-progress tasks make impact ownership ambiguous" };
  if (active.length === 1) return { task: active[0] };
  const completed = (graph.tasks || []).filter((task) => task.status === "completed");
  if (completed.length) return { task: completed.at(-1), closeout: true };
  return { error: "no in-progress or completed task owns the staged mutation" };
}

function artifactExists(artifact, worktree) {
  const candidate = path.isAbsolute(artifact) ? artifact : path.resolve(worktree, artifact);
  try { return fs.statSync(candidate).isFile(); } catch { return false; }
}

export function evaluateImpactTriad({ cwd = process.cwd(), env = process.env, payload = {} } = {}) {
  let operationCwd = cwd;
  if (payload?.tool_input || payload?.toolInput) {
    const host = payload.host || env.SVC_HOST ||
      (env.CLAUDE_PLUGIN_ROOT || env.CLAUDE_CODE_REMOTE || env.CLAUDE_PROJECT_DIR ? "claude" : "codex");
    const scope = resolveOperationScope({
      ...payload, host,
      tool_name: payload.tool_name || payload.toolName, tool_input: payload.tool_input || payload.toolInput,
      cwd,
    }, { host, env });
    if (scope.ok) operationCwd = scope.operation_repository?.worktree_root || scope.operation_cwd || cwd;
  }
  const root = fs.realpathSync(operationCwd);
  let worktree = root;
  try { worktree = fs.realpathSync(execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: operationCwd, encoding: "utf8" }).trim()); }
  catch {}
  const svcDir = findSvcDir(worktree);
  if (!svcDir || path.resolve(svcDir) !== path.join(worktree, ".svc")) return { ok: true, n_a: "outside svc governance" };
  let hasStagedChanges = true;
  try { execFileSync("git", ["diff", "--cached", "--quiet", "--exit-code"], { cwd: worktree, stdio: "ignore" }); hasStagedChanges = false; }
  catch (error) { if (error.status !== 1) throw error; }
  if (!hasStagedChanges) return { ok: true, n_a: "no staged mutation" };
  // The canonical framework main checkout has a permanent, narrow maintenance
  // lane so its own enforcement repair can be committed without a product WI
  // receipt. Clones, child worktrees, and product repositories still take the
  // exact-binding path below.
  const maintenanceScope = resolveOperationScope({
    host: "codex", tool_name: "Bash", cwd: worktree,
    tool_input: { command: "git status --short" },
  }, { host: "codex", env });
  if (maintenanceScope.framework_maintenance) return { ok: true, maintenance: true, n_a: "framework maintenance" };
  const sid = sessionId(payload, env);
  const resolved = resolveWI({ ...payload, cwd: worktree, session_id: sid }, env);
  if (!resolved.authority || (!resolved.binding && !resolved.tuple)) return { ok: false, reason: `exact WI-484 binding required (${resolved.diagnostics?.reason || "unresolved"})` };
  const graphPath = path.join(worktree, ".svc", `lane-tasks-${resolved.wi}.json`);
  const graph = readJsonRegular(graphPath);
  if (!graph) return { ok: false, reason: "owned task graph missing or insecure" };
  const selection = receiptTask(graph);
  if (selection.error) return { ok: false, reason: selection.error };
  const task = selection.task;
  const classification = classifyFromGit({ cwd: worktree, staged: true });
  const receiptPath = path.join(worktree, ".svc", "impact-triad", resolved.wi, `task-${task.id}.json`);
  const receipt = readReceiptUnderRoot(receiptPath, worktree);
  if (!receipt) return { ok: false, reason: `missing or insecure receipt ${receiptPath}` };
  const receiptContract = validateImpactReceiptContract(receipt, graph);
  if (!receiptContract.valid) return { ok: false, reason: receiptContract.errors[0] };
  const checks = [
    [receipt.wi === resolved.wi, "WI"],
    [receipt.session_id === sid, "session"],
    [path.resolve(receipt.worktree_root) === worktree, "worktree"],
    [path.resolve(receipt.task_graph) === path.resolve(graphPath), "task graph"],
    [Number(receipt.task_id) === Number(task.id), "task id"],
    [receipt.diff_sha256 === classification.sha256, "diff hash"],
    [receipt.risk_tier === classification.tier, "risk tier"],
    [JSON.stringify([...receipt.risk_reasons].sort()) === JSON.stringify([...classification.reasons].sort()), "risk reasons"],
  ];
  const mismatch = checks.find(([ok]) => !ok);
  if (mismatch) return { ok: false, reason: `foreign or stale receipt: ${mismatch[1]} mismatch` };
  const artifacts = [...(receipt.runtime_proof?.artifacts || []), ...(receipt.risk_tier === "high" ? receipt.independent_review?.artifacts || [] : [])];
  const missingArtifact = artifacts.find((artifact) => !artifactExists(artifact, worktree));
  if (missingArtifact) return { ok: false, reason: `proof artifact does not exist: ${missingArtifact}` };
  return { ok: true, wi: resolved.wi, task_id: task.id, receipt_path: receiptPath, classification };
}

function main() {
  const cli = process.argv.includes("--staged") || process.argv.includes("--pre-commit");
  let payload = {};
  if (!cli) {
    try { payload = JSON.parse(fs.readFileSync(0, "utf8") || "{}"); } catch {}
    if (!hookBoundary(payload)) { hookAllow(); return; }
  }
  let result;
  try { result = evaluateImpactTriad({ cwd: process.cwd(), env: process.env, payload }); }
  catch (error) { fail(error.message, cli); return; }
  if (!result.ok) fail(result.reason, cli);
  if (cli) process.stdout.write(`${JSON.stringify(result)}\n`); else hookAllow();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
