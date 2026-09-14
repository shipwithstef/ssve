#!/usr/bin/env node
// svc-migrate-task-state.mjs — WI-486 task-4 (SIB-30..35) + EXEC-006/007.
//
// The ONLY on-disk task-state rewrite path. Migration is a separately-named,
// explicitly-authorized command — never an implicit side-effect of inspection.
// Guarantees:
//   SIB-30 / EXEC-006  refuses without --wi AND a STRUCTURED, attributable
//           authorization (JSON naming repository + exact wi + principal +
//           issuance/expiry + nonce); a bare non-empty file no longer authorizes.
//   SIB-31 / EXEC-007  rejects a graph owned by a FRESH FOREIGN session — both
//           claims AND bindings are reinspected FRESH under the migration lock.
//   SIB-32  immutable byte-for-byte backup + recorded path/digest BEFORE any write
//   SIB-33  schema-valid terminal receipt (authorization+principal+nonce, versions,
//           before/after digests, changed paths, backups, terminal result)
//   SIB-34 / EXEC-007  every post-backup failure atomically restores the original
//           and emits a terminal failure receipt; never reports "upgraded".
//   SIB-35  idempotent: an already-current graph emits terminal already-migrated
//   restore / EXEC-007  --restore reverts ONLY from a receipt-indexed, WI-matching,
//           digest-verified backup, and backs up the CURRENT bytes first.
//   EXEC-007  the whole {reinspect ownership → digest → backup → transform → write
//           → verify → receipt} runs under ONE per-graph migration lock.
//
// Hermetic: local fs + local Git + node only, zero network/model calls.

import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
// JSON state writes (receipt + migrated task-graph) go through the canonical
// atomic writer; the byte-EXACT immutable backup/restore stay raw fs copies by
// design (a re-serialization would not be byte-for-byte — SIB-32).
import { writeJsonAtomic } from "./state-io.mjs";
import { normalizeClaimOwner, isClaimStale, readClaimAbsolute, withExclusiveLock } from "../hooks/lib/wi-claim.mjs";
import { WI_ID_RE } from "../hooks/lib/wi-id.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function has(name) { return process.argv.includes(name); }
function die(msg, code = 2) { process.stderr.write(`svc-migrate-task-state: ${msg}\n`); process.exit(code); }
function sha256(buf) { return createHash("sha256").update(buf).digest("hex"); }
function nowIso() { return new Date().toISOString(); }

function runtimeDir() {
  return process.env.SVC_TASK_STATE_RUNTIME_DIR ||
    path.join(ROOT, ".svc", "task-state-migrations");
}

function writeReceipt(receipt) {
  const dir = path.join(runtimeDir(), receipt.wi);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = receipt.timestamp.replace(/[:.]/g, "-");
  const p = path.join(dir, `${receipt.terminal_result}-${stamp}.json`);
  writeJsonAtomic(p, receipt);
  process.stdout.write(JSON.stringify({ ...receipt, receipt_path: p }) + "\n");
  return p;
}

function baseReceipt(wi, authorization) {
  return {
    receipt_type: "task-state-migration",
    schema_version: 1,
    wi,
    authorization,
    source_version: 0,
    target_version: 1,
    changed_paths: [],
    backups: [],
    before_digests: {},
    after_digests: {},
    terminal_result: "failed",
    timestamp: nowIso(),
  };
}

// EXEC-006: verify a STRUCTURED owner authorization. It must be JSON naming the
// exact repository, the exact --wi, an authority principal, issuance + expiry, and
// a nonce; anything else (a README, an unrelated file, a wrong/expired grant) is
// refused BEFORE the migration lock is taken.
function verifyAuthorization(authBytes, wi, repoRoot) {
  let doc;
  try { doc = JSON.parse(authBytes.toString("utf8")); }
  catch { return { ok: false, reason: "authorization is not valid JSON (EXEC-006: a structured authorization is required)" }; }
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return { ok: false, reason: "authorization must be a JSON object" };
  if (String(doc.wi || "") !== wi) return { ok: false, reason: `authorization names WI ${doc.wi || "?"}, not ${wi}` };
  let repoOk = false;
  try { repoOk = Boolean(doc.repository) && fs.realpathSync(String(doc.repository)) === fs.realpathSync(repoRoot); } catch { repoOk = false; }
  if (!repoOk) return { ok: false, reason: `authorization repository does not match this repository (${repoRoot})` };
  const principal = String(doc.principal || "").trim();
  if (!principal) return { ok: false, reason: "authorization is missing an authority principal" };
  const nonce = String(doc.nonce || "").trim();
  if (!nonce) return { ok: false, reason: "authorization is missing a nonce" };
  const issued = Date.parse(doc.issued_at || "");
  const expires = Date.parse(doc.expires_at || "");
  if (!Number.isFinite(issued)) return { ok: false, reason: "authorization issued_at is not a valid timestamp" };
  if (!Number.isFinite(expires)) return { ok: false, reason: "authorization expires_at is not a valid timestamp" };
  const now = Date.now();
  if (expires <= now) return { ok: false, reason: "authorization is expired" };
  if (issued > now + 60_000) return { ok: false, reason: "authorization issued in the future" };
  return { ok: true, principal, nonce, issued_at: String(doc.issued_at), expires_at: String(doc.expires_at), repository: String(doc.repository) };
}

