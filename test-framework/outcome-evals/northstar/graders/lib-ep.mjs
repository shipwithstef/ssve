// Shared helpers for the E (edge and failure robustness) and P (production basics) graders.
// Hidden graders score the built artifact of either arm; nothing here reads the arm's
// own checks. Everything is deterministic: seeded walks, fixed hostile inputs, no network.
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const NORTHSTAR = path.resolve(HERE, "..");
export const SPECS = path.join(NORTHSTAR, "specs");
export const TASKS = path.resolve(NORTHSTAR, "..", "tasks");
export { taskDirFor, specDirFor, refEpDirFor, extraTaskRoots, taskMaskDirs, isExternalTask, TASK_ROOTS_ENV } from "./task-roots.mjs";
import { taskMaskDirs } from "./task-roots.mjs";
export const REPO_ROOT = path.resolve(NORTHSTAR, "..", "..", "..");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const check = (name, pass, detail = "", extra = {}) => ({ name, pass: Boolean(pass), detail: String(detail ?? "").replace(/\s+/g, " ").slice(0, 400), ...extra });

// score = passed checks / total checks; no checks means no evidence, which scores 0.
export function scoreChecks(checks) {
  const total = checks.length;
  const passed = checks.filter((c) => c.pass).length;
  return { score: total ? +(passed / total).toFixed(4) : 0, checks };
}

// A spec is a list of named checks, each with a known type. Unknown types are a spec error
// (caught when the spec is loaded), never a silent skip.
export const KNOWN_CHECKS = {
  E: ["chaos", "unknown_route", "ui_bad_input", "ui_offline", "ui_walk", "game_bad_input", "game_deadends", "cases", "report_wellformed", "report_finding"],
  P: ["readme", "clean_run", "mutation", "tests_cover", "new_tests", "tests_fail_on_baseline", "web", "occlusion", "report_parses", "report_actionable", "report_severity", "src_unmodified"],
};
export function validateSpec(spec, label = "spec") {
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) throw new Error(`${label}: must be a JSON object`);
  if (!["E", "P"].includes(spec.component)) throw new Error(`${label}: "component" must be "E" or "P"`);
  if (!Array.isArray(spec.checks) || !spec.checks.length) throw new Error(`${label}: "checks" must be a non-empty array`);
  for (const [i, c] of spec.checks.entries()) {
    if (!c || typeof c.type !== "string") throw new Error(`${label}: checks[${i}] needs a "type"`);
    if (!KNOWN_CHECKS[spec.component].includes(c.type)) throw new Error(`${label}: checks[${i}] has unknown type "${c.type}" for ${spec.component}`);
  }
  return spec;
}

// ---------------------------------------------------------------------------------------
// Containment. Everything the artifact makes us run (install, start, test, mutation, library
// cases) runs with a private temporary HOME and npm cache and a minimal environment (no host
// credentials), and under bubblewrap when it exists: the whole filesystem read-only except
// the work directory and that private home, the task folders (answers) masked.

const jails = new Map(); // work dir -> private home
const liveGroups = new Set();
const TOOLING_ENV = ["PATH", "LANG", "LC_ALL", "TERM"];

// Artifact code never runs without a verified containment backend. The backend is probed once
// with a real bubblewrap launch (installed is not enough: unprivileged user namespaces may be
// disabled). OE_NO_BUILDER_SANDBOX=1 disables it, which means artifact code does not run at all.
let sandboxProbe = null;
export function resetSandboxProbe() { sandboxProbe = null; }
export function sandboxStatus() {
  if (sandboxProbe) return sandboxProbe;
  if (process.env.OE_NO_BUILDER_SANDBOX === "1") return (sandboxProbe = { ok: false, backend: null, reason: "the sandbox is disabled (OE_NO_BUILDER_SANDBOX=1) and artifact code is not run uncontained" });
  const which = spawnSync("sh", ["-c", "command -v bwrap"], { encoding: "utf8" });
  if (which.status !== 0) return (sandboxProbe = { ok: false, backend: null, reason: "bubblewrap (bwrap) is not installed" });
  const t = spawnSync("bwrap", ["--ro-bind", "/", "/", "--dev", "/dev", "--proc", "/proc", "--unshare-pid", "--die-with-parent", "--", "true"], { encoding: "utf8", timeout: 15000 });
  if (t.status !== 0) return (sandboxProbe = { ok: false, backend: null, reason: `bubblewrap cannot start a sandbox here: ${`${t.stderr || t.error?.message || ""}`.trim().slice(0, 140)}` });
  return (sandboxProbe = { ok: true, backend: "bwrap", reason: null });
}
export const bwrapAvailable = () => sandboxStatus().ok;
export class NoSandboxError extends Error {
  constructor(reason) { super(`no sandbox: ${reason}`); this.name = "NoSandboxError"; this.code = "NO_SANDBOX"; }
}
export function requireSandbox() {
  const st = sandboxStatus();
  if (!st.ok) throw new NoSandboxError(st.reason);
  return st;
}
// Check types that run the build's own code; the others only read files.
export const RUNS_ARTIFACT = new Set(["chaos", "unknown_route", "ui_bad_input", "ui_offline", "ui_walk", "game_bad_input", "game_deadends", "cases", "clean_run", "mutation", "tests_fail_on_baseline", "web", "occlusion"]);
export function requireSandboxFor(spec) {
  if (spec.checks.some((c) => RUNS_ARTIFACT.has(c.type))) requireSandbox();
}

