import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { closeSync, constants, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { writeJsonAtomic } from "../state-io.mjs";

export const MAX_CHILD_TIMEOUT_MS = 20_000;
export const DEFAULT_CHILD_TIMEOUT_MS = 10_000;
export const DRIVE_ROOT = ".svc/reconcile-drive";
export const STALE_DRIVE_LOCK_MS = 30 * 60 * 1000;

export function runBounded(command, args = [], options = {}) {
  const timeoutMs = Math.min(Number(options.timeoutMs ?? DEFAULT_CHILD_TIMEOUT_MS), MAX_CHILD_TIMEOUT_MS);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    timeout: timeoutMs,
    killSignal: "SIGKILL",
    shell: false,
  });
  const timedOut = result.error?.code === "ETIMEDOUT" || result.signal === "SIGKILL";
  const classification = timedOut ? "timeout" : result.error ? "spawn-error" : result.status === 0 ? "success" : "error";
  return {
    ok: classification === "success",
    classification,
    status: result.status,
    signal: result.signal,
    stdout: String(result.stdout ?? ""),
    stderr: String(result.stderr ?? ""),
    error: result.error ? String(result.error.message || result.error) : null,
    timeout_ms: timeoutMs,
    duration_ms: Date.now() - started,
  };
}

export function parseJsonResult(result, fallback) {
  try { return JSON.parse(result.stdout); }
  catch { return fallback; }
}

export function unavailableReceiptResult(shas, classification) {
  return {
    ok: false,
    infrastructure_failures: shas,
    results: shas.map((sha) => ({
      sha,
      ok: false,
      missing: [`receipt check ${classification}`],
      type: "worker-error",
      infrastructure: true,
    })),
  };
}

export function validateReceiptResultCoverage(result, expectedShas, classification = "malformed-output") {
  const rows = Array.isArray(result?.results) ? result.results : null;
  const coherent = rows
    && typeof result.ok === "boolean"
    && rows.length === expectedShas.length
    && rows.every((row, index) => (
      row
      && row.sha === expectedShas[index]
      && typeof row.ok === "boolean"
    ))
    && result.ok === rows.every((row) => row.ok);
  return coherent ? result : unavailableReceiptResult(expectedShas, classification);
}

export function validateReceiptChildResult(processResult, decoded, expectedShas) {
  const covered = validateReceiptResultCoverage(decoded, expectedShas);
  const coverageValid = covered === decoded;
  const exitMatches = (
    processResult?.classification === "success"
    && processResult.status === 0
    && decoded?.ok === true
  ) || (
    processResult?.classification === "error"
    && processResult.status === 1
    && decoded?.ok === false
  );
  if (coverageValid && exitMatches) return decoded;
  const classification = ["timeout", "spawn-error"].includes(processResult?.classification)
    ? processResult.classification
    : "exit-output-mismatch";
  return unavailableReceiptResult(expectedShas, classification);
}

export function missingFromReceiptResult(result) {
  const rows = Array.isArray(result?.results) ? result.results : [];
  return rows.filter((row) => !row.ok).map((row) => ({
    sha: row.sha,
    missing: Array.isArray(row.missing) && row.missing.length ? row.missing : ["unknown"],
    infrastructure: row.infrastructure === true || row.type === "worker-error",
    classification: row.infrastructure === true || row.type === "worker-error"
      ? "receipt-validation-unavailable"
      : "receipt-debt",
  }));
}

export function legacyReportProjection(report) {
  return {
    mode: report.mode,
    main: report.main,
    unaccounted_count: report.unaccounted_count,
    unaccounted_commits: (report.unaccounted_commits || []).map((row) => ({
      sha: row.sha,
      missing: row.missing,
    })),
    merged_unverified_count: report.merged_unverified_count,
    merged_unverified_prs: report.merged_unverified_prs,
    gh_available: report.gh_available,
    auto_drive_runs: report.auto_drive_runs,
  };
}

export function driveStatePaths(sha, root = DRIVE_ROOT) {
  if (!/^[0-9a-f]{7,64}$/i.test(String(sha))) throw new Error(`invalid drive SHA: ${sha}`);
  const key = String(sha).toLowerCase();
  return {
    root,
    lock: join(root, `${key}.lock.json`),
    outcome: join(root, `${key}.outcome.json`),
    log: join(root, `${key}.log`),
  };
}

export function readDriveOutcome(sha, root = DRIVE_ROOT) {
  const { outcome } = driveStatePaths(sha, root);
  if (!existsSync(outcome)) return null;
  try {
    const parsed = JSON.parse(readFileSync(outcome, "utf8"));
    return validateDriveOutcome(parsed, sha) ? parsed : null;
  }
  catch { return null; }
}

