#!/usr/bin/env node
// check-tier1-env-red-set.mjs — WI-487 F-006/F-019.
//
// Structured-results env-red-subset parser for the Tier-1 baseline gate. The
// acceptance predicate is a SET RELATION, never a numeric triple:
//
//   PASS iff FAILED_IDS ⊆ ENV_RED_SET
//        AND every --require-pass validator is present and NOT failing
//        AND each surviving env-red failure still matches its recorded cause
//            (cause_class + digest) from the baseline cause map (when provided).
//
// Usage:
//   node scripts/check-tier1-env-red-set.mjs --results <run-all-evals.out>
//     --baseline docs/specs/test-evidence/WI-487/env-red-baseline.json
//     --env-red a.sh,b.sh --require-pass c.sh,d.sh
//
// Exit 0 on PASS; exit 1 on FAIL (a NEW content failure, a changed env-red cause,
// or a missing/failing required validator).

import crypto from "node:crypto";
import fs from "node:fs";

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; }
function fail(msg) { process.stderr.write(`check-tier1-env-red-set: FAIL — ${msg}\n`); process.exit(1); }

const resultsPath = arg("--results");
if (!resultsPath) fail("--results <file> required");
let text;
try { text = fs.readFileSync(resultsPath, "utf8"); } catch (e) { fail(`cannot read results: ${e.message}`); }

const envRed = new Set((arg("--env-red") || "").split(",").map((s) => s.trim()).filter(Boolean));
const requirePass = (arg("--require-pass") || "").split(",").map((s) => s.trim()).filter(Boolean);
let baseline = {};
const baselinePath = arg("--baseline");
if (baselinePath) {
  try { baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8")); } catch { baseline = {}; }
}

// Parse the run-all-evals.sh output. A validator FAILED if a "FAIL: <name>" line
// exists; it was RUN if a "Running <name>..." line exists.
const failedIds = new Set();
const ranIds = new Set();
// Match ONLY the run-all-evals harness lines, never validator OUTPUT content:
//   "  Running <name>..."                         -> ran
//   "  FAIL: <name>.(sh|mjs) (rc=N)"               -> failed
//   "  FAIL: <name>.(sh|mjs) — timed out at ..."   -> failed (timeout)
for (const line of text.split(/\r?\n/)) {
  let m = line.match(/^\s*Running\s+(\S+\.(?:sh|mjs))\.\.\.\s*$/);
  if (m) ranIds.add(m[1]);
  m = line.match(/^\s*FAIL:\s+(\S+\.(?:sh|mjs))\s+(?:\(rc=|—\s*timed out)/);
  if (m) failedIds.add(m[1]);
}

// 1. FAILED_IDS ⊆ ENV_RED_SET (any member outside the env-red set is a NEW content failure).
const newFailures = [...failedIds].filter((id) => !envRed.has(id));
if (newFailures.length) fail(`NEW content failure(s) outside ENV_RED_SET: ${newFailures.join(", ")}`);

// 2. Every --require-pass validator must have RUN and NOT be failing.
for (const id of requirePass) {
  if (!ranIds.has(id)) fail(`required validator not present/run: ${id}`);
  if (failedIds.has(id)) fail(`required validator is failing: ${id}`);
}

// 3. Surviving env-red failures must still match their recorded cause (best-effort:
// when the baseline records a digest AND the results contain a per-validator block,
// verify the normalized failure signature is unchanged).
for (const id of failedIds) {
  const rec = baseline[id];
  if (!rec) continue; // no recorded cause map entry — subset membership already enforced above
  if (rec.digest) {
    const sig = normalizedSignature(text, id);
    if (sig) {
      const cur = crypto.createHash("sha256").update(sig, "utf8").digest("hex");
      if (cur !== rec.digest) {
        fail(`env-red validator ${id} still fails but its signature changed (new/code reason hiding behind an allowed id)`);
      }
    }
  }
}

process.stderr.write(`check-tier1-env-red-set: PASS — FAILED_IDS {${[...failedIds].join(", ") || "none"}} ⊆ ENV_RED_SET; required validators present + passing\n`);
process.exit(0);

// Extract a validator's block from the run output and whitespace-normalize the
// classification-relevant lines (best-effort — used only when a baseline digest exists).
function normalizedSignature(all, id) {
  const start = all.indexOf(`Running ${id}...`);
  if (start < 0) return "";
  const rest = all.slice(start);
  const next = rest.indexOf("\n  Running ");
  const block = next > 0 ? rest.slice(0, next) : rest;
  return block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("\n");
}
