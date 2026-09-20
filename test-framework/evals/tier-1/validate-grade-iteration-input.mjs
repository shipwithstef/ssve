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


const script = "scripts/write-auto-grade.mjs";
const base = ["--skill", "review-gate", "--grade", "pass"];
test("invalid counts cannot silently become misleading grade metadata", (t) => {
  const dir = fixture(t); const existing = '{"skill":"other","grade":"pass"}\n'; const file = put(dir, ".svc/auto-grades.jsonl", existing);
  for (const value of ["-1", "1.5", "2oops", "NaN", "Infinity", "9007199254740992", ""]) {
    const out = cli(script, [...base, "--iterations", value], dir); assert.equal(out.status, 1); assert.equal(out.stdout, "");
  }
  assert.equal(fs.readFileSync(file, "utf8"), existing);
});
test("an iterations flag with no value fails before state creation", (t) => {
  const dir = fixture(t); assert.equal(cli(script, [...base, "--iterations"], dir).status, 1);
  assert.equal(fs.existsSync(path.join(dir, ".svc")), false);
});
test("zero and ordinary counts append unchanged numeric values", (t) => {
  const dir = fixture(t);
  assert.equal(json(cli(script, [...base, "--iterations", "0"], dir)).iterations, 0);
  assert.equal(json(cli(script, [...base, "--iterations", "3"], dir)).iterations, 3);
  assert.equal(fs.readFileSync(path.join(dir, ".svc/auto-grades.jsonl"), "utf8").trim().split("\n").length, 2);
});
test("optional omission and existing pass/fail validation are preserved", (t) => {
  const dir = fixture(t); assert.equal(Object.hasOwn(json(cli(script, base, dir)), "iterations"), false);
  assert.equal(cli(script, ["--skill", "x", "--grade", "pending"], dir).status, 1);
});
