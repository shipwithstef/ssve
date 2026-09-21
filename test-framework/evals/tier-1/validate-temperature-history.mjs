#!/usr/bin/env node
/** Regression coverage for the functional improvement; fixtures never use live project state. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
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


const script = "scripts/assess-temperature.mjs";
test("zero confidence remains zero and recommends exploration", (t) => {
  const dir = fixture(t); put(dir, ".svc/agent-decisions.jsonl", '{"skill":"review-gate","confidence":0}\n');
  const out = json(cli(script, ["review-gate"], dir));
  assert.equal(out.metrics.avgConfidence, 0); assert.equal(out.temperature, "high");
});
test("a strong pass rate cannot erase a low-confidence signal", (t) => {
  const dir = fixture(t);
  put(dir, ".svc/auto-grades.jsonl", '{"skill":"review-gate","grade":"pass"}\n');
  put(dir, ".svc/agent-decisions.jsonl", '{"skill":"review-gate","confidence":0.2}\n');
  assert.equal(json(cli(script, ["review-gate"], dir)).temperature, "high");
});
test("neutral history is not described as missing history", (t) => {
  const dir = fixture(t); put(dir, ".svc/agent-decisions.jsonl", '{"skill":"review-gate","confidence":0.7}\n');
  const out = json(cli(script, ["review-gate"], dir));
  assert.equal(out.temperature, "low"); assert.doesNotMatch(out.reasons.join(" "), /no grade\/decision history/);
});
test("invalid metrics are ignored without changing the no-history default", (t) => {
  const dir = fixture(t); put(dir, ".svc/agent-decisions.jsonl", '{"skill":"review-gate","confidence":-1}\nnot-json\n');
  put(dir, ".svc/auto-grades.jsonl", '{"skill":"review-gate","grade":"pending"}\n');
  const out = json(cli(script, ["review-gate"], dir));
  assert.equal(out.metrics.avgConfidence, null); assert.equal(out.metrics.passRate, null); assert.equal(out.temperature, "low");
});
test("existing failure thresholds and read-only behavior remain intact", (t) => {
  const dir = fixture(t); const input = Array(3).fill('{"skill":"review-gate","grade":"fail"}').join("\n");
  const file = put(dir, ".svc/auto-grades.jsonl", input);
  const out = json(cli(script, ["review-gate"], dir));
  assert.equal(out.temperature, "high"); assert.equal(out.metrics.recentFails, 3); assert.equal(fs.readFileSync(file, "utf8"), input);
});
