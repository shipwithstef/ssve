#!/usr/bin/env node
/**
 * chaos-probe.mjs — hold a running app to its steady state while faults are injected.
 *
 *   node scripts/chaos-probe.mjs --dir <app> --spec <chaos.json> [--out <result.json>]
 *
 * Chaos engineering, sized for a prototype: name the steady state (a command that exits 0
 * while the app behaves), check it holds, inject one fault, check it again. A fault the
 * app does not survive is a finding with its evidence. Principles: steady state as a
 * measurable output, a hypothesis per fault, a small blast radius (one local process).
 *
 * Spec (JSON):
 *   start      command that serves the app on $PORT (default "npm start")
 *   ready      path that answers 2xx once the app is up (default "/")
 *   steady     command run in the app directory with BASE_URL set; exits 0 while the
 *              steady state holds
 *   prepare    optional command (BASE_URL set) run once after the first start of each
 *              fault, to put state in place (a player, some gold) before the fault
 *   endpoints  [{ method, path }] to fuzz and flood (default: the ready path)
 *   faults     subset of restart, malformed, flood, race, latency, clock, bots
 *              (default: every fault the spec has the inputs for)
 *   race       { method, path, body, times } sent concurrently, then steady must hold
 *              (catches duplicated money or items)
 *   latency_ms added each way by a local proxy for the latency fault (default 150)
 *   clock_skew_ms  how far Date.now is moved for the clock fault (default 3 h)
 *   bots       { cmd, seeds } a seeded simulation run once per seed ({seed} is replaced);
 *              every run must exit 0
 *   flood      requests sent at once (default 200)
 */
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { isMain } from "./lib/is-main.mjs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve) => { const s = net.createServer().listen(0, () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
}

async function waitReady(base, ready, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(base + ready); if (r.ok) return true; } catch {}
    await sleep(150);
  }
  return false;
}

async function startApp(dir, spec, env = {}) {
  const port = await freePort();
  const { __noPrepare, ...extra } = env;
  const child = spawn("sh", ["-c", spec.start || "npm start"], { cwd: dir, env: { ...process.env, PORT: String(port), ...extra }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  child.stdout.on("data", (c) => { log = (log + c).slice(-4000); });
  child.stderr.on("data", (c) => { log = (log + c).slice(-4000); });
  const base = `http://127.0.0.1:${port}`;
  const up = await waitReady(base, spec.ready || "/");
  if (up && spec.prepare && !env.__noPrepare) spawnSync("sh", ["-c", spec.prepare], { cwd: dir, encoding: "utf8", timeout: 60000, env: { ...process.env, BASE_URL: base } });
  const stop = () => { try { process.kill(-child.pid, "SIGKILL"); } catch {} };
  return { base, port, up, stop, log: () => log, alive: () => child.exitCode === null };
}

// Asynchronous on purpose: the latency proxy lives in this process, so a blocking child
// would stall the proxy and deadlock the check.
function steady(dir, spec, base) {
  if (!spec.steady) return Promise.resolve({ ok: true, out: "no steady command" });
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", spec.steady], { cwd: dir, env: { ...process.env, BASE_URL: base }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { out += c; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 60000);
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, out: out.trim().slice(-400) }); });
  });
}

async function alive(base, ready) {
  try { return (await fetch(base + ready)).ok; } catch { return false; }
}

const MALFORMED = [
  "{not json", "", "null", "[]", '{"action":"__unknown__"}', '{"id":{"$gt":""}}', '{"x":1e309}',
  JSON.stringify({ action: "a".repeat(5000) }), "x".repeat(1024 * 1024),
];

// Sends one request without throwing; returns the status or 0 when the socket failed.
async function send(base, method, p, body) {
  try { const r = await fetch(base + p, { method, body: method === "GET" ? undefined : body, headers: { "content-type": "application/json" } }); await r.arrayBuffer(); return r.status; }
  catch { return 0; }
}

