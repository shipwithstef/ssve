// Grader for the founder RPG benchmark: the deterministic layers. Founder layers that
// cannot be computed (research, design, monetization, cost, compliance memo, launch,
// taste) are judged from docs/, the code and the screenshots this grader saves.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";

const port = 47000 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${port}`;
let server;
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

test.before(async () => {
  const hasDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0;
  if (hasDeps && !fs.existsSync("node_modules")) spawnSync("npm", ["install", "--no-audit", "--no-fund"], { stdio: "ignore", timeout: 300000 });
  server = spawn("npm", ["start"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore", detached: true });
  for (let i = 0; i < 300; i++) { try { if ((await fetch(base + "/")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("npm start did not serve / on PORT within 60 s");
});
test.after(() => { try { process.kill(-server.pid, "SIGKILL"); } catch {} });

async function players(n) {
  const pw = await import(process.env.OE_PLAYWRIGHT || "playwright");
  const browser = await pw.chromium.launch();
  const pages = [], errors = [];
  for (let i = 0; i < n; i++) {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForFunction(() => window.__game && window.__game.state() && window.__game.state().you, null, { timeout: 15000 });
    pages.push(page);
  }
  return { browser, pages, errors };
}
const st = (p) => p.evaluate(() => window.__game.state());
const moveAction = (acts) => acts.find((a) => /north|south|east|west|up|down|left|right|move/i.test(a)) || acts[0];

test("solo: one player can play; actions change the world without errors", async () => {
  const { browser, pages, errors } = await players(1);
  try {
    const [p] = pages;
    const before = JSON.stringify(await st(p));
    const acts = await p.evaluate(() => window.__game.actions());
    assert.ok(Array.isArray(acts) && acts.length > 0, "actions() lists inputs");
    for (let i = 0; i < 30; i++) await p.evaluate((a) => window.__game.act(a), acts[i % acts.length]);
    await p.waitForTimeout(800);
    fs.mkdirSync("__shots", { recursive: true });
    await p.screenshot({ path: "__shots/1-solo.png" });
    assert.notEqual(JSON.stringify(await st(p)), before, "playing changes the state");
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("multiplayer: two players share a world and see each other move", async () => {
  const { browser, pages, errors } = await players(2);
  try {
    const [a, b] = pages;
    const idA = (await st(a)).you.id, idB = (await st(b)).you.id;
    assert.notEqual(idA, idB);
    await a.waitForFunction((id) => window.__game.state().players.some((p) => p.id === id), idB, { timeout: 8000 });
    await b.waitForFunction((id) => window.__game.state().players.some((p) => p.id === id), idA, { timeout: 8000 });
    const seen = async () => (await st(a)).players.find((p) => p.id === idB);
    const start = await seen();
    const acts = await b.evaluate(() => window.__game.actions());
    for (let i = 0; i < 6; i++) { await b.evaluate((x) => window.__game.act(x), moveAction(acts)); await b.waitForTimeout(120); }
    await a.waitForFunction(([id, x, y]) => { const p = window.__game.state().players.find((q) => q.id === id); return p && (p.x !== x || p.y !== y); }, [idB, start.x, start.y], { timeout: 8000 });
    await a.screenshot({ path: "__shots/2-together.png" });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test("load: four players at once all see four players, frames stay under 25 ms", async () => {
  const { browser, pages, errors } = await players(4);
  try {
    const ids = await Promise.all(pages.map(async (p) => (await st(p)).you.id));
    for (const p of pages) await p.waitForFunction((ids) => ids.every((id) => window.__game.state().players.some((q) => q.id === id)), ids, { timeout: 10000 });
    const frames = await pages[0].evaluate(() => new Promise((done) => { const t = []; let prev = performance.now(); const tick = (now) => { t.push(now - prev); prev = now; t.length < 120 ? requestAnimationFrame(tick) : done(t); }; requestAnimationFrame(tick); }));
    const sorted = frames.slice(10).sort((x, y) => x - y);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    await pages[0].screenshot({ path: "__shots/3-four.png" });
    assert.ok(p95 < 25, `p95 frame interval ${p95?.toFixed(1)} ms`);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

// "Inspired by" is not "copied from": names and places from Tolkien's works in anything a
// player or the public sees are an IP risk. docs/ may discuss them (the legal memo must).
const TOLKIEN = /\b(middle[- ]earth|tolkien|lord of the rings|lotro|mordor|gondor|rohan|the shire|hobbits?|frodo|bilbo|samwise|gandalf|saruman|sauron|aragorn|legolas|gimli|elrond|galadriel|rivendell|lothl[oó]rien|moria|isengard|minas tirith|nazg[uû]l|mithril|palant[ií]r|ents?wood|balrog|uruk[- ]hai)\b/i;
test("IP gate: no Tolkien names or places in shipped game content or public copy", () => {
  const hits = [];
  const walk = (dir) => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "docs", "__shots"].includes(e.name) || e.name.startsWith("__")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|mjs|cjs|ts|json|html|css|md|txt|yaml|yml)$/.test(e.name) && !["package-lock.json", "spec.md"].includes(e.name)) {
      const m = TOLKIEN.exec(fs.readFileSync(p, "utf8")); if (m) hits.push(`${p}: ${m[0]}`);
    }
  } };
  walk(".");
  assert.deepEqual(hits, []);
});

test("founder docs exist: decisions are written down in docs/", () => {
  const docs = fs.existsSync("docs") ? fs.readdirSync("docs").filter((f) => f.endsWith(".md")) : [];
  assert.ok(docs.length >= 4, `found ${docs.length} Markdown files in docs/`);
});
