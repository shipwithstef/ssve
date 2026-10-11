// @organism-suite
// P0.5: journey conformance checker, kept transcripts, job HOME mode. No model is called.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readTranscripts, toolUses, evalPredicate, checkJourney, validateSpec, globToRegex } from "../../scripts/lib/journey-conformance.mjs";
import * as oe from "../../scripts/outcome-eval.mjs";
import { loadBar, loadRows, decide } from "../../scripts/northstar.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const tmp = (p = "jc-") => fs.mkdtempSync(path.join(os.tmpdir(), p));
const use = (name, input) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "x" }, { type: "tool_use", name, input }] } });

function transcripts(events, { badLine = false } = {}) {
  const d = tmp("jc-tr-");
  const sub = path.join(d, "-work-proj");
  fs.mkdirSync(sub, { recursive: true });
  fs.writeFileSync(path.join(sub, "s1.jsonl"), events.map((e) => JSON.stringify(e)).join("\n") + (badLine ? "\n{not json\n" : "\n"));
  return d;
}
function build() {
  const b = tmp("jc-build-");
  fs.mkdirSync(path.join(b, "src", "deep"), { recursive: true });
  fs.mkdirSync(path.join(b, "docs"), { recursive: true });
  fs.writeFileSync(path.join(b, "src", "a.mjs"), "export const a = 1;\n");
  fs.writeFileSync(path.join(b, "src", "deep", "b.mjs"), "// TODO ship\n");
  fs.writeFileSync(path.join(b, "docs", "plan.md"), "# Plan\nAC-1 covered\n");
  return b;
}
const g = (args, cwd) => {
  const r = spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", ...args], { cwd, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
};
function repo({ note = true } = {}) {
  const b = build();
  g(["init", "-q"], b);
  g(["add", "."], b);
  g(["commit", "-q", "-m", "one"], b);
  if (note) g(["notes", "--ref", "refs/notes/svc-receipts", "add", "-m", '{"type":"review-exec"}', "HEAD"], b);
  return b;
}

const events = [
  use("Skill", { skill: "route-workflow" }),
  use("Skill", { skill: "svc:plan-changeset" }),
  use("Bash", { command: "git status\nnode --test" }),
  use("Edit", { file_path: "a" }),
];

test("readTranscripts reads every jsonl recursively in order and tolerates bad lines", () => {
  const d = transcripts(events, { badLine: true });
  fs.writeFileSync(path.join(d, "-work-proj", "s0.jsonl"), JSON.stringify(use("Read", {})) + "\n");
  fs.mkdirSync(path.join(d, "z"), { recursive: true });
  fs.writeFileSync(path.join(d, "z", "s2.jsonl"), JSON.stringify(use("Glob", {})) + "\n");
  fs.writeFileSync(path.join(d, "ignored.txt"), "nope");
  const names = toolUses(readTranscripts(d)).map((t) => t.name);
  assert.deepEqual(names, ["Read", "Skill", "Skill", "Bash", "Edit", "Glob"]);
  assert.deepEqual(readTranscripts(path.join(d, "missing")), []);
  assert.deepEqual(readTranscripts(null), []);
});

test("toolUses ignores events without array content", () => {
  assert.deepEqual(toolUses([{ message: { content: "text" } }, { type: "summary" }, null, { message: { content: [{ type: "text" }] } }]), []);
});

test("skill, bash and tool predicates", () => {
  const ctx = { tools: toolUses(readTranscripts(transcripts(events))) };
  assert.equal(evalPredicate({ skill: "route-workflow" }, ctx).hit, true);
  assert.equal(evalPredicate({ skill: "plan-changeset" }, ctx).hit, true, "plugin prefix accepted");
  assert.equal(evalPredicate({ skill: "review-exec" }, ctx).hit, false);
  assert.equal(evalPredicate({ skill: "set" }, ctx).hit, false, "no suffix guessing without the colon");
  assert.equal(evalPredicate({ bash: "^node --test" }, ctx).hit, true, "m flag: matches a later line");
  assert.equal(evalPredicate({ bash: "^npm" }, ctx).hit, false);
  assert.equal(evalPredicate({ tool: "Edit" }, ctx).hit, true);
  assert.equal(evalPredicate({ tool: "Write" }, ctx).hit, false);
  assert.ok(evalPredicate({ tool: "Edit" }, ctx).evidence.length > 0);
});

