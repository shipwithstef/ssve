// Cooperative file lock for .svc/ state files.
//
// Usage:
//   import { acquireLock } from "./state-lock.mjs";
//   const release = acquireLock(".svc/orchestrator-state.json");
//   try { ... } finally { release(); }
//
// The lock file is `<path>.lock` and contains JSON {pid, ts}. Stale locks
// (older than staleMs, default 10 minutes) are auto-expired.

import { existsSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync, constants } from "node:fs";

const DEFAULT_STALE_MS = 10 * 60 * 1000;

export function acquireLock(filePath, opts = {}) {
  const staleMs = typeof opts.staleMs === "number" ? opts.staleMs : DEFAULT_STALE_MS;
  const lockPath = `${filePath}.lock`;
  const now = Date.now();

  if (existsSync(lockPath)) {
    try {
      const raw = readFileSync(lockPath, "utf8");
      const info = JSON.parse(raw);
      const lockTs = Date.parse(info.ts);
      if (Number.isFinite(lockTs) && now - lockTs < staleMs) {
        throw new Error(`state-lock: ${lockPath} held by pid ${info.pid} since ${info.ts}`);
      }
      // stale — drop it
      try { unlinkSync(lockPath); } catch {}
    } catch (e) {
      if (String(e.message).startsWith("state-lock:")) throw e;
      // Corrupt lock file — replace it
      try { unlinkSync(lockPath); } catch {}
    }
  }

  // Atomic create with O_EXCL
  let fd;
  try {
    fd = openSync(lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o644);
  } catch (e) {
    throw new Error(`state-lock: failed to acquire ${lockPath}: ${e.message}`);
  }
  try {
    closeSync(fd);
    writeFileSync(lockPath, JSON.stringify({ pid: process.pid, ts: new Date(now).toISOString() }));
  } catch (e) {
    try { unlinkSync(lockPath); } catch {}
    throw e;
  }

  let released = false;
  return function release() {
    if (released) return;
    released = true;
    try { unlinkSync(lockPath); } catch {}
  };
}
