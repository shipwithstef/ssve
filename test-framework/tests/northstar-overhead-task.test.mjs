// @organism-suite
// The empty overhead task: an untouched build passes, any product change fails.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TASK = path.join(ROOT, "test-framework", "outcome-evals", "northstar", "overhead", "empty");
const run = (dir) => {
  fs.copyFileSync(path.join(TASK, "hidden.test.mjs"), path.join(dir, "__hidden.test.mjs"));
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  return spawnSync(process.execPath, ["--test", "__hidden.test.mjs"], { cwd: dir, encoding: "utf8", env }).status;
};
const build = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oe-empty-"));
  fs.cpSync(path.join(TASK, "repo"), dir, { recursive: true });
  fs.copyFileSync(path.join(TASK, "spec.md"), path.join(dir, "spec.md"));
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}\n');
  return dir;
};

test("an untouched build passes, harness state ignored", () => {
  const dir = build();
  fs.mkdirSync(path.join(dir, ".svc"));
  fs.writeFileSync(path.join(dir, ".svc", "fail-open-counter.json"), "{}");
  assert.equal(run(dir), 0);
});

test("an added file or an edited README fails", () => {
  const a = build();
  fs.writeFileSync(path.join(a, "PLAN.md"), "x");
  assert.notEqual(run(a), 0);
  const b = build();
  fs.appendFileSync(path.join(b, "README.md"), "more\n");
  assert.notEqual(run(b), 0);
});
