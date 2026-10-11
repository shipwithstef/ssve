// @organism-suite
// Fail-open counter: increments, concurrency, silence, shape, and a wired hook whose
// exit code must not change when it fails open.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const LIB = path.join(ROOT, "scripts", "lib", "fail-open-counter.mjs");
const { recordFailOpen, readFailOpen, counterPath } = await import(pathToFileURL(LIB));

function repo({ git = true, svc = true } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "svc-failopen-")));
  if (git) execFileSync("git", ["init", "-q", dir]);
  if (svc) fs.mkdirSync(path.join(dir, ".svc"));
  return dir;
}
const read = (dir) => JSON.parse(fs.readFileSync(counterPath(dir), "utf8"));

test("increments total and by_hook/by_class using code, then name, then Error", () => {
  const dir = repo();
  recordFailOpen("svc-a", Object.assign(new Error("secret text"), { code: "ENOENT" }), { root: dir });
  recordFailOpen("svc-a", Object.assign(new Error("secret text"), { code: "ENOENT" }), { root: dir });
  recordFailOpen("svc-a", new TypeError("other"), { root: dir });
  recordFailOpen("svc-b", "just a string", { root: dir });
  assert.deepEqual(read(dir), { total: 4, by_hook: { "svc-a": { ENOENT: 2, TypeError: 1 }, "svc-b": { Error: 1 } } });
  assert.deepEqual(readFailOpen(dir).total, 4);
  assert.equal(fs.readFileSync(counterPath(dir), "utf8").includes("secret"), false, "messages are never stored");
  assert.deepEqual(fs.readdirSync(path.join(dir, ".svc")), ["fail-open-counter.json"], "no temp or lock leftovers");
});

test("never throws, never prints, tolerates a corrupt file", () => {
  const dir = repo();
  fs.writeFileSync(counterPath(dir), "{not json");
  const script = `import(${JSON.stringify(pathToFileURL(LIB).href)}).then((m) => { m.recordFailOpen("h", new Error("x"), { root: ${JSON.stringify(dir)} }); m.recordFailOpen(undefined, null, { root: "/nonexistent/zzz" }); });`;
  const r = spawnSync(process.execPath, ["-e", script], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");
  assert.deepEqual(read(dir), { total: 1, by_hook: { h: { Error: 1 } } });
});

test(".svc is created only inside a git work tree", () => {
  const plain = repo({ git: false, svc: false });
  recordFailOpen("h", new Error("x"), { root: plain });
  assert.equal(fs.existsSync(path.join(plain, ".svc")), false);
  const tree = repo({ svc: false });
  recordFailOpen("h", new Error("x"), { root: tree });
  assert.equal(read(tree).total, 1);
});

test("root defaults to the git toplevel of cwd", () => {
  const dir = repo({ svc: false });
  fs.mkdirSync(path.join(dir, "deep", "er"), { recursive: true });
  recordFailOpen("h", new Error("x"), { cwd: path.join(dir, "deep", "er") });
  assert.equal(read(dir).total, 1);
});

test("concurrent increments from parallel processes are not lost", async () => {
  const dir = repo();
  const N = 12, EACH = 5;
  const script = `import(${JSON.stringify(pathToFileURL(LIB).href)}).then((m) => { for (let i = 0; i < ${EACH}; i++) m.recordFailOpen("svc-par", { code: "EPAR" }, { root: ${JSON.stringify(dir)} }); });`;
  await Promise.all(Array.from({ length: N }, () => new Promise((resolve, reject) => {
    const c = spawn(process.execPath, ["-e", script], { stdio: "ignore" });
    c.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`child exit ${code}`))));
  })));
  assert.deepEqual(read(dir), { total: N * EACH, by_hook: { "svc-par": { EPAR: N * EACH } } });
});

test("CLI record is silent and exits 0 (shell hooks)", () => {
  const dir = repo();
  const r = spawnSync(process.execPath, [LIB, "record", "svc-shell", "ScannerError", dir], { encoding: "utf8" });
  assert.equal(r.status, 0);
  assert.equal(r.stdout + r.stderr, "");
  assert.deepEqual(read(dir), { total: 1, by_hook: { "svc-shell": { ScannerError: 1 } } });
});

