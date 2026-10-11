#!/usr/bin/env node
/** Tier 1: eval builders cannot read the answers. Inside the builder sandbox the task
 * folders (reference solutions, hidden graders, quizzes), recorded results and kept builds
 * are empty, the framework's scripts stay readable, and only the build directory is
 * writable. Where bubblewrap is missing, builderWrap returns null and rows record that. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { builderWrap } from "../../../scripts/outcome-eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

test("builders see no answers, can read the framework, and write only their build", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oe-wrap-test-"));
  const w = builderWrap(dir);
  if (!w) { assert.notEqual(spawnSync("sh", ["-c", "command -v bwrap"]).status, 0, "builderWrap is null only without bubblewrap"); return; }
  const tasks = path.join(ROOT, "test-framework/outcome-evals/tasks");
  const inner = `ls ${JSON.stringify(tasks)} | wc -l; test -r ${JSON.stringify(path.join(tasks, "ai-quest/quiz.json"))} && echo quiz-readable; ls ${JSON.stringify(path.join(ROOT, "scripts"))} | wc -l; touch "$PROBE_DIR/ok" && echo inside-ok; touch ${JSON.stringify(path.join(ROOT, ".builder-escape"))} 2>/dev/null && echo escaped`;
  const r = spawnSync("sh", ["-c", `${w.prefix} sh -c ${JSON.stringify(inner)}`], { env: { ...process.env, ...w.env }, encoding: "utf8" });
  const out = r.stdout.trim().split("\n");
  assert.equal(out[0].trim(), "0", "the task folders look empty inside");
  assert.ok(!r.stdout.includes("quiz-readable"), "the hidden quiz cannot be read");
  assert.ok(Number(out[1]) > 50, "the framework's scripts stay readable");
  assert.ok(r.stdout.includes("inside-ok"), "the build directory is writable");
  assert.ok(!r.stdout.includes("escaped") && !fs.existsSync(path.join(ROOT, ".builder-escape")), "the repository is read-only");
  assert.ok(fs.readdirSync(tasks).length > 10, "outside the sandbox nothing changed");
});