test("glob support: *, **, ?", () => {
  assert.ok(globToRegex("src/*.mjs").test("src/a.mjs"));
  assert.ok(!globToRegex("src/*.mjs").test("src/deep/b.mjs"));
  assert.ok(globToRegex("src/**/*.mjs").test("src/deep/b.mjs"));
  assert.ok(globToRegex("src/**/*.mjs").test("src/a.mjs"));
  assert.ok(globToRegex("**/b.mjs").test("src/deep/b.mjs"));
  assert.ok(globToRegex("docs/pla?.md").test("docs/plan.md"));
  assert.ok(!globToRegex("docs/pla?.md").test("docs/plaan.md"));
  assert.ok(globToRegex("a.b").test("a.b") && !globToRegex("a.b").test("axb"), "dot is literal");
});

test("file and file_matches predicates", () => {
  const ctx = { tools: [], buildDir: build() };
  assert.equal(evalPredicate({ file: "docs/*.md" }, ctx).hit, true);
  assert.equal(evalPredicate({ file: "src/**/*.mjs" }, ctx).hit, true);
  assert.equal(evalPredicate({ file: "docs/*.json" }, ctx).hit, false);
  assert.equal(evalPredicate({ file_matches: { glob: "src/**/*.mjs", regex: "TODO" } }, ctx).hit, true);
  assert.equal(evalPredicate({ file_matches: { glob: "src/*.mjs", regex: "TODO" } }, ctx).hit, false);
  assert.equal(evalPredicate({ file_matches: { glob: "docs/plan.md", regex: "^AC-\\d" } }, ctx).hit, true);
  assert.equal(evalPredicate({ file: "x" }, { tools: [], buildDir: null }).hit, false);
});

test("git_notes and commits against a real repo", () => {
  const ctx = (b) => ({ tools: [], buildDir: b });
  const b = repo();
  assert.equal(evalPredicate({ git_notes: { ref: "refs/notes/svc-receipts" } }, ctx(b)).hit, true);
  assert.equal(evalPredicate({ git_notes: { ref: "refs/notes/svc-receipts", regex: "review-exec" } }, ctx(b)).hit, true);
  assert.equal(evalPredicate({ git_notes: { ref: "refs/notes/svc-receipts", regex: "audit-implementation" } }, ctx(b)).hit, false);
  assert.equal(evalPredicate({ git_notes: { ref: "refs/notes/other" } }, ctx(b)).hit, false, "missing ref");
  assert.equal(evalPredicate({ commits: { min: 1 } }, ctx(b)).hit, true);
  assert.equal(evalPredicate({ commits: { min: 2 } }, ctx(b)).hit, false);
  const noNotes = repo({ note: false });
  assert.equal(evalPredicate({ git_notes: { ref: "refs/notes/svc-receipts" } }, ctx(noNotes)).hit, false);
  const plain = build(); // no .git
  assert.equal(evalPredicate({ git_notes: { ref: "refs/notes/svc-receipts" } }, ctx(plain)).hit, false);
  assert.equal(evalPredicate({ commits: { min: 1 } }, ctx(plain)).hit, false);
  assert.equal(evalPredicate({ commits: { min: 0 } }, ctx(plain)).hit, true, "no HEAD counts as 0");
  const empty = tmp("jc-empty-"); g(["init", "-q"], empty);
  assert.equal(evalPredicate({ commits: { min: 1 } }, ctx(empty)).hit, false);
});

test("all, any, not", () => {
  const ctx = { tools: toolUses(readTranscripts(transcripts(events))), buildDir: build() };
  const yes = { skill: "route-workflow" }, no = { skill: "nope" };
  assert.equal(evalPredicate({ all: [yes, { tool: "Edit" }] }, ctx).hit, true);
  assert.equal(evalPredicate({ all: [yes, no] }, ctx).hit, false);
  assert.equal(evalPredicate({ any: [no, yes] }, ctx).hit, true);
  assert.equal(evalPredicate({ any: [no, no] }, ctx).hit, false);
  assert.equal(evalPredicate({ not: no }, ctx).hit, true);
  assert.equal(evalPredicate({ not: yes }, ctx).hit, false);
  assert.equal(evalPredicate({ not: { any: [no, { all: [yes, no] }] } }, ctx).hit, true, "nesting");
});