test("a wired hook that fails open keeps its exit code and prints nothing extra", () => {
  const dir = repo();
  // svc-subagent-start swallows telemetry errors and exits 0. Make the append fail by
  // putting a directory where dispatch-log.jsonl must be written.
  fs.mkdirSync(path.join(dir, ".svc", "dispatch-log.jsonl"));
  const r = spawnSync(process.execPath, [path.join(ROOT, "hooks", "svc-subagent-start.mjs")], {
    cwd: dir, input: JSON.stringify({ cwd: dir, session_id: "s", agent_name: "a" }), encoding: "utf8",
  });
  assert.equal(r.status, 0, "exit code unchanged");
  assert.equal(r.stdout, "");
  assert.equal(r.stderr, "");
  const c = read(dir);
  assert.equal(c.total, 1);
  assert.ok(c.by_hook["svc-subagent-start"], JSON.stringify(c));
});

test("the hook boundary counts a failing child in advisory mode and keeps exit 0", () => {
  const dir = repo();
  const child = path.join(dir, "bad-hook.mjs");
  fs.writeFileSync(child, "process.exit(1);\n");
  const spec = Buffer.from(JSON.stringify({ command: `node ${child}`, host: "claude", event: "UserPromptSubmit", timeoutMs: 20000 })).toString("base64url");
  const env = { ...process.env, SVC_HOOK_MODE: "advisory", HOME: dir };
  delete env.SVC_REPO_MODE;
  const r = spawnSync(process.execPath, [path.join(ROOT, "hooks", "svc-hook-boundary.mjs"), "bad-hook", "--spec", spec], {
    cwd: dir, env, input: JSON.stringify({ cwd: dir, hook_event_name: "UserPromptSubmit", prompt: "hi" }), encoding: "utf8",
  });
  assert.equal(r.status, 0);
  const c = read(dir);
  assert.equal(c.total, 1, r.stderr);
  assert.deepEqual(Object.keys(c.by_hook), ["bad-hook"]);
});

test("cockpit state exposes the fail-open count per project and in totals", async () => {
  const { buildState } = await import(pathToFileURL(path.join(ROOT, "scripts", "cockpit-state.mjs")));
  const dir = repo();
  recordFailOpen("svc-a", { code: "EIO" }, { root: dir });
  recordFailOpen("svc-a", { code: "EIO" }, { root: dir });
  const clean = repo();
  const state = buildState([dir, clean]);
  const byName = Object.fromEntries(state.orchestrator.projects.map((p) => [p.name, p]));
  assert.equal(byName[path.basename(dir)].fail_open, 2);
  assert.deepEqual(byName[path.basename(dir)].fail_open_by_hook, { "svc-a": { EIO: 2 } });
  assert.equal(byName[path.basename(clean)].fail_open, 0);
  assert.equal(state.totals.fail_open, 2);
});

test("hook-bench drops inherited mode switches, passes explicit ones, and fails on a failing child with no numbers", async () => {
  const { bench, sanitiseEnv } = await import(pathToFileURL(path.join(ROOT, "scripts", "hook-bench.mjs")));
  const base = { PATH: "x", SVC_REPO_MODE: "off", SVC_DISABLED_HOOKS: "a,b", SVC_HOOK_PROFILE: "minimal", SVC_HOOK_MODE: "enforce" };
  assert.deepEqual(sanitiseEnv(base), { PATH: "x" });
  assert.deepEqual(sanitiseEnv(base, { SVC_HOOK_PROFILE: "full" }), { PATH: "x", SVC_HOOK_PROFILE: "full" });

  // A probe handler fails (exit 7) exactly when SVC_REPO_MODE reaches it.
  const probe = (hooks) => { (hooks.UserPromptSubmit ||= []).push({ hooks: [{ type: "command", command: `node -e "process.exit(process.env.SVC_REPO_MODE ? 7 : 0)"` }] }); };
  const saved = process.env.SVC_REPO_MODE;
  process.env.SVC_REPO_MODE = "off";
  try {
    const inherited = await bench({ runs: 1, mutateHooks: probe });
    assert.equal(inherited.failures.some((f) => f.exit === 7), false, "inherited SVC_REPO_MODE never reaches the child");
    const explicit = await bench({ runs: 1, mutateHooks: probe, env: { SVC_REPO_MODE: "on" } });
    assert.equal(explicit.ok, false);
    assert.ok(explicit.failures.some((f) => f.exit === 7));
    assert.deepEqual(explicit.events, [], "no numbers are reported when a child failed");
  } finally {
    if (saved === undefined) delete process.env.SVC_REPO_MODE; else process.env.SVC_REPO_MODE = saved;
  }
});

