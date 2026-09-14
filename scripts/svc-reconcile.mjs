#!/usr/bin/env node
/** Local L3 reconcile gate: bounded receipt accounting and detached promotion repair. */

import { existsSync, readFileSync, realpathSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeJsonAtomic } from "./state-io.mjs";
import {
  legacyReportProjection,
  missingFromReceiptResult,
  parseJsonResult,
  unavailableReceiptResult,
  readDriveOutcome,
  runBounded,
  scheduleDetachedDrive,
  shouldAdvanceWatcher,
  validateReceiptChildResult,
} from "./lib/reconcile-core.mjs";
import { resolveChainPolicy } from "./lib/chain-policy.mjs";

const CHECKPOINT_PATH = process.env.SVC_RECONCILE_CHECKPOINT_PATH || ".svc/reconcile-checkpoint.json";
const GH_AUTH_RECOVERY_PATH = process.env.SVC_GH_AUTH_RECOVERY_PATH || ".svc/runtime/gh-auth-restore.json";
const DRIVE_STATE_ROOT = process.env.SVC_RECONCILE_DRIVE_ROOT || ".svc/reconcile-drive";
const CHILD_TIMEOUT_MS = Math.min(Number(process.env.SVC_RECONCILE_CHILD_TIMEOUT_MS || 10_000), 20_000);
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const RECEIPT_CHECK_PATH = path.join(SCRIPT_DIR, "check-chain-receipts.mjs");
const AUTO_DRIVE_PATH = path.join(SCRIPT_DIR, "svc-auto-drive.mjs");

function usage() {
  return [
    "Usage: node scripts/svc-reconcile.mjs [--repo <git-worktree>]",
    "",
    "Reconcile chain receipts and merged promotion state for the selected repository.",
    "Framework helpers are resolved from the installed SVC package; repository state",
    "and Git operations remain anchored to --repo (or the current working directory).",
  ].join("\n");
}

function parseArgs(argv) {
  let repo = null;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") return { help: true, repo: null };
    if (arg === "--repo") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error("--repo requires a Git worktree path");
      repo = value;
      index += 1;
      continue;
    }
    throw new Error(`unknown argument: ${arg}`);
  }
  return { help: false, repo };
}

function run(command, args, options = {}) {
  return runBounded(command, args, { timeoutMs: CHILD_TIMEOUT_MS, ...options });
}

function git(args) {
  const result = run("git", args);
  return result.ok ? result.stdout.trim() : "";
}

function expectedGithubOwner() {
  const remote = git(["remote", "get-url", "origin"]);
  const match = remote.match(/github\.com[:/]([^/]+)\//);
  const owner = match?.[1] || "";
  return /^[A-Za-z0-9-]+$/.test(owner) ? owner : "";
}

function activeGhOwner(statusText) {
  const lines = String(statusText || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].includes("Active account: true")) continue;
    for (let j = i; j >= 0; j--) {
      const match = lines[j].match(/account ([^ )]+)/);
      if (match) return match[1];
    }
  }
  return "";
}

function ghHasOwner(statusText, owner) {
  return new RegExp(`account ${owner.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:[ )]|$)`).test(statusText);
}

function recoverStrandedGhIdentity() {
  if (!existsSync(GH_AUTH_RECOVERY_PATH)) return { ok: true, recovered: false };
  let record;
  try { record = JSON.parse(readFileSync(GH_AUTH_RECOVERY_PATH, "utf8")); }
  catch { return { ok: false, error: "invalid GitHub auth recovery record" }; }
  if (!/^[A-Za-z0-9-]+$/.test(record.previous || "")) return { ok: false, error: "invalid previous GitHub owner in recovery record" };
  const restore = run("gh", ["auth", "switch", "--user", record.previous]);
  if (!restore.ok) return { ok: false, error: `could not restore GitHub owner ${record.previous}: ${restore.classification}` };
  try { unlinkSync(GH_AUTH_RECOVERY_PATH); } catch {}
  return { ok: true, recovered: true };
}

