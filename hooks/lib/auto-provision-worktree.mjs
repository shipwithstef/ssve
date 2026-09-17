// Shared auto-provision / self-heal for default-checkout mutations.
// Dispatcher and isolation-guard both call this instead of telling the
// operator to invoke svc-ensure-worktree by hand.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { extractWiId, isValidWiId } from "./wi-id.mjs";
import { defaultCheckoutRoot, uniqueLaneWi, worktreeRoots } from "./authoritative-binding.mjs";
import {
  authorityStateRoot,
  listControllers,
  repositoryId,
} from "./authority-store.mjs";
import { resolveAuthorityHost, wiFromBranch } from "./resolve-wi.mjs";

const PATH_KEYS = ["file_path", "filePath", "path", "file"];
const DIR_KEYS = ["workdir", "cwd", "working_directory", "workingDirectory"];

function realpathOrEmpty(value) {
  try { return fs.realpathSync(value); } catch { return ""; }
}

function currentBranch(cwd) {
  try {
    return execFileSync("git", ["-C", cwd, "branch", "--show-current"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function worktreeRows(repo) {
  const rows = [];
  let current = { path: "", branch: "" };
  try {
    const out = execFileSync("git", ["-C", repo, "worktree", "list", "--porcelain"], {
      encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
    });
    for (const line of String(out || "").split(/\r?\n/)) {
      if (line.startsWith("worktree ")) {
        if (current.path) rows.push(current);
        let resolved = "";
        try { resolved = fs.realpathSync(line.slice(9)); } catch { resolved = ""; }
        current = { path: resolved, branch: "" };
      } else if (line.startsWith("branch ")) {
        current.branch = line.slice(7).replace(/^refs\/heads\//, "");
      }
    }
    if (current.path) rows.push(current);
  } catch {}
  return rows;
}

function sessionSlug(sessionId) {
  const compact = String(sessionId || "session").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return (compact.slice(0, 12) || "SESSION");
}

function readContractWi(root) {
  const file = path.join(root, ".svc", "session-contract.jsonl");
  if (!fs.existsSync(file)) return "";
  try {
    const lines = fs.readFileSync(file, "utf8").trim().split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const row = JSON.parse(lines[i]);
      const wi = extractWiId(row?.wi || "");
      if (wi) return wi;
    }
  } catch {}
  return "";
}

function rewriteAbsolute(value, defaultRoot, worktree) {
  if (typeof value !== "string" || !value.trim()) return value;
  if (!path.isAbsolute(value)) return value;
  const relative = path.relative(defaultRoot, value);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`)) return value;
  return path.join(worktree, relative);
}

export function isDefaultCheckoutIsolationReason(reason) {
  return /AUTH_BINDING_MISSING|default checkout is forbidden|repository mutation in or from the default checkout/i.test(String(reason || ""));
}

export function isPreProvisionIsolationDenial(reason) {
  const text = String(reason || "");
  if (/SELF_PROVISION_ATTEMPTED/.test(text)) return false;
  return isDefaultCheckoutIsolationReason(text);
}

export function rebindToolInput(input, defaultRoot, worktree) {
  const next = input && typeof input === "object" && !Array.isArray(input) ? { ...input } : {};
  for (const key of DIR_KEYS) {
    if (key in next) next[key] = worktree;
  }
  next.workdir = worktree;
  for (const key of PATH_KEYS) {
    if (typeof next[key] === "string") next[key] = rewriteAbsolute(next[key], defaultRoot, worktree);
  }
  for (const key of ["paths", "file_paths", "filePaths", "files"]) {
    if (!Array.isArray(next[key])) continue;
    next[key] = next[key].map((entry) => {
      if (typeof entry === "string") return rewriteAbsolute(entry, defaultRoot, worktree);
      if (entry && typeof entry === "object") {
        const copy = { ...entry };
        for (const field of PATH_KEYS) {
          if (typeof copy[field] === "string") copy[field] = rewriteAbsolute(copy[field], defaultRoot, worktree);
        }
        return copy;
      }
      return entry;
    });
  }
  return next;
}

export function rebindMutationPayload(payload, defaultRoot, worktree) {
  if (!payload || typeof payload !== "object") return payload;
  const key = payload.tool_input ? "tool_input"
    : payload.toolInput ? "toolInput"
      : payload.arguments ? "arguments"
        : payload.args ? "args"
          : "tool_input";
  const input = payload[key] && typeof payload[key] === "object" ? payload[key] : {};
  return {
    ...payload,
    cwd: worktree,
    [key]: rebindToolInput(input, defaultRoot, worktree),
  };
}

export function resolveProvisionTarget({ repo, payload = {}, env = process.env, sessionId = "" } = {}) {
  const defaultRoot = defaultCheckoutRoot(repo) || realpathOrEmpty(repo);
  if (!defaultRoot) return { ok: false, reason: "WORKTREE_UNRESOLVED" };
  const rows = worktreeRows(repo).filter((row) => row.path && row.path !== defaultRoot);
  const withWi = rows.map((row) => ({ ...row, wi: uniqueLaneWi(row.path) || extractWiId(row.branch) }));

  if (withWi.length === 1 && withWi[0].wi) {
    return { ok: true, wi: withWi[0].wi, branch: withWi[0].branch, existing: withWi[0].path, defaultRoot };
  }
  const uniqueWis = [...new Set(withWi.map((row) => row.wi).filter(Boolean))];
  if (uniqueWis.length === 1) {
    const match = withWi.filter((row) => row.wi === uniqueWis[0]);
    if (match.length === 1) {
      return { ok: true, wi: match[0].wi, branch: match[0].branch, existing: match[0].path, defaultRoot };
    }
  }

  try {
    const leases = listControllers({
      stateRoot: authorityStateRoot(defaultRoot, env),
      repoId: repositoryId(defaultRoot),
      states: ["active"],
    });
    const live = leases.filter((lease) => {
      const target = realpathOrEmpty(lease.worktree_root);
      return target && target !== defaultRoot;
    });
    if (live.length === 1 && isValidWiId(live[0].wi)) {
      const target = realpathOrEmpty(live[0].worktree_root);
      const row = withWi.find((item) => item.path === target);
      return {
        ok: true,
        wi: live[0].wi,
        branch: row?.branch || currentBranch(target),
        existing: target,
        defaultRoot,
      };
    }
  } catch {}

  const hinted = extractWiId(env.SVC_WORKER_WI || env.SVC_WI || "")
    || extractWiId(readContractWi(defaultRoot))
    || extractWiId(JSON.stringify(payload?.tool_input || payload?.toolInput || {}));
  if (hinted) {
    const match = withWi.filter((row) => row.wi === hinted);
    if (match.length === 1) {
      return { ok: true, wi: hinted, branch: match[0].branch, existing: match[0].path, defaultRoot };
    }
    const branch = String(env.SVC_WORKTREE_BRANCH || "").trim() || `feature-${hinted.toLowerCase()}`;
    return { ok: true, wi: hinted, branch, existing: null, defaultRoot };
  }

  const branchNow = currentBranch(defaultRoot);
  if (branchNow && !["main", "master"].includes(branchNow)) {
    const match = withWi.find((row) => row.branch === branchNow);
    if (match?.wi) {
      return { ok: true, wi: match.wi, branch: match.branch, existing: match.path, defaultRoot };
    }
    const derived = wiFromBranch(defaultRoot);
    if (derived) return { ok: true, wi: derived, branch: branchNow, existing: null, defaultRoot };
  }

  const slug = sessionSlug(sessionId);
  return {
    ok: true,
    wi: `WI-SESSION-${slug}`,
    branch: `feature-session-${slug.toLowerCase()}`,
    existing: withWi.find((row) => row.wi === `WI-SESSION-${slug}`)?.path || null,
    defaultRoot,
  };
}

export async function autoProvisionMissingBinding({
  payload = {},
  env = process.env,
  repo = "",
  sessionId = "",
  host = "",
} = {}) {
  const resolvedHost = host || resolveAuthorityHost(payload, env);
  if (!resolvedHost) return { ok: false, reason: "HOST_IDENTITY_MISSING" };
  const sid = String(sessionId || "").trim();
  if (!sid) return { ok: false, reason: "SESSION_IDENTITY_MISSING" };
  const root = realpathOrEmpty(repo);
  if (!root) return { ok: false, reason: "WORKTREE_UNRESOLVED" };

  const target = resolveProvisionTarget({ repo: root, payload, env, sessionId: sid });
  if (!target.ok) return target;

  const provisionEnv = {
    ...env,
    SVC_HOST: resolvedHost,
    SVC_SESSION_ID: sid,
  };
  try {
    const ensureModule = await import("../../scripts/svc-ensure-worktree.mjs");
    let adopted;
    if (target.existing) {
      adopted = ensureModule.adoptExistingWorktree({
        wi: target.wi,
        cwd: root,
        prepareSession: true,
        sessionId: sid,
      }, provisionEnv);
    } else {
      adopted = ensureModule.ensureWorktree({
        wi: target.wi,
        branch: target.branch,
        cwd: root,
        from: "origin/main",
      }, provisionEnv);
    }
    const worktree = adopted?.absolute_worktree || target.existing;
    if (!worktree) return { ok: false, reason: "PROVISION_DID_NOT_RESOLVE" };
    return {
      ok: true,
      wi: adopted?.wi || target.wi,
      branch: adopted?.branch || target.branch,
      worktree,
      defaultRoot: target.defaultRoot,
      payload: rebindMutationPayload(payload, target.defaultRoot, worktree),
      input: rebindToolInput(
        payload?.tool_input || payload?.toolInput || payload?.arguments || payload?.args || {},
        target.defaultRoot,
        worktree,
      ),
    };
  } catch (error) {
    return { ok: false, reason: error.message || "SELF_PROVISION_FAILED" };
  }
}

export function defaultCheckoutOf(repo) {
  return defaultCheckoutRoot(repo) || realpathOrEmpty(repo);
}

export function linkedWorktreeCount(repo) {
  const defaultRoot = defaultCheckoutOf(repo);
  return worktreeRoots(repo).filter((row) => row && row !== defaultRoot).length;
}
