#!/usr/bin/env node
/**
 * Repository-shared immutable store for external-review artifact bytes.
 * Objects are keyed by SHA-256. A relocation manifest maps historical
 * absolute (or checkout-relative) paths to those object ids without
 * rewriting launcher receipts or git notes. The same historical path may
 * accumulate append-only records keyed by path + sha256 (one per review
 * round). A later round never overwrites an earlier round's record.
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

function relocationFailure(label, historical_path) {
  throw new Error(`${label} for ${historical_path}`);
}

// v1 is one path → one digest. v2 keeps every digest for that path.
// A declared digest that is absent while any record exists is a conflict,
// not permission to fall back to a different object.
function relocationRecords(parsed, historical_path, label) {
  if (!parsed || typeof parsed !== "object" || parsed.historical_path !== historical_path) {
    relocationFailure(label, historical_path);
  }
  if (parsed.schema_version === 2 && Array.isArray(parsed.records)) {
    if (parsed.records.length === 0) relocationFailure(label, historical_path);
    if (parsed.sha256 && !parsed.records.some((row) => row && row.sha256 === parsed.sha256)) {
      relocationFailure(label, historical_path);
    }
    return parsed.records.map((row) => {
      if (!row || (row.historical_path && row.historical_path !== historical_path) || !SHA_RE.test(String(row.sha256 || ""))) {
        relocationFailure(label, historical_path);
      }
      return { ...row, historical_path };
    });
  }
  if (!SHA_RE.test(String(parsed.sha256 || ""))) relocationFailure(label, historical_path);
  return [parsed];
}

// Create-if-absent: write a private temp file, then hard-link it into place.
// link() fails with EEXIST instead of replacing, so concurrent writers can
// never discard each other's record. Returns true when this call created it.
function createJsonOnce(file, body) {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  const fd = fs.openSync(tmp, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
  try {
    fs.writeFileSync(fd, `${JSON.stringify(body, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.linkSync(tmp, file);
    return true;
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* temp is not authority */ }
  }
}

// Layout: relocations/<key>.json is the first record for a path (v1, or a
// legacy v2 manifest). Every later digest is its own immutable file
// relocations/<key>.d/<sha256>.json, created with link-no-clobber. Nothing is
// ever rewritten, so concurrent rounds cannot lose each other's records.
function relocationFiles(root, historical_path) {
  const key = digest(Buffer.from(historical_path));
  const dir = path.join(root, "relocations");
  return { file: path.join(dir, `${key}.json`), recordsDir: path.join(dir, `${key}.d`), dir };
}

function readRelocationRecords(root, historical_path, label) {
  const { file, recordsDir } = relocationFiles(root, historical_path);
  const records = [];
  let primaryExists = false;
  try {
    const stat = fs.lstatSync(file);
    primaryExists = true;
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`relocation manifest is insecure: ${historical_path}`);
    records.push(...relocationRecords(JSON.parse(fs.readFileSync(file, "utf8")), historical_path, label));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  let names = [];
  try {
    const stat = fs.lstatSync(recordsDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`relocation manifest is insecure: ${historical_path}`);
    names = fs.readdirSync(recordsDir).filter((name) => name.endsWith(".json")).sort();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const extra = [];
  for (const name of names) {
    const child = path.join(recordsDir, name);
    const stat = fs.lstatSync(child);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`relocation manifest is insecure: ${historical_path}`);
    const row = JSON.parse(fs.readFileSync(child, "utf8"));
    if (!row || row.historical_path !== historical_path || row.sha256 !== name.slice(0, -5) || !SHA_RE.test(String(row.sha256))) {
      relocationFailure(label, historical_path);
    }
    if (!records.some((existing) => existing.sha256 === row.sha256)) extra.push(row);
  }
  extra.sort((left, right) => String(left.relocated_at).localeCompare(String(right.relocated_at)));
  records.push(...extra);
  return { records, file, primaryExists };
}

export function putRelocation(entry, { start = process.cwd(), env = process.env } = {}) {
  const historical_path = normalizeHistoricalPath(entry.historical_path);
  const sha256 = String(entry.sha256 || "");
  if (!historical_path) throw new Error("relocation requires historical_path");
  if (!SHA_RE.test(sha256)) throw new Error("relocation requires object sha256");
  const root = secureDir(reviewEvidenceStoreRoot(start, env), { create: true });
  secureDir(path.join(root, "relocations"), { create: true });
  const { file, recordsDir } = relocationFiles(root, historical_path);
  const record = {
    schema_version: 1,
    historical_path,
    sha256,
    repo_root: entry.repo_root || (env.SVC_REVIEW_EVIDENCE_STORE ? path.resolve(start) : repositoryIdentity(start).repoRoot),
    candidate_digest: entry.candidate_digest || null,
    kind: entry.kind || null,
    relocated_at: entry.relocated_at || new Date().toISOString(),
  };
  const existing = readRelocationRecords(root, historical_path, "conflicting relocation").records;
  const match = existing.find((row) => row.sha256 === sha256);
  if (match) return { ...match, historical_path, created: false, path: file };
  if (existing.length === 0 && createJsonOnce(file, record)) return { ...record, created: true, path: file };
  fs.mkdirSync(recordsDir, { recursive: true, mode: 0o700 });
  const created = createJsonOnce(path.join(recordsDir, `${sha256}.json`), record);
  return { ...record, created, path: file };
}

export function lookupRelocation(historicalPath, { start = process.cwd(), env = process.env, sha256 = null } = {}) {
  const historical_path = normalizeHistoricalPath(historicalPath);
  if (!historical_path) return null;
  const root = reviewEvidenceStoreRoot(start, env);
  const { records, file } = readRelocationRecords(root, historical_path, "forged or malformed relocation");
  if (records.length === 0) return null;
  const wanted = typeof sha256 === "string" ? sha256 : null;
  if (wanted) {
    const match = records.find((row) => row.sha256 === wanted);
    if (match) return { ...match, path: file };
    return { ...records[0], path: file, conflict: true };
  }
  if (records.length === 1) return { ...records[0], path: file };
  return { ...records[records.length - 1], path: file, history: records };
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
    const relocated = lookupRelocation(candidate, { start, env, sha256: declared });
    if (relocated) {
      if (relocated.conflict || relocated.sha256 !== declared) throw new Error(`relocation digest mismatch: ${candidate}`);
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
