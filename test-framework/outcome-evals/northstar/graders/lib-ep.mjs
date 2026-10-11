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
export const REPO_ROOT = path.resolve(NORTHSTAR, "..", "..", "..");

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const check = (name, pass, detail = "") => ({ name, pass: Boolean(pass), detail: String(detail ?? "").replace(/\s+/g, " ").slice(0, 400) });

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
    const r = spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: work, encoding: "utf8", timeout: 180000 });
    if (r.status !== 0) notes.push(`npm install failed: ${`${r.stderr || r.stdout || ""}`.trim().slice(-160)}`);
  }
  return { dir: work, notes, cleanup: () => fs.rmSync(work, { recursive: true, force: true }) };
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
    try { const r = await fetch(base + readyPath, { signal: AbortSignal.timeout(2000) }); if (r.status < 500) return true; } catch {}
    await sleep(150);
  }
  return false;
}

// Starts `start` on a free PORT in dir; resolves { base, up, stop, log }.
export async function startApp(dir, { start = "npm start", ready = "/", env = {}, waitMs = 20000 } = {}) {
  const port = await freePort();
  const child = spawn("sh", ["-c", start], { cwd: dir, env: { ...process.env, PORT: String(port), ...env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  const grab = (c) => { log = (log + c).slice(-3000); };
  child.stdout.on("data", grab); child.stderr.on("data", grab);
  child.on("error", () => {});
  const base = `http://127.0.0.1:${port}`;
  const up = await waitReady(base, ready, waitMs, child);
  const stop = () => { try { process.kill(-child.pid, "SIGKILL"); } catch {} };
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
let browserReady = false;
export function ensureBrowser() {
  if (browserReady) return;
  browserReady = true;
  const probe = spawnSync(process.execPath, ["--input-type=module", "-e", `const pw = await import(${JSON.stringify(playwrightEntry())}); const b = await pw.chromium.launch(); await b.close();`], { encoding: "utf8", timeout: 60000 });
  if (probe.status === 0) return;
  const m = /Executable doesn't exist at (\S+)/.exec(`${probe.stderr}${probe.stdout}`);
  if (!m) return;
  const at = m[1].indexOf("/ms-playwright/");
  if (at < 0) return;
  const root = m[1].slice(0, at + "/ms-playwright".length);
  const dirName = m[1].slice(root.length + 1).split("/")[0];
  const prefix = dirName.replace(/-\d+$/, "");
  const have = fs.readdirSync(root).filter((n) => n.startsWith(`${prefix}-`)).sort((a, b) => Number(b.split("-").pop()) - Number(a.split("-").pop()));
  if (!have.length) return;
  const shim = fs.mkdtempSync(path.join(os.tmpdir(), "ns-pw-"));
  fs.symlinkSync(path.join(root, have[0]), path.join(shim, dirName));
  process.env.PLAYWRIGHT_BROWSERS_PATH = shim;
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
export async function discoverPages(browser, base, { max = 8, extra = [] } = {}) {
  const origin = new URL(base).origin;
  const seen = new Set(["/"]);
  const order = ["/"];
  const ctx = await browser.newContext();
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
      try { const r = await fetch(base + p, { signal: AbortSignal.timeout(3000) }); if (r.status === 200 && /html/.test(r.headers.get("content-type") || "")) { seen.add(p); order.push(p); } } catch {}
    }
  } finally { await ctx.close().catch(() => {}); }
  return { pages: order, requests: watch.requests };
}

// Best-effort sign-in for products that need one: find a visible password field, fill the
// other visible text-like fields with a fixed test identity and submit. Returns whether a
// form was found and submitted; never throws.
export async function loginAuto(page, base) {
  try {
    const candidates = ["/", "/login", "/signin", "/sign-in", "/register", "/signup", "/sign-up", "/account"];
    for (const p of candidates) {
      await page.goto(base + p, { waitUntil: "load", timeout: 6000 }).catch(() => {});
      if (!(await page.locator("input[type=password]:visible").count())) continue;
      const fields = await page.$$("input:visible, textarea:visible");
      for (const f of fields) {
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
      return true;
    }
  } catch {}
  return false;
}

// ---------------------------------------------------------------------------------------
// Case runner (library tasks): each case is one child process with a time limit, so a build
// that hangs or crashes costs one failed check, never the grader.

export function runCase(workDir, kase, defaults = {}, timeoutMs = 20000) {
  const file = path.join(os.tmpdir(), `ns-case-${process.pid}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(file, JSON.stringify({ module: defaults.module, ...kase }));
  try {
    const r = spawnSync(process.execPath, [path.join(HERE, "runner-ep.mjs"), file], {
      cwd: workDir, encoding: "utf8", timeout: kase.timeout_ms || timeoutMs,
      env: { ...process.env, ...(kase.env || {}), NODE_TEST_CONTEXT: "" },
    });
    if (r.error?.code === "ETIMEDOUT") return { ok: false, detail: `timed out after ${kase.timeout_ms || timeoutMs} ms` };
    const line = `${r.stdout || ""}`.trim().split("\n").filter((l) => l.startsWith("{")).pop();
    if (!line) return { ok: false, detail: `runner produced no result: ${`${r.stderr || ""}`.trim().slice(-200)}` };
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
  const { NODE_TEST_CONTEXT, ...base } = process.env;
  const r = spawnSync("sh", ["-c", cmd], { cwd, encoding: "utf8", timeout: timeoutMs, env: { ...base, CI: "1", ...env } });
  const out = `${r.stdout || ""}\n${r.stderr || ""}`;
  return { status: r.status, out, timedOut: r.error?.code === "ETIMEDOUT" };
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
