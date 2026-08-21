#!/usr/bin/env node
/**
 * Validates chain receipts for a commit, range, or PR.
 *
 * Authoritative source: git notes ref `refs/notes/svc-receipts`.
 * Working-tree mirror at `.svc/receipts/<sha>/<type>.json` is consulted
 * as a speed cache; if missing, mirror is regenerated from notes.
 *
 * Usage:
 *   check-chain-receipts.mjs --sha <sha>
 *   check-chain-receipts.mjs --range <base>..<head>
 *   check-chain-receipts.mjs --pr <pr-number>     # uses gh CLI
 *   check-chain-receipts.mjs --sha <sha> --wi <WI-###> [--consumer <name>]
 *
 * Exit 0 if all receipts present and valid. Exit 1 if any missing/invalid.
 *
 * Required receipt types per non-eligible commit:
 *   plan-manifest, review-plan, exec-record, review-exec,
 *   audit-implementation
 *
 * Quick-fix commits need only: quick-fix
 */

import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import { availableParallelism, cpus } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const SCRIPT_FILE = fileURLToPath(import.meta.url);
const SCRIPT_DIR = dirname(SCRIPT_FILE);
import { writeJsonAtomic } from "./state-io.mjs";
import { acTableSha256 } from "./lib/normalize-ac-table.mjs";
import { deriveTier } from "./derive-receipt-tier.mjs";
import { familyOf } from "./lib/cognitive-family.mjs";
import { verifyReviewerEvidence } from "./lib/reviewer-evidence.mjs";
import { isExternalizedHistoryRange } from "./lib/history-epoch.mjs";

const REQUIRED_TYPES_FULL = [
  "plan-manifest",
  "review-plan",
  "exec-record",
  "review-exec",
  "audit-implementation",
];

// WI-385: the LOW non-quick-fix tier — plan-manifest + exec-record + ONE
// consolidated cross-family review (review-exec). EXACTLY two non-quick-fix
// tiers (low, full); no SEV ladder. Activated ONLY under the graded opt-in AND a
// diff that re-derives to "low"; otherwise the full 5 apply.
const LOW_TIER_TYPES = ["plan-manifest", "exec-record", "review-exec"];

const QUICK_FIX_TYPES = ["quick-fix"];
const SLOT_PREFIX = "slot::";
const CONSUMER_TYPES = new Set([
  "execute-changeset",
  "review-exec",
  "audit-implementation",
  "stop",
  "verify-promotion",
  "final-report",
  "push",
  "reconcile",
]);
const CONSUMER_REQUIRED_TYPES = {
  "execute-changeset": ["plan-manifest", "review-plan", "exec-record"],
  "review-exec": ["exec-record", "review-exec"],
  "audit-implementation": ["exec-record", "audit-implementation"],
  "verify-promotion": ["verify-promotion"],
};
// SOL-E001 / SOL-R2-001: finalization and land consumers cannot be authorized
// by a gitignored mirror. push/reconcile are the L2/L3 callers that previously
// invoked the checker with no consumer and inherited the development fallback.
const NOTE_REQUIRED_CONSUMERS = new Set([
  "stop",
  "verify-promotion",
  "final-report",
  "push",
  "reconcile",
]);
// SOL-HARNESS-005: v1/v2 review envelopes are grandfathered only for SHAs
// that are ancestors of the WI-548 land (inclusive). Newer commits in this
// repo must carry schema_version >= 3 so a synthetic v1 note cannot skip
// reviewer_evidence. Isolated fixture SHAs that are not in this object
// store keep the historical grandfather so range-worker tests stay hermetic.
const REVIEW_V3_CUTOFF_SHA = "30381c5c5e6635a102944834e04319063824dc53";

export function reviewEnvelopeRequiresSchemaV3(sha, options = {}) {
  const cutoff = options.cutoff || process.env.SVC_REVIEW_V3_CUTOFF_SHA || REVIEW_V3_CUTOFF_SHA;
  const repo = options.gitCwd || join(SCRIPT_DIR, "..");
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(String(sha))) return true;
  const cutoffType = (() => {
    try {
      return execFileSync("git", ["-C", repo, "cat-file", "-t", cutoff], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return null;
    }
  })();
  if (cutoffType !== "commit") return false;
  const shaType = (() => {
    try {
      return execFileSync("git", ["-C", repo, "cat-file", "-t", sha], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      return null;
    }
  })();
  if (shaType !== "commit") return false;
  try {
    execFileSync("git", ["-C", repo, "merge-base", "--is-ancestor", sha, cutoff], {
      stdio: "ignore",
    });
    return false;
  } catch {
    return true;
  }
}

const PASSING_VERDICTS = {
  "review-plan": new Set(["pass", "pass-with-acks"]),
  "review-exec": new Set(["pass", "pass-with-acks"]),
  "audit-implementation": new Set(["pass", "pass-with-acks"]),
  "verify-promotion": new Set(["pass"]),
};
const EXPECTED_STAGE_TYPES = {
  "quick-fix": ["quick-fix"],
  plan: ["plan-manifest"],
  "review-plan": ["plan-manifest", "review-plan"],
  exec: ["plan-manifest", "review-plan", "exec-record"],
  "review-exec": ["plan-manifest", "review-plan", "exec-record", "review-exec"],
  audit: REQUIRED_TYPES_FULL,
  "verify-promotion": ["verify-promotion"],
  full: REQUIRED_TYPES_FULL,
};
const RANGE_CONCURRENCY_MAX = 16;
const RANGE_WORKER_TIMEOUT_MIN_MS = 1_000;
const RANGE_WORKER_TIMEOUT_MAX_MS = 10_000;
const RANGE_WORKER_TIMEOUT_DEFAULT_MS = 5_000;
const RANGE_WORKER_MAX_BUFFER = 4 * 1024 * 1024;

export class RangeConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "RangeConfigError";
  }
}

function parseRangeInteger(env, name) {
  const raw = env?.[name];
  if (raw === undefined || raw === "") return null;
  if (!/^\d+$/.test(String(raw))) {
    throw new RangeConfigError(`${name} must be an integer`);
  }
  return Number(raw);
}

function detectedParallelism() {
  const available = typeof availableParallelism === "function"
    ? availableParallelism()
    : cpus()?.length;
  return Number.isInteger(available) && available > 0 ? available : 1;
}

export function resolveRangeConcurrency(env = process.env, available) {
  const override = parseRangeInteger(env, "SVC_RECEIPT_RANGE_CONCURRENCY");
  const detected = arguments.length < 2 ? detectedParallelism() : available;
  const candidate = override ?? Math.min(8, Number.isInteger(detected) && detected > 0 ? detected : 1);
  const resolved = Math.min(RANGE_CONCURRENCY_MAX, Math.max(1, candidate));
  if (override !== null && override !== resolved) {
    console.error(`SVC_RECEIPT_RANGE_CONCURRENCY clamped to ${resolved}`);
  }
  return resolved;
}

