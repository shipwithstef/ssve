// Centralized worktree policy loader and resolver.
// Owner config lives at ~/.svc/worktree-policy.json (see schemas/worktree-policy.schema.json).
// A missing file yields built-in defaults. A present but corrupt file fails closed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const DEFAULT_POLICY_VERSION = 1;
export const DEFAULT_WORKTREES_ROOT = "~/worktrees";
export const DEFAULT_PERMISSIONS = "0700";

const PERMISSIONS_RE = /^0[0-7]{3}$/;
const policyCache = new Map();

export function expandHome(filePath) {
  if (typeof filePath !== "string") return filePath;
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/")) return path.join(os.homedir(), filePath.slice(2));
  return filePath;
}

function canonicalizeExisting(filePath) {
  const resolved = path.resolve(expandHome(filePath));
  try {
    return fs.realpathSync(resolved);
  } catch {
    return resolved;
  }
}

function presentAsFileOrLink(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (err) {
    if (err && err.code === "ENOENT") return false;
    return true;
  }
}

export function locatePolicyFile(env = process.env) {
  const home = os.homedir();
  const svcPath = path.join(home, ".svc", "worktree-policy.json");
  const xdgPath = path.join(home, ".config", "svc", "worktree-policy.json");
  if (env?.SVC_WORKTREE_POLICY) {
    return path.resolve(expandHome(String(env.SVC_WORKTREE_POLICY)));
  }
  if (presentAsFileOrLink(svcPath)) return svcPath;
  if (presentAsFileOrLink(xdgPath)) return xdgPath;
  return svcPath;
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

function assertPolicyShape(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("policy must be a JSON object");
  }
  if (!Number.isInteger(value.schema_version) || value.schema_version < 1) {
    throw new Error("schema_version must be an integer >= 1");
  }
  if (typeof value.default_root !== "string" || value.default_root.length === 0) {
    throw new Error("default_root must be a non-empty string");
  }
  if (value.naming_strategy !== undefined && value.naming_strategy !== "hierarchical" && value.naming_strategy !== "flat") {
    throw new Error("naming_strategy must be 'hierarchical' or 'flat'");
  }
  if (value.permissions !== undefined && (typeof value.permissions !== "string" || !PERMISSIONS_RE.test(value.permissions))) {
    throw new Error("permissions must match ^0[0-7]{3}$");
  }
  if (value.projects !== undefined) {
    if (value.projects === null || typeof value.projects !== "object" || Array.isArray(value.projects)) {
      throw new Error("projects must be an object");
    }
    for (const [name, project] of Object.entries(value.projects)) {
      if (project === null || typeof project !== "object" || Array.isArray(project)) {
        throw new Error(`projects.${name} must be an object`);
      }
      if (typeof project.root !== "string" || project.root.length === 0) {
        throw new Error(`projects.${name}.root is required`);
      }
      if (project.permissions !== undefined && (typeof project.permissions !== "string" || !PERMISSIONS_RE.test(project.permissions))) {
        throw new Error(`projects.${name}.permissions must match ^0[0-7]{3}$`);
      }
    }
  }
}

export function resetWorktreePolicyCache() {
  policyCache.clear();
}

