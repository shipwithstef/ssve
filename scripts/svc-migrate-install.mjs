#!/usr/bin/env node
// svc-migrate-install.mjs — WI-487 versioned all-host first-run install migration.
//
// Dynamic-inventory (globs provision/hosts/*.json — no hard-coded host list),
// transactional (per-host backup + reverse rollback), resumable (per-host marker),
// bounded (pinned N=3 attempts per {migration_version, host_id, pre_state_digest}
// -> fail-closed terminal record), idempotent (converged host = byte no-op), and
// exposes a versioned --rollback that restores from per-host backups.
//
// BOUNDARY (AC-487-11 / D-7): legacy WI-state transformation is DELEGATED to
// WI-486's contract. This CLI imports hooks/lib/task-state-compatibility.mjs to
// CLASSIFY graphs and, only for migratable state, shells
// scripts/svc-migrate-task-state.mjs. It performs NO task-graph write of its own —
// a hard grep invariant asserts no lane-tasks graph write exists here.
//
// Subcommands:
//   migrate      (default)  --all-hosts | --host <h>   full transactional migration
//   materialize             --host <h>                 launcher + install receipt only (setup)
//   --rollback              --all-hosts | --host <h>    reverse the external migration
//   --resume                                            resume interrupted hosts
//
// Options: --repo-root <dir> --skills-path <dir> --json --fail-point <stage> --force

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  MIGRATION_VERSION,
  resolveStateRoot,
  assertStateRootSecure,
  classifySource,
  launcherRunnable,
  ensureSecureDir,
  atomicWriteFileExclusive,
  validateReceiptFile,
  validateInstallReceipt,
} from "../hooks/lib/enforcement-core.mjs";

const SELF_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SELF_DIR, "..");
const MAX_ATTEMPTS = 3; // pinned N=3 ceiling (D-8)

// The launcher registry materialized into the sibling manifest. Includes the three
// governed guards (Claude/Gemini Stop, Codex PreToolUse, Kimi Stop) so every
// launcher-routed governed host resolves its hook id at run time (F-010). Codex
// installs one serialized dispatcher, so that effective composite boundary is a
// first-class launcher target rather than a direct checkout command.
const MATERIALIZE_REGISTRY = {
  "svc-task-completion-guard": { relpath: "hooks/svc-task-completion-guard.sh", runner: "bash", event: "Stop" },
  "svc-codex-skill-load-enforcer": { relpath: "hooks/codex/svc-codex-skill-load-enforcer.mjs", runner: "node", event: "PreToolUse" },
  "svc-codex-pretool-dispatcher": { relpath: "hooks/codex/svc-codex-pretool-dispatcher.mjs", runner: "node", event: "PreToolUse" },
  "svc-kimi-task-completion-guard": { relpath: "hooks/kimi/svc-kimi-task-completion-guard.sh", runner: "bash", event: "Stop" },
};

// F-013: a TERMINAL-class failure (unsupported host / unavailable-or-quarantine
// compatibility contract / missing-authorization) is fail-closed on the FIRST
// occurrence — it is NOT a transient failure and is NEVER auto-retried. It is
// thrown distinctly so the catch can persist terminal:true immediately instead
// of consuming the N=3 transient budget.
class TerminalMigrationError extends Error {
  constructor(message, cause) { super(message); this.name = "TerminalMigrationError"; this.terminalCause = cause || message; }
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--all-hosts") out.allHosts = true;
    else if (a === "--host") out.host = argv[++i];
    else if (a === "--repo-root") out.repoRoot = argv[++i];
    else if (a === "--skills-path") out.skillsPath = argv[++i];
    else if (a === "--rollback") out.rollback = true;
    else if (a === "--resume") out.resume = true;
    else if (a === "--json") out.json = true;
    else if (a === "--force") out.force = true;
    else if (a === "--fail-point") out.failPoint = argv[++i];
    else out._.push(a);
  }
  return out;
}

function log(json, obj) {
  if (json) process.stdout.write(JSON.stringify(obj) + "\n");
  else process.stderr.write(`[svc-migrate-install] ${obj.host || ""} ${obj.stage || ""} ${obj.status || ""}${obj.detail ? " — " + obj.detail : ""}\n`);
}

function expandHome(p, home) {
  if (!p) return "";
  if (p === "~") return home;
  if (p.startsWith("~/")) return path.join(home, p.slice(2));
  return p;
}

function inventoryHosts(repoRoot) {
  const dir = path.join(repoRoot, "provision", "hosts");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return []; }
  return files.map((f) => f.replace(/\.json$/, "")).sort();
}

