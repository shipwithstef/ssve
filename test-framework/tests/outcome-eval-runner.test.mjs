// @organism-suite
// Fair-arms runner: private home for every arm, git-archive framework install, no unsandboxed
// scored rows, grader cleanup, same-model accounting, one safety timeout, fail-open rerun,
// explicit --parallel. No paid calls: the spawn tests put a fake `claude` on PATH.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import * as oe from "../../scripts/outcome-eval.mjs";
import { resolveDispatchModel } from "../../scripts/resolve-dispatch.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const script = path.join(root, "scripts", "outcome-eval.mjs");
const bwrapOk = oe.hasBwrap();
const tmp = (p = "oe-rt-") => fs.mkdtempSync(path.join(os.tmpdir(), p));

function creds() { const d = tmp("oe-cred-"); const f = path.join(d, "credentials.json"); fs.writeFileSync(f, '{"fake":true}'); return f; }

function taskRootWith(id = "tiny") {
  const r = tmp("oe-troot-");
  fs.mkdirSync(path.join(r, id));
  fs.writeFileSync(path.join(r, id, "spec.md"), "Export add(a, b) from solution.mjs.\n");
  fs.writeFileSync(path.join(r, id, "hidden.test.mjs"), 'import test from "node:test"; import assert from "node:assert/strict"; import { add } from "./solution.mjs";\ntest("add", () => assert.equal(add(1, 2), 3));\n');
  return r;
}

// ---- pure helpers --------------------------------------------------------------------

test("bwrap argv: private home at /tmp/oe-home after the /tmp tmpfs, credentials bound over the placeholder, every task root masked", () => {
  const argv = oe.bwrapArgv({ dir: "/work/b1", jobHome: "/work/h1", credentials: "/real/.claude/.credentials.json", maskRoots: ["/repo/tasks", "/reserve/tasks"], keepRo: ["/opt/bin"], realHome: "/home/someone" });
  const at = (...seq) => argv.findIndex((_, i) => seq.every((x, k) => argv[i + k] === x));
  assert.equal(argv[0], "bwrap");
  const tmpfs = at("--tmpfs", "/tmp"), home = at("--bind", "/work/h1", "/tmp/oe-home"), cred = at("--bind", "/real/.claude/.credentials.json", "/tmp/oe-home/.claude/.credentials.json");
  assert.ok(tmpfs > 0 && home > tmpfs, "the home is bound after /tmp is emptied");
  assert.ok(cred > home, "only the credentials file is bound from the real home");
  assert.ok(at("--tmpfs", "/home/someone") > 0, "the real home is hidden");
  assert.ok(at("--ro-bind", "/opt/bin", "/opt/bin") > at("--tmpfs", "/home/someone"), "needed read-only paths come back after the hide");
  assert.ok(at("--bind", "/work/b1", "/work/b1") > 0);
  for (const m of ["/repo/tasks", "/reserve/tasks"]) assert.ok(at("--tmpfs", m) > cred, `${m} is masked`);
  assert.equal(argv.filter((a) => a === "--bind").length, 3, "writable: build dir, job home, credentials file only");
  assert.equal(argv.at(-1), "--");
});

test("builder env drops SVC_* and config redirects", () => {
  const env = oe.builderEnvBase({ PATH: "/bin", SVC_ROOT: "/x", SVC_HOOK_MODE: "enforce", CLAUDE_CONFIG_DIR: "/c", XDG_CONFIG_HOME: "/x", KEEP: "1" });
  assert.deepEqual(env, { PATH: "/bin", KEEP: "1" });
});

test("ancestor CLAUDE.md, AGENTS.md or .claude/ refuses the build dir and names the file", () => {
  const top = tmp("oe-anc-");
  const dir = path.join(top, "a", "b", "build");
  fs.mkdirSync(dir, { recursive: true });
  assert.deepEqual(oe.ancestorContamination(dir).filter((f) => f.startsWith(top)), []);
  oe.assertCleanAncestors(dir);
  for (const [name, mk] of [["CLAUDE.md", (p) => fs.writeFileSync(p, "x")], ["AGENTS.md", (p) => fs.writeFileSync(p, "x")], [".claude", (p) => fs.mkdirSync(p)]]) {
    const at = path.join(top, "a", name);
    mk(at);
    assert.throws(() => oe.assertCleanAncestors(dir), (e) => e.message.includes(at), `${name} refused`);
    fs.rmSync(at, { recursive: true, force: true });
  }
});

