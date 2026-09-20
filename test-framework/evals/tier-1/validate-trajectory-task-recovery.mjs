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


const script = "scripts/mine-trajectory-patterns.mjs";
/** Mine real fixture logs through the unchanged atomic writer. */
function mine(t, grades) {
  const dir = fixture(t); const text = grades.map((g) => JSON.stringify(g)).join("\n") + "\n";
  const file = put(dir, ".svc/auto-grades.jsonl", text); const out = json(cli(script, [], dir));
  assert.equal(fs.readFileSync(file, "utf8"), text); return out;
}
test("nonterminal grades are not counted as failures", (t) => {
  const out = mine(t, [{ skill: "review", grade: "pass" }, { skill: "review", grade: "pending" }]);
  assert.deepEqual(out.skill_pass_rates.review, { pass: 1, fail: 0 });
  assert.equal(out.total_grades, 2); assert.equal(out.valid_grades, 1); assert.equal(out.ignored_grades, 1);
});
test("interleaved tasks recover against their own preceding result", (t) => {
  const out = mine(t, [
    { skill: "review", wi: "WI-example", task_id: "A", grade: "fail", findings: "A issue" },
    { skill: "review", wi: "WI-example", task_id: "B", grade: "fail", findings: "B issue" },
    { skill: "review", wi: "WI-example", task_id: "A", grade: "pass", iterations: 0 },
  ]);
  assert.equal(out.dead_end_patterns.length, 1); assert.equal(out.dead_end_patterns[0].task_id, "A");
  assert.equal(out.dead_end_patterns[0].original_findings, "A issue"); assert.equal(out.dead_end_patterns[0].recovery_iterations, 0);
});
test("a different task's pass is not evidence of recovery", (t) => {
  const out = mine(t, [{ skill: "review", task_id: "A", grade: "fail" }, { skill: "review", task_id: "B", grade: "pass" }]);
  assert.deepEqual(out.dead_end_patterns, []);
});
test("legacy adjacent recovery remains compatible without inventing identity", (t) => {
  const out = mine(t, [{ skill: "review", grade: "fail" }, { skill: "review", grade: "pass" }]);
  assert.equal(out.dead_end_patterns.length, 1); assert.equal(Object.hasOwn(out.dead_end_patterns[0], "task_id"), false);
});
test("missing history still produces an empty derived report", (t) => {
  const dir = fixture(t); const out = json(cli(script, [], dir));
  assert.equal(out.total_grades, 0); assert.deepEqual(out.dead_end_patterns, []);
});
test("reused task IDs and unscoped interleaving cannot fabricate recovery", (t) => {
  const out = mine(t, [
    { skill: "review", wi: "WI-one", task_id: "T3", grade: "fail" },
    { skill: "review", wi: "WI-two", task_id: "T3", grade: "pass" },
    { skill: "review", task_id: "A", grade: "fail" },
    { skill: "other", task_id: "B", grade: "pass" },
    { skill: "review", task_id: "A", grade: "pass" },
  ]);
  assert.deepEqual(out.dead_end_patterns, []);
});
