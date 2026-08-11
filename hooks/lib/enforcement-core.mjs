// enforcement-core.mjs — WI-487 canonical enforcement core.
//
// The ONE implementation of:
//   - resolveStateRoot()      : the single HOME-anchored expander of ~/.svc
//   - classifySource()        : durable-canonical | ephemeral | worktree-bound | dangling
//   - denialStateDigest()     : stable cross-process dedup key over ENFORCEMENT-relevant state
//   - receipt validation      : evidence-only; reject symlinked / wrong-owner / schema-invalid
//   - atomic denial write      : O_EXCL create inside a verified 0700 dir
//
// Setup/migration MATERIALIZE a byte/hash-verified COPY of this file under
// ~/.svc/enforcement/<MIGRATION_VERSION>/lib/enforcement-core.mjs, which the
// installed launcher imports (never the live checkout). In-repo consumers
// (durable-source.mjs, hook-denial.mjs) import THIS copy. One implementation,
// zero drift, no live-checkout dependency after install (F-016).
//
// Zero dependencies beyond Node core. Never throws from the classify/digest
// primitives (a thrown classifier would itself be a fail-open surface).

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The install-migration / launcher version segment. Bumping it installs a new
// enforcement bundle without disturbing a running one (D-10).
export const MIGRATION_VERSION = "1";

// Ephemeral filesystem prefixes: a source under any of these is NOT durable (D-1).
export const EPHEMERAL_PREFIXES = (() => {
  const out = [];
  const seen = new Set();
  const add = (p) => {
    if (!p) return;
    try {
      const r = path.resolve(p);
      if (!seen.has(r)) { seen.add(r); out.push(r); }
    } catch { /* ignore */ }
    try {
      const rp = fs.realpathSync(p);
      if (!seen.has(rp)) { seen.add(rp); out.push(rp); }
    } catch { /* ignore */ }
  };
  add("/tmp");
  add("/dev/shm");
  add("/var/tmp");
  add(process.env.TMPDIR);
  try { add(os.tmpdir()); } catch { /* ignore */ }
  return out;
})();

// ---------------------------------------------------------------------------
// resolveStateRoot() — the SINGLE expander of ~/.svc (D-11).
//
// HOME-anchored with EXPLICIT fail-closed behavior when HOME is unset/unreadable:
// it THROWS rather than falling back to a world-writable or CWD-relative path.
// Callers that must never crash (a launcher deny path) catch and treat the throw
// as a fail-closed condition — they never silently pick a foreign root.
// ---------------------------------------------------------------------------
export function resolveStateRoot(env = process.env) {
  const home = env && typeof env.HOME === "string" ? env.HOME.trim() : "";
  if (!home) {
    throw new Error("SVC-ENFORCE-NO-HOME: HOME is unset or empty; refusing to resolve a state root (fail-closed).");
  }
  let real;
  try {
    real = fs.realpathSync(home);
  } catch {
    // HOME points nowhere readable — fail-closed, do NOT invent a path.
    throw new Error(`SVC-ENFORCE-BAD-HOME: HOME '${home}' is not a readable directory (fail-closed).`);
  }
  return path.join(real, ".svc");
}