export function resolveRangeWorkerTimeout(env = process.env) {
  const override = parseRangeInteger(env, "SVC_RECEIPT_RANGE_WORKER_TIMEOUT_MS");
  const candidate = override ?? RANGE_WORKER_TIMEOUT_DEFAULT_MS;
  const resolved = Math.min(
    RANGE_WORKER_TIMEOUT_MAX_MS,
    Math.max(RANGE_WORKER_TIMEOUT_MIN_MS, candidate),
  );
  if (override !== null && override !== resolved) {
    console.error(`SVC_RECEIPT_RANGE_WORKER_TIMEOUT_MS clamped to ${resolved}`);
  }
  return resolved;
}

function workerErrorResult(sha, error) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    sha,
    ok: false,
    missing: [`receipt worker failure: ${message}`],
    type: "worker-error",
    infrastructure: true,
  };
}

function isInfrastructureFailure(row) {
  return row?.infrastructure === true;
}

// OPT-07: historical commits are immutable, so a SHA that already validated
// green under the CURRENT notes tip never needs re-checking. Cache is
// gitignored/machine-local, fail-open (missing/corrupt => proceed uncached —
// this is an optimization, never a gate), and invalidated WHOLESALE the
// instant notes_tip moves. Only SHAs that validate green THIS run are added.
//
// FIX 2 (WI-512 reviewer round, reproduced CRITICAL): notes_tip alone is an
// insufficient key. Three inputs can flip a SHA's verdict without moving the
// tip: (a) .svc/chain-policy.json risk_tiering, (b) the mirror-fallback path
// in getReceiptsForSha (a mirror-only green can vanish when the mirror is
// deleted, leaving the SHA genuinely unaccounted), (c) the on-disk content of
// the eligibility/classifier scripts the quick-fix re-check shells out to.
// Fix: (a)+(c) are folded into a POLICY_FINGERPRINT hashed alongside
// notes_tip; (b) is closed at the call site in main() — only a SHA whose
// receipts came from the note (receipt_source === "note") is ever added to
// the cache, never a mirror-sourced green.
//
// FIX 4: the cache path is repo-root-anchored (git rev-parse --show-toplevel),
// not cwd-relative — this repo has a recurring incident class of stray
// /tmp/.svc pollution from cwd-relative .svc writes.
let cachedRepoRoot;
function repoRootForCache() {
  if (cachedRepoRoot === undefined) cachedRepoRoot = gitTry(["rev-parse", "--show-toplevel"]) || process.cwd();
  return cachedRepoRoot;
}

function reconcileCachePath() {
  return join(repoRootForCache(), ".svc", "reconcile-cache.json");
}

function reconcileCacheIsIgnored() {
  try {
    execFileSync("git", ["-C", repoRootForCache(), "check-ignore", "-q", "--", ".svc/reconcile-cache.json"], {
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function policyFingerprint() {
  const inputs = [
    join(repoRootForCache(), ".svc", "chain-policy.json"),
    join(SCRIPT_DIR, "quick-fix-eligibility.mjs"),
    join(SCRIPT_DIR, "classify-change-risk.mjs"),
  ];
  const parts = inputs.map((p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } });
  return createHash("sha256").update(parts.join("")).digest("hex");
}

function readReconcileCache(notesTip, fingerprint) {
  // A performance cache must never become candidate input through `git add
  // -A`.  Only use the documented cache when the consumer repo explicitly
  // ignores it; otherwise run uncached.
  if (!reconcileCacheIsIgnored()) return new Set();
  try {
    const raw = JSON.parse(readFileSync(reconcileCachePath(), "utf8"));
    if (!raw || typeof raw.notes_tip !== "string" || typeof raw.fingerprint !== "string" || !Array.isArray(raw.green)) {
      return new Set();
    }
    if (raw.notes_tip !== notesTip || raw.fingerprint !== fingerprint) return new Set(); // wholesale invalidation
    return new Set(raw.green.filter((s) => typeof s === "string"));
  } catch {
    return new Set(); // fail-open: missing/corrupt cache never blocks
  }
}

function writeReconcileCache(notesTip, fingerprint, greenSet) {
  if (typeof notesTip !== "string" || !notesTip) return; // no stable tip to anchor to
  if (!reconcileCacheIsIgnored()) return;
  try {
    mkdirSync(join(repoRootForCache(), ".svc"), { recursive: true });
    writeJsonAtomic(reconcileCachePath(), { notes_tip: notesTip, fingerprint, green: [...greenSet] });
  } catch {
    // best-effort; caching is an optimization, never a gate
  }
}

export function interpretWorkerOutput(sha, error, stdout, timeout) {
  let payload;
  try {
    payload = JSON.parse(String(stdout || ""));
  } catch {
    let reason;
    if (error?.killed) reason = `timeout after ${timeout}ms`;
    else if (error) reason = `child failed: ${error.code ?? error.signal ?? error.message}`;
    else reason = "empty or malformed JSON output";
    return workerErrorResult(sha, new Error(reason));
  }
  const row = Array.isArray(payload?.results) && payload.results.length === 1
    ? payload.results[0]
    : null;
  if (!row || row.sha !== sha) {
    return workerErrorResult(sha, new Error("result cardinality or SHA mismatch"));
  }
  if (error && error.code !== 1) {
    const reason = error.killed
      ? `timeout after ${timeout}ms`
      : `child exit ${error.code ?? error.signal ?? "unknown"}`;
    return workerErrorResult(sha, new Error(reason));
  }
  const expectedOk = error ? false : true;
  if (
    typeof payload.ok !== "boolean"
    || typeof row.ok !== "boolean"
    || payload.ok !== row.ok
    || row.ok !== expectedOk
  ) {
    return workerErrorResult(sha, new Error("exit and result status mismatch"));
  }
  return row;
}

export function checkShaInWorker(sha, policy = {}) {
  const timeout = policy.timeout ?? resolveRangeWorkerTimeout();
  const childEnv = { ...process.env, SVC_RECEIPT_RANGE_WORKER: "1" };
  delete childEnv.SVC_RECEIPT_RANGE_CONCURRENCY;
  delete childEnv.SVC_RECEIPT_RANGE_WORKER_TIMEOUT_MS;
  const childArgs = [SCRIPT_FILE, "--sha", sha];
  if (policy.wi) childArgs.push("--wi", policy.wi);
  if (policy.consumer) childArgs.push("--consumer", policy.consumer);
  if (policy.expectedStage) childArgs.push("--expected-stage", policy.expectedStage);

  return new Promise((resolveResult) => {
    execFile(
      process.execPath,
      childArgs,
      {
        encoding: "utf8",
        env: childEnv,
        timeout,
        maxBuffer: RANGE_WORKER_MAX_BUFFER,
      },
      (error, stdout) => {
        resolveResult(interpretWorkerOutput(sha, error, stdout, timeout));
      },
    );
  });
}

export async function checkShasWithPool(shas, concurrency, worker) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeConfigError("range concurrency must be an integer of at least 1");
  }
  if (typeof worker !== "function") {
    throw new RangeConfigError("range worker must be a function");
  }
  const results = new Array(shas.length);
  let cursor = 0;
  const runWorker = async () => {
    while (cursor < shas.length) {
      const index = cursor;
      cursor += 1;
      const sha = shas[index];
      try {
        results[index] = await worker(sha, index);
      } catch (error) {
        results[index] = workerErrorResult(sha, error);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, shas.length) }, () => runWorker()),
  );
  return results;
}

