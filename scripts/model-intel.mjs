#!/usr/bin/env node
/**
 * model-intel.mjs — read-only drift check for the seven model/harness sources
 * and for installed harness CLIs.
 *
 *   node scripts/model-intel.mjs check [--root DIR]
 *
 * The seven sources (plan §5.9, read, never written):
 *   references/model-registry.json
 *   references/model-intel/models.json
 *   references/model-intel/priors.json
 *   references/harness-playbook.json
 *   references/harness-baseline.json
 *   provision/hosts/*.json
 *   scripts/orch/dispatch.mjs
 *
 * check joins those sources and reports disagreements. It also compares the
 * playbook and each harness baseline with what that harness CLI prints.
 * Detection is PATH lookup via `--version` and the playbook `--help` probe
 * only. It never passes a model id, a prompt, or any other argv, and it never
 * writes a source, un-pins a slot, or deletes anything.
 *
 * Drift (exit 1) is any of: a cross-source disagreement, a playbook host with
 * no tuned_version (baseline unverified), installed version != tuned_version,
 * a probe that exits nonzero or on a signal, a playbook probe flag missing
 * from --help, a CLI-reported model id absent from models.json, or a
 * CLI-reported alias whose id differs from the pinned id. Harnesses that are
 * not on PATH are reported and that absence alone is not drift.
 *
 * The JSON report is the only stdout. A daily schedule is documented, not
 * installed: docs/ops/model-intel-check-schedule.md.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { missingFlags } from "./harness-playbook.mjs";
import { cmpVersion } from "./harness-drift.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const HELP_FLAG = /^(?:--help|-h|--version|-V|-v)$/;
const SUBCOMMAND = /^[a-z][a-z0-9_-]{0,40}$/;
const CLI_EQ = /cli === ['"]([a-z0-9_-]+)['"]/g;
const MODEL_FIELD = /["'](model|model_id|modelId|default_model|requested_model|resolved_model)["']\s*:\s*["']([^"']+)["']/g;
const MODEL_FLAG = /--model(?:\s+|=)([A-Za-z0-9][A-Za-z0-9._:-]*)/g;
const MODEL_ARGV = /["']--model["']\s*,\s*["']([^"']+)["'](?!\s*:)/g;
const MODEL_SHORT = /["']-m["']\s*,\s*["']([^"']+)["'](?!\s*:)/g;
const MODEL_BOUND = /\bmodel\s*===\s*["']([^"']+)["']/g;
/** argv0 of a harness CLI. Short `-m` is a model flag only in that argv, not mkfifo/git mode. */
const HARNESS_ARGV0 = new Set([
  "agy", "claude", "codex", "cursor", "cursor-agent", "gemini", "grok", "kimi", "mimocode", "opencode",
]);

export const SEVEN_SOURCES = [
  ["model-registry", "references/model-registry.json"],
  ["models", "references/model-intel/models.json"],
  ["priors", "references/model-intel/priors.json"],
  ["playbook", "references/harness-playbook.json"],
  ["baseline", "references/harness-baseline.json"],
  ["provision", "provision/hosts"],
  ["dispatch", "scripts/orch/dispatch.mjs"],
];

/** True only for --help / --version probes (optional leading subcommand). */
export function isProbeArgv(args) {
  if (!Array.isArray(args) || args.length === 0) return false;
  if (!args.some((a) => a === "--help" || a === "-h" || a === "--version" || a === "-V" || a === "-v")) return false;
  return args.every((a) => HELP_FLAG.test(a) || SUBCOMMAND.test(a));
}

export function reportedModelIds(text) {
  const ids = new Set();
  for (const line of String(text).split("\n")) {
    const list = line.match(/^\s*models:\s*(.+)$/i);
    if (list) for (const id of list[1].split(/[\s,]+/)) if (id) ids.add(id);
    const one = line.match(/^\s*model-id:\s*(\S+)/i);
    if (one) ids.add(one[1]);
  }
  return [...ids];
}

