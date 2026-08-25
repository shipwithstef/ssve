#!/usr/bin/env node
// extract-inline-plan-contract.mjs — materialize plan-contract.json from the
// byte-exact inline block in the WI-FW-SWARM-COORDINATION-01 manifest.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(ROOT, "docs/plans/2026-08-25-wi-fw-swarm-coordination/manifest.md");
const TARGET = path.join(ROOT, "docs/plans/2026-08-25-wi-fw-swarm-coordination/plan-contract.json");

const manifest = fs.readFileSync(MANIFEST, "utf8");
const startMarker = "The contract artifact content is fixed NOW by this inline block";
const start = manifest.indexOf(startMarker);
if (start < 0) {
  process.stderr.write("extract-inline-plan-contract: inline contract intro not found in manifest\n");
  process.exit(1);
}
const openFence = manifest.indexOf("```json", start);
if (openFence < 0) {
  process.stderr.write("extract-inline-plan-contract: no json fence after inline contract intro\n");
  process.exit(1);
}
const bodyStart = manifest.indexOf("\n", openFence) + 1;
const closeFence = manifest.indexOf("\n```", bodyStart);
if (closeFence < 0) {
  process.stderr.write("extract-inline-plan-contract: unclosed json fence\n");
  process.exit(1);
}
const bytes = manifest.slice(bodyStart, closeFence) + "\n";
JSON.parse(bytes); // must be valid JSON before we write it
fs.writeFileSync(TARGET, bytes, { mode: 0o600 });
process.stdout.write(`${JSON.stringify({ ok: true, wrote: path.relative(ROOT, TARGET), bytes: Buffer.byteLength(bytes) })}\n`);
