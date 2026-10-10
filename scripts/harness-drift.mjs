#!/usr/bin/env node
/**
 * harness-drift.mjs — notice when the harness svc wraps has moved on, and say what to adopt or check.
 *
 *   node scripts/harness-drift.mjs check [--host claude] [--installed <ver>] [--changelog <file|url>] [--json]
 *   node scripts/harness-drift.mjs mark-tuned --host claude --version <ver>
 *
 * check reads references/harness-baseline.json, gets the installed version (version_cmd,
 * or --installed), and when it is newer than tuned_version reads the release notes in
 * between. Every entry that matches a watched area's keywords becomes a proposal:
 *   adopt  an "Added" entry: a new capability svc could use (the owners say where)
 *   check  any other entry (changed, fixed, removed): verify svc still behaves
 * Exit 0 when current, 3 when there is drift to review, 2 on bad input. Run it on a
 * schedule; act on proposals through the normal chain, then mark-tuned.
 */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { writeJsonAtomic } from "./state-io.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = path.join(ROOT, "references", "harness-baseline.json");

export function cmpVersion(a, b) {
  const pa = String(a).match(/\d+/g)?.map(Number) || [];
  const pb = String(b).match(/\d+/g)?.map(Number) || [];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

// Parse <Update label="x.y.z" ...> sections; inside, "**Added**"-style headings set the kind of each "* " bullet.
export function parseUpdates(text) {
  const out = [];
  const re = /<Update label="([^"]+)"[^>]*>([\s\S]*?)<\/Update>/g;
  for (const m of text.matchAll(re)) {
    let kind = "changed";
    const entries = [];
    for (const line of m[2].split("\n")) {
      const head = line.match(/^\s*\*\*([A-Za-z ]+)\*\*\s*$/);
      if (head) { kind = head[1].trim().toLowerCase(); continue; }
      const bullet = line.match(/^\s*[*-]\s+(.+)$/);
      if (bullet) entries.push({ kind, text: bullet[1].trim() });
    }
    out.push({ version: m[1], entries });
  }
  return out;
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const wordRe = (k) => new RegExp(`(^|[^A-Za-z0-9_-])${esc(k)}(?=$|[^A-Za-z0-9_])`, "i");

export function proposals(updates, baseline, installed, watch, skipSurfaces = []) {
  const res = [];
  const areas = watch.map((w) => ({ ...w, res: w.keywords.map(wordRe) }));
  const skip = skipSurfaces.length ? new RegExp(`^\\\\?\\[(?:${skipSurfaces.map(esc).join("|")})[^\\]]*\\]`, "i") : null;
  for (const u of updates) {
    if (!(cmpVersion(u.version, baseline) > 0 && cmpVersion(u.version, installed) <= 0)) continue;
    for (const e of u.entries) {
      if (skip && skip.test(e.text)) continue;
      const hit = areas.filter((w) => w.res.some((re) => re.test(e.text)));
      if (!hit.length) continue;
      res.push({ version: u.version, action: /^add/.test(e.kind) ? "adopt" : "check", areas: hit.map((a) => a.area),
        owners: [...new Set(hit.flatMap((a) => a.owners))], text: e.text.length > 220 ? e.text.slice(0, 219) + "…" : e.text });
    }
  }
  return res;
}

function installedVersion(spec, override) {
  if (override) return override;
  const [bin, ...args] = spec.version_cmd;
  const r = spawnSync(bin, args, { encoding: "utf8", timeout: 15000 });
  if (r.error || r.status !== 0) return null;
  return (r.stdout.match(/\d+\.\d+\.\d+/) || [null])[0];
}

function readChangelog(src) {
  if (!/^https?:\/\//.test(src)) return fs.readFileSync(src, "utf8");
  const r = spawnSync("curl", ["-sSL", "--max-time", "30", src], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`could not fetch ${src}: ${r.stderr.trim()}`);
  return r.stdout;
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  const data = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
  const host = opt("--host") || "claude";
  const spec = data.hosts[host];
  if (!spec) { process.stderr.write(`unknown host "${host}"\n`); return 2; }
  if (cmd === "mark-tuned") {
    const v = opt("--version");
    if (!/^\d+\.\d+\.\d+/.test(v || "")) { process.stderr.write("mark-tuned needs --version x.y.z\n"); return 2; }
    spec.tuned_version = v;
    spec.tuned_on = new Date().toISOString().slice(0, 10);
    writeJsonAtomic(BASELINE, data);
    process.stdout.write(`${host} baseline set to ${v}\n`);
    return 0;
  }
  if (cmd !== "check") { process.stderr.write("usage: harness-drift.mjs check [--host H] [--installed V] [--changelog F|URL] [--json] | mark-tuned --host H --version V\n"); return 2; }
  const installed = installedVersion(spec, opt("--installed"));
  const report = { host, tuned_version: spec.tuned_version, installed, proposals: [] };
  if (!installed) report.status = "not installed or version unreadable";
  else if (!spec.tuned_version) report.status = "no baseline yet: run mark-tuned after reviewing svc on this version";
  else if (cmpVersion(installed, spec.tuned_version) <= 0) report.status = "current";
  else {
    const src = opt("--changelog") || spec.changelog_url;
    if (!src) report.status = `newer than baseline but no changelog_url for ${host}: read its release notes by hand`;
    else {
      try { report.proposals = proposals(parseUpdates(readChangelog(src)), spec.tuned_version, installed, data.watch, data.skip_surfaces || []); }
      catch (e) { process.stderr.write(`harness-drift: ${e.message}\n`); return 2; }
      report.status = `drift: ${installed} vs tuned ${spec.tuned_version}, ${report.proposals.length} relevant entries`;
    }
  }
  if (rest.includes("--json")) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else {
    process.stdout.write(`${host}: ${report.status}\n`);
    for (const p of report.proposals) process.stdout.write(`  ${p.action.padEnd(5)} ${p.version} [${p.areas.join(", ")}] ${p.text}\n        → ${p.owners.join(", ")}\n`);
  }
  return report.proposals.length ? 3 : 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
