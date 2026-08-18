#!/usr/bin/env node
// scripts/lib/chain-policy.mjs — WI-549 single resolver for the shared chain-policy mode.
//
// Every linked worktree, closeout tree, and canonical checkout must observe
// the SAME owner-selected chain-policy mode ("refuse" | "warn"), with
// provenance. Missing or unreadable policy must never silently downgrade
// refuse to warn.
//
// Resolution order (AC-549-1):
//   1. SVC_CHAIN_POLICY env var (mode string: "refuse" | "warn") — session override.
//   2. $(git-common-dir)/svc-chain-policy.json — repository-shared authority
//      (WI-547 established the same git-common-dir pattern for review evidence).
//   3. ~/.svc/chain-policy.json — owner-home fallback.
//   4. Fail-closed "refuse".
//
// A per-worktree `.svc/chain-policy.json` is NEVER authoritative (AC-549-4).
// It is read ONLY to detect a conflict against the shared file: if it exists
// and is not byte-identical to the shared file, that is a conflict — not a
// silent override — and resolution fails closed to "refuse" (AC-549-3).
//
// CLI:
//   node scripts/lib/chain-policy.mjs                 # JSON result on stdout
//   node scripts/lib/chain-policy.mjs --mode           # bare mode on stdout
//   node scripts/lib/chain-policy.mjs --repo <path>    # resolve as if cwd were <path>
//   node scripts/lib/chain-policy.mjs migrate-seed [--from <path>] [--force]
//
// Diagnostics (fail-closed / conflict / invalid) are always written to
// stderr, independent of --mode / --json, so callers that capture only
// stdout (e.g. `MODE=$(node .../chain-policy.mjs --mode)`) still surface
// the reason on the terminal.
//
// Importers:
//   import { resolveChainPolicy, seedSharedChainPolicy } from "./chain-policy.mjs";

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { repositoryIdentity } from "./review-evidence-store.mjs";

const VALID_MODES = new Set(["refuse", "warn"]);
const AUTHORITATIVE_SOURCES = new Set(["env", "shared", "home"]);

