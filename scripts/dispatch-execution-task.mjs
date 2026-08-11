#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  acceptDelegation, issueDelegation, readDelegation, updateDelegationStatus,
} from "../hooks/lib/delegation-authority.mjs";

function parse(argv) {
  const command = argv.shift(); const flags = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]; if (!key.startsWith("--")) throw new Error(`unexpected argument: ${key}`);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith("--")) { flags[key] = next; index += 1; }
    else flags[key] = true;
  }
  return { command, flags };
}
function required(flags, name) { if (!flags[name] || flags[name] === true) throw new Error(`missing ${name}`); return String(flags[name]); }
function load(file) { return JSON.parse(fs.readFileSync(path.resolve(file), "utf8")); }
function save(file, value) { const out = path.resolve(file); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, `${JSON.stringify(value, null, 2)}\n`); }
function git(repo, args) { return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
function gitBuffer(repo, args) { return execFileSync("git", ["-C", repo, ...args], { stdio: ["ignore", "pipe", "pipe"] }); }
function digest(value) { return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`; }

function withGraphLock(graphPath, operation) {
  const lock = `${path.resolve(graphPath)}.dispatch.lock`;
  let fd;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try { fd = fs.openSync(lock, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600); fs.writeFileSync(fd, `${process.pid}\n`); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (attempt === 499) throw new Error("execution graph dispatch lock timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return operation(); }
  finally { if (fd !== undefined) fs.closeSync(fd); try { fs.unlinkSync(lock); } catch {} }
}

function updateGraph(graphPath, taskId, mutation) {
  const graph = load(graphPath); const task = graph.tasks?.[taskId];
  if (!task) throw new Error(`execution task not found: ${taskId}`);
  mutation(task, graph); save(graphPath, graph); return graph;
}

export function run(argv = process.argv.slice(2)) {
  const { command, flags } = parse([...argv]);
  const stateRoot = path.resolve(required(flags, "--state-root"));
  if (command === "issue") {
    const repo = fs.realpathSync(path.resolve(required(flags, "--repo")));
    const graphPath = path.resolve(required(flags, "--graph"));
    const taskId = required(flags, "--task");
    const result = withGraphLock(graphPath, () => {
      const graph = load(graphPath); const task = graph.tasks?.[taskId];
      if (!task || task.state !== "pending") throw new Error("task is not pending");
      const lease = load(required(flags, "--lease"));
      const innerRoot = path.resolve(String(flags["--inner-root"] || path.join(repo, ".worktrees", ".svc-inner", graph.wi)));
      fs.mkdirSync(innerRoot, { recursive: true });
      const suffix = crypto.randomUUID().slice(0, 8); const branch = `svc-${graph.wi.toLowerCase()}-${taskId}-${suffix}`;
      const inner = path.join(innerRoot, `${taskId}-${suffix}`);
      const parentDelegation = flags["--parent-delegation"]
        ? readDelegation({ stateRoot, delegationId: String(flags["--parent-delegation"]) }) : null;
      const issued = issueDelegation({
        stateRoot, lease, childPrincipal: required(flags, "--child-principal"), taskId, skill: task.skill,
        waveId: task.wave_id, innerWorktree: inner, allowedPaths: task.paths,
        validationCommands: task.validation_commands || [],
        deniedPaths: [".svc/**", ".git/**", ...(flags["--denied-paths"] ? String(flags["--denied-paths"]).split(",") : [])],
        baseSha: graph.base_sha, maxDepth: Number(flags["--max-depth"] || 0), parentDelegation,
      });
      try {
        execFileSync("git", ["clone", "--quiet", "--no-hardlinks", "--no-checkout", repo, inner], { stdio: ["ignore", "pipe", "pipe"] });
        git(inner, ["checkout", "-qb", branch, graph.base_sha]);
      }
      catch (error) { updateDelegationStatus({ stateRoot, delegationId: issued.capability.delegation_id, status: "failed", reason: "inner worktree creation failed" }); throw error; }
      updateGraph(graphPath, taskId, (entry) => {
        if (entry.state !== "pending") throw new Error("task is not pending");
        entry.state = "delegated"; entry.delegation_id = issued.capability.delegation_id;
        entry.inner_worktree = inner; entry.child_principal = issued.capability.child_principal;
      });
      return { ...issued, branch, inner_worktree: inner, graph_path: graphPath };
    });
    if (flags["--out"]) save(flags["--out"], result);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); return;
  }
  const delegationId = required(flags, "--delegation");
  if (command === "accept") {
    const accepted = acceptDelegation({ stateRoot, delegationId, childPrincipal: required(flags, "--child-principal"), token: required(flags, "--token") });
    if (flags["--graph"]) updateGraph(flags["--graph"], accepted.task_id, (task) => { task.state = "running"; });
    process.stdout.write(`${JSON.stringify(accepted, null, 2)}\n`); return;
  }
  if (command === "complete") {
    const outputPath = path.resolve(required(flags, "--out"));
    const capability = readDelegation({ stateRoot, delegationId });
    if (!["accepted", "running"].includes(capability.status)) throw new Error("delegation is not running");
    if (capability.child_principal !== required(flags, "--child-principal")) throw new Error("delegation child principal mismatch");
    const inner = fs.realpathSync(capability.inner_worktree);
    const head = git(inner, ["rev-parse", "HEAD"]);
    const commits = git(inner, ["rev-list", "--reverse", `${capability.base_sha}..${head}`]).split(/\r?\n/).filter(Boolean);
    if (!commits.length) throw new Error("delegated completion requires at least one commit");
    const filesWritten = git(inner, ["diff", "--name-only", `${capability.base_sha}..${head}`]).split(/\r?\n/).filter(Boolean).sort();
    const validation = flags["--validation"] ? load(flags["--validation"]) : [];
    if (!Array.isArray(validation) || validation.length === 0 || validation.some((entry) => Number(entry.exit_code) !== 0 || !entry.output_digest)) throw new Error("delegated completion requires passing validation evidence");
    const cleanWorktree = git(inner, ["status", "--porcelain"]) === "";
    if (!cleanWorktree) throw new Error("delegated completion requires a clean worktree");
    const receipt = {
      schema_version: 1, delegation_id: capability.delegation_id, child_principal: capability.child_principal,
      authority_generation: capability.authority_generation, task_id: capability.task_id,
      base_sha: capability.base_sha, head_sha: head, commits, files_written: filesWritten,
      diff_digest: digest(gitBuffer(inner, ["diff", "--binary", `${capability.base_sha}..${head}`])),
      validation, clean_worktree: true, completed_at: new Date().toISOString(),
    };
    save(outputPath, receipt);
    updateDelegationStatus({ stateRoot, delegationId, status: "completed", details: { completion_receipt: outputPath } });
    if (flags["--graph"]) updateGraph(flags["--graph"], capability.task_id, (task) => { task.state = "completed_unmerged"; task.completion_receipt = outputPath; });
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`); return;
  }
  if (["revoke", "fail", "expire"].includes(command)) {
    const status = command === "revoke" ? "revoked" : command === "expire" ? "expired" : "failed";
    const next = updateDelegationStatus({ stateRoot, delegationId, status, reason: String(flags["--reason"] || command) });
    if (flags["--graph"]) updateGraph(flags["--graph"], next.task_id, (task) => { task.state = status; });
    process.stdout.write(`${JSON.stringify(next, null, 2)}\n`); return;
  }
  if (command === "status") { process.stdout.write(`${JSON.stringify(readDelegation({ stateRoot, delegationId }), null, 2)}\n`); return; }
  throw new Error("Usage: dispatch-execution-task.mjs <issue|accept|complete|status|revoke|fail|expire> [options]");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { run(); } catch (error) { process.stderr.write(`[dispatch-execution-task] ${error.message}\n`); process.exit(2); }
}
