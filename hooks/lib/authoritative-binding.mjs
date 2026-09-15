import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  authorityStateRoot,
  listControllers,
  principalId,
  readController,
  repositoryId,
} from "./authority-store.mjs";

function realpathOrEmpty(value) {
  try { return fs.realpathSync(value); } catch { return ""; }
}

export function worktreeRoots(repo) {
  const rows = [];
  try {
    const out = execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" });
    for (const line of String(out || "").split(/\r?\n/)) {
      if (!line.startsWith("worktree ")) continue;
      const resolved = realpathOrEmpty(line.slice(9));
      if (resolved) rows.push(resolved);
    }
  } catch {}
  return rows;
}

export function uniqueLaneWi(worktree) {
  const dir = path.join(worktree, ".svc");
  let names = [];
  try { names = fs.readdirSync(dir).filter((name) => name.startsWith("lane-tasks-") && name.endsWith(".json")); }
  catch { return ""; }
  const wis = [];
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
      const wi = String(parsed?.wi || "");
      if (wi && !wis.includes(wi)) wis.push(wi);
    } catch {}
  }
  return wis.length === 1 ? wis[0] : "";
}

export function defaultCheckoutRoot(worktree) {
  try {
    const common = execFileSync("git", ["-C", worktree, "rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
    return fs.realpathSync(path.dirname(path.resolve(worktree, common)));
  } catch {
    return "";
  }
}

export function isAuthoritativeMutatingBinding(binding, {
  sessionId = "",
  host = "",
  agentId = null,
  env = process.env,
} = {}) {
  if (!binding || typeof binding !== "object") return false;
  if (binding.role !== "mutating" || binding.released_at) return false;
  if (sessionId && String(binding.session_id || "") !== String(sessionId)) return false;
  const worktree = realpathOrEmpty(binding.worktree_root);
  const wi = String(binding.wi || "");
  if (!worktree || !wi) return false;
  let lease = null;
  try {
    lease = readController({
      stateRoot: authorityStateRoot(worktree, env),
      repoId: repositoryId(worktree),
      wi,
    });
  } catch {
    return false;
  }
  if (!lease) return true;
  if (!leaseIsLive(lease)) return false;
  if (realpathOrEmpty(lease.worktree_root) !== worktree) return false;
  if (host && sessionId) {
    const principal = principalId({ host, session_id: sessionId, agent_id: agentId || null });
    if (String(lease.controller_principal) !== String(principal)) return false;
  }
  return true;
}

export function leaseIsLive(lease, now = Date.now()) {
  if (!lease || lease.state !== "active") return false;
  const expires = Date.parse(lease.expires_at);
  return Number.isFinite(expires) && expires > now;
}

function collectV1Batons(roots, { sessionId, host, agentId, env }) {
  const found = [];
  for (const candidate of roots) {
    const dir = path.join(candidate, ".svc", "bindings");
    let names = [];
    try { names = fs.readdirSync(dir); } catch { continue; }
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      const file = path.join(dir, name);
      try {
        const stat = fs.lstatSync(file);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
        const binding = JSON.parse(fs.readFileSync(file, "utf8"));
        if (!isAuthoritativeMutatingBinding(binding, { sessionId, host, agentId, env })) continue;
        const worktree = realpathOrEmpty(binding.worktree_root);
        if (worktree) found.push({ worktree, binding });
      } catch {}
    }
  }
  return found;
}

function collectV2OnlyBatons(roots, { sessionId, host, agentId, env }) {
  if (!host || !sessionId) return [];
  const principal = principalId({ host, session_id: sessionId, agent_id: agentId || null });
  const found = [];
  for (const candidate of roots) {
    let matches = [];
    try {
      matches = listControllers({
        stateRoot: authorityStateRoot(candidate, env),
        repoId: repositoryId(candidate),
        worktreeRoot: candidate,
        principal,
        states: ["active"],
      }).filter((lease) => leaseIsLive(lease));
    } catch { continue; }
    if (matches.length !== 1) continue;
    const lease = matches[0];
    found.push({
      worktree: candidate,
      binding: { session_id: sessionId, role: "mutating", wi: lease.wi, worktree_root: candidate },
    });
  }
  return found;
}

export function collectSessionBatons({
  repo,
  sessionId,
  host = "",
  agentId = null,
  env = process.env,
  explicitWorktree = null,
} = {}) {
  if (!repo || !sessionId) return null;
  const roots = [];
  const seen = new Set();
  const add = (value) => {
    const resolved = realpathOrEmpty(value);
    if (!resolved || seen.has(resolved)) return;
    seen.add(resolved);
    roots.push(resolved);
  };
  if (explicitWorktree) add(explicitWorktree);
  else {
    add(repo);
    for (const row of worktreeRoots(repo)) add(row);
  }
  if (!roots.length) return null;
  const found = collectV1Batons(roots, { sessionId, host, agentId, env });
  const selected = found.length ? found : collectV2OnlyBatons(roots, { sessionId, host, agentId, env });
  if (selected.length === 1) return selected[0];
  if (selected.length > 1) return { conflict: true };
  return null;
}
