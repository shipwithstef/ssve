const canvas = document.querySelector("canvas"), ctx = canvas.getContext("2d");
const { id } = await (await fetch("/join", { method: "POST" })).json();
let latest = { you: null, players: [], wolves: [] };
const ACTIONS = ["north", "south", "east", "west", "attack", "rest"];
async function poll() { latest = await (await fetch(`/state?id=${id}`)).json(); }
async function act(name) { const r = await fetch("/act", { method: "POST", body: JSON.stringify({ id, action: name }) }); if (r.ok) latest = await r.json(); }
window.__game = { state: () => JSON.parse(JSON.stringify(latest)), actions: () => ACTIONS.slice(), act };
addEventListener("keydown", (e) => { const a = { ArrowUp: "north", ArrowDown: "south", ArrowRight: "east", ArrowLeft: "west", " ": "attack", r: "rest" }[e.key]; if (a) act(a); });
setInterval(poll, 150); await poll();
(function draw() {
  ctx.fillStyle = "#1d2a1a"; ctx.fillRect(0, 0, 400, 400);
  ctx.fillStyle = "#8a3b2b"; for (const w of latest.wolves) ctx.fillRect(w.x * 20 + 4, w.y * 20 + 4, 12, 12);
  for (const p of latest.players) { ctx.fillStyle = p.id === id ? "#e8c35a" : "#7fb3d5"; ctx.beginPath(); ctx.arc(p.x * 20 + 10, p.y * 20 + 10, 7, 0, 7); ctx.fill(); }
  if (latest.you) { ctx.fillStyle = "#e8e2cf"; ctx.fillText(`Level ${latest.you.level}  Coins ${latest.you.coins}  HP ${latest.you.hp}`, 8, 14); }
  requestAnimationFrame(draw);
})();
