// @organism-suite
// Two task-level guarantees for the northstar bar:
//   - security-payments: every arm's build directory carries a spec that names the SECURITY.json
//     deliverable and its shape (plan section 11, item 6), and the task is still sound;
//   - typo-readme: the tiny dev task is sound (reference passes, untouched repo and a plausible
//     wrong answer fail) and its grader catches each way of getting it wrong.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ARMS, PILLAR_ARMS, armPrompts, grade, listTasks, prepare } from "../../scripts/outcome-eval.mjs";

// grade() starts `node --test` children; inside a test run they must not inherit this run's context.
delete process.env.NODE_TEST_CONTEXT;
const TASKS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "outcome-evals", "tasks");
const overlay = (dir, from) => fs.cpSync(from, dir, { recursive: true });

// ---- security-payments -------------------------------------------------------------
test("security-payments: the spec every arm receives names SECURITY.json and its shape", () => {
  for (const arm of [...Object.keys(ARMS), ...PILLAR_ARMS]) {
    const dir = prepare("security-payments");
    const spec = fs.readFileSync(path.join(dir, "spec.md"), "utf8");
    assert.match(spec, /SECURITY\.json/, `${arm}: spec.md names the deliverable`);
    for (const field of ["file", "line", "severity", "issue"]) assert.match(spec, new RegExp(`\\b${field}\\b`), `spec.md describes ${field}`);
    assert.match(spec, /CRITICAL\|HIGH\|MEDIUM\|LOW|CRITICAL, HIGH, MEDIUM/, "spec.md lists the severities");
    assert.match(spec, /src\//);
    assert.match(spec, /\[\]/, "spec.md says what to write when there is nothing");
  }
  for (const arm of PILLAR_ARMS) assert.match(armPrompts("security-payments", arm).join("\n"), /SECURITY\.json/);
});

test("security-payments: the contract matches what the hidden grader reads", () => {
  const spec = fs.readFileSync(path.join(TASKS, "security-payments", "spec.md"), "utf8");
  const hidden = fs.readFileSync(path.join(TASKS, "security-payments", "hidden.test.mjs"), "utf8");
  assert.match(hidden, /SECURITY\.json/);
  assert.match(spec, /JSON array/);
  assert.doesNotMatch(spec, /hidden|planted|grader/i, "the spec does not leak the grader");
  for (const f of ["checkout.mjs", "webhook.mjs"]) assert.doesNotMatch(spec, new RegExp(`${f}:\\d+`), "no line numbers in the spec");
});

test("security-payments: reference passes the grader, an untouched repo and the wrong answer do not", () => {
  const good = prepare("security-payments");
  overlay(good, path.join(TASKS, "security-payments", "ref"));
  assert.equal(grade(good, "security-payments").solved, true);
  assert.equal(grade(prepare("security-payments"), "security-payments").solved, false);
  const wrong = prepare("security-payments");
  overlay(wrong, path.join(TASKS, "security-payments", "ref-wrong"));
  assert.equal(grade(wrong, "security-payments").solved, false);
});

// ---- typo-readme --------------------------------------------------------------------
const TYPO = "typo-readme";
const build = (mutate) => { const dir = prepare(TYPO); overlay(dir, path.join(TASKS, TYPO, "ref")); mutate?.(dir); return dir; };
const edit = (dir, rel, fn) => fs.writeFileSync(path.join(dir, rel), fn(fs.readFileSync(path.join(dir, rel), "utf8")));

test("typo-readme: the task is listed and has the brownfield files", () => {
  assert.ok(listTasks().includes(TYPO));
  for (const f of ["spec.md", "hidden.test.mjs", "task.json", "repo/README.md", "repo/package.json", "ref/README.md", "ref-wrong/README.md"]) assert.ok(fs.existsSync(path.join(TASKS, TYPO, f)), f);
  const spec = fs.readFileSync(path.join(TASKS, TYPO, "spec.md"), "utf8");
  assert.match(spec, /typo/i);
  assert.ok(spec.trim().split("\n").filter((l) => l.trim() && !l.startsWith("#")).length <= 2, "a one-line request");
});

test("typo-readme: the repository starts with 2-3 typos in prose and one code block", () => {
  const readme = fs.readFileSync(path.join(TASKS, TYPO, "repo", "README.md"), "utf8");
  assert.equal((readme.match(/```/g) || []).length, 2, "exactly one fenced code block");
  const fixed = fs.readFileSync(path.join(TASKS, TYPO, "ref", "README.md"), "utf8");
  const a = readme.split("\n"), b = fixed.split("\n");
  assert.equal(a.length, b.length);
  const changed = a.filter((l, i) => l !== b[i]).length;
  assert.ok(changed >= 2 && changed <= 3, `${changed} lines differ`);
});

test("typo-readme: the reference passes every hidden test and the repository's own tests", () => {
  const dir = build();
  const r = grade(dir, TYPO);
  assert.equal(r.solved, true, JSON.stringify(r.hidden_failures));
});

test("typo-readme: the untouched repository and the plausible wrong answer fail", () => {
  assert.equal(grade(prepare(TYPO), TYPO).solved, false);
  const wrong = prepare(TYPO);
  overlay(wrong, path.join(TASKS, TYPO, "ref-wrong"));
  assert.equal(grade(wrong, TYPO).solved, false);
});

test("typo-readme: each way of getting it wrong is caught", () => {
  const cases = {
    "misses a typo": (d) => edit(d, "README.md", (t) => t.replace("dependencies", "dependancies")),
    "also rewrites other prose": (d) => edit(d, "README.md", (t) => t.replace("It is small", "It is tiny")),
    "americanises the correct British spelling": (d) => edit(d, "README.md", (t) => t.replace("behaviour", "behavior")),
    "improves the code block": (d) => edit(d, "README.md", (t) => t.replace("// \"hello-world\"", "// => \"hello-world\"")),
    "edits the module": (d) => edit(d, "src/slugify.mjs", (t) => `${t}\n// tidy\n`),
    "edits the test": (d) => edit(d, "test/slugify.test.mjs", (t) => `${t}\n// tidy\n`),
    "adds a dependency to package.json": (d) => fs.writeFileSync(path.join(d, "package.json"), '{"type":"module","dependencies":{"left-pad":"1.3.0"}}\n'),
    "adds a script to package.json": (d) => fs.writeFileSync(path.join(d, "package.json"), '{"type":"module","scripts":{"test":"node --test"}}\n'),
    "rewrites package.json without the trailing newline": (d) => fs.writeFileSync(path.join(d, "package.json"), '{"type":"module"}'),
    "adds a file": (d) => fs.writeFileSync(path.join(d, "CHANGELOG.md"), "# Changes\n"),
  };
  for (const [name, mutate] of Object.entries(cases)) assert.equal(grade(build(mutate), TYPO).solved, false, name);
});

test("typo-readme: harmless differences are not penalised (CRLF, trailing newline)", () => {
  const dir = build((d) => edit(d, "README.md", (t) => `${t.replace(/\n/g, "\r\n")}\r\n\r\n`));
  assert.equal(grade(dir, TYPO).solved, true);
});

test("typo-readme: the hidden grader names no path from this machine", () => {
  for (const f of ["hidden.test.mjs", "spec.md", "task.json"]) assert.doesNotMatch(fs.readFileSync(path.join(TASKS, TYPO, f), "utf8"), /\/home\/|\/Users\//);
});