function loadHostManifest(repoRoot, host) {
  const p = path.join(repoRoot, "provision", "hosts", `${host}.json`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function sha256Str(s) {
  return crypto.createHash("sha256").update(String(s)).digest("hex");
}

// The version-scoped enforcement bundle dir (durable launcher + materialized core).
function enforcementDir(stateRoot) {
  return path.join(stateRoot, "enforcement", MIGRATION_VERSION);
}

// Materialize the launcher + canonical core as byte/hash-verified COPIES (never
// symlinks) under ~/.svc/enforcement/<version>/. Idempotent: a converged bundle
// (matching hashes) is a no-op. Returns { launcherPath, changed }.
function materializeLauncher(stateRoot, repoRoot, effectiveSource, registry) {
  const dir = enforcementDir(stateRoot);
  const binDir = path.join(dir, "bin");
  const libDir = path.join(dir, "lib");
  // F-015: every bundle dir + write is fenced to the state root with a no-follow
  // ancestry walk so a symlinked/foreign-owned ~/.svc ancestor is refused.
  ensureSecureDir(binDir, { boundary: stateRoot });
  ensureSecureDir(libDir, { boundary: stateRoot });
  const srcLauncher = path.join(repoRoot, "bin", "svc-enforce.mjs");
  const srcCore = path.join(repoRoot, "hooks", "lib", "enforcement-core.mjs");
  const dstLauncher = path.join(binDir, "svc-enforce");
  const dstCore = path.join(libDir, "enforcement-core.mjs");
  let changed = false;
  changed = copyVerified(srcLauncher, dstLauncher, 0o700, stateRoot) || changed;
  changed = copyVerified(srcCore, dstCore, 0o600, stateRoot) || changed;
  // Sibling manifest (durable, outside the checkout) records effective_source.
  const manifestPath = path.join(dir, "manifest.json");
  const manifestBody = {
    schema_version: 1,
    migration_version: MIGRATION_VERSION,
    effective_source: effectiveSource,
    registry: registry || {},
  };
  const manifestText = JSON.stringify(manifestBody, null, 2) + "\n";
  let existing = null;
  try { existing = fs.readFileSync(manifestPath, "utf8"); } catch { /* absent */ }
  if (existing !== manifestText) {
    writeAtomic(manifestPath, manifestText, 0o600, stateRoot);
    changed = true;
  }
  return { launcherPath: dstLauncher, corePath: dstCore, changed };
}

// Copy src -> dst as real bytes, verify sha256, chmod. Returns true when it changed.
function copyVerified(src, dst, mode, boundary) {
  const srcHash = sha256File(src);
  let dstHash = null;
  try { if (!fs.lstatSync(dst).isSymbolicLink()) dstHash = sha256File(dst); } catch { /* absent */ }
  if (dstHash === srcHash) {
    try { fs.chmodSync(dst, mode); } catch { /* best-effort */ }
    return false;
  }
  const bytes = fs.readFileSync(src);
  // Never write over a symlink (defensive: an attacker-seeded symlink target).
  try { if (fs.lstatSync(dst).isSymbolicLink()) fs.unlinkSync(dst); } catch { /* absent */ }
  writeAtomic(dst, bytes, mode, boundary);
  const verify = sha256File(dst);
  if (verify !== srcHash) {
    throw new Error(`SVC-MIGRATE-COPY-VERIFY: hash mismatch materializing ${path.basename(dst)} (${verify} != ${srcHash})`);
  }
  return true;
}

function writeAtomic(file, contents, mode, boundary = null) {
  const dir = path.dirname(file);
  ensureSecureDir(dir, { boundary });
  const tmp = path.join(dir, `.tmp-${process.pid}-${crypto.randomBytes(6).toString("hex")}`);
  const fd = fs.openSync(tmp, "wx", mode);
  try { fs.writeSync(fd, contents); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  try { fs.chmodSync(tmp, mode); } catch { /* best-effort */ }
  fs.renameSync(tmp, file);
}

// Per-host migration directories under ~/.svc/install-migrations/v<version>/<host>/.
function hostMigDir(stateRoot, host) {
  return path.join(stateRoot, "install-migrations", `v${MIGRATION_VERSION}`, host);
}
function installReceiptPath(stateRoot, host) {
  return path.join(stateRoot, "install-state", `${host}.json`);
}

// The retry key components: {migration_version, host_id, pre_state_digest}.
function retryKey(host, preStateDigest) {
  return sha256Str(`${MIGRATION_VERSION}|${host}|${preStateDigest}`);
}

// Read/advance the atomic attempts ledger. Returns { attempts, terminal, key }.
function readAttempts(migDir) {
  const p = path.join(migDir, "attempts.json");
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8"));
    return { attempts: parsed.attempts || 0, terminal: parsed.terminal === true, key: parsed.retry_key || "", cause: parsed.cause || "" };
  } catch {
    return { attempts: 0, terminal: false, key: "", cause: "" };
  }
}
function writeAttempts(migDir, body, boundary = null) {
  ensureSecureDir(migDir, { boundary });
  writeAtomic(path.join(migDir, "attempts.json"), JSON.stringify(body, null, 2) + "\n", 0o600, boundary);
}

// Snapshot the CURRENT installed source pointer for a host (the `.source-repo`).
function currentSourcePointer(skillsPath) {
  const pointer = path.join(skillsPath, ".source-repo");
  try { return fs.readFileSync(pointer, "utf8").trim(); } catch { return ""; }
}

// F-010/F-011: host wiring is DERIVED FROM THE MANIFEST's `wiring` metadata — no
// hard-coded per-host table. Every host in provision/hosts/ is covered uniformly
// and a future host is covered automatically. Shape:
//   { hook_capable, wirer, wirer_via, governed, governed_token, config_file,
//     enforcement, reason }
// A hook-capable host with no wiring block OR (governed && no wirer) is a
// fail-closed unsupported-state — never a silent skip.
function loadWiring(manifest, host) {
  const w = manifest.wiring;
  const cap = Boolean(manifest.capabilities && manifest.capabilities.hooks);
  if (!w || typeof w !== "object") {
    // No declared wiring metadata: a hook-capable host is unsupported (fail-closed);
    // a non-hook-capable host is skills-only.
    return { hook_capable: cap, wirer: null, wirer_via: null, governed: false, governed_token: null, config_file: null, enforcement: cap ? "unknown" : "none", reason: cap ? "hook-capable host has no wiring metadata (unsupported)" : "non-hook-capable", _declared: false };
  }
  // Consistency guard: manifest.wiring.hook_capable MUST equal capabilities.hooks.
  if (Boolean(w.hook_capable) !== cap) {
    throw new TerminalMigrationError(`wiring.hook_capable (${w.hook_capable}) disagrees with capabilities.hooks (${cap}) for '${host}'`, "manifest-inconsistent");
  }
  return { ...w, _declared: true };
}

function hostConfigPath(manifest, home) {
  const w = manifest.wiring;
  const cf = (w && w.config_file) || (manifest.hook_quirks && manifest.hook_quirks.config_file);
  if (!cf) return null;
  // config_file paths are ~-relative, home-relative (".codex/hooks.json"), or absolute.
  if (cf.startsWith("~")) return expandHome(cf, home);
  if (path.isAbsolute(cf)) return cf;
  return path.join(home, cf);
}

function hostEffectiveStatePath(manifest, home) {
  const candidate = manifest.wiring?.effective_state?.config_file;
  if (!candidate) return null;
  if (candidate.startsWith("~")) return expandHome(candidate, home);
  return path.isAbsolute(candidate) ? candidate : path.join(home, candidate);
}

function governedRoutingStatus(configPath, wiring, options = {}) {
  if (!wiring.governed) return { ok: true, reason: "host declares no governed command" };
  const tokens = Array.isArray(wiring.governed_token) ? wiring.governed_token.filter(Boolean) : (wiring.governed_token ? [wiring.governed_token] : []);
  if (!tokens.length || !configPath || !fs.existsSync(configPath)) return { ok: false, reason: "governed command metadata/config is absent" };
  const identity = tokens.at(-1);
  let candidates = [];
  let stateKeys = [];
  try {
    const text = fs.readFileSync(configPath, "utf8");
    if (path.extname(configPath).toLowerCase() === ".json") {
      const parsed = JSON.parse(text);
      for (const [event, entries] of Object.entries(parsed.hooks || {})) {
        for (const [entryIndex, entry] of (entries || []).entries()) {
          for (const [hookIndex, hook] of (entry.hooks || []).entries()) {
            const command = typeof hook.command === "string" ? hook.command : "";
            if (!command.includes(identity)) continue;
            candidates.push(command);
            const eventKey = event.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
            stateKeys.push(`${path.resolve(configPath)}:${eventKey}:${entryIndex}:${hookIndex}`);
          }
        }
      }
    } else {
      candidates = text.split(/\r?\n/).flatMap((line) => {
        const match = line.match(/^\s*command\s*=\s*("(?:[^"\\]|\\.)*")\s*(?:#.*)?$/);
        if (!match) return [];
        try { const command = JSON.parse(match[1]); return command.includes(identity) ? [command] : []; } catch { return []; }
      });
    }
  } catch (error) { return { ok: false, reason: `host config cannot be parsed: ${error.message}` }; }
  if (candidates.length !== 1) return { ok: false, reason: `expected one '${identity}' command, found ${candidates.length}` };
  const missing = tokens.filter((token) => !candidates[0].includes(token));
  if (missing.length) return { ok: false, reason: `effective governed command missing: ${missing.join(", ")}` };
  if (wiring.effective_state?.type === "codex-hooks-state") {
    if (!options.stateConfigPath || !fs.existsSync(options.stateConfigPath)) {
      return { ok: false, reason: "effective Codex state config is absent" };
    }
    const lines = fs.readFileSync(options.stateConfigPath, "utf8").split(/\r?\n/);
    let inTarget = false;
    for (const line of lines) {
      const section = line.match(/^\s*\[hooks\.state\.("(?:[^"\\]|\\.)*")\]\s*$/);
      if (section) {
        let decoded = "";
        try { decoded = JSON.parse(section[1]); } catch { decoded = ""; }
        inTarget = decoded === stateKeys[0];
      } else if (/^\s*\[.+\]\s*$/.test(line)) inTarget = false;
      else if (inTarget && /^\s*enabled\s*=\s*false\s*(?:#.*)?$/.test(line)) {
        return { ok: false, reason: `effective governed command is explicitly disabled at ${stateKeys[0]}` };
      }
    }
  }
  return { ok: true, reason: "one effective governed command routes through the durable launcher" };
}

// Is the host present/installed on THIS machine? A host that was never installed
// (no skills dir and no config file) is not an error — it is an explicit
// non-migratable terminal (nothing to migrate), never a silent skip.
function hostIsPresent(skillsPath, configPath) {
  if (skillsPath && fs.existsSync(skillsPath)) return true;
  if (configPath && fs.existsSync(configPath)) return true;
  return false;
}

// Orchestrate the EXISTING host wiring primitive transactionally: SNAPSHOT the
// config (which MUST succeed before any mutation — F-014), run the wirer with the
// SAME HOME (so the materialized launcher is visible), then VERIFY the governed
// command routes through the launcher (F-012). Returns { hooks_installed, governed,
// config_path, config_existed, routed } or throws (fail-closed) when a governed
// host cannot be converged. A snapshot-write failure is a distinct terminal
// `corrupt` outcome (F-014) — NEVER swallowed.
function wireHostConfig(ctx, host, manifest, wiring, skillsPath, backupDir) {
  const { repoRoot, home, stateRoot } = ctx;
  if (!wiring.hook_capable) {
    // Skills-only host (antigravity/cursor): no hook surface to wire.
    return { hooks_installed: false, governed: false, config_path: null, config_existed: false, routed: true, note: "skills-only (non-hook-capable)" };
  }
  if (!wiring.wirer) {
    throw new TerminalMigrationError(`hook-capable host '${host}' declares no wirer in wiring metadata (unsupported-state)`, "no-wirer");
  }
  const scriptPath = path.join(repoRoot, wiring.wirer);
  if (!fs.existsSync(scriptPath)) {
    throw new TerminalMigrationError(`host wirer missing at ${wiring.wirer}; cannot converge ${host} (unsupported-state)`, "wirer-missing");
  }
  const configPath = hostConfigPath(manifest, home);
  const stateConfigPath = hostEffectiveStatePath(manifest, home);
  const configPaths = [...new Set([configPath, stateConfigPath].filter(Boolean))];
  // F-014: snapshot BEFORE mutation. The snapshot MUST succeed — a failure is a
  // distinct terminal `corrupt` result, never a swallowed best-effort no-op.
  let configExisted = false;
  ensureSecureDir(backupDir, { boundary: stateRoot });
  try {
    const configs = [];
    for (const [index, candidate] of configPaths.entries()) {
      const existed = fs.existsSync(candidate);
      const snapshot = `host-config-${index}.snapshot`;
      if (candidate === configPath) configExisted = existed;
      if (existed) writeAtomic(path.join(backupDir, snapshot), fs.readFileSync(candidate), 0o600, stateRoot);
      configs.push({ config_path: candidate, existed, snapshot: existed ? snapshot : null });
    }
    writeAtomic(path.join(backupDir, "host-config.meta"), JSON.stringify({ configs }) + "\n", 0o600, stateRoot);
  } catch (e) {
    throw new TerminalMigrationError(`host-config snapshot FAILED for ${host} (${e.message}); refusing to wire without a restorable backup`, "snapshot-corrupt");
  }
  // Run the existing wiring primitive with the SAME HOME so the launcher resolves.
  const res = execFileSyncSafe("node", [scriptPath, "--skills-path", skillsPath], repoRoot, home);
  if (res.status !== 0) {
    if (wiring.governed) {
      throw new Error(`host wirer failed for ${host} (exit ${res.status}): ${(res.stderr || "").split("\n")[0]}`);
    }
    // A governed:false host has no launcher-routable governed command; a wirer
    // failure here cannot fail-open enforcement. Record it as a non-fatal note.
    return { hooks_installed: false, governed: false, config_path: configPath, config_existed: configExisted, routed: true, note: `observational wirer exit ${res.status} (non-governed host; enforcement=${wiring.enforcement})` };
  }
  // F-012: VERIFY the effective post-state — the governed command must route
  // through the launcher (parsed from the ACTUAL installed config).
  const routing = governedRoutingStatus(configPath, wiring, {
    stateConfigPath,
  });
  if (wiring.governed && !routing.ok) {
    throw new Error(`post-wire verification failed for ${host}: ${routing.reason}`);
  }
  return { hooks_installed: Boolean(wiring.governed && routing.ok), governed: Boolean(wiring.governed), config_path: configPath, config_existed: configExisted, routed: routing.ok, note: routing.reason };
}

// Restore a snapshotted host config on rollback (F-014). Returns { ok } — a
// restore FAILURE is surfaced to the caller as a distinct terminal, never a false
// "restored". When the config did NOT exist before migration, the migration-created
// file is REMOVED (no dangling pointer at a removed launcher).
function restoreHostConfig(backupDir) {
  const metaPath = path.join(backupDir, "host-config.meta");
  const meta = safeJson(metaPath);
  if (!meta) return { ok: true, note: "no host config in transaction" };
  const configs = Array.isArray(meta.configs)
    ? meta.configs
    : (meta.config_path ? [{ config_path: meta.config_path, existed: meta.existed, snapshot: "host-config.snapshot" }] : []);
  if (configs.length === 0) return { ok: true, note: "no host config in transaction" };
  try {
    for (const config of configs) {
      if (config.existed) {
        const snap = path.join(backupDir, config.snapshot || "");
        if (!config.snapshot || !fs.existsSync(snap)) return { ok: false, note: `pre-existing config had no snapshot to restore: ${config.config_path}` };
        writeAtomic(config.config_path, fs.readFileSync(snap), 0o600, null);
      } else if (fs.existsSync(config.config_path)) {
        fs.rmSync(config.config_path, { force: true });
      }
    }
    return { ok: true, note: `restored ${configs.length} exact host config surface(s)` };
  } catch (e) {
    return { ok: false, note: `restore failed: ${e.message}` };
  }
}

function execFileSyncSafe(cmd, args, cwd, home) {
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: "utf8", env: { ...process.env, HOME: home }, stdio: ["ignore", "pipe", "pipe"] });
    return { status: 0, stdout: out, stderr: "" };
  } catch (e) {
    return { status: e.status == null ? 1 : e.status, stdout: e.stdout || "", stderr: e.stderr || String(e.message || e) };
  }
}

// The durable canonical source is the repo root passed in (already canonical —
// setup / the caller resolves git-common-dir before invoking).
async function migrateHost(ctx, host) {
  const { stateRoot, repoRoot, home, json, failPoint, force } = ctx;
  const report = { host, stage: "start", status: "pending" };
  let manifest;
  try { manifest = loadHostManifest(repoRoot, host); } catch (e) {
    report.stage = "load-manifest"; report.status = "error"; report.detail = e.message; return report;
  }
  let wiring;
  try { wiring = loadWiring(manifest, host); } catch (e) {
    // A manifest-inconsistency is a TERMINAL configuration error (fail-closed).
    report.stage = "load-wiring"; report.status = "terminal"; report.detail = e.message; report.terminal = true; return report;
  }
  const skillsPath = ctx.skillsPath || expandHome(manifest.skills_path, home);
  const migDir = hostMigDir(stateRoot, host);
  const marker = path.join(migDir, "marker.json");
  const backupDir = path.join(migDir, "backup");
  const configPathForCheck = hostConfigPath(manifest, home);

  // Fail-closed up front: never migrate FROM a non-durable source. setup resolves
  // the canonical main checkout (git-common-dir) BEFORE invoking, so a durable
  // repoRoot is expected; a worktree/ephemeral repoRoot is refused (no attempt
  // consumed, nothing touched).
  const repoClass = classifySource(repoRoot, { requireExecutable: false });
  if (repoClass !== "durable-canonical") {
    report.stage = "precheck"; report.status = "refused";
    report.detail = `refusing to migrate from a non-durable source (${repoClass}): ${repoRoot}; run setup from the canonical main checkout`;
    return report;
  }

  // F-011: a host that was NEVER installed on this machine (no skills dir, no
  // config) is not an error and not a silent skip — it is an EXPLICIT, actionable
  // non-migratable terminal. An explicit --host or --skills-path request overrides
  // (the caller is asserting the host is present / will be created).
  if (!ctx.explicitHost && !ctx.skillsPath && !hostIsPresent(skillsPath, configPathForCheck)) {
    report.stage = "not-installed"; report.status = "not-migratable"; report.terminal = true;
    report.detail = `host '${host}' is declared but not installed on this machine (no skills dir at ${skillsPath}, no config at ${configPathForCheck || "n/a"}); nothing to migrate. Run ./setup --host ${host} to install it first.`;
    report.wiring = { hook_capable: wiring.hook_capable, governed: wiring.governed, enforcement: wiring.enforcement };
    return report;
  }

  const beforePointer = currentSourcePointer(skillsPath);
  const beforeClass = beforePointer ? classifySource(beforePointer, { requireExecutable: false }) : "dangling";
  const preStateDigest = sha256Str(`${skillsPath}|${beforePointer}|${beforeClass}`);
  const key = retryKey(host, preStateDigest);

  // Idempotency (F-007): convergence is recomputed from LIVE state, never accepted
  // on marker existence + receipt text alone. Requires: an OWNED (uid+mode-checked,
  // non-symlink) marker, a schema+identity-bound install receipt naming this repo
  // root, that source STILL classifying durable-canonical, the recorded launcher
  // STILL runnable, and the live `.source-repo` pointer STILL equal to repoRoot.
  const markerObj = validateReceiptFile(marker, {
    requiredFields: ["host", "migration_version", "effective_source"],
    identity: { host, migration_version: MIGRATION_VERSION, effective_source: repoRoot },
    boundary: stateRoot,
  });
  const receipt = validateInstallReceipt(installReceiptPath(stateRoot, host), { host, stateRoot });
  // F-012: convergence is accepted ONLY when the FULL-schema receipt is valid, the
  // recorded launcher STILL passes the hardened runnable+ancestry check, the live
  // `.source-repo` pointer STILL equals repoRoot, AND the host's ACTUAL installed
  // governed command STILL routes through the durable launcher (parsed live — a
  // command that drifted back to a direct checkout path is NOT converged and is
  // re-wired rather than accepted as noop).
  const liveRouting = governedRoutingStatus(configPathForCheck, wiring, {
    stateConfigPath: hostEffectiveStatePath(manifest, home),
  });
  if (!force && markerObj && receipt && receipt.effective_source === repoRoot &&
      classifySource(receipt.effective_source, { requireExecutable: false }) === "durable-canonical" &&
      launcherRunnable(receipt.launcher_path, { boundary: stateRoot }) &&
      currentSourcePointer(skillsPath) === repoRoot &&
      liveRouting.ok) {
    report.stage = "idempotent"; report.status = "noop"; report.effective_source = repoRoot; report.governed_routing = liveRouting.reason; return report;
  }

  // Bounded retry: honor a terminal record; a NEW key (changed pre_state_digest
  // or migration_version) starts a fresh N=3 budget. F-013: a terminal record is
  // NOT auto-retried and is cleared ONLY by an explicit owner action (--force) or
  // a changed pre-state digest / migration version (a new key) — never a silent
  // retry loop. Plain --resume on an UNCHANGED terminal key stays refused.
  const ledger = readAttempts(migDir);
  if (ledger.terminal && ledger.key === key && !force) {
    report.stage = "terminal"; report.status = "refused"; report.terminal = true;
    report.detail = `terminal record present for this key (cause: ${ledger.cause || "n/a"}). It is NOT auto-retried. Recovery: fix the underlying condition (which changes the pre-state digest) OR run an explicit owner override: node scripts/svc-migrate-install.mjs migrate --host ${host} --force`;
    return report;
  }
  const priorAttempts = ledger.key === key ? ledger.attempts : 0;
  if (priorAttempts >= MAX_ATTEMPTS && !force) {
    writeAttempts(migDir, { retry_key: key, attempts: priorAttempts, terminal: true, host, cause: "retry ceiling reached", pre_state_digest: preStateDigest, migration_version: MIGRATION_VERSION }, stateRoot);
    report.stage = "terminal"; report.status = "refused"; report.terminal = true; report.detail = "retry ceiling reached; terminal record written"; return report;
  }
  const thisAttempt = priorAttempts + 1;
  writeAttempts(migDir, { retry_key: key, attempts: thisAttempt, terminal: false, host, pre_state_digest: preStateDigest, migration_version: MIGRATION_VERSION }, stateRoot);

  try {
    // 1. Backup the current host source pointer (transaction start).
    ensureSecureDir(backupDir, { boundary: stateRoot });
    writeAtomic(path.join(backupDir, "source-repo"), beforePointer + "\n", 0o600, stateRoot);
    writeAtomic(path.join(backupDir, "pre-state.json"), JSON.stringify({ skills_path: skillsPath, pointer: beforePointer, classification: beforeClass, pre_state_digest: preStateDigest }, null, 2) + "\n", 0o600, stateRoot);
    if (failPoint === "after-backup") throw new Error("injected fail-point after-backup");

    // 2. Materialize the durable launcher + canonical core (copy, byte/hash-verified).
    const registry = MATERIALIZE_REGISTRY;
    const { launcherPath } = materializeLauncher(stateRoot, repoRoot, repoRoot, registry);
    if (failPoint === "after-launcher") throw new Error("injected fail-point after-launcher");

    // 3. Repoint the host source pointer to the durable canonical checkout (the
    //    host skills dir lives outside ~/.svc, so boundary=null here).
    if (fs.existsSync(skillsPath)) {
      writeAtomic(path.join(skillsPath, ".source-repo"), repoRoot + "\n", 0o644, null);
    }
    if (failPoint === "after-repoint") throw new Error("injected fail-point after-repoint");

    // 3b. F-010/F-011/F-012: orchestrate the manifest-declared host wiring primitive
    // transactionally and VERIFY the governed command routes through the launcher.
    // hooks_installed is derived from this verified post-state, not a capability
    // flag. A GOVERNED host that cannot be converged throws → transactional rollback
    // (fail-closed). A governed:false host is wired observationally with an explicit
    // disposition (no launcher-routable command to verify).
    const wireResult = wireHostConfig(ctx, host, manifest, wiring, skillsPath, backupDir);
    if (failPoint === "after-wire") throw new Error("injected fail-point after-wire");

    // 4. Verify: effective source durable + launcher present & executable.
    const effClass = classifySource(repoRoot, { requireExecutable: false });
    if (effClass !== "durable-canonical") throw new Error(`effective source not durable after repoint (${effClass})`);
    if (!launcherRunnable(launcherPath)) throw new Error("launcher not runnable after materialization");
    // 4b. F-004: derive skills_installed from live post-state (pointer resolves to
    // the durable effective source), never an unconditional true.
    const skillsInstalled = fs.existsSync(skillsPath) && currentSourcePointer(skillsPath) === repoRoot;
    if (!skillsInstalled) throw new Error("skills surface not converged: .source-repo does not point at the durable effective source");

    // 5. Legacy WI-state alignment — DELEGATE to WI-486 (no self graph write).
    // F-005: a terminal compatibility outcome (contract unavailable / unsupported /
    // missing authorization where migration is required / delegated CLI failure)
    // THROWS before the receipt/marker are written — never a success claim.
    const delegation = await delegateWiState(ctx, host);
    report.wi_state = delegation;
    if (delegation.terminal) {
      // F-013: a WI-486 terminal delegation is a terminal-class error — it must
      // persist terminal:true on the FIRST occurrence, not be retried up to N=3.
      throw new TerminalMigrationError(`WI-486 delegation terminal (fail-closed): ${delegation.detail || "unavailable/unsupported compatibility contract"}`, "wi486-delegation-terminal");
    }

    // 6. Write the per-host install receipt (before/after) — evidence only, booleans
    // derived from the verified post-state above.
    const receiptBody = {
      schema_version: 1,
      migration_version: MIGRATION_VERSION,
      host,
      skills_path: skillsPath,
      effective_source: repoRoot,
      source_classification: effClass,
      launcher_path: launcherPath,
      launcher_version: MIGRATION_VERSION,
      framework_commit: gitCommit(repoRoot),
      hooks_installed: wireResult.hooks_installed,
      skills_installed: skillsInstalled,
      governed: wireResult.governed,
      governed_routed: wireResult.routed,
      enforcement: wiring.enforcement || null,
      host_config_path: wireResult.config_path || null,
      installed_at: new Date().toISOString(),
      before: { pointer: beforePointer, classification: beforeClass },
      after: { pointer: repoRoot, classification: effClass },
    };
    writeAtomic(installReceiptPath(stateRoot, host), JSON.stringify(receiptBody, null, 2) + "\n", 0o600, stateRoot);

    // 7. Completion marker (resume anchor) + attempts reset to non-terminal success.
    writeAtomic(marker, JSON.stringify({ host, migration_version: MIGRATION_VERSION, completed_at: new Date().toISOString(), pre_state_digest: preStateDigest, effective_source: repoRoot }, null, 2) + "\n", 0o600, stateRoot);
    writeAttempts(migDir, { retry_key: key, attempts: thisAttempt, terminal: false, host, completed: true, pre_state_digest: preStateDigest, migration_version: MIGRATION_VERSION }, stateRoot);

    report.stage = "migrate"; report.status = "ok"; report.effective_source = repoRoot; report.launcher_path = launcherPath;
    report.governed = wireResult.governed; report.governed_routed = wireResult.routed; report.wiring_note = wireResult.note;
    return report;
  } catch (e) {
    // Transactional rollback of THIS host from backup, then record the attempt.
    const rb = rollbackHost(ctx, host, { silent: true });
    // F-014: a rollback that could not restore is a distinct terminal `corrupt`
    // result — never reported as a clean transient failure.
    const rollbackCorrupt = rb && rb.status === "corrupt";
    // F-013: a terminal-class error is terminal on the FIRST occurrence (no retry).
    const isTerminalClass = e instanceof TerminalMigrationError || rollbackCorrupt;
    const terminal = isTerminalClass || thisAttempt >= MAX_ATTEMPTS;
    writeAttempts(migDir, { retry_key: key, attempts: thisAttempt, terminal, host, cause: e.message, terminal_class: isTerminalClass ? (e.terminalCause || (rollbackCorrupt ? "rollback-corrupt" : "terminal")) : undefined, pre_state_digest: preStateDigest, migration_version: MIGRATION_VERSION }, stateRoot);
    report.stage = "migrate"; report.status = rollbackCorrupt ? "corrupt" : (terminal ? "terminal" : "failed"); report.terminal = terminal; report.detail = e.message; report.attempts = thisAttempt;
    if (rollbackCorrupt) report.rollback = rb;
    return report;
  }
}

function gitCommit(repoRoot) {
  try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return null; }
}

