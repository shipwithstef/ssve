// skill-ab-eval: graders reject empty substance, small samples never recommend keep,
// verdicts are bound to the measured skill folder and served model, and only two arms run.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  grade, summarize, skillFolderHash, evidenceStatus, parseRunnerOutput, buildPrompt, MIN_RUNS, ADOPT_RUNS, ARMS, parseArgs,
} from "../../scripts/skill-ab-eval.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts/skill-ab-eval.mjs");
const tasksFile = path.join(root, "test-framework/evals/skill-ab/tasks.json");
const fixtures = JSON.parse(fs.readFileSync(path.join(root, "test-framework/fixtures/skill-ab/grader-fixtures.json"), "utf8"));
const spec = JSON.parse(fs.readFileSync(tasksFile, "utf8"));
const cli = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 60000, env: { ...process.env, EVALS: "0", ...env } });
const tmpdir = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));

// ---- 1. graders -------------------------------------------------------------------

for (const task of spec.tasks) {
  test(`grader ${task.id}: accepts a substantive answer`, () => {
    for (const text of fixtures[task.id].pass) assert.equal(grade(task.grader, text), true);
  });
  test(`grader ${task.id}: rejects empty, whitespace and boilerplate-only answers (negative fixtures)`, () => {
    assert.ok(fixtures[task.id].fail.length >= 3, "each grader needs several negative fixtures");
    for (const f of fixtures[task.id].fail) assert.equal(grade(task.grader, f.text), false, f.name);
  });
}

test("every committed task has fixtures, so no grader ships without a negative test", () => {
  for (const t of spec.tasks) assert.ok(fixtures[t.id], t.id);
});

test("any grader rejects an empty or whitespace-only graded text before it runs", () => {
  assert.equal(grade({ type: "regex", pattern: "^" }, ""), false);
  assert.equal(grade({ type: "regex", pattern: "^" }, " \n\t"), false);
  assert.equal(grade({ type: "regex", pattern: "a|^", on: "artifacts" }, "ok", root, []), false, "no artifacts means nothing to grade");
  assert.equal(grade({ type: "command", argv: [process.execPath, "-e", "process.exit(0)"] }, "   "), false);
});

test("min_words and section bodies count content, not keywords", () => {
  const g = { type: "regex", pattern: "x", min_words: 5 };
  assert.equal(grade(g, "x y z"), false);
  assert.equal(grade(g, "x one two three four five"), true);
  const s = { type: "regex", pattern: "x", sections: [{ heading: "Root Cause", min_words: 4 }] };
  assert.equal(grade(s, "x\n## Root Cause\n## Next\nplenty of words here"), false, "an empty section does not borrow the next section's body");
  assert.equal(grade(s, "x\n## Root Cause\nthe loop bound is wrong\n## Next"), true);
});

// ---- 2. evidence thresholds -------------------------------------------------------

const mk = (arm, pass, extra = {}) => ({ task: "t", skill: "decide", arm, pass, exit: 0, tokens: null, answer_chars: 1, skill_hash: "h1", models: ["m1"], ...extra });
const many = (arm, passes) => passes.map((p) => mk(arm, p));
const verdictOf = (bare, skill, margin = 0.15) => summarize([...many("bare", bare), ...many("with-skill", skill)], margin)[0];

test("one failed bare run against one passing skill run is inconclusive, never earns-keep", () => {
  const row = verdictOf([false], [true]);
  assert.equal(row.verdict, "inconclusive");
  assert.match(row.reason, /at least 3/);
  assert.equal(verdictOf([false, false], [true, true]).verdict, "inconclusive");
});

test("three to four finished runs per arm are exploratory only: inconclusive with the point-estimate direction recorded", () => {
  assert.equal(MIN_RUNS, 3); assert.equal(ADOPT_RUNS, 5);
  const r = verdictOf([false, false, false], [true, true, true]);
  assert.equal(r.verdict, "inconclusive"); assert.equal(r.exploratory, "earns-keep"); assert.match(r.reason, /at least 5/);
  assert.equal(verdictOf([true, true, true, true], [false, false, false, false]).verdict, "inconclusive");
  assert.equal(verdictOf([true, true, true], [true, true, true]).verdict, "inconclusive", "a tiny tie does not prove equivalence either");
});