export function reportedAliases(text) {
  const out = [];
  for (const line of String(text).split("\n")) {
    const m = line.match(/^\s*alias:\s*([A-Za-z0-9_.-]+)\s*=\s*(\S+)\s*$/);
    if (m) out.push({ alias: m[1], id: m[2] });
  }
  return out;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sourcePresent(root, id, rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) return false;
  const st = fs.statSync(abs);
  return id === "provision" ? st.isDirectory() : st.isFile();
}

function storeAliases(modelsDoc) {
  const map = new Map();
  for (const [alias, spec] of Object.entries(modelsDoc?.models || {})) {
    if (spec && typeof spec.id === "string" && spec.id) map.set(alias, spec.id);
  }
  return map;
}

function registryAliases(registry) {
  const map = new Map();
  for (const spec of Object.values(registry?.harnesses || {})) {
    for (const [alias, model] of Object.entries(spec?.models || {})) {
      if (!model || typeof model.id !== "string" || !model.id) continue;
      const prev = map.get(alias);
      if (prev && prev !== model.id) map.set(alias, `${prev}|${model.id}`);
      else if (!prev) map.set(alias, model.id);
    }
  }
  return map;
}

function priorAliases(priors) {
  const out = new Set();
  for (const task of Object.values(priors?.task_types || {})) {
    for (const rung of task?.ladder || []) {
      if (Array.isArray(rung) && typeof rung[0] === "string" && rung[0]) out.add(rung[0]);
    }
  }
  return [...out].sort();
}

function addModelId(ids, raw) {
  const id = String(raw || "").trim();
  if (!id || id.startsWith("{") || id.startsWith("$") || id.startsWith("-")) return;
  ids.add(id);
}

/** Model ids from model fields and model arguments only. Host names and other quoted strings are not ids. */
function collectModelIds(ids, re, text, group) {
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) addModelId(ids, m[group]);
}

/**
 * Short `-m` is a model argument only inside harness argv:
 * the array starts with a harness binary, or it is the argv of a harness command
 * (`spawnSync('codex', ['-m', 'gpt'])`). mkfifo `['-m', '600']` is a mode, not a model.
 */
