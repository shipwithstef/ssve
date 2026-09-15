import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { freezeDelegations } from "./delegation-authority.mjs";
import { normalizeClaimOwner } from "./claim-owner.mjs";
import { validateTaskGraphShape, selectRecoveryTask } from "./validate-task-graph-shape.mjs";
// WI-562 IP-H5: liveness primitives unified into one source.
import { processStartToken, ownerProcessIdentity, processIsAlive } from "./process-liveness.mjs";
export { processStartToken, ownerProcessIdentity, processIsAlive };

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function sha256(value) {
  return `sha256:${crypto.createHash("sha256").update(value).digest("hex")}`;
}

function iso(value = Date.now()) {
  return new Date(value).toISOString();
}

function requireString(value, label) {
  if (!String(value || "").trim()) throw new Error(`missing ${label}`);
  return String(value).trim();
}

function safeKey(repoId, wi) {
  return crypto.createHash("sha256").update(`${repoId}\0${wi}`).digest("hex");
}

function reclaimProvablyDeadLock(lock) {
  try {
    const stat = fs.lstatSync(lock);
    if (!stat.isFile() || stat.isSymbolicLink()) return false;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return false;
    const [pidText, hostname = "", startToken = ""] = fs.readFileSync(lock, "utf8").trim().split("\n");
    if (hostname !== os.hostname()) return false;
    const identity = { hostname, pid: Number(pidText), start_token: startToken || null };
    if (processIsAlive(identity) !== false) return false;
    const current = fs.lstatSync(lock);
    if (current.dev !== stat.dev || current.ino !== stat.ino) return false;
    fs.unlinkSync(lock);
    return true;
  } catch { return false; }
}

function commonGitDir(worktreeRoot) {
  const root = fs.realpathSync(requireString(worktreeRoot, "worktree root"));
  const value = execFileSync("git", ["-C", root, "rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
  return fs.realpathSync(path.isAbsolute(value) ? value : path.resolve(root, value));
}

function fsyncDirectory(dir) {
  const fd = fs.openSync(dir, fs.constants.O_RDONLY | (fs.constants.O_DIRECTORY || 0));
  try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
}

function assertNoFollowDirectoryPath(dir, { requireFinalOwner = false } = {}) {
  const absolute = path.resolve(dir);
  const parsed = path.parse(absolute);
  let current = parsed.root;
  for (const segment of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    let stat;
    try { stat = fs.lstatSync(current); }
    catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe authority directory ancestor: ${current}`);
    if (requireFinalOwner && current === absolute && typeof process.getuid === "function" && stat.uid !== process.getuid()) {
      throw new Error(`foreign authority directory: ${current}`);
    }
  }
  return absolute;
}

function ensureDir(dir) {
  const absolute = assertNoFollowDirectoryPath(dir, { requireFinalOwner: true });
  const created = [];
  for (let cursor = absolute; ; cursor = path.dirname(cursor)) {
    try {
      fs.lstatSync(cursor);
      break;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    created.push(cursor);
    if (path.dirname(cursor) === cursor) break;
  }
  fs.mkdirSync(absolute, { recursive: true, mode: 0o700 });
  assertNoFollowDirectoryPath(absolute, { requireFinalOwner: true });
  fs.chmodSync(absolute, 0o700);
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe authority directory: ${dir}`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`foreign authority directory: ${dir}`);
  for (const createdDir of created) {
    fsyncDirectory(createdDir);
    const parent = path.dirname(createdDir);
    if (parent !== createdDir) fsyncDirectory(parent);
  }
}

function readJson(file, { required = false } = {}) {
  try {
    assertNoFollowDirectoryPath(path.dirname(path.resolve(file)), { requireFinalOwner: true });
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("not a secure regular file");
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error("foreign-owned state file");
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid JSON object");
    return parsed;
  } catch (error) {
    if (!required && error.code === "ENOENT") return null;
    if (!required && !fs.existsSync(file)) return null;
    throw new Error(`corrupt authority evidence at ${file}: ${error.message}`);
  }
}

function atomicWrite(file, value) {
  ensureDir(path.dirname(file));
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
  fsyncDirectory(path.dirname(file));
}

function atomicWriteBytes(file, bytes) {
  ensureDir(path.dirname(file));
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
  fsyncDirectory(path.dirname(file));
}

function durableUnlink(file) {
  try { fs.unlinkSync(file); } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  fsyncDirectory(path.dirname(file));
}

function withLock(stateRoot, key, operation) {
  const dir = path.join(path.resolve(stateRoot), "locks");
  ensureDir(dir);
  const lock = path.join(dir, `${key}.lock`);
  let fd = null;
  for (let attempt = 0; attempt < 500; attempt += 1) {
    try {
      fd = fs.openSync(lock, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
      fs.writeFileSync(fd, `${process.pid}\n${os.hostname()}\n${processStartToken() || ""}\n${iso()}\n`);
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (reclaimProvablyDeadLock(lock)) continue;
      if (attempt === 499) throw new Error("authority lock timeout");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return operation(); }
  finally {
    if (fd !== null) fs.closeSync(fd);
    try { fs.unlinkSync(lock); } catch {}
  }
}

function pathsFor(stateRoot, repoId, wi) {
  const root = assertNoFollowDirectoryPath(path.resolve(stateRoot), { requireFinalOwner: true });
  const key = safeKey(repoId, wi);
  return {
    root, key,
    lease: path.join(root, "leases", `${key}.json`),
    handover: path.join(root, "handovers", `${key}.json`),
    transition: path.join(root, "transitions", `${key}.json`),
    receipts: path.join(root, "receipts"),
  };
}

function assertLease(lease, { repoId, wi } = {}) {
  if (!lease || lease.schema_version !== 2) throw new Error("corrupt controller lease schema");
  for (const key of ["lease_id", "repo_id", "wi", "worktree_root", "controller_principal", "issued_at", "renewed_at", "expires_at"]) {
    if (!String(lease[key] || "")) throw new Error(`corrupt controller lease: missing ${key}`);
  }
  if (!Number.isInteger(lease.generation) || lease.generation < 1 || !Number.isInteger(lease.backend_revision) || lease.backend_revision < 1) {
    throw new Error("corrupt controller lease generation/revision");
  }
  if (repoId && lease.repo_id !== repoId) throw new Error("controller lease repository mismatch");
  if (wi && lease.wi !== wi) throw new Error("controller lease WI mismatch");
  return lease;
}

export function principalId({ host, session_id, agent_id = null }) {
  const stableHost = requireString(host, "host");
  const stableSession = requireString(session_id, "stable session id");
  return sha256(Buffer.from(`${stableHost}\0${stableSession}\0${agent_id ? String(agent_id) : ""}`));
}

export function repositoryId(worktreeRoot) {
  return sha256(Buffer.from(commonGitDir(worktreeRoot)));
}

export function authorityStateRoot(worktreeRoot, env = process.env) {
  if (env.SVC_AUTHORITY_STATE_ROOT) return path.resolve(env.SVC_AUTHORITY_STATE_ROOT);
  return path.join(commonGitDir(worktreeRoot), "svc-authority-v2");
}

export function readController({ stateRoot, repoId, wi }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  const lease = readJson(paths.lease);
  return lease ? assertLease(lease, { repoId, wi }) : null;
}

export function listControllers({ stateRoot, repoId, worktreeRoot = null, principal = null, states = null }) {
  const dir = path.join(path.resolve(stateRoot), "leases");
  if (!fs.existsSync(dir)) return [];
  let wantedWorktree = "";
  if (worktreeRoot) {
    try { wantedWorktree = fs.realpathSync(worktreeRoot); }
    catch { return []; }
  }
  const matches = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch { return []; }
  for (const name of names) {
    if (!/^[0-9a-f]{64}\.json$/.test(name)) continue;
    const file = path.join(dir, name);
    let lease;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      lease = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch { continue; }
    if (lease?.schema_version !== 2 || String(lease.repo_id) !== String(repoId)) continue;
    if (Array.isArray(states) && !states.includes(lease.state)) continue;
    if (principal && String(lease.controller_principal) !== String(principal)) continue;
    if (wantedWorktree) {
      let leaseWorktree = "";
      try { leaseWorktree = fs.realpathSync(lease.worktree_root); } catch { continue; }
      if (leaseWorktree !== wantedWorktree) continue;
    }
    matches.push(lease);
  }
  return matches;
}

// Serialize a compound compatibility operation with every controller mutation.
// The callback receives the exact lease observed while the repository-shared
// controller lock is held; no handover, takeover, recovery, release, or
// migration can interleave until the callback returns.
export function withControllerLeaseLock({ stateRoot, repoId, wi }, operation) {
  if (typeof operation !== "function") throw new Error("controller lease lock requires an operation");
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    const lease = readJson(paths.lease);
    return operation(lease ? assertLease(lease, { repoId, wi }) : null);
  });
}

export function bootstrapController({ stateRoot, repoId, wi, worktreeRoot, principal, initialGeneration = 1, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  requireString(repoId, "repo id"); requireString(wi, "WI"); requireString(principal, "principal");
  if (!Number.isInteger(initialGeneration) || initialGeneration < 1) throw new Error("initial controller generation must be a positive integer");
  const canonicalWorktree = fs.realpathSync(requireString(worktreeRoot, "worktree root"));
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    const existing = readJson(paths.lease);
    if (existing) {
      assertLease(existing, { repoId, wi });
      throw new Error("controller lease already exists; use resume, rearm, handover, or recover");
    }
    const lease = {
      schema_version: 2, lease_id: crypto.randomUUID(), repo_id: repoId, wi,
      worktree_root: canonicalWorktree, controller_principal: principal,
      generation: initialGeneration, state: "active",
      owner_process: ownerProcessIdentity(),
      issued_at: iso(now), renewed_at: iso(now), expires_at: iso(now + ttlMs),
      backend_revision: 1,
    };
    atomicWrite(paths.lease, lease);
    return lease;
  });
}

export function rearmReleasedController({
  stateRoot, repoId, wi, worktreeRoot, principal, expectedGeneration, expectedLeaseId,
  ttlMs = DEFAULT_TTL_MS, now = Date.now(),
}) {
  requireString(repoId, "repo id"); requireString(wi, "WI"); requireString(principal, "principal");
  const canonicalWorktree = fs.realpathSync(requireString(worktreeRoot, "worktree root"));
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => runTransition({
    paths, repoId, wi, kind: "rearm-released", principal, worktree: canonicalWorktree,
    expectedGeneration, expectedLeaseId, now,
    prepare(existing) {
      if (existing.state !== "released") throw new Error("controller lease is not released");
      if (String(existing.controller_principal) !== String(principal)) {
        throw new Error("released lease belongs to a different principal; explicit handover required");
      }
      if (Number(existing.generation) !== Number(expectedGeneration)) {
        throw new Error("released lease generation changed; inspect again");
      }
      if (String(existing.lease_id) !== String(expectedLeaseId)) {
        throw new Error("released lease id changed; inspect again");
      }
      if (fs.realpathSync(existing.worktree_root) !== canonicalWorktree) {
        throw new Error("released controller worktree mismatch");
      }
      const planned = {
        schema_version: 2, lease_id: crypto.randomUUID(), repo_id: repoId, wi,
        worktree_root: canonicalWorktree, controller_principal: principal,
        generation: existing.generation + 1, state: "active",
        owner_process: ownerProcessIdentity(),
        issued_at: iso(now), renewed_at: iso(now), expires_at: iso(now + ttlMs),
        backend_revision: existing.backend_revision + 1,
        lifecycle_bound: true,
      };
      const receiptId = crypto.randomUUID();
      const recordId = crypto.randomUUID();
      return {
        planned,
        freeze: { lease_id: existing.lease_id, generation: existing.generation },
        handoff: {
          record_id: recordId, kind: "recovery", wi, repo_id: repoId, lease_id: planned.lease_id,
          generation: planned.generation, old_generation: existing.generation,
          principal, predecessor_principal: existing.controller_principal,
          worktree_realpath: canonicalWorktree,
          base_sha: typeof existing.base_sha === "string" ? existing.base_sha : "",
          ttl_ms: ttlMs,
          evidence_digests: priorLeaseEvidence(expectedLeaseId, expectedGeneration, { rearmed_from_released: true }),
        },
        lifecycle: {
          schema_version: 1, receipt_id: receiptId, kind: "recovery", lease_id: planned.lease_id,
          repo_id: repoId, wi, old_controller_principal: existing.controller_principal,
          new_controller_principal: principal, old_generation: existing.generation,
          new_generation: planned.generation, evidence: { rearmed_from_released: true },
        },
      };
    },
  }));
}

