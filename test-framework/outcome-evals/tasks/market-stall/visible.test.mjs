import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
test("starting state over HTTP", async (t) => {
  const port = 41000 + Math.floor(Math.random() * 2000);
  const server = spawn(process.execPath, ["server.mjs"], { env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  t.after(() => server.kill());
  let state;
  for (let i = 0; i < 50 && !state; i++) { try { state = await (await fetch(`http://127.0.0.1:${port}/api/state`)).json(); } catch { await new Promise((r) => setTimeout(r, 100)); } }
  assert.equal(state.coins, 100);
  assert.equal(state.day, 1);
  assert.deepEqual(state.prices.apple, { buy: 5, sell: 3 });
});
