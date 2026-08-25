import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { freezeDelegations } from "./delegation-authority.mjs";
import { normalizeClaimOwner } from "./claim-owner.mjs";
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
  fs.mkdirSync(absolute, { recursive: true, mode: 0o700 });
  assertNoFollowDirectoryPath(absolute, { requireFinalOwner: true });
  fs.chmodSync(absolute, 0o700);
  const stat = fs.lstatSync(absolute);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe authority directory: ${dir}`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`foreign authority directory: ${dir}`);
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
}

function atomicWriteBytes(file, bytes) {
  ensureDir(path.dirname(file));
  const temp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomUUID()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  fs.chmodSync(file, 0o600);
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
      if (existing.state === "active") throw new Error("active controller lease already exists; use resume or handover");
    }
    const lease = {
      schema_version: 2, lease_id: crypto.randomUUID(), repo_id: repoId, wi,
      worktree_root: canonicalWorktree, controller_principal: principal,
      generation: existing ? existing.generation + 1 : initialGeneration, state: "active",
      owner_process: ownerProcessIdentity(),
      issued_at: iso(now), renewed_at: iso(now), expires_at: iso(now + ttlMs),
      backend_revision: existing ? existing.backend_revision + 1 : 1,
    };
    atomicWrite(paths.lease, lease);
    return lease;
  });
}

export function resumeController({ stateRoot, repoId, wi, worktreeRoot, principal, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    if (lease.state !== "active") throw new Error("controller lease is not active");
    if (lease.controller_principal !== principal) throw new Error("controller principal mismatch");
    if (fs.realpathSync(worktreeRoot) !== fs.realpathSync(lease.worktree_root)) throw new Error("controller worktree mismatch");
    // WI-562 IP-H6: resume consumes handoff RECORDS, not prose. The newest
    // normalized record must agree with the live lease; disagreement means the
    // on-disk authority state is ambiguous — refuse with actionable detail.
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

function verifyLatestHandoffRecord(paths, lease) {
  const dir = path.join(paths.receipts, "handoff");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return null; }
  if (files.length === 0) return null;
  // WI-562 round-5 review: order by the record's OWN ts (UUID filenames are
  // unordered); unreadable records refuse loudly rather than being skipped.
  const stamped = [];
  for (const f of files) {
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); }
    catch (e) { throw new Error(`resume refused: handoff record unreadable (${f}: ${e.message})`); }
    // WI-562 round-5: records are namespaced per lease — only THIS repo+wi's
    // records participate in the latest-check; unrelated/corrupt-for-other-WI
    // records cannot block an unrelated resume.
    if (parsed.repo_id !== lease.repo_id || parsed.wi !== lease.wi) continue;
    if (!Number.isFinite(Date.parse(parsed.ts))) {
      throw new Error(`resume refused: own handoff record has invalid ts (${f})`);
    }
    stamped.push({ f, ts: Date.parse(parsed.ts), record: parsed });
  }
  if (stamped.length === 0) return null; // no own records: nothing to verify
  stamped.sort((a, b) => a.ts - b.ts);
  const latestPath = path.join(dir, stamped[stamped.length - 1].f);
  let record;
  try { record = JSON.parse(fs.readFileSync(latestPath, "utf8")); }
  catch (e) { throw new Error(`resume refused: latest handoff record unreadable (${latestPath}: ${e.message})`); }
  if (Number(record.generation) !== Number(lease.generation)) {
    throw new Error(`resume refused: handoff record generation ${record.generation} != lease generation ${lease.generation} (${latestPath})`);
  }
  if (String(record.principal) !== String(lease.controller_principal)) {
    throw new Error(`resume refused: handoff record principal differs from live controller principal (${latestPath})`);
  }
  return record;
}

export function prepareHandover({ stateRoot, repoId, wi, principal, intendedPrincipal = null, ttlMs = 15 * 60_000, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
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
  const file = path.join(paths.receipts, `${receipt.completed_at.replace(/[:.]/g, "-")}-${receipt.receipt_id}.json`);
  atomicWrite(file, receipt);
  return file;
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
  const file = path.join(paths.receipts, "handoff", `${record.record_id}.json`);
  atomicWrite(file, record);
  return file;
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
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    const handover = readJson(paths.handover, { required: true });
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
  return withLock(paths.root, paths.key, () => {
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    let handover;
    try { handover = readJson(paths.handover, { required: true }); }
    catch (e) { throw new Error(`finalizeHandover: no handover record (${e.message})`); }
    if (handover.status !== "prepared") return { completed: false, reason: "handover already consumed" };
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
    const receipt = {
      schema_version: 1, receipt_id: crypto.randomUUID(), kind: "handover", lease_id: lease.lease_id,
      repo_id: repoId, wi, old_controller_principal: String(handover.source_principal || ""),
      new_controller_principal: lease.controller_principal,
      old_generation: Number(handover.expected_generation), new_generation: lease.generation,
      evidence: { handover_id: handover.handover_id, finalized_forward: true, frozen_delegations }, completed_at: iso(now),
    };
    const receipt_path = writeLifecycleReceipt(paths, receipt);
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
    atomicWrite(paths.handover, { ...handover, status: "consumed", consumed_at: iso(now), finalized_forward: true });
    return { completed: true, receipt, receipt_path, frozen_delegations };
  });
}

// Explicit user-directed takeover. This never inspects, signals, or terminates
// the previous process. Exact owner + generation + backend lock provide CAS.
export function takeoverController({ stateRoot, repoId, wi, principal, expectedPrincipal, expectedGeneration, reason, ttlMs = 15 * 60_000, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  if (!String(reason || "").trim()) throw new Error("explicit takeover requires a reason");
  if (!Number.isInteger(Number(expectedGeneration)) || Number(expectedGeneration) < 1) throw new Error("explicit takeover requires the observed generation");
  return withLock(paths.root, paths.key, () => {
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    if (lease.state !== "active") throw new Error("controller lease is not active");
    if (lease.controller_principal !== String(expectedPrincipal || "")) throw new Error("takeover owner compare-and-swap mismatch");
    if (lease.generation !== Number(expectedGeneration)) throw new Error("takeover generation compare-and-swap mismatch");
    const next = { ...lease, controller_principal: principal, generation: lease.generation + 1,
      owner_process: ownerProcessIdentity(), renewed_at: iso(now), expires_at: iso(now + ttlMs), backend_revision: lease.backend_revision + 1 };
    atomicWrite(paths.lease, next);
    const frozen_delegations = freezeOldGenerationDelegations(paths.root, lease.lease_id, lease.generation, now);
    const receipt = { schema_version: 1, receipt_id: crypto.randomUUID(), kind: "explicit_takeover", lease_id: lease.lease_id,
      repo_id: repoId, wi, old_controller_principal: lease.controller_principal, new_controller_principal: principal,
      old_generation: lease.generation, new_generation: next.generation,
      evidence: { reason: String(reason).trim(), frozen_delegations }, completed_at: iso(now) };
    const receipt_path = writeLifecycleReceipt(paths, receipt);
    writeHandoffRecord(paths, {
      kind: "explicit_takeover", wi, repo_id: repoId, lease_id: lease.lease_id,
      generation: next.generation, old_generation: lease.generation,
      principal, predecessor_principal: lease.controller_principal,
      worktree_realpath: lease.worktree_root || "",
      base_sha: typeof lease.base_sha === "string" ? lease.base_sha : "",
      ttl_ms: ttlMs,
      evidence_digests: digestEvidence({ reason: String(reason).trim(), frozen_delegations }),
      ts: iso(now),
    });
    return { lease: next, receipt, receipt_path };
  });
}

export function recoverController({ stateRoot, repoId, wi, principal, reason, evidence = {}, ttlMs = DEFAULT_TTL_MS, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    if (lease.state !== "active") throw new Error("controller lease is not active");
    const ownerAlive = processIsAlive(lease.owner_process);
    if (evidence.owner_live === true || ownerAlive === true) throw new Error("a provably live owner cannot be displaced");
    const expired = evidence.expired === true && Date.parse(lease.expires_at) <= now;
    const sameHostDead = evidence.same_host_dead === true && ownerAlive === false;
    if (!expired && !sameHostDead) throw new Error("recovery requires positive dead-owner evidence or lease expiry");
    const next = {
      ...lease, controller_principal: principal, generation: lease.generation + 1,
      owner_process: ownerProcessIdentity(),
      renewed_at: iso(now), expires_at: iso(now + ttlMs), backend_revision: lease.backend_revision + 1,
    };
    atomicWrite(paths.lease, next);
    const frozen_delegations = freezeOldGenerationDelegations(paths.root, lease.lease_id, lease.generation, now);
    const receipt = {
      schema_version: 1, receipt_id: crypto.randomUUID(), kind: "recovery", lease_id: lease.lease_id,
      repo_id: repoId, wi, old_controller_principal: lease.controller_principal,
      new_controller_principal: principal, old_generation: lease.generation,
      new_generation: next.generation, evidence: { ...evidence, reason: requireString(reason, "recovery reason"), frozen_delegations }, completed_at: iso(now),
    };
    const receipt_path = writeLifecycleReceipt(paths, receipt);
    writeHandoffRecord(paths, {
      kind: "recovery", wi, repo_id: repoId, lease_id: lease.lease_id,
      generation: next.generation, old_generation: lease.generation,
      principal, predecessor_principal: lease.controller_principal,
      worktree_realpath: lease.worktree_root || "",
      base_sha: typeof lease.base_sha === "string" ? lease.base_sha : "",
      ttl_ms: ttlMs,
      evidence_digests: digestEvidence({ ...evidence, reason: requireString(reason, "recovery reason"), frozen_delegations }),
      ts: iso(now),
    });
    return { lease: next, receipt, receipt_path };
  });
}

export function releaseController({ stateRoot, repoId, wi, principal, now = Date.now() }) {
  const paths = pathsFor(stateRoot, repoId, wi);
  return withLock(paths.root, paths.key, () => {
    const lease = assertLease(readJson(paths.lease, { required: true }), { repoId, wi });
    if (lease.state !== "active" || lease.controller_principal !== principal) throw new Error("only the active controller principal may release authority");
    const released = { ...lease, state: "released", renewed_at: iso(now), expires_at: iso(now), backend_revision: lease.backend_revision + 1 };
    atomicWrite(paths.lease, released);
    freezeOldGenerationDelegations(paths.root, lease.lease_id, lease.generation, now);
    // WI-562 IP-H6: release transitions were previously invisible to the record
    // stream (no lifecycle receipt existed); the normalized record closes that.
    writeHandoffRecord(paths, {
      kind: "release", wi, repo_id: repoId, lease_id: lease.lease_id,
      generation: lease.generation, old_generation: lease.generation,
      principal, predecessor_principal: lease.controller_principal,
      worktree_realpath: lease.worktree_root || "",
      base_sha: typeof lease.base_sha === "string" ? lease.base_sha : "",
      ttl_ms: Math.max(1, Date.parse(lease.expires_at) - now),
      evidence_digests: digestEvidence({ released: true }),
      ts: iso(now),
    });
    return released;
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

export function migrateV1Claim({ stateRoot, claimPath, repoId, worktreeRoot, host, env = process.env }) {
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
    // Compatibility path for controller-v2 leases created before deterministic
    // v1 migration intents existed. The exact same principal/worktree/generation
    // is already authoritative, so resume it without fabricating retroactive
    // migration evidence or creating an orphan backup directory. Any mismatch
    // remains a conflict and fails before migration state is written.
    let intent = readJson(intentPath);
    let lease = readJson(paths.lease);
    if (lease) lease = assertLease(lease, { repoId, wi });
    if (!intent && lease?.state === "active") {
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
      else {
        fs.unlinkSync(paths.lease);
        try { const fd = fs.openSync(path.dirname(paths.lease), "r"); fs.fsyncSync(fd); fs.closeSync(fd); } catch {}
      }
    }
    return { restored: receipt.claim_path, sha256: receipt.source_sha256, controller_restored: true };
  });
}
