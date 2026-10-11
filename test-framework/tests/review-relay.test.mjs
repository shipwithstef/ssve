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
import { spawn, spawnSync } from "node:child_process";
import { test } from "node:test";
import * as oe from "../../scripts/outcome-eval.mjs";
import * as relay from "../../scripts/lib/review-relay.mjs";

const bwrapOk = oe.hasBwrap();
const tmp = (p = "rr-") => fs.mkdtempSync(path.join(os.tmpdir(), p));

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
echo "stdin=$in" | head -c 200
[ -n "$last" ] && printf '{"findings":[]}' > "$last"
echo '{"type":"turn.completed","usage":{"input_tokens":1000,"cached_input_tokens":400,"output_tokens":200,"reasoning_output_tokens":50}}'
echo "fake-stderr" >&2
code=$(printf '%s' "$in" | sed -n 's/^EXIT \\([0-9]*\\).*/\\1/p' | head -1)
exit "\${code:-0}"
`, { mode: 0o755 });
  return f;
}

async function setup({ maxCalls, callTimeoutMs, price = (id, u) => oe.priceUsage(id || "unknown", u), deadlineAt = null } = {}) {
  const base = tmp("rr-base-");
  const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  const log = path.join(base, "calls.log");
  fakeCodex(bin, log);
  const jobHome = path.join(base, "home"); fs.mkdirSync(jobHome, { mode: 0o700 });
  const buildDir = path.join(base, "build"); fs.mkdirSync(buildDir);
  const r = await relay.startRelay({ jobHome, buildDir, pathEnv: bin, maxCalls, callTimeoutMs, price, deadlineAt });
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
  const v = relay.vetCodexArgv(["exec", "--json", "-"]);
  assert.equal(v.ok, true);
  assert.deepEqual(v.args, ["exec", "-s", "read-only", "--json", "-"]);
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
    '{"type":"turn.completed","usage":{"input_tokens":10,"cached_input_tokens":0,"output_tokens":5}}',
  ]);
  assert.equal(u.input_tokens, 1010); assert.equal(u.cached_input_tokens, 400); assert.equal(u.output_tokens, 205);
  assert.deepEqual(relay.usageForPricing(u), { inputTokens: 610, cacheReadInputTokens: 400, outputTokens: 205 });
  assert.equal(relay.parseCodexUsage(["no usage here"]), null);
  assert.equal(relay.parseCodexUsage([]), null);
});

// ---- the relay over its socket ---------------------------------------------------------

test("relay: the client reaches the fake codex, streams stdout and stderr, relays the exit code, writes the last-message file and sends the schema", async () => {
  const s = await setup();
  try {
    const out = path.join(tmp("rr-out-"), "deep", "last.json");
    const schemaFile = path.join(tmp("rr-sch-"), "schema.json");
    fs.writeFileSync(schemaFile, '{"type":"object"}');
    const res = await client(s.r.socketPath, LAUNCHER(out, schemaFile), { cwd: s.buildDir, input: "hello\nEXIT 3\n" });
    assert.equal(res.code, 3, res.err);
    assert.match(res.out, /stdin=hello/);
    assert.match(res.out, /schema-bytes=17/, "the schema file contents travelled with the call");
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
    const ok = await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: s.buildDir, input: "x" });
    assert.equal(ok.code, 0, ok.err);
    assert.match(s.calls()[0], /^exec -s read-only --json -/);
    const rejected = s.r.calls().filter((c) => c.rejected);
    assert.equal(rejected.length, 3);
    assert.equal(s.r.execCalls(), 1, "refused calls do not use the cap");
  } finally { await s.r.close(); }
});

test("relay: a working directory outside the build dir and job home is refused; -C is held to the same fence; probes still run anywhere", async () => {
  const s = await setup();
  try {
    const outside = tmp("rr-outside-");
    const bad = await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: outside, input: "CWD" });
    assert.equal(bad.code, 126);
    assert.match(bad.err, /outside the job/);
    const badC = await client(s.r.socketPath, ["exec", "-C", outside, "--json", "-"], { cwd: s.buildDir, input: "CWD" });
    assert.equal(badC.code, 126);
    assert.match(badC.err, /-C .* outside the job/);
    assert.deepEqual(s.calls(), []);
    // a symlink inside the build dir that points outside does not get around the fence
    fs.symlinkSync(outside, path.join(s.buildDir, "escape"));
    const link = await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: path.join(s.buildDir, "escape"), input: "CWD" });
    assert.equal(link.code, 126);
    const good = await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: s.buildDir, input: "CWD" });
    assert.equal(good.code, 0, good.err);
    assert.match(good.out, new RegExp(`cwd=${fs.realpathSync(s.buildDir)}`));
    const probe = await client(s.r.socketPath, ["--version"], { cwd: outside });
    assert.equal(probe.code, 0);
    assert.match(probe.out, /codex-cli 0.0.0-fake/);
  } finally { await s.r.close(); }
});

test("relay: the per-job call cap stops exec calls past it, probes and refused calls do not count", async () => {
  const s = await setup({ maxCalls: 2 });
  try {
    for (let i = 0; i < 2; i++) assert.equal((await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: s.buildDir, input: "x" })).code, 0);
    for (let i = 0; i < 3; i++) assert.equal((await client(s.r.socketPath, ["--version"], { cwd: s.buildDir })).code, 0);
    const third = await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: s.buildDir, input: "x" });
    assert.equal(third.code, 126);
    assert.match(third.err, /call cap reached \(2 per job\)/);
    assert.equal(s.calls().length, 2);
  } finally { await s.r.close(); }
});

test("relay: a call past its timeout is stopped (exit 124) and its process group dies", async () => {
  const s = await setup({ callTimeoutMs: 400 });
  try {
    const t0 = Date.now();
    const res = await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: s.buildDir, input: "SLEEP" });
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
    const res = await client(s.r.socketPath, ["exec", "--json", "-"], { cwd: s.buildDir, input: "x" });
    assert.equal(res.code, 126);
    assert.match(res.err, /time is spent/);
  } finally { await s.r.close(); }
});

test("relay: reviewer cost is priced from the codex usage, summed, and null when no call printed usage", async () => {
  const s = await setup();
  try {
    await client(s.r.socketPath, ["exec", "--json", "-m", "gpt-5.6-sol", "-"], { cwd: s.buildDir, input: "x" });
    await client(s.r.socketPath, ["exec", "--json", "-m", "gpt-5.6-sol", "-"], { cwd: s.buildDir, input: "x" });
    const expectOne = oe.priceUsage("gpt-5.6-sol", { inputTokens: 600, cacheReadInputTokens: 400, outputTokens: 200 }).usd;
    assert.ok(expectOne > 0);
    const sum = s.r.summary();
    assert.ok(Math.abs(sum.reviewer_cost_usd - 2 * expectOne) < 1e-5, `${sum.reviewer_cost_usd} vs ${2 * expectOne}`);
    assert.equal(sum.reviewer_unpriced_calls, 0);
    assert.ok(Math.abs(s.r.costUsd() - sum.reviewer_cost_usd) < 1e-9);
    assert.equal(sum.reviewer_calls[0].priced.known, false, "a model the table does not list is priced at the dearest known rate and flagged");
  } finally { await s.r.close(); }
  // a codex that prints no usage: calls are counted, cost is null
  const base = tmp("rr-nu-"); const bin = path.join(base, "bin"); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "codex"), "#!/bin/sh\ncat >/dev/null\necho plain\n", { mode: 0o755 });
  const jobHome = path.join(base, "h"); fs.mkdirSync(jobHome); const buildDir = path.join(base, "b"); fs.mkdirSync(buildDir);
  const r = await relay.startRelay({ jobHome, buildDir, pathEnv: bin, price: (id, u) => oe.priceUsage(id, u) });
  try {
    await client(r.socketPath, ["exec", "-"], { cwd: buildDir, input: "x" });
    const sum = r.summary();
    assert.equal(sum.reviewer_calls.length, 1);
    assert.equal(sum.reviewer_cost_usd, null);
    assert.equal(sum.reviewer_unpriced_calls, 1);
    assert.equal(r.costUsd(), 0);
  } finally { await r.close(); }
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
  const r = await relay.startRelay({ jobHome, buildDir, pathEnv: bin });
  try {
    const res = await client(r.socketPath, ["exec", "-"], { cwd: buildDir, input: "" });
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
  const work = path.join(base, "work"), dir = path.join(work, "b"), jobHome = path.join(work, "h"), codex = path.join(base, "codexhome");
  for (const d of [dir, jobHome, codex, path.join(base, "home", ".svc"), path.join(base, "home", ".ssh")]) fs.mkdirSync(d, { recursive: true });
  const f = oe.reviewerConfinement({ dir, jobHome, workRoot: work, realHome: path.join(base, "home"), codexHome: codex });
  const a = f({ cwd: dir, scratch: "/scratch/x" });
  assert.equal(a[0], "bwrap"); assert.deepEqual(a.slice(1, 4), ["--ro-bind", "/", "/"]);
  assert.equal(a[a.length - 1], "--");
  const has = (...xs) => a.some((_, i) => xs.every((x, j) => a[i + j] === x));
  assert.ok(has("--tmpfs", work), "sibling jobs are hidden");
  assert.ok(has("--tmpfs", path.join(base, "home", ".svc")));
  assert.ok(has("--tmpfs", path.join(base, "home", ".ssh")));
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
  const r = await relay.startRelay({ jobHome: w.job_home, buildDir: dir, pathEnv: bin, price: (id, u) => oe.priceUsage(id, u) });
  try {
    fs.mkdirSync(path.join(w.job_home, "wt"));
    // a launcher-shaped call from the build dir: stdin, exit code and last-message file
    const res = await inSandbox(w, `cd "$DIR" && printf 'review me\\nEXIT 4\\n' | codex exec -s read-only --json --output-last-message /tmp/rr-last/out.json - ; echo "code=$?"; cat /tmp/rr-last/out.json`, { DIR: dir });
    assert.match(res.stdout, /stdin=review me/, res.stderr);
    assert.match(res.stdout, /code=4/);
    assert.match(res.stdout, /\{"findings":\[\]\}/);
    // the framework worktree under the sandbox HOME maps to the job home on the host
    const wt = await inSandbox(w, 'cd "$HOME/wt" && echo CWD | codex exec --json -');
    assert.match(wt.stdout, new RegExp(`cwd=${fs.realpathSync(path.join(w.job_home, "wt"))}`), wt.stderr);
    // outside the job: refused
    const out = await inSandbox(w, "cd / && echo CWD | codex exec --json -; echo code=$?");
    assert.match(out.stdout, /code=126/);
    assert.match(out.stderr, /outside the job/);
    // write flags refused inside the sandbox too
    const wf = await inSandbox(w, 'cd "$DIR" && echo x | codex exec --dangerously-bypass-approvals-and-sandbox -; echo code=$?', { DIR: dir });
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
  const r = await relay.startRelay({ jobHome, buildDir: dir, pathEnv: bin, confine: oe.reviewerConfinement({ dir, jobHome, workRoot: work, realHome: path.join(base, "nohome") }) });
  try {
    const res = await client(r.socketPath, ["exec", "-"], { cwd: dir, input: "x" });
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
printf 'review this\\n' | codex exec -s read-only --json -m gpt-5.6-sol - > review.out 2> review.err; echo "codex=$?" > review.code
printf 'x' | codex exec --dangerously-bypass-approvals-and-sandbox - > /dev/null 2> refused.err; echo "refused=$?" >> review.code
gemini --version 2> gemini.err; echo "gemini=$?" >> review.code
printf '{"type":"result","subtype":"success","session_id":"s1","is_error":false,"result":"done","total_cost_usd":0.02,"num_turns":2,"duration_ms":5,"modelUsage":{"claude-haiku-5-5":{"inputTokens":10,"outputTokens":2000,"costUSD":0.01}}}'
`, { mode: 0o755 });
  const out = path.join(base, "out.json");
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, OE_CREDENTIALS: creds() };
  const r = spawnSync(process.execPath, [path.join(oe_root(), "scripts", "outcome-eval.mjs"), "run", "--judge", "none", "--reps", "1", "--model", "haiku", "--keep", path.join(base, "kept"), "--work-root", path.join(base, "work"), "--out", out, "--arms", "solo,framework", "--tasks", "tiny", "--tasks-root", tr, "--parallel", "1", "--framework-sha", sha, "--framework-repo", repo, "--framework-cache", tmp("rr-cache-")], { env, encoding: "utf8", timeout: 240000 });
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(fs.readFileSync(out, "utf8")).rows;
  const fw = rows.find((x) => x.arm === "framework"), solo = rows.find((x) => x.arm === "solo");
  assert.equal(fw.error, undefined, JSON.stringify(fw));
  assert.equal(fw.reviewer_relay, "codex");
  assert.equal(fw.foreign_cli, "blocked-except-codex-relay");
  const code = fs.readFileSync(path.join(fw.artifact, "review.code"), "utf8");
  assert.match(code, /codex=0/); assert.match(code, /refused=126/); assert.match(code, /gemini=127/);
  assert.match(fs.readFileSync(path.join(fw.artifact, "review.out"), "utf8"), /"type":"turn.completed"/);
  const exec = fw.reviewer_calls.filter((c) => !c.rejected && !c.probe);
  assert.equal(exec.length, 1, JSON.stringify(fw.reviewer_calls));
  assert.equal(fw.reviewer_calls.filter((c) => c.rejected).length, 1);
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
function oe_price() { return oe.priceUsage("gpt-5.6-sol", { inputTokens: 600, cacheReadInputTokens: 400, outputTokens: 200 }).usd; }
