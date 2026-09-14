# WI-352: WI-Scoped Parallel Session Isolation — Implementation Manifest

- **Feature spec:** `docs/specs/work-items/WI-352.md`
- **Branch:** `framework-wi-352-wi-scoped-isolation`
- **Status:** DRAFTED
- **Base branch:** `main`
- **Base SHA:** `cda79a44a8a83d0f625012a2075c6e65d110d296`
- **Created:** 2026-05-29T17:26:00Z
- **Archetype:** Architectural change
- **Delivery tier:** full
- **Supersedes:** WI-351 (session_id-based isolation — incomplete, wrong abstraction)

---

## Problem Archetype

```
Problem archetype: Architectural change
Reasoning: Restructures the isolation model across all stop hooks, accumulators,
  worktree init, and guard logic. Touches 7 files across hooks/, scripts/, and
  test-framework/. Hard to reverse once hooks depend on the new resolution chain.
Planning mode: Map invariants and dependencies BEFORE planning tasks.
  - Invariant 1: All existing tier-1 tests must continue to pass
  - Invariant 2: Single-session behavior must be identical (zero regression)
  - Invariant 3: Fail-open behavior preserved — no new hard blocks for edge cases
  - Invariant 4: All 7 hosts (Claude, Gemini, Codex, Kimi, OpenCode, Antigravity, Cursor) must work
```

---

## Implementation Summary

### What this changes

Replace session_id-based hook isolation with WI-scoped isolation across the stop hook pipeline:

1. **New shared module `hooks/lib/resolve-wi.mjs`** — canonical WI resolution chain used by all hooks
2. **WI-scoped accumulator** in `svc-stop-quality.js` — `.svc/svc-edited-files-<WI>.json` instead of `...-<session_id>.json`
3. **WI-filtered guard** in `svc-task-completion-guard.sh` — uses resolve-wi instead of session-contract tail-1
4. **WI claims** — prevents two sessions executing the same WI simultaneously
5. **Worktree `.svc/` init** — `worktree.sh create` initializes `.svc/` so hooks find local state
6. **Role-aware guard skip** — reviewers/research sessions don't get blocked
7. **Stale cleanup** — orphaned claims, accumulators, `/tmp/` counters, stuck in_progress tasks

### What must remain invariant

- Single-session workflows behave identically (resolution chain falls through to same answer)
- `SVC_COMPLETION_FAIL_OPEN=true` bypass still works
- `isSubagent` early-exit still works (line 290 of guard)
- All hook exit codes unchanged (0=allow, 1=type-errors for quality; JSON block for guard)
- Session-contract.jsonl remains the audit log — just not the identity source
- All 8 existing lane-tasks files are handled correctly
- `/tmp/svc-completion-guard/` counter behavior preserved (but cleaned up)

### Major constraints

- Hooks run in isolated processes — no env var inheritance from skills unless set by host
- `.svc/` is gitignored — worktree init must happen at `worktree.sh create` time
- Cross-host compatibility: Claude sends stdin JSON payloads; Gemini/Codex/Kimi may differ
- The completion guard is a bash script with inline Node.js — changes must work in both

---

## Files Planned

| File | Action | Task | Purpose |
|------|--------|------|---------|
| `hooks/lib/resolve-wi.mjs` | CREATE | task-1 | Shared WI resolution chain for all hooks |
| `hooks/lib/wi-claim.mjs` | CREATE | task-2 | Active WI claim lifecycle (create, check, release, stale-detect) |
| `hooks/lib/stale-cleanup.mjs` | CREATE | task-3 | Session-start cleanup for orphaned state |
| `hooks/svc-stop-quality.js` | MODIFY | task-4 | Switch from session-scoped to WI-scoped accumulator |
| `hooks/svc-task-completion-guard.sh` | MODIFY | task-5 | Use resolve-wi for WI filtering + add role-aware skip |
| `scripts/worktree.sh` | MODIFY | task-6 | Initialize `.svc/` in worktree at create time |
| `test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh` | MODIFY | task-7 | Update for WI-scoped behavior + add worktree and role tests |
| `test-framework/evals/tier-1/validate-worktree-svc-init.sh` | CREATE | task-7 | New test for worktree .svc/ initialization |
| `docs/specs/work-items/WI-352.md` | MODIFY | task-8 | Update AC checkboxes |

---

## 3a. Changeset Blueprint

### File 1: `hooks/lib/resolve-wi.mjs` (CREATE)