// Delegate legacy WI-state classification/migration to WI-486. NEVER writes graph
// bytes: classify only (via WI-486's classifyTaskState), then shell
// svc-migrate-task-state for migratable state. If the WI-486 contract is absent
// or the state is unsupported, terminates fail-closed with NO retry loop.
async function delegateWiState(ctx, host) {
  const { repoRoot } = ctx;
  const result = { delegated: false, classifications: [], detail: "", terminal: false };
  const contractPath = path.join(repoRoot, "hooks", "lib", "task-state-compatibility.mjs");
  let compat;
  try {
    compat = await import(pathToFileURL(contractPath).href);
  } catch {
    // F-005: unavailable compatibility contract is a TERMINAL host failure.
    result.detail = "WI-486 compatibility contract unavailable — fail-closed terminal (no retry)";
    result.terminal = true;
    return result;
  }
  const svcDir = ctx.svcDir || path.join(repoRoot, ".svc");
  let graphs = [];
  try { graphs = fs.readdirSync(svcDir).filter((f) => /^lane-tasks.*\.json$/.test(f) && !f.includes(".completed")); } catch { /* none */ }
  for (const g of graphs) {
    let bytes;
    try { bytes = fs.readFileSync(path.join(svcDir, g)); } catch { continue; }
    const c = compat.classifyTaskState(bytes);
    result.classifications.push({ graph: g, classification: c.classification });
    if (c.classification === compat.SUPPORTED) continue;
    if (c.classification === compat.QUARANTINE) {
      // F-005: unsupported / malformed state cannot be safely migrated → terminal.
      result.terminal = true;
      result.detail = `WI-486 classified ${g} as ${c.classification} (${c.reason || "unsupported"}) — fail-closed terminal`;
      return result;
    }
    if (c.classification === compat.LEGACY_LOSSLESS) {
      // Migration IS required. Missing authorization is a terminal fail-closed
      // condition (F-005) — never a silent success.
      if (!ctx.authorization) {
        result.terminal = true;
        result.detail = `WI-486 legacy-lossless graph ${g} requires migration but no authorization was provided — fail-closed terminal (set SVC_MIGRATE_AUTHORIZATION)`;
        return result;
      }
      const _WI_BODY = "WI-[A-Z0-9]+(?:-[A-Z0-9]+)*";  // canonical: hooks/lib/wi-id.mjs (inlined — migrate-install runs from a reduced source set, cannot import the shared lib)
  const _wm = g.match(new RegExp("(?<![A-Za-z0-9._:/-])" + _WI_BODY + "(?![A-Za-z0-9._:/-])")); const wi = (_wm && /^WI-[A-Z0-9]+(-[A-Z0-9]+)*$/.test(_wm[0])) ? _wm[0] : undefined;
      if (!wi) {
        result.terminal = true;
        result.detail = `WI-486 legacy graph ${g} has no resolvable WI id — cannot delegate migration (terminal)`;
        return result;
      }
      try {
        execFileSync("node", [path.join(repoRoot, "scripts", "svc-migrate-task-state.mjs"), "--wi", wi, "--authorization", ctx.authorization], { cwd: repoRoot, stdio: ["ignore", "ignore", "pipe"] });
        result.delegated = true;
      } catch (e) {
        // F-005: a delegated CLI failure is terminal, not a swallowed detail.
        result.terminal = true;
        result.detail = `delegation to svc-migrate-task-state failed for ${wi}: ${e.message}`;
        return result;
      }
    }
  }
  return result;
}

