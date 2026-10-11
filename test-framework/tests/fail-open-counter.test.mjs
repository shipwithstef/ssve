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
