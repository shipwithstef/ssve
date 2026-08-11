# OpenCode Go — Capabilities

Analyzed: 2026-05-04
Source: Medium article by Jatin K Malik + official docs

## Space
Subscription-based agent CLI that provides access to 14 state-of-the-art open-source models through tiered model routing, with an companion plugin (`oh-my-openagent`) that provides 11 built-in agents with model-specific assignments and fallback chains.

## Pricing & Limits

| Window | Limit |
|--------|-------|
| 5-hour | $12 of usage |
| Weekly | $30 |
| Monthly | $60 |

- **Cost**: $10/month subscription
- **Limit type**: Dollar-based (not token-based)
- A single agentic coding session burns 50–200 requests (one per tool call, file edit, shell command)

## Available Models (14 open-source)

### Frontier Reference (not included in Go, for comparison)
- Claude Opus 4.7: 87.6% SWE-Verified, 64.3% SWE-Pro
- GPT-5.4: 57.7% SWE-Pro
- Gemini 3.1 Pro: 54.2% SWE-Pro

### Tier 1 — Volume Workhorse (Never Rate-Limited)
- **DeepSeek V4 Flash** — 31,650 req/5hr, 79% SWE-Verified
- **Qwen3.5 Plus**
- **MiniMax M2.5**

### Tier 2 — Standard Engineering (Balanced)
- **DeepSeek V4 Pro** — 3,300 req/5hr, 93.5% LiveCodeBench, 80.6% SWE-Verified
- **Qwen3.6 Plus** — 3,450 req/5hr, 61.6% Terminal-Bench
- **MiniMax M2.7**

### Tier 3 — Complex Agentic (Elite)
- **Kimi K2.6** — 1,150 req/5hr, 58.6% SWE-Pro
- **GLM-5.1** — 880 req/5hr, 58.4% SWE-Pro, 8-hour autonomous runs
- **MiMo-V2.5-Pro**

### Tier 4 — Specialized
- **MiMo-V2-Omni** — multimodal, screenshot-to-code

## oh-my-openagent Built-in Agents (11)

| Agent | Role | Primary Model | Fallback Chain |
|-------|------|---------------|----------------|
| Sisyphus | Main orchestrator | Kimi K2.6 | → DeepSeek V4 Pro → Qwen3.6 Plus |
| Hephaestus | Autonomous deep worker | DeepSeek V4 Pro | → V4 Flash → Kimi K2.6 |
| Oracle | Architecture consultant | GLM-5.1 | → Kimi K2.6 → V4 Pro |
| Librarian | Search / explore | DeepSeek V4 Flash | → Qwen3.5 Plus |
| Explore | Search / explore | DeepSeek V4 Flash | (none) |
| Multimodal-looker | Vision tasks | MiMo-V2-Omni | → Qwen3.6 Plus |
| Prometheus | Planner | GLM-5.1 | → Qwen3.6 Plus → V4 Pro |
| Metis | Review agent | Qwen3.6 Plus | → V4 Pro |
| Momus | Review agent | Qwen3.6 Plus | → Kimi K2.6 |
| Atlas | (utility) | DeepSeek V4 Pro | → V4 Flash |
| Code-reviewer | Quality review | Kimi K2.6 | → V4 Pro |
| Sisyphus-junior | Quick tasks | DeepSeek V4 Flash | (none) |

## Category Defaults

| Category | Primary | Fallback |
|----------|---------|----------|
| visual-engineering | MiMo-V2-Omni | Qwen3.6 Plus |
| ultrabrain | GLM-5.1 | Kimi K2.6 |
| deep | Kimi K2.6 | V4 Pro |
| artistry | GLM-5.1 | Qwen3.6 Plus |
| quick | V4 Flash | — |
| unspecified-low | V4 Flash | — |
| unspecified-high | V4 Pro | Kimi K2.6 |
| writing | Qwen3.6 Plus | — |

## Key Technical Patterns

- **Tiered model routing**: Match model capability to task complexity; never route everything through one model
- **fallback_models chains**: Every agent has a fallback chain; rate limits trigger automatic model switching
- **Global provider blacklisting**: When a provider hits rate limits, blacklisted for `cooldown_seconds`; all new sessions skip it
- **Concurrency limits per model**: Kimi K2.6=2, V4 Pro=3, V4 Flash=20, GLM-5.1=1, Qwen3.6 Plus=5
- **Dollar-based metering**: Not token-based; request count matters more than token volume

## Rate Limit Resilience Configuration

```json
{
  "model_fallback": true,
  "runtime_fallback": {
    "enabled": true,
    "retry_on_errors": [400, 429, 503, 529],
    "max_fallback_attempts": 3,
    "cooldown_seconds": 60,
    "timeout_seconds": 30,
    "notify_on_fallback": true
  }
}
```

## Benchmark Positioning

| Model | SWE-Pro | SWE-Verified | LiveCodeBench | Terminal-Bench |
|-------|---------|--------------|---------------|----------------|
| Claude Opus 4.7 | 64.3% | 87.6% | — | — |
| DeepSeek V4 Pro | 55.4% | 80.6% | **93.5%** | — |
| Kimi K2.6 | **58.6%** | — | — | — |
| GLM-5.1 | 58.4% | — | — | — |
| Qwen3.6 Plus | — | — | — | **61.6%** |
| DeepSeek V4 Flash | — | 79% | — | — |

**Verdict**: ~80–90% of frontier quality at ~10–20x lower cost. 7-point gap on SWE-Bench Verified vs Opus 4.7.

## Common Pitfalls

- Routing everything through one model (K2.6 burns 1,150 req/5hr in 2–3 heavy sessions)
- "Upgrading" utility agents (Explore/Librarian need speed, not intelligence)
- Ignoring fallback chains (rate limits are signals, not failures)
- Overly aggressive concurrency (start at 2–3 parallel tasks)

## Where It Wins vs Compromises

**Wins**:
- Cost: Save $50–200/month vs frontier API access
- LiveCodeBench: V4 Pro at 93.5% beats every frontier model
- Terminal-Bench: Qwen3.6 Plus at 61.6% beats Claude 4.5 (59.3%)
- Token efficiency: MiMo-V2.5-Pro uses 40–60% fewer tokens than Claude
- V4 Flash at 31K req/5hr is effectively unlimited

**Compromises**:
- SWE-Bench Verified gap: 80.6% (V4 Pro) vs 87.6% (Opus 4.7)
- Oracle quality: GLM-5.1 trails Opus 4.7 by ~15–20% more iterations on unfamiliar architecture
- Multimodal: MiMo-V2-Omni trails Gemini 3.1 Pro on vision-heavy tasks

## Installation Requirements

- OpenCode 1.0.133+ (1.0.150+ with oh-my-openagent)
- Git, Node.js or Bun
- macOS, Linux, or WSL

## Resources

- OpenCode Go Docs: https://opencode.ai/docs/go/
- Oh My Open Agent GitHub: https://github.com/code-yeongyu/oh-my-openagent
- Oh My Open Agent Docs: https://ohmyopenagent.com/en/docs
- Config Schema: https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json
