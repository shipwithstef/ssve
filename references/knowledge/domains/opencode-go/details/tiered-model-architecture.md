# Tiered Model Architecture

## Mechanism

OpenCode Go uses a 4-tier model classification system where each tier matches model capability to task complexity. The core principle: **never route everything through one model**.

| Tier | Models | Req/5hr | SWE-Verified | SWE-Pro | Best For |
|------|--------|---------|--------------|---------|----------|
| **T1 — Volume** | DeepSeek V4 Flash, Qwen3.5 Plus, MiniMax M2.5 | **31,650** (V4 Flash) | 79% (V4 Flash) | — | Code completion, simple bug fixes (1–2 files), code review, PR feedback, explore/librarian searches, quick tasks |
| **T2 — Standard** | DeepSeek V4 Pro, Qwen3.6 Plus, MiniMax M2.7 | **3,300–3,450** | 80.6% (V4 Pro) | 55.4% (V4 Pro) | Feature implementation (3–5 files), terminal-heavy automation, multi-step debugging, standard agentic workflows |
| **T3 — Elite** | Kimi K2.6, GLM-5.1, MiMo-V2.5-Pro | **880–1,150** | — | 58.6% (K2.6), 58.4% (GLM-5.1) | Multi-file refactoring (10+ files), long-horizon autonomous runs (4+ hours), architecture decisions, 300-agent swarm coordination |
| **T4 — Specialized** | MiMo-V2-Omni, GLM-5.1 (long-horizon) | Varies | — | — | Screenshot-to-code (MiMo-V2-Omni), 8-hour autonomous runs (GLM-5.1), spec-writing and architectural planning |

### Tier-Specific Benchmarks

| Model | LiveCodeBench | Terminal-Bench | Notes |
|-------|---------------|----------------|-------|
| DeepSeek V4 Pro | **93.5%** | — | Beats every frontier model on competitive programming |
| Qwen3.6 Plus | — | **61.6%** | Beats Claude 4.5 (59.3%) on agentic terminal work |
| Kimi K2.6 | — | — | Highest SWE-Pro among Go models (58.6%) |
| GLM-5.1 | — | — | 8-hour autonomous run capability |
| MiMo-V2.5-Pro | — | — | 40–60% fewer tokens than Claude at comparable capability |

## Analysis

**Why tiers matter:** OpenCode Go limits are dollar-based, not token-based. A single agentic session burns 50–200 requests (one per tool call, file edit, shell command). If you route your main orchestrator through Kimi K2.6 for everything, you'll hit the 1,150 request/5hr limit in 2–3 heavy sessions.

**The volume tier is effectively unlimited:** DeepSeek V4 Flash at 31,650 req/5hr means you can run it for autocomplete, search, and quick fixes without ever thinking about limits. At 79% SWE-Verified, it's good enough for 80% of coding tasks.

**The elite tier is precious:** K2.6 and GLM-5.1 have the tightest limits (880–1,150 req/5hr) but the highest capability on the hardest tasks. Use deliberately — not for routine work.

**Rule of thumb:** If a task will take more than 100 requests, route it through V4 Flash first. Escalate to K2.6 or V4 Pro only if V4 Flash gets stuck.

## L4 Pointers

- `CAPABILITIES.md` § "Pricing & Limits" — dollar-based metering context
- `CAPABILITIES.md` § "Where It Wins vs Compromises" — capability gap analysis
- `agents-and-fallbacks.md` — how specific agents map to these tiers
- `pricing-and-limits.md` — request budgeting math
- External: https://ohmyopenagent.com/en/docs — official agent-model matching guide
