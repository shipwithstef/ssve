#!/usr/bin/env node
/**
 * web-probes.mjs — measure a built web app's design/UI, performance and security in a real
 * browser, as numbers rather than judge opinions.
 *
 *   node scripts/web-probes.mjs --dir <build> [--play-s 20]
 *   node scripts/web-probes.mjs prove                       (planted good vs bad builds)
 *   node scripts/web-probes.mjs score <results.json...> --out <file>   (kept eval builds)
 *
 * The build is started like the outcome-eval hidden graders do (npm start with PORT). Apps
 * that expose the benchmark hook window.__game ({ state(), act(a), actions() }) are also
 * played by seeded bots; other apps get the page-level probes only. Every metric is a
 * number, a boolean or null with a reason; a probe that cannot run never passes silently.
 *
 * Design/UI   axe-core violations (serious+critical, WCAG 2 A/AA), colour-contrast failures,
 *             share of interactive controls reachable by Tab, horizontal overflow at 390 px,
 *             console/page errors while used, distinct colours on screen.
 * Performance load to first interactive state, JS bytes transferred, p95 frame interval
 *             with 1 and 4 players, server p95 for GET / while 4 players act, server memory
 *             growth over the play period.
 * Security    script execution from player-supplied text (XSS), acting as another player
 *             by swapping ids in captured requests or socket frames, security headers on /,
 *             throttling of a request flood.
 *
 * Grounding: axe-core is the W3C-aligned accessibility engine used by Lighthouse; frame and
 * latency percentiles follow the RAIL model (16 ms frames, 100 ms responses); the security
 * probes are OWASP Top 10 classes (A03 injection/XSS, A01 broken access control, A05
 * misconfiguration, A04 missing rate limits). Proven against planted good and bad builds in
 * test-framework/evals/tier-1/validate-web-probes.mjs.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { isMain } from "./lib/is-main.mjs";

// WEB_PROBES_NPM_ROOT overrides where playwright and axe-core are looked up (tests use it to
// prove the no-browser refusal).
const npmRoot = () => process.env.WEB_PROBES_NPM_ROOT ?? (spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout?.trim() || "");
const globalModule = (name, file) => { const p = path.join(npmRoot(), name, file); return fs.existsSync(p) ? p : null; };
const XSS = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(1) : null; };
const safe = async (fn) => { try { return await fn(); } catch (e) { return { value: null, reason: String(e?.message || e).slice(0, 200) }; } };

// Start the build like the hidden graders: install if it has dependencies, npm start on PORT.
export async function startApp(dir, port) {
  const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  const hasDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0;
  if (hasDeps && !fs.existsSync(path.join(dir, "node_modules"))) spawnSync("npm", ["install", "--no-audit", "--no-fund"], { cwd: dir, stdio: "ignore", timeout: 300000 });
  const server = spawn("npm", ["start"], { cwd: dir, env: { ...process.env, PORT: String(port) }, stdio: "ignore", detached: true });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 600; i++) { try { if ((await fetch(base + "/")).ok) return { server, base }; } catch {} await sleep(200); }
  try { process.kill(-server.pid, "SIGKILL"); } catch {}
  throw new Error("npm start did not serve / within 120 s");
}

// Resident memory of every process in the server's group, in MB.
function groupRssMb(pgid) {
  const r = spawnSync("ps", ["-eo", "pgid=,rss="], { encoding: "utf8" });
  const kb = (r.stdout || "").split("\n").map((l) => l.trim().split(/\s+/)).filter(([g]) => Number(g) === pgid).reduce((a, [, rss]) => a + Number(rss || 0), 0);
  return kb ? +(kb / 1024).toFixed(1) : null;
}

async function openPlayer(browser, base, viewport = { width: 1280, height: 800 }, entry = "/", ctxOptions = {}) {
  const ctx = await browser.newContext({ viewport, ...ctxOptions });
  const page = await ctx.newPage();
  const errors = [], requests = [], frames = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on("request", (r) => { const u = new URL(r.url()); if (u.origin === base && r.method() !== "GET") requests.push({ method: r.method(), url: r.url(), body: r.postData() }); });
  page.on("websocket", (ws) => ws.on("framesent", (f) => frames.push({ url: ws.url(), payload: typeof f.payload === "string" ? f.payload : null })));
  const t0 = Date.now();
  await page.goto(base + entry, { waitUntil: "load" });
  const game = await page.waitForFunction(() => window.__game && window.__game.state() && window.__game.state().you, null, { timeout: 15000 }).then(() => true, () => false);
  return { page, errors, requests, frames, game, ready_ms: Date.now() - t0 };
}

const framesP95 = (page) => page.evaluate(() => new Promise((done) => { const t = []; let prev = performance.now(); const tick = (now) => { t.push(now - prev); prev = now; t.length < 120 ? requestAnimationFrame(tick) : done(t.slice(10)); }; requestAnimationFrame(tick); })).then((t) => pct(t, 0.95));
const pos = async (page) => page.evaluate(() => { const s = window.__game?.state(); return JSON.stringify([s?.you?.x, s?.you?.y]); });

async function bot(page, ms) {
  const acts = await page.evaluate(() => window.__game.actions());
  const end = Date.now() + ms; let i = 0;
  while (Date.now() < end) { await page.evaluate((a) => window.__game.act(a), acts[i++ % acts.length]); await page.waitForTimeout(80); }
}

async function design(browser, base, axePath, p1) {
  const out = {};
  out.console_errors = { value: p1.errors.length };
  out.axe = await safe(async () => {
    if (!axePath) return { value: null, reason: "axe-core not installed (npm i -g axe-core@4.10.2)" };
    // axe is injected into its own page with CSP bypassed, so a build's Content-Security-
    // Policy neither blocks the audit nor shows up as a console error the probe caused.
    const audit = await openPlayer(browser, base, undefined, "/", { bypassCSP: true });
    await audit.page.addScriptTag({ path: axePath });
    const r = await audit.page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } }));
    await audit.page.context().close();
    const bad = r.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    return { value: bad.reduce((a, v) => a + v.nodes.length, 0), contrast_failures: (r.violations.find((v) => v.id === "color-contrast")?.nodes.length) || 0, rules: bad.map((v) => v.id) };
  });
  out.keyboard = await safe(async () => {
    const total = await p1.page.evaluate(() => [...document.querySelectorAll("button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter((e) => e.offsetParent !== null).length);
    if (!total) return { value: null, reason: "no interactive controls on the page" };
    const seen = new Set();
    for (let i = 0; i < Math.min(40, total * 2); i++) { await p1.page.keyboard.press("Tab"); const id = await p1.page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; if (!a.dataset.__k) a.dataset.__k = String(Math.random()); return a.dataset.__k; }); if (id) seen.add(id); }
    return { value: +(Math.min(seen.size, total) / total).toFixed(2), reachable: seen.size, controls: total };
  });
  out.phone_overflow = await safe(async () => {
    const phone = await openPlayer(browser, base, { width: 390, height: 844 });
    const o = await phone.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    await phone.page.context().close();
    return { value: o > 1, overflow_px: o };
  });
  out.distinct_colours = await safe(async () => ({ value: await p1.page.evaluate(() => {
    const q = (r, g, b) => `${r >> 4},${g >> 4},${b >> 4}`, set = new Set();
    const add = (c) => { const m = c && c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/); if (m && (m[4] === undefined || +m[4] > 0.1)) set.add(q(+m[1], +m[2], +m[3])); };
    for (const e of document.querySelectorAll("body, body *")) { if (e.offsetParent === null && e !== document.body) continue; const s = getComputedStyle(e); add(s.color); add(s.backgroundColor); add(s.borderTopColor); }
    for (const c of document.querySelectorAll("canvas")) { try { const ctx = c.getContext("2d"); if (!ctx) continue; const d = ctx.getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < d.length; i += 4 * 97) if (d[i + 3] > 25) set.add(q(d[i], d[i + 1], d[i + 2])); } catch {} }
    return set.size;
  }) }));
  return out;
}

async function performance(browser, base, p1, server, playS) {
  const out = {};
  out.ready_ms = { value: p1.ready_ms };
  out.js_kb = await safe(async () => ({ value: await p1.page.evaluate(() => Math.round(performance.getEntriesByType("resource").filter((r) => r.initiatorType === "script" || /\.m?js(\?|$)/.test(r.name)).reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0) / 1024)) }));
  if (!p1.game) return { ...out, note: "no window.__game hook: frame, load and memory probes need bot play" };
  out.frame_p95_1p = await safe(async () => ({ value: await framesP95(p1.page) }));
  const others = [];
  const rss0 = groupRssMb(server.pid);
  const four = await safe(async () => {
    for (let i = 0; i < 3; i++) others.push(await openPlayer(browser, base));
    const lat = [];
    const play = Promise.all([p1, ...others].map((p) => bot(p.page, playS * 1000)));
    const sample = (async () => { const end = Date.now() + playS * 1000; while (Date.now() < end) { const t = Date.now(); try { await (await fetch(base + "/")).arrayBuffer(); lat.push(Date.now() - t); } catch { lat.push(5000); } await sleep(150); } })();
    const frame = await framesP95(p1.page);
    await Promise.all([play, sample]);
    return { frame, lat };
  });
  out.frame_p95_4p = four.value === null ? four : { value: four.frame };
  out.server_p95_ms = four.value === null ? four : { value: pct(four.lat, 0.95), samples: four.lat.length };
  const rss1 = groupRssMb(server.pid);
  out.memory_growth_mb = rss0 && rss1 ? { value: +(rss1 - rss0).toFixed(1), start_mb: rss0, end_mb: rss1 } : { value: null, reason: "server memory not readable" };
  for (const o of others) await o.page.context().close();
  return out;
}

async function security(browser, base, p1) {
  const out = {};
  out.headers = await safe(async () => {
    const h = (await fetch(base + "/")).headers;
    const present = ["content-security-policy", "x-content-type-options"].filter((k) => h.get(k));
    if (h.get("x-frame-options") || /frame-ancestors/.test(h.get("content-security-policy") || "")) present.push("framing");
    return { value: present.length, of: 3, present };
  });
  // XSS: put the payload everywhere a player can type, then look for execution in this
  // player's page and in a second player's page (stored XSS).
  out.xss = await safe(async () => {
    const watcher = await openPlayer(browser, base);
    const page = p1.page;
    const inputs = await page.$$("input[type=text], input:not([type]), textarea");
    for (const el of inputs) { try { await el.fill(XSS); await el.press("Enter"); } catch {} }
    const textActs = p1.game ? (await page.evaluate(() => window.__game.actions())).filter((x) => /say|chat|name|shout|whisper|rename|emote/i.test(x)) : [];
    for (const a of textActs) await page.evaluate(([a, x]) => { try { window.__game.act(a, x); } catch {} }, [a, XSS]);
    const viaUrl = await openPlayer(browser, base, undefined, "/?name=" + encodeURIComponent(XSS) + "&q=" + encodeURIComponent(XSS)).catch(() => null);
    await sleep(1500);
    const fired = [await page.evaluate(() => window.__xss || 0), await watcher.page.evaluate(() => window.__xss || 0), viaUrl ? await viaUrl.page.evaluate(() => window.__xss || 0) : 0];
    await watcher.page.context().close(); if (viaUrl) await viaUrl.page.context().close();
    const surfaces = ["url", ...(inputs.length ? [`${inputs.length} text inputs`] : []), ...(textActs.length ? textActs : [])];
    return { value: fired.some((n) => n > 0), self: fired[0], other_player: fired[1], url: fired[2], surfaces, ...(surfaces.length === 1 ? { note: "only the URL was tried: the page has no text inputs or text actions" } : {}) };
  });
  // Impersonation: replay player A's own requests and socket frames with player B's id in
  // place of A's; if B moves while B is idle, the server trusts the id the client sends.
  out.impersonation = await safe(async () => {
    if (!p1.game) return { value: null, reason: "no window.__game hook to read player ids" };
    const b = await openPlayer(browser, base);
    const idA = String(await p1.page.evaluate(() => window.__game.state().you.id)), idB = String(await b.page.evaluate(() => window.__game.state().you.id));
    const acts = await p1.page.evaluate(() => window.__game.actions());
    for (let i = 0; i < 8; i++) await p1.page.evaluate((a) => window.__game.act(a), acts[i % acts.length]);
    await sleep(500);
    const before = await pos(b.page);
    const swap = (s) => (s || "").split(idA).join(idB);
    // B's position is checked after every replay, because replayed moves can cancel out.
    let replayed = 0, moved = false;
    const check = async () => { await sleep(250); if ((await pos(b.page)) !== before) moved = true; };
    for (const r of p1.requests.filter((r) => (r.body || "").includes(idA) || r.url.includes(idA)).slice(0, 20)) { await fetch(swap(r.url), { method: r.method, body: swap(r.body), headers: { "content-type": "application/json" } }).catch(() => {}); replayed++; await check(); if (moved) break; }
    for (const f of moved ? [] : p1.frames.filter((f) => f.payload && f.payload.includes(idA)).slice(0, 20)) {
      replayed++;
      await p1.page.evaluate((f) => new Promise((done) => { const ws = new WebSocket(f.url); ws.onopen = () => { ws.send(f.payload); setTimeout(() => { ws.close(); done(); }, 200); }; ws.onerror = () => done(); }), { url: f.url, payload: swap(f.payload) });
      await check(); if (moved) break;
    }
    await b.page.context().close();
    if (!replayed) return { value: false, replayed: 0, note: "the client never sends its own id; identity is bound to the connection" };
    return { value: moved, replayed };
  });
  out.throttled = await safe(async () => {
    const target = p1.requests[0] || { method: "GET", url: base + "/" };
    const codes = await Promise.all(Array.from({ length: 300 }, () => fetch(target.url, { method: target.method, body: target.method === "GET" ? undefined : target.body || "{}", headers: { "content-type": "application/json" } }).then((r) => r.status, () => 0)));
    return { value: codes.some((c) => c === 429 || c === 503), target: `${target.method} ${new URL(target.url).pathname}`, statuses: [...new Set(codes)] };
  });
  return out;
}

export async function probeWeb(dir, { playS = 20, port = 48000 + Math.floor(Math.random() * 1500) } = {}) {
  const pwPath = globalModule("playwright", "index.mjs");
  const pw = await import(pwPath || "playwright");
  const axePath = globalModule("axe-core", "axe.min.js");
  const { server, base } = await startApp(dir, port);
  const browser = await pw.chromium.launch();
  try {
    const p1 = await openPlayer(browser, base);
    const d = await design(browser, base, axePath, p1);
    const perf = await performance(browser, base, p1, server, playS);
    d.console_errors = { value: p1.errors.length, sample: p1.errors.slice(0, 3) };
    const sec = await security(browser, base, p1);
    return { dir, game_hook: p1.game, design: d, performance: perf, security: sec };
  } finally {
    await browser.close().catch(() => {});
    try { process.kill(-server.pid, "SIGKILL"); } catch {}
  }
}

// Prove the probes on planted builds: every metric must score the good fixture better than
// the bad one (test-framework/evals/tier-1/fixtures/web-probes/server.mjs).
export async function prove({ playS = 8 } = {}) {
  if (!globalModule("playwright", "index.mjs")) { const e = new Error("playwright is not installed (npm i -g playwright); the web probes need a browser"); e.code = 3; throw e; }
  const fixture = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "test-framework", "evals", "tier-1", "fixtures", "web-probes", "server.mjs");
  const run = async (mode) => {
    const dir = fs.mkdtempSync(path.join((await import("node:os")).tmpdir(), `web-probe-${mode}-`));
    fs.copyFileSync(fixture, path.join(dir, "server.mjs"));
    fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ type: "module", scripts: { start: `MODE=${mode} node server.mjs` } }));
    try { return await probeWeb(dir, { playS }); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  const good = await run("good"), bad = await run("bad");
  const v = (r, a, k) => r[a][k]?.value;
  const checks = [
    ["design.axe", v(good, "design", "axe") === 0 && v(bad, "design", "axe") > 0],
    ["design.contrast", good.design.axe.contrast_failures === 0 && bad.design.axe.contrast_failures > 0],
    ["design.phone_overflow", v(good, "design", "phone_overflow") === false && v(bad, "design", "phone_overflow") === true],
    ["design.console_errors", v(good, "design", "console_errors") === 0 && v(bad, "design", "console_errors") > 0],
    ["performance.frame_p95_1p", v(good, "performance", "frame_p95_1p") < 25 && v(bad, "performance", "frame_p95_1p") >= 25],
    ["performance.memory_growth_mb", v(bad, "performance", "memory_growth_mb") - v(good, "performance", "memory_growth_mb") > 20],
    ["security.xss", v(good, "security", "xss") === false && v(bad, "security", "xss") === true],
    ["security.impersonation", v(good, "security", "impersonation") === false && v(bad, "security", "impersonation") === true],
    ["security.headers", v(good, "security", "headers") === 3 && v(bad, "security", "headers") === 0],
    ["security.throttled", v(good, "security", "throttled") === true && v(bad, "security", "throttled") === false],
  ].map(([metric, separates]) => ({ metric, separates: Boolean(separates) }));
  return { ok: checks.every((c) => c.separates), checks, good, bad };
}

// Probe every kept build listed in outcome-eval result files (rows with .artifact).
export async function scoreResults(files, { playS = 20 } = {}) {
  const rows = [];
  for (const f of files) for (const r of JSON.parse(fs.readFileSync(f, "utf8")).rows) {
    if (!r.artifact || !fs.existsSync(r.artifact)) { rows.push({ source: path.basename(f), arm: r.arm, rep: r.rep, error: "artifact missing" }); continue; }
    try { rows.push({ source: path.basename(f), arm: r.arm, rep: r.rep, artifact: r.artifact, ...(await probeWeb(r.artifact, { playS })) }); }
    catch (e) { rows.push({ source: path.basename(f), arm: r.arm, rep: r.rep, artifact: r.artifact, error: String(e.message || e).slice(0, 200) }); }
    process.stderr.write(`web-probes: ${path.basename(f)} ${r.arm}#${r.rep} done\n`);
  }
  return { ran_at: new Date().toISOString(), play_s: playS, rows };
}

if (isMain(import.meta.url)) {
  if (process.argv[2] === "score") {
    const argv = process.argv.slice(3), oi = argv.indexOf("--out");
    const out = oi >= 0 ? argv[oi + 1] : null, files = argv.filter((a, i) => a !== "--out" && i !== oi + 1);
    scoreResults(files).then((r) => { const t = JSON.stringify(r, null, 2) + "\n"; if (out) fs.writeFileSync(out, t); else process.stdout.write(t); process.exit(0); }, (e) => { process.stderr.write(`web-probes: ${e.message}\n`); process.exit(1); });
  } else if (process.argv[2] === "prove") {
    prove().then((r) => { process.stdout.write(JSON.stringify({ ok: r.ok, checks: r.checks }, null, 2) + "\n"); if (!r.ok) process.stderr.write(JSON.stringify({ good: r.good, bad: r.bad }) + "\n"); process.exit(r.ok ? 0 : 1); },
      (e) => { process.stderr.write(`web-probes: ${e.message}\n`); process.exit(e.code === 3 ? 3 : 1); });
  } else {
  const argv = process.argv.slice(2);
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
  const dir = arg("--dir");
  if (!dir) { process.stderr.write("usage: web-probes.mjs --dir <build> [--play-s 20] [--json]\n"); process.exit(2); }
  probeWeb(path.resolve(dir), { playS: Number(arg("--play-s", 20)) }).then((r) => { process.stdout.write(JSON.stringify(r, null, 2) + "\n"); process.exit(0); }, (e) => { process.stderr.write(`web-probes: ${e.message}\n`); process.exit(1); });
}
}
