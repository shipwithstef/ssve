// @organism-suite
// External task roots for the northstar graders: specs, probes and baselines of a task kept
// outside the repo (the reserve), the sandbox that grades it, and the reserve freeze by hash.
// Everything runs on temp directories.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { gradeComponents, readSpec } from "../outcome-evals/northstar/graders/index.mjs";
import * as roots from "../outcome-evals/northstar/graders/task-roots.mjs";
import { innerMasks } from "../outcome-evals/northstar/graders/lib-ep.mjs";
import { loadBar, buildManifest, decide, reserveHashes, main, NorthstarError } from "../../scripts/northstar.mjs";
import { dirSha } from "../../scripts/lib/dir-sha.mjs";
import * as oe from "../../scripts/outcome-eval.mjs";

const tmp = (n) => fs.mkdtempSync(path.join(os.tmpdir(), `ns-specroot-${n}-`));
const write = (dir, rel, text) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), text); };
const withRoots = (list, fn) => {
  const before = process.env.NORTHSTAR_TASK_ROOTS;
  process.env.NORTHSTAR_TASK_ROOTS = list.join(path.delimiter);
  const restore = () => { if (before === undefined) delete process.env.NORTHSTAR_TASK_ROOTS; else process.env.NORTHSTAR_TASK_ROOTS = before; };
  let r;
  try { r = fn(); } catch (e) { restore(); throw e; }
  return r && typeof r.then === "function" ? r.finally(restore) : (restore(), r);
};

// A minimal external task "X1": a K spec with a call fact and a script fact whose probe imports
// the grader helper by the location-independent specifier.
function fakeRoot() {
  const root = tmp("root");
  write(root, "X1/task.json", "{}");
  write(root, "X1/repo/package.json", "{}");
  write(root, "X1/specs/E.json", JSON.stringify({ component: "E", checks: [{ type: "chaos" }], marker: "external" }));
  write(root, "X1/specs/K.json", JSON.stringify({
    task: "X1",
    facts: [
      { id: "quote", rule: "r", type: "call", module: "src/q.mjs", export: "quote", args: [2], expect: { equals: 84 } },
      { id: "probe", rule: "r", type: "script", file: "probes/p.mjs", args: {} },
    ],
  }));
  write(root, "X1/specs/probes/p.mjs", 'import { load, pass, fail } from "@graders/sk-probe.mjs";\nconst m = await load("src/q.mjs");\nif (m.quote(1) !== 42) fail("quote(1) is not 42");\npass("quote ok");\n');
  return root;
}
const goodBuild = () => { const d = tmp("build"); write(d, "src/q.mjs", "export const quote = (n) => n * 42;\n"); return d; };

test("NORTHSTAR_TASK_ROOTS: absolute entries only, in order; taskDirFor is in-repo first", () => {
  const a = tmp("a"), b = tmp("b");
  write(a, "T/task.json", "{}"); write(b, "U/task.json", "{}"); write(b, "yoga-studio/task.json", "{}");
  const list = [a, "relative/dir", "", b].join(path.delimiter);
  assert.deepEqual(roots.extraTaskRoots(list), [a, b]);
  withRoots([a, b], () => {
    assert.equal(roots.taskDirFor("T"), path.join(a, "T"));
    assert.equal(roots.taskDirFor("U"), path.join(b, "U"));
    assert.equal(roots.taskDirFor("yoga-studio"), path.join(roots.IN_REPO_TASKS, "yoga-studio"), "the in-repo task wins over an external one of the same id");
    assert.equal(roots.isExternalTask("T"), true);
    assert.equal(roots.isExternalTask("yoga-studio"), false);
    assert.equal(roots.taskDirFor("nope"), path.join(roots.IN_REPO_TASKS, "nope"));
  });
  // first extra root wins between externals
  write(a, "U/task.json", "{}");
  assert.equal(roots.taskDirFor("U", { roots: [a, b] }), path.join(a, "U"));
});

