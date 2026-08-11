#!/usr/bin/env node
/** report-commit-ratio (WI-369 D4): monthly framework-vs-product commit ratio.
 * MEASUREMENT ONLY — explicitly NOT a gate (ship-gate declined 2026-06-06). */
import { execSync } from "node:child_process";
const MONTHS = (()=>{const i=process.argv.indexOf("--months");return i>-1?Number(process.argv[i+1]):6;})();
const FRAMEWORK = /^(hooks\/|scripts\/|test-framework\/|skills-manifest\.json|provision\/|rules\/|_shared\/|references\/(?!knowledge\/)|[a-z0-9-]+\/SKILL\.md|FRAMEWORK-STATE)/;
const PRODUCT = /^(docs\/specs\/(?!work-items|reviews|audit)|references\/knowledge\/|src\/|e2e\/)/;
const log = execSync(`git log --since="${MONTHS} months ago" --pretty='format:%H|%ad' --date=format:%Y-%m --name-only`, { encoding: "utf8", maxBuffer: 64e6 });
const months = {};
let cur = null;
for (const line of log.split("\n")) {
  if (line.includes("|")) { const [, m] = line.split("|"); cur = months[m] ??= { fw: 0, prod: 0, mixed: 0, other: 0, n: 0 }; cur.n++; cur._fw = false; cur._pr = false; cur._counted = false; continue; }
  if (!line.trim() || !cur) { if (cur && !cur._counted && (cur._fw || cur._pr)) { cur._counted = true; if (cur._fw && cur._pr) cur.mixed++; else if (cur._fw) cur.fw++; else cur.prod++; } cur && (cur._fw = cur._pr = false); continue; }
  if (FRAMEWORK.test(line)) cur._fw = true; else if (PRODUCT.test(line)) cur._pr = true;
}
console.log(`# Commit-ratio report — framework vs product (last ${MONTHS} months)\n`);
console.log(`> **MEASUREMENT ONLY — explicitly not a gate** (ship-gate policy declined by user 2026-06-06). Purpose: visibility on the 54% framework-on-framework finding from the 2026-06-06 evaluation.\n`);
console.log(`| Month | Commits | Framework | Product | Mixed | FW% |`);
console.log(`|---|---|---|---|---|---|`);
for (const [m, s] of Object.entries(months).sort()) {
  const classified = s.fw + s.prod + s.mixed;
  const fwPct = classified ? Math.round(((s.fw + s.mixed / 2) / classified) * 100) : 0;
  console.log(`| ${m} | ${s.n} | ${s.fw} | ${s.prod} | ${s.mixed} | ${fwPct}% |`);
}
