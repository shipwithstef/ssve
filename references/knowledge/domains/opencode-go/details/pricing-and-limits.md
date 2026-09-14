# Pricing and Limits

## Mechanism

OpenCode Go uses **dollar-based metering**, not token-based. This is a critical distinction — request count matters more than token volume.

### Subscription

| Item | Value |
|------|-------|
| Monthly cost | **$10** |
| Models included | 14 open-source models |
| Host platforms | macOS, Linux, WSL |
| Minimum OpenCode version | 1.0.133 (1.0.150+ with oh-my-openagent) |

### Rate Limit Windows

| Window | Limit |
|--------|-------|
| 5-hour rolling | **$12** |
| Weekly | **$30** |
| Monthly | **$60** |

### Per-Model Request Budgets (5-Hour Window)

These are derived from the article's stated limits and pricing:

| Model | Req/5hr | Model Tier | Cost per Request (est.) |
|-------|---------|------------|------------------------|
| DeepSeek V4 Flash | **31,650** | T1 | ~$0.00038 |
| Qwen3.5 Plus | ~31,650 | T1 | ~$0.00038 |
| MiniMax M2.5 | ~31,650 | T1 | ~$0.00038 |
| DeepSeek V4 Pro | **3,300** | T2 | ~$0.0036 |
| Qwen3.6 Plus | **3,450** | T2 | ~$0.0035 |
| MiniMax M2.7 | ~3,300 | T2 | ~$0.0036 |
| Kimi K2.6 | **1,150** | T3 | ~$0.010 |
| GLM-5.1 | **880** | T3 | ~$0.014 |
| MiMo-V2.5-Pro | ~1,150 | T3 | ~$0.010 |
| MiMo-V2-Omni | ~1,150 | T4 | ~$0.010 |

### Session Cost Estimates

| Session Type | Requests | Typical Cost | Model Mix |
|--------------|----------|--------------|-----------|
| Light autocomplete + search | 20–50 | ~$0.02–0.08 | Mostly V4 Flash |
| Standard feature implementation | 50–100 | ~$0.20–0.50 | V4 Pro primary, V4 Flash for search |
| Heavy agentic coding session | 100–200 | ~$0.50–1.50 | K2.6 for orchestration, V4 Pro for implementation, V4 Flash for utility |
| Multi-file refactoring | 200–400 | ~$1.50–3.00 | K2.6 primary, heavy V4 Pro fallback |
| Long-horizon autonomous run | 400–800 | ~$3.00–6.00 | GLM-5.1 / K2.6, may hit weekly limit |

## Analysis

**Dollar-based metering changes optimization strategy.** With token-based pricing (OpenAI, Anthropic), you optimize prompt length and context window usage. With dollar-based pricing, you optimize **request count** and **model selection per request**.

**The 5-hour window is the binding constraint for heavy users.** $12/5hr = ~$2.40/hr sustained. If you're running an autonomous agent for 4 hours at 100 req/hr with K2.6, you'll burn ~$9.60 — close to the limit. Spread across mixed tiers, you can sustain longer.

**The monthly limit ($60) is generous.** At $10/mo subscription + $60/mo usage limit, total max spend is $70/mo. Compare to frontier API access at $150–250/mo for equivalent volume.

**K2.6 3x promos change the math.** When K2.6 has a promotional multiplier (as noted "this week" in the article), route more work through it temporarily. When the promo ends, revert Hephaestus to V4 Pro primary.

**Conservative concurrency is mandatory.** Start at 2–3 parallel background tasks. The `background_task.modelConcurrency` settings in the config are pre-tuned to these limits.

## L4 Pointers

- `CAPABILITIES.md` § "Pricing & Limits" — summary
- `tiered-model-architecture.md` — which model to use for which task
- `configuration.md` — `background_task` concurrency settings
- External: https://opencode.ai/docs/go/ — official pricing docs
