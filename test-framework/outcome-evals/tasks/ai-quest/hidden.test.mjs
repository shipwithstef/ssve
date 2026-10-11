// Grader for the AI-engineering quest: the deterministic layers. Fun, humour, art and how
// well the teaching hides are judged from the build and its screenshots; how much a player
// actually learns is measured separately (scripts/learning-eval.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const quest = async () => (await import(pathToFileURL(path.resolve("game/quest.mjs")).href + `?t=${Math.random()}`)).createQuest;
const IDEAS = ["1", "2", "3", "4", "5", "6", "7", "8"];

// Replay actions on a fresh game; an action not on offer at that moment is skipped and
// reported, so a walkthrough that relies on unavailable actions fails.
async function replay(actions, { strict = true } = {}) {
  const q = (await quest())();
  const skipped = [];
  for (const a of actions) { if (q.state().solved) break; if (!q.actions().includes(a)) { skipped.push(a); if (strict) break; continue; } q.act(a); }
  return { q, skipped };
}

test("contract: the quest module plays in Node and shows its world as text", async () => {
  const q = (await quest())();
  const s = q.state();
  assert.equal(typeof s.scene, "string");
  assert.ok(Array.isArray(s.inventory) && s.solved === false && "dialogue" in s);
  assert.ok(q.actions().length >= 3, "a fresh game offers several actions");
  assert.ok(q.screen().trim().length > 40, "screen() shows the scene");
  for (const a of q.actions().slice(0, 20)) { const r = (await quest())(); const out = r.act(a); assert.equal(typeof out, "string"); assert.ok(out.trim().length > 0, `"${a}" gives the player some text`); }
});

test("solvable: the walkthrough wins from a fresh start and is a real adventure", async () => {
  const w = read("docs/walkthrough.json");
  const { q, skipped } = await replay(w);
  assert.deepEqual(skipped, [], "every walkthrough step is on offer when it is played");
  assert.equal(q.state().solved, true, "the walkthrough wins the game");
  const scenes = new Set(); const r = (await quest())(); for (const a of w) { scenes.add(r.state().scene); r.act(a); }
  assert.ok(w.length >= 15, `at least 15 actions (got ${w.length})`);
  assert.ok(scenes.size >= 4, `at least 4 scenes visited (got ${scenes.size})`);
  assert.ok(w.filter((a) => /^(use|give|show) .+ (on|to) .+/.test(a)).length >= 6, "at least 6 item combinations or hand-overs");
});

test("every lesson is needed: skipping any curriculum action leaves the game unwinnable", async () => {
  const w = read("docs/walkthrough.json"), c = read("docs/curriculum.json");
  assert.deepEqual(Object.keys(c).sort(), IDEAS, "curriculum.json maps all eight ideas");
  for (const id of IDEAS) {
    assert.ok(w.includes(c[id]), `idea ${id}'s action is in the walkthrough`);
    // Lenient replay without that action: everything else still gets its chance.
    const rest = w.filter((a) => a !== c[id]);
    const { q } = await replay([...rest, ...rest], { strict: false });
    assert.equal(q.state().solved, false, `idea ${id} (${c[id]}) can be skipped and the game still won`);
  }
});

// Finish a game from wherever it is, using only the walkthrough's own steps: a step not on
// offer here is looked for by walking the exits ("go to <place>"); a step whose effect has
// already happened is skipped. Several passes, so out-of-order progress still completes.
function finish(q, w) {
  for (let pass = 0; pass < 5 && !q.state().solved; pass++) for (const a of w) {
    if (q.state().solved) return;
    if (q.state().dialogue && !q.actions().includes(a)) { const o = q.actions(); if (o.length) q.act(o[o.length - 1]); }
    const seen = new Set();
    for (let m = 0; m < 12 && !q.actions().includes(a); m++) {
      const exits = q.actions().filter((x) => x.startsWith("go to "));
      if (!exits.length) break;
      const x = exits.find((e) => !seen.has(e)) || exits[m % exits.length];
      seen.add(x); q.act(x);
    }
    if (q.actions().includes(a)) q.act(a);
  }
}

