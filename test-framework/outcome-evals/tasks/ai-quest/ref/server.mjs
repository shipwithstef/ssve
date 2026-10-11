// Static server for Patch Island: the page, its script and the shared game module.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const FILES = { "/": ["public/index.html", "text/html"], "/client.js": ["public/client.js", "text/javascript"], "/game/quest.mjs": ["game/quest.mjs", "text/javascript"] };
const HEADERS = { "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'", "x-content-type-options": "nosniff", "x-frame-options": "DENY" };

http.createServer((req, res) => {
  const f = FILES[new URL(req.url, "http://x").pathname];
  if (req.method !== "GET" || !f) { res.writeHead(404, HEADERS); return res.end("not found"); }
  res.writeHead(200, { ...HEADERS, "content-type": `${f[1]}; charset=utf-8` });
  res.end(fs.readFileSync(path.join(root, f[0])));
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