test("adoption needs n >= 5 per arm and a permutation p < .05", () => {
  const keep = verdictOf([false, false, false, false, false], [true, true, true, true, true]);
  assert.equal(keep.verdict, "earns-keep"); assert.ok(keep.p < 0.05, `p=${keep.p}`);
  const reg = verdictOf([true, true, true, true, true], [false, false, false, false, false]);
  assert.equal(reg.verdict, "regresses"); assert.ok(reg.p < 0.05);
  // big point delta but noisy: 2/5 vs 4/5 is not significant
  const noisy = verdictOf([true, true, false, false, false], [true, true, true, true, false]);
  assert.equal(noisy.verdict, "inconclusive"); assert.ok(noisy.p >= 0.05); assert.match(noisy.reason, /p/);
  assert.equal(verdictOf([true, true, true, true, false], [true, true, true, true, false]).verdict, "no-gain");
});

test("crashed runs do not count toward n: five launched, two finished is inconclusive", () => {
  const runs = [
    ...many("bare", [false, false]), ...[0, 1, 2].map((i) => mk("bare", false, { crashed: true, exit: 3 })),
    ...many("with-skill", [true, true, true, true, true]),
  ];
  const row = summarize(runs, 0.15)[0];
  assert.equal(row.bare.runs, 2); assert.equal(row.bare.errors, 3);
  assert.equal(row.verdict, "inconclusive");
  const none = summarize([...[0, 1, 2].map(() => mk("bare", false, { crashed: true, exit: 3 })), ...many("with-skill", [true, true, true])], 0.15)[0];
  assert.equal(none.verdict, "error", "an arm that never finished is still an error");
});

// ---- 3. evidence binding ----------------------------------------------------------

