// @organism-suite
// @organism-suite
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
import { webMetrics, A11Y_TOOL } from "../outcome-evals/northstar/graders/ui-ep.mjs";
import { spawnSync, spawn } from "node:child_process";

// Tests that run artifact code need a verified sandbox; tests that drive a page need a browser.
// Without them these tests skip with the reason printed, and the rest still run. A grader never
// passes silently without them: it scores 0 with the error (see the "no sandbox" test below).
const SBX = lib.sandboxStatus();
const BROWSER = SBX.ok ? lib.browserStatus() : { ok: false, reason: "needs the sandbox as well" };
const needSandbox = SBX.ok ? {} : { skip: `no sandbox: ${SBX.reason}` };
const needBrowser = SBX.ok && BROWSER.ok ? {} : { skip: SBX.ok ? `no browser: ${BROWSER.reason}` : `no sandbox: ${SBX.reason}` };

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

test("the case runner reports ok, a wrong value, an unclean crash and a missing export", { ...needSandbox }, () => {
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

test("the case runner stops a case that never returns", { ...needSandbox }, () => {
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

test("bugfix-rootcause: the reference scores high and the unchanged repository scores low on E and P", { timeout: 240000 , ...needSandbox }, async () => {
  const rows = await checkTask("bugfix-rootcause", ["E", "P"]);
  for (const r of rows) assert.ok(r.ok, `${r.kind} ${r.component} scored ${r.score}: ${r.checks.filter((c) => (r.kind === "ref" ? !c.pass : c.pass)).map((c) => c.name).join(", ")}`);
  assert.ok(rows.find((r) => r.kind === "ref" && r.component === "E").score >= 0.8);
});

// ---- review fixes: containment, dependencies, README run-path, pinned a11y, auth, readiness, deadlines

const pgrep = (marker) => spawnSync("pgrep", ["-f", marker], { encoding: "utf8" }).stdout.trim();

test("artifact subprocesses get a private HOME and npm cache and no host environment", { ...needSandbox }, () => {
  const dir = tmp("jail");
  process.env.NS_TEST_SECRET = "leak";
  try {
    const r = lib.runContainedSync(dir, ["sh", "-c", 'echo "$HOME|$npm_config_cache|${NS_TEST_SECRET:-none}"'], {});
    const [home, cache, secret] = r.stdout.trim().split("|");
    assert.notEqual(home, os.homedir());
    assert.ok(home.startsWith(os.tmpdir()), home);
    assert.ok(cache.startsWith(home), cache);
    assert.equal(secret, "none");
    if (lib.bwrapAvailable()) {
      const outside = path.join(tmp("outside"), "x");
      const w = lib.runContainedSync(dir, ["sh", "-c", `echo hi > ${outside}; echo ok > ${dir}/inside`], {});
      assert.ok(!fs.existsSync(outside), "writes outside the work dir are refused");
      assert.ok(fs.existsSync(path.join(dir, "inside")), "the work dir stays writable");
      assert.equal(lib.runContainedSync(dir, ["ls", lib.TASKS], {}).stdout.trim(), "", "the task folders are masked");
    }
  } finally { delete process.env.NS_TEST_SECRET; lib.releaseJail(dir); }
});

function depBuild(extraTest = true) {
  const d = tmp("dep");
  write(d, "depx/package.json", JSON.stringify({ name: "depx", version: "1.0.0", main: "index.js", scripts: { postinstall: "node -e \"require('fs').writeFileSync('POSTINSTALL_RAN','x')\"" } }));
  write(d, "depx/index.js", "module.exports = { double: (n) => n * 2 };\n");
  write(d, "package.json", JSON.stringify({ type: "module", dependencies: { depx: "file:./depx" } }));
  write(d, "src/a.mjs", 'import depx from "depx";\nexport const four = () => depx.double(2);\nexport const isBig = (n) => n > 10;\n');
  if (extraTest) write(d, "test/a.test.mjs", 'import test from "node:test";\nimport assert from "node:assert/strict";\nimport { four, isBig } from "../src/a.mjs";\ntest("four", () => { assert.equal(four(), 4); });\ntest("big", () => { assert.equal(isBig(11), true); assert.equal(isBig(10), false); });\n');
  write(d, "README.md", "# dep build\n\nInstall with `npm install`, then run the tests with `npm test`. This text is long enough to count as a README for the check.\n");
  const pkg = JSON.parse(fs.readFileSync(path.join(d, "package.json"), "utf8")); pkg.scripts = { test: "node --test" };
  fs.writeFileSync(path.join(d, "package.json"), JSON.stringify(pkg));
  return d;
}

test("installs run with --ignore-scripts, and mutation keeps the installed dependencies", { timeout: 240000 , ...needSandbox }, async () => {
  const d = depBuild();
  const w = lib.workCopy(d);
  try {
    assert.deepEqual(w.notes, []);
    assert.ok(fs.existsSync(path.join(w.dir, "node_modules", "depx")), "dependencies installed");
    assert.ok(!fs.existsSync(path.join(d, "depx", "POSTINSTALL_RAN")) && !fs.existsSync(path.join(w.dir, "depx", "POSTINSTALL_RAN")), "the lifecycle script did not run");
  } finally { w.cleanup(); }
  const r = await P.grade(d, "t", { component: "P", checks: [{ type: "mutation", mutants: 6, min: 0.3 }] });
  assert.match(r.checks[0].detail, /mutants caught/, r.checks[0].detail);
  assert.equal(r.checks[0].pass, true, r.checks[0].detail);
});

test("README run-path: documented allowlisted commands only; no README or no documented command fails", { ...needSandbox }, async () => {
  const spec = { component: "P", checks: [{ type: "clean_run", commands: { install: ["npm install"], test: ["npm test", "node --test"] } }] };
  const d = depBuild();
  const ok = await P.grade(d, "t", spec);
  assert.equal(ok.score, 1, JSON.stringify(ok.checks));
  fs.rmSync(path.join(d, "README.md"));
  const none = await P.grade(d, "t", spec);
  assert.equal(none.score, 0);
  assert.match(none.checks.find((c) => c.name === "clean:tests_pass").detail, /no README/);
  write(d, "README.md", "# something\n\nWe never say how to run anything here, however long this paragraph is.\n");
  const vague = await P.grade(d, "t", spec);
  assert.match(vague.checks.find((c) => c.name === "clean:tests_pass").detail, /documents no test command/);
  assert.equal(vague.checks.find((c) => c.name === "clean:install").pass, false, "dependencies with no documented install fail");
});

// A small app: /login (form, cookie on the right password only when ACCEPT=1), /api/me needs the cookie.
function authApp(accept) {
  const d = tmp(accept ? "auth-ok" : "auth-no");
  write(d, "package.json", JSON.stringify({ type: "module", scripts: { start: "node server.mjs" } }));
  write(d, "server.mjs", `import http from "node:http";
const ACCEPT = ${accept};
http.createServer((q, r) => {
  const authed = (q.headers.cookie || "").includes("sid=ok");
  if (q.url === "/api/me") { r.writeHead(authed ? 200 : 401).end("{}"); return; }
  if (q.method === "POST" && q.url === "/login") { q.resume().on("end", () => { r.writeHead(303, { location: "/", ...(ACCEPT ? { "set-cookie": "sid=ok; Path=/" } : {}) }).end(); }); return; }
  r.writeHead(200, { "content-type": "text/html" });
  r.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>t</title><body><main><h1>Studio</h1>' + (authed ? '<button>Book</button>' : '<form method="post" action="/login"><label>Email <input name="email" type="email"></label><label>Password <input name="password" type="password"></label><button type="submit">Sign in</button></form>') + '</main></body></html>');
}).listen(Number(process.env.PORT || 3000));
`);
  return d;
}

test("sign-in is verified: a rejected login is reported as not authenticated, an accepted one as signed in", { timeout: 240000 , ...needBrowser }, async () => {
  const spec = { component: "P", start: "node server.mjs", ready: "/", checks: [{ type: "occlusion", pages: ["/"], login: "auto" }] };
  const rejected = await P.grade(authApp(false), "t", spec);
  assert.match(rejected.checks[0].detail, /NOT AUTHENTICATED/, rejected.checks[0].detail);
  assert.doesNotMatch(rejected.checks[0].detail, /signed in, verified/);
  assert.equal(rejected.checks[0].pass, false, "an unverified sign-in never passes on anonymous screens");
  const accepted = await P.grade(authApp(true), "t", spec);
  assert.match(accepted.checks[0].detail, /signed in, verified by \/api\/me/, accepted.checks[0].detail);
  assert.equal(accepted.checks[0].pass, true, accepted.checks[0].detail);
});

// A page whose controls only appear 700 ms after load, so load and readiness differ.
test("readiness waits for the task's signal and frames are sampled under the click workload", { timeout: 120000 , ...needBrowser }, async () => {
  const d = tmp("late");
  write(d, "package.json", JSON.stringify({ type: "module", scripts: { start: "node server.mjs" } }));
  write(d, "server.mjs", `import http from "node:http";
http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/html" }); r.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>late</title><body><main><h1 id="h">Loading the studio schedule for this week, please wait a moment</h1></main><script>setTimeout(() => { window.__ready = true; for (const t of ["One", "Two", "Three"]) { const b = document.createElement("button"); b.textContent = t; b.style.cssText = "min-height:48px;padding:8px 16px"; document.querySelector("main").append(b); } }, 700);</script></body></html>'); }).listen(Number(process.env.PORT || 3000));
`);
  const app = await lib.startApp(d, { start: "node server.mjs" });
  try {
    assert.ok(app.up);
    const m = await lib.withBrowser((b) => webMetrics(b, app.base, "/", { ready: { selector: "button", js: "window.__ready === true" }, playS: 1.5 }));
    assert.ok(m.ready_ms >= 650, `ready_ms ${m.ready_ms} must include the 700 ms the controls took`);
    assert.ok(m.workload_clicks > 3, `${m.workload_clicks} clicks during the workload`);
    assert.ok(Number.isFinite(m.frame_p95_ms));
    assert.equal(m.phone_ready, true, "the phone page waited for the same readiness signal");
    assert.notEqual(m.tap_small_share, null, "tap targets were measured after the controls appeared, not before");
    assert.deepEqual(m.tool.a11y, A11Y_TOOL);
    assert.match(m.tool.browser, /^chromium /);
    const never = await lib.withBrowser((b) => webMetrics(b, app.base, "/", { ready: { selector: "#nothing-here" }, playS: 0.3 }));
    assert.equal(never.ready_ms, Infinity);
  } finally { app.stop(); }
});

test("accessibility is always the pinned DOM-rule subset, and the tool is recorded on the checks", { timeout: 120000 , ...needBrowser }, async () => {
  const spec = { component: "P", start: "node server.mjs", ready: "/", checks: [{ type: "web", play_s: 0.5, thresholds: { a11y_serious_critical: 0, contrast: 0 } }] };
  const r = await P.grade(authApp(false), "t", spec);
  for (const c of r.checks) {
    assert.ok(c.tool, c.detail);
    assert.equal(c.tool.a11y.name, "ns-dom-rules");
    assert.equal(c.tool.a11y.version, "1");
    assert.match(c.detail, /ns-dom-rules@1/);
    assert.doesNotMatch(c.detail, /axe/);
  }
});

test("chaos: bodies and requests are bounded, a probe past its deadline is killed with everything it started", { timeout: 180000 , ...needSandbox }, async () => {
  // A server that streams forever on every request still lets the probe finish.
  const d = tmp("endless");
  write(d, "package.json", JSON.stringify({ type: "module" }));
  write(d, "server.mjs", `import http from "node:http";
http.createServer((q, r) => { r.writeHead(200, { "content-type": "text/plain" }); const t = setInterval(() => r.write("x".repeat(65536)), 1); q.on("close", () => clearInterval(t)); r.on("close", () => clearInterval(t)); }).listen(Number(process.env.PORT || 3000));
`);
  const spec = { component: "E", start: "node server.mjs", ready: "/", checks: [{ type: "chaos", faults: ["malformed"], deadline_ms: 90000 }] };
  const t0 = Date.now();
  const r = await E.grade(d, "t", spec);
  assert.ok(Date.now() - t0 < 80000, "finished well before the deadline");
  assert.doesNotMatch(r.checks[0].detail, /deadline/, r.checks[0].detail);

  // A probe that outlives its deadline is killed, and so is the app it started.
  const h = tmp("hang");
  write(h, "package.json", JSON.stringify({ type: "module" }));
  const marker = `NSMARK${process.pid}${Date.now()}`;
  // A valid long-lived detached child carrying the marker, which the app keeps after the probe dies.
  write(h, "server.mjs", `import { spawn } from "node:child_process"; spawn(process.execPath, ["-e", "setTimeout(() => {}, 600000)", "${marker}"], { stdio: "ignore", detached: true }); setInterval(() => {}, 1000);`);
  const t1 = Date.now();
  const running = E.grade(h, "t", { component: "E", start: "node server.mjs", ready: "/", checks: [{ type: "chaos", faults: ["restart"], deadline_ms: 4000 }] });
  let alive = "";
  for (let i = 0; i < 20 && !alive; i++) { await new Promise((r) => setTimeout(r, 250)); alive = pgrep(marker); }
  assert.notEqual(alive, "", "the long-lived child is running before the cleanup is triggered");
  const k = await running;
  assert.ok(Date.now() - t1 < 30000, "returned shortly after the deadline");
  assert.equal(k.checks[0].pass, false);
  assert.match(k.checks[0].detail, /deadline/);
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(pgrep(marker), "", "nothing the probe started is left running");
});

test("without a verified sandbox, artifact code is refused and the component scores 0 with 'no sandbox'", async () => {
  const before = process.env.OE_NO_BUILDER_SANDBOX;
  process.env.OE_NO_BUILDER_SANDBOX = "1";
  lib.resetSandboxProbe();
  try {
    assert.equal(lib.sandboxStatus().ok, false);
    assert.throws(() => lib.runContainedSync(tmp("x"), ["true"], {}), /no sandbox/);
    assert.throws(() => lib.spawnContained(tmp("x"), ["true"], {}), /no sandbox/);
    assert.throws(() => lib.workCopy(depBuild()), /no sandbox/, "installs are refused too");
    const dir = tmp("nosbx");
    write(dir, "m.mjs", "export const f = () => 1;");
    const specs = tmp("nosbx-specs");
    write(specs, "t/E.json", JSON.stringify({ component: "E", checks: [{ type: "cases", module: "m.mjs", cases: [{ name: "c", steps: [{ fn: "f" }] }] }] }));
    write(specs, "t/P.json", JSON.stringify({ component: "P", checks: [{ type: "mutation" }] }));
    const r = await gradeComponents(dir, "t", { components: ["E", "P"], specsDir: specs });
    assert.equal(r.E, 0);
    assert.equal(r.P, 0);
    assert.match(r.details.E.error, /no sandbox/);
    assert.match(r.details.P.error, /no sandbox/);
    // A report-only spec runs no artifact code and is unaffected.
    write(dir, "src/a.mjs", "1\n2\n3\n");
    write(dir, "SECURITY.json", JSON.stringify([{ file: "src/a.mjs", line: 2, severity: "LOW", issue: "twenty characters or more of text" }]));
    const ok = await E.grade(dir, "t", { component: "E", checks: [{ type: "report_wellformed", src: "src" }] });
    assert.equal(ok.score, 1);
  } finally {
    if (before === undefined) delete process.env.OE_NO_BUILDER_SANDBOX; else process.env.OE_NO_BUILDER_SANDBOX = before;
    lib.resetSandboxProbe();
  }
});

test("readiness needs a 2xx or 3xx: a 404 route is not ready", { ...needSandbox }, async () => {
  const d = tmp("ready404");
  write(d, "package.json", JSON.stringify({ type: "module" }));
  write(d, "server.mjs", `import http from "node:http";
http.createServer((q, r) => { if (q.url === "/redir") { r.writeHead(302, { location: "/ok" }).end(); } else if (q.url === "/ok") r.writeHead(200).end("ok"); else r.writeHead(404).end("missing"); }).listen(Number(process.env.PORT || 3000));`);
  const missing = await lib.startApp(d, { start: "node server.mjs", ready: "/", waitMs: 1500 });
  assert.equal(missing.up, false, "a server answering 404 on the ready route is not up");
  missing.stop();
  const redirect = await lib.startApp(d, { start: "node server.mjs", ready: "/redir", waitMs: 5000 });
  assert.equal(redirect.up, true);
  redirect.stop();
  const ok = await lib.startApp(d, { start: "node server.mjs", ready: "/ok", waitMs: 5000 });
  assert.equal(ok.up, true);
  ok.stop();
});

test("frame samples survive navigation across document lifetimes", { ...needBrowser, timeout: 120000 }, async () => {
  const d = tmp("nav");
  write(d, "package.json", JSON.stringify({ type: "module" }));
  write(d, "server.mjs", `import http from "node:http";
http.createServer((q, r) => { const other = q.url === "/two" ? "/" : "/two"; r.writeHead(200, { "content-type": "text/html" }); r.end('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><title>nav</title><body><main><h1>Page ' + q.url + ' with enough text to count as a heading</h1><a href="' + other + '" style="display:inline-block;min-height:48px;padding:12px">Next page</a></main></body></html>'); }).listen(Number(process.env.PORT || 3000));`);
  const app = await lib.startApp(d, { start: "node server.mjs" });
  try {
    const m = await lib.withBrowser((b) => webMetrics(b, app.base, "/", { ready: { selector: "a" }, playS: 1.5 }));
    assert.ok(m.workload_clicks >= 3, `${m.workload_clicks} navigating clicks`);
    assert.ok(m.frame_docs >= 3, `frames came from ${m.frame_docs} documents; each click loads a new one`);
    assert.ok(m.frame_samples > 30, `${m.frame_samples} frame samples`);
  } finally { app.stop(); }
});
