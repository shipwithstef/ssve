#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { WI_ID_RE } from "./wi-id.mjs";
import {
  authorityStateRoot,
  principalId,
  readController,
  repositoryId,
  withControllerLeaseLock,
} from "./authority-store.mjs";
import { normalizeClaimOwner, sessionShaped } from "./claim-owner.mjs";

export { normalizeClaimOwner };

const DEFAULT_TTL_HOURS = 24;
const READ_ONLY_ROLES = new Set(["reviewer", "research", "audit"]);

function findSvcDir(startDir = process.cwd()) {
  let dir = path.resolve(startDir || process.cwd());
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, ".svc");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

function isProcessAlive(pid) {
  if (!Number.isInteger(Number(pid)) || Number(pid) <= 0) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    // ESRCH => no such process (dead). EPERM => the process EXISTS but is owned
    // by another user (alive/uncertain — never a death proof). WI-486 EXEC-004.
    return error && error.code === "EPERM";
  }
}

// --- WI-486 (task-3): process identity + cross-worktree live-WI inspection -----
// The bootstrap recovery/liveness algorithm needs to tell a still-running owner
// process apart from a dead one whose PID has since been reused. A raw PID probe
// cannot: `kill(pid,0)` succeeds for ANY live process at that number. We bind the
// PID to its start time (host:pid:btime) so a reused PID no longer matches.

// Read field 22 (starttime, clock ticks since boot) from /proc/<pid>/stat. The
// comm field (2) may itself contain spaces and parentheses, so we split AFTER the
// last ')' — every field past that point is single-token and positional.
function readProcStartTime(pid) {
  try {
    const raw = fs.readFileSync(`/proc/${Number(pid)}/stat`, "utf8");
    const close = raw.lastIndexOf(")");
    if (close < 0) return "";
    const rest = raw.slice(close + 2).trim().split(/\s+/);
    // rest[0] is field 3 (state); starttime is field 22 -> index 22 - 3 = 19.
    const starttime = rest[19];
    return /^\d+$/.test(String(starttime || "")) ? String(starttime) : "";
  } catch {
    return "";
  }
}

// Stable per-live-process token: host:pid:btime. Empty when btime is unavailable
// (non-Linux / no /proc) — callers must then fail-closed to LIVE, never reclaim.
export function processStartToken(pid = process.pid) {
  const btime = readProcStartTime(pid);
  if (!btime) return "";
  return `${os.hostname()}:${Number(pid)}:${btime}`;
}

// "dead" (reclaimable) | "alive" (must not reclaim). Fail-closed to "alive" for
// every uncertainty, so a probe we cannot evaluate never authorizes deletion.
// Only a positive death proof returns "dead": ESRCH (no such process) or a
// start-token mismatch (the recorded process is gone; this PID was reused).
export function processIdentity(pid, expectedToken) {
  const n = Number(pid);
  if (!Number.isInteger(n) || n <= 0) return "alive"; // malformed identity -> uncertain -> LIVE
  if (!isProcessAlive(n)) return "dead";               // ESRCH -> dead (EPERM is treated as alive)
  const current = processStartToken(n);
  if (!current || !expectedToken) return "alive"; // uncertain -> LIVE (never reclaim)
  return current === String(expectedToken) ? "alive" : "dead"; // mismatch == PID reuse
}

