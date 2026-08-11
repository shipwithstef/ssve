# Benchmarks and Tradeoffs

## Mechanism

OpenCode Go models are positioned against frontier models on standard agentic coding benchmarks.

### SWE-Bench Pro (Real-World Engineering — Hardest Benchmark)

| Model | Score | Relative to Opus 4.7 |
|-------|-------|---------------------|
| Claude Opus 4.7 | **64.3%** | Baseline |
| Kimi K2.6 | **58.6%** | -5.7 pts |
| GLM-5.1 | **58.4%** | -5.9 pts |
| DeepSeek V4 Pro | **55.4%** | -8.9 pts |
| GPT-5.4 | 57.7% | -6.6 pts |
| Gemini 3.1 Pro | 54.2% | -10.1 pts |

**Insight:** K2.6 and GLM-5.1 are within 6 points of Opus 4.7. DeepSeek V4 Pro at 55.4% still beats Gemini 3.1 Pro.

### SWE-Bench Verified (Real-World Bug Fixes)

| Model | Score | Relative to Opus 4.7 |
|-------|-------|---------------------|
| Claude Opus 4.7 | **87.6%** | Baseline |
| DeepSeek V4 Pro | **80.6%** | -7.0 pts |
| DeepSeek V4 Flash | **79.0%** | -8.6 pts |

### LiveCodeBench (Competitive Programming)

| Model | Score |
|-------|-------|
| DeepSeek V4 Pro | **93.5%** |
| *(all frontier models)* | *lower* |

**Insight:** V4 Pro beats every frontier model on competitive programming.

### Terminal-Bench (Agentic Terminal Work)

| Model | Score | Relative to Claude 4.5 |
|-------|-------|----------------------|
| Qwen3.6 Plus | **61.6%** | Baseline |
| Claude 4.5 | 59.3% | -2.3 pts |

## Analysis

### Where You Win ✔

1. **Cost:** Save $50–200/month vs frontier API access
2. **LiveCodeBench:** DeepSeek V4 Pro at 93.5% beats every frontier model
3. **Terminal-Bench:** Qwen3.6 Plus at 61.6% beats Claude 4.5
4. **Token efficiency:** MiMo-V2.5-Pro uses 40–60% fewer tokens than Claude
5. **Rate limits:** DeepSeek V4 Flash at 31K req/5hr is effectively unlimited

### Where You Compromise ⚠

1. **SWE-Bench Verified:** Best Go model is 80.6% (V4 Pro) vs Opus 4.7 at 87.6%. That's a 7-point gap on real-world bug fixes.
2. **Oracle quality:** GLM-5.1 is excellent but not Opus 4.7. For architecture decisions on unfamiliar systems, expect ~15–20% more iterations.
3. **Multimodal:** MiMo-V2-Omni is capable but trails Gemini 3.1 Pro on vision-heavy tasks.

### Verdict

> "For 80% of coding tasks, the gap is invisible. For the remaining 20% (complex architecture, cutting-edge security, maximum accuracy), you'll need 1–2 extra iterations. The cost savings ($100–200/month) more than compensate."

This is the correct framing. Don't benchmark Go models against frontier on single tasks — benchmark them on **workload economics**.

## L4 Pointers

- `tiered-model-architecture.md` — which model to use for which task tier
- `pricing-and-limits.md` — cost math that makes the tradeoff concrete
- External: https://opencode.ai/docs/go/ — official model list with benchmarks
