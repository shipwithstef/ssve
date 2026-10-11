// @organism-suite
// The eval's reviewer relay: the framework arm's `codex` shim reaches the runner's real codex
// (here a fake on PATH) over a unix socket. No real Codex, no model: a fake `codex` script logs
// its argv and answers. Covers argv vetting (write flags refused, read-only forced), the cwd
// fence, the call cap and timeout, usage parsing and pricing, the row/watchdog accounting, and
// the sandbox path (bwrap tests skip cleanly without bubblewrap).
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn, spawnSync } from "node:child_process";
import { test } from "node:test";
import * as oe from "../../scripts/outcome-eval.mjs";
import * as relay from "../../scripts/lib/review-relay.mjs";
import { checkJourney } from "../../scripts/lib/journey-conformance.mjs";
import { buildCodexExecArgs, buildPromptInspectArgv } from "../../scripts/lib/isolated-plan-analysis.mjs";
import { outputSchemaForCall, PLANNING_ROLES } from "../../scripts/lib/two-box-protocol.mjs";

const bwrapOk = oe.hasBwrap();
const tmp = (p = "rr-") => fs.mkdtempSync(path.join(os.tmpdir(), p));

// The one output schema the fake framework passes. The relay accepts exec only with a schema
// whose hash it was given (the runner computes the real list from the framework source).
const SCHEMA_TEXT = '{"type":"object"}\n';
const SCHEMA = path.join(tmp("rr-schema-"), "schema.json");
fs.writeFileSync(SCHEMA, SCHEMA_TEXT);
const SCHEMA_HASH = relay.sha256Hex(Buffer.from(SCHEMA_TEXT));
const ex = (...rest) => ["exec", "--output-schema", SCHEMA, ...rest];
// A runner CODEX_HOME with a login and the state a reviewer must never see.
const runnerCodexHome = () => { const d = tmp("rr-codexhome-"); fs.writeFileSync(path.join(d, "auth.json"), '{"tok":"x"}'); fs.mkdirSync(path.join(d, "sessions")); fs.writeFileSync(path.join(d, "sessions", "other-job.jsonl"), "SECRET-CONVERSATION"); fs.writeFileSync(path.join(d, "history.jsonl"), "HIST"); return d; };

// A fake codex. `--version` prints a version. Otherwise it appends its argv (one line) to
// $FAKE_LOG, copies the --output-schema file, writes --output-last-message, echoes stdin, prints
// a turn.completed usage event, and exits with the code in a "EXIT n" stdin line (0 by default);
// "SLEEP" in stdin hangs, "CWD" prints the working directory.
function fakeCodex(binDir, logFile) {
  const f = path.join(binDir, "codex");
  fs.writeFileSync(f, `#!/bin/sh
for a in "$@"; do case "$a" in --version|-V) echo "codex-cli 0.0.0-fake"; exit 0;; esac; done
echo "$*" >> "${logFile}"
last=""; schema=""; prev=""
for a in "$@"; do
  [ "$prev" = "--output-last-message" ] && last="$a"
  [ "$prev" = "--output-schema" ] && schema="$a"
  prev="$a"
done
in=$(cat)
case "$in" in *SLEEP*) sleep 30;; esac
[ -n "$schema" ] && echo "schema-bytes=$(wc -c < "$schema")"
case "$in" in *CWD*) echo "cwd=$(pwd -P)";; esac
case "$in" in *LS*) echo "ls=[$(ls -A | tr '\\n' ' ')]";; esac
echo "stdin=$in" | head -c 200
[ -n "$last" ] && printf '{"findings":[]}' > "$last"
case "$in" in *BIG*) head -c 3000000 /dev/zero | tr '\\0' 'x'; echo;; esac
case "$in" in *BIGLAST*) head -c 700000 /dev/zero | tr '\\0' 'y' > "$last";; esac
case "$in" in *WORKLS*) echo "repo=[$(ls -A "$FAKE_REPO" 2>/dev/null | tr '\\n' ' ')]";; esac
case "$in" in *CODEXHOME*) echo "codexhome=[$(ls -A "$CODEX_HOME" | tr '\\n' ' ')]";; esac
case "$in" in *NOUSAGE*) ;; *) echo '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":400,"output_tokens":'"\${FAKE_OUT:-200}"',"reasoning_output_tokens":50}}';; esac
echo "fake-stderr" >&2
code=$(printf '%s' "$in" | sed -n 's/^EXIT \\([0-9]*\\).*/\\1/p' | head -1)
exit "\${code:-0}"
`, { mode: 0o755 });
  return f;
}

async function setup({ maxCalls, callTimeoutMs, price = (id, u) => oe.priceReviewerUsage(id || "unknown", u), deadlineAt = null, ...extra } = {}) {
  const base = tmp("rr-base-");
  const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  const log = path.join(base, "calls.log");
  fakeCodex(bin, log);
  const jobHome = path.join(base, "home"); fs.mkdirSync(jobHome, { mode: 0o700 });
  const buildDir = path.join(base, "build"); fs.mkdirSync(buildDir);
  const r = await relay.startRelay({ jobHome, buildDir, pathEnv: bin, maxCalls, callTimeoutMs, price, deadlineAt, allowedSchemaHashes: [SCHEMA_HASH], codexHomeFrom: runnerCodexHome(), ...extra });
  return { base, bin, log, jobHome, buildDir, r, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean) : []) };
}

// Run the real client against a relay socket from a host cwd.
function client(sock, args, { cwd, input = "" } = {}) {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [relay.CLIENT_SOURCE, ...args], { cwd, env: { ...process.env, OE_RELAY_SOCK: sock }, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    c.stdout.on("data", (d) => { out += d; }); c.stderr.on("data", (d) => { err += d; });
    c.on("close", (code) => resolve({ code, out, err }));
    c.stdin.end(input);
  });
}

const LAUNCHER = (last, schema) => ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "--ephemeral", "--ignore-user-config", "--ignore-rules", "--strict-config", "--model", "gpt-5.6-sol", "-c", 'model_reasoning_effort="high"', "--output-schema", schema, "--json", "--output-last-message", last, "--color", "never", "-"];

// ---- argv vetting ---------------------------------------------------------------------

test("vet: the launcher's own codex argv is accepted as it is, read-only stays read-only", () => {
  const v = relay.vetCodexArgv(LAUNCHER("/tmp/x/last.json", "/s/schema.json"));
  assert.equal(v.ok, true, v.reason);
  assert.equal(v.info, false);
  assert.equal(v.model, "gpt-5.6-sol");
  assert.equal(v.last, "/tmp/x/last.json");
  assert.equal(v.schema, "/s/schema.json");
  assert.equal(v.args[0], "exec");
  assert.equal(v.args.filter((a) => a === "-s").length, 1);
  assert.equal(v.args[v.args.indexOf("-s") + 1], "read-only");
});

test("vet: no -s given means -s read-only is added", () => {
  const v = relay.vetCodexArgv(["exec", "--output-schema", "/s.json", "--json", "-"]);
  assert.equal(v.ok, true, v.reason);
  assert.deepEqual(v.args, ["exec", "-s", "read-only", "--output-schema", "/s.json", "--json", "-"]);
});

