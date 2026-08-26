// WI-FW-HOOKS-SAFETY-01 T04/AC-5: replay-safe pre/post tool-call correlation.
//
// PreToolUse stores a mode-0600 same-UID receipt OUTSIDE the consumer worktree
// (runtime authority root) keyed by digest(session id + tool-use id). It
// records ONLY identifiers and digests — never prompts, commands,
// credentials, tokens, or file contents. Successful PostToolUse may heartbeat
// only through consuming this receipt exactly once; missing, expired, reused,
// host-mismatched, digest-mismatched, or generation-mismatched receipts are
// no-ops. A missing receipt is observable but can never authorize anything:
// PostToolUse cannot grant authority PreToolUse did not establish.
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { resolveRuntimeDirectory } from "./svc-runtime-root.mjs";

export const RECEIPT_SCHEMA_VERSION = 1;
const RECEIPT_TTL_MS_DEFAULT = 30 * 60_000;

export function receiptsRoot(env = process.env) {
  return resolveRuntimeDirectory({ env, leaf: "svc-tool-receipts" }).path;
}

// EXTREV-EXEC-001: ONE canonical digest over the immutable original tool
// input. PreToolUse stores it in the receipt; PostToolUse recomputes it from
// the host-returned original tool input. Never derived from rewritten or
// normalized execution input.
export function canonicalOriginalDigest(originalCommandInput) {
  return `sha256:${crypto.createHash("sha256").update(String(originalCommandInput ?? "")).digest("hex")}`;
}

function sameUid(stat) {
  return typeof process.getuid !== "function" || stat.uid === process.getuid();
}

