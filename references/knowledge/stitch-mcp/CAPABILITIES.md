# stitch-mcp — CAPABILITIES (Layer 2)

**What:** CLI + MCP proxy by David East (Google DevRel) that moves AI-generated UI
designs from Google's Stitch platform into developer workflows. Acts as a local
proxy between coding agents (Claude Code, Cursor, VS Code, Gemini CLI, Codex,
OpenCode, Antigravity) and the upstream Stitch MCP server at
`https://stitch.googleapis.com/mcp`.

**Package:** `@_davideast/stitch-mcp` (npm, Apache 2.0, v0.5.3 at SHA `bca95541`)
**Upstream:** Google Stitch API (`stitch.googleapis.com`, enabled via
`gcloud beta services mcp enable stitch.googleapis.com`)
**Related Google official MCP info:** [stitch.withgoogle.com/docs/mcp/setup](https://stitch.withgoogle.com/docs/mcp/setup) — but the page is a JS-rendered SPA, not machine-readable from WebFetch. Content surfaced via search results only.

## Capabilities

### CLI commands (10 total)
- **init** — 9-step wizard: client selection → auth mode (API key/OAuth) → gcloud install → auth → transport → project select → IAM/API enable → MCP config gen → connection test. Supports `--client`, `--transport`, `--yes`, `--defaults`, `--local`. See [details/commands.md](details/commands.md).
- **doctor** — 7 health checks (API key presence, gcloud install ≥400.0.0, auth, ADC, project, API key connection, API connection). `--verbose` prints HTTP errors.
- **logout** — Revoke credentials. `--force --clear-config` fully resets `~/.stitch-mcp/`.
- **serve -p <id>** — Vite dev server. Screens at `/screens/{screenId}`. Asset proxy at `/_stitch/asset?url=...`. CSS url() rewriting. Disk cache at `.stitch-mcp/cache/`. See [details/serve-and-preview.md](details/serve-and-preview.md).
- **screens -p <id>** — Terminal screen browser. Keys: `v` preview, `c` copy, `o` open in Stitch, `q` quit.
- **view** — Interactive tree browser. Keys: arrows nav, Enter drill, `c`/`cc` copy, `s` preview HTML, `o` open, `q` quit.
- **site -p <id>** — Generate Astro project from screens via interactive route mapper (include/exclude/discard). Output: `src/pages/*.astro`, `src/layouts/Layout.astro`, `public/assets/`. `--export` emits `build_site` JSON instead. See [details/site-generator.md](details/site-generator.md).
- **snapshot** — UI snapshot with data state (`-c command`, `-d data.json`, `-s schema`).
- **tool [name]** — Invoke any MCP tool from CLI. `-s` schema, `-d` JSON data, `-f` JSON file, `-o json|pretty|raw`. Run without name to list all.
- **proxy** — Start MCP proxy. `--transport stdio|http`, `--port`, `--debug` (logs to `/tmp/stitch-proxy-debug.log`).

### Two connection modes
- **Proxy (stdio):** `agent <-stdio-> stitch-mcp proxy <-HTTP-> Stitch API`. Enables virtual tools. Auto-refreshes OAuth tokens every 55 min.
- **Direct (HTTP):** `agent <-HTTP-> Stitch API` at `https://stitch.googleapis.com/mcp` with `X-Goog-Api-Key` header. Upstream tools only, no virtual tools, manual 1hr token refresh.
See [details/connection-modes.md](details/connection-modes.md).

### Upstream Stitch MCP tools (7) — available in both modes
`list_projects`, `get_project`, `list_screens`, `get_screen` (returns metadata + download URLs, NOT HTML), `generate_screen_from_text`, `edit_screens`, `generate_variants`. See [details/upstream-tools.md](details/upstream-tools.md).

### Virtual tools (4) — proxy only
Combine multiple upstream calls into agent-callable operations:
- **get_screen_code** — calls `get_screen` + downloads HTML from returned URL → adds `htmlContent` field.
- **get_screen_image** — calls `get_screen` + downloads PNG → adds `screenshotBase64`.
- **build_site** — maps `[{screenId, route}]` to routes, validates unique paths, fetches HTML in parallel with `pLimit(3)`. Returns `{success, pages: [{screenId, route, title, html}], message}`.
- **list_tools** — forwards `client.getCapabilities().tools`.
Implemented via `VirtualTool` interface: `{name, description, inputSchema, execute(client, args)}` where `client` is `StitchMCPClient` with `callTool(name, args)` and `getCapabilities()`. See [details/virtual-tools.md](details/virtual-tools.md).

### Authentication (3 modes)
- **API key** — `STITCH_API_KEY` env or `X-Goog-Api-Key` header. No expiry. Recommended for CI/headless.
- **OAuth bundled gcloud** — installs isolated gcloud at `~/.stitch-mcp/google-cloud-sdk/` with config at `~/.stitch-mcp/config/`. 1hr tokens, auto-refreshed at 55 min by proxy.
- **OAuth system gcloud** — set `STITCH_USE_SYSTEM_GCLOUD=1` to use system install. Requires `gcloud auth application-default login` + `gcloud config set project` + Stitch API enabled.
Detection: WSL, SSH, Docker, Cloud Shell detected automatically → browser-auth workaround (copy URL).

### Environment variables
`STITCH_API_KEY`, `STITCH_ACCESS_TOKEN`, `STITCH_USE_SYSTEM_GCLOUD`, `STITCH_PROJECT_ID`, `GOOGLE_CLOUD_PROJECT`, `STITCH_HOST`.

### Client configs supported (7)
Claude Code (`claude mcp add`), VS Code (`.vscode/mcp.json`), Cursor (`.cursor/mcp.json`), Gemini CLI (extension), Codex (`~/.codex/config.toml`), OpenCode (`opencode.json`), Antigravity (uses `serverUrl` not `url`). See [details/client-configs.md](details/client-configs.md).

### Agent Skills integration
Docs promote pairing with [agentskills.io](https://agentskills.io) — markdown `SKILL.md` directory format, progressive disclosure (metadata ~100 tokens, body <5000, resources on demand). References existing ecosystem at [google-labs-code/stitch-skills](https://github.com/google-labs-code/stitch-skills): `react-components`, `design-md`, `stitch-loop`, `enhance-prompt`, `remotion`, `shadcn-ui`. Example: `design-review` skill compares implementation to design via `get_screen_code` + `get_screen_image`. See [details/agent-skills.md](details/agent-skills.md).

### Architecture pattern — Typed Service Contracts
Internal `.gemini/skills/typed-service-contract/` defines repo's architecture: **Spec & Handler** pattern (vertical slice + Design by Contract). `spec.ts` declares Zod input/output/error schemas + discriminated `Result` union + interface. `handler.ts` implements interface, **never throws** (errors as values). Contract tests vs logic tests split. Pattern is used across all `src/commands/*/` and `src/services/*/`. See [details/architecture.md](details/architecture.md).

### Tech stack
- Runtime: Bun (preferred) + Node ≥18
- MCP SDK: `@modelcontextprotocol/sdk` ^1.25.2
- Stitch SDK: `@google/stitch-sdk` ^0.0.3 (with MockStitchSDK for tests)
- CLI: `commander`, `@inquirer/prompts`, `ink` (React TUI), `chalk`
- Dev server: Vite 7 (`StitchViteServer` with `virtualContent` plugin + `AssetGateway`)
- Site gen: `@astrojs/compiler`, `cheerio`
- Validation: `zod` ^3.24
- Concurrency: `p-limit`

### Testing
`bun test` with `./tests/setup.ts` preload. Benchmarks at `tests/benchmark_*.ts`. SSRF test at `tests/security/ssrf-asset-proxy.test.ts`. Spec tests (`*.spec.test.ts`) for Zod contracts separate from handler tests.

## Meaningful to svc

- **Virtual tools pattern** — composing multiple MCP tool calls into higher-level agent-callable operations is directly analogous to svc skill composition. Pattern: validate → orchestrate with concurrency cap → structured result. Relevant for any MCP server svc builds.
- **Spec & Handler pattern** — Zod-parsed inputs, Result monads, never-throw handlers, split contract/logic tests. Parallels svc's skill contracts + self_verify + deterministic outputs. Reference architecture for tool-heavy skills.
- **Agent Skills framing** — confirms the industry pattern: `SKILL.md` + progressive disclosure. Google ecosystem (google-labs-code/stitch-skills) is an independent instantiation worth tracking as a competitor/reference in the skill marketplace space.
- **Bundled vs system dep isolation** — isolating gcloud under `~/.stitch-mcp/` is a good pattern for tools that need specific CLI versions without polluting the user's environment.
- **Proxy-as-token-refresher** — the 55-min refresh pattern is a generic solution for any MCP server fronting a short-lived-credential upstream.

## Non-obvious gotchas

- `get_screen` does NOT return HTML — it returns metadata + signed download URLs. `htmlCode.downloadUrl` must be fetched separately. Virtual tool `get_screen_code` hides this.
- Direct HTTP mode loses ALL virtual tools. Switching proxy↔direct is a config-only change.
- `build_site` validates unique route paths and errors on duplicates. Missing `screenId`s throw with a list.
- Antigravity uses `serverUrl` instead of `url` — different from every other client.
- Bundled gcloud and system gcloud can conflict: "already authenticated" confusion is often the wrong instance.
- OAuth URL prints with a 5-second timeout — easy to miss. `--debug` logs to `/tmp/stitch-proxy-debug.log`.
- Screen IDs are hex strings like `98b50e2ddc9943efb387052637738f61`, NOT display names. Project IDs are numeric like `4044680601076201931`.
- Bun is preferred internal runtime (`GEMINI.md` says "default to Bun, not Node"); npm publish still targets Node ≥18 users.