test("unknown predicate keys and malformed predicates throw", () => {
  assert.throws(() => evalPredicate({ skil: "x" }, { tools: [] }), /unknown journey predicate key "skil"/);
  assert.throws(() => evalPredicate({ all: [{ typo: 1 }] }, { tools: [] }), /unknown/);
  assert.throws(() => evalPredicate({ skill: "a", tool: "b" }, { tools: [] }), /exactly one key/);
  assert.throws(() => evalPredicate(null, { tools: [] }), /object/);
});

const step = (id, must, evidence, extra = {}) => ({ id, kind: "skill", name: id, must, evidence, ...extra });
const spec = (steps) => ({ task: "t", version: 1, steps });

test("checkJourney: MUST, CONDITIONAL with and without when, OPTIONAL", () => {
  const tr = transcripts(events), b = build();
  const s = spec([
    step("route", "MUST", { skill: "route-workflow" }),
    step("review", "MUST", { skill: "review-exec" }),
    step("cond-when-hit", "CONDITIONAL", { skill: "nope" }, { when: { tool: "Edit" } }),
    step("cond-when-miss", "CONDITIONAL", { skill: "nope" }, { when: { tool: "Write" } }),
    step("cond-no-when", "CONDITIONAL", { skill: "plan-changeset" }),
    step("cond-no-when-missing", "CONDITIONAL", { skill: "absent" }),
    step("opt", "OPTIONAL", { skill: "absent" }),
  ]);
  const r = checkJourney(s, { transcriptsDir: tr, buildDir: b });
  assert.equal(r.spec_sha.length, 12);
  assert.match(r.spec_sha, /^[0-9a-f]{12}$/);
  assert.deepEqual(r.missing, ["review", "cond-when-hit", "cond-no-when-missing"]);
  assert.equal(r.conformant, false);
  assert.equal(r.must_total, 5); // route, review, cond-when-hit, cond-no-when, cond-no-when-missing
  assert.equal(r.must_hit, 2);
  const byId = Object.fromEntries(r.steps.map((x) => [x.id, x]));
  assert.equal(byId["cond-when-miss"].applies, false);
  assert.equal(byId.opt.applies, true);
  assert.equal(byId.opt.hit, false);
  assert.ok(byId.route.evidence.includes("route-workflow"));
  const ok = checkJourney(spec([step("route", "MUST", { skill: "route-workflow" }), step("opt", "OPTIONAL", { skill: "absent" }), step("c", "CONDITIONAL", { skill: "absent" }, { when: { tool: "Write" } })]), { transcriptsDir: tr, buildDir: b });
  assert.equal(ok.conformant, true);
  assert.deepEqual(ok.missing, []);
});

test("checkJourney: spec_sha is stable under key order and changes with content; no transcripts means missing", () => {
  const a = spec([step("route", "MUST", { skill: "route-workflow" })]);
  const reordered = { steps: [{ evidence: { skill: "route-workflow" }, name: "route", kind: "skill", must: "MUST", id: "route" }], version: 1, task: "t" };
  assert.equal(checkJourney(a, {}).spec_sha, checkJourney(reordered, {}).spec_sha);
  assert.notEqual(checkJourney(a, {}).spec_sha, checkJourney(spec([step("route", "MUST", { skill: "other" })]), {}).spec_sha);
  assert.deepEqual(checkJourney(a, { transcriptsDir: null, buildDir: null }).missing, ["route"]);
});

