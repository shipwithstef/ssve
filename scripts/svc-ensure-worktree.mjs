#!/usr/bin/env node

import crypto from "node:crypto";
import { appendJsonlLine } from "./state-io.mjs";
import { authorityStateRoot, repositoryId, readController, recoverController, resumeController, principalId, processIsAlive } from '../hooks/lib/authority-store.mjs';
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  bindingPath,
  finalizeTransferredClaim,
  inspectV1AuthorityTuple,
  liveSameWiOwner,
  processIdentity,
  processStartToken,
  readSessionBinding,
  repairSameSessionBranchCoordinates,
  removeCreatedPaths,
  transferClaim,
  authorityLockRef,
  withExclusiveLock,
  writeSessionBinding,
  migrateSessionBindingToV2,
} from "../hooks/lib/wi-claim.mjs";
import { authorityJson, resolveAuthorityHost, resolveWI } from "../hooks/lib/resolve-wi.mjs";
import { markerPathFor, readMarker, secureAncestors } from "../hooks/codex/lib/bootstrap-marker.mjs";
import { consumeBootstrapHandoff } from "../hooks/codex/lib/session-handoff.mjs";
import { resolveChainPolicy } from "./lib/chain-policy.mjs";
import { validateTaskGraphShape, selectRecoveryTask, taskSkillForLoad } from "../hooks/lib/validate-task-graph-shape.mjs";

import { WI_ID_RE as WI_RE } from "../hooks/lib/wi-id.mjs";
// WI-FW-HOOKS-SAFETY-01 (FP-01/FP-02): Git-valid slash branches validate as
// literal refs; new-worktree paths for such branches are hash-derived, never
// the raw ref text; registered worktrees outside `.worktrees` are adoptable
// only beneath an owner-approved canonical root with same-UID/no-symlink checks.
import {
  validateLiteralBranchName,
  worktreeLeafFor,
  needsDerivedWorktreeLeaf,
  isApprovedExistingWorktreeRoot,
  secureAncestorChain,
} from "../hooks/lib/literal-branch.mjs";
const SHA_RE = /^[0-9a-f]{40}$/;
const CROSS_HOST_TTL_MS = 24 * 3_600_000;

function git(args, cwd, options = {}) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8", stdio: ["ignore", "pipe", options.stderr === false ? "ignore" : "pipe"],
  }).trim();
}

function repository(start) {
  const current = fs.realpathSync(git(["rev-parse", "--show-toplevel"], start));
  const common = fs.realpathSync(path.resolve(current, git(["rev-parse", "--git-common-dir"], start)));
  return { current, root: fs.realpathSync(path.dirname(common)) };
}

function sessionId(env) {
  return String(env.SVC_SESSION_ID || env.GROK_SESSION_ID || env.CODEX_THREAD_ID || env.CODEX_SESSION_ID ||
    env.CLAUDE_SESSION_ID || env.KIMI_SESSION_ID || env.GEMINI_SESSION_ID || "");
}

// WI-486 (EXEC-004): the owner process identity persisted in the claim. Only a
// STABLE, long-lived owner pid is meaningful (the ephemeral bootstrap CLI pid is
// not — it exits immediately and would read back as false-dead). We therefore
// record a pid ONLY when the harness supplies one via SVC_OWNER_PID; otherwise
// the claim carries hostname-only and freshness falls back to TTL. When a pid is
// recorded, a live same-host owner is never TTL-preempted by claim freshness.
function ownerPid(env) {
  const raw = Number(env.SVC_OWNER_PID);
  return Number.isInteger(raw) && raw > 0 ? raw : undefined;
}

function bootstrapLockIdentity(repoRoot, wi) {
  return `ensure-worktree:${path.resolve(repoRoot)}\x1e${wi}`;
}

// Compatibility diagnostic: callers that displayed the former runtime-file
// path now receive the exact repository-shared Git ref that serializes this WI.
export function lockPathFor(repoRoot, wi, env = process.env) {
  void env;
  return authorityLockRef(bootstrapLockIdentity(repoRoot, wi));
}

// WI-562 IP-H5 E2: resume/attach refreshes the WI claim heartbeat so
// heartbeat-contract claims (pid-less owners) never expire mid-session.
async function renewClaimHeartbeat(repoRoot, wi) {
  try {
    const { renewClaim } = await import("../hooks/lib/wi-claim.mjs");
    const r = await renewClaim(wi, { svcDir: `${repoRoot}/.svc` });
    return Boolean(r?.ok);
  } catch { return false; }
}

function withLock(repoRoot, wi, env, operation) {
  void env;
  const result = withExclusiveLock(bootstrapLockIdentity(repoRoot, wi), operation, repoRoot);
  if (result?.lock_busy) throw new Error(`worktree creation is already in progress for ${wi} (${result.warning})`);
  if (result?.lock_error) throw new Error(`worktree creation cannot acquire its repository authority lock for ${wi} (${result.warning})`);
  return result;
}

function assertIgnored(repoRoot) {
  try { git(["check-ignore", "-q", ".worktrees/.svc-isolation-probe"], repoRoot); }
  catch { throw new Error(".worktrees/ is not ignored; repair .gitignore before ensuring a worktree"); }
}

// Residue-safe (SIB-16): the bootstrap NEVER inspects, stages, resets, or requires
// a clean default checkout. Unrelated tracked/untracked residue is not a
// precondition; it is left byte-for-byte unchanged. Only the immutable base commit
// is validated.
function resolveBase(repoRoot, from) {
  try { git(["rev-parse", "--verify", "origin/main^{commit}"], repoRoot); }
  catch { throw new Error("origin/main is missing; fetch origin before ensuring a worktree"); }
  const explicitSha = SHA_RE.test(from);
  if (from !== "origin/main" && !explicitSha) throw new Error("--from must be origin/main or an immutable 40-character commit SHA");
  try { return git(["rev-parse", "--verify", `${from}^{commit}`], repoRoot); }
  catch { throw new Error(`base does not resolve to a commit: ${from}`); }
}

function worktreeRows(repoRoot) {
  const rows = [];
  let current = null;
  for (const line of git(["worktree", "list", "--porcelain"], repoRoot).split(/\r?\n/)) {
    if (line.startsWith("worktree ")) {
      if (current) rows.push(current);
      const raw = line.slice("worktree ".length);
      let real = null;
      try { real = fs.realpathSync(raw); } catch {}
      current = real ? { path: real, branch: "" } : null;
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch refs/heads/".length);
    }
  }
  if (current) rows.push(current);
  return rows;
}

function laneFor(branch) {
  const match = String(branch).match(/^([a-z]+)-/i);
  const known = {
    framework: "framework", feature: "greenfield", greenfield: "greenfield",
    bugfix: "bugfix", refactor: "refactor", drift: "drift", brownfield: "brownfield-feature",
  };
  return (match && known[match[1].toLowerCase()]) || "framework";
}

// --- Atomic local JSON (temp -> fsync -> rename), same pattern as wi-claim.mjs ---
function atomicWriteJson(file, value) {
  const abs = path.resolve(file);
  fs.mkdirSync(path.dirname(abs), { recursive: true, mode: 0o700 });
  const temp = path.join(path.dirname(abs), `.${path.basename(abs)}.${process.pid}.${Date.now()}.tmp`);
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(temp, abs);
  fs.chmodSync(abs, 0o600);
  try { const dfd = fs.openSync(path.dirname(abs), "r"); fs.fsyncSync(dfd); fs.closeSync(dfd); } catch {}
}

// --- Bootstrap-intent marker: the single ownership anchor (§Bootstrap transaction) ---
// WI-494 F-003: markerPathFor/readMarker are now single-sourced from
// hooks/codex/lib/bootstrap-marker.mjs (shared with the Codex enforcer's
// isBootstrapShape) so writer and reader can never drift apart.

