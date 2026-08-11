// task-state-compatibility.mjs — WI-486 task-4.
//
// PURE task-state compatibility inspection (SIB-26..29, SIB-36..41). This module
// NEVER writes task-graph bytes and NEVER confers mutation authority (SIB-29):
// it only classifies bytes, produces an in-memory normalized view, computes a
// classification-sensitive identity digest, and records a BOUNDED disposition
// (first-actionable / repeat-advisory) so a compatibility diagnosis can never
// hard-block a session indefinitely (SIB-38). On-disk migration is a separate,
// explicitly-authorized CLI (scripts/svc-migrate-task-state.mjs, SIB-30..35).

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { validateTaskGraphShape } from "./validate-task-graph-shape.mjs";

export const SUPPORTED = "supported";
export const LEGACY_LOSSLESS = "legacy-lossless";
export const QUARANTINE = "quarantine-recommended";
export const CURRENT_VERSION = 1;

// ---------------------------------------------------------------------------
// classifyTaskState(bytes) -> { classification, effective_version, parseable, reason }
//
// NEVER throws — invalid bytes classify as quarantine-recommended (SIB-28/29).
// Version source of truth: `schema_version` (current) or legacy `version`; an
// omitted version means the current supported shape (SIB-26).
// ---------------------------------------------------------------------------
export function classifyTaskState(bytes) {
  const text = Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes ?? "");
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { classification: QUARANTINE, effective_version: null, parseable: false, reason: "unparseable-bytes" };
  }
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) {
    return { classification: QUARANTINE, effective_version: null, parseable: true, reason: "not-an-object" };
  }
  const hasSchema = Object.prototype.hasOwnProperty.call(doc, "schema_version");
  const hasLegacy = Object.prototype.hasOwnProperty.call(doc, "version");
  let effective;
  if (hasSchema) effective = doc.schema_version;
  else if (hasLegacy) effective = doc.version;
  else effective = CURRENT_VERSION; // omitted == current supported shape (SIB-26)

  if (!Number.isInteger(effective) || effective < 0) {
    return { classification: QUARANTINE, effective_version: effective, parseable: true, reason: "non-integer-version" };
  }
  if (effective > CURRENT_VERSION) {
    return { classification: QUARANTINE, effective_version: effective, parseable: true, reason: "future-version" };
  }
  if (effective === CURRENT_VERSION) {
    // WI-486 (EXEC-008): a current-version graph is SUPPORTED only if its SHAPE
    // is well-formed. `{schema_version:1, tasks:"invalid"}` (or missing/malformed
    // tasks) is NOT supported — it quarantines instead of silently passing.
    if (!isWellFormedGraphShape(doc)) {
      return { classification: QUARANTINE, effective_version: effective, parseable: true, reason: "malformed-current-graph" };
    }
    return { classification: SUPPORTED, effective_version: effective, parseable: true, reason: "current-version" };
  }
  // effective === 0 → legacy: legacy-lossless only if it can normalize to v1
  // without loss; a lossy/malformed legacy graph quarantines (SIB-28).
  if (isWellFormedGraphShape(doc)) {
    return { classification: LEGACY_LOSSLESS, effective_version: 0, parseable: true, reason: "legacy-lossless" };
  }
  return { classification: QUARANTINE, effective_version: 0, parseable: true, reason: "legacy-lossy" };
}

// The complete well-formed task-graph shape gate. WI-486 (EXEC-R2-003): this now
// delegates to the ONE shared canonical validator so the compatibility
// classification and the mutation-authority path agree on exactly what "clean"
// means — unknown statuses, duplicate ids, dangling/self blockers, non-array
// blocked_by, and structural corruption are ALL rejected here, not just a
// tasks-array-of-id/status. Used for BOTH the supported (v1) shape gate and
// legacy-lossless upgradability, so no malformed graph — legacy or current — is
// ever classified as clean.
function isWellFormedGraphShape(doc) {
  return validateTaskGraphShape(doc).ok;
}

// ---------------------------------------------------------------------------
// normalizedView(input) -> versioned read-only view (in-memory only, SIB-27).
// Accepts { bytes } or { doc }. Upgrades ONLY a legacy-lossless graph; throws for
// supported (already current) and quarantine (unsafe). The result is frozen and
// is NEVER persisted by this function.
// ---------------------------------------------------------------------------
export function normalizedView(input) {
  const bytes = input && input.bytes != null
    ? input.bytes
    : Buffer.from(JSON.stringify(input && input.doc != null ? input.doc : input));
  const { classification } = classifyTaskState(bytes);
  if (classification !== LEGACY_LOSSLESS) {
    throw new Error(`normalizedView only upgrades legacy-lossless graphs (got ${classification})`);
  }
  const doc = JSON.parse(Buffer.isBuffer(bytes) ? bytes.toString("utf8") : String(bytes));
  const { version, ...rest } = doc;
  const view = { schema_version: CURRENT_VERSION, ...rest, _normalized_from_version: version ?? 0 };
  return Object.freeze(view);
}

