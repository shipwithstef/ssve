// A small, defensible yoga-studio app: the S grader's reference for yoga-studio. The task's
// own ref/server.mjs is a smoke floor with no behaviour to probe; this one has accounts, an
// owner role, bookings, persistence, and the usual defences. Standard library only.
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const DATA = process.env.DATA_FILE || path.join(process.cwd(), "data", "studio.json");
const OWNER_EMAIL = process.env.OWNER_EMAIL || "owner@studio.invalid";
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || crypto.randomBytes(9).toString("base64url");
const sessions = new Map(); // token -> user id (sessions are not persisted)

const hash = (pw, salt = crypto.randomBytes(16).toString("hex")) => ({ salt, hash: crypto.scryptSync(pw, salt, 32).toString("hex") });
const same = (pw, u) => { const h = Buffer.from(hash(pw, u.salt).hash, "hex"); const w = Buffer.from(u.hash, "hex"); return h.length === w.length && crypto.timingSafeEqual(h, w); };

function load() {
  try { return JSON.parse(fs.readFileSync(DATA, "utf8")); } catch { /* first run */ }
  const db = { nextId: 1, users: [], classes: [{ id: "c1", name: "Morning flow", startsAt: "2031-01-06T08:00:00Z", capacity: 10, priceCents: 1850 }, { id: "c2", name: "Yin evening", startsAt: "2031-01-06T19:00:00Z", capacity: 8, priceCents: 1600 }], bookings: [] };
  db.users.push({ id: "u0", email: OWNER_EMAIL, name: "Owner", role: "owner", ...hash(OWNER_PASSWORD) });
  return db;
}
const db = load();
function save() {
  fs.mkdirSync(path.dirname(DATA), { recursive: true });
  const tmp = `${DATA}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, DATA);
}
save();

const PAGE = `<!doctype html><meta charset="utf-8"><title>Studio</title><main><h1>Classes</h1><ul id="l"></ul><a href="#login">Log in</a> <button id="b">Book</button></main><script>fetch("/api/classes").then(r=>r.json()).then(c=>{for(const x of c){const li=document.createElement("li");li.textContent=x.name;l.append(li)}})</script>`;
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type, "x-content-type-options": "nosniff", "cache-control": "no-store" }); res.end(type === "application/json" ? JSON.stringify(body) : body); };
const userOf = (req) => { const t = (req.headers.cookie || "").match(/(?:^|; )sid=([\w-]+)/)?.[1] || (req.headers.authorization || "").replace(/^Bearer /, ""); const id = sessions.get(t); return db.users.find((u) => u.id === id); };
const open = (res, user) => { const t = crypto.randomBytes(24).toString("hex"); sessions.set(t, user.id); res.setHeader("set-cookie", `sid=${t}; HttpOnly; SameSite=Strict; Path=/`); return t; };
const clean = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

http.createServer((req, res) => {
  const u = new URL(req.url, "http://x");
  let raw = "";
  req.on("data", (c) => { raw += c; if (raw.length > 100_000) req.destroy(); });
  req.on("end", () => {
    try {
      let body = {};
      if (raw) { try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "invalid JSON" }); } }
      const me = userOf(req);
      const owner = me?.role === "owner";
      const m = u.pathname.match(/^\/api\/(?:admin\/)?classes\/(\w+)$/);
      /*STATIC*/
      if (req.method === "GET" && u.pathname === "/") return send(res, 200, PAGE, "text/html; charset=utf-8");
      if (req.method === "GET" && u.pathname === "/api/classes") return send(res, 200, db.classes.map((c) => ({ ...c, left: c.capacity - db.bookings.filter((b) => b.classId === c.id).length })));
      if (req.method === "POST" && /^\/api\/(register|signup)$/.test(u.pathname)) {
        const email = String(body.email || "").trim().toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || String(body.password || "").length < 8) return send(res, 400, { error: "a valid email and a password of 8+ characters are required" });
        if (db.users.some((x) => x.email === email)) return send(res, 409, { error: "already registered" });
        const user = { id: `u${db.nextId++}`, email, name: String(body.name || "").slice(0, 80), phone: String(body.phone || "").slice(0, 30), role: "customer", ...hash(String(body.password)) };
        db.users.push(user); save();
        return send(res, 201, { user: clean(user), token: open(res, user) });
      }
      if (req.method === "POST" && /^\/api\/(login|session)$/.test(u.pathname)) {
        const user = db.users.find((x) => x.email === String(body.email || "").toLowerCase());
        if (!user || !same(String(body.password || ""), user)) return send(res, 401, { error: "wrong email or password" });
        return send(res, 200, { user: clean(user), token: open(res, user) });
      }
      if (u.pathname === "/api/me" && req.method === "GET") return me ? send(res, 200, clean(me)) : send(res, 401, { error: "login required" });
      if (u.pathname === "/api/bookings" && req.method === "GET") return me ? send(res, 200, db.bookings.filter((b) => b.userId === me.id)) : send(res, 401, { error: "login required" });
      if (u.pathname === "/api/bookings" && req.method === "POST") {
        if (!me) return send(res, 401, { error: "login required" });
        const cls = db.classes.find((c) => c.id === body.classId);
        if (!cls) return send(res, 404, { error: "no such class" });
        if (db.bookings.filter((b) => b.classId === cls.id).length >= cls.capacity) return send(res, 409, { error: "class is full" });
        const b = { id: `b${db.nextId++}`, classId: cls.id, userId: me.id, amountCents: cls.priceCents, status: "pending_payment" }; // the price is the server's, never the client's
        db.bookings.push(b); save();
        return send(res, 201, b);
      }
      // Owner-only schedule management.
      if (/^\/api\/(admin\/|owner\/)?(classes|schedule)(\/\w+)?$/.test(u.pathname) && req.method !== "GET") {
        if (!me) return send(res, 401, { error: "login required" });
        if (!owner) return send(res, 403, { error: "owner only" });
        if (req.method === "POST") { const c = { id: `c${db.nextId++}`, name: String(body.name || "").slice(0, 80), startsAt: String(body.startsAt || ""), capacity: Math.max(1, Math.min(200, Number(body.capacity) || 1)), priceCents: Math.max(0, Math.round(Number(body.priceCents) || 0)) }; db.classes.push(c); save(); return send(res, 201, c); }
        if (req.method === "DELETE" && m) { db.classes = db.classes.filter((c) => c.id !== m[1]); save(); return send(res, 200, { ok: true }); }
        return send(res, 400, { error: "unsupported" });
      }
      if (/^\/api\/(admin|owner)\//.test(u.pathname)) return !me ? send(res, 401, { error: "login required" }) : !owner ? send(res, 403, { error: "owner only" }) : send(res, 200, db.bookings);
      send(res, 404, { error: "not found" });
    } catch { send(res, 500, { error: "internal error" }); }
  });
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