test("installed root must be its archive: a skill symlink pointing outside the source voids the job", () => {
  const src = tmp("oe-src-"), home = tmp("oe-hm-"), elsewhere = tmp("oe-else-");
  fs.mkdirSync(path.join(src, "skills", "a"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  fs.symlinkSync(path.join(src, "skills", "a"), path.join(home, ".claude", "skills", "a"));
  assert.deepEqual(oe.verifyInstalledRoot(home, src), []);
  fs.symlinkSync(elsewhere, path.join(home, ".claude", "skills", "live"));
  const bad = oe.verifyInstalledRoot(home, src);
  assert.equal(bad.length, 1);
  assert.match(bad[0], /^live ->/);
});

test("no bwrap: the wrap throws 'no builder sandbox' for every arm, and the old escape hatch is gone", () => {
  const dir = tmp("oe-nb-");
  const saved = process.env.PATH, hatch = process.env.OE_NO_BUILDER_SANDBOX;
  try {
    process.env.PATH = tmp("oe-empty-path-");
    process.env.OE_NO_BUILDER_SANDBOX = "1";
    assert.equal(oe.hasBwrap(), false);
    assert.throws(() => oe.builderWrap(dir, { credentials: creds() }), /no builder sandbox/);
    assert.throws(() => oe.builderWrap(dir, { framework: { home: dir, src: dir }, credentials: creds() }), /no builder sandbox/);
  } finally { process.env.PATH = saved; if (hatch === undefined) delete process.env.OE_NO_BUILDER_SANDBOX; else process.env.OE_NO_BUILDER_SANDBOX = hatch; }
  assert.ok(!fs.readFileSync(script, "utf8").includes("OE_NO_BUILDER_SANDBOX"));
});

test("grader copy is deleted in a finally, also when the judge throws", async () => {
  const r = taskRootWith("fin");
  oe.addTaskRoot(r);
  try {
    const dir = tmp("oe-fin-");
    fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
    fs.writeFileSync(path.join(dir, "solution.mjs"), "export const add = (a, b) => a + b;\n");
    await assert.rejects(oe.gradeAndCleanup(dir, "fin", { judgeFn: async () => { assert.ok(fs.existsSync(path.join(dir, "__hidden.test.mjs")) === false); throw new Error("judge down"); } }), (e) => e.message === "judge down" && e.partial.solved === true);
    assert.equal(fs.existsSync(path.join(dir, "__hidden.test.mjs")), false);
    const ok = await oe.gradeAndCleanup(dir, "fin", {});
    assert.equal(ok.solved, true);
    assert.equal(fs.existsSync(path.join(dir, "__hidden.test.mjs")), false);
  } finally { oe.resetTaskRoots(); }
});

test("off-model work is rejected only above 1000 output tokens AND 5% of the run", () => {
  const u = (haiku, other) => ({ "claude-haiku-5-5": { outputTokens: haiku }, "claude-sonnet-5-5": { outputTokens: other } });
  assert.equal(oe.offModelWork(u(50000, 900), "haiku"), null, "small background calls are tolerated");
  assert.equal(oe.offModelWork(u(50000, 1000), "haiku"), null, "1000 is not above 1000");
  assert.equal(oe.offModelWork(u(50000, 2000), "haiku"), null, "2000 tokens but under 5% of 52000");
  assert.equal(oe.offModelWork(u(50000, 3000), "haiku"), "claude-sonnet-5-5", "over both thresholds");
  assert.equal(oe.offModelWork(u(500, 1200), "haiku"), "claude-sonnet-5-5");
  assert.equal(oe.offModelWork({ "claude-haiku-5-5": { outputTokens: 9000 } }, "claude-haiku-5-5"), null);
  const merged = oe.mergeModelUsage({ a: { inputTokens: 1, outputTokens: 2, costUSD: 0.5 } }, { a: { outputTokens: 3, costUSD: 0.25 }, b: { outputTokens: 1 } });
  assert.deepEqual([merged.a.outputTokens, merged.a.costUSD, merged.b.outputTokens], [5, 0.75, 1]);
});

test("ARM_LIMITS is one safety timeout for every arm: 2x time, 3x turns", () => {
  const all = Object.values(oe.ARM_LIMITS);
  assert.ok(oe.ARM_LIMITS.solo && oe.ARM_LIMITS.framework);
  for (const l of all) assert.deepEqual(l, { turns: 3, time: 2 });
  assert.deepEqual(oe.ARM_LIMITS.solo, oe.ARM_LIMITS.framework);
  assert.deepEqual(oe.armLimits("not-an-arm"), { turns: 3, time: 2 });
  assert.equal(oe.stoppedBy({ timedOut: true }), "timeout");
  assert.equal(oe.stoppedBy({ stop: "error_max_turns" }), "max_turns");
  assert.equal(oe.stoppedBy({ stop: "error_max_budget_usd" }), "budget");
  assert.equal(oe.stoppedBy({ stop: "success" }), null);
});

test("fail-open: a count above zero re-runs once; the second result is kept, spend is summed, a repeat means rules not loaded", async () => {
  const calls = [];
  const seq = (...rows) => async (n) => { calls.push(n); return { ...rows[n - 1] }; };
  let r = await oe.withFailOpenRerun(seq({ fail_open: 0, cost_usd: 1 }));
  assert.deepEqual([r.fail_open, calls.length, r.fail_open_rerun], [0, 1, undefined]);
  calls.length = 0;
  r = await oe.withFailOpenRerun(seq({ fail_open: "counter absent", cost_usd: 1 }));
  assert.equal(calls.length, 1, "an absent counter never triggers a re-run");
  calls.length = 0;
  r = await oe.withFailOpenRerun(seq({ fail_open: 2, cost_usd: 1, judge_cost_usd: 0.1, artifact: "/a1", wall_ms: 1000, turns: 4, duration_ms: 900, model_usage: { m: { outputTokens: 10, costUSD: 1 } } }, { fail_open: 0, cost_usd: 2, judge_cost_usd: 0.2, artifact: "/a2", wall_ms: 2000, turns: 6, duration_ms: 1500, model_usage: { m: { outputTokens: 5, costUSD: 2 }, n: { outputTokens: 1 } } }));
  assert.deepEqual([r.wall_ms, r.turns, r.duration_ms], [3000, 10, 2400], "time and turns are summed across attempts");
  assert.deepEqual([r.model_usage.m.outputTokens, r.model_usage.m.costUSD, r.model_usage.n.outputTokens], [15, 3, 1], "model usage is merged");
  assert.deepEqual(calls, [1, 2]);
  assert.equal(r.fail_open_rerun, true);
  assert.equal(r.rules_not_loaded, undefined);
  assert.equal(r.cost_usd, 3);
  assert.equal(r.judge_cost_usd, 0.3);
  assert.equal(r.artifact, "/a2");
  assert.equal(r.first_attempt_artifact, "/a1");
  calls.length = 0;
  r = await oe.withFailOpenRerun(seq({ fail_open: 1, cost_usd: 1 }, { fail_open: 3, cost_usd: 1 }));
  assert.deepEqual(calls, [1, 2], "never a third run");
  assert.equal(r.rules_not_loaded, true);
  assert.equal(r.fail_open, 3);
});

test("fail-open counter file: contract, absence and a missing library", () => {
  const dir = tmp("oe-fo-");
  assert.deepEqual(oe.readFailOpen(dir, { has_fail_open_counter: false }), { fail_open: "counter absent" });
  assert.deepEqual(oe.readFailOpen(dir, { has_fail_open_counter: true }), { fail_open: 0 });
  fs.mkdirSync(path.join(dir, ".svc"));
  fs.writeFileSync(path.join(dir, ".svc", "fail-open-counter.json"), JSON.stringify({ total: 3, by_hook: { h: { timeout: 3 } } }));
  assert.deepEqual(oe.readFailOpen(dir, { has_fail_open_counter: true }), { fail_open: 3, fail_open_by_hook: { h: { timeout: 3 } } });
});

test("run refuses to start without an explicit --parallel", () => {
  assert.ok(oe.parseParallel(["run"]).error);
  assert.ok(oe.parseParallel(["run", "--parallel", "0"]).error);
  assert.equal(oe.parseParallel(["run", "--parallel", "3"]).parallel, 3);
  const r = spawnSync(process.execPath, [script, "run", "--arms", "plain", "--tasks", "x"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--parallel/);
});

test("wall-time forecast from the first wave", () => {
  assert.deepEqual(oe.forecastWall({ firstWaveMs: [60000, 120000], remaining: 5, parallel: 2 }), { mean_job_ms: 90000, waves_left: 3, forecast_ms: 270000 });
});

test("dispatch policy pins every slot to the arm model and still validates", () => {
  const def = JSON.parse(fs.readFileSync(path.join(root, "references", "default-dispatch-policy.json"), "utf8"));
  const pinned = oe.pinDispatchPolicy(def, "haiku");
  const models = [];
  JSON.stringify(pinned, (k, v) => { if (k === "model") models.push(v); return v; });
  assert.ok(models.length >= 7 && models.every((m) => m === "haiku" || m === "web_search"), models.join());
  const home = tmp("oe-pol-");
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  const w = oe.writeFrameworkPolicies(home, root, "haiku");
  assert.equal(w.slot_pin, "dispatch-policy");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, ".svc", "hook-policy.json"), "utf8")), { mode: "advisory" });
  const t = resolveDispatchModel({ label: "EXEC", orchestrator: "claude", configPath: path.join(home, ".svc", "dispatch-policy.json") });
  assert.equal(t.tuple?.model ?? t.model, "haiku");
  const bare = tmp("oe-nopol-");
  assert.equal(oe.writeFrameworkPolicies(home, bare, "haiku").slot_pin, "env-only");
});