test("validateSpec reports problems", () => {
  assert.deepEqual(validateSpec(spec([step("a", "MUST", { skill: "x" }), step("b", "OPTIONAL", { not: { tool: "Bash" } })])), []);
  const has = (probs, re) => assert.ok(probs.some((p) => re.test(p)), `${re} in ${JSON.stringify(probs)}`);
  has(validateSpec(spec([{ must: "MUST", evidence: { skill: "x" } }])), /missing id/);
  has(validateSpec(spec([step("a", "MUST", { skill: "x" }), step("a", "MUST", { skill: "y" })])), /duplicate id/);
  has(validateSpec(spec([step("a", "MAYBE", { skill: "x" })])), /must is "MAYBE"/);
  has(validateSpec(spec([step("a", "MUST", { skil: "x" })])), /unknown predicate key "skil"/);
  has(validateSpec(spec([step("a", "CONDITIONAL", { skill: "x" }, { when: { zzz: 1 } })])), /when: unknown predicate key "zzz"/);
  has(validateSpec(spec([step("a", "MUST", { all: [{ nope: 1 }] })])), /unknown predicate key "nope"/);
  has(validateSpec(spec([step("a", "MUST", { bash: "(" })])), /valid regex/);
  has(validateSpec(spec([step("a", "MUST", { commits: { min: "2" } })])), /commits/);
  has(validateSpec(spec([{ id: "a", must: "MUST" }])), /missing evidence/);
  has(validateSpec({ task: "t", version: 1, steps: [] }), /steps/);
  has(validateSpec(null), /object/);
});

// ---- runner ----
test("cloneHome leaves the job home 0700 even when the source dir is 0775", () => {
  const from = tmp("jc-from-"), to = path.join(tmp("jc-to-"), "home");
  fs.mkdirSync(path.join(from, ".claude"), { recursive: true });
  fs.writeFileSync(path.join(from, ".claude", "x"), "1");
  fs.chmodSync(from, 0o775);
  oe.cloneHome(from, to);
  assert.equal(fs.statSync(to).mode & 0o777, 0o700);
  assert.equal(fs.readFileSync(path.join(to, ".claude", "x"), "utf8"), "1");
  // an existing 0700 dir (as mkdtemp makes it) is also left at 0700
  const pre = tmp("jc-pre-"); oe.cloneHome(from, pre);
  assert.equal(fs.statSync(pre).mode & 0o777, 0o700);
});

test("builderWrap: framework job home and solo job home have the same mode", { skip: !oe.hasBwrap() }, () => {
  const src = fs.realpathSync(tmp("jc-src-")), home = tmp("jc-fhome-");
  fs.mkdirSync(path.join(src, "skills", "a"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  fs.symlinkSync(path.join(src, "skills", "a"), path.join(home, ".claude", "skills", "a"));
  fs.chmodSync(home, 0o775);
  const cred = path.join(tmp("jc-cred-"), "credentials.json");
  fs.writeFileSync(cred, '{"fake":true}');
  const dir = tmp("jc-dir-");
  const fw = oe.builderWrap(dir, { credentials: cred, framework: { home, src, checkpoint_mode: "prompt-sentence" }, model: "haiku", workRoot: tmp("jc-w1-") });
  const solo = oe.builderWrap(dir, { credentials: cred, model: "haiku", workRoot: tmp("jc-w2-") });
  const m = (p) => fs.statSync(p).mode & 0o777;
  assert.equal(m(fw.job_home), 0o700);
  assert.equal(m(solo.job_home), 0o700);
  assert.equal(m(fw.job_home), m(solo.job_home));
});

test("keepTranscripts copies .claude/projects beside the build, null when absent", () => {
  const jobHome = tmp("jc-jh-"), keepRoot = tmp("jc-keep-");
  const to = path.join(keepRoot, "task-framework-1.transcripts");
  assert.equal(oe.keepTranscripts(jobHome, to), null);
  assert.equal(fs.existsSync(to), false);
  assert.equal(oe.keepTranscripts(null, to), null);
  const proj = path.join(jobHome, ".claude", "projects", "-work");
  fs.mkdirSync(proj, { recursive: true });
  fs.writeFileSync(path.join(proj, "s.jsonl"), JSON.stringify(use("Skill", { skill: "route-workflow" })) + "\n");
  assert.equal(oe.keepTranscripts(jobHome, to), to);
  assert.equal(toolUses(readTranscripts(to))[0].input.skill, "route-workflow");
});

test("preflightRun refuses a bad journey spec for the run's tasks and ignores other tasks", () => {
  const dir = tmp("jc-journeys-");
  fs.writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ task: "bad", version: 1, steps: [step("a", "MUST", { skil: "x" })] }));
  fs.writeFileSync(path.join(dir, "good.json"), JSON.stringify({ task: "good", version: 1, steps: [step("a", "MUST", { skill: "x" })] }));
  fs.writeFileSync(path.join(dir, "wrongname.json"), JSON.stringify({ task: "other", version: 1, steps: [step("a", "MUST", { skill: "x" })] }));
  fs.writeFileSync(path.join(dir, "junk.json"), "{nope");
  const args = { arms: ["solo", "framework"], reps: 1, maxUsd: null, bar: { floor_usd: 0.5, reserve: [] }, dirOf: () => null, journeysDir: dir };
  assert.match(oe.preflightRun({ ...args, tasks: ["bad"] }).error, /refusing to start: .*journey spec bad: .*unknown predicate key "skil"/);
  assert.match(oe.preflightRun({ ...args, tasks: ["wrongname"] }).error, /names task "other"/);
  assert.match(oe.preflightRun({ ...args, tasks: ["junk"] }).error, /is invalid: .*JSON/);
  assert.equal(oe.preflightRun({ ...args, tasks: ["good"] }).error, undefined);
  assert.equal(oe.preflightRun({ ...args, tasks: ["no-spec-task"] }).error, undefined, "a task without a spec is fine");
  assert.equal(oe.preflightRun({ ...args, tasks: ["good", "bad"] }).error === undefined, false);
});

