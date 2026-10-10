// A tiny gold bank for the chaos-probe test. FRAGILE selects a planted defect:
//   memory  - balances live in memory only (lost on restart)
//   race    - gold is read before an await and written after it: concurrent earns lose gold
//   parse   - a malformed body crashes the process
//   clock   - refuses to serve when the clock is not near the build time
import http from "node:http";
import fs from "node:fs";
const fragile = process.env.FRAGILE || "";
const FILE = process.env.BANK_FILE || "bank.json";
const load = () => (fragile === "memory" ? mem : (fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : { gold: 0, earns: 0 }));
let mem = { gold: 0, earns: 0 };
const save = (b) => { if (fragile === "memory") mem = b; else fs.writeFileSync(FILE, JSON.stringify(b)); };
let queue = Promise.resolve();
const BUILT = Number(process.env.BUILT_AT || Date.now());
http.createServer((req, res) => {
  const json = (c, b) => res.writeHead(c, { "content-type": "application/json" }).end(JSON.stringify(b));
  if (fragile === "clock" && Math.abs(Date.now() - BUILT) > 3600e3) return json(500, { error: "clock" });
  if (req.method === "GET" && req.url === "/") return json(200, load());
  if (req.method === "POST" && req.url === "/earn") {
    let body = ""; req.on("data", (c) => { body += c; if (body.length > 10000) req.destroy(); });
    req.on("end", async () => {
      if (fragile === "parse") { const { amount } = JSON.parse(body); void amount; }
      else { try { JSON.parse(body); } catch { return json(400, { error: "bad json" }); } }
      if (fragile === "race") { const stale = load().gold; await new Promise((r) => setTimeout(r, 20)); const b = load(); b.gold = stale + 1; b.earns += 1; save(b); return json(200, b); }
      queue = queue.then(() => { const b = load(); b.gold += 1; b.earns += 1; save(b); json(200, b); });
    });
    return;
  }
  json(404, { error: "not found" });
}).listen(Number(process.env.PORT));
