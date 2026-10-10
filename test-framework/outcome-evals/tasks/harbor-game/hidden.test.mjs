// Grader for the game benchmark: the deterministic layers. Taste (loop, progression,
// feel, UX, art direction) is judged from the screenshots this grader saves to __shots/.
//   1. separation: the rules import in Node with no browser globals
//   2. contract: actions/step/state, a JSON state with a numeric score and boolean over
//   3. determinism: same seed and inputs, same game; a different seed, a different game
//   4. seed bots: 8 bots x 3000 steps; no exception, no NaN, no softlock, idle loses
//   5. browser: zero errors while played, window.__game live, frame p95 under 20 ms
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawn } from "node:child_process";

let logic;
const load = async () => (logic ??= await import("./game/logic.mjs"));
const finite = (v) => typeof v === "number" ? Number.isFinite(v) : Array.isArray(v) ? v.every(finite) : v && typeof v === "object" ? Object.values(v).every(finite) : true;

function play(seed, bot, steps = 3000, dt = 50) {
  const g = logic.createGame(seed);
  const trace = [];
  for (let i = 0; i < steps; i++) {
    const s = g.state();
    if (s.over) break;
    const acts = g.actions();
    if (!acts.length) throw new Error(`softlock at step ${i}: no actions while not over`);
    g.step(bot(acts, i, s), dt);
    if (i % 100 === 0) trace.push(JSON.stringify(g.state()));
  }
  return { state: g.state(), trace };
}

test("separation: game/logic.mjs runs in Node without browser globals", async () => {
  assert.equal(typeof globalThis.window, "undefined");
  const m = await load();
  assert.equal(typeof m.createGame, "function");
});

test("contract: actions, step and a JSON state with score and over", async () => {
  await load();
  const g = logic.createGame(1);
  const acts = g.actions();
  assert.ok(Array.isArray(acts) && acts.length > 0 && acts.every((a) => typeof a === "string"));
  g.step(acts[0], 50); g.step(null, 50);
  const s = g.state();
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s, "state is JSON-serialisable");
  assert.equal(typeof s.score, "number");
  assert.equal(typeof s.over, "boolean");
});

test("determinism: same seed and inputs give the same game; seeds matter", async () => {
  await load();
  const bot = (acts, i) => (i % 7 === 0 ? acts[i % acts.length] : null);
  assert.deepEqual(play(42, bot).trace, play(42, bot).trace);
  const a = play(1, bot, 1200).trace.join(), b = play(2, bot, 1200).trace.join();
  assert.notEqual(a, b, "different seeds give different games");
});

test("seed bots: eight bots play without crashing, NaN or softlock", async () => {
  await load();
  const r = (seed) => { let s = seed; return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff); };
  const bots = [
    ...[1, 2, 3, 4].map((k) => { const rnd = r(k); return (acts) => (rnd() < 0.3 ? acts[Math.floor(rnd() * acts.length)] : null); }),
    (acts) => acts[0],
    (acts, i) => acts[i % acts.length],
    (acts) => acts[acts.length - 1],
    () => "not-an-action",
  ];
  bots.forEach((bot, k) => {
    const { state } = play(100 + k, bot);
    assert.ok(finite(state), `bot ${k}: state has no NaN or Infinity`);
  });
});

test("a player who does nothing eventually loses", async () => {
  await load();
  assert.equal(play(7, () => null, 12000).state.over, true, "idle for 10 minutes of game time");
});

test("browser: plays with zero errors, exposes window.__game and keeps frames under 20 ms", async () => {
  const port = 46000 + Math.floor(Math.random() * 2000);
  const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  const pw = await import(process.env.OE_PLAYWRIGHT || "playwright");
  const browser = await pw.chromium.launch();
  try {
    for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${port}/`); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "load" });
    fs.mkdirSync("__shots", { recursive: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: "__shots/1-start.png" });
    for (const k of ["Space", "Enter"]) await page.keyboard.press(k);
    await page.mouse.click(640, 400);
    const keys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "KeyW", "KeyS", "KeyA", "KeyD"];
    for (let i = 0; i < 40; i++) { await page.keyboard.press(keys[i % keys.length]); await page.waitForTimeout(60); if (i === 20) await page.screenshot({ path: "__shots/2-play.png" }); }
    const frames = await page.evaluate(() => new Promise((done) => {
      const t = []; let prev = performance.now();
      const tick = (now) => { t.push(now - prev); prev = now; t.length < 150 ? requestAnimationFrame(tick) : done(t); };
      requestAnimationFrame(tick);
    }));
    await page.waitForTimeout(4000);
    await page.screenshot({ path: "__shots/3-later.png" });
    const live = await page.evaluate(() => { const g = window.__game; return !!g && typeof g.step === "function" && typeof g.state === "function" && typeof g.actions === "function"; });
    const sorted = frames.slice(10).sort((x, y) => x - y);
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    assert.deepEqual(errors, [], "no page or console errors while played");
    assert.ok(live, "window.__game is the running game");
    assert.ok(p95 < 20, `p95 frame interval ${p95?.toFixed(1)} ms`);
  } finally {
    await browser.close();
    server.kill();
  }
});