test("readSpec: external task reads <task dir>/specs, in-repo tasks keep northstar/specs/<task>", () => {
  const root = fakeRoot();
  write(root, "yoga-studio/specs/E.json", JSON.stringify({ marker: "shadow" }));
  withRoots([root], () => {
    assert.equal(readSpec("X1", "E").marker, "external");
    assert.throws(() => readSpec("X1", "P"), /no P spec for task "X1"/);
    const inRepo = readSpec("yoga-studio", "E");
    assert.equal(inRepo.component, "E");
    assert.notEqual(inRepo.marker, "shadow");
    assert.equal(roots.specDirFor("X1"), path.join(root, "X1", "specs"));
    assert.equal(roots.specDirFor("yoga-studio"), path.join(roots.IN_REPO_SPECS, "yoga-studio"));
    assert.equal(roots.refEpDirFor("X1"), path.join(root, "X1", "ref-ep"));
  });
  // without the variable the external task cannot be found
  assert.throws(() => readSpec("X1", "E"), /no E spec/);
});

test("gradeComponents grades an external task with its own specs and a probe that imports @graders/", async () => {
  const root = fakeRoot();
  const good = goodBuild(), empty = tmp("empty");
  await withRoots([root], async () => {
    const r = await gradeComponents(good, "X1", { components: ["K"] });
    assert.equal(r.details.K.error, undefined);
    assert.deepEqual(r.details.K.checks.map((c) => [c.name, c.pass]), [["quote", true], ["probe", true]], JSON.stringify(r.details.K.checks));
    assert.equal(r.K, 1);
    const stub = await gradeComponents(empty, "X1", { components: ["K"] });
    assert.equal(stub.K, 0);
  });
  const none = await gradeComponents(good, "X1", { components: ["K"] });
  assert.equal(none.K, 0);
  assert.match(none.details.K.error, /no K spec/);
});

test("a probe cannot escape the graders directory through @graders/", async () => {
  const graders = path.dirname(fileURLToPath(roots.GRADERS_URL));
  const outside = path.resolve(graders, "..", "..", "..", "..", "scripts", "lib", "is-main.mjs");
  assert.ok(fs.existsSync(outside), "the escape target exists, so a successful traversal would import it");
  assert.ok(!outside.startsWith(graders + path.sep));
  // the resolver: an in-directory file is mapped, the escape is left alone for node to reject
  const hooks = await import("../outcome-evals/northstar/graders/sk-resolve-hooks.mjs");
  const next = (spec) => ({ url: spec });
  assert.equal(hooks.resolve("@graders/sk-probe.mjs", {}, next).url, pathToFileURL(path.join(graders, "sk-probe.mjs")).href);
  assert.equal(hooks.resolve("@graders/../../../../scripts/lib/is-main.mjs", {}, next).url, "@graders/../../../../scripts/lib/is-main.mjs");
  assert.equal(hooks.resolve("@graders/../sk-probe.mjs", {}, next).url, "@graders/../sk-probe.mjs");
  assert.equal(hooks.resolve("@graders/", {}, next).url, "@graders/");
  // end to end: the probe that reaches outside fails, the same probe importing a helper passes
  const root = fakeRoot();
  const good = goodBuild();
  await withRoots([root], async () => {
    assert.equal((await gradeComponents(good, "X1", { components: ["K"] })).details.K.checks.find((c) => c.name === "probe").pass, true);
    write(root, "X1/specs/probes/p.mjs", 'import "@graders/../../../../scripts/lib/is-main.mjs";\nimport { pass } from "@graders/sk-probe.mjs";\npass("escaped");\n');
    const r = await gradeComponents(good, "X1", { components: ["K"] });
    const probe = r.details.K.checks.find((c) => c.name === "probe");
    assert.equal(probe.pass, false);
    assert.doesNotMatch(probe.detail, /escaped/);
  });
});

test("the inner grading sandbox masks the in-repo tasks and every external root", () => {
  const a = tmp("ma"), b = tmp("mb");
  const dirs = roots.taskMaskDirs({ roots: [a, b] });
  assert.deepEqual(dirs, [roots.IN_REPO_TASKS, a, b]);
  assert.deepEqual(innerMasks("/somewhere/else/work", dirs), dirs);
  // a work dir inside a masked root keeps that root visible
  assert.deepEqual(innerMasks(path.join(a, "w"), dirs), [roots.IN_REPO_TASKS, b]);
  assert.deepEqual(roots.taskMaskDirs({ roots: [path.join(a, "missing")] }), [roots.IN_REPO_TASKS]);
});