test("the installed enforcement bundle ships the counter: a forced child failure increments the project's file", () => {
  const home = repo({ svc: false });            // disposable HOME, a git work tree like a dotfiles home
  const installed = path.join(home, "installed");
  fs.mkdirSync(installed);
  const project = repo();
  const env = { ...process.env, HOME: home, CODEX_HOME: path.join(home, ".codex"), SVC_HOST: "codex", SVC_HOOK_MODE: "advisory" };
  for (const k of ["SVC_REPO_MODE", "SVC_DISABLED_HOOKS", "SVC_HOOK_PROFILE", "SVC_SESSION_ID", "CLAUDE_SESSION_ID"]) delete env[k];
  const built = spawnSync(process.execPath, [path.join(ROOT, "scripts", "svc-migrate-install.mjs"), "materialize",
    "--host", "codex", "--repo-root", ROOT, "--skills-path", installed, "--json"], { env, encoding: "utf8" });
  assert.equal(built.status, 0, built.stderr);
  const bundle = path.join(home, ".svc", "enforcement", "1");
  for (const rel of ["hooks/lib/fail-open.mjs", "hooks/lib/process-liveness.mjs", "scripts/lib/fail-open-counter.mjs", "scripts/lib/is-main.mjs", "scripts/state-io.mjs"]) {
    assert.ok(fs.existsSync(path.join(bundle, rel)), `bundle ships ${rel}`);
  }
  const child = path.join(project, "bad-hook.mjs");
  fs.writeFileSync(child, "process.exit(1);\n");
  const spec = Buffer.from(JSON.stringify({ command: `node ${child}`, host: "claude", event: "UserPromptSubmit", timeoutMs: 20000 })).toString("base64url");
  const r = spawnSync(process.execPath, [path.join(bundle, "hooks", "svc-hook-boundary.mjs"), "bad-hook", "--spec", spec], {
    cwd: project, env, input: JSON.stringify({ cwd: project, hook_event_name: "UserPromptSubmit", prompt: "hi" }), encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(read(project), { total: 1, by_hook: { "bad-hook": { Exit1: 1 } } });
});

// ---- review fixes ----------------------------------------------------------------

function runBoundary(dir, childSource) {
  const child = path.join(dir, "child.mjs");
  fs.writeFileSync(child, childSource);
  const spec = Buffer.from(JSON.stringify({ command: `node ${child}`, host: "claude", event: "UserPromptSubmit", timeoutMs: 20000 })).toString("base64url");
  const env = { ...process.env, SVC_HOOK_MODE: "advisory", HOME: dir };
  delete env.SVC_REPO_MODE;
  const r = spawnSync(process.execPath, [path.join(ROOT, "hooks", "svc-hook-boundary.mjs"), "child", "--spec", spec], {
    cwd: dir, env, input: JSON.stringify({ cwd: dir, hook_event_name: "UserPromptSubmit", prompt: "hi" }), encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return fs.existsSync(counterPath(dir)) ? read(dir) : { total: 0, by_hook: {} };
}

test("boundary: a confirmed policy denial is not counted; every other exit 2 or signal is", () => {
  const denial = JSON.stringify({ svc_denial: true, hook_id: "svc-x", reason_code: "SVC-X", cause: "no", operation: "o", recovery: "r" });
  const denyJson = JSON.stringify({ hookSpecificOutput: { permissionDecision: "deny", permissionDecisionReason: "no" } });
  assert.equal(runBoundary(repo(), `process.stderr.write(${JSON.stringify(denial + "\n")}); process.exit(2);`).total, 0, "machine denial record on stderr");
  assert.equal(runBoundary(repo(), `process.stdout.write(${JSON.stringify(denyJson)}); process.exit(2);`).total, 0, "deny decision on stdout");
  assert.deepEqual(runBoundary(repo(), "process.exit(2);").by_hook, { child: { Exit2: 1 } }, "bare exit 2");
  assert.deepEqual(runBoundary(repo(), `process.stderr.write("SVC DENIAL svc-enforce SVC-ENFORCE-INTERNAL: boom (fail-closed)\\n"); process.exit(2);`).by_hook, { child: { Exit2: 1 } }, "svc-enforce internal error");
  assert.deepEqual(runBoundary(repo(), `process.kill(process.pid, "SIGKILL");`).by_hook, { child: { SignalSIGKILL: 1 } }, "signal-terminated child");
  assert.deepEqual(runBoundary(repo(), `process.stderr.write(${JSON.stringify(denial + "\n")}); process.exit(1);`).by_hook, { child: { Exit1: 1 } }, "a denial record with exit 1 is a crash");
});

test("learning and owner injectors count memo failures against the payload's project", () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, "references"));
  fs.writeFileSync(path.join(dir, "references", "framework-learnings.jsonl"), JSON.stringify({ key: "k", insight: "i", confidence: 9, files: ["app/w.ts"], type: "x" }) + "\n");
  fs.writeFileSync(path.join(dir, ".svc", "task-owners.json"), JSON.stringify({ entries: [{ task_class: "deploy", owner: "ship-it", signals: { bash: ["deploy"] } }] }));
  // A directory where each per-session memo file belongs makes its read and write fail.
  fs.mkdirSync(path.join(dir, ".svc", "learning-injections-s1.json"));
  fs.mkdirSync(path.join(dir, ".svc", "owner-injections-s1.json"));
  const elsewhere = repo({ svc: false });     // process cwd is NOT the project
  const run = (hook, tool, input) => spawnSync(process.execPath, [path.join(ROOT, "hooks", hook)], {
    cwd: elsewhere, input: JSON.stringify({ hook_event_name: "PreToolUse", tool_name: tool, tool_input: input, session_id: "s1", cwd: dir }), encoding: "utf8",
    env: { ...process.env, SVC_OWNERS_MANIFEST: path.join(dir, "none.json") },
  });
  const a = run("svc-learning-inject.mjs", "Edit", { file_path: "app/w.ts" });
  const b = run("svc-owner-inject.mjs", "Bash", { command: "deploy now" });
  assert.equal(a.status, 0); assert.equal(b.status, 0);
  const c = read(dir);
  assert.ok(c.by_hook["svc-learning-inject"], JSON.stringify(c));
  assert.ok(c.by_hook["svc-owner-inject"], JSON.stringify(c));
  assert.equal(fs.existsSync(path.join(elsewhere, ".svc")), false, "nothing is counted against the process cwd");
});

test("spec-index-update counts a failing index build and counts against the payload's project", () => {
  const dir = repo();
  fs.mkdirSync(path.join(dir, "scripts"));
  fs.writeFileSync(path.join(dir, "scripts", "build-spec-index.mjs"), "process.exit(3);\n");
  const elsewhere = repo({ svc: false });
  const r = spawnSync(process.execPath, [path.join(ROOT, "hooks", "svc-spec-index-update.mjs")], {
    cwd: dir, input: JSON.stringify({ cwd: dir, tool_input: { file_path: path.join(dir, "docs", "specs", "a.md") } }), encoding: "utf8",
    env: { ...process.env, SVC_HOST: "claude" },
  });
  assert.equal(r.status, 0);
  assert.deepEqual(read(dir).by_hook, { "svc-spec-index-update": { Exit3: 1 } });
  assert.equal(fs.existsSync(path.join(elsewhere, ".svc")), false);
});

test("telemetry hooks count against the payload's cwd, not process.cwd()", () => {
  const project = repo();
  fs.mkdirSync(path.join(project, ".svc", "dispatch-log.jsonl"));
  const elsewhere = repo();                   // a different governed repo is the process cwd
  const r = spawnSync(process.execPath, [path.join(ROOT, "hooks", "svc-subagent-stop.mjs")], {
    cwd: elsewhere, input: JSON.stringify({ cwd: project, session_id: "s" }), encoding: "utf8",
  });
  assert.equal(r.status, 0);
  assert.equal(read(project).total, 1);
  assert.equal(fs.existsSync(counterPath(elsewhere)), false);
});

test("hook-bench fails when a wired (boundary-wrapped) handler crashes behind the advisory exit 0", async () => {
  const { bench, counterGrowth } = await import(pathToFileURL(path.join(ROOT, "scripts", "hook-bench.mjs")));
  assert.deepEqual(counterGrowth({ total: 1, by_hook: { a: { E: 1 } } }, { total: 3, by_hook: { a: { E: 2 }, b: { F: 1 } } }),
    [{ hook: "a", cls: "E", n: 1 }, { hook: "b", cls: "F", n: 1 }]);
  const scratch = repo({ svc: false });
  const crash = path.join(scratch, "crash.mjs");
  fs.writeFileSync(crash, "process.exit(1);\n");
  const spec = Buffer.from(JSON.stringify({ command: `node ${crash}`, host: "claude", event: "UserPromptSubmit", timeoutMs: 20000 })).toString("base64url");
  const wrapped = (hooks) => { (hooks.UserPromptSubmit ||= []).push({ hooks: [{ type: "command", command: `node ${path.join(ROOT, "hooks", "svc-hook-boundary.mjs")} wrapped-crash --spec ${spec}` }] }); };
  const result = await bench({ runs: 1, mutateHooks: wrapped });
  assert.equal(result.ok, false);
  assert.deepEqual(result.events, []);
  assert.ok(result.failures.some((f) => f.handler === "wrapped-crash" && /failed open/.test(String(f.exit))), JSON.stringify(result.failures));
});

test("the live cockpit page shows the fail-open total and per-project counts", async () => {
  const vm = await import("node:vm");
  const { buildState } = await import(pathToFileURL(path.join(ROOT, "scripts", "cockpit-state.mjs")));
  const noisy = repo(), quiet = repo();
  recordFailOpen("svc-a", { code: "EIO" }, { root: noisy });
  recordFailOpen("svc-b", { code: "EIO" }, { root: noisy });
  const html = fs.readFileSync(path.join(ROOT, "templates", "cockpit", "live.html"), "utf8");
  const script = html.split("<script>")[1].split("</script>")[0];
  const render = (state) => {
    const els = new Map();
    const el = () => ({ innerHTML: "", textContent: "", hidden: false, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, querySelector: () => el(), querySelectorAll: () => [], focus() {}, scrollIntoView() {} });
    const document = { querySelector: (sel) => { if (!els.has(sel)) els.set(sel, el()); return els.get(sel); }, querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el(), documentElement: el(), activeElement: null, title: "" };
    const store = new Map();
    const window = { __COCKPIT_STATE__: state, addEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), location: { search: "", hash: "" } };
    const ctx = { document, window, location: window.location, history: { replaceState() {} }, fetch: async () => ({ ok: true, json: async () => ({}) }), sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) }, localStorage: { getItem: () => null, setItem() {} }, console, setTimeout, clearTimeout, setInterval: () => 0, Date, JSON, Math, Set, Map, URLSearchParams, EventSource: class { }, Notification: undefined, requestAnimationFrame: (f) => f() };
    vm.runInNewContext(script, ctx);
    return { kpis: els.get("#kpis").innerHTML, repos: els.get("#repos").innerHTML };
  };
  const shown = render(buildState([noisy, quiet]));
  assert.match(shown.kpis, /Hook fail-opens<\/div><div class="v">2</);
  assert.ok(shown.kpis.includes(`${path.basename(noisy)} 2`), shown.kpis);
  assert.ok(shown.repos.includes(`${path.basename(noisy)} · 2 fail-opens`), shown.repos);
  assert.equal(shown.repos.includes(`${path.basename(quiet)} ·`), false, "a clean project shows no count");
  const clean = render(buildState([quiet]));
  assert.match(clean.kpis, /Hook fail-opens<\/div><div class="v">0</);
  assert.match(clean.kpis, /no hook has failed open/);
});
