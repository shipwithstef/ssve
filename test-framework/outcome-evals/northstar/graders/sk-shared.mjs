// Helpers shared by the S (security and data) and K (knowledge) graders.
//
// Grader contract (shared with E and P):
//   export async function grade(dir, task, spec) -> { score: 0..1, checks: [{ name, pass, detail }] }
//   score = passed / total. The spec is read from northstar/specs/<task>/<C>.json by the
//   index, or passed in directly. A spec may carry `specDir` to override where its probe
//   scripts live (tests do this).
//
// Everything here runs the BUILT artifact as a child process with a timeout. Nothing is
// imported into the grader's own process, so a hostile or broken build cannot take the
// grader down, and nothing here calls a paid model.
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { specDirFor, taskDirFor } from "./task-roots.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const OE = path.resolve(HERE, "..", "..");
export const TASKS = path.join(OE, "tasks");
export { taskDirFor };
export const SPECS = path.resolve(HERE, "..", "specs");
export const CALL_RUNNER = path.join(HERE, "sk-call.mjs");
const RESOLVE_HOOK = pathToFileURL(path.join(HERE, "sk-resolve.mjs")).href;

export function loadSpec(task, C) {
  const f = path.join(specDirFor(task), `${C}.json`);
  if (!fs.existsSync(f)) throw new Error(`no ${C} spec for task ${task}: expected ${f.startsWith(OE + path.sep) ? path.relative(OE, f) : `<task dir>/specs/${C}.json`}`);
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

// Where a task's probe scripts and reference files live: next to its specs, in-repo or not.
export const specDirOf = (task, spec) => spec.specDir || specDirFor(task);
export const check = (name, pass, detail = "") => ({ name, pass: !!pass, detail: String(detail).slice(0, 600) });
export function finish(checks) {
  const passed = checks.filter((c) => c.pass).length;
  return { score: checks.length ? passed / checks.length : 0, checks };
}
export const lastLine = (text) => String(text || "").split("\n").map((l) => l.trim()).filter(Boolean).pop() || "";

// ---- arithmetic in spec arguments ------------------------------------------------------
// {"$": "start - 6*H"}: digits, declared variables, + - * / ( ) only. No calls, no property
// access, nothing else is ever evaluated.
export function safeEval(expr, vars = {}) {
  if (typeof expr !== "string" || !/^[\w\s+\-*/().]*$/.test(expr)) throw new Error(`expression not allowed: ${JSON.stringify(expr)}`);
  for (const id of expr.match(/[A-Za-z_]\w*/g) ?? []) if (!Object.prototype.hasOwnProperty.call(vars, id)) throw new Error(`expression uses unknown variable ${id}`);
  const value = Function(...Object.keys(vars), `"use strict"; return (${expr});`)(...Object.values(vars));
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`expression is not a finite number: ${expr}`);
  return value;
}
export function resolveArgs(value, vars) {
  if (Array.isArray(value)) return value.map((v) => resolveArgs(v, vars));
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === "$") return safeEval(value.$, vars);
    return Object.fromEntries(keys.map((k) => [k, resolveArgs(value[k], vars)]));
  }
  return value;
}

// ---- expectations ------------------------------------------------------------------------
export function subsetMatch(actual, expected) {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    return actual && typeof actual === "object" && Object.entries(expected).every(([k, v]) => subsetMatch(actual[k], v));
  }
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((v, i) => subsetMatch(actual[i], v));
  return Object.is(actual, expected) || actual === expected;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// outcome: { value } | { threw } ; returns [pass, detail]
export function evalExpect(expect, outcome) {
  const e = expect || {};
  if (outcome.threw !== undefined) {
    if (e.throws === undefined) return [false, `threw: ${outcome.threw}`];
    const ok = e.throws === true || String(outcome.threw).toLowerCase().includes(String(e.throws).toLowerCase());
    return [ok, ok ? `threw: ${outcome.threw}` : `threw "${outcome.threw}", expected message containing "${e.throws}"`];
  }
  if (e.throws !== undefined) return [false, `expected a throw, got ${JSON.stringify(outcome.value)}`];
  const v = outcome.value;
  const fails = [];
  if ("equals" in e && !same(v, e.equals)) fails.push(`expected ${JSON.stringify(e.equals)}`);
  if ("not_equals" in e && same(v, e.not_equals)) fails.push(`must not be ${JSON.stringify(e.not_equals)}`);
  if (e.oneOf && !e.oneOf.some((x) => same(v, x))) fails.push(`expected one of ${JSON.stringify(e.oneOf)}`);
  if (e.integer && !Number.isInteger(v)) fails.push("expected an integer");
  if ("gte" in e && !(typeof v === "number" && v >= e.gte)) fails.push(`expected >= ${e.gte}`);
  if ("lte" in e && !(typeof v === "number" && v <= e.lte)) fails.push(`expected <= ${e.lte}`);
  if (e.matches && !new RegExp(e.matches, "i").test(String(v))) fails.push(`expected to match /${e.matches}/`);
  if (e.subset && !subsetMatch(v, e.subset)) fails.push(`expected to contain ${JSON.stringify(e.subset)}`);
  return fails.length ? [false, `got ${JSON.stringify(v)}; ${fails.join("; ")}`] : [true, `got ${JSON.stringify(v)}`];
}

