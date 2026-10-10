#!/usr/bin/env node
/**
 * cockpit.mjs — repository facts for the founder cockpit's header gauges.
 *
 *   node scripts/cockpit.mjs gauges [--ledger <requirements.md>] [--out <file.json>]
 *
 * Prints (or writes) {"gauges":[{label,value,note}]} for an ArtifactData `update` of
 * the cockpit's meta/project document (references/cockpit-protocol.md). Every value is
 * read from the repository; a source that is missing is left out, never guessed.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { resolveHookMode } from "../hooks/lib/hook-policy.mjs";
import { maxParallel } from "./lib/parallelism.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const git = (...args) => { try { return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim(); } catch { return ""; } };

// Counts the status column of every ledger table row: | # | requirement | status | evidence |
export function ledgerCounts(text) {
  const counts = {};
  for (const line of text.split("\n")) {
    const cells = line.split("|").map((c) => c.trim());
    if (cells.length < 5 || !/^\d+$/.test(cells[1])) continue;
    const status = cells[3].toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

export function gauges({ ledger } = {}) {
  const out = [];
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const head = git("log", "-1", "--format=%h %cr");
  if (branch) out.push({ label: "Branch", value: branch, note: head });
  out.push({ label: "Hook mode", value: resolveHookMode().mode });
  const lanes = maxParallel({ plan: process.env.SVC_PLAN, override: process.env.SVC_MAX_PARALLEL });
  out.push({ label: "Parallel lanes", value: String(lanes.max_parallel), note: `${lanes.plan}: ${lanes.why}` });
  if (ledger && fs.existsSync(ledger)) {
    const c = ledgerCounts(fs.readFileSync(ledger, "utf8"));
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    if (total) out.push({ label: "Requirements", value: `${c.done || 0} done / ${total}`, note: Object.entries(c).filter(([k]) => k !== "done").map(([k, v]) => `${v} ${k}`).join(", ") });
  }
  return { gauges: out };
}

function main(argv) {
  if (argv[0] !== "gauges") { process.stderr.write("usage: cockpit.mjs gauges [--ledger <file.md>] [--out <file.json>]\n"); return 2; }
  const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const result = JSON.stringify(gauges({ ledger: opt("--ledger") }), null, 2) + "\n";
  if (opt("--out")) fs.writeFileSync(opt("--out"), result); else process.stdout.write(result);
  return 0;
}

if (isMain(import.meta.url)) process.exit(main(process.argv.slice(2)));