test("skill folder hash covers every file, so a change in references/ or scripts/ changes it", () => {
  const dir = tmpdir("svc-ab-hash-");
  try {
    const skills = path.join(dir, "skills", "demo"); fs.mkdirSync(path.join(skills, "references"), { recursive: true });
    fs.writeFileSync(path.join(skills, "SKILL.md"), "body"); fs.writeFileSync(path.join(skills, "references", "a.md"), "A");
    const h0 = skillFolderHash("demo", dir);
    assert.match(h0, /^[0-9a-f]{64}$/); assert.equal(skillFolderHash("demo", dir), h0, "stable");
    fs.writeFileSync(path.join(skills, "references", "a.md"), "A2");
    const h1 = skillFolderHash("demo", dir); assert.notEqual(h1, h0);
    fs.mkdirSync(path.join(skills, "scripts")); fs.writeFileSync(path.join(skills, "scripts", "x.mjs"), "1");
    const h2 = skillFolderHash("demo", dir); assert.notEqual(h2, h1);
    fs.renameSync(path.join(skills, "scripts", "x.mjs"), path.join(skills, "scripts", "y.mjs"));
    assert.notEqual(skillFolderHash("demo", dir), h2, "a rename is a change");
    assert.throws(() => skillFolderHash("nope", dir), /unknown skill/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("verdict rows record the skill folder hash and the served model; a changed hash or model is stale", () => {
  const row = verdictOf([false, false, false, false, false], [true, true, true, true, true]);
  assert.equal(row.skill_hash, "h1"); assert.deepEqual(row.models, ["m1"]);
  assert.deepEqual(evidenceStatus(row, { skill_hash: "h1", model: "m1" }), { stale: false, reasons: [] });
  assert.deepEqual(evidenceStatus(row, { skill_hash: "h2", model: "m1" }), { stale: true, reasons: ["skill-changed"] });
  assert.deepEqual(evidenceStatus(row, { skill_hash: "h1", model: "m2" }), { stale: true, reasons: ["model-changed"] });
  assert.deepEqual(evidenceStatus(row, { skill_hash: "h2", model: "m2" }).reasons.sort(), ["model-changed", "skill-changed"]);
  const legacy = { ...row, skill_hash: null, models: [] };
  assert.deepEqual(evidenceStatus(legacy, { skill_hash: "h1", model: "m1" }).reasons.sort(), ["model-unknown", "no-hash"], "unbound evidence is never fresh");
  const mixed = summarize([...many("bare", [true]).map((r) => ({ ...r, models: ["m1"] })), ...many("with-skill", [true]).map((r) => ({ ...r, models: ["m9"] }))], 0.15)[0];
  assert.deepEqual(mixed.models, ["m1", "m9"]);
  assert.equal(evidenceStatus(mixed, { skill_hash: "h1", model: "m1" }).stale, true, "a verdict that mixed models matches neither");
});

test("parseRunnerOutput reads the served model ids from the envelope", () => {
  assert.deepEqual(parseRunnerOutput(JSON.stringify({ result: "x", modelUsage: { "model-b": {}, "model-a": {} } })).models, ["model-a", "model-b"]);
  assert.deepEqual(parseRunnerOutput(JSON.stringify({ result: "x", model: "model-c" })).models, ["model-c"]);
  assert.deepEqual(parseRunnerOutput("plain text").models, []);
});

test("--check-stale reports a report whose skill or model differs from the current ones, exit 1", () => {
  const dir = tmpdir("svc-ab-stale-");
  try {
    const t = path.join(dir, "t.json");
    fs.writeFileSync(t, JSON.stringify({ tasks: [{ id: "s", skill: "decide", prompt: "x", grader: { type: "regex", pattern: "ok", min_words: 1 } }] }));
    const runner = path.join(dir, "r.mjs");
    fs.writeFileSync(runner, "import fs from 'node:fs'; fs.readFileSync(0); process.stdout.write(JSON.stringify({ result: 'ok', modelUsage: { 'model-x': {} } }));");
    const report = path.join(dir, "r.json");
    const first = cli(["--tasks", t, "--runner", `node ${runner}`, "--repeat", "5", "--out", report, "--json"]);
    assert.equal(first.status, 0, first.stderr);
    const rep = JSON.parse(fs.readFileSync(report, "utf8"));
    assert.equal(rep.tasks[0].skill_hash, skillFolderHash("decide")); assert.deepEqual(rep.tasks[0].models, ["model-x"]);
    assert.deepEqual(rep.arms, ["bare", "with-skill"]);
    assert.equal(cli(["--check-stale", report, "--model", "model-x"]).status, 0);
    const other = cli(["--check-stale", report, "--model", "model-y"]);
    assert.equal(other.status, 1); assert.match(other.stdout, /stale.*model-changed/);
    rep.tasks[0].skill_hash = "0".repeat(64); fs.writeFileSync(report, JSON.stringify(rep));
    const changed = cli(["--check-stale", report, "--model", "model-x"]);
    assert.equal(changed.status, 1); assert.match(changed.stdout, /skill-changed/);
    assert.equal(cli(["--check-stale", report]).status, 2, "--model is required");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- 4. two arms, whole folder ----------------------------------------------------

test("only two arms exist; a four-arm request is refused", () => {
  assert.deepEqual(ARMS, ["bare", "with-skill"]);
  assert.throws(() => parseArgs(["--tasks", tasksFile, "--runner", "x", "--arms", "bare,thin,full,contract"]), /two arms/);
  assert.equal(parseArgs(["--tasks", tasksFile, "--runner", "x", "--arms", "bare,with-skill"]).runner, "x", "the two real arms stay accepted");
  assert.throws(() => summarize([{ ...mk("thin", true) }], 0.15), /arm/);
});

test("the skill arm gets the whole skill folder mounted; the bare arm gets nothing; the mount is not graded", () => {
  const dir = tmpdir("svc-ab-mount-");
  try {
    const runner = path.join(dir, "probe.mjs");
    fs.writeFileSync(runner, `import fs from 'node:fs';
const p = fs.readFileSync(0, 'utf8');
const m = '.claude/skills/write-spec';
const has = fs.existsSync(m + '/SKILL.md') && fs.existsSync(m + '/references/authoring-modes.md') && fs.existsSync(m + '/templates/infra-feature.md');
process.stdout.write(JSON.stringify({ result: (has ? 'mounted' : 'unmounted') + ' ' + (p.includes(m) ? 'told' : 'untold') }));`);
    const t = path.join(dir, "t.json");
    fs.writeFileSync(t, JSON.stringify({ tasks: [{ id: "m", skill: "write-spec", prompt: "x", grader: { type: "regex", pattern: "^mounted told$" } }] }));
    const r = cli(["--tasks", t, "--runner", `node ${runner}`, "--repeat", "3", "--json"]);
    assert.equal(r.status, 0, r.stderr);
    const out = JSON.parse(r.stdout);
    const answers = (arm) => out.runs.filter((x) => x.arm === arm).map((x) => x.answer);
    assert.ok(answers("with-skill").every((a) => a === "mounted told"), answers("with-skill").join());
    assert.ok(answers("bare").every((a) => a === "unmounted untold"), answers("bare").join());
    assert.ok(out.runs.every((x) => x.artifacts.length === 0), "mounted skill files are not run artifacts");
    assert.match(buildPrompt({ skill: "write-spec", prompt: "do it" }, "with-skill"), /\.claude\/skills\/write-spec/);
    assert.equal(buildPrompt({ skill: "write-spec", prompt: "do it" }, "bare"), "do it");
    assert.throws(() => buildPrompt({ skill: "write-spec", prompt: "x" }, "thin"), /arm/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