// ---- the runner ----
test("the component-grade child receives the external roots as --tasks-root and NORTHSTAR_TASK_ROOTS", () => {
  const wrapped = { argv: ["bwrap", "--x", "--"], env: { PROBE_DIR: "/w" } };
  const c = oe.componentGradeCommand(wrapped, { dir: "/w", task: "R1", northstar: "/ns", roots: ["/r1", "/r2"], nodePath: "node", script: "oe.mjs" });
  assert.equal(c.cmd, "bwrap");
  assert.deepEqual(c.args, ["--x", "--", "node", "oe.mjs", "component-grade", "/w", "R1", "--northstar", "/ns", "--tasks-root", "/r1", "--tasks-root", "/r2"]);
  assert.equal(c.env.NORTHSTAR_TASK_ROOTS, ["/r1", "/r2"].join(path.delimiter));
  assert.equal(c.env.PROBE_DIR, "/w");
  const none = oe.componentGradeCommand(wrapped, { dir: "/w", task: "yoga-studio", northstar: "/ns", roots: [] });
  assert.ok(!none.args.includes("--tasks-root"));
  assert.equal(none.env.NORTHSTAR_TASK_ROOTS, undefined);
});

test("component sandbox: the graded task is re-bound, other external tasks stay masked", () => {
  const root = tmp("sbx");
  write(root, "A/task.json", "{}"); write(root, "B/task.json", "{}");
  oe.resetTaskRoots();
  try {
    oe.addTaskRoot(root);
    const work = tmp("work");
    const m = oe.sandboxMasks({ dir: work, role: "components", task: "A", realHome: "/nonexistent-home" });
    assert.ok(m.maskRoots.includes(root), "the external root is masked");
    assert.deepEqual(m.reBind, [path.join(root, "A")]);
    assert.ok(!m.reBind.includes(path.join(root, "B")));
    // the roots handed to the child equal the runner's extra roots, and addTaskRoot there only needs the root to exist
    assert.deepEqual(oe.externalRootsEnv(), { NORTHSTAR_TASK_ROOTS: root });
  } finally { oe.resetTaskRoots(); }
});

// Skip only when bubblewrap itself is unavailable (a trivial run fails); once it works, any launch
// or bind-mount error in the real test below is a failure.
const bwrapUsable = () => {
  if (!oe.hasBwrap()) return false;
  const r = spawnSync("bwrap", ["--ro-bind", "/", "/", "--tmpfs", "/tmp", "--dev", "/dev", "--proc", "/proc", "--unshare-pid", "--", process.execPath, "-e", "0"], { encoding: "utf8" });
  return r.status === 0;
};
const HAS_BWRAP = bwrapUsable();
test("inside a real component sandbox the graded task and its specs are readable and the others are not", { skip: HAS_BWRAP ? false : "bubblewrap is not usable on this host" }, () => {
  const root = tmp("real");
  write(root, "A/specs/E.json", "{}"); write(root, "B/specs/E.json", "{}");
  oe.resetTaskRoots();
  let w;
  try {
    oe.addTaskRoot(root);
    const work = tmp("realwork");
    w = oe.builderWrap(work, { role: "components", task: "A" });
    const probe = `const fs=require("fs");const r=process.argv[1];console.log(JSON.stringify([fs.existsSync(r+"/A/specs/E.json"),fs.existsSync(r+"/B/specs/E.json")]))`;
    const r = spawnSync(w.argv[0], [...w.argv.slice(1), process.execPath, "-e", probe, root], { encoding: "utf8", env: { ...process.env, ...w.env } });
    assert.equal(r.status, 0, `sandbox launch failed: ${r.stderr}`);
    assert.equal(r.stdout.trim(), "[true,false]", r.stderr);
  } finally { oe.resetTaskRoots(); if (w) fs.rmSync(w.job_home, { recursive: true, force: true }); }
});

