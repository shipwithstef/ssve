# Serve & Preview (Layer 3)

## Mechanism

### `serve -p <id>` — Vite dev server

`StitchViteServer` at `src/lib/server/vite/StitchViteServer.ts`. Features:

- **Routes:** each screen at `/screens/{screenId}`.
- **Asset proxy:** `/_stitch/asset?url=<url-encoded-upstream-url>` fetches external
  resources (fonts, images, signed URLs from Stitch) through the dev server to
  work around CORS and auth.
- **CSS url() rewriting:** `src/lib/server/vite/plugins/virtualContent.ts` plugin
  rewrites CSS `url(...)` to point at `/_stitch/asset?url=...` so fonts/images
  resolve correctly.
- **Disk cache:** `.stitch-mcp/cache/` stores fetched assets locally.
- **AssetGateway** (`src/lib/server/AssetGateway.ts`) — the fetch+cache layer.
  Has `tests/security/ssrf-asset-proxy.test.ts` guarding against SSRF abuse of
  the asset proxy endpoint.
- Hot reload on source changes.

### `screens -p <id>` — terminal browser

Ink-based TUI (React in terminal). Lists screens with thumbnails/metadata.
Keys: `v` preview in browser, `c` copy data, `o` open in Stitch web, `q` quit.

### `view` — tree browser

Interactive resource explorer. `InteractiveViewer.tsx` renders a `JsonTree`
with arrow nav, Enter to drill in, `c`/`cc` copy, `s` preview HTML via local
serve, `o` open Stitch web.

`copy-behaviors/` and `serve-behaviors/` are behavior registries — plug-in
style handlers for "what happens when user presses c/s on this node type".
Each has a `registry.ts`, `handlers.ts`, `types.ts`.

### `site -p <id>` — Astro site generator

- `src/commands/site/` — interactive mapper + generator
- `src/commands/site/hooks/useProjectHydration.ts` — hydrates project data from Stitch
- `src/commands/site/utils/SiteManifest.ts` — manifest format
- `src/commands/site/utils/suggestRoute.ts` — suggest route path from screen title
- `src/commands/site/utils/fetchWithRetry.ts` — resilient asset download
- Uses `@astrojs/compiler` + `cheerio` to transform HTML → `.astro` files
- Output: `src/pages/{route}.astro`, `src/layouts/Layout.astro`, `public/assets/`
- `--export` flag → emit `build_site`-compatible JSON instead of scaffolding

## Analysis

The asset proxy + CSS rewriting is the non-obvious part. Stitch designs
reference external assets via signed URLs that expire and require auth. A
naive "just open the HTML in a browser" approach would 401/timeout. The
proxy pattern — intercept CSS, rewrite urls to local endpoint, fetch+cache
server-side — is the right solution and is reusable for any "preview
third-party-signed design assets" case.

SSRF test coverage for the asset proxy is a good signal: the team knows this
is a trust boundary. Any svc tool that proxies arbitrary URLs should
mirror this.

The `copy-behaviors`/`serve-behaviors` registry pattern is a clean extension
point: new resource types get a handler, not a giant switch statement.

## Layer 4 pointers

- Vite server: `src/lib/server/vite/StitchViteServer.ts`
- Virtual content plugin: `src/lib/server/vite/plugins/virtualContent.ts`
- Asset gateway: `src/lib/server/AssetGateway.ts`
- SSRF test: `tests/security/ssrf-asset-proxy.test.ts`
- Site generator: `src/commands/site/generate/handler.ts`
- Behavior registries: `src/ui/copy-behaviors/`, `src/ui/serve-behaviors/`
- Ink TUI: `src/commands/serve/ServeView.tsx`, `src/commands/screens/ScreensView.tsx`, `src/ui/InteractiveViewer.tsx`, `src/ui/JsonTree.tsx`
