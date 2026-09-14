# Configuration

## Mechanism

Configuration lives at `~/.config/opencode/oh-my-openagent.json` and uses a JSON schema for validation.

### Schema URL
```
https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json
```

### Rate Limit Resilience Block

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

**How it works:** When a provider hits rate limits, it's globally blacklisted for `cooldown_seconds`. All new sessions skip blacklisted providers until cooldown expires. Errors 400, 429, 503, and 529 all trigger fallback.

### Agent Configuration Block

Each agent under `"agents"` supports:
- `"model"` — primary model (required)
- `"fallback_models"` — string or array of fallback model IDs
- `"variant"` — e.g., `"max"` for ultrawork mode
- `"prompt_append"` — additional prompt text appended to system prompts

Example — Sisyphus (main orchestrator):
```json
"sisyphus": {
  "model": "opencode-go/kimi-k2.6",
  "fallback_models": [
    "opencode-go/deepseek-v4-pro",
    "opencode-go/qwen3.6-plus"
  ],
  "ultrawork": {
    "model": "opencode-go/kimi-k2.6",
    "variant": "max"
  }
}
```

### Category Configuration Block

Categories under `"categories"` use the same structure as agents:
```json
"deep": {
  "model": "opencode-go/kimi-k2.6",
  "fallback_models": "opencode-go/deepseek-v4-pro"
}
```

### Background Task Concurrency

```json
"background_task": {
  "defaultConcurrency": 5,
  "staleTimeoutMs": 180000,
  "providerConcurrency": {
    "opencode-go": 10
  },
  "modelConcurrency": {
    "opencode-go/kimi-k2.6": 2,
    "opencode-go/deepseek-v4-pro": 3,
    "opencode-go/deepseek-v4-flash": 20,
    "opencode-go/glm-5.1": 1,
    "opencode-go/qwen3.6-plus": 5
  }
}
```

**Tuning guidance:**
- K2.6 = 2 (tightest limit, most expensive)
- GLM-5.1 = 1 (tightest of all)
- V4 Pro = 3 (balanced)
- Qwen3.6 Plus = 5 (good limits, versatile)
- V4 Flash = 20 (effectively unlimited)

### Git Master Block

```json
"git_master": {
  "include_co_authored_by": false
}
```

### Full Configuration Example

The article provides a complete reference config at ~150 lines. Key design principles reflected in it:
1. Every production agent has at least one fallback
2. Utility agents (Librarian, Explore, Sisyphus-junior) use T1 models only
3. Review agents (Metis, Momus, Code-reviewer) use T2/T3
4. Orchestrators (Sisyphus) use T3 primary with T2 fallback
5. Concurrency tuned to 5-hour request limits

## Analysis

**The config is the product.** Unlike frontier APIs where you just pick a model, OpenCode Go's value is in the routing logic. The `oh-my-openagent.json` file encodes your entire cost/quality tradeoff strategy.

**Variant/ultrawork mode is underdocumented.** The article mentions `"variant": "max"` for Sisyphus ultrawork but doesn't explain what parameters change. Assume it increases context window or reasoning tokens at higher cost.

**Global blacklisting is powerful but opaque.** If K2.6 hits a 429, all your K2.6 tasks switch to V4 Pro for 60 seconds. This is correct for rate limits but can cause unexpected quality drops mid-session.

## L4 Pointers

- `agents-and-fallbacks.md` — agent-specific model assignments
- `pricing-and-limits.md` — why concurrency numbers are what they are
- External: https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/dev/assets/oh-my-opencode.schema.json — live schema
- External: https://github.com/code-yeongyu/oh-my-openagent/blob/dev/docs/reference/configuration.md — full reference
