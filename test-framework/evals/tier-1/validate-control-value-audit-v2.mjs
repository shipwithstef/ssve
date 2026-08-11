#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { auditControlValueLedger } from "../../../scripts/svc-control-value-audit-v2.mjs";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
  } catch (error) {
    console.error(`not ok ${name}: ${error.message}`);
    process.exitCode = 1;
  }
}

const proposalPath = path.resolve(import.meta.dirname, "../../../proposals/2026-08-10-wi368-execution-controller-v2.md");
const proposal = fs.readFileSync(proposalPath, "utf8");

check("all observed framework controls have a no-value-loss disposition", () => {
  const result = auditControlValueLedger(proposal, { minimum_controls: 80 });
  assert.equal(result.valid, true, result.errors?.join("; "));
  assert.equal(result.summary.controls, 80);
  assert.equal(result.summary.deleted, 0);
  assert.equal(result.summary.unproven_deletions, 0);
  assert.equal(result.summary.preserved + result.summary.strengthened + result.summary.replaced, 80);
  assert.match(result.ledger_digest, /^[a-f0-9]{64}$/);
});

check("missing control row breaks contiguous coverage", () => {
  const input = proposal.replace(/^\| 40 \|.*\n/m, "");
  const result = auditControlValueLedger(input, { minimum_controls: 80 });
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("minimum is 80")));
  assert(result.errors.some((error) => error.includes("expected 40, found 41")));
});

check("replacement without proof cannot pass", () => {
  const input = proposal.replace(/(\| 33 \|.*?\|.*?\| )(.*?)( \|)/m, "$1Make it better later.$3");
  const result = auditControlValueLedger(input, { minimum_controls: 80 });
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("control 33 replacement has no proof mechanism")));
});

check("deletion is denied without zero-benefit authority ROI and corpus", () => {
  const input = proposal.replace(/(\| 33 \|.*?\|.*?\| )(.*?)( \|)/m, "$1**DELETE:** test says remove it.$3");
  const result = auditControlValueLedger(input, { minimum_controls: 80 });
  assert.equal(result.valid, false);
  assert(result.errors.some((error) => error.includes("ZERO_UNIQUE_BENEFIT")));
  assert(result.errors.some((error) => error.includes("owner-authority digest")));
  assert(result.errors.some((error) => error.includes("measured ROI")));
  assert(result.errors.some((error) => error.includes("regression corpus")));
});

check("80 distinct control-row proof removals produce zero false-valid ledgers", () => {
  let falseValid = 0;
  for (let index = 1; index <= 80; index += 1) {
    const row = String(index).padStart(2, "0");
    const input = proposal.replace(new RegExp(`(^\\| ${row} \\|.*?\\|.*?\\| )(.*?)( \\|$)`, "m"), "$1No executable replacement mechanism.$3");
    if (auditControlValueLedger(input, { minimum_controls: 80 }).valid) falseValid += 1;
  }
  assert.equal(falseValid, 0);
});

check("CLI emits one compact 80-control audit", () => {
  const script = path.resolve(import.meta.dirname, "../../../scripts/svc-control-value-audit-v2.mjs");
  const result = spawnSync(process.execPath, [script, "--proposal", proposalPath, "--minimum-controls", "80"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(JSON.parse(result.stdout).summary.controls, 80);
});

if (process.exitCode) console.error(`control value audit v2: ${passed} passed, failures present`);
else console.log(`control value audit v2: ${passed} passed, 0 failed`);
