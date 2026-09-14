# TinyFish — Integrations & Developer Tools

## Mechanism

TinyFish provides multiple access patterns to fit different developer workflows: REST API for direct integration, SDKs for typed language support, CLI for terminal/scripting use, MCP for AI assistant interoperability, and Agent Skills for zero-code agent education.

### REST API

All four products share the same `X-API-Key` header authentication.

```bash
export TINYFISH_API_KEY="your_api_key_here"
```

Key endpoints:
- Agent: `POST https://agent.tinyfish.ai/v1/automation/run-sse`
- Search: `GET https://api.search.tinyfish.ai`
- Fetch: `POST https://api.fetch.tinyfish.ai`
- Browser: `POST https://api.browser.tinyfish.ai`

### SDKs

**Python:**
```bash
pip install tinyfish
```

```python
from tinyfish import TinyFish, CompleteEvent

client = TinyFish()
with client.agent.stream(
    url="https://example.com",
    goal="Extract the page title. Return as JSON.",
) as stream:
    for event in stream:
        if isinstance(event, CompleteEvent):
            print(event.result_json)
```

**TypeScript:**
```bash
npm install @tiny-fish/sdk
```

### CLI

Install:
```bash
npm install -g @tiny-fish/cli
```

Authenticate:
```bash
tinyfish auth login
```

The CLI provides terminal access to all four endpoints and writes results to the filesystem instead of piping through the model's context window.

### MCP Server

For MCP-compatible hosts (Claude Code, Claude Desktop, Cursor, Windsurf, Codex):

```json
{
  "mcpServers": {
    "tinyfish": { "url": "https://agent.tinyfish.ai/mcp" }
  }
}
```

Or install via helper:
```bash
npx -y install-mcp@latest https://agent.tinyfish.ai/mcp --client claude-code
```

**MCP Tools:**
- `run_web_automation` — SSE streaming execution
- `run_web_automation_async` — Async launch with run_id
- `get_run` — Poll for results
- `list_runs` — History with filtering/pagination

Auth is OAuth 2.1 — no manual API key management in MCP mode.

### Agent Skill

A markdown instruction file (SKILL.md) that teaches AI coding agents when and how to call TinyFish endpoints.

**Install:**
```bash
npx skills add https://github.com/tinyfish-io/skills --skill tinyfish
```

**Supported agents:** Claude Code, Cursor, Codex, OpenClaw, OpenCode, Antigravity, Hermes Agent, Cline, Goose.

The skill includes:
- Pre-flight API key check
- curl examples for extract, multi-item, stealth mode, proxy routing
- Parallel extraction best practices
- SSE output parsing guidance

### Platform Integrations

| Platform | Integration Type |
|----------|-----------------|
| Dify | Plugin marketplace — Run Synchronously, Asynchronously, SSE, List Runs, Get Run |
| n8n | Workflow node |
| Vercel | Skills on skills.sh |
| ChatGPT App | App integration |
| Claude Desktop | MCP server |

### Open Source

- **Cookbook:** github.com/tinyfish-io/tinyfish-cookbook
- **Web Agent Integrations:** github.com/tinyfish-io/tinyfish-web-agent-integrations (MIT License)
- **Skills repo:** github.com/tinyfish-io/skills

## Analysis

### Strengths
- **Multi-modal access:** API, SDK, CLI, MCP, and Skill cover every major integration pattern.
- **AI-native design:** The Skill system lets agents autonomously discover and use TinyFish without manual integration code.
- **OAuth for MCP:** Removes API key friction in AI assistant contexts.

### Weaknesses / Gaps
- **No explicit CI/CD examples:** Documentation focuses on manual setup; production deployment patterns (retry, backoff, monitoring) are less covered.
- **Skill marketplace fragmentation:** Skills exist across multiple registries (GitHub, Playbooks, Vercel, OpenClaw); no single canonical index.

## L4 Pointers

- `details/api-products.md` — Endpoint reference and parameter details
- `details/pricing.md` — Credit consumption per integration type
- `details/competitive-position.md` — Integration breadth vs. competitors
