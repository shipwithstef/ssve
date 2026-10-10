# Request

I want an online fantasy RPG I can play solo and with friends: an original world inspired by Middle-earth, with the feel of Lord of the Rings Online. Get it to a first playable version I could show players, and tell me everything I need to take it to launch: what to build it with and why, how the game should work (world, quests, progression, economy), how it makes money fairly, what it costs to run and how it scales, what could get us into legal trouble, how accounts stay secure, and how we announce it.

## Contract (so the build can be tested automatically)

- `npm install` then `npm start` serves the game on `process.env.PORT` (default 3000); opening `/` in a browser plays it. One player alone can play solo. Two players who open it in two browsers are in the same world and see each other.
- In the browser, `window.__game` provides `state()`, returning a JSON object with `you: { id, x, y }` and `players: [{ id, x, y }]` (everyone in your world, you included); `actions()`, returning the names of the inputs available now; and `act(name)`, which performs one.
- The game rules (movement, combat, quests, loot, economy) live in a module that runs in Node without a browser.
- Write your decisions for the founder as Markdown files in `docs/`.

## Environment

There is network access for npm packages only. For testing, a Chromium browser and Playwright are installed: `await import(process.env.OE_PLAYWRIGHT)` gives Playwright's API.
