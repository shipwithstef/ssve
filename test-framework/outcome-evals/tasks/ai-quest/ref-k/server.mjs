// Static server for Patch Island: the page, its script, the shared game module and its art.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const FILES = { "/": ["public/index.html", "text/html"], "/client.js": ["public/client.js", "text/javascript"], "/game/quest.mjs": ["game/quest.mjs", "text/javascript"] };
const ART = { png: "image/png", svg: "image/svg+xml" };
const HEADERS = { "content-security-policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'", "x-content-type-options": "nosniff", "x-frame-options": "DENY" };

http.createServer((req, res) => {
  const p = new URL(req.url, "http://x").pathname;
  let f = FILES[p];
  const art = /^\/assets\/([\w-]+)\.(png|svg)$/.exec(p);
  if (art) f = [`public/assets/${art[1]}.${art[2]}`, ART[art[2]]];
  if (req.method !== "GET" || !f || !fs.existsSync(path.join(root, f[0]))) { res.writeHead(404, HEADERS); return res.end("not found"); }
  res.writeHead(200, { ...HEADERS, "content-type": f[1].startsWith("text") ? `${f[1]}; charset=utf-8` : f[1] });
  res.end(fs.readFileSync(path.join(root, f[0])));
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
