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


const script = "scripts/query-spec-index.mjs";
test("WI-38 does not match WI-381 or embedded identifiers", (t) => {
  const dir = fixture(t); put(dir, ".svc/spec-index.json", { sections: {
    "docs/wi-381.md#title": {}, "docs/xwi-38.md#title": {}, "docs/wi-38-title.md#scope": {},
    "docs/other.md#body": { tags: ["wi:WI-38"] },
  } });
  const out = json(cli(script, ["--wi", "wi-38", "--json"], dir));
  assert.deepEqual(out.matches.map((m) => m.anchor), ["docs/other.md#body", "docs/wi-38-title.md#scope"]);
});
test("literal identifier punctuation is not interpreted as regex", (t) => {
  const dir = fixture(t); put(dir, ".svc/spec-index.json", { sections: { "docs/WI-3+.md": {}, "docs/WI-333.md": {} } });
  assert.equal(json(cli(script, ["--wi", "WI-3+", "--json"], dir)).total, 1);
});
test("surface matching, stable output and bounded results remain intact", (t) => {
  const dir = fixture(t); const sections = {};
  for (let i = 0; i < 120; i++) sections[`docs/baton-${i}.md#scope`] = { title: "Baton", byte_range: [0, 20] };
  put(dir, ".svc/spec-index.json", { sections });
  const args = ["--surface", "baton", "--json"]; const a = cli(script, args, dir); const b = cli(script, args, dir);
  const out = json(a); assert.equal(a.stdout, b.stdout); assert.equal(out.total, 120); assert.equal(out.truncated, true);
  assert.ok(a.stdout.length <= 6001); assert.ok(out.returned > 0);
});
