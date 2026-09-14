#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const argv = process.argv.slice(2); const command = argv[0];
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const fail = (message) => { console.error(JSON.stringify({ ok: false, error: message })); process.exit(1); };
const stateRoot = path.resolve(process.env.SVC_STATE_HOME || path.join(os.homedir(), ".svc"));
const database = path.join(stateRoot, "worktree-topology.db");
const git = (repo, args, allowFailure = false) => {
  try { return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(); }
  catch (error) { if (allowFailure) return null; throw error; }
};
const atomicWrite = (value) => {
  fs.mkdirSync(stateRoot, { recursive: true, mode: 0o700 });
  const tmp = `${database}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  try { fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600, flag: "wx" }); fs.renameSync(tmp, database); }
  finally { try { fs.unlinkSync(tmp); } catch {} }
};
function parseWorktrees(text) {
  const rows = []; let current = null;
  for (const line of `${text}\n`.split("\n")) {
    if (!line) { if (current) rows.push(current); current = null; continue; }
    const [key, ...rest] = line.split(" "); const value = rest.join(" ");
    if (key === "worktree") {
      let resolved = path.resolve(value); let exists = true;
      try { resolved = fs.realpathSync(value); } catch { exists = false; }
      current = { path: resolved, exists, head: null, branch: null, locked: false, prunable: !exists };
    }
    else if (current && key === "HEAD") current.head = value;
    else if (current && key === "branch") current.branch = value;
    else if (current && key === "locked") current.locked = true;
    else if (current && key === "prunable") current.prunable = true;
  }
  return rows;
}
function specRefs(worktree, branch) {
  const refs = new Set(); const match = String(branch || "").match(/WI-[A-Z0-9-]+/i); if (match) refs.add(match[0].toUpperCase());
  const svc = path.join(worktree, ".svc");
  if (fs.existsSync(svc)) for (const name of fs.readdirSync(svc).filter((n) => /^lane-tasks-WI-.*\.json$/.test(n)).slice(0, 100)) refs.add(name.slice("lane-tasks-".length, -".json".length));
  return [...refs].sort();
}

if (command === "show") {
  if (!fs.existsSync(database)) fail(`topology database not found: ${database}`);
  process.stdout.write(fs.readFileSync(database, "utf8")); process.exit(0);
}
if (command !== "refresh") fail("use: refresh --apps <apps.json> | show");
const appsPath = path.resolve(opt("--apps") || ""); if (!opt("--apps") || !fs.existsSync(appsPath)) fail("--apps must name an existing registry");
let registry; try { registry = JSON.parse(fs.readFileSync(appsPath, "utf8")); } catch { fail("apps registry is invalid JSON"); }
if (registry.schema_version !== "1.0.0" || !Array.isArray(registry.apps)) fail("unsupported apps registry");
try {
  const appIds = new Set(); const repoPaths = new Set();
  if (JSON.stringify(registry.apps) !== JSON.stringify([...registry.apps].sort((a, b) => String(a.id).localeCompare(String(b.id))))) throw new Error("apps must be sorted by id");
  const repositories = registry.apps.map((app) => {
    if (!app || typeof app !== "object" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(app.id || "")) throw new Error("app id is invalid");
    if (appIds.has(app.id)) throw new Error(`duplicate app id: ${app.id}`); appIds.add(app.id);
    if (typeof app.owner !== "string" || !app.owner.trim() || !["active", "paused", "retired"].includes(app.status) || !Array.isArray(app.contracts)) throw new Error(`${app.id}: invalid registry entry`);
    const repo = fs.realpathSync(app.repo_path); if (git(repo, ["rev-parse", "--show-toplevel"]) !== repo) throw new Error(`${app.id} is not a Git root`);
    if (repoPaths.has(repo)) throw new Error(`duplicate repository path: ${repo}`); repoPaths.add(repo);
    const contractNames = new Set();
    for (const contract of app.contracts) {
      if (!contract || typeof contract.name !== "string" || !contract.name.trim() || contractNames.has(contract.name) || typeof contract.path !== "string" || !contract.path || path.isAbsolute(contract.path)) throw new Error(`${app.id}: invalid contract entry`);
      contractNames.add(contract.name);
      const candidate = path.resolve(repo, contract.path); const real = fs.realpathSync(candidate);
      if (!(real === repo || real.startsWith(`${repo}${path.sep}`)) || !fs.statSync(real).isFile()) throw new Error(`${app.id}/${contract.name}: contract is not a contained regular file`);
    }
    const defaultBranch = git(repo, ["symbolic-ref", "refs/remotes/origin/HEAD"], true) || (git(repo, ["rev-parse", "--verify", "refs/remotes/origin/main"], true) ? "refs/remotes/origin/main" : (git(repo, ["rev-parse", "--verify", "refs/heads/main"], true) ? "refs/heads/main" : "HEAD"));
    const worktrees = parseWorktrees(git(repo, ["worktree", "list", "--porcelain"])).map((row) => ({ ...row, merged_to_default: Boolean(row.head) && git(repo, ["merge-base", "--is-ancestor", row.head, defaultBranch], true) !== null, spec_refs: row.exists ? specRefs(row.path, row.branch) : [] }));
    return { app_id: app.id, repo_path: repo, default_branch: defaultBranch, head: git(repo, ["rev-parse", "HEAD"], true), dirty: Boolean(git(repo, ["status", "--porcelain"])), worktrees };
  }).sort((a, b) => a.app_id.localeCompare(b.app_id));
  if (new Set(repositories.map((r) => r.app_id)).size !== repositories.length) throw new Error("duplicate app ids");
  atomicWrite({ schema_version: 1, generated_at: new Date().toISOString(), apps_registry_path: fs.realpathSync(appsPath), repositories });
  console.log(JSON.stringify({ ok: true, repositories: repositories.length, path: database }));
} catch (error) { fail(error.message); }
