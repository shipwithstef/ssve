import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const free = () => new Promise((r) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => r(port)); }); });
async function boot() {
  const port = await free();
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "yoga-"));
  fs.copyFileSync(new URL("../server.mjs", import.meta.url), path.join(cwd, "server.mjs"));
  const child = spawn(process.execPath, ["server.mjs"], { cwd, env: { ...process.env, PORT: String(port) }, stdio: "ignore" });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) { try { await fetch(base + "/"); break; } catch { await new Promise((r) => setTimeout(r, 100)); } }
  return { base, stop: () => { child.kill(); fs.rmSync(cwd, { recursive: true, force: true }); } };
}
const post = (base, p, b) => fetch(base + p, { method: "POST", body: typeof b === "string" ? b : JSON.stringify(b) });

test("lists classes, books a place and cancels it", async () => {
  const { base, stop } = await boot();
  try {
    const before = await (await fetch(base + "/api/classes")).json();
    const r = await post(base, "/api/book", { classId: "flow", name: "Ana" });
    assert.equal(r.status, 201);
    const { id } = await r.json();
    assert.equal((await (await fetch(base + "/api/classes")).json())[0].left, before[0].left - 1);
    assert.equal((await post(base, "/api/cancel", { id })).status, 200);
    assert.equal((await (await fetch(base + "/api/classes")).json())[0].left, before[0].left);
  } finally { stop(); }
});

test("rejects bad input with a 4xx and keeps serving", async () => {
  const { base, stop } = await boot();
  try {
    assert.equal((await post(base, "/api/book", "{not json")).status, 400);
    assert.equal((await post(base, "/api/book", { classId: "nope", name: "Ana" })).status, 404);
    assert.equal((await post(base, "/api/book", { classId: "flow", name: "" })).status, 400);
    assert.equal((await post(base, "/api/cancel", { id: "nope" })).status, 404);
    assert.equal((await fetch(base + "/elsewhere")).status, 404);
    assert.equal((await fetch(base + "/")).status, 200);
  } finally { stop(); }
});

test("a class that is full refuses the next booking", async () => {
  const { base, stop } = await boot();
  try {
    const n = (await (await fetch(base + "/api/classes")).json()).find((c) => c.id === "yin").left;
    for (let i = 0; i < n; i++) assert.equal((await post(base, "/api/book", { classId: "yin", name: `p${i}` })).status, 201);
    assert.equal((await post(base, "/api/book", { classId: "yin", name: "late" })).status, 409);
  } finally { stop(); }
});