```javascript
#!/usr/bin/env node

/**
 * Canonical WI resolution chain for svc hooks.
 *
 * Used by svc-stop-quality.js, svc-task-completion-guard.sh, and
 * any future hook that needs to know "which WI am I working on?"
 *
 * Resolution priority:
 *   1. SVC_WORKER_WI env var (set by dispatch-waves, skill orchestration)
 *   2. Hook payload .wi field (if host sends it)
 *   3. WI claim file (.svc/claims/<WI>.claim.json) matched by session token
 *   4. Git branch name (parse WI-\d+, feature-\d+, bugfix-\d+)
 *   5. Exactly one in_progress lane-tasks file
 *   6. Session-contract.jsonl last-line fallback (racy but better than nothing)
 *
 * Returns: string (e.g. "WI-352") or "" if unresolvable.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Find the nearest .svc/ directory, walking up from startDir.
 * @param {string} [startDir]
 * @returns {string|null}
 */
export function findSvcDir(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, ".svc");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  return null;
}

/**
 * Parse the WI from a git branch name.
 * Supports: WI-123, feature-123, bugfix-123, refactor-123,
 *           feature-auth-WI-123, framework-WI-352-description
 * @returns {string} e.g. "WI-123" or ""
 */
export function wiFromBranch() {
  try {
    const branch = execSync("git symbolic-ref --short HEAD 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
    // Try explicit WI-\d+ first (strongest signal)
    const wiMatch = branch.match(/WI-(\d+)/i);
    if (wiMatch) return `WI-${wiMatch[1]}`;
    // Fallback: feature-\d+ or bugfix-\d+
    const numMatch = branch.match(/(?:feature|bugfix|refactor)-(\d+)/i);
    if (numMatch) return `WI-${numMatch[1]}`;
    return "";
  } catch {
    return "";
  }
}

/**
 * Find the WI from a session token by checking claim files.
 * @param {string} svcDir
 * @param {string} sessionToken
 * @returns {string} WI or ""
 */
export function wiFromClaim(svcDir, sessionToken) {
  if (!svcDir || !sessionToken) return "";
  const claimsDir = path.join(svcDir, "claims");
  if (!fs.existsSync(claimsDir)) return "";
  try {
    for (const file of fs.readdirSync(claimsDir)) {
      if (!file.endsWith(".claim.json")) continue;
      const data = JSON.parse(fs.readFileSync(path.join(claimsDir, file), "utf8"));
      if (data.session_token === sessionToken) {
        return file.replace(".claim.json", "");
      }
    }
  } catch {
    // Fail open
  }
  return "";
}

/**
 * Find WI from exactly one in_progress lane-tasks file.
 * @param {string} svcDir
 * @returns {string} WI or ""
 */
export function wiFromSingleInProgress(svcDir) {
  if (!svcDir) return "";
  try {
    const files = fs.readdirSync(svcDir).filter(
      (f) => f.startsWith("lane-tasks-") && f.endsWith(".json") && !f.includes(".completed")
    );
    const inProgress = [];
    for (const f of files) {
      const graph = JSON.parse(fs.readFileSync(path.join(svcDir, f), "utf8"));
      const hasActive = (graph.tasks || []).some(
        (t) => t.status === "pending" || t.status === "in_progress"
      );
      if (hasActive) {
        const wi = graph.wi || f.replace("lane-tasks-", "").replace(".json", "");
        inProgress.push(wi);
      }
    }
    return inProgress.length === 1 ? inProgress[0] : "";
  } catch {
    return "";
  }
}

/**
 * Read the WI from the last session-contract entry.
 * This is the racy fallback — only used when nothing else works.
 * @param {string} svcDir
 * @returns {string} WI or ""
 */
export function wiFromLastContract(svcDir) {
  if (!svcDir) return "";
  const contractPath = path.join(svcDir, "session-contract.jsonl");
  if (!fs.existsSync(contractPath)) return "";
  try {
    const lines = fs.readFileSync(contractPath, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return "";
    const last = JSON.parse(lines[lines.length - 1]);
    return last.wi || "";
  } catch {
    return "";
  }
}

/**
 * Read the session role from the last session-contract entry.
 * @param {string} svcDir
 * @returns {string} role or ""
 */
export function sessionRoleFromContract(svcDir) {
  if (!svcDir) return "";
  const contractPath = path.join(svcDir, "session-contract.jsonl");
  if (!fs.existsSync(contractPath)) return "";
  try {
    const lines = fs.readFileSync(contractPath, "utf8").split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return "";
    const last = JSON.parse(lines[lines.length - 1]);
    return last.session_role || last.role || "";
  } catch {
    return "";
  }
}

/**
 * Resolve the active WI using the canonical priority chain.
 *
 * @param {object} [hookPayload] - Parsed hook stdin payload
 * @param {object} [env] - Process environment (defaults to process.env)
 * @returns {{ wi: string, source: string }}
 */
export function resolveWI(hookPayload, env) {
  const e = env || process.env;

  // 1. Explicit env var (dispatch-waves, skill orchestration)
  if (e.SVC_WORKER_WI) {
    return { wi: e.SVC_WORKER_WI, source: "SVC_WORKER_WI" };
  }

  // 2. Hook payload .wi field
  if (hookPayload?.wi) {
    return { wi: hookPayload.wi, source: "hook_payload" };
  }

  // 3. Claim file lookup by session token
  const svcDir = findSvcDir();
  const sessionToken =
    hookPayload?.session_id || hookPayload?.sessionId ||
    e.GEMINI_SESSION_ID || e.CODEX_SESSION_ID ||
    e.KIMI_SESSION_ID || e.CLAUDE_SESSION_ID || "";
  if (sessionToken && svcDir) {
    const claimWI = wiFromClaim(svcDir, sessionToken);
    if (claimWI) return { wi: claimWI, source: "claim_file" };
  }

  // 4. Git branch name
  const branchWI = wiFromBranch();
  if (branchWI) return { wi: branchWI, source: "branch_name" };

  // 5. Single in_progress lane-tasks
  if (svcDir) {
    const singleWI = wiFromSingleInProgress(svcDir);
    if (singleWI) return { wi: singleWI, source: "single_in_progress" };
  }

  // 6. Session-contract last line (racy fallback)
  if (svcDir) {
    const contractWI = wiFromLastContract(svcDir);
    if (contractWI) return { wi: contractWI, source: "contract_fallback" };
  }

  return { wi: "", source: "unresolved" };
}

/**
 * Check if the current session role is a non-execution role
 * that should skip the completion guard.
 *
 * @param {object} [hookPayload]
 * @param {object} [env]
 * @returns {boolean}
 */
export function isNonExecutionRole(hookPayload, env) {
  const e = env || process.env;
  const role =
    hookPayload?.session_role || hookPayload?.role ||
    e.SVC_SESSION_ROLE || "";

  const NON_BLOCKING_ROLES = new Set([
    "reviewer",
    "adversarial",
    "research",
    "audit",
    "cross-model-review",
  ]);
  if (NON_BLOCKING_ROLES.has(role)) return true;

  // Also check session-contract for role
  const svcDir = findSvcDir();
  if (svcDir) {
    const contractRole = sessionRoleFromContract(svcDir);
    if (NON_BLOCKING_ROLES.has(contractRole)) return true;
  }

  return false;
}
```

---

### File 2: `hooks/lib/wi-claim.mjs` (CREATE)