test("component grading is skipped when the graders or the bar are absent; a thrower scores 0", async () => {
  const ns = tmp("oe-ns-");
  assert.deepEqual(await oe.gradeComponentsFor("/x", "t", { northstar: ns }), {});
  fs.mkdirSync(path.join(ns, "graders"));
  fs.writeFileSync(path.join(ns, "bar.json"), JSON.stringify({ matrix: { t: ["E", "S", "P"], u: { E: true, K: true, S: false } } }));
  fs.writeFileSync(path.join(ns, "graders", "index.mjs"), 'export async function gradeComponents(dir, task, { components }) { if (task === "u") throw new Error("boom"); return { E: 0.5, S: { score: 2 }, P: "x" }; }\n');
  const a = await oe.gradeComponentsFor("/x", "t", { northstar: ns });
  assert.deepEqual(a.components, { E: 0.5, S: 1, P: 0 });
  assert.deepEqual(Object.keys(a.component_errors), ["P"]);
  const b = await oe.gradeComponentsFor("/x", "u", { northstar: ns });
  assert.deepEqual(b.components, { E: 0, K: 0 });
  assert.match(b.component_errors.E, /boom/);
  assert.deepEqual(await oe.gradeComponentsFor("/x", "zzz", { northstar: ns }), {});
});

test("extra task roots resolve tasks outside the repo", () => {
  const r = taskRootWith("reserve-1");
  try {
    assert.ok(!oe.listTasks().includes("reserve-1"));
    oe.addTaskRoot(r);
    assert.ok(oe.listTasks().includes("reserve-1"));
    assert.equal(oe.taskDir("reserve-1"), path.join(r, "reserve-1"));
    assert.equal(oe.taskConfig("reserve-1").max_turns, 40);
  } finally { oe.resetTaskRoots(); }
});

// ---- real bubblewrap ----------------------------------------------------------------

test("sandbox: HOME is /tmp/oe-home, only the credentials file comes from the real home, task roots are empty", { skip: !bwrapOk }, () => {
  const work = tmp("oe-sbx-");
  const dir = path.join(work, "build"); fs.mkdirSync(dir);
  const extra = taskRootWith("hidden-answer");
  const cred = creds();
  try {
    oe.addTaskRoot(extra);
    const w = oe.builderWrap(dir, { credentials: cred, workRoot: work, model: "haiku" });
    assert.equal(w.env.HOME, "/tmp/oe-home");
    assert.equal(w.env.CLAUDE_CODE_SUBAGENT_MODEL, "haiku");
    assert.equal(w.env.ANTHROPIC_SMALL_FAST_MODEL, "haiku");
    const inner = 'echo "home=$HOME"; ls -A "$HOME/.claude"; cat "$HOME/.claude/.credentials.json"; echo; echo "real=$(ls -A "$REAL" 2>/dev/null | wc -l)"; echo "extra=$(ls -A "$EXTRA" | wc -l)"; echo "repo=$(ls -A "$REPO" 2>/dev/null | wc -l)"; touch "$DIR/ok" && echo build-writable; touch "$REAL/.claude/x" 2>/dev/null && echo escaped';
    const r = spawnSync(w.argv[0], [...w.argv.slice(1), "sh", "-c", inner], { env: { ...process.env, ...w.env, REAL: path.join(os.homedir(), ".claude"), EXTRA: extra, REPO: root, DIR: dir }, encoding: "utf8" });
    assert.match(r.stdout, /home=\/tmp\/oe-home/);
    assert.match(r.stdout, /\.credentials\.json/);
    assert.match(r.stdout, /\{"fake":true\}/, "the credentials file is the bound one");
    assert.match(r.stdout, /real=0/, "the real ~/.claude is not visible");
    assert.match(r.stdout, /extra=0/, "an extra task root looks empty");
    assert.match(r.stdout, /repo=0/, "the live repository is not visible to a solo builder");
    assert.match(r.stdout, /build-writable/);
    assert.ok(!r.stdout.includes("escaped"));
    assert.ok(fs.readdirSync(path.join(w.job_home, ".claude")).includes(".credentials.json"));
    assert.ok(fs.readdirSync(extra).length > 0, "outside the sandbox nothing changed");
  } finally { oe.resetTaskRoots(); }
});

