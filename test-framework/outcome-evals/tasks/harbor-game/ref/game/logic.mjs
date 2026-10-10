// Harbor Light rules. Pure and seeded: no DOM, no Math.random, no clock.
export const WIDTH = 800, HEIGHT = 450, LANES = 5, ROCKS_X = 260, MAX_LOST = 3;
const BOOST_MS = 1500, BOOST_COOLDOWN_MS = 4000;

function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const laneY = (lane) => (lane + 0.5) * (HEIGHT / LANES);

export function createGame(seed = 1) {
  const rand = rng(seed);
  const st = { t: 0, level: 1, score: 0, lost: 0, over: false, beam: 2, boost: 0, nextShipIn: 1200, ships: [], events: [] };

  const beamCovers = (lane) => Math.abs(lane - st.beam) <= (st.boost > 0 ? 1 : 0);

  function spawn() {
    st.ships.push({ id: st.t, lane: Math.floor(rand() * LANES), x: WIDTH + 20, speed: 0.06 + st.level * 0.015 + rand() * 0.03, guided: false });
    st.nextShipIn = Math.max(450, 1700 - st.level * 140) * (0.7 + rand() * 0.6);
  }

  function step(action, dtMs = 16) {
    st.events = [];
    if (st.over) return;
    if (action === "up") st.beam = Math.max(0, st.beam - 1);
    if (action === "down") st.beam = Math.min(LANES - 1, st.beam + 1);
    if (action === "flare" && st.boost === 0) st.boost = BOOST_MS;
    const dt = Math.max(0, Math.min(dtMs, 100));
    st.t += dt;
    st.level = 1 + Math.floor(st.t / 30000);
    if (st.boost > 0) st.boost = Math.max(0, st.boost - dt) || -BOOST_COOLDOWN_MS;
    else if (st.boost < 0) st.boost = Math.min(0, st.boost + dt);
    st.nextShipIn -= dt;
    if (st.nextShipIn <= 0) spawn();
    for (const ship of st.ships) {
      ship.x -= ship.speed * dt;
      if (ship.x < ROCKS_X + 60 && ship.x > ROCKS_X && beamCovers(ship.lane)) ship.guided = true;
    }
    for (const ship of st.ships.filter((s) => s.x <= ROCKS_X && !s.guided)) {
      st.lost += 1;
      st.events.push({ type: "wreck", lane: ship.lane });
    }
    for (const ship of st.ships.filter((s) => s.x <= 0 && s.guided)) {
      st.score += 10 * st.level;
      st.events.push({ type: "home", lane: ship.lane });
    }
    st.ships = st.ships.filter((s) => (s.guided ? s.x > 0 : s.x > ROCKS_X));
    if (st.lost >= MAX_LOST) st.over = true;
  }

  return {
    actions: () => (st.over ? [] : ["up", "down", "flare"]),
    step,
    state: () => JSON.parse(JSON.stringify(st)),
  };
}