test("no dead ends: after 40 random walks, the walkthrough's own steps still finish the game", async () => {
  const w = read("docs/walkthrough.json");
  let seed = 7; const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let walk = 0; walk < 40; walk++) {
    const q = (await quest())();
    for (let i = 0; i < 80 && !q.state().solved; i++) { const a = q.actions(); assert.ok(a.length > 0, "an unsolved game always offers an action"); q.act(a[rand(a.length)]); }
    finish(q, w);
    assert.equal(q.state().solved, true, `walk ${walk} left the game unwinnable`);
  }
});

test("no dead ends: one wrong move at any point along the walkthrough can always be recovered from", async () => {
  // The risky moves are the ones a player makes on the way: at every step of the
  // walkthrough, try each other action on offer once, then finish from there.
  const w = read("docs/walkthrough.json"), make = await quest();
  const prefix = (i) => { const q = make(); for (const a of w.slice(0, i)) if (q.actions().includes(a)) q.act(a); return q; };
  const traps = [], known = new Set();
  for (let i = 0; i < w.length; i++) {
    for (const dev of prefix(i).actions().filter((a) => a !== w[i])) {
      const q = prefix(i); q.act(dev);
      const k = JSON.stringify(q.state()) + q.screen();
      if (known.has(k)) continue;
      finish(q, w);
      if (q.state().solved) known.add(k); else traps.push(`after step ${i}: "${dev}"`);
    }
  }
  assert.deepEqual(traps.slice(0, 5), [], `${traps.length} moves make the game unwinnable`);
});

test("no dead ends: skipping a step and then making a risky move can always be recovered from", async () => {
  // The classic adventure trap needs two moves: a step not taken (the bottle never
  // stamped), then an irreversible one later (handing it over). Ron Gilbert's rule for
  // the genre: the player should never be stuck without knowing it.
  const w = read("docs/walkthrough.json"), make = await quest();
  const traps = [], known = new Set();
  const t0 = Date.now(); let done = 0;
  for (let j = 0; j < w.length && Date.now() - t0 < 240000; j++, done++) {
    const path = w.filter((_, k) => k !== j);
    for (let i = j; i < path.length; i++) {
      const at = () => { const q = make(); for (const a of path.slice(0, i)) if (q.actions().includes(a)) q.act(a); return q; };
      for (const dev of at().actions().filter((a) => /^(use|give|show) /.test(a) && a !== path[i])) {
        const q = at(); q.act(dev);
        // A state already proven finishable needs no second proof (most wrong moves are
        // jokes that change nothing).
        const k = JSON.stringify(q.state()) + q.screen();
        if (known.has(k)) continue;
        finish(q, w);
        if (q.state().solved) known.add(k); else traps.push(`without "${w[j]}", then "${dev}"`);
      }
    }
  }
  assert.deepEqual(traps.slice(0, 5), [], `${traps.length} move pairs make the game unwinnable`);
  assert.equal(done, w.length, `checked only ${done} of ${w.length} skipped steps in the time limit`);
});

test("teaching stays hidden: no on-screen text lectures", async () => {
  // A lecture line names a curriculum idea in AI terms and defines it. Characters may joke
  // about the ideas; they may not explain them like a textbook.
  const TERMS = /\b(prompt caching|cache|context window|tokens?|held[- ]out|test set|overfit|temperature|sampling|prompt injection|tool use|function call|grounding|hallucinat|citations?|agent loop|stop condition|LLM|language model|AI model)\b/i;
  const DEFINES = /\b(is a (technique|method|way|process)|refers to|means that|is when|in (machine learning|AI)|did you know|lesson|tip:|remember:|this teaches|you learned)\b/i;
  const seen = new Set(); let seed = 3; const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const w = read("docs/walkthrough.json");
  const collect = (t) => { for (const line of String(t).split(/\n|(?<=[.!?])\s+/)) if (line.trim()) seen.add(line.trim()); };
  { const q = (await quest())(); collect(q.screen()); for (const a of w) { if (q.actions().includes(a)) { collect(q.act(a)); collect(q.screen()); } } }
  for (let walk = 0; walk < 20; walk++) { const q = (await quest())(); for (let i = 0; i < 60; i++) { const a = q.actions(); if (!a.length) break; collect(q.act(a[rand(a.length)])); collect(q.screen()); } }
  const lectures = [...seen].filter((l) => TERMS.test(l) && DEFINES.test(l));
  assert.deepEqual(lectures, [], "on-screen text that defines an AI idea like a textbook");
});

