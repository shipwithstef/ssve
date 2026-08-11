// Atomic JSON/JSONL helpers for .svc/ state files.
//
// Usage:
//   import { readJsonAtomic, writeJsonAtomic, withStateLock, appendJsonlLine } from "./state-io.mjs";
//   const s = readJsonAtomic(".svc/orchestrator-state.json");
//   writeJsonAtomic(".svc/orchestrator-state.json", s);
//   withStateLock(".svc/lane-tasks-WI-123.json", () => { ...read/modify/write... });
//   appendJsonlLine(".svc/pipeline-decisions.jsonl", { ts: new Date().toISOString() });

import {
  appendFileSync,
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";

const DEFAULT_LOCK_TIMEOUT_MS = 5000;
const DEFAULT_STALE_LOCK_MS = 10 * 60 * 1000;
const DEFAULT_LOCK_RETRY_MS = 25;

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function readLock(lockPath) {
  try {
    return JSON.parse(readFileSync(lockPath, "utf8"));
  } catch {
    return null;
  }
}

function isStaleLock(lockPath, staleMs, now) {
  try {
    const meta = readLock(lockPath);
    const ts = Date.parse(meta?.ts ?? "");
    if (Number.isFinite(ts) && now - ts > staleMs) return true;
    const mtime = statSync(lockPath).mtimeMs;
    return now - mtime > staleMs;
  } catch {
    return true;
  }
}

function acquireStateLock(filePath, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  const staleMs = opts.staleMs ?? DEFAULT_STALE_LOCK_MS;
  const retryMs = opts.retryMs ?? DEFAULT_LOCK_RETRY_MS;
  const lockPath = `${filePath}.lock`;
  const start = Date.now();
  mkdirSync(dirname(filePath), { recursive: true });

  while (true) {
    try {
      const fd = openSync(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      writeFileSync(fd, JSON.stringify({ pid: process.pid, ts: new Date().toISOString(), filePath }));
      closeSync(fd);
      return () => {
        try { unlinkSync(lockPath); } catch {}
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const now = Date.now();
      if (isStaleLock(lockPath, staleMs, now)) {
        try { unlinkSync(lockPath); } catch {}
        continue;
      }
      if (now - start >= timeoutMs) {
        const meta = readLock(lockPath);
        throw new Error(
          `Timed out after ${timeoutMs}ms waiting for state lock ${lockPath}` +
            (meta?.pid ? ` held by pid ${meta.pid}` : "")
        );
      }
      sleepSync(retryMs);
    }
  }
}

export function readJsonAtomic(filePath) {
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, "utf8");
  if (!raw.trim()) return null;
  return JSON.parse(raw);
}

function writeJsonAtomicUnlocked(filePath, obj) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const rand = Math.random().toString(36).slice(2, 10);
  const tmp = `${filePath}.tmp.${process.pid}.${rand}`;
  const json = JSON.stringify(obj, null, 2) + "\n";
  writeFileSync(tmp, json, "utf8");
  // fsync to ensure data hits disk before rename
  try {
    const fd = openSync(tmp, "r+");
    fsyncSync(fd);
    closeSync(fd);
  } catch {
    // fsync may fail on some filesystems (e.g., tmpfs); proceed with rename
  }
  try {
    renameSync(tmp, filePath);
  } catch (err) {
    // Best effort cleanup
    try { unlinkSync(tmp); } catch {}
    throw err;
  }
}

export function withStateLock(filePath, fn, opts = {}) {
  const release = acquireStateLock(filePath, opts);
  try {
    return fn();
  } finally {
    release();
  }
}

export function writeJsonAtomic(filePath, obj, opts = {}) {
  return withStateLock(filePath, () => writeJsonAtomicUnlocked(filePath, obj), opts);
}

// WI-498 (F-004): a sentinel an `updater` may return to signal "no change —
// do NOT write". The read + decision still happen INSIDE the state lock, so a
// no-write outcome (e.g. an idempotent activate-skill reload of an already
// in_progress task) is byte-stable and TOCTOU-free: no other writer can slip
// between the check and the (skipped) write. `updateJsonAtomic` returns the
// unchanged `current` in that case.
export const NO_WRITE = Symbol("svc.state-io.NO_WRITE");

export function updateJsonAtomic(filePath, updater, fallback = null, opts = {}) {
  return withStateLock(filePath, () => {
    const current = readJsonAtomic(filePath) ?? fallback;
    const next = updater(current);
    if (next === NO_WRITE) {
      return current;
    }
    writeJsonAtomicUnlocked(filePath, next);
    return next;
  }, opts);
}

// Atomic JSONL rewrite: serialize all entries to a single newline-delimited
// payload, write via temp + fsync + rename under the state lock. Mirrors
// writeJsonAtomicUnlocked's safety contract for the multi-line JSONL case
// (e.g., audit-log rewrites in scripts/promote-auto-learnings.mjs per
// WI-343 tranche 2a Codex review MEDIUM finding). A crash mid-rewrite
// leaves the original file intact; on success the new payload is observed
// atomically by readers.
export function writeJsonlAtomic(filePath, entries, opts = {}) {
  return withStateLock(filePath, () => {
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });
    const rand = Math.random().toString(36).slice(2, 10);
    const tmp = `${filePath}.tmp.${process.pid}.${rand}`;
    const payload = entries.length === 0
      ? ""
      : entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
    writeFileSync(tmp, payload, "utf8");
    try {
      const fd = openSync(tmp, "r+");
      fsyncSync(fd);
      closeSync(fd);
    } catch {
      // fsync may fail on some filesystems (e.g., tmpfs); proceed with rename
    }
    try {
      renameSync(tmp, filePath);
    } catch (err) {
      try { unlinkSync(tmp); } catch {}
      throw err;
    }
  }, opts);
}

export function appendJsonlLine(filePath, obj, opts = {}) {
  return withStateLock(filePath, () => {
    mkdirSync(dirname(filePath), { recursive: true });
    appendFileSync(filePath, `${JSON.stringify(obj)}\n`, "utf8");
  }, opts);
}

export const stateIoDefaults = {
  lockTimeoutMs: DEFAULT_LOCK_TIMEOUT_MS,
  staleLockMs: DEFAULT_STALE_LOCK_MS,
  lockRetryMs: DEFAULT_LOCK_RETRY_MS,
};
