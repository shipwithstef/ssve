import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SHARED_PATHS = [
  /^\.svc(?:\/|$)/, /^\.git(?:\/|$)/, /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/, /(^|\/)yarn\.lock$/, /(^|\/)migrations?(?:\/|$)/,
  /^(?:package\.json|AGENTS\.md|CLAUDE\.md|README\.md)$/,
];

function iso(value = Date.now()) { return new Date(value).toISOString(); }
function sha256(value) { return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`; }
function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700); }
function atomicWrite(file, value) {
  ensureDir(path.dirname(file));
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  fs.renameSync(temp, file); fs.chmodSync(file, 0o600);
}
function readJson(file, required = true) {
  try {
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("not a regular file");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    if (!required && error.code === "ENOENT") return null;
    throw new Error(`invalid delegation state ${file}: ${error.message}`);
  }
}
function processStartToken(pid = process.pid) {
  try { const s = fs.readFileSync(`/proc/${pid}/stat`, "utf8"); return s.slice(s.lastIndexOf(")") + 2).trim().split(/\s+/)[19] || null; }
  catch { return null; }
}
function reclaimProvablyDeadLock(lock) {
  try {
    const stat = fs.lstatSync(lock); if (!stat.isFile() || stat.isSymbolicLink()) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    const [pidText, hostname = "", token = ""] = fs.readFileSync(lock, "utf8").trim().split("\n");
    if (hostname !== os.hostname()) return false;
    const pid = Number(pidText); if (!Number.isInteger(pid) || pid < 1) return false;
    try { process.kill(pid, 0); }
    catch (error) { if (error.code === "ESRCH") { const current = fs.lstatSync(lock); if (current.dev !== stat.dev || current.ino !== stat.ino) return false; fs.unlinkSync(lock); return true; } return false; }
    if (token) { const currentToken = processStartToken(pid); if (!currentToken) return false; if (currentToken !== token) { const current = fs.lstatSync(lock); if (current.dev !== stat.dev || current.ino !== stat.ino) return false; fs.unlinkSync(lock); return true; } }
  } catch {}
  return false;
}
function withLock(stateRoot, id, operation) {
  const dir = path.join(path.resolve(stateRoot), "delegation-locks"); ensureDir(dir);
  const lock = path.join(dir, `${id}.lock`);
  let fd;
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try { fd = fs.openSync(lock, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600); fs.writeFileSync(fd, `${process.pid}\n${os.hostname()}\n${processStartToken() || ""}\n`); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (reclaimProvablyDeadLock(lock)) continue;
      if (attempt === 299) throw new Error("delegation lock timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return operation(); } finally { if (fd !== undefined) fs.closeSync(fd); try { fs.unlinkSync(lock); } catch {} }
}
function normalizeRelative(value) {
  const text = String(value || "").replaceAll("\\", "/").replace(/^\.\//, "");
  if (!text || text.startsWith("/") || text.split("/").includes("..") || text.includes("\0")) throw new Error(`unsafe delegated path: ${value}`);
  return path.posix.normalize(text);
}
function staticPrefix(pattern) { return normalizeRelative(pattern).split(/[*?[{]/, 1)[0].replace(/\/$/, ""); }
function scopesOverlap(left, right) {
  const a = staticPrefix(left); const b = staticPrefix(right);
  return !a || !b || a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}
function isShared(pattern) { const prefix = staticPrefix(pattern); return SHARED_PATHS.some((matcher) => matcher.test(prefix)); }
export function globRegex(pattern) {
  const source = normalizeRelative(pattern);
  let regex = "^";
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "*" && source[index + 1] === "*") { regex += ".*"; index += 1; }
    else if (char === "*") regex += "[^/]*";
    else if (char === "?") regex += "[^/]";
    else regex += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  }
  return new RegExp(`${regex}$`);
}
export function matchesAny(target, patterns) { return patterns.some((pattern) => globRegex(pattern).test(normalizeRelative(target))); }
function capabilityPath(stateRoot, delegationId) { return path.join(path.resolve(stateRoot), "delegations", `${delegationId}.json`); }
export function delegationSkillReceiptPath(stateRoot, delegationId) { return path.join(path.resolve(stateRoot), "delegation-receipts", `${delegationId}.json`); }

export function planExecutionGraph({ wi, baseSha, tasks, now = Date.now() }) {
  if (!/^[0-9a-f]{40}$/.test(String(baseSha || ""))) throw new Error("execution graph requires a 40-character base SHA");
  const taskIds = new Set();
  for (const source of tasks || []) {
    const id = String(source.id || "");
    if (!id || taskIds.has(id)) throw new Error("execution tasks require unique ids");
    taskIds.add(id);
  }
  const taskMap = {};
  const waves = [];
  const waveByTask = new Map();
  for (const source of tasks || []) {
    const id = String(source.id || "");
    const paths = (source.paths || []).map(normalizeRelative);
    const blockers = (source.blocked_by || []).map(String);
    for (const blocker of blockers) {
      if (!taskIds.has(blocker)) throw new Error(`execution task ${id} has unknown blocker: ${blocker}`);
      if (!waveByTask.has(blocker)) throw new Error(`execution task ${id} must follow blocker ${blocker} in graph order`);
    }
    const unknown = paths.length === 0;
    const shared = paths.some(isShared);
    let waveIndex = 0;
    if (blockers.length) waveIndex = Math.max(...blockers.map((blocker) => (waveByTask.get(blocker) ?? -1) + 1));
    let serializationReason = unknown ? "unknown-scope" : shared ? "shared-resource" : null;
    while (true) {
      const wave = waves[waveIndex];
      if (!wave) break;
      const overlaps = wave.tasks.some((otherId) => {
        const other = taskMap[otherId];
        return paths.some((left) => other.paths.some((right) => scopesOverlap(left, right)));
      });
      if (!unknown && !shared && !overlaps && !wave.serial) break;
      if (overlaps && !serializationReason) serializationReason = "overlapping-scope";
      waveIndex += 1;
    }
    if (!waves[waveIndex]) waves[waveIndex] = { id: `wave-${waveIndex + 1}`, tasks: [], serial: false };
    if (unknown || shared) {
      if (waves[waveIndex].tasks.length) { waveIndex += 1; waves[waveIndex] = { id: `wave-${waveIndex + 1}`, tasks: [], serial: true }; }
      waves[waveIndex].serial = true;
    }
    waves[waveIndex].tasks.push(id);
    waveByTask.set(id, waveIndex);
    taskMap[id] = { id, skill: String(source.skill || "execute-changeset"), paths, blocked_by: blockers, validation_commands: (source.validation_commands || []).map(String), state: "pending", wave_id: waves[waveIndex].id, serialization_reason: serializationReason };
  }
  return { schema_version: 1, wi: String(wi), base_sha: baseSha, state: "pending", tasks: taskMap, waves: waves.filter(Boolean), created_at: iso(now) };
}

function canonicalPlannedPath(value) {
  const absolute = path.resolve(String(value || ""));
  let cursor = absolute; const tail = [];
  while (!fs.existsSync(cursor)) { const parent = path.dirname(cursor); if (parent === cursor) throw new Error("inner worktree has no existing parent"); tail.unshift(path.basename(cursor)); cursor = parent; }
  return path.resolve(fs.realpathSync(cursor), ...tail);
}

export function issueDelegation({ stateRoot, lease, childPrincipal, taskId, skill = "execute-changeset", waveId, innerWorktree, allowedPaths, deniedPaths = [".svc/**", ".git/**"], validationCommands = [], baseSha, ttlMs = 60 * 60_000, maxDepth = 0, parentDelegation = null, now = Date.now() }) {
  if (!lease || lease.state !== "active" || !lease.lease_id || !Number.isInteger(lease.generation)) throw new Error("an active controller lease is required");
  if (!String(childPrincipal || "")) throw new Error("stable child principal is required");
  const allowed = (allowedPaths || []).map(normalizeRelative); if (!allowed.length) throw new Error("delegation requires allowed paths");
  const denied = deniedPaths.map(normalizeRelative);
  const requestedDepth = Number(maxDepth);
  if (!Number.isInteger(requestedDepth) || requestedDepth < 0) throw new Error("delegation max depth must be a non-negative integer");
  if (parentDelegation) {
    if (!["accepted", "running"].includes(parentDelegation.status)) throw new Error("parent delegation is not active");
    if (parentDelegation.parent_lease_id !== lease.lease_id || parentDelegation.authority_generation !== lease.generation) throw new Error("parent delegation authority mismatch");
    if (!Number.isInteger(parentDelegation.max_depth) || parentDelegation.max_depth < 1) throw new Error("parent delegation does not permit child delegation");
    if (requestedDepth >= parentDelegation.max_depth) throw new Error("nested delegation depth was not reduced");
    for (const pattern of allowed) {
      if (!parentDelegation.allowed_paths.some((parentPattern) => pattern === parentPattern || (parentPattern.endsWith("/**") && staticPrefix(pattern).startsWith(`${staticPrefix(parentPattern)}/`)))) {
        throw new Error(`nested delegated scope exceeds parent: ${pattern}`);
      }
    }
    for (const inherited of parentDelegation.denied_paths || []) {
      if (!denied.includes(inherited)) denied.push(inherited);
    }
  }
  const token = crypto.randomBytes(32).toString("base64url");
  const capability = {
    schema_version: 1, delegation_id: crypto.randomUUID(), parent_lease_id: lease.lease_id,
    authority_generation: lease.generation, repo_id: lease.repo_id, child_principal: childPrincipal, wi: lease.wi,
    task_id: String(taskId), skill: String(skill), wave_id: String(waveId), inner_worktree: canonicalPlannedPath(innerWorktree),
    allowed_paths: [...new Set(allowed)], denied_paths: [...new Set(denied)], validation_commands: validationCommands.map(String), base_sha: String(baseSha),
    issued_at: iso(now), accepted_at: null, expires_at: iso(now + ttlMs), max_depth: requestedDepth,
    parent_delegation_id: parentDelegation?.delegation_id || null,
    status: "issued", token_hash: sha256(Buffer.from(token)),
  };
  atomicWrite(capabilityPath(stateRoot, capability.delegation_id), capability);
  return { capability, token };
}

export function readDelegation({ stateRoot, delegationId }) { return readJson(capabilityPath(stateRoot, delegationId)); }

export function acceptDelegation({ stateRoot, delegationId, childPrincipal, token, now = Date.now() }) {
  return withLock(stateRoot, delegationId, () => {
    const file = capabilityPath(stateRoot, delegationId); const capability = readJson(file);
    if (capability.status !== "issued") throw new Error("delegation already accepted or unavailable");
    if (Date.parse(capability.expires_at) <= now) { atomicWrite(file, { ...capability, status: "expired" }); throw new Error("delegation token expired"); }
    if (capability.child_principal !== childPrincipal) throw new Error("delegation child principal mismatch");
    if (capability.token_hash !== sha256(Buffer.from(String(token || "")))) throw new Error("invalid delegation token");
    const receipt = {
      schema_version: 1, delegation_id: capability.delegation_id, child_principal: capability.child_principal,
      task_id: capability.task_id, skill: capability.skill, worktree: capability.inner_worktree,
      authority_generation: capability.authority_generation, accepted_at: iso(now),
    };
    const receiptPath = delegationSkillReceiptPath(stateRoot, delegationId);
    atomicWrite(receiptPath, receipt);
    const accepted = { ...capability, status: "accepted", accepted_at: iso(now), token_hash: "consumed", skill_receipt_path: receiptPath };
    atomicWrite(file, accepted); return accepted;
  });
}

export function authorizeDelegatedMutation({ stateRoot, delegationId, childPrincipal, lease, worktreeRoot, targets, taskState, skillReceipt, now = Date.now() }) {
  try {
    const capability = readDelegation({ stateRoot, delegationId });
    if (!["accepted", "running"].includes(capability.status)) throw new Error("delegation is not active");
    if (Date.parse(capability.expires_at) <= now) throw new Error("delegation expired");
    if (capability.child_principal !== childPrincipal) throw new Error("child principal mismatch");
    if (!lease || lease.state !== "active" || lease.lease_id !== capability.parent_lease_id || lease.generation !== capability.authority_generation) throw new Error("parent authority generation mismatch");
    if (fs.realpathSync(worktreeRoot) !== fs.realpathSync(capability.inner_worktree)) throw new Error("delegated inner worktree mismatch");
    if (!["delegated", "running"].includes(String(taskState))) throw new Error("execution task is not delegated or running");
    if (!skillReceipt || String(skillReceipt.delegation_id) !== capability.delegation_id || String(skillReceipt.child_principal) !== capability.child_principal || String(skillReceipt.task_id) !== capability.task_id || String(skillReceipt.skill) !== capability.skill || fs.realpathSync(skillReceipt.worktree) !== fs.realpathSync(capability.inner_worktree) || Number(skillReceipt.authority_generation) !== capability.authority_generation) throw new Error("delegated skill receipt mismatch");
    for (const target of targets || []) {
      const relative = normalizeRelative(target);
      if (matchesAny(relative, capability.denied_paths)) throw new Error(`denied delegated path: ${relative}`);
      if (!matchesAny(relative, capability.allowed_paths)) throw new Error(`path outside delegated scope: ${relative}`);
    }
    return { ok: true, capability };
  } catch (error) { return { ok: false, reason: error.message }; }
}

export function updateDelegationStatus({ stateRoot, delegationId, status, reason = "", details = {}, now = Date.now() }) {
  const allowed = new Set(["running", "completed", "merged", "failed", "revoked", "expired", "frozen"]);
  if (!allowed.has(status)) throw new Error("invalid delegation status");
  return withLock(stateRoot, delegationId, () => {
    const file = capabilityPath(stateRoot, delegationId); const current = readJson(file);
    const next = { ...current, ...details, status, ...(reason ? { failure_reason: reason } : {}), [`${status}_at`]: iso(now) };
    atomicWrite(file, next); return next;
  });
}

export function freezeDelegations({ stateRoot, leaseId, oldGeneration, now = Date.now() }) {
  const dir = path.join(path.resolve(stateRoot), "delegations"); if (!fs.existsSync(dir)) return [];
  const frozen = [];
  for (const name of fs.readdirSync(dir)) {
    if (!name.endsWith(".json")) continue;
    const current = readJson(path.join(dir, name));
    if (current.parent_lease_id !== leaseId || current.authority_generation !== oldGeneration || ["merged", "failed", "revoked", "expired", "frozen"].includes(current.status)) continue;
    const next = { ...current, status: "frozen", frozen_at: iso(now) }; atomicWrite(path.join(dir, name), next); frozen.push(next);
  }
  return frozen;
}

export function adoptDelegation({ stateRoot, delegationId, newLease, newChildPrincipal, ttlMs = 60 * 60_000 }) {
  const old = readDelegation({ stateRoot, delegationId });
  if (old.status !== "frozen") throw new Error("only a frozen delegation can be adopted");
  return issueDelegation({ stateRoot, lease: newLease, childPrincipal: newChildPrincipal, taskId: old.task_id, skill: old.skill, waveId: old.wave_id, innerWorktree: old.inner_worktree, allowedPaths: old.allowed_paths, deniedPaths: old.denied_paths, validationCommands: old.validation_commands || [], baseSha: old.base_sha, ttlMs, maxDepth: old.max_depth });
}

export function validateCompletionReceiptShape(receipt) {
  const required = ["delegation_id", "child_principal", "authority_generation", "task_id", "base_sha", "head_sha", "commits", "files_written", "diff_digest", "validation", "clean_worktree", "completed_at"];
  const missing = required.filter((key) => receipt?.[key] === undefined || receipt?.[key] === null);
  return { ok: receipt?.schema_version === 1 && missing.length === 0, missing };
}