test("vet: write and danger flags, a writable sandbox and sandbox-changing config are refused", () => {
  const bad = [
    ["exec", "--dangerously-bypass-approvals-and-sandbox", "-"],
    ["exec", "--full-auto", "-"],
    ["exec", "-s", "workspace-write", "-"],
    ["exec", "--sandbox=danger-full-access", "-"],
    ["exec", "--sandbox", "workspace-write", "-"],
    ["exec", "--approve-for-me", "-"],
    ["exec", "--add-dir", "/tmp", "-"],
    ["exec", "-c", 'sandbox_mode="danger-full-access"', "-"],
    ["exec", "-c", "approval_policy=never", "-"],
    ["exec", "-c", "shell_environment_policy.inherit=all", "-"],
    ["exec", "-p", "mine", "-"],
    ["exec", "resume", "--last"],
    ["exec", "review"],
    ["exec", "--oss", "-"],
    ["exec", "a prompt", "second prompt"],
    ["login"],
    ["apply", "x"],
    [],
  ];
  for (const argv of bad) assert.equal(relay.vetCodexArgv(argv).ok, false, JSON.stringify(argv));
  assert.match(relay.vetCodexArgv(["exec", "-s", "workspace-write", "-"]).reason, /read-only/);
  assert.match(relay.vetCodexArgv(["exec", "--full-auto", "-"]).reason, /write\/danger/);
});

test("vet: --help and --version probes pass through, with or without exec", () => {
  for (const argv of [["--version"], ["-V"], ["--help"], ["exec", "--help"], ["exec", "-h"], ["exec", "--sandbox", "read-only", "--ephemeral", "--version"]]) {
    const v = relay.vetCodexArgv(argv);
    assert.equal(v.ok, true, JSON.stringify(argv));
    assert.equal(v.info, true, JSON.stringify(argv));
  }
});

test("sanitized argv keeps flags and drops prompt text", () => {
  const s = relay.sanitizeArgv(["exec", "--json", "x".repeat(500)]);
  assert.deepEqual(s.slice(0, 2), ["exec", "--json"]);
  assert.match(s[2], /^<500 chars>$/);
});

// ---- usage -----------------------------------------------------------------------------

test("usage: turn.completed events are summed, pricing treats cached input separately", () => {
  const u = relay.parseCodexUsage([
    '{"type":"thread.started","thread_id":"t"}',
    '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":400,"output_tokens":200,"reasoning_output_tokens":50}}',
    "not json",
    '{"type":"turn.completed","usage":{"input_tokens":10,"cached_input_tokens":0,"cache_write_input_tokens":3,"output_tokens":5}}',
  ]);
  assert.equal(u.input_tokens, 1010); assert.equal(u.cached_input_tokens, 400); assert.equal(u.output_tokens, 205);
  assert.deepEqual(relay.usageForPricing(u), { inputTokens: 610, cacheReadInputTokens: 400, outputTokens: 205, cacheCreationInputTokens: 3 });
  assert.equal(relay.parseCodexUsage(["no usage here"]), null);
  assert.equal(relay.parseCodexUsage([]), null);
});

// ---- the relay over its socket ---------------------------------------------------------

test("relay: the client reaches the fake codex, streams stdout and stderr, relays the exit code, writes the last-message file and sends the schema", async () => {
  const s = await setup();
  try {
    const out = path.join(tmp("rr-out-"), "deep", "last.json");
    const res = await client(s.r.socketPath, LAUNCHER(out, SCHEMA), { cwd: s.buildDir, input: "hello\nEXIT 3\n" });
    assert.equal(res.code, 3, res.err);
    assert.match(res.out, /stdin=hello/);
    assert.match(res.out, /schema-bytes=18/, "the schema file contents travelled with the call");
    assert.match(res.out, /"type":"turn.completed"/);
    assert.match(res.err, /fake-stderr/);
    assert.equal(fs.readFileSync(out, "utf8"), '{"findings":[]}', "the client wrote the file codex wrote for the server");
    const [call] = s.calls();
    assert.match(call, /^exec .*-s read-only /);
    assert.equal(call.split(" -s ").length, 2, "one -s, read-only");
    assert.doesNotMatch(call, new RegExp(path.dirname(out).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "codex got a scratch path, not the sandbox path");
    const sum = s.r.summary();
    assert.equal(sum.reviewer_calls.length, 1);
    assert.equal(sum.reviewer_calls[0].exit, 3);
    assert.ok(sum.reviewer_calls[0].wall_ms >= 0);
    assert.equal(sum.reviewer_calls[0].usage.output_tokens, 200);
    assert.deepEqual(sum.reviewer_calls[0].argv_sanitized.slice(0, 1), ["exec"]);
  } finally { await s.r.close(); }
});

test("relay: write flags are rejected before the real codex runs; a missing -s is forced to read-only", async () => {
  const s = await setup();
  try {
    for (const args of [["exec", "--dangerously-bypass-approvals-and-sandbox", "-"], ["exec", "-s", "workspace-write", "-"], ["exec", "--full-auto", "-"]]) {
      const res = await client(s.r.socketPath, args, { cwd: s.buildDir, input: "x" });
      assert.equal(res.code, 126, res.err);
      assert.match(res.err, /refused|read-only/);
    }
    assert.deepEqual(s.calls(), [], "the fake was never run for a refused call");
    const ok = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "x" });
    assert.equal(ok.code, 0, ok.err);
    assert.match(s.calls()[0], /^exec -s read-only --output-schema \S+ --json -/);
    const rejected = s.r.calls().filter((c) => c.rejected);
    assert.equal(rejected.length, 3);
    assert.equal(s.r.execCalls(), 1, "refused calls do not use the cap");
  } finally { await s.r.close(); }
});

test("relay: a working directory outside the build dir, job home and neutral /tmp is refused; -C is held to the same fence; probes still run anywhere", async () => {
  const s = await setup();
  try {
    const outside = fs.realpathSync("/etc");
    const bad = await client(s.r.socketPath, ex("--json", "-"), { cwd: outside, input: "CWD" });
    assert.equal(bad.code, 126);
    assert.match(bad.err, /outside the job/);
    const badC = await client(s.r.socketPath, ex("-C", outside, "--json", "-"), { cwd: s.buildDir, input: "CWD" });
    assert.equal(badC.code, 126);
    assert.match(badC.err, /-C .* outside the job/);
    assert.deepEqual(s.calls(), []);
    // a symlink inside the build dir that points outside does not get around the fence
    fs.symlinkSync(outside, path.join(s.buildDir, "escape"));
    const link = await client(s.r.socketPath, ex("--json", "-"), { cwd: path.join(s.buildDir, "escape"), input: "CWD" });
    assert.equal(link.code, 126);
    const good = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "CWD" });
    assert.equal(good.code, 0, good.err);
    assert.match(good.out, new RegExp(`cwd=${fs.realpathSync(s.buildDir)}`));
    const probe = await client(s.r.socketPath, ["--version"], { cwd: outside });
    assert.equal(probe.code, 0);
    assert.match(probe.out, /codex-cli 0.0.0-fake/);
  } finally { await s.r.close(); }
});