// Read the machine-local graded-tier opt-in. DEFAULT OFF: absent/unreadable
// policy, or anything other than "graded", means full enforcement — a
// value-reduction can never activate by accident.
function readRiskTieringPolicy() {
  try {
    const p = join(".svc", "chain-policy.json");
    if (!existsSync(p)) return null;
    const j = JSON.parse(readFileSync(p, "utf8"));
    return j && j.risk_tiering === "graded" ? "graded" : null;
  } catch { return null; }
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 100 * 1024 * 1024 }).trim();
}

function gitTry(args) {
  try {
    return git(args);
  } catch (e) {
    return null;
  }
}

function shortSha(sha) {
  return sha.substring(0, 7);
}

function readNoteForSha(sha) {
  const note = gitTry(["notes", "--ref=svc-receipts", "show", sha]);
  if (!note) return null;
  try {
    return JSON.parse(note);
  } catch (e) {
    return null;
  }
}

function readMirrorForSha(sha) {
  const dir = join(".svc", "receipts", shortSha(sha));
  if (!existsSync(dir)) return null;
  const receipts = {};
  try {
    const types = readdirSync(dir);
    for (const t of types) {
      const f = join(dir, t);
      const content = JSON.parse(readFileSync(f, "utf8"));
      const typeName = typeof content.receipt_type === "string"
        ? content.receipt_type
        : t.replace(/\.json$/, "");
      const wi = typeof content.wi === "string" && content.wi.length > 0 ? content.wi : null;
      const phase = typeof content.phase === "string" && content.phase.length > 0 ? content.phase : null;
      if (wi && /^[0-9a-f]{40}$/.test(sha)) {
        receipts[compositeSlotKey(typeName, wi, sha, phase)] = content;
      } else {
        receipts[typeName] = content;
      }
    }
    return receipts;
  } catch (e) {
    return null;
  }
}

function regenerateMirror(sha, envelope) {
  const dir = join(".svc", "receipts", shortSha(sha));
  mkdirSync(dir, { recursive: true });
  const safe = (value) => String(value || "").replace(/[^A-Za-z0-9._-]/g, "_");
  for (const [slotKey, receipt] of Object.entries(envelope)) {
    const slot = parseCompositeSlotKey(slotKey);
    let fileName = null;
    if (slot) {
      fileName = `${safe(slot.receiptType)}--${safe(slot.wi)}${slot.phase ? `--${safe(slot.phase)}` : ""}.json`;
    } else {
      fileName = `${safe(slotKey)}.json`;
    }
    writeJsonAtomic(join(dir, fileName), receipt);
    // Compatibility alias for legacy readers that still expect <type>.json.
    if (slot && !existsSync(join(dir, `${safe(slot.receiptType)}.json`))) {
      writeJsonAtomic(join(dir, `${safe(slot.receiptType)}.json`), receipt);
    }
  }
}

// FIX 2 (WI-512 reviewer round): reports WHERE the envelope came from so a
// caller (the OPT-07 cache) can refuse to cache anything sourced from the
// gitignored, routinely-deleted mirror — only a note-sourced green result is
// durable enough to trust across invocations.
function getReceiptsForSha(sha) {
  // Try notes first (authoritative)
  let envelope = readNoteForSha(sha);
  if (envelope) {
    // Regenerate mirror if missing
    const mirror = readMirrorForSha(sha);
    if (!mirror) regenerateMirror(sha, envelope);
    return { envelope, source: "note" };
  }
  // Fall back to mirror only (development mode where notes haven't synced)
  const mirror = readMirrorForSha(sha);
  return { envelope: mirror, source: mirror ? "mirror" : null };
}

function parseCompositeSlotKey(key) {
  if (typeof key !== "string" || !key.startsWith(SLOT_PREFIX)) return null;
  const tail = key.slice(SLOT_PREFIX.length);
  const parts = tail.split("::");
  if (parts.length < 3 || parts.length > 4) return null;
  const [receiptType, wi, targetSha, phase] = parts;
  if (!receiptType || !wi || !/^[0-9a-f]{40}$/.test(String(targetSha))) return null;
  return {
    receiptType,
    wi,
    targetSha,
    phase: phase || null,
  };
}

function compositeSlotKey(receiptType, wi, sha, phase = null) {
  return `${SLOT_PREFIX}${receiptType}::${wi}::${sha}${phase ? `::${phase}` : ""}`;
}

function normalizeEnvelopeEntries(sha, envelope) {
  const entries = [];
  const explicitWIs = new Set();
  const issues = [];

  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
    return { entries, explicitWIs, issues };
  }

  for (const [key, rawReceipt] of Object.entries(envelope)) {
    if (!rawReceipt || typeof rawReceipt !== "object" || Array.isArray(rawReceipt)) continue;
    const slot = parseCompositeSlotKey(key);
    const receiptType = typeof rawReceipt.receipt_type === "string"
      ? rawReceipt.receipt_type
      : (slot?.receiptType || key);
    const entry = {
      key,
      receipt: rawReceipt,
      receiptType,
      wi: null,
      phase: null,
      source: slot ? "composite" : "legacy",
      unresolved_owner: false,
    };

    if (slot) {
      entry.wi = slot.wi;
      entry.phase = slot.phase;
      explicitWIs.add(slot.wi);
      if (slot.targetSha !== sha) {
        issues.push(`slot ${key} targets ${slot.targetSha}, expected ${sha}`);
      }
      if (rawReceipt.wi && rawReceipt.wi !== slot.wi) {
        issues.push(`slot ${key} wi mismatch: key=${slot.wi} body=${rawReceipt.wi}`);
      }
      if (rawReceipt.target_sha && rawReceipt.target_sha !== sha) {
        issues.push(`slot ${key} body target_sha mismatch: ${rawReceipt.target_sha} != ${sha}`);
      }
    } else {
      const wi = typeof rawReceipt.wi === "string" && rawReceipt.wi.length > 0 ? rawReceipt.wi : null;
      if (wi) {
        entry.wi = wi;
        explicitWIs.add(wi);
      }
      if (typeof rawReceipt.phase === "string" && rawReceipt.phase.length > 0) {
        entry.phase = rawReceipt.phase;
      }
    }
    entries.push(entry);
  }

  for (const entry of entries) {
    if (entry.wi) continue;
    if (entry.source !== "legacy") continue;
    if (explicitWIs.size === 1) {
      entry.wi = [...explicitWIs][0];
      entry.source = "legacy-projected";
      continue;
    }
    entry.unresolved_owner = true;
    if (explicitWIs.size === 0) {
      issues.push(`legacy slot '${entry.key}' has no wi and no unique owner claim`);
    } else {
      issues.push(
        `legacy slot '${entry.key}' has no wi and multiple WI claims exist (${[...explicitWIs].join(", ")})`,
      );
    }
  }
  return { entries, explicitWIs, issues };
}

function indexEntriesByType(entries, wi = null) {
  const byType = new Map();
  for (const entry of entries) {
    if (wi && entry.wi !== wi) continue;
    const bucket = byType.get(entry.receiptType) || [];
    bucket.push(entry);
    byType.set(entry.receiptType, bucket);
  }
  return byType;
}