```javascript
#!/usr/bin/env node

/**
 * Active WI claim lifecycle for session isolation.
 *
 * Prevents two sessions from executing the same WI simultaneously.
 * Claims are stored as .svc/claims/<WI>.claim.json.
 *
 * Lifecycle:
 *   - claimWI(): Create or renew a claim (warns if already claimed by another session)
 *   - releaseClaim(): Delete the claim on session end
 *   - isClaimedByOther(): Check if another active session holds the claim
 *   - cleanStaleClaims(): Remove expired/dead claims
 */

import fs from "node:fs";
import path from "node:path";
import { findSvcDir } from "./resolve-wi.mjs";

const DEFAULT_TTL_HOURS = 24;

/**
 * Check if a process is still alive.
 * @param {number} pid
 * @returns {boolean}
 */
function isProcessAlive(pid) {
  if (!pid || typeof pid !== "number") return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a claim is stale (TTL expired or PID dead).
 * @param {object} claim
 * @returns {boolean}
 */
export function isClaimStale(claim) {
  if (!claim || !claim.started_at) return true;
  const ttlHours = claim.ttl_hours || DEFAULT_TTL_HOURS;
  const ageMs = Date.now() - Date.parse(claim.started_at);
  if (ageMs > ttlHours * 3600 * 1000) return true;
  if (claim.pid && !isProcessAlive(claim.pid)) return true;
  return false;
}

/**
 * Claim a WI for this session.
 * @param {string} wi - Work item ID (e.g. "WI-352")
 * @param {object} opts - { host, session_token, pid }
 * @returns {{ ok: boolean, warning?: string }}
 */
export function claimWI(wi, opts = {}) {
  const svcDir = findSvcDir();
  if (!svcDir) return { ok: false, warning: "No .svc/ directory found" };

  const claimsDir = path.join(svcDir, "claims");
  fs.mkdirSync(claimsDir, { recursive: true });

  const claimPath = path.join(claimsDir, `${wi}.claim.json`);

  // Check existing claim
  if (fs.existsSync(claimPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(claimPath, "utf8"));
      if (!isClaimStale(existing)) {
        const ageMin = Math.round((Date.now() - Date.parse(existing.started_at)) / 60000);
        return {
          ok: false,
          warning: `${wi} is already claimed by ${existing.host || "unknown"} (PID ${existing.pid || "?"}, started ${ageMin}m ago). Set SVC_CLAIM_FORCE=true to override.`,
        };
      }
      // Stale — overwrite
    } catch {
      // Corrupt — overwrite
    }
  }

  const claim = {
    wi,
    host: opts.host || process.env.SVC_HARNESS || "unknown",
    pid: opts.pid || process.pid,
    session_token: opts.session_token || "",
    started_at: new Date().toISOString(),
    ttl_hours: DEFAULT_TTL_HOURS,
  };

  fs.writeFileSync(claimPath, JSON.stringify(claim, null, 2) + "\n");
  return { ok: true };
}

/**
 * Release a WI claim.
 * @param {string} wi
 */
export function releaseClaim(wi) {
  const svcDir = findSvcDir();
  if (!svcDir) return;
  const claimPath = path.join(svcDir, "claims", `${wi}.claim.json`);
  try {
    fs.unlinkSync(claimPath);
  } catch {
    // Already gone
  }
}

/**
 * Clean all stale claims.
 * @returns {number} count of cleaned claims
 */
export function cleanStaleClaims() {
  const svcDir = findSvcDir();
  if (!svcDir) return 0;
  const claimsDir = path.join(svcDir, "claims");
  if (!fs.existsSync(claimsDir)) return 0;

  let cleaned = 0;
  for (const file of fs.readdirSync(claimsDir)) {
    if (!file.endsWith(".claim.json")) continue;
    try {
      const claim = JSON.parse(fs.readFileSync(path.join(claimsDir, file), "utf8"));
      if (isClaimStale(claim)) {
        fs.unlinkSync(path.join(claimsDir, file));
        cleaned++;
      }
    } catch {
      // Corrupt — remove
      try { fs.unlinkSync(path.join(claimsDir, file)); } catch {}
      cleaned++;
    }
  }
  return cleaned;
}
```

---

### File 3: `hooks/lib/stale-cleanup.mjs` (CREATE)

