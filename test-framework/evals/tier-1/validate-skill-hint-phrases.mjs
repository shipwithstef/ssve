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


const script = "scripts/resolve-skill-hint.mjs";
/** Resolve a hint against only the fixture catalog. */
function hint(t, text, skills = ["write-e2e", "review-gate", "audit-implementation", "write-spec", "track-visuals"]) {
  const dir = fixture(t); const manifest = put(dir, "manifest.json", { includedSkills: skills });
  return json(cli(script, ["--text", text, "--manifest", manifest], dir)).matches;
}
test("partial words do not produce high-confidence skill matches", (t) => {
  assert.deepEqual(hint(t, "e2eology and qa skilled tasks"), []);
});
test("normalized whole phrases keep existing synonyms", (t) => {
  assert.deepEqual(hint(t, "Please write an end-to-end test").map((m) => m.skill), ["write-e2e"]);
});
test("ambiguous QA hints preserve both alternatives", (t) => {
  assert.deepEqual(hint(t, "qa skills").map((m) => m.skill), ["review-gate", "audit-implementation"]);
});
test("explicit catalog names need no hand-maintained alias", (t) => {
  assert.equal(hint(t, "Run /skill:write-spec now")[0].skill, "write-spec");
  assert.deepEqual(hint(t, "write-spec", ["write-e2e"]), []);
});
test("plural screenshots stay supported without duplicate matches", (t) => {
  assert.deepEqual(hint(t, "track-visuals screenshots").map((m) => m.skill), ["track-visuals"]);
});
