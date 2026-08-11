#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOSTS = ["antigravity", "claude", "codex", "cursor", "gemini", "kimi", "mimo-code", "opencode"];

function parse(argv) { const index = argv.indexOf("--root"); return index >= 0 ? path.resolve(argv[index + 1]) : process.cwd(); }

export function validateHostCapabilities(root) {
  const errors = [];
  for (const host of HOSTS) {
    const file = path.join(root, "provision", "hosts", `${host}.json`);
    let manifest;
    try { manifest = JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { errors.push(`${host}: ${error.message}`); continue; }
    const value = manifest.authority_capabilities;
    if (!value || typeof value !== "object") { errors.push(`${host}: missing authority_capabilities`); continue; }
    for (const field of ["stable_session_identity", "stable_child_identity", "mutating_child_execution"]) if (typeof value[field] !== "boolean") errors.push(`${host}: ${field} must be boolean`);
    if (!['sandbox', 'wrapper', 'none'].includes(value.filesystem_containment)) errors.push(`${host}: invalid filesystem_containment`);
    if (value.mutating_child_execution && (!value.stable_session_identity || !value.stable_child_identity || value.filesystem_containment === "none")) errors.push(`${host}: child mutation lacks identity or containment`);
    if (value.filesystem_containment === "wrapper" && value.containment_launcher !== "scripts/svc-contained-exec.mjs") errors.push(`${host}: wrapper launcher is not canonical`);
    if (!manifest.wiring?.hook_capable && value.mutating_child_execution) errors.push(`${host}: non-hook-capable host cannot enable delegated mutation`);
  }
  return errors;
}

export function run(argv = process.argv.slice(2)) {
  const root = parse(argv); const errors = validateHostCapabilities(root);
  if (errors.length) { for (const error of errors) process.stderr.write(`[host-authority] ${error}\n`); return 1; }
  process.stdout.write(`HOST AUTHORITY PASS: ${HOSTS.length} manifests declare identity and containment support\n`); return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = run();