// Original work, not a copy: names, places and phrases from the series it is inspired by
// must not appear in anything the player or the public sees.
const SERIES = /\b(monkey island|guybrush|threepwood|lechuck|le chuck|elaine marley|m[eê]l[eé]e island|plunder island|lucre island|scumm bar|stan s\. stanman|murray the|voodoo lady|insult sword ?fighting|herman toothrot|ozzie mandrill|lucasarts|lucasfilm games)\b/i;
test("IP gate: nothing from the series it is inspired by in game content or public copy", () => {
  const leaks = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name);
    if (e.isDirectory()) { if (!["node_modules", ".git", "docs", "test", "tests", "__shots", "scripts"].includes(e.name)) walk(p); }
    else if (/\.(js|mjs|cjs|ts|json|html|css|txt|svg)$/.test(e.name) && !["package-lock.json", "spec.md"].includes(e.name) && !/\.test\.[cm]?js$/.test(e.name) && SERIES.test(fs.readFileSync(p, "utf8"))) leaks.push(p); } };
  walk(".");
  if (fs.existsSync("README.md") && SERIES.test(fs.readFileSync("README.md", "utf8"))) leaks.push("README.md");
  assert.deepEqual(leaks, []);
});

const port = 49000 + Math.floor(Math.random() * 900);
const base = `http://127.0.0.1:${port}`;
let server;
async function startServer() {
  const pkg = read("package.json");
  if (Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length && !fs.existsSync("node_modules")) spawnSync("npm", ["install", "--no-audit", "--no-fund"], { stdio: "ignore", timeout: 300000 });
  server = spawn("npm", ["start"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore", detached: true });
  for (let i = 0; i < 600; i++) { try { if ((await fetch(base + "/")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("npm start did not serve / within 120 s");
}

test("point and click: the walkthrough plays by clicking in the browser, and the keyboard works", async () => {
  await startServer();
  const pw = await import(process.env.OE_PLAYWRIGHT || "playwright");
  const browser = await pw.chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(base + "/", { waitUntil: "load" });
    await page.waitForFunction(() => window.__quest && window.__quest.state(), null, { timeout: 15000 });
    fs.mkdirSync("__shots", { recursive: true });
    await page.screenshot({ path: "__shots/1-start.png" });
    const w = read("docs/walkthrough.json");
    for (const [i, a] of w.entries()) {
      const el = page.locator(`[data-action="${a.replace(/"/g, '\\"')}"]`).first();
      assert.ok(await el.count(), `step ${i + 1}: something clickable performs "${a}"`);
      await el.click();
      if (i === Math.floor(w.length / 2)) await page.screenshot({ path: "__shots/2-middle.png" });
    }
    await page.waitForFunction(() => window.__quest.state().solved === true, null, { timeout: 5000 });
    await page.screenshot({ path: "__shots/3-won.png" });
    // Keyboard: on a fresh page, Tab reaches a clickable thing and Enter performs it.
    const k = await (await browser.newContext()).newPage();
    await k.goto(base + "/", { waitUntil: "load" });
    await k.waitForFunction(() => window.__quest && window.__quest.state());
    const before = await k.evaluate(() => window.__quest.screen());
    let focused = null;
    for (let i = 0; i < 30 && !focused; i++) { await k.keyboard.press("Tab"); focused = await k.evaluate(() => document.activeElement?.getAttribute("data-action")); }
    assert.ok(focused, "Tab reaches something clickable");
    await k.keyboard.press("Enter");
    await k.waitForTimeout(300);
    assert.notEqual(await k.evaluate(() => window.__quest.screen()) + await k.evaluate(() => document.body.innerText), before, "Enter on it does something");
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
    try { process.kill(-server.pid, "SIGKILL"); } catch {}
  }
});

test("docs: the build explains its choices and how it would check that players learn", () => {
  const docs = fs.existsSync("docs") ? fs.readdirSync("docs").filter((f) => f.endsWith(".md")) : [];
  assert.ok(docs.length >= 1, "at least one Markdown file in docs/");
  const text = docs.map((f) => fs.readFileSync(path.join("docs", f), "utf8")).join("\n");
  assert.ok(text.length > 1500, "the docs say something substantial");
});