// ---------------------------------------------------------------------------
// stateIdentityDigest(ctx) -> hex sha256 over the SIX loop-termination fields
// (SIB-36): repo, session, absolute worktree, affected state paths, exact
// state-byte digest, AND compatibility classification. Length-delimited framing
// so no field boundary can be forged by concatenation.
// ---------------------------------------------------------------------------
export function stateIdentityDigest(ctx = {}) {
  const parts = [];
  const push = (label, value) => {
    const s = String(value ?? "");
    parts.push(`${label}:${Buffer.byteLength(s, "utf8")}:${s}`);
  };
  push("repo", ctx.repoRoot);
  push("session", ctx.sessionId);
  push("worktree", ctx.worktreeRoot);
  const paths = [...(ctx.affectedPaths || [])].map(String).sort();
  push("paths", JSON.stringify(paths));
  // exact state-byte digest, path-sorted so ordering never changes identity
  const byteMap = ctx.graphBytesByPath || {};
  const byteDigest = createHash("sha256");
  for (const p of Object.keys(byteMap).sort()) {
    const b = Buffer.isBuffer(byteMap[p]) ? byteMap[p] : Buffer.from(String(byteMap[p]));
    byteDigest.update(`${p}:${b.length}:`).update(b);
  }
  push("bytes", byteDigest.digest("hex"));
  push("classification", ctx.classification);
  return createHash("sha256").update(parts.join("\x1e")).digest("hex");
}

function runtimeDir() {
  return process.env.SVC_TASK_STATE_RUNTIME_DIR ||
    path.join(process.cwd(), ".svc", "task-state-compat");
}

// ---------------------------------------------------------------------------
// recordDisposition(ctx) -> { disposition, classification, affected_path?, recovery? }
// BOUNDED loop (SIB-37..41):
//   - supported            -> "none", writes no marker (SIB-41)
//   - first sight of a digest -> "actionable" + one recovery command, writes marker
//   - repeat of the same digest -> "advisory" (never hard-block, SIB-38)
// The digest already partitions by session (SIB-40) and by state bytes (SIB-39),
// so a different session or changed bytes get their own single actionable pass.
// ---------------------------------------------------------------------------
export function recordDisposition(ctx = {}) {
  const classification = ctx.classification || classifyTaskState(
    ctx.bytes || Buffer.from("{}")
  ).classification;
  if (classification === SUPPORTED) {
    return { disposition: "none", classification };
  }
  const digest = stateIdentityDigest({ ...ctx, classification });
  const dir = runtimeDir();
  const marker = path.join(dir, `${digest}.json`);
  const affectedPath = (ctx.affectedPaths || [])[0] || null;
  const recovery = recoveryCommand(ctx.wi, affectedPath);

  // WI-486 (EXEC-008): the FIRST-seen marker is established ATOMICALLY with
  // O_EXCL in a verified 0700 directory. Exactly one caller wins "actionable";
  // a concurrent/subsequent caller sees EEXIST → "advisory" (bounded). If the
  // marker CANNOT be established at all (unwritable/unsafe runtime dir), the
  // disposition is a NON-BLOCKING "error" — a first-actionable can never recur
  // forever and hard-block Stop.
  let established;
  try {
    established = establishFirstSeenMarker(dir, marker, {
      digest, classification, session_id: ctx.sessionId || null, affected_path: affectedPath, recovery,
    });
  } catch {
    return { disposition: "error", classification, digest, reason: "disposition-persistence-unsafe" };
  }
  if (established === "exists") {
    return { disposition: "advisory", classification, digest };
  }
  if (established === "created") {
    return { disposition: "actionable", classification, affected_path: affectedPath, recovery, digest };
  }
  return { disposition: "error", classification, digest, reason: "disposition-marker-unwritable" };
}

// Returns "created" (this call established the first-seen marker), "exists" (a
// prior first-seen marker is present), or "unwritable" (the marker could not be
// created for a reason other than pre-existence). Throws only when the runtime
// directory itself is unsafe.
function establishFirstSeenMarker(dir, marker, payload) {
  ensureRuntimeDir(dir);
  let fd;
  try {
    fd = fs.openSync(marker, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  } catch (error) {
    if (error && error.code === "EEXIST") return "exists";
    return "unwritable";
  }
  try {
    fs.writeFileSync(fd, JSON.stringify({ ...payload, first_seen: true }) + "\n");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  return "created";
}

// Create (idempotently) and VERIFY the runtime dir is a real, self-owned, 0700
// directory. Any deviation throws so the caller degrades to a non-blocking error.
function ensureRuntimeDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`unsafe task-state runtime dir: ${dir}`);
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error(`foreign-owned task-state runtime dir: ${dir}`);
  }
}

function recoveryCommand(wi, affectedPath) {
  const wiArg = wi ? `--wi ${wi}` : "--wi <WI>";
  const target = affectedPath ? ` (state: ${affectedPath})` : "";
  return `node scripts/svc-migrate-task-state.mjs ${wiArg} --authorization <auth-file>${target}`;
}

export default {
  classifyTaskState, normalizedView, stateIdentityDigest, recordDisposition,
  SUPPORTED, LEGACY_LOSSLESS, QUARANTINE, CURRENT_VERSION,
};
