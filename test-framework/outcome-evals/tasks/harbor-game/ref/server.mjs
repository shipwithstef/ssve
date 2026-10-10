import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const types = { ".html": "text/html", ".mjs": "text/javascript", ".js": "text/javascript", ".css": "text/css" };
const allowed = new Set(["/index.html", "/game/logic.mjs", "/game/client.js"]);

http.createServer((req, res) => {
  const url = new URL(req.url, "http://local").pathname;
  const file = url === "/" ? "/index.html" : url;
  if (!allowed.has(file)) return res.writeHead(404).end("not found");
  res.writeHead(200, { "content-type": types[path.extname(file)] });
  fs.createReadStream(path.join(root, file)).pipe(res);
}).listen(Number(process.env.PORT) || 3000);