// EXEC-007: FRESH ownership reinspection of BOTH claims AND bindings via the
// shared owner normalizer. A fresh (non-stale, non-released) foreign claim OR a
// live (non-released) foreign binding for this WI blocks migration/restore.
function foreignFreshOwner(wi, sessionId) {
  const claimPath = path.join(ROOT, ".svc", "claims", `${wi}.claim.json`);
  const claim = readClaimAbsolute(claimPath);
  if (claim && !claim.released_at && !isClaimStale(claim)) {
    const owner = normalizeClaimOwner(claim);
    if (owner.attributable && owner.session_id !== sessionId) return { owner: owner.session_id, via: "claim" };
  }
  const bindingsDir = path.join(ROOT, ".svc", "bindings");
  let files = [];
  try { files = fs.readdirSync(bindingsDir).filter((f) => f.endsWith(".json")); } catch { files = []; }
  for (const f of files) {
    const b = readClaimAbsolute(path.join(bindingsDir, f));
    if (!b || b.released_at || b.wi !== wi) continue;
    const owner = normalizeClaimOwner(b);
    if (owner.attributable && owner.session_id !== sessionId) return { owner: owner.session_id, via: "binding" };
  }
  return null;
}

function graphPath(wi) { return path.join(ROOT, ".svc", `lane-tasks-${wi}.json`); }

async function loadCompat() {
  const mod = await import(pathToFileURL(path.join(ROOT, "hooks", "lib", "task-state-compatibility.mjs")).href);
  return mod;
}

// Runs fn under an exclusive per-graph lock. fn MUST return an exit code (it must
// not call process.exit, or the finally that releases the lock would be skipped).
function withMigrationLock(gp, fn) {
  const result = withExclusiveLock(`task-state-migration:${path.resolve(gp)}`, fn, path.dirname(gp));
  if (result?.lock_busy) die(`migration already in progress for ${gp} (${result.warning})`, 4);
  if (result?.lock_error) die(`migration cannot acquire its repository authority lock for ${gp} (${result.warning})`, 4);
  return result;
}

// EXEC-007: the restore backup MUST be referenced by a prior migration receipt for
// THIS wi with a byte-digest match. Arbitrary supplied bytes are never restored.
function backupIsReceiptIndexed(wi, backupAbs, digest) {
  const dir = path.join(runtimeDir(), wi);
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return false; }
  for (const f of files) {
    let rec;
    try { rec = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    if (!rec || rec.wi !== wi || !Array.isArray(rec.backups)) continue;
    for (const b of rec.backups) {
      let bp = "";
      try { bp = fs.realpathSync(String(b.backup_path || "")); } catch { bp = path.resolve(String(b.backup_path || "")); }
      if (bp === backupAbs && String(b.digest) === digest) return true;
    }
  }
  return false;
}

function fsyncFile(p) {
  try { const fd = fs.openSync(p, "r"); fs.fsyncSync(fd); fs.closeSync(fd); } catch {}
}