test("relay: a neutral cwd in the sandbox /tmp gets a fresh EMPTY host directory per call, never the host path", async () => {
  const s = await setup();
  try {
    const hostDir = tmp("rr-neutral-");   // exists on the host with content, like a same-named path would
    fs.writeFileSync(path.join(hostDir, "host-secret.txt"), "HOST");
    const one = await client(s.r.socketPath, ex("--json", "-"), { cwd: hostDir, input: "CWD LS" });
    assert.equal(one.code, 0, one.err);
    assert.match(one.out, /ls=\[\]/, "the neutral directory is empty");
    const cwd1 = /cwd=(\S+)/.exec(one.out)[1];
    assert.notEqual(cwd1, fs.realpathSync(hostDir));
    assert.equal(fs.existsSync(cwd1), false, "the per-call directory is removed afterwards");
    const two = await client(s.r.socketPath, ex("-C", hostDir, "--json", "-"), { cwd: s.buildDir, input: "CWD LS" });
    assert.equal(two.code, 0, two.err);
    assert.match(two.out, /ls=\[\]/);
    assert.notEqual(/cwd=(\S+)/.exec(two.out)[1], cwd1, "a fresh directory per call");
    // the build dir still maps to itself, and a path outside /tmp stays refused
    const build = await client(s.r.socketPath, ex("-C", s.buildDir, "--json", "-"), { cwd: s.buildDir, input: "CWD" });
    assert.match(build.out, new RegExp(`cwd=${fs.realpathSync(s.buildDir)}`));
    for (const bad of ["/etc", os.homedir()]) {
      const res = await client(s.r.socketPath, ex("--json", "-"), { cwd: bad, input: "CWD" });
      assert.equal(res.code, 126, bad);
    }
    assert.equal(relay.isNeutralSandboxDir("/tmp", { buildDir: "/b" }), false);
    assert.equal(relay.isNeutralSandboxDir("/tmp/oe-home/x", { buildDir: "/b" }), false);
    assert.equal(relay.isNeutralSandboxDir("/tmp/ssve-openbox-preflight-1", { buildDir: "/b" }), true);
    assert.equal(relay.isNeutralSandboxDir("relative", { buildDir: "/b" }), false);
  } finally { await s.r.close(); }
});

test("relay: the per-job call cap stops exec calls past it, probes and refused calls do not count", async () => {
  const s = await setup({ maxCalls: 2 });
  try {
    for (let i = 0; i < 2; i++) assert.equal((await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "x" })).code, 0);
    for (let i = 0; i < 3; i++) assert.equal((await client(s.r.socketPath, ["--version"], { cwd: s.buildDir })).code, 0);
    const third = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "x" });
    assert.equal(third.code, 126);
    assert.match(third.err, /call cap reached \(2 per job\)/);
    assert.equal(s.calls().length, 2);
  } finally { await s.r.close(); }
});

test("relay: a call past its timeout is stopped (exit 124) and its process group dies", async () => {
  const s = await setup({ callTimeoutMs: 400 });
  try {
    const t0 = Date.now();
    const res = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "SLEEP" });
    assert.equal(res.code, 124, res.err);
    assert.match(res.err, /exceeded its/);
    assert.ok(Date.now() - t0 < 10000);
    const c = s.r.calls()[0];
    assert.equal(c.timed_out, true);
    assert.equal(c.exit, 124);
  } finally { await s.r.close(); }
});

test("relay: no exec call starts once the job's time is spent", async () => {
  const s = await setup({ deadlineAt: Date.now() - 1 });
  try {
    const res = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "x" });
    assert.equal(res.code, 126);
    assert.match(res.err, /time is spent/);
  } finally { await s.r.close(); }
});

test("relay: reviewer cost is priced from the reviewer rate table (an estimate), summed, and recorded under the Codex model in model_usage", async () => {
  const s = await setup();
  try {
    await client(s.r.socketPath, ex("--json", "-m", "gpt-5.6-sol", "-"), { cwd: s.buildDir, input: "x" });
    await client(s.r.socketPath, ex("--json", "-m", "gpt-5.6-sol", "-"), { cwd: s.buildDir, input: "x" });
    const expectOne = oe.priceReviewerUsage("gpt-5.6-sol", { inputTokens: 600, cacheReadInputTokens: 400, outputTokens: 200 }).usd;
    assert.ok(expectOne > 0);
    assert.notEqual(expectOne, oe.priceUsage("gpt-5.6-sol", { inputTokens: 600, cacheReadInputTokens: 400, outputTokens: 200 }).usd, "not the Anthropic table's guess");
    const sum = s.r.summary();
    assert.ok(Math.abs(sum.reviewer_cost_usd - 2 * expectOne) < 1e-5, `${sum.reviewer_cost_usd} vs ${2 * expectOne}`);
    assert.equal(sum.reviewer_cost_basis, "estimate");
    assert.equal(sum.reviewer_accounting, "measured");
    assert.equal(sum.reviewer_unpriced_calls, 0);
    assert.ok(Math.abs(s.r.costUsd() - sum.reviewer_cost_usd) < 1e-9);
    assert.equal(sum.reviewer_calls[0].priced.known, false, "a model the rate table does not list is priced at its fallback and flagged");
    assert.equal(sum.reviewer_calls[0].priced.basis, "estimate");
    const mu = sum.reviewer_model_usage["gpt-5.6-sol"];
    assert.deepEqual([mu.inputTokens, mu.cacheReadInputTokens, mu.outputTokens], [1200, 800, 400]);
    assert.ok(Math.abs(mu.costUSD - sum.reviewer_cost_usd) < 1e-9);
  } finally { await s.r.close(); }
});

test("reviewer rates: a listed model is known, an unlisted one uses the fallback ceiling; both are estimates", () => {
  const table = { models: { "m-1": { input_per_m: 1, cached_input_per_m: 0.1, output_per_m: 2 } }, fallback: { input_per_m: 5, cached_input_per_m: 0.5, output_per_m: 30 } };
  const u = { inputTokens: 1e6, cacheReadInputTokens: 1e6, outputTokens: 1e6 };
  const a = oe.priceReviewerUsage("m-1", u, table), b = oe.priceReviewerUsage("other", u, table);
  assert.ok(Math.abs(a.usd - 3.1) < 1e-9); assert.equal(a.known, true);
  assert.ok(Math.abs(b.usd - 35.5) < 1e-9); assert.equal(b.known, false);
  assert.equal(a.basis, "estimate");
  const shipped = oe.reviewerRates("anything");
  assert.ok(shipped.output > 0 && shipped.known === false);
});

test("relay: startRelay without a codex on the PATH fails loudly", async () => {
  const jobHome = tmp("rr-nc-"); const buildDir = tmp("rr-ncb-");
  await assert.rejects(relay.startRelay({ jobHome, buildDir, pathEnv: tmp("rr-empty-") }), /no codex binary/);
});