function collectHarnessShortModelIds(ids, text) {
  for (const m of text.matchAll(/\[([^\[\]]*)\]/g)) {
    const body = m[1];
    MODEL_SHORT.lastIndex = 0;
    const shorts = [...body.matchAll(MODEL_SHORT)];
    if (shorts.length === 0) continue;
    const head = /^\s*["']([^"']+)["']/.exec(body);
    const invoked = /["']([A-Za-z0-9_.-]+)["']\s*,\s*$/.exec(text.slice(Math.max(0, m.index - 180), m.index));
    if (!HARNESS_ARGV0.has(head?.[1]) && !HARNESS_ARGV0.has(invoked?.[1])) continue;
    for (const s of shorts) addModelId(ids, s[1]);
  }
}

export function referencedModelIds(text) {
  const ids = new Set();
  const src = String(text);
  collectModelIds(ids, MODEL_FIELD, src, 2);
  collectModelIds(ids, MODEL_FLAG, src, 1);
  collectModelIds(ids, MODEL_ARGV, src, 1);
  collectHarnessShortModelIds(ids, src);
  collectModelIds(ids, MODEL_BOUND, src, 1);
  return [...ids];
}

/** A headless role is a non-empty argv list. Empty roles (and a no-headless declaration) stay out of dispatch comparison. */
function hasHeadlessRoles(spec) {
  const roles = spec?.roles;
  if (!roles || typeof roles !== "object" || Array.isArray(roles)) return false;
  return Object.values(roles).some((argv) => Array.isArray(argv) && argv.length > 0);
}

function dispatchClis(text) {
  return [...new Set([...String(text).matchAll(CLI_EQ)].map((m) => m[1]))].sort();
}

function tunedOf(base) {
  return typeof base?.tuned_version === "string" && base.tuned_version.trim() ? base.tuned_version.trim() : null;
}

/**
 * Join the seven sources. Missing files are listed and not invented.
 * Present files are parsed and compared. Nothing is written.
 * @param {string} root
 */
export function compareSources(root) {
  const sources = SEVEN_SOURCES.map(([id, rel]) => ({ id, path: rel, present: sourcePresent(root, id, rel), compared: false }));
  const byId = Object.fromEntries(sources.map((s) => [s.id, s]));
  const disagreements = [];
  const facts = { model_aliases: [], registry_aliases: [], prior_aliases: [], provision_hosts: [], dispatch_clis: [] };

  const models = byId.models.present ? readJson(path.join(root, byId.models.path)) : null;
  const registry = byId["model-registry"].present ? readJson(path.join(root, byId["model-registry"].path)) : null;
  const priors = byId.priors.present ? readJson(path.join(root, byId.priors.path)) : null;
  const playbook = byId.playbook.present ? readJson(path.join(root, byId.playbook.path)) : null;
  const baseline = byId.baseline.present ? readJson(path.join(root, byId.baseline.path)) : null;
  const dispatchText = byId.dispatch.present ? fs.readFileSync(path.join(root, byId.dispatch.path), "utf8") : null;

  if (models) byId.models.compared = true;
  if (registry) byId["model-registry"].compared = true;
  if (priors) byId.priors.compared = true;
  if (playbook) byId.playbook.compared = true;
  if (baseline) byId.baseline.compared = true;
  if (dispatchText != null) byId.dispatch.compared = true;

  const store = models ? storeAliases(models) : new Map();
  const reg = registry ? registryAliases(registry) : new Map();
  facts.model_aliases = [...store.keys()].sort();
  facts.registry_aliases = [...reg.keys()].sort();
  const knownIds = new Set([...store.values(), ...reg.values()]);

  if (models && registry) {
    for (const alias of [...new Set([...store.keys(), ...reg.keys()])].sort()) {
      if (!store.has(alias) || !reg.has(alias)) continue;
      if (store.get(alias) === reg.get(alias)) continue;
      disagreements.push({
        kind: "alias",
        alias,
        sources: {
          "references/model-intel/models.json": store.get(alias),
          "references/model-registry.json": reg.get(alias),
        },
      });
    }
  }

  if (priors && models) {
    facts.prior_aliases = priorAliases(priors);
    for (const alias of facts.prior_aliases) {
      if (store.has(alias)) continue;
      disagreements.push({
        kind: "prior",
        alias,
        detail: "priors ladder alias is not in models.json",
        sources: ["references/model-intel/priors.json", "references/model-intel/models.json"],
      });
    }
  }

  const playHosts = playbook?.hosts || {};
  const baseHosts = baseline?.hosts || {};
  if (playbook) {
    for (const host of Object.keys(playHosts).sort()) {
      if (tunedOf(baseHosts[host])) continue;
      disagreements.push({
        kind: "baseline",
        host,
        status: "unverified",
        sources: ["references/harness-playbook.json", "references/harness-baseline.json"],
      });
    }
  }

  let provisionHosts = [];
  const referenced = new Map();
  if (byId.provision.present) {
    const dir = path.join(root, byId.provision.path);
    provisionHosts = fs.readdirSync(dir).filter((n) => n.endsWith(".json")).map((n) => n.slice(0, -5)).sort();
    facts.provision_hosts = provisionHosts;
    byId.provision.compared = true;
    for (const host of provisionHosts) {
      const rel = `provision/hosts/${host}.json`;
      for (const id of referencedModelIds(fs.readFileSync(path.join(dir, `${host}.json`), "utf8"))) {
        if (!referenced.has(id)) referenced.set(id, []);
        referenced.get(id).push(rel);
      }
    }
    if (playbook) {
      const linked = new Set(Object.values(playHosts).map((h) => h?.provision_host).filter(Boolean));
      for (const host of provisionHosts) {
        if (linked.has(host)) continue;
        disagreements.push({
          kind: "host",
          host,
          detail: "provision host has no harness-playbook provision_host",
          sources: ["provision/hosts", "references/harness-playbook.json"],
        });
      }
      for (const host of [...linked].sort()) {
        if (provisionHosts.includes(host)) continue;
        disagreements.push({
          kind: "host",
          host,
          detail: "playbook provision_host has no provision file",
          sources: ["references/harness-playbook.json", "provision/hosts"],
        });
      }
    }
  }

  if (dispatchText != null) {
    facts.dispatch_clis = dispatchClis(dispatchText);
    for (const id of referencedModelIds(dispatchText)) {
      if (!referenced.has(id)) referenced.set(id, []);
      referenced.get(id).push("scripts/orch/dispatch.mjs");
    }
    if (playbook) {
      const allowed = new Set(facts.dispatch_clis);
      for (const host of Object.keys(playHosts).sort()) {
        if (!hasHeadlessRoles(playHosts[host])) continue;
        if (allowed.has(host)) continue;
        disagreements.push({
          kind: "dispatch",
          host,
          detail: "playbook host is not in the dispatch allowlist",
          sources: ["references/harness-playbook.json", "scripts/orch/dispatch.mjs"],
        });
      }
    }
  }

  if (models && registry) {
    for (const id of [...referenced.keys()].sort()) {
      if (knownIds.has(id)) continue;
      disagreements.push({
        kind: "model",
        id,
        detail: "referenced by a source but absent from models.json and model-registry.json",
        referenced_by: [...new Set(referenced.get(id))].sort(),
      });
    }
  }

  disagreements.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return { sources, disagreements, facts };
}

function storePins(modelsDoc) {
  const ids = new Set();
  const aliases = {};
  for (const [name, spec] of Object.entries(modelsDoc?.models || {})) {
    if (spec && typeof spec.id === "string" && spec.id) {
      ids.add(spec.id);
      aliases[name] = spec.id;
    }
  }
  return { ids, aliases };
}

function runProbe(spawn, bin, args, env) {
  const r = spawn(bin, args, { encoding: "utf8", timeout: 8000, env, windowsHide: true });
  if (r?.error && r.error.code === "ENOENT") return { installed: false };
  if (r?.error) return { installed: true, error: r.error.code || "probe_failed", status: r.status ?? null, signal: r.signal ?? null, text: "" };
  if (r?.signal) return { installed: true, error: `signal:${r.signal}`, status: r.status ?? null, signal: r.signal, text: "" };
  if (r?.status !== 0) return { installed: true, error: `exit:${r?.status ?? "null"}`, status: r?.status ?? null, signal: null, text: "" };
  return { installed: true, status: 0, signal: null, text: `${r?.stdout || ""}\n${r?.stderr || ""}` };
}

function versionOf(text) {
  return (String(text).match(/\d+\.\d+\.\d+/) || [null])[0];
}

function hostRecord(playbook, baseline) {
  const names = new Set([...Object.keys(playbook.hosts || {}), ...Object.keys(baseline.hosts || {})]);
  return [...names].sort().map((host) => {
    const spec = playbook.hosts?.[host] || {};
    const base = baseline.hosts?.[host] || {};
    const binary = spec.binary || (Array.isArray(base.version_cmd) ? base.version_cmd[0] : null);
    return { host, spec, base, binary };
  });
}

function baselineRowStatus(row) {
  if (row.baseline_status === "unverified") return "unverified";
  if (!row.installed) return "not_installed";
  if (row.probe_drift) return "probe_failed";
  if (row.version_drift) return "drift";
  return "ok";
}

/**
 * @param {{ root?: string, env?: NodeJS.ProcessEnv, spawn?: typeof spawnSync }} opts
 * @returns {{ code: number, report: object }}
 */
export function checkModelIntel(opts = {}) {
  const root = opts.root || ROOT;
  const env = opts.env || process.env;
  const spawn = opts.spawn || spawnSync;
  const modelsDoc = readJson(path.join(root, "references", "model-intel", "models.json"));
  const playbook = readJson(path.join(root, "references", "harness-playbook.json"));
  const baselinePath = path.join(root, "references", "harness-baseline.json");
  const baseline = fs.existsSync(baselinePath) ? readJson(baselinePath) : { hosts: {} };
  const pins = storePins(modelsDoc);
  const harnesses = [];
  const findings = [];

  for (const { host, spec, base, binary } of hostRecord(playbook, baseline)) {
    const tuned = tunedOf(base);
    const row = {
      host,
      binary: binary || null,
      installed: false,
      version: null,
      tuned_version: tuned,
      baseline_status: tuned ? "present" : "unverified",
      version_drift: false,
      missing_flags: [],
      flag_drift: false,
      reported_models: [],
      unknown_models: [],
      alias_drift: [],
      model_drift: false,
      probe_drift: false,
    };
    if (!binary) {
      harnesses.push(row);
      continue;
    }
    const versionProbe = runProbe(spawn, binary, ["--version"], env);
    if (!versionProbe.installed) {
      harnesses.push(row);
      continue;
    }
    row.installed = true;
    if (versionProbe.error) {
      row.probe_drift = true;
      findings.push({ host, kind: "probe", detail: versionProbe.error });
    } else {
      row.version = versionOf(versionProbe.text || "");
      if (tuned && cmpVersion(row.version || "0", tuned) !== 0) {
        row.version_drift = true;
        findings.push({ host, kind: "version", installed: row.version, tuned });
      }
    }

    const helpArgv = spec.probe?.help;
    let helpText = "";
    if (Array.isArray(helpArgv) && helpArgv.length) {
      if (!isProbeArgv(helpArgv)) {
        row.probe_drift = true;
        findings.push({ host, kind: "probe", detail: "help argv is not a --version/--help probe" });
      } else {
        const helpProbe = runProbe(spawn, binary, helpArgv, env);
        if (!helpProbe.installed || helpProbe.error) {
          row.probe_drift = true;
          findings.push({ host, kind: "probe", detail: helpProbe.error || "help probe failed" });
        } else helpText = helpProbe.text || "";
      }
    }
    if (Array.isArray(spec.probe?.flags) && spec.probe.flags.length && !row.probe_drift) {
      row.missing_flags = missingFlags(helpText, spec.probe.flags);
      if (row.missing_flags.length) {
        row.flag_drift = true;
        findings.push({ host, kind: "flag", missing: row.missing_flags });
      }
    }

    const versionText = versionProbe.error ? "" : (versionProbe.text || "");
    row.reported_models = reportedModelIds(`${versionText}\n${helpText}`);
    row.unknown_models = row.reported_models.filter((id) => !pins.ids.has(id));
    if (row.unknown_models.length) findings.push({ host, kind: "model", unknown: row.unknown_models });
    for (const { alias, id } of reportedAliases(`${versionText}\n${helpText}`)) {
      if (!(alias in pins.aliases)) continue;
      if (pins.aliases[alias] !== id) {
        row.alias_drift.push({ alias, reported: id, pinned: pins.aliases[alias] });
        findings.push({ host, kind: "alias", alias, reported: id, pinned: pins.aliases[alias] });
      }
    }
    row.model_drift = row.unknown_models.length > 0 || row.alias_drift.length > 0;
    harnesses.push(row);
  }

  const joined = compareSources(root);
  for (const d of joined.disagreements) {
    if (d.kind === "baseline") findings.push({ host: d.host, kind: "baseline", status: "unverified" });
    else findings.push(d);
  }

  const drift = findings.length > 0;
  return {
    code: drift ? 1 : 0,
    report: {
      command: "model-intel check",
      read_only: true,
      ok: !drift,
      drift,
      models: "references/model-intel/models.json",
      registry: ["references/harness-playbook.json", "references/harness-baseline.json"],
      sources: joined.sources,
      baselines: harnesses.map((h) => ({
        host: h.host,
        tuned_version: h.tuned_version,
        installed_version: h.version,
        status: baselineRowStatus(h),
      })),
      harnesses,
      findings,
    },
  };
}

function main(argv) {
  if (argv[0] !== "check") {
    process.stderr.write("usage: model-intel.mjs check [--root DIR]\n");
    return 2;
  }
  let root = ROOT;
  for (let i = 1; i < argv.length; i++) {
    if (argv[i] === "--root") {
      root = path.resolve(argv[++i] || "");
      if (!argv[i - 1] || argv[i] === undefined) {
        process.stderr.write("usage: model-intel.mjs check [--root DIR]\n");
        return 2;
      }
    } else {
      process.stderr.write("usage: model-intel.mjs check [--root DIR]\n");
      return 2;
    }
  }
  try {
    const { code, report } = checkModelIntel({ root, env: process.env });
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return code;
  } catch (e) {
    process.stderr.write(`model-intel check: ${e.message}\n`);
    return 2;
  }
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
