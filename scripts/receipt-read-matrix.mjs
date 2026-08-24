#!/usr/bin/env node
// WI-562 IP-R7: regenerate the receipt read-side matrix from the kind registry
// and gate it against the pre-implementation baseline.
//   --check   exit nonzero on any regression vs docs/specs/wi562-read-matrix-baseline.json
//             AND require the WI-562-upgraded subset to be non-debt.
//   default   print the current matrix (markdown-ish JSON)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REGISTRY = JSON.parse(fs.readFileSync(path.join(ROOT, "references", "receipt-kind-registry.json"), "utf8"));
const BASELINE = JSON.parse(fs.readFileSync(path.join(ROOT, "docs", "specs", "wi562-read-matrix-baseline.json"), "utf8"));
const UPGRADED = new Set(BASELINE.wi562_upgraded_subset || []);
const DEBT_KINDS = new Set((BASELINE.kinds || []).filter((k) => k.read_validated !== "YES").map((k) => k.kind));
const ACCEPTED_DEBT = new Set(["denial-receipts", "runtime-projections"]); // bound to WI-563 in wi-followups.md

const current = REGISTRY.kinds.map((row) => ({ kind: row.kind, read_validated: row.read_validated }));

let fail = 0;
function problem(m) { console.error(`  ✗ ${m}`); fail++; }

// (a) zero regressions anywhere
const baselineMap = new Map(BASELINE.kinds.map((k) => [k.kind, k.read_validated ?? k.validated_on_read]));
for (const { kind, read_validated } of current) {
  const was = baselineMap.get(kind);
  if (was === undefined) continue; // new kind introduced post-baseline
  const rank = { YES: 2, PARTIAL: 1, NO: 0 };
  if ((rank[normalized(read_validated)] ?? 0) < (rank[normalized(was)] ?? 0)) problem(`REGRESSION: ${kind} ${was} -> ${read_validated}`);
}

// (b) upgraded subset must reach YES
const normalized = (v) => String(v || "").split(" ")[0];
for (const kind of UPGRADED) {
  const row = current.find((r) => r.kind === kind);
  if (!row) problem(`upgraded subset kind missing from registry: ${kind}`);
  else if (normalized(row.read_validated) !== "YES") problem(`upgraded subset not closed: ${kind} is ${row.read_validated}`);
}

// (c) remaining debt must be exactly the accepted set bound to WI-563
for (const { kind, read_validated } of current) {
  if (read_validated !== "YES" && !UPGRADED.has(kind) && !ACCEPTED_DEBT.has(kind)) {
    problem(`untracked debt cell: ${kind} is ${read_validated} — add to ACCEPTED_DEBT or close it`);
  }
}

console.log(JSON.stringify({ generated_from: "references/receipt-kind-registry.json", cells: current }, null, 2));

if (process.argv.includes("--check")) {
  if (fail > 0) { console.error(`receipt-read-matrix --check: FAIL (${fail})`); process.exit(1); }
  console.error("receipt-read-matrix --check: PASS (no regressions; upgraded subset closed; debt tracked)");
}
