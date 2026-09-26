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


const script = "scripts/measure-skill-budget.mjs";
test("LF and BOM/CRLF catalogs produce identical metrics", (t) => {
  const a = fixture(t); const b = fixture(t); const skill = "---\nname: demo\ndescription: Use for testing.\n---\nBody\n";
  put(a, "demo/SKILL.md", skill); put(b, "demo/SKILL.md", "\uFEFF" + skill.replace(/\n/g, "\r\n"));
  const args = (dir) => ["--root", dir, "--json"];
  assert.deepEqual(json(cli(script, args(a), a)), json(cli(script, args(b), b)));
});
test("disabled skills are excluded and ties are stable", (t) => {
  const dir = fixture(t);
  for (const name of ["zeta", "alpha"]) put(dir, `${name}/SKILL.md`, "---\ndescription: same\n---\n");
  put(dir, "hidden/SKILL.md", "---\ndescription: much longer\ndisable-model-invocation: true\n---\n");
  const out = json(cli(script, ["--root", dir, "--json"], dir));
  assert.equal(out.active, 2); assert.equal(out.disabled, 1); assert.equal(out.description_chars, 8);
  assert.deepEqual(out.largest.map((r) => r.name), ["alpha", "zeta"]);
});
test("invalid numeric inputs are usage errors, not NaN reports", (t) => {
  const dir = fixture(t);
  for (const args of [["--fraction", "0"], ["--context", "NaN"], ["--top", "-1"], ["--root"]]) {
    const result = cli(script, args, dir); assert.equal(result.status, 2); assert.equal(result.stdout, "");
  }
});
test("help succeeds and missing roots fail without a stack trace", (t) => {
  const dir = fixture(t); assert.equal(cli(script, ["--help"], dir).status, 0);
  const result = cli(script, ["--root", path.join(dir, "absent")], dir);
  assert.equal(result.status, 1); assert.doesNotMatch(result.stderr, /at report|node:internal/);
});