export function jailHome(workDir) {
  const key = path.resolve(workDir);
  if (!jails.has(key)) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "ns-home-"));
    fs.mkdirSync(path.join(home, "tmp"), { recursive: true });
    jails.set(key, home);
  }
  return jails.get(key);
}
export function releaseJail(workDir) {
  const key = path.resolve(workDir);
  const home = jails.get(key);
  if (home) { fs.rmSync(home, { recursive: true, force: true }); jails.delete(key); }
}

// The in-repo tasks directory and every external task root, except one that holds the work dir.
export function innerMasks(work, dirs = taskMaskDirs()) {
  const w = path.resolve(work);
  return dirs.filter((d) => w !== d && !w.startsWith(d + path.sep));
}

// The command line and environment for running argv inside the jail of workDir.
export function containedCommand(workDir, argv, { env = {}, rw = [] } = {}) {
  requireSandbox();
  const home = jailHome(workDir);
  const work = path.resolve(workDir);
  const base = Object.fromEntries(TOOLING_ENV.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  const full = { ...base, HOME: home, npm_config_cache: path.join(home, ".npm"), XDG_CACHE_HOME: path.join(home, ".cache"), TMPDIR: "/tmp", CI: "1", ...env };
  const mask = innerMasks(work).flatMap((d) => ["--tmpfs", d]);
  const binds = [work, home, ...rw].flatMap((d) => ["--bind", d, d]);
  return { bin: "bwrap", args: ["--ro-bind", "/", "/", "--tmpfs", "/tmp", ...binds, ...mask, "--dev", "/dev", "--proc", "/proc", "--unshare-pid", "--die-with-parent", "--chdir", work, "--", ...argv], env: full, sandbox: "bwrap" };
}

export function runContainedSync(workDir, argv, { cwd = workDir, env = {}, timeoutMs = 120000, rw = [] } = {}) {
  const c = containedCommand(workDir, argv, { env, rw });
  const r = spawnSync(c.bin, c.args, { cwd, encoding: "utf8", timeout: timeoutMs, env: c.env, maxBuffer: 8 * 1024 * 1024 });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "", timedOut: r.error?.code === "ETIMEDOUT", out: `${r.stdout || ""}\n${r.stderr || ""}` };
}

