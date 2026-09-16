import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const DEFAULT_POLICY_VERSION = 1;
export const DEFAULT_WORKTREES_ROOT = "~/worktrees";
export const DEFAULT_PERMISSIONS = "0700";

let cachedPolicy = null;
let cachedMtime = 0;
let cachedPath = null;

export function expandHome(filePath) {
  if (typeof filePath !== "string") return filePath;
  if (filePath === "~" || filePath.startsWith("~" + path.sep) || filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(1).replace(/^[/\\]/, ""));
  }
  return filePath;
}

export function locatePolicyFile(env = process.env) {
  if (env.SVC_WORKTREE_POLICY) {
    return path.resolve(expandHome(env.SVC_WORKTREE_POLICY));
  }
  const svcCandidate = path.join(os.homedir(), ".svc", "worktree-policy.json");
  if (fs.existsSync(svcCandidate)) return svcCandidate;

  const configCandidate = path.join(os.homedir(), ".config", "svc", "worktree-policy.json");
  if (fs.existsSync(configCandidate)) return configCandidate;

  // Default target location if file doesn't exist yet
  return svcCandidate;
}

export function defaultPolicy(env = process.env) {
  return {
    schema_version: DEFAULT_POLICY_VERSION,
    default_root: env?.SVC_WORKTREES_ROOT || DEFAULT_WORKTREES_ROOT,
    naming_strategy: "hierarchical",
    permissions: DEFAULT_PERMISSIONS,
    projects: {},
  };
}

export function loadWorktreePolicy(env = process.env) {
  const policyPath = locatePolicyFile(env);
  if (!fs.existsSync(policyPath)) {
    return defaultPolicy(env);
  }

  try {
    const stat = fs.statSync(policyPath);
    if (!env?.SVC_WORKTREES_ROOT && cachedPolicy && cachedPath === policyPath && cachedMtime === stat.mtimeMs) {
      return cachedPolicy;
    }
    const content = fs.readFileSync(policyPath, "utf8");
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") {
      cachedPolicy = {
        schema_version: Number(parsed.schema_version) || DEFAULT_POLICY_VERSION,
        default_root: env?.SVC_WORKTREES_ROOT || parsed.default_root || DEFAULT_WORKTREES_ROOT,
        naming_strategy: parsed.naming_strategy || "hierarchical",
        permissions: parsed.permissions || DEFAULT_PERMISSIONS,
        projects: parsed.projects && typeof parsed.projects === "object" ? parsed.projects : {},
      };
      cachedMtime = stat.mtimeMs;
      cachedPath = policyPath;
      return cachedPolicy;
    }
  } catch {}

  return defaultPolicy(env);
}

export function repoIdentifier(repoRoot) {
  try {
    const real = fs.realpathSync(path.resolve(repoRoot));
    return path.basename(real);
  } catch {
    return path.basename(path.resolve(repoRoot));
  }
}

/**
 * Resolves the directory where worktrees for a specific repository should be placed.
 * e.g., for repository "ssve", returns "/home/user/worktrees/ssve" (or custom project root).
 */
export function resolveWorktreesRoot(repoRoot, env = process.env) {
  const policy = loadWorktreePolicy(env);
  const repoName = repoIdentifier(repoRoot);

  if (policy.projects && policy.projects[repoName]?.root) {
    return path.resolve(expandHome(policy.projects[repoName].root));
  }

  const baseRoot = path.resolve(expandHome(policy.default_root));
  if (policy.naming_strategy === "flat") {
    return baseRoot;
  }
  // Hierarchical: baseRoot/repoName
  return path.join(baseRoot, repoName);
}

/**
 * Returns an array of approved canonical directories where worktrees are permitted to exist.
 */
export function resolveApprovedRoots(repoRoot, env = process.env) {
  const roots = [];

  // 1. Centralized worktrees root for this repository
  try {
    const centralRoot = resolveWorktreesRoot(repoRoot, env);
    roots.push(centralRoot);
    // Also include the base parent (e.g. ~/worktrees) so nested worktree containment check passes
    const baseRoot = path.resolve(expandHome(loadWorktreePolicy(env).default_root));
    if (!roots.includes(baseRoot)) roots.push(baseRoot);
  } catch {}

  // 2. Legacy in-repo .worktrees (for backward compatibility)
  try {
    const legacy = path.join(fs.realpathSync(repoRoot), ".worktrees");
    if (!roots.includes(legacy)) roots.push(legacy);
  } catch {
    const legacyFallback = path.join(path.resolve(repoRoot), ".worktrees");
    if (!roots.includes(legacyFallback)) roots.push(legacyFallback);
  }

  // 3. Project-specific roots declared in policy
  try {
    const policy = loadWorktreePolicy(env);
    for (const projectConfig of Object.values(policy.projects || {})) {
      if (projectConfig?.root) {
        const pRoot = path.resolve(expandHome(projectConfig.root));
        if (!roots.includes(pRoot)) roots.push(pRoot);
      }
    }
  } catch {}

  // 4. Environment variable overrides (SVC_APPROVED_WORKTREE_ROOTS)
  const rawEnv = String(env.SVC_APPROVED_WORKTREE_ROOTS || "");
  for (const entry of rawEnv.split(":")) {
    if (!entry) continue;
    let real = null;
    try { real = fs.realpathSync(path.resolve(expandHome(entry))); } catch { continue; }
    try {
      if (!fs.statSync(real).isDirectory()) continue;
    } catch { continue; }
    if (real && !roots.includes(real)) roots.push(real);
  }

  return roots;
}

/**
 * Ensures a worktrees directory exists with the specified octal permissions.
 */
export function ensureWorktreesDirectory(dirPath, permissions = DEFAULT_PERMISSIONS) {
  const target = path.resolve(expandHome(dirPath));
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  try {
    const mode = parseInt(permissions, 8);
    if (!Number.isNaN(mode)) {
      fs.chmodSync(target, mode);
    }
  } catch {}
  return target;
}
