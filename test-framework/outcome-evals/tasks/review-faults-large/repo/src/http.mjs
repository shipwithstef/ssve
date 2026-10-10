// JSON API. Every route needs a valid session cookie; owner routes need role "owner".
import http from "node:http";
import { readSession } from "./auth.mjs";
import { book, cancel } from "./bookings.mjs";
import { revenueByDay } from "./reports.mjs";

const MAX_BODY = 64 * 1024;

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}); } catch { reject(new Error("bad json")); } });
  });
}

function cookie(req, name) {
  return (req.headers.cookie || "").split(/;\s*/).map((p) => p.split("=")).find(([k]) => k === name)?.[1];
}

export function createApp(store, payments) {
  return http.createServer(async (req, res) => {
    const send = (code, body) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
    const session = readSession(cookie(req, "sid"));
    if (!session) return send(401, { error: "login required" });
    try {
      const url = new URL(req.url, "http://local");
      let m;
      if (req.method === "POST" && (m = url.pathname.match(/^\/classes\/([\w-]+)\/book$/))) {
        return send(201, { id: await book(store, payments, m[1], session.userId) });
      }
      if (req.method === "POST" && (m = url.pathname.match(/^\/bookings\/([\w-]+)\/cancel$/))) {
        const body = await readJson(req);
        return send(200, await cancel(store, payments, m[1], body.userId ?? session.userId));
      }
      if (req.method === "GET" && url.pathname === "/reports/revenue") {
        if (session.role !== "owner") return send(403, { error: "owners only" });
        return send(200, revenueByDay(store));
      }
      send(404, { error: "not found" });
    } catch (e) {
      send(400, { error: e.message });
    }
  });
}
