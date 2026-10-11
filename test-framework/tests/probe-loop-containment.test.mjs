/** probe-loop containment (organism plan 5.5 step 4): checks run in the worker sandbox,
 * ownership is inspected after the checks, results are hash-bound, apply is all-or-nothing
 * and never follows a destination symlink, and a broken checker stops the experiment.
 * Hermetic: workers are shell commands, no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run, apply, resolveSandbox, confines, hasBwrap, BWRAP, baseCheckProblem, resultHash } from "../../scripts/probe-loop.mjs";

const LANES = { lanes: { max_parallel: 1, why: "t" } };
const tmp = (p) => fs.mkdtempSync(path.join(os.tmpdir(), p));
function base() {
  const dir = tmp("pl-base-");
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "a.txt"), "orig\n");
  fs.writeFileSync(path.join(dir, "src", "b.txt"), "orig b\n");
  fs.writeFileSync(path.join(dir, "README.md"), "readme\n");
  return dir;
}
const spec = (dir, over = {}) => ({ question: "q", base: dir, prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: "echo new > src/a.txt", ...over });
const go = (dir, over, opts = LANES) => run(spec(dir, over), { sandbox: null, ...opts });
// A target equal to the base, plus a winning result that changes a.txt and b.txt.
async function winner(over = {}) {
  const dir = base();
  const r = await go(dir, { worker_cmd: "echo new > src/a.txt; echo new b > src/b.txt", ...over });
  assert.equal(r.winner, 1);
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  return { r, target, w: r.variants[0] };
}
const read = (...p) => fs.readFileSync(path.join(...p), "utf8");
const canContain = () => hasBwrap() && confines(BWRAP).contained;

// 1. checks run inside the worker sandbox
test("the check runs wrapped by the sandbox, with the private home", async () => {
  const log = path.join(tmp("pl-wrap-"), "log");
  const sandbox = resolveSandbox({ sandbox_cmd: "fake" }, { probe: () => ({ contained: true }) });
  sandbox.prefix = `echo wrapped >> ${JSON.stringify(log)};`;
  const marker = `probe-check-home-${process.pid}-${Date.now()}`;
  const r = await run(spec(base(), { check: `echo x > ~/${marker}; test "$HOME" = "$PROBE_HOME"` }), { sandbox, ...LANES });
  assert.equal(fs.readFileSync(log, "utf8").trim().split("\n").length, 3, "worker, base check and variant check");
  assert.equal(fs.existsSync(path.join(os.homedir(), marker)), false);
  assert.equal(r.variants[0].status, "pass");
  assert.equal(r.variants[0].check_contained, true);
});

test("a check writing outside the variant is blocked by the sandbox (child processes included)", async (t) => {
  if (!canContain()) return t.skip("bubblewrap is absent or cannot create user namespaces on this host");
  const outDir = tmp("pl-out-");
  const outside = path.join(outDir, "escape");
  const home = path.join(os.homedir(), `.probe-check-escape-${process.pid}-${Date.now()}`);
  const r = await run(spec(base(), { check: `sh -c 'echo x > ${outside}; echo x > ${home}; echo ok > src/ok.txt'; true` }), LANES);
  assert.equal(r.sandbox, "bwrap");
  assert.equal(fs.existsSync(outside), false);
  assert.equal(fs.existsSync(home), false);
  fs.rmSync(home, { force: true });
  assert.ok(r.variants[0].changed.includes("src/ok.txt"), "writes inside the variant still land");
});

// 2. ownership inspected after the checks
test("a check that writes an unowned file rejects the variant (out-of-scope write)", async () => {
  const dir = base();
  const r = await go(dir, { check: "echo hacked >> README.md; true" });
  const v = r.variants[0];
  assert.equal(v.status, "out_of_bounds");
  assert.equal(v.outside_phase, "check");
  assert.deepEqual(v.outside, ["README.md"]);
  assert.equal(r.winner, null);
  assert.equal(read(dir, "README.md"), "readme\n");
});

test("a check-spawned child process cannot slip an unowned write past the inspection", async () => {
  const r = await go(base(), { check: "sh -c 'node -e \"require(\\\"fs\\\").writeFileSync(\\\"README.md\\\", \\\"x\\\")\"'" });
  assert.equal(r.variants[0].status, "out_of_bounds");
});

test("a check that creates a link leaving the copy rejects the variant", async () => {
  const r = await go(base(), { check: "ln -s /etc src/escape; true" });
  assert.equal(r.variants[0].status, "out_of_bounds");
  assert.match(r.variants[0].outside[0], /src\/escape/);
});

test("check-time writes inside the owned set are part of the bound result", async () => {
  const r = await go(base(), { check: "echo gen > src/generated.txt; true" });
  assert.equal(r.variants[0].status, "pass");
  assert.ok(r.variants[0].changed.includes("src/generated.txt"));
  assert.ok(r.variants[0].files["src/generated.txt"]);
});

// 3. result contents are bound
test("apply refuses a produced file that changed after the probe (tampered result)", async () => {
  const { r, target, w } = await winner();
  fs.writeFileSync(path.join(w.dir, "src/a.txt"), "tampered\n");
  assert.throws(() => apply(r, target), /does not match its recorded hashes: src\/a.txt/);
  assert.equal(read(target, "src/a.txt"), "orig\n");
  assert.equal(read(target, "src/b.txt"), "orig b\n");
});

test("apply refuses an edited result record and a result with no hashes", async () => {
  const { r, target } = await winner();
  const edited = structuredClone(r);
  edited.variants[0].changed.push("README.md");
  edited.variants[0].baseline["README.md"] = null;
  edited.variants[0].files["README.md"] = null;
  assert.throws(() => apply(edited, target), /does not match its recorded hashes/);
  const unbound = structuredClone(r);
  delete unbound.variants[0].files;
  delete unbound.variants[0].result_hash;
  assert.throws(() => apply(unbound, target), /unbound result/);
  const swapped = structuredClone(r);
  swapped.owned = ["src", "README.md"];
  assert.throws(() => apply(swapped, target), /does not match its recorded hashes/);
  assert.equal(read(target, "src/a.txt"), "orig\n");
});

test("apply refuses paths that leave the target or touch .git, even in a consistently rehashed result", async () => {
  for (const f of ["../escape.txt", "/abs.txt", ".git/hooks/pre-commit", "src/../../x"]) {
    const { r, target } = await winner();
    const v = r.variants[0];
    v.changed.push(f); v.baseline[f] = null; v.files[f] = null;
    r.owned = [".", "src", ".git", ".."];
    assert.throws(() => apply(r, target), /refusing to write outside the target|does not match/, f);
  }
});

// 4. destination ancestry without following links
test("apply never writes through a destination directory replaced by a symlink", async () => {
  const { r, target } = await winner();
  const external = tmp("pl-external-");
  fs.writeFileSync(path.join(external, "a.txt"), "orig\n");
  fs.writeFileSync(path.join(external, "b.txt"), "orig b\n");
  fs.rmSync(path.join(target, "src"), { recursive: true });
  fs.symlinkSync(external, path.join(target, "src"));
  assert.throws(() => apply(r, target), /refusing to write outside the target: src\/a.txt \(src is a symlink\)/);
  assert.equal(read(external, "a.txt"), "orig\n");
  assert.equal(read(external, "b.txt"), "orig b\n");
});

test("apply refuses a symlink ancestor below a newly created destination too", async () => {
  const dir = base();
  const r = await go(dir, { worker_cmd: "mkdir -p src/deep/er; echo n > src/deep/er/new.txt" });
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  const external = tmp("pl-external-");
  fs.symlinkSync(external, path.join(target, "src", "deep"));
  assert.throws(() => apply(r, target), /src\/deep is a symlink/);
  assert.deepEqual(fs.readdirSync(external), []);
});

test("apply replaces a destination symlink instead of writing through it", async () => {
  const { r, target } = await winner();
  const external = tmp("pl-external-");
  fs.writeFileSync(path.join(external, "a.txt"), "outside\n");
  // the baseline recorded a regular file, so a link in its place is stale, never followed
  fs.rmSync(path.join(target, "src/a.txt"));
  fs.symlinkSync(path.join(external, "a.txt"), path.join(target, "src/a.txt"));
  assert.throws(() => apply(r, target), /stale result/);
  assert.equal(read(external, "a.txt"), "outside\n");
});

test("a produced link that would leave the target is refused", async () => {
  const dir = base();
  const r = await go(dir, { worker_cmd: "ln -s ../README.md src/inner-ok" });
  assert.equal(r.variants[0].status, "pass");
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  assert.deepEqual(apply(r, target), ["src/inner-ok"], "a link that stays inside the target is applied");
  assert.equal(fs.readlinkSync(path.join(target, "src/inner-ok")), "../README.md");
  // the same link text one level deeper would resolve outside; tamper-proof via result_hash, so
  // exercise the check on a target that is nested one directory shallower
  const shallow = tmp("pl-target-");
  const r2 = await go(base(), { worker_cmd: "ln -s ../README.md src/inner-ok" });
  const v = r2.variants[0];
  v.changed = ["inner-ok"]; v.baseline = { "inner-ok": null }; v.files = { "inner-ok": "link:../README.md" };
  fs.symlinkSync("../README.md", path.join(v.dir, "inner-ok"));
  r2.owned = ["inner-ok"];
  v.result_hash = resultHash(v, r2.owned);
  assert.throws(() => apply(r2, shallow), /link leaves the target/);
});

// 5. preflight before any write; rollback if a write still fails
test("one bad file in the result means nothing is written (partial-write attempt)", async () => {
  const { r, target } = await winner();
  // a.txt would apply cleanly; b.txt was changed by the owner since the probe
  fs.writeFileSync(path.join(target, "src/b.txt"), "owner's newer b\n");
  assert.throws(() => apply(r, target), /stale result: .*src\/b.txt/);
  assert.equal(read(target, "src/a.txt"), "orig\n", "the clean file was not applied either");
  assert.equal(read(target, "src/b.txt"), "owner's newer b\n");
});

test("an ancestor that is a plain file blocks the whole result before any write", async () => {
  const dir = base();
  const r = await go(dir, { worker_cmd: "echo new > src/a.txt; mkdir src/sub; echo n > src/sub/c.txt" });
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  fs.writeFileSync(path.join(target, "src/sub"), "i am a file\n");
  assert.throws(() => apply(r, target), /src\/sub is not a directory/);
  assert.equal(read(target, "src/a.txt"), "orig\n");
});

test("a write that fails midway is rolled back to the original target", async () => {
  const dir = base();
  const r = await go(dir, { worker_cmd: "echo new > src/a.txt; echo n > src/b.txt; mkdir src/fresh; echo n > src/fresh/c.txt" });
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  let writes = 0;
  assert.throws(() => apply(r, target, { onWrite: () => { if (++writes === 3) throw new Error("disk full"); } }), /rolled back: disk full/);
  assert.equal(writes, 3);
  assert.equal(read(target, "src/a.txt"), "orig\n");
  assert.equal(read(target, "src/b.txt"), "orig b\n");
  assert.equal(fs.existsSync(path.join(target, "src/fresh")), false);
});

test("a valid result applies completely and the target must be a directory", async () => {
  const { r, target } = await winner();
  assert.deepEqual(apply(r, target), ["src/a.txt", "src/b.txt"]);
  assert.equal(read(target, "src/a.txt"), "new\n");
  assert.equal(read(target, "src/b.txt"), "new b\n");
  assert.throws(() => apply(r, path.join(target, "missing")), /target is not a directory/);
});

// 6. a broken checker stops the experiment
test("a checker that cannot start stops the run; no worker runs and no variant is condemned", async () => {
  const marker = path.join(tmp("pl-marker-"), "worker-ran");
  const r = await go(base(), { check: "definitely-not-a-command-xyz", variants: 3, worker_cmd: `touch ${JSON.stringify(marker)}` }, { lanes: { max_parallel: 3, why: "t" } });
  assert.equal(r.status, "checker broken");
  assert.match(r.reason, /could not start/);
  assert.equal(r.winner, null);
  assert.equal(r.variants.length, 3);
  assert.ok(r.variants.every((v) => v.status === "skipped" && v.reason === "checker broken"), "nobody is marked failing");
  assert.equal(fs.existsSync(marker), false, "no worker ran");
});

test("a check that fails on the unmodified base is a broken checker, unless a red base is declared", async () => {
  const bad = await go(base(), { check: "exit 1" });
  assert.equal(bad.status, "checker broken");
  assert.match(bad.reason, /fails on the unmodified base/);
  const red = await go(base(), { check: "test \"$(cat src/a.txt)\" = new", expect_base: "fail" });
  assert.equal(red.status, "complete");
  assert.equal(red.variants[0].status, "pass");
  const green = await go(base(), { check: "true", expect_base: "fail" });
  assert.equal(green.status, "checker broken", "a declared-red base that passes is not a usable experiment either");
});

test("a checker that crashes or hangs on the base stops the run even when a red base is declared", async () => {
  const crash = await go(base(), { check: "kill -9 $$", expect_base: "fail" });
  assert.equal(crash.status, "checker broken");
  const hang = await go(base(), { check: "sleep 5", expect_base: "fail", check_timeout_s: 1 });
  assert.equal(hang.status, "checker broken");
  assert.match(hang.reason, /ETIMEDOUT|killed/);
  assert.equal(baseCheckProblem({ status: 0 }), null);
  assert.equal(baseCheckProblem({ status: 1 }, "fail"), null);
  assert.match(baseCheckProblem({ status: null, signal: "SIGSEGV" }), /killed/);
});

test("the CLI exits 3 and says so when the checker is broken", async () => {
  const { spawnSync } = await import("node:child_process");
  const dir = base();
  const specFile = path.join(tmp("pl-spec-"), "spec.json");
  fs.writeFileSync(specFile, JSON.stringify(spec(dir, { check: "exit 127", worker_cmd: "true" })));
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
  const r = spawnSync(process.execPath, [path.join(root, "scripts/probe-loop.mjs"), "run", "--spec", specFile], { encoding: "utf8" });
  assert.equal(r.status, 3);
  assert.match(r.stderr, /checker broken/);
  assert.equal(JSON.parse(r.stdout).status, "checker broken");
});