test("relay: the call runs without SVC_* variables from the runner", async () => {
  const base = tmp("rr-env-"); const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "codex"), '#!/bin/sh\ncat >/dev/null\necho "svc=[$SVC_ROOT] keep=[$RR_KEEP]"\n', { mode: 0o755 });
  const jobHome = path.join(base, "h"); fs.mkdirSync(jobHome); const buildDir = path.join(base, "b"); fs.mkdirSync(buildDir);
  process.env.SVC_ROOT = "/leak"; process.env.RR_KEEP = "yes";
  const r = await relay.startRelay({ jobHome, buildDir, pathEnv: bin, allowedSchemaHashes: [SCHEMA_HASH], codexHomeFrom: runnerCodexHome() });
  try {
    const res = await client(r.socketPath, ex("--json", "-"), { cwd: buildDir, input: "" });
    assert.match(res.out, /svc=\[\] keep=\[yes\]/);
  } finally { delete process.env.SVC_ROOT; delete process.env.RR_KEEP; await r.close(); }
});

// ---- accounting in the runner ---------------------------------------------------------

test("the spend watchdog counts relayed reviewer spend (extraUsd) against the run cap and the 3x ceiling", async () => {
  const bin = tmp("rr-wd-"); fs.writeFileSync(path.join(bin, "claude"), "#!/bin/sh\ncat >/dev/null\nsleep 60 &\nwait\n", { mode: 0o755 });
  const saved = process.env.PATH;
  process.env.PATH = `${bin}${path.delimiter}${saved}`;
  try {
    const budget = new oe.Budget(1, 1, 0.01, 0);
    const claim = budget.claim();
    let spend = 0;
    const t = setTimeout(() => { spend = 1.4; }, 150);
    const row = await oe.runAgent(tmp("rr-wd-w-"), "p", "haiku", 8000, undefined, 3, null, [], null, { budget, key: "r", claimUsd: claim.usd, home: tmp("rr-wd-h-"), intervalMs: 40, extraUsd: () => spend });
    clearTimeout(t);
    assert.equal(row.stopped_by, "run-budget", JSON.stringify(row));
  } finally { process.env.PATH = saved; }
});

test("withFailOpenRerun keeps both attempts' reviewer calls and sums the reviewer cost", async () => {
  let n = 0;
  const row = await oe.withFailOpenRerun(async () => {
    n++;
    return n === 1 ? { cost_usd: 0.5, fail_open: 2, reviewer_calls: [{ exit: 0 }], reviewer_cost_usd: 0.1, reviewer_wall_ms: 5, reviewer_unpriced_calls: 0 }
      : { cost_usd: 0.4, fail_open: 0, reviewer_calls: [{ exit: 0 }, { exit: 1 }], reviewer_cost_usd: 0.2, reviewer_wall_ms: 7, reviewer_unpriced_calls: 1 };
  });
  assert.equal(row.reviewer_calls.length, 3);
  assert.ok(Math.abs(row.reviewer_cost_usd - 0.3) < 1e-9);
  assert.equal(row.reviewer_wall_ms, 12);
  assert.equal(row.reviewer_unpriced_calls, 1);
  assert.ok(Math.abs(row.cost_usd - 0.9) < 1e-9);
});

// ---- confinement argv (pure) -----------------------------------------------------------

test("reviewer confinement: ro root, answer trees and other jobs hidden, build dir and job home read-only, only CODEX_HOME and scratch writable", () => {
  const base = fs.realpathSync(tmp("rr-conf-"));
  const work = path.join(base, "work"), dir = path.join(work, "b"), jobHome = path.join(work, "h"), codex = path.join(base, "isolated"), real = path.join(base, "home", ".codex");
  for (const d of [dir, jobHome, codex, path.join(base, "home", ".svc"), path.join(base, "home", ".ssh"), path.join(real, "sessions"), path.join(real, "packages")]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(real, "history.jsonl"), "h"); fs.writeFileSync(path.join(real, "auth.json"), "a");
  const f = oe.reviewerConfinement({ dir, jobHome, workRoot: work, realHome: path.join(base, "home"), realCodexHome: real });
  const a = f({ cwd: dir, scratch: "/scratch/x", codexHome: codex });
  assert.equal(a[0], "bwrap"); assert.deepEqual(a.slice(1, 4), ["--ro-bind", "/", "/"]);
  assert.equal(a[a.length - 1], "--");
  const has = (...xs) => a.some((_, i) => xs.every((x, j) => a[i + j] === x));
  assert.ok(has("--tmpfs", work), "sibling jobs are hidden");
  assert.ok(has("--tmpfs", path.join(base, "home", ".svc")));
  assert.ok(has("--tmpfs", path.join(base, "home", ".ssh")));
  // the runner's own Codex conversations, history and login are hidden; the installed binary's package dir is not
  assert.ok(has("--tmpfs", path.join(real, "sessions")));
  assert.ok(has("--ro-bind", "/dev/null", path.join(real, "history.jsonl")) && has("--ro-bind", "/dev/null", path.join(real, "auth.json")));
  assert.ok(!has("--tmpfs", path.join(real, "packages")));
  assert.ok(has("--ro-bind", dir, dir) && has("--ro-bind", jobHome, jobHome));
  assert.ok(has("--bind", codex, codex) && has("--bind", "/scratch/x", "/scratch/x"));
  assert.ok(a.indexOf("--tmpfs") < a.indexOf("--ro-bind", 4 + 3), "masks come before the binds that restore the job");
});

// ---- the sandbox path ------------------------------------------------------------------