export function spawnContained(workDir, argv, { cwd = workDir, env = {}, rw = [] } = {}) {
  const c = containedCommand(workDir, argv, { env, rw });
  const child = spawn(c.bin, c.args, { cwd, env: c.env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  liveGroups.add(child.pid);
  child.on("close", () => liveGroups.delete(child.pid));
  child.on("error", () => {});
  return child;
}
export const killGroup = (child, signal = "SIGKILL") => { try { process.kill(-child.pid, signal); } catch {} };

// Runs a node script in the jail with a hard deadline: SIGTERM to its process group, then
// SIGKILL two seconds later. Resolves { status, stdout, stderr, timedOut }.
export function runNodeContained(workDir, script, args, { timeoutMs = 120000, env = {}, rw = [] } = {}) {
  return new Promise((resolve) => {
    const child = spawnContained(workDir, [process.execPath, script, ...args], { env, rw });
    let stdout = "", stderr = "", timedOut = false;
    child.stdout.on("data", (c) => { stdout = (stdout + c).slice(-200000); });
    child.stderr.on("data", (c) => { stderr = (stderr + c).slice(-20000); });
    const t1 = setTimeout(() => { timedOut = true; killGroup(child, "SIGTERM"); }, timeoutMs);
    const t2 = setTimeout(() => killGroup(child), timeoutMs + 2000);
    child.on("close", (status) => { clearTimeout(t1); clearTimeout(t2); killGroup(child); resolve({ status, stdout, stderr, timedOut }); });
  });
}

process.on("exit", () => {
  for (const pid of liveGroups) { try { process.kill(-pid, "SIGKILL"); } catch {} }
  for (const home of jails.values()) { try { fs.rmSync(home, { recursive: true, force: true }); } catch {} }
});

// One request with a time limit and a cap on the bytes read; never throws.
export async function boundedFetch(url, init = {}, { ms = 5000, bytes = 1_000_000 } = {}) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
    const reader = res.body?.getReader();
    let total = 0; const parts = []; let truncated = false;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length; parts.push(value);
      if (total > bytes) { truncated = true; await reader.cancel().catch(() => {}); break; }
    }
    return { status: res.status, headers: res.headers, text: Buffer.concat(parts).toString("utf8"), truncated };
  } catch (e) { return { status: 0, headers: new Headers(), text: "", truncated: false, error: String(e.message || e) }; }
}

// ---------------------------------------------------------------------------------------
// Working copies

// A copy of the build as the arm left it. Kept artifacts exclude node_modules, so a build
// that declares dependencies gets them installed here (the same step its README tells).
// `clean: true` leaves node_modules behind and installs nothing: the README run-path starts
// from exactly what a fresh clone has.
export function workCopy(dir, { deps = true, clean = false } = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "ns-ep-"));
  const skip = clean ? /[\\/](\.git|node_modules)([\\/]|$)/ : /[\\/]\.git([\\/]|$)/;
  fs.cpSync(dir, work, { recursive: true, filter: (s) => !skip.test(s) && !/[\\/]__hidden[^\\/]*$/.test(s) });
  const notes = [];
  if (deps && !clean && hasDependencies(work) && !fs.existsSync(path.join(work, "node_modules"))) {
    const r = runContainedSync(work, ["npm", "install", "--ignore-scripts", "--no-audit", "--no-fund"], { timeoutMs: 180000 });
    if (r.status !== 0) notes.push(`npm install failed: ${r.out.trim().slice(-160)}`);
  }
  return { dir: work, notes, cleanup: () => { releaseJail(work); fs.rmSync(work, { recursive: true, force: true }); } };
}

export function readPackage(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")); } catch { return null; }
}
export function hasDependencies(dir) {
  const p = readPackage(dir);
  return Boolean(p && Object.keys({ ...p.dependencies, ...p.devDependencies }).length);
}

// The documented start command is what a user runs. When the build's package.json has no
// "start" script but the task contract says `node server.mjs`, the contract command is
// registered so tools that run `npm start` (web-probes) can launch it.
export function ensureStartScript(dir, start) {
  const p = readPackage(dir) || {};
  if (p.scripts?.start) return;
  const m = /^node\s+(\S+)$/.exec(start || "");
  if (!m) return;
  p.scripts = { ...(p.scripts || {}), start: `node ${m[1]}` };
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", ...p }, null, 2) + "\n");
}

// ---------------------------------------------------------------------------------------
// Running the app

export function freePort() {
  return new Promise((resolve) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
}

export async function waitReady(base, readyPath = "/", ms = 20000, child = null) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (child && child.exitCode !== null) return false;
    try { const r = await fetch(base + readyPath, { signal: AbortSignal.timeout(2000), redirect: "manual" }); await r.body?.cancel().catch(() => {}); if (r.status >= 200 && r.status < 400) return true; } catch {}
    await sleep(150);
  }
  return false;
}

// Starts `start` on a free PORT in dir; resolves { base, up, stop, log }.
export async function startApp(dir, { start = "npm start", ready = "/", env = {}, waitMs = 20000 } = {}) {
  const port = await freePort();
  const child = spawnContained(dir, ["sh", "-c", start], { env: { PORT: String(port), ...env } });
  let log = "";
  const grab = (c) => { log = (log + c).slice(-3000); };
  child.stdout.on("data", grab); child.stderr.on("data", grab);
  const base = `http://127.0.0.1:${port}`;
  const up = await waitReady(base, ready, waitMs, child);
  const stop = () => killGroup(child);
  return { base, port, up, stop, log: () => log, alive: () => child.exitCode === null };
}

