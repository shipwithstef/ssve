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


const script = "scripts/write-decision.mjs";
const decision = ["--type", "decision", "--decision_point", "approach", "--choice", "small change"];
test("optional skill attribution and zero confidence survive actual append", (t) => {
  const dir = fixture(t); const out = json(cli(script, [...decision, "--skill", "review-gate", "--confidence", "0"], dir));
  assert.equal(out.skill, "review-gate"); assert.equal(out.confidence, 0);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, ".svc/agent-decisions.jsonl"), "utf8")), out);
});
test("legacy callers may omit attribution and confidence", (t) => {
  const dir = fixture(t); const out = json(cli(script, decision, dir));
  assert.equal(Object.hasOwn(out, "skill"), false); assert.equal(out.confidence, null); assert.equal(out.evidence_level, "training_data");
});
test("invalid confidence is rejected before creating or appending state", (t) => {
  const dir = fixture(t);
  for (const value of ["NaN", "Infinity", "-0.1", "1.1", ""]) {
    const out = cli(script, [...decision, "--confidence", value], dir); assert.equal(out.status, 1); assert.equal(out.stdout, "");
  }
  assert.equal(cli(script, [...decision, "--confidence"], dir).status, 1);
  assert.equal(fs.existsSync(path.join(dir, ".svc")), false);
});
test("meta-learning attribution retains normalized applicability", (t) => {
  const dir = fixture(t); const out = json(cli(script, ["--type", "meta-learning", "--category", "testing", "--observation", "use fixtures", "--skill", "write-spec", "--applies_to", " review-gate,review-gate, write-spec "], dir));
  assert.equal(out.skill, "write-spec"); assert.deepEqual(out.applies_to, ["review-gate", "write-spec"]);
});
test("the existing assessment consumer sees a newly recorded skill decision", (t) => {
  const dir = fixture(t); json(cli(script, [...decision, "--skill", "review-gate", "--confidence", "0.25"], dir));
  const out = json(cli("scripts/assess-temperature.mjs", ["review-gate"], dir));
  assert.equal(out.metrics.avgConfidence, 0.25);
});

/** Run a decision fixture with the same bounded CLI helper as the original tests. */
function run(root, args) { return cli(script, args, root); }

for (const [field, value] of [
  ["choice", "--dry-run"], ["reasoning", "--dry-run avoids writes"],
  ["decision_point", "--output format"], ["choice", "--dry-run=preview"],
  ["choice", "--skill"], ["reasoning", "--confidence=0"],
]) {
  test(`literal ${field} text beginning with -- is preserved`, (t) => {
    const root = fixture(t);
    const result = run(root, [...decision, `--${field}`, value]);
    assert.equal(result.status, 0, result.stderr);
    const entry = JSON.parse(result.stdout);
    assert.equal(entry[field], value);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, ".svc/agent-decisions.jsonl"), "utf8")), entry);
  });
}

test("meta-learning observation preserves literal flags and Unicode", (t) => {
  const root = fixture(t);
  const text = "--dry-run preserves café data\nwithout writes";
  const result = run(root, ["--type", "meta-learning", "--category", "verification", "--observation", text]);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).observation, text);
});

test("equals syntax disambiguates known option names without losing embedded equals", (t) => {
  const root = fixture(t);
  const result = run(root, [
    "--type=decision", "--decision_point=CLI", "--choice=--skill", "--reasoning=--confidence=0",
    "--skill=review-gate", "--confidence=0",
  ]);
  assert.equal(result.status, 0, result.stderr);
  const entry = JSON.parse(result.stdout);
  assert.equal(entry.choice, "--skill");
  assert.equal(entry.reasoning, "--confidence=0");
  assert.equal(entry.confidence, 0);
  assert.equal(entry.skill, "review-gate");
});

test("missing known-option values cannot modify an existing ledger", (t) => {
  const root = fixture(t);
  assert.equal(run(root, decision).status, 0);
  const ledger = path.join(root, ".svc/agent-decisions.jsonl");
  const original = fs.readFileSync(ledger);
  const mtime = fs.statSync(ledger).mtimeMs;
  for (const extra of [
    ["--choice", "--skill", "review-gate"], ["--reasoning"], ["--skill", "--confidence=0"],
    ["--skill", "--confidence", "0"], ["--choice="], ["--confidence=NaN"], ["--"],
  ]) {
    const result = run(root, [...decision, ...extra]);
    assert.equal(result.status, 1, JSON.stringify(extra));
    assert.equal(result.stdout, "");
    assert.notEqual(result.stderr.trim(), "");
    assert.deepEqual(fs.readFileSync(ledger), original);
    assert.equal(fs.statSync(ledger).mtimeMs, mtime);
  }
});