// EXEC-R2-006: byte-preserving ATOMIC writer — same-directory temp, fsync, rename,
// directory fsync. Unlike an in-place `writeFileSync` (which truncates the target
// and is corruptible on interruption), a crash mid-write leaves the ORIGINAL file
// intact; readers only ever observe the old or the new bytes, never a torn write.
// Used for restore + rollback so the on-disk graph is never left half-written.
function atomicWriteBytes(file, buf) {
  const abs = path.resolve(file);
  const dir = path.dirname(abs);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(abs)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`);
  const fd = fs.openSync(tmp, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600);
  try { fs.writeFileSync(fd, buf); fs.fsyncSync(fd); }
  finally { fs.closeSync(fd); }
  fs.renameSync(tmp, abs);
  try { const dfd = fs.openSync(dir, "r"); fs.fsyncSync(dfd); fs.closeSync(dfd); } catch {}
}

// EXEC-R2-006: create an immutable, content-addressed backup WITHOUT ever unlinking
// an existing one. The filename embeds the FULL content digest, so a byte-identical
// backup already on disk (referenced by an older receipt) is REUSED, never
// clobbered; a same-name file with DIFFERENT content is refused. The prior code
// `fs.rmSync(backupPath)` before an O_EXCL create made a receipt-referenced backup
// destructible if the process died between unlink and recreate.
function ensureImmutableBackup(backupPath, bytes, expectedDigest) {
  try {
    const fd = fs.openSync(backupPath, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o400);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); }
    finally { fs.closeSync(fd); }
    fsyncFile(backupPath);
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
    const existing = fs.readFileSync(backupPath);
    if (sha256(existing) !== expectedDigest) {
      throw new Error(`existing backup content mismatch (not immutable-identical): ${backupPath}`);
    }
    // Identical immutable backup already present — reuse it, never clobber.
  }
}

// EXEC-R2-006: atomically restore ORIGINAL bytes and VERIFY the on-disk digest. On
// verified success the receipt reports terminal "failed" with the original
// preserved; if the rollback write fails OR the re-read bytes do not match the
// recorded original digest, the receipt reports a DISTINCT terminal "corrupt"
// carrying the ACTUAL on-disk digest — never a false "original preserved".
function rollbackToOriginal(r, gp, originalBytes, originalDigest, reason) {
  // No prior original (empty digest) => the correct rollback is to remove the file,
  // returning the graph to its pre-operation ABSENT state.
  if (!originalDigest) {
    try { fs.rmSync(gp, { force: true }); } catch {}
    if (fs.existsSync(gp)) {
      let actual = "";
      try { actual = sha256(fs.readFileSync(gp)); } catch {}
      r.terminal_result = "corrupt";
      r.failure_reason = `${reason}; ROLLBACK FAILED — could not remove partially-written graph`;
      r.after_digests[gp] = actual;
      return "corrupt";
    }
    r.terminal_result = "failed";
    r.failure_reason = `${reason}; no prior graph existed — partial write removed`;
    r.after_digests[gp] = "";
    return "failed";
  }
  try {
    atomicWriteBytes(gp, originalBytes);
    fsyncFile(gp);
  } catch (e) {
    let actual = "";
    try { actual = sha256(fs.readFileSync(gp)); } catch {}
    r.terminal_result = "corrupt";
    r.failure_reason = `${reason}; ROLLBACK FAILED — on-disk graph may be corrupt: ${e.message}`;
    r.after_digests[gp] = actual;
    return "corrupt";
  }
  let actual = "";
  try { actual = sha256(fs.readFileSync(gp)); } catch {}
  if (actual !== originalDigest) {
    r.terminal_result = "corrupt";
    r.failure_reason = `${reason}; rollback verification failed — restored bytes do not match the original digest`;
    r.after_digests[gp] = actual;
    return "corrupt";
  }
  r.terminal_result = "failed";
  r.failure_reason = `${reason}; original restored and digest-verified`;
  r.after_digests[gp] = originalDigest;
  return "failed";
}

async function main() {
  const wi = arg("--wi");
  const authFile = arg("--authorization");
  const restore = arg("--restore");
  const dryRun = has("--dry-run");

  // SIB-30 / EXEC-006: refuse without WI and a structured, attributable authorization.
  if (!wi || !WI_ID_RE.test(wi)) die("missing or invalid --wi WI-<n>", 2);
  if (!authFile) die("migration requires an explicit --authorization <file> (SIB-30: no bare rewrite)", 2);
  let authBytes;
  try { authBytes = fs.readFileSync(authFile); }
  catch { die(`--authorization file not readable: ${authFile}`, 2); }
  if (!authBytes.length) die("--authorization file is empty; a structured attributable authorization is required", 2);
  const authorization = { source: path.resolve(authFile), digest: sha256(authBytes) };

  const verified = verifyAuthorization(authBytes, wi, ROOT);
  if (!verified.ok) {
    const r = baseReceipt(wi, authorization);
    r.terminal_result = "rejected";
    r.failure_reason = `authorization rejected: ${verified.reason} (EXEC-006)`;
    writeReceipt(r);
    process.exit(2);
  }
  authorization.principal = verified.principal;
  authorization.nonce = verified.nonce;
  authorization.issued_at = verified.issued_at;
  authorization.expires_at = verified.expires_at;
  authorization.repository = verified.repository;

  const sessionId = process.env.SVC_SESSION_ID || process.env.CLAUDE_SESSION_ID || "";
  const compat = await loadCompat();
  const gp = graphPath(wi);

  const code = withMigrationLock(gp, () =>
    restore ? runRestore({ wi, gp, authorization, sessionId, restore, dryRun })
            : runMigrate({ wi, gp, authorization, sessionId, compat, dryRun }));
  process.exit(code);
}

// ---- Restore (foreign-excluding, WI-scoped, receipt-indexed) -----------------
function runRestore({ wi, gp, authorization, sessionId, restore, dryRun }) {
  const r = baseReceipt(wi, authorization);
  const restoreAbs = (() => { try { return fs.realpathSync(restore); } catch { return path.resolve(restore); } })();

  let backupBytes;
  try { backupBytes = fs.readFileSync(restoreAbs); }
  catch { r.terminal_result = "failed"; r.failure_reason = `backup not readable: ${restore}`; writeReceipt(r); return 1; }
  const backupDigest = sha256(backupBytes);

  // Provenance: only a receipt-indexed, WI-matching, digest-verified backup.
  if (!backupIsReceiptIndexed(wi, restoreAbs, backupDigest)) {
    r.terminal_result = "rejected";
    r.failure_reason = `restore refused: ${restore} is not a receipt-indexed, WI-matching, digest-verified backup (EXEC-007)`;
    writeReceipt(r);
    return 3;
  }

  // Fresh ownership reinspection (claims AND bindings) under the lock.
  const foreign = foreignFreshOwner(wi, sessionId);
  if (foreign) {
    r.terminal_result = "rejected";
    r.failure_reason = `graph for ${wi} is owned by a fresh foreign session (${foreign.owner} via ${foreign.via}); restore refused (SIB-31)`;
    writeReceipt(r);
    return 3;
  }

  // Read the CURRENT bytes (the pre-restore original).
  let before = Buffer.alloc(0);
  try { before = fs.readFileSync(gp); } catch { /* may not exist */ }
  r.before_digests[gp] = before.length ? sha256(before) : "";

  // EXEC-R2-007: dry-run is SIDE-EFFECT-FREE and NON-TERMINAL. It writes NO backup
  // and NO graph bytes, records the ACTUAL (unchanged) after-digest, and emits a
  // distinct `restore-dry-run` result that cannot satisfy a completed-restore check.
  if (dryRun) {
    r.after_digests[gp] = r.before_digests[gp];
    r.changed_paths = [];
    r.restore_of = restoreAbs;
    r.terminal_result = "restore-dry-run";
    writeReceipt(r);
    return 0;
  }

  // Back up the CURRENT bytes FIRST (immutable, content-addressed, never clobbered)
  // so the restore is itself reversible.
  if (before.length) {
    const preDir = path.join(runtimeDir(), wi, "backups");
    fs.mkdirSync(preDir, { recursive: true, mode: 0o700 });
    const preBak = path.join(preDir, `lane-tasks-${wi}.pre-restore.${r.before_digests[gp]}.bak.json`);
    try {
      ensureImmutableBackup(preBak, before, r.before_digests[gp]);
    } catch (e) {
      r.terminal_result = "failed";
      r.failure_reason = `could not write immutable pre-restore backup: ${e.message}`;
      r.after_digests[gp] = r.before_digests[gp];
      writeReceipt(r);
      return 1;
    }
    r.backups.push({ original_path: gp, backup_path: preBak, digest: r.before_digests[gp] });
  }

  try {
    atomicWriteBytes(gp, backupBytes);
    fsyncFile(gp);
    // Re-read and digest-verify the restored bytes before claiming preservation.
    const restored = sha256(fs.readFileSync(gp));
    if (restored !== backupDigest) {
      throw new Error(`restored bytes digest ${restored} != backup digest ${backupDigest}`);
    }
    r.after_digests[gp] = backupDigest;
    r.changed_paths = [gp];
    r.restore_of = restoreAbs;
    r.terminal_result = "restored";
    writeReceipt(r);
    return 0;
  } catch (e) {
    const outcome = rollbackToOriginal(r, gp, before, r.before_digests[gp], `restore write failed: ${e.message}`);
    writeReceipt(r);
    return outcome === "corrupt" ? 4 : 1;
  }
}

// ---- Migrate (backup-first, transactional) -----------------------------------
function runMigrate({ wi, gp, authorization, sessionId, compat, dryRun }) {
  // EXEC-007: fresh ownership reinspection (claims AND bindings) under the lock,
  // immediately before reading/backing up the source.
  const foreign = foreignFreshOwner(wi, sessionId);
  if (foreign) {
    const r = baseReceipt(wi, authorization);
    r.terminal_result = "rejected";
    r.failure_reason = `graph for ${wi} is owned by a fresh foreign session (${foreign.owner} via ${foreign.via}); migration refused (SIB-31)`;
    writeReceipt(r);
    return 3;
  }

  let bytes;
  try { bytes = fs.readFileSync(gp); }
  catch {
    const r = baseReceipt(wi, authorization);
    r.terminal_result = "failed";
    r.failure_reason = `task-graph not found: ${gp}`;
    writeReceipt(r);
    return 1;
  }

  const cls = compat.classifyTaskState(bytes);
  const r = baseReceipt(wi, authorization);
  r.before_digests[gp] = sha256(bytes);

  // SIB-35: already-current → terminal, no rewrite.
  if (cls.classification === compat.SUPPORTED) {
    r.source_version = 1;
    r.after_digests[gp] = r.before_digests[gp];
    r.terminal_result = "already-migrated";
    writeReceipt(r);
    return 0;
  }

  // Only a legacy-lossless graph is eligible to rewrite; quarantine never
  // auto-migrates (SIB-34: never silently upgrade a lossy/malformed graph).
  if (cls.classification !== compat.LEGACY_LOSSLESS) {
    r.terminal_result = "failed";
    r.failure_reason = `graph classifies ${cls.classification} (${cls.reason}); only legacy-lossless is migratable — resolve manually`;
    r.after_digests[gp] = r.before_digests[gp];
    writeReceipt(r);
    return 1;
  }

  // EXEC-R2-007: dry-run is SIDE-EFFECT-FREE and NON-TERMINAL. It writes NO backup
  // and NO graph bytes, records the ACTUAL (unchanged) after-digest, and emits a
  // distinct `eligible-dry-run` result that cannot satisfy a completed-migration
  // check (the prior code emitted a terminal `already-migrated` AND wrote a backup
  // even though the graph remained legacy).
  if (dryRun) {
    r.after_digests[gp] = r.before_digests[gp];
    r.changed_paths = [];
    r.terminal_result = "eligible-dry-run";
    writeReceipt(r);
    return 0;
  }

  // SIB-32: immutable, content-addressed byte-for-byte backup BEFORE any mutation.
  // The backup is NEVER unlinked (EXEC-R2-006) — a byte-identical backup already on
  // disk is reused, never clobbered, so an older receipt's backup stays immutable.
  const backupDir = path.join(runtimeDir(), wi, "backups");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `lane-tasks-${wi}.${r.before_digests[gp]}.bak.json`);
  try {
    ensureImmutableBackup(backupPath, bytes, r.before_digests[gp]);
  } catch (e) {
    r.terminal_result = "failed";
    r.failure_reason = `could not write immutable backup: ${e.message}`;
    r.after_digests[gp] = r.before_digests[gp];
    writeReceipt(r);
    return 1;
  }
  const backupDigest = sha256(fs.readFileSync(backupPath));
  if (backupDigest !== r.before_digests[gp]) {
    r.terminal_result = "failed";
    r.failure_reason = "backup digest mismatch — refusing to migrate without a verified immutable backup (SIB-32)";
    r.after_digests[gp] = r.before_digests[gp];
    writeReceipt(r);
    return 1;
  }
  r.backups.push({ original_path: gp, backup_path: backupPath, digest: backupDigest });

  // EXEC-007 / EXEC-R2-006: EVERY post-backup failure (transform, write, verify)
  // ATOMICALLY restores the byte-exact original, RE-READS + digest-verifies it, and
  // emits a terminal failure receipt — or a DISTINCT `corrupt` receipt carrying the
  // actual on-disk digest if the rollback itself fails. The original is never left
  // upgraded, half-written, or falsely reported as preserved.
  try {
    const view = compat.normalizedView({ bytes });
    writeJsonAtomic(gp, view);
    const restaged = compat.classifyTaskState(fs.readFileSync(gp));
    if (restaged.classification !== compat.SUPPORTED) {
      throw new Error(`migrated bytes do not classify supported (${restaged.classification})`);
    }
    fsyncFile(gp);
    r.changed_paths = [gp];
    r.after_digests[gp] = sha256(fs.readFileSync(gp));
    r.terminal_result = "migrated";
    delete r.failure_reason;
    writeReceipt(r);
    return 0;
  } catch (e) {
    r.changed_paths = [];
    const outcome = rollbackToOriginal(r, gp, bytes, r.before_digests[gp], `migration failed after backup: ${e.message}`);
    writeReceipt(r);
    return outcome === "corrupt" ? 4 : 1;
  }
}

main().catch((e) => die(`unexpected: ${e.stack || e.message}`, 1));
