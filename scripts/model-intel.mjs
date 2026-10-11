#!/usr/bin/env node
/**
 * model-intel.mjs — read-only drift check for installed harness CLIs.
 *
 *   node scripts/model-intel.mjs check [--root DIR]
 *
 * check compares references/model-intel/models.json and the harness registry
 * (references/harness-playbook.json + references/harness-baseline.json) with
 * what each installed harness CLI prints. Detection is PATH lookup via
 * `--version` and the playbook `--help` probe only. It never passes a model
 * id, a prompt, or any other argv, and it never writes the store, un-pins a
 * slot, or deletes anything.
 *
 * Drift (exit 1) is any of: installed version != tuned_version, a playbook
 * probe flag missing from --help, a CLI-reported model id absent from
 * models.json, or a CLI-reported alias whose id differs from the pinned id.
 * Harnesses that are not on PATH are reported and are not drift.
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
  if (r?.error) return { installed: true, error: r.error.code || "probe_failed", text: "" };
  return { installed: true, status: r?.status ?? null, text: `${r?.stdout || ""}\n${r?.stderr || ""}` };
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
    const tuned = typeof base.tuned_version === "string" ? base.tuned_version : null;
    const row = {
      host,
      binary: binary || null,
      installed: false,
      version: null,
      tuned_version: tuned,
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
    }
    row.version = versionOf(versionProbe.text || "");
    if (tuned && cmpVersion(row.version || "0", tuned) !== 0) {
      row.version_drift = true;
      findings.push({ host, kind: "version", installed: row.version, tuned });
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

    const reportedText = `${versionProbe.text || ""}\n${helpText}`;
    row.reported_models = reportedModelIds(reportedText);
    row.unknown_models = row.reported_models.filter((id) => !pins.ids.has(id));
    if (row.unknown_models.length) findings.push({ host, kind: "model", unknown: row.unknown_models });
    for (const { alias, id } of reportedAliases(reportedText)) {
      if (!(alias in pins.aliases)) continue;
      if (pins.aliases[alias] !== id) {
        row.alias_drift.push({ alias, reported: id, pinned: pins.aliases[alias] });
        findings.push({ host, kind: "alias", alias, reported: id, pinned: pins.aliases[alias] });
      }
    }
    row.model_drift = row.unknown_models.length > 0 || row.alias_drift.length > 0;
    harnesses.push(row);
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