function selectReceipts(byType, type) {
  const entries = byType.get(type) || [];
  // Prefer the non-phase receipt when multiple phase-keyed siblings exist.
  const phaseLess = entries.filter((entry) => !entry.phase);
  if (phaseLess.length > 0) return phaseLess;
  return entries;
}

function commitIsQuickFix(entriesByType, wi = null) {
  const quickFixEntries = selectReceipts(entriesByType, "quick-fix");
  const match = wi
    ? quickFixEntries.find((entry) => entry.wi === wi)
    : quickFixEntries[0];
  return Boolean(match?.receipt?.eligible === true);
}

function requiredTypesForStop(entriesByType, options = {}) {
  const expectedStage = options.expectedStage || null;
  if (expectedStage) {
    const mapped = EXPECTED_STAGE_TYPES[expectedStage];
    if (!mapped) return null;
    return mapped;
  }
  if (commitIsQuickFix(entriesByType, options.wi || null)) return ["quick-fix"];
  const has = (type) => selectReceipts(entriesByType, type).length > 0;
  if (has("verify-promotion")) return ["verify-promotion"];
  if (has("audit-implementation")) return REQUIRED_TYPES_FULL;
  if (has("review-exec")) return ["plan-manifest", "review-plan", "exec-record", "review-exec"];
  if (has("exec-record")) return ["plan-manifest", "review-plan", "exec-record"];
  // SOL-R2-004: leftover planning-only receipts cannot authorize Stop/final-report.
  return REQUIRED_TYPES_FULL;
}

function requiredTypesForConsumer(consumer, entriesByType, options = {}) {
  if (!consumer) return null;
  if (consumer === "stop" || consumer === "final-report") {
    return requiredTypesForStop(entriesByType, options);
  }
  if (consumer === "push" || consumer === "reconcile") return null;
  if (consumer in CONSUMER_REQUIRED_TYPES) return CONSUMER_REQUIRED_TYPES[consumer];
  return null;
}

function selectBestEntry(entries) {
  if (!entries || entries.length === 0) return null;
  const sourceRank = (source) => {
    if (source === "composite") return 3;
    if (source === "legacy-projected") return 2;
    return 1;
  };
  return entries
    .slice()
    .sort((a, b) => {
      const rank = sourceRank(b.source) - sourceRank(a.source);
      if (rank !== 0) return rank;
      const tsA = Date.parse(a.receipt?.timestamp || 0) || 0;
      const tsB = Date.parse(b.receipt?.timestamp || 0) || 0;
      return tsB - tsA;
    })[0];
}

// WI-555: WI-472 authority stays in the framework package (SCRIPT_DIR parent).
// Post-WI-472 consumer gaps resolve ledger/bundle/review from the invocation
// repo root (repoRootForCache()), matching WI-554's consumer-root contract.
const WI472_HISTORICAL_RANGE = "985a8d5de2255288daaacda91c739e294b8a67d5..6b026ea9fbcee849e682d7aa47c3eec894512de3";

function resolveRetroactiveAuthority(receipt) {
  const wi = String(receipt?.wi || "");
  if (wi === "WI-472") {
    return {
      wi,
      root: join(SCRIPT_DIR, ".."),
      ledgerRel: "docs/specs/audit/wi-472-reconcile-backlog.json",
      bundleRel: "docs/specs/audit/wi-472-reconcile-backlog-bundle.json",
      reviewRel: "docs/specs/reviews/wi-472-backlog-review.json",
      certPrefix: "wi472-backlog",
      frozenRange: WI472_HISTORICAL_RANGE,
      missingAuthority: "tracked WI-472 bundle/review authority is unavailable",
      outsideAllowlist: "target SHA is outside the reviewed 78-row allowlist",
    };
  }
  if (!/^WI-[A-Z0-9][A-Z0-9_-]*$/.test(wi)) {
    return { wi, error: `attestation wi=${wi || "<missing>"} is not a valid WI id` };
  }
  const slug = wi.toLowerCase();
  return {
    wi,
    root: repoRootForCache(),
    ledgerRel: `docs/specs/audit/${slug}-reconcile-backlog.json`,
    bundleRel: `docs/specs/audit/${slug}-reconcile-backlog-bundle.json`,
    reviewRel: `docs/specs/reviews/${slug}-backlog-review.json`,
    certPrefix: `${slug}-backlog`,
    frozenRange: null,
    missingAuthority: `tracked ${wi} consumer recovery bundle/review authority is unavailable`,
    outsideAllowlist: `target SHA is outside the reviewed ${wi} recovery allowlist`,
  };
}

