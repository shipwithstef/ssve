// WI-562 IP-W3/W-D: declarative hook catalog loader + QUOTED command renderer.
//
// The catalog (references/host-hook-catalog.json) is the single source for
// wirer entry generation: per-host event mapping, hook ids, and canonical
// command templates. Paths interpolated into commands are ALWAYS quoted so
// space-bearing install prefixes wire correctly (IP-W4).
//
// Claude's legacy ~35-case isAlreadyWired table remains as a bounded
// migration adapter for pre-catalog installs; new-style entries come from here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CATALOG_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "references", "host-hook-catalog.json");

let _catalog = null;
export function loadCatalog(catalogPath = CATALOG_PATH) {
  if (!_catalog || catalogPath !== CATALOG_PATH) {
    _catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
  }
  return _catalog;
}

/** Host capability truth (receipts / freeze enforcement), for WI-563 consumers. */
export function hostCapability(host) {
  return loadCatalog().hosts?.[host] || null;
}

/**
 * Render a catalog command template. Every interpolated path segment is
 * double-quoted (W-D): `node {HOOKS_DIR}/x.mjs` → `node "<dir>/x.mjs"`.
 */
export function renderCommand(template, { hooksDir, nodeCmd = "node" }) {
  const quotedDir = `"${String(hooksDir).replace(/"/g, '\\"')}"`;
  return template.replaceAll("{HOOKS_DIR}", quotedDir).replaceAll("{NODE_CMD}", nodeCmd);
}

/**
 * Generate wirer entries for one host from the catalog.
 * @param {string} host - claude | cursor | grok
 * @param {Record<string,string>} eventMap - catalog event name → host config key
 * @param {{hooksDir: string, nodeCmd?: string}} paths
 * @param {Set<string>} disabled - disabled hook ids
 * @param {(id: string, rendered: string, event: string) => void} [push]
 *   optional collector; defaults to returning a map of eventKey → [{command,id}]
 */
export function generateHostEntries(host, eventMap, paths, disabled = new Set(), push = null) {
  const out = {};
  for (const hook of loadCatalog().hooks || []) {
    if (!hook.hosts?.includes(host)) continue;
    if (disabled.has(hook.id)) continue;
    const rendered = renderCommand(hook.command_template, paths);
    for (const ev of hook.events || []) {
      const key = eventMap[ev];
      if (!key) continue;
      if (push) {
        push(hook.id, rendered, key);
      } else {
        (out[key] ||= []).push({ id: hook.id, command: rendered });
      }
    }
  }
  return push ? null : out;
}
