// Authoritative server: clients send actions; the server owns the world and its rules.
import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import { createWorld, join, act, step, view } from "./game/rules.mjs";

const world = createWorld(Number(process.env.WORLD_SEED) || 7);
setInterval(() => step(world), 100).unref();
const FILES = { "/": ["public/index.html", "text/html"], "/client.js": ["public/client.js", "text/javascript"], "/rules.mjs": ["game/rules.mjs", "text/javascript"] };

http.createServer((req, res) => {
  const url = new URL(req.url, "http://local");
  const json = (code, body) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
  if (req.method === "GET" && FILES[url.pathname]) {
    const [file, type] = FILES[url.pathname];
    return res.writeHead(200, { "content-type": type }).end(fs.readFileSync(new URL(file, import.meta.url)));
  }
  if (req.method === "POST" && url.pathname === "/join") { const id = crypto.randomUUID().slice(0, 8); join(world, id); return json(200, { id }); }
  if (req.method === "GET" && url.pathname === "/state") return json(200, view(world, url.searchParams.get("id")));
  if (req.method === "POST" && url.pathname === "/act") {
    let body = ""; req.on("data", (c) => { body += c; if (body.length > 1000) req.destroy(); });
    req.on("end", () => { try { const { id, action } = JSON.parse(body); json(act(world, id, action) ? 200 : 400, view(world, id)); } catch { json(400, { error: "bad request" }); } });
    return;
  }
  json(404, { error: "not found" });
}).listen(Number(process.env.PORT) || 3000);