export function rearmExpiredController({
  stateRoot, repoId, wi, worktreeRoot, principal, expectedGeneration, expectedLeaseId,
  ttlMs = DEFAULT_TTL_MS, now = Date.now(),
}) {
  requireString(repoId, "repo id"); requireString(wi, "WI"); requireString(principal, "principal");
  const canonicalWorktree = fs.realpathSync(requireString(worktreeRoot, "worktree root"));
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => runTransition({
    paths, repoId, wi, kind: "rearm-expired", principal, worktree: canonicalWorktree,
    expectedGeneration, expectedLeaseId, now,
    prepare(existing) {
      if (existing.state !== "active") throw new Error("controller lease is not active");
      if (String(existing.controller_principal) !== String(principal)) {
        throw new Error("expired lease belongs to a different principal; explicit handover required");
      }
      if (Number(existing.generation) !== Number(expectedGeneration)) {
        throw new Error("expired lease generation changed; inspect again");
      }
      if (String(existing.lease_id) !== String(expectedLeaseId)) {
        throw new Error("expired lease id changed; inspect again");
      }
      if (fs.realpathSync(existing.worktree_root) !== canonicalWorktree) {
        throw new Error("expired controller worktree mismatch");
      }
      const expiresAt = Date.parse(existing.expires_at || "");
      if (!Number.isFinite(expiresAt) || expiresAt > now) throw new Error("controller lease is not expired");
      const planned = {
        ...existing,
        generation: existing.generation + 1,
        owner_process: ownerProcessIdentity(),
        renewed_at: iso(now), expires_at: iso(now + ttlMs),
        backend_revision: existing.backend_revision + 1,
        lifecycle_bound: true,
      };
      const receiptId = crypto.randomUUID();
      const recordId = crypto.randomUUID();
      return {
        planned,
        freeze: { lease_id: existing.lease_id, generation: existing.generation },
        handoff: {
          record_id: recordId, kind: "recovery", wi, repo_id: repoId, lease_id: planned.lease_id,
          generation: planned.generation, old_generation: existing.generation,
          principal, predecessor_principal: existing.controller_principal,
          worktree_realpath: canonicalWorktree,
          base_sha: typeof existing.base_sha === "string" ? existing.base_sha : "",
          ttl_ms: ttlMs,
          evidence_digests: priorLeaseEvidence(expectedLeaseId, expectedGeneration, { rearmed_from_expired: true }),
        },
        lifecycle: {
          schema_version: 1, receipt_id: receiptId, kind: "recovery", lease_id: planned.lease_id,
          repo_id: repoId, wi, old_controller_principal: existing.controller_principal,
          new_controller_principal: principal, old_generation: existing.generation,
          new_generation: planned.generation, evidence: { rearmed_from_expired: true },
        },
      };
    },
  }));
}

export function resumeController({ stateRoot, repoId, wi, worktreeRoot, principal, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    completeProvenPendingLifecycleLocked(paths, { repoId, wi, now });
    let lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    if (lease.state !== "active") throw new Error("controller lease is not active");
    if (lease.controller_principal !== principal) throw new Error("controller principal mismatch");
    if (fs.realpathSync(worktreeRoot) !== fs.realpathSync(lease.worktree_root)) throw new Error("controller worktree mismatch");
    const expiresAt = Date.parse(lease.expires_at || "");
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      throw new Error("controller lease expired; generation-bound expired recovery required");
    }
    verifyLatestHandoffRecord(paths, lease);
    const renewed = { ...lease, owner_process: ownerProcessIdentity(), renewed_at: iso(now), expires_at: iso(now + ttlMs), backend_revision: lease.backend_revision + 1 };
    atomicWrite(paths.lease, renewed);
    return renewed;
  });
}

// WI-FW-HOOKS-SAFETY-01 T04/AC-4: generation-aware compare-and-swap renewal.
// Continuity, never escalation: the caller must present the EXACT live tuple
// (lease id + generation + principal + canonical worktree). Any drift returns
// a typed stale decision and writes NOTHING — a stale renewal can never
// resurrect released authority, extend a foreign principal, or advance an old
// generation. Owner override, break-glass markers, handover tokens,
// delegation and promotion capabilities are separate authority objects this
// function never touches; they stay non-renewable by construction.
export function renewControllerIfCurrent({ stateRoot, repoId, wi, worktreeRoot, principal, leaseId, generation, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  requireString(repoId, "repo id");
  requireString(wi, "WI");
  requireString(principal, "principal");
  if (!Number.isInteger(generation) || generation < 1) return { status: "stale_decision", reason: "invalid expected generation" };
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    try { completeProvenPendingLifecycleLocked(paths, { repoId, wi, now }); }
    catch (error) { return { status: "stale_decision", reason: error.message }; }
    let lease;
    try { lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi }); }
    catch (error) { return { status: "stale_decision", reason: `unreadable or corrupt lease (${error.message})` }; }
    if (String(lease.lease_id) !== String(leaseId)) return { status: "stale_decision", reason: "lease id is not current" };
    if (Number(lease.generation) !== Number(generation)) return { status: "stale_decision", reason: "generation changed" };
    if (String(lease.controller_principal) !== String(principal)) return { status: "stale_decision", reason: "principal is not the controller" };
    try {
      if (fs.realpathSync(worktreeRoot) !== fs.realpathSync(lease.worktree_root)) return { status: "stale_decision", reason: "canonical worktree changed" };
    } catch { return { status: "stale_decision", reason: "worktree path unresolved" }; }
    if (lease.state !== "active") return { status: "not_renewable", reason: `lease state is ${lease.state}` };
    // EXTREV-EXEC-004: an expired or unreadable expiry must never be renewed
    // — renewal resurrecting dead authority is exactly the failure this guard
    // exists to prevent.
    const expiresAt = Date.parse(lease.expires_at || "");
    if (!Number.isFinite(expiresAt)) return { status: "not_renewable", reason: "lease expiry is malformed" };
    if (expiresAt <= now) return { status: "not_renewable", reason: "lease expired" };
    try { verifyLatestHandoffRecord(paths, lease); }
    catch (error) { return { status: "stale_decision", reason: error.message }; }
    const renewed = { ...lease, owner_process: ownerProcessIdentity(), renewed_at: iso(now), expires_at: iso(now + ttlMs), backend_revision: lease.backend_revision + 1 };
    atomicWrite(paths.lease, renewed);
    return { status: "renewed", lease: renewed };
  });
}

