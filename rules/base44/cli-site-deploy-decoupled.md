# Base44 CLI `site deploy`: the Sandbox-Decoupled UI Publish Path

There are **two independent ways** a Base44 `user_app` frontend reaches production, and they do not sync to each other:

1. **Sandbox/git model** (the platform's native path) — the Base44 web editor or git sync builds your source *inside Base44's sandbox* and serves that build. Runtime app config (`appId`, backend URL) is injected by the platform via `/api/frontend-config.js` → `window.__APP_CONFIG__`.
2. **CLI static-publish model** — `npx base44 site deploy` uploads your *local* `dist/` (your own `npm run build` output) straight to the live hosting slot. It never touches the sandbox.

`npx base44 site deploy` **does** change the live site — verified in a real browser, not just by the CLI's "Site deployed successfully" message. But it carries two gotchas that make it silently useless if you don't account for them.

## Gotcha 1 — git sync reverts CLI deploys

If the app is `connected_to_github: true`, git sync periodically republishes the **pinned repo commit** (`last_git_commit_hash`) into the sandbox and over the live site — clobbering whatever `site deploy` just pushed. Symptom: "I deployed, saw the change, then it reverted to the old/sandbox state."

- Check: `curl .../api/apps/$APP_ID | jq '{connected_to_github, git_remote_source, last_git_commit_hash}'`
- For CLI `site deploy` to **persist**, git sync must be disconnected (`connected_to_github: false`, `git_remote_source: "s3"`). Verified: with git detached, repeated `site deploy`s held with no reversion.
- Also: never deploy from the web editor afterward — it republishes the (now-stale) sandbox over your CLI deploy. Pick ONE source of truth.

## Gotcha 2 — a raw build deploys with NO app config → every SDK call 405s

Your local Vite build has no `appId`/`serverUrl` baked in unless you set them. The platform normally injects them at runtime; a static CLI deploy does not. Result: the deployed UI renders fine (static markup, colors, copy), but every Base44 SDK call (`functions.invoke`, `entities.*`, analytics) hits a broken URL and dies:

```
POST https://<app>.base44.app/null/api/apps/null/functions/<name>  → 405
                                ^^^^          ^^^^  appId/serverUrl resolved to null
```

The fix is to bake the app config at **build time** via the `@base44/vite-plugin` env vars:

```bash
VITE_BASE44_APP_ID=<app-id> \
VITE_BASE44_BACKEND_URL=https://<app-subdomain>.base44.app \
VITE_BASE44_APP_BASE_URL=https://<app-subdomain>.base44.app \
npm run build
npx base44 site deploy -y
```

- `VITE_BASE44_BACKEND_URL` MUST be the **app subdomain**, NOT `app.base44.com`. Backend functions are rejected on the platform domain ("Backend functions cannot be accessed from the platform domain. Use the app's subdomain instead.") but served at `https://<app-subdomain>.base44.app/api/apps/<id>/functions/<name>`.
- After baking config: verified `functions.invoke` + `entities.*` work from the CLI-deployed build (live data rendered). A `401` on `entities/User/me` for anonymous visitors is **expected** (not logged in) and handled by the app's auth guard — not a regression.

## When this path is the RIGHT choice

- **Backend-only apps / changes** — entities + functions are managed purely via CLI (`entities push`, `functions deploy`); there's no UI bundle to worry about at all.
- **Static / SDK-free frontends** — marketing/landing pages with no `@base44/sdk` data calls: Gotcha 2 doesn't bite, so even a config-less build is fine.
- **Staging / preview / headless CI** — no dependency on git sync + a human-open Base44 UI tab (which the platform's native auto-deploy requires; see base44-environment skill "Primary Deploy Flow"). The CLI path is fully scriptable and headless-safe.

## When NOT to use it

- When the app is the team's canonical product and **must stay in sync with the web editor / git** — the CLI deploy intentionally diverges from the sandbox; the editor will show stale code, and any editor/git republish silently reverts the CLI deploy.
- When you want one artifact to be both the live site AND the editable source — that requires the sandbox/git path, not static publish.

## Verify, don't trust the CLI message

"Site deployed successfully" only means the upload succeeded. Confirm the change actually rendered:
- `curl` is NOT sufficient — the root domain serves Base44's generic platform shell (auth loader, `"APP_FLAVOR": "platform"`) to unauthenticated/non-browser clients; the real app renders client-side. Use a real browser (Playwright) to read the rendered DOM / computed styles, and target the production URL.
- A unique build marker (a `data-*` token or a distinct string) proves causation vs. seeing leftover state.

## Origin

Captured 2026-06-11 investigating Creator Campfire (app `693a01552acaf691bc2b99c0`, `platform_version: 4`, `is_managed_source_code: true`, `using_sandbox: true`). CLI `site deploy` appeared to "do nothing," then changes appeared, then reverted — root cause was git sync republishing commit `dc0fec3` over each deploy. After disconnecting git sync, CLI deploys persisted. Browser (Playwright) validation then surfaced Gotcha 2: a raw build's SDK calls went to `/null/api/apps/null/...` (405) until rebuilt with `VITE_BASE44_*` env vars, after which functions + entities rendered live data end-to-end. Earlier `curl`-only verification gave a false "deploy isn't served" conclusion because curl only ever saw the platform auth shell.

## Related

- `~/.claude/skills/base44-environment/SKILL.md` §"Primary Deploy Flow" — the sandbox/git deploy model (the other path)
- `rules/base44/static-assets-public-dir.md` — HTTP 200 / Content-Type is not proof of deploy (same "verify, don't trust" theme)
- `rules/base44/function-deploy-404-check-secrets.md` — another misleading-success Base44 deploy failure mode