function fakeClaude(dir) {
  const bin = path.join(dir, "claude");
  fs.writeFileSync(bin, `#!/bin/sh
cat > /dev/null
printf '{"home":"%s","svc":"%s","hook":"%s","sub":"%s","fast":"%s","realclaude":"%s","skills":"%s","profile":"%s"}' "$HOME" "$(env | grep -c '^SVC_ROOT=')" "$SVC_HOOK_MODE" "$CLAUDE_CODE_SUBAGENT_MODEL" "$ANTHROPIC_SMALL_FAST_MODEL" "$(ls -A "$FAKE_REAL_HOME/.claude" 2>/dev/null | wc -l)" "$(ls "$HOME/.claude/skills" 2>/dev/null | tr '\\n' ',')" "$SVC_DELIVERY_PROFILE" > probe.json
echo 'export const add = (a, b) => a + b;' > solution.mjs
if [ -n "$FAKE_COUNTER" ]; then mkdir -p .svc; echo "{\\"total\\":$FAKE_COUNTER,\\"by_hook\\":{}}" > .svc/fail-open-counter.json; fi
case "$FAKE_MODE" in
  offmodel) USAGE='{"claude-haiku-5-5":{"inputTokens":10,"outputTokens":2000,"costUSD":0.01},"claude-opus-5-5":{"inputTokens":10,"outputTokens":3000,"costUSD":0.5}}' ;;
  background) USAGE='{"claude-haiku-5-5":{"inputTokens":10,"outputTokens":20000,"costUSD":0.01},"claude-opus-5-5":{"inputTokens":10,"outputTokens":300,"costUSD":0.001}}' ;;
  *) USAGE='{"claude-haiku-5-5":{"inputTokens":10,"outputTokens":2000,"costUSD":0.01}}' ;;
esac
if [ "$FAKE_MODE" = "maxturns" ]; then SUB=error_max_turns; else SUB=success; fi
if [ -n "$FAKE_NESTED" ]; then
  mkdir -p "$HOME/.claude/projects/p"
  echo '{"type":"assistant","sessionId":"outer-1","message":{"id":"m0","model":"claude-haiku-5-5","usage":{"input_tokens":5,"output_tokens":7}}}' > "$HOME/.claude/projects/p/outer-1.jsonl"
  if [ "$FAKE_NESTED" = opus ]; then NM=claude-opus-5-5; NO=5000; else NM=claude-haiku-5-5; NO=300; fi
  L='{"type":"assistant","sessionId":"nested-1","message":{"id":"n1","model":"'$NM'","usage":{"input_tokens":100,"output_tokens":'$NO',"cache_read_input_tokens":1000,"cache_creation_input_tokens":200}}}'
  echo "$L" > "$HOME/.claude/projects/p/nested-1.jsonl"; echo "$L" >> "$HOME/.claude/projects/p/nested-1.jsonl"
fi
printf '{"type":"result","subtype":"%s","session_id":"outer-1","is_error":false,"result":"done","total_cost_usd":0.02,"num_turns":4,"duration_ms":5,"modelUsage":%s}' "$SUB" "$USAGE"
`, { mode: 0o755 });
  return bin;
}

function runEval(args, { mode = "ok", counter = "", extraEnv = {}, workBase = null } = {}) {
  const base = tmp("oe-e2e-");
  const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  fakeClaude(bin);
  const out = path.join(base, "out.json");
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, OE_CREDENTIALS: creds(), FAKE_MODE: mode, FAKE_REAL_HOME: os.homedir(), SVC_ROOT: "/should/not/leak", ...(counter !== "" ? { FAKE_COUNTER: counter } : {}), ...extraEnv };
  const r = spawnSync(process.execPath, [script, "run", "--judge", "none", "--reps", "1", "--model", "haiku", "--keep", path.join(base, "kept"), "--work-root", workBase || path.join(base, "work"), "--out", out, ...args], { env, encoding: "utf8", timeout: 240000 });
  const result = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  return { r, result, base };
}

test("solo arm end to end (fake claude): private home, no SVC env, model usage recorded, grader removed, parallel recorded", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  const { r, result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(result.parallel, 1);
  const row = result.rows[0];
  assert.equal(row.error, undefined, JSON.stringify(row));
  assert.equal(row.builder_sandbox, "bwrap");
  assert.equal(row.solved, true);
  assert.equal(row.stopped_by, null);
  assert.deepEqual(Object.keys(row.model_usage), ["claude-haiku-5-5"]);
  assert.equal(row.model_usage["claude-haiku-5-5"].outputTokens, 2000);
  const probe = JSON.parse(fs.readFileSync(path.join(row.artifact, "probe.json"), "utf8"));
  assert.equal(probe.home, "/tmp/oe-home");
  assert.equal(probe.svc, "0");
  assert.equal(probe.sub, "haiku");
  assert.equal(probe.fast, "haiku");
  assert.equal(probe.realclaude, "0", "the real ~/.claude is invisible");
  assert.equal(probe.skills, "", "solo has no skills");
  assert.equal(row.foreign_cli, "blocked");
  assert.equal(row.nested_cost_usd, 0);
  assert.equal(row.cost_usd, 0.02);
  assert.equal(fs.existsSync(path.join(row.artifact, "__hidden.test.mjs")), false);
});

test("--sealed (fake claude): stdout and stderr show no score, the rows with scores are in --out", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  const { r, result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1", "--sealed"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(result.rows[0].solved, true, "the full row is in --out");
  const shown = r.stdout + r.stderr;
  assert.doesNotMatch(shown, /solved|solve_rate|hidden|mean_hidden_score|components|\b\d+\/\d+ solved/i);
  assert.match(r.stderr, /job 1\/1: done, \$/);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(out).sort(), ["cost_usd", "error_rows", "jobs", "out", "sealed", "wall_s"]);
});

