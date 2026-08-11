#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate } from "./json-schema-validator.mjs";
import { sameGenerationBindings, validateGenerationBindings } from "./generation-bindings-v2.mjs";
import { compileCapsule, compileExecutionGraph } from "../svc-execution-controller-v2.mjs";

const LEASE_SCHEMA = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../schemas/execution-lease-v2.schema.json", import.meta.url)), "utf8"));
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const ACTIVE = "ACTIVE";

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).filter((key) => value[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function digest(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stable(value)).digest("hex");
}

function canonicalTime(value) {
  if (typeof value !== "string" || !ISO_TIMESTAMP.test(value) || new Date(value).toISOString() !== value) throw new Error(`non-canonical timestamp ${value}`);
  return value;
}

function timestamp(value = new Date().toISOString()) {
  return canonicalTime(typeof value === "number" ? new Date(value).toISOString() : value);
}

function safeId(value, label) {
  if (typeof value !== "string" || !SAFE_ID.test(value)) throw new Error(`${label} is invalid`);
  return value;
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function checkedTtl(ttlMs) {
  if (!Number.isInteger(ttlMs) || ttlMs < 100 || ttlMs > 86_400_000) throw new Error("ttl_ms must be an integer between 100 and 86400000");
  return ttlMs;
}

function ensurePlainFile(file) {
  try {
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`refusing symlinked lease store ${file}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function secureStorePath(file) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  if (fs.realpathSync(path.dirname(resolved)) !== path.dirname(resolved)) throw new Error(`refusing symlinked lease store parent ${path.dirname(resolved)}`);
  ensurePlainFile(resolved);
  return resolved;
}

function atomicWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  ensurePlainFile(file);
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    const descriptor = fs.openSync(temporary, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    try { fs.writeFileSync(descriptor, content); fs.fsyncSync(descriptor); } finally { fs.closeSync(descriptor); }
    fs.renameSync(temporary, file);
    const directory = fs.openSync(path.dirname(file), fs.constants.O_RDONLY);
    try { fs.fsyncSync(directory); } finally { fs.closeSync(directory); }
  } finally {
    try { fs.unlinkSync(temporary); } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

function processAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; }
}

function clearAbandonedLock(lockDir) {
  const ownerPath = path.join(lockDir, "owner.json");
  let owner = null;
  try { owner = JSON.parse(fs.readFileSync(ownerPath, "utf8")); } catch {}
  if (owner && processAlive(owner.pid)) return false;
  if (!owner) {
    try { if (Date.now() - fs.statSync(lockDir).mtimeMs < 5000) return false; }
    catch { return false; }
  }
  try { fs.unlinkSync(ownerPath); } catch (error) { if (error.code !== "ENOENT") return false; }
  try { fs.rmdirSync(lockDir); return true; } catch { return false; }
}

function withStoreLock(storePath, action, options = {}) {
  storePath = secureStorePath(storePath);
  const lockDir = `${storePath}.lock`;
  const deadline = Date.now() + (options.lock_timeout_ms ?? 5000);
  fs.mkdirSync(path.dirname(storePath), { recursive: true, mode: 0o700 });
  while (true) {
    try {
      fs.mkdirSync(lockDir, { mode: 0o700 });
      fs.writeFileSync(path.join(lockDir, "owner.json"), `${JSON.stringify({ pid: process.pid, acquired_at: new Date().toISOString() })}\n`, { flag: "wx", mode: 0o600 });
      break;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (clearAbandonedLock(lockDir)) continue;
      if (Date.now() >= deadline) throw new Error("lease store lock busy");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  try { return action(); }
  finally {
    try { fs.unlinkSync(path.join(lockDir, "owner.json")); } catch (error) { if (error.code !== "ENOENT") throw error; }
    fs.rmdirSync(lockDir);
  }
}

export function validateExecutionLease(lease) {
  const errors = [...validate(LEASE_SCHEMA, lease).errors];
  const allowedFields = new Set([
    "schema_version", "run_id", "task_id", "task_revision", "capsule_digest", "principal_id",
    "generation", "generation_bindings", "lease_id", "status", "acquired_at", "heartbeat_at",
    "expires_at", "ttl_ms", "heartbeat_sequence", "predecessor_lease_id", "reclaim_reason",
    "closed_at", "close_reason"
  ]);
  for (const key of Object.keys(lease ?? {})) if (!allowedFields.has(key)) errors.push(`unknown lease field ${key}`);
  for (const field of ["run_id", "task_id", "principal_id"]) {
    if (typeof lease?.[field] !== "string" || !SAFE_ID.test(lease[field])) errors.push(`${field} is invalid`);
  }
  if (!Number.isInteger(lease?.task_revision) || lease.task_revision < 1) errors.push("task_revision must be a positive integer");
  if (!Number.isInteger(lease?.generation) || lease.generation < 1) errors.push("generation must be a positive integer");
  if (!Number.isInteger(lease?.heartbeat_sequence) || lease.heartbeat_sequence < 0) errors.push("heartbeat_sequence must be a non-negative integer");
  if (!Number.isInteger(lease?.ttl_ms) || lease.ttl_ms < 100 || lease.ttl_ms > 86_400_000) errors.push("ttl_ms must be an integer between 100 and 86400000");
  if (!SHA256.test(lease?.capsule_digest ?? "")) errors.push("capsule_digest must be lowercase sha256");
  if (!SHA256.test(lease?.lease_id ?? "")) errors.push("lease_id must be lowercase sha256");
  errors.push(...validateGenerationBindings(lease?.generation_bindings, "generation_bindings"));
  let acquired;
  let heartbeat;
  let expires;
  try { acquired = Date.parse(canonicalTime(lease?.acquired_at)); } catch (error) { errors.push(error.message); }
  try { heartbeat = Date.parse(canonicalTime(lease?.heartbeat_at)); } catch (error) { errors.push(error.message); }
  try { expires = Date.parse(canonicalTime(lease?.expires_at)); } catch (error) { errors.push(error.message); }
  if (Number.isFinite(acquired) && Number.isFinite(heartbeat) && heartbeat < acquired) errors.push("heartbeat_at precedes acquired_at");
  if (Number.isFinite(heartbeat) && Number.isFinite(expires) && expires !== heartbeat + lease.ttl_ms) errors.push("expires_at must equal heartbeat_at plus ttl_ms");
  if (lease?.generation === 1 && lease?.predecessor_lease_id !== null) errors.push("first lease cannot have a predecessor");
  if (lease?.generation === 1 && lease?.reclaim_reason !== null) errors.push("first lease cannot have a reclaim_reason");
  if (lease?.generation > 1 && !SHA256.test(lease?.predecessor_lease_id ?? "")) errors.push("reclaimed lease requires predecessor_lease_id");
  if (lease?.generation > 1 && !nonEmptyString(lease?.reclaim_reason)) errors.push("reclaimed lease requires reclaim_reason");
  if (lease?.status === ACTIVE && (lease?.closed_at !== null || lease?.close_reason !== null)) errors.push("active lease cannot have close fields");
  if (lease?.status !== ACTIVE) {
    try { canonicalTime(lease?.closed_at); } catch (error) { errors.push(`closed_at ${error.message}`); }
    if (!nonEmptyString(lease?.close_reason)) errors.push("closed lease requires close_reason");
  }
  const expectedId = errors.length === 0 ? digest({
    run_id: lease.run_id, task_id: lease.task_id, task_revision: lease.task_revision,
    capsule_digest: lease.capsule_digest, principal_id: lease.principal_id, generation: lease.generation,
    generation_bindings: lease.generation_bindings, acquired_at: lease.acquired_at,
    predecessor_lease_id: lease.predecessor_lease_id, reclaim_reason: lease.reclaim_reason
  }) : null;
  if (expectedId && expectedId !== lease.lease_id) errors.push("lease_id does not bind lease identity");
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

function emptyStore(runId) {
  return { schema_version: 2, run_id: safeId(runId, "run_id"), revision: 0, leases: [] };
}

function validateStore(store, expectedRunId) {
  const errors = [];
  if (store?.schema_version !== 2) errors.push("lease store schema_version must equal 2");
  if (store?.run_id !== expectedRunId) errors.push(`lease store run_id ${store?.run_id ?? "missing"} != ${expectedRunId}`);
  if (!Number.isInteger(store?.revision) || store.revision < 0) errors.push("lease store revision must be a non-negative integer");
  if (!Array.isArray(store?.leases)) errors.push("lease store leases must be an array");
  const identities = new Set();
  const activeTasks = new Set();
  for (const [index, lease] of (store?.leases ?? []).entries()) {
    const checked = validateExecutionLease(lease);
    errors.push(...checked.errors.map((error) => `leases[${index}] ${error}`));
    if (identities.has(lease.lease_id)) errors.push(`duplicate lease_id ${lease.lease_id}`);
    identities.add(lease.lease_id);
    if (lease.status === ACTIVE) {
      if (activeTasks.has(lease.task_id)) errors.push(`multiple active leases for task ${lease.task_id}`);
      activeTasks.add(lease.task_id);
    }
  }
  const tasks = new Map();
  for (const lease of store?.leases ?? []) {
    const rows = tasks.get(lease.task_id) ?? [];
    rows.push(lease);
    tasks.set(lease.task_id, rows);
  }
  for (const [taskId, rows] of tasks) {
    rows.sort((left, right) => left.generation - right.generation);
    for (const [index, lease] of rows.entries()) {
      if (lease.generation !== index + 1) errors.push(`task ${taskId} lease generations are not contiguous`);
      if (index > 0 && lease.predecessor_lease_id !== rows[index - 1].lease_id) errors.push(`task ${taskId} predecessor chain is broken at generation ${lease.generation}`);
      if (index > 0 && !sameGenerationBindings(lease.generation_bindings, rows[0].generation_bindings)) errors.push(`task ${taskId} generation bindings changed inside one run`);
    }
  }
  return { valid: errors.length === 0, errors: [...new Set(errors)].sort() };
}

export function readLeaseStore(storePath, runId) {
  safeId(runId, "run_id");
  storePath = secureStorePath(storePath);
  if (!fs.existsSync(storePath)) return emptyStore(runId);
  const store = JSON.parse(fs.readFileSync(storePath, "utf8"));
  const checked = validateStore(store, runId);
  if (!checked.valid) throw new Error(`invalid lease store: ${checked.errors.join("; ")}`);
  return store;
}

function persistStore(storePath, store) {
  storePath = secureStorePath(storePath);
  const checked = validateStore(store, store.run_id);
  if (!checked.valid) throw new Error(`refusing invalid lease store write: ${checked.errors.join("; ")}`);
  atomicWrite(storePath, `${JSON.stringify(store)}\n`);
}

function expireInPlace(store, nowIso) {
  const now = Date.parse(nowIso);
  const expired = [];
  for (const lease of store.leases) {
    if (lease.status !== ACTIVE || Date.parse(lease.expires_at) > now) continue;
    lease.status = "EXPIRED";
    lease.closed_at = nowIso;
    lease.close_reason = "heartbeat-expired";
    expired.push(lease.lease_id);
  }
  return expired;
}

function pathPrefix(pattern) {
  const wildcard = pattern.search(/[?*[]/);
  return wildcard < 0 ? pattern : pattern.slice(0, wildcard);
}

function patternsMayOverlap(left, right) {
  if (left === right) return true;
  const leftWild = /[?*[]/.test(left);
  const rightWild = /[?*[]/.test(right);
  if (!leftWild && !rightWild) return false;
  const a = pathPrefix(left);
  const b = pathPrefix(right);
  return a.startsWith(b) || b.startsWith(a);
}

function effectNamespace(kind) {
  if (kind.startsWith("filesystem_")) return "filesystem";
  if (new Set(["network_read", "provider_write", "paid_write", "deploy"]).has(kind)) return "external";
  return kind;
}

function effectWrites(kind) {
  return !new Set(["filesystem_read", "network_read"]).has(kind);
}

export function taskConflict(left, right) {
  if ((left.dependencies ?? []).includes(right.task_id) || (right.dependencies ?? []).includes(left.task_id)) {
    return { conflict: true, kind: "dependency", key: `${left.task_id}:${right.task_id}` };
  }
  const leftFiles = new Set((left.allowed_files ?? []).map((entry) => entry.path));
  const sharedFile = (right.allowed_files ?? []).map((entry) => entry.path).filter((entry) => leftFiles.has(entry)).sort()[0];
  if (sharedFile) return { conflict: true, kind: "file", key: sharedFile };
  const leftResources = new Map((left.resource_claims ?? []).map((claim) => [claim.key, claim.mode]));
  for (const claim of [...(right.resource_claims ?? [])].sort((a, b) => a.key.localeCompare(b.key))) {
    const mode = leftResources.get(claim.key);
    if (mode && (mode === "exclusive" || claim.mode === "exclusive")) return { conflict: true, kind: "resource", key: claim.key };
  }
  for (const a of left.effect_capabilities ?? []) {
    for (const b of right.effect_capabilities ?? []) {
      if (effectNamespace(a.kind) !== effectNamespace(b.kind) || (!effectWrites(a.kind) && !effectWrites(b.kind))) continue;
      for (const leftTarget of a.targets ?? []) {
        for (const rightTarget of b.targets ?? []) {
          if (patternsMayOverlap(leftTarget, rightTarget)) return { conflict: true, kind: "effect", key: `${effectNamespace(a.kind)}:${leftTarget}:${rightTarget}` };
        }
      }
    }
  }
  return { conflict: false, kind: null, key: null };
}

function newLease({ runId, capsule, capsuleDigest, principalId, generation, predecessor, reclaimReason, nowIso, ttlMs }) {
  const identity = {
    run_id: runId, task_id: capsule.task_id, task_revision: capsule.revision, capsule_digest: capsuleDigest,
    principal_id: principalId, generation, generation_bindings: capsule.generation_bindings, acquired_at: nowIso,
    predecessor_lease_id: predecessor?.lease_id ?? null, reclaim_reason: reclaimReason ?? null
  };
  return {
    schema_version: 2, ...identity, lease_id: digest(identity), status: ACTIVE,
    heartbeat_at: nowIso, expires_at: new Date(Date.parse(nowIso) + ttlMs).toISOString(), ttl_ms: ttlMs,
    heartbeat_sequence: 0, closed_at: null, close_reason: null
  };
}

function assertCapsule(capsule) {
  const compiled = compileCapsule(capsule);
  if (!compiled.valid) throw new Error(`invalid capsule: ${compiled.errors.join("; ")}`);
  return compiled;
}

function currentActive(store, taskId) {
  return store.leases.find((lease) => lease.task_id === taskId && lease.status === ACTIVE) ?? null;
}

function latestLease(store, taskId) {
  return store.leases.filter((lease) => lease.task_id === taskId).sort((a, b) => b.generation - a.generation)[0] ?? null;
}

function claimInPlace(store, input, nowIso) {
  const compiled = assertCapsule(input.capsule);
  const principalId = safeId(input.principal_id, "principal_id");
  const existing = currentActive(store, input.capsule.task_id);
  if (existing) {
    if (input.expected_predecessor_lease_id !== undefined && existing.predecessor_lease_id !== input.expected_predecessor_lease_id) {
      return { valid: false, errors: ["predecessor lease changed before reclaim"] };
    }
    const sameOwner = existing.principal_id === principalId && existing.capsule_digest === compiled.capsule_digest && sameGenerationBindings(existing.generation_bindings, input.capsule.generation_bindings);
    if (sameOwner) return { valid: true, idempotent: true, lease: existing };
    return { valid: false, errors: [`task ${input.capsule.task_id} already leased by ${existing.principal_id}`], conflict: existing };
  }
  const predecessor = latestLease(store, input.capsule.task_id);
  if (input.expected_predecessor_lease_id !== undefined && predecessor?.lease_id !== input.expected_predecessor_lease_id) {
    return { valid: false, errors: ["predecessor lease changed before reclaim"] };
  }
  if (predecessor && predecessor.status !== "EXPIRED" && predecessor.status !== "RELEASED" && predecessor.status !== "CANCELLED") {
    return { valid: false, errors: [`predecessor lease is ${predecessor.status}`] };
  }
  if (predecessor && !sameGenerationBindings(predecessor.generation_bindings, input.capsule.generation_bindings)) {
    return { valid: false, errors: ["capsule generation bindings changed inside one run"] };
  }
  const lease = newLease({
    runId: store.run_id, capsule: input.capsule, capsuleDigest: compiled.capsule_digest, principalId,
    generation: (predecessor?.generation ?? 0) + 1, predecessor,
    reclaimReason: predecessor ? (input.reclaim_reason ?? "deterministic-reclaim") : null,
    nowIso, ttlMs: checkedTtl(input.ttl_ms ?? 30_000)
  });
  const checkedLease = validateExecutionLease(lease);
  if (!checkedLease.valid) return { valid: false, errors: checkedLease.errors };
  store.leases.push(lease);
  return { valid: true, idempotent: false, reclaimed: Boolean(predecessor), lease };
}

export function claimTaskLease(input) {
  const nowIso = timestamp(input.now);
  return withStoreLock(input.store_path, () => {
    const store = readLeaseStore(input.store_path, input.run_id);
    const expired_lease_ids = expireInPlace(store, nowIso);
    const result = claimInPlace(store, input, nowIso);
    if (expired_lease_ids.length > 0 || (result.valid && !result.idempotent)) {
      store.revision += 1;
      persistStore(input.store_path, store);
    }
    return { ...result, expired_lease_ids, store_revision: store.revision };
  });
}

export function reclaimExpiredTaskLease(input) {
  if (typeof input.expected_predecessor_lease_id !== "string") throw new Error("expected_predecessor_lease_id is required for reclaim");
  return claimTaskLease({ ...input, reclaim_reason: input.reclaim_reason ?? "expired-heartbeat-reclaim" });
}

export function expireTaskLeases(input) {
  const nowIso = timestamp(input.now);
  return withStoreLock(input.store_path, () => {
    const store = readLeaseStore(input.store_path, input.run_id);
    const expired_lease_ids = expireInPlace(store, nowIso);
    if (expired_lease_ids.length > 0) { store.revision += 1; persistStore(input.store_path, store); }
    return { valid: true, expired_lease_ids, store_revision: store.revision };
  });
}

function findBoundActive(store, input) {
  const lease = currentActive(store, input.task_id);
  const errors = [];
  if (!lease) errors.push(`task ${input.task_id} has no active lease`);
  else {
    if (lease.lease_id !== input.lease_id) errors.push("lease_id does not own active task lease");
    if (lease.principal_id !== input.principal_id) errors.push("principal_id does not own active task lease");
    if (lease.generation !== input.generation) errors.push("lease generation is stale");
  }
  return { lease, errors };
}

export function heartbeatTaskLease(input) {
  const nowIso = timestamp(input.now);
  return withStoreLock(input.store_path, () => {
    const store = readLeaseStore(input.store_path, input.run_id);
    const expired = expireInPlace(store, nowIso);
    const { lease, errors } = findBoundActive(store, input);
    if (errors.length > 0) {
      if (expired.length > 0) { store.revision += 1; persistStore(input.store_path, store); }
      return { valid: false, errors, expired_lease_ids: expired };
    }
    if (Date.parse(nowIso) < Date.parse(lease.heartbeat_at)) return { valid: false, errors: ["heartbeat time moved backwards"] };
    lease.heartbeat_at = nowIso;
    lease.expires_at = new Date(Date.parse(nowIso) + lease.ttl_ms).toISOString();
    lease.heartbeat_sequence += 1;
    store.revision += 1;
    persistStore(input.store_path, store);
    return { valid: true, lease, store_revision: store.revision };
  });
}

export function closeTaskLease(input) {
  const nowIso = timestamp(input.now);
  if (!new Set(["RELEASED", "CANCELLED"]).has(input.status)) throw new Error("lease close status must be RELEASED or CANCELLED");
  return withStoreLock(input.store_path, () => {
    const store = readLeaseStore(input.store_path, input.run_id);
    const expired = expireInPlace(store, nowIso);
    const { lease, errors } = findBoundActive(store, input);
    if (errors.length > 0) {
      if (expired.length > 0) { store.revision += 1; persistStore(input.store_path, store); }
      return { valid: false, errors, expired_lease_ids: expired };
    }
    lease.status = input.status;
    lease.closed_at = nowIso;
    lease.close_reason = input.reason ?? input.status.toLowerCase();
    store.revision += 1;
    persistStore(input.store_path, store);
    return { valid: true, lease, store_revision: store.revision };
  });
}

function criticalBudgets(capsules, completed) {
  const children = new Map(capsules.map((capsule) => [capsule.task_id, []]));
  const byId = new Map(capsules.map((capsule) => [capsule.task_id, capsule]));
  for (const capsule of capsules) for (const dependency of capsule.dependencies) children.get(dependency).push(capsule.task_id);
  const memo = new Map();
  const visit = (taskId) => {
    if (memo.has(taskId)) return memo.get(taskId);
    if (completed.has(taskId)) return 0;
    const downstream = children.get(taskId).filter((child) => !completed.has(child)).map(visit);
    const value = byId.get(taskId).active_budget_seconds + (downstream.length ? Math.max(...downstream) : 0);
    memo.set(taskId, value);
    return value;
  };
  for (const capsule of capsules) visit(capsule.task_id);
  return memo;
}

export function claimReadyTaskLeases(input) {
  const graph = compileExecutionGraph(input.capsules);
  if (!graph.valid) return graph;
  const completed = new Set(input.completed_task_ids ?? []);
  const known = new Set(input.capsules.map((capsule) => capsule.task_id));
  const unknown = [...completed].filter((taskId) => !known.has(taskId));
  if (unknown.length) return { valid: false, errors: [`unknown completed tasks: ${unknown.sort().join(",")}`] };
  const maxActive = input.max_active ?? 4;
  if (!Number.isInteger(maxActive) || maxActive < 1) return { valid: false, errors: ["max_active must be a positive integer"] };
  const nowIso = timestamp(input.now);
  return withStoreLock(input.store_path, () => {
    const store = readLeaseStore(input.store_path, input.run_id);
    const expired_lease_ids = expireInPlace(store, nowIso);
    const byId = new Map(input.capsules.map((capsule) => [capsule.task_id, capsule]));
    const activeLeases = store.leases.filter((lease) => lease.status === ACTIVE);
    const unknownActive = activeLeases.filter((lease) => !byId.has(lease.task_id)).map((lease) => lease.task_id);
    const completedActive = activeLeases.filter((lease) => completed.has(lease.task_id)).map((lease) => lease.task_id);
    if (unknownActive.length > 0 || completedActive.length > 0) {
      if (expired_lease_ids.length > 0) { store.revision += 1; persistStore(input.store_path, store); }
      const errors = [];
      if (unknownActive.length > 0) errors.push(`active leases reference unknown tasks: ${unknownActive.sort().join(",")}`);
      if (completedActive.length > 0) errors.push(`completed tasks retain active leases: ${completedActive.sort().join(",")}`);
      return { valid: false, errors };
    }
    const active = activeLeases.map((lease) => byId.get(lease.task_id));
    const critical = criticalBudgets(input.capsules, completed);
    const candidates = input.capsules.filter((capsule) => !completed.has(capsule.task_id) && !currentActive(store, capsule.task_id) && capsule.dependencies.every((dependency) => completed.has(dependency)))
      .sort((left, right) => critical.get(right.task_id) - critical.get(left.task_id) || left.parallel_policy.merge_order_key.localeCompare(right.parallel_policy.merge_order_key) || left.task_id.localeCompare(right.task_id));
    const claimed = [];
    const deferred = [];
    for (const capsule of candidates) {
      if (active.length + claimed.length >= maxActive) { deferred.push({ task_id: capsule.task_id, reason: "parallel-capacity" }); continue; }
      if (capsule.parallel_policy.eligible === false && active.length + claimed.length > 0) { deferred.push({ task_id: capsule.task_id, reason: `serial:${capsule.parallel_policy.serialization_reason}` }); continue; }
      const peers = [...active, ...claimed.map((entry) => entry.capsule)];
      const serialPeer = peers.find((peer) => peer.parallel_policy.eligible === false);
      if (serialPeer) { deferred.push({ task_id: capsule.task_id, reason: `serial-peer:${serialPeer.task_id}` }); continue; }
      const conflict = peers.map((peer) => ({ peer, result: taskConflict(capsule, peer) })).find((entry) => entry.result.conflict);
      if (conflict) { deferred.push({ task_id: capsule.task_id, reason: `${conflict.result.kind}:${conflict.result.key};with:${conflict.peer.task_id}` }); continue; }
      const principalId = input.principals?.[capsule.task_id];
      if (!principalId) { deferred.push({ task_id: capsule.task_id, reason: "missing-principal" }); continue; }
      const result = claimInPlace(store, { capsule, principal_id: principalId, ttl_ms: input.ttl_ms }, nowIso);
      if (!result.valid) { deferred.push({ task_id: capsule.task_id, reason: result.errors.join(";") }); continue; }
      claimed.push({ capsule, lease: result.lease, reclaimed: result.reclaimed });
    }
    if (expired_lease_ids.length > 0 || claimed.length > 0) { store.revision += 1; persistStore(input.store_path, store); }
    return {
      valid: true, errors: [], claimed_leases: claimed.map((entry) => entry.lease),
      claimed_task_ids: claimed.map((entry) => entry.capsule.task_id), deferred,
      active_task_ids: store.leases.filter((lease) => lease.status === ACTIVE).map((lease) => lease.task_id).sort(),
      deterministic_merge_order: graph.merge_task_order.filter((taskId) => claimed.some((entry) => entry.capsule.task_id === taskId)),
      expired_lease_ids, store_revision: store.revision
    };
  });
}