function sha256Hex(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Read + validate a candidate chain-policy.json. Never throws: every failure
// mode (missing, unreadable, not a file, malformed JSON, invalid mode value)
// is reported structurally so the resolver can decide fail-closed vs. "this
// tier is simply absent, try the next one" without any silent guessing.
function readPolicyFile(absPath) {
  if (!absPath) return { exists: false };
  let stat;
  try {
    stat = fs.lstatSync(absPath);
  } catch {
    return { exists: false };
  }
  if (!stat.isFile()) {
    return { exists: true, ok: false, error: `${absPath} exists but is not a regular file` };
  }
  let raw;
  try {
    raw = fs.readFileSync(absPath);
  } catch (error) {
    return { exists: true, ok: false, error: `${absPath} is unreadable: ${error.message}` };
  }
  const hash = sha256Hex(raw);
  let data;
  try {
    data = JSON.parse(raw.toString("utf8"));
  } catch (error) {
    return { exists: true, ok: false, hash, error: `${absPath} is not valid JSON: ${error.message}` };
  }
  const mode = data && data.mode;
  if (!VALID_MODES.has(mode)) {
    return { exists: true, ok: false, hash, data, error: `${absPath} has an invalid "mode" field (${JSON.stringify(mode)}); must be "refuse" or "warn"` };
  }
  return { exists: true, ok: true, hash, data, mode };
}

function closed({ reason, source, conflict = false, provenance }) {
  return { mode: "refuse", source, conflict, reason, provenance };
}

function open({ mode, source, reason, provenance }) {
  return { mode, source, conflict: false, reason, provenance };
}

/**
 * Resolve the effective chain-policy mode per AC-549-1..4.
 * @param {{start?: string, env?: NodeJS.ProcessEnv}} opts
 */
export function resolveChainPolicy({ start = process.cwd(), env = process.env } = {}) {
  const provenance = {
    env_value: null,
    git_common_dir: null,
    shared_path: null, shared_exists: false, shared_hash: null, shared_mode: null,
    local_path: null, local_exists: false, local_hash: null, local_mode: null, local_error: null,
    home_path: null, home_exists: false, home_hash: null, home_mode: null,
  };

  // Tier 1: explicit session override. Wins outright — files are not even
  // consulted — but an invalid value still fails closed rather than being
  // silently ignored (a typo in SVC_CHAIN_POLICY must never look like "unset").
  const envRaw = env.SVC_CHAIN_POLICY;
  if (typeof envRaw === "string" && envRaw.trim() !== "") {
    const mode = envRaw.trim();
    provenance.env_value = mode;
    if (!VALID_MODES.has(mode)) {
      return closed({
        reason: `SVC_CHAIN_POLICY has an invalid value ${JSON.stringify(mode)}; must be "refuse" or "warn"`,
        source: "env-invalid",
        provenance,
      });
    }
    return open({ mode, source: "env", reason: `SVC_CHAIN_POLICY=${mode} overrides shared/home policy files`, provenance });
  }

  const identity = repositoryIdentity(start);
  const sharedPath = path.join(identity.gitCommonDir, "svc-chain-policy.json");
  const localPath = path.join(identity.checkout, ".svc", "chain-policy.json");
  // Respect an explicitly-injected env.HOME (test isolation / non-ambient
  // callers) before falling back to the OS-reported home directory.
  const homeDir = typeof env.HOME === "string" && env.HOME ? env.HOME : os.homedir();
  const homePath = path.join(homeDir, ".svc", "chain-policy.json");

  provenance.git_common_dir = identity.gitCommonDir;
  provenance.shared_path = sharedPath;
  provenance.local_path = localPath;
  provenance.home_path = homePath;

  const shared = readPolicyFile(sharedPath);
  const local = readPolicyFile(localPath);
  provenance.shared_exists = shared.exists;
  provenance.shared_hash = shared.hash || null;
  provenance.shared_mode = shared.mode || null;
  provenance.local_exists = local.exists;
  provenance.local_hash = local.hash || null;
  provenance.local_mode = local.mode || null;
  provenance.local_error = local.exists && !local.ok ? local.error : null;

  // AC-549-3: a worktree-local file is NEVER authority. It is only ever
  // compared against a present, valid shared file to catch drift. Equal
  // bytes -> non-authoritative mirror (fine, ignored). Any difference
  // (including "local is present but unreadable/malformed") is a conflict
  // that fails closed rather than silently trusting either file.
  if (local.exists && shared.exists && shared.ok) {
    if (!local.ok) {
      return closed({
        reason: `worktree-local chain-policy.json is unreadable/invalid while the shared repository policy is valid: local=${localPath} (${local.error}) shared=${sharedPath} (sha256 ${shared.hash}, mode="${shared.mode}")`,
        source: "conflict",
        conflict: true,
        provenance,
      });
    }
    if (local.hash !== shared.hash) {
      return closed({
        reason: `worktree-local chain-policy.json disagrees with the shared repository policy: local=${localPath} (sha256 ${local.hash}, mode="${local.mode}") shared=${sharedPath} (sha256 ${shared.hash}, mode="${shared.mode}")`,
        source: "conflict",
        conflict: true,
        provenance,
      });
    }
    // byte-identical: local is a non-authoritative mirror; shared still decides.
  }

  // Tier 2: repository-shared authority.
  if (shared.exists) {
    if (!shared.ok) {
      return closed({
        reason: `shared chain-policy.json is unreadable/invalid: ${shared.error}`,
        source: "shared-invalid",
        provenance,
      });
    }
    return open({ mode: shared.mode, source: "shared", reason: `resolved from repository-shared policy ${sharedPath}`, provenance });
  }

  // Tier 3: owner-home fallback.
  const home = readPolicyFile(homePath);
  provenance.home_exists = home.exists;
  provenance.home_hash = home.hash || null;
  provenance.home_mode = home.mode || null;
  if (home.exists) {
    if (!home.ok) {
      return closed({
        reason: `owner-home chain-policy.json is unreadable/invalid: ${home.error}`,
        source: "home-invalid",
        provenance,
      });
    }
    return open({ mode: home.mode, source: "home", reason: `resolved from owner-home policy ${homePath}`, provenance });
  }

  // Tier 4: fail-closed. No file anywhere means "refuse", never "warn".
  return closed({
    reason: `no chain-policy.json found at SVC_CHAIN_POLICY, ${sharedPath}, or ${homePath}; failing closed to "refuse"`,
    source: "fail-closed",
    provenance,
  });
}

/**
 * One-time migration helper (per the WI-549 migration note): seed
 * $(git-common-dir)/svc-chain-policy.json from an existing canonical policy
 * file. Idempotent — a no-op when the shared file already exists, unless
 * `force` is set.
 */
export function seedSharedChainPolicy({ start = process.cwd(), fromPath = null, force = false } = {}) {
  const identity = repositoryIdentity(start);
  const sharedPath = path.join(identity.gitCommonDir, "svc-chain-policy.json");
  if (fs.existsSync(sharedPath) && !force) {
    return { seeded: false, reason: "shared chain-policy.json already exists", path: sharedPath };
  }
  const sourcePath = fromPath ? path.resolve(fromPath) : path.join(identity.checkout, ".svc", "chain-policy.json");
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`cannot seed shared chain-policy.json: source ${sourcePath} does not exist`);
  }
  const raw = fs.readFileSync(sourcePath, "utf8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new Error(`source ${sourcePath} is not valid JSON: ${error.message}`);
  }
  if (!VALID_MODES.has(data.mode)) {
    throw new Error(`source ${sourcePath} has an invalid "mode" field (${JSON.stringify(data.mode)})`);
  }
  fs.mkdirSync(path.dirname(sharedPath), { recursive: true });
  const body = raw.endsWith("\n") ? raw : `${raw}\n`;
  const tmp = `${sharedPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, body, { mode: 0o644 });
  fs.renameSync(tmp, sharedPath);
  return { seeded: true, path: sharedPath, source: sourcePath, mode: data.mode, sha256: sha256Hex(Buffer.from(body)) };
}

// CLI ------------------------------------------------------------------

function parseArgs(argv) {
  const out = { mode: false, json: false, repo: null, from: null, force: false, command: null };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === "--mode") out.mode = true;
    else if (tok === "--json") out.json = true;
    else if (tok === "--repo") out.repo = argv[++i];
    else if (tok === "--from") out.from = argv[++i];
    else if (tok === "--force") out.force = true;
    else if (tok === "migrate-seed") out.command = "migrate-seed";
  }
  return out;
}

function emitDiagnosticIfNotable(resolved) {
  if (AUTHORITATIVE_SOURCES.has(resolved.source)) return;
  process.stderr.write(`svc chain-policy: ${resolved.reason}\n`);
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
  }
}

if (isMainModule()) {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "migrate-seed") {
    try {
      const result = seedSharedChainPolicy({ start: args.repo || process.cwd(), fromPath: args.from, force: args.force });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } catch (error) {
      process.stderr.write(`chain-policy migrate-seed: ${error.message}\n`);
      process.exitCode = 1;
    }
  } else {
    const resolved = resolveChainPolicy({ start: args.repo || process.cwd() });
    emitDiagnosticIfNotable(resolved);
    if (args.mode) process.stdout.write(`${resolved.mode}\n`);
    else process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
  }
}
