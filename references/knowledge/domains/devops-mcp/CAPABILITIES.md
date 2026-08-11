# DevOps MCP Domain — Capabilities

**Domain:** DevOps tooling + MCP (Model Context Protocol) ecosystem
**Layer:** 2 (CAPABILITIES)
**Last updated:** 2026-04-12

---

## MCP Ecosystem (as of April 2026)

- MCP is Anthropic's open standard for connecting AI assistants to external tools; 97M+ monthly SDK downloads
- 19,000+ MCP servers catalogued on mcp.so; 95% unmonetized
- 53% of community servers use static API keys or have no auth — security is unclaimed differentiation
- Azure MCP Server shipped CVSS 9.1 (no auth), reached 97M installs — the defining ecosystem security incident
- MCP transport modes: `stdio` (subprocess, simplest), `HTTP/SSE` (hosted/remote); stdio is correct for single-user install
- MCP tool protocol: `tools/list` returns schema-annotated tools; `tools/call` invokes them with JSON args via NDJSON stdin/stdout
- Claude Code registers MCP servers in `~/.claude.json` (global) or `.claude/mcp.json` (project)
- mcp.so provides organic distribution to the install base; GitHub stars are the trust signal for security-conscious users

## K8s Tooling Patterns

- K8sGPT (45K+ stars) proves AI+K8s demand is massive and real
- `client-go` is the official Go K8s client; handles kubeconfig loading, auth token refresh, rate limiting
- Read-only K8s RBAC requires only GET/LIST/WATCH on core API groups (pods, deployments, events, nodes)
- `~/.kube/config` contains user's existing auth (short-lived certs, OAuth tokens) — no new credentials needed
- KUBECONFIG env var overrides default path; must be supported
- `client-go` handles exec-based credentials (EKS, GKE) transparently including token refresh
- CRDs are not queryable via standard clientset; stick to core API groups for MVP
- List operations without namespace filter can be slow on large clusters; default to current context namespace

## Terraform Tooling Patterns

- `terraform show -json` outputs machine-readable plan/state JSON; correct surface for programmatic access
- Works transparently with all backends (local, S3, Terraform Cloud) — terraform handles state retrieval
- `terraform workspace show` returns current workspace
- Terraform marks sensitive values as `(sensitive value)` in output — must never be stripped
- Requires `terraform` binary in PATH; always true for DevOps engineers
- HashiCorp's `github.com/hashicorp/terraform-json` package provides typed Go structs for state JSON

## Credential Security (Infra Tooling)

- Correct pattern: use credentials that already exist (kubeconfig, Terraform workspace) — don't create new ones
- Static API keys are a persistent attack surface; they appear in dotfiles, config repos, logs
- Audit log every query: timestamp, tool name, args, duration — never log response content
- Read-only posture for free tier removes the most dangerous attack surface and builds trust
- SOC 2 alignment: read-only + audit log matches requirements already present in most DevOps orgs

## Go for DevOps CLI Tools

- K8s, Terraform, Prometheus — all Go-native; target users understand Go
- Single binary via `go build`; `go install github.com/org/tool@latest` is the DevOps-native install UX
- `-ldflags="-s -w"` strips debug symbols; ~30% binary size reduction
- Cross-platform: GOOS/GOARCH env vars for all targets
- goreleaser automates multi-platform release builds and GitHub Releases attachment

## Distribution and Monetization

- mcp.so listing provides built-in discovery (organic, no cold-start marketing needed)
- GitHub public repo with stars is the primary trust signal for security-conscious DevOps engineers
- $9/mo Pro tier: rate limits lifted + audit logging enabled; Dodo Payments handles VAT without business entity
- Break-even at 20 paying users ($180/mo covers Claude subscription)
- 21st.dev achieved $10K MRR in 6 weeks with zero marketing via organic MCP discovery (comparable trajectory evidence)
