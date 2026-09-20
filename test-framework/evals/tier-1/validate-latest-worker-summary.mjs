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


const start = "=== SVC_WORKER_SUMMARY ==="; const end = "=== END_SVC_WORKER_SUMMARY ===";
const block = (value) => `${start}\n${value}\n${end}\n`;
/** Run the real Bash extractor, not a reimplementation. */
function extract(t, log) {
  const dir = fixture(t); const file = put(dir, "worker.log", log);
  return spawnSync("bash", [path.join(root, "scripts/extract-summary.sh"), file], { cwd: dir, encoding: "utf8", timeout: 10000 });
}
test("one complete summary preserves its exact lines", (t) => {
  const value = block("result: done"); const out = extract(t, `noise\n${value}tail\n`);
  assert.equal(out.status, 0); assert.equal(out.stdout, value);
});
test("multiple completed attempts return only the latest", (t) => {
  const out = extract(t, block("first") + "noise\n" + block("second"));
  assert.equal(out.status, 0); assert.equal(out.stdout, block("second"));
});
test("a truncated trailing retry cannot reuse an older completion", (t) => {
  const out = extract(t, block("complete") + `${start}\npartial`);
  assert.equal(out.status, 1); assert.equal(out.stdout, "");
});
test("a restarted block discards the interrupted attempt", (t) => {
  const out = extract(t, `${start}\npartial\n` + block("restarted"));
  assert.equal(out.status, 0); assert.equal(out.stdout, block("restarted"));
});
test("missing complete blocks and unreadable inputs keep distinct failures", (t) => {
  const out = extract(t, `${start}\npartial`); assert.equal(out.status, 1); assert.equal(out.stdout, "");
  const dir = fixture(t);
  const missing = spawnSync("bash", [path.join(root, "scripts/extract-summary.sh"), path.join(dir, "absent")], { encoding: "utf8" });
  assert.equal(missing.status, 2); assert.equal(missing.stdout, "");
});
