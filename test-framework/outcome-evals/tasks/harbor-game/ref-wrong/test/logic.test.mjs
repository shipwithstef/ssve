import test from "node:test";
import assert from "node:assert/strict";
import { createGame } from "../game/logic.mjs";

const play = (seed, pick, steps = 3000) => { const g = createGame(seed); for (let i = 0; i < steps && !g.state().over; i++) g.step(pick(g, i), 50); return g.state(); };

test("same seed and inputs give the same game", () => {
  assert.deepEqual(play(5, (g, i) => g.actions()[i % 3]), play(5, (g, i) => g.actions()[i % 3]));
});

test("doing nothing loses", () => {
  assert.equal(play(3, () => null).over, true);
});

test("aiming the beam at an incoming ship brings it home", () => {
  const g = createGame(9);
  for (let i = 0; i < 4000 && g.state().score === 0 && !g.state().over; i++) {
    const s = g.state();
    const next = s.ships.filter((x) => !x.guided).sort((a, b) => a.x - b.x)[0];
    g.step(next ? (next.lane < s.beam ? "up" : next.lane > s.beam ? "down" : null) : null, 50);
  }
  assert.ok(g.state().score > 0);
});
