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
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMain } from "./lib/is-main.mjs";
import { buildState } from "./cockpit-state.mjs";

const PAGE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "templates", "cockpit", "live.html");

export function startCockpit({ repos = ["."], port = 4317, host = "127.0.0.1" } = {}) {
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
    if (url.pathname === "/") { res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }); return res.end(fs.readFileSync(PAGE)); }
    if (url.pathname === "/api/state") { last = snapshot(); res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }); return res.end(last); }
    if (url.pathname === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(`data: ${snapshot()}\n\n`);
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    res.writeHead(404); res.end("not found");
  });
  server.listen(port, host);
  return { server, url: `http://${host}:${port}/`, close: () => { clearInterval(tick); clearTimeout(timer); watchers.forEach((w) => w.close()); for (const c of clients) c.end(); server.close(); } };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (argv[i - 1] === "--repo" ? [a] : []));
  const pi = argv.indexOf("--port");
  const c = startCockpit({ repos: repos.length ? repos : ["."], port: pi >= 0 ? Number(argv[pi + 1]) : 4317 });
  c.server.on("listening", () => process.stdout.write(`cockpit: ${c.url}  (watching ${repos.length || 1} repo${repos.length > 1 ? "s" : ""}; Ctrl-C to stop)\n`));
  c.server.on("error", (e) => { process.stderr.write(`cockpit: ${e.code === "EADDRINUSE" ? `port in use; try --port ${Number(pi >= 0 ? argv[pi + 1] : 4317) + 1}` : e.message}\n`); process.exit(1); });
}
