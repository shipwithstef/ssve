// Emberfall rules: pure and seeded, shared by the server. No DOM, no clock, no Math.random.
export const SIZE = 20;
function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export function createWorld(seed = 1) {
  const rand = rng(seed);
  const wolves = Array.from({ length: 6 }, (_, i) => ({ id: `w${i}`, x: Math.floor(rand() * SIZE), y: Math.floor(rand() * SIZE), hp: 3 }));
  return { seed, tick: 0, players: {}, wolves, rand };
}

export function join(world, id) {
  world.players[id] ??= { id, x: 10, y: 10, hp: 10, xp: 0, coins: 0, level: 1 };
  return world.players[id];
}

const MOVES = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
export const ACTIONS = [...Object.keys(MOVES), "attack", "rest"];

export function act(world, id, action) {
  const p = world.players[id];
  if (!p || !ACTIONS.includes(action)) return false;
  if (MOVES[action]) {
    p.x = Math.max(0, Math.min(SIZE - 1, p.x + MOVES[action][0]));
    p.y = Math.max(0, Math.min(SIZE - 1, p.y + MOVES[action][1]));
  } else if (action === "attack") {
    const w = world.wolves.find((w) => w.hp > 0 && Math.abs(w.x - p.x) + Math.abs(w.y - p.y) <= 1);
    if (w && --w.hp === 0) { p.xp += 5; p.coins += 2; p.level = 1 + Math.floor(p.xp / 20); }
  } else if (action === "rest") p.hp = Math.min(10, p.hp + 1);
  return true;
}

export function step(world) {
  world.tick++;
  if (world.tick % 50 === 0) for (const w of world.wolves) if (w.hp === 0) { w.hp = 3; w.x = Math.floor(world.rand() * SIZE); w.y = Math.floor(world.rand() * SIZE); }
}

export function view(world, id) {
  const you = world.players[id];
  return { you: you && { ...you }, players: Object.values(world.players).map(({ id, x, y }) => ({ id, x, y })), wolves: world.wolves.filter((w) => w.hp > 0).map(({ id, x, y }) => ({ id, x, y })), tick: world.tick };
}