function validateRetroactiveAttestation(sha, receipt) {
  const base = validateReceipt("retroactive-attestation", receipt);
  if (!base.valid) return base;
  const reasons = [];
  const allowedKeys = ["receipt_type", "schema_version", "wi", "target_sha", "tree_hash", "historical_range", "ledger_sha256", "bundle_sha256", "basis_sha256", "basis", "disposition", "evidence", "producer", "reviewer", "review", "verdict", "zero_waivers", "timestamp"].sort();
  const actualKeys = Object.keys(receipt || {}).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(allowedKeys)) reasons.push("attestation contains missing or additional properties");
  const producerFamily = familyOf(receipt.producer?.host);
  const reviewerFamily = familyOf(receipt.reviewer?.host);
  const authority = resolveRetroactiveAuthority(receipt);
  if (authority.error) reasons.push(authority.error);
  const historicalRange = String(receipt?.historical_range || "");
  const [rangeAncestor = "", rangeDescendant = ""] = historicalRange.split("..");
  const root = authority.root || join(SCRIPT_DIR, "..");
  const externalized = isExternalizedHistoryRange(root, rangeAncestor, rangeDescendant);
  let tree = null;
  try { tree = git(["rev-parse", `${sha}^{tree}`]); }
  catch { if (!externalized) reasons.push("target commit tree is unresolvable"); }
  if (receipt.target_sha !== sha) reasons.push(`target_sha=${receipt.target_sha} expected ${sha}`);
  if (tree && receipt.tree_hash !== tree) reasons.push(`tree_hash=${receipt.tree_hash} expected ${tree}`);
  const sha256 = (value) => createHash("sha256").update(value).digest("hex");
  let bundle, review, ledgerBytes;
  if (!authority.error) {
    try {
      ledgerBytes = readFileSync(join(root, authority.ledgerRel));
      bundle = JSON.parse(readFileSync(join(root, authority.bundleRel), "utf8"));
      review = JSON.parse(readFileSync(join(root, authority.reviewRel), "utf8"));
    } catch { reasons.push(authority.missingAuthority); }
  }
  if (bundle && review) {
    const { bundle_sha256: ignored, ...boundBundle } = bundle;
    const row = bundle.rows?.find((candidate) => candidate.sha === sha);
    const approval = review.rows?.find((candidate) => candidate.sha === sha);
    if (sha256(ledgerBytes) !== bundle.ledger_sha256 || receipt.ledger_sha256 !== bundle.ledger_sha256) reasons.push("ledger binding mismatch");
    if (sha256(JSON.stringify(boundBundle)) !== bundle.bundle_sha256 || receipt.bundle_sha256 !== bundle.bundle_sha256) reasons.push("bundle binding mismatch");
    if (bundle.wi && bundle.wi !== receipt.wi) reasons.push(`bundle wi=${bundle.wi} expected ${receipt.wi}`);
    if (review.wi && review.wi !== receipt.wi) reasons.push(`review wi=${review.wi} expected ${receipt.wi}`);
    if (!row || !approval) reasons.push(authority.outsideAllowlist);
    if (row) {
      if (externalized && receipt.tree_hash !== row.proof?.target_tree) reasons.push("externalized target tree does not match the tracked reviewed row");
      const { basis_sha256, ...basis } = row;
      if (sha256(JSON.stringify(basis)) !== basis_sha256 || receipt.basis_sha256 !== basis_sha256) reasons.push("basis hash mismatch");
      if (JSON.stringify(receipt.basis) !== JSON.stringify(basis)) reasons.push("embedded basis differs from tracked reviewed row");
      if (receipt.disposition !== row.disposition || receipt.evidence && JSON.stringify(receipt.evidence) !== JSON.stringify(row.evidence)) reasons.push("attestation evidence/disposition mismatch");
      try {
        const commitObject = git(["cat-file", "commit", sha]);
        const parent = git(["rev-parse", `${sha}^`]);
        const patch = git(["diff", "--binary", "--no-ext-diff", parent, sha]).replace(/^index [0-9a-f]+\.\.[0-9a-f]+.*$/gm, "index <normalized>");
        if (sha256(commitObject) !== row.evidence.commit_object_sha256 || sha256(patch) !== row.evidence.patch_sha256) reasons.push("commit/patch evidence hash mismatch");
      } catch { if (!externalized) reasons.push("commit evidence cannot be recomputed"); }
    }
    if (!approval || approval.verdict !== "approve" || !approval.evidence_checked?.includes(receipt.basis_sha256)) reasons.push("tracked row approval is absent or not basis-bound");
    if (review.verdict !== "pass" || review.zero_waivers_verified !== true || review.ledger_sha256 !== bundle.ledger_sha256 || review.bundle_sha256 !== bundle.bundle_sha256) reasons.push("tracked global review is not a bound zero-waiver pass");
    if (receipt.review?.request_id !== review.reviewer?.request_id || receipt.review?.package_sha256 !== review.reviewer?.package_sha256 || receipt.review?.receipt_sha256 !== review.reviewer?.receipt_sha256 || receipt.review?.findings_sha256 !== review.reviewer?.findings_sha256) reasons.push("canonical review identity mismatch");
    const certKey = `${authority.certPrefix}-${sha}`;
    try {
      const launcherReceipt = JSON.parse(readFileSync(join(root, review.reviewer.receipt), "utf8"));
      const launcherFindings = JSON.parse(readFileSync(join(root, review.reviewer.findings), "utf8"));
      const cert = launcherFindings.certifications?.find((candidate) => candidate.key === certKey);
      if (sha256(readFileSync(join(root, review.reviewer.receipt))) !== review.reviewer.receipt_sha256 || sha256(readFileSync(join(root, review.reviewer.findings))) !== review.reviewer.findings_sha256) reasons.push("tracked launcher artifact hash mismatch");
      if (launcherReceipt.status !== "success" || launcherReceipt.request_id !== review.reviewer.request_id || !String(launcherFindings.verdict || "").startsWith("pass") || !cert?.certified || cert.for_content_sha !== receipt.basis_sha256 || cert.reviewer_family !== reviewerFamily) reasons.push("tracked launcher artifacts do not certify this row");
    } catch { reasons.push("tracked launcher artifacts are unavailable or invalid"); }
    if (authority.frozenRange) {
      if (receipt.historical_range !== authority.frozenRange) reasons.push("historical range mismatch");
    } else if (receipt.historical_range !== bundle.historical_range) {
      reasons.push("historical range mismatch");
    }
  }
  if (receipt.verdict !== "approved" || receipt.zero_waivers !== true) reasons.push("attestation is not an approved zero-waiver review");
  if (!receipt.review?.request_id || !/^[0-9a-f]{64}$/.test(String(receipt.review?.receipt_sha256 || "")) || !/^[0-9a-f]{64}$/.test(String(receipt.review?.findings_sha256 || ""))) {
    reasons.push("attestation lacks a hash-bound canonical review receipt");
  }
  if (!producerFamily || !reviewerFamily || producerFamily === reviewerFamily) reasons.push("attestation review is not cross-family");
  if (producerFamily !== receipt.producer?.family || reviewerFamily !== receipt.reviewer?.family) reasons.push("declared reviewer family does not match host");
  if (!authority.error && receipt.review?.row_certification !== `${authority.certPrefix}-${sha}`) reasons.push("row certification key mismatch");
  return { valid: reasons.length === 0, reasons };
}

function loadSchema(receiptType) {
  // WI-396: MUST be SCRIPT_DIR-relative, not cwd-relative. A cwd-relative path
  // returned null from any other directory, turning validateReceipt into a
  // no-op that validated every receipt — the receipt-content gate silently
  // disabled by cwd. Resolve against the script's own location instead.
  const schemaPath = join(SCRIPT_DIR, "..", "schemas", "receipts", `${receiptType}.schema.json`);
  if (!existsSync(schemaPath)) return null;
  try { return JSON.parse(readFileSync(schemaPath, "utf8")); }
  catch (e) { return null; }
}