export async function withApp(dir, opts, fn) {
  const app = await startApp(dir, opts);
  try { return await fn(app); } finally { app.stop(); }
}

// ---------------------------------------------------------------------------------------
// Playwright

let pwEntry;
export function playwrightEntry() {
  if (pwEntry !== undefined) return pwEntry;
  if (process.env.OE_PLAYWRIGHT) return (pwEntry = process.env.OE_PLAYWRIGHT);
  const root = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout?.trim() || "";
  const entry = path.join(root, "playwright", "index.mjs");
  return (pwEntry = fs.existsSync(entry) ? entry : "playwright");
}

// Playwright wants one exact browser revision. When the machine has the package but only other
// revisions of the same browser, a temporary browsers directory links the expected name to the
// newest installed one. On a machine whose browser matches this does nothing.
let browserProbe = null;
const launchProbe = () => spawnSync(process.execPath, ["--input-type=module", "-e", `const pw = await import(${JSON.stringify(playwrightEntry())}); const b = await pw.chromium.launch(); await b.close();`], { encoding: "utf8", timeout: 60000 });
const firstLine = (r) => { const lines = `${r.stderr || r.stdout || r.error?.message || ""}`.split("\n").map((l) => l.trim()).filter((l) => l && !/^[╔║╚]/.test(l)); return lines.find((l) => /Error|Cannot find|doesn't exist|ERR_/.test(l)) || lines[0] || "unknown error"; };
// { ok, reason }: whether a headless Chromium can be launched here. Tests that need one skip
// with this reason; graders turn it into failed checks, never into a pass.
export function browserStatus() {
  if (browserProbe) return browserProbe;
  let probe = launchProbe();
  if (probe.status !== 0) {
    const m = /Executable doesn't exist at (\S+)/.exec(`${probe.stderr}${probe.stdout}`);
    const at = m ? m[1].indexOf("/ms-playwright/") : -1;
    if (m && at >= 0) {
      const root = m[1].slice(0, at + "/ms-playwright".length);
      const dirName = m[1].slice(root.length + 1).split("/")[0];
      const prefix = dirName.replace(/-\d+$/, "");
      const have = fs.existsSync(root) ? fs.readdirSync(root).filter((n) => n.startsWith(`${prefix}-`)).sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop())) : [];
      if (have.length) {
        const shim = fs.mkdtempSync(path.join(os.tmpdir(), "ns-pw-"));
        fs.symlinkSync(path.join(root, have[0]), path.join(shim, dirName));
        process.env.PLAYWRIGHT_BROWSERS_PATH = shim;
        probe = launchProbe();
      }
    }
  }
  return (browserProbe = probe.status === 0 ? { ok: true, reason: null } : { ok: false, reason: `Playwright cannot launch Chromium: ${firstLine(probe).slice(0, 160)}` });
}
export function ensureBrowser() {
  const st = browserStatus();
  if (!st.ok) throw new Error(`no browser: ${st.reason}`);
}

export async function withBrowser(fn) {
  ensureBrowser();
  const pw = await import(playwrightEntry());
  const browser = await pw.chromium.launch();
  try { return await fn(browser); } finally { await browser.close().catch(() => {}); }
}

// Seeded generator so every walk is the same for both arms.
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return (n) => { s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff; return s % n; };
}

export const CONTROLS = "button:visible, a[href]:visible, input[type=submit]:visible, [role=button]:visible, [data-action]:visible, summary:visible";

export const HOSTILE = [
  "", "   ", "<script>window.__ns_xss=1</script>", "'; DROP TABLE users;--", "9".repeat(400), "-1", "0", "1e309", "NaN",
  "\u0000\u0001", "😀".repeat(60), "a".repeat(5000), "../../etc/passwd", "{\"$gt\":\"\"}",
];

