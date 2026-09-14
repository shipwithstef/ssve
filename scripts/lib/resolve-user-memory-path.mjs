// scripts/lib/resolve-user-memory-path.mjs
//
// Host-neutral user-memory path resolver per WI-343 (tranche 2b).
//
// Returns the absolute directory path where the active host stores per-project
// user-memory files (e.g. Claude Code's `MEMORY.md` index + memory body files).
//
// Resolution order:
//   1. Active host = SVC_HOST env var (set by `setup`), defaulting to "claude".
//   2. Read provision/hosts/<host>.json. If the manifest declares a
//      `user_memory_path_template` field, expand the `<slug>` placeholder with
//      the project's slug and return.
//   3. Otherwise fall back to `~/.svc/per-host/<host>/projects/<slug>/memory/`.
//
// Project slug convention (matches Claude Code's existing folder layout):
//   absolute project path -> lowercase -> non-[a-z0-9]+ replaced with `-` ->
//   leading `-` preserved (Claude Code uses `-home-user-...`).
//
// CLI:
//   node scripts/lib/resolve-user-memory-path.mjs               # JSON output
//   node scripts/lib/resolve-user-memory-path.mjs --host claude
//   node scripts/lib/resolve-user-memory-path.mjs --project /path/to/proj
//
// Importers:
//   import { resolveUserMemoryPath, projectSlug } from "./resolve-user-memory-path.mjs";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const FALLBACK_HOST = "claude";

// Claude Code-style slug: leading `-`, lowercase, non-alphanumerics → `-`.
// Matches the on-disk layout at ~/.claude/projects/-home-user-app/memory/.
export function projectSlug(absProjectPath) {
  const abs = path.resolve(absProjectPath || process.cwd());
  return abs.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function expandTilde(p) {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function readHostManifest(host) {
  const file = path.join(REPO_ROOT, "provision", "hosts", `${host}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function expandTemplate(template, slug) {
  return String(template || "")
    .replace(/<slug>/g, slug)
    .replace(/\{slug\}/g, slug)
    .replace(/\$\{slug\}/g, slug);
}

export function resolveUserMemoryPath(opts = {}) {
  const host = opts.host || process.env.SVC_HOST || FALLBACK_HOST;
  const projectPath = opts.projectPath || process.cwd();
  const slug = projectSlug(projectPath);

  const manifest = readHostManifest(host);
  const template = manifest && typeof manifest.user_memory_path_template === "string"
    ? manifest.user_memory_path_template
    : null;

  let resolved;
  let source;
  if (template && template.trim()) {
    resolved = expandTilde(expandTemplate(template, slug));
    source = `provision/hosts/${host}.json#user_memory_path_template`;
  } else {
    resolved = path.join(os.homedir(), ".svc", "per-host", host, "projects", slug, "memory");
    source = "fallback (~/.svc/per-host/<host>/projects/<slug>/memory/)";
  }

  return {
    host,
    slug,
    projectPath: path.resolve(projectPath),
    path: resolved,
    source,
  };
}

function parseArgs(argv) {
  const out = { host: null, projectPath: null };
  for (let i = 0; i < argv.length; i += 1) {
    const tok = argv[i];
    if (tok === "--host") { out.host = argv[++i]; continue; }
    if (tok === "--project") { out.projectPath = argv[++i]; continue; }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  const r = resolveUserMemoryPath({
    host: args.host || undefined,
    projectPath: args.projectPath || undefined,
  });
  process.stdout.write(JSON.stringify(r, null, 2) + "\n");
}
