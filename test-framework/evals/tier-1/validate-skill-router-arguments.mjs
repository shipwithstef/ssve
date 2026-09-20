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


const { parseArgs } = await import(pathToFileURL(path.join(root, "scripts/lib/skill-router-args.mjs")));
test("missing values and option-as-value mistakes fail explicitly", () => {
  for (const flag of ["--root", "--intent", "--files", "--packages", "--env", "--active-skill", "--next-skill", "--mode"]) {
    assert.throws(() => parseArgs(["route", flag]), /requires a value/);
    assert.throws(() => parseArgs(["route", flag, "--no-receipts"]), /requires a value/);
  }
});
test("context lists trim, deduplicate and discard empty entries", () => {
  const args = parseArgs(["route", "--files", " src/a, src/b ,src/a,,", "--packages", "react, react", "--env", " A, B,A"]);
  assert.deepEqual(args.files, ["src/a", "src/b"]); assert.deepEqual(args.packages, ["react"]); assert.deepEqual(args.env, ["A", "B"]);
});
test("unknown flags, extra positionals and invalid modes are rejected", () => {
  assert.throws(() => parseArgs(["route", "--wat"]), /unknown flag/);
  assert.throws(() => parseArgs(["route", "extra"]), /unexpected positional/);
  assert.throws(() => parseArgs(["route", "--mode", "automatic"]), /--mode must/);
});
test("existing valid options retain their meaning without inventing a mode", () => {
  const args = parseArgs(["route", "--intent", "", "--no-receipts", "--active-skill", "write-spec"]);
  assert.equal(args.intent, ""); assert.equal(args.noReceipts, true); assert.equal(args.activeSkill, "write-spec"); assert.equal(args.mode, undefined);
  assert.deepEqual(parseArgs(["compile", "--check"]), { _: ["compile"], check: true });
});
test("help is an explicit non-mutating request", () => {
  assert.equal(parseArgs(["--help"]).help, true); assert.equal(parseArgs(["route", "-h"]).help, true);
});
test("the actual CLI wires parser errors and help before routing", (t) => {
  const dir = fixture(t);
  put(dir, "scripts/skill-router.mjs", fs.readFileSync(path.join(root, "scripts/skill-router.mjs"), "utf8"));
  put(dir, "scripts/lib/skill-router-args.mjs", fs.readFileSync(path.join(root, "scripts/lib/skill-router-args.mjs"), "utf8"));
  // These test doubles must never be called; this verifies CLI wiring, not routing decisions.
  put(dir, "scripts/compile-skill-router-index.mjs", 'export function compile(){throw new Error("unexpected compile")}');
  put(dir, "scripts/lib/skill-router.mjs", 'export const BUDGETS={}; export function route(){throw new Error("unexpected route")} export const loadIndex=route,verifyIndexFreshness=route,validateDecision=route;');
  const script = path.join(dir, "scripts/skill-router.mjs");
  const run = (args) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: "utf8", timeout: 10000 });
  assert.equal(run(["--help"]).status, 0);
  const result = run(["route", "--intent", "x", "--files"]);
  assert.equal(result.status, 2); assert.match(result.stderr, /--files requires a value/); assert.doesNotMatch(result.stderr, /unexpected route/);
});
