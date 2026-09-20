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


const script = "scripts/htn-decompose.mjs";
const phase = (id, preconditions, postconditions) => ({ id, preconditions, postconditions });
/** Exercise extended plans through the real read-only CLI. */
function validate(t, tree) { const dir = fixture(t); const file = put(dir, "plan.json", { tree }); return cli(script, ["--validate", file], dir); }
test("phase names do not reorder dependencies", (t) => {
  const plan = [phase("P2", [], ["ready"]), phase("P10", ["ready"], ["done"])];
  assert.deepEqual(json(validate(t, plan)).tree, plan);
});
test("future and same-phase postconditions cannot satisfy a prerequisite", (t) => {
  assert.equal(validate(t, [phase("P2", ["ready"], []), phase("P1", [], ["ready"])]).status, 1);
  assert.equal(validate(t, [phase("P1", ["ready"], ["ready"])]).status, 1);
});
test("malformed and duplicate phases fail with useful diagnostics", (t) => {
  for (const tree of [[], [null], [phase("P1", "bad", [])], [phase("P1", [], []), phase("P1", [], [])]]) {
    const out = validate(t, tree); assert.equal(out.status, 1); assert.match(out.stderr, /htn-decompose:/);
  }
});
test("existing scaffold and empty model-owned subtasks remain unchanged", (t) => {
  const dir = fixture(t); const out = json(cli(script, ["Build something", '{"area":"ui"}'], dir));
  assert.equal(out.goal, "Build something"); assert.equal(out.context.area, "ui");
  assert.deepEqual(out.tree.map((p) => p.id), ["P1","P2","P3","P4","P5"]);
  assert.ok(out.tree.every((p) => p.subtasks.length === 0));
});
test("invalid JSON produces no plan and leaves source bytes unchanged", (t) => {
  const dir = fixture(t); const file = put(dir, "bad.json", "not-json");
  const out = cli(script, ["--validate", file], dir); assert.equal(out.status, 1); assert.equal(out.stdout, "");
  assert.equal(fs.readFileSync(file, "utf8"), "not-json"); assert.equal(cli(script, ["--help"], dir).status, 0);
});
