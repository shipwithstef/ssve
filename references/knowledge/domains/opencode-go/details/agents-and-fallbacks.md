# Agents and Fallbacks

## Mechanism

`oh-my-openagent` provides 11 built-in agents, each assigned a primary model and a fallback chain. When the primary model hits rate limits, the system automatically cascades through fallbacks.

### Orchestrators & Planners

| Agent | Role | Primary | Fallback Chain | Notes |
|-------|------|---------|----------------|-------|
| **Sisyphus** | Main orchestrator | Kimi K2.6 | → DeepSeek V4 Pro → Qwen3.6 Plus | Best agentic coder on Go. Ultrawork mode also uses K2.6 for background parallel execution |
| **Hephaestus** | Autonomous deep worker | DeepSeek V4 Pro | → V4 Flash → Kimi K2.6 | Principle-driven, GPT-like. Prompt append: "Explore thoroughly, then implement. Prefer small, testable changes." |
| **Prometheus** | Planner | GLM-5.1 | → Qwen3.6 Plus → V4 Pro | Spec-writing, architectural planning. Prompt append: "Always interview first. Validate scope before planning." |
| **Oracle** | Architecture consultant | GLM-5.1 | → Kimi K2.6 → V4 Pro | Best reasoning among Go models. 8-hour autonomous runs |

### Deep Workers

| Agent | Role | Primary | Fallback Chain |
|-------|------|---------|----------------|
| **Atlas** | Utility deep worker | DeepSeek V4 Pro | → V4 Flash |
| **Code-reviewer** | Quality review | Kimi K2.6 | → V4 Pro |

### Utility & Search Agents

| Agent | Role | Primary | Fallback Chain | Notes |
|-------|------|---------|----------------|-------|
| **Librarian** | Search / explore | DeepSeek V4 Flash | → Qwen3.5 Plus | **Never rate-limited.** Speed agent — don't waste expensive models |
| **Explore** | Search / explore | DeepSeek V4 Flash | (none) | Same as Librarian — speed over intelligence |
| **Multimodal-looker** | Vision tasks | MiMo-V2-Omni | → Qwen3.6 Plus | Multimodal → text fallback |
| **Metis** | Review agent | Qwen3.6 Plus | → V4 Pro | 3,300 req/5hr, analytical |
| **Momus** | Review agent | Qwen3.6 Plus | → Kimi K2.6 | Falls back to K2.6 for critical reviews |
| **Sisyphus-junior** | Quick tasks | DeepSeek V4 Flash | (none) | Trivial executions |

### Category Defaults

Categories are task-type tags that route to default models:

| Category | Primary | Fallback | When Used |
|----------|---------|----------|-----------|
| `visual-engineering` | MiMo-V2-Omni | Qwen3.6 Plus | Screenshot-to-code, UI extraction |
| `ultrabrain` | GLM-5.1 | Kimi K2.6 | Maximum reasoning, long-horizon planning |
| `deep` | Kimi K2.6 | V4 Pro | Complex research + execution |
| `artistry` | GLM-5.1 | Qwen3.6 Plus | Creative / generative tasks |
| `quick` | V4 Flash | — | Trivial, one-off tasks |
| `unspecified-low` | V4 Flash | — | Default for low-confidence routing |
| `unspecified-high` | V4 Pro | Kimi K2.6 | Default for high-confidence routing |
| `writing` | Qwen3.6 Plus | — | Copy, docs, prose generation |

## Analysis

**Don't "upgrade" utility agents.** Explore and Librarian need speed, not intelligence. V4 Flash at 31K req/5hr is perfect for them. Moving them to K2.6 wastes precious elite-tier requests on simple search tasks.

**Oracle is your weakest link without frontier models.** GLM-5.1 at 58.4% SWE-Pro is solid but trails Opus 4.7 (64.3%). For architecture decisions on unfamiliar systems, expect ~15–20% more iterations than with a frontier oracle.

**Qwen3.6 Plus is the Swiss Army knife.** 3,300 req/5hr, 61.6% Terminal-Bench, good at everything. Use it for Metis, Momus, Writing, and as a universal fallback.

**Fallback chains are not optional.** Rate limits are signals to switch models, not failures. Every agent should have a `fallback_models` entry.

## L4 Pointers

- `CAPABILITIES.md` § "oh-my-openagent Built-in Agents" — summary table
- `configuration.md` — full JSON config with all agent assignments
- External: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/guide/agent-model-matching.md — official matching guide
- External: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/reference/configuration.md — config reference
