#!/usr/bin/env node
/**
 * Repository-shared immutable store for external-review artifact bytes.
 * Objects are keyed by SHA-256. A relocation manifest maps historical
 * absolute (or checkout-relative) paths to those object ids without
 * rewriting launcher receipts or git notes.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const SHA_RE = /^[0-9a-f]{64}$/;
const digest = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

function git(args, cwd) {
  return execFileSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

export function repositoryIdentity(start = process.cwd()) {
  try {
    const current = fs.realpathSync(git(["rev-parse", "--show-toplevel"], start));
    const common = fs.realpathSync(path.resolve(current, git(["rev-parse", "--git-common-dir"], start)));
    return { checkout: current, gitCommonDir: common, repoRoot: fs.realpathSync(path.dirname(common)) };
  } catch {
    const checkout = fs.realpathSync(path.resolve(start));
    return { checkout, gitCommonDir: path.join(checkout, ".git"), repoRoot: checkout };
  }
}

export function reviewEvidenceStoreRoot(start = process.cwd(), env = process.env) {
  if (env.SVC_REVIEW_EVIDENCE_STORE) return path.resolve(env.SVC_REVIEW_EVIDENCE_STORE);
  const { gitCommonDir } = repositoryIdentity(start);
  return path.join(gitCommonDir, "svc-review-evidence");
}

function secureDir(directory, { create = false } = {}) {
  const lexical = path.resolve(directory);
  if (create) fs.mkdirSync(lexical, { recursive: true, mode: 0o700 });
  const stat = fs.lstatSync(lexical);
  if (!stat.isDirectory() || stat.isSymbolicLink() || fs.realpathSync(lexical) !== lexical) {
    throw new Error(`review-evidence store directory is insecure: ${directory}`);
  }
  if (typeof process.getuid === "function" && stat.uid !== process.getuid()) {
    throw new Error(`review-evidence store directory is foreign-owned: ${directory}`);
  }
  return lexical;
}

function objectPath(root, sha256) {
  if (!SHA_RE.test(sha256)) throw new Error("object id must be a 64-hex digest");
  return path.join(root, "objects", sha256.slice(0, 2), sha256.slice(2));
}

export function putObject(bytes, { start = process.cwd(), env = process.env } = {}) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const sha256 = digest(buf);
  const root = secureDir(reviewEvidenceStoreRoot(start, env), { create: true });
  secureDir(path.join(root, "objects"), { create: true });
  const dest = objectPath(root, sha256);
  fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
  if (fs.existsSync(dest)) {
    const existing = fs.readFileSync(dest);
    if (digest(existing) !== sha256) throw new Error(`review-evidence object collision: ${sha256}`);
    return { sha256, path: dest, created: false };
  }
  const tmp = `${dest}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const fd = fs.openSync(tmp, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try {
    fs.writeFileSync(fd, buf);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, dest);
  } catch (error) {
    try { fs.unlinkSync(tmp); } catch { /* leftover tmp is not authority */ }
    if (fs.existsSync(dest)) {
      if (digest(fs.readFileSync(dest)) !== sha256) throw new Error(`review-evidence object collision: ${sha256}`);
      return { sha256, path: dest, created: false };
    }
    throw error;
  }
  return { sha256, path: dest, created: true };
}

export function getObject(sha256, { start = process.cwd(), env = process.env } = {}) {
  if (!SHA_RE.test(sha256)) throw new Error("object id must be a 64-hex digest");
  const root = reviewEvidenceStoreRoot(start, env);
  const dest = objectPath(root, sha256);
  const stat = fs.lstatSync(dest);
  if (!stat.isFile() || stat.isSymbolicLink() || fs.realpathSync(dest) !== dest) {
    throw new Error(`review-evidence object is insecure: ${sha256}`);
  }
  const bytes = fs.readFileSync(dest);
  if (digest(bytes) !== sha256) throw new Error(`review-evidence object tampered: ${sha256}`);
  return { sha256, path: dest, bytes };
}

function normalizeHistoricalPath(value) {
  return String(value || "").trim();
}