export function attachWatch(page, base) {
  const w = { errors: [], serverErrors: [], requests: [] };
  page.on("pageerror", (e) => w.errors.push(`pageerror: ${String(e).slice(0, 160)}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|net::ERR/.test(m.text())) w.errors.push(`console: ${m.text().slice(0, 160)}`); });
  page.on("response", (r) => {
    let u; try { u = new URL(r.url()); } catch { return; }
    if (u.origin !== new URL(base).origin) return;
    if (r.status() >= 500) w.serverErrors.push(`${r.request().method()} ${u.pathname} -> ${r.status()}`);
    const t = r.request().resourceType();
    if (t === "fetch" || t === "xhr") w.requests.push({ method: r.request().method(), path: u.pathname });
  });
  return w;
}

// Same-origin pages reachable by links from "/" (breadth first) plus a few common entry
// points, so forms behind a navigation step are found without knowing the product's routes.
// With `ctx` the pages are read in that browser context (a signed-in session stays signed in);
// otherwise a fresh anonymous context is used.
export async function discoverPages(browser, base, { max = 8, extra = [], ctx: given = null } = {}) {
  const origin = new URL(base).origin;
  const seen = new Set(["/"]);
  const order = ["/"];
  const ctx = given || await browser.newContext();
  const page = await ctx.newPage();
  const watch = attachWatch(page, base);
  try {
    for (let i = 0; i < order.length && order.length < max; i++) {
      try { await page.goto(base + order[i], { waitUntil: "load", timeout: 8000 }); } catch { continue; }
      const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
      for (const h of hrefs) {
        let u; try { u = new URL(h, origin + order[i]); } catch { continue; }
        if (u.origin !== origin || u.hash && u.pathname === order[i]) continue;
        const p = u.pathname + u.search;
        if (!seen.has(p) && order.length < max) { seen.add(p); order.push(p); }
      }
    }
    for (const p of extra) {
      if (seen.has(p) || order.length >= max + extra.length) continue;
      const r = await boundedFetch(base + p, {}, { ms: 3000, bytes: 100000 });
      if (r.status === 200 && /html/.test(r.headers.get("content-type") || "")) { seen.add(p); order.push(p); }
    }
  } finally { await page.close().catch(() => {}); if (!given) await ctx.close().catch(() => {}); }
  return { pages: order, requests: watch.requests };
}

// Routes that answer 200 only to a signed-in user, tried in order when a spec names none.
export const DEFAULT_AUTH_PATHS = ["/api/me", "/api/session", "/api/user", "/api/account", "/api/bookings", "/me", "/account", "/bookings", "/profile", "/dashboard"];
const ANON_REFUSED = [401, 403, 301, 302, 303, 307, 308];

// Signed in means a route that refuses an anonymous visitor answers 200 in this browser
// context (same cookies). Nothing else counts: a form that was merely submitted proves nothing.
export async function verifyAuth(ctx, base, paths = DEFAULT_AUTH_PATHS) {
  for (const p of paths) {
    try {
      const authed = await ctx.request.get(base + p, { maxRedirects: 0, timeout: 4000 });
      if (authed.status() !== 200) continue;
      const anon = await boundedFetch(base + p, { redirect: "manual" }, { ms: 4000, bytes: 100000 });
      if (ANON_REFUSED.includes(anon.status)) return { ok: true, path: p };
    } catch {}
  }
  return { ok: false };
}

// Best-effort sign-in: a visible password field marks a form; the other visible fields get a
// fixed test identity, the form is submitted, and the session is verified with verifyAuth.
// Registration pages are tried after login pages, then login again with the same identity.
// Returns { attempted, authenticated, via } and never throws.
export async function loginAuto(ctx, page, base, { verify = DEFAULT_AUTH_PATHS } = {}) {
  const result = { attempted: false, authenticated: false, via: null };
  const order = ["/login", "/signin", "/sign-in", "/", "/register", "/signup", "/sign-up", "/login", "/signin"];
  try {
    for (const p of order) {
      await page.goto(base + p, { waitUntil: "load", timeout: 6000 }).catch(() => {});
      if (!(await page.locator("input[type=password]:visible").count())) continue;
      result.attempted = true;
      for (const f of await page.$$("input:visible, textarea:visible")) {
        const type = (await f.getAttribute("type")) || "text";
        const hint = `${await f.getAttribute("name")} ${await f.getAttribute("id")} ${await f.getAttribute("placeholder")} ${await f.getAttribute("autocomplete")}`.toLowerCase();
        if (type === "password") await f.fill("Passw0rd!test").catch(() => {});
        else if (type === "email" || /e-?mail/.test(hint)) await f.fill("grader@example.com").catch(() => {});
        else if (["text", "search", "tel"].includes(type)) await f.fill(/phone|tel/.test(hint) ? "0400000000" : /user/.test(hint) ? "grader" : "Grader Test").catch(() => {});
        else if (type === "checkbox") await f.check().catch(() => {});
      }
      const submit = page.locator("button[type=submit]:visible, input[type=submit]:visible, form button:visible").first();
      if (await submit.count()) await submit.click({ timeout: 2000 }).catch(() => {}); else await page.keyboard.press("Enter");
      await page.waitForLoadState("load", { timeout: 4000 }).catch(() => {});
      await sleep(400);
      const v = await verifyAuth(ctx, base, verify);
      if (v.ok) return { attempted: true, authenticated: true, via: v.path };
    }
  } catch {}
  return result;
}

// ---------------------------------------------------------------------------------------
// Case runner (library tasks): each case is one child process with a time limit, so a build
// that hangs or crashes costs one failed check, never the grader.

export function runCase(workDir, kase, defaults = {}, timeoutMs = 20000) {
  const home = jailHome(workDir);
  const file = path.join(home, `case-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify({ module: defaults.module, ...kase }));
  try {
    const limit = kase.timeout_ms || timeoutMs;
    const r = runContainedSync(workDir, [process.execPath, path.join(HERE, "runner-ep.mjs"), file], { env: { ...(kase.env || {}), NODE_TEST_CONTEXT: "" }, timeoutMs: limit });
    if (r.timedOut) return { ok: false, detail: `timed out after ${limit} ms` };
    const line = r.stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop();
    if (!line) return { ok: false, detail: `runner produced no result: ${r.stderr.trim().slice(-200)}` };
    return JSON.parse(line);
  } finally { fs.rmSync(file, { force: true }); }
}

// ---------------------------------------------------------------------------------------
// Review reports (security-payments writes SECURITY.json)

export function readFindings(dir, file = "SECURITY.json") {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const list = Array.isArray(j) ? j : Array.isArray(j?.findings) ? j.findings : null;
    return list;
  } catch { return null; }
}

