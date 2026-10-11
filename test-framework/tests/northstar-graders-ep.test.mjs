// Unit tests for the northstar E and P graders: scoring, spec parsing, the component
// dispatcher, the case runner, report checks, and one reference-versus-stub proof.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gradeComponents, readSpec, SPECS_DIR } from "../outcome-evals/northstar/graders/index.mjs";
import * as lib from "../outcome-evals/northstar/graders/lib-ep.mjs";
import * as E from "../outcome-evals/northstar/graders/E.mjs";
import * as P from "../outcome-evals/northstar/graders/P.mjs";
import { checkTask, verdict, MATRIX_EP } from "../outcome-evals/northstar/graders/check.mjs";

const tmp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `ns-test-${name}-`));
const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };

test("score is passed checks over total checks, and no checks score 0", () => {
  const c = (pass) => ({ name: "x", pass, detail: "" });
  assert.equal(lib.scoreChecks([c(true), c(true), c(true), c(false)]).score, 0.75);
  assert.equal(lib.scoreChecks([c(false)]).score, 0);
  assert.equal(lib.scoreChecks([]).score, 0);
});

test("specs are validated: component, non-empty checks, known check types", () => {
  assert.throws(() => lib.validateSpec(null), /JSON object/);
  assert.throws(() => lib.validateSpec({ component: "X", checks: [{ type: "chaos" }] }), /component/);
  assert.throws(() => lib.validateSpec({ component: "E", checks: [] }), /non-empty/);
  assert.throws(() => lib.validateSpec({ component: "E", checks: [{ type: "mutation" }] }), /unknown type "mutation" for E/);
  assert.throws(() => lib.validateSpec({ component: "P", checks: [{}] }), /needs a "type"/);
  assert.doesNotThrow(() => lib.validateSpec({ component: "P", checks: [{ type: "mutation" }] }));
});

test("every committed E and P spec for the matrix parses and validates", () => {
  for (const [task, comps] of Object.entries(MATRIX_EP)) for (const c of comps) {
    const spec = readSpec(task, c);
    assert.doesNotThrow(() => lib.validateSpec(spec, `${task}/${c}`));
    assert.equal(spec.component, c);
  }
  assert.ok(SPECS_DIR.endsWith(path.join("northstar", "specs")));
});

test("gradeComponents imports only requested modules; a missing module, a missing spec or a throw scores 0", async () => {
  const graders = tmp("graders"), specs = tmp("specs");
  write(graders, "E.mjs", 'export async function grade() { return { score: 0.5, checks: [{ name: "a", pass: true, detail: "" }] }; }');
  write(graders, "P.mjs", 'export async function grade() { throw new Error("boom"); }');
  write(graders, "K.mjs", 'export async function grade() { return { score: 7, checks: [] }; }');
  write(graders, "S.mjs", "this is not valid javascript (");
  for (const c of ["E", "P", "K"]) write(specs, `t/${c}.json`, "{}");
  const r = await gradeComponents(tmp("build"), "t", { components: ["E", "P"], specsDir: specs, graderDir: graders });
  assert.equal(r.E, 0.5);
  assert.equal(r.P, 0);
  assert.match(r.details.P.error, /boom/);
  assert.equal("K" in r, false, "K was not requested");
  assert.equal("S" in r, false, "S was not requested, so its broken module is never imported");
  const more = await gradeComponents(tmp("build"), "t", { components: ["K", "S"], specsDir: specs, graderDir: graders });
  assert.equal(more.K, 1, "scores are clamped to 1");
  assert.equal(more.S, 0);
  assert.ok(more.details.S.error);
  const gone = await gradeComponents(tmp("build"), "t", { components: ["E"], specsDir: specs, graderDir: tmp("empty") });
  assert.equal(gone.E, 0);
  assert.match(gone.details.E.error, /E\.mjs|Cannot find/);
  const nospec = await gradeComponents(tmp("build"), "nope", { components: ["E"], specsDir: specs, graderDir: graders });
  assert.equal(nospec.E, 0);
  assert.match(nospec.details.E.error, /no E spec/);
});