export function assertConfiguredRootSafe(rootPath) {
  const expanded = path.resolve(expandHome(String(rootPath || "")));
  let current = expanded;
  while (true) {
    let st;
    try {
      st = fs.lstatSync(current);
    } catch (err) {
      if (err && err.code === "ENOENT") {
        const parent = path.dirname(current);
        if (parent === current) break;
        current = parent;
        continue;
      }
      throw new Error("WORKTREE_POLICY_INVALID: configured worktree root is unreadable: " + err.message);
    }
    if (st.isSymbolicLink()) {
      throw new Error("WORKTREE_POLICY_INVALID: configured worktree root must not be a symlink: " + rootPath);
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  if (!presentAsFileOrLink(expanded)) return;
  try {
    const real = fs.realpathSync(expanded);
    if (real !== expanded) {
      throw new Error("WORKTREE_POLICY_INVALID: configured worktree root contains a symlink escaping the designated area: " + rootPath);
    }
  } catch (err) {
    if (String(err.message || "").startsWith("WORKTREE_POLICY_INVALID")) throw err;
  }
}

export function loadWorktreePolicy(env = process.env) {
  const policyPath = locatePolicyFile(env);
  let lstat;
  try {
    lstat = fs.lstatSync(policyPath);
  } catch (err) {
    if (err && err.code === "ENOENT") return defaultPolicy(env);
    throw new Error("WORKTREE_POLICY_INVALID: Policy file exists but contains invalid JSON or structure: " + err.message);
  }
  if (lstat.isSymbolicLink()) {
    throw new Error("WORKTREE_POLICY_INVALID: Policy file must not be a symlink");
  }
  let stat;
  try {
    stat = fs.statSync(policyPath);
  } catch (err) {
    throw new Error("WORKTREE_POLICY_INVALID: Policy file exists but contains invalid JSON or structure: " + err.message);
  }
  if (stat.uid !== process.getuid()) {
    throw new Error("WORKTREE_POLICY_INVALID: Policy file is owned by foreign UID " + stat.uid);
  }
  if ((stat.mode & 0o077) !== 0) {
    throw new Error("WORKTREE_POLICY_INVALID: Policy file permissions are too open (must be 0600, got " + (stat.mode & 0o777).toString(8) + ")");
  }
  const cached = policyCache.get(policyPath);
  if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
    return cached.policy;
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(policyPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || !parsed.schema_version || !parsed.default_root) {
      throw new Error("WORKTREE_POLICY_INVALID: Missing required schema fields (schema_version, default_root)");
    }
    assertPolicyShape(parsed);
  } catch (err) {
    if (String(err.message || "").startsWith("WORKTREE_POLICY_INVALID")) throw err;
    throw new Error("WORKTREE_POLICY_INVALID: Policy file exists but contains invalid JSON or structure: " + err.message);
  }
  const policy = {
    schema_version: parsed.schema_version,
    default_root: parsed.default_root,
    naming_strategy: parsed.naming_strategy || "hierarchical",
    permissions: parsed.permissions || DEFAULT_PERMISSIONS,
    projects: parsed.projects || {},
  };
  policyCache.set(policyPath, { mtimeMs: stat.mtimeMs, size: stat.size, policy });
  return policy;
}

export function repoIdentifier(repoRoot) {
  return path.basename(fs.realpathSync(repoRoot));
}

export function resolveWorktreesRoot(repoRoot, env = process.env) {
  const policy = loadWorktreePolicy(env);
  const repoName = repoIdentifier(repoRoot);
  const project = policy.projects?.[repoName];
  if (project?.root) {
    return canonicalizeExisting(project.root);
  }
  const baseRoot = canonicalizeExisting(policy.default_root || DEFAULT_WORKTREES_ROOT);
  if (policy.naming_strategy === "flat") return baseRoot;
  return path.join(baseRoot, repoName);
}

function pushUnique(list, filePath) {
  if (!filePath) return;
  const canonical = canonicalizeExisting(filePath);
  if (!list.includes(canonical)) list.push(canonical);
}

export function resolveApprovedRoots(repoRoot, env = process.env) {
  const policy = loadWorktreePolicy(env);
  assertConfiguredRootSafe(policy.default_root || DEFAULT_WORKTREES_ROOT);
  for (const project of Object.values(policy.projects || {})) {
    if (project?.root) assertConfiguredRootSafe(project.root);
  }
  const roots = [];
  pushUnique(roots, resolveWorktreesRoot(repoRoot, env));
  pushUnique(roots, policy.default_root || DEFAULT_WORKTREES_ROOT);
  const legacyRoot = path.join(path.resolve(repoRoot), ".worktrees");
  assertConfiguredRootSafe(legacyRoot);
  pushUnique(roots, legacyRoot);
  for (const project of Object.values(policy.projects || {})) {
    if (project?.root) pushUnique(roots, project.root);
  }
  for (const entry of String(env?.SVC_APPROVED_WORKTREE_ROOTS || "").split(":")) {
    if (!entry) continue;
    assertConfiguredRootSafe(entry);
    pushUnique(roots, entry);
  }
  return roots;
}

function isContained(root, candidate) {
  const rel = path.relative(root, candidate);
  return rel === "" || (!!rel && !rel.startsWith("..") && !path.isAbsolute(rel));
}

export function isApprovedWorktreeRoot(candidatePath, repoRoot, env = process.env) {
  const resolved = path.resolve(expandHome(String(candidatePath || "")));
  let real = resolved;
  try {
    real = fs.realpathSync(resolved);
  } catch {
    // Candidate may not exist yet (new worktree path).
  }
  for (const root of resolveApprovedRoots(repoRoot, env)) {
    if (isContained(root, real) || isContained(root, resolved)) {
      return { ok: true, root, realpath: real };
    }
  }
  return {
    ok: false,
    reason_code: "WORKTREE_ROOT_UNAPPROVED",
    reason: `no approved worktree root contains ${real}`,
  };
}

export function ensureWorktreesDirectory(dirPath, permissions = DEFAULT_PERMISSIONS) {
  const target = path.resolve(expandHome(dirPath));
  const mode = parseInt(permissions, 8);
  const created = [];
  let cursor = target;
  while (!presentAsFileOrLink(cursor)) {
    created.push(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  fs.mkdirSync(target, { recursive: true });
  for (const dir of created) {
    try { fs.chmodSync(dir, mode); } catch {}
  }
  try { fs.chmodSync(target, mode); } catch {}
  return target;
}
