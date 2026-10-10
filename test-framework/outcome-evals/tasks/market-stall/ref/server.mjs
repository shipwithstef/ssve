import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CATALOG = { apple: 5, bread: 12, sword: 80 };
let s;
const reset = () => { s = { coins: 100, day: 1, inventory: {}, today: {}, purchases: 0 }; };
reset();
const buyPrice = (id) => Math.ceil((CATALOG[id] * (10 + (s.today[id] || 0))) / 10);
const sellPrice = (id) => Math.floor((CATALOG[id] * 6) / 10);
const view = () => ({ coins: s.coins, day: s.day, inventory: Object.fromEntries(Object.entries(s.inventory).filter(([, n]) => n > 0)), prices: Object.fromEntries(Object.keys(CATALOG).map((id) => [id, { buy: buyPrice(id), sell: sellPrice(id) }])) });
const send = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
async function body(req) { let t = ""; for await (const c of req) t += c; try { const j = JSON.parse(t); return j && typeof j === "object" ? j : null; } catch { return null; } }
http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  if (req.method === "GET" && url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(fs.readFileSync(path.join(HERE, "index.html"))); }
  if (req.method === "GET" && url === "/api/state") return send(res, 200, view());
  if (req.method === "POST" && url === "/api/reset") { reset(); return send(res, 200, view()); }
  if (req.method === "POST" && url === "/api/next-day") { s.day++; s.today = {}; s.purchases = 0; s.coins += Math.floor((s.coins * 5) / 100); return send(res, 200, view()); }
  if (req.method === "POST" && (url === "/api/buy" || url === "/api/sell")) {
    const b = await body(req);
    if (!b || typeof b.item !== "string") return send(res, 400, { error: "bad_request" });
    if (!Object.hasOwn(CATALOG, b.item)) return send(res, 400, { error: "unknown_item" });
    const id = b.item;
    if (url === "/api/buy") {
      if (s.purchases >= 10) return send(res, 400, { error: "daily_limit" });
      const p = buyPrice(id);
      if (s.coins < p) return send(res, 400, { error: "insufficient_coins" });
      s.coins -= p; s.inventory[id] = (s.inventory[id] || 0) + 1; s.today[id] = (s.today[id] || 0) + 1; s.purchases++;
    } else {
      if (!(s.inventory[id] > 0)) return send(res, 400, { error: "not_owned" });
      s.inventory[id]--; s.coins += sellPrice(id);
    }
    return send(res, 200, view());
  }
  send(res, 404, { error: "not_found" });
}).listen(Number(process.env.PORT || 3000));