test("the case runner reports ok, a wrong value, an unclean crash and a missing export", () => {
  const dir = tmp("lib");
  write(dir, "m.mjs", `export const add = (a, b) => a + b;
export const boom = () => { throw new Error("nope"); };
export const crash = (x) => x.y.z;
export const tz = () => process.env.TZ_X;
export const srv = async () => (await import("node:http")).createServer((q, r) => { r.writeHead(q.url === "/ok" ? 200 : 404).end(JSON.stringify({ n: 1 })); });`);
  const run = (steps, extra = {}) => lib.runCase(dir, { steps, ...extra }, { module: "m.mjs" });
  assert.equal(run([{ fn: "add", args: [1, 2], equals: 3 }]).ok, true);
  assert.match(run([{ fn: "add", args: [1, 2], equals: 4 }]).detail, /returned 3, wanted 4/);
  assert.equal(run([{ fn: "boom", expect: "throws", errorMatch: "nop" }]).ok, true);
  assert.equal(run([{ fn: "boom", expect: "ok" }]).ok, false);
  assert.match(run([{ fn: "crash", args: [{}], expect: "throws" }]).detail, /crashed instead of rejecting cleanly/);
  assert.match(run([{ fn: "crash", args: [{}], expect: "clean" }]).detail, /crashed/);
  assert.match(run([{ fn: "nothere" }]).detail, /does not export nothere/);
  assert.equal(run([{ fn: "tz", assert: "r === 'x'" }], { env: { TZ_X: "x" } }).ok, true);
  assert.equal(run([{ fn: "add", args: [{ $js: "20 + 1" }, { $var: "k" }], save: "z" }, { op: "assert", js: "v.z !== undefined" }]).ok, true);
  const http = run([{ fn: "srv", save: "srv" }, { op: "listen", target: "srv" }, { op: "http", path: "/ok", status: 200, assert: "r.json.n === 1" }, { op: "http", path: "/x", status: [400, 499] }]);
  assert.equal(http.ok, true, http.detail);
  assert.match(run([{ fn: "srv", save: "srv" }, { op: "listen", target: "srv" }, { op: "http", path: "/x", status: 200 }]).detail, /answered 404/);
});

test("the case runner stops a case that never returns", () => {
  const dir = tmp("hang");
  write(dir, "m.mjs", "export const spin = () => { for (;;) {} };");
  const r = lib.runCase(dir, { steps: [{ fn: "spin" }], timeout_ms: 1500 }, { module: "m.mjs" });
  assert.equal(r.ok, false);
  assert.match(r.detail, /timed out/);
});

test("README commands: only allowlisted strings are found; counts parse from test output", () => {
  assert.equal(lib.documentedCommand("run `npm test` then rm -rf /", ["node --test", "npm test"]), "npm test");
  assert.equal(lib.documentedCommand("rm -rf /", ["npm test"]), null);
  assert.equal(lib.documentedCommand(null, ["npm test"]), null);
  assert.equal(lib.countPassed("ℹ pass 7\nℹ fail 0"), 7);
  assert.equal(lib.countPassed("# pass 3\n# fail 0"), 3);
  assert.equal(lib.countPassed("nothing"), 0);
  const d = tmp("readme");
  assert.equal(lib.findReadme(d), null);
  write(d, "readme.MD", "hello");
  assert.equal(path.basename(lib.findReadme(d)), "readme.MD");
});

