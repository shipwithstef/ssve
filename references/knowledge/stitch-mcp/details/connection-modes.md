# Connection Modes (Layer 3)

## Mechanism

### Proxy (stdio)
```
Agent  <-stdio->  stitch-mcp proxy (child process)  <-HTTPS->  Stitch API
```
- MCP client launches proxy as child via stdin/stdout.
- Proxy handles OAuth token refresh every 55 min (tokens expire at 60 min).
- Exposes upstream tools + 4 virtual tools.
- No port/firewall config needed.

### Direct (HTTP)
```
Agent  <-HTTPS->  https://stitch.googleapis.com/mcp
```
- One HTTPS connection. Header: `X-Goog-Api-Key: <key>` (or OAuth Bearer).
- No child process, no local state.
- **Only upstream tools** — virtual tools not available.
- Manual token refresh for OAuth (1hr expiry).

## Comparison table

| | Proxy (stdio) | Direct (HTTP) |
|---|---|---|
| Virtual tools | Yes (4) | No |
| Token refresh | Auto every 55 min | Manual (OAuth) or N/A (API key) |
| API key auth | Yes | Yes |
| OAuth auth | Yes | Yes but manual refresh |
| Setup complexity | Requires npx/child-process | Just URL + headers |
| CI/serverless friendly | Less (spawns process) | More |

## When to use each

- Interactive coding sessions → **proxy** (virtual tools + auto refresh)
- CI, scripts, serverless, containers without exec → **direct** (API key)
- Switching between them is config-only, same creds work.

## Analysis

The proxy-as-token-refresher is the most copyable pattern here: any MCP server
that fronts an upstream with short-lived credentials should consider this.
The 55/60 min refresh window is standard for GCP OAuth tokens.

The virtual-tools-only-in-proxy split creates a real lock-in: if a team writes
skills around `build_site` and later moves to direct mode (e.g. CI), those
skills break. Worth remembering when designing any skill that depends on
composed MCP operations.

## Layer 4 pointers

- Proxy handler: `src/commands/proxy/handler.ts`
- Debug log: `/tmp/stitch-proxy-debug.log` (with `--debug`)
- Transport toggle: `--transport stdio|http` on `proxy` command
- OAuth refresh logic: lives inside the bundled gcloud install at
  `~/.stitch-mcp/google-cloud-sdk/` — stitch-mcp shells out to it
