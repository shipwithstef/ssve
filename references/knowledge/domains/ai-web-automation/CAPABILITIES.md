# TinyFish — AI Web Automation Platform

**Source:** https://x.com/Tiny_Fish (primary social), https://www.tinyfish.ai (homepage), https://docs.tinyfish.ai (docs)
**Domain:** ai-web-automation
**Last updated:** 2026-05-05

## Summary

TinyFish (stylized TinyFish AI) is a serverless platform providing AI-powered web automation infrastructure for developers and enterprises. It enables natural-language-driven browser automation, web search, content fetching, and remote browser sessions via a unified API. The company is backed by $47M in Series A funding (led by ICONIQ) and counts Google, DoorDash, Cigna, Grubhub, Volkswagen, and NEC among enterprise clients.

## Core Capabilities

### 1. Web Agent API
- **Goal-based automation:** Describe tasks in natural language; the agent navigates, interacts, authenticates, and extracts structured data.
- **Modes:** Sync, async (polling), and SSE streaming for real-time progress.
- **Browser profiles:** Lite (fast standard Chromium) and Stealth (anti-detection with residential proxies).
- **Benchmarks:** 90% on Mind2Web; 89.9% across 300 tasks; 98.7% success rate.
- **Parallelism:** Up to 1,000 simultaneous agents.
- **Cost:** ~$0.015/step (all-inclusive: LLM, browser, proxy, anti-bot).

### 2. Web Search API
- Real-time web search returning clean structured JSON.
- P50 latency ~488 ms (vs. industry average ~2,800 ms).
- Self-built Chromium-based search engine.
- **Free tier:** Search is free for every agent as of 2026-05-05.

### 3. Web Fetch API
- Renders pages in a full browser, extracts clean content as Markdown or JSON.
- Strips CSS, scripts, ads, and boilerplate.
- Reduces token usage by ~87% vs. raw page fetch through MCP.
- **Free tier:** Fetch is free for every agent as of 2026-05-05.

### 4. Web Browser API
- Remote browser sessions via CDP WebSocket (Playwright-compatible).
- Runs in isolated microVMs (not containers), booted in ~4 seconds.
- Headful rendering for anti-detection; sub-millisecond native-code actions.
- Per-domain proxy reputation tracking with automatic IP rotation.

## Developer Experience

### Authentication
- Single `X-API-Key` header for all REST APIs.
- MCP server with OAuth 2.1 for AI assistants (Claude Code, Cursor, Codex, etc.).

### SDKs & Tools
- **CLI:** `npm install -g @tiny-fish/cli` — terminal access to all four endpoints.
- **Python SDK:** `pip install tinyfish`
- **TypeScript SDK:** `npm install @tiny-fish/sdk`
- **Agent Skill:** Markdown instruction file for AI coding agents (Claude Code, Cursor, Codex, OpenCode, etc.). Install via `npx skills add https://github.com/tinyfish-io/skills --skill tinyfish`.
- **MCP Server:** `https://agent.tinyfish.ai/mcp`

### Integrations
- Dify Marketplace plugin
- n8n
- Vercel Skills on skills.sh
- ChatGPT App, Claude Desktop
- OpenClaw / VoltAgent skill registry

## Architecture Highlights

- **Serverless:** No browser or proxy management required.
- **MicroVM isolation:** Each session runs in a fresh VM; no cookie leakage or filesystem residue.
- **Proxy intelligence:** Dedicated ISP IPs with per-domain reputation scoring; 7-country coverage (US, GB, CA, DE, FR, JP, AU).
- **Anti-bot:** 28 C++-level anti-bot mechanisms in Stealth mode.
- **DOM-based extraction:** Reads DOM structure, not pixels — more reliable than CV approaches on dynamic pages.

## Company & Funding

- **Funding:** $47M Series A (led by ICONIQ)
- **Enterprise clients:** Google, DoorDash, Cigna, Grubhub, Volkswagen, NEC
- **Operations processed:** 40M+ agent operations
- **Platform uptime:** 99.99%
- **Hackathon:** $2M Pre-Accelerator Hackathon (tag @Tiny_fish on X)
- **Social:** X/Twitter @Tiny_Fish

## Comparison Matrix

| Dimension | TinyFish | Browser Use | Browserbase | Bright Data |
|-----------|----------|-------------|-------------|-------------|
| **Model** | Platform (API + AI) | Framework (open-source) | Infrastructure (cloud browsers) | Infrastructure (proxies + scrapers) |
| **Agent logic** | Built-in | Bring your own LLM | Bring your own | Bring your own / pre-built |
| **Parallelism** | Up to 1,000 | Self-hosted limit | Cloud-scaled | Cloud-scaled |
| **Cold start** | < 250 ms | Local = instant | ~5–10 s | Varies |
| **Cost/step** | ~$0.015 | ~$0.002 (own LLM) | Browser hourly | Proxy / dataset pricing |
| **Stealth** | Engine-level C++ | JS-injection | JS-injection | Proxy rotation + unlocker |
| **Best for** | "Describe goal, get JSON" | Build custom agent | Need raw browser control | Need massive proxy network |

## L3 Detail Files

- `details/platform-overview.md` — Company, funding, positioning
- `details/api-products.md` — Agent, Search, Fetch, Browser APIs
- `details/integrations.md` — SDKs, CLI, MCP, skills, partner ecosystem
- `details/pricing.md` — Pricing model, free tier, cost benchmarks
- `details/competitive-position.md` — Comparisons with Browser Use, Browserbase, Bright Data, OpenAI Operator