// ---- reserve freeze ----
test("dirSha: deterministic, order independent, one changed byte changes it, symlinks refused", () => {
  const a = tmp("sa"), b = tmp("sb");
  write(a, "x/one.txt", "1"); write(a, "two.txt", "2");
  write(b, "two.txt", "2"); write(b, "x/one.txt", "1");
  assert.equal(dirSha(a), dirSha(b));
  assert.match(dirSha(a), /^[0-9a-f]{64}$/);
  write(b, "x/one.txt", "9");
  assert.notEqual(dirSha(a), dirSha(b));
  write(b, "x/one.txt", "1"); write(b, "extra/empty-name.txt", "");
  assert.notEqual(dirSha(a), dirSha(b), "an added file changes it");
  fs.rmSync(path.join(b, "extra"), { recursive: true });
  assert.equal(dirSha(a), dirSha(b));
  fs.symlinkSync(path.join(a, "two.txt"), path.join(b, "link"));
  assert.throws(() => dirSha(b), /symlink/);
  // framing cannot be forged: a name or content holding the old separator bytes is not another tree
  const f1 = tmp("f1"), f2 = tmp("f2");
  write(f1, "a", "x\0b\0y");
  write(f2, "a", "x"); write(f2, "b", "y");
  assert.notEqual(dirSha(f1), dirSha(f2));
  const g1 = tmp("g1"), g2 = tmp("g2");
  write(g1, "a", "12"); write(g1, "b", "3");
  write(g2, "a", "1"); write(g2, "b", "23");
  assert.notEqual(dirSha(g1), dirSha(g2), "content boundaries matter");
  // the path is part of the hash: same bytes, different name
  const c = tmp("sc"); write(c, "x/uno.txt", "1"); write(c, "two.txt", "2");
  assert.notEqual(dirSha(a), dirSha(c));
});

// The real bar.json carries the frozen reserve hashes; these tests need an unfrozen one.
function unfrozenBar() {
  const b = loadBar();
  return { ...b, reserve: b.reserve.map((r) => ({ ...r, grader_sha256: null })) };
}

function reserveFixture() {
  const root = tmp("res");
  for (const t of ["R1", "R2"]) { write(root, `${t}/task.json`, "{}"); write(root, `${t}/hidden.test.mjs`, "// h"); write(root, `${t}/specs/E.json`, "{}"); }
  const bar = unfrozenBar();
  const hashes = reserveHashes(root, bar);
  const frozen = { ...bar, reserve: bar.reserve.map((r) => ({ ...r, grader_sha256: hashes[r.task] })) };
  return { root, bar, hashes, frozen };
}
const plan = (bar, roots_) => buildManifest({ model: "m", maxUsd: 35, slice: "reserve", frameworkSha: "abc", bar, tasksRoots: roots_ });

test("reserve-hash prints {R1, R2} and is stable", () => {
  const { root, hashes } = reserveFixture();
  assert.deepEqual(Object.keys(hashes), ["R1", "R2"]);
  assert.deepEqual(reserveHashes(root, loadBar()), hashes);
  assert.notEqual(hashes.R1, hashes.R2 + "x");
  let out = "";
  assert.equal(main(["reserve-hash", root], { out: (s) => { out += s; }, err() {} }), 0);
  assert.deepEqual(JSON.parse(out), hashes);
  assert.equal(main(["reserve-hash", path.join(root, "nope")], { out() {}, err() {} }), 1);
  assert.equal(main(["reserve-hash", tmp("emptyroot")], { out() {}, err() {} }), 1);
});

test("plan refuses a reserve task with a null, mismatched or missing hash and accepts the frozen one", () => {
  const { root, bar, frozen } = reserveFixture();
  assert.throws(() => plan(bar, [root]), (e) => e instanceof NorthstarError && /no frozen grader_sha256/.test(e.message));
  assert.throws(() => plan(frozen, []), (e) => e instanceof NorthstarError && /not found/.test(e.message));
  const m = plan(frozen, [root]);
  assert.equal(m.runs.length, 12);
  assert.equal(m.reserve_task_sha256.R1, frozen.reserve[0].grader_sha256);
  assert.equal(m.runs[0].contract.task_sha256, frozen.reserve[0].grader_sha256);
  write(root, "R2/specs/E.json", '{"changed":true}');
  assert.throws(() => plan(frozen, [root]), (e) => e instanceof NorthstarError && /R2 differs from its frozen/.test(e.message));
  // the dev slice does not need external tasks
  assert.doesNotThrow(() => buildManifest({ model: "m", maxUsd: 35, slice: "dev", frameworkSha: "x", bar }));
  // the dry run is synthetic and never touches the reserve
  assert.doesNotThrow(() => buildManifest({ model: "m", maxUsd: 35, slice: "all", dryRun: true, bar }));
});