// ---------------------------------------------------------------------------
// classifySource(candidatePath) -> classification
//
// Pure predicate over a realpath. NEVER throws.
//   dangling       : realpath missing OR target not readable/executable
//   ephemeral      : realpath under an ephemeral prefix
//   worktree-bound : realpath contains a /.worktrees/ segment
//   durable-canonical : exists, readable/executable, none of the above
//
// `opts.requireExecutable` (default true): when the candidate is a FILE, require
// the owner-executable bit (an installed enforcement COMMAND must be runnable).
// A directory candidate is treated as durable when it is a readable dir.
// ---------------------------------------------------------------------------
export function classifySource(candidatePath, opts = {}) {
  const requireExecutable = opts.requireExecutable !== false;
  if (!candidatePath || typeof candidatePath !== "string") return "dangling";
  let real;
  try {
    real = fs.realpathSync(candidatePath);
  } catch {
    return "dangling";
  }
  let st;
  try {
    st = fs.statSync(real);
  } catch {
    return "dangling";
  }
  // Ephemeral prefix check (on the RESOLVED path — a symlink into /tmp is ephemeral).
  for (const prefix of EPHEMERAL_PREFIXES) {
    if (real === prefix || real.startsWith(prefix + path.sep)) return "ephemeral";
  }
  // Worktree segment check.
  const segments = real.split(path.sep);
  if (segments.includes(".worktrees")) return "worktree-bound";
  if (st.isDirectory()) {
    try { fs.accessSync(real, fs.constants.R_OK); } catch { return "dangling"; }
    return "durable-canonical";
  }
  if (st.isFile()) {
    try {
      fs.accessSync(real, requireExecutable ? fs.constants.R_OK | fs.constants.X_OK : fs.constants.R_OK);
    } catch {
      return "dangling";
    }
    return "durable-canonical";
  }
  return "dangling";
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// launcherRunnable(p) — the durability predicate for the MATERIALIZED launcher
// (and its materialized core). Unlike classifySource, this does NOT apply the
// ephemeral-prefix rule: the launcher legitimately lives under ~/.svc (which is
// HOME-anchored, not a source checkout). It must be a COPIED real executable
// file — never a symlink into the checkout — and readable+executable.
// ---------------------------------------------------------------------------
export function launcherRunnable(p, opts = {}) {
  if (!p || typeof p !== "string") return false;
  let lst;
  try { lst = fs.lstatSync(p); } catch { return false; }
  if (lst.isSymbolicLink()) return false; // must be a copied real file
  // F-015: an installed enforcement launcher writable by group/other, or owned by
  // another user, is forgeable — reject it unconditionally (not only with a
  // boundary). A hostile party who can rewrite the executed launcher controls
  // enforcement, so this must fail closed even when no ancestry boundary is given.
  if ((lst.mode & 0o022) !== 0) return false;
  if (typeof process.getuid === "function" && lst.uid !== process.getuid()) return false;
  // F-015: when a trusted (already-realpath'd) boundary is supplied, require secure
  // no-follow ancestry from the launcher up to the boundary, so a symlinked or
  // foreign-owned ancestor cannot redirect which file actually executes.
  if (opts.boundary) {
    try { assertSecureAncestry(path.dirname(path.resolve(p)), opts.boundary); }
    catch { return false; }
  }
  let real, st;
  try { real = fs.realpathSync(p); st = fs.statSync(real); } catch { return false; }
  if (!st.isFile()) return false;
  try { fs.accessSync(real, fs.constants.R_OK | fs.constants.X_OK); } catch { return false; }
  return true;
}

// ---------------------------------------------------------------------------
// assertStateRootSecure(stateRoot) — validate the STATE ROOT itself (F-015).
// The whole durable bundle, receipts, markers, ledger and backups are written
// UNDER ~/.svc; if that root is a symlink, foreign-owned, or group/other-writable,
// a hostile party controls enforcement. When the root does not yet exist this is
// a no-op (setup creates it securely via ensureSecureDir). NEVER silently accepts
// an insecure root — it THROWS so callers fail closed.
// ---------------------------------------------------------------------------
export function assertStateRootSecure(stateRoot) {
  let lst;
  try { lst = fs.lstatSync(stateRoot); } catch { return true; } // absent — created secure on first write
  if (lst.isSymbolicLink()) throw new Error(`SVC-ENFORCE-INSECURE-STATE-ROOT: ${stateRoot} is a symlink; refusing (fail-closed).`);
  if (!lst.isDirectory()) throw new Error(`SVC-ENFORCE-INSECURE-STATE-ROOT: ${stateRoot} is not a directory; refusing (fail-closed).`);
  if (typeof process.getuid === "function" && lst.uid !== process.getuid()) throw new Error(`SVC-ENFORCE-FOREIGN-STATE-ROOT: ${stateRoot} is owned by another user; refusing (fail-closed).`);
  if ((lst.mode & 0o022) !== 0) throw new Error(`SVC-ENFORCE-WRITABLE-STATE-ROOT: ${stateRoot} is group/other-writable; refusing (fail-closed).`);
  return true;
}

// canonicalJson(value) — deterministic, sorted-key, whitespace-free JSON.
// Used so a digest is byte-identical across processes and Node versions.
// ---------------------------------------------------------------------------
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

// The exact enforcement-relevant field set (F-010). Timestamps / output / pids
// are EXCLUDED so the digest is stable cross-process.
const DIGEST_FIELDS = [
  "resolved_command_path",
  "target_exists",
  "target_executable",
  "effective_source",
  "source_or_receipt_class",
  "hook_id",
  "reason_code",
];

// ---------------------------------------------------------------------------
// denialStateDigest(state) — SHA-256 over canonical JSON of ONLY the enforcement
// -relevant fields (F-010). The dedup key. NEVER throws.
// ---------------------------------------------------------------------------
export function denialStateDigest(state = {}) {
  const projected = {};
  for (const f of DIGEST_FIELDS) {
    projected[f] = Object.prototype.hasOwnProperty.call(state, f) ? state[f] : null;
  }
  return crypto.createHash("sha256").update(canonicalJson(projected), "utf8").digest("hex");
}

// sessionHash(sessionId) — stable short hash for the per-session receipt subdir.
export function sessionHash(sessionId) {
  return crypto.createHash("sha256").update(String(sessionId || "no-session"), "utf8").digest("hex").slice(0, 24);
}

// ---------------------------------------------------------------------------
// assertSecureAncestry(dir, boundary) — walk EVERY path component from `dir` up
// to (and including) `boundary` with NO-FOLLOW (lstat) semantics and REJECT any
// component that is a symbolic link or is owned by another user (F-007). This
// closes the symlink-redirection seam: a `.svc` (or any intermediate) ancestor
// re-pointed at an attacker-controlled tree is refused before any write/read.
// `boundary` MUST be an already-realpath'd trusted root (the state root). When
// boundary is null the walk is skipped (leaf-only, legacy callers).
// ---------------------------------------------------------------------------
export function assertSecureAncestry(dir, boundary) {
  if (!boundary) return true;
  const bound = path.resolve(boundary);
  const target = path.resolve(dir);
  // The boundary itself and every component between it and the target that
  // EXISTS must be a real (non-symlink) directory owned by us.
  const chain = [];
  let cur = target;
  while (true) {
    chain.push(cur);
    if (cur === bound) break;
    const parent = path.dirname(cur);
    if (parent === cur) {
      // Reached the filesystem root without crossing the boundary — the target
      // is NOT under the trusted boundary. Fail closed.
      throw new Error(`SVC-ENFORCE-OUTSIDE-BOUNDARY: ${target} is not under the trusted state root ${bound}; refusing (fail-closed).`);
    }
    cur = parent;
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : null;
  for (const comp of chain) {
    let lst;
    try { lst = fs.lstatSync(comp); } catch { continue; /* not yet created — mkdir handles it */ }
    if (lst.isSymbolicLink()) {
      throw new Error(`SVC-ENFORCE-INSECURE-ANCESTOR: ${comp} is a symlink; refusing (fail-closed).`);
    }
    if (!lst.isDirectory()) {
      throw new Error(`SVC-ENFORCE-INSECURE-ANCESTOR: ${comp} is not a directory; refusing (fail-closed).`);
    }
    if (uid !== null && lst.uid !== uid) {
      throw new Error(`SVC-ENFORCE-FOREIGN-ANCESTOR: ${comp} is owned by another user; refusing (fail-closed).`);
    }
    // R3-F002: a group/other-writable ancestor is forgeable — a hostile party who
    // can write to any component between the trusted boundary and the leaf can swap
    // the leaf (launcher, core, receipt) it eventually resolves to. Reject it here
    // too, so the boundary walk — not only the leaf-mode checks — closes the
    // writable-descendant seam.
    if ((lst.mode & 0o022) !== 0) {
      throw new Error(`SVC-ENFORCE-WRITABLE-ANCESTOR: ${comp} is group/other-writable; refusing (fail-closed).`);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// ensureSecureDir(dir, opts) — mkdir -p with 0700, and REFUSE a symlinked or
// foreign-owned directory (a receipt tree an attacker could pre-seed as a
// symlink is rejected). When `opts.boundary` is supplied, EVERY ancestor from
// the boundary down is walked no-follow first (F-007). Returns true when the dir
// is a verified 0700 owner-only real directory; throws otherwise.
// ---------------------------------------------------------------------------
export function ensureSecureDir(dir, opts = {}) {
  const boundary = opts.boundary || null;
  // Walk the ancestry of the eventual leaf BEFORE creating it, so a symlinked
  // ancestor is rejected rather than followed by mkdir.
  if (boundary) assertSecureAncestry(path.dirname(path.resolve(dir)), boundary);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (boundary) assertSecureAncestry(dir, boundary);
  const lst = fs.lstatSync(dir);
  if (lst.isSymbolicLink()) {
    throw new Error(`SVC-ENFORCE-INSECURE-DIR: ${dir} is a symlink; refusing (fail-closed).`);
  }
  if (!lst.isDirectory()) {
    throw new Error(`SVC-ENFORCE-INSECURE-DIR: ${dir} is not a directory; refusing (fail-closed).`);
  }
  if (typeof process.getuid === "function" && lst.uid !== process.getuid()) {
    throw new Error(`SVC-ENFORCE-FOREIGN-DIR: ${dir} is owned by another user; refusing (fail-closed).`);
  }
  try { fs.chmodSync(dir, 0o700); } catch { /* best-effort */ }
  return true;
}

// ---------------------------------------------------------------------------
// atomicWriteFileExclusive(file, contents, mode) — write to a temp file, fsync,
// then rename over the target. When `exclusive` is true, an EEXIST on the FINAL
// target is surfaced (used for the dedup marker: first write wins, repeat is a
// deduped no-op). Returns { written: boolean }.
// ---------------------------------------------------------------------------
export function atomicWriteFileExclusive(file, contents, { mode = 0o600, exclusive = false, boundary = null } = {}) {
  const dir = path.dirname(file);
  ensureSecureDir(dir, { boundary });
  if (exclusive) {
    // Fast path: if the final target already exists, this is a deduped repeat.
    try {
      const lst = fs.lstatSync(file);
      if (lst.isSymbolicLink()) {
        throw new Error(`SVC-ENFORCE-INSECURE-RECEIPT: ${file} is a symlink; refusing (fail-closed).`);
      }
      return { written: false };
    } catch (e) {
      if (e && e.code !== "ENOENT") throw e;
    }
  }
  const tmp = path.join(dir, `.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`);
  const fd = fs.openSync(tmp, "wx", mode);
  try {
    fs.writeSync(fd, contents);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try { fs.chmodSync(tmp, mode); } catch { /* best-effort */ }
  if (exclusive) {
    // Link-then-unlink gives us an atomic exclusive create even across the rename.
    try {
      fs.linkSync(tmp, file);
    } catch (e) {
      fs.unlinkSync(tmp);
      if (e && e.code === "EEXIST") return { written: false };
      throw e;
    }
    fs.unlinkSync(tmp);
    return { written: true };
  }
  fs.renameSync(tmp, file);
  return { written: true };
}

// ---------------------------------------------------------------------------
// validateReceiptFile(file, opts) — read a home-local receipt as EVIDENCE ONLY.
// Rejects a symlinked, foreign-owned, or group/other-writable file, any non-JSON,
// a schema violation (required fields + field types), and any identity mismatch
// (F-007). Returns the parsed object or null. Callers ALWAYS re-realpath +
// reclassify the live hook/source before accepting a converged state — a receipt
// is never authority.
//
// opts:
//   requiredFields : string[]                        — every field must be present
//   fieldTypes     : { field: "string"|"integer"|"boolean"|"object" } — type gate
//   identity       : { field: expectedValue }        — exact-match install identity bind
//   boundary       : trusted realpath'd root         — no-follow ancestry walk
//   allowGroupOther: boolean (default false)         — reject g/o-writable when false
// ---------------------------------------------------------------------------
export function validateReceiptFile(file, opts = {}) {
  // No-follow ancestry: a symlinked ancestor redirecting the receipt path is rejected.
  if (opts.boundary) {
    try { assertSecureAncestry(path.dirname(path.resolve(file)), opts.boundary); }
    catch { return null; }
  }
  let lst;
  try {
    lst = fs.lstatSync(file);
  } catch {
    return null;
  }
  if (lst.isSymbolicLink()) return null;
  if (!lst.isFile()) return null;
  if (typeof process.getuid === "function" && lst.uid !== process.getuid()) return null;
  // A receipt writable by group/other is forgeable — reject it (unless opted out).
  if (opts.allowGroupOther !== true && (lst.mode & 0o022) !== 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (Array.isArray(opts.requiredFields)) {
    for (const f of opts.requiredFields) {
      if (!Object.prototype.hasOwnProperty.call(parsed, f)) return null;
    }
  }
  if (opts.fieldTypes && typeof opts.fieldTypes === "object") {
    for (const [f, t] of Object.entries(opts.fieldTypes)) {
      if (!Object.prototype.hasOwnProperty.call(parsed, f)) return null;
      const v = parsed[f];
      if (t === "string" && typeof v !== "string") return null;
      if (t === "integer" && !(typeof v === "number" && Number.isInteger(v))) return null;
      if (t === "boolean" && typeof v !== "boolean") return null;
      if (t === "object" && (v === null || typeof v !== "object")) return null;
    }
  }
  if (opts.identity && typeof opts.identity === "object") {
    for (const [f, expected] of Object.entries(opts.identity)) {
      if (parsed[f] !== expected) return null;
    }
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// The required-field + type contracts for the two evidence receipts. Single-
// sourced so the migration CLI, healthcheck, and drift check validate identically.
// ---------------------------------------------------------------------------
// F-012: the COMPLETE required-field set including the coverage booleans
// (hooks_installed / skills_installed) and the before/after evidence, so a
// convergence/health/drift predicate can never accept a partial receipt.
export const INSTALL_RECEIPT_REQUIRED = [
  "schema_version", "migration_version", "host", "skills_path",
  "effective_source", "source_classification", "launcher_path",
  "launcher_version", "installed_at", "hooks_installed", "skills_installed",
  "host_config_path", "after",
];
export const INSTALL_RECEIPT_TYPES = {
  schema_version: "integer",
  migration_version: "string",
  host: "string",
  skills_path: "string",
  effective_source: "string",
  source_classification: "string",
  launcher_path: "string",
  launcher_version: "string",
  installed_at: "string",
  hooks_installed: "boolean",
  skills_installed: "boolean",
};

// validateInstallReceipt(file, { host, stateRoot }) — schema + identity-bound
// read of a per-host install receipt. Binds migration_version to the running
// MIGRATION_VERSION and (when supplied) host to the expected host, so a receipt
// forged for a different version/host cannot be accepted as convergence (F-007).
export function validateInstallReceipt(file, { host = null, stateRoot = null } = {}) {
  const identity = { migration_version: MIGRATION_VERSION };
  if (host) identity.host = host;
  return validateReceiptFile(file, {
    requiredFields: INSTALL_RECEIPT_REQUIRED,
    fieldTypes: INSTALL_RECEIPT_TYPES,
    identity,
    boundary: stateRoot || null,
  });
}

// ---------------------------------------------------------------------------
// writeDenialReceipt(state, opts) — durable per-session denial receipt for
// stderr-swallowing hosts (AC-487-7A). Path:
//   <stateRoot>/denial-receipts/<sessionHash>/<denialStateDigest>.json
// The receipt file doubles as the dedup marker: an exclusive create returns
// { deduped:true } on a repeat with the SAME digest (AC-487-8). It NEVER
// downgrades the deny — only OUTPUT is suppressed by the caller.
// Returns { receipt_path, digest, deduped, session_hash }.
// ---------------------------------------------------------------------------
export function writeDenialReceipt(state, opts = {}) {
  const env = opts.env || process.env;
  const stateRoot = opts.stateRoot || resolveStateRoot(env);
  const digest = denialStateDigest(state);
  const sh = sessionHash(state.session_id || opts.sessionId);
  const dir = path.join(stateRoot, "denial-receipts", sh);
  const file = path.join(dir, `${digest}.json`);
  const body = {
    schema_version: 1,
    hook_id: state.hook_id || null,
    reason_code: state.reason_code || null,
    cause: state.cause || null,
    operation: state.operation || null,
    recovery: state.recovery || null,
    session_id: state.session_id || opts.sessionId || null,
    denial_state_digest: digest,
    resolved_command_path: state.resolved_command_path || null,
    effective_source: state.effective_source || null,
    source_or_receipt_class: state.source_or_receipt_class || null,
    target_exists: state.target_exists === true,
    target_executable: state.target_executable === true,
    first_seen_at: new Date().toISOString(),
  };
  let deduped = false;
  let written = false;
  try {
    const res = atomicWriteFileExclusive(file, JSON.stringify(body, null, 2) + "\n", { mode: 0o600, exclusive: true, boundary: stateRoot });
    written = res.written;
    deduped = !res.written;
  } catch {
    // A receipt-write failure must NOT convert the deny into an allow. Report as
    // not-deduped (so the caller still emits its actionable message) with no path.
    return { receipt_path: null, digest, deduped: false, session_hash: sh, written: false };
  }
  return { receipt_path: file, digest, deduped, session_hash: sh, written };
}

export default {
  MIGRATION_VERSION,
  EPHEMERAL_PREFIXES,
  resolveStateRoot,
  classifySource,
  launcherRunnable,
  canonicalJson,
  denialStateDigest,
  sessionHash,
  assertSecureAncestry,
  assertStateRootSecure,
  ensureSecureDir,
  atomicWriteFileExclusive,
  validateReceiptFile,
  validateInstallReceipt,
  INSTALL_RECEIPT_REQUIRED,
  INSTALL_RECEIPT_TYPES,
  writeDenialReceipt,
};
