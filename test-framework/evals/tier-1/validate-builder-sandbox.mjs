#!/usr/bin/env node
/** Tier 1: eval builders cannot read the answers. Inside the builder sandbox the task
 * folders (reference solutions, hidden graders, quizzes), recorded results and kept builds
 * are empty, the real home is hidden except the credentials file, and only the build
 * directory is writable. Without bubblewrap builderWrap throws: nothing is scored unsandboxed. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { builderWrap, hasBwrap } from "../../../scripts/outcome-eval.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const cred = () => { const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "oe-cred-")), "credentials.json"); fs.writeFileSync(f, "{}"); return f; };

test("builders see no answers, cannot read the real home, and write only their build", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oe-wrap-test-"));
  if (!hasBwrap()) { assert.throws(() => builderWrap(dir, { credentials: cred() }), /no builder sandbox/); return; }
  const w = builderWrap(dir, { credentials: cred(), exposeRoot: true });
  const tasks = path.join(ROOT, "test-framework/outcome-evals/tasks");
  // Paths travel as environment values and the sandbox as an argument list: no shell
  // string is built from them.
  const inner = 'ls "$TASKS" | wc -l; test -r "$TASKS/ai-quest/quiz.json" && echo quiz-readable; ls "$SCRIPTS" | wc -l; touch "$PROBE_DIR/ok" && echo inside-ok; touch "$ESCAPE" 2>/dev/null && echo escaped; echo "home=$HOME"';
  const r = spawnSync(w.argv[0], [...w.argv.slice(1), "sh", "-c", inner], { env: { ...process.env, ...w.env, TASKS: tasks, SCRIPTS: path.join(ROOT, "scripts"), ESCAPE: path.join(ROOT, ".builder-escape") }, encoding: "utf8" });
  const out = r.stdout.trim().split("\n");
  assert.equal(out[0].trim(), "0", "the task folders look empty inside");
  assert.ok(!r.stdout.includes("quiz-readable"), "the hidden quiz cannot be read");
  assert.ok(Number(out[1]) > 50, "the framework's scripts stay readable when the root is exposed");
  assert.ok(r.stdout.includes("inside-ok"), "the build directory is writable");
  assert.ok(!r.stdout.includes("escaped") && !fs.existsSync(path.join(ROOT, ".builder-escape")), "the repository is read-only");
  assert.ok(r.stdout.includes("home=/tmp/oe-home"), "the builder's home is the private one");
  assert.ok(fs.readdirSync(tasks).length > 10, "outside the sandbox nothing changed");
});

test("the framework arm installs into a private home from its archive, never the real one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oe-wrap-fw-"));
  if (!hasBwrap()) { assert.throws(() => builderWrap(dir, { credentials: cred() }), /no builder sandbox/); return; }
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "oe-fwhome-")), src = fs.mkdtempSync(path.join(os.tmpdir(), "oe-fwsrc-"));
  fs.mkdirSync(path.join(src, "skills", "route-workflow"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  fs.symlinkSync(path.join(src, "skills", "route-workflow"), path.join(home, ".claude", "skills", "route-workflow"));
  const realSkills = path.join(os.homedir(), ".claude", "skills");
  const before = fs.existsSync(realSkills) ? fs.readdirSync(realSkills).sort().join(",") : "";
  const w = builderWrap(dir, { credentials: cred(), framework: { home, src: fs.realpathSync(src), checkpoint_mode: "prompt-sentence" }, model: "haiku" });
  assert.equal(w.env.HOME, "/tmp/oe-home", "the builder runs with the private home");
  assert.notEqual(w.job_home, home, "each job gets a clone, not the cached home");
  assert.ok(fs.readdirSync(path.join(w.job_home, ".claude", "skills")).includes("route-workflow"));
  assert.equal(JSON.parse(fs.readFileSync(path.join(w.job_home, ".svc", "hook-policy.json"), "utf8")).mode, "advisory");
  const after = fs.existsSync(realSkills) ? fs.readdirSync(realSkills).sort().join(",") : "";
  assert.equal(after, before, "the real home's skills are untouched");
});