// F-006: is the version-scoped enforcement bundle still referenced by ANY OTHER
// migrated host? A live-scan of install-state receipts (excluding `exceptHost`)
// whose launcher_version matches the running bundle. The shared bundle is only
// deleted when the LAST host that uses it is rolled back — otherwise every other
// migrated host's launcher-routed command would dangle (fail-open/lockout).
function otherHostsUseBundle(stateRoot, exceptHost) {
  const dir = path.join(stateRoot, "install-state");
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")); } catch { return false; }
  for (const f of files) {
    const h = f.replace(/\.json$/, "");
    if (h === exceptHost) continue;
    const r = validateInstallReceipt(path.join(dir, f), { host: h, stateRoot });
    if (r && r.launcher_version === MIGRATION_VERSION) return true;
  }
  return false;
}

// Rollback ONE host: restore the .source-repo pointer + host config from backup,
// remove the version-scoped launcher dir ONLY when no other host references it
// (F-006), verify, idempotent (D-12). Returns a report.
function rollbackHost(ctx, host, opts = {}) {
  const { stateRoot, home, repoRoot, force } = ctx;
  const report = { host, stage: "rollback", status: "pending" };
  let manifest;
  try { manifest = loadHostManifest(repoRoot, host); } catch (e) { report.status = "error"; report.detail = e.message; return report; }
  const skillsPath = ctx.skillsPath || expandHome(manifest.skills_path, home);
  const migDir = hostMigDir(stateRoot, host);
  const backupPointer = path.join(migDir, "backup", "source-repo");
  if (!fs.existsSync(backupPointer)) {
    report.status = "noop"; report.detail = "no backup to restore (never migrated)"; return report;
  }
  const backupVal = fs.readFileSync(backupPointer, "utf8").trim();
  const markerPath = path.join(migDir, "marker.json");
  const receiptPath = installReceiptPath(stateRoot, host);
  // Already rolled back: no marker, no install receipt for THIS host, and the live
  // pointer already equals the backup value -> a second --rollback is a byte no-op.
  // (The shared enforcement dir may legitimately survive because another host still
  // references it — F-006 — so it is NOT part of the already-rolled-back predicate.)
  if (!fs.existsSync(markerPath) && !fs.existsSync(receiptPath) &&
      currentSourcePointer(skillsPath) === backupVal) {
    report.status = "noop"; report.detail = "host already rolled back"; return report;
  }
  // Precondition digest: refuse to roll back an already-diverged host unless --force.
  const pre = safeJson(path.join(migDir, "backup", "pre-state.json"));
  const receipt = validateReceiptFile(installReceiptPath(stateRoot, host));
  if (!opts.silent && !force && receipt && pre) {
    const currentPointer = currentSourcePointer(skillsPath);
    if (currentPointer && receipt.after && currentPointer !== receipt.after.pointer) {
      report.status = "refused"; report.detail = "host diverged from recorded post-migration state; re-run with --force to override"; return report;
    }
  }
  const restored = fs.readFileSync(backupPointer, "utf8").trim();
  if (fs.existsSync(skillsPath)) {
    writeAtomic(path.join(skillsPath, ".source-repo"), restored + "\n", 0o644, null);
  }
  // F-014: restore (or remove) the pre-wire host config (transaction reverse). A
  // restore FAILURE is a distinct terminal `corrupt` result — NEVER a false
  // "restored". When the config did NOT pre-exist, the migration-created file is
  // REMOVED so it can never dangle pointing at a removed launcher.
  const cfgRestore = restoreHostConfig(path.join(migDir, "backup"));
  if (!cfgRestore.ok) {
    report.status = "corrupt"; report.terminal = true;
    report.detail = `rollback could not restore/clean host config (${cfgRestore.note}); leaving a partially-migrated host would dangle a launcher pointer — refusing to claim 'restored'`;
    report.restored_pointer = restored;
    return report;
  }
  // Remove the marker + install receipt (regenerable) FIRST so the ref-count below
  // does not see this host's own receipt, then keep backup for idempotent replay.
  try { fs.rmSync(path.join(migDir, "marker.json"), { force: true }); } catch { /* */ }
  try { fs.rmSync(installReceiptPath(stateRoot, host), { force: true }); } catch { /* */ }
  // F-006: remove the shared version-scoped launcher dir ONLY if no other migrated
  // host still references this bundle version. Otherwise leave it intact.
  const encDir = enforcementDir(stateRoot);
  let bundleRemoved = false;
  if (!otherHostsUseBundle(stateRoot, host)) {
    try { fs.rmSync(encDir, { recursive: true, force: true }); bundleRemoved = true; } catch { /* best-effort */ }
  }
  // F-014: VERIFY the post-restore state before claiming "restored" — the live
  // pointer must equal the backup value and this host's receipt must be gone.
  const livePointer = currentSourcePointer(skillsPath);
  if (fs.existsSync(skillsPath) && livePointer !== restored) {
    report.status = "corrupt"; report.terminal = true;
    report.detail = `post-rollback verification failed: .source-repo is '${livePointer}', expected '${restored}'`;
    return report;
  }
  report.status = "restored"; report.restored_pointer = restored; report.bundle_removed = bundleRemoved; report.config_restore = cfgRestore.note;
  return report;
}

