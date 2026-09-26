import path from "node:path";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../../hooks/lib/enforcement-core.mjs";

const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

/** Wrap only commands emitted by SVC wirers. The child command is encoded as data. */
export function hookTimeoutMs(command) {
  if (String(command).includes("svc-session-start-healthcheck")) return 300000;
  if (String(command).includes("svc-stop-quality") || String(command).includes("svc-kimi-stop-quality")) return 540000;
  return 20000;
}

export function wrapHookCommand(command, { skillsPath, host, event, timeoutMs }) {
  const names = String(command).match(/svc-[a-zA-Z0-9._-]+/g) || [];
  const identity = names.findLast((name) => name !== "svc-enforce") || names[0] || "svc-hook";
  const marker = command.includes("svc-enforce") ? `svc-enforce ${identity}` : identity;
  const encoded = Buffer.from(JSON.stringify({ command, host, event, timeoutMs: timeoutMs ?? hookTimeoutMs(command) }), "utf8").toString("base64url");
  let boundary = path.join(skillsPath, "hooks", "svc-hook-boundary.mjs");
  try {
    const durable = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "hooks", "svc-hook-boundary.mjs");
    if (launcherRunnable(durable, { boundary: resolveStateRoot(process.env) })) boundary = durable;
  } catch { /* non-materialized fixture: use installed source */ }
  return `${quote(process.execPath)} ${quote(boundary)} ${marker} --spec ${encoded}`;
}

export function wrapHookEntries(entries, options) {
  if (Array.isArray(entries)) return entries.map((entry) => wrapHookEntries(entry, options));
  if (!entries || typeof entries !== "object") return entries;
  const result = {};
  const command = typeof entries.command === "string" ? entries.command : "";
  const nativeTimeout = command.includes("svc-session-start-healthcheck") ? 330
    : /svc-(?:kimi-)?stop-quality/.test(command) ? 570 : options.outerTimeout;
  for (const [key, value] of Object.entries(entries)) {
    if (key === "command" && typeof value === "string") {
      result[key] = wrapHookCommand(value, options);
    } else if (key === "timeout" && typeof value === "number" && nativeTimeout) {
      result[key] = options.host === "gemini" ? nativeTimeout * 1000 : nativeTimeout;
    } else if (key === "hooks" && value && typeof value === "object") {
      result[key] = wrapHookEntries(value, options);
    } else {
      result[key] = value;
    }
  }
  if (command && options.outerTimeout && result.timeout === undefined) {
    result.timeout = options.host === "gemini" ? nativeTimeout * 1000 : nativeTimeout;
  }
  return result;
}