// ---- running build code (module calls, probe scripts) ---------------------------------
// Completion evidence never travels on stdout, which the build can write to. The grader
// generates a nonce per run and hands it to the runner on STDIN (consumed before any build
// code is imported, so the build cannot read it) and reads the runner's verdict from fd 3,
// a pipe only the runner is told about. A run counts only if the child exited 0 AND the last
// well-formed line on fd 3 carries this run's nonce. A build that calls process.exit(0) early
// leaves nothing on fd 3; text it prints on stdout is ignored.
function spawnRunner(args, cwd, stdinBody, env, timeoutMs) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const r = spawnSync(process.execPath, args, { cwd, input: `${nonce}\n${stdinBody}`, encoding: "utf8", timeout: timeoutMs, stdio: ["pipe", "pipe", "pipe", "pipe"], env: cleanEnv(env) });
  const fd3 = Buffer.isBuffer(r.output?.[3]) ? r.output[3].toString("utf8") : String(r.output?.[3] ?? "");
  const lines = fd3.split("\n").filter((l) => l.startsWith(`${nonce}\t`));
  return { r, done: lines.length ? lines[lines.length - 1].slice(nonce.length + 1) : null };
}
export function runCall(dir, { module: mod, export: name, args = [] }, timeoutMs = 10000) {
  const { r, done } = spawnRunner([CALL_RUNNER], dir, JSON.stringify({ module: mod, export: name, args }), { GRADE_BUILD_DIR: dir }, timeoutMs);
  if (r.status !== 0 || done == null) return { error: r.error?.code === "ETIMEDOUT" ? "timed out" : `no trustworthy result (${r.status === 0 ? "the module ended the process early" : lastLine(r.stderr) || `exit ${r.status}`})` };
  try { return JSON.parse(done); } catch { return { error: "unreadable result" }; }
}
// A probe script passes only if it exits 0 and reports through pass() in sk-probe.mjs.
export function runScript(file, dir, { specDir, args, timeoutMs = 30000, env = {} } = {}) {
  const f = path.isAbsolute(file) ? file : path.join(specDir, file);
  if (!fs.existsSync(f)) return { pass: false, detail: `probe script missing: ${file}` };
  // --import sk-resolve.mjs: a probe may import the grader helpers as "@graders/<file>".
  const { r, done } = spawnRunner(["--import", RESOLVE_HOOK, f], dir, "", { ...env, GRADE_BUILD_DIR: dir, GRADE_ARGS: JSON.stringify(args ?? {}) }, timeoutMs);
  if (r.status === 0 && done != null) return { pass: true, detail: done };
  const out = lastLine(r.stdout) || lastLine(r.stderr) || (r.error ? String(r.error.code || r.error.message) : "");
  return { pass: false, detail: r.status === 0 ? `the probe exited before finishing its assertions${out ? `: ${out}` : ""}` : out };
}
function cleanEnv(extra) {
  const { NODE_TEST_CONTEXT, ...rest } = process.env;
  return { ...rest, ...extra };
}

// ---- servers ---------------------------------------------------------------------------
export function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

export function request(base, { method = "GET", path: p = "/", headers = {}, body, timeoutMs = 5000 } = {}) {
  return new Promise((resolve) => {
    let u;
    try { u = new URL(base); } catch (e) { return resolve({ status: 0, error: String(e.message), headers: {}, text: "" }); }
    const data = body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body);
    const h = { ...headers };
    if (data !== undefined) {
      if (!Object.keys(h).some((k) => k.toLowerCase() === "content-type")) h["content-type"] = "application/json";
      h["content-length"] = Buffer.byteLength(data);
    }
    // Node rejects raw spaces and non-latin1 in a request path; encode just those, keep every other byte as sent.
    const wire = String(p).replace(/ /g, "%20").replace(/[^!-ÿ]/g, (c) => encodeURIComponent(c));
    let req;
    try {
      req = http.request({ host: u.hostname, port: u.port, method, path: wire, headers: h, timeout: timeoutMs }, (res) => {
        const chunks = []; let size = 0;
        res.on("data", (c) => { size += c.length; if (size < 1_000_000) chunks.push(c); });
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", (e) => resolve({ status: 0, error: e.message, headers: {}, text: "" }));
      });
    } catch (e) { return resolve({ status: 0, error: String(e.message), headers: {}, text: "" }); }
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (e) => resolve({ status: 0, error: e.message, headers: {}, text: "" }));
    if (data !== undefined) req.write(data);
    req.end();
  });
}
export const jsonOf = (r) => { try { return JSON.parse(r.text); } catch { return undefined; } };
export const getPath = (obj, p) => String(p).split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

