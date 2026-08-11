# TinyFish — Pricing & Cost Model

## Mechanism

TinyFish uses a **single credit system** across all four API products. One API key covers Agent, Search, Fetch, and Browser usage. Credits are consumed by Agent and Browser operations; Search and Fetch are free as of 2026-05-05.

### Pricing Tiers

| Tier | Cost | Limits |
|------|------|--------|
| **Free** | $0 | 500 free steps; Search and Fetch free |
| **Pay-as-you-go** | ~$0.015/step | All-inclusive (LLM, browser, proxy, anti-bot) |
| **Enterprise** | Custom | Up to 1,000 parallel agents; dedicated support |

### What counts as a "step"

A step is a single agent operation (navigation, click, form fill, extraction). The exact definition is opaque in public docs but is the unit of billing for Agent and Browser APIs.

### Cost Benchmarks

| Metric | TinyFish | Browser Use (self-hosted) | Browserbase | Bright Data |
|--------|----------|--------------------------|-------------|-------------|
| Per-step cost | ~$0.015 | ~$0.002 (own LLM) | Browser hourly | Proxy/data pricing |
| All-inclusive | Yes | No | Partial | Partial |
| Free tier | 500 steps + free Search/Fetch | Open-source | Limited trial | Limited trial |
| Enterprise | Custom | Self-hosted | Custom | Custom |

### Free Search & Fetch Policy (2026-05-05)

Starting 2026-05-05, TinyFish made Search and Fetch completely free:
- `api.search.tinyfish.ai` — no credit consumption
- `api.fetch.tinyfish.ai` — no credit consumption

This is a strategic move to reduce friction for lightweight use cases while monetizing high-value Agent and Browser workflows.

### Historical Hackathon Incentive

The $2M Pre-Accelerator Hackathon (2026) offered:
- Free API access for hackathon participants
- Requirement: post demo video on X tagging @Tiny_fish
- Partner stack perks: Google for Startups, v0 by Vercel, ElevenLabs, Fireworks.ai, MongoDB, Composio, Dify, etc.

## Analysis

### Value Proposition
- **Predictable costs:** All-inclusive per-step pricing eliminates surprise bills from LLM tokens, proxy usage, or browser hours.
- **Low friction entry:** 500 free steps + free Search/Fetch let developers experiment before committing.
- **Scale pricing:** Enterprise tier supports up to 1,000 parallel agents for high-throughput pipelines.

### Cost Concerns
- **Premium vs. self-hosted:** At ~7.5× the per-step cost of Browser Use with own LLM, TinyFish is expensive for teams that already have browser/proxy infrastructure.
- **Opaque step definition:** Without clarity on what constitutes a step, forecasting costs for complex multi-page workflows is difficult.
- **Platform risk:** Single-vendor dependency for all four layers means no ability to optimize costs by swapping components.

## L4 Pointers

- `details/platform-overview.md` — Company context and funding
- `details/api-products.md` — Which APIs consume credits
- `details/competitive-position.md` — Cost comparison with alternatives
