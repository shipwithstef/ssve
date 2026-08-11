# Upstream Stitch MCP Tools (Layer 3)

## Mechanism

Upstream tools come directly from Google's Stitch MCP server at
`https://stitch.googleapis.com/mcp`. Available in both proxy and direct modes.

| Tool | Purpose | Notes |
|------|---------|-------|
| `list_projects` | List all Stitch projects accessible to user | No params |
| `get_project` | Get project details by resource name | |
| `list_screens` | List all screens within a project | Requires `projectId` |
| `get_screen` | Screen metadata + download URLs | **Does NOT return HTML** — returns `htmlCode.downloadUrl` (signed) which must be fetched separately |
| `generate_screen_from_text` | Generate new screen from text prompt | |
| `edit_screens` | Edit existing screens via text prompt | |
| `generate_variants` | Generate design variants of existing screens | |

### Common parameter traps

- `screenId` is a hex string (e.g. `98b50e2ddc9943efb387052637738f61`), not the
  display name. Use `list_screens` to find IDs.
- `projectId` is numeric (e.g. `4044680601076201931`).
- `get_screen` returns a signed download URL — don't try to treat its output as
  HTML. Use `get_screen_code` (virtual) for that.

## Analysis

The upstream surface is intentionally atomic: list, get, generate, edit,
variants. This is a design choice that keeps the MCP server simple but shifts
composition burden to agents (or proxies). The `get_screen`/`downloadUrl` split
is standard Google API practice (signed URLs for binary payloads) but surprises
agents that expect "get_X returns X".

## Layer 4 pointers

- Google docs (JS-rendered, not machine-readable): https://stitch.withgoogle.com/docs/mcp/setup
- API enable: `gcloud beta services mcp enable stitch.googleapis.com`
- HTTP endpoint: `https://stitch.googleapis.com/mcp` with `X-Goog-Api-Key` header
- SDK: `@google/stitch-sdk` on npm
- Invoked from stitch-mcp via: `client.callTool('<upstream_name>', args)`