// Renewal due-threshold: renew when remaining TTL falls below the greater of
// the safety window and the declared tool timeout plus margin. Rate limiting:
// at most one renewal write per minimum interval per lease in normal
// sequential use — EXCEPT genuine emergencies (the remaining life is shorter
// than one interval), where blocking on the limiter would let authority die.
const RENEW_SAFETY_WINDOW_MS_DEFAULT = 5 * 60_000;
export function renewalDue(lease, { timeoutMs = 0, safetyWindowMs = RENEW_SAFETY_WINDOW_MS_DEFAULT, minIntervalMs = 60_000, now = Date.now() } = {}) {
  const expires = Date.parse(lease?.expires_at || "");
  if (!Number.isFinite(expires)) return false;
  const remaining = expires - now;
  const threshold = Math.max(safetyWindowMs, Number(timeoutMs || 0) + 60_000);
  if (remaining >= threshold) return false;
  const renewedAt = Date.parse(lease?.renewed_at || "");
  const sinceRenewal = Number.isFinite(renewedAt) ? now - renewedAt : Infinity;
  const emergencyFloorMs = Math.min(Math.max(1, safetyWindowMs) / 2, Math.max(1, minIntervalMs));
  return sinceRenewal >= minIntervalMs || remaining <= emergencyFloorMs;
}

function latestOwnHandoff(paths, lease) {
  const dir = path.join(paths.receipts, "handoff");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return null; }
  if (files.length === 0) return null;
  const stamped = [];
  for (const f of files) {
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { throw new Error(`resume refused: handoff record unreadable (${f}: ${e.message})`); }
    if (parsed.repo_id !== lease.repo_id || parsed.wi !== lease.wi) continue;
    if (!Number.isFinite(Date.parse(parsed.ts))) {
      throw new Error(`resume refused: own handoff record has invalid ts (${f})`);
    }
    stamped.push({ f, ts: Date.parse(parsed.ts), record: parsed });
  }
  if (stamped.length === 0) return null;
  stamped.sort((a, b) => a.ts - b.ts);
  return stamped[stamped.length - 1].record;
}

function hitTransitionFailpoint(name) {
  if (String(process.env.SVC_AUTHORITY_TRANSITION_FAILPOINT || "") === name) {
    throw new Error(`injected failpoint: ${name}`);
  }
}

function snapshotLease(lease) {
  return JSON.parse(JSON.stringify(lease));
}

function assertPositiveIntegerRevision(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`open transition ${label} revision is invalid`);
  }
  return value;
}

function plannedLeaseIdentityMatches(planned, live) {
  return Boolean(planned && live
    && String(live.lease_id) === String(planned.lease_id)
    && Number(live.generation) === Number(planned.generation)
    && String(live.state) === String(planned.state)
    && String(live.controller_principal) === String(planned.controller_principal)
    && String(live.worktree_root) === String(planned.worktree_root)
    && String(live.repo_id) === String(planned.repo_id)
    && String(live.wi) === String(planned.wi));
}

function plannedMatchesLive(planned, live) {
  return plannedLeaseIdentityMatches(planned, live)
    && Number.isInteger(live.backend_revision)
    && Number.isInteger(planned.backend_revision)
    && live.backend_revision === planned.backend_revision;
}

function sameLeaseIdentity(left, right) {
  return Boolean(left && right
    && String(left.lease_id) === String(right.lease_id)
    && Number(left.generation) === Number(right.generation)
    && String(left.state) === String(right.state)
    && Number(left.backend_revision) === Number(right.backend_revision)
    && String(left.controller_principal) === String(right.controller_principal)
    && String(left.worktree_root) === String(right.worktree_root)
    && String(left.repo_id) === String(right.repo_id)
    && String(left.wi) === String(right.wi));
}

function sameCanonicalWorktree(left, right) {
  try { return fs.realpathSync(left) === fs.realpathSync(right); }
  catch { return false; }
}

function assertCallerMatchesLive(existing, { principal, worktree, repoId, wi }) {
  if (String(existing.repo_id) !== String(repoId)) throw new Error("controller lease repository mismatch");
  if (String(existing.wi) !== String(wi)) throw new Error("controller lease WI mismatch");
  if (String(existing.controller_principal) !== String(principal)) {
    throw new Error("controller belongs to a different principal");
  }
  if (!sameCanonicalWorktree(existing.worktree_root, worktree)) {
    throw new Error("controller worktree mismatch");
  }
}

function assertOpenTransitionIntent(intent, { kind, principal, worktree, repoId, wi, expectedGeneration, expectedLeaseId }) {
  if (!intent || intent.schema_version !== 1 || !intent.intent_id) {
    throw new Error("corrupt transition intent");
  }
  const prior = intent.prior_lease;
  const planned = intent.planned_lease;
  const handoff = intent.handoff;
  const lifecycle = intent.lifecycle;
  const freeze = intent.freeze;
  if (!prior?.lease_id || !planned?.lease_id || !handoff?.record_id || !lifecycle?.receipt_id || !freeze?.lease_id) {
    throw new Error("corrupt transition intent");
  }
  const priorRevision = assertPositiveIntegerRevision(prior.backend_revision, "prior");
  const plannedRevision = assertPositiveIntegerRevision(planned.backend_revision, "planned");
  if (plannedRevision !== priorRevision + 1) {
    throw new Error("open transition planned revision conflict");
  }
  if (intent.kind !== kind) throw new Error("open transition kind conflict");
  if (String(intent.repo_id) !== String(repoId) || String(prior.repo_id) !== String(repoId) || String(planned.repo_id) !== String(repoId)) {
    throw new Error("open transition repository mismatch");
  }
  if (String(intent.wi) !== String(wi) || String(prior.wi) !== String(wi) || String(planned.wi) !== String(wi)) {
    throw new Error("open transition WI mismatch");
  }
  if (String(intent.principal) !== String(principal) || String(planned.controller_principal) !== String(principal)) {
    throw new Error("open transition belongs to a different principal");
  }
  if (!sameCanonicalWorktree(intent.worktree_root, worktree) || String(planned.worktree_root) !== String(intent.worktree_root)) {
    throw new Error("open transition worktree mismatch");
  }
  if (Number(prior.generation) !== Number(expectedGeneration) || Number(intent.prior_lease.generation) !== Number(expectedGeneration)) {
    throw new Error("open transition generation mismatch");
  }
  if (String(prior.lease_id) !== String(expectedLeaseId)) {
    throw new Error("open transition lease id mismatch");
  }
  if (String(freeze.lease_id) !== String(prior.lease_id) || Number(freeze.generation) !== Number(prior.generation)) {
    throw new Error("open transition freeze tuple conflict");
  }
  if (String(handoff.repo_id) !== String(repoId) || String(handoff.wi) !== String(wi)
      || String(handoff.lease_id) !== String(planned.lease_id)
      || Number(handoff.generation) !== Number(planned.generation)
      || String(handoff.principal) !== String(principal)
      || Number(handoff.old_generation) !== Number(prior.generation)
      || String(handoff.predecessor_principal) !== String(prior.controller_principal)
      || String(handoff.worktree_realpath) !== String(intent.worktree_root)) {
    throw new Error("open transition handoff tuple conflict");
  }
  if (String(lifecycle.repo_id) !== String(repoId) || String(lifecycle.wi) !== String(wi)
      || String(lifecycle.lease_id) !== String(planned.lease_id)
      || Number(lifecycle.old_generation) !== Number(prior.generation)
      || Number(lifecycle.new_generation) !== Number(planned.generation)
      || String(lifecycle.old_controller_principal) !== String(prior.controller_principal)
      || String(lifecycle.new_controller_principal) !== String(principal)) {
    throw new Error("open transition lifecycle tuple conflict");
  }
  if (kind === "release") {
    if (handoff.kind !== "release" || lifecycle.kind !== "release") throw new Error("open transition kind conflict");
    if (String(planned.lease_id) !== String(prior.lease_id) || Number(planned.generation) !== Number(prior.generation) || planned.state !== "released") {
      throw new Error("open transition planned lease identity conflict");
    }
  } else if (kind === "rearm-released" || kind === "rearm-expired") {
    if (handoff.kind !== "recovery" || lifecycle.kind !== "recovery") throw new Error("open transition kind conflict");
    if (Number(planned.generation) !== Number(prior.generation) + 1 || planned.state !== "active") {
      throw new Error("open transition planned lease identity conflict");
    }
    if (kind === "rearm-expired" && String(planned.lease_id) !== String(prior.lease_id)) {
      throw new Error("open transition planned lease identity conflict");
    }
    if (kind === "rearm-released" && String(planned.lease_id) === String(prior.lease_id)) {
      throw new Error("open transition planned lease identity conflict");
    }
  } else if (kind === "explicit-takeover" || kind === "recovery-displace") {
    if (kind === "explicit-takeover" && (handoff.kind !== "explicit_takeover" || lifecycle.kind !== "explicit_takeover")) {
      throw new Error("open transition kind conflict");
    }
    if (kind === "recovery-displace" && (handoff.kind !== "recovery" || lifecycle.kind !== "recovery")) {
      throw new Error("open transition kind conflict");
    }
    if (Number(planned.generation) !== Number(prior.generation) + 1 || planned.state !== "active") {
      throw new Error("open transition planned lease identity conflict");
    }
    if (String(planned.lease_id) !== String(prior.lease_id)) {
      throw new Error("open transition planned lease identity conflict");
    }
    if (!planned.lifecycle_bound) throw new Error("open transition planned lease identity conflict");
  } else {
    throw new Error("open transition kind conflict");
  }
}

function priorLeaseEvidence(expectedLeaseId, expectedGeneration, extra = {}) {
  return digestEvidence({ prior_lease_id: expectedLeaseId, expected_generation: expectedGeneration, ...extra });
}

