#!/usr/bin/env node
/**
 * harness-playbook.mjs — known-good headless invocations per coding harness.
 *
 *   node scripts/harness-playbook.mjs list
 *   node scripts/harness-playbook.mjs show <host> [--role review|exec|...] [--model M --effort E ...]
 *   node scripts/harness-playbook.mjs prompt --role R --task T --mode read-only --inputs I --done-condition D --schema-json J
 *   node scripts/harness-playbook.mjs verify [<host>...]   # probe installed CLIs' --help for every flag
 *
 * Data: references/harness-playbook.json. show fills {placeholders} from --name value
 * pairs and leaves unknown ones visible. verify exits 1 when an installed CLI lacks a
 * flag the playbook relies on, and reports hosts that are not installed without failing.
 * Every provision/hosts/<host>.json host has one entry, found by its key or its
 * provision_host (show/verify accept either, e.g. "antigravity" resolves to "agy").
 * An entry with empty roles has no headless invocation svc runs; it states
 * no_headless_reason, show prints that reason, and verify skips it.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadPlaybook(file = path.join(ROOT, "references", "harness-playbook.json")) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** Resolve a playbook key or a provision/hosts host id to [key, entry], or null. */
export function resolveHost(playbook, host) {
  if (playbook.hosts[host]) return [host, playbook.hosts[host]];
  return Object.entries(playbook.hosts).find(([, h]) => h.provision_host === host) || null;
}

export const hasHeadless = (spec) => Object.keys(spec.roles || {}).length > 0;

const subst =(str, values) => str.replace(/\{([a-z_]+)\}/g, (m, k) => (values[k] !== undefined ? values[k] : m));

export function fill(argv, values) {
  return argv.map((a) => subst(a, values));
}

export function renderPrompt(playbook, values) {
  return subst(playbook.reference_prompt.template, values);
}

const escapeRe = (s) => s.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");

export function missingFlags(helpText, flags) {
  return flags.filter((f) => !new RegExp(`(^|[\\s,\\[])${escapeRe(f)}(?=[\\s,=\\]<]|$)`, "m").test(helpText));
}

export function probe(host, spec, run = spawnSync) {
  const bin = process.env[`SVC_HARNESS_${host.toUpperCase()}_BIN`] || spec.binary;
  const r = run(bin, spec.probe.help, { encoding: "utf8", timeout: 20000 });
  if (r.error && r.error.code === "ENOENT") return { host, installed: false };
  const text = `${r.stdout || ""}\n${r.stderr || ""}`;
  return { host, installed: true, missing: missingFlags(text, spec.probe.flags) };
}

function parsePairs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith("--")) o[argv[i].slice(2).replace(/-/g, "_")] = argv[i + 1]?.startsWith("--") ? true : argv[++i];
  return o;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const pb = loadPlaybook();
  if (cmd === "list") {
    for (const [k, h] of Object.entries(pb.hosts)) process.stdout.write(`${k.padEnd(9)} ${h.name} — ${hasHeadless(h) ? `roles: ${Object.keys(h.roles).join(", ")}` : "no headless invocation"}${h.provision_host && h.provision_host !== k ? ` (provision host: ${h.provision_host})` : ""}${h.conflict ? " (has an unverified conflict)" : ""}\n`);
    return 0;
  }
  if (cmd === "show") {
    const found = resolveHost(pb, rest[0]);
    if (!found) { process.stderr.write(`unknown host "${rest[0]}" (known: ${Object.keys(pb.hosts).join(", ")})\n`); return 2; }
    const [host, spec] = found;
    if (!hasHeadless(spec)) { process.stderr.write(`${host}: no headless invocation recorded. ${spec.no_headless_reason}\n`); return 2; }
    const v = parsePairs(rest.slice(1));
    const role = v.role || Object.keys(spec.roles)[0];
    if (!spec.roles[role]) { process.stderr.write(`${host} has no "${role}" role (has: ${Object.keys(spec.roles).join(", ")})\n`); return 2; }
    const args = fill(spec.roles[role], v);
    const head = spec.launcher ? spec.launcher.join(" ") : spec.binary;
    process.stdout.write(`${head} ${args.map((a) => (/[\s"{}]/.test(a) ? JSON.stringify(a) : a)).join(" ")}\n`);
    process.stdout.write(`prompt via: ${spec.prompt_delivery}\nsource: ${spec.source}\n`);
    if (spec.notes) process.stdout.write(`notes: ${spec.notes}\n`);
    if (spec.conflict) process.stdout.write(`CONFLICT: ${spec.conflict}\n`);
    return 0;
  }
  if (cmd === "prompt") { process.stdout.write(renderPrompt(pb, parsePairs(rest)) + "\n"); return 0; }
  if (cmd === "verify") {
    const hosts = rest.length ? rest : Object.keys(pb.hosts);
    let bad = 0;
    for (const name of hosts) {
      const found = resolveHost(pb, name);
      if (!found) { process.stderr.write(`unknown host "${name}"\n`); bad++; continue; }
      const [h, spec] = found;
      if (!hasHeadless(spec)) { process.stdout.write(`${h}: no headless invocation recorded (skipped)\n`); continue; }
      const r = probe(h, spec);
      if (!r.installed) process.stdout.write(`${h}: not installed (skipped)\n`);
      else if (r.missing.length) { bad++; process.stdout.write(`${h}: MISSING ${r.missing.join(" ")} — the installed CLI changed; update references/harness-playbook.json\n`); }
      else process.stdout.write(`${h}: ok (${spec.probe.flags.length} flags present)\n`);
    }
    return bad ? 1 : 0;
  }
  process.stderr.write("usage: harness-playbook.mjs list | show <host> [--role R] [--model M ...] | prompt --role R --task T ... | verify [host...]\n");
  return 2;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