test("hasDependencies and ensureStartScript read package.json", () => {
  const d = tmp("pkg");
  write(d, "package.json", '{"type":"module"}');
  assert.equal(lib.hasDependencies(d), false);
  lib.ensureStartScript(d, "node server.mjs");
  assert.equal(lib.readPackage(d).scripts.start, "node server.mjs");
  lib.ensureStartScript(d, "node other.mjs");
  assert.equal(lib.readPackage(d).scripts.start, "node server.mjs", "an existing start script is kept");
  write(d, "package.json", '{"dependencies":{"x":"1"}}');
  assert.equal(lib.hasDependencies(d), true);
});

test("seeded walks are reproducible", () => {
  const a = lib.rng(5), b = lib.rng(5);
  assert.deepEqual([a(10), a(10), a(10)], [b(10), b(10), b(10)]);
});

test("E report checks: well-formed reports and located findings; a missing report fails", async () => {
  const build = tmp("report");
  write(build, "src/a.mjs", "line1\nline2\nline3\nline4\nline5\nline6\n");
  const spec = { component: "E", report: "SECURITY.json", checks: [
    { type: "report_wellformed", src: "src" },
    { type: "report_finding", name: "edge", file: "a.mjs", line: 3, words: "parse|crash" },
  ] };
  write(build, "SECURITY.json", JSON.stringify([{ file: "src/a.mjs", line: 4, severity: "HIGH", issue: "the parse step crashes on bad input" }]));
  const ok = await E.grade(build, "t", spec);
  assert.equal(ok.score, 1, JSON.stringify(ok.checks));
  write(build, "SECURITY.json", JSON.stringify([{ file: "src/a.mjs", line: 99, severity: "HIGH", issue: "the parse step crashes on bad input" }, { file: "src/zzz.mjs", line: 1, severity: "BAD", issue: "x" }]));
  const bad = await E.grade(build, "t", spec);
  assert.equal(bad.score, 0);
  fs.rmSync(path.join(build, "SECURITY.json"));
  assert.equal((await E.grade(build, "t", spec)).score, 0);
});

test("P report checks: actionable, calibrated and untouched source", async () => {
  const task = "security-payments";
  const build = tmp("sec");
  fs.cpSync(path.join(lib.TASKS, task, "repo"), build, { recursive: true });
  const spec = readSpec(task, "P");
  assert.equal((await P.grade(build, task, spec)).score, 0.25, "no report: only the untouched source passes");
  fs.copyFileSync(path.join(lib.TASKS, task, "ref", "SECURITY.json"), path.join(build, "SECURITY.json"));
  assert.equal((await P.grade(build, task, spec)).score, 1);
  const weak = JSON.parse(fs.readFileSync(path.join(build, "SECURITY.json"), "utf8")).map((f) => ({ ...f, severity: "LOW" }));
  write(build, "SECURITY.json", JSON.stringify(weak));
  const r = await P.grade(build, task, spec);
  assert.equal(r.checks.find((c) => c.name === "report:severity_calibrated").pass, false);
  write(build, "src/checkout.mjs", fs.readFileSync(path.join(build, "src/checkout.mjs"), "utf8") + "\n// edit\n");
  assert.equal((await P.grade(build, task, spec)).checks.find((c) => c.name === "src_unmodified").pass, false);
});

test("check verdicts: a reference needs >= 0.8, a stub <= 0.4", () => {
  assert.equal(verdict("ref", 0.8), true);
  assert.equal(verdict("ref", 0.79), false);
  assert.equal(verdict("stub", 0.4), true);
  assert.equal(verdict("stub", 0.41), false);
});

test("bugfix-rootcause: the reference scores high and the unchanged repository scores low on E and P", { timeout: 240000 }, async () => {
  const rows = await checkTask("bugfix-rootcause", ["E", "P"]);
  for (const r of rows) assert.ok(r.ok, `${r.kind} ${r.component} scored ${r.score}: ${r.checks.filter((c) => (r.kind === "ref" ? !c.pass : c.pass)).map((c) => c.name).join(", ")}`);
  assert.ok(rows.find((r) => r.kind === "ref" && r.component === "E").score >= 0.8);
});
