// HTTP routes. The service runs on the studio's private network and has no authentication.
import http from "node:http";
import { book, cancel } from "./bookings.mjs";

export function createServer(store, payments) {
  return http.createServer(async (req, res) => {
    const send = (code, body) => res.writeHead(code, { "content-type": "application/json" }).end(JSON.stringify(body));
    try {
      let m;
      if (req.method === "POST" && (m = req.url.match(/^\/classes\/([^/]+)\/book\?user=(\w+)$/))) return send(201, { id: await book(store, m[1], m[2], payments) });
      if (req.method === "POST" && (m = req.url.match(/^\/bookings\/([^/]+)\/cancel$/))) return send(200, { ok: (await cancel(store, m[1], payments), true) });
      send(404, { error: "not found" });
    } catch (e) { send(400, { error: e.message }); }
  });
}
