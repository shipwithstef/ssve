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
export function consumeToolCallReceipt({ session_id, tool_use_id, host, original_digest, generation = null, now = Date.now(), env = process.env }) {
  const noop = (reason) => ({ ok: false, reason });
  const root = receiptsRoot(env);
  const file = receiptPath(root, receiptKey({ session_id, tool_use_id }));
  const stat = lstatSafe(file);
  if (!stat) return noop("receipt_missing");
  if (stat.isSymbolicLink() || !stat.isFile()) return noop("receipt_insecure");
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) return noop("receipt_foreign_owned");
  if ((stat.mode & 0o077) !== 0) return noop("receipt_insecure_mode");
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return noop("receipt_unreadable"); }
  if (receipt?.schema_version !== RECEIPT_SCHEMA_VERSION) return noop("receipt_schema_unknown");
  if (receipt.consumed_at) return noop("receipt_replayed");
  if (Date.parse(receipt.expires_at || "") <= now) return noop("receipt_expired");
  if (String(host || "") && String(receipt.host || "") !== String(host)) return noop("host_mismatch");
  if (String(session_id ?? "") && receipt.session_id !== String(session_id)) return noop("session_mismatch");
  if (receipt.tool_use_id !== String(tool_use_id)) return noop("tool_use_mismatch");
  if (String(original_digest || "") && receipt.original_digest !== String(original_digest)) return noop("digest_mismatch");
  if (generation !== null && receipt.lease && Number(receipt.lease.generation || 0) !== Number(generation)) return noop("generation_mismatch");
  // One-time consumption is itself compare-and-write: mark consumed first so a
  // crash between mark and use cannot resurrect a spent receipt.
  const consumed = { ...receipt, consumed_at: new Date(now).toISOString() };
  const temp = `${file}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`;
  const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, JSON.stringify(consumed)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  fs.renameSync(temp, file);
  try { fs.chmodSync(file, 0o600); } catch {}
  return { ok: true, receipt, file };
}

export function dropConsumedReceipt({ session_id, tool_use_id, env = process.env }) {
  const file = receiptPath(receiptsRoot(env), receiptKey({ session_id, tool_use_id }));
  try { fs.unlinkSync(file); return true; } catch { return false; }
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
