#!/usr/bin/env node
/** Regression coverage for the functional improvement; fixtures never use live project state. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** Create a disposable project and remove it after the test. */
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ssve-functional-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
/** Write a fixture file, creating only fixture-owned parents. */
function put(dir, name, value) {
  const file = path.join(dir, name); fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value)); return file;
}
/** Execute the real CLI with bounded runtime and isolated project state. */
function cli(script, args, cwd, env = {}) {
  return spawnSync(process.execPath, [path.join(root, script), ...args], {
    cwd, env: { ...process.env, SVC_PROJECT_DIR: cwd, ...env }, encoding: "utf8", timeout: 10000,
  });
}
/** Require successful machine-readable output. */
function json(result) { assert.equal(result.status, 0, result.stderr); return JSON.parse(result.stdout); }


const script = "scripts/write-decision.mjs";
const decision = ["--type", "decision", "--decision_point", "approach", "--choice", "small change"];

// Permanent writer-to-reader regressions use the actual assessment implementation.
for (const [confidence, average, temperature] of [["0", 0, "high"], ["0.25", 0.25, "high"], ["1", 1, "low"], [null, null, "low"]]) {
  test(`attributed decision reaches assessment unchanged: confidence=${confidence}`, (t) => {
    const dir = fixture(t);
    const args = [...decision, "--skill", "review-gate"];
    if (confidence !== null) { args.push("--confidence", confidence); }
    const written = json(cli(script, args, dir));
    assert.equal(written.confidence, average);
    const ledger = path.join(dir, ".svc/agent-decisions.jsonl");
    const bytes = fs.readFileSync(ledger); const mtime = fs.statSync(ledger).mtimeMs;
    const result = json(cli("scripts/assess-temperature.mjs", ["review-gate"], dir));
    assert.equal(result.metrics.avgConfidence, average); assert.equal(result.temperature, temperature);
    if (confidence !== null) { assert.doesNotMatch(result.reasons.join(" "), /no grade\/decision history/); }
    assert.deepEqual(fs.readFileSync(ledger), bytes); assert.equal(fs.statSync(ledger).mtimeMs, mtime);
  });
}
test("real writer's zero confidence is not overwritten by a perfect grade history", (t) => {
  const dir = fixture(t);
  json(cli(script, [...decision, "--skill", "review-gate", "--confidence", "0"], dir));
  put(dir, ".svc/auto-grades.jsonl", '{"skill":"review-gate","grade":"pass"}\n');
  const result = json(cli("scripts/assess-temperature.mjs", ["review-gate"], dir));
  assert.equal(result.metrics.passRate, 1); assert.equal(result.metrics.avgConfidence, 0);
  assert.equal(result.temperature, "high");
});
test("a rejected decision does not change downstream metrics or existing ledger bytes", (t) => {
  const dir = fixture(t);
  json(cli(script, [...decision, "--skill", "review-gate", "--confidence", "0"], dir));
  const prior = json(cli("scripts/assess-temperature.mjs", ["review-gate"], dir));
  const ledger = path.join(dir, ".svc/agent-decisions.jsonl"); const bytes = fs.readFileSync(ledger);
  const invalid = cli(script, [...decision, "--skill", "review-gate", "--confidence", "2"], dir);
  assert.equal(invalid.status, 1); assert.equal(invalid.stdout, "");
  assert.deepEqual(json(cli("scripts/assess-temperature.mjs", ["review-gate"], dir)), prior);
  assert.deepEqual(fs.readFileSync(ledger), bytes);
});
