import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function currentUid() {
  return typeof process.getuid === "function" ? process.getuid() : null;
}

function statOwnedDirectory(dir, { privateMode = true, label = "runtime directory" } = {}) {
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} is not a real directory: ${dir}`);
  const uid = currentUid();
  if (uid !== null && stat.uid !== uid) throw new Error(`${label} is not owned by the current user: ${dir}`);
  const mode = stat.mode & 0o777;
  if (privateMode ? mode !== 0o700 : (mode & 0o022) !== 0) {
    throw new Error(`${label} has unsafe mode ${mode.toString(8)}: ${dir}`);
  }
  return stat;
}

export function assertPrivateDirectory(dir, label = "runtime directory") {
  try {
    statOwnedDirectory(dir, { privateMode: true, label });
    return fs.realpathSync(dir);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`${label} must be a pre-existing current-user directory with mode 0700: ${dir}`);
    throw error;
  }
}

export function ensurePrivateDirectory(dir, { parent, label = "runtime directory" } = {}) {
  const absolute = path.resolve(dir);
  const expectedParent = fs.realpathSync(parent || path.dirname(absolute));
  let created = false;
  try {
    fs.mkdirSync(absolute, { mode: 0o700 });
    created = true;
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  if (created) fs.chmodSync(absolute, 0o700);
  const real = assertPrivateDirectory(absolute, label);
  if (path.dirname(real) !== expectedParent) throw new Error(`${label} escaped its validated parent: ${absolute}`);
  return real;
}

function validateLeaf(leaf) {
  if (typeof leaf !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,126}$/.test(leaf)) {
    throw new Error("runtime leaf must be one safe path segment");
  }
  return leaf;
}

function configuredAbsolute(value, variable) {
  if (!path.isAbsolute(String(value || ""))) throw new Error(`${variable} must be an absolute path`);
  return path.normalize(String(value));
}

function ensureCacheParent(env) {
  const configuredHome = configuredAbsolute(env.HOME || os.homedir(), "HOME");
  const home = fs.realpathSync(configuredHome);
  statOwnedDirectory(home, { privateMode: false, label: "HOME" });
  const cache = path.join(home, ".cache");
  try {
    fs.mkdirSync(cache, { mode: 0o700 });
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
  }
  statOwnedDirectory(cache, { privateMode: false, label: "HOME cache directory" });
  const real = fs.realpathSync(cache);
  if (path.dirname(real) !== home) throw new Error(`HOME cache directory escaped HOME: ${cache}`);
  return real;
}

function createLeaf(parent, leaf, label) {
  const trustedParent = assertPrivateDirectory(parent, `${label} parent`);
  return ensurePrivateDirectory(path.join(trustedParent, leaf), { parent: trustedParent, label });
}

function homeFallback(env, leaf, legacyCodexHome, fallbackReason) {
  const cache = ensureCacheParent(env);
  if (legacyCodexHome) {
    return {
      path: ensurePrivateDirectory(path.join(cache, "svc-codex-runtime"), { parent: cache, label: "Codex runtime directory" }),
      source: "home-cache-fallback",
      fallback_reason: fallbackReason,
    };
  }
  const shared = ensurePrivateDirectory(path.join(cache, "svc-runtime"), { parent: cache, label: "SVC runtime parent" });
  return {
    path: createLeaf(shared, leaf, "SVC runtime leaf"),
    source: "home-cache-fallback",
    fallback_reason: fallbackReason,
  };
}

export function resolveRuntimeDirectory({
  env = process.env,
  leaf,
  legacyCodexDirect = false,
  legacyCodexHome = false,
} = {}) {
  const safeLeaf = validateLeaf(leaf);

  if (env.SVC_RUNTIME_DIR) {
    const parent = configuredAbsolute(env.SVC_RUNTIME_DIR, "SVC_RUNTIME_DIR");
    return { path: createLeaf(parent, safeLeaf, "SVC runtime leaf"), source: "svc-runtime-dir", fallback_reason: null };
  }

  if (legacyCodexDirect && env.SVC_CODEX_RUNTIME_DIR) {
    const direct = configuredAbsolute(env.SVC_CODEX_RUNTIME_DIR, "SVC_CODEX_RUNTIME_DIR");
    return { path: assertPrivateDirectory(direct, "Codex runtime directory"), source: "svc-codex-runtime-dir", fallback_reason: null };
  }

  if (env.XDG_RUNTIME_DIR) {
    const xdg = configuredAbsolute(env.XDG_RUNTIME_DIR, "XDG_RUNTIME_DIR");
    try {
      fs.lstatSync(xdg);
    } catch (error) {
      if (error.code === "ENOENT") return homeFallback(env, safeLeaf, legacyCodexHome, "xdg-enoent");
      throw new Error(`XDG_RUNTIME_DIR is not accessible: ${error.message}`);
    }
    return { path: createLeaf(xdg, safeLeaf, "SVC XDG runtime leaf"), source: "xdg-runtime-dir", fallback_reason: null };
  }

  return homeFallback(env, safeLeaf, legacyCodexHome, "xdg-unset");
}
