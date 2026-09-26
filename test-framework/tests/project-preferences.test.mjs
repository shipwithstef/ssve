import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadProjectPreferences, microlearningEligibility } from "../../scripts/project-preferences.mjs";

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const cli = path.resolve(testsDir, "../../scripts/project-preferences.mjs");

function fixture(fn) {
  const root = fs.mkdtempSync(path.join(testsDir, ".project-preferences-test-"));
  try { return fn(root); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function writeConfig(root, value) {
  const svc = path.join(root, ".svc");
  fs.mkdirSync(svc, { recursive: true });
  const file = path.join(svc, "project-preferences.json");
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
  return file;
}

test("absent preferences are short, plain, and learning-off without creating state", () => {
  fixture((root) => {
    const result = loadProjectPreferences(root);
    assert.deepEqual(result, {
      communication: { explanation_level: "beginner", style: "plain_stepwise" },
      learning: { mode: "off", difficulty: "beginner" },
      source: "default",
      diagnostics: [],
    });
    assert.deepEqual(fs.readdirSync(root), []);
  });
});

test("project choices override defaults and leave unrelated shared keys untouched", () => {
  fixture((root) => {
    const file = writeConfig(root, {
      skills: { profile: "framework" },
      communication: { explanation_level: "advanced" },
      learning: { mode: "opportunistic", difficulty: "intermediate" },
    });
    const before = fs.readFileSync(file);
    const result = loadProjectPreferences(root);
    assert.deepEqual(result.communication, { explanation_level: "advanced", style: "plain_stepwise" });
    assert.deepEqual(result.learning, { mode: "opportunistic", difficulty: "intermediate" });
    assert.equal(result.source, "project");
    assert.deepEqual(fs.readFileSync(file), before);
  });
});

test("malformed values return safe defaults with actionable field diagnostics", () => {
  fixture((root) => {
    writeConfig(root, { learning: { mode: "opportunistic", difficulty: "expert" } });
    const result = loadProjectPreferences(root);
    assert.equal(result.source, "invalid");
    assert.equal(result.learning.mode, "off");
    assert.match(result.diagnostics[0], /learning\.difficulty/);
    assert.doesNotMatch(result.diagnostics[0], /expert/);
  });
  fixture((root) => {
    writeConfig(root, "{private invalid content");
    const result = loadProjectPreferences(root);
    assert.equal(result.source, "invalid");
    assert.equal(result.learning.mode, "off");
    assert.match(result.diagnostics[0], /readable JSON/);
    assert.doesNotMatch(JSON.stringify(result), /private invalid content/);
  });
});

test("symlinked preference file is never read", () => {
  fixture((root) => {
    const svc = path.join(root, ".svc");
    fs.mkdirSync(svc);
    const target = path.join(root, "outside.json");
    fs.writeFileSync(target, JSON.stringify({ learning: { mode: "opportunistic" } }));
    fs.symlinkSync(target, path.join(svc, "project-preferences.json"));
    const result = loadProjectPreferences(root);
    assert.equal(result.source, "invalid");
    assert.equal(result.learning.mode, "off");
    assert.match(result.diagnostics[0], /regular file/);
  });
});

test("CLI prints the same read-only profile", () => {
  fixture((root) => {
    writeConfig(root, { communication: { explanation_level: "intermediate" } });
    const run = spawnSync(process.execPath, [cli, "--root", root], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), loadProjectPreferences(root));
  });
});

test("installed symlink CLI emits the effective profile", () => {
  fixture((root) => {
    const link = path.join(root, "installed-project-preferences.mjs");
    fs.symlinkSync(cli, link);
    writeConfig(root, { learning: { mode: "opportunistic", difficulty: "advanced" } });
    const run = spawnSync(process.execPath, [link, "--root", root], { encoding: "utf8" });
    assert.equal(run.status, 0, run.stderr);
    assert.ok(run.stdout.trim(), "symlinked CLI produced no output");
    assert.deepEqual(JSON.parse(run.stdout), loadProjectPreferences(root));
  });
});

test("microlearning eligibility is opt-in, grounded, and nonblocking", () => {
  const off = loadProjectPreferences(os.tmpdir());
  assert.equal(microlearningEligibility({ preferences: off, naturalWait: true, evidencePath: "src/app.ts" }).eligible, false);
  const on = { learning: { mode: "opportunistic" } };
  assert.deepEqual(microlearningEligibility({ preferences: on, naturalWait: true, evidencePath: "src/app.ts" }), { eligible: true, reason: "eligible" });
  assert.equal(microlearningEligibility({ preferences: on, naturalWait: false, evidencePath: "src/app.ts" }).reason, "no-natural-wait");
  assert.equal(microlearningEligibility({ preferences: on, naturalWait: true }).reason, "no-project-evidence");
  assert.equal(microlearningEligibility({ preferences: on, naturalWait: true, evidencePath: "src/app.ts", unansweredOffer: true }).reason, "offer-outstanding");
  assert.equal(microlearningEligibility({ preferences: on, naturalWait: true, evidencePath: "src/app.ts", skipped: true }).reason, "user-skipped");
});