test("off-model work is an error row; background calls are not; ending at the turn limit is still graded", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  let { result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"], { mode: "offmodel" });
  assert.equal(result.rows[0].error, "off-model work: claude-opus-5-5");
  assert.equal(result.rows[0].solved, undefined, "not graded");
  ({ result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"], { mode: "background" }));
  assert.equal(result.rows[0].error, undefined);
  assert.equal(result.rows[0].solved, true);
  ({ result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"], { mode: "maxturns" }));
  assert.equal(result.rows[0].stopped_by, "max_turns");
  assert.equal(result.rows[0].solved, true);
});

test("a build under a directory that carries CLAUDE.md is refused before any run", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  const poisoned = tmp("oe-poison-");
  fs.writeFileSync(path.join(poisoned, "CLAUDE.md"), "x");
  const r2 = spawnSync(process.execPath, [script, "run", "--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1", "--work-root", path.join(poisoned, "work")], { encoding: "utf8", env: { ...process.env, OE_CREDENTIALS: creds() } });
  assert.equal(r2.status, 2);
  assert.match(r2.stderr, /CLAUDE\.md/);
});

function miniFramework() {
  const repo = tmp("oe-fwrepo-");
  fs.mkdirSync(path.join(repo, "skills", "route-workflow"), { recursive: true });
  fs.mkdirSync(path.join(repo, "skills", "other"), { recursive: true });
  fs.writeFileSync(path.join(repo, "skills", "route-workflow", "SKILL.md"), "x");
  fs.writeFileSync(path.join(repo, "skills", "other", "SKILL.md"), "x");
  fs.mkdirSync(path.join(repo, "scripts", "lib"), { recursive: true });
  fs.writeFileSync(path.join(repo, "scripts", "lib", "fail-open-counter.mjs"), "export {};\n");
  fs.writeFileSync(path.join(repo, "setup"), '#!/bin/bash\nset -e\nD="$(cd "$(dirname "$0")" && pwd -P)"\nmkdir -p "$HOME/.claude/skills"\nfor s in "$D"/skills/*/; do ln -s "${s%/}" "$HOME/.claude/skills/$(basename "$s")"; done\necho "{}" > "$HOME/.claude/settings.json"\n', { mode: 0o755 });
  const git = (...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: repo, encoding: "utf8" });
  git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "mini");
  const sha = git("rev-parse", "HEAD").stdout.trim();
  // A later working-tree change that must NOT leak into the install.
  fs.mkdirSync(path.join(repo, "skills", "leak"));
  fs.writeFileSync(path.join(repo, "skills", "leak", "SKILL.md"), "x");
  return { repo, sha };
}

test("framework arm from git archive (fake claude): installed from the sha, cloned home, advisory, counter, receipts, slot pin", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  const { repo, sha } = miniFramework();
  const cache = tmp("oe-cache-");
  const common = ["--arms", "framework", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1", "--framework-sha", sha, "--framework-repo", repo, "--framework-cache", cache];
  const { r, result } = runEval(common, { counter: "0" });
  assert.equal(r.status, 0, r.stderr);
  const row = result.rows[0];
  assert.equal(row.error, undefined, JSON.stringify(row));
  assert.equal(row.framework_sha, sha);
  assert.equal(result.framework_sha, sha);
  assert.equal(row.fail_open, 0);
  assert.equal(row.checkpoint_mode, "prompt-sentence");
  assert.equal(row.slot_pin, "env-only");
  assert.equal(row.receipts_emitted, 0);
  assert.equal(row.same_family_release, null);
  assert.equal(row.same_family_release_reason, "absent at this sha");
  const probe = JSON.parse(fs.readFileSync(path.join(row.artifact, "probe.json"), "utf8"));
  assert.equal(probe.hook, "advisory");
  assert.equal(probe.skills, "other,route-workflow,", "the committed skills are installed, the uncommitted one is not");
  assert.equal(probe.svc, "0");
  assert.ok(fs.existsSync(path.join(cache, sha, "ok")));
  assert.deepEqual(oe.verifyInstalledRoot(path.join(cache, sha, "home"), path.join(cache, sha, "src")), []);
  assert.equal(fs.existsSync(path.join(cache, sha, "home", ".claude", ".credentials.json")), false, "the cached home never holds credentials");
  // The counter is read from the build; a count re-runs the job once and both attempts are charged.
  const again = runEval(common, { counter: "2" });
  const row2 = again.result.rows[0];
  assert.equal(row2.fail_open_rerun, true);
  assert.equal(row2.rules_not_loaded, true);
  assert.equal(row2.attempts, 2);
  assert.ok(Math.abs(row2.cost_usd - 0.04) < 1e-9, `both attempts' spend: ${row2.cost_usd}`);
});

test("the safety timeout kills a run and reports stopped_by: timeout", async () => {
  const bin = tmp("oe-slow-");
  fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\nsleep 5\n", { mode: 0o755 });
  const saved = process.env.PATH;
  try {
    process.env.PATH = `${bin}${path.delimiter}${saved}`;
    const r = await oe.runAgent(tmp("oe-to-"), "p", "haiku", 300, undefined, 3);
    assert.equal(r.stopped_by, "timeout");
    assert.match(r.error, /^timeout/);
  } finally { process.env.PATH = saved; }
});

test("framework arm requires --framework-sha", () => {
  const r = spawnSync(process.execPath, [script, "run", "--arms", "framework", "--tasks", "x", "--parallel", "1"], { encoding: "utf8" });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--framework-sha/);
});

// ---- review fixes --------------------------------------------------------------------

