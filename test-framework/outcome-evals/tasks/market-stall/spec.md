# Market stall: a small full-stack trading game

Build a browser game with Node's standard library only (no npm packages). Create `server.mjs` and `index.html`.

## Server
- `server.mjs` starts an HTTP server on `process.env.PORT` (default 3000).
- `GET /` serves `index.html`.
- State lives in memory.

## Economy
- The player starts with 100 coins on day 1 with an empty inventory.
- Catalog (id: base price): `apple` 5, `bread` 12, `sword` 80.
- **Buy price** of an item is `ceil(base × (10 + n) / 10)`, where `n` is how many of that item were bought today. Use exact integer arithmetic; for example, apple costs 5, then 6, 6, 7, 7, 8.
- **Sell price** is `floor(base × 6 / 10)`. Selling does not change buy prices.
- **Buying** needs enough coins. At most 10 purchases per day in total, across all items.
- **Selling** needs the item in the inventory.
- **Next day:** the day goes up by 1, today's purchase counts reset, and the player earns interest of `floor(coins × 5 / 100)`.

## API
All responses are JSON. A failed action changes nothing.

| Request | Success | Errors |
|---|---|---|
| `GET /api/state` | `{coins, day, inventory, prices}` | |
| `POST /api/buy` with body `{"item": "<id>"}` | the new state | 400 `{"error": "unknown_item"}`, `{"error": "insufficient_coins"}` or `{"error": "daily_limit"}` |
| `POST /api/sell` with body `{"item": "<id>"}` | the new state | 400 `{"error": "unknown_item"}` or `{"error": "not_owned"}` |
| `POST /api/next-day` | the new state | |
| `POST /api/reset` | the starting state | |

- In the state, `inventory` maps item id to count and includes only items with a count above 0. `prices` maps every catalog id to `{buy, sell}`, using current prices.
- A POST body that is not valid JSON, or has no `item` string where one is needed, returns 400 `{"error": "bad_request"}`.
- Unknown routes return 404.

## UI (`index.html`)
Use these `data-testid` attributes. Text values are plain numbers or codes:
- `coins` and `day`;
- for each item: `price-<id>` (current buy price), `owned-<id>` (count, `0` when none), `buy-<id>` and `sell-<id>` (buttons);
- `next-day` (button);
- `error`: shows the error code of the last failed action, such as `insufficient_coins`, and is empty after a successful action.

The page loads the state from the API on open and updates after every action without reloading.
