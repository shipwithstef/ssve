import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const port = 43000 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${port}`;
let server;
const api = async (method, path, body, raw) => { const r = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: raw ?? (body === undefined ? undefined : JSON.stringify(body)) }); let j = null; try { j = await r.json(); } catch {} return { status: r.status, body: j }; };
test.before(async () => {
  server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  for (let i = 0; i < 80; i++) { try { await fetch(base + "/api/state"); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error("server did not start");
});
test.after(() => server?.kill());
test("api: prices escalate per item per day and reset next day", async () => {
  await api("POST", "/api/reset");
  const paid = [];
  for (let i = 0; i < 6; i++) { const before = (await api("GET", "/api/state")).body.coins; const r = await api("POST", "/api/buy", { item: "apple" }); assert.equal(r.status, 200); paid.push(before - r.body.coins); }
  assert.deepEqual(paid, [5, 6, 6, 7, 7, 8]);
  let s = (await api("GET", "/api/state")).body;
  assert.deepEqual(s.inventory, { apple: 6 });
  assert.deepEqual(s.prices.bread, { buy: 12, sell: 7 }, "other items unaffected");
  assert.equal(s.prices.apple.buy, 8);
  s = (await api("POST", "/api/next-day")).body;
  assert.equal(s.day, 2);
  assert.equal(s.coins, 61 + Math.floor(61 * 5 / 100));
  assert.equal(s.prices.apple.buy, 5);
});
test("api: sell price, not_owned, inventory hides zero", async () => {
  await api("POST", "/api/reset");
  await api("POST", "/api/buy", { item: "sword" });
  let r = await api("POST", "/api/sell", { item: "sword" });
  assert.equal(r.status, 200);
  assert.equal(r.body.coins, 100 - 80 + 48);
  assert.deepEqual(r.body.inventory, {});
  r = await api("POST", "/api/sell", { item: "sword" });
  assert.deepEqual([r.status, r.body], [400, { error: "not_owned" }]);
  assert.equal((await api("GET", "/api/state")).body.coins, 68, "failed action changes nothing");
});
test("api: insufficient coins and daily limit", async () => {
  await api("POST", "/api/reset");
  await api("POST", "/api/buy", { item: "sword" });
  let r = await api("POST", "/api/buy", { item: "sword" });
  assert.deepEqual([r.status, r.body], [400, { error: "insufficient_coins" }]);
  await api("POST", "/api/reset");
  for (let i = 0; i < 10; i++) assert.equal((await api("POST", "/api/buy", { item: "apple" })).status, 200, `apple #${i + 1} costs within 100 coins`);
  r = await api("POST", "/api/buy", { item: "apple" });
  assert.deepEqual([r.status, r.body], [400, { error: "daily_limit" }]);
  await api("POST", "/api/next-day");
  assert.equal((await api("POST", "/api/buy", { item: "apple" })).status, 200, "limit resets next day");
});
test("api: bad requests and routing", async () => {
  await api("POST", "/api/reset");
  assert.deepEqual(await api("POST", "/api/buy", { item: "gold" }), { status: 400, body: { error: "unknown_item" } });
  assert.deepEqual(await api("POST", "/api/buy", undefined, "{not json"), { status: 400, body: { error: "bad_request" } });
  assert.deepEqual(await api("POST", "/api/sell", { thing: 1 }), { status: 400, body: { error: "bad_request" } });
  assert.equal((await api("GET", "/api/nope")).status, 404);
  const s = (await api("GET", "/api/state")).body;
  assert.deepEqual(Object.keys(s.prices).sort(), ["apple", "bread", "sword"]);
});
test("e2e: the page plays the game in a real browser", async () => {
  const pw = await import(process.env.OE_PLAYWRIGHT || "playwright");
  const browser = await pw.chromium.launch();
  try {
    await api("POST", "/api/reset");
    const page = await browser.newPage();
    await page.goto(base + "/");
    const text = (id) => page.getByTestId(id).textContent().then((t) => t.trim());
    await page.waitForFunction(() => document.querySelector('[data-testid="coins"]')?.textContent.trim() === "100");
    assert.equal(await text("day"), "1");
    assert.equal(await text("price-apple"), "5");
    assert.equal(await text("owned-apple"), "0");
    await page.getByTestId("buy-apple").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="coins"]')?.textContent.trim() === "95");
    assert.equal(await text("owned-apple"), "1");
    assert.equal(await text("price-apple"), "6");
    await page.getByTestId("sell-bread").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="error"]')?.textContent.trim() === "not_owned");
    await page.getByTestId("buy-bread").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="owned-bread"]')?.textContent.trim() === "1");
    assert.equal(await text("error"), "", "error clears after success");
    await page.getByTestId("next-day").click();
    await page.waitForFunction(() => document.querySelector('[data-testid="day"]')?.textContent.trim() === "2");
    assert.equal(await text("coins"), String(83 + Math.floor(83 * 5 / 100)));
    assert.equal(await text("price-apple"), "5");
  } finally { await browser.close(); }
});
