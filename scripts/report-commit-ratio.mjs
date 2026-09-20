#!/usr/bin/env node
/** Monthly framework/product visibility; measurement only, never a release gate. */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
const FRAMEWORK = /^(hooks\/|scripts\/|test-framework\/|skills\/|skills-manifest\.json|provision\/|rules\/|_shared\/|references\/(?!knowledge\/)|[a-z0-9-]+\/SKILL\.md|FRAMEWORK-STATE)/;
const PRODUCT = /^(docs\/specs\/(?!work-items|reviews|audit)|references\/knowledge\/|src\/|e2e\/)/;

/** Flush commits at headers and EOF, independent of blank-line formatting. */
export function parseCommitLog(log) {
  const months = {}; let current = null;
  const flush = () => {
    if (!current) return;
    const row = months[current.month] ??= { fw: 0, prod: 0, mixed: 0, other: 0, n: 0 };
    row.n++; row[current.fw && current.prod ? "mixed" : current.fw ? "fw" : current.prod ? "prod" : "other"]++;
  };
  for (const line of log.split(/\r?\n/)) {
    const header = line.match(/^[a-f0-9]{40}\|(\d{4}-\d{2})$/i);
    if (header) { flush(); current = { month: header[1], fw: false, prod: false }; continue; }
    if (!line || !current) continue;
    if (FRAMEWORK.test(line)) current.fw = true;
    else if (PRODUCT.test(line)) current.prod = true;
  }
  flush(); return months;
}

/** Render the established report using a validated lookback and argument-array Git call. */
function main(argv) {
  if (argv[0] === "--help") { console.log("Usage: report-commit-ratio.mjs [--months <positive integer>]"); return; }
  if (argv.length && (argv.length !== 2 || argv[0] !== "--months" || !/^\d+$/.test(argv[1]))) throw new Error("Usage: report-commit-ratio.mjs [--months <positive integer>]");
  const count = argv.length ? Number(argv[1]) : 6;
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("--months must be a positive safe integer");
  const log = execFileSync("git", ["log", `--since=${count} months ago`, "--pretty=format:%H|%ad", "--date=format:%Y-%m", "--name-only"], { encoding: "utf8", maxBuffer: 64e6 });
  console.log(`# Commit-ratio report — framework vs product (last ${count} months)\n`);
  console.log("> **MEASUREMENT ONLY — explicitly not a gate** (ship-gate policy declined by user 2026-06-06). Purpose: visibility on the 54% framework-on-framework finding from the 2026-06-06 evaluation.\n");
  console.log("| Month | Commits | Framework | Product | Mixed | FW% |");
  console.log("|---|---|---|---|---|---|");
  for (const [month, row] of Object.entries(parseCommitLog(log)).sort()) {
    const classified = row.fw + row.prod + row.mixed;
    const percent = classified ? Math.round((row.fw + row.mixed / 2) / classified * 100) : 0;
    console.log(`| ${month} | ${row.n} | ${row.fw} | ${row.prod} | ${row.mixed} | ${percent}% |`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(`report-commit-ratio: ${error.message}`); process.exitCode = 1; }
}