```javascript
#!/usr/bin/env node

/**
 * Stale state self-healing for svc hooks.
 *
 * Runs at session start (invoked by route-workflow or first hook).
 * Cleans up orphaned state from crashed sessions:
 *   - Stale WI claims (TTL expired or PID dead)
 *   - Orphaned accumulator files (>24h old)
 *   - /tmp/svc-completion-guard/ counter files (>48h old)
 *   - Stuck in_progress tasks (>8h old with no active claim)
 */

import fs from "node:fs";
import path from "node:path";
import { findSvcDir } from "./resolve-wi.mjs";
import { cleanStaleClaims, isClaimStale } from "./wi-claim.mjs";

const ACCUMULATOR_MAX_AGE_MS = 24 * 3600 * 1000; // 24h
const COUNTER_MAX_AGE_MS = 48 * 3600 * 1000; // 48h
const IN_PROGRESS_MAX_AGE_MS = 8 * 3600 * 1000; // 8h

/**
 * Clean orphaned accumulator files.
 * @param {string} svcDir
 * @returns {number} count cleaned
 */
function cleanOrphanedAccumulators(svcDir) {
  let cleaned = 0;
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(svcDir)) {
      if (!file.startsWith("svc-edited-files") || !file.endsWith(".json")) continue;
      const filePath = path.join(svcDir, file);
      const mtime = fs.statSync(filePath).mtimeMs;
      if (now - mtime > ACCUMULATOR_MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
  } catch {
    // Fail open
  }
  return cleaned;
}

/**
 * Clean /tmp/svc-completion-guard/ counter files.
 * @returns {number} count cleaned
 */
function cleanCounterFiles() {
  const counterDir = path.join(process.env.TMPDIR || "/tmp", "svc-completion-guard");
  if (!fs.existsSync(counterDir)) return 0;
  let cleaned = 0;
  const now = Date.now();
  try {
    for (const file of fs.readdirSync(counterDir)) {
      const filePath = path.join(counterDir, file);
      const mtime = fs.statSync(filePath).mtimeMs;
      if (now - mtime > COUNTER_MAX_AGE_MS) {
        fs.unlinkSync(filePath);
        cleaned++;
      }
    }
  } catch {
    // Fail open
  }
  return cleaned;
}

/**
 * Reset stuck in_progress tasks (>8h old with no active claim).
 * @param {string} svcDir
 * @returns {number} count reset
 */
function resetStuckTasks(svcDir) {
  let reset = 0;
  const now = Date.now();
  const claimsDir = path.join(svcDir, "claims");

  try {
    for (const file of fs.readdirSync(svcDir)) {
      if (!file.startsWith("lane-tasks-") || !file.endsWith(".json") || file.includes(".completed")) continue;
      const filePath = path.join(svcDir, file);
      const graph = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const wi = graph.wi || file.replace("lane-tasks-", "").replace(".json", "");

      // Check if WI has an active claim
      let hasActiveClaim = false;
      const claimPath = path.join(claimsDir, `${wi}.claim.json`);
      if (fs.existsSync(claimPath)) {
        try {
          const claim = JSON.parse(fs.readFileSync(claimPath, "utf8"));
          hasActiveClaim = !isClaimStale(claim);
        } catch {}
      }

      if (hasActiveClaim) continue; // Someone is actively working on this

      let modified = false;
      for (const task of graph.tasks || []) {
        if (task.status !== "in_progress") continue;
        const taskAge = task.started_at ? now - Date.parse(task.started_at) : Infinity;
        if (taskAge > IN_PROGRESS_MAX_AGE_MS) {
          task.status = "pending";
          task.notes = (task.notes || "") + ` [auto-reset: stale in_progress after ${Math.round(taskAge / 3600000)}h, no active claim]`;
          modified = true;
          reset++;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, JSON.stringify(graph, null, 2) + "\n");
      }
    }
  } catch {
    // Fail open
  }
  return reset;
}

/**
 * Run all stale cleanup tasks.
 * @returns {{ claims: number, accumulators: number, counters: number, tasks: number }}
 */
export function runStaleCleanup() {
  const svcDir = findSvcDir();
  const result = {
    claims: cleanStaleClaims(),
    accumulators: svcDir ? cleanOrphanedAccumulators(svcDir) : 0,
    counters: cleanCounterFiles(),
    tasks: svcDir ? resetStuckTasks(svcDir) : 0,
  };
  const total = result.claims + result.accumulators + result.counters + result.tasks;
  if (total > 0) {
    process.stderr.write(
      `[svc-stale-cleanup] Cleaned: ${result.claims} claims, ${result.accumulators} accumulators, ` +
      `${result.counters} counter files, ${result.tasks} stuck tasks\n`
    );
  }
  return result;
}

// CLI entry point
if (process.argv[1] && process.argv[1].endsWith("stale-cleanup.mjs")) {
  runStaleCleanup();
}
```

---

### File 4: `hooks/svc-stop-quality.js` (MODIFY)