function archiveWithAnswers() {
  const src = tmp("oe-ans-src-"), home = tmp("oe-ans-home-");
  for (const d of ["tasks/secret", "results", "northstar/graders"]) fs.mkdirSync(path.join(src, "test-framework", "outcome-evals", d), { recursive: true });
  const base = path.join(src, "test-framework", "outcome-evals");
  fs.writeFileSync(path.join(base, "tasks", "secret", "hidden.test.mjs"), "HIDDEN");
  fs.writeFileSync(path.join(base, "results", "r.json"), "RESULTS");
  fs.writeFileSync(path.join(base, "northstar", "graders", "index.mjs"), "GRADERS");
  fs.mkdirSync(path.join(src, "skills", "a"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  fs.symlinkSync(path.join(src, "skills", "a"), path.join(home, ".claude", "skills", "a"));
  return { src: fs.realpathSync(src), home };
}

test("sandbox masks cover the archive's tasks, results and northstar dirs and an extra root's counterparts, on any machine", () => {
  // Every path is a fixture under a temp dir: nothing depends on HOME, the checkout location or bwrap.
  const base = tmp("oe-masks-");
  const mk = (...p) => { const d = path.join(base, ...p); fs.mkdirSync(d, { recursive: true }); return d; };
  const repoRoot = mk("repo"), dir = mk("work", "job"), extra = mk("reserve");
  const src = mk("cache", "src");
  for (const root of [repoRoot, src]) for (const d of ["tasks", "results", "northstar"]) mk(path.relative(base, root), "test-framework", "outcome-evals", d);
  const reserveTasks = mk("reserve", "tasks"); mk("reserve", "northstar");
  try {
    oe.addTaskRoot(reserveTasks);
    for (const home of [path.join(base, "elsewhere-home"), path.join(base, "cache")]) {
      const keepRo = home === path.join(base, "cache") ? [src] : [];
      const { maskRoots } = oe.sandboxMasks({ dir, framework: { src }, exposeRoot: true, keepRo, realHome: home, repoRoot, kept: path.join(base, "kept") });
      const want = [
        ...["tasks", "results", "northstar"].map((d) => path.join(src, "test-framework", "outcome-evals", d)),
        ...["tasks", "results", "northstar"].map((d) => path.join(repoRoot, "test-framework", "outcome-evals", d)),
        reserveTasks, path.join(extra, "northstar"),
      ];
      for (const m of want) assert.ok(maskRoots.includes(m), `${m} is masked (real home ${path.basename(home)})`);
      assert.ok(!maskRoots.includes(repoRoot), "an exposed repo root is not itself masked");
      assert.ok(!maskRoots.some((m) => dir.startsWith(m + path.sep)), "no mask swallows the job dir");
    }
    // A mask inside a hidden real home is dropped unless that path was brought back read-only.
    const hidden = oe.sandboxMasks({ dir, framework: { src }, exposeRoot: true, keepRo: [], realHome: path.join(base, "cache"), repoRoot, kept: path.join(base, "kept") });
    assert.ok(!hidden.maskRoots.includes(path.join(src, "test-framework", "outcome-evals", "tasks")));
    // Solo builders do not see the live repo at all.
    assert.ok(oe.sandboxMasks({ dir, exposeRoot: false, realHome: path.join(base, "none"), repoRoot }).maskRoots.includes(repoRoot));
  } finally { oe.resetTaskRoots(); }
});

test("a framework builder cannot read the archive's hidden grader", { skip: !bwrapOk }, () => {
  const { src, home } = archiveWithAnswers();
  const dir = tmp("oe-ans-b-");
  const w = oe.builderWrap(dir, { credentials: creds(), framework: { home, src, checkpoint_mode: "prompt-sentence" }, model: "haiku", workRoot: tmp("oe-ans-w-") });
  const base = path.join(src, "test-framework", "outcome-evals");
  const r = spawnSync(w.argv[0], [...w.argv.slice(1), "sh", "-c", 'cat "$B/tasks/secret/hidden.test.mjs" 2>/dev/null; cat "$B/results/r.json" 2>/dev/null; cat "$B/northstar/graders/index.mjs" 2>/dev/null; ls "$S/skills"; echo end'], { env: { ...process.env, ...w.env, B: base, S: src }, encoding: "utf8" });
  assert.ok(!/HIDDEN|RESULTS|GRADERS/.test(r.stdout), r.stdout);
  assert.match(r.stdout, /^a\nend/m, "the rest of the archive stays readable");
  assert.equal(fs.readFileSync(path.join(base, "tasks", "secret", "hidden.test.mjs"), "utf8"), "HIDDEN", "outside the sandbox nothing changed");
});

test("the run deletes only its own directory beneath --work-root", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  const base = tmp("oe-wbase-");
  fs.writeFileSync(path.join(base, "keep-me.txt"), "mine");
  fs.mkdirSync(path.join(base, "other-run"));
  const { r, result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"], { workBase: base });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(fs.readFileSync(path.join(base, "keep-me.txt"), "utf8"), "mine");
  assert.ok(fs.existsSync(path.join(base, "other-run")));
  assert.deepEqual(fs.readdirSync(base).sort(), ["keep-me.txt", "other-run"], "the invocation directory is gone");
  assert.deepEqual(result.task_roots, [tr], "the task roots are persisted in the results file");
});

test("--tasks-root works before every subcommand: regrade finds external tasks, also from the stored roots", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  const { result, base } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"]);
  const file = path.join(base, "out.json");
  const row = result.rows[0];
  fs.writeFileSync(path.join(row.artifact, "solution.mjs"), "export const add = () => 0;\n");
  const withFlag = spawnSync(process.execPath, [script, "regrade", file, "--tasks-root", tr], { encoding: "utf8" });
  assert.equal(withFlag.status, 0, withFlag.stderr);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).rows[0].solved, false, "the external grader ran");
  fs.writeFileSync(path.join(row.artifact, "solution.mjs"), "export const add = (a, b) => a + b;\n");
  const stored = spawnSync(process.execPath, [script, "regrade", file], { encoding: "utf8" });
  assert.equal(stored.status, 0, stored.stderr);
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).rows[0].solved, true, "the stored roots were used");
  assert.equal(fs.existsSync(path.join(row.artifact, "__hidden.test.mjs")), false);
  const missing = spawnSync(process.execPath, [script, "check", "--tasks-root", path.join(base, "nope")], { encoding: "utf8" });
  assert.equal(missing.status, 2);
});

// ---- round 2 -------------------------------------------------------------------------

function hiddenTaskRoot(id, testBody) {
  const r = tmp("oe-gtroot-");
  fs.mkdirSync(path.join(r, id));
  fs.writeFileSync(path.join(r, id, "spec.md"), "x\n");
  fs.writeFileSync(path.join(r, id, "hidden.test.mjs"), testBody);
  return r;
}

