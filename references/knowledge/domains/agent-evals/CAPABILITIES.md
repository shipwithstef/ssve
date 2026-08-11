# Agent Evals & Skill Evaluation

This domain covers the methodologies, frameworks, and best practices for systematically evaluating the skills and behaviors of AI agents and coding assistants.

## 1. Core Methodology
Evaluating an agent skill requires transitioning from subjective "vibes" to concrete, deterministic, and repeatable checks. A proper eval loop consists of a specific prompt, an execution trace with artifacts, a targeted set of checks, and a quantifiable score.

## 2. Evaluation Pillars
Every skill must be evaluated against four core pillars:
- **Outcome:** Did the agent successfully complete the intended task?
- **Process:** Did the agent invoke the correct tool, skill, or step sequence?
- **Style:** Does the generated output adhere to defined conventions and formats?
- **Efficiency:** Was the execution optimal (e.g., no thrashing, redundant tool calls, or excessive token usage)?

## 3. Tooling and Mechanics
- **Deterministic Validation:** Use execution traces (e.g., `codex exec --json` to generate JSONL logs) to programmatically assert the presence of specific commands or files.
- **Qualitative Validation:** For nuanced outputs (like code architecture or design style), use a secondary LLM "Grader" pass constrained by a JSON Schema rubric to yield stable, parseable metrics.

## 4. Advanced Metrics & Controls
As agent evaluation scales to production readiness, the following metrics become standard:
- **Pass@k vs. Pass^k:** Move beyond measuring if an agent can succeed *once* in `k` attempts (Pass@k, good for capability discovery) to measuring if it succeeds *every time* across `k` attempts (Pass^k, critical for production reliability).
- **Thrashing Metrics:** Quantify agent inefficiency by measuring repetition counts, context-induced amnesia (re-reading the same file), and environment lock contentions.
- **Negative Controls:** Introduce test cases explicitly designed to ensure an agent *does not* act (e.g., ignoring irrelevant tools or correctly declining an out-of-scope request).

See [details/skill-evaluations.md](details/skill-evaluations.md) for deeper analysis on prompt strategies and metrics, and [details/framework-implementations.md](details/framework-implementations.md) for industry framework implementations (Promptfoo, LangSmith, Braintrust).