function frameworkFixture() {
  const src = fs.realpathSync(tmp("rr-src-")), home = tmp("rr-fhome-");
  fs.mkdirSync(path.join(src, "skills", "a"), { recursive: true });
  fs.mkdirSync(path.join(home, ".claude", "skills"), { recursive: true });
  fs.symlinkSync(path.join(src, "skills", "a"), path.join(home, ".claude", "skills", "a"));
  return { home, src, checkpoint_mode: "prompt-sentence" };
}
const creds = () => { const f = path.join(tmp("rr-cred-"), "credentials.json"); fs.writeFileSync(f, '{"fake":true}'); return f; };
// Async: the relay server lives in this process, so the sandbox must not block the event loop.
const inSandbox = (w, script, env = {}) => new Promise((resolve) => {
  const c = spawn(w.argv[0], [...w.argv.slice(1), "sh", "-c", script], { env: { ...process.env, ...w.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  const t = setTimeout(() => c.kill("SIGKILL"), 60000);
  c.stdout.on("data", (d) => { stdout += d; }); c.stderr.on("data", (d) => { stderr += d; });
  c.on("close", () => { clearTimeout(t); resolve({ stdout, stderr }); });
});

test("sandbox: the framework arm's codex reaches the fake via the socket (stdin, exit code, cwd in the job home mapped); other foreign CLIs stay blocked", { skip: !bwrapOk }, async () => {
  const work = tmp("rr-sbx-"); const dir = path.join(work, "build"); fs.mkdirSync(dir);
  const base = tmp("rr-sbxb-"); const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  const log = path.join(base, "calls.log"); fakeCodex(bin, log);
  const w = oe.builderWrap(dir, { credentials: creds(), framework: frameworkFixture(), model: "haiku", workRoot: work, reviewRelay: true });
  assert.equal(w.foreign_cli, "blocked-except-codex-relay");
  const r = await relay.startRelay({ jobHome: w.job_home, buildDir: dir, pathEnv: bin, allowedSchemaHashes: [SCHEMA_HASH], codexHomeFrom: runnerCodexHome(), price: (id, u) => oe.priceReviewerUsage(id, u) });
  try {
    fs.mkdirSync(path.join(w.job_home, "wt"));
    fs.copyFileSync(SCHEMA, path.join(w.job_home, "schema.json"));
    // a launcher-shaped call from the build dir: stdin, exit code and last-message file
    const res = await inSandbox(w, `cd "$DIR" && printf 'review me\\nEXIT 4\\n' | codex exec -s read-only --json --output-schema $HOME/schema.json --output-last-message /tmp/rr-last/out.json - ; echo "code=$?"; cat /tmp/rr-last/out.json`, { DIR: dir });
    assert.match(res.stdout, /stdin=review me/, res.stderr);
    assert.match(res.stdout, /code=4/);
    assert.match(res.stdout, /\{"findings":\[\]\}/);
    // the framework worktree under the sandbox HOME maps to the job home on the host
    const wt = await inSandbox(w, 'cd "$HOME/wt" && echo CWD | codex exec --json --output-schema $HOME/schema.json -');
    assert.match(wt.stdout, new RegExp(`cwd=${fs.realpathSync(path.join(w.job_home, "wt"))}`), wt.stderr);
    // two-box style: a neutral temp dir private to the sandbox maps to an empty host dir
    const neu = await inSandbox(w, 'mkdir -p /tmp/ssve-openbox-preflight-x && cd /tmp/ssve-openbox-preflight-x && echo "CWD LS" | codex exec --json --output-schema $HOME/schema.json -');
    assert.match(neu.stdout, /ls=\[\]/, neu.stderr);
    assert.doesNotMatch(neu.stdout, /preflight-x/);
    // outside the job: refused
    const out = await inSandbox(w, "cd / && echo CWD | codex exec --json --output-schema $HOME/schema.json -; echo code=$?");
    assert.match(out.stdout, /code=126/);
    assert.match(out.stderr, /outside the job/);
    // write flags refused inside the sandbox too
    const wf = await inSandbox(w, 'cd "$DIR" && echo x | codex exec --dangerously-bypass-approvals-and-sandbox --output-schema $HOME/schema.json -; echo code=$?', { DIR: dir });
    assert.match(wf.stdout, /code=126/);
    // other foreign CLIs are still blocked
    for (const n of ["gemini", "agy", "grok", "kimi"]) {
      const b = await inSandbox(w, `${n} --version; echo code=$?`);
      assert.match(b.stdout, /code=127/, `${n}: ${b.stdout}`);
      assert.match(b.stderr, /blocked in the eval sandbox/);
    }
    assert.ok(r.summary().reviewer_calls.length >= 3);
    assert.equal(fs.statSync(w.job_home).mode & 0o777, 0o700);
  } finally { await r.close(); }
});

test("sandbox: the solo arm (and a framework arm without the relay) still gets the blocked codex shim", { skip: !bwrapOk }, async () => {
  const work = tmp("rr-solo-"); const dir = path.join(work, "build"); fs.mkdirSync(dir);
  for (const opts of [{}, { framework: frameworkFixture() }, { reviewRelay: true }]) {
    const w = oe.builderWrap(dir, { credentials: creds(), model: "haiku", workRoot: tmp("rr-sw-"), ...opts });
    assert.equal(w.foreign_cli, "blocked");
    const res = await inSandbox(w, "codex exec -; echo code=$?");
    assert.match(res.stdout, /code=127/);
    assert.match(res.stderr, /codex: blocked in the eval sandbox/);
    assert.equal(fs.existsSync(path.join(w.job_home, ".oe-shims", "codex-relay-client.mjs")), false);
  }
});

test("sandbox: with the relay's socket absent the shim says so and exits 127", { skip: !bwrapOk }, async () => {
  const work = tmp("rr-nosock-"); const dir = path.join(work, "build"); fs.mkdirSync(dir);
  const w = oe.builderWrap(dir, { credentials: creds(), framework: frameworkFixture(), model: "haiku", workRoot: work, reviewRelay: true });
  const res = await inSandbox(w, "echo x | codex exec -; echo code=$?");
  assert.match(res.stdout, /code=127/);
  assert.match(res.stderr, /relay unavailable/);
});

test("confinement at run time: the reviewer sees the build dir read-only and not a sibling job's directory", { skip: !bwrapOk }, async () => {
  const base = fs.realpathSync(tmp("rr-cf-")); const work = path.join(base, "work");
  const dir = path.join(work, "build"), sibling = path.join(work, "other-job"), jobHome = path.join(work, "home");
  for (const d of [dir, sibling, jobHome]) fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(sibling, "secret.txt"), "OTHER-JOB-SECRET");
  fs.writeFileSync(path.join(dir, "mine.txt"), "BUILD-FILE");
  const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh
cat >/dev/null
echo "sibling=$(cat "${sibling}/secret.txt" 2>/dev/null)"
echo "mine=$(cat mine.txt)"
touch new.txt 2>/dev/null && echo wrote || echo readonly
`, { mode: 0o755 });
  const r = await relay.startRelay({ jobHome, buildDir: dir, pathEnv: bin, allowedSchemaHashes: [SCHEMA_HASH], codexHomeFrom: runnerCodexHome(), confine: oe.reviewerConfinement({ dir, jobHome, workRoot: work, realHome: path.join(base, "nohome"), realCodexHome: path.join(base, "nocodex") }) });
  try {
    const res = await client(r.socketPath, ex("--json", "-"), { cwd: dir, input: "x" });
    assert.equal(res.code, 0, res.err);
    assert.match(res.out, /sibling=\n/, "the sibling job's file is not visible to the reviewer");
    assert.match(res.out, /mine=BUILD-FILE/);
    assert.match(res.out, /readonly/);
    assert.equal(fs.existsSync(path.join(dir, "new.txt")), false);
  } finally { await r.close(); }
});

function miniFramework() {
  const repo = tmp("rr-fwrepo-");
  fs.mkdirSync(path.join(repo, "skills", "route-workflow"), { recursive: true });
  fs.writeFileSync(path.join(repo, "skills", "route-workflow", "SKILL.md"), "x");
  fs.mkdirSync(path.join(repo, "scripts", "lib"), { recursive: true });
  fs.writeFileSync(path.join(repo, "scripts", "lib", "fail-open-counter.mjs"), "export {};\n");
  fs.mkdirSync(path.join(repo, "schemas"), { recursive: true });
  fs.writeFileSync(path.join(repo, "schemas", "external-review-findings.schema.json"), SCHEMA_TEXT);
  fs.writeFileSync(path.join(repo, "setup"), '#!/bin/bash\nset -e\nD="$(cd "$(dirname "$0")" && pwd -P)"\nmkdir -p "$HOME/.claude/skills"\nfor s in "$D"/skills/*/; do ln -s "${s%/}" "$HOME/.claude/skills/$(basename "$s")"; done\necho "{}" > "$HOME/.claude/settings.json"\n', { mode: 0o755 });
  const git = (...a) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@example.invalid", ...a], { cwd: repo, encoding: "utf8" });
  git("init", "-q"); git("add", "-A"); git("commit", "-q", "-m", "mini");
  return { repo, sha: git("rev-parse", "HEAD").stdout.trim() };
}

test("end to end (fake claude + fake codex): the framework row records reviewer_calls and pays for them; the solo row has no relay and codex stays blocked", { skip: !bwrapOk }, () => {
  const tr = tmp("rr-troot-"); fs.mkdirSync(path.join(tr, "tiny"));
  fs.writeFileSync(path.join(tr, "tiny", "spec.md"), "Export add(a, b) from solution.mjs.\n");
  fs.writeFileSync(path.join(tr, "tiny", "hidden.test.mjs"), 'import test from "node:test"; import assert from "node:assert/strict"; import { add } from "./solution.mjs";\ntest("add", () => assert.equal(add(1, 2), 3));\n');
  const { repo, sha } = miniFramework();
  const base = tmp("rr-e2e-"); const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  fakeCodex(bin, path.join(base, "calls.log"));
  fs.writeFileSync(path.join(bin, "claude"), `#!/bin/sh
cat > /dev/null
echo 'export const add = (a, b) => a + b;' > solution.mjs
printf '{"type":"object"}\\n' > schema.json
printf '{"type":"string"}\\n' > other-schema.json
printf 'review this WORKLS\\n' | codex exec -s read-only --json -m gpt-5.6-sol --output-schema schema.json - > review.out 2> review.err; echo "codex=$?" > review.code
printf 'x' | codex exec --dangerously-bypass-approvals-and-sandbox --output-schema schema.json - > /dev/null 2> refused.err; echo "refused=$?" >> review.code
printf 'write me a whole program' | codex exec --json --output-schema other-schema.json - > /dev/null 2> generation.err; echo "generation=$?" >> review.code
printf 'write me a whole program' | codex exec --json - > /dev/null 2> noschema.err; echo "noschema=$?" >> review.code
gemini --version 2> gemini.err; echo "gemini=$?" >> review.code
printf '{"type":"result","subtype":"success","session_id":"s1","is_error":false,"result":"done","total_cost_usd":0.02,"num_turns":2,"duration_ms":5,"modelUsage":{"claude-haiku-5-5":{"inputTokens":10,"outputTokens":2000,"costUSD":0.01}}}'
`, { mode: 0o755 });
  const out = path.join(base, "out.json");
  // OE_RELAY_NO_CONFINE is the retired escape hatch: it must not switch confinement off.
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, OE_CREDENTIALS: creds(), OE_RELAY_NO_CONFINE: "1", FAKE_OUT: "5000", FAKE_REPO: oe_root() };
  const r = spawnSync(process.execPath, [path.join(oe_root(), "scripts", "outcome-eval.mjs"), "run", "--judge", "none", "--reps", "1", "--model", "haiku", "--keep", path.join(base, "kept"), "--work-root", path.join(base, "work"), "--out", out, "--arms", "solo,framework", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1", "--framework-sha", sha, "--framework-repo", repo, "--framework-cache", tmp("rr-cache-")], { env, encoding: "utf8", timeout: 240000 });
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(fs.readFileSync(out, "utf8")).rows;
  const fw = rows.find((x) => x.arm === "framework"), solo = rows.find((x) => x.arm === "solo");
  assert.equal(fw.error, undefined, JSON.stringify(fw));
  assert.equal(fw.reviewer_relay, "codex");
  assert.equal(fw.foreign_cli, "blocked-except-codex-relay");
  const code = fs.readFileSync(path.join(fw.artifact, "review.code"), "utf8");
  assert.match(code, /codex=0/); assert.match(code, /refused=126/); assert.match(code, /gemini=127/);
  assert.match(code, /generation=126/, "a schema that is not the framework's is refused: no free-form generation");
  assert.match(code, /noschema=126/);
  assert.match(fs.readFileSync(path.join(fw.artifact, "generation.err"), "utf8"), /not one of the framework's review or planning schemas/);
  assert.match(fs.readFileSync(path.join(fw.artifact, "review.out"), "utf8"), /repo=\[\]/, "the reviewer cannot see the live repository, whatever OE_RELAY_NO_CONFINE says");
  assert.equal(fw.reviewer_confinement, "bwrap");
  assert.equal(fw.reviewer_accounting, "measured");
  assert.equal(fw.reviewer_cost_basis, "estimate");
  // Reviewer usage is recorded under the Codex model, apart from the builder's, and is not off-model builder work.
  assert.equal(fw.model_usage["gpt-5.6-sol"].outputTokens, 5000);
  assert.equal(fw.builder_model_usage["gpt-5.6-sol"], undefined);
  assert.equal(fw.error, undefined);
  assert.match(fs.readFileSync(path.join(fw.artifact, "review.out"), "utf8"), /"type":"turn.completed"/);
  const exec = fw.reviewer_calls.filter((c) => !c.rejected && !c.probe);
  assert.equal(exec.length, 1, JSON.stringify(fw.reviewer_calls));
  assert.equal(fw.reviewer_calls.filter((c) => c.rejected).length, 3);
  const one = oe_price();
  assert.ok(Math.abs(fw.reviewer_cost_usd - one) < 1e-5, `${fw.reviewer_cost_usd} vs ${one}`);
  assert.ok(Math.abs(fw.cost_usd - (0.02 + fw.reviewer_cost_usd)) < 1e-5, `cost_usd ${fw.cost_usd} must include the reviewer`);
  assert.ok(fw.reviewer_wall_ms >= 0);
  assert.equal(solo.reviewer_calls, undefined);
  assert.equal(solo.reviewer_cost_usd, undefined);
  assert.equal(solo.foreign_cli, "blocked");
  assert.equal(solo.cost_usd, 0.02);
  assert.match(fs.readFileSync(path.join(solo.artifact, "review.code"), "utf8"), /codex=127/);
});

function oe_root() { return path.resolve(path.dirname(new URL(import.meta.url).pathname), "../.."); }
function oe_price() { return oe.priceReviewerUsage("gpt-5.6-sol", { inputTokens: 600, cacheReadInputTokens: 400, outputTokens: 5000 }).usd; }


// ---- round 2: findings from the first review --------------------------------------------

// A bare socket request, for floods that would be slow through the client process.
function rawCall(sock, req) {
  return new Promise((resolve) => {
    const c = net.createConnection(sock); let buf = Buffer.alloc(0);
    const frame = (t, b) => { const body = Buffer.from(b); const h = Buffer.alloc(5); h.write(t, 0, 1, "latin1"); h.writeUInt32BE(body.length, 1); return Buffer.concat([h, body]); };
    c.on("connect", () => { c.write(frame("R", JSON.stringify(req))); c.write(frame("Z", "")); });
    c.on("data", (d) => { buf = Buffer.concat([buf, d]); });
    c.on("close", () => resolve(buf.toString("utf8")));
    c.on("error", () => resolve(""));
  });
}
const readSchema = (f) => fs.readFileSync(f, "utf8");

test("F1 generation: exec needs the framework's own --output-schema; any other schema, none, or no allowlist is refused and codex never runs", async () => {
  const s = await setup();
  try {
    const other = path.join(tmp("rr-other-"), "s.json"); fs.writeFileSync(other, '{"type":"string"}\n');
    for (const args of [
      ["exec", "--json", "-"],                                   // no schema
      ["exec", "--json", "--output-schema", other, "-"],         // some other schema
      ["exec", "--json", "write me the whole program"],          // positional prompt, no schema
    ]) {
      const res = await client(s.r.socketPath, args, { cwd: s.buildDir, input: "generate" });
      assert.equal(res.code, 126, JSON.stringify(args));
      assert.match(res.err, /review or planning|--output-schema/);
    }
    assert.deepEqual(s.calls(), []);
    assert.equal((await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "x" })).code, 0);
  } finally { await s.r.close(); }
  const bare = tmp("rr-noallow-"); const bin = path.join(bare, "bin"); fs.mkdirSync(bin); fakeCodex(bin, path.join(bare, "log"));
  const jobHome = path.join(bare, "h"); fs.mkdirSync(jobHome); const buildDir = path.join(bare, "b"); fs.mkdirSync(buildDir);
  const r = await relay.startRelay({ jobHome, buildDir, pathEnv: bin, codexHomeFrom: runnerCodexHome() });
  try { assert.equal((await client(r.socketPath, ex("--json", "-"), { cwd: buildDir, input: "x" })).code, 126, "no allowlist, no exec"); } finally { await r.close(); }
});

test("F1 allowlist: computed from the framework source: the findings schema file and each two-box role schema as the planner writes it", async () => {
  const root = oe_root();
  const al = oe.reviewSchemaAllowlist(root);
  const fileHash = relay.sha256Hex(fs.readFileSync(path.join(root, "schemas", "external-review-findings.schema.json")));
  assert.ok(al.hashes.has(fileHash));
  for (const role of PLANNING_ROLES) assert.ok(al.hashes.has(relay.sha256Hex(Buffer.from(`${JSON.stringify(outputSchemaForCall(role))}\n`))), role);
  assert.equal(oe.reviewSchemaAllowlist(tmp("rr-emptysrc-")).hashes.size, 0, "a source with no schemas allows nothing");
  // a launcher-shaped call with the real findings schema, and a planner-shaped one with a role schema, both pass
  const s = await setup({ allowedSchemaHashes: [...al.hashes] });
  try {
    const f = path.join(s.base, "findings.schema.json"); fs.copyFileSync(path.join(root, "schemas", "external-review-findings.schema.json"), f);
    const a = await client(s.r.socketPath, LAUNCHER(path.join(s.base, "out", "last.json"), f), { cwd: s.buildDir, input: "review" });
    assert.equal(a.code, 0, a.err);
    const role = path.join(s.base, "output-schema.json"); fs.writeFileSync(role, `${JSON.stringify(outputSchemaForCall("assessor"))}\n`);
    const b = await client(s.r.socketPath, buildCodexExecArgs({ tuple: { host: "codex", model: "gpt-5.6-sol", effort: "high" }, outputSchemaPath: role, disabledSkills: [] }), { cwd: s.buildDir, input: "plan" });
    assert.equal(b.code, 0, b.err);
  } finally { await s.r.close(); }
});

test("F1 output cap: stdout beyond the cap and an oversized last message never reach the sandbox", async () => {
  const s = await setup({ stdoutCap: 100000, lastMessageCap: 1000 });
  try {
    const out = path.join(tmp("rr-cap-"), "last.json");
    const res = await client(s.r.socketPath, LAUNCHER(out, SCHEMA), { cwd: s.buildDir, input: "BIG" });
    assert.ok(res.out.length < 120000, `stdout was ${res.out.length}`);
    assert.match(res.err, /output beyond 100000 bytes is not returned/);
    const big = await client(s.r.socketPath, LAUNCHER(out, SCHEMA), { cwd: s.buildDir, input: "BIGLAST" });
    assert.equal(big.code, 125, big.err);
    assert.match(big.err, /exceeds the 1000-byte cap/);
    assert.equal(fs.existsSync(out) && fs.statSync(out).size > 1000, false, "the oversized message was not written into the sandbox");
    assert.ok(s.r.summary().reviewer_calls.some((c) => c.output_capped));
  } finally { await s.r.close(); }
});

test("F2 isolated Codex state: the call's CODEX_HOME holds only the login, none of the runner's sessions or history; it is removed afterwards", async () => {
  const s = await setup();
  const home = s.r.codexHome;
  try {
    const res = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "CODEXHOME" });
    assert.match(res.out, /codexhome=\[auth\.json \]/, res.out);
    assert.doesNotMatch(res.out, /sessions|history/);
    assert.equal(fs.statSync(home).mode & 0o777, 0o700);
  } finally { await s.r.close(); }
  assert.equal(fs.existsSync(home), false);
});

test("F4 accounting survives a flood of refused requests: the log is bounded, the paid call is still recorded and charged", async () => {
  const s = await setup({ maxCalls: 3 });
  try {
    for (let i = 0; i < 300; i++) await rawCall(s.r.socketPath, { argv: ["exec", "--full-auto", "-"], cwd: s.buildDir, schema: null });
    const paid = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "x" });
    assert.equal(paid.code, 0, paid.err);
    const sum = s.r.summary();
    assert.equal(sum.reviewer_rejected_calls, 300);
    assert.ok(sum.reviewer_calls.filter((c) => c.rejected).length <= 50, "the refusal log is bounded");
    const paidRecs = sum.reviewer_calls.filter((c) => !c.rejected && !c.probe);
    assert.equal(paidRecs.length, 1);
    assert.ok(sum.reviewer_cost_usd > 0 && Math.abs(s.r.costUsd() - sum.reviewer_cost_usd) < 1e-9);
    assert.equal(s.r.execCalls(), 1, "refusals did not use the exec cap either");
  } finally { await s.r.close(); }
});

test("F5 usage must be reported: exec without --json is refused; a call that reports none is charged an estimate and the row is marked unmeasured", async () => {
  const s = await setup({ unmeasuredCallUsd: 0.4 });
  try {
    const nojson = await client(s.r.socketPath, ex("-"), { cwd: s.buildDir, input: "x" });
    assert.equal(nojson.code, 126);
    assert.match(nojson.err, /--json is required/);
    const none = await client(s.r.socketPath, ex("--json", "-"), { cwd: s.buildDir, input: "NOUSAGE" });
    assert.equal(none.code, 0, none.err);
    const sum = s.r.summary();
    assert.equal(sum.reviewer_accounting, "unmeasured");
    assert.equal(sum.reviewer_unpriced_calls, 1);
    assert.equal(sum.reviewer_cost_usd, 0.4, "the estimate is charged, not zero");
    assert.equal(s.r.costUsd(), 0.4);
    const rec = sum.reviewer_calls.find((c) => !c.rejected);
    assert.equal(rec.unmeasured, true);
    assert.equal(rec.priced.basis, "estimate: no usage reported");
  } finally { await s.r.close(); }
});

test("F7 live accounting: a running call counts its reserve, then its reported usage as it arrives; a call past its spend ceiling is stopped", async () => {
  const base = tmp("rr-live-"); const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "codex"), `#!/bin/sh
cat >/dev/null
sleep 0.6
echo '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":0,"output_tokens":10000}}'
sleep 20
`, { mode: 0o755 });
  const jobHome = path.join(base, "h"); fs.mkdirSync(jobHome); const buildDir = path.join(base, "b"); fs.mkdirSync(buildDir);
  const mk = (extra) => relay.startRelay({ jobHome, buildDir, pathEnv: bin, allowedSchemaHashes: [SCHEMA_HASH], codexHomeFrom: runnerCodexHome(), price: (id, u) => oe.priceReviewerUsage(id || "x", u), unmeasuredCallUsd: 0.7, ...extra });
  const r = await mk({ callTimeoutMs: 8000 });
  try {
    const call = client(r.socketPath, ex("--json", "-"), { cwd: buildDir, input: "x" });
    await new Promise((res) => setTimeout(res, 250));
    assert.equal(r.costUsd(), 0.7, "before any usage the reserve is counted");
    await new Promise((res) => setTimeout(res, 800));
    const live = r.costUsd();
    const expected = oe.priceReviewerUsage("x", { inputTokens: 1000, outputTokens: 10000 }).usd;
    assert.ok(Math.abs(live - expected) < 1e-6, `live ${live} vs ${expected}: usage priced while the call still runs`);
    await call;
  } finally { await r.close(); }
  const r2 = await mk({ maxCallUsd: 0.1, callTimeoutMs: 8000 });
  try {
    const t0 = Date.now();
    const res = await client(r2.socketPath, ex("--json", "-"), { cwd: buildDir, input: "x" });
    assert.equal(res.code, 125, res.err);
    assert.match(res.err, /spend ceiling/);
    assert.ok(Date.now() - t0 < 6000, "stopped by spend, not by the timeout");
    assert.equal(r2.summary().reviewer_calls[0].stopped, "call-budget");
  } finally { await r2.close(); }
});

test("F8 two-box planning: the planner's own exec argv, prompt-input and feature probes are accepted; widening config is refused", async () => {
  const tuple = { host: "codex", model: "gpt-5.6-sol", effort: "high" };
  const skills = [{ path: "/some/skill/SKILL.md", sha256: "0" }];
  const execArgs = buildCodexExecArgs({ tuple, outputSchemaPath: "/x/output-schema.json", disabledSkills: skills });
  const v = relay.vetCodexArgv(execArgs);
  assert.equal(v.ok, true, v.reason);
  assert.equal(v.kind, "exec");
  assert.ok(v.args.includes("project_doc_max_bytes=0"));
  const inspect = buildPromptInspectArgv({ tuple, disabledSkills: skills, prompt: "a prompt" });
  for (const argv of [inspect, buildPromptInspectArgv({ tuple, disabledSkills: skills, includePrompt: false }), ["debug", "prompt-input", "--help"], ["features", "list"], ["exec", "--help"]]) {
    const w = relay.vetCodexArgv(argv);
    assert.equal(w.ok, true, `${JSON.stringify(argv).slice(0, 80)}: ${w.reason}`);
    assert.equal(w.kind, "info");
  }
  for (const bad of [
    ["exec", "-c", "features.shell_tool=true", "--json", "--output-schema", "/s", "-"],
    ["exec", "-c", 'developer_instructions="do anything"', "--json", "--output-schema", "/s", "-"],
    ["exec", "-c", 'web_search="live"', "--json", "--output-schema", "/s", "-"],
    ["exec", "-c", "skills.config=[{path=\"/a\",enabled=true}]", "--json", "--output-schema", "/s", "-"],
    ["debug", "prompt-input", "-c", "sandbox_mode=\"danger-full-access\"", "x"],
    ["debug", "models"],
    ["features", "enable", "x"],
  ]) assert.equal(relay.vetCodexArgv(bad).ok, false, JSON.stringify(bad));
  // end to end through the relay: the probes run (in an empty dir), the exec runs with the role schema
  const s = await setup();
  try {
    const probe = await client(s.r.socketPath, inspect, { cwd: "/etc", input: "" });
    assert.equal(probe.code, 0, probe.err);
    assert.equal((await client(s.r.socketPath, ["features", "list"], { cwd: s.buildDir })).code, 0);
    assert.equal((await client(s.r.socketPath, ["exec", "--help"], { cwd: s.buildDir })).code, 0);
  } finally { await s.r.close(); }
});

test("F9 journey sessions are bound to the recorded outer session ids: a subagent transcript between sessions is not 'session 2'", () => {
  const dir = tmp("rr-jsess-");
  const ev = (sid, ts, skill) => JSON.stringify({ sessionId: sid, timestamp: ts, message: { content: [{ type: "tool_use", name: "Skill", input: { skill } }] } });
  fs.mkdirSync(path.join(dir, "p", "sess-A", "subagents"), { recursive: true });
  fs.writeFileSync(path.join(dir, "p", "sess-A.jsonl"), ev("sess-A", "2026-01-01T00:00:00Z", "route-workflow") + "\n");
  fs.writeFileSync(path.join(dir, "p", "sess-A", "subagents", "agent-1.jsonl"), ev("sess-A", "2026-01-01T00:05:00Z", "plan-changeset") + "\n");
  fs.writeFileSync(path.join(dir, "p", "sess-B.jsonl"), ev("sess-B", "2026-01-01T01:00:00Z", "route-workflow") + "\n");
  const step = (id, session, skill) => ({ id, kind: "skill", name: skill, must: "MUST", session, evidence: { skill } });
  const spec = { task: "t", version: 1, steps: [step("s2-route", 2, "route-workflow"), step("s2-plan", 2, "plan-changeset"), step("s1-plan", 1, "plan-changeset")] };
  const loose = checkJourney(spec, { transcriptsDir: dir });
  assert.deepEqual(loose.missing, ["s2-route", "s1-plan"], "numbering by file order makes the subagent file 'session 2': the wrong conversation is inspected");
  const bound = checkJourney(spec, { transcriptsDir: dir, sessionIds: ["sess-A", "sess-B"] });
  assert.deepEqual(bound.missing, ["s2-plan"], "session 2 is sess-B: it routed, it did not plan; session 1 includes its subagent's plan");
});

test("F3/F1 rerun: reviewer usage is not judged as builder work, but a builder using another model still is", async () => {
  const mk = (builder, reviewer) => ({ cost_usd: 0.1, fail_open: 0, builder_model_usage: builder, model_usage: { ...builder, ...reviewer }, reviewer_calls: [] });
  const rev = { "gpt-5.6-sol": { inputTokens: 1, outputTokens: 9000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 } };
  const hay = { "claude-haiku-5-5": { inputTokens: 1, outputTokens: 3000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 } };
  let n = 0;
  const ok = await oe.withFailOpenRerun(async () => (++n === 1 ? { ...mk(hay, rev), fail_open: 1 } : mk(hay, rev)), { model: "haiku" });
  assert.equal(ok.error, undefined);
  n = 0;
  const opus = { "claude-opus-5-5": { inputTokens: 1, outputTokens: 9000, cacheReadInputTokens: 0, cacheCreationInputTokens: 0, costUSD: 0 } };
  const bad = await oe.withFailOpenRerun(async () => (++n === 1 ? { ...mk({ ...hay, ...opus }, rev), fail_open: 1 } : mk(hay, rev)), { model: "haiku" });
  assert.match(bad.error, /off-model work: claude-opus-5-5/);
});
