import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MODES = new Set(["advisory", "enforce"]);

function ownerPolicy(home) {
  const policy = path.join(home, ".svc", "hook-policy.json");
  let raw;
  try {
    raw = fs.readFileSync(policy, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { mode: "advisory", source: "default" };
    return { mode: "advisory", source: "file", warning: `cannot read ${policy}: ${error.message}; using advisory` };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && MODES.has(parsed.mode)) {
      return { mode: parsed.mode, source: "file" };
    }
  } catch { /* malformed policy is reported below */ }
  return { mode: "advisory", source: "file", warning: `invalid ${policy}; expected {"mode":"advisory"} or {"mode":"enforce"}; using advisory` };
}

/**
 * Owner file first, then the environment, then advisory. The environment can raise
 * advisory to enforce but never lower an owner's enforce: host and repository
 * settings can set env, and a cloned repository must not switch off the owner's
 * enforcement. To leave enforce, the owner edits ~/.svc/hook-policy.json.
 */
export function resolveHookMode(env = process.env, home = env.HOME || os.homedir()) {
  const owner = ownerPolicy(home);
  if (!Object.hasOwn(env, "SVC_HOOK_MODE")) return owner;
  const mode = String(env.SVC_HOOK_MODE).trim().toLowerCase();
  if (!MODES.has(mode)) {
    const warning = `invalid SVC_HOOK_MODE '${env.SVC_HOOK_MODE}'; using ${owner.mode}`;
    return { ...owner, warning: [owner.warning, warning].filter(Boolean).join("; ") };
  }
  if (owner.mode === "enforce" && mode === "advisory") {
    return { mode: "enforce", source: "file", warning: "SVC_HOOK_MODE=advisory ignored: ~/.svc/hook-policy.json sets enforce, and only that file can lower it" };
  }
  return { mode, source: "env" };
}

export function hookPolicyWarning(result, output = process.stderr) {
  if (result.warning) output.write(`[svc hook policy] ${result.warning}\n`);
}

/**
 * Per-repo opt-out (scripts/svc-repo.mjs off sets SVC_REPO_MODE=off). It applies only in
 * advisory mode; resolveHookMode already keeps an owner's enforce over any env value.
 */
export function repoOptOut(env = process.env, home = env.HOME || os.homedir(), mode = resolveHookMode(env, home)) {
  return env.SVC_REPO_MODE === "off" && mode.mode !== "enforce";
}