function validateReceipt(receiptType, receipt, sha = null) {
  // Minimal in-process validator: checks required keys + receipt_type.
  // Full JSON Schema validation can be plugged in later; for now,
  // verify required fields per the schema's "required" array.
  const schema = loadSchema(receiptType);
  if (!schema) return { valid: true, reasons: [] };
  if (typeof receipt !== "object" || receipt === null) {
    return { valid: false, reasons: ["receipt is not an object"] };
  }
  if (receipt.receipt_type !== receiptType) {
    return { valid: false, reasons: [`receipt_type=${receipt.receipt_type} expected ${receiptType}`] };
  }
  let required = schema.required || [];
  // WI-381: ac_digests (the pipeline baton) is required only for v3+ plan-manifests;
  // legacy plan-manifests predate the baton and are grandfathered — parity with the
  // WI-396 diff_hash version gate, so historical main commits don't retroactively break.
  if (receiptType === "plan-manifest" && Number(receipt.schema_version) < 3) {
    required = required.filter((k) => k !== "ac_digests");
  }
  // WI-386: conditional blueprints, mirroring the schema's allOf if/then. The chain's
  // enforcement engine is THIS custom validator (presence-only, no JSON-Schema library
  // loads the allOf), so the conditional MUST be re-expressed here or the gate fails
  // OPEN — exactly the WI-396 cwd-skip regression class. changeset_blueprints is no
  // longer in the schema's top-level `required`; it is required UNLESS the receipt
  // explicitly self-declares mode:inline. ABSENT/forged mode → fail-closed (dispatch
  // semantics), preserving WI-347's hard requirement for every receipt that does not
  // opt out by name. Only mode:inline (the full-context orchestrator path) skips it.
  if (receiptType === "plan-manifest" && receipt.mode !== "inline") {
    if (!required.includes("changeset_blueprints")) required = [...required, "changeset_blueprints"];
  }
  const missing = required.filter((k) => !(k in receipt));
  if (missing.length > 0) {
    return { valid: false, reasons: [`missing required: ${missing.join(", ")}`] };
  }
  // WI-396 (codex G6 reproduced): presence-only validation let a fabricated/empty
  // diff_hash pass. exec-record/review-exec diff_hash must be a well-formed sha256.
  // Gated on the EXPLICIT post-WI-396 marker (schema_version>=2 OR tree_hash present),
  // NOT on tree_hash absence alone — else a forger omits tree_hash to skip the check
  // (codex G6 finding). New receipts (emit-receipt stamps v2) are fully bound; legacy
  // schema_version-1 receipts are grandfathered so historical main commits (placeholder
  // diff_hash from the cwd-skip era) don't retroactively break.
  if ((receiptType === "exec-record" || receiptType === "review-exec") &&
      (Number(receipt.schema_version) >= 2 || receipt.tree_hash)) {
    if (!/^[0-9a-f]{64}$/.test(String(receipt.diff_hash || ""))) {
      return { valid: false, reasons: [`diff_hash must be a 64-hex sha256 (got ${JSON.stringify(receipt.diff_hash)})`] };
    }
  }
  if (receiptType === "review-plan" || receiptType === "review-exec") {
    if (reviewEnvelopeRequiresSchemaV3(sha) && Number(receipt.schema_version) < 3) {
      return {
        valid: false,
        reasons: [
          `${receiptType} schema_version ${receipt.schema_version ?? "missing"} is below 3; v1/v2 review envelopes are grandfathered only for ancestors of ${REVIEW_V3_CUTOFF_SHA.slice(0, 7)}`,
        ],
      };
    }
    if (Number(receipt.schema_version) >= 3) {
      // WI-554: evidence lives in the invocation/consumer repo, not the
      // centrally installed framework checkout that owns SCRIPT_DIR.
      const evidenceReasons = verifyReviewerEvidence({ root: repoRootForCache(), reviewKind: receiptType === "review-plan" ? "plan" : "exec", body: receipt });
      if (evidenceReasons.length) return { valid: false, reasons: evidenceReasons };
    }
  }
  const allowedVerdicts = PASSING_VERDICTS[receiptType];
  if (allowedVerdicts && receipt.verdict === "fail") {
    return { valid: false, reasons: [`${receiptType} verdict=${JSON.stringify(receipt.verdict)} is not authorizing evidence`] };
  }
  return { valid: true, reasons: [] };
}

function checkSha(sha, options = {}) {
  const { envelope, source } = getReceiptsForSha(sha);
  const consumer = options.consumer || null;
  if (NOTE_REQUIRED_CONSUMERS.has(consumer) && source !== "note") {
    return {
      sha,
      ok: false,
      missing: [
        `${consumer} requires a note-sourced envelope; gitignored mirrors are not authority`,
      ],
      type: "unaccounted",
      receipt_source: source,
      ...(options.wi ? { wi: options.wi } : {}),
      consumer,
    };
  }
  const result = checkShaAgainstReceipts(sha, envelope, options);
  return {
    ...result,
    receipt_source: source,
    ...(options.wi ? { wi: options.wi } : {}),
    ...(consumer ? { consumer } : {}),
    ...(options.expectedStage ? { expected_stage: options.expectedStage } : {}),
  };
}

