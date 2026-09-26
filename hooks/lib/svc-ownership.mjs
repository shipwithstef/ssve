// WI-562 IP-W2: ONE shared svc-ownership predicate for every host wirer.
//
// Replaces the per-host substring/regex heuristics (wire-hooks kimi-strip
// heuristics, wire-cursor-hooks `cmd.includes("svc-")`, wire-grok-hooks
// isSvcOwnedText) so identical command fixtures always yield identical
// verdicts across hosts.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MIGRATION_VERSION, resolveStateRoot } from "./enforcement-core.mjs";

// Governed svc hook script names: svc-<thing>.<mjs|js|sh> as a distinct token.
const SVC_SCRIPT_RE = /(?:^|[^\w.-])svc-[A-Za-z0-9._-]+\.(?:mjs|js|sh)\b/;
// The svc-enforce launcher. Suffix lookahead accepts a shell-quote because
// governed commands embed the launcher path QUOTED ('…/bin/svc-enforce' …);
// requiring \s|$ there misclassified installed governed entries as user-owned
// and made wirer rebuilds append duplicates (post-land OTA finding, 2026-08-26).
const SVC_ENFORCE_RE = /(?:^|[^\w.-])svc-enforce(?=['"]|\s|$)/;
const SVC_BOUNDARY_RE = /(?:^|[^\w.-])svc-hook-boundary\.mjs(?=['"]|\s|$)/;
// Skills hooks directory containment.
const SKILLS_HOOKS_RE = /\/skills\/hooks\//;
// Documented grok carve-out: user hooks under skills/hooks/user-keep.* are
// explicitly PRESERVED by the grok wirer — they are user property even though
// they live inside the hooks dir.
const USER_KEEP_RE = /\/hooks\/user-keep\./;

/**
 * Decide whether a host-config hook command is owned/managed by svc.
 * Owned commands are rebuilt (subtractive) by wirers; non-owned commands are
 * preserved byte-verbatim.
 *
 * @param {string} command - raw command text from a host config entry
 * @returns {boolean}
 */
export function isSvcOwnedCommand(command) {
  const cmd = String(command || "");
  if (!cmd.trim()) return false;
  if (USER_KEEP_RE.test(cmd)) return false;
  return SVC_SCRIPT_RE.test(cmd)
    || SVC_ENFORCE_RE.test(cmd)
    || SVC_BOUNDARY_RE.test(cmd)
    || SKILLS_HOOKS_RE.test(cmd);
}

/**
 * Inverse convenience matching the wirers' "keep non-svc" filters.
 */
export function isUserOwnedCommand(command) {
  return !isSvcOwnedCommand(command);
}

// Exact package identity for destructive migration. The broad legacy
// predicate above remains for compatibility but must not delete host hooks.
const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
function collectScripts(directory, prefix, target) {
  for (const item of fs.readdirSync(path.join(packageRoot, directory), { withFileTypes: true })) {
    const relative = `${prefix}/${item.name}`;
    if (item.isDirectory()) collectScripts(path.join(directory, item.name), relative, target);
    else if (item.isFile()) target.add(relative);
  }
}
let managedPaths;
function managedPathSet() {
  if (managedPaths) return managedPaths;
  const paths = new Set();
  collectScripts("hooks", "hooks", paths);
  collectScripts("scripts", "scripts", paths);
  for (const legacy of ["hooks/svc-workflow-guard.js", "hooks/svc-bash-guard.sh"]) paths.add(legacy);
  managedPaths = paths;
  return paths;
}

export function isKnownManagedCommand(command, skillsPath) {
  const raw = String(command || "");
  const encoded = raw.match(/(?:^|\s)--spec\s+([A-Za-z0-9_-]+)(?:\s|$)/)?.[1];
  if (encoded) {
    try {
      const outer = (raw.match(/'[^']*'|"[^"]*"|[^\s]+/g) || [])
        .map((word) => /^(['"])(.*)\1$/.test(word) ? word.slice(1, -1) : word);
      let boundaryRunner = path.basename(outer[0] || "") === "node" ||
        [process.execPath, process.env.SVC_NODE_BIN].filter(Boolean).includes(outer[0]);
      if (!boundaryRunner) {
        try { boundaryRunner = fs.realpathSync(outer[0]) === fs.realpathSync(process.execPath); } catch {}
      }
      if (!boundaryRunner) return false;
      const boundary = path.resolve(outer[1] || "");
      const installed = path.resolve(skillsPath, "hooks", "svc-hook-boundary.mjs");
      const durable = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "hooks", "svc-hook-boundary.mjs");
      if (boundary !== installed && boundary !== durable) return false;
      const nested = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
      return typeof nested.command === "string" && isKnownManagedCommand(nested.command, skillsPath);
    } catch { return false; }
  }
  // Only inspect executable and script tokens. Legacy input arguments may
  // contain shell expansions, but they cannot change the script identity.
  const argv = (raw.match(/'[^']*'|"[^"]*"|[^\s]+/g) || [])
    .map((word) => /^(['"])(.*)\1$/.test(word) ? word.slice(1, -1) : word);
  if (argv[0] === "env") argv.shift();
  while (/^[A-Za-z_][A-Za-z0-9_]*=/.test(argv[0] || "")) argv.shift();
  if (argv.length < 2) return false;
  let knownRunner = ["node", "bash"].includes(path.basename(argv[0])) ||
    [process.execPath, process.env.SVC_NODE_BIN].filter(Boolean).includes(argv[0]);
  if (!knownRunner) {
    try { knownRunner = fs.realpathSync(argv[0]) === fs.realpathSync(process.execPath); } catch {}
  }
  if (!knownRunner || /[`$*?\[\]{}]/.test(argv[1])) return false;
  const script = path.resolve(argv[1].replace(/^~(?=\/)/, process.env.HOME || ""));
  const roots = [path.resolve(skillsPath)];
  try { roots.push(path.resolve(fs.readFileSync(path.join(skillsPath, ".source-repo"), "utf8").trim())); } catch {}
  for (const root of roots) {
    const relative = path.relative(root, script).split(path.sep).join("/");
    if (!relative.startsWith("../") && !path.isAbsolute(relative) && managedPathSet().has(relative)) return true;
  }
  try {
    const durable = path.join(resolveStateRoot(process.env), "enforcement", MIGRATION_VERSION, "bin", "svc-enforce");
    return script === durable && /^svc-[A-Za-z0-9-]+$/.test(argv[2] || "");
  } catch { return false; }
}
