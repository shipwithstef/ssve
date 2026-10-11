#!/usr/bin/env node
/**
 * cockpit-serve.mjs — the live orchestration cockpit, on this machine.
 *
 *   node scripts/cockpit-serve.mjs [--repo <dir>]... [--port 4317]
 *
 * Open the printed address in a browser. The page shows every goal as a workflow lane and
 * updates the moment any orchestrator writes its task graph: the server watches each
 * repository's .svc folder and pushes the new state over server-sent events. Nothing to
 * install, no account, no build step; it only listens on 127.0.0.1.
 *
 * Read access is gated by a random per-start token (32 bytes, base64url). The terminal
 * prints it in the URL fragment (http://127.0.0.1:<port>/#t=<token>); a fragment is never
 * sent to the server, so it stays out of logs and Referer. The page reads it from
 * location.hash and sends it on every data request:
 *   - fetch: `Authorization: Bearer <token>` on every GET route;
 *   - EventSource cannot set headers, so /api/events (only) also accepts `?t=<token>`.
 *     A query parameter was chosen over a cookie because cookies are not port-scoped: any
 *     other local server on 127.0.0.1 would receive it (and could set one), and an
 *     ambient cookie adds CSRF surface. The query token reaches no log (this server logs
 *     nothing), and the page sends `Referrer-Policy: no-referrer` and strips the hash.
 * A missing or wrong token gets byte-for-byte the response an unknown path gets. The HTML
 * shell holds no data and needs no token.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { buildState } from "./cockpit-state.mjs";

const PAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "cockpit", "live.html");

export function newToken() { return crypto.randomBytes(32).toString("base64url"); }

// Constant-time: lengths are compared first (timingSafeEqual throws on unequal lengths);
// the length of the real token is not a secret.
export function tokenMatches(given, expected) {
  if (typeof given !== "string") return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function notFound(res) { res.writeHead(404); res.end("not found"); }

export function startCockpit({ repos = ["."], port = 4317, host = "127.0.0.1", token = newToken() } = {}) {
  const clients = new Set();
  let last = "";
  const snapshot = () => JSON.stringify(buildState(repos));
  const push = () => {
    const now = snapshot();
    if (now === last) return;
    last = now;
    for (const res of clients) res.write(`data: ${now}\n\n`);
  };
  // Debounced: a stage completion writes the graph several times in a row.
  let timer = null;
  const changed = () => { clearTimeout(timer); timer = setTimeout(push, 250); };
  const watchers = repos.map((r) => path.join(r, ".svc")).filter((d) => fs.existsSync(d)).map((d) => fs.watch(d, changed));
  // Stalled detection depends on the clock as well as the files.
  const tick = setInterval(push, 60000);

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${host}`);
    if (url.pathname === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" }); return res.end(fs.readFileSync(PAGE)); }
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization || "");
    const given = bearer ? bearer[1] : (url.pathname === "/api/events" ? url.searchParams.get("t") : null);
    if (!tokenMatches(given, token)) return notFound(res);
    if (url.pathname === "/api/state") { last = snapshot(); res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); return res.end(last); }
    if (url.pathname === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(`data: ${snapshot()}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    notFound(res);
  });
  server.listen(port, host);
  // The token rides in the fragment only: it is never sent to the server.
  return { server, token, get url() { return `http://${host}:${server.address()?.port ?? port}/#t=${token}`; }, close: () => { clearInterval(tick); clearTimeout(timer); watchers.forEach((w) => w.close()); for (const c of clients) c.end(); server.close(); } };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (argv[i - 1] === "--repo" ? [a] : []));
  const pi = argv.indexOf("--port");
  const c = startCockpit({ repos: repos.length ? repos : ["."], port: pi >= 0 ? Number(argv[pi + 1]) : 4317 });
  c.server.on("listening", () => process.stdout.write(`cockpit: ${c.url}  (watching ${repos.length || 1} repo${repos.length > 1 ? "s" : ""}; Ctrl-C to stop)\n`));
  c.server.on("error", (e) => { process.stderr.write(`cockpit: ${e.code === "EADDRINUSE" ? `port in use; try --port ${Number(pi >= 0 ? argv[pi + 1] : 4317) + 1}` : e.message}\n`); process.exit(1); });
}
