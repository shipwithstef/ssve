#!/usr/bin/env node
/** Tier 1 (framework-5.5 audit): the with-skill vs bare-model A/B harness grades, measures and refuses paid runs. Hermetic. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { splitArgv, parseRunnerOutput, grade, summarize, parseArgs } from "../../../scripts/skill-ab-eval.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const script = path.join(root, "scripts/skill-ab-eval.mjs");
const tasks = path.join(root, "test-framework/evals/skill-ab/tasks.json");
const fake = `node ${path.join(root, "test-framework/fixtures/skill-ab/fake-runner.mjs")}`;
const cli = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 60000,
  env: { ...process.env, EVALS: "0", ...env } });

test("the committed task set is well-formed and names real skills", () => {
  const spec = JSON.parse(fs.readFileSync(tasks, "utf8"));
  assert.ok(spec.tasks.length >= 3);
  for (const t of spec.tasks) {
    assert.ok(t.id && t.prompt && t.grader, t.id);
    assert.ok(fs.existsSync(path.join(root, "skills", t.skill, "SKILL.md")), t.skill);
  }
});

test("fake runner A/B: contract gain earns keep, ties are no-gain, tokens are measured", () => {
  const r = cli(["--tasks", tasks, "--runner", fake, "--repeat", "2", "--json"]);
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  const by = Object.fromEntries(out.tasks.map((t) => [t.task, t]));
  assert.equal(by["write-spec-csv-export"].verdict, "earns-keep");
  assert.equal(by["diagnose-off-by-one"].verdict, "no-gain");
  assert.equal(out.runs.length, out.tasks.length * 2 * 2);
  for (const t of out.tasks) assert.ok(t.token_delta > 0, "with-skill arm must pay the skill's context cost");
});

test("a failing runner counts as a failed run, not a pass", () => {
  const r = cli(["--tasks", tasks, "--runner", fake, "--repeat", "1", "--only", "decide", "--json"], { FAKE_RUNNER_FAIL: "decide-db-choice" });
  assert.equal(r.status, 0, r.stderr);
  const t = JSON.parse(r.stdout).tasks[0];
  assert.equal(t.bare.pass_rate, 0); assert.equal(t.with_skill.pass_rate, 0);
});

test("the paid default runner is refused without EVALS=1", () => {
  const r = cli(["--tasks", tasks]);
  assert.equal(r.status, 2); assert.match(r.stderr, /EVALS=1/);
  assert.equal(parseArgs(["--tasks", tasks], { EVALS: "1" }).runner, "claude -p --output-format json");
});

test("helpers: argv split, output parsing, graders, verdict margins", () => {
  assert.deepEqual(splitArgv(`node "a b.mjs" --x ''`), ["node", "a b.mjs", "--x", ""]);
  assert.throws(() => splitArgv(`node "open`));
  const p = parseRunnerOutput(JSON.stringify({ result: "hi", usage: { input_tokens: 10, cache_read_input_tokens: 5, output_tokens: 2 } }));
  assert.deepEqual(p.tokens, { input: 15, output: 2, total: 17 });
  assert.equal(parseRunnerOutput("plain").answer, "plain");
  assert.equal(grade({ type: "regex", pattern: ["a", "b"] }, "a b"), true);
  assert.equal(grade({ type: "regex", pattern: "a", forbid: "b" }, "a b"), false);
  assert.equal(grade({ type: "regex", pattern: "Status:\\s*DRAFT" }, "**Status:** Draft"), true, "markdown emphasis is not content");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-ab-"));
  try {
    const g = path.join(tmp, "g.mjs"); fs.writeFileSync(g, "process.exit(require('fs').readFileSync(0,'utf8').includes('ok')?0:1)".replace("require('fs')", "(await import('node:fs'))"));
    assert.equal(grade({ type: "command", argv: [process.execPath, g] }, "ok"), true);
    assert.equal(grade({ type: "command", argv: [process.execPath, g] }, "no"), false);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const mk = (arm, pass) => ({ task: "t", skill: "s", arm, pass, tokens: null, answer_chars: 1 });
  assert.equal(summarize([mk("bare", false), mk("with-skill", true)], 0.15)[0].verdict, "earns-keep");
  assert.equal(summarize([mk("bare", true), mk("with-skill", false)], 0.15)[0].verdict, "regresses");
  assert.equal(summarize([mk("bare", true), mk("with-skill", true)], 0.15)[0].verdict, "no-gain");
});

test("bad arguments are usage errors", () => {
  for (const args of [[], ["--tasks"], ["--tasks", tasks, "--runner", fake, "--repeat", "0"], ["--nope"]]) {
    assert.equal(cli(args).status, 2, args.join(" "));
  }
});

test("runs execute outside the repo so the bare arm cannot load CLAUDE.md", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-ab-cwd-"));
  try {
    const runner = path.join(tmp, "where.mjs");
    fs.writeFileSync(runner, "import fs from 'node:fs'; fs.readFileSync(0); process.stdout.write(JSON.stringify({ result: fs.existsSync('CLAUDE.md') || fs.existsSync('AGENTS.md') ? 'contaminated' : 'clean' }));");
    const t = path.join(tmp, "t.json");
    fs.writeFileSync(t, JSON.stringify({ tasks: [{ id: "cwd", skill: "decide", prompt: "x", grader: { type: "regex", pattern: "^clean$" } }] }));
    const r = cli(["--tasks", t, "--runner", `node ${runner}`, "--repeat", "1", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const row = JSON.parse(r.stdout).tasks[0];
    assert.equal(row.bare.pass_rate, 1); assert.equal(row.with_skill.pass_rate, 1);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("artifact graders read what the run wrote; a claimed file fails; runs are isolated", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "svc-ab-art-"));
  try {
    // with-skill writes the brief; bare only claims to have written it and checks for a leaked file
    const runner = path.join(tmp, "writer.mjs");
    fs.writeFileSync(runner, `import fs from 'node:fs';
const p = fs.readFileSync(0, 'utf8');
const leaked = fs.existsSync('docs/brief.md');
if (p.startsWith('Follow this skill')) { fs.mkdirSync('docs', { recursive: true }); fs.writeFileSync('docs/brief.md', '## Symptom\\nx\\n'); }
process.stdout.write(JSON.stringify({ result: leaked ? 'LEAKED' : 'I wrote the brief to docs/brief.md' }));`);
    const t = path.join(tmp, "t.json");
    fs.writeFileSync(t, JSON.stringify({ tasks: [{ id: "art", skill: "diagnose-bug", prompt: "x",
      grader: { type: "regex", on: "artifacts", pattern: "^#+\\s*Symptom", forbid: "LEAKED" } }] }));
    const r = cli(["--tasks", t, "--runner", `node ${runner}`, "--repeat", "2", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout); const row = out.tasks[0];
    assert.equal(row.bare.pass_rate, 0, "a claim without a file fails");
    assert.equal(row.with_skill.pass_rate, 1);
    assert.ok(out.runs.every((x) => x.answer !== "LEAKED"), "no run sees another run's files");
    assert.deepEqual(out.runs.find((x) => x.arm === "with-skill").artifacts.map((a) => a.path), ["docs/brief.md"]);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