function replayCompletedTransition(existing, latest, { kind, principal, worktree, expectedGeneration, expectedLeaseId }) {
  if (!existing || !latest) return null;
  if (String(latest.principal) !== String(principal)) return null;
  if (String(existing.controller_principal) !== String(principal)) return null;
  if (!sameCanonicalWorktree(existing.worktree_root, worktree)) return null;
  if (!sameCanonicalWorktree(latest.worktree_realpath || existing.worktree_root, worktree)) return null;
  const priorDigest = digestEvidence({ prior_lease_id: expectedLeaseId }).prior_lease_id;
  if (latest.evidence_digests?.prior_lease_id && latest.evidence_digests.prior_lease_id !== priorDigest) return null;
  if (kind === "release") {
    if (existing.state !== "released") return null;
    if (latest.kind !== "release") return null;
    if (Number(latest.generation) !== Number(expectedGeneration)) return null;
    if (String(existing.lease_id) !== String(expectedLeaseId)) return null;
    return existing;
  }
  if (kind === "explicit-takeover" || kind === "recovery-displace") {
    if (existing.state !== "active") return null;
    if (latest.kind !== (kind === "explicit-takeover" ? "explicit_takeover" : "recovery")) return null;
    if (Number(latest.old_generation) !== Number(expectedGeneration)) return null;
    if (Number(latest.generation) !== Number(existing.generation)) return null;
    if (Number(existing.generation) !== Number(expectedGeneration) + 1) return null;
    if (String(existing.lease_id) !== String(expectedLeaseId)) return null;
    if (!existing.lifecycle_bound) return null;
    return existing;
  }
  if (kind !== "rearm-released" && kind !== "rearm-expired") return null;
  if (existing.state !== "active") return null;
  if (latest.kind !== "recovery") return null;
  if (Number(latest.old_generation) !== Number(expectedGeneration)) return null;
  if (Number(latest.generation) !== Number(existing.generation)) return null;
  if (Number(existing.generation) !== Number(expectedGeneration) + 1) return null;
  if (kind === "rearm-expired" && String(existing.lease_id) !== String(expectedLeaseId)) return null;
  if (kind === "rearm-released" && String(existing.lease_id) === String(expectedLeaseId)) return null;
  return existing;
}

function completeTransitionSteps(paths, intent, now) {
  freezeOldGenerationDelegations(paths.root, intent.freeze.lease_id, intent.freeze.generation, now);
  hitTransitionFailpoint("after-freeze-before-handoff");
  writeHandoffRecord(paths, intent.handoff);
  hitTransitionFailpoint("after-handoff-before-complete");
  if (intent.lifecycle) writeLifecycleReceipt(paths, intent.lifecycle);
  durableUnlink(paths.transition);
}

function runTransition({
  paths, repoId, wi, kind, principal, worktree, expectedGeneration, expectedLeaseId, now, prepare,
  successor = false, expectedPriorPrincipal = null,
}) {
  requireString(expectedLeaseId, "expected lease id");
  if (!Number.isInteger(expectedGeneration) || expectedGeneration < 1) throw new Error("expected generation must be a positive integer");
  completeProvenPendingLifecycleLocked(paths, { repoId, wi, now });
  const existing = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
  const latest = latestOwnHandoff(paths, existing);
  const intent = readJson(paths.transition);
  if (intent) {
    assertOpenTransitionIntent(intent, { kind, principal, worktree, repoId, wi, expectedGeneration, expectedLeaseId });
    if (plannedMatchesLive(intent.planned_lease, existing)) {
      completeTransitionSteps(paths, intent, now);
      return assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    }
    if (sameLeaseIdentity(existing, intent.prior_lease)) {
      hitTransitionFailpoint("after-intent-before-lease");
      atomicWrite(paths.lease, intent.planned_lease);
      hitTransitionFailpoint("after-lease-before-freeze");
      completeTransitionSteps(paths, intent, now);
      return intent.planned_lease;
    }
    throw new Error("controller lease conflicts with the durable transition intent");
  }
  if (successor) {
    requireString(expectedPriorPrincipal, "expected prior principal");
    if (String(existing.controller_principal) === String(principal)) {
      const replayed = replayCompletedTransition(existing, latest, { kind, principal, worktree, expectedGeneration, expectedLeaseId });
      if (replayed) return existing;
    }
    if (String(existing.controller_principal) !== String(expectedPriorPrincipal)) {
      throw new Error("controller belongs to a different principal");
    }
    if (Number(existing.generation) !== Number(expectedGeneration) || String(existing.lease_id) !== String(expectedLeaseId)) {
      throw new Error("controller lease changed; inspect again");
    }
  } else {
    assertCallerMatchesLive(existing, { principal, worktree, repoId, wi });
  }
  if (replayCompletedTransition(existing, latest, { kind, principal, worktree, expectedGeneration, expectedLeaseId })) {
    return existing;
  }
  const prepared = prepare(existing);
  const ts = iso(now);
  const lifecycle = prepared.lifecycle ? { ...prepared.lifecycle, completed_at: ts } : null;
  const intentDoc = {
    schema_version: 1,
    intent_id: crypto.randomUUID(),
    kind,
    repo_id: repoId,
    wi,
    principal,
    worktree_root: worktree,
    prior_lease: snapshotLease(existing),
    planned_lease: prepared.planned,
    freeze: prepared.freeze,
    handoff: { ...prepared.handoff, ts },
    lifecycle,
    created_at: ts,
  };
  atomicWrite(paths.transition, intentDoc);
  hitTransitionFailpoint("after-intent-before-lease");
  atomicWrite(paths.lease, intentDoc.planned_lease);
  hitTransitionFailpoint("after-lease-before-freeze");
  completeTransitionSteps(paths, intentDoc, now);
  return intentDoc.planned_lease;
}

function finalizeOpenTransitionIntent(paths, lease, { principal, worktree }) {
  const intent = readJson(paths.transition);
  if (!intent) return lease;
  const completable = intent.kind === "rearm-released" || intent.kind === "rearm-expired"
    || intent.kind === "explicit-takeover" || intent.kind === "recovery-displace";
  if (!completable) {
    throw new Error(`open ${intent.kind} transition must be completed by its own operation`);
  }
  assertCallerMatchesLive(lease, { principal, worktree, repoId: lease.repo_id, wi: lease.wi });
  assertOpenTransitionIntent(intent, {
    kind: intent.kind, principal, worktree, repoId: lease.repo_id, wi: lease.wi,
    expectedGeneration: Number(intent.prior_lease?.generation), expectedLeaseId: String(intent.prior_lease?.lease_id || ""),
  });
  if (!plannedMatchesLive(intent.planned_lease, lease)) {
    throw new Error("controller lease conflicts with the durable transition intent");
  }
  completeTransitionSteps(paths, intent, Date.now());
  return assertLease(readJson(paths.lease, { required: true }), { repoId: lease.repo_id, wi: lease.wi });
}

function tryFinalizeStrandedHandover(paths, lease, { repoId, wi, now }) {
  const handover = readJson(paths.handover);
  if (!handover || handover.status !== "prepared") return lease;
  if (lease.accepted_handover_id !== handover.handover_id || lease.accepted_token_hash !== handover.token_hash) {
    return lease;
  }
  return finalizeHandoverLocked(paths, { repoId, wi, now }).lease || lease;
}

function isProvenAcceptedHandover(lease, handover) {
  return Boolean(lease && handover
    && handover.status === "prepared"
    && String(lease.accepted_handover_id) === String(handover.handover_id)
    && String(lease.accepted_token_hash) === String(handover.token_hash)
    && String(lease.lease_id) === String(handover.lease_id));
}

function completeProvenAcceptedHandoverLocked(paths, { repoId, wi, now }) {
  const lease = readJson(paths.lease);
  if (!lease) return null;
  const asserted = assertLease(lease, { repoId, wi });
  const handover = readJson(paths.handover);
  if (!isProvenAcceptedHandover(asserted, handover)) return asserted;
  return finalizeHandoverLocked(paths, { repoId, wi, now }).lease || asserted;
}

function completeProvenPendingTransitionLocked(paths, { repoId, wi, now }) {
  const intent = readJson(paths.transition);
  const lease = readJson(paths.lease);
  if (!intent || !lease) return lease ? assertLease(lease, { repoId, wi }) : null;
  const asserted = assertLease(lease, { repoId, wi });
  if (!plannedLeaseIdentityMatches(intent.planned_lease, asserted)) return asserted;
  assertOpenTransitionIntent(intent, {
    kind: intent.kind,
    principal: intent.principal,
    worktree: intent.worktree_root,
    repoId, wi,
    expectedGeneration: Number(intent.prior_lease?.generation),
    expectedLeaseId: String(intent.prior_lease?.lease_id || ""),
  });
  if (!plannedMatchesLive(intent.planned_lease, asserted)) {
    throw new Error("controller lease conflicts with the durable transition intent");
  }
  completeTransitionSteps(paths, intent, now);
  return assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
}

function completeProvenPendingLifecycleLocked(paths, { repoId, wi, now }) {
  completeProvenAcceptedHandoverLocked(paths, { repoId, wi, now });
  return completeProvenPendingTransitionLocked(paths, { repoId, wi, now });
}

function leaseIsMutationReady(paths, lease, now = Date.now()) {
  if (!lease || lease.state !== "active") return false;
  const expires = Date.parse(lease.expires_at);
  if (!Number.isFinite(expires) || expires <= now) return false;
  if (readJson(paths.transition)) return false;
  if (isProvenAcceptedHandover(lease, readJson(paths.handover))) return false;
  if (lease.lifecycle_bound) {
    try { verifyLatestHandoffRecord(paths, lease); }
    catch { return false; }
  }
  return true;
}

