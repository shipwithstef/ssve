// S reference for yoga-studio built around guest checkout: visitors book without an account.
// Each booking gets a secret cancel code that is the only way to read or cancel it; the owner
// signs in to manage the schedule and see all bookings. Standard library only.
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const DATA = process.env.DATA_FILE || path.join(process.cwd(), "data", "studio.json");
const OWNER_EMAIL = process.env.OWNER_EMAIL || "owner@studio.invalid";
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || crypto.randomBytes(9).toString("base64url");
const sessions = new Set();
const digest = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const eq = (a, b) => { const x = Buffer.from(digest(a)); const y = Buffer.from(digest(b)); return crypto.timingSafeEqual(x, y); };

let db;
try { db = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch {
  db = { n: 1, classes: [{ id: "c1", name: "Morning flow", startsAt: "2031-01-06T08:00:00Z", capacity: 10, priceCents: 1850 }], bookings: [] };
}
function save() { fs.mkdirSync(path.dirname(DATA), { recursive: true }); const t = `${DATA}.${process.pid}.tmp`; fs.writeFileSync(t, JSON.stringify(db), { mode: 0o600 }); fs.renameSync(t, DATA); }
save();

const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "x-content-type-options": "nosniff", "cache-control": "no-store" }); res.end(type === "application/json" ? JSON.stringify(body) : body); };
const isOwner = (req) => sessions.has((req.headers.cookie || "").match(/(?:^|; )sid=(\w+)/)?.[1] || (req.headers.authorization || "").replace(/^Bearer /, ""));
const PAGE = `<!doctype html><meta charset="utf-8"><title>Studio</title><main><h1>Classes</h1><ul id="l"></ul><button id="b">Book</button></main><script>fetch("/api/classes").then(r=>r.json()).then(c=>{for(const x of c){const li=document.createElement("li");li.textContent=x.name;l.append(li)}})</script>`;

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 100_000) req.destroy(); });
  req.on("end", () => {
    try {
      let body = {};
      if (raw) { try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "invalid JSON" }); } }
      const owner = isOwner(req);
      const code = req.headers["x-cancel-code"] || u.searchParams.get("code");
      const bm = u.pathname.match(/^\/api\/bookings\/(\w+)$/);
      if (req.method === "GET" && u.pathname === "/") return send(res, 200, PAGE, "text/html; charset=utf-8");
      if (req.method === "GET" && u.pathname === "/api/classes") return send(res, 200, db.classes);
      if (req.method === "POST" && u.pathname === "/api/login") {
        if (!eq(body.email || "", OWNER_EMAIL) || !eq(body.password || "", OWNER_PASSWORD)) return send(res, 401, { error: "wrong email or password" });
        const t = crypto.randomBytes(24).toString("hex"); sessions.add(t);
        res.setHeader("set-cookie", `sid=${t}; HttpOnly; SameSite=Strict; Path=/`);
        return send(res, 200, { token: t });
      }
      if (req.method === "POST" && u.pathname === "/api/bookings") {
        const cls = db.classes.find((c) => c.id === body.classId);
        const email = String(body.email || "").trim();
        if (!cls || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return send(res, 400, { error: "a class and a valid email are required" });
        if (db.bookings.filter((b) => b.classId === cls.id).length >= cls.capacity) return send(res, 409, { error: "class is full" });
        const b = { id: `b${db.n++}`, classId: cls.id, name: String(body.name || "").slice(0, 80), email, phone: String(body.phone || "").slice(0, 30), amountCents: cls.priceCents, cancelCode: crypto.randomBytes(12).toString("hex") };
        db.bookings.push(b); save();
        return send(res, 201, { id: b.id, amountCents: b.amountCents, cancelCode: b.cancelCode });
      }
      if (bm) {
        const b = db.bookings.find((x) => x.id === bm[1]);
        if (!b || !(owner || (code && eq(code, b.cancelCode)))) return send(res, owner || code ? 404 : 401, { error: "not found or not yours" });
        if (req.method === "GET") return send(res, 200, { id: b.id, classId: b.classId, name: b.name });
        if (req.method === "DELETE") { db.bookings = db.bookings.filter((x) => x.id !== b.id); save(); return send(res, 200, { ok: true }); }
      }
      if (u.pathname === "/api/bookings" && req.method === "GET") return owner ? send(res, 200, db.bookings) : send(res, 401, { error: "owner only" });
      if (/^\/api\/(admin\/|owner\/)?(classes|schedule)(\/\w+)?$/.test(u.pathname) && req.method !== "GET") {
        if (!owner) return send(res, 401, { error: "owner login required" });
        if (req.method === "POST") { const c = { id: `c${db.n++}`, name: String(body.name || "").slice(0, 80), startsAt: String(body.startsAt || ""), capacity: Math.max(1, Math.min(200, Number(body.capacity) || 1)), priceCents: Math.max(0, Math.round(Number(body.priceCents) || 0)) }; db.classes.push(c); save(); return send(res, 201, c); }
        return send(res, 400, { error: "unsupported" });
      }
      send(res, 404, { error: "not found" });
    } catch { send(res, 500, { error: "internal error" }); }
  });
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
