import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { startCockpit } from "../../scripts/cockpit-serve.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

async function boot(opts = {}) {
  const r = fs.mkdtempSync(path.join(os.tmpdir(), "cockpit-token-"));
  fs.mkdirSync(path.join(r, ".svc"));
  fs.writeFileSync(path.join(r, ".svc", "lane-tasks-WI-1.json"), JSON.stringify({ wi: "WI-1", title: "goal", lane: "feature", tasks: [{ id: 1, skill: "plan-changeset", status: "pending" }] }));
  const c = startCockpit({ repos: [r], port: 0, ...opts });
  await new Promise((ok) => c.server.on("listening", ok));
  return { c, base: `http://127.0.0.1:${c.server.address().port}` };
}

// Everything a client can observe about a response except the Date header.
async function shape(res) {
  const headers = [...res.headers].filter(([k]) => k !== "date").sort();
  return { status: res.status, headers, body: await res.text() };
}

const DATA_ROUTES = ["/api/state", "/api/events"];

test("the token is 32 random bytes, base64url, different per server start", async () => {
  const a = await boot(); const b = await boot();
  try {
    assert.match(a.c.token, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a.c.token, b.c.token);
  } finally { a.c.close(); b.c.close(); }
});

test("the printed URL carries the token only after '#'", async () => {
  const { c, base } = await boot();
  try {
    const u = new URL(c.url);
    assert.equal(u.origin, base);
    assert.equal(u.pathname, "/");
    assert.equal(u.search, "");
    assert.equal(u.hash, `#t=${c.token}`);
    assert.equal(c.url.split("#")[0].includes(c.token), false);
  } finally { c.close(); }
});

test("the CLI prints the token-bearing URL", async () => {
  const child = spawn(process.execPath, [path.join(ROOT, "scripts/cockpit-serve.mjs"), "--port", "0"], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const line = await new Promise((ok, no) => {
      let buf = "";
      child.stdout.on("data", (d) => { buf += d; if (buf.includes("\n")) ok(buf); });
      child.on("error", no); setTimeout(() => no(new Error("no output: " + buf)), 5000);
    });
    assert.match(line, /http:\/\/127\.0\.0\.1:\d+\/#t=[A-Za-z0-9_-]{43}/);
  } finally { child.kill(); }
});

test("without a token every data route answers exactly like an unknown path", async () => {
  const { c, base } = await boot();
  try {
    const unknown = await shape(await fetch(base + "/api/nope"));
    assert.equal(unknown.status, 404);
    for (const p of DATA_ROUTES) {
      assert.deepEqual(await shape(await fetch(base + p)), unknown, p);
    }
  } finally { c.close(); }
});

test("a wrong token (any length, header or query) answers exactly like an unknown path", async () => {
  const { c, base } = await boot();
  try {
    const unknown = await shape(await fetch(base + "/api/nope"));
    const wrong = [c.token.slice(0, -1) + (c.token.endsWith("A") ? "B" : "A"), "x", "", c.token + "x", c.token.slice(1)];
    for (const p of DATA_ROUTES) for (const w of wrong) {
      assert.deepEqual(await shape(await fetch(base + p, { headers: { authorization: `Bearer ${w}` } })), unknown, `${p} header ${w}`);
      assert.deepEqual(await shape(await fetch(`${base}${p}?t=${encodeURIComponent(w)}`)), unknown, `${p} query ${w}`);
    }
    // wrong scheme
    assert.deepEqual(await shape(await fetch(base + "/api/state", { headers: { authorization: `Basic ${c.token}` } })), unknown);
  } finally { c.close(); }
});

test("the right token works on the state route (header)", async () => {
  const { c, base } = await boot();
  try {
    const res = await fetch(base + "/api/state", { headers: { authorization: `Bearer ${c.token}` } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).totals.goals, 1);
  } finally { c.close(); }
});

test("the event stream requires the token and streams with it", async () => {
  const { c, base } = await boot();
  try {
    assert.equal((await fetch(base + "/api/events")).status, 404);
    for (const res of [await fetch(base + "/api/events", { headers: { authorization: `Bearer ${c.token}` } }), await fetch(`${base}/api/events?t=${c.token}`)]) {
      assert.equal(res.status, 200);
      assert.match(res.headers.get("content-type"), /text\/event-stream/);
      const reader = res.body.getReader();
      const { value } = await reader.read();
      assert.match(new TextDecoder().decode(value), /^data: \{/);
      await reader.cancel();
    }
  } finally { c.close(); }
});

test("the query token is accepted only on the event stream, not on the state route", async () => {
  const { c, base } = await boot();
  try {
    const unknown = await shape(await fetch(base + "/api/nope"));
    assert.deepEqual(await shape(await fetch(`${base}/api/state?t=${c.token}`)), unknown);
  } finally { c.close(); }
});

test("the HTML shell needs no token, holds no data and no token, and sends no referrer", async () => {
  const { c, base } = await boot();
  try {
    const res = await fetch(base + "/");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("referrer-policy"), "no-referrer");
    const html = await res.text();
    assert.equal(html.includes(c.token), false);
    assert.equal(html.includes("WI-1"), false);
  } finally { c.close(); }
});

test("the page reads the token from the fragment and sends it", () => {
  const html = fs.readFileSync(path.join(ROOT, "templates/cockpit/live.html"), "utf8");
  assert.match(html, /location\.hash/);
  assert.match(html, /\/api\/events\?t=/);
  assert.doesNotThrow(() => new Function(html.split("<script>")[1].split("</script>")[0]));
});
