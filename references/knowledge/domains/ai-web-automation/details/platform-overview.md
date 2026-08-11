# TinyFish — Platform Overview

## Mechanism

TinyFish AI operates as a **serverless web agent platform** that abstracts browser automation, AI reasoning, proxy management, and structured data extraction into a single API call. Instead of assembling separate tools (browser infra + LLM + proxy + anti-bot), developers describe a goal in natural language and receive structured JSON results.

### Architecture Layers

1. **Agent Layer:** Natural language goal → AI planning → step execution
2. **Browser Layer:** Remote Chromium (Lite/Stealth) in isolated microVMs
3. **Network Layer:** Dedicated ISP proxies with per-domain reputation tracking
4. **Extraction Layer:** DOM-based structured data return (not screenshots/CV)

### Key Technical Claims

- **MicroVM isolation:** Each browser session boots a fresh VM in ~4 seconds. No shared state, no cookie leakage, no filesystem residue. When the session ends, the VM is destroyed.
- **Headful performance:** Runs headful with full rendering for anti-detection, but actions execute in sub-millisecond native code (not JS bridge), making it faster than typical headless setups.
- **CDP direct connection:** After session creation, the client connects directly to the microVM over CDP WebSocket. No proxy or middleman in the traffic path.
- **Single session identity:** Same IP, fingerprint, and cookies across an entire workflow — unlike assembled toolchains where session fingerprints diverge.

### Benchmarks

| Benchmark | Score | Notes |
|-----------|-------|-------|
| Mind2Web | 90% | Industry-leading on standard web automation eval |
| 300-task eval | 89.9% | First-place ranking per company claims |
| Success rate | 98.7% | Production metric |
| Parallel scan | 50 portals in 2m 14s | vs. 45+ min traditional |
| Cost per operation | $0.04 | All-inclusive (LLM + browser + proxy) |

## Analysis

### Strengths
- **All-in-one abstraction:** Eliminates integration work across browser, LLM, proxy, and anti-bot vendors.
- **Token efficiency:** Fetch API returns clean content (~100 tokens vs. ~1,500 for raw MCP fetch), and CLI writes to filesystem instead of polluting context windows.
- **Enterprise traction:** Named clients (Google, DoorDash, Volkswagen) suggest production-grade reliability.
- **Free tier for Search/Fetch:** Removes friction for lightweight use cases.

### Weaknesses / Risks
- **Vendor lock-in:** All four layers are proprietary and in-house. If one layer fails, the entire platform is affected.
- **Cost vs. self-hosted:** $0.015/step is ~7.5x more expensive per step than Browser Use with own LLM ($0.002/step).
- **Less customization:** Framework users (Browser Use) can swap LLMs, tune retry logic, and modify agent behavior; TinyFish is a black-box API.
- **Privacy concerns:** All traffic routes through TinyFish's infrastructure — sensitive authenticated workflows require trust.

## L4 Pointers

- `details/api-products.md` — Deep dive into each of the four APIs
- `details/pricing.md` — Cost model and free tier details
- `details/competitive-position.md` — Head-to-head comparisons
- `details/integrations.md` — SDK, CLI, MCP, and skill system