test("hidden tests run inside the sandbox: private home, no real home, no escape, task roots empty", { skip: !bwrapOk }, async () => {
  const outside = tmp("oe-outside-");
  const tr = hiddenTaskRoot("jail", `import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
test("jailed", () => {
  assert.equal(process.env.HOME, "/tmp/oe-home");
  assert.equal(fs.existsSync(path.join(process.env.OE_REAL_HOME, ".claude")), false, "real home is hidden");
  assert.equal(fs.existsSync(process.env.OE_OUTSIDE), false, "host /tmp is not visible");
  assert.throws(() => fs.writeFileSync(path.join(process.env.OE_OUTSIDE, "pwn"), "x"));
  assert.equal(fs.existsSync(process.env.OE_TASKS), false, "the hidden task dir is not readable");
  fs.writeFileSync("built-ok", "x");
});
`);
  const dir = tmp("oe-jail-");
  fs.writeFileSync(path.join(dir, "package.json"), '{"type":"module"}');
  Object.assign(process.env, { OE_REAL_HOME: os.homedir(), OE_OUTSIDE: outside, OE_TASKS: path.join(tr, "jail", "hidden.test.mjs") });
  try {
    oe.addTaskRoot(tr);
    const bare = oe.grade(dir, "jail");
    assert.equal(bare.solved, false, "unsandboxed, the same test sees the host (control)");
    fs.rmSync(path.join(dir, "__hidden.test.mjs"), { force: true });
    const r = await oe.gradeAndCleanup(dir, "jail", { sandbox: { workRoot: tmp("oe-jw-") } });
    assert.equal(r.solved, true, JSON.stringify(r.hidden_failures));
    assert.ok(fs.existsSync(path.join(dir, "built-ok")), "the build dir is writable");
    assert.equal(fs.existsSync(path.join(dir, "__hidden.test.mjs")), false);
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally { oe.resetTaskRoots(); for (const k of ["OE_REAL_HOME", "OE_OUTSIDE", "OE_TASKS"]) delete process.env[k]; }
});

test("component graders run inside the sandbox too", { skip: !bwrapOk }, async () => {
  const outside = tmp("oe-outside-");
  const ns = tmp("oe-ns-");
  fs.mkdirSync(path.join(ns, "graders"));
  fs.writeFileSync(path.join(ns, "bar.json"), JSON.stringify({ matrix: { t: ["E", "S"] } }));
  fs.writeFileSync(path.join(ns, "graders", "index.mjs"), `import fs from "node:fs"; import path from "node:path";
export async function gradeComponents() {
  let wrote = false; try { fs.writeFileSync(path.join(process.env.OE_OUTSIDE, "pwn"), "x"); wrote = true; } catch {}
  return { E: fs.existsSync(path.join(process.env.OE_REAL_HOME, ".claude")) ? 0 : 1, S: wrote ? 0 : 1 };
}
`);
  const dir = tmp("oe-comp-");
  Object.assign(process.env, { OE_REAL_HOME: os.homedir(), OE_OUTSIDE: outside });
  try {
    const r = await oe.gradeComponentsFor(dir, "t", { northstar: ns, sandbox: { workRoot: tmp("oe-cw-") } });
    assert.deepEqual(r.components, { E: 1, S: 1 }, JSON.stringify(r));
    assert.deepEqual(fs.readdirSync(outside), []);
  } finally { for (const k of ["OE_REAL_HOME", "OE_OUTSIDE"]) delete process.env[k]; }
});

test("run-level directories outside /tmp and the home are hidden; only the job's own dir is bound", { skip: !bwrapOk }, () => {
  let base;
  try { base = fs.mkdtempSync("/var/tmp/oe-hide-"); } catch { return; }
  try {
    fs.mkdirSync(path.join(base, "kept")); fs.writeFileSync(path.join(base, "kept", "artifact.txt"), "SECRET");
    fs.mkdirSync(path.join(base, "run", "other-job"), { recursive: true }); fs.writeFileSync(path.join(base, "run", "other-job", "f.txt"), "SIBLING");
    const dir = path.join(base, "run", "job"); fs.mkdirSync(dir);
    const w = oe.builderWrap(dir, { credentials: creds(), workRoot: tmp("oe-hw-"), hideRoots: [base] });
    const iHide = w.argv.findIndex((a, i) => a === "--tmpfs" && w.argv[i + 1] === base), iBind = w.argv.findIndex((a, i) => a === "--bind" && w.argv[i + 1] === dir);
    assert.ok(iHide > 0 && iBind > iHide, "the run root is emptied before the job dir is bound back");
    const r = spawnSync(w.argv[0], [...w.argv.slice(1), "sh", "-c", 'cat "$B/kept/artifact.txt" "$B/run/other-job/f.txt" 2>/dev/null; touch "$D/mine" && echo job-ok'], { env: { ...process.env, ...w.env, B: base, D: dir }, encoding: "utf8" });
    assert.ok(!/SECRET|SIBLING/.test(r.stdout), r.stdout);
    assert.match(r.stdout, /job-ok/);
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test("foreign agent CLIs are unavailable inside the sandbox; claude still runs", { skip: !bwrapOk }, () => {
  const bin = tmp("oe-fbin-");
  for (const n of oe.FOREIGN_CLIS) fs.writeFileSync(path.join(bin, n), "#!/bin/sh\necho REAL\n", { mode: 0o755 });
  assert.deepEqual(oe.foreignCliMasks(bin).map((f) => path.basename(f)).sort(), [...oe.FOREIGN_CLIS].sort());
  assert.deepEqual(oe.foreignCliMasks(bin, { hidden: () => true }), []);
  const dir = tmp("oe-fc-");
  const saved = process.env.PATH;
  try {
    process.env.PATH = `${bin}${path.delimiter}${saved}`;
    const w = oe.builderWrap(dir, { credentials: creds(), workRoot: tmp("oe-fw-") });
    assert.equal(w.foreign_cli, "blocked");
    for (const n of oe.FOREIGN_CLIS) {
      const r = spawnSync(w.argv[0], [...w.argv.slice(1), "sh", "-c", `${n} --version`], { env: { ...process.env, ...w.env }, encoding: "utf8" });
      assert.notEqual(r.status, 0, n);
      assert.ok(!r.stdout.includes("REAL"), n);
      assert.match(r.stderr, /blocked/, n);
    }
  } finally { process.env.PATH = saved; }
  const claude = spawnSync("sh", ["-c", "command -v claude"], { encoding: "utf8" }).stdout.trim();
  if (claude && !claude.startsWith(os.tmpdir())) {
    const w = oe.builderWrap(dir, { credentials: creds(), workRoot: tmp("oe-fw-") });
    const r = spawnSync(w.argv[0], [...w.argv.slice(1), "claude", "--version"], { env: { ...process.env, ...w.env }, encoding: "utf8" });
    assert.match(r.stdout, /Claude Code/, "the real claude binary starts in the sandbox");
  }
});

test("a fail-open rerun keeps the first attempt's off-model rejection and judges the combined usage", async () => {
  const run = (a, b, model = "haiku") => oe.withFailOpenRerun(async (n) => ({ ...(n === 1 ? a : b) }), { model });
  let r = await run({ fail_open: 1, error: "off-model work: claude-opus-5-5", model_usage: { "claude-haiku-5-5": { outputTokens: 100 }, "claude-opus-5-5": { outputTokens: 4000 } } }, { fail_open: 0, model_usage: { "claude-haiku-5-5": { outputTokens: 90000 } } });
  assert.match(r.error, /^off-model work/, "a clean second attempt does not forgive it");
  r = await run({ fail_open: 1, model_usage: { "claude-haiku-5-5": { outputTokens: 20000 }, "claude-opus-5-5": { outputTokens: 900 } } }, { fail_open: 0, model_usage: { "claude-haiku-5-5": { outputTokens: 100 }, "claude-opus-5-5": { outputTokens: 900 } } });
  assert.equal(r.error, "off-model work: claude-opus-5-5", "combined 1800 tokens over 5% of 21100");
  r = await run({ fail_open: 1, model_usage: { "claude-haiku-5-5": { outputTokens: 20000 }, "claude-opus-5-5": { outputTokens: 300 } } }, { fail_open: 0, model_usage: { "claude-haiku-5-5": { outputTokens: 20000 } } });
  assert.equal(r.error, undefined);
});

function transcript(file, records) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, records.map((x) => JSON.stringify(x)).join("\n") + "\n"); }
const msg = (sessionId, id, model, usage) => ({ type: "assistant", sessionId, message: { id, model, usage } });

test("nested sessions are read from the job home's transcripts and priced from the repo table", () => {
  const home = tmp("oe-tx-");
  const proj = path.join(home, ".claude", "projects", "p");
  transcript(path.join(proj, "outer.jsonl"), [msg("outer", "a", "claude-haiku-5-5", { input_tokens: 1, output_tokens: 1000 })]);
  transcript(path.join(proj, "outer", "subagents", "agent-1.jsonl"), [msg("outer", "s1", "claude-haiku-5-5", { input_tokens: 1, output_tokens: 1000 })]);
  const dup = msg("nested", "n1", "claude-opus-5-5", { input_tokens: 100, output_tokens: 2000, cache_read_input_tokens: 1000, cache_creation_input_tokens: 200 });
  transcript(path.join(proj, "nested.jsonl"), [msg("nested", "n1", "claude-opus-5-5", { input_tokens: 100, output_tokens: 10 }), dup, dup, msg("nested", "n2", "<synthetic>", { output_tokens: 99999 })]);
  transcript(path.join(proj, "killed.jsonl"), [msg("killed", "k1", "claude-haiku-5-5", { input_tokens: 0, output_tokens: 500 }), msg("killed", "k2", "weird-model", { output_tokens: 10 })]);
  const n = oe.nestedUsage(home, new Set(["outer"]));
  assert.equal(n.sessions, 2);
  assert.equal(n.model_usage["claude-opus-5-5"].outputTokens, 2000, "de-duplicated by message id, last record wins");
  assert.equal(n.model_usage["claude-haiku-5-5"].outputTokens, 500, "the outer session and its subagents are excluded");
  assert.deepEqual(n.unpriced, ["weird-model"]);
  // opus: 20 USD/Mtok out; input 4; cache read 0.4; cache write 5
  const opus = 2000 * 20e-6 + 100 * 4e-6 + 1000 * 0.4e-6 + 200 * 5e-6;
  assert.ok(Math.abs(n.model_usage["claude-opus-5-5"].costUSD - opus) < 1e-6, String(n.model_usage["claude-opus-5-5"].costUSD));
  const all = oe.nestedUsage(home, new Set());
  assert.equal(all.sessions, 3, "with no known outer session (a killed step) everything counts");
  assert.equal(oe.nestedUsage(tmp("oe-empty-"), new Set()).usd, 0);
});

test("spend by a nested claude -p is added to cost_usd and judged for off-model work", { skip: !bwrapOk }, () => {
  const tr = taskRootWith("tiny");
  let { result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"], { extraEnv: { FAKE_NESTED: "haiku" } });
  let row = result.rows[0];
  assert.equal(row.error, undefined, JSON.stringify(row));
  assert.equal(row.nested_sessions, 1, "the outer session's own transcript is not counted");
  assert.ok(Math.abs(row.nested_cost_usd - 0.000195) < 1e-9, String(row.nested_cost_usd));
  assert.ok(Math.abs(row.cost_usd - (0.02 + row.nested_cost_usd)) < 1e-9);
  assert.equal(row.outer_cost_usd, 0.02);
  assert.equal(row.model_usage["claude-haiku-5-5"].outputTokens, 2300);
  ({ result } = runEval(["--arms", "solo", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1"], { extraEnv: { FAKE_NESTED: "opus" } }));
  row = result.rows[0];
  assert.equal(row.error, "off-model work: claude-opus-5-5");
  assert.ok(row.nested_cost_usd > 0.1);
});

test("a killed run keeps the accounting its JSON carried", async () => {
  const bin = tmp("oe-slowjson-");
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh\ncat >/dev/null\nprintf '{"session_id":"s1","total_cost_usd":0.5,"num_turns":9,"duration_ms":77,"modelUsage":{"claude-haiku-5-5":{"outputTokens":3}}}'\nsleep 5\n`, { mode: 0o755 });
  const saved = process.env.PATH;
  try {
    process.env.PATH = `${bin}${path.delimiter}${saved}`;
    const r = await oe.runAgent(tmp("oe-to2-"), "p", "haiku", 1500, undefined, 3);
    assert.equal(r.stopped_by, "timeout");
    assert.match(r.error, /^timeout/);
    assert.deepEqual([r.cost_usd, r.turns, r.duration_ms, r.session_id], [0.5, 9, 77, "s1"]);
    assert.equal(r.model_usage["claude-haiku-5-5"].outputTokens, 3);
  } finally { process.env.PATH = saved; }
});

test("summarize and promote do not read option values as result files", () => {
  assert.deepEqual(oe.positionalArgs(["a.json", "--candidate", "x", "b.json", "--tasks-root", "/r", "--flag"]), ["a.json", "b.json"]);
  const d = tmp("oe-sum-");
  const f = path.join(d, "r.json");
  fs.writeFileSync(f, JSON.stringify({ rows: [{ task: "t", arm: "plain", rep: 0, solved: true, score: 1, cost_usd: 1, turns: 1 }, { task: "t", arm: "x", rep: 0, solved: true, score: 1, cost_usd: 1, turns: 1 }] }));
  const sum = spawnSync(process.execPath, [script, "summarize", "--tasks-root", d, f], { encoding: "utf8" });
  assert.equal(sum.status, 0, sum.stderr);
  assert.equal(JSON.parse(sum.stdout).runs, 2);
  const pro = spawnSync(process.execPath, [script, "promote", "--candidate", "x", "--baseline", "plain", "--tasks-root", d, f], { encoding: "utf8" });
  assert.equal(pro.status, 0, pro.stderr);
  assert.equal(JSON.parse(pro.stdout).promote, false);
});
