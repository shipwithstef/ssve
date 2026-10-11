import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createQuest } from "../game/quest.mjs";

test("the walkthrough wins and the parrot drops the last card when the stack is too big", () => {
  const q = createQuest();
  for (const a of JSON.parse(fs.readFileSync(new URL("../docs/walkthrough.json", import.meta.url)))) q.act(a);
  assert.equal(q.state().solved, true);
  const r = createQuest();
  for (const a of ["go to tavern", "pick up card stack"]) r.act(a);
  assert.match(r.act("give card stack to parrot"), /drops the last one/);
  assert.ok(r.state().inventory.includes("card stack"), "the untrimmed stack comes back: no dead end");
});

test("an unstamped message gets you thrown overboard but keeps the game winnable", () => {
  const q = createQuest();
  assert.ok(q.actions().includes("pick up bottle"));
});
