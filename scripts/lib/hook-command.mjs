import path from "node:path";
import { MIGRATION_VERSION, resolveStateRoot, launcherRunnable } from "../../hooks/lib/enforcement-core.mjs";
import { parseManagedCommand } from "../../hooks/svc-hook-boundary.mjs";

const quote = (value) => `'${String(value).replace(/'/g, "'\\''")}'`;

/** Wrap only commands emitted by SVC wirers. The child command is encoded as data. */
export function hookTimeoutMs(command) {
  if (String(command).includes("svc-session-start-healthcheck")) return 300000;
  if (String(command).includes("svc-stop-quality") || String(command).includes("svc-kimi-stop-quality")) return 540000;
  return 20000;
}

export function wrapHookCommand(command, { skillsPath, host, event, timeoutMs }) {
  // Reject malformed generated commands at setup, before the host trusts a
  // definition that would fail on every invocation.
  parseManagedCommand(command, { ...process.env, SVC_HOST: host });
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
  // Codex, Claude, Cursor, Kimi and Grok use seconds; Gemini uses
  // milliseconds. The host deadline includes startup and exceeds the inner
  // boundary deadline (20s normally, 300s/540s for deferred lifecycle work).
  const outerDefault = options.host === "gemini" ? 30000 : 30;
  const seconds = command.includes("svc-session-start-healthcheck") ? 330
    : /svc-(?:kimi-)?stop-quality/.test(command) ? 570 : null;
  const nativeTimeout = seconds === null ? (options.outerTimeout ?? outerDefault)
    : options.host === "gemini" ? seconds * 1000 : seconds;
  for (const [key, value] of Object.entries(entries)) {
    if (key === "command" && typeof value === "string") {
      result[key] = wrapHookCommand(value, options);
    } else if (key === "timeout" && typeof value === "number" && nativeTimeout) {
      result[key] = nativeTimeout;
    } else if (key === "hooks" && value && typeof value === "object") {
      result[key] = wrapHookEntries(value, options);
    } else {
      result[key] = value;
    }
  }
  if (command && result.timeout === undefined) {
    result.timeout = nativeTimeout;
  }
  return result;
}