export function reconcileControllerLifecycle({ stateRoot, repoId, wi, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    completeProvenPendingLifecycleLocked(paths, { repoId, wi, now });
    const lease = readJson(paths.lease);
    if (!lease) return { lease: null, mutation_ready: false };
    const asserted = assertLease(lease, { repoId, wi });
    return { lease: asserted, mutation_ready: leaseIsMutationReady(paths, asserted, now) };
  });
}

function matchingOpenSuccessorIntent(paths, { kind, principal, expectedGeneration = null, expectedPrincipal = null }) {
  const intent = readJson(paths.transition);
  if (!intent || intent.kind !== kind || String(intent.principal) !== String(principal)) return null;
  if (expectedPrincipal != null && String(intent.prior_lease?.controller_principal) !== String(expectedPrincipal)) return null;
  if (expectedGeneration != null && Number(intent.prior_lease?.generation) !== Number(expectedGeneration)) return null;
  const lease = readJson(paths.lease);
  if (!lease) return null;
  if (plannedMatchesLive(intent.planned_lease, lease) || sameLeaseIdentity(lease, intent.prior_lease)) return intent;
  return null;
}

function verifyLatestHandoffRecord(paths, lease) {
  const record = latestOwnHandoff(paths, lease);
  if (!record) {
    // Only NEW release/rearm transitions stamp lifecycle_bound onto the lease in
    // the same atomic write as the planned tuple. Unmarked legacy controllers,
    // v1 migrations, and bootstrap(initialGeneration>1) keep same-owner resume.
    if (lease?.lifecycle_bound) {
      throw new Error("resume refused: lifecycle evidence missing; cannot reconstruct without a durable transition intent");
    }
    return null;
  }
  if (Number(record.generation) !== Number(lease.generation)) {
    throw new Error(`resume refused: handoff record generation ${record.generation} != lease generation ${lease.generation}`);
  }
  if (String(record.principal) !== String(lease.controller_principal)) {
    throw new Error("resume refused: handoff record principal differs from live controller principal");
  }
  return record;
}

export function prepareHandover({ stateRoot, repoId, wi, principal, intendedPrincipal = null, ttlMs = 15 * 60_000, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    const lease = completeProvenPendingLifecycleLocked(paths, { repoId, wi, now })
      || assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    const leftover = readJson(paths.handover);
    if (isProvenAcceptedHandover(lease, leftover)) {
      throw new Error("cannot prepare a new handover while accepted handover proof is incomplete");
    }
    if (lease.state !== "active" || lease.controller_principal !== principal) throw new Error("only the active controller principal may prepare handover");
    const token = crypto.randomBytes(32).toString("base64url");
    const record = {
      schema_version: 1, handover_id: crypto.randomUUID(), token_hash: sha256(Buffer.from(token)),
      repo_id: repoId, wi, lease_id: lease.lease_id, expected_generation: lease.generation,
      expected_revision: lease.backend_revision, source_principal: principal,
      intended_principal: intendedPrincipal || null, issued_at: iso(now), expires_at: iso(now + ttlMs),
      status: "prepared",
    };
    atomicWrite(paths.handover, record);
    return { token, record };
  });
}

function freezeOldGenerationDelegations(stateRoot, leaseId, generation, now = Date.now()) {
  return freezeDelegations({ stateRoot, leaseId, oldGeneration: generation, now })
    .map((delegation) => delegation.delegation_id);
}

function writeLifecycleReceipt(paths, receipt) {
  ensureDir(paths.receipts);
  const match = findMatchingLifecycleReceipt(paths, receipt);
  if (match) {
    return path.join(paths.receipts, match.file);
  }
  const file = path.join(paths.receipts, `${receipt.completed_at.replace(/[:.]/g, "-")}-${receipt.receipt_id}.json`);
  const existing = readJson(file);
  if (existing) {
    if (existing.receipt_id === receipt.receipt_id && existing.kind === receipt.kind && existing.lease_id === receipt.lease_id) return file;
    throw new Error("lifecycle receipt id conflict");
  }
  atomicWrite(file, receipt);
  return file;
}

function findMatchingLifecycleReceipt(paths, receipt) {
  let names = [];
  try { names = fs.readdirSync(paths.receipts).filter((name) => name.endsWith(".json")); }
  catch { return null; }
  for (const name of names) {
    const parsed = readJson(path.join(paths.receipts, name));
    if (parsed?.kind === receipt.kind && String(parsed.lease_id) === String(receipt.lease_id)
      && String(parsed.wi) === String(receipt.wi)
      && Number(parsed.new_generation) === Number(receipt.new_generation)
      && String(parsed.new_controller_principal) === String(receipt.new_controller_principal)) {
      return { file: name, receipt: parsed };
    }
  }
  return null;
}

function findHandoverLifecycleReceipt(paths, handoverId) {
  let names = [];
  try { names = fs.readdirSync(paths.receipts).filter((name) => name.endsWith(".json")); }
  catch { return null; }
  for (const name of names) {
    const parsed = readJson(path.join(paths.receipts, name));
    if (parsed?.kind === "handover" && parsed.evidence?.handover_id === handoverId) return parsed;
  }
  return null;
}

function findHandoverHandoffRecord(paths, { tokenHash, generation, leaseId }) {
  const dir = path.join(paths.receipts, "handoff");
  let names = [];
  try { names = fs.readdirSync(dir).filter((name) => name.endsWith(".json")); }
  catch { return null; }
  for (const name of names) {
    const parsed = readJson(path.join(dir, name));
    if (parsed?.kind === "handover" && parsed.token_hash === tokenHash
      && Number(parsed.generation) === Number(generation) && String(parsed.lease_id) === String(leaseId)) {
      return parsed;
    }
  }
  return null;
}

// WI-562 IP-H6: normalized handoff records — a SEPARATE object from lifecycle
// receipts (never dual-validated), one atomic file per record under
// <receipts>/handoff/, validated against schemas/handoff-record.schema.json.
const HANDOFF_RECORD_SCHEMA_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "schemas", "handoff-record.schema.json");

function validateHandoffRecord(record) {
  let schema;
  try { schema = JSON.parse(fs.readFileSync(HANDOFF_RECORD_SCHEMA_PATH, "utf8")); }
  catch (e) { throw new Error(`handoff-record schema unavailable (${e.message})`); }
  const required = schema.required || [];
  const missing = required.filter((k) => record[k] === undefined || record[k] === null);
  if (missing.length > 0) throw new Error(`handoff-record invalid: missing ${missing.join(", ")}`);
  if (!schema.properties.kind.enum.includes(record.kind)) throw new Error(`handoff-record invalid: unknown kind ${record.kind}`);
  if (!/^sha256:[0-9a-f]{64}$/.test(String(record.token_hash || "sha256:" + "0".repeat(64)))) {
    // token_hash is optional; when present it must be digest-shaped.
    if (record.token_hash !== undefined) throw new Error("handoff-record invalid: token_hash not sha256:<hex>");
  }
  if (!Number.isInteger(record.generation) || record.generation < 1) throw new Error("handoff-record invalid: generation");
  for (const [label, d] of Object.entries(record.evidence_digests || {})) {
    if (!/^sha256:[0-9a-f]{64}$/.test(d)) throw new Error(`handoff-record invalid: evidence_digests[${label}]`);
  }
}

function writeHandoffRecord(paths, partial) {
  const record = { schema_version: 1, record_id: crypto.randomUUID(), allowed_paths: [], ...partial };
  validateHandoffRecord(record);
  ensureDir(path.join(paths.receipts, "handoff"));
  const match = findMatchingHandoffRecord(paths, record);
  if (match) return path.join(paths.receipts, "handoff", match.file);
  const file = path.join(paths.receipts, "handoff", `${record.record_id}.json`);
  const existing = readJson(file);
  if (existing) {
    if (existing.record_id === record.record_id && existing.kind === record.kind
        && existing.generation === record.generation && existing.old_generation === record.old_generation
        && existing.lease_id === record.lease_id && existing.principal === record.principal) {
      return file;
    }
    throw new Error("handoff record id conflict");
  }
  atomicWrite(file, record);
  return file;
}

function findMatchingHandoffRecord(paths, record) {
  const dir = path.join(paths.receipts, "handoff");
  let names = [];
  try { names = fs.readdirSync(dir).filter((name) => name.endsWith(".json")); }
  catch { return null; }
  for (const name of names) {
    const parsed = readJson(path.join(dir, name));
    if (parsed?.kind === record.kind && String(parsed.lease_id) === String(record.lease_id)
      && Number(parsed.generation) === Number(record.generation)
      && Number(parsed.old_generation) === Number(record.old_generation)
      && String(parsed.principal) === String(record.principal)
      && String(parsed.wi) === String(record.wi)) {
      return { file: name, record: parsed };
    }
  }
  return null;
}

function digestEvidence(evidence) {
  const digests = {};
  for (const [label, value] of Object.entries(evidence)) {
    digests[label] = sha256(Buffer.from(JSON.stringify(value)));
  }
  return digests;
}