function newMarker({ owner, wi, branch, worktree, baseSha }) {
  const now = new Date().toISOString();
  return {
    schema_version: 1,
    session_id: owner,
    owner_token: crypto.randomBytes(32).toString("hex"),
    pid: process.pid,
    process_start_token: processStartToken(process.pid),
    hostname: os.hostname(),
    wi,
    branch,
    target_worktree: worktree,
    base_sha: baseSha,
    created_paths: [],
    started_at: now,
    renewed_at: now,
  };
}

// F-004: re-verify (write time, not just read/authorization time -- a symlink can
// be planted or swapped in the gap between the two) that every existing ancestor
// of markerPath is a real, same-uid directory before every marker write.
// repoRoot is REQUIRED (not optional) so this check can never be silently skipped
// by a future caller.
function writeMarker(markerPath, marker, repoRoot) {
  if (!secureAncestors(repoRoot, markerPath)) {
    throw new Error(`unsafe bootstrap-intent marker path ${markerPath}: an ancestor directory is a symlink or not owned by the current user`);
  }
  atomicWriteJson(markerPath, marker);
}

// Record-intent-then-create (§Deletion-authority provenance): append the intended
// absolute path and fsync the marker BEFORE the artifact is created, so
// created_paths[] is always a SUPERSET of on-disk artifacts.
function recordIntent(markerPath, marker, absPath, repoRoot) {
  const resolved = path.resolve(absPath);
  if (!marker.created_paths.includes(resolved)) marker.created_paths.push(resolved);
  marker.renewed_at = new Date().toISOString();
  writeMarker(markerPath, marker, repoRoot);
}

function renewMarker(markerPath, marker, repoRoot) {
  marker.renewed_at = new Date().toISOString();
  writeMarker(markerPath, marker, repoRoot);
}

// R2-F004: a same-uid TOCTOU race between marker validation and removal is a
// theoretical residual (not the pre-planted-symlink vector, which secureAncestors
// already closes at write time). Accepted as-is for this WI -- see the R2-F004
// note in bootstrap-marker.mjs; not gold-plated further here.
function removeMarker(markerPath) {
  try { fs.rmSync(markerPath, { force: true }); } catch {}
}

// STALE (reclaimable) vs LIVE (never reclaim). Process liveness OVERRIDES TTL for
// same-host owners; TTL is consulted ONLY for cross-host owners whose PID cannot
// be probed. Uncertainty fails closed to LIVE.
function markerLiveness(marker) {
  if (!marker) return "stale";
  if (String(marker.hostname || "") === os.hostname()) {
    return processIdentity(marker.pid, marker.process_start_token) === "dead" ? "stale" : "live";
  }
  const clock = Date.parse(marker.renewed_at || marker.started_at || "");
  if (!Number.isFinite(clock)) return "live";
  return Date.now() - clock > CROSS_HOST_TTL_MS ? "stale" : "live";
}

// Completeness backstop (§G2): every on-disk WI/branch/worktree artifact must be a
// SUBSET of the stale marker's created_paths[]. Any match NOT in the ledger makes
// the state an ambiguous CONFLICT — nothing is deleted.
function onDiskArtifactsFor(wi, worktree) {
  const found = [];
  if (fs.existsSync(worktree)) found.push(path.resolve(worktree));
  const graphP = path.join(worktree, ".svc", `lane-tasks-${wi}.json`);
  if (fs.existsSync(graphP)) found.push(path.resolve(graphP));
  const claimP = path.join(worktree, ".svc", "claims", `${wi}.claim.json`);
  if (fs.existsSync(claimP)) found.push(path.resolve(claimP));
  const bindDir = path.join(worktree, ".svc", "bindings");
  if (fs.existsSync(bindDir)) {
    try {
      for (const file of fs.readdirSync(bindDir)) if (file.endsWith(".json")) found.push(path.resolve(path.join(bindDir, file)));
    } catch {}
  }
  return found;
}

function assertLedgerSuperset(marker, wi, worktree) {
  const ledger = new Set((marker.created_paths || []).map((p) => path.resolve(String(p))));
  for (const artifact of onDiskArtifactsFor(wi, worktree)) {
    if (!ledger.has(artifact)) {
      throw new Error(`ambiguous bootstrap conflict for ${wi}: on-disk artifact ${artifact} is not in the stale marker ledger; nothing was deleted`);
    }
  }
}

function ensureGraph(worktree, wi, branch) {
  const graphPath = path.join(worktree, ".svc", `lane-tasks-${wi}.json`);
  if (!secureAncestors(worktree, graphPath)) {
    throw new Error("unsafe worktree state path: .svc is symlinked, foreign-owned, or escapes the worktree");
  }
  if (fs.existsSync(graphPath)) return { path: graphPath, created: false };
  // Recheck immediately before the mkdir/write boundary. This mirrors marker
  // writes and prevents a pre-planted .svc symlink from redirecting the graph.
  if (!secureAncestors(worktree, graphPath)) {
    throw new Error("unsafe worktree state path before graph write");
  }
  atomicWriteJson(graphPath, {
    schema_version: 1,
    wi,
    lane: laneFor(branch),
    // EXEC-R3-001: this placeholder MUST be a fully task-graph.mjs-VALID graph,
    // because scripts/codex-load-skill.mjs delegates the FIRST load-skill to
    // scripts/task-graph.mjs (the write-time authority). That authority requires
    // (a) a NUMERIC task id — a string id ("task-1") is rejected by validateTask —
    // and (b) a graph-level status that EQUALS the task-derived status. A single
    // pending route-workflow task derives to "pending"; the sole pending task is
    // also what the enforcer's first-load bootstrap branch (no task in_progress yet)
    // and firstRunnablePendingTask rely on. A numeric id sits inside the canonical
    // recoverable id domain the enforcer/loader/receipt now compare through, so it
    // is accepted on every path.
    status: "pending",
    created: new Date().toISOString(),
    tasks: [{ id: 1, status: "pending", skill: "route-workflow", subject: "route workflow", blocked_by: [] }],
  });
  return { path: graphPath, created: true };
}

function createWorktreeAndBranch(repoRoot, worktree, branch, baseSha) {
  let branchExists = true;
  try { git(["show-ref", "--verify", `refs/heads/${branch}`], repoRoot); }
  catch { branchExists = false; }
  if (branchExists) throw new Error(`branch ${branch} already exists but is not linked at ${worktree}`);
  // F-004: re-verify at write time (not just at transaction()'s authorization-time
  // check) -- a symlinked .worktrees parent could redirect the mkdir+`git worktree
  // add` below outside the repository.
  if (!secureAncestors(repoRoot, worktree)) {
    throw new Error(`unsafe worktree path ${worktree}: an ancestor directory is a symlink or not owned by the current user`);
  }
  fs.mkdirSync(path.dirname(worktree), { recursive: true });
  git(["worktree", "add", worktree, "-b", branch, baseSha], repoRoot);
  // R2-F004: a same-uid race window between the git-worktree-add above and these
  // mkdirs is a theoretical residual, not gold-plated further for this WI (see
  // the R2-F004 note in bootstrap-marker.mjs).
  fs.mkdirSync(path.join(worktree, ".svc", "claims"), { recursive: true });
  fs.mkdirSync(path.join(worktree, ".svc", "bindings"), { recursive: true });
}

