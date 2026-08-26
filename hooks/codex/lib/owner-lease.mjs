import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { sessionDir } from "./codex-hook-context.mjs";

const MAX_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TTL_MIN = 24 * 60;
const FILE = "owner-override.json";
function file(repoRoot, sid, env = process.env) { return path.join(sessionDir(repoRoot, sid, env), FILE); }
function write(filePath, value) { const temp = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`; const fd = fs.openSync(temp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600); try { fs.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); } fs.renameSync(temp, filePath); fs.chmodSync(filePath, 0o600); }
export function armOwnerLease({ repo_root, worktree_root, wi, session_id, reason, ttl_min = DEFAULT_TTL_MIN, env = process.env, now = Date.now() }) { if (!reason || !String(reason).trim()) throw new Error("owner override requires a reason"); const ttl = Math.min(DEFAULT_TTL_MIN, Math.max(1, Number(ttl_min))) * 60_000; const repo = fs.realpathSync(repo_root); const worktree = fs.realpathSync(worktree_root); const target = file(repo, session_id, env); const lease = { schema_version: 1, lease_id: crypto.randomUUID(), session_id, repo_root: repo, worktree_root: worktree, wi, reason: String(reason).trim(), armed_at: new Date(now).toISOString(), expires_at: new Date(now + Math.min(ttl, MAX_MS)).toISOString() }; write(target, lease); return { ...lease, path: target }; }
export function readOwnerLease(repoRoot, sessionId, env = process.env, now = Date.now()) { try { const p = file(fs.realpathSync(repoRoot), sessionId, env); const stat = fs.lstatSync(p); if (!stat.isFile() || stat.isSymbolicLink() || (typeof process.getuid === "function" && stat.uid !== process.getuid())) return null; const lease = JSON.parse(fs.readFileSync(p, "utf8")); if (Date.parse(lease.expires_at) <= now) { try { fs.unlinkSync(p); } catch {} return null; } return lease; } catch { return null; } }
export function renewOwnerLease(repoRoot, sessionId, env = process.env, now = Date.now()) {
  const repo = fs.realpathSync(repoRoot);
  const target = file(repo, sessionId, env);
  const lease = readOwnerLease(repo, sessionId, env, now);
  if (!lease) return null;
  const renewed = { ...lease, renewed_at: new Date(now).toISOString(), expires_at: new Date(now + MAX_MS).toISOString() };
  write(target, renewed);
  return renewed;
}
export function disarmOwnerLease(repoRoot, sessionId, env = process.env) { const p = file(fs.realpathSync(repoRoot), sessionId, env); try { fs.unlinkSync(p); return true; } catch (e) { if (e.code === "ENOENT") return false; throw e; } }
export const OWNER_LEASE_MAX_MS = MAX_MS;
