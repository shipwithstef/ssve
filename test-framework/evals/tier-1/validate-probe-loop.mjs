#!/usr/bin/env node
/** Tier 1: the probe loop picks the variant that passes its check, fails a variant that
 * writes outside its owned paths, never runs more lanes than the plan allows, stops at
 * the budget, and applies only the winner's changes. Hermetic: workers are shell
 * commands, no model calls. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { run, apply, insideOwned, rank, score, resolveSandbox, confines, hasBwrap, BWRAP } from "../../../scripts/probe-loop.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

function base() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-base-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.writeFileSync(path.join(dir, "src", "drop.mjs"), "export const padding = 0;\n");
  fs.writeFileSync(path.join(dir, "README.md"), "egg drop\n");
  return dir;
}

// Variant 1 under-pads, variant 2 pads enough, variant 3 pads enough but also edits
// README.md (outside its ownership).
const WORKER = `case "$PROBE_VARIANT" in
  1) echo 'export const padding = 1;' > src/drop.mjs ;;
  2) echo 'export const padding = 5;' > src/drop.mjs ;;
  3) echo 'export const padding = 9;' > src/drop.mjs; echo hacked >> README.md ;;
esac
echo "tried padding for variant $PROBE_VARIANT"`;
const CHECK = `node -e 'import("./src/drop.mjs").then(m => { console.log(JSON.stringify({ score: Math.min(1, m.padding / 5) })); process.exit(m.padding >= 5 ? 0 : 1); })'`;

test("the variant that passes the check wins; outside writes fail; apply copies only the winner", async () => {
  const dir = base();
  const r = await run({ question: "how much padding survives a 32 m drop", base: dir, prompt: "pad the egg", owned: ["src"], check: CHECK, variants: 3, worker_cmd: WORKER }, { sandbox: null, lanes: { max_parallel: 3, why: "test" } });
  const by = Object.fromEntries(r.variants.map((v) => [v.variant, v]));
  assert.equal(by[1].status, "fail");
  assert.equal(by[2].status, "pass");
  assert.equal(by[3].status, "out_of_bounds");
  assert.deepEqual(by[3].outside, ["README.md"]);
  assert.equal(r.winner, 2);
  assert.deepEqual(apply(r, dir), ["src/drop.mjs"]);
  assert.match(fs.readFileSync(path.join(dir, "src", "drop.mjs"), "utf8"), /padding = 5/);
  assert.equal(fs.readFileSync(path.join(dir, "README.md"), "utf8"), "egg drop\n", "the out-of-bounds write never reaches the base");
});

test("lanes never exceed the plan cap", async () => {
  const r = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 5, worker_cmd: "true" }, { sandbox: null, lanes: { max_parallel: 2, why: "pro plan" } });
  assert.equal(r.lanes, 2);
  assert.equal(r.variants.length, 5);
});

test("no passing variant means no winner", async () => {
  const r = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "false", variants: 2, worker_cmd: "echo x > src/a.txt" }, { sandbox: null, lanes: { max_parallel: 2, why: "t" } });
  assert.equal(r.winner, null);
  assert.throws(() => apply(r, base()), /no passing variant/);
});

test("ownership must be explicit; ranking and scoring are outcome-based", () => {
  assert.equal(insideOwned("src/a.mjs", ["src"]), true);
  assert.equal(insideOwned("srcx/a.mjs", ["src"]), false);
  assert.equal(insideOwned("a.mjs", ["."]), false, "'.' owns nothing");
  assert.equal(insideOwned("a.mjs", []), false);
  assert.deepEqual(rank([
    { variant: 1, status: "pass", score: 0.5, cost_usd: 0.01 },
    { variant: 2, status: "out_of_bounds", score: 1 },
    { variant: 3, status: "pass", score: 0.9, cost_usd: 0.05 },
    { variant: 4, status: "pass", score: 0.9, cost_usd: 0.02 },
  ]), [4, 3, 1, 2]);
  assert.equal(score(0, "TAP version 13\n# pass 3\n# fail 1\n"), 0.75);
  assert.equal(score(1, 'x\n{"score":0.4}'), 0.4);
  assert.equal(score(0, "ok"), 1);
});

test("no new variant starts once the budget is spent", async () => {
  const r = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 3, worker_cmd: "true", budget_usd: 0 }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } });
  assert.ok(r.variants.every((v) => v.status === "skipped"));
});

test("a worker cannot write through a symlink into the source (review #127 P1)", async () => {
  const dir = base();
  fs.writeFileSync(path.join(dir, "outside.txt"), "orig\n");
  fs.symlinkSync("../outside.txt", path.join(dir, "src", "link.txt"));
  const r = await run({ question: "q", base: dir, prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: "echo changed > src/link.txt" }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } });
  assert.equal(fs.readFileSync(path.join(dir, "outside.txt"), "utf8"), "orig\n", "the original is untouched");
  assert.deepEqual(r.variants[0].changed, ["src/link.txt"], "the write landed in the copy and is reported");
});

test("a worker that creates a link pointing outside its copy fails", async () => {
  const r = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: "ln -s /etc src/escape" }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } });
  assert.equal(r.variants[0].status, "out_of_bounds");
});

test("a worker that writes into the original project aborts the run", async () => {
  const dir = base();
  await assert.rejects(run({ question: "q", base: dir, prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: `echo hacked >> ${JSON.stringify(path.join(dir, "README.md"))}` }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } }), /changed the original project/);
});

test("apply refuses a stale result instead of overwriting newer work (review #127 P1)", async () => {
  const dir = base();
  const r = await run({ question: "q", base: dir, prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: "echo 'export const padding = 5;' > src/drop.mjs" }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } });
  fs.writeFileSync(path.join(dir, "src", "drop.mjs"), "export const padding = 7; // owner's newer change\n");
  assert.throws(() => apply(r, dir), /stale result/);
  assert.match(fs.readFileSync(path.join(dir, "src", "drop.mjs"), "utf8"), /owner's newer change/, "nothing was written");
});

test("a command worker's home is private: writes to ~ stay out of the real home (review #127)", async () => {
  const marker = `probe-home-${process.pid}-${Date.now()}.txt`;
  const r = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: `echo x > ~/${marker}` }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } });
  assert.equal(fs.existsSync(path.join(os.homedir(), marker)), false);
  assert.equal(r.variants[0].status, "pass");
});

test("model workers never run without a sandbox (owner decision on review #127)", async () => {
  await assert.rejects(run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 1 }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } }), /run only inside a sandbox/);
});

test("a sandbox_cmd that does not confine is refused by the live probe", () => {
  assert.throws(() => resolveSandbox({ sandbox_cmd: "env" }), /does not confine/);
  const p = confines("env");
  assert.equal(p.contained, false);
  assert.equal(p.inside, true, "the probe's own inside write still works");
});

test("the resolved sandbox wraps every worker and results say so", async () => {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "probe-wrap-")), "log");
  const sandbox = resolveSandbox({ sandbox_cmd: "fake" }, { probe: () => ({ contained: true }) });
  sandbox.prefix = `echo wrapped >> ${JSON.stringify(log)};`;
  const r = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 3, worker_cmd: "true" }, { sandbox, lanes: { max_parallel: 3, why: "t" } });
  assert.equal(fs.readFileSync(log, "utf8").trim().split("\n").length, 3);
  assert.ok(r.contained && r.variants.every((v) => v.contained && v.sandbox === "custom"));
  const bare = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: "true" }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } });
  assert.equal(bare.variants[0].contained, false, "an uncontained command worker is recorded as such");
});

test("on this host either bubblewrap contains a worker's outside writes, or sandbox-check says it cannot", async () => {
  const check = spawnSync(process.execPath, [path.join(ROOT, "scripts/probe-loop.mjs"), "sandbox-check"], { encoding: "utf8" });
  const report = JSON.parse(check.stdout);
  if (!report.contained) {
    assert.equal(check.status, 1, "a host that cannot contain workers fails sandbox-check");
    assert.match(check.stderr, /cannot contain model workers/);
    return;
  }
  assert.equal(check.status, 0);
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "probe-outside-")), "escape");
  const homeFile = path.join(os.homedir(), `.probe-escape-${process.pid}-${Date.now()}`);
  const r = await run({ question: "q", base: base(), prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: `echo ok > src/in.txt; echo x > ${JSON.stringify(outside)}; echo x > ${JSON.stringify(homeFile)}; true` }, { lanes: { max_parallel: 1, why: "t" } });
  assert.equal(r.sandbox, "bwrap");
  assert.equal(r.variants[0].contained, true);
  assert.deepEqual(r.variants[0].changed, ["src/in.txt"], "writes inside the variant still land");
  assert.equal(fs.existsSync(outside), false, "a write to another temp dir is blocked");
  assert.equal(fs.existsSync(homeFile), false, "a write to the real home is blocked");
  fs.rmSync(homeFile, { force: true });
  assert.equal(resolveSandbox({})?.prefix, BWRAP);
  assert.equal(hasBwrap(), true);
});

test("apply keeps a winner's link as a link, even when its target is missing (review #127)", async () => {
  const dir = base();
  const r = await run({ question: "q", base: dir, prompt: "p", owned: ["src"], check: "true", variants: 1, worker_cmd: "ln -s ./later.txt src/pending" }, { sandbox: null, lanes: { max_parallel: 1, why: "t" } });
  assert.equal(r.variants[0].status, "pass");
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "probe-apply-link-"));
  fs.cpSync(dir, target, { recursive: true });
  apply(r, target);
  assert.equal(fs.lstatSync(path.join(target, "src/pending")).isSymbolicLink(), true);
  assert.equal(fs.readlinkSync(path.join(target, "src/pending")), "./later.txt");
});