test("decide on the reserve slice refuses rows whose recorded task hash is missing or differs", () => {
  const { frozen } = reserveFixture();
  const row = (task, arm, rep, extra = {}) => ({ task, arm, rep, model: "m", framework_sha: arm === "framework" ? "s" : null, builder_sandbox: "bwrap", solved: true, hidden_pass: 1, hidden_total: 1, cost_usd: 1, wall_ms: 1000, stop: "end_turn", model_usage: { m: { inputTokens: 1, outputTokens: 1 } }, components: { E: 1, S: 1, P: 1, K: 1 }, ...(arm === "framework" ? { journey: { conformant: true } } : {}), ...extra });
  const rows = (h1, h2) => ["R1", "R2"].flatMap((t) => ["solo", "framework"].flatMap((arm) => [1, 2, 3].map((rep) => row(t, arm, rep, { task_sha256: t === "R1" ? h1 : h2 }))));
  const [h1, h2] = frozen.reserve.map((r) => r.grader_sha256);
  assert.doesNotThrow(() => decide(rows(h1, h2), { slice: "reserve", bar: frozen }));
  assert.throws(() => decide(rows(h1, "0".repeat(64)), { slice: "reserve", bar: frozen }), (e) => e instanceof NorthstarError && /R2 \(recorded hash differs/.test(e.message));
  assert.throws(() => decide(rows(h1, undefined), { slice: "reserve", bar: frozen }), /no task_sha256 recorded/);
  assert.throws(() => decide(rows(h1, h2), { slice: "reserve", bar: unfrozenBar() }), /no frozen grader_sha256/);
  // the dev slice is unchanged
  assert.doesNotThrow(() => decide([], { slice: "dev", bar: loadBar() }));
});

test("budget-skipped rows carry the task hash; decide on the reserve accepts them only with the frozen hash", () => {
  const { root, frozen } = reserveFixture();
  oe.resetTaskRoots();
  try {
    oe.addTaskRoot(root);
    const job = { id: "R1/solo#1", task: "R1", arm: "solo", rep: 1 };
    const skipped = oe.skippedRow(job, { spent: 3.14159 });
    assert.equal(skipped.error, "skipped: budget");
    assert.equal(skipped.spent_before_usd, 3.14);
    assert.equal(skipped.task_sha256, frozen.reserve[0].grader_sha256);
  } finally { oe.resetTaskRoots(); }
  const [h1, h2] = frozen.reserve.map((r) => r.grader_sha256);
  const row = (task, arm, rep, extra = {}) => ({ task, arm, rep, model: "m", framework_sha: arm === "framework" ? "s" : null, builder_sandbox: "bwrap", solved: true, hidden_pass: 1, hidden_total: 1, cost_usd: 1, wall_ms: 1000, stop: "end_turn", model_usage: { m: { inputTokens: 1, outputTokens: 1 } }, components: { E: 1, S: 1, P: 1, K: 1 }, ...(arm === "framework" ? { journey: { conformant: true } } : {}), ...extra });
  const ran = ["R1", "R2"].flatMap((t) => ["solo", "framework"].flatMap((arm) => [1, 2].map((rep) => row(t, arm, rep, { task_sha256: t === "R1" ? h1 : h2 }))));
  const skip = (t, arm, h) => ({ task: t, arm, rep: 3, error: "skipped: budget", spent_before_usd: 30, ...(h ? { task_sha256: h } : {}) });
  const withSkips = (h) => [...ran, ...["R1", "R2"].flatMap((t) => ["solo", "framework"].map((arm) => skip(t, arm, h?.[t])))];
  assert.doesNotThrow(() => decide(withSkips({ R1: h1, R2: h2 }), { slice: "reserve", bar: frozen }));
  assert.throws(() => decide(withSkips(null), { slice: "reserve", bar: frozen }), /no task_sha256 recorded/, "a skipped row without a hash is refused like any other reserve row");
  assert.throws(() => decide(withSkips({ R1: h1 }), { slice: "reserve", bar: frozen }), /R2 \(no task_sha256 recorded/);
  assert.throws(() => decide(withSkips({ R1: h1, R2: "0".repeat(64) }), { slice: "reserve", bar: frozen }), /R2 \(recorded hash differs/);
});

test("decide on the reserve refuses when any frozen grader_sha256 in bar.json is null, with or without rows", () => {
  const { frozen } = reserveFixture();
  const partial = { ...frozen, reserve: [frozen.reserve[0], { ...frozen.reserve[1], grader_sha256: null }] };
  assert.throws(() => decide([], { slice: "reserve", bar: partial }), (e) => e instanceof NorthstarError && /R2 have no frozen grader_sha256/.test(e.message));
  assert.throws(() => decide([], { slice: "reserve", bar: unfrozenBar() }), /R1, R2 have no frozen grader_sha256/);
  const row = { task: "R1", arm: "solo", rep: 1, model: "m", builder_sandbox: "bwrap", task_sha256: frozen.reserve[0].grader_sha256 };
  assert.throws(() => decide([row], { slice: "reserve", bar: partial }), /no frozen grader_sha256/);
  assert.doesNotThrow(() => decide([], { slice: "reserve", bar: frozen }));
  assert.doesNotThrow(() => decide([], { slice: "dev", bar: loadBar() }));
});

test("regrade records the hash of the task it rescored with: a changed reserve task no longer decides", () => {
  const { root, frozen } = reserveFixture();
  const [h1, h2] = frozen.reserve.map((r) => r.grader_sha256);
  const row = (task, arm, rep, extra = {}) => ({ task, arm, rep, model: "m", framework_sha: arm === "framework" ? "s" : null, builder_sandbox: "bwrap", solved: true, hidden_pass: 1, hidden_total: 1, cost_usd: 1, wall_ms: 1000, stop: "end_turn", model_usage: { m: { inputTokens: 1, outputTokens: 1 } }, components: { E: 1, S: 1, P: 1, K: 1 }, ...(arm === "framework" ? { journey: { conformant: true } } : {}), ...extra });
  const rows = () => ["R1", "R2"].flatMap((t) => ["solo", "framework"].flatMap((arm) => [1, 2, 3].map((rep) => row(t, arm, rep, { task_sha256: t === "R1" ? h1 : h2 }))));
  oe.resetTaskRoots();
  try {
    oe.addTaskRoot(root);
    // an untouched task: the regraded row keeps the frozen hash and decide accepts it
    const ok = rows();
    oe.regradeRow(ok[0], () => ({ hidden_pass: 1, hidden_total: 1 }));
    assert.equal(ok[0].task_sha256, h1);
    assert.doesNotThrow(() => decide(ok, { slice: "reserve", bar: frozen }));
    // one byte of R1 changes after the run; the row still carries the old hash until it is regraded
    write(root, "R1/hidden.test.mjs", "// H");
    const stale = rows();
    assert.doesNotThrow(() => decide(stale, { slice: "reserve", bar: frozen }), "an un-regraded row is unchanged evidence");
    oe.regradeRow(stale[0], () => ({ hidden_pass: 1, hidden_total: 1 }));
    assert.notEqual(stale[0].task_sha256, h1);
    assert.match(stale[0].task_sha256, /^[0-9a-f]{64}$/);
    assert.throws(() => decide(stale, { slice: "reserve", bar: frozen }), (e) => e instanceof NorthstarError && /R1 \(recorded hash differs/.test(e.message));
    // a task that changes while it is being graded, or cannot be hashed, records no hash
    const mid = row("R2", "solo", 1, { task_sha256: h2 });
    oe.regradeRow(mid, () => { write(root, "R2/hidden.test.mjs", "// changed mid-grade"); return {}; });
    assert.equal(mid.task_sha256, null);
    const missing = row("R9", "solo", 1, { task_sha256: h2 });
    oe.regradeRow(missing, () => ({}));
    assert.equal(missing.task_sha256, null);
  } finally { oe.resetTaskRoots(); }
});