// Starts cfg.cmd (a command list; "node" means this Node; an "@spec/" prefix is the spec dir)
// in the build directory with PORT set, and waits until it answers. Returns { ok, base, stop, alive }.
export async function startServer(dir, cfg, specDir) {
  if (!cfg?.cmd?.length) return { ok: false, error: "the spec configures no server" };
  const port = await freePort();
  const cmd = cfg.cmd.map((a) => (String(a).startsWith("@spec/") ? path.join(specDir, String(a).slice(6)) : a));
  const exe = cmd[0] === "node" ? process.execPath : cmd[0];
  // `install: true` mirrors how a user starts a Node project: npm install when the build
  // declares dependencies and has no node_modules yet.
  if (cfg.install) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
      if (Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length && !fs.existsSync(path.join(dir, "node_modules"))) spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir, stdio: "ignore", timeout: cfg.installTimeoutMs || 300000 });
    } catch { /* no package.json: nothing to install */ }
  }
  let log = ""; let exited = null;
  const child = spawn(exe, cmd.slice(1), { cwd: dir, detached: true, stdio: ["ignore", "pipe", "pipe"], env: cleanEnv({ ...(cfg.env || {}), [cfg.portEnv || "PORT"]: String(port), GRADE_BUILD_DIR: dir }) });
  const keep = (c) => { log = (log + c).slice(-2000); };
  child.stdout.on("data", keep); child.stderr.on("data", keep);
  child.on("error", (e) => { exited = `spawn failed: ${e.message}`; });
  child.on("exit", (code, sig) => { exited = `exited ${code ?? sig}`; });
  const base = `http://127.0.0.1:${port}`;
  // The whole process group: `npm start` forks the real server.
  const killGroup = (sig) => { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* already gone */ } } };
  const stop = () => killGroup("SIGKILL");
  // SIGTERM first, so a server that flushes on shutdown is not blamed; SIGKILL after a grace period.
  const stopGracefully = async (graceMs = 1500) => {
    if (exited !== null) return;
    killGroup("SIGTERM");
    const until = Date.now() + graceMs;
    while (exited === null && Date.now() < until) await new Promise((r) => setTimeout(r, 50));
    stop();
    while (exited === null) await new Promise((r) => setTimeout(r, 20));
  };
  const deadline = Date.now() + (cfg.startTimeoutMs || 10000);
  while (Date.now() < deadline && exited === null) {
    const r = await request(base, { path: cfg.readyPath || "/", timeoutMs: 800 });
    if (r.status) return { ok: true, base, port, stop, stopGracefully, alive: () => exited === null, log: () => log, ready: cfg.readyPath || "/" };
    await new Promise((res) => setTimeout(res, 100));
  }
  stop();
  return { ok: false, error: exited ? `server ${exited}: ${lastLine(log)}`.slice(0, 300) : `server did not answer within ${cfg.startTimeoutMs || 10000} ms`, stop() {}, alive: () => false };
}

// ---- files -------------------------------------------------------------------------------
export const SKIP_DIRS = new Set(["node_modules", ".git", ".svc", "coverage"]);
export function walk(dir, { skipTests = true, skip = [] } = {}) {
  const out = [];
  const visit = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (SKIP_DIRS.has(e.name)) continue;
      const rel = path.relative(dir, path.join(d, e.name)).split(path.sep).join("/");
      if (e.isDirectory()) {
        if (skipTests && /^(tests?|__tests__|spec)$/.test(e.name)) continue;
        visit(path.join(d, e.name));
      } else if (e.isFile()) {
        if (skip.some((re) => re.test(rel))) continue;
        out.push(rel);
      }
    }
  };
  if (fs.existsSync(dir)) visit(dir);
  return out.sort();
}
export function readText(file, max = 512 * 1024) {
  try {
    const st = fs.statSync(file);
    if (!st.isFile() || st.size > max) return null;
    const buf = fs.readFileSync(file);
    if (buf.includes(0)) return null;
    return buf.toString("utf8");
  } catch { return null; }
}
