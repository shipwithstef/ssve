// Rendering and input for Harbor Light. All rules live in logic.mjs.
import { createGame, WIDTH, HEIGHT, LANES, ROCKS_X, MAX_LOST, laneY } from "./logic.mjs";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const overlay = document.querySelector("#overlay");
let game, running = false, paused = false, shake = 0, particles = [], last = performance.now(), queued = null;

function start() {
  game = createGame(Date.now() % 100000);
  window.__game = game;
  running = true; paused = false; overlay.hidden = true; particles = [];
}

addEventListener("keydown", (e) => {
  if (!running && (e.key === " " || e.key === "Enter")) return start();
  if (e.key === "p") { paused = !paused; overlay.hidden = !paused; overlay.textContent = "Paused — press P"; }
  if (e.key === "r") return start();
  queued = { ArrowUp: "up", w: "up", ArrowDown: "down", s: "down", " ": "flare" }[e.key] ?? queued;
});
canvas.addEventListener("pointerdown", (e) => {
  if (!running) return start();
  const y = (e.offsetY / canvas.clientHeight) * HEIGHT;
  const lane = Math.floor(y / (HEIGHT / LANES));
  queued = lane < game.state().beam ? "up" : lane > game.state().beam ? "down" : "flare";
});

function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, life: 600, color });
}

function draw(s, dt) {
  const sea = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sea.addColorStop(0, "#0b1d3a"); sea.addColorStop(1, "#05101f");
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
  ctx.fillStyle = sea; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#1f2a33";
  for (let l = 0; l < LANES; l++) ctx.beginPath(), ctx.arc(ROCKS_X, laneY(l) + 18, 14, 0, Math.PI * 2), ctx.fill();
  const wide = s.boost > 0 ? 1 : 0;
  const beam = ctx.createLinearGradient(40, 0, WIDTH, 0);
  beam.addColorStop(0, "rgba(255,230,140,0.55)"); beam.addColorStop(1, "rgba(255,230,140,0)");
  ctx.fillStyle = beam;
  const top = laneY(Math.max(0, s.beam - wide)) - HEIGHT / LANES / 2, bottom = laneY(Math.min(LANES - 1, s.beam + wide)) + HEIGHT / LANES / 2;
  ctx.beginPath(); ctx.moveTo(40, laneY(s.beam)); ctx.lineTo(WIDTH, top); ctx.lineTo(WIDTH, bottom); ctx.fill();
  ctx.fillStyle = "#f4f1e6"; ctx.fillRect(20, laneY(s.beam) - 30, 20, 60);
  ctx.fillStyle = "#ffd36e"; ctx.beginPath(); ctx.arc(30, laneY(s.beam) - 30, 9, 0, Math.PI * 2); ctx.fill();
  for (const ship of s.ships) {
    ctx.fillStyle = ship.guided ? "#ffd36e" : "#c9d6e3";
    ctx.beginPath(); ctx.moveTo(ship.x - 16, laneY(ship.lane)); ctx.lineTo(ship.x + 14, laneY(ship.lane) - 8); ctx.lineTo(ship.x + 14, laneY(ship.lane) + 8); ctx.fill();
  }
  for (const ev of s.events) {
    if (ev.type === "wreck") { shake = 10; burst(ROCKS_X, laneY(ev.lane), "#ff6b5b", 24); }
    if (ev.type === "home") burst(10, laneY(ev.lane), "#ffd36e", 14);
  }
  particles = particles.filter((p) => (p.life -= dt) > 0);
  for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = p.life / 600; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); }
  ctx.globalAlpha = 1; ctx.restore();
  shake = Math.max(0, shake - dt * 0.03);
  ctx.fillStyle = "#f4f1e6"; ctx.font = "600 20px system-ui";
  ctx.fillText(`Ships home ${s.score}   Level ${s.level}   ${"●".repeat(MAX_LOST - s.lost)}${"○".repeat(s.lost)}`, 60, 30);
  ctx.fillText(s.boost < 0 ? "Flare recharging" : "Space: flare", WIDTH - 190, 30);
}

function frame(now) {
  const dt = Math.min(now - last, 50); last = now;
  if (running && !paused) {
    game.step(queued, dt); queued = null;
    const s = game.state();
    draw(s, dt);
    if (s.over) { running = false; overlay.hidden = false; overlay.textContent = `The harbor went dark. ${s.score} points — press Space to sail again`; }
  }
  requestAnimationFrame(frame);
}
start(); running = false; overlay.hidden = false;
draw(game.state(), 0);
requestAnimationFrame(frame);