// Scan every linked worktree for a FRESH (attributable, non-released, non-stale)
// claim owning `wi`. Diagnostic input to the bootstrap same-WI conflict scan; it
// returns a plain object (never grants authority by itself). `excludeSession`
// skips the caller's own claims so a resume is not treated as a foreign conflict.
export function liveSameWiOwner(worktreeRoot, wi, opts = {}) {
  const excludeSession = String(opts.excludeSession || "");
  try {
    const rows = execFileSync("git", ["-C", worktreeRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter((line) => line.startsWith("worktree "))
      .map((line) => line.slice("worktree ".length));
    for (const candidate of rows) {
      let root;
      try { root = fs.realpathSync(candidate); } catch { continue; }
      const claimPath = path.join(root, ".svc", "claims", `${wi}.claim.json`);
      const claim = readClaimAbsolute(claimPath);
      if (!claim || claim.released_at) continue;
      const owner = normalizeClaimOwner(claim);
      if (!owner.attributable) continue;
      if (excludeSession && owner.session_id === excludeSession) continue;
      if (!isClaimStale(claim)) {
        return { live: true, wi, owner: owner.session_id, worktree: root, claim_path: claimPath, claim };
      }
    }
  } catch { /* no linked worktrees / git unavailable -> no live owner */ }
  return null;
}

// Selective release: remove ONLY the given absolute paths, in reverse creation
// order (binding -> claim -> graph -> worktree). Directories are removed
// recursively; missing paths are skipped. Never follows a symlinked directory
// into an unrelated tree. Returns the paths actually removed.
//
// WI-486 (EXEC-003): deletion is fail-closed by containment. When a
// `containmentRoot` is supplied, ONLY the root itself or a path strictly inside
// it is ever removed — an entry that escapes the root is skipped, never deleted.
// This prevents a forged/stale marker ledger from directing recursive removal at
// an arbitrary absolute path.
export function removeCreatedPaths(paths = [], opts = {}) {
  const root = opts.containmentRoot ? path.resolve(String(opts.containmentRoot)) : null;
  const removed = [];
  for (const p of [...paths].reverse()) {
    const abs = path.resolve(String(p));
    if (root) {
      const rel = path.relative(root, abs);
      const contained = abs === root || (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel));
      if (!contained) continue; // out-of-root entry: never delete
    }
    try {
      const stat = fs.lstatSync(abs);
      if (stat.isDirectory() && !stat.isSymbolicLink()) {
        fs.rmSync(abs, { recursive: true, force: true });
      } else {
        fs.rmSync(abs, { force: true });
      }
      removed.push(abs);
    } catch { /* already gone / inaccessible -> skip */ }
  }
  return removed;
}

// WI-486 (EXEC-004): claim freshness is process-identity-first, not TTL-first.
//
//   - A same-host claim that carries a live process identity (pid+start-token)
//     is NEVER expired by TTL — a LIVE owner working past the 24h window can no
//     longer be preempted. Only proven death (ESRCH or a start-token mismatch =
//     PID reuse) makes it reclaimable. An empty/uncertain start-token
//     (non-Linux, /proc unavailable) fails CLOSED to LIVE (never stale), so a
//     probe we cannot evaluate never authorizes transfer.
//   - TTL governs ONLY claims that cannot be process-probed locally: cross-host
//     claims, and legacy/identity-less claims with no recorded pid.
export function isClaimStale(claim, now = Date.now()) {
  if (!claim || typeof claim !== "object") return true;
  if (claim.released_at) return true;
  const started = Date.parse(claim.renewed_at || claim.started_at || "");
  if (!Number.isFinite(started)) return true;
  const ttlHours = Number(claim.ttl_hours || DEFAULT_TTL_HOURS);
  if (!Number.isFinite(ttlHours) || ttlHours <= 0) return true;

  const hasHostname = Boolean(claim.hostname);
  const sameHost = hasHostname ? String(claim.hostname) === os.hostname() : Boolean(claim.pid);

  if (sameHost && claim.pid) {
    // Identity governs; TTL is IGNORED while the exact process is live/uncertain.
    return processIdentity(claim.pid, claim.process_start_token) === "dead";
  }
  // WI-486 (EXEC-R2-005): a same-host claim WITHOUT a probeable process identity
  // (hostname recorded but no pid) is NO LONGER "fresh forever". The EXEC-004
  // compromise — recording a pid only when SVC_OWNER_PID is supplied, and treating
  // every other same-host claim as uncertain-LIVE regardless of age — left a
  // crashed/abandoned same-host session PERMANENTLY unreclaimable, wedging
  // generation-bound transfer and sibling bootstrap forever. Instead we fall back
  // to the claim's OWN renewal heartbeat under TTL: the claim's `renewed_at` is
  // refreshed by every claim write an active session performs, so a LIVE owner that
  // renews within its TTL is never preempted, while a DEAD owner stops renewing and
  // becomes reclaimable once TTL elapses. This does NOT reintroduce the ephemeral
  // CLI-pid false-dead bug (no pid is probed here) and preserves the invariant: a
  // live owner is never preempted, a dead owner is always eventually reclaimable.
  return now - started > ttlHours * 3_600_000;
}

export function claimFreshness(claim, claimPath = "", now = Date.now()) {
  const owner = normalizeClaimOwner(claim);
  const stale = isClaimStale(claim, now);
  let secure = true;
  if (claimPath) {
    try {
      const stat = fs.lstatSync(path.resolve(claimPath));
      secure = stat.isFile() && !stat.isSymbolicLink() &&
        (typeof process.getuid !== "function" || stat.uid === process.getuid());
    } catch {
      secure = false;
    }
  }
  return {
    fresh: secure && owner.attributable && !stale,
    stale,
    secure,
    owner,
    reason: !secure ? "insecure claim path" : !owner.attributable ? "unattributable owner" : stale ? "stale claim" : "fresh claim",
  };
}

export function readClaimAbsolute(claimPath) {
  if (!path.isAbsolute(String(claimPath || ""))) return null;
  try {
    const absolute = path.resolve(claimPath);
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink()) return null;
    if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return null;
    const parsed = JSON.parse(fs.readFileSync(absolute, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function ensureOwnedDirectory(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe state directory: ${dir}`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) throw new Error(`foreign-owned state directory: ${dir}`);
}

function atomicWriteJson(file, value) {
  const absolute = path.resolve(file);
  ensureOwnedDirectory(path.dirname(absolute));
  const temp = path.join(path.dirname(absolute), `.${path.basename(absolute)}.${process.pid}.${Date.now()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(temp, absolute);
  fs.chmodSync(absolute, 0o600);
  try {
    const dfd = fs.openSync(path.dirname(absolute), "r");
    fs.fsyncSync(dfd);
    fs.closeSync(dfd);
  } catch {}
}

function gitLock(repoRoot, args, options = {}) {
  return execFileSync("git", ["-C", repoRoot, ...args], {
    encoding: "utf8",
    input: options.input,
    stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", options.stderr === false ? "ignore" : "pipe"],
  }).trim();
}

function lockRepository(anchor) {
  const absolute = path.resolve(anchor || process.cwd());
  return fs.realpathSync(gitLock(absolute, ["rev-parse", "--show-toplevel"]));
}

export function authorityLockRef(identity) {
  const key = crypto.createHash("sha256").update(String(identity)).digest("hex");
  return `refs/svc/authority-locks/${key}`;
}

function zeroObjectId(repoRoot) {
  const format = gitLock(repoRoot, ["rev-parse", "--show-object-format"]);
  return "0".repeat(format === "sha256" ? 64 : 40);
}

const PROCESS_LOCK_HOLDER = Object.freeze({
  schema_version: 1,
  hostname: os.hostname(),
  pid: process.pid,
  process_start_token: processStartToken(process.pid),
});

function writeLockHolder(repoRoot) {
  // Stable bytes let Git reuse one blob for every lock held by this process.
  const holder = PROCESS_LOCK_HOLDER;
  const oid = gitLock(repoRoot, ["hash-object", "-w", "--stdin"], { input: `${JSON.stringify(holder)}\n` });
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(oid)) throw new Error("git returned an invalid authority-lock object id");
  return { holder, oid };
}

function readLockRef(repoRoot, ref) {
  let oid;
  try { oid = gitLock(repoRoot, ["rev-parse", "--verify", "--end-of-options", ref], { stderr: false }); }
  catch { return null; }
  if (!/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(oid)) return { oid, holder: null };
  try {
    if (gitLock(repoRoot, ["cat-file", "-t", oid]) !== "blob") return { oid, holder: null };
    const holder = JSON.parse(gitLock(repoRoot, ["cat-file", "blob", oid]));
    return { oid, holder };
  } catch {
    return { oid, holder: null };
  }
}

function updateLockRef(repoRoot, ref, nextOid, expectedOid) {
  try {
    gitLock(repoRoot, ["update-ref", "--no-deref", ref, nextOid, expectedOid], { stderr: false });
    return true;
  } catch {
    return false;
  }
}

function holderIsProvablyDead(holder) {
  if (!holder || typeof holder !== "object") return false;
  if (String(holder.hostname || "") !== os.hostname()) return false;
  if (!holder.pid) return false;
  // On hosts without /proc the start token is unavailable, but ESRCH is still
  // a positive death proof. processIdentity checks ESRCH before it fails closed
  // on a missing token, so dead PIDs remain recoverable while a live/reused PID
  // with no token is never preempted.
  return processIdentity(holder.pid, holder.process_start_token) === "dead";
}

export function withExclusiveLock(identity, operation, anchor = process.cwd()) {
  // Correctness locks are Git compare-and-swap refs, not runtime files. Git's
  // update-ref transaction makes acquisition, proven-dead takeover, and release
  // conditional on the exact prior object id, so delayed contenders cannot
  // delete or replace a freshly acquired lock. The ref namespace is shared by
  // every linked worktree and cannot split under per-process runtime overrides.
  let repoRoot;
  try {
    repoRoot = lockRepository(anchor);
  } catch (error) {
    return {
      ok: false,
      lock_error: true,
      warning: `authority lock requires a readable local Git repository at ${path.resolve(anchor || process.cwd())}: ${error.message}`,
    };
  }
  const ref = authorityLockRef(identity);
  let candidate = null;
  let zero;
  try {
    zero = zeroObjectId(repoRoot);
  } catch (error) {
    return { ok: false, lock_error: true, ref, warning: `authority lock cannot determine the Git object format: ${error.message}` };
  }
  let acquired = false;
  let observed = null;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const current = readLockRef(repoRoot, ref);
    observed = current;
    // Live or malformed contention is observation-only: it does not create an
    // unreachable Git object. Exact-OID CAS prevents a delayed takeover race,
    // but malformed bytes still do not prove the current owner dead, so only an
    // independently verified operator may remove that ref.
    if (current && !current.holder) {
      return {
        ok: false, lock_error: true, corrupt_holder: true, ref,
        observed_oid: current.oid,
        warning: `authority lock holder is malformed at ${ref} oid=${current.oid}. If no critical section is live and death is independently verified, recover exactly with: git update-ref --no-deref -d ${ref} ${current.oid}`,
      };
    }
    if (!current || holderIsProvablyDead(current.holder)) {
      try { candidate ||= writeLockHolder(repoRoot); }
      catch (error) {
        return { ok: false, lock_error: true, ref, warning: `authority lock cannot write its holder object: ${error.message}` };
      }
      acquired = updateLockRef(repoRoot, ref, candidate.oid, current?.oid || zero);
    }
    if (acquired) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
  }
  if (!acquired) {
    const holder = observed?.holder || {};
    const observedOid = observed?.oid || "unknown";
    return {
      ok: false,
      lock_busy: true,
      ref,
      observed_oid: observedOid,
      holder,
      warning: `binding state is busy at ${ref}; holder hostname=${holder.hostname || "unknown"} pid=${holder.pid || "unknown"} oid=${observedOid}. Retry after the holder exits. If its death is independently verified, recover exactly with: git update-ref --no-deref -d ${ref} ${observedOid}`,
    };
  }
  let operationResult;
  try {
    operationResult = operation();
  } catch (operationError) {
    // Preserve the operation's exception, but still make the best exact-OID
    // release attempt. A release failure cannot turn an exception into success.
    try { gitLock(repoRoot, ["update-ref", "--no-deref", "-d", ref, candidate.oid], { stderr: false }); } catch {}
    throw operationError;
  }
  try {
    gitLock(repoRoot, ["update-ref", "--no-deref", "-d", ref, candidate.oid], { stderr: false });
  } catch (error) {
    const current = readLockRef(repoRoot, ref);
    const observedOid = current?.oid || candidate.oid;
    return {
      ok: false,
      lock_error: true,
      lock_release_error: true,
      ref,
      observed_oid: observedOid,
      operation_result: operationResult,
      warning: `operation completed but failed to release authority lock ${ref} oid=${observedOid}: ${error.message}. Retry cleanup only against that exact object id with: git update-ref --no-deref -d ${ref} ${observedOid}`,
    };
  }
  return operationResult;
}

function branchFor(worktreeRoot) {
  try {
    return execFileSync("git", ["-C", worktreeRoot, "branch", "--show-current"], { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function repoRootFor(worktreeRoot) {
  try {
    const common = execFileSync("git", ["-C", worktreeRoot, "rev-parse", "--git-common-dir"], { encoding: "utf8" }).trim();
    const commonAbs = path.resolve(worktreeRoot, common);
    return fs.realpathSync(path.dirname(commonAbs));
  } catch {
    return fs.realpathSync(worktreeRoot);
  }
}

function conflictingBindingInSibling(worktreeRoot, sessionId) {
  try {
    const rows = execFileSync("git", ["-C", worktreeRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter((line) => line.startsWith("worktree "))
      .map((line) => line.slice("worktree ".length));
    for (const candidate of rows) {
      const root = fs.realpathSync(candidate);
      if (root === worktreeRoot) continue;
      const dir = path.join(root, ".svc", "bindings");
      if (!fs.existsSync(dir)) continue;
      for (const file of fs.readdirSync(dir).filter((name) => name.endsWith(".json"))) {
        const binding = readClaimAbsolute(path.resolve(dir, file));
        if (binding?.session_id === sessionId && !binding.released_at) return binding;
      }
    }
  } catch {}
  return null;
}

function sessionHash(sessionId) {
  return crypto.createHash("sha256").update(String(sessionId)).digest("hex").slice(0, 32);
}

export function bindingPath(worktreeRoot, sessionId) {
  return path.join(path.resolve(worktreeRoot), ".svc", "bindings", `${sessionHash(sessionId)}.json`);
}

export function readSessionBinding(worktreeRoot, sessionId) {
  return readClaimAbsolute(bindingPath(worktreeRoot, sessionId));
}

// Repair one narrowly provable legacy condition: the same live session still
// owns the same WI/worktree/generation, but Git renamed the checked-out branch
// after claim-v1 was written. The registered Git branch is authoritative. This
// never transfers ownership or increments a generation. When controller lease
// v2 is present, repair is allowed only for the exact same principal, WI,
// worktree, and generation. Either file may already contain the new branch so
// an interrupted multi-file repair forward-completes on exact retry.
export function repairSameSessionBranchCoordinates(opts = {}) {
  const wi = String(opts.wi || "");
  const requestedSession = String(opts.session_id || opts.session_token || "");
  if (!WI_ID_RE.test(wi) || !sessionShaped(requestedSession)) {
    return { ok: false, warning: "branch repair requires an exact WI and session identity" };
  }
  let worktreeRoot;
  let repoRoot;
  try {
    worktreeRoot = fs.realpathSync(path.resolve(opts.worktree_root || process.cwd()));
    repoRoot = fs.realpathSync(path.resolve(opts.repo_root || repoRootFor(worktreeRoot)));
  } catch {
    return { ok: false, warning: "branch repair worktree or repository is missing" };
  }
  const branch = String(opts.branch || branchFor(worktreeRoot));
  if (!branch || branchFor(worktreeRoot) !== branch) {
    return { ok: false, warning: "branch repair target is not the registered Git branch" };
  }
  const claimPath = claimPathFor(worktreeRoot, wi);
  return withExclusiveLock(`claim:${claimPath}`, () => {
    const repoId = repositoryId(worktreeRoot);
    const stateRoot = authorityStateRoot(worktreeRoot, opts.env || process.env);
    return withControllerLeaseLock({ stateRoot, repoId, wi }, (controller) => {
    if ((opts.env || process.env).SVC_TEST_MODE === "1") {
      const holdMs = Number((opts.env || process.env).SVC_BRANCH_REPAIR_HOLD_MS || 0);
      if (Number.isFinite(holdMs) && holdMs > 0) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(holdMs, 2_000));
      }
    }
    const svcDir = path.join(worktreeRoot, ".svc");
    const claimsDir = path.join(svcDir, "claims");
    const bindingsDir = path.join(svcDir, "bindings");
    if (![svcDir, claimsDir, bindingsDir].every((dir) => secureContainedDirectoryForRead(worktreeRoot, dir))) {
      return { ok: false, warning: "branch repair authority directories escape the worktree or are insecure" };
    }
    const claimEvidence = secureJsonEvidence(claimPath);
    const currentBindingPath = bindingPath(worktreeRoot, requestedSession);
    const bindingEvidence = secureJsonEvidence(currentBindingPath);
    if (!claimEvidence.ok || !bindingEvidence.ok) {
      return { ok: false, warning: "branch repair claim or binding is missing or insecure" };
    }
    const claim = claimEvidence.value;
    const binding = bindingEvidence.value;
    const owner = normalizeClaimOwner(claim);
    const generation = Number(claim.generation || 0);
    const bindingGeneration = Number(binding.generation || 0);
    let exactController = true;
    if (controller) {
      try {
        const repairEnv = opts.env || process.env;
        const controllerHost = String(opts.host || repairEnv.SVC_HOST ||
          (repairEnv.CODEX_THREAD_ID || repairEnv.CODEX_SESSION_ID ? "codex" : "") ||
          (repairEnv.CLAUDE_SESSION_ID ? "claude" : "") ||
          (repairEnv.KIMI_SESSION_ID ? "kimi" : "") ||
          (repairEnv.GEMINI_SESSION_ID ? "gemini" : "") ||
          (repairEnv.OPENCODE_SESSION_ID ? "opencode" : ""));
        if (!controllerHost) throw new Error("controller host is not attributable");
        const expectedPrincipal = principalId({
          host: controllerHost,
          session_id: requestedSession,
        });
        exactController = controller.state === "active" &&
          controller.controller_principal === expectedPrincipal &&
          fs.realpathSync(controller.worktree_root) === worktreeRoot &&
          controller.generation === generation;
      } catch {
        exactController = false;
      }
    }
    const canonical =
      claim.schema_version === 1 && claim.wi === wi && claim.role === "mutating" &&
      !claim.released_at &&
      owner.attributable && owner.session_id === requestedSession &&
      Number.isInteger(generation) && generation > 0 &&
      sameResolvedPath(claim.repo_root, repoRoot) && sameResolvedPath(claim.worktree_root, worktreeRoot) &&
      binding.schema_version === 1 && binding.session_id === requestedSession && binding.role === "mutating" &&
      binding.wi === wi && !binding.released_at && bindingGeneration === generation &&
      sameResolvedPath(binding.repo_root, repoRoot) && sameResolvedPath(binding.worktree_root, worktreeRoot) &&
      path.resolve(String(binding.claim_path || "")) === claimPath && exactController;
    if (!canonical) return { ok: false, warning: "branch repair tuple coordinates or ownership are not exact" };

    const initialBranches = [claim.branch, binding.branch].map((value) => String(value || ""));
    if (initialBranches.some((value) => !value)) {
      return { ok: false, warning: "branch repair found ambiguous claim/binding branch coordinates" };
    }
    const legacyBranches = new Set(initialBranches.filter((value) => value !== branch));
    const lineageBindings = [];
    for (const name of fs.readdirSync(bindingsDir).filter((entry) => entry.endsWith(".json")).sort()) {
      const evidence = secureJsonEvidence(path.join(bindingsDir, name));
      if (!evidence.ok) return { ok: false, warning: `branch repair found insecure binding ${name}` };
      const candidate = evidence.value;
      if (candidate.schema_version !== 1 || !sessionShaped(String(candidate.session_id || "")) ||
          path.basename(bindingPath(worktreeRoot, candidate.session_id)) !== name) {
        return { ok: false, warning: `branch repair found malformed binding identity ${name}` };
      }
      if (candidate.role === "mutating") {
        const candidateGeneration = Number(candidate.generation || 0);
        const candidateBranch = String(candidate.branch || "");
        const exactCoordinates = candidate.wi === wi && Number.isInteger(candidateGeneration) && candidateGeneration > 0 &&
          candidateGeneration <= generation && sameResolvedPath(candidate.repo_root, repoRoot) &&
          sameResolvedPath(candidate.worktree_root, worktreeRoot) && candidateBranch &&
          path.resolve(String(candidate.claim_path || "")) === claimPath;
        if (!exactCoordinates) return { ok: false, warning: `branch repair found malformed binding coordinates ${name}` };
        if (candidateBranch !== branch) legacyBranches.add(candidateBranch);
        if (!candidate.released_at && candidateGeneration === generation && candidate.session_id !== requestedSession) {
          return { ok: false, warning: "branch repair found a live foreign owner in the current generation" };
        }
        lineageBindings.push(evidence);
      } else if (!READ_ONLY_ROLES.has(String(candidate.role || ""))) {
        return { ok: false, warning: `branch repair found unsupported binding role ${name}` };
      }
    }
    if (legacyBranches.size > 1) {
      return { ok: false, warning: "branch repair found ambiguous claim/binding branch coordinates" };
    }

    // Validate every lineage file again before the first write. This keeps the
    // branch-coordinate repair CAS-like even when a transferred claim has
    // historical released bindings from earlier generations.
    const claimCurrent = secureJsonEvidence(claimPath);
    if (!claimCurrent.ok || claimCurrent.sha256 !== claimEvidence.sha256 ||
        claimCurrent.dev !== claimEvidence.dev || claimCurrent.ino !== claimEvidence.ino) {
      return { ok: false, warning: "branch repair claim changed before convergence" };
    }
    for (const evidence of lineageBindings) {
      const current = secureJsonEvidence(evidence.path);
      if (!current.ok || current.sha256 !== evidence.sha256 || current.dev !== evidence.dev || current.ino !== evidence.ino) {
        return { ok: false, warning: `branch repair binding changed before convergence: ${path.basename(evidence.path)}` };
      }
    }

    if (claim.branch === branch && lineageBindings.every((entry) => entry.value.branch === branch)) {
      return { ok: true, repaired: false, generation, branch };
    }
    if (claim.branch !== branch) atomicWriteJson(claimPath, { ...claim, branch });
    const repairedAt = new Date().toISOString();
    for (const evidence of lineageBindings) {
      if (evidence.value.branch !== branch) {
        atomicWriteJson(evidence.path, { ...evidence.value, branch, updated_at: repairedAt });
      }
    }
    const repairedClaim = readClaimAbsolute(claimPath);
    const repairedBinding = readClaimAbsolute(currentBindingPath);
    if (repairedClaim?.branch !== branch || repairedBinding?.branch !== branch ||
        Number(repairedClaim?.generation || 0) !== generation || Number(repairedBinding?.generation || 0) !== generation) {
      return { ok: false, warning: "branch repair did not converge to the registered Git branch" };
    }
    for (const evidence of lineageBindings) {
      if (readClaimAbsolute(evidence.path)?.branch !== branch) {
        return { ok: false, warning: "branch repair did not converge every lineage binding" };
      }
    }
    return { ok: true, repaired: true, generation, branch };
    });
  }, repoRoot);
}

function claimPathFor(worktreeRoot, wi) {
  return path.join(path.resolve(worktreeRoot), ".svc", "claims", `${wi}.claim.json`);
}

function secureDirectoryForRead(dir) {
  try {
    const stat = fs.lstatSync(dir);
    return stat.isDirectory() && !stat.isSymbolicLink() &&
      (typeof process.getuid !== "function" || stat.uid === process.getuid());
  } catch {
    return false;
  }
}

function secureContainedDirectoryForRead(root, dir) {
  if (!secureDirectoryForRead(dir)) return false;
  try {
    const canonicalRoot = fs.realpathSync(root);
    const canonicalDir = fs.realpathSync(dir);
    const relative = path.relative(canonicalRoot, canonicalDir);
    return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
  } catch {
    return false;
  }
}

function secureOptionalDirectoryForRead(dir) {
  try {
    const stat = fs.lstatSync(dir);
    return stat.isDirectory() && !stat.isSymbolicLink() &&
      (typeof process.getuid !== "function" || stat.uid === process.getuid());
  } catch (error) {
    return error?.code === "ENOENT";
  }
}

function secureJsonEvidence(file) {
  const absolute = path.resolve(file);
  try {
    const stat = fs.lstatSync(absolute);
    if (!stat.isFile() || stat.isSymbolicLink() ||
        (typeof process.getuid === "function" && stat.uid !== process.getuid())) {
      return { ok: false, path: absolute, reason: "insecure authority file" };
    }
    const bytes = fs.readFileSync(absolute);
    const value = JSON.parse(bytes.toString("utf8"));
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, path: absolute, reason: "malformed authority JSON" };
    }
    return {
      ok: true,
      path: absolute,
      value,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      dev: stat.dev,
      ino: stat.ino,
    };
  } catch (error) {
    return {
      ok: false,
      path: absolute,
      reason: error instanceof SyntaxError ? "malformed authority JSON" : "missing or insecure authority file",
    };
  }
}

function sameResolvedPath(left, right) {
  try { return path.resolve(String(left || "")) === path.resolve(String(right || "")); }
  catch { return false; }
}

function v2AuthorityDecision(worktreeRoot, wi, env = process.env) {
  try {
    const repoId = repositoryId(worktreeRoot);
    const stateRoot = authorityStateRoot(worktreeRoot, env);
    if (!secureOptionalDirectoryForRead(stateRoot) ||
        !secureOptionalDirectoryForRead(path.join(stateRoot, "leases"))) {
      return { state: "deny", reason: "controller-lease-v2 directory is symlinked, malformed, or foreign-owned" };
    }
    const controller = readController({ stateRoot, repoId, wi });
    return controller
      ? { state: "v2_present", reason: `controller-lease-v2 generation ${controller.generation} is present`, controller }
      : { state: "absent" };
  } catch (error) {
    return { state: "deny", reason: `controller-lease-v2 state is malformed or insecure: ${error.message}` };
  }
}

// WI-505: one secure, exact claim-v1 tuple classifier for optimistic resume and
// the generation-locked transfer/finalization paths. An unreleased binding is
// evidence only when it correlates to the canonical claim owner and generation;
// it is never authority by itself.
export function inspectV1AuthorityTuple(opts = {}) {
  const wi = String(opts.wi || "");
  const requestedSession = String(opts.session_id || opts.session_token || "");
  if (!WI_ID_RE.test(wi) || !sessionShaped(requestedSession)) {
    return { state: "deny", reason: "invalid WI or requesting session identity", generation: 0 };
  }

  let worktreeRoot;
  let repoRoot;
  try {
    worktreeRoot = fs.realpathSync(path.resolve(opts.worktree_root || process.cwd()));
    repoRoot = fs.realpathSync(path.resolve(opts.repo_root || repoRootFor(worktreeRoot)));
  } catch {
    return { state: "deny", reason: "worktree or repository path is missing or insecure", generation: 0 };
  }
  const branch = String(opts.branch || branchFor(worktreeRoot));
  if (!branch || branchFor(worktreeRoot) !== branch) {
    return { state: "deny", reason: "claim/binding branch does not match the registered worktree", generation: 0 };
  }

  const canonicalClaimPath = claimPathFor(worktreeRoot, wi);
  if (opts.claim_path && path.resolve(String(opts.claim_path)) !== canonicalClaimPath) {
    return { state: "deny", reason: "claim path is not canonical for the requested WI/worktree", generation: 0 };
  }
  const svcDir = path.join(worktreeRoot, ".svc");
  const claimsDir = path.join(svcDir, "claims");
  const bindingsDir = path.join(svcDir, "bindings");
  if (![svcDir, claimsDir, bindingsDir].every((dir) => secureContainedDirectoryForRead(worktreeRoot, dir))) {
    return { state: "deny", reason: "authority directory is missing, symlinked, or foreign-owned", generation: 0 };
  }

  const v2 = v2AuthorityDecision(worktreeRoot, wi, opts.env || process.env);
  if (v2.state !== "absent") return { ...v2, generation: 0, worktree_root: worktreeRoot, repo_root: repoRoot };

  const claimEvidence = secureJsonEvidence(canonicalClaimPath);
  if (!claimEvidence.ok) return { state: "deny", reason: claimEvidence.reason, generation: 0 };
  const claim = claimEvidence.value;
  const attributableClaimOwners = [claim.session_token, claim.session, claim.session_id, claim.claimed_by]
    .map((value) => String(value || "").trim())
    .filter((value) => sessionShaped(value));
  if (new Set(attributableClaimOwners).size > 1) {
    return { state: "deny", reason: "claim carries ambiguous owner identities", generation: Number(claim.generation || 0) };
  }
  const claimOwner = normalizeClaimOwner(claim);
  const generation = Number(claim.generation || 0);
  if (claim.schema_version !== 1 || claim.wi !== wi || claim.role !== "mutating" ||
      !claimOwner.attributable || !Number.isInteger(generation) || generation < 1 ||
      !sameResolvedPath(claim.repo_root, repoRoot) || !sameResolvedPath(claim.worktree_root, worktreeRoot) ||
      String(claim.branch || "") !== branch) {
    return { state: "deny", reason: "claim coordinates, owner, role, schema, or generation mismatch", generation };
  }

  const bindingEvidence = [];
  for (const name of fs.readdirSync(bindingsDir).filter((entry) => entry.endsWith(".json")).sort()) {
    const evidence = secureJsonEvidence(path.join(bindingsDir, name));
    if (!evidence.ok) return { state: "deny", reason: `${evidence.reason} at ${evidence.path}`, generation };
    const binding = evidence.value;
    if (binding.schema_version !== 1 || !sessionShaped(String(binding.session_id || "")) ||
        path.basename(bindingPath(worktreeRoot, binding.session_id)) !== name) {
      return { state: "deny", reason: `binding schema/session/filename mismatch at ${evidence.path}`, generation };
    }
    if (binding.role === "mutating") {
      const bindingGeneration = Number(binding.generation || 0);
      if (binding.wi !== wi || !Number.isInteger(bindingGeneration) || bindingGeneration < 1 ||
          !sameResolvedPath(binding.repo_root, repoRoot) || !sameResolvedPath(binding.worktree_root, worktreeRoot) ||
          String(binding.branch || "") !== branch || path.resolve(String(binding.claim_path || "")) !== canonicalClaimPath ||
          bindingGeneration > generation) {
        return { state: "deny", reason: `claim/binding coordinate or generation mismatch at ${evidence.path}`, generation };
      }
    } else if (!READ_ONLY_ROLES.has(String(binding.role || ""))) {
      return { state: "deny", reason: `unsupported binding role at ${evidence.path}`, generation };
    }
    bindingEvidence.push(evidence);
  }

  const mutating = bindingEvidence.filter((entry) => entry.value.role === "mutating");
  const conflictingCurrentOwners = mutating.filter((entry) =>
    Number(entry.value.generation) === generation && entry.value.session_id !== claimOwner.session_id,
  );
  if (conflictingCurrentOwners.length > 0) {
    return { state: "deny", reason: "current generation has a foreign owner binding", generation };
  }
  const current = mutating.filter((entry) =>
    Number(entry.value.generation) === generation && entry.value.session_id === claimOwner.session_id,
  );
  if (current.length > 1) {
    return { state: "deny", reason: "ambiguous current-generation binding candidates", generation };
  }
  const base = {
    generation,
    owner_session: claimOwner.session_id,
    worktree_root: worktreeRoot,
    repo_root: repoRoot,
    branch,
    claim_path: canonicalClaimPath,
    claim,
    claim_evidence: claimEvidence,
  };

  if (claimOwner.session_id === requestedSession) {
    if (current.length === 1 && !current[0].value.released_at) {
      return { ...base, state: "current_complete", current_binding_path: current[0].path };
    }
    const rawFromGeneration = claim.transfer_from_generation;
    const fromGeneration = Number(rawFromGeneration || 0);
    const transferFromSession = String(claim.transfer_from_session || "");
    const sources = mutating.filter((entry) =>
      fromGeneration > 0 && Number(entry.value.generation) === fromGeneration &&
      entry.value.session_id !== requestedSession &&
      (!transferFromSession || entry.value.session_id === transferFromSession),
    );
    if (rawFromGeneration !== undefined &&
        (!Number.isInteger(rawFromGeneration) || fromGeneration !== generation - 1)) {
      return { ...base, state: "deny", reason: "transferred claim has mismatched source generation" };
    }
    if (fromGeneration > 0 && !sessionShaped(transferFromSession)) {
      return { ...base, state: "deny", reason: "transferred claim lacks an attributable source session" };
    }
    if (fromGeneration === 0 && transferFromSession) {
      return { ...base, state: "deny", reason: "claim has source session without transfer generation" };
    }
    if (sources.length > 1) return { ...base, state: "deny", reason: "ambiguous transfer source bindings" };
    if (fromGeneration > 0 && sources.length !== 1) {
      return { ...base, state: "deny", reason: "transferred claim has no exact source binding" };
    }
    return {
      ...base,
      state: "current_unbound",
      source_binding_path: sources[0]?.path || "",
      source_binding_evidence: sources[0] || null,
    };
  }

  if (current.length !== 1) {
    return { ...base, state: "deny", reason: "claim has no exact current-generation owner binding" };
  }
  const freshness = claimFreshness(claim, canonicalClaimPath);
  if (!claim.released_at && !freshness.stale) {
    if (current[0].value.released_at) {
      return { ...base, state: "deny", reason: "fresh claim has a released owner binding" };
    }
    return {
      ...base,
      state: "fresh_foreign",
      reason: `fresh authority owned by ${claimOwner.session_id} at generation ${generation}`,
      source_binding_path: current[0].path,
    };
  }
  return {
    ...base,
    state: "reclaimable",
    reason: claim.released_at ? "released exact complete tuple" : freshness.reason,
    source_binding_path: current[0].path,
    source_binding_evidence: current[0],
  };
}

function retireSourceBinding(sourceEvidence, { toSession, toGeneration, fromGeneration }) {
  if (!sourceEvidence) return { ok: true, retired: false };
  const current = secureJsonEvidence(sourceEvidence.path);
  if (!current.ok || current.sha256 !== sourceEvidence.sha256 || current.dev !== sourceEvidence.dev || current.ino !== sourceEvidence.ino) {
    return { ok: false, warning: "source binding changed before generation-bound retirement" };
  }
  const now = new Date().toISOString();
  const retired = {
    ...current.value,
    released_at: current.value.released_at || now,
    updated_at: now,
    transfer_to_session: toSession,
    transfer_to_generation: Number(toGeneration),
    transfer_from_generation: Number(fromGeneration),
  };
  atomicWriteJson(current.path, retired);
  return { ok: true, retired: true, binding: retired, binding_path: current.path };
}

function claimWIUnlocked(wi, opts = {}) {
  const svcDir = opts.svcDir ? path.resolve(opts.svcDir) : findSvcDir(opts.worktree_root || opts.cwd);
  if (!svcDir) return { ok: false, warning: "No .svc/ directory found" };
  const claimPath = opts.claim_path ? path.resolve(opts.claim_path) : path.join(svcDir, "claims", `${wi}.claim.json`);
  const existing = readClaimAbsolute(claimPath);
  const requestedSession = String(opts.session_id || opts.session_token || "");
  const existingOwner = normalizeClaimOwner(existing || {});
  if (existingOwner.ambiguous) {
    return { ok: false, warning: `${wi} claim carries ambiguous owner identities; repair requires explicit evidence` };
  }
  if (existing && !existing.released_at && !isClaimStale(existing)) {
    if (!existingOwner.attributable || !requestedSession || existingOwner.session_id !== requestedSession) {
      const ageMin = Math.max(0, Math.round((Date.now() - Date.parse(existing.renewed_at || existing.started_at || 0)) / 60000));
      return {
        ok: false,
        warning: `${wi} is already claimed by ${existingOwner.session_id || existing.host || "unknown"} (PID ${existing.pid || "?"}, started ${ageMin}m ago). Release or transfer with the expected generation.`,
      };
    }
  }
  if (existing && isClaimStale(existing) && existingOwner.attributable &&
      existingOwner.session_id !== requestedSession && !opts.transfer_authorized) {
    return {
      ok: false,
      warning: `${wi} has a stale foreign claim at generation ${Number(existing.generation || 0)}; use generation-bound claim transfer.`,
    };
  }
  const now = new Date().toISOString();
  const worktreeRoot = path.resolve(opts.worktree_root || path.dirname(svcDir));
  const repoRoot = path.resolve(opts.repo_root || repoRootFor(worktreeRoot));
  const generation = existing && normalizeClaimOwner(existing).session_id === requestedSession
    ? Math.max(1, Number(existing.generation || 1))
    : Math.max(1, Number(existing?.generation || 0) + 1);
  const claim = {
    schema_version: 1,
    wi,
    generation,
    repo_root: repoRoot,
    worktree_root: worktreeRoot,
    branch: opts.branch || branchFor(worktreeRoot),
    session_id: requestedSession,
    role: opts.role || "mutating",
    host: opts.host || process.env.SVC_HARNESS || "unknown",
    // WI-486 (EXEC-004): persist the process-liveness identity so freshness can
    // be decided by process identity (not TTL) for same-host owners. hostname is
    // always recorded; pid+start-token only when an owner pid is supplied.
    hostname: os.hostname(),
    started_at: existing?.started_at || now,
    renewed_at: now,
    ttl_hours: Number(opts.ttl_hours || DEFAULT_TTL_HOURS),
    ...(Number.isInteger(Number(existing?.transfer_from_generation)) && Number(existing.transfer_from_generation) > 0
      ? { transfer_from_generation: Number(existing.transfer_from_generation) }
      : {}),
    ...(sessionShaped(String(existing?.transfer_from_session || ""))
      ? { transfer_from_session: String(existing.transfer_from_session) }
      : {}),
    ...(opts.pid ? { pid: Number(opts.pid), process_start_token: processStartToken(Number(opts.pid)) } : {}),
  };
  // WI-562 IP-H5 (E2): a NEW claim without a durable owner pid MUST carry an
  // explicit heartbeat contract — interval bounded to half the TTL so a live
  // owner that renews on schedule is never preempted by TTL expiry. Claims
  // with NEITHER identity NOR an acknowledged ephemeral posture are REFUSED:
  // silently persisting an unreclaimable orphan is exactly the HD-7 hole.
  if (!claim.pid) {
    if (opts.ephemeral === true) {
      claim.heartbeat_required = false;
      claim.ephemeral = true;
    } else {
      const ttlHours = Number(claim.ttl_hours || DEFAULT_TTL_HOURS);
      // Floor of 1 minute is a DELIBERATE invariant (WI-562 exec-review R4):
      // sub-minute renewal loops are pathological spin risk; the contract
      // interval is minutes by definition.
      const requestedInterval = Number(opts.heartbeat_interval_minutes || Math.max(5, Math.floor((ttlHours * 60) / 4)));
      // Invariant (WI-562 round-4 review): interval*2 <= TTL, else the
      // contract cannot keep a live owner ahead of expiry.
      if (!(requestedInterval > 0) || requestedInterval * 2 > ttlHours * 60) {
        return { ok: false, warning: `heartbeat_interval_minutes ${requestedInterval} violates invariant interval*2 <= TTL (${ttlHours}h)` };
      }
      claim.heartbeat_required = true;
      claim.heartbeat_contract = { interval_minutes: requestedInterval };
    }
  }
  if (!opts.defer_write) atomicWriteJson(claimPath, claim);
  return { ok: true, claim, claim_path: claimPath };
}

// WI-562 IP-H5 (E2): explicit renewal op for long silent sections. Refreshes
// renewed_at (+ optional durable-owner identity upgrade). Callers: ensure-worktree
// resume/attach, worktree.sh binding guard, dispatch-worker exec loop.
export function renewClaim(wi, opts = {}) {
  const svcDir = opts.svcDir ? path.resolve(opts.svcDir) : findSvcDir(opts.worktree_root || opts.cwd);
  if (!svcDir) return { ok: false, warning: "No .svc/ directory found" };
  const claimPath = path.resolve(opts.claim_path || path.join(svcDir, "claims", `${wi}.claim.json`));
  return withExclusiveLock(`claim:${claimPath}`, () => {
    let existing = null;
    try { existing = JSON.parse(fs.readFileSync(claimPath, "utf8")); } catch {}
    if (!existing || existing.released_at) return { ok: false, warning: "no live claim to renew" };
    const now = new Date().toISOString();
    const next = {
      ...existing,
      renewed_at: now,
      ...(opts.pid ? { pid: Number(opts.pid), process_start_token: processStartToken(Number(opts.pid)), heartbeat_required: false, heartbeat_contract: undefined } : {}),
    };
    atomicWriteJson(claimPath, JSON.parse(JSON.stringify(next)));
    return { ok: true, claim: next, claim_path: claimPath };
  }, svcDir);
}

export function claimWI(wi, opts = {}) {
  const svcDir = opts.svcDir ? path.resolve(opts.svcDir) : findSvcDir(opts.worktree_root || opts.cwd);
  if (!svcDir) return { ok: false, warning: "No .svc/ directory found" };
  const claimPath = path.resolve(opts.claim_path || path.join(svcDir, "claims", `${wi}.claim.json`));
  return withExclusiveLock(`claim:${claimPath}`, () => claimWIUnlocked(wi, { ...opts, svcDir, claim_path: claimPath }), svcDir);
}

export function transferClaim(wi, expectedGeneration, opts = {}) {
  const worktreeRoot = path.resolve(opts.worktree_root || process.cwd());
  const claimPath = path.resolve(opts.claim_path || claimPathFor(worktreeRoot, wi));
  return withExclusiveLock(`claim:${claimPath}`, () => {
    const v2 = v2AuthorityDecision(worktreeRoot, wi, opts.env || process.env);
    if (v2.state !== "absent") {
      return { ok: false, warning: v2.reason || "controller-lease-v2 authority blocks claim-v1 transfer" };
    }
    let tuple = null;
    if (opts.complete_tuple) {
      tuple = inspectV1AuthorityTuple({
        wi,
        worktree_root: worktreeRoot,
        repo_root: opts.repo_root,
        branch: opts.branch,
        claim_path: claimPath,
        session_id: opts.session_id || opts.session_token,
        env: opts.env || process.env,
      });
      if (Number(tuple.generation || 0) !== Number(expectedGeneration)) {
        return { ok: false, warning: "claim generation changed; retry from current state" };
      }
      if (tuple.state !== "reclaimable") {
        return { ok: false, warning: `complete tuple state changed; transfer denied (${tuple.reason || tuple.state})` };
      }
      if (!opts.source_binding_path || path.resolve(String(opts.source_binding_path)) !== tuple.source_binding_path) {
        return { ok: false, warning: "complete tuple source binding changed; transfer denied" };
      }
    }
    const existing = readClaimAbsolute(claimPath);
    if (!existing) return { ok: false, warning: "claim missing or insecure" };
    const transferOwner = normalizeClaimOwner(existing);
    if (Number(existing.generation || 0) !== Number(expectedGeneration)) {
      return { ok: false, warning: "claim generation changed; retry from current state" };
    }
    if (!existing.released_at && !isClaimStale(existing)) {
      return { ok: false, warning: "live claim cannot transfer without owner release or stale proof" };
    }
    const result = claimWIUnlocked(wi, {
      ...opts,
      claim_path: claimPath,
      worktree_root: worktreeRoot,
      transfer_authorized: true,
      // transferClaim owns the expected-generation CAS. Build the winner claim
      // in memory so its FIRST durable write includes the current transfer
      // provenance; otherwise a crash between two writes can strand an
      // unprovenanced generation winner.
      defer_write: true,
    });
    if (!result.ok) return result;
    result.claim.generation = Number(expectedGeneration) + 1;
    result.claim.transfer_from_generation = Number(expectedGeneration);
    if (transferOwner.attributable) result.claim.transfer_from_session = transferOwner.session_id;
    delete result.claim.released_at;
    atomicWriteJson(claimPath, result.claim);
    if (tuple && opts.env?.SVC_ENSURE_FAILPOINT === "after-claim-transfer-cas") {
      return {
        ...result,
        ok: false,
        warning: "injected failpoint: after-claim-transfer-cas",
        generation_winner: true,
      };
    }
    if (tuple) {
      const retired = retireSourceBinding(tuple.source_binding_evidence, {
        toSession: String(opts.session_id || opts.session_token || ""),
        toGeneration: result.claim.generation,
        fromGeneration: expectedGeneration,
      });
      if (!retired.ok) {
        return {
          ok: false,
          warning: `${retired.warning}; generation ${result.claim.generation} remains owned by the transfer winner and must be forward-completed`,
          claim: result.claim,
          claim_path: claimPath,
          generation_winner: true,
        };
      }
      result.retired_binding = retired.binding;
      result.retired_binding_path = retired.binding_path;
    }
    return result;
  }, path.dirname(path.dirname(claimPath)));
}

// Complete a durable post-CAS/pre-retirement state for the already-selected
// winner. This never changes claim generation: it re-inspects the exact tuple
// under the same claim lock and only retires the old generation-bound binding.
export function finalizeTransferredClaim(wi, expectedGeneration, opts = {}) {
  const worktreeRoot = path.resolve(opts.worktree_root || process.cwd());
  const claimPath = path.resolve(opts.claim_path || claimPathFor(worktreeRoot, wi));
  return withExclusiveLock(`claim:${claimPath}`, () => {
    const tuple = inspectV1AuthorityTuple({
      wi,
      worktree_root: worktreeRoot,
      repo_root: opts.repo_root,
      branch: opts.branch,
      claim_path: claimPath,
      session_id: opts.session_id || opts.session_token,
      env: opts.env || process.env,
    });
    if (Number(tuple.generation || 0) !== Number(expectedGeneration)) {
      return { ok: false, warning: "claim generation changed; retry from current state" };
    }
    if (tuple.state === "current_complete") {
      return {
        ok: true,
        claim: tuple.claim,
        claim_path: claimPath,
        retired_binding: null,
        retired_binding_path: "",
        recovered: false,
        already_finalized: true,
      };
    }
    if (tuple.state !== "current_unbound") {
      return { ok: false, warning: `claim is not an exact current-winner recovery tuple (${tuple.reason || tuple.state})` };
    }
    const retired = retireSourceBinding(tuple.source_binding_evidence, {
      toSession: String(opts.session_id || opts.session_token || ""),
      toGeneration: expectedGeneration,
      fromGeneration: Number(tuple.claim.transfer_from_generation || 0),
    });
    if (!retired.ok) return retired;
    return {
      ok: true,
      claim: tuple.claim,
      claim_path: claimPath,
      retired_binding: retired.binding || null,
      retired_binding_path: retired.binding_path || "",
      recovered: true,
    };
  }, path.dirname(path.dirname(claimPath)));
}

export function releaseClaim(wi, opts = {}) {
  const svcDir = opts.svcDir ? path.resolve(opts.svcDir) : findSvcDir(opts.worktree_root || opts.cwd);
  if (!svcDir) return { ok: true, released: false };
  const claimPath = path.resolve(opts.claim_path || path.join(svcDir, "claims", `${wi}.claim.json`));
  return withExclusiveLock(`claim:${claimPath}`, () => {
    const existing = readClaimAbsolute(claimPath);
    if (!existing) return { ok: true, released: false };
    const owner = normalizeClaimOwner(existing);
    const requested = String(opts.session_id || opts.session_token || "");
    if (requested && owner.attributable && owner.session_id !== requested && !isClaimStale(existing)) {
      return { ok: false, warning: "cannot release a fresh foreign claim" };
    }
    if (opts.preserve_for_transfer) {
      existing.released_at = new Date().toISOString();
      existing.renewed_at = existing.released_at;
      atomicWriteJson(claimPath, existing);
    } else {
      fs.unlinkSync(claimPath);
    }
    return { ok: true, released: true, claim: existing };
  }, path.dirname(path.dirname(claimPath)));
}

export function writeSessionBinding(opts = {}) {
  const worktreeRoot = fs.realpathSync(path.resolve(opts.worktree_root || process.cwd()));
  const role = String(opts.role || "mutating");
  const sessionId = String(opts.session_id || "");
  if (!sessionShaped(sessionId)) return { ok: false, warning: "session id is missing or not host-session-shaped" };
  if (role !== "mutating" && !READ_ONLY_ROLES.has(role)) return { ok: false, warning: "unsupported binding role" };
  const wi = role === "mutating" ? String(opts.wi || "") : "";
  if (role === "mutating" && !WI_ID_RE.test(wi)) return { ok: false, warning: "mutating binding requires WI-N" };
  const branch = String(opts.branch || branchFor(worktreeRoot));
  if (!branch) return { ok: false, warning: "binding requires a named branch; detached HEAD is not authoritative" };
  const repoRoot = path.resolve(opts.repo_root || repoRootFor(worktreeRoot));
  return withExclusiveLock(`session-binding:${repoRoot}:${sessionId}`, () => {
    const sibling = conflictingBindingInSibling(worktreeRoot, sessionId);
    if (sibling) return { ok: false, warning: `session already bound to ${sibling.wi || "read-only"} at ${sibling.worktree_root}` };
    const file = bindingPath(worktreeRoot, sessionId);
    const existing = readClaimAbsolute(file);
    if (existing && !existing.released_at) {
      const same = existing.session_id === sessionId && existing.role === role &&
        existing.wi === wi && path.resolve(existing.worktree_root) === worktreeRoot &&
        existing.branch === branch;
      if (!same) return { ok: false, warning: "session already has a conflicting live binding" };
    }
    let claimPath = "";
    let generation = Math.max(1, Number(existing?.generation || 1));
    if (role === "mutating") {
      const claimed = claimWI(wi, {
        session_id: sessionId,
        worktree_root: worktreeRoot,
        repo_root: repoRoot,
        branch,
        role,
        host: opts.host,
        pid: opts.pid,
        ttl_hours: opts.ttl_hours,
      });
      if (!claimed.ok) return claimed;
      claimPath = claimed.claim_path;
      generation = claimed.claim.generation;
    }
    const now = new Date().toISOString();
    const binding = {
      schema_version: 1,
      session_id: sessionId,
      role,
      wi,
      repo_root: repoRoot,
      worktree_root: worktreeRoot,
      branch,
      claim_path: claimPath,
      created_at: existing?.created_at || now,
      updated_at: now,
      generation,
    };
    atomicWriteJson(file, binding);
    return { ok: true, binding, binding_path: file };
  }, repoRoot);
}

// Explicit compatibility bridge only. Reading or writing a v1 claim never invokes
// this function implicitly; callers must opt into v2 migration and retain its
// digest-checked rollback receipt.
export async function migrateSessionBindingToV2(opts = {}) {
  const { authorityStateRoot, migrateV1Claim, repositoryId } = await import("./authority-store.mjs");
  const worktreeRoot = fs.realpathSync(path.resolve(opts.worktree_root || process.cwd()));
  const sessionId = String(opts.session_id || "");
  const binding = readSessionBinding(worktreeRoot, sessionId);
  if (!binding || binding.released_at || binding.role !== "mutating" || !binding.claim_path) {
    throw new Error("an active v1 mutating binding is required for explicit migration");
  }
  const repoId = repositoryId(worktreeRoot);
  const stateRoot = opts.state_root ? path.resolve(opts.state_root) : authorityStateRoot(worktreeRoot, opts.env || process.env);
  return migrateV1Claim({
    stateRoot, claimPath: binding.claim_path, repoId, worktreeRoot,
    host: String(opts.host || "codex"), env: opts.env || process.env,
  });
}

export function releaseSessionBinding(opts = {}) {
  const worktreeRoot = fs.realpathSync(path.resolve(opts.worktree_root || process.cwd()));
  const sessionId = String(opts.session_id || "");
  const repoRoot = repoRootFor(worktreeRoot);
  return withExclusiveLock(`session-binding:${repoRoot}:${sessionId}`, () => {
    const file = bindingPath(worktreeRoot, sessionId);
    const binding = readClaimAbsolute(file);
    if (!binding) return { ok: true, released: false };
    if (binding.role === "mutating" && binding.wi) {
      const released = releaseClaim(binding.wi, {
        claim_path: binding.claim_path,
        session_id: sessionId,
        worktree_root: worktreeRoot,
        preserve_for_transfer: true,
      });
      if (!released.ok) return released;
    }
    binding.released_at = new Date().toISOString();
    binding.updated_at = binding.released_at;
    atomicWriteJson(file, binding);
    return { ok: true, released: true, binding };
  }, repoRoot);
}

export function cleanStaleClaims(opts = {}) {
  const svcDir = opts.svcDir ? path.resolve(opts.svcDir) : findSvcDir(opts.worktree_root || opts.cwd);
  if (!svcDir) return 0;
  const claimsDir = path.join(svcDir, "claims");
  if (!fs.existsSync(claimsDir)) return 0;
  let cleaned = 0;
  for (const file of fs.readdirSync(claimsDir)) {
    if (!file.endsWith(".claim.json")) continue;
    const claimPath = path.join(claimsDir, file);
    const result = withExclusiveLock(`claim:${claimPath}`, () => {
      const claim = readClaimAbsolute(claimPath);
      if (claim?.released_at) return false;
      if (!claim || isClaimStale(claim)) {
        try { fs.unlinkSync(claimPath); return true; } catch {}
      }
      return false;
    }, svcDir);
    if (result === true) cleaned += 1;
  }
  return cleaned;
}

function parseArgs(argv) {
  const result = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith("--")) result._.push(argv[i]);
    else result[argv[i].slice(2).replaceAll("-", "_")] = argv[++i] ?? true;
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [kind, action] = args._;
  let result;
  if (kind === "binding" && action === "write") result = writeSessionBinding(args);
  else if (kind === "binding" && action === "release") result = releaseSessionBinding(args);
  else if (kind === "binding" && action === "status") {
    const binding = readSessionBinding(args.worktree_root || process.cwd(), args.session_id || "");
    result = { ok: Boolean(binding), binding };
  } else if (kind === "claim" && action === "transfer") {
    result = transferClaim(args.wi, Number(args.expected_generation), args);
  } else if (kind === "claim" && action === "renew") {
    // WI-562 IP-H5 E2: CLI renewal touch for long silent sections.
    result = await renewClaim(args.wi, args);
  } else {
    console.error("Usage: wi-claim.mjs binding <write|status|release> --worktree-root ABS --session-id ID [--wi WI-N --role mutating]\n       wi-claim.mjs claim renew --wi WI-N [--svc-dir DIR]");
    process.exit(2);
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
