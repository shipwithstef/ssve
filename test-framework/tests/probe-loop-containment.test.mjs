// @organism-suite
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
const tmp = (p) => fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), p));
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

test("apply refuses bad paths even when the result and its hash are recomputed consistently", async () => {
  const cases = [
    ["../escape.txt", /refusing to write outside the target: \.\.\/escape\.txt \(not a plain relative path\)/],
    ["/abs.txt", /refusing to write outside the target: \/abs\.txt \(not a plain relative path\)/],
    [".git/hooks/pre-commit", /refusing to write outside the target: \.git\/hooks\/pre-commit \(not a plain relative path\)/],
    ["src/../../x", /refusing to write outside the target: src\/\.\.\/\.\.\/x \(not a plain relative path\)/],
    ["README.md", /does not match its recorded hashes: README\.md \(not in the owned set\)/],
  ];
  for (const [f, expected] of cases) {
    const { r, target } = await winner();
    const v = r.variants[0];
    v.changed.push(f); v.baseline[f] = null; v.files[f] = null;
    if (f === "../escape.txt" || f === "/abs.txt" || f.startsWith(".git") || f.includes("..")) r.owned = [".", "src", ".git", ".."];
    v.result_hash = resultHash(v, r.owned);
    assert.throws(() => apply(r, target), expected, f);
    assert.equal(read(target, "src/a.txt"), "orig\n", `${f}: nothing was written`);
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

test("produced symlinks are refused, including one whose referent passes through an existing link", async () => {
  const dir = base();
  const r = await go(dir, { worker_cmd: "ln -s ../README.md src/inner" });
  assert.equal(r.variants[0].status, "pass", "the run itself keeps allowing links that stay in the copy");
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  assert.throws(() => apply(r, target), /src\/inner \(produced symlinks are not applied\)/);
  assert.equal(fs.existsSync(path.join(target, "src/inner")), false);
  // the lexically safe link would be redirected by README.md being a link to outside
  const external = tmp("pl-external-");
  fs.writeFileSync(path.join(external, "secret"), "s\n");
  fs.rmSync(path.join(target, "README.md"));
  fs.symlinkSync(path.join(external, "secret"), path.join(target, "README.md"));
  assert.throws(() => apply(r, target), /produced symlinks are not applied/);
  assert.equal(fs.existsSync(path.join(target, "src/inner")), false);
});

test("a symlinked target root, or a symlink above it, is refused (nothing written outside)", async () => {
  const { r, target } = await winner();
  const external = tmp("pl-external-");
  fs.cpSync(target, external, { recursive: true });
  const holder = tmp("pl-holder-");
  const linkRoot = path.join(holder, "root");
  fs.symlinkSync(external, linkRoot);
  assert.throws(() => apply(r, linkRoot), /target root .*root is a symlink/);
  assert.equal(read(external, "src/a.txt"), "orig\n");
  const viaParent = path.join(holder, "parent");
  fs.symlinkSync(path.dirname(external), viaParent);
  assert.throws(() => apply(r, path.join(viaParent, path.basename(external))), /target root .*parent is a symlink/);
  assert.equal(read(external, "src/a.txt"), "orig\n");
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
  assert.throws(() => apply(r, path.join(target, "missing")), /target root .* \(ENOENT\)/);
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

// finding: contents are read once, then written
test("the bytes that were hashed are the bytes written, even if the source changes after preflight", async () => {
  const { r, target, w } = await winner();
  apply(r, target, { beforeWrite: () => fs.writeFileSync(path.join(w.dir, "src/a.txt"), "swapped after the hash check\n") });
  assert.equal(read(target, "src/a.txt"), "new\n");
});

// finding: backups survive until the end; failed rollbacks are reported
test("an original is restored byte for byte when a later write fails", async () => {
  const { r, target } = await winner();
  fs.chmodSync(path.join(target, "src/a.txt"), 0o640);
  assert.throws(() => apply(r, target, { onWrite: (f) => { if (f === "src/a.txt") throw new Error("boom"); } }), /rolled back: boom/);
  assert.equal(read(target, "src/a.txt"), "orig\n");
  assert.equal(read(target, "src/b.txt"), "orig b\n");
  assert.equal(fs.statSync(path.join(target, "src/a.txt")).mode & 0o777, 0o640);
  assert.deepEqual(fs.readdirSync(path.join(target, "src")).sort(), ["a.txt", "b.txt"], "no temp files left");
});

test("a rollback that fails is reported as failed, never as rolled back", async (t) => {
  if (process.getuid?.() === 0) return t.skip("directory permissions do not bind root");
  const { r, target } = await winner();
  const srcDir = path.join(target, "src");
  let err;
  try {
    apply(r, target, { onWrite: (f) => { if (f === "src/b.txt") { fs.chmodSync(srcDir, 0o500); throw new Error("disk full"); } } });
  } catch (e) { err = e; } finally { fs.chmodSync(srcDir, 0o700); }
  assert.ok(err, "apply threw");
  assert.match(err.message, /rollback FAILED/);
  assert.doesNotMatch(err.message, /was rolled back/);
  assert.ok(err.rollbackFailed.length > 0);
});

// finding: file <-> directory changes
test("a file replaced by a directory applies", async () => {
  const dir = base();
  fs.writeFileSync(path.join(dir, "src/x"), "a file\n");
  const r = await go(dir, { worker_cmd: "rm src/x; mkdir src/x; echo y > src/x/y.txt" });
  assert.equal(r.variants[0].status, "pass");
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  apply(r, target);
  assert.equal(read(target, "src/x/y.txt"), "y\n");
});

test("a directory replaced by a file applies, and refuses if the owner added to the directory", async () => {
  const dir = base();
  fs.mkdirSync(path.join(dir, "src/d"));
  fs.writeFileSync(path.join(dir, "src/d/e.txt"), "e\n");
  const r = await go(dir, { worker_cmd: "rm -r src/d; echo f > src/d" });
  assert.equal(r.variants[0].status, "pass");
  const target = tmp("pl-target-");
  fs.cpSync(dir, target, { recursive: true });
  fs.writeFileSync(path.join(target, "src/d/owner.txt"), "mine\n");
  assert.throws(() => apply(r, target), /stale result: .*src\/d \(directory still holds src\/d\/owner\.txt\)/);
  assert.equal(read(target, "src/d/owner.txt"), "mine\n");
  fs.rmSync(path.join(target, "src/d/owner.txt"));
  apply(r, target);
  assert.equal(read(target, "src/d"), "f\n");
});
