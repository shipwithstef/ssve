# TinyFish — API Products

## Mechanism

TinyFish exposes four public API surfaces under a single API key and credit system. Each product targets a different web-interaction pattern, from high-level natural language automation to low-level browser control.

### 1. Web Agent API

**Canonical endpoint:** `POST https://agent.tinyfish.ai/v1/automation/run-sse`

**What it does:**
- Accepts a natural language `goal` and a target `url`
- Plans and executes multi-step browser workflows (navigation, clicking, form filling, extraction)
- Returns structured JSON results

**Execution modes:**

| Mode | Endpoint | Latency | Use case |
|------|----------|---------|----------|
| Sync | `/run` | 15–60s | Simple tasks, blocking call |
| SSE Streaming | `/run-sse` | 15–60s (streaming) | Real-time progress watching |
| Async | `/run-async` | Immediate `run_id` | Long tasks, poll with `/get-run` |

**Key parameters:**
- `url` — starting page
- `goal` — natural language task description
- `browser_profile` — `"lite"` (default) or `"stealth"`
- `proxy_config` — `{ "enabled": true, "country_code": "US" }` (US, GB, CA, DE, FR, JP, AU)

**Example:**
```bash
curl -N -X POST https://agent.tinyfish.ai/v1/automation/run-sse \
  -H "X-API-Key: $TINYFISH_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "goal": "Extract all product prices as JSON",
    "browser_profile": "stealth"
  }'
```

**Output:** SSE stream with `data:` lines; final event has `type == "COMPLETE"` and `resultJson`.

### 2. Web Search API

**Canonical endpoint:** `GET https://api.search.tinyfish.ai`

**What it does:**
- Real-time web search returning clean structured JSON
- Built on self-developed Chromium engine
- P50 latency ~488 ms

**Parameters:**
- `query` — search string
- `location` — geo context
- `language` — result language

**Pricing:** Free as of 2026-05-05.

### 3. Web Fetch API

**Canonical endpoint:** `POST https://api.fetch.tinyfish.ai`

**What it does:**
- Renders target URL in a full browser
- Strips CSS, scripts, ads, navigation, footers
- Returns clean content as Markdown or JSON

**Parameters:**
- `urls` — array of URLs to fetch

**Benefits:**
- ~87% fewer tokens vs. raw page fetch through MCP
- Writes output to filesystem (via CLI) instead of dumping into agent context window

**Pricing:** Free as of 2026-05-05.

### 4. Web Browser API

**Canonical endpoint:** `POST https://api.browser.tinyfish.ai`

**What it does:**
- Creates a remote browser session accessible via CDP WebSocket
- Direct Playwright/Puppeteer compatibility
- Full control for custom automation logic

**Session characteristics:**
- Isolated microVM per session
- Headful rendering
- Sub-millisecond native-code actions
- Direct CDP connection (no proxy in traffic path)

## Analysis

### When to use which API

| Need | Recommended API | Why |
|------|-----------------|-----|
| "Get data from a site, I don't know the structure" | Agent API | Natural language + AI handles navigation |
| "Get clean content from known URLs" | Fetch API | Cheaper, faster, no AI overhead |
| "Search the live web" | Search API | Structured JSON, low latency |
| "I need custom Playwright logic" | Browser API | Full CDP control |
| "Bot-protected site" | Agent/Browser + stealth | Residential proxies + anti-detection |

### Task completion rates

TinyFish claims 2× higher task completion rates with CLI + Skills vs. MCP-based execution on complex multi-step tasks. This is attributed to:
1. Cleaner context windows (filesystem output vs. inline)
2. Native Unix composability (pipes, redirects)
3. Unified session identity across steps

## L4 Pointers

- `details/integrations.md` — SDKs, CLI, and MCP usage examples
- `details/pricing.md` — Credit system and cost per product
- `details/competitive-position.md` — How APIs compare to Browserbase, Bright Data, etc.
