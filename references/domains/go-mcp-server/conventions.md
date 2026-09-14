# Go MCP Server — Code Conventions

**Domain:** MCP server binary in Go using stdio transport
**Last updated:** 2026-04-12
**Applies to:** Valluri and any future Go MCP server project

---

## Project Layout

```
cmd/<name>/main.go          # entry point: init server, register tools, start loop
internal/
  <domain>/                 # one package per integration (k8s/, terraform/, etc.)
    client.go               # auth + client initialization
    queries.go              # query functions (one func per MCP tool)
  mcp/
    server.go               # MCP protocol loop (or thin wrapper over mcp-go SDK)
    tools.go                # tool registration
  audit/
    logger.go               # append-only audit log writer
go.mod
go.sum
```

## Naming

- Tool names: `snake_case` (MCP spec convention): `get_pods`, `show_plan`, `get_logs`
- Go functions: `GetPods`, `ShowPlan`, `GetLogs` (PascalCase, exported from internal package)
- Tool parameter names: `snake_case` in JSON Schema, camelCase in Go struct tags
- Binary name: same as module base name (`valluri`, not `valluri-mcp-server`)

## MCP Tool Registration Pattern

```go
// Register all tools at startup, not lazily
// Each tool: name (snake_case) + description + JSON Schema + handler func
server.RegisterTool("get_pods", &mcp.Tool{
    Description: "List pods in a Kubernetes namespace",
    InputSchema: mcp.Schema{
        Type: "object",
        Properties: map[string]mcp.Property{
            "namespace": {Type: "string", Description: "Kubernetes namespace (default: current context namespace)"},
            "label_selector": {Type: "string", Description: "Label selector filter (e.g. app=nginx)"},
        },
    },
    Handler: k8sClient.GetPods,
})
```

## stdin/stdout Discipline

- **Never write to stdout except MCP protocol messages.** Any debug output → stderr or log file.
- **Never write to stderr in production.** Claude Code captures stderr and may display it. Use `~/.valluri/debug.log` for debug output.
- **Use `os.Stdin` / `os.Stdout` directly.** Do not use `fmt.Println` anywhere in the MCP path.
- **Flush after every response.** `bufio.Writer.Flush()` or use unbuffered writer.

## Response Size Limits

- Default `tail_lines: 100` for log queries — never return unbounded logs
- Truncate resource lists at 50 items with a `truncated: true` flag
- Return counts alongside items: `{"pods": [...], "total": 347, "shown": 50}`
- Max JSON response: aim for <100KB. Above this, K8s log responses get unwieldy.

## Timeout Policy

All outbound calls (K8s API, Terraform subprocess) must have explicit timeouts:
```go
ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
defer cancel()
```

Default: 10s for K8s API calls, 30s for `terraform show -json` (can be slow on large state).

## Error Responses

Return structured errors in MCP format, not raw Go errors:
```go
return &mcp.CallToolResult{
    IsError: true,
    Content: []mcp.Content{{
        Type: "text",
        Text: "Failed to list pods: context deadline exceeded. Is the cluster reachable?",
    }},
}
```

Never expose stack traces or internal error details in MCP responses.

## Credential Loading Order

```
K8s:
  1. KUBECONFIG env var
  2. ~/.kube/config
  3. In-cluster config (if running inside K8s) — future

Terraform:
  1. --workdir flag (explicit, required by user)
  2. Current directory (fallback only if explicit is not set)
```

## Audit Log Format

```json
{"ts":"2026-04-12T10:30:00Z","tool":"get_pods","args":{"namespace":"production"},"duration_ms":234,"result_size_bytes":1842}
```

One JSON object per line, appended to `~/.valluri/audit.log`.
Never log response content — only metadata.

## Build & Distribution

```bash
# Local build
go build -o valluri ./cmd/valluri

# Cross-platform releases (via goreleaser or manual)
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o valluri-linux-amd64 ./cmd/valluri
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o valluri-darwin-arm64 ./cmd/valluri
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o valluri-windows-amd64.exe ./cmd/valluri

# Install from source
go install github.com/s7an-it/valluri/cmd/valluri@latest
```

Use `-ldflags="-s -w"` to strip debug symbols and reduce binary size (~30% reduction).

## Testing

- Unit test query functions with mock K8s clients (`k8s.io/client-go/kubernetes/fake`)
- Integration test the MCP protocol loop with a test harness that sends NDJSON requests
- No testing against real clusters in CI
- Test timeout behavior explicitly — mock slow responses

## Free Tier vs Pro Tier Gates

```go
type Tier int
const (TierFree Tier = iota; TierPro)

func (s *Server) checkTier(required Tier) error {
    if s.tier < required {
        return errors.New("this feature requires Valluri Pro ($9/mo) — see https://valluri.dev/pro")
    }
    return nil
}
```

Gate: audit log (Pro), rate limit lift (Pro). Free tier: full read access, local-only logging.