// WI-486 (EXEC-003): compare-and-delete the git worktree registration + branch.
// The worktree is unregistered ONLY when it is registered at the exact expected
// path (and, if branch-linked, to the expected branch). The branch is deleted
// ONLY when it still points at the recorded base OID (no work was committed on
// it) and it is not linked to any OTHER worktree. `strict` throws on any mismatch
// (stale-marker reclaim → ambiguous CONFLICT, delete nothing); non-strict is
// best-effort cleanup for our own just-created attempt.
function removeWorktreeRegistrationIfExpected(repoRoot, worktree, branch, baseSha, { strict = false } = {}) {
  const reg = worktreeRows(repoRoot).find((row) => row.path === worktree);
  if (reg) {
    if (reg.branch && reg.branch !== branch) {
      if (strict) throw new Error(`ambiguous bootstrap conflict: worktree ${worktree} is registered to ${reg.branch}, not ${branch}; nothing was deleted`);
      return;
    }
    try { git(["worktree", "remove", worktree, "--force"], repoRoot); } catch {}
    try { git(["worktree", "prune"], repoRoot); } catch {}
  }
  let branchExists = true;
  try { git(["show-ref", "--verify", `refs/heads/${branch}`], repoRoot); } catch { branchExists = false; }
  if (!branchExists) return;
  const linkedElsewhere = worktreeRows(repoRoot).some((row) => row.branch === branch && row.path !== worktree);
  if (linkedElsewhere) {
    if (strict) throw new Error(`ambiguous bootstrap conflict: branch ${branch} is linked to another worktree; nothing was deleted`);
    return;
  }
  let tip = "";
  try { tip = git(["rev-parse", `refs/heads/${branch}`], repoRoot); } catch {}
  if (baseSha && tip && tip !== baseSha) {
    if (strict) throw new Error(`ambiguous bootstrap conflict: branch ${branch} advanced past the recorded base; nothing was deleted`);
    return; // branch has commits we did not make — never delete
  }
  try { git(["branch", "-D", branch], repoRoot); } catch {}
}

// PHASE-1 (pure): compute the exact worktree/branch reclaim plan WITHOUT mutating
// anything. Every mismatch throws an ambiguous CONFLICT so the caller deletes
// nothing. This is the fix for EXEC-R2-001: the old path ran
// `git worktree remove --force` BEFORE the branch-linkage/branch-tip checks, so a
// failing check threw "nothing deleted" AFTER the worktree (and any files in it)
// were already gone. Now ALL validation happens before ANY deletion.
function planWorktreeReclaim(repoRoot, worktree, branch, baseSha) {
  const rows = worktreeRows(repoRoot);
  const reg = rows.find((row) => row.path === worktree);
  if (reg && reg.branch && reg.branch !== branch) {
    throw new Error(`ambiguous bootstrap conflict: worktree ${worktree} is registered to ${reg.branch}, not ${branch}; nothing was deleted`);
  }
  const removeWorktree = Boolean(reg);
  let branchExists = true;
  try { git(["show-ref", "--verify", `refs/heads/${branch}`], repoRoot); } catch { branchExists = false; }
  let deleteBranch = false;
  if (branchExists) {
    const linkedElsewhere = rows.some((row) => row.branch === branch && row.path !== worktree);
    if (linkedElsewhere) {
      throw new Error(`ambiguous bootstrap conflict: branch ${branch} is linked to another worktree; nothing was deleted`);
    }
    let tip = "";
    try { tip = git(["rev-parse", `refs/heads/${branch}`], repoRoot); } catch {}
    if (baseSha && tip && tip !== baseSha) {
      throw new Error(`ambiguous bootstrap conflict: branch ${branch} advanced past the recorded base; nothing was deleted`);
    }
    deleteBranch = true;
  }
  return { removeWorktree, deleteBranch };
}

// PHASE-1 (pure): the worktree must contain ONLY artifacts this bootstrap created
// (its ledger). Any tracked modification, untracked file, OR gitignored file NOT
// in the ledger is real user state — an ambiguous CONFLICT that refuses reclaim.
//
// EXEC-R3-002: the inventory MUST include gitignored entries (`--ignored`). The
// bootstrap's own runtime state (.svc/claims, .svc/bindings, the lane-tasks graph)
// is gitignored yet recorded in the ledger, so a pristine bootstrap worktree still
// reads clean; but a NON-ledger gitignored user file (e.g. under an ignored dir)
// would previously be invisible to plain `git status` and force-deleted with the
// worktree. Listing ignored entries and rejecting any not covered by the ledger
// closes that data-loss path. `--untracked-files=all --ignored` lists individual
// files inside ignored directories (git's traditional-ignored + all-untracked
// behavior), so containment is checked per file, not per collapsed directory.
// Returns the offending absolute paths ([] == clean; a status failure fails closed).
function worktreeCleanlinessConflicts(worktree, ledgerSet) {
  let out;
  try { out = git(["status", "--porcelain", "--untracked-files=all", "--ignored"], worktree, { stderr: false }); }
  catch { return ["<worktree status unavailable>"]; }
  const conflicts = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line) continue;
    let rel = line.slice(3).trim();
    if (rel.includes(" -> ")) rel = rel.split(" -> ").pop();
    rel = rel.replace(/^"|"$/g, "");
    // A trailing-slash entry is an ignored directory git did not (or could not)
    // expand to individual files; treat it as a conflict unless the directory
    // itself is a recorded ledger path.
    const abs = path.resolve(worktree, rel.replace(/\/$/, ""));
    if (!ledgerSet.has(abs)) conflicts.push(abs);
  }
  return conflicts;
}

// Validate a STALE marker's identity + containment + cleanliness + reclaim plan
// with ZERO mutation, THEN reclaim EXACTLY the artifacts it authorized. Every
// mismatch (identity, out-of-worktree ledger entry, ledger-superset violation,
// tracked modification / untracked non-ledger file, mis-registered worktree,
// branch linked elsewhere, branch advanced past base) is an ambiguous CONFLICT —
// nothing is deleted. Deletion begins only after ALL checks pass.
export function reclaimStaleMarker(repoRoot, wi, branch, worktree, marker, markerPath) {
  // --- PHASE 1: validate everything, mutate nothing. ---
  if (!marker || typeof marker !== "object" ||
      String(marker.wi) !== wi || String(marker.branch) !== branch ||
      path.resolve(String(marker.target_worktree || "")) !== worktree ||
      !Array.isArray(marker.created_paths)) {
    throw new Error(`ambiguous bootstrap conflict for ${wi}: stale marker identity does not match the request; nothing was deleted`);
  }
  const ledgerSet = new Set();
  for (const entry of marker.created_paths) {
    const abs = path.resolve(String(entry));
    const rel = path.relative(worktree, abs);
    const contained = abs === worktree || (rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel));
    if (!contained) {
      throw new Error(`ambiguous bootstrap conflict for ${wi}: stale marker lists an out-of-worktree path ${abs}; nothing was deleted`);
    }
    ledgerSet.add(abs);
  }
  assertLedgerSuperset(marker, wi, worktree);
  const plan = planWorktreeReclaim(repoRoot, worktree, branch, marker.base_sha);
  // Refuse automatic reclaim of a worktree that carries tracked modifications or
  // untracked files that this bootstrap did NOT create (EXEC-R2-001).
  if (fs.existsSync(worktree)) {
    const dirty = worktreeCleanlinessConflicts(worktree, ledgerSet);
    if (dirty.length) {
      throw new Error(`ambiguous bootstrap conflict for ${wi}: worktree has ${dirty.length} tracked-modified/untracked file(s) not created by this bootstrap (e.g. ${dirty[0]}); nothing was deleted`);
    }
  }
  // --- PHASE 2: all checks passed — mutate. Cleanliness (modulo the bootstrap's
  // own ledger artifacts) was POSITIVELY proven above, so `--force` here can only
  // remove bootstrap-created state, never user work. ---
  if (plan.removeWorktree) {
    try { git(["worktree", "remove", worktree, "--force"], repoRoot); } catch {}
    try { git(["worktree", "prune"], repoRoot); } catch {}
  }
  if (plan.deleteBranch) {
    try { git(["branch", "-D", branch], repoRoot); } catch {}
  }
  removeCreatedPaths(marker.created_paths, { containmentRoot: worktree });
  removeMarker(markerPath);
}

