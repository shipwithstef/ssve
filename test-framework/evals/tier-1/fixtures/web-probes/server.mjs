// A tiny multiplayer game for proving scripts/web-probes.mjs. MODE=good is built well;
// MODE=bad plants one defect per metric: unlabeled controls and low contrast, a page wider
// than a phone, a console error, a slow frame loop, a memory leak, chat rendered as HTML
// (stored XSS), a server that trusts the player id the client sends, no security headers
// and no rate limit.
import http from "node:http";
import crypto from "node:crypto";

const BAD = process.env.MODE === "bad";
const players = new Map(); // id -> { id, token, x, y }
const chat = [];
const leak = [];
const hits = new Map();

const page = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Probe Keep</title>
<style>body{margin:0;font:16px Georgia,serif;background:${BAD ? "#888" : "#1d2a24"};color:${BAD ? "#7a7a7a" : "#f2ead8"}}main{padding:16px}${BAD ? ".wide{width:1200px;height:4px;background:#999}" : ""}canvas{display:block;max-width:100%;background:#2f4a3c}
button{font:inherit;padding:6px 10px;background:#c9a24a;color:#1d2a24;border:0}#log{min-height:40px}</style></head><body><main>
<h1>Probe Keep</h1><p id="who">joining…</p>${BAD ? '<div class="wide"></div>' : ""}
<canvas id="c" width="320" height="200"></canvas>
${BAD ? '<input id="say">' : '<label for="say">Say</label> <input id="say">'}
${BAD ? '<button id="go"></button>' : '<button id="go">Send</button>'}
<div id="log"></div></main>
<script>
let me = null, state = { players: [], chat: [] };
const post = (p, b) => fetch(p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }).then((r) => r.json());
const auth = () => (${BAD} ? { id: me.id } : { token: me.token });
async function join() { me = await post("/api/join", {}); document.getElementById("who").textContent = "You are " + me.id; }
async function poll() { if (!me) return; const s = await (await fetch("/api/state")).json(); if (s.players) state = s; const log = document.getElementById("log");
  ${BAD ? 'log.innerHTML = state.chat.map((m) => "<p>" + m + "</p>").join("");' : 'log.replaceChildren(...state.chat.map((m) => { const p = document.createElement("p"); p.textContent = m; return p; }));'} }
function say(text) { return post("/api/say", { ...auth(), text }); }
window.__game = { state: () => (me ? { you: state.players.find((p) => p.id === me.id) || { id: me.id, x: 0, y: 0 }, players: state.players } : null),
  actions: () => ["north", "south", "east", "west", "say"],
  act: (a, text) => (a === "say" ? say(text || "hello") : post("/api/act", { ...auth(), action: a })) };
document.getElementById("say").addEventListener("keydown", (e) => { if (e.key === "Enter") say(e.target.value); });
document.getElementById("go").addEventListener("click", () => say(document.getElementById("say").value));
const ctx = document.getElementById("c").getContext("2d");
function frame() { ${BAD ? "const t = performance.now(); while (performance.now() - t < 35) {}" : ""}
  ctx.fillStyle = "#2f4a3c"; ctx.fillRect(0, 0, 320, 200);
  for (const p of state.players) { ctx.fillStyle = p.id === me?.id ? "#e8c66a" : "#9fc7b0"; ctx.fillRect(160 + p.x * 8, 100 + p.y * 8, 8, 8); }
  requestAnimationFrame(frame); }
${BAD ? 'console.error("planted console error");' : ""}
join().then(() => { setInterval(poll, 100); poll(); requestAnimationFrame(frame); });
</script></body></html>`;

const body = (req) => new Promise((done) => { let b = ""; req.on("data", (c) => { b += c; if (b.length > 65536) req.destroy(); }); req.on("end", () => { try { done(JSON.parse(b || "{}")); } catch { done(null); } }); });
const send = (res, code, obj, type = "application/json") => {
  const h = { "content-type": type };
  if (!BAD) Object.assign(h, { "content-security-policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'", "x-content-type-options": "nosniff", "x-frame-options": "DENY" });
  res.writeHead(code, h); res.end(type === "application/json" ? JSON.stringify(obj) : obj);
};
const who = (b) => (BAD ? players.get(String(b?.id)) : [...players.values()].find((p) => p.token === b?.token));

http.createServer(async (req, res) => {
  if (!BAD && req.url.startsWith("/api/")) {
    const now = Math.floor(Date.now() / 1000), key = `${req.socket.remoteAddress}:${now}`;
    hits.set(key, (hits.get(key) || 0) + 1);
    if (hits.get(key) > 250) return send(res, 429, { error: "slow down" });
  }
  if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) return send(res, 200, page, "text/html");
  if (req.method === "GET" && req.url === "/api/state") return send(res, 200, { players: [...players.values()].map(({ id, x, y }) => ({ id, x, y })), chat: chat.slice(-20) });
  if (req.method === "POST") {
    const b = await body(req);
    if (b === null) return send(res, 400, { error: "bad json" });
    if (req.url === "/api/join") { const p = { id: crypto.randomUUID().slice(0, 8), token: crypto.randomUUID(), x: 0, y: 0 }; players.set(p.id, p); return send(res, 200, p); }
    const p = who(b);
    if (!p) return send(res, 403, { error: "unknown player" });
    if (BAD) leak.push(Buffer.alloc(1024 * 1024, 1));
    if (req.url === "/api/act") { const d = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[b.action]; if (!d) return send(res, 400, { error: "unknown action" }); p.x += d[0]; p.y += d[1]; return send(res, 200, { ok: true }); }
    if (req.url === "/api/say") { const t = String(b.text ?? "").slice(0, 200); chat.push(`${p.id}: ${t}`); return send(res, 200, { ok: true }); }
  }
  send(res, 404, { error: "not found" });
}).listen(Number(process.env.PORT || 3000), "127.0.0.1");
