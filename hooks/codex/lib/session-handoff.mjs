import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runtimeRoot, repoIdentity, readJson } from "./codex-hook-context.mjs";

const MAX_LIFETIME_MS = 60_000;
const NONCE = /^[A-Za-z0-9_-]{32,128}$/;

function handoffDir(env = process.env) {
  const root = path.join(runtimeRoot(env), "handoffs");
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  fs.chmodSync(root, 0o700);
  return root;
}

function fileFor(nonce, env = process.env) {
  if (!NONCE.test(String(nonce || ""))) throw new Error("invalid bootstrap handoff nonce");
  return path.join(handoffDir(env), `${nonce}.json`);
}

export function createBootstrapHandoff({ session_id, repo_root, wi, branch, base, command_digest, now = Date.now(), env = process.env }) {
  if (!session_id || !repo_root || !wi || !branch || !base || !command_digest) throw new Error("incomplete bootstrap handoff");
  const nonce = crypto.randomBytes(32).toString("base64url");
  const record = {
    schema_version: 1,
    nonce_hash: `sha256:${crypto.createHash("sha256").update(nonce).digest("hex")}`,
    session_id: String(session_id), repo_root: fs.realpathSync(repo_root), repo_id: repoIdentity(repo_root),
    wi: String(wi), branch: String(branch), base: String(base), command_digest: String(command_digest),
    created_at: new Date(now).toISOString(), expires_at: new Date(now + MAX_LIFETIME_MS).toISOString(),
  };
  const file = fileFor(nonce, env);
  const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, `${JSON.stringify(record)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  return { nonce, file, record };
}

export function consumeBootstrapHandoff(nonce, expected = {}, { now = Date.now(), env = process.env } = {}) {
  const file = fileFor(nonce, env);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error("invalid bootstrap handoff file");
  const record = readJson(file);
  if (!record || record.schema_version !== 1) throw new Error("malformed bootstrap handoff");
  if (Date.parse(record.expires_at) <= now) throw new Error("bootstrap handoff expired");
  if (expected.session_id && record.session_id !== expected.session_id) throw new Error("bootstrap handoff session mismatch");
  for (const key of ["repo_root", "wi", "branch", "base", "command_digest"]) if (expected[key] && String(record[key]) !== String(expected[key])) throw new Error(`bootstrap handoff ${key} mismatch`);
  const consumed = `${file}.consumed.${process.pid}.${crypto.randomBytes(8).toString("hex")}`;
  fs.renameSync(file, consumed);
  fs.chmodSync(consumed, 0o600);
  return record;
}

export function inspectBootstrapHandoff(nonce, expected = {}, { now = Date.now(), env = process.env } = {}) {
  const file = fileFor(nonce, env); const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (typeof process.getuid === "function" && stat.uid !== process.getuid())) throw new Error("invalid bootstrap handoff file");
  const record = readJson(file);
  if (!record || record.schema_version !== 1 || Date.parse(record.expires_at) <= now) throw new Error("invalid or expired bootstrap handoff");
  for (const key of ["session_id", "repo_root", "wi", "branch"]) if (expected[key] && String(record[key]) !== String(expected[key])) throw new Error(`bootstrap handoff ${key} mismatch`);
  return record;
}

export { MAX_LIFETIME_MS };
