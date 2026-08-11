#!/usr/bin/env node
// Resolve host install paths from provision/hosts/<host>.json.

import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function defaultRepoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..");
}

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

export function loadHostManifest(host, opts = {}) {
  const repoRoot = opts.repoRoot ?? defaultRepoRoot();
  const manifestPath = resolve(repoRoot, "provision", "hosts", `${host}.json`);
  if (!existsSync(manifestPath)) {
    throw new Error(`host manifest not found: ${manifestPath}`);
  }
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

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

function main() {
  const host = process.argv[2];
  if (!host || host === "--help" || host === "-h") {
    console.error("Usage: resolve-host-paths.mjs <host>");
    process.exit(2);
  }
  console.log(JSON.stringify(resolveHostPaths(host), null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