export function acceptHandover({ stateRoot, repoId, wi, principal, token, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    completeProvenPendingTransitionLocked(paths, { repoId, wi, now });
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    const handover = readJson(paths.handover, { required: true });
    if (isProvenAcceptedHandover(lease, handover)) {
      if (handover.token_hash !== sha256(Buffer.from(requireString(token, "handover token")))) throw new Error("invalid handover token");
      if (handover.intended_principal && handover.intended_principal !== principal) throw new Error("handover intended principal mismatch");
      if (lease.controller_principal !== principal) throw new Error("handover intended principal mismatch");
      const finalized = finalizeHandoverLocked(paths, { repoId, wi, now });
      return { lease: finalized.lease || lease, receipt: finalized.receipt, receipt_path: finalized.receipt_path };
    }
    if (handover.status !== "prepared") throw new Error("handover token already consumed");
    if (Date.parse(handover.expires_at) <= now) throw new Error("handover token expired");
    if (handover.intended_principal && handover.intended_principal !== principal) throw new Error("handover intended principal mismatch");
    if (handover.token_hash !== sha256(Buffer.from(requireString(token, "handover token")))) throw new Error("invalid handover token");
    if (handover.lease_id !== lease.lease_id || handover.expected_generation !== lease.generation || handover.expected_revision !== lease.backend_revision) {
      throw new Error("handover compare-and-swap mismatch");
    }
    const next = {
      ...lease, controller_principal: principal, generation: lease.generation + 1,
      // WI-562 IP-H6/HD-4: token-proof lives INSIDE the lease. Only token-gated
      // acceptHandover writes these fields — takeover/recovery never do — so a
      // stranded post-crash tuple is positive proof of token acceptance.
      accepted_handover_id: handover.handover_id,
      accepted_token_hash: handover.token_hash,
      owner_process: ownerProcessIdentity(),
      renewed_at: iso(now), expires_at: iso(now + ttlMs), backend_revision: lease.backend_revision + 1,
      lifecycle_bound: true,
    };
    atomicWrite(paths.lease, next);
    const frozen_delegations = freezeOldGenerationDelegations(paths.root, lease.lease_id, lease.generation, now);
    const receipt = {
      schema_version: 1, receipt_id: crypto.randomUUID(), kind: "handover", lease_id: lease.lease_id,
      repo_id: repoId, wi, old_controller_principal: lease.controller_principal,
      new_controller_principal: principal, old_generation: lease.generation,
      new_generation: next.generation, evidence: { handover_id: handover.handover_id, frozen_delegations }, completed_at: iso(now),
    };
    const receipt_path = writeLifecycleReceipt(paths, receipt);
    writeHandoffRecord(paths, {
      kind: "handover", wi, repo_id: repoId, lease_id: lease.lease_id,
      generation: next.generation, old_generation: lease.generation,
      principal, predecessor_principal: lease.controller_principal,
      worktree_realpath: lease.worktree_root || "",
      base_sha: typeof lease.base_sha === "string" ? lease.base_sha : "",
      token_hash: handover.token_hash,
      ttl_ms: ttlMs,
      evidence_digests: digestEvidence({ handover_id: handover.handover_id, frozen_delegations }),
      ts: iso(now),
    });
    // Consumed marker is written LAST on purpose: crash-before-consumed leaves
    // the verifiable stranded tuple {prepared, lease.accepted_handover_id match}
    // that finalizeHandover completes idempotently.
    atomicWrite(paths.handover, { ...handover, status: "consumed", consumed_at: iso(now) });
    return { lease: next, receipt, receipt_path };
  });
}

// WI-562 IP-H4/HD-4: forward-completion for HALF-CONSUMED handovers.
// Case A only (crash between the advanced lease write and the consumed marker):
//   prepared AND lease.accepted_handover_id === handover.handover_id AND
//   lease.accepted_token_hash === handover.token_hash AND lease_id match AND
//   (intended_principal unset OR equals current controller).
// Completes bookkeeping WITHOUT touching the lease (no second generation bump),
// emits the lifecycle receipt + normalized record, freezes old delegations, and
// is idempotent. Case B (token still unconsumed) REFUSES here — that path
// belongs to acceptHandover and requires the secret token.
export function finalizeHandover({ stateRoot, repoId, wi, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => finalizeHandoverLocked(paths, { repoId, wi, now }));
}

function finalizeHandoverLocked(paths, { repoId, wi, now }) {
  const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
  let handover;
  try { handover = readJson(paths.handover, { required: true }); }
  catch (e) { throw new Error(`finalizeHandover: no handover record (${e.message})`); }
  if (handover.status !== "prepared") return { completed: false, reason: "handover already consumed", lease };
  if (handover.lease_id !== lease.lease_id) throw new Error("finalizeHandover refused: cross-lease stranding (operator recovery required)");
  if (lease.accepted_handover_id !== handover.handover_id || lease.accepted_token_hash !== handover.token_hash) {
    throw new Error("finalizeHandover refused: lease was advanced by takeover/recovery, not by token acceptance");
  }
  if (Number(lease.backend_revision) !== Number(handover.expected_revision) + 1) {
    throw new Error("finalizeHandover refused: backend revision does not match acceptance");
  }
  if (handover.intended_principal && handover.intended_principal !== lease.controller_principal) {
    throw new Error("finalizeHandover refused: controller principal differs from intended successor");
  }
  const frozen_delegations = freezeOldGenerationDelegations(paths.root, lease.lease_id, Number(handover.expected_generation), now);
  const existingReceipt = findHandoverLifecycleReceipt(paths, handover.handover_id);
  const receipt = existingReceipt || {
    schema_version: 1, receipt_id: crypto.randomUUID(), kind: "handover", lease_id: lease.lease_id,
    repo_id: repoId, wi, old_controller_principal: String(handover.source_principal || ""),
    new_controller_principal: lease.controller_principal,
    old_generation: Number(handover.expected_generation), new_generation: lease.generation,
    evidence: { handover_id: handover.handover_id, finalized_forward: true, frozen_delegations }, completed_at: iso(now),
  };
  const receipt_path = existingReceipt ? null : writeLifecycleReceipt(paths, receipt);
  const existingHandoff = findHandoverHandoffRecord(paths, {
    tokenHash: handover.token_hash, generation: lease.generation, leaseId: lease.lease_id,
  });
  if (!existingHandoff) {
    writeHandoffRecord(paths, {
      kind: "handover", wi, repo_id: repoId, lease_id: lease.lease_id,
      generation: lease.generation, old_generation: Number(handover.expected_generation),
      principal: lease.controller_principal, predecessor_principal: String(handover.source_principal || ""),
      worktree_realpath: lease.worktree_root || "",
      base_sha: typeof lease.base_sha === "string" ? lease.base_sha : "",
      token_hash: handover.token_hash,
      ttl_ms: Math.max(1, Date.parse(lease.expires_at) - now),
      evidence_digests: digestEvidence({ handover_id: handover.handover_id, finalized_forward: true, frozen_delegations }),
      ts: iso(now),
    });
  }
  atomicWrite(paths.handover, { ...handover, status: "consumed", consumed_at: iso(now), finalized_forward: true });
  return { completed: true, receipt, receipt_path, frozen_delegations, lease };
}