// EXTREV-EXEC-002: every ancestor of the receipt root must be a real,
// non-symlink directory; the receipt root itself must be same-UID. System
// ancestors (/ , /home) are legitimately root-owned, so ownership is enforced
// only where svc creates state; world-writable non-sticky dirs are rejected.
function assertSecureAncestry(root) {
  let current = path.resolve(root);
  const chain = [];
  while (true) {
    chain.unshift(current);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  chain.forEach((dir, index) => {
    const stat = lstatSafe(dir);
    if (!stat || stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error(`receipt root ancestry insecure at ${dir}`);
    }
    if (index === chain.length - 1 && !sameUid(stat)) {
      throw new Error(`receipt root foreign-owned at ${dir}`);
    }
    // World-writable without the sticky bit would let another principal plant
    // or swap components of the path.
    if ((stat.mode & 0o002) !== 0 && (stat.mode & 0o01000) === 0) {
      throw new Error(`receipt root ancestry writable-unprotected at ${dir}`);
    }
  });
}

export function receiptKey({ session_id, tool_use_id }) {
  return crypto.createHash("sha256")
    .update(`${String(session_id ?? "")}\0${String(tool_use_id ?? "")}`)
    .digest("hex");
}

function receiptPath(root, key) {
  // Two-level fan-out keeps any single directory small; every component is hex.
  return path.join(root, key.slice(0, 2), `${key}.json`);
}

export function writeToolCallReceipt({ session_id, tool_use_id, host, original_digest, decision = "allow", classification = "mutation", lease = null, ttlMs = RECEIPT_TTL_MS_DEFAULT, now = Date.now(), env = process.env }) {
  const key = receiptKey({ session_id, tool_use_id });
  const root = receiptsRoot(env);
  // EXTREV-EXEC-002: recursive mkdir follows symlinks; validate every ancestor
  // no-follow before creating anything beneath it.
  assertSecureAncestry(root);
  const file = receiptPath(root, key);
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const receipt = {
    schema_version: RECEIPT_SCHEMA_VERSION,
    key,
    host: String(host || ""),
    session_id: String(session_id || ""),
    tool_use_id: String(tool_use_id || ""),
    original_digest: String(original_digest || ""),
    decision, classification,
    lease: lease && typeof lease === "object" ? { ...lease } : null,
    issued_at: new Date(now).toISOString(),
    expires_at: new Date(now + Math.max(1_000, ttlMs)).toISOString(),
    consumed_at: null,
  };
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try {
    fs.writeFileSync(fd, JSON.stringify(receipt));
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  try { fs.chmodSync(file, 0o600); } catch {}
  return { receipt, file };
}

function lstatSafe(p) { try { return fs.lstatSync(p); } catch { return null; } }

// One-time consume. Returns { ok:true, receipt } only when the receipt exists,
// is unexpired and unconsumed, belongs to the same host/session/tool-use/
// original-digest tuple, and its lease generation matches when supplied.
// Every other outcome is a typed no-op reason — never an authorization.
//
// EXTREV-EXEC-002: consumption is claim-by-rename. The live receipt is
// atomically renamed to a unique claim path FIRST; exactly one concurrent
// consumer can win (the loser's rename hits ENOENT). All validation then runs
// against the claimed bytes; an invalid claim is unlinked, never restored to a
// consumable state.
export function consumeToolCallReceipt({ session_id, tool_use_id, host, original_digest, generation = null, now = Date.now(), env = process.env }) {
  const noop = (reason) => ({ ok: false, reason });
  const root = receiptsRoot(env);
  try { assertSecureAncestry(root); }
  catch { return noop("receipt_insecure"); }
  const file = receiptPath(root, receiptKey({ session_id, tool_use_id }));
  const claim = `${file}.claim.${process.pid}.${crypto.randomBytes(6).toString("hex")}`;
  try { fs.renameSync(file, claim); }
  catch { return noop("receipt_missing"); }
  const releaseInvalid = (reason) => { try { fs.unlinkSync(claim); } catch {} return noop(reason); };
  const stat = lstatSafe(claim);
  if (!stat) return noop("receipt_missing");
  if (stat.isSymbolicLink() || !stat.isFile()) return releaseInvalid("receipt_insecure");
  if (!sameUid(stat)) return releaseInvalid("receipt_foreign_owned");
  if ((stat.mode & 0o077) !== 0) return releaseInvalid("receipt_insecure_mode");
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(claim, "utf8")); }
  catch { return releaseInvalid("receipt_unreadable"); }
  if (receipt?.schema_version !== RECEIPT_SCHEMA_VERSION) return releaseInvalid("receipt_schema_unknown");
  if (receipt.consumed_at) return releaseInvalid("receipt_replayed");
  if (Date.parse(receipt.expires_at || "") <= now) return releaseInvalid("receipt_expired");
  if (String(host || "") && String(receipt.host || "") !== String(host)) return releaseInvalid("host_mismatch");
  if (String(session_id ?? "") && receipt.session_id !== String(session_id)) return releaseInvalid("session_mismatch");
  if (receipt.tool_use_id !== String(tool_use_id)) return releaseInvalid("tool_use_mismatch");
  // EXTREV-EXEC-001: mutation receipts REQUIRE proof of the immutable original
  // input — an absent digest can no longer silently skip correlation.
  if (receipt.classification === "mutation") {
    if (!String(original_digest || "")) return releaseInvalid("digest_required");
    if (receipt.original_digest !== String(original_digest)) return releaseInvalid("digest_mismatch");
  } else if (String(original_digest || "") && receipt.original_digest !== String(original_digest)) {
    return releaseInvalid("digest_mismatch");
  }
  if (generation !== null && receipt.lease && Number(receipt.lease.generation || 0) !== Number(generation)) return releaseInvalid("generation_mismatch");
  // The claim itself is the consumed state: rewrite it in place with the
  // consumed marker so auditable evidence persists until the sweeper collects it.
  const consumed = { ...receipt, consumed_at: new Date(now).toISOString() };
  const temp = `${claim}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(consumed)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, claim);
  try { fs.chmodSync(claim, 0o600); } catch {}
  return { ok: true, receipt, file: claim };
}

export function dropConsumedReceipt({ session_id, tool_use_id, env = process.env }) {
  const root = receiptsRoot(env);
  const key = receiptKey({ session_id, tool_use_id });
  const dir = path.join(root, key.slice(0, 2));
  let removed = false;
  try {
    for (const name of fs.readdirSync(dir)) {
      if (!name.startsWith(`${key}.json`)) continue;
      const full = path.join(dir, name);
      const stat = lstatSafe(full);
      if (!stat || stat.isSymbolicLink() || !stat.isFile() || !sameUid(stat)) continue;
      try { fs.unlinkSync(full); removed = true; } catch {}
    }
  } catch {}
  return removed;
}

// Bounded retention: sweep by owner (same-UID check) and age only.
export function sweepExpiredReceipts({ maxAgeMs = 24 * 3_600_000, now = Date.now(), env = process.env } = {}) {
  const root = receiptsRoot(env);
  let removed = 0;
  let stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const stat = lstatSafe(full);
      if (!stat) continue;
      if (stat.isSymbolicLink()) continue; // never follow
      if (entry.isDirectory()) { stack.push(full); continue; }
      if (!entry.isFile()) continue;
      if (typeof process.getuid === "function" && stat.uid !== process.getuid()) continue;
      if (now - stat.mtimeMs > maxAgeMs) { try { fs.unlinkSync(full); removed += 1; } catch {} }
    }
  }
  return { removed };
}