function withRepoOwnerGh(fn) {
  // Compatibility contract: `gh auth switch --user` is always invoked through
  // runBounded uses stdio: ["ignore", "pipe", "pipe"] so GraphQL/auth
  // diagnostics are captured as structured degraded evidence, never leaked.
  const recovered = recoverStrandedGhIdentity();
  if (!recovered.ok) return recovered;
  const owner = expectedGithubOwner();
  if (!owner) return { ok: true, value: fn(), switched: false };
  const statusResult = run("gh", ["auth", "status"]);
  const status = `${statusResult.stdout}${statusResult.stderr}`;
  if (!statusResult.ok && statusResult.classification !== "error") return { ok: false, error: `gh auth status ${statusResult.classification}` };
  if (!ghHasOwner(status, owner)) return { ok: false, error: `expected GitHub owner ${owner} is not present in gh auth status` };
  const previous = activeGhOwner(status);
  const shouldSwitch = previous && previous !== owner;
  try {
    if (shouldSwitch) {
      writeJsonAtomic(GH_AUTH_RECOVERY_PATH, { schema_version: 1, previous, target: owner, recorded_at: new Date().toISOString() });
      const switched = run("gh", ["auth", "switch", "--user", owner]);
      if (!switched.ok) return { ok: false, error: `gh auth switch ${switched.classification}` };
    }
    return { ok: true, value: fn(), switched: Boolean(shouldSwitch), owner, previous };
  } finally {
    if (shouldSwitch && previous) {
      const restored = run("gh", ["auth", "switch", "--user", previous]);
      if (restored.ok) {
        try { unlinkSync(GH_AUTH_RECOVERY_PATH); } catch {}
      }
    }
  }
}

function readJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch { return fallback; }
}

function noteHasVerifyPromotion(noteText) {
  try { return Boolean(JSON.parse(noteText || "{}")["verify-promotion"]); }
  catch { return false; }
}

// WI-549: chain-policy mode is resolved through the single shared resolver
// (SVC_CHAIN_POLICY -> $(git-common-dir)/svc-chain-policy.json ->
// ~/.svc/chain-policy.json -> fail-closed "refuse"). Missing or unreadable
// policy at every tier, or a worktree-local file that conflicts with the
// shared one, is surfaced to stderr and NEVER silently downgraded to "warn".
function getMode() {
  const resolved = resolveChainPolicy();
  if (resolved.source !== "shared" && resolved.source !== "home" && resolved.source !== "env") {
    console.error(`svc-reconcile: chain-policy ${resolved.reason}`);
  }
  return resolved.mode;
}

function readCheckpoint() {
  return readJson(CHECKPOINT_PATH, { last_reconciled_sha: null, last_pr_watcher_run: null });
}

function getMainBranch() {
  return git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]).replace(/^origin\//, "") || "main";
}

function getCommitsSince(base, main) {
  const args = base
    ? ["log", "--format=%H", `${base}..origin/${main}`]
    : ["log", "--format=%H", `origin/${main}`, "-n", "5"];
  const result = run("git", args);
  return { shas: result.ok ? result.stdout.trim().split("\n").filter(Boolean) : [], result };
}

function checkReceipts(args, fallbackShas) {
  const result = run(process.execPath, [RECEIPT_CHECK_PATH, ...args]);
  const decoded = parseJsonResult(result, null);
  const parsed = validateReceiptChildResult(result, decoded, fallbackShas);
  return { result, parsed };
}

function reconcileResponsibilityA(cp) {
  const main = getMainBranch();
  const discovered = getCommitsSince(cp.last_reconciled_sha, main);
  const shas = discovered.shas;
  if (!discovered.result.ok) {
    return { unaccounted: [{ sha: "git-log", missing: [`commit discovery ${discovered.result.classification}`] }], main, receipt_check: { classification: discovered.result.classification, duration_ms: discovered.result.duration_ms, mode: "discovery-failed" } };
  }
  if (!shas.length) return { unaccounted: [], main, receipt_check: { classification: "success", duration_ms: discovered.result.duration_ms, mode: "empty" } };
  if (cp.last_reconciled_sha) {
    const range = `${cp.last_reconciled_sha}..origin/${main}`;
    const { result, parsed } = checkReceipts(["--range", range, "--consumer", "reconcile"], shas);
    return { unaccounted: missingFromReceiptResult(parsed), main, receipt_check: { classification: result.classification, duration_ms: result.duration_ms, mode: "range", range } };
  }
  const rows = [];
  let duration = 0;
  let classification = "success";
  for (const sha of shas) {
    const checked = checkReceipts(["--sha", sha, "--consumer", "reconcile"], [sha]);
    rows.push(...missingFromReceiptResult(checked.parsed));
    duration += checked.result.duration_ms;
    if (!checked.result.ok) classification = checked.result.classification;
  }
  return { unaccounted: rows, main, receipt_check: { classification, duration_ms: duration, mode: "first-run-per-sha" } };
}

function reconcileResponsibilityB(cp) {
  const ghResult = withRepoOwnerGh(() => run("gh", ["pr", "list", "--state", "merged", "--limit", "20", "--json", "number,mergeCommit,mergedAt"]));
  if (!ghResult.ok || !ghResult.value?.ok) {
    const detail = ghResult.error || ghResult.value?.classification || "unknown gh error";
    return { unverified: [], gh_available: false, auth_recovery_error: detail, gh_check: ghResult.value || null };
  }
  const prs = parseJsonResult(ghResult.value, null);
  if (!Array.isArray(prs)) return { unverified: [], gh_available: false, auth_recovery_error: "could not parse gh pr list JSON", gh_check: ghResult.value };
  const cutoff = cp.last_pr_watcher_run ? new Date(cp.last_pr_watcher_run) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const unverified = [];
  for (const pr of prs) {
    const sha = pr.mergeCommit?.oid;
    if (!sha || new Date(pr.mergedAt) <= cutoff) continue;
    const note = git(["notes", "--ref=svc-receipts", "show", sha]);
    if (!noteHasVerifyPromotion(note)) unverified.push({ pr: pr.number, sha, mergedAt: pr.mergedAt });
  }
  return { unverified, gh_available: true, gh_check: ghResult.value };
}

