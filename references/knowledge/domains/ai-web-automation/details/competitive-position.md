# TinyFish — Competitive Position

## Mechanism

TinyFish competes in the web automation/infrastructure space against four main categories of alternatives: open-source agent frameworks (Browser Use), cloud browser infrastructure (Browserbase), full web data platforms (Bright Data), and AI-native operator tools (OpenAI Operator).

### vs. Browser Use

**Browser Use** is an open-source Python framework (MIT license, ~85K GitHub stars) for building AI browser agents locally or on Browser Use Cloud.

| Factor | TinyFish | Browser Use |
|--------|----------|-------------|
| **Model** | Platform (API call → result) | Framework (build your own) |
| **LLM** | Included | Bring your own |
| **Browser** | Managed remote | Local or cloud |
| **Cost/step** | ~$0.015 | ~$0.002 (own LLM) |
| **Customization** | Low (black box) | High (full code control) |
| **Parallelism** | Up to 1,000 | Self-hosted limit |
| **Cold start** | < 250 ms | Instant (local) |
| **Best for** | "Describe goal, get JSON" | Build custom agent framework |

### vs. Browserbase

**Browserbase** provides cloud-hosted browser infrastructure with Playwright/Puppeteer connectivity. Their Stagehand SDK (~20K stars) adds AI automation on top.

| Factor | TinyFish | Browserbase |
|--------|----------|-------------|
| **Model** | Full-stack agent platform | Browser infrastructure + optional SDK |
| **Agent logic** | Built-in | Build with Stagehand or custom |
| **Cold start** | < 250 ms | ~5–10 seconds |
| **Stealth** | Engine-level C++ | JS injection |
| **Best for** | End-to-end automation | Raw browser control needed |

### vs. Bright Data

**Bright Data** is the largest web data infrastructure company (~$300M+ ARR, 150M+ residential IPs).

| Factor | TinyFish | Bright Data |
|--------|----------|-------------|
| **Core product** | Web agent platform | Proxy network + data platform |
| **Proxy scale** | 7 countries, ISP IPs | 195+ countries, 150M+ IPs |
| **Agent capability** | Native natural language | Pre-built scrapers / bring your own |
| **Best for** | Workflow automation | Massive proxy-driven data collection |

### vs. OpenAI Operator

Per TinyFish's benchmark claims:
- TinyFish: 81% success rate on complex web tasks
- OpenAI Operator: 43% success rate

## Analysis

### Differentiation
TinyFish's core differentiator is **vertical integration:** all four layers (search, fetch, browser, agent) are built in-house and communicate through a unified signal loop. This enables:
1. End-to-end failure tracing
2. Session identity consistency
3. Compounding data feedback across layers
4. Single-vendor accountability

### Threats
- **Open-source convergence:** Browser Use + Stagehand + cheap LLMs could replicate 80% of TinyFish's capability at lower cost.
- **Platform commoditization:** As more browsers add native AI (Chrome with Gemini, Edge with Copilot), the value of remote AI browsing may decline.
- **Pricing pressure:** Bright Data and Browserbase have deeper pockets and could bundle agent capabilities at competitive prices.

### Moat Assessment
- **Technical moat:** Medium — the microVM + native C++ automation surface is non-trivial but replicable with enough engineering.
- **Data moat:** Medium-high — 40M+ operations create a feedback loop for improving agent accuracy.
- **Distribution moat:** Medium — skill integrations across Claude, Cursor, Codex create habit formation, but switching costs are low.

## L4 Pointers

- `details/platform-overview.md` — Architecture and benchmarks
- `details/pricing.md` — Cost comparison details
- `details/api-products.md` — Feature comparison by product