export function validateDriveOutcome(outcome, sha) {
  if (!outcome || outcome.schema_version !== 1 || outcome.target_sha !== sha) return false;
  if (!/^[0-9a-f-]{36}$/i.test(String(outcome.generation || ""))) return false;
  if (!Number.isFinite(Date.parse(outcome.started_at || ""))) return false;
  if (outcome.state === "running") return outcome.ended_at === null && outcome.exit_classification === null;
  return outcome.state === "terminal" && ["success", "error", "timeout", "spawn-error"].includes(outcome.exit_classification) && Number.isFinite(Date.parse(outcome.ended_at || ""));
}

export function shouldAdvanceWatcher({ ghAvailable, candidates }) {
  if (!ghAvailable) return false;
  return (candidates || []).every((candidate) => {
    if (candidate.verified === true) return true;
    const outcome = candidate.outcome;
    return validateDriveOutcome(outcome, candidate.sha) && outcome.state === "terminal" && outcome.exit_classification === "success";
  });
}

export function ownsDriveLock(lockPath, generation) {
  try { return Boolean(generation) && JSON.parse(readFileSync(lockPath, "utf8")).generation === generation; }
  catch { return false; }
}

export function finalizeDriveOutcome({ lockPath, outcomePath, generation, outcome }) {
  if (!lockPath || !outcomePath || !ownsDriveLock(lockPath, generation)) return false;
  writeJsonAtomic(outcomePath, { ...outcome, generation });
  try { unlinkSync(lockPath); } catch {}
  return true;
}

export function scheduleDetachedDrive(sha, options = {}) {
  const paths = driveStatePaths(sha, options.root);
  mkdirSync(paths.root, { recursive: true });
  const priorOutcome = readDriveOutcome(sha, options.root);
  if (!existsSync(paths.lock) && priorOutcome?.state === "terminal" && priorOutcome.exit_classification === "success") {
    return { scheduled: false, reason: "terminal-success", paths, outcome: priorOutcome };
  }
  if (existsSync(paths.lock)) {
    let stale = false;
    let lock = null;
    try {
      lock = JSON.parse(readFileSync(paths.lock, "utf8"));
      stale = Date.now() - Date.parse(lock.started_at) > (options.staleLockMs ?? STALE_DRIVE_LOCK_MS);
    } catch { stale = true; }
    const outcome = readDriveOutcome(sha, options.root);
    if (outcome?.state === "terminal" && outcome.generation === lock?.generation) stale = true;
    if (stale) {
      try { unlinkSync(paths.lock); } catch {}
    }
  }
  const generation = randomUUID();
  let fd;
  try {
    fd = openSync(paths.lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
  } catch (error) {
    if (error?.code === "EEXIST") return { scheduled: false, reason: "already-running", paths, outcome: readDriveOutcome(sha, options.root) };
    throw error;
  }
  const startedAt = new Date().toISOString();
  writeFileSync(fd, JSON.stringify({ schema_version: 1, sha, generation, owner_pid: process.pid, started_at: startedAt }) + "\n");
  fsyncSync(fd);
  closeSync(fd);
  writeJsonAtomic(paths.outcome, {
    schema_version: 1,
    target_sha: sha,
    generation,
    pid: null,
    state: "running",
    exit_classification: null,
    started_at: startedAt,
    ended_at: null,
    watcher_cutoff: options.watcherCutoff ?? null,
    diagnostic: "detached drive scheduled",
  });
  try {
    const child = spawn(process.execPath, [
      options.script ?? "scripts/svc-auto-drive.mjs",
      sha,
      "--lock", paths.lock,
      "--outcome", paths.outcome,
      "--generation", generation,
      "--watcher-cutoff", options.watcherCutoff ?? "",
    ], { detached: true, stdio: ["ignore", "ignore", "ignore"], cwd: options.cwd ?? process.cwd(), env: options.env ?? process.env });
    child.unref();
    // The child is the sole owner of running -> terminal transitions. A
    // post-spawn parent write can otherwise clobber a fast terminal outcome.
    return { scheduled: true, pid: child.pid ?? null, generation, paths };
  } catch (error) {
    const ownsLock = ownsDriveLock(paths.lock, generation);
    if (ownsLock) try { unlinkSync(paths.lock); } catch {}
    if (ownsLock) writeJsonAtomic(paths.outcome, {
      schema_version: 1,
      target_sha: sha,
      generation,
      pid: null,
      state: "terminal",
      exit_classification: "spawn-error",
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      watcher_cutoff: options.watcherCutoff ?? null,
      diagnostic: String(error.message || error),
    });
    return { scheduled: false, reason: "spawn-error", paths, error: String(error.message || error) };
  }
}

export function ensureParent(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}
