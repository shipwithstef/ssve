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


const script = "scripts/population-compare.mjs";
/** Materialize worker results and run the real comparer. */
function compare(t, results) {
  const dir = fixture(t); const population = path.join(dir, "population"); fs.mkdirSync(population);
  for (const [name, value] of Object.entries(results)) put(population, name, value);
  return { dir, out: json(cli(script, [population], dir)) };
}
test("a failed worker cannot outrank a successful worker for learning", (t) => {
  const { dir, out } = compare(t, {
    "failed.result.json": { status: "failed", clean_worktree: true, validation_evidence: "log", changed_files: [], worker_summary: "minimal tests" },
    "success.result.json": { status: "success", worker_summary: "completed" },
  });
  assert.equal(out.winner, "success.result.json"); assert.equal(out.total, 2); assert.equal(out.eligible, 1);
  const saved = fs.readFileSync(path.join(dir, ".svc/population-patterns.jsonl"), "utf8"); assert.doesNotMatch(saved, /minimal tests/);
});
test("all-failed or empty populations produce no learning-state writes", (t) => {
  for (const results of [{ "failed.result.json": { status: "failed" } }, {}]) {
    const { dir, out } = compare(t, results); assert.equal(out.winner, null); assert.equal(out.patterns, 0);
    assert.equal(fs.existsSync(path.join(dir, ".svc")), false);
  }
});
test("equal successful scores use stable physical filename ordering", (t) => {
  const { out } = compare(t, { "z.result.json": { status: "success" }, "a.result.json": { status: "success", file: "not-the-physical-name" } });
  assert.equal(out.winner, "a.result.json"); assert.equal(out.patterns, 1); assert.equal(out.eligible, 2);
});
test("missing populations are unsuccessful reports, not false successful runs", (t) => {
  const dir = fixture(t); const result = cli(script, [path.join(dir, "absent")], dir);
  assert.equal(result.status, 1); assert.match(JSON.parse(result.stdout).error, /not found/); assert.equal(fs.existsSync(path.join(dir, ".svc")), false);
});
