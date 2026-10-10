You are a game director and a principal engineer judging a small browser game an AI built from the request in spec.md. Read every file. Look at the screenshots in `__shots/` (1-start.png is the first screen, 2-play.png mid-play, 3-later.png about five seconds later) with the Read tool. You may run `node` commands, for example to import `game/logic.mjs` and play it with a script, or to run the game's own tests. Do not change files.

Answer each claim with 1 (clearly true, with evidence you can point to) or 0 (false, missing or doubtful). Do not give partial credit.

Game design
1. goal_clear: the first screen tells a new player the goal and the controls.
2. decisions: while playing, the player has a meaningful choice to make at least every few seconds (check by playing `game/logic.mjs` with a script).
3. fail_and_replay: there is a fail state, a final score or result, and a one-key or one-click restart.
4. progression: difficulty or variety rises during a run (faster, more, or new elements after the first minute), verified in the code or by playing.
5. storms: the storms in the request change play (they are not only drawn), verified in the code.

Feel and look (from the screenshots and the rendering code)
6. feedback: player actions and outcomes get visible feedback beyond a number changing (flash, particles, shake, tween or sound).
7. art_direction: a deliberate palette and shapes that fit "a harbor at night"; not default rectangles on a plain background.
8. hud: score and remaining lives or health are readable during play, as 2-play.png shows.
9. not_generic: the look avoids the stock AI-default styles (centered card on a gradient, emoji as the only art, system-font title with no styling).

Engineering
10. layering: rules live in game/logic.mjs, rendering and input elsewhere; no game rule is duplicated in the client.
11. tests_meaningful: the game's own tests check behaviour (determinism, losing, scoring), not only that functions exist; they pass under `node --test`.
12. lean: no speculative systems the game does not use (plugin layers, unused config, entity frameworks for three entity types, dead code).
13. robust_input: unknown actions, huge or zero time steps and repeated restarts do not break the state (try them).

Reply with ONLY a JSON object: {"scores": {"goal_clear": n, "decisions": n, "fail_and_replay": n, "progression": n, "storms": n, "feedback": n, "art_direction": n, "hud": n, "not_generic": n, "layering": n, "tests_meaningful": n, "lean": n, "robust_input": n}, "total": n, "notes": "three sentences: the best part, the biggest gap, would a player replay it"}