// Reverse selective rollback (SIB-12/13): remove ONLY marker-listed artifacts this
// attempt created (contained under the worktree), then — if this attempt actually
// created the worktree/branch — compare-and-delete them, then the marker.
function rollbackAttempt(repoRoot, worktree, branch, marker, markerPath, opts = {}) {
  removeCreatedPaths(
    (marker.created_paths || []).filter((p) => path.resolve(String(p)) !== path.resolve(worktree)),
    { containmentRoot: worktree },
  );
  if (opts.worktreeCreated) {
    removeWorktreeRegistrationIfExpected(repoRoot, worktree, branch, opts.baseSha, { strict: false });
    try { fs.rmSync(worktree, { recursive: true, force: true }); } catch {}
  }
  removeMarker(markerPath);
}

// WI-549 (AC-549-4): this bootstrap NEVER writes a per-worktree
// .svc/chain-policy.json — a linked worktree observes the SAME
// repository-shared mode as every other worktree, resolved fresh through the
// single shared resolver. Surfacing it here (rather than only on first hook
// invocation) means a caller sees the effective mode + provenance at the
// exact moment a worktree is ensured, before any commit/push is attempted.
function chainPolicySummary(worktree) {
  const resolved = resolveChainPolicy({ start: worktree });
  return { mode: resolved.mode, source: resolved.source, conflict: resolved.conflict };
}

function result({ wi, branch, baseSha, worktree, owner, graphPath, generation, created, resumed }) {
  return {
    wi,
    branch,
    base_sha: baseSha,
    absolute_worktree: worktree,
    absolute_graph: path.resolve(graphPath),
    owner_session: owner,
    claim_generation: Number(generation || 0),
    created: Boolean(created),
    resumed: Boolean(resumed),
    chain_policy: chainPolicySummary(worktree),
  };
}

// WI-FW-HOOKS-SAFETY-01 T03/AC-3 (FP-05): exact existing-worktree self-heal.
// The dispatcher imports and calls this DIRECTLY when a governed mutation has
// no binding but fresh positive prompt authority names one WI. It adopts the
// SINGLE registered non-default worktree holding a valid lane graph for that
// WI — never a foreign owner, never an unapproved root, never the default
// checkout, never an ambiguous candidate — by running the SAME locked
// transaction used for ordinary ensure/resume, so every foreign/stale/
// generation conflict keeps its fail-closed semantics.
// A root allowlist is needed for first adoption. A complete existing tuple is
// already authorization for this exact registered target, not for its parent.
function stateProbePath(worktree) { return path.join(worktree, ".svc", ".svc-state-probe"); }

function existingResumeApproval({ repo, wi, branch, owner, worktree, env }) {
  const approval = isApprovedExistingWorktreeRoot(worktree, repo.root, env);
  if (approval.ok) return approval;
  try {
    const targetInfo = fs.lstatSync(worktree);
    if (!targetInfo.isDirectory() || targetInfo.isSymbolicLink() || (process.getuid && targetInfo.uid !== process.getuid())) return approval;
    if (fs.existsSync(markerPathFor(repo.root, wi))) return approval;
    if (fs.realpathSync(worktree) !== worktree || !secureAncestorChain(path.dirname(worktree), worktree).ok ||
        !secureAncestors(worktree, path.join(worktree, ".svc", ".svc-state-probe"))) return approval;
    const tuple = inspectV1AuthorityTuple({ wi, branch, worktree_root: worktree,
      repo_root: repo.root, session_id: owner, env });
    // A deliberately released binding does not authorize an external root.
    // Missing bindings after interruption remain recoverable from the exact claim.
    const priorBinding = bindingPath(worktree, owner);
    if (tuple.state === "current_unbound" && fs.existsSync(priorBinding) && JSON.parse(fs.readFileSync(priorBinding, "utf8")).released_at) return approval;
    const graph = JSON.parse(fs.readFileSync(path.join(worktree, ".svc", `lane-tasks-${wi}.json`), "utf8"));
    if (graph?.wi !== wi || !validateTaskGraphShape(graph).ok) return approval;
    if (["current_complete", "current_unbound", "reclaimable", "v2_present"].includes(tuple.state))
      return { ok: true, root: worktree, source: "existing-exact-authority" };
  } catch { /* Malformed or missing authority retains the original refusal. */ }
  return approval;
}