// Explicit user-directed takeover. This never inspects, signals, or terminates
// the previous process. Exact owner + generation + backend lock provide CAS.
export function takeoverController({ stateRoot, repoId, wi, principal, expectedPrincipal, expectedGeneration, reason, ttlMs = 15 * 60_000, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  if (!String(reason || "").trim()) throw new Error("explicit takeover requires a reason");
  if (!Number.isInteger(Number(expectedGeneration)) || Number(expectedGeneration) < 1) throw new Error("explicit takeover requires the observed generation");
  requireString(principal, "takeover principal");
  return withLock(paths.root, paths.key, () => {
    completeProvenPendingLifecycleLocked(paths, { repoId, wi, now });
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    const open = matchingOpenSuccessorIntent(paths, {
      kind: "explicit-takeover", principal, expectedGeneration, expectedPrincipal,
    });
    if (!open) {
      const replayed = replayCompletedTransition(lease, latestOwnHandoff(paths, lease), {
        kind: "explicit-takeover", principal, worktree: lease.worktree_root,
        expectedGeneration: Number(expectedGeneration), expectedLeaseId: lease.lease_id,
      });
      if (replayed) return { lease, receipt: latestOwnHandoff(paths, lease), receipt_path: null };
      if (lease.state !== "active") throw new Error("controller lease is not active");
      if (lease.controller_principal !== String(expectedPrincipal || "")) throw new Error("takeover owner compare-and-swap mismatch");
      if (lease.generation !== Number(expectedGeneration)) throw new Error("takeover generation compare-and-swap mismatch");
    }
    const prior = open ? open.prior_lease : lease;
    const worktree = fs.realpathSync(open ? open.worktree_root : lease.worktree_root);
    const successor = String(principal) !== String(prior.controller_principal);
    const nextLease = runTransition({
      paths, repoId, wi, kind: "explicit-takeover", principal, worktree,
      expectedGeneration: Number(prior.generation), expectedLeaseId: prior.lease_id, now,
      successor, expectedPriorPrincipal: prior.controller_principal,
      prepare(existing) {
        const planned = {
          ...existing, controller_principal: principal, generation: existing.generation + 1,
          owner_process: ownerProcessIdentity(), renewed_at: iso(now), expires_at: iso(now + ttlMs),
          backend_revision: existing.backend_revision + 1, lifecycle_bound: true,
        };
        return {
          planned,
          freeze: { lease_id: existing.lease_id, generation: existing.generation },
          handoff: {
            record_id: crypto.randomUUID(), kind: "explicit_takeover", wi, repo_id: repoId, lease_id: planned.lease_id,
            generation: planned.generation, old_generation: existing.generation,
            principal, predecessor_principal: existing.controller_principal,
            worktree_realpath: worktree,
            base_sha: typeof existing.base_sha === "string" ? existing.base_sha : "",
            ttl_ms: ttlMs,
            evidence_digests: digestEvidence({ reason: String(reason).trim() }),
          },
          lifecycle: {
            schema_version: 1, receipt_id: crypto.randomUUID(), kind: "explicit_takeover", lease_id: planned.lease_id,
            repo_id: repoId, wi, old_controller_principal: existing.controller_principal,
            new_controller_principal: principal, old_generation: existing.generation,
            new_generation: planned.generation, evidence: { reason: String(reason).trim() },
          },
        };
      },
    });
    return { lease: nextLease, receipt: latestOwnHandoff(paths, nextLease), receipt_path: null };
  });
}

export function recoverController({ stateRoot, repoId, wi, principal, reason, worktreeRoot = null, expectedGeneration = null, evidence = {}, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  reason = requireString(reason, "recovery reason");
  principal = requireString(principal, "recovery principal");
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    completeProvenPendingLifecycleLocked(paths, { repoId, wi, now });
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    const open = matchingOpenSuccessorIntent(paths, {
      kind: "recovery-displace", principal, expectedGeneration,
    });
    let target = lease.worktree_root;
    if (!open) {
      const replayed = expectedGeneration != null
        ? replayCompletedTransition(lease, latestOwnHandoff(paths, lease), {
            kind: "recovery-displace", principal, worktree: lease.worktree_root,
            expectedGeneration: Number(expectedGeneration), expectedLeaseId: lease.lease_id,
          })
        : null;
      if (replayed) return { lease, receipt: latestOwnHandoff(paths, lease), receipt_path: null };
      if (lease.state !== "active") throw new Error("controller lease is not active");
      const ownerAlive = processIsAlive(lease.owner_process);
      if (evidence.owner_live === true || ownerAlive === true) throw new Error("controller authority conflict: a provably live owner cannot be displaced");
      const expired = evidence.expired === true && Date.parse(lease.expires_at) <= now;
      const sameHostDead = evidence.same_host_dead === true && ownerAlive === false;
      if (!expired && !sameHostDead) throw new Error("recovery requires positive dead-owner evidence or lease expiry");
      if (expectedGeneration !== null && lease.generation !== expectedGeneration) throw new Error("recovery generation changed; inspect again");
      if (worktreeRoot && path.resolve(worktreeRoot) !== path.resolve(target)) {
        if (fs.existsSync(target)) throw new Error("old controller worktree still exists; explicit handover required");
        target = fs.realpathSync(worktreeRoot);
        assertNoFollowDirectoryPath(worktreeRoot, { requireFinalOwner: true });
        if (repositoryId(target) !== repoId) throw new Error("recovery target belongs to another repository");
        const rows = execFileSync('git', ['-C', target, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
        if (!rows.split('\n').includes(`worktree ${target}`) || target === path.dirname(commonGitDir(target))) throw new Error("recovery requires a registered non-default worktree");
        const claim = readJson(path.join(target, '.svc', 'claims', `${wi}.claim.json`), { required: true });
        const bindingsDir = path.join(target, '.svc', 'bindings');
        const bindings = fs.readdirSync(bindingsDir).filter(n => n.endsWith('.json')).map(n => readJson(path.join(bindingsDir, n), { required: true }));
        const matches = bindings.filter(b => !b.released_at && b.role === 'mutating');
        if (matches.length !== 1 || matches[0].session_id !== claim.session_id || matches[0].generation !== claim.generation || matches[0].wi !== wi || matches[0].worktree_root !== target || matches[0].branch !== claim.branch) throw new Error('recovery target binding mismatch');
        const candidates = rows.split('\n').filter(v => v.startsWith('worktree ')).map(v => v.slice(9)).filter(w => fs.existsSync(path.join(w, '.svc', `lane-tasks-${wi}.json`)));
        if (candidates.length !== 1 || candidates[0] !== target) throw new Error('recovery target selection is ambiguous');
        const branch = execFileSync('git', ['-C', target, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
        if (claim.schema_version !== 1 || claim.wi !== wi || claim.role !== 'mutating' || claim.worktree_root !== target || claim.branch !== branch || fs.realpathSync(claim.repo_root) !== path.dirname(commonGitDir(target))) throw new Error("recovery target claim mismatch");
        const renewed = Date.parse(claim.renewed_at || claim.started_at);
        const ttl = Number(claim.ttl_hours);
        if (!Number.isFinite(renewed) || !Number.isFinite(ttl) || ttl <= 0 || renewed + ttl * 3600000 > now) throw new Error("recovery target claim is live or uncertain");
        const graph = readJson(path.join(target, '.svc', `lane-tasks-${wi}.json`), { required: true });
        if (graph.wi !== wi || !validateTaskGraphShape(graph).ok || !selectRecoveryTask(graph)) throw new Error("recovery target graph is ambiguous");
      }
    }
    const prior = open ? open.prior_lease : lease;
    const worktree = fs.realpathSync(open ? open.worktree_root : target);
    const successor = String(principal) !== String(prior.controller_principal)
      || !sameCanonicalWorktree(prior.worktree_root, worktree);
    const recovered = runTransition({
      paths, repoId, wi, kind: "recovery-displace", principal, worktree,
      expectedGeneration: Number(prior.generation), expectedLeaseId: prior.lease_id, now,
      successor, expectedPriorPrincipal: prior.controller_principal,
      prepare(existing) {
        const planned = {
          ...existing, worktree_root: worktree, controller_principal: principal,
          generation: existing.generation + 1, owner_process: ownerProcessIdentity(),
          renewed_at: iso(now), expires_at: iso(now + ttlMs),
          backend_revision: existing.backend_revision + 1, lifecycle_bound: true,
        };
        return {
          planned,
          freeze: { lease_id: existing.lease_id, generation: existing.generation },
          handoff: {
            record_id: crypto.randomUUID(), kind: "recovery", wi, repo_id: repoId, lease_id: planned.lease_id,
            generation: planned.generation, old_generation: existing.generation,
            principal, predecessor_principal: existing.controller_principal,
            worktree_realpath: worktree,
            base_sha: typeof existing.base_sha === "string" ? existing.base_sha : "",
            ttl_ms: ttlMs,
            evidence_digests: digestEvidence({ ...evidence, reason }),
          },
          lifecycle: {
            schema_version: 1, receipt_id: crypto.randomUUID(), kind: "recovery", lease_id: planned.lease_id,
            repo_id: repoId, wi, old_controller_principal: existing.controller_principal,
            new_controller_principal: principal, old_generation: existing.generation,
            new_generation: planned.generation,
            evidence: { ...evidence, reason, old_worktree_root: existing.worktree_root, new_worktree_root: planned.worktree_root },
          },
        };
      },
    });
    return { lease: recovered, receipt: latestOwnHandoff(paths, recovered), receipt_path: null };
  });
}

export function releaseController({
  stateRoot, repoId, wi, principal, expectedGeneration = null, expectedLeaseId = null, now = Date.now(),
}) {
  requireString(principal, "principal");
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    completeProvenPendingLifecycleLocked(paths, { repoId, wi, now });
    const current = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    const generation = expectedGeneration == null ? Number(current.generation) : Number(expectedGeneration);
    const leaseId = expectedLeaseId == null ? String(current.lease_id) : String(expectedLeaseId);
    const worktree = fs.realpathSync(current.worktree_root);
    return runTransition({
      paths, repoId, wi, kind: "release", principal, worktree,
      expectedGeneration: generation, expectedLeaseId: leaseId, now,
      prepare(existing) {
        if (existing.state !== "active" || existing.controller_principal !== principal) {
          throw new Error("only the active controller principal may release authority");
        }
        if (Number(existing.generation) !== generation) throw new Error("release generation changed; inspect again");
        if (String(existing.lease_id) !== String(leaseId)) throw new Error("release lease id changed; inspect again");
        const planned = {
          ...existing, state: "released", renewed_at: iso(now), expires_at: iso(now),
          backend_revision: existing.backend_revision + 1,
          lifecycle_bound: true,
        };
        const ttlMs = Math.max(1, Date.parse(existing.expires_at) - now);
        const receiptId = crypto.randomUUID();
        const recordId = crypto.randomUUID();
        return {
          planned,
          freeze: { lease_id: existing.lease_id, generation: existing.generation },
          handoff: {
            record_id: recordId, kind: "release", wi, repo_id: repoId, lease_id: existing.lease_id,
            generation: existing.generation, old_generation: existing.generation,
            principal, predecessor_principal: existing.controller_principal,
            worktree_realpath: worktree,
            base_sha: typeof existing.base_sha === "string" ? existing.base_sha : "",
            ttl_ms: ttlMs,
            evidence_digests: priorLeaseEvidence(leaseId, generation, { released: true }),
          },
          lifecycle: {
            schema_version: 1, receipt_id: receiptId, kind: "release", lease_id: existing.lease_id,
            repo_id: repoId, wi, old_controller_principal: existing.controller_principal,
            new_controller_principal: principal, old_generation: existing.generation,
            new_generation: existing.generation, evidence: { released: true },
          },
        };
      },
    });
  });
}

export function writeControllerForTest({ stateRoot, lease, expectedRevision }) {
  if (process.env.NODE_ENV !== "test") throw new Error("test-only controller writer requires NODE_ENV=test");
  const paths = pathsFor(stateRoot, lease.repo_id, lease.wi);
  return withLock(paths.root, paths.key, () => {
    const current = assertLease(readJson(paths.lease, { required: true }), { repoId: lease.repo_id, wi: lease.wi });
    if (current.backend_revision !== expectedRevision) throw new Error("compare-and-swap revision mismatch");
    const next = { ...lease, backend_revision: expectedRevision + 1 };
    atomicWrite(paths.lease, next);
    return next;
  });
}

export function migrateV1Claim({ stateRoot, claimPath, repoId, worktreeRoot, host, env = process.env, actorSessionId = null }) {
  const absoluteClaim = path.resolve(claimPath);
  const stat = fs.lstatSync(absoluteClaim);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("v1 claim is not a secure regular file");
  const bytes = fs.readFileSync(absoluteClaim);
  let claim;
  try { claim = JSON.parse(bytes.toString("utf8")); } catch { throw new Error("v1 claim is malformed"); }
  const owner = normalizeClaimOwner(claim);
  if (!owner.attributable) {
    throw new Error(owner.ambiguous ? "v1 claim carries ambiguous session owners" : "v1 claim lacks a stable session owner");
  }
  const principal = principalId({ host, session_id: requireString(owner.session_id, "v1 stable session id") });
  if (actorSessionId != null && String(actorSessionId) !== "" && String(owner.session_id) !== String(actorSessionId)) {
    throw new Error("v1 claim session owner does not match the authenticated actor; explicit handover required");
  }
  const wi = requireString(claim.wi, "v1 WI");
  const canonicalWorktree = fs.realpathSync(requireString(worktreeRoot, "worktree root"));
  if (claim.worktree_root && fs.realpathSync(claim.worktree_root) !== canonicalWorktree) {
    throw new Error("v1 claim worktree mismatch");
  }
  const sourceDigest = sha256(bytes);
  const initialGeneration = Number.isInteger(claim.generation) && claim.generation > 0 ? claim.generation : 1;
  const migrationId = crypto.createHash("sha256")
    .update(`${repoId}\0${wi}\0${absoluteClaim}\0${sourceDigest}`)
    .digest("hex");
  const migrationRoot = path.join(path.resolve(stateRoot), "migrations", migrationId);
  const backup_path = path.join(migrationRoot, "v1-claim.backup");
  const intentPath = path.join(migrationRoot, "migration-intent.json");
  const receipt_path = path.join(migrationRoot, "migration-receipt.json");
  const paths = pathsFor(stateRoot, repoId, wi);

  return withLock(paths.root, paths.key, () => {
    completeProvenPendingLifecycleLocked(paths, { repoId, wi, now: Date.now() });
    // Compatibility path for controller-v2 leases created before deterministic
    // v1 migration intents existed. The exact same principal/worktree/generation
    // is already authoritative, so resume it without fabricating retroactive
    // migration evidence or creating an orphan backup directory. Any mismatch
    // remains a conflict and fails before migration state is written.
    let intent = readJson(intentPath);
    let lease = readJson(paths.lease);
    if (lease) lease = assertLease(lease, { repoId, wi });
    if (!intent && lease) {
      const expiresAt = Date.parse(lease.expires_at);
      const live = Number.isFinite(expiresAt) && expiresAt > Date.now();
      if (lease.state !== "active" || !live) {
        throw new Error("v2 controller lease already exists; use resume, rearm, handover, or recover");
      }
      const exactLegacyController = lease.controller_principal === principal &&
        fs.realpathSync(lease.worktree_root) === canonicalWorktree &&
        lease.generation === initialGeneration;
      if (exactLegacyController) {
        return {
          lease,
          backup_path: null,
          receipt_path: null,
          resumed: true,
          preexisting_controller: true,
        };
      }
      throw new Error("active controller lease has no matching v1 migration intent; use resume or handover");
    }

    ensureDir(migrationRoot);
    if (fs.existsSync(backup_path)) {
      if (sha256(fs.readFileSync(backup_path)) !== sourceDigest) throw new Error("v1 migration backup digest mismatch");
    } else {
      atomicWriteBytes(backup_path, bytes);
    }

    if (!intent) {
      const now = Date.now();
      const plannedLease = {
        schema_version: 2, lease_id: crypto.randomUUID(), repo_id: repoId, wi,
        worktree_root: canonicalWorktree, controller_principal: principal,
        generation: lease ? lease.generation + 1 : initialGeneration, state: "active",
        owner_process: ownerProcessIdentity(), issued_at: iso(now), renewed_at: iso(now),
        expires_at: iso(now + DEFAULT_TTL_MS), backend_revision: lease ? lease.backend_revision + 1 : 1,
      };
      intent = {
        schema_version: 1, migration_id: migrationId, claim_path: absoluteClaim,
        backup_path, source_sha256: sourceDigest, backup_sha256: sourceDigest,
        repo_id: repoId, wi, worktree_root: canonicalWorktree, controller_principal: principal,
        source_generation: initialGeneration,
        prior_lease: lease ? { ...lease } : null,
        planned_lease: plannedLease, created_at: iso(now),
      };
      // Durable intent + backup precede the authority write. A crash after this
      // point can only forward-complete the exact recorded lease.
      atomicWrite(intentPath, intent);
    } else {
      const exactIntent = intent.schema_version === 1 && intent.migration_id === migrationId &&
        intent.claim_path === absoluteClaim && intent.backup_path === backup_path &&
        intent.source_sha256 === sourceDigest && intent.backup_sha256 === sourceDigest &&
        intent.repo_id === repoId && intent.wi === wi && intent.worktree_root === canonicalWorktree &&
        intent.controller_principal === principal && intent.source_generation === initialGeneration &&
        intent.planned_lease?.lease_id;
      if (!exactIntent) throw new Error("v1 migration intent does not match the current source tuple");
    }

    const planned = assertLease(intent.planned_lease, { repoId, wi });
    const leaseMatchesPlan = lease && lease.state === "active" &&
      lease.lease_id === planned.lease_id && lease.controller_principal === principal &&
      lease.worktree_root === canonicalWorktree && lease.generation === planned.generation;
    if (!leaseMatchesPlan) {
      const prior = intent.prior_lease;
      const stillAtPrior = prior && lease && lease.lease_id === prior.lease_id &&
        lease.generation === prior.generation && lease.state === prior.state &&
        lease.backend_revision === prior.backend_revision;
      if (lease && !stillAtPrior) throw new Error("controller lease conflicts with the durable v1 migration intent");
      if (!lease && prior) throw new Error("controller lease disappeared after v1 migration intent");
      atomicWrite(paths.lease, planned);
      lease = planned;
    }

    if (env.SVC_AUTHORITY_MIGRATION_FAILPOINT === "after-lease-before-receipt") {
      throw new Error("injected failpoint: after-lease-before-receipt");
    }

    const receipt = {
      schema_version: 1, migration_id: migrationId, claim_path: absoluteClaim, backup_path,
      source_sha256: sourceDigest, backup_sha256: sha256(fs.readFileSync(backup_path)),
      repo_id: repoId, wi, lease_id: lease.lease_id, intent_path: intentPath, migrated_at: iso(),
    };
    const existingReceipt = readJson(receipt_path);
    if (existingReceipt) {
      const exactReceipt = existingReceipt.schema_version === 1 && existingReceipt.migration_id === migrationId &&
        existingReceipt.claim_path === absoluteClaim && existingReceipt.backup_path === backup_path &&
        existingReceipt.source_sha256 === sourceDigest && existingReceipt.backup_sha256 === sourceDigest &&
        existingReceipt.repo_id === repoId && existingReceipt.wi === wi && existingReceipt.lease_id === lease.lease_id;
      if (!exactReceipt) throw new Error("v1 migration receipt conflicts with the durable migration intent");
    } else {
      atomicWrite(receipt_path, receipt);
    }
    return { lease, backup_path, receipt_path, resumed: Boolean(existingReceipt || leaseMatchesPlan) };
  });
}

export function rollbackV1Migration({ migrationReceiptPath }) {
  const absoluteReceipt = path.resolve(migrationReceiptPath);
  const receipt = readJson(absoluteReceipt, { required: true });
  const bytes = fs.readFileSync(receipt.backup_path);
  if (sha256(bytes) !== receipt.source_sha256 || sha256(bytes) !== receipt.backup_sha256) throw new Error("v1 migration backup digest mismatch");
  // Legacy receipts predate reversible controller-state rollback. Preserve
  // their byte-restore behavior, but new deterministic migrations must roll
  // back the exact v2 lease under the same authority lock as one transaction.
  if (!receipt.migration_id || !receipt.intent_path) {
    atomicWriteBytes(receipt.claim_path, bytes);
    return { restored: receipt.claim_path, sha256: receipt.source_sha256, controller_restored: false };
  }
  const intent = readJson(path.resolve(receipt.intent_path), { required: true });
  if (intent.migration_id !== receipt.migration_id || intent.claim_path !== receipt.claim_path ||
      intent.backup_path !== receipt.backup_path || intent.source_sha256 !== receipt.source_sha256 ||
      intent.repo_id !== receipt.repo_id || intent.wi !== receipt.wi ||
      intent.planned_lease?.lease_id !== receipt.lease_id) {
    throw new Error("v1 migration rollback intent/receipt mismatch");
  }
  const stateRoot = path.dirname(path.dirname(path.dirname(absoluteReceipt)));
  const paths = pathsFor(stateRoot, receipt.repo_id, receipt.wi);
  return withLock(paths.root, paths.key, () => {
    const current = readJson(paths.lease);
    const planned = assertLease(intent.planned_lease, { repoId: receipt.repo_id, wi: receipt.wi });
    const prior = intent.prior_lease ? assertLease(intent.prior_lease, { repoId: receipt.repo_id, wi: receipt.wi }) : null;
    const sameLease = (left, right) => Boolean(left && right &&
      left.lease_id === right.lease_id && left.generation === right.generation &&
      left.backend_revision === right.backend_revision && left.state === right.state &&
      left.controller_principal === right.controller_principal && left.worktree_root === right.worktree_root);
    const plannedCurrent = sameLease(current, planned);
    const alreadyRestored = prior ? sameLease(current, prior) : !current;
    if (!plannedCurrent && !alreadyRestored) throw new Error("controller lease changed after v1 migration; rollback denied");

    // Restore v1 bytes first. If the process stops before controller rollback,
    // v2 remains authoritative and an exact retry safely finishes the operation.
    atomicWriteBytes(receipt.claim_path, bytes);
    if (plannedCurrent) {
      if (prior) atomicWrite(paths.lease, prior);
      else durableUnlink(paths.lease);
    }
    return { restored: receipt.claim_path, sha256: receipt.source_sha256, controller_restored: true };
  });
}