// A TCP proxy that delays every chunk in both directions.
function latencyProxy(targetPort, delay) {
  return new Promise((resolve) => {
    const server = net.createServer((client) => {
      const upstream = net.connect(targetPort, "127.0.0.1");
      // Data and the end of each stream are delayed alike, so nothing is cut off.
      const pipe = (from, to) => {
        from.on("data", (c) => setTimeout(() => to.write(c), delay));
        from.on("end", () => setTimeout(() => to.end(), delay + 1));
      };
      pipe(client, upstream); pipe(upstream, client);
      const kill = () => { client.destroy(); upstream.destroy(); };
      client.on("error", kill); upstream.on("error", kill);
    }).listen(0, () => resolve({ port: server.address().port, close: () => server.close() }));
  });
}

const FAULTS = {
  async restart(dir, spec) {
    const a = await startApp(dir, spec);
    if (!a.up) { a.stop(); return { pass: false, detail: "app did not start" }; }
    const before = await steady(dir, spec, a.base);
    a.stop(); await sleep(300);
    const b = await startApp(dir, spec, { __noPrepare: true });
    const after = b.up ? await steady(dir, spec, b.base) : { ok: false, out: "app did not come back" };
    b.stop();
    return { pass: before.ok && after.ok, detail: after.ok ? "steady state held across a hard restart" : `after restart: ${after.out}` };
  },
  async malformed(dir, spec) {
    const a = await startApp(dir, spec);
    if (!a.up) { a.stop(); return { pass: false, detail: "app did not start" }; }
    const statuses = [];
    for (const e of spec.endpoints || [{ method: "GET", path: spec.ready || "/" }]) {
      for (const body of MALFORMED) statuses.push(await send(a.base, e.method === "GET" ? "POST" : e.method, e.path, body));
      statuses.push(await send(a.base, "GET", `${e.path}?id=%00%ff&x=${"9".repeat(400)}`));
    }
    const up = a.alive() && await alive(a.base, spec.ready || "/");
    const s = up ? await steady(dir, spec, a.base) : { ok: false, out: a.log() };
    a.stop();
    const errors = statuses.filter((c) => c >= 500).length;
    return { pass: up && s.ok && errors === 0, detail: !up ? `app died on malformed input: ${s.out.slice(-200)}` : errors ? `${errors} malformed requests got a 5xx` : s.ok ? `${statuses.length} malformed requests rejected cleanly` : `steady state broke: ${s.out}` };
  },
  async flood(dir, spec) {
    const a = await startApp(dir, spec);
    if (!a.up) { a.stop(); return { pass: false, detail: "app did not start" }; }
    const n = spec.flood || 200;
    const eps = spec.endpoints || [{ method: "GET", path: spec.ready || "/" }];
    const t0 = Date.now();
    const times = await Promise.all(Array.from({ length: n }, async (_, i) => { const e = eps[i % eps.length]; const s = Date.now(); await send(a.base, e.method, e.path, e.method === "GET" ? undefined : "{}"); return Date.now() - s; }));
    times.sort((x, y) => x - y);
    const p95 = times[Math.floor(times.length * 0.95)];
    const up = a.alive() && await alive(a.base, spec.ready || "/");
    const s = up ? await steady(dir, spec, a.base) : { ok: false, out: "app died under flood" };
    a.stop();
    return { pass: up && s.ok, detail: `${n} requests in ${Date.now() - t0} ms, p95 ${p95} ms; ${s.ok ? "steady state held" : s.out}`, p95_ms: p95 };
  },
  async race(dir, spec) {
    const a = await startApp(dir, spec);
    if (!a.up) { a.stop(); return { pass: false, detail: "app did not start" }; }
    const r = spec.race;
    await Promise.all(Array.from({ length: r.times || 20 }, () => send(a.base, r.method || "POST", r.path, typeof r.body === "string" ? r.body : JSON.stringify(r.body ?? {}))));
    const s = await steady(dir, spec, a.base);
    a.stop();
    return { pass: s.ok, detail: s.ok ? `${r.times || 20} concurrent ${r.path} requests kept the invariant` : `invariant broke under concurrency: ${s.out}` };
  },
  async latency(dir, spec) {
    const a = await startApp(dir, spec);
    if (!a.up) { a.stop(); return { pass: false, detail: "app did not start" }; }
    const proxy = await latencyProxy(a.port, spec.latency_ms ?? 150);
    const s = await steady(dir, spec, `http://127.0.0.1:${proxy.port}`);
    proxy.close(); a.stop();
    return { pass: s.ok, detail: s.ok ? `steady state held with ${spec.latency_ms ?? 150} ms added each way` : `under latency: ${s.out}` };
  },
  async clock(dir, spec) {
    const pre = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "chaos-")), "skew.cjs");
    const skew = spec.clock_skew_ms ?? 3 * 3600 * 1000;
    fs.writeFileSync(pre, `const real = Date.now; Date.now = () => real() + ${skew};\n`);
    const a = await startApp(dir, spec, { NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --require ${pre}`.trim() });
    if (!a.up) { a.stop(); return { pass: false, detail: "app did not start with a skewed clock" }; }
    const s = await steady(dir, spec, a.base);
    a.stop();
    return { pass: s.ok, detail: s.ok ? `steady state held with the server clock ${Math.round(skew / 60000)} min ahead` : `with a skewed clock: ${s.out}` };
  },
  async bots(dir, spec) {
    const fails = [];
    for (let seed = 1; seed <= (spec.bots.seeds || 8); seed++) {
      const r = spawnSync("sh", ["-c", spec.bots.cmd.replaceAll("{seed}", String(seed))], { cwd: dir, encoding: "utf8", timeout: 120000 });
      if (r.status !== 0) fails.push(`seed ${seed}: ${`${r.stdout || ""}${r.stderr || ""}`.trim().slice(-160)}`);
    }
    return { pass: fails.length === 0, detail: fails.length ? fails.slice(0, 3).join("; ") : `${spec.bots.seeds || 8} seeded runs passed` };
  },
};

export function plannedFaults(spec) {
  const has = { race: !!spec.race, bots: !!spec.bots?.cmd };
  const all = Object.keys(FAULTS).filter((f) => has[f] ?? true);
  return spec.faults ? spec.faults.filter((f) => all.includes(f)) : all;
}

export async function probe(dir, spec) {
  const results = [];
  for (const id of plannedFaults(spec)) {
    const t0 = Date.now();
    let r;
    try { r = await FAULTS[id](dir, spec); } catch (e) { r = { pass: false, detail: `probe error: ${e.message}` }; }
    results.push({ fault: id, ...r, ms: Date.now() - t0 });
  }
  const passed = results.filter((r) => r.pass).length;
  return { survival: results.length ? passed / results.length : null, passed, total: results.length, faults: results };
}

async function main(argv) {
  const arg = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
  if (!arg("--dir") || !arg("--spec")) { process.stderr.write("usage: chaos-probe.mjs --dir <app> --spec <chaos.json> [--out <json>]\n"); return 2; }
  const result = await probe(path.resolve(arg("--dir")), JSON.parse(fs.readFileSync(arg("--spec"), "utf8")));
  const text = JSON.stringify(result, null, 2) + "\n";
  if (arg("--out")) fs.writeFileSync(arg("--out"), text); else process.stdout.write(text);
  for (const f of result.faults) process.stderr.write(`${f.pass ? "ok  " : "FAIL"} ${f.fault}: ${f.detail}\n`);
  return result.passed === result.total ? 0 : 1;
}

if (isMain(import.meta.url)) main(process.argv.slice(2)).then((c) => process.exit(c), (e) => { process.stderr.write(`chaos-probe: ${e.message}\n`); process.exit(2); });