test("the shipped journeys directory validates (every spec present is well formed)", () => {
  const dir = path.join(HERE, "../outcome-evals/northstar/journeys");
  assert.ok(fs.existsSync(path.join(dir, "README.md")));
  const tasks = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
  assert.deepEqual(oe.journeyProblems(tasks), []);
});

// ---- decide ----
test("decide reports a journey section and counts non-conformant runs without touching the headline", () => {
  const bar = loadBar();
  const rows = loadRows([path.join(HERE, "../outcome-evals/northstar/fixtures/dev-pass.json")]);
  const base = decide(rows, { slice: "dev", bar });
  assert.deepEqual(base.journey, { per_task: {}, void_nonconformant: 0 });
  assert.equal(base.void_nonconformant, 0);
  const fwYoga = rows.filter((r) => r.task === "yoga-studio" && r.arm === "framework");
  assert.ok(fwYoga.length >= 3);
  const withJ = rows.map((r) => {
    const i = fwYoga.indexOf(r);
    if (i < 0) return r;
    if (i === 0) return { ...r, journey: { conformant: true, missing: [] } };
    if (i === 1) return { ...r, journey: { conformant: false, missing: ["plan", "review"] } };
    if (i === 2) return { ...r, journey: { conformant: false, missing: ["review"] } };
    return { ...r, journey: { error: "boom" } };
  });
  const d = decide(withJ, { slice: "dev", bar });
  const y = d.journey.per_task["yoga-studio"];
  assert.equal(y.framework_runs_with_journey, fwYoga.length);
  assert.equal(y.conformant, 1);
  assert.equal(y.nonconformant, 2);
  assert.equal(y.errored, fwYoga.length - 3);
  assert.deepEqual(y.missing_steps, { plan: 1, review: 2 });
  assert.equal(d.void_nonconformant, 2);
  assert.deepEqual(d.headline, base.headline, "headline math unchanged");
  assert.equal(d.overall, base.overall);
  assert.equal(d.rows_used, base.rows_used);
});

test("an existing spec file holding null, false, 0, \"\" or an array is refused, not treated as absent", () => {
  for (const body of ["null", "false", "0", '""', "[]"]) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jspec-"));
    fs.writeFileSync(path.join(dir, "t1.json"), body);
    const p = oe.journeyProblems(["t1"], dir);
    assert.equal(p.length, 1, body); assert.match(p[0], /journey spec for t1 is invalid: .*not a JSON object/, body);
  }
});