export function putRelocation(entry, { start = process.cwd(), env = process.env } = {}) {
  const historical_path = normalizeHistoricalPath(entry.historical_path);
  const sha256 = String(entry.sha256 || "");
  if (!historical_path) throw new Error("relocation requires historical_path");
  if (!SHA_RE.test(sha256)) throw new Error("relocation requires object sha256");
  const root = secureDir(reviewEvidenceStoreRoot(start, env), { create: true });
  const manifestDir = secureDir(path.join(root, "relocations"), { create: true });
  const key = digest(Buffer.from(historical_path));
  const file = path.join(manifestDir, `${key}.json`);
  const record = {
    schema_version: 1,
    historical_path,
    sha256,
    repo_root: entry.repo_root || (env.SVC_REVIEW_EVIDENCE_STORE ? path.resolve(start) : repositoryIdentity(start).repoRoot),
    candidate_digest: entry.candidate_digest || null,
    kind: entry.kind || null,
    relocated_at: entry.relocated_at || new Date().toISOString(),
  };
  if (fs.existsSync(file)) {
    const existing = JSON.parse(fs.readFileSync(file, "utf8"));
    if (existing.sha256 !== sha256 || existing.historical_path !== historical_path) {
      throw new Error(`conflicting relocation for ${historical_path}`);
    }
    return { ...existing, created: false, path: file };
  }
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
  return { ...record, created: true, path: file };
}

export function lookupRelocation(historicalPath, { start = process.cwd(), env = process.env } = {}) {
  const historical_path = normalizeHistoricalPath(historicalPath);
  if (!historical_path) return null;
  const root = reviewEvidenceStoreRoot(start, env);
  const file = path.join(root, "relocations", `${digest(Buffer.from(historical_path))}.json`);
  if (!fs.existsSync(file)) return null;
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`relocation manifest is insecure: ${historical_path}`);
  const record = JSON.parse(fs.readFileSync(file, "utf8"));
  if (record.historical_path !== historical_path || !SHA_RE.test(record.sha256)) {
    throw new Error(`forged or malformed relocation for ${historical_path}`);
  }
  return record;
}

function walkFiles(directory, out = []) {
  const stat = fs.lstatSync(directory);
  if (stat.isSymbolicLink()) throw new Error(`refusing to walk symlink: ${directory}`);
  if (!stat.isDirectory()) return out;
  for (const name of fs.readdirSync(directory).sort()) {
    const next = path.join(directory, name);
    const child = fs.lstatSync(next);
    if (child.isSymbolicLink()) throw new Error(`refusing to relocate symlink: ${next}`);
    if (child.isDirectory()) walkFiles(next, out);
    else if (child.isFile()) out.push(next);
  }
  return out;
}

export function relocatePath(sourcePath, extraHistorical = [], opts = {}) {
  const absolute = fs.realpathSync(path.resolve(sourcePath));
  const stat = fs.lstatSync(path.resolve(sourcePath));
  if (stat.isSymbolicLink()) throw new Error(`refusing to relocate symlink: ${sourcePath}`);
  const bytes = fs.readFileSync(absolute);
  const object = putObject(bytes, opts);
  const paths = new Set([absolute, path.resolve(sourcePath), ...extraHistorical.map(normalizeHistoricalPath).filter(Boolean)]);
  const rows = [];
  for (const historical_path of paths) {
    rows.push(putRelocation({
      historical_path,
      sha256: object.sha256,
      candidate_digest: opts.candidate_digest,
      kind: opts.kind,
    }, opts));
  }
  return { sha256: object.sha256, bytes, created: object.created, relocations: rows };
}

export function relocateTree(sourceDir, opts = {}) {
  const resolved = path.resolve(sourceDir);
  const stat = fs.lstatSync(resolved);
  if (stat.isSymbolicLink()) throw new Error(`refusing to relocate symlink: ${sourceDir}`);
  const root = fs.realpathSync(resolved);
  const files = walkFiles(root);
  return files.map((file) => relocatePath(file, [], opts));
}

export function resolveEvidenceBytes(value, { start = process.cwd(), env = process.env, extraPaths = [] } = {}) {
  if (!value || typeof value.path !== "string" || !SHA_RE.test(String(value.sha256 || ""))) {
    throw new Error("evidence artifacts require path and sha256");
  }
  const declared = String(value.sha256);
  const candidates = [value.path, ...extraPaths].map(normalizeHistoricalPath).filter(Boolean);
  for (const candidate of candidates) {
    const relocated = lookupRelocation(candidate, { start, env });
    if (relocated) {
      if (relocated.sha256 !== declared) throw new Error(`relocation digest mismatch: ${candidate}`);
      const object = getObject(declared, { start, env });
      return { ...object, source: "relocation", historical_path: candidate };
    }
  }
  try {
    return { ...getObject(declared, { start, env }), source: "object-id", historical_path: value.path };
  } catch {
    throw new Error(`no relocated object for ${value.path}`);
  }
}
