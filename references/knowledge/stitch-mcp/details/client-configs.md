# MCP Client Configurations (Layer 3)

## Mechanism

Seven supported clients. Each has a config format and conventions. All support
both proxy-with-API-key, proxy-with-OAuth, and direct-HTTP modes.

### Claude Code
```bash
# Proxy + API key
claude mcp add stitch -e STITCH_API_KEY=KEY -- npx @_davideast/stitch-mcp proxy
# Proxy + OAuth
claude mcp add stitch -- npx @_davideast/stitch-mcp proxy
# Direct + API key
claude mcp add stitch --transport http https://stitch.googleapis.com/mcp --header "X-Goog-Api-Key: KEY" -s user
```
`-s user` → `$HOME/.claude.json`. `-s project` → `./.mcp.json`.

### VS Code (`.vscode/mcp.json`)
```json
{
  "servers": {
    "stitch": {
      "type": "stdio",
      "command": "npx",
      "args": ["@_davideast/stitch-mcp", "proxy"],
      "env": { "STITCH_API_KEY": "KEY" }
    }
  }
}
```
Direct uses `"type": "http"` + `"url"` + `"headers"`.

### Cursor (`.cursor/mcp.json`)
```json
{ "mcpServers": { "stitch": { "command": "npx", "args": [...], "env": {...} } } }
```
Direct: `"url": "https://stitch.googleapis.com/mcp", "headers": {...}`.

### Gemini CLI
```bash
gemini extensions install https://github.com/gemini-cli-extensions/stitch
```
No JSON needed — extension handles connectivity.

### Codex (`~/.codex/config.toml`)
```toml
[mcp_servers.stitch]
command = "npx"
args = ["@_davideast/stitch-mcp", "proxy"]
[mcp_servers.stitch.env]
STITCH_API_KEY = "KEY"
```
Direct: `url = "https://..."` and `[mcp_servers.stitch.env_http_headers]`.

### OpenCode (`opencode.json`)
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "stitch": { "type": "local", "command": ["npx", ...], "environment": {...} }
  }
}
```
Direct: `"type": "remote"` + `"url"` + `"headers"`.

### Antigravity
Agent Panel > ⋮ > MCP Servers > Manage MCP Servers > View raw config.
```json
{ "mcpServers": { "stitch": { "command": "npx", "args": [...], "env": {...} } } }
```
**Gotcha:** Antigravity uses `serverUrl` (not `url`) for HTTP mode — different from all other clients.

## Analysis

Seven clients, four config file formats (JSON, TOML, extension, CLI add).
The variance is a perfect argument for `init` wizards that know each client
— users should not need to know that Antigravity uses `serverUrl`.

For svc: if we ever ship an MCP server for the framework, matching this
coverage (CC, Cursor, VS Code, Gemini, Codex, OpenCode, Antigravity) is the
bar. The `init` step pattern (`ClientSelectionStep` → `ConfigStep`) is
directly copyable.

## Layer 4 pointers

- Config generation: `src/services/mcp-config/handler.ts` + `handler_apikey.test.ts`
- Client list: `src/commands/init/steps/ClientSelectionStep.ts`
- Per-client install paths: deferred to reading that file
- Gemini extension: https://github.com/gemini-cli-extensions/stitch
- Full matrix with exact JSON: `docs/connect-your-agent.md`
