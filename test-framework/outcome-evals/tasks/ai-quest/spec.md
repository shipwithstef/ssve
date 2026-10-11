# Request

Make me a point-and-click comedy adventure in the spirit of the classic pirate-island adventures (Escape from Monkey Island is the feel I love: a hapless hero, absurd puzzles, inventory combinations, witty dialogue choices, an island to explore). It must be entirely our own: our own hero, island, characters, jokes and art, nothing taken from that series.

The twist: it is secretly a course. The world is about AI. A player who finishes it should come away able to reason like a good AI engineer, the kind who could pass a technical interview at a frontier AI lab, without ever feeling taught. No lectures, no quiz screens, no "did you know" boxes. Every lesson is a puzzle you can only solve by doing the right thing, and the joke lands because you understood it. Even a player who just clicks around for fun should pick it up.

The player should come away understanding these eight ideas, each one needed to get through the game:

1. Measure before you change things: compare against a held-out test set, not the examples you tuned on.
2. A context window is a hard budget: what goes in, in what order, and what gets dropped.
3. Prompt caching: keep the stable part first and unchanged so it can be reused.
4. Tool use: the model asks for a tool, your code runs it, and the result goes back to the model.
5. Grounding: answer from given sources, cite them, and say "I don't know" rather than invent.
6. Sampling: temperature trades variety against consistency, and some jobs need consistency.
7. Prompt injection: text from outside is data, never instructions.
8. Agent loops need a stop condition and a budget.

Get it to a first playable version I could show people, and tell me in `docs/` how you'd take it further: what you built it with and why, how the puzzles map to the lessons, and how you would check that players really learn.

## Contract (so the build can be tested automatically)

- `npm install` then `npm start` serves the game on `process.env.PORT` (default 3000); opening `/` in a browser plays it with the mouse (point and click), and with the keyboard too.
- The game logic lives in a module that runs in Node without a browser, at `game/quest.mjs`, exporting `createQuest()`. It returns an object with:
  - `state()`: JSON with `scene` (string id), `inventory` (array of item ids), `solved` (true once the game is won), and `dialogue` (null, or `{ speaker, line, options }`);
  - `actions()`: the actions available now, as strings (for example `look at sign`, `pick up rope`, `use rope on mast`, `talk to cook`, `go to harbour`, `say 2`);
  - `act(name)`: performs one action and returns the text the player sees as a result;
  - moving between places uses actions named `go to <place>`;
  - `screen()`: all the text the player can see right now (scene description, visible objects and people, dialogue).
- In the browser, `window.__quest` offers the same four functions for the game being played.
- Every clickable thing in the page (hotspots, inventory items, dialogue choices, exits) carries `data-action` set to the action string it performs, and can be reached and activated with the keyboard.
- `docs/walkthrough.json` is the list of actions that wins the game from a fresh start.
- `docs/curriculum.json` maps each of the eight ideas (by number, 1 to 8) to the action that proves the player understood it, as `{ "1": "use ... on ...", ... }`.
- Write your other decisions as Markdown files in `docs/`.

## Environment

There is network access for npm packages only. For testing, a Chromium browser and Playwright are installed: `await import(process.env.OE_PLAYWRIGHT)` gives Playwright's API.
