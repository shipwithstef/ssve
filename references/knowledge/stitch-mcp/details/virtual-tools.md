# Virtual Tools (Layer 3)

## Mechanism

A virtual tool is a TypeScript object registered with the stitch-mcp proxy that
agents call through the standard MCP protocol. The proxy exposes them alongside
upstream Stitch tools. They exist because upstream tools are atomic (e.g.
`get_screen` returns metadata + download URLs, not HTML); agents need composed
operations.

### Interface

```typescript
interface VirtualTool {
  name: string;                           // snake_case, must match registry
  description?: string;                    // start with "(Virtual)"
  inputSchema?: {                          // JSON Schema
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
  execute: (client: StitchMCPClient, args: any) => Promise<any>;
}
```

### The client

Every `execute` receives an authenticated `StitchMCPClient`:
- `client.callTool(name, args)` → calls any upstream tool, handles auth/connection/errors.
- `client.getCapabilities()` → returns `{ tools: [...] }` with names, descriptions, and schemas.

### Registration

Add to array in `src/commands/tool/virtual-tools/index.ts`:
```typescript
export const virtualTools: VirtualTool[] = [
  getScreenCodeTool, getScreenImageTool, buildSiteTool, listToolsTool,
];
```

### The 4 built-ins

| Tool | Pattern | Logic |
|------|---------|-------|
| `get_screen_code` | Wrapper | call `get_screen` → follow `screen.htmlCode.downloadUrl` → return `{...screen, htmlContent}` |
| `get_screen_image` | Wrapper | call `get_screen` → download PNG → return `{...screen, screenshotBase64}` |
| `build_site` | Orchestrator | validate unique routes → `ProjectSyncer.fetchManifest(projectId)` → `pLimit(3)` parallel HTML fetches → `{success, pages:[{screenId,route,title,html}]}` |
| `list_tools` | Passthrough | `return (await client.getCapabilities()).tools || []` |

### Three patterns documented

1. **Wrapper** — 1 upstream call + 1 fetch + 1 return. Start here.
2. **Orchestrator** — validate input first (throw descriptive errors like
   `'Duplicate route paths found'`), use `pLimit(N)` for concurrency, collect
   errors rather than fail-first, assemble structured result.
3. **Passthrough** — forward a single client method.

### Testing via CLI
```bash
stitch tool                       # list all
stitch tool build_site -s         # show schema
stitch tool build_site -d '{...}' # invoke
```

## Analysis — why this matters for svc

This is the cleanest in-the-wild example of **MCP tool composition as a
first-class pattern**. The naming (`(Virtual)` prefix, `snake_case`) and
interface shape are small, copyable conventions. `pLimit(3)` for concurrency
caps is a direct lesson — agents that spawn N parallel MCP calls hammer
upstream APIs without it.

The "atomic upstream → composed virtual" split is the same shape as svc's
"skill invokes MCP tool, skill composes workflow". Virtual tools here live
inside the MCP server; svc skills live outside. Same principle, different
boundary.

## Layer 4 pointers

- Interface: `src/commands/tool/spec.ts` (VirtualTool type)
- Client: `src/services/mcp-client/client.ts` (inferred from imports; not
  explicitly read — the file referenced in docs uses that path)
- Registry: `src/commands/tool/virtual-tools/index.ts`
- Built-ins: `src/commands/tool/virtual-tools/{build-site,get-screen-code,get-screen-image,list-tools}.ts`
- Tests: `tests/commands/tool/virtual-tools/*.test.ts`
- Docs: `docs/virtual-tools.md`, `docs/build-virtual-tools.md`