function inspectRecoverySession(worktree, wi) {
  const graphPath = path.join(worktree, '.svc', `lane-tasks-${wi}.json`);
  const graphStat = fs.lstatSync(graphPath);
  if (!graphStat.isFile() || graphStat.isSymbolicLink() || !secureAncestors(worktree, graphPath)) throw new Error('recovery graph is insecure');
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  if (!validateTaskGraphShape(graph).ok || graph.wi !== wi) throw new Error('recovery graph mismatch');
  const task = selectRecoveryTask(graph);
  if (!task) throw new Error('recovery has no unambiguous runnable task');
  const skill = taskSkillForLoad(task);
  if (!skill) throw new Error('active task has no declared skill');
  const contractPath = path.join(worktree, '.svc', 'session-contract.jsonl');
  const st = fs.lstatSync(contractPath);
  if (!st.isFile() || st.isSymbolicLink() || st.uid !== process.getuid()) throw new Error('recovery contract is insecure');
  const lines = fs.readFileSync(contractPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  const previous = JSON.parse(lines.at(-1));
  if (previous.wi !== wi) throw new Error('recovery contract names another WI');
  return { graphPath, taskId: task.id, skill, contractPath, previous };
}

export function prepareRecoveredSession({ worktree, wi, sessionId, turnId, authorization, agentId = null }) {
  if (!authorization?.eligible || authorization.wi !== wi) throw new Error('recovery requires current session authorization');
  const owned = resolveWI({ cwd: worktree, session_id: sessionId, agent_id: agentId }, { ...process.env, SVC_SESSION_ID: sessionId, SVC_REQUIRE_SESSION_BINDING: "1" });
  if (!owned.authority || owned.wi !== wi || owned.tuple?.worktree_root !== worktree) throw new Error("recovery requires the current owned worktree");
  const { graphPath, taskId, skill, contractPath, previous } = inspectRecoverySession(worktree, wi);
  if (previous.recovery_session !== sessionId || previous.recovery_turn !== turnId) {
    appendJsonlLine(contractPath, { ...previous, ts: new Date().toISOString(), skill,
      recovery_session: sessionId, recovery_turn: turnId, recovery_kind: 'authorized-resume' });
  }
  return { graphPath, taskId, skill };
}

export function adoptExistingWorktree(options = {}, env = process.env) {
  const wi = String(options.wi || "");
  if (!WI_RE.test(wi)) throw new Error(`SELF_HEAL_INELIGIBLE: invalid WI identifier (${wi || "empty"})`);
  const owner = sessionId(env);
  if (!owner) throw new Error("SELF_HEAL_INELIGIBLE: a host session id is required to adopt a worktree");
  const repo = repository(options.cwd || process.env.SVC_SELF_HEAL_REPO_ROOT || process.cwd());
  // The default checkout is NEVER adoptable as a mutation worktree.
  let defaultRoot = "";
  try {
    const commonDir = fs.realpathSync(path.resolve(repo.root, git(["rev-parse", "--git-common-dir"], repo.root)));
    defaultRoot = path.dirname(commonDir);
  } catch {}
  const rows = worktreeRows(repo.root).filter((row) => row.path !== defaultRoot);
  const graphPathFor = (row) => path.join(row.path, ".svc", `lane-tasks-${wi}.json`);
  const candidates = rows.filter((row) => {
    const graphPath = graphPathFor(row);
    if (!fs.existsSync(graphPath)) return false;
    let parsed;
    try { parsed = JSON.parse(fs.readFileSync(graphPath, "utf8")); }
    catch { return false; }
    if (!validateTaskGraphShape(parsed).ok) return false;
    // EXTREV-EXEC-012: the graph's internal identity must equal the requested
    // WI — a valid-shaped graph for a different WI must never be adopted.
    if (String(parsed.wi || "") !== wi) return false;
    return true;
  });
  if (candidates.length === 0) {
    throw new Error(`SELF_HEAL_INELIGIBLE: no registered non-default worktree carries a valid lane graph for ${wi}; say ‘work on <WI>’ from that worktree`);
  }
  if (candidates.length > 1) {
    throw new Error(`SELF_HEAL_INELIGIBLE: multiple worktrees carry lane graphs for ${wi} (${candidates.map((row) => row.path).join(", ")}); resolve the ambiguity explicitly`);
  }
  const target = candidates[0];
  const branchCheck = validateLiteralBranchName(target.branch);
  if (!branchCheck.ok) {
    throw new Error(`SELF_HEAL_INELIGIBLE: registered branch for ${wi} is not a Git-valid literal ref (BRANCH_REF_INVALID: ${branchCheck.reason})`);
  }
  // Prove that recovery can reach its loader before transferring ownership.
  // Legacy direct adoption keeps its historical bootstrap behavior; the
  // dispatcher requests the stricter complete-session preflight.
  if (options.prepareSession) inspectRecoverySession(target.path, wi);
  const v2ctx = { stateRoot: authorityStateRoot(target.path, env), repoId: repositoryId(target.path), wi };
  const controller = readController(v2ctx);
  if (controller) {
    const principal = principalId({ host: resolveAuthorityHost({}, env), session_id: owner, agent_id: env.SVC_AGENT_ID || null });
    const lease = controller.controller_principal === principal && controller.worktree_root === target.path
      ? resumeController({ ...v2ctx, principal, worktreeRoot: target.path })
      : recoverController({ ...v2ctx, principal, worktreeRoot: target.path, expectedGeneration: controller.generation,
          reason: 'Authorized resume of the unique registered WI worktree',
          evidence: { expired: Date.parse(controller.expires_at) <= Date.now(), same_host_dead: processIsAlive(controller.owner_process) === false } }).lease;
    const verified = verifyCompleteTuple({ repo, wi, branch: target.branch, owner, worktree: target.path, graphP: graphPathFor(target), marker: null, env });
    if (!verified.ok) throw new Error(`recovery tuple verification failed: ${verified.reason}`);
    return { wi, branch: target.branch, absolute_worktree: target.path, owner_session: owner, graph_path: graphPathFor(target), resumed: true, authority_v2: { lease } };
  }
  // Approved-root containment + same-UID/no-symlink ancestry, identical to the
  // bootstrap transaction's authorization surface.
  const relativeWorktree = path.relative(path.join(repo.root, ".worktrees"), target.path);
  const insideDefaultRoot = !!relativeWorktree && !relativeWorktree.startsWith("..") && !path.isAbsolute(relativeWorktree);
  if (!insideDefaultRoot) {
    const approval = existingResumeApproval({ repo, wi, branch: target.branch, owner, worktree: target.path, env });
    if (!approval.ok) throw new Error(`SELF_HEAL_INELIGIBLE (${approval.reason_code || "WORKTREE_ROOT_UNAPPROVED"}: ${approval.reason})`);
    if (!secureAncestors(approval.root, approval.root === target.path ? path.join(target.path, ".svc", ".svc-state-probe") : target.path)) {
      throw new Error("SELF_HEAL_INELIGIBLE: unsafe approved worktree path (symlinked or foreign-owned ancestor)");
    }
  } else if (!secureAncestors(repo.root, target.path)) {
    throw new Error("SELF_HEAL_INELIGIBLE: unsafe worktree path (symlinked or foreign-owned ancestor)");
  }
  const stateProbe = path.join(target.path, ".svc", ".svc-state-probe");
  if (!secureAncestors(target.path, stateProbe)) {
    throw new Error("SELF_HEAL_INELIGIBLE: unsafe worktree state root (.svc symlinked, foreign-owned, or escaping)");
  }
  if (!fs.existsSync(path.join(target.path, ".svc"))) {
    fs.mkdirSync(path.join(target.path, ".svc"), { recursive: true });
  }
  // Run the SAME locked transaction (resume/reclaim/adoption paths). Any live
  // foreign owner, generation conflict, or ambiguous marker throws here with
  // its actionable conflict text; nothing is mutated on refusal.
  return ensureWorktree({ wi, branch: target.branch, cwd: target.path }, env);
}

export function ensureWorktree(options = {}, env = process.env) {
  const wi = String(options.wi || "");
  const branch = String(options.branch || "");
  const from = String(options.from || "origin/main");
  if (!WI_RE.test(wi)) throw new Error("--wi must be WI-N");
  const branchCheck = validateLiteralBranchName(branch);
  if (!branchCheck.ok) throw new Error(`--branch must be a Git-valid literal ref (BRANCH_REF_INVALID: ${branchCheck.reason})`);
  const owner = sessionId(env);
  if (!owner) throw new Error("a host session id is required to create or resume a mutating worktree");
  const host = resolveAuthorityHost({}, env);
  if (!host) throw new Error("trusted host identity is missing or unsupported");
  const repo = repository(options.cwd || process.cwd());
  return withLock(repo.root, wi, env, () => transaction({ repo, wi, branch, from, owner, host, env }));
}

function transaction({ repo, wi, branch, from, owner, host, env }) {
  assertIgnored(repo.root);
  const worktreesRoot = path.join(repo.root, ".worktrees");
  // AC-1/FP-02: the requested NEW-worktree path is derived independently of the
  // branch ref. Slash-free filesystem-safe branches keep the legacy layout;
  // Git-valid slash branches get `<wi>-<slug>-<sha256[0:12]>` so no ref byte is
  // ever interpreted as a path separator.
  const requestedWorktree = needsDerivedWorktreeLeaf(branch)
    ? path.join(worktreesRoot, worktreeLeafFor(branch, wi))
    : path.join(worktreesRoot, branch);
  const rows = worktreeRows(repo.root);
  const registeredBranches = rows.filter((row) => row.branch === branch);
  if (registeredBranches.length > 1) {
    throw new Error("ambiguous bootstrap conflict: requested branch is registered in multiple worktrees");
  }
  const registeredBranch = registeredBranches[0];
  const worktree = registeredBranch?.path || requestedWorktree;
  const relativeWorktree = path.relative(worktreesRoot, worktree);
  const insideDefaultRoot = !!relativeWorktree && !relativeWorktree.startsWith("..") && !path.isAbsolute(relativeWorktree);
  let approvedExternalRoot = null;
  if (!insideDefaultRoot) {
    // FP-02/AC-3: a registered linked worktree outside the repository's default
    // root is adoptable ONLY when its realpath sits beneath an owner-approved
    // canonical root with a same-UID, symlink-free ancestry chain. Unapproved
    // roots stay fail-closed and are never auto-approved.
    if (registeredBranch) {
      const approval = existingResumeApproval({ repo, wi, branch, owner, worktree: registeredBranch.path, env });
      if (!approval.ok) {
        throw new Error(`registered requested branch is outside the repository .worktrees containment root (${approval.reason_code || "WORKTREE_ROOT_UNAPPROVED"}: ${approval.reason})`);
      }
      approvedExternalRoot = approval.root;
    } else {
      throw new Error("registered requested branch is outside the repository .worktrees containment root");
    }
  }
  // F-004 (round 2, CONFIRMED HIGH): the lexical dirname comparison above does NOT
  // notice a PRE-PLANTED symlink at .worktrees itself -- it would redirect the
  // worktree creation below outside the repository while still satisfying the
  // lexical check. Canonicalize every existing ancestor before authorizing.
  // For an approved external worktree the containment anchor is the approved
  // canonical root (repo-root-relative containment does not apply there), and
  // the same same-UID/no-symlink guarantees are enforced from that root.
  if (!insideDefaultRoot && approvedExternalRoot) {
    const externalChain = secureAncestors(approvedExternalRoot, approvedExternalRoot === worktree ? stateProbePath(worktree) : worktree);
    if (!externalChain) throw new Error("unsafe approved worktree path: an ancestor beneath the approved root is a symlink or not owned by the current user");
  } else if (!secureAncestors(repo.root, worktree)) {
    throw new Error("unsafe worktree path: an ancestor directory is a symlink or not owned by the current user");
  }
  const stateProbe = path.join(worktree, ".svc", ".svc-state-probe");
  if (fs.existsSync(worktree) && !secureAncestors(worktree, stateProbe)) {
    throw new Error("unsafe worktree state root: .svc is symlinked, foreign-owned, or escapes the worktree");
  }
  // FP-02 adoption: a host-provisioned registered worktree may predate any svc
  // state root; the authority writers require one. Creation here is safe — the
  // worktree realpath and its ancestry were just validated above.
  if (registeredBranch && !fs.existsSync(path.join(worktree, ".svc"))) {
    fs.mkdirSync(path.join(worktree, ".svc"), { recursive: true });
  }
  const markerPath = markerPathFor(repo.root, wi);
  // F-004: same defense-in-depth for the bootstrap-intent marker's parent
  // (.svc, .svc/bootstrap-intent) -- a symlinked parent could redirect the
  // marker read below (and any subsequent write) outside the repository.
  if (!secureAncestors(repo.root, markerPath)) throw new Error(`unsafe bootstrap-intent marker path for ${wi}: an ancestor directory is a symlink or not owned by the current user`);
  // WI-494 F-003 (round 3): a malformed/foreign-shaped marker is a HARD ERROR here,
  // never silently downgraded to "absent" -- an invalid marker at bootstrap time is
  // a conflict the operator must resolve (matching the existing SIB "ambiguous
  // bootstrap conflict; nothing was deleted" posture elsewhere in this file).
  const markerRead = readMarker(markerPath);
  if (markerRead.state === "invalid") {
    throw new Error(`ambiguous bootstrap conflict for ${wi}: existing bootstrap-intent marker at ${markerPath} is malformed/invalid; nothing was deleted`);
  }
  const existingMarker = markerRead.state === "valid" ? markerRead.marker : null;

  // WI-486 (EXEC-002): an EXACT same-session bootstrap marker means a prior
  // attempt by THIS session crashed mid-transaction (before its complete tuple).
  // Route it to forward-completion BEFORE the generic existing-worktree routing —
  // otherwise a crash that already created the worktree would land in
  // resumeExisting, which recreates claim/binding/graph WITHOUT recordIntent and
  // leaves the marker, breaking the created_paths SUPERSET invariant. Identity is
  // validated on owner + WI + branch + worktree + base_sha; forwardComplete
  // recordIntents each missing artifact and removes the marker only after the
  // complete authoritative tuple is re-resolved and verified.
  if (existingMarker && String(existingMarker.session_id) === owner &&
      String(existingMarker.wi) === wi && String(existingMarker.branch) === branch &&
      path.resolve(String(existingMarker.target_worktree || "")) === worktree) {
    const baseSha = resolveBase(repo.root, from);
    if (String(existingMarker.base_sha) === baseSha) {
      return forwardComplete({ repo, wi, branch, owner, host, env, worktree, markerPath, marker: existingMarker, baseSha });
    }
  }

  const byPath = rows.find((row) => row.path === worktree);
  const byBranch = rows.find((row) => row.branch === branch);

  if (byPath || byBranch || fs.existsSync(worktree)) {
    if (!byPath || byPath.branch !== branch || (byBranch && byBranch.path !== worktree)) {
      throw new Error("conflicting worktree path or branch");
    }
    return resumeExisting({ repo, wi, branch, from, owner, host, env, worktree, markerPath, existingMarker });
  }
  return createFresh({ repo, wi, branch, from, owner, host, env, worktree, markerPath, existingMarker });
}

// SIB-14/15: exact same-session complete tuple resumes unchanged; a released or
// stale foreign tuple with no live owner is reclaimed and re-bound to the current
// session; a LIVE foreign owner is an actionable conflict and is never repaired or
// deleted.
function resumeExisting({ repo, wi, branch, from, owner, host, env, worktree, markerPath, existingMarker }) {
  const baseSha = resolveBase(repo.root, from);
  const claimP = path.join(worktree, ".svc", "claims", `${wi}.claim.json`);
  let myBinding = readSessionBinding(worktree, owner);

  if (myBinding && !myBinding.released_at && myBinding.wi === wi &&
      path.resolve(String(myBinding.worktree_root || "")) === worktree) {
    // Always run the idempotent lineage convergence check. A previous process
    // may have updated the claim and current binding before stopping, leaving a
    // released source-generation binding on the old branch. Looking only at the
    // current binding would make that partial repair invisible on retry.
    const repaired = repairSameSessionBranchCoordinates({
      wi, worktree_root: worktree, repo_root: repo.root, session_id: owner, branch,
      host, env,
    });
    if (!repaired.ok) throw new Error(repaired.warning || "same-session branch coordinate repair failed");
    myBinding = readSessionBinding(worktree, owner);
  }

  if (myBinding && !myBinding.released_at && myBinding.wi === wi && myBinding.branch === branch &&
      path.resolve(myBinding.worktree_root) === worktree) {
    const graph = ensureGraph(worktree, wi, branch);
    // WI-486 (EXEC-R3-003): a successful same-session resume is a "complete tuple"
    // claim and MUST be validated through the SAME shared authority resolver that
    // create/forward-complete use — a stale/foreign/generation-mismatched claim or
    // a graph corrupted to an unknown status must FAIL here rather than be reported
    // as a complete successful resume. No marker is required for a genuine resume.
    const sameMarker = existingMarker && String(existingMarker.session_id) === owner ? existingMarker : null;
    const verified = verifyCompleteTuple({ repo, wi, branch, owner, worktree, graphP: graph.path, marker: sameMarker, env });
    if (!verified.ok) throw new Error(`resume tuple verification failed; ownership retained (${verified.reason})`);
    // WI-562 IP-H5 E2: resume is a heartbeat touch for the WI claim.
    renewClaimHeartbeat(repo.root, wi).catch(() => {});
    if (sameMarker) renewMarker(markerPath, existingMarker, repo.root);
    return result({ wi, branch, baseSha, worktree, owner, graphPath: graph.path, generation: Number(verified.tuple.claim_generation || myBinding.generation), created: false, resumed: true });
  }

  if (existingMarker && String(existingMarker.session_id) !== owner && markerLiveness(existingMarker) === "live") {
    throw new Error(`existing worktree binding conflict (bootstrap owned by live session ${existingMarker.session_id})`);
  }

  // WI-541 generation-zero adoption: an already registered, exact-branch
  // worktree owned by this OS principal may predate claim/binding state. Adopt
  // ONLY when both authority directories contain no JSON evidence. Existing
  // graphs, ignored files, and user residue are preserved byte-for-byte.
  const claimDir = path.join(worktree, ".svc", "claims");
  const bindingDir = path.join(worktree, ".svc", "bindings");
  const authorityEntries = [claimDir, bindingDir].flatMap((dir) => {
    try { return fs.readdirSync(dir).filter((name) => name.endsWith(".json")).map((name) => path.join(dir, name)); }
    catch (error) { if (error.code === "ENOENT") return []; throw error; }
  });
  if (authorityEntries.length === 0) {
    const adopted = writeSessionBinding({
      worktree_root: worktree, session_id: owner, role: "mutating", wi, branch,
      repo_root: repo.root, host, pid: ownerPid(env),
    });
    if (!adopted.ok || Number(adopted.binding?.generation || 0) !== 1) {
      throw new Error(adopted.warning || "generation-zero authority adoption failed");
    }
  }

  const tuple = inspectV1AuthorityTuple({
    wi, branch, worktree_root: worktree, repo_root: repo.root, claim_path: claimP,
    session_id: owner, env,
  });
  if (tuple.state === "fresh_foreign") {
    throw new Error(
      `existing worktree binding conflict (owned by ${tuple.owner_session}, generation ${tuple.generation}, worktree ${tuple.worktree_root})`,
    );
  }
  if (tuple.state === "reclaimable") {
    const transferred = transferClaim(wi, Number(tuple.generation || 0), {
      worktree_root: worktree, claim_path: claimP, session_id: owner, role: "mutating",
      branch, repo_root: repo.root, host,
      pid: ownerPid(env), env, complete_tuple: true,
      source_binding_path: tuple.source_binding_path,
    });
    if (!transferred.ok) throw new Error(transferred.warning || "failed to reclaim released worktree claim");
  } else if (tuple.state === "current_unbound") {
    const finalized = finalizeTransferredClaim(wi, Number(tuple.generation || 0), {
      worktree_root: worktree, claim_path: claimP, session_id: owner,
      branch, repo_root: repo.root, env,
    });
    if (!finalized.ok) throw new Error(finalized.warning || "failed to forward-complete transferred worktree claim");
  } else if (tuple.state === "v2_present") {
    const v2ctx = { stateRoot: authorityStateRoot(worktree, env), repoId: repositoryId(worktree), wi };
    const controller = tuple.controller || readController(v2ctx);
    if (controller) {
      const principal = principalId({ host: resolveAuthorityHost({}, env), session_id: owner, agent_id: env.SVC_AGENT_ID || null });
      const lease = controller.controller_principal === principal && controller.worktree_root === worktree
        ? resumeController({ ...v2ctx, principal, worktreeRoot: worktree })
        : recoverController({ ...v2ctx, principal, worktreeRoot: worktree, expectedGeneration: controller.generation,
            reason: 'Authorized resume of the unique registered WI worktree',
            evidence: { expired: Date.parse(controller.expires_at) <= Date.now(), same_host_dead: processIsAlive(controller.owner_process) === false } }).lease;
      const graph = ensureGraph(worktree, wi, branch);
      const verified = verifyCompleteTuple({ repo, wi, branch, owner, worktree, graphP: graph.path, marker: null, env });
      if (!verified.ok) throw new Error(`recovery tuple verification failed: ${verified.reason}`);
      return result({ wi, branch, baseSha, worktree, owner, graphPath: graph.path, generation: Number(lease.generation), created: false, resumed: true, authority_v2: { lease } });
    }
  } else if (tuple.state !== "current_complete") {
    throw new Error(`existing worktree authority conflict (${tuple.reason || tuple.state})`);
  }
  const bound = writeSessionBinding({
    worktree_root: worktree, session_id: owner, role: "mutating", wi, branch,
    repo_root: repo.root, host,
    pid: ownerPid(env),
  });
  if (!bound.ok) throw new Error(bound.warning || "failed to rebind session to resumed worktree");
  const graph = ensureGraph(worktree, wi, branch);
  // WI-486 (EXEC-R3-003): the reclaim/rebind resume exit is verified through the
  // shared authority resolver too — after re-binding, the complete tuple must
  // resolve as OWNED (claim + generation + a well-formed graph) or the resume
  // fails rather than reporting a non-authoritative success.
  const verified = verifyCompleteTuple({ repo, wi, branch, owner, worktree, graphP: graph.path, marker: null, env });
  if (!verified.ok) throw new Error(`resume tuple verification failed; ownership retained (${verified.reason})`);
  return result({ wi, branch, baseSha, worktree, owner, graphPath: graph.path, generation: Number(verified.tuple.claim_generation || 0), created: false, resumed: true });
}

function createFresh({ repo, wi, branch, from, owner, host, env, worktree, markerPath, existingMarker }) {
  const baseSha = resolveBase(repo.root, from);

  // Same-session partial tuple -> forward-complete idempotently (SIB-14). The
  // transaction router already handles the exact-identity case; this is a
  // defensive backstop for the worktree-absent path.
  if (existingMarker && String(existingMarker.session_id) === owner &&
      path.resolve(String(existingMarker.target_worktree || "")) === worktree &&
      String(existingMarker.branch) === branch) {
    return forwardComplete({ repo, wi, branch, owner, host, env, worktree, markerPath, marker: existingMarker, baseSha });
  }

  // Foreign / ambiguous marker -> classify owner liveness. A LIVE foreign owner
  // is an actionable conflict. A STALE (dead-owner) marker is reclaimed under
  // identity + containment + compare-and-delete (WI-486 EXEC-003) — any mismatch
  // is an ambiguous CONFLICT and deletes nothing.
  if (existingMarker) {
    if (markerLiveness(existingMarker) === "live") {
      throw new Error(`actionable conflict: ${wi} bootstrap is owned by live session ${existingMarker.session_id}`);
    }
    reclaimStaleMarker(repo.root, wi, branch, worktree, existingMarker, markerPath);
  }

  // Same-WI live owner elsewhere is a conflict (SIB-11/17). Scan from the
  // repository root (the target worktree does not exist yet).
  const sibling = liveSameWiOwner(repo.root, wi, { excludeSession: owner });
  if (sibling) throw new Error(`${wi} is already owned by a live session ${sibling.owner} at ${sibling.worktree}`);

  const marker = newMarker({ owner, wi, branch, worktree, baseSha });
  writeMarker(markerPath, marker, repo.root); // ANCHOR FIRST — before any other artifact
  const bindingP = bindingPath(worktree, owner);
  let worktreeCreated = false;
  try {
    recordIntent(markerPath, marker, worktree, repo.root);
    if (env.SVC_ENSURE_FAILPOINT === "after-worktree") throw new Error("injected failpoint: after-worktree");
    createWorktreeAndBranch(repo.root, worktree, branch, baseSha);
    worktreeCreated = true;

    const graphP = path.join(worktree, ".svc", `lane-tasks-${wi}.json`);
    recordIntent(markerPath, marker, graphP, repo.root);
    if (env.SVC_ENSURE_FAILPOINT === "after-graph") throw new Error("injected failpoint: after-graph");
    ensureGraph(worktree, wi, branch);

    recordIntent(markerPath, marker, claimPathFor(worktree, wi), repo.root);
    recordIntent(markerPath, marker, bindingP, repo.root);
    if (env.SVC_ENSURE_FAILPOINT === "before-binding") throw new Error("injected failpoint: before-binding");
    const bound = writeSessionBinding({
      worktree_root: worktree, session_id: owner, role: "mutating", wi, branch,
      repo_root: repo.root, host,
      pid: ownerPid(env),
    });
    if (!bound.ok) throw new Error(bound.warning || "failed to initialize session/worktree binding");

    const binding = readSessionBinding(worktree, owner);
    if (!binding || binding.released_at || binding.wi !== wi) throw new Error("tuple re-read failed after bootstrap");
    removeMarker(markerPath); // complete -> anchor removed LAST
    return result({ wi, branch, baseSha, worktree, owner, graphPath: graphP, generation: bound.binding.generation, created: true, resumed: false });
  } catch (error) {
    rollbackAttempt(repo.root, worktree, branch, marker, markerPath, { worktreeCreated, baseSha });
    throw error;
  }
}

function claimPathFor(worktree, wi) {
  return path.join(worktree, ".svc", "claims", `${wi}.claim.json`);
}

// WI-486 (EXEC-R2-004 + EXEC-R3-003): re-resolve and VERIFY the COMPLETE
// authoritative tuple through the SHARED resolver (the same bindingDecision/
// authorityJson the hooks use), FROM the target worktree, with the expected
// session + WI — instead of a handful of local existence/field checks. Every
// returned tuple field is compared against the request: repository, worktree,
// branch, WI, owner session, and the exact binding-derived graph path; the claim
// path must be present. When a `marker` is supplied (the create/forward-complete
// anchor) its identity is also cross-checked; the resume path passes marker=null
// because a genuine same-session resume need not carry a bootstrap marker. The
// graph is validated by the SHARED resolver's authority-floor validator
// (validateTaskGraphShape) — a graph corrupted to an unknown status therefore
// yields a non-owned tuple and fails verification. Returns { ok, reason, tuple }.
// On ANY mismatch the caller retains its ownership anchor and fails — a mismatched
// generation, foreign claim, or malformed graph can no longer be reported as a
// complete successful tuple.
function verifyCompleteTuple({ repo, wi, branch, owner, worktree, graphP, marker, env }) {
  let graphReal = path.resolve(graphP);
  try { graphReal = fs.realpathSync(graphP); } catch {}
  const auth = authorityJson(
    { cwd: worktree, wi, session_id: owner },
    { ...env, PWD: worktree, SVC_SESSION_ID: owner, SVC_REQUIRE_SESSION_BINDING: "1" },
  );
  const t = auth.tuple;
  if (!auth.authority || auth.classification !== "owned" || !t) {
    return { ok: false, reason: `tuple not authoritative (${auth.classification}: ${auth.reason})` };
  }
  const controllerV2 = t.authority_model === "controller-lease-v2";
  const mismatch =
    t.wi !== wi ||
    t.branch !== branch ||
    String(t.session_id || "") !== owner ||
    path.resolve(String(t.worktree_root || "")) !== worktree ||
    path.resolve(String(t.repo_root || "")) !== repo.root ||
    path.resolve(String(t.graph_path || "")) !== graphReal ||
    (!controllerV2 && !t.claim_path) ||
    (controllerV2 && (!t.lease_id || !t.principal_id || Number(t.authority_generation || 0) < 1)) ||
    // When present, the marker (the create/forward-complete anchor) must itself
    // still name this exact session/WI/branch/worktree. The resume path has no
    // marker (marker=null) and is verified by the resolved tuple alone.
    (marker && (
      String(marker.wi) !== wi ||
      String(marker.branch) !== branch ||
      String(marker.session_id) !== owner ||
      path.resolve(String(marker.target_worktree || "")) !== worktree
    ));
  if (mismatch) return { ok: false, reason: marker ? "resolved tuple does not match the request and marker" : "resolved tuple does not match the request" };
  return { ok: true, tuple: t };
}

function forwardComplete({ repo, wi, branch, owner, host, env, worktree, markerPath, marker, baseSha }) {
  try {
    if (!fs.existsSync(worktree)) {
      recordIntent(markerPath, marker, worktree, repo.root);
      createWorktreeAndBranch(repo.root, worktree, branch, baseSha);
    }
    const graphP = path.join(worktree, ".svc", `lane-tasks-${wi}.json`);
    if (!fs.existsSync(graphP)) {
      recordIntent(markerPath, marker, graphP, repo.root);
      ensureGraph(worktree, wi, branch);
    }
    let binding = readSessionBinding(worktree, owner);
    if (!binding || binding.released_at) {
      recordIntent(markerPath, marker, claimPathFor(worktree, wi), repo.root);
      recordIntent(markerPath, marker, bindingPath(worktree, owner), repo.root);
      const bound = writeSessionBinding({
        worktree_root: worktree, session_id: owner, role: "mutating", wi, branch,
        repo_root: repo.root, host,
        pid: ownerPid(env),
      });
      if (!bound.ok) throw new Error(bound.warning || "forward-complete binding failed");
      binding = readSessionBinding(worktree, owner);
    }
    // WI-486 (EXEC-002 + EXEC-R2-004): re-resolve and VERIFY the complete
    // authoritative tuple THROUGH THE SHARED RESOLVER before removing the marker.
    // The marker is the single ownership anchor; it is dropped LAST, only once the
    // shared bindingDecision/authorityJson resolver confirms an OWNED tuple whose
    // every field matches the request and the marker.
    binding = readSessionBinding(worktree, owner);
    const verified = verifyCompleteTuple({ repo, wi, branch, owner, worktree, graphP, marker, env });
    if (!binding || binding.released_at || !verified.ok) {
      throw new Error(`forward-complete tuple verification failed; marker retained${verified.ok ? "" : ` (${verified.reason})`}`);
    }
    renewMarker(markerPath, marker, repo.root);
    removeMarker(markerPath); // now complete
    return result({ wi, branch, baseSha, worktree, owner, graphPath: graphP, generation: Number(verified.tuple.claim_generation || binding.generation), created: false, resumed: true });
  } catch (error) {
    // A forward-complete failure leaves the marker in place (still the anchor);
    // it never deletes a pre-existing artifact that belongs to this same session.
    renewMarker(markerPath, marker, repo.root);
    throw error;
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`unexpected argument: ${arg}`);
    const key = arg.slice(2).replaceAll("-", "_");
    if (key === "json" || key === "print_cd" || key === "authority_v2") result[key] = true;
    else result[key] = argv[++index];
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.wi || !args.branch) {
    throw new Error("Usage: node scripts/svc-ensure-worktree.mjs --wi WI-N --branch NAME [--from origin/main] [--authority-v2] [--print-cd] [--json]");
  }
  const authorityHost = resolveAuthorityHost({}, process.env);
  if (!authorityHost) throw new Error("trusted host identity is missing or unsupported");
  if (args.handoff) {
    const invocationRepo = repository(process.cwd()).root;
    const requestedBase = (args.from || "origin/main") === "origin/main" ? git(["rev-parse", "origin/main"], invocationRepo) : args.from;
    const handoff = consumeBootstrapHandoff(args.handoff, { host: authorityHost, repo_root: invocationRepo, wi: args.wi, branch: args.branch, base: requestedBase }, { env: process.env });
    // The session id crosses the hook/child boundary only through the private
    // one-use handoff, never as a shell argument. Existing callers may still
    // provide the host env identity; the handoff wins when present.
    process.env.SVC_SESSION_ID = handoff.session_id;
    process.env.SVC_HANDOFF_REPO_ROOT = handoff.repo_root;
  }
  const value = ensureWorktree(args);
  if (args.authority_v2) {
    value.authority_v2 = await migrateSessionBindingToV2({
      worktree_root: value.absolute_worktree,
      session_id: value.owner_session,
      host: authorityHost,
      env: process.env,
    });
  }
  if (args.json) process.stdout.write(`${JSON.stringify(value)}\n`);
  else if (args.print_cd) process.stdout.write(`cd ${JSON.stringify(value.absolute_worktree)}\n`);
  else process.stdout.write(`${value.absolute_worktree}\n`);
}

function isMainModule(argvPath, moduleUrl) {
  if (!argvPath) return false;
  try {
    return fs.realpathSync(argvPath) === fs.realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return path.resolve(argvPath) === path.resolve(fileURLToPath(moduleUrl));
  }
}

if (isMainModule(process.argv[1], import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`[svc-ensure-worktree] ${error.message}\n`);
    process.exit(2);
  });
}
