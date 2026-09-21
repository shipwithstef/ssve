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

test("option-looking choice and reasoning text retain their literal bytes", (t) => {
  const dir = fixture(t);
  for (const value of ["--dry-run", "--skill", "--confidence", "--", "--choice=value"]) {
    const out = json(cli(script, [...decision.slice(0, -1), value, "--reasoning", "--dry-run avoids writes"], dir));
    assert.equal(out.choice, value); assert.equal(out.reasoning, "--dry-run avoids writes");
  }
  const rows = fs.readFileSync(path.join(dir, ".svc/agent-decisions.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  assert.equal(rows.length, 5); assert.equal(rows[0].choice, "--dry-run");
});
test("meta-learning observation text also accepts option-looking values", (t) => {
  const dir = fixture(t);
  const out = json(cli(script, ["--type", "meta-learning", "--category", "cli", "--observation", "--dry-run avoids writes"], dir));
  assert.equal(out.observation, "--dry-run avoids writes");
});
test("missing values and invalid typed options preserve existing append-only history", (t) => {
  const dir = fixture(t); json(cli(script, decision, dir));
  const file = path.join(dir, ".svc/agent-decisions.jsonl"); const before = fs.readFileSync(file, "utf8");
  for (const extra of [["--skill"], ["--reasoning"], ["--confidence"], ["--confidence", "--skill"], ["bad", "value"], ["--skill", " "]]) {
    const out = cli(script, [...decision, ...extra], dir);
    assert.equal(out.status, 1, JSON.stringify(extra)); assert.equal(out.stdout, "");
    assert.equal(fs.readFileSync(file, "utf8"), before);
  }
});
for (const type of ["decision", "meta-learning"]) {
  for (const confidence of [0, 0.5, 1, undefined]) {
    test(`${type} writer-to-reader boundary confidence=${confidence}`, (t) => {
      const dir = fixture(t);
      const args = type === "decision" ? decision : ["--type", type, "--category", "cli", "--observation", "use fixtures"];
      json(cli(script, [...args, "--skill", "review-gate", ...(confidence === undefined ? [] : ["--confidence", String(confidence)])], dir));
      const file = path.join(dir, ".svc/agent-decisions.jsonl"); const before = fs.readFileSync(file, "utf8");
      const out = json(cli("scripts/assess-temperature.mjs", ["review-gate"], dir));
      assert.equal(out.metrics.avgConfidence, confidence ?? null);
      assert.equal(out.temperature, confidence === 0 ? "high" : "low");
      if (confidence !== undefined) { assert.doesNotMatch(out.reasons.join(" "), /no grade\/decision history/); }
      assert.equal(fs.readFileSync(file, "utf8"), before);
    });
  }
}
test("mixed zero and one confidence averages correctly without crossing skill scope", (t) => {
  const dir = fixture(t);
  for (const confidence of [0, 1]) { json(cli(script, [...decision, "--skill", "review-gate", "--confidence", String(confidence)], dir)); }
  json(cli(script, [...decision, "--skill", "write-spec", "--confidence", "0"], dir));
  const out = json(cli("scripts/assess-temperature.mjs", ["review-gate"], dir));
  assert.equal(out.metrics.avgConfidence, 0.5); assert.equal(out.temperature, "low");
});
