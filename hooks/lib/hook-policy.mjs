import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MODES = new Set(["advisory", "enforce"]);

/** Runtime preference: process override, then owner file, then advisory. */
export function resolveHookMode(env = process.env, home = env.HOME || os.homedir()) {
  if (Object.hasOwn(env, "SVC_HOOK_MODE")) {
    const mode = String(env.SVC_HOOK_MODE).trim().toLowerCase();
    return MODES.has(mode)
      ? { mode, source: "env" }
      : { mode: "advisory", source: "env", warning: `invalid SVC_HOOK_MODE '${env.SVC_HOOK_MODE}'; using advisory` };
  }
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

export function hookPolicyWarning(result, output = process.stderr) {
  if (result.warning) output.write(`[svc hook policy] ${result.warning}\n`);
}
