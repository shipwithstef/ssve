// Generic smoke grader: the product runs, loads, and survives a click-through.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
const port = 45000 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${port}`;
let server;
test.before(async () => {
  server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  for (let i = 0; i < 80; i++) { try { await fetch(base + "/"); return; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  throw new Error("server did not start on PORT");
});
test.after(() => server?.kill());
test("serves an HTML page", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  assert.match(await r.text(), /<(html|body|div|button|main)/i);
});
test("loads and survives clicking through its controls in a real browser", async () => {
  const pw = await import(process.env.OE_PLAYWRIGHT || "playwright");
  const browser = await pw.chromium.launch();
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // Chromium logs every non-2xx response as a console error; a handled 400 is not a defect.
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    await page.goto(base + "/", { waitUntil: "networkidle" });
    // A product page leads with links and forms as often as buttons: any visible control counts.
    const buttons = page.locator("button:visible, a[href]:visible, input[type=submit]:visible, [role=button]:visible");
    const n = await buttons.count();
    assert.ok(n >= 2, `at least two interactive controls (found ${n})`);
    for (let i = 0; i < Math.min(n, 15); i++) { try { await buttons.nth(i).click({ timeout: 2000 }); await page.goto(base + "/", { waitUntil: "networkidle" }); } catch {} }
    await page.waitForTimeout(300);
    assert.deepEqual(errors, [], "no page errors or console errors");
    assert.ok((await page.textContent("body")).trim().length > 40, "the page shows content");
  } finally { await browser.close(); }
});
