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


const script = "scripts/generate-a2ui-catalog.mjs";
/** Generate a real catalog from one fixture component. */
function catalog(t, source) {
  const dir = fixture(t); put(dir, "src/components/ui/Button.tsx", source);
  const out = cli(script, [], dir); assert.equal(out.status, 0, out.stderr);
  return { dir, value: JSON.parse(fs.readFileSync(path.join(dir, "docs/specs/ui/catalog.json"), "utf8")) };
}
test("all literal choices survive, including spaces, hyphens and duplicates", (t) => {
  const { value } = catalog(t, `type Props = { size?: 'small' | 'extra-large' | "very large" | 'small'; }`);
  assert.deepEqual(value.components.Button.properties.size, { type: "string", enum: ["small", "extra-large", "very large"] });
});
test("primitive types retain their original catalog shape", (t) => {
  const { value } = catalog(t, "type Props = { label: string; count?: number; disabled: boolean; }");
  assert.deepEqual(value.components.Button.properties, { component: { const: "Button" }, label: { type: "string" }, count: { type: "number" }, disabled: { type: "boolean" } });
});
test("comma-separated declarations and commas inside literals remain supported", (t) => {
  const { value } = catalog(t, `type Props = { label: string, size: 'small, compact' | 'large', enabled: boolean }`);
  assert.deepEqual(value.components.Button.properties.size.enum, ["small, compact", "large"]);
  assert.equal(value.components.Button.properties.label.type, "string");
  assert.equal(value.components.Button.properties.enabled.type, "boolean");
});
test("mixed or unsupported unions are not published as incomplete enums", (t) => {
  const { value } = catalog(t, "type Props = { size: 'small' | number; value: string | undefined; }");
  assert.equal(Object.hasOwn(value.components.Button.properties, "size"), false);
  assert.equal(Object.hasOwn(value.components.Button.properties, "value"), false);
});
test("catalog order and repeated generation remain deterministic", (t) => {
  const { dir } = catalog(t, "type Props = { label: string; }");
  put(dir, "src/components/ui/Alert.vue", "type Props = { visible: boolean; }");
  const file = path.join(dir, "docs/specs/ui/catalog.json"); cli(script, [], dir); const first = fs.readFileSync(file, "utf8");
  cli(script, [], dir); assert.equal(fs.readFileSync(file, "utf8"), first);
  assert.deepEqual(Object.keys(JSON.parse(first).components), ["Alert", "Button"]);
});
