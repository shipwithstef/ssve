# Site Generator (Layer 3)

## Mechanism

`site -p <id>` produces a deployable Astro project from a Stitch project by
interactively mapping screens to routes.

### Workflow
1. User runs `site -p <projectId>` (`-o <dir>` optional, defaults to `.`)
2. Interactive Ink mapper (`src/commands/site/ui/SiteBuilder.tsx`) presents
   each screen with three actions per screen:
   - **Include** — assign route path (e.g. `/`, `/about`)
   - **Exclude** — skip but keep for later
   - **Discard** — remove from consideration
3. `suggestRoute()` proposes a route from screen title.
4. Generator (`src/commands/site/generate/handler.ts`) downloads HTML + assets
   using `fetchWithRetry`, transforms via `@astrojs/compiler` + `cheerio`.
5. Writes scaffolded project:
   ```
   output/
   ├── package.json          # Astro deps
   ├── astro.config.mjs
   ├── src/
   │   ├── layouts/Layout.astro    # shared shell
   │   └── pages/
   │       ├── index.astro         # → /
   │       └── about.astro         # → /about
   └── public/assets/               # downloaded images/fonts
   ```
6. User runs `npm install && npm run dev` → localhost:4321.

### `--export` mode
Emits JSON compatible with `build_site` virtual tool instead of scaffolding:
```json
{ "projectId": "123", "routes": [{"screenId":"abc","route":"/"},...] }
```
Use case: human picks routes interactively, hands off to agent:
```bash
npx @_davideast/stitch-mcp tool build_site \
  -d "$(npx @_davideast/stitch-mcp site -p 123 --export)"
```

### `SiteManifest`
Stored mapping of screens→routes (`src/commands/site/utils/SiteManifest.ts`).
Tests at `SiteManifest.test.ts`.

### Tool equivalence
The `build_site` virtual tool does the same thing programmatically:
1. Agent calls `list_screens` to discover
2. Decides assignments based on title/metadata
3. Calls `build_site` with `{projectId, routes:[...]}`
4. Gets back `{pages: [{screenId, route, title, html}]}`
5. Generates framework-specific code from HTML

## Analysis

The interactive-mapper-OR-JSON-export split is a reusable UX pattern:
**"let humans decide interactively, then emit machine-readable output that
agents can consume."** Bridges the gap between "agent automates everything"
(bad when decisions are judgment calls) and "human clicks every screen"
(bad when there are 50 screens).

For svc: many skills could benefit from this — e.g., a skill that lets the
user interactively confirm a proposed ACs list, then emits a JSON file that
downstream skills consume. The pattern is stronger than pure yes/no prompts
because the output is structured.

The choice of Astro is pragmatic (file-based routing, HTML-first, minimal
JS) — matches the shape of Stitch output well. Not a recommendation for svc,
just context.

## Layer 4 pointers

- Generator: `src/commands/site/generate/handler.ts`, `handler.test.ts`, `spec.ts`
- Interactive UI: `src/commands/site/ui/{SiteBuilder,ScreenList}.tsx`, `index.tsx`
- Route suggester: `src/commands/site/utils/suggestRoute.ts` + tests
- Retry fetch: `src/commands/site/utils/fetchWithRetry.ts` + tests
- Manifest: `src/commands/site/utils/SiteManifest.ts` + tests
- Export test: `src/commands/site/export.test.ts`
- List screens handler (used by mapper): `src/commands/site/list-screens/handler.ts`
- Hook: `src/commands/site/hooks/useProjectHydration.ts`