function safeJson(p) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; } }

// materialize subcommand: launcher + install receipt for ONE host (setup path).
function materializeCmd(ctx, host) {
  const { stateRoot, repoRoot, home, json } = ctx;
  const report = { host, stage: "materialize", status: "pending" };
  let manifest;
  try { manifest = loadHostManifest(repoRoot, host); } catch (e) { report.status = "error"; report.detail = e.message; return report; }
  let wiring;
  try { wiring = loadWiring(manifest, host); } catch (e) {
    report.status = "terminal"; report.terminal = true; report.detail = e.message; return report;
  }
  const skillsPath = ctx.skillsPath || expandHome(manifest.skills_path, home);
  const effClass = classifySource(repoRoot, { requireExecutable: false });
  if (effClass !== "durable-canonical") {
    report.status = "refused"; report.detail = `refusing to materialize from a non-durable source (${effClass}): ${repoRoot}`; return report;
  }
  const { launcherPath } = materializeLauncher(stateRoot, repoRoot, repoRoot, MATERIALIZE_REGISTRY);
  // Derive receipt booleans from LIVE post-state, never an unconditional true
  // (F-004/F-012). setup wires the host config in a SEPARATE step, so hooks_installed
  // reflects whether the ACTUAL installed governed command already routes through the
  // launcher (parsed via the manifest's governed_token). For a governed:false host
  // there is no launcher-routable command, so hooks_installed stays false with an
  // explicit enforcement disposition. check-install-drift reconciles otherwise.
  const configPath = hostConfigPath(manifest, home);
  const routing = governedRoutingStatus(configPath, wiring, {
    stateConfigPath: hostEffectiveStatePath(manifest, home),
  });
  const hooksInstalled = Boolean(wiring.governed && routing.ok);
  const skillsInstalled = fs.existsSync(skillsPath);
  const receiptBody = {
    schema_version: 1,
    migration_version: MIGRATION_VERSION,
    host,
    skills_path: skillsPath,
    effective_source: repoRoot,
    source_classification: effClass,
    launcher_path: launcherPath,
    launcher_version: MIGRATION_VERSION,
    framework_commit: gitCommit(repoRoot),
    hooks_installed: hooksInstalled,
    skills_installed: skillsInstalled,
    governed: Boolean(wiring.governed),
    governed_routed: routing.ok,
    enforcement: wiring.enforcement || null,
    host_config_path: configPath || null,
    installed_at: new Date().toISOString(),
    before: null,
    after: { pointer: repoRoot, classification: effClass },
  };
  writeAtomic(installReceiptPath(stateRoot, host), JSON.stringify(receiptBody, null, 2) + "\n", 0o600, stateRoot);
  report.status = "ok"; report.launcher_path = launcherPath; report.effective_source = repoRoot; report.governed = Boolean(wiring.governed); report.governed_routed = routing.ok;
  return report;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sub = args._[0];
  const home = process.env.HOME || "";
  let stateRoot;
  try {
    stateRoot = resolveStateRoot(process.env);
    // F-015: validate the state root itself (owner==uid, non-symlink, non-g/o-writable)
    // BEFORE any bundle/receipt/marker/ledger/backup write threads through it.
    assertStateRootSecure(stateRoot);
  } catch (e) {
    process.stderr.write(`svc-migrate-install: ${e.message}\n`); process.exit(2);
  }
  const repoRoot = args.repoRoot ? path.resolve(args.repoRoot) : DEFAULT_REPO_ROOT;
  const ctx = {
    stateRoot, repoRoot, home,
    skillsPath: args.skillsPath ? path.resolve(args.skillsPath) : null,
    explicitHost: Boolean(args.host),
    json: Boolean(args.json), failPoint: args.failPoint, force: Boolean(args.force),
    authorization: process.env.SVC_MIGRATE_AUTHORIZATION || null,
    svcDir: process.env.SVC_MIGRATE_SVC_DIR || null,
  };

  const hosts = args.host ? [args.host] : inventoryHosts(repoRoot);
  if (hosts.length === 0) { process.stderr.write("svc-migrate-install: no hosts inventoried\n"); process.exit(1); }

  const reports = [];
  let hadError = false;
  for (const host of hosts) {
    let r;
    if (sub === "materialize") r = materializeCmd(ctx, host);
    else if (args.rollback) r = rollbackHost(ctx, host);
    else r = await migrateHost(ctx, host); // migrate + --resume share the same idempotent path
    reports.push(r);
    log(ctx.json, r);
    // A "not-migratable" host (declared but not installed on this machine) is an
    // explicit, benign terminal — recorded, but it does not fail the batch (so an
    // --all-hosts run on a machine with only some hosts installed still exits 0).
    if (["error", "failed", "terminal", "refused", "corrupt"].includes(r.status)) hadError = true;
  }

  if (ctx.json) process.stdout.write(JSON.stringify({ migration_version: MIGRATION_VERSION, hosts: reports }) + "\n");
  process.exit(hadError ? 1 : 0);
}

main().catch((e) => { process.stderr.write(`svc-migrate-install: ${e && e.message}\n`); process.exit(1); });