function configureOperationRepository(repoArg) {
  if (!repoArg) return;
  const requested = realpathSync(path.resolve(repoArg));
  process.chdir(requested);
  const topLevel = git(["rev-parse", "--show-toplevel"]);
  if (!topLevel || realpathSync(topLevel) !== requested) {
    throw new Error(`--repo must name the exact root of a Git worktree: ${repoArg}`);
  }
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
      return;
    }
    configureOperationRepository(options.repo);
  } catch (error) {
    console.error(`svc-reconcile: ${error.message}`);
    console.error(usage());
    process.exitCode = 2;
    return;
  }
  const started = Date.now();
  const mode = getMode();
  const cp = readCheckpoint();
  const respA = reconcileResponsibilityA(cp);
  const respB = reconcileResponsibilityB(cp);
  const autoDriveRuns = [];
  const autoDriveScheduling = [];
  for (const item of respB.unverified) {
    const scheduled = scheduleDetachedDrive(item.sha, {
      watcherCutoff: cp.last_pr_watcher_run,
      root: DRIVE_STATE_ROOT,
      script: AUTO_DRIVE_PATH,
      cwd: process.cwd(),
    });
    autoDriveRuns.push({ pr: item.pr, sha: item.sha, ok: scheduled.scheduled || scheduled.reason === "already-running" || scheduled.reason === "terminal-success" });
    autoDriveScheduling.push({ pr: item.pr, sha: item.sha, scheduled: scheduled.scheduled, reason: scheduled.reason || null });
  }
  const watcherCandidates = respB.unverified.map((item) => ({ sha: item.sha, verified: false, outcome: readDriveOutcome(item.sha, DRIVE_STATE_ROOT) }));
  const advanceWatcher = shouldAdvanceWatcher({ ghAvailable: respB.gh_available, candidates: watcherCandidates });
  const report = {
    mode,
    main: respA.main,
    unaccounted_count: respA.unaccounted.length,
    unaccounted_commits: respA.unaccounted,
    merged_unverified_count: respB.unverified.length,
    merged_unverified_prs: respB.unverified,
    gh_available: respB.gh_available,
    auto_drive_runs: autoDriveRuns,
    receipt_validation_unavailable_count: respA.unaccounted.filter((row) => row.infrastructure === true).length,
  };
  if (respA.unaccounted.length) {
    console.error(`svc-reconcile: ${respA.unaccounted.length} unaccounted commits on ${respA.main}`);
    for (const row of respA.unaccounted) {
      const label = row.infrastructure === true ? "receipt validation unavailable" : "missing";
      console.error(`  ${row.sha.substring(0, 7)}: ${label} ${row.missing.join(", ")}`);
    }
    const unavailableCount = respA.unaccounted.filter((row) => row.infrastructure === true).length;
    if (unavailableCount > 0) {
      console.error("Receipt validation was unavailable: re-run the whole reconcile command; do not edit the checkpoint or file retroactive receipt debt.");
    }
    if (unavailableCount < respA.unaccounted.length) {
      console.error("Receipt-debt options:");
      console.error("  1. Retroactive plan: claude /plan-changeset --retroactive <sha>");
      console.error("  2. Explicit reviewed recovery; waivers remain policy-limited exceptions");
    }
  }
  writeJsonAtomic(CHECKPOINT_PATH, {
    last_reconciled_sha: respA.unaccounted.length === 0 ? (git(["rev-parse", `origin/${respA.main}`]) || cp.last_reconciled_sha) : cp.last_reconciled_sha,
    last_pr_watcher_run: advanceWatcher ? new Date().toISOString() : cp.last_pr_watcher_run,
  });
  console.log(JSON.stringify({ ok: true, ...legacyReportProjection(report), reconcile_metadata: {
    total_ms: Date.now() - started,
    receipt_check: respA.receipt_check,
    gh_check: respB.gh_check ? { classification: respB.gh_check.classification, duration_ms: respB.gh_check.duration_ms } : null,
    auto_drive_scheduling: autoDriveScheduling,
    watcher_advanced: advanceWatcher,
  } }, null, 2));
  process.exit(mode === "refuse" && respA.unaccounted.length ? 1 : 0);
}

main();
