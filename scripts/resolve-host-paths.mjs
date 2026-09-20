#!/usr/bin/env node
// Resolve host install paths from provision/hosts/<host>.json.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Resolve the checkout containing this module. */
function defaultRepoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

/** Expand one manifest path without changing the filesystem. */
export function expandPath(value, opts = {}) {
  if (!value) return "";
  const home = opts.home ?? process.env.HOME ?? "";
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  let out = String(value);
  if (out === "~") return home;
  if (out.startsWith("~/")) out = `${home}${out.slice(1)}`;
  if (!isAbsolute(out)) out = resolve(repoRoot, out);
  return out;
}

/** Discover installed manifest names without a duplicate host catalog.
 * @param {object} opts Optional repository root.
 * @returns {string[]} Deterministically ordered manifest names.
 */
export function listHosts(opts = {}) {
  const directory = resolve(opts.repoRoot ?? defaultRepoRoot(), "provision", "hosts");
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5)).sort();
}

/** Read one host manifest, preserving the existing resolver API. */
export function loadHostManifest(host, opts = {}) {
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  const manifestPath = resolve(repoRoot, "provision", "hosts", `${host}.json`);
  if (!existsSync(manifestPath)) {
    throw new Error(`host manifest not found: ${manifestPath}; available hosts: ${listHosts({ repoRoot }).join(", ") || "(none)"}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/** Resolve the existing host paths, capabilities, and source manifest. */
export function resolveHostPaths(host, opts = {}) {
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  const manifest = loadHostManifest(host, { repoRoot });
  return {
    host: manifest.host,
    skillsPath: expandPath(manifest.skills_path, opts),
    rulesPath: expandPath(manifest.rules_path || "", opts),
    configFile: expandPath(manifest.hook_quirks?.config_file || "", opts),
    hooksSupported: Boolean(manifest.capabilities?.hooks),
    manifestPath: resolve(repoRoot, "provision", "hosts", `${host}.json`),
    manifest,
  };
}

const USAGE = "Usage: resolve-host-paths.mjs <host> [--root PATH] | --list [--root PATH]";

/** Run the read-only CLI; usage errors are distinct from manifest errors. */
function main(argv) {
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) { console.log(USAGE); return; }
  let host; let repoRoot; let list = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--root" && repoRoot === undefined && argv[i + 1] && !argv[i + 1].startsWith("-")) {
      repoRoot = resolve(argv[++i]);
    } else if (arg === "--list" && !list) { list = true; }
    else if (!arg.startsWith("-") && host === undefined) { host = arg; }
    else { console.error(USAGE); process.exitCode = 2; return; }
  }
  if ((list && host !== undefined) || (!list && host === undefined)) {
    console.error(USAGE); process.exitCode = 2; return;
  }
  console.log(JSON.stringify(list ? listHosts({ repoRoot }) : resolveHostPaths(host, { repoRoot }), null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