export const SEVERITY_RANK = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function findingMatches(f, want) {
  return String(f?.file || "").endsWith(want.file) && Math.abs(Number(f?.line) - want.line) <= (want.tolerance ?? 3) && new RegExp(want.words, "i").test(`${f?.issue || ""} ${f?.title || ""}`);
}

// ---------------------------------------------------------------------------------------
// README commands. Only strings from the spec's allowlist are ever executed; the README
// is only searched for them.

export function findReadme(dir) {
  const f = fs.readdirSync(dir).find((n) => /^readme(\.md|\.txt)?$/i.test(n));
  return f ? path.join(dir, f) : null;
}

// The first allowlisted command the README text contains, or null.
export function documentedCommand(readmeText, allowlist = []) {
  const text = String(readmeText || "");
  return allowlist.find((c) => text.includes(c)) ?? null;
}

export function runShell(cmd, cwd, timeoutMs = 120000, env = {}) {
  const r = runContainedSync(cwd, ["sh", "-c", cmd], { timeoutMs, env });
  return { status: r.status, out: r.out, timedOut: r.timedOut };
}

export function countPassed(out) {
  const m = /^(?:# |ℹ )pass (\d+)/m.exec(out);
  return m ? Number(m[1]) : 0;
}

export function listFiles(dir, skip = /(^|\/)(node_modules|\.git|data|coverage)(\/|$)/) {
  const out = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); const rel = path.relative(dir, p).split(path.sep).join("/"); if (skip.test(rel)) continue; e.isDirectory() ? walk(p) : out.push(rel); } };
  if (fs.existsSync(dir)) walk(dir);
  return out.sort();
}

export function testFiles(dir) {
  return listFiles(dir).filter((f) => /\.(m|c)?[jt]s$/.test(f) && (/(^|\/)(test|tests|__tests__)\//.test(f) || /[._-]test\.(m|c)?[jt]s$/.test(f)) && !f.startsWith("__"));
}
export function countCases(dir) {
  return testFiles(dir).reduce((a, f) => a + (fs.readFileSync(path.join(dir, f), "utf8").match(/\b(test|it)\s*\(\s*["'`]/g) || []).length, 0);
}
