import { lstatSync, readdirSync, unlinkSync } from "node:fs";
import path from "node:path";
import { withStateLock } from "../../scripts/state-io.mjs";

export const LOOP_GUARD_STATE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const LOOP_GUARD_PRUNE_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const LOOP_GUARD_PRUNE_BATCH_SIZE = 32;

const LOOP_GUARD_STATE_NAME =
  /^loop-guard-state(?:-[A-Za-z0-9_-]{1,48})?\.json$/;

function regularNonSymlink(filePath, statFile = lstatSync) {
  const stat = statFile(filePath);
  return stat.isFile() && !stat.isSymbolicLink() ? stat : null;
}

export function shouldPruneLoopGuardState(currentStateFile, now = Date.now()) {
  try {
    const stat = regularNonSymlink(currentStateFile);
    if (!stat) return true;
    return stat.mtimeMs <= now - LOOP_GUARD_PRUNE_INTERVAL_MS;
  } catch {
    return true;
  }
}

export function pruneExpiredLoopGuardStates({
  svcDir,
  currentStateFile,
  now = Date.now(),
}, operations = {}) {
  const result = { scanned: 0, removed: 0 };
  const statFile = operations.lstatSync || lstatSync;
  const readDirectory = operations.readdirSync || readdirSync;
  const unlinkFile = operations.unlinkSync || unlinkSync;
  let resolvedDir;
  let resolvedCurrent;
  let entries;

  try {
    resolvedDir = path.resolve(svcDir);
    resolvedCurrent = path.resolve(currentStateFile);
    if (path.dirname(resolvedCurrent) !== resolvedDir) return result;
    const directory = statFile(resolvedDir);
    if (!directory.isDirectory() || directory.isSymbolicLink()) return result;
    entries = readDirectory(resolvedDir, { withFileTypes: true });
  } catch {
    return result;
  }

  const cutoff = now - LOOP_GUARD_STATE_MAX_AGE_MS;
  const candidates = [];
  for (const entry of entries) {
    if (!LOOP_GUARD_STATE_NAME.test(entry.name)) continue;

    const candidate = path.join(resolvedDir, entry.name);
    if (candidate === resolvedCurrent) continue;
    result.scanned += 1;
    if (!entry.isFile()) continue;
    candidates.push(candidate);
  }

  candidates.sort();
  const batchSize = Math.min(LOOP_GUARD_PRUNE_BATCH_SIZE, candidates.length);
  const cycle = Math.floor(now / LOOP_GUARD_PRUNE_INTERVAL_MS);
  const start = candidates.length === 0
    ? 0
    : (cycle * LOOP_GUARD_PRUNE_BATCH_SIZE) % candidates.length;

  for (let index = 0; index < batchSize; index += 1) {
    const candidate = candidates[(start + index) % candidates.length];
    try {
      const initial = regularNonSymlink(candidate, statFile);
      if (!initial || initial.mtimeMs >= cutoff) continue;

      withStateLock(candidate, () => {
        const locked = regularNonSymlink(candidate, statFile);
        if (!locked || locked.mtimeMs >= cutoff) return;
        unlinkFile(candidate);
        result.removed += 1;
      }, { timeoutMs: 0 });
    } catch {
      // Cleanup is maintenance. Contention, disappearance, and filesystem
      // errors preserve the candidate and must never affect loop detection.
    }
  }

  return result;
}
