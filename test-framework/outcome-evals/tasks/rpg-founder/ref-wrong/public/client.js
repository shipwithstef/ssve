// Wrong answer: a single-player client. Nothing is shared between browsers.
import { createWorld, join, act as apply, view } from "/rules.mjs";
const world = createWorld(7); const id = "me"; join(world, id);
window.__game = { state: () => view(world, id), actions: () => ["north", "south", "east", "west", "attack", "rest"], act: (a) => apply(world, id, a) };
