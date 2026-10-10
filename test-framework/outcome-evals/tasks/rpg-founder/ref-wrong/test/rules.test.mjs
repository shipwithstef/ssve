import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, join, act, view } from "../game/rules.mjs";
test("moving stays inside the world and killing a wolf pays out", () => {
  const w = createWorld(7); join(w, "a");
  for (let i = 0; i < 30; i++) act(w, "a", "north");
  assert.equal(view(w, "a").you.y, 0);
  const wolf = w.wolves[0]; w.players.a.x = wolf.x; w.players.a.y = wolf.y;
  for (let i = 0; i < 3; i++) act(w, "a", "attack");
  assert.equal(w.players.a.coins, 2);
  assert.equal(act(w, "a", "teleport"), false);
});