function checkShaAgainstReceipts(sha, envelope, options = {}) {
  const wi = options.wi || null;
  const consumer = options.consumer || null;
  if (consumer && !CONSUMER_TYPES.has(consumer)) {
    return { sha, ok: false, missing: [`unknown consumer '${consumer}'`], type: "invalid" };
  }
  if (wi && !/^WI-[A-Z0-9]+(?:-[A-Z0-9]+)*$/i.test(String(wi))) {
    return { sha, ok: false, missing: [`invalid --wi value '${wi}'`], type: "invalid" };
  }
  if (!envelope) {
    return { sha, ok: false, missing: ["ALL — no note or mirror found"], type: "unaccounted" };
  }

  const normalized = normalizeEnvelopeEntries(sha, envelope);
  const unresolvedLegacy = normalized.entries.filter((entry) => entry.unresolved_owner);
  if (wi && unresolvedLegacy.length > 0) {
    return {
      sha,
      ok: false,
      missing: [
        `legacy type-only slots cannot be projected uniquely for ${wi}; add explicit WI ownership map`,
        ...normalized.issues,
      ],
      type: "invalid",
    };
  }
  if (normalized.issues.length > 0) {
    return { sha, ok: false, missing: normalized.issues, type: "invalid" };
  }

  const entriesByType = indexEntriesByType(normalized.entries, wi);
  const receiptEntries = {};
  for (const [type] of entriesByType.entries()) {
    const candidates = selectReceipts(entriesByType, type);
    const selected = selectBestEntry(candidates);
    if (selected) receiptEntries[type] = selected.receipt;
  }

  if (wi && Object.keys(receiptEntries).length === 0) {
    return { sha, ok: false, missing: [`no receipts found for ${wi} at ${sha}`], type: "incomplete" };
  }

  if (receiptEntries["retroactive-attestation"]) {
    const v = validateRetroactiveAttestation(sha, receiptEntries["retroactive-attestation"]);
    return { sha, ok: v.valid, missing: v.reasons, type: v.valid ? "retroactive-attestation" : "invalid" };
  }
  const consumerRequiredTypes = requiredTypesForConsumer(consumer, entriesByType, {
    expectedStage: options.expectedStage || null,
    wi,
  });
  const allowQuickFixShortcut = !consumerRequiredTypes || (
    consumerRequiredTypes.length === 1 && consumerRequiredTypes[0] === "quick-fix"
  );
  if (allowQuickFixShortcut && commitIsQuickFix(entriesByType, wi)) {
    const v = validateReceipt("quick-fix", receiptEntries["quick-fix"]);
    if (!v.valid) return { sha, ok: false, missing: [`quick-fix invalid: ${v.reasons.join("; ")}`], type: "invalid" };
    // WI-360: bind the receipt to THIS commit — a quick-fix verdict computed
    // from a different staged tree must not validate this commit (observed
    // live: 1-file receipt promoted onto a 26-file commit, dfe22a00).
    try {
      const commitTree = git(["rev-parse", `${sha}^{tree}`]);
      if (receiptEntries["quick-fix"].tree_hash !== commitTree) {
        return { sha, ok: false, missing: [`quick-fix tree mismatch: receipt ${String(receiptEntries["quick-fix"].tree_hash).slice(0, 12)} vs commit ${commitTree.slice(0, 12)}`], type: "invalid" };
      }
    } catch {
      return { sha, ok: false, missing: ["quick-fix tree mismatch: commit tree unresolvable"], type: "invalid" };
    }
    // WI-369 D2 (honest-emission): the note CLAIMING eligible is not proof —
    // re-run the eligibility predicate against the commit's own diff. A
    // manually forged eligible:true on non-exempt content refuses here.
    try {
      execFileSync(process.execPath, [join(SCRIPT_DIR, "quick-fix-eligibility.mjs"), "--sha", sha], { stdio: "pipe" });
    } catch (e) {
      const out = [e.stdout, e.stderr].filter(Boolean).map(String).join(" ").slice(0, 200);
      const ranPredicate = /"eligible"\s*:\s*false/.test(out);
      if (e.status === 1 && ranPredicate) {
        return { sha, ok: false, missing: [`quick-fix eligibility mismatch: note claims eligible, commit classifies ineligible — ${out.slice(0, 120)}`], type: "invalid" };
      }
      return { sha, ok: false, missing: [`quick-fix eligibility re-check could not run (${e.code || `status ${e.status}`}) — fail-closed`], type: "invalid" };
    }
    return { sha, ok: true, type: "quick-fix" };
  }
  // WI-385: choose the required-receipt set. DEFAULT = full 5. The LOW tier
  // activates ONLY under the graded opt-in AND a diff that RE-DERIVES to "low"
  // (the declared risk_tier on any receipt is never trusted — derive-receipt-tier
  // reads the commit's own diff and fails CLOSED to full). The low tier still
  // demands a real cross-family adversarial review (never self-review).
  let requiredTypes = consumerRequiredTypes || REQUIRED_TYPES_FULL;
  if (!consumer && readRiskTieringPolicy() === "graded") {
    let derived;
    try { derived = deriveTier(sha); } catch { derived = { tier: "full" }; }
    if (derived && derived.tier === "low") {
      const re = receiptEntries["review-exec"] || {};
      // AC1/AC2: the "never self-review" fence is MECHANICAL. The declared
      // author_family/reviewer_family are REQUIRED (AC2), but enforcement does
      // NOT trust them — Gemini G6 #3: re-derive the families from the receipt's
      // OWN review hosts (orchestrator + the USED adversarial host) so a receipt
      // written with forged cross-family strings over same-family hosts is caught.
      if (!re.author_family || !re.reviewer_family) {
        return { sha, ok: false, missing: ["low-tier review-exec must carry author_family AND reviewer_family (mechanical cross-family fence; a forgeable self_review boolean is insufficient)"], type: "invalid" };
      }
      const sr = re.self_review || {};
      const ar = re.adversarial_review || {};
      const reviewerHost = ar.fallback_used ? ar.fallback_host : ar.primary_reviewer_host;
      const af = familyOf(sr.orchestrator), rf = familyOf(reviewerHost);
      if (af === "unknown" || rf === "unknown" || af === rf) {
        return { sha, ok: false, missing: [`low-tier review is NOT a real cross-family pass (author host→${af}, reviewer host→${rf}) — re-derived from the receipt's own hosts, declared families are not trusted`], type: "invalid" };
      }
      requiredTypes = LOW_TIER_TYPES;
    }
    // derived.tier === "full" → requiredTypes stays full 5; a commit that only
    // emitted the low set will fail the missing check below (declared-low,
    // derives-full → rejected, fail-closed).
  }
  const missing = requiredTypes.filter((t) => !receiptEntries[t]);
  if (missing.length > 0) {
    return { sha, ok: false, missing, type: "incomplete" };
  }
  const strictMode = !consumer;
  const shouldValidateType = (type) => strictMode || requiredTypes.includes(type);
  // WI-385 AC2 (BOTH tiers, wherever declared): if review-exec carries the family
  // fields, they must be a real cross-family pair — a self-review (same family)
  // is rejected even in the full tier. New emissions populate these; legacy
  // receipts without them are grandfathered (the full tier's review-plan +
  // audit-implementation remain its cross-family evidence).
  {
    const re = receiptEntries["review-exec"] || {};
    // Re-derive from the receipt's own hosts (not the declared families). Applies
    // to BOTH tiers wherever the review structure reveals a self-review.
    const sr = re.self_review || {};
    const ar = re.adversarial_review || {};
    if (shouldValidateType("review-exec") && sr.orchestrator && ar && (ar.primary_reviewer_host || ar.fallback_host)) {
      const reviewerHost = ar.fallback_used ? ar.fallback_host : ar.primary_reviewer_host;
      const af = familyOf(sr.orchestrator), rf = familyOf(reviewerHost);
      if (af !== "unknown" && af === rf) {
        return { sha, ok: false, missing: [`review-exec is a self-review (author host & reviewer host both → ${af}) — rejected (WI-385 cross-family fence)`], type: "invalid" };
      }
    }
  }
  // WI-396: bind exec-record + review-exec to the commit TREE (squash-invariant,
  // unlike diff_hash) — rejects a receipt promoted onto a different commit, the
  // forgery class the presence-only validator missed. Grandfathered: enforced
  // when tree_hash is present; emit-receipt always populates it for these types
  // going forward, so legacy noteless commits stay valid while new ones are bound.
  try {
    const commitTree = git(["rev-parse", `${sha}^{tree}`]);
    for (const t of ["exec-record", "review-exec"]) {
      if (!shouldValidateType(t)) continue;
      const r = receiptEntries[t] || {};
      const bound = Number(r.schema_version) >= 2 || r.tree_hash; // explicit post-WI-396 marker
      if (bound && !r.tree_hash) {
        // schema_version>=2 promises a tree bind; a missing tree_hash is the omission bypass.
        return { sha, ok: false, missing: [`${t} schema_version>=2 requires tree_hash (omission bypass blocked)`], type: "invalid" };
      }
      if (r.tree_hash && r.tree_hash !== commitTree) {
        return { sha, ok: false, missing: [`${t} tree mismatch: receipt ${String(r.tree_hash).slice(0, 12)} vs commit ${commitTree.slice(0, 12)}`], type: "invalid" };
      }
    }
  } catch {
    return { sha, ok: false, missing: ["commit tree unresolvable for envelope tree-bind"], type: "invalid" };
  }
  // WI-381: RECOMPUTE the pipeline-baton AC binding for v3+ plan-manifests
  // (NOT the old key-presence check). The baton's ac_digests is a NAVIGATION
  // index downstream skills trust instead of re-reading the spec, so a STALE
  // binding (spec ACs revised after distillation) must fail. Recompute against
  // the spec AS IT IS IN THIS COMMIT'S TREE — each baton binds to its own commit,
  // so legitimate later spec evolution never false-fails a historical commit.
  if (shouldValidateType("plan-manifest")) {
    const pm = receiptEntries["plan-manifest"] || {};
    const ad = pm.ac_digests;
    // Gemini G6 #1: a PRESENT baton must ALWAYS be bound + recomputed, regardless
    // of schema_version — else a forged v2 receipt carrying ac_digests WITHOUT a
    // spec_ac_table_sha256 would bypass the staleness gate while downstream skills
    // still consume the payload. Only the ABSENCE of a baton is grandfathered
    // (legacy v1/v2 plan-manifests have none → validateReceipt's version filter).
    if (ad) {
      if (!/^[0-9a-f]{64}$/.test(String(ad.spec_ac_table_sha256 || ""))) {
        return { sha, ok: false, missing: ["plan-manifest ac_digests.spec_ac_table_sha256 must be a 64-hex sha256"], type: "invalid" };
      }
      if (typeof ad.spec_path !== "string" || !/^[\w./-]+$/.test(ad.spec_path)) {
        return { sha, ok: false, missing: [`plan-manifest ac_digests.spec_path invalid: ${JSON.stringify(ad.spec_path)}`], type: "invalid" };
      }
      let specText = null;
      try { specText = execFileSync("git", ["show", `${sha}:${ad.spec_path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
      catch { specText = null; }
      if (specText === null) {
        return { sha, ok: false, missing: [`plan-manifest baton spec_path '${ad.spec_path}' not in commit tree (baton references a missing spec)`], type: "invalid" };
      }
      const recomputed = acTableSha256(specText);
      if (recomputed !== ad.spec_ac_table_sha256) {
        return { sha, ok: false, missing: [`plan-manifest baton STALE: recomputed spec AC sha ${recomputed.slice(0, 12)} != baton ${String(ad.spec_ac_table_sha256).slice(0, 12)} (ACs revised after distill — re-distill the baton)`], type: "invalid" };
      }
    }
  }
  // All required receipts present; validate each (the resolved tier's set)
  const invalid = [];
  for (const t of requiredTypes) {
    const v = validateReceipt(t, receiptEntries[t], sha);
    if (!v.valid) invalid.push(`${t}: ${v.reasons.join("; ")}`);
  }
  return {
    sha,
    ok: invalid.length === 0,
    missing: invalid,
    type: invalid.length === 0 ? "complete" : "invalid",
  };
}

function shasFromRange(base, head) {
  return git(["log", "--format=%H", `${base}..${head}`]).split("\n").filter(Boolean);
}

function shasFromPr(pr) {
  // gh pr view returns the PR's commits; use the head SHA
  const json = execFileSync("gh", ["pr", "view", String(pr), "--json", "baseRefName,headRefOid,commits"], { encoding: "utf8" });
  const data = JSON.parse(json);
  return data.commits.map((c) => c.oid);
}

async function main() {
  const args = process.argv.slice(2);
  let shas = [];
  let sawRange = false;
  let sawSha = false;
  let sawPr = false;
  let wi = null;
  let consumer = null;
  let expectedStage = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--sha") {
      sawSha = true;
      shas.push(args[++i]);
    }
    else if (args[i] === "--range") {
      sawRange = true;
      if (process.env.SVC_RECEIPT_RANGE_WORKER === "1") {
        throw new RangeConfigError("range recursion is forbidden inside a receipt worker");
      }
      const [base, head] = args[++i].split("..");
      shas = shas.concat(shasFromRange(base, head));
    } else if (args[i] === "--pr") {
      sawPr = true;
      shas = shas.concat(shasFromPr(args[++i]));
    } else if (args[i] === "--wi") {
      wi = args[++i];
    } else if (args[i] === "--consumer") {
      consumer = args[++i];
    } else if (args[i] === "--expected-stage") {
      expectedStage = args[++i];
    }
  }

  if (sawRange && (sawSha || sawPr)) {
    throw new RangeConfigError("mixed --range with --sha or --pr is not supported");
  }
  if (consumer && !CONSUMER_TYPES.has(consumer)) {
    throw new RangeConfigError(`--consumer must be one of: ${[...CONSUMER_TYPES].join(", ")}`);
  }
  if (expectedStage && !EXPECTED_STAGE_TYPES[expectedStage]) {
    throw new RangeConfigError(`--expected-stage must be one of: ${Object.keys(EXPECTED_STAGE_TYPES).join(", ")}`);
  }
  if (shas.length === 0) {
    console.error("Usage: check-chain-receipts.mjs --sha <sha> | --range <base>..<head> | --pr <n> [--wi WI-###] [--consumer execute-changeset|review-exec|audit-implementation|stop|verify-promotion|final-report|push|reconcile] [--expected-stage STAGE]");
    process.exit(1);
  }

  const notesTip = gitTry(["rev-parse", "refs/notes/svc-receipts"]);
  const fingerprint = policyFingerprint();
  const canUseCache = !wi && !consumer;
  const cachedGreen = canUseCache ? readReconcileCache(notesTip, fingerprint) : new Set();
  const cacheHitShas = shas.filter((sha) => cachedGreen.has(sha));
  const shasToCheck = shas.filter((sha) => !cachedGreen.has(sha));

  let checkedResults;
  let concurrency;
  let timeout;
  let usedPool = false;
  if (sawRange) {
    concurrency = resolveRangeConcurrency();
    timeout = resolveRangeWorkerTimeout();
  }
  if (sawRange && shasToCheck.length > 1) {
    usedPool = true;
    checkedResults = await checkShasWithPool(
      shasToCheck,
      concurrency,
      (sha) => checkShaInWorker(sha, { timeout, wi, consumer, expectedStage }),
    );
  } else {
    checkedResults = shasToCheck.map((sha) => checkSha(sha, { wi, consumer, expectedStage }));
  }
  // Cache hits are only admitted from NOTE-sourced complete receipts. Keep
  // the public result byte-stable across cold and warm runs so callers do not
  // have to special-case a reconciliation implementation detail.
  const cachedResults = cacheHitShas.map((sha) => ({
    sha,
    ok: true,
    missing: [],
    type: "complete",
    receipt_source: "note",
  }));
  const resultBySha = new Map([...checkedResults, ...cachedResults].map((r) => [r.sha, r]));
  const results = shas.map((sha) => resultBySha.get(sha));
  // Only a NOTE-sourced green is durable enough to cache — a mirror-sourced
  // green can vanish the instant the (gitignored, routinely-deleted) mirror
  // is removed, and the cache must never assert green for a SHA that would
  // now come back unaccounted.
  const newlyGreen = checkedResults.filter((r) => r.ok && r.receipt_source === "note").map((r) => r.sha);
  if (canUseCache) {
    writeReconcileCache(notesTip, fingerprint, new Set([...cachedGreen, ...newlyGreen]));
  }
  const failed = results.filter((r) => !r.ok);
  const infrastructureFailures = failed
    .filter(isInfrastructureFailure)
    .map((candidate) => candidate.sha);
  const output = {
    ok: failed.length === 0,
    results,
    ...(sawRange ? { infrastructure_failures: infrastructureFailures } : {}),
  };
  console.log(JSON.stringify(output, null, 2));
  for (const row of failed.filter(isInfrastructureFailure)) {
    console.error(`receipt worker infrastructure failure ${row.sha}: ${row.missing.join("; ")}`);
  }
  process.exitCode = failed.length === 0 ? 0 : 1;
}

const INVOKED_FILE = process.argv[1]
  ? (() => {
      try { return realpathSync(resolve(process.argv[1])); }
      catch { return resolve(process.argv[1]); }
    })()
  : null;
if (INVOKED_FILE === realpathSync(SCRIPT_FILE)) {
  try {
    await main();
  } catch (error) {
    if (error instanceof RangeConfigError) {
      console.error(`receipt range configuration error: ${error.message}`);
      process.exitCode = 2;
    } else {
      throw error;
    }
  }
}
