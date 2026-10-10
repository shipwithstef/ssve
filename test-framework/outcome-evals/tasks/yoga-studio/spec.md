# Request

Build a paid booking web app for a small yoga studio: customers book and pay for classes online, and the owner manages the schedule.

Environment: there is no network access and no npm packages are available, so use Node's standard library only. `node server.mjs` must start the app on `process.env.PORT` (default 3000). For testing only, a Chromium browser and Playwright are installed: `await import(process.env.OE_PLAYWRIGHT)` gives Playwright's API.