<<<<<<< BEFORE
function getAccumulatorFile(sessionId) {
  if (sessionId) {
    return path.join(process.cwd(), ".svc", `svc-edited-files-${sessionId}.json`);
  }
  return path.join(process.cwd(), ".svc", "svc-edited-files.json");
}
=======
function findSvcDir(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  while (dir !== path.dirname(dir)) {
    const candidate = path.join(dir, ".svc");
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  // Fallback: create in cwd
  const fallback = path.join(process.cwd(), ".svc");
  if (!fs.existsSync(fallback)) {
    try { fs.mkdirSync(fallback, { recursive: true }); } catch {}
  }
  return fallback;
}

function getAccumulatorFile(wi) {
  const svcDir = findSvcDir();
  if (wi) {
    return path.join(svcDir, `svc-edited-files-${wi}.json`);
  }
  return path.join(svcDir, "svc-edited-files.json");
}
>>>>>>> AFTER

<<<<<<< BEFORE
async function accumulate(toolInput) {
  if (!shouldRun()) return;
  const { readJsonAtomic, writeJsonAtomic } = await import("../scripts/state-io.mjs");

  let sessionId = "";
  let filePath = null;

  const payload = parsePayload();
  if (payload) {
    sessionId = payload.session_id || payload.sessionId || payload.session || "";
    const toolInputParsed = payload.tool_input || payload.toolInput || payload.arguments || payload.args || payload.input || null;
    if (toolInputParsed) {
      filePath = toolInputParsed.file_path || toolInputParsed.filePath || toolInputParsed.path || toolInputParsed.file || null;
    }
  }

  if (!sessionId) {
    sessionId = process.env.GEMINI_SESSION_ID || process.env.CODEX_SESSION_ID || process.env.KIMI_SESSION_ID || process.env.CLAUDE_SESSION_ID || "";
  }
=======
async function accumulate(toolInput) {
  if (!shouldRun()) return;
  const { readJsonAtomic, writeJsonAtomic } = await import("../scripts/state-io.mjs");
  const { resolveWI } = await import("./lib/resolve-wi.mjs");

  let filePath = null;

  const payload = parsePayload();
  if (payload) {
    const toolInputParsed = payload.tool_input || payload.toolInput || payload.arguments || payload.args || payload.input || null;
    if (toolInputParsed) {
      filePath = toolInputParsed.file_path || toolInputParsed.filePath || toolInputParsed.path || toolInputParsed.file || null;
    }
  }

  // Resolve WI using canonical chain
  const { wi } = resolveWI(payload);
>>>>>>> AFTER

<<<<<<< BEFORE
  const accumulatorFile = getAccumulatorFile(sessionId);
=======
  const accumulatorFile = getAccumulatorFile(wi);
>>>>>>> AFTER

In the `check()` function:

<<<<<<< BEFORE
  let sessionId = "";
  const payload = parsePayload();
  if (payload) {
    sessionId = payload.session_id || payload.sessionId || payload.session || "";
  }
  if (!sessionId) {
    sessionId = process.env.GEMINI_SESSION_ID || process.env.CODEX_SESSION_ID || process.env.KIMI_SESSION_ID || process.env.CLAUDE_SESSION_ID || "";
  }

  const accumulatorFile = getAccumulatorFile(sessionId);
=======
  const { resolveWI } = await import("./lib/resolve-wi.mjs");
  const payload = parsePayload();
  const { wi } = resolveWI(payload);

  const accumulatorFile = getAccumulatorFile(wi);
>>>>>>> AFTER

And change `check()` from sync to async (it already calls `process.exit` so this is safe):

<<<<<<< BEFORE
function check() {
=======
async function check() {
>>>>>>> AFTER

Fix the `cleanup()` call on empty files path:

<<<<<<< BEFORE
  if (files.length === 0) {
    cleanup();
    process.exit(0);
  }
=======
  if (files.length === 0) {
    cleanup(accumulatorFile);
    process.exit(0);
  }
>>>>>>> AFTER

---

### File 5: `hooks/svc-task-completion-guard.sh` (MODIFY)

Replace the inline session_id resolution block (lines 311-365) with WI resolution via the shared module:

<<<<<<< BEFORE
const sessionId = input.session_id || input.sessionId || input.session || 
                  process.env.GEMINI_SESSION_ID || process.env.CODEX_SESSION_ID || 
                  process.env.KIMI_SESSION_ID || process.env.CLAUDE_SESSION_ID || "";

let activeWi = "";
const contractPath = laneFiles[0] ? path.join(path.dirname(laneFiles[0]), "session-contract.jsonl") : null;
if (contractPath && fs.existsSync(contractPath)) {
  try {
    const lines = fs.readFileSync(contractPath, "utf8").split(/\r?\n/).filter(Boolean);
    let matchedEntry = null;
    if (sessionId) {
      for (let i = lines.length - 1; i >= 0; i--) {
        const entry = JSON.parse(lines[i]);
        if (entry.session_id === sessionId) {
          matchedEntry = entry;
          break;
        }
      }
    }
    if (!matchedEntry && lines.length > 0) {
      matchedEntry = JSON.parse(lines[lines.length - 1]);
    }
    if (matchedEntry) {
      activeWi = matchedEntry.wi || "";
    }
  } catch (error) {
    warnings.push(`failed to parse ${contractPath}: ${error.message}`);
  }
}

if (!activeWi) {
  try {
    const { execSync } = require("node:child_process");
    const branchName = execSync("git symbolic-ref --short HEAD", { encoding: "utf8" }).trim();
    const match = branchName.match(/WI-(\d+)/i) || branchName.match(/feature-(\d+)/i) || branchName.match(/bugfix-(\d+)/i);
    if (match) {
      activeWi = `WI-${match[1]}`;
    }
  } catch (e) {}
}

const workerWi = process.env.SVC_WORKER_WI || activeWi;
=======
// WI resolution — canonical chain (resolve-wi.mjs inlined for bash-embedded Node)
function resolveActiveWI(hookInput) {
  // 1. SVC_WORKER_WI env var
  if (process.env.SVC_WORKER_WI) return process.env.SVC_WORKER_WI;
  // 2. Hook payload .wi
  if (hookInput?.wi) return hookInput.wi;
  // 3. Git branch name (WI-\d+, feature-\d+, bugfix-\d+, refactor-\d+)
  try {
    const { execSync } = require("node:child_process");
    const branch = execSync("git symbolic-ref --short HEAD 2>/dev/null", { encoding: "utf8" }).trim();
    const m = branch.match(/WI-(\d+)/i) || branch.match(/(?:feature|bugfix|refactor)-(\d+)/i);
    if (m) return `WI-${m[1]}`;
  } catch {}
  // 4. Single in_progress lane-tasks
  const svcDir = laneFiles[0] ? path.dirname(laneFiles[0]) : null;
  if (svcDir) {
    const activeGraphs = laneFiles.filter((f) => {
      try {
        const g = JSON.parse(fs.readFileSync(f, "utf8"));
        return (g.tasks || []).some((t) => t.status === "pending" || t.status === "in_progress");
      } catch { return false; }
    });
    if (activeGraphs.length === 1) {
      try {
        const g = JSON.parse(fs.readFileSync(activeGraphs[0], "utf8"));
        return g.wi || path.basename(activeGraphs[0]).replace("lane-tasks-", "").replace(".json", "");
      } catch {}
    }
  }
  // 5. Session-contract last-line (racy fallback)
  if (svcDir) {
    const cp = path.join(svcDir, "session-contract.jsonl");
    if (fs.existsSync(cp)) {
      try {
        const lines = fs.readFileSync(cp, "utf8").split(/\r?\n/).filter(Boolean);
        if (lines.length > 0) {
          const last = JSON.parse(lines[lines.length - 1]);
          return last.wi || "";
        }
      } catch {}
    }
  }
  return "";
}

// Role-aware skip: non-execution roles should not be blocked
function isNonExecutionRole(hookInput) {
  const role = hookInput?.session_role || hookInput?.role || process.env.SVC_SESSION_ROLE || "";
  const NON_BLOCKING = new Set(["reviewer", "adversarial", "research", "audit", "cross-model-review"]);
  if (NON_BLOCKING.has(role)) return true;
  // Also check session-contract for role
  const svcDir = laneFiles[0] ? path.dirname(laneFiles[0]) : null;
  if (svcDir) {
    const cp = path.join(svcDir, "session-contract.jsonl");
    if (fs.existsSync(cp)) {
      try {
        const lines = fs.readFileSync(cp, "utf8").split(/\r?\n/).filter(Boolean);
        if (lines.length > 0) {
          const last = JSON.parse(lines[lines.length - 1]);
          const contractRole = last.session_role || last.role || "";
          if (NON_BLOCKING.has(contractRole)) return true;
        }
      } catch {}
    }
  }
  return false;
}

if (isNonExecutionRole(input)) {
  console.log("status\tallow");
  process.exit(0);
}

const workerWi = resolveActiveWI(input);
>>>>>>> AFTER

---

### File 6: `scripts/worktree.sh` (MODIFY)

After line 384 (`ok "Worktree created"`), add `.svc/` initialization:

<<<<<<< BEFORE
  ok "Worktree created"

  # --- Project setup (auto-detect) ---
  _run_setup "$wt_path"
=======
  ok "Worktree created"

  # --- Initialize worktree-local .svc/ ---
  local wt_svc="$wt_path/.svc"
  mkdir -p "$wt_svc/claims"

  # Extract WI from branch name for lane-tasks init
  local wt_wi=""
  if [[ "$branch_name" =~ WI-([0-9]+) ]]; then
    wt_wi="WI-${BASH_REMATCH[1]}"
  elif [[ "$branch_name" =~ (feature|bugfix|refactor)-([0-9]+) ]]; then
    wt_wi="WI-${BASH_REMATCH[2]}"
  fi

  if [[ -n "$wt_wi" ]]; then
    # Initialize lane-tasks for this WI
    local lt_file="$wt_svc/lane-tasks-${wt_wi}.json"
    if [[ ! -f "$lt_file" ]]; then
      cat > "$lt_file" <<LANE_EOF
{"wi": "${wt_wi}", "tasks": [], "created": "$(date -u +%Y-%m-%dT%H:%M:%SZ)", "source": "worktree-init"}
LANE_EOF
      info "Initialized $lt_file"
    fi

    # Initialize session contract
    echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"wi\":\"${wt_wi}\",\"bound_to\":\"wi-backlog\",\"request\":\"worktree-init for ${branch_name}\",\"skill\":null,\"guard_override_count\":0}" \
      > "$wt_svc/session-contract.jsonl"
    info "Initialized worktree session contract for $wt_wi"
  else
    # No WI in branch name — create minimal .svc/
    echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"bound_to\":\"wi-backlog\",\"request\":\"worktree-init for ${branch_name}\",\"skill\":null,\"guard_override_count\":0}" \
      > "$wt_svc/session-contract.jsonl"
    info "Initialized worktree .svc/ (no WI detected in branch name)"
  fi

  # --- Project setup (auto-detect) ---
  _run_setup "$wt_path"
>>>>>>> AFTER

---

### File 7: Tests (MODIFY + CREATE)

`test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh` — rewrite for WI-scoped:

Full replacement (the test must verify WI-scoped, not session-scoped):

```bash
#!/usr/bin/env bash
#
# Tier-1 regression test: WI-scoped stop hook session isolation.
# Tests accumulator isolation by WI, role-aware guard skip, and
# worktree .svc/ init.
#
set -euo pipefail

echo "=== Tier 1: Stop hook WI-scoped session isolation ==="

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
SVC_DIR="${ROOT}/.svc"
mkdir -p "$SVC_DIR"

# Clean up any leftover test accumulators
rm -f "$SVC_DIR"/svc-edited-files-WI-TEST-*.json

# 1. Test WI-scoped accumulator isolation
echo "--- Test 1: WI-scoped accumulator isolation ---"
SVC_WORKER_WI=WI-TEST-A echo '{"tool_name":"Edit","tool_input":{"file_path":"scripts/state-io.mjs"}}' | \
  node "$ROOT/hooks/svc-stop-quality.js" --accumulate
SVC_WORKER_WI=WI-TEST-B echo '{"tool_name":"Edit","tool_input":{"file_path":"hooks/svc-stop-quality.js"}}' | \
  node "$ROOT/hooks/svc-stop-quality.js" --accumulate

if [ ! -f "$SVC_DIR/svc-edited-files-WI-TEST-A.json" ]; then
  echo "FAIL: WI-TEST-A accumulator not created" >&2; exit 1
fi
if [ ! -f "$SVC_DIR/svc-edited-files-WI-TEST-B.json" ]; then
  echo "FAIL: WI-TEST-B accumulator not created" >&2; exit 1
fi

A_CONTENT=$(cat "$SVC_DIR/svc-edited-files-WI-TEST-A.json")
B_CONTENT=$(cat "$SVC_DIR/svc-edited-files-WI-TEST-B.json")

if [[ ! "$A_CONTENT" =~ "state-io.mjs" ]] || [[ "$A_CONTENT" =~ "svc-stop-quality.js" ]]; then
  echo "FAIL: WI-TEST-A accumulator crosstalk: $A_CONTENT" >&2; exit 1
fi
if [[ ! "$B_CONTENT" =~ "svc-stop-quality.js" ]] || [[ "$B_CONTENT" =~ "state-io.mjs" ]]; then
  echo "FAIL: WI-TEST-B accumulator crosstalk: $B_CONTENT" >&2; exit 1
fi
echo "  WI-scoped accumulator isolation: PASS"

# 2. Test that resolve-wi.mjs exports work
echo "--- Test 2: resolve-wi.mjs module loads ---"
node -e "
  import('$ROOT/hooks/lib/resolve-wi.mjs').then(m => {
    if (typeof m.resolveWI !== 'function') { console.error('FAIL: resolveWI not a function'); process.exit(1); }
    if (typeof m.findSvcDir !== 'function') { console.error('FAIL: findSvcDir not a function'); process.exit(1); }
    if (typeof m.isNonExecutionRole !== 'function') { console.error('FAIL: isNonExecutionRole not a function'); process.exit(1); }
    console.log('  resolve-wi.mjs module: PASS');
  }).catch(e => { console.error('FAIL: ' + e.message); process.exit(1); });
"

# 3. Test SVC_WORKER_WI takes priority in resolution
echo "--- Test 3: SVC_WORKER_WI priority ---"
SVC_WORKER_WI=WI-PRIORITY node -e "
  import('$ROOT/hooks/lib/resolve-wi.mjs').then(m => {
    const { wi, source } = m.resolveWI({});
    if (wi !== 'WI-PRIORITY') { console.error('FAIL: expected WI-PRIORITY, got ' + wi); process.exit(1); }
    if (source !== 'SVC_WORKER_WI') { console.error('FAIL: expected source SVC_WORKER_WI, got ' + source); process.exit(1); }
    console.log('  SVC_WORKER_WI priority: PASS');
  });
"

# 4. Test role-aware skip
echo "--- Test 4: Non-execution role detection ---"
node -e "
  import('$ROOT/hooks/lib/resolve-wi.mjs').then(m => {
    if (!m.isNonExecutionRole({ session_role: 'reviewer' })) { console.error('FAIL: reviewer should be non-execution'); process.exit(1); }
    if (!m.isNonExecutionRole({ role: 'adversarial' })) { console.error('FAIL: adversarial should be non-execution'); process.exit(1); }
    if (m.isNonExecutionRole({ role: 'executor' })) { console.error('FAIL: executor should NOT be non-execution'); process.exit(1); }
    if (m.isNonExecutionRole({})) { console.error('FAIL: empty role should NOT be non-execution'); process.exit(1); }
    console.log('  Role-aware detection: PASS');
  });
"

# Clean up test accumulators
rm -f "$SVC_DIR"/svc-edited-files-WI-TEST-*.json

echo "Stop hook WI-scoped session isolation: passed"
exit 0
```

New file `test-framework/evals/tier-1/validate-worktree-svc-init.sh`:

```bash
#!/usr/bin/env bash
#
# Tier-1 validation: worktree.sh create initializes .svc/ directory.
# This is a dry-run check — it doesn't create actual worktrees.
# It verifies the create function CONTAINS the .svc/ initialization code.
#
set -euo pipefail

echo "=== Tier 1: Worktree .svc/ initialization ==="

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORKTREE_SCRIPT="$ROOT/scripts/worktree.sh"

# Check that worktree.sh contains .svc/ initialization
if ! grep -q 'wt_svc.*\.svc' "$WORKTREE_SCRIPT"; then
  echo "FAIL: worktree.sh does not contain .svc/ initialization in create" >&2
  exit 1
fi
echo "  worktree.sh contains .svc/ init: PASS"

# Check that it creates claims directory
if ! grep -q 'claims' "$WORKTREE_SCRIPT"; then
  echo "FAIL: worktree.sh does not create claims/ directory" >&2
  exit 1
fi
echo "  worktree.sh creates claims/: PASS"

# Check that it initializes session-contract.jsonl
if ! grep -q 'session-contract.jsonl' "$WORKTREE_SCRIPT"; then
  echo "FAIL: worktree.sh does not initialize session-contract.jsonl" >&2
  exit 1
fi
echo "  worktree.sh creates session-contract: PASS"

# Check that resolve-wi.mjs exists
if [ ! -f "$ROOT/hooks/lib/resolve-wi.mjs" ]; then
  echo "FAIL: hooks/lib/resolve-wi.mjs does not exist" >&2
  exit 1
fi
echo "  resolve-wi.mjs exists: PASS"

# Check that wi-claim.mjs exists
if [ ! -f "$ROOT/hooks/lib/wi-claim.mjs" ]; then
  echo "FAIL: hooks/lib/wi-claim.mjs does not exist" >&2
  exit 1
fi
echo "  wi-claim.mjs exists: PASS"

echo "Worktree .svc/ initialization: passed"
exit 0
```

---

## Task Graph

| ID | Title | Files | Depends | AC | Validation | Checkpoint |
|----|-------|-------|---------|-----|------------|------------|
| task-1 | Create resolve-wi.mjs | `hooks/lib/resolve-wi.mjs` | — | AC1 | `node -e "import('./hooks/lib/resolve-wi.mjs')"` | `cp-resolve-wi` |
| task-2 | Create wi-claim.mjs | `hooks/lib/wi-claim.mjs` | task-1 | AC4 | `node -e "import('./hooks/lib/wi-claim.mjs')"` | `cp-wi-claim` |
| task-3 | Create stale-cleanup.mjs | `hooks/lib/stale-cleanup.mjs` | task-1, task-2 | AC7 | `node -e "import('./hooks/lib/stale-cleanup.mjs')"` | `cp-stale-cleanup` |
| task-4 | Refactor svc-stop-quality.js | `hooks/svc-stop-quality.js` | task-1 | AC2 | Session isolation test | `cp-accumulator` |
| task-5 | Refactor svc-task-completion-guard.sh | `hooks/svc-task-completion-guard.sh` | task-1 | AC3, AC6 | Guard test with SVC_WORKER_WI | `cp-guard` |
| task-6 | Add .svc/ init to worktree.sh | `scripts/worktree.sh` | — | AC5 | Worktree init test | `cp-worktree` |
| task-7 | Update/create tier-1 tests | `test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh`, `test-framework/evals/tier-1/validate-worktree-svc-init.sh` | task-1 thru task-6 | AC8, AC9 | `bash test-framework/evals/run-all-evals.sh` | `cp-tests` |
| task-8 | Update WI-352 ACs + FRAMEWORK-STATE | `docs/specs/work-items/WI-352.md`, `FRAMEWORK-STATE.md` | task-7 | AC10 | Manual | `cp-docs` |

**Parallel groups:** task-4 and task-5 can run in parallel (both depend only on task-1). task-6 is independent.

---

## AC-to-Task Mapping

| AC | Task |
|----|------|
| AC1: resolve-wi.mjs with 6-step chain | task-1 |
| AC2: WI-scoped accumulator | task-4 |
| AC3: Guard uses resolveWI | task-5 |
| AC4: WI claims | task-2 |
| AC5: worktree.sh .svc/ init | task-6 |
| AC6: Role-aware guard skip | task-5 |
| AC7: Stale cleanup | task-3 |
| AC8: Tier-1 WI-scoped isolation test | task-7 |
| AC9: All tier-1 pass | task-7 |
| AC10: Scenario coverage | task-7 |

---

## AC-to-Test Mapping

| AC | Test Type | Test |
|----|-----------|------|
| AC1 | Unit | `validate-stop-hook-session-isolation.sh` Test 2 & 3 |
| AC2 | Unit | `validate-stop-hook-session-isolation.sh` Test 1 |
| AC3 | Unit | Guard run with SVC_WORKER_WI |
| AC4 | Unit | Claim create/release/stale-detect |
| AC5 | Unit | `validate-worktree-svc-init.sh` |
| AC6 | Unit | `validate-stop-hook-session-isolation.sh` Test 4 |
| AC7 | Manual | Run stale-cleanup against /tmp/ counter files |
| AC8 | Unit | `validate-stop-hook-session-isolation.sh` passes |
| AC9 | Unit | `run-all-evals.sh` passes |

---

## External State

| # | Environment | What state | Coupling | Lifecycle wiring |
|---|-------------|------------|----------|------------------|
| 1 | .svc/claims/ (gitignored local) | WI claim files | coupled | Created by claimWI(), cleaned by cleanStaleClaims() |
| 2 | .svc/svc-edited-files-<WI>.json (gitignored local) | WI-scoped accumulators | coupled | Created by accumulate(), cleaned by cleanup() and stale-cleanup |
| 3 | /tmp/svc-completion-guard/ (tmpfs) | Counter files | coupled | Created by guard, cleaned by stale-cleanup |
| 4 | .worktrees/<branch>/.svc/ (gitignored local) | Worktree-local svc state | coupled | Created by worktree.sh create, removed by worktree.sh remove |

Untouched environments: 5-15 (no external services, no deployment, no CI, no secrets, no databases)

---

## Validation Plan

### Per-task validation

| Task | Validation command |
|------|--------------------|
| task-1 | `node -e "import('./hooks/lib/resolve-wi.mjs').then(m => { console.log(m.resolveWI({})); })"` |
| task-2 | `node -e "import('./hooks/lib/wi-claim.mjs').then(m => { console.log(m.claimWI('WI-TEST')); m.releaseClaim('WI-TEST'); })"` |
| task-3 | `node hooks/lib/stale-cleanup.mjs` |
| task-4 | `SVC_WORKER_WI=WI-TEST echo '{"tool_input":{"file_path":"test.js"}}' \| node hooks/svc-stop-quality.js --accumulate && cat .svc/svc-edited-files-WI-TEST.json && rm .svc/svc-edited-files-WI-TEST.json` |
| task-5 | `SVC_WORKER_WI=WI-TEST echo '{}' \| bash hooks/svc-task-completion-guard.sh` |
| task-6 | `grep -c 'wt_svc' scripts/worktree.sh` |
| task-7 | `bash test-framework/evals/tier-1/validate-stop-hook-session-isolation.sh && bash test-framework/evals/tier-1/validate-worktree-svc-init.sh` |

### Final validation

```bash
bash test-framework/evals/run-all-evals.sh
```

---

## Checkpoint Plan

| # | Checkpoint | After task | Rollback |
|---|-----------|------------|----------|
| 1 | `cp-resolve-wi` | task-1 | `git checkout -- hooks/lib/resolve-wi.mjs` |
| 2 | `cp-wi-claim` | task-2 | `git checkout -- hooks/lib/wi-claim.mjs` |
| 3 | `cp-stale-cleanup` | task-3 | `git checkout -- hooks/lib/stale-cleanup.mjs` |
| 4 | `cp-accumulator` | task-4 | `git checkout -- hooks/svc-stop-quality.js` |
| 5 | `cp-guard` | task-5 | `git checkout -- hooks/svc-task-completion-guard.sh` |
| 6 | `cp-worktree` | task-6 | `git checkout -- scripts/worktree.sh` |
| 7 | `cp-tests` | task-7 | Revert test files |
| 8 | `cp-docs` | task-8 | Revert doc files |

---

## Promotion Readiness Checklist

- [ ] All 9 planned files accounted for
- [ ] All 8 tasks have validation commands
- [ ] All 10 ACs mapped to tasks
- [ ] All 8 checkpoints named
- [ ] Final diff contains only manifest-listed files
- [ ] Tier-1 suite passes
- [ ] No schema drift (no ORM/migration files)

---

## Simulation Report

| Task | Check | Result | Action |
|------|-------|--------|--------|
| task-1 | hooks/lib/resolve-wi.mjs does not exist | PASS (CREATE) | — |
| task-1 | hooks/lib/hook-payload.mjs exists (peer module) | PASS | Import pattern matches |
| task-2 | hooks/lib/wi-claim.mjs does not exist | PASS (CREATE) | — |
| task-2 | imports resolve-wi.mjs (task-1 creates) | PASS (planned layer) | — |
| task-3 | hooks/lib/stale-cleanup.mjs does not exist | PASS (CREATE) | — |
| task-3 | imports resolve-wi.mjs + wi-claim.mjs | PASS (planned layer) | — |
| task-4 | hooks/svc-stop-quality.js exists | PASS (MODIFY) | — |
| task-4 | getAccumulatorFile function at L46-51 | PASS | Target found |
| task-4 | accumulate function at L68-130 | PASS | Target found |
| task-4 | check function at L197 | PASS | Target found |
| task-4 | dynamic import of state-io.mjs works | PASS | Verified in prior test |
| task-5 | hooks/svc-task-completion-guard.sh exists | PASS (MODIFY) | — |
| task-5 | session_id resolution block at L311-365 | PASS | Target found |
| task-6 | scripts/worktree.sh cmd_create at L329-399 | PASS | Target found |
| task-6 | No existing .svc/ init code | PASS | Confirmed zero references |
| task-7 | validate-stop-hook-session-isolation.sh exists | PASS (MODIFY) | — |
| task-7 | validate-worktree-svc-init.sh does not exist | PASS (CREATE) | — |

---

## Loop-Back Targets

- If `check()` async conversion causes issues in the main() entrypoint → review async flow
- If worktree .svc/ init conflicts with project-specific .svc/ files → discuss-phase
- If WI resolution performance is noticeable (6 resolution steps) → optimize with early-exit caching
