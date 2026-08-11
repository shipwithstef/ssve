# Base44 AI Tooling And Integrations - Detail

## Mechanism (factual)

Base44's backend overview does not treat AI support as an afterthought. It documents AI-facing tooling as a first-class part of the platform.

There are three documented project skills:

- `base44-cli` for setup, resource management, project config, connectors, types, and deployment
- `base44-sdk` for feature implementation with entities, auth, functions, integrations, subscriptions, and app logs
- `base44-troubleshooter` for production log analysis

Projects created by the CLI automatically include Base44 project-level skills, and global installation is also supported with `npx skills add base44/skills -g`.

There are also two MCP servers:

1. Base44 account MCP

- endpoint: `https://app.base44.com/mcp`
- purpose: create and edit projects, list apps, inspect schemas, and query entities

2. Base44 docs MCP

- endpoint: `https://docs.base44.com/mcp`
- purpose: search live documentation, return code examples, filter results, and provide source links

The integrations model has three layers:

- connectors for OAuth-backed third-party access
- custom OpenAPI integrations for shared workspace-level APIs imported from OpenAPI specs and called through `base44.integrations.custom.call()`
- backend functions for unrestricted custom logic and secret-backed external API work

The external API docs explicitly frame custom integrations as secure proxied API access and backend functions as the path when you need custom transformations or unsupported API behavior.

## Analysis (expert commentary)

- **Useful for:** deciding which Base44 automation surface to use for a given task and for designing agent workflows around the platform instead of around raw shell commands only.
- **Trade-offs:** Base44's AI tooling lowers the effort to operate the platform, but it also increases the number of "official" surfaces a team can depend on: CLI, skills, MCP, docs MCP, app editor, GitHub sync.
- **Similar to:** cloud platforms that ship both SDKs and IaC tooling, except Base44 also ships agent instructions and MCP endpoints as part of the supported workflow.
- **Could improve svc by:** explicitly differentiating between "Base44 account control plane access" and "Base44 docs retrieval" when choosing agent tools.
- **Assumptions:** the published skills and MCP endpoints remain aligned with the CLI and backend docs.
- **Watch out for:** custom OpenAPI integrations can look like "bring your own backend", but they are an integration layer inside Base44, not a substitute for choosing a primary system-of-record backend.

## Key Source Files (L4 pointers)

- `https://docs.base44.com/developers/backend/overview/agent-extensions`
- `https://docs.base44.com/developers/backend/overview/skills`
- `https://docs.base44.com/developers/backend/overview/mcp-server`
- `https://docs.base44.com/developers/backend/overview/base44-docs-mcp`
- `https://docs.base44.com/documentation/integrations/using-custom-integrations`
- `https://docs.base44.com/developers/references/sdk/getting-started/third-party-apis`
