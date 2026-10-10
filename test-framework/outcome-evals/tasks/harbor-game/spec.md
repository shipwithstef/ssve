# Request

Build a small browser game people want to replay: at night, you work a harbor lighthouse and guide ships home past the rocks while storms make it harder. Make it feel good to play.

Contract (so the game can be tested automatically):
- `game/logic.mjs` holds the game rules and exports `createGame(seed)`. It must run in Node with no browser globals, and all randomness must come from `seed`, so the same seed and the same inputs always give the same game.
- The object it returns has `actions()` (the names of the inputs the player can make right now, as strings; empty only once the game is over), `step(action, dtMs)` (apply one action name, or `null` for no input, then advance the game by `dtMs` milliseconds) and `state()` (a JSON-serialisable object with a numeric `score` and a boolean `over`).
- A player who does nothing must eventually lose.
- In the browser, the running game object is `window.__game`.

Environment: there is no network access and no npm packages are available, so use Node's standard library and browser APIs only. `node server.mjs` must serve the game on `process.env.PORT` (default 3000). For testing only, a Chromium browser and Playwright are installed: `await import(process.env.OE_PLAYWRIGHT)` gives Playwright's API.